import type { SolutionGrid } from './types'

export interface Point {
  x: number
  y: number
}

export interface ProcessResult {
  grid: SolutionGrid
  confidence: number
  rawClues: { rows: number[][]; cols: number[][] }
  imageUrl: string
  gridDetected: boolean
}

export interface ProcessError {
  message: string
  step: 'detection' | 'ocr' | 'parse'
}

/**
 * Résultat du découpage de la grille en cases individuelles.
 * Les données URL servent à l'affichage dans la mosaïque de vérification.
 */
export interface GridCellsResult {
  nRows: number
  nCols: number
  /** Cases d'indices colonnes (au-dessus de la grille), [nCols] */
  colClueCells: string[]
  /** Cases d'indices lignes (à gauche de la grille), [nRows] */
  rowClueCells: string[]
  /** Cases intérieures de la grille de jeu, [nRows][nCols] */
  interiorCells: string[][]
}

export type ProcessStep =
  | 'cropping'
  | 'analyzing-grid'
  | 'extracting-clues'
  | 'loading-ocr'
  | 'recognizing-rows'
  | 'recognizing-cols'
  | 'finalizing'

export const PROCESS_STEPS: ProcessStep[] = [
  'cropping',
  'analyzing-grid',
  'extracting-clues',
  'loading-ocr',
  'recognizing-rows',
  'recognizing-cols',
  'finalizing',
]

// ---------------------------------------------------------------------------
// Détection de grille par analyse de projections (canvas 2D pur, sans libs)
// ---------------------------------------------------------------------------

function toGrayscale(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData
  const gray = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    gray[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255
  }
  return gray
}

function rowDarknessProfile(gray: Float32Array, width: number, height: number): Float32Array {
  const p = new Float32Array(height)
  for (let y = 0; y < height; y++) {
    let dark = 0
    for (let x = 0; x < width; x++) if (gray[y * width + x] < 0.5) dark++
    p[y] = dark / width
  }
  return p
}

function colDarknessProfile(gray: Float32Array, width: number, height: number): Float32Array {
  const p = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    let dark = 0
    for (let y = 0; y < height; y++) if (gray[y * width + x] < 0.5) dark++
    p[x] = dark / height
  }
  return p
}

function findLineCenters(profile: Float32Array, threshold: number): number[] {
  const centers: number[] = []
  let inLine = false
  let start = 0
  for (let i = 0; i < profile.length; i++) {
    if (!inLine && profile[i] >= threshold) {
      inLine = true
      start = i
    } else if (inLine && profile[i] < threshold) {
      centers.push(Math.round((start + i - 1) / 2))
      inLine = false
    }
  }
  if (inLine) centers.push(Math.round((start + profile.length - 1) / 2))
  return centers
}

function findRegularLines(positions: number[], minCount = 4): number[] | null {
  if (positions.length < minCount) return null

  const spacingFreq = new Map<number, number>()
  for (let i = 0; i < positions.length; i++)
    for (let j = i + 1; j < positions.length; j++) {
      const s = positions[j] - positions[i]
      if (s >= 4) spacingFreq.set(s, (spacingFreq.get(s) ?? 0) + 1)
    }

  let bestSpacing = 0
  let bestFreq = 0
  for (const [s, f] of spacingFreq)
    if (f > bestFreq) {
      bestFreq = f
      bestSpacing = s
    }
  if (bestSpacing === 0) return null

  const tol = Math.max(bestSpacing * 0.25, 3)
  let best: number[] = []
  for (let i = 0; i < positions.length; i++) {
    const chain = [positions[i]]
    for (let step = 1; step <= positions.length; step++) {
      const target = positions[i] + step * bestSpacing
      const found = positions.find(
        (p) => Math.abs(p - target) <= tol && p > chain[chain.length - 1],
      )
      if (found !== undefined) chain.push(found)
      else break
    }
    if (chain.length > best.length) best = chain
  }
  return best.length >= minCount ? best : null
}

interface GridStructure {
  rowLines: number[]
  colLines: number[]
}

function detectGridStructure(imageData: ImageData): GridStructure | null {
  const { width, height } = imageData
  const gray = toGrayscale(imageData)
  const hProfile = rowDarknessProfile(gray, width, height)
  const vProfile = colDarknessProfile(gray, width, height)

  for (const threshold of [0.5, 0.4, 0.35, 0.3, 0.25, 0.2]) {
    const rowLines = findRegularLines(findLineCenters(hProfile, threshold))
    const colLines = findRegularLines(findLineCenters(vProfile, threshold))
    if (rowLines && colLines && rowLines.length >= 4 && colLines.length >= 4)
      return { rowLines, colLines }
  }
  return null
}

// ---------------------------------------------------------------------------
// Helpers canvas
// ---------------------------------------------------------------------------

function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  canvas.getContext('2d')!.putImageData(imageData, 0, 0)
  return canvas
}

function cropCanvas(
  src: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = Math.max(1, w)
  out.height = Math.max(1, h)
  out.getContext('2d')!.drawImage(src, x, y, w, h, 0, 0, w, h)
  return out
}

