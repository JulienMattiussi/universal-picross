/**
 * OCR recognition: Tesseract-based clue cell reading.
 */

import type { GridCellsResult } from '@/lib/image/types'
import {
  adaptiveNormalize,
  removeGridLines,
  cropToContent,
  upscaleCanvas,
  addWhitePadding,
} from '@/lib/image/canvas'

/**
 * Corrige les chiffres OCR mal collés : si un nombre dépasse maxValue (impossible
 * dans une grille de cette taille), il est séparé en ses chiffres individuels.
 * Ex : "11" avec maxValue=5  →  "1 1"
 *      "12" avec maxValue=5  →  "1 2"
 *      "11" avec maxValue=15 →  "11" (valide, inchangé)
 */
export function repairClueString(raw: string, maxValue: number): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter((s) => s.length > 0)
    .flatMap((token) => {
      const n = parseInt(token, 10)
      if (isNaN(n)) return []
      if (n <= maxValue) return [token]
      // Nombre impossible : sépare chaque chiffre
      return token.split('').filter((d) => /[0-9]/.test(d))
    })
    .join(' ')
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.src = url
  })
}

/**
 * Reconnaît les chiffres dans chaque case d'indice individuellement.
 * Traite d'abord les cases de colonnes, puis les cases de lignes.
 * Appelle onProgress après chaque case traitée.
 */
export async function recognizeAllClueCells(
  cells: GridCellsResult,
  onProgress?: (done: number, total: number) => void,
): Promise<{ rows: string[]; cols: string[] }> {
  const { nRows, nCols, colClueCells, rowClueCells } = cells
  const total = nCols + nRows

  const { createWorker } = await import('tesseract.js')

  const OCR_TIMEOUT = 10_000

  async function makeWorker() {
    const w = await createWorker('eng', 1, { logger: () => {} })
    await w.setParameters({
      tessedit_char_whitelist: '0123456789 ',
      tessedit_pageseg_mode: '6' as unknown as Parameters<
        typeof w.setParameters
      >[0]['tessedit_pageseg_mode'],
    })
    return w
  }

  let worker = await makeWorker()

  const processCell = async (url: string): Promise<string> => {
    const img = await loadImageFromUrl(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d')!.drawImage(img, 0, 0)

    const cleaned = cropToContent(removeGridLines(adaptiveNormalize(canvas)))
    const factor = Math.max(2, Math.ceil(128 / Math.min(cleaned.width, cleaned.height)))
    const prepared = addWhitePadding(upscaleCanvas(cleaned, factor), 16)

    const result = await Promise.race([
      worker.recognize(prepared),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), OCR_TIMEOUT)),
    ])

    if (!result) {
      // Le worker est bloqué — le tuer et en recréer un
      await worker.terminate().catch(() => {})
      worker = await makeWorker()
      return ''
    }

    return result.data.text
      .trim()
      .replace(/[^0-9\n ]/g, '')
      .replace(/\n+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  const colResults: string[] = []
  for (let j = 0; j < nCols; j++) {
    colResults.push(repairClueString(await processCell(colClueCells[j]), nRows))
    onProgress?.(j + 1, total)
  }

  const rowResults: string[] = []
  for (let i = 0; i < nRows; i++) {
    rowResults.push(repairClueString(await processCell(rowClueCells[i]), nCols))
    onProgress?.(nCols + i + 1, total)
  }

  await worker.terminate()

  return { rows: rowResults, cols: colResults }
}
