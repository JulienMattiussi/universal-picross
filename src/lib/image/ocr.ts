/**
 * OCR recognition: Tesseract-based clue cell reading + template matching fallback.
 */

import type { GridCellsResult } from '@/lib/image/types'
import {
  adaptiveNormalize,
  removeBorderArtifacts,
  removeGridLines,
  cropToContent,
  upscaleCanvas,
  addWhitePadding,
} from '@/lib/image/canvas'
import { matchCellDigits, segmentBlobs, extractBlob } from '@/lib/image/templateMatch'
import { addWhitePadding as padBlob } from '@/lib/image/canvas'
import { matchCanvasAgainstLearnedBank, type BankCandidate } from '@/lib/image/learnedBank'
import { getAvailableLearnedBanks } from '@/lib/image/bankRegistry'

/** Seuil minimum pour considérer qu'une banque apprise reconnaît correctement un blob. */
const LEARNED_BANK_THRESHOLD = 0.5

/**
 * Corrige les chiffres OCR mal collés : si un nombre dépasse maxValue (impossible
 * dans une grille de cette taille), il est séparé en ses chiffres individuels.
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
 * Pipeline : Tesseract d'abord, template matching en fallback si Tesseract échoue.
 */
export async function recognizeAllClueCells(
  cells: GridCellsResult,
  onProgress?: (done: number, total: number) => void,
  debug = false,
): Promise<{ rows: string[]; cols: string[] }> {
  const { nRows, nCols, colClueCells, rowClueCells } = cells
  const total = nCols + nRows

  // Prépare le canvas d'une case (commun aux deux méthodes)
  const prepareCell = async (url: string): Promise<HTMLCanvasElement> => {
    const img = await loadImageFromUrl(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    const cleaned = cropToContent(removeGridLines(removeBorderArtifacts(adaptiveNormalize(canvas))))
    const factor = Math.max(2, Math.ceil(128 / Math.min(cleaned.width, cleaned.height)))
    return addWhitePadding(upscaleCanvas(cleaned, factor), 16)
  }

  // Charge les banques apprises packagées (Free Picross etc.)
  let learnedBanks: BankCandidate[] = []
  try {
    learnedBanks = await getAvailableLearnedBanks()
  } catch (e) {
    if (debug) console.warn('[OCR] échec chargement banques apprises', e)
  }
  if (debug)
    console.log(
      `[OCR] ${learnedBanks.length} banque(s) apprise(s) chargée(s):`,
      learnedBanks.map((b) => `${b.name}(${b.bank.length})`).join(', '),
    )

  // Tesseract pour toutes les images (N&B et couleur)
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
  let cellIndex = 0

  /** Reconnaît un seul blob via Tesseract (avec timeout) */
  const tesseractBlob = async (blobCanvas: HTMLCanvasElement): Promise<string> => {
    const padded = padBlob(blobCanvas, 8)
    try {
      const result = await Promise.race([
        worker.recognize(padded),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), OCR_TIMEOUT)),
      ])
      if (result) {
        return result.data.text
          .trim()
          .replace(/[^0-9\n ]/g, '')
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
      worker.terminate().catch(() => {})
      worker = await makeWorker()
      return ''
    } catch {
      worker.terminate().catch(() => {})
      worker = await makeWorker()
      return ''
    }
  }

  const processCell = async (url: string, label: string): Promise<string> => {
    cellIndex++
    const prepared = await prepareCell(url)

    if (debug) console.log(`\n[OCR #${cellIndex}] ${label}`)

    // Segmenter en blobs individuels
    const blobs = segmentBlobs(prepared)

    if (blobs.length === 0) {
      if (debug) console.log(`[OCR #${cellIndex}] Aucun blob`)
      return ''
    }

    const tessDigits: string[] = []
    const tmplDigits: string[] = []
    const learnedDigits: string[] = []
    let learnedScoreSum = 0
    let learnedScoreCount = 0

    for (let b = 0; b < blobs.length; b++) {
      const blobCanvas = extractBlob(prepared, blobs[b])

      // 1. Banque apprise (Free Picross, etc.) — la plus précise quand applicable
      let learnedResult = ''
      let bestLearnedScore = 0
      let bestBankName = ''
      for (const candidate of learnedBanks) {
        const m = matchCanvasAgainstLearnedBank(blobCanvas, candidate.bank)
        const score = Math.max(m.iou.score, m.hausdorff.score)
        if (score > bestLearnedScore) {
          bestLearnedScore = score
          bestBankName = candidate.name
          // Préférer Hausdorff sur banque apprise, équivalent à IoU dans nos tests
          const digit = m.hausdorff.score >= m.iou.score ? m.hausdorff.digit : m.iou.digit
          learnedResult = digit >= 0 ? String(digit) : ''
        }
      }

      // 2. Template matching générique
      const tmplResult = matchCellDigits(blobCanvas, debug)

      // 3. Tesseract
      const tessResult = await tesseractBlob(blobCanvas)

      if (debug) {
        const { w, h } = blobs[b]
        console.log(
          `[OCR #${cellIndex}] Blob ${b + 1}/${blobs.length} (${w}×${h})  ` +
            `Appris (${bestBankName}): %c${learnedResult || '·'} (${(bestLearnedScore * 100).toFixed(0)}%)%c  ` +
            `Tesseract: %c${tessResult || '·'}%c  Template: %c${tmplResult || '·'}`,
          bestLearnedScore >= LEARNED_BANK_THRESHOLD
            ? 'color:purple;font-weight:bold'
            : 'color:gray',
          '',
          tessResult ? 'color:green;font-weight:bold' : 'color:red',
          '',
          tmplResult ? 'color:green;font-weight:bold' : 'color:red',
        )
      }

      if (
        learnedResult &&
        /[0-9]/.test(learnedResult) &&
        bestLearnedScore >= LEARNED_BANK_THRESHOLD
      ) {
        learnedDigits.push(learnedResult)
        learnedScoreSum += bestLearnedScore
        learnedScoreCount++
      }
      if (tessResult && /[0-9]/.test(tessResult)) tessDigits.push(tessResult)
      if (tmplResult && /[0-9]/.test(tmplResult)) tmplDigits.push(tmplResult)
    }

    const learnedAll = learnedDigits.join(' ')
    const tessAll = tessDigits.join(' ')
    const tmplAll = tmplDigits.join(' ')
    const hasLearned = learnedDigits.length === blobs.length && learnedAll.length > 0
    const hasTess = tessAll.length > 0
    const hasTmpl = tmplAll.length > 0
    const chosen = hasLearned ? 'Appris' : hasTess ? 'Tesseract' : hasTmpl ? 'Template' : 'rien'
    const finalResult = hasLearned ? learnedAll : hasTess ? tessAll : hasTmpl ? tmplAll : ''

    if (debug) {
      const avgScore = learnedScoreCount > 0 ? learnedScoreSum / learnedScoreCount : 0
      console.log(
        `[OCR #${cellIndex}] FINAL → %c${chosen}: ${finalResult || '?'}` +
          (hasLearned ? ` (banque apprise, score moyen ${(avgScore * 100).toFixed(0)}%)` : ''),
        'color:blue;font-weight:bold',
      )
    }

    return finalResult
  }

  const colResults: string[] = []
  for (let j = 0; j < nCols; j++) {
    colResults.push(repairClueString(await processCell(colClueCells[j], `Col ${j + 1}`), nRows))
    onProgress?.(j + 1, total)
  }

  const rowResults: string[] = []
  for (let i = 0; i < nRows; i++) {
    rowResults.push(repairClueString(await processCell(rowClueCells[i], `Lig ${i + 1}`), nCols))
    onProgress?.(nCols + i + 1, total)
  }

  await worker.terminate()

  return { rows: rowResults, cols: colResults }
}