function upscaleCanvas(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width * factor
  out.height = src.height * factor
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, 0, 0, out.width, out.height)
  return out
}

/**
 * Normalise les couleurs : tout pixel non-blanc (noir, bleu, orange…) → noir pur.
 * Indispensable pour que Tesseract lise les chiffres colorés.
 */
function normalizeToBlackWhite(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  const img = ctx.getImageData(0, 0, out.width, out.height)
  for (let i = 0; i < img.data.length; i += 4) {
    const isWhite = img.data[i] > 200 && img.data[i + 1] > 200 && img.data[i + 2] > 200
    img.data[i] = img.data[i + 1] = img.data[i + 2] = isWhite ? 255 : 0
    img.data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return out
}

function getWords(data: Tesseract.Page): Tesseract.Word[] {
  return (data.blocks ?? []).flatMap((b) =>
    b.paragraphs.flatMap((p) => p.lines.flatMap((l) => l.words)),
  )
}

function parseNums(text: string): number[] {
  return text
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((n) => !isNaN(n) && n >= 0)
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.src = url
  })
}

// ---------------------------------------------------------------------------
// Points d'entrée publics
// ---------------------------------------------------------------------------

/**
 * Découpe l'image en cases à partir des deux coins de la GRILLE DE JEU sélectionnés.
 *
 * Convention :
 *   - p1/p2 délimitent exactement la grille de jeu (cases intérieures + bordures).
 *   - N lignes verticales détectées → N-1 colonnes.
 *   - N lignes horizontales détectées → N-1 lignes.
 *   - Les cases d'indices se trouvent à l'EXTÉRIEUR de la sélection :
 *       colonnes → au-dessus de y1, sur la largeur de chaque colonne
 *       lignes   → à gauche de x1, sur la hauteur de chaque ligne
 */
export function extractGridCells(
  imageData: ImageData,
  p1: Point,
  p2: Point,
): GridCellsResult | null {
  const x1 = Math.round(Math.min(p1.x, p2.x))
  const y1 = Math.round(Math.min(p1.y, p2.y))
  const x2 = Math.round(Math.max(p1.x, p2.x))
  const y2 = Math.round(Math.max(p1.y, p2.y))
  const selW = x2 - x1
  const selH = y2 - y1

  const canvas = imageDataToCanvas(imageData)
  const croppedData = cropCanvas(canvas, x1, y1, selW, selH)
    .getContext('2d')!
    .getImageData(0, 0, selW, selH)

  const grid = detectGridStructure(croppedData)
  if (!grid) return null

  // N+1 lignes bornent N cases
  const nRows = grid.rowLines.length - 1
  const nCols = grid.colLines.length - 1
  if (nRows < 2 || nCols < 2) return null

  // Taille uniforme des cases (en px dans l'image originale)
  const cellW = selW / nCols
  const cellH = selH / nRows

  // Zone d'indices disponible : jusqu'à 2 cases, limitée par les bords de l'image
  const clueW = Math.min(x1, Math.ceil(cellW * 2))
  const clueH = Math.min(y1, Math.ceil(cellH * 2))

  /** Extrait et retourne une data URL pour une sous-région de l'image originale */
  const cell = (cx: number, cy: number, cw: number, ch: number): string => {
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(cw))
    c.height = Math.max(1, Math.round(ch))
    c.getContext('2d')!.drawImage(
      canvas,
      Math.max(0, Math.round(cx)),
      Math.max(0, Math.round(cy)),
      Math.round(cw),
      Math.round(ch),
      0,
      0,
      Math.round(cw),
      Math.round(ch),
    )
    return c.toDataURL('image/png')
  }

  const interiorCells: string[][] = Array.from({ length: nRows }, (_, i) =>
    Array.from({ length: nCols }, (_, j) => cell(x1 + j * cellW, y1 + i * cellH, cellW, cellH)),
  )

  // Cases d'indices colonnes (au-dessus)
  const colClueCells: string[] = Array.from({ length: nCols }, (_, j) =>
    cell(x1 + j * cellW, y1 - clueH, cellW, clueH),
  )

  // Cases d'indices lignes (à gauche)
  const rowClueCells: string[] = Array.from({ length: nRows }, (_, i) =>
    cell(x1 - clueW, y1 + i * cellH, clueW, cellH),
  )

  return { nRows, nCols, colClueCells, rowClueCells, interiorCells }
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
  const worker = await createWorker('eng', 1, { logger: () => {} })
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789 ',
    tessedit_pageseg_mode: '11' as unknown as Parameters<
      typeof worker.setParameters
    >[0]['tessedit_pageseg_mode'],
  })

  const processCell = async (url: string): Promise<string> => {
    const img = await loadImageFromUrl(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    const prepared = upscaleCanvas(normalizeToBlackWhite(canvas), 4)
    const result = await worker.recognize(prepared)
    return result.data.text
      .trim()
      .replace(/[^0-9 ]/g, '')
      .trim()
  }

  const colResults: string[] = []
  for (let j = 0; j < nCols; j++) {
    colResults.push(await processCell(colClueCells[j]))
    onProgress?.(j + 1, total)
  }

  const rowResults: string[] = []
  for (let i = 0; i < nRows; i++) {
    rowResults.push(await processCell(rowClueCells[i]))
    onProgress?.(nCols + i + 1, total)
  }

  await worker.terminate()

  return { rows: rowResults, cols: colResults }
}

/**
 * Reconnaît les indices d'un picross dont les coins de grille de jeu ont été
 * sélectionnés par l'utilisateur. Les bandes d'indices sont extraites à l'extérieur
 * de la sélection ; la taille uniforme des cases sert à l'assignation spatiale OCR.
 */
export async function processImageWithCorners(
  imageData: ImageData,
  p1: Point,
  p2: Point,
  onProgress?: (step: ProcessStep) => void,
): Promise<ProcessResult | ProcessError> {
  const fullCanvas = imageDataToCanvas(imageData)
  const imageUrl = fullCanvas.toDataURL('image/png')

  try {
    // 1. Recadrage de la grille de jeu
    onProgress?.('cropping')
    const x1 = Math.round(Math.min(p1.x, p2.x))
    const y1 = Math.round(Math.min(p1.y, p2.y))
    const x2 = Math.round(Math.max(p1.x, p2.x))
    const y2 = Math.round(Math.max(p1.y, p2.y))
    const selW = x2 - x1
    const selH = y2 - y1

    const croppedData = cropCanvas(fullCanvas, x1, y1, selW, selH)
      .getContext('2d')!
      .getImageData(0, 0, selW, selH)

    // 2. Détection des lignes dans la grille de jeu
    onProgress?.('analyzing-grid')
    const grid = detectGridStructure(croppedData)

    if (!grid) {
      return {
        grid: Array.from({ length: 5 }, () => Array(5).fill(false)) as SolutionGrid,
        confidence: 0,
        rawClues: { rows: [], cols: [] },
        imageUrl,
        gridDetected: false,
      }
    }

    const nRows = grid.rowLines.length - 1
    const nCols = grid.colLines.length - 1
    const cellW = selW / nCols
    const cellH = selH / nRows

    // 3. Extraction des bandes d'indices (hors sélection)
    onProgress?.('extracting-clues')
    const clueW = Math.min(x1, Math.ceil(cellW * 2))
    const clueH = Math.min(y1, Math.ceil(cellH * 2))
    const SCALE = 4

    const prepare = (cx: number, cy: number, cw: number, ch: number) =>
      upscaleCanvas(normalizeToBlackWhite(cropCanvas(fullCanvas, cx, cy, cw, ch)), SCALE)

    // Bande lignes : à gauche de x1
    const rowStrip = prepare(x1 - clueW, y1, clueW, selH)
    // Bande colonnes : au-dessus de y1
    const colStrip = prepare(x1, y1 - clueH, selW, clueH)

    // 4. Chargement OCR
    onProgress?.('loading-ocr')
    const { createWorker } = await import('tesseract.js')
    const worker = await createWorker('eng', 1, { logger: () => {} })
    await worker.setParameters({
      tessedit_char_whitelist: '0123456789 ',
      tessedit_pageseg_mode: '11' as unknown as Parameters<
        typeof worker.setParameters
      >[0]['tessedit_pageseg_mode'],
    })

    // 5 & 6. OCR des deux bandes
    onProgress?.('recognizing-rows')
    const rowResult = await worker.recognize(rowStrip, {}, { blocks: true })
    onProgress?.('recognizing-cols')
    const colResult = await worker.recognize(colStrip, {}, { blocks: true })
    await worker.terminate()

    // 7. Assignation spatiale par taille de case uniforme
    onProgress?.('finalizing')
    const rowClues: number[][] = Array.from({ length: nRows }, () => [])
    const colClues: number[][] = Array.from({ length: nCols }, () => [])

    for (const word of getWords(rowResult.data)) {
      // absY = position dans la bande + y1 (début de la grille)
      const absY = (word.bbox.y0 + word.bbox.y1) / 2 / SCALE + y1
      const i = Math.floor((absY - y1) / cellH)
      if (i >= 0 && i < nRows) rowClues[i].push(...parseNums(word.text))
    }

    for (const word of getWords(colResult.data)) {
      // absX = position dans la bande + x1
      const absX = (word.bbox.x0 + word.bbox.x1) / 2 / SCALE + x1
      const j = Math.floor((absX - x1) / cellW)
      if (j >= 0 && j < nCols) colClues[j].push(...parseNums(word.text))
    }

    const confidence = Math.max(rowResult.data.confidence, colResult.data.confidence) / 100
    const size = Math.max(nRows, nCols, 5)
    const emptyGrid: SolutionGrid = Array.from({ length: size }, () => Array(size).fill(false))

    return {
      grid: emptyGrid,
      confidence,
      rawClues: { rows: rowClues, cols: colClues },
      imageUrl,
      gridDetected: true,
    }
  } catch (err) {
    return {
      message: err instanceof Error ? err.message : 'Erreur inconnue',
      step: 'detection',
    }
  }
}
