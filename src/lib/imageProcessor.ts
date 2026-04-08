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

  // Cherche le pas le plus fréquent entre toutes les paires
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

  // Pour chaque ligne candidate comme origine, garde toutes les lignes qui tombent
  // sur un multiple du pas régulier — robuste aux bordures épaisses qui décalent
  // les centres des premières/dernières lignes.
  let best: number[] = []
  for (const origin of positions) {
    const matching = positions.filter((p) => {
      const dist = p - origin
      if (dist < -tol) return false
      const steps = Math.round(dist / bestSpacing)
      return Math.abs(dist - steps * bestSpacing) <= tol
    })
    if (matching.length > best.length) best = matching
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
 * Calcule le seuil optimal (méthode d'Otsu) sur un tableau de valeurs en [0,1].
 * Maximise la variance inter-classe pour séparer fond et texte.
 */
function otsuThreshold(grays: Float32Array): number {
  const hist = new Float32Array(256)
  for (let i = 0; i < grays.length; i++) hist[Math.round(grays[i] * 255)]++
  const total = grays.length
  for (let i = 0; i < 256; i++) hist[i] /= total

  let sumAll = 0
  for (let i = 0; i < 256; i++) sumAll += i * hist[i]

  let bestT = 128,
    bestVar = -1,
    w0 = 0,
    sum0 = 0
  for (let t = 0; t < 256; t++) {
    w0 += hist[t]
    sum0 += t * hist[t]
    const w1 = 1 - w0
    if (w0 === 0 || w1 === 0) continue
    const mu0 = sum0 / w0
    const mu1 = (sumAll - sum0) / w1
    const v = w0 * w1 * (mu0 - mu1) ** 2
    if (v > bestVar) {
      bestVar = v
      bestT = t
    }
  }
  return bestT / 255
}

/**
 * Convertit en noir et blanc avec seuillage adaptatif (Otsu).
 * Gère automatiquement fond clair sur texte sombre et l'inverse.
 * Résultat : texte noir sur fond blanc — format attendu par Tesseract.
 */
function adaptiveNormalize(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  const imgData = ctx.getImageData(0, 0, out.width, out.height)
  const { data } = imgData
  const n = data.length / 4

  const grays = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    grays[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255
  }

  const threshold = otsuThreshold(grays)

  // La classe majoritaire est le fond.
  // On utilise le seuil Otsu (et non 0.5) pour éviter que les fonds gris
  // (zone d'indices hors grille) soient classés comme fond sombre.
  let aboveThreshold = 0
  for (let i = 0; i < n; i++) if (grays[i] > threshold) aboveThreshold++
  const bgIsLight = aboveThreshold >= n / 2

  for (let i = 0; i < n; i++) {
    const isText = bgIsLight ? grays[i] < threshold : grays[i] > threshold
    const v = isText ? 0 : 255
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }

  ctx.putImageData(imgData, 0, 0)
  return out
}

/** Ajoute un liseré blanc autour de l'image pour améliorer la détection Tesseract aux bords. */
function addWhitePadding(src: HTMLCanvasElement, pad: number): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width + pad * 2
  out.height = src.height + pad * 2
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(src, pad, pad)
  return out
}

/**
 * Supprime les colonnes et rangées quasi-entièrement noires (traits de grille).
 * Doit être appliqué sur une image déjà normalisée en N&B.
 */
function removeGridLines(src: HTMLCanvasElement, threshold = 0.75): HTMLCanvasElement {
  const ctx = src.getContext('2d')!
  const imgData = ctx.getImageData(0, 0, src.width, src.height)
  const { data, width, height } = imgData

  for (let x = 0; x < width; x++) {
    let black = 0
    for (let y = 0; y < height; y++) if (data[(y * width + x) * 4] === 0) black++
    if (black / height > threshold) {
      for (let y = 0; y < height; y++) {
        const i = (y * width + x) * 4
        data[i] = data[i + 1] = data[i + 2] = 255
      }
    }
  }

  for (let y = 0; y < height; y++) {
    let black = 0
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4] === 0) black++
    if (black / width > threshold) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        data[i] = data[i + 1] = data[i + 2] = 255
      }
    }
  }

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  out.getContext('2d')!.putImageData(imgData, 0, 0)
  return out
}

/**
 * Rogne au contenu noir utile (bounding-box des pixels noirs restants) + marge blanche.
 * Permet de présenter à Tesseract uniquement les chiffres, sans espace mort.
 */
function cropToContent(src: HTMLCanvasElement, pad = 8): HTMLCanvasElement {
  const ctx = src.getContext('2d')!
  const { data, width, height } = ctx.getImageData(0, 0, src.width, src.height)

  let minX = width,
    maxX = -1,
    minY = height,
    maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4] === 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0) return src // aucun pixel noir trouvé

  const cx = Math.max(0, minX - pad)
  const cy = Math.max(0, minY - pad)
  const cw = Math.min(width, maxX + pad + 1) - cx
  const ch = Math.min(height, maxY + pad + 1) - cy
  return cropCanvas(src, cx, cy, cw, ch)
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

/**
 * Corrige les chiffres OCR mal collés : si un nombre dépasse maxValue (impossible
 * dans une grille de cette taille), il est séparé en ses chiffres individuels.
 * Ex : "11" avec maxValue=5  →  "1 1"
 *      "12" avec maxValue=5  →  "1 2"
 *      "11" avec maxValue=15 →  "11" (valide, inchangé)
 */
function repairClueString(raw: string, maxValue: number): string {
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
  // PSM 6 : bloc de texte uniforme — adapté à 1-2 chiffres par cellule,
  // qu'ils soient sur une ligne (indices lignes) ou empilés (indices colonnes).
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789 ',
    tessedit_pageseg_mode: '6' as unknown as Parameters<
      typeof worker.setParameters
    >[0]['tessedit_pageseg_mode'],
  })

  const processCell = async (url: string): Promise<string> => {
    const img = await loadImageFromUrl(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d')!.drawImage(img, 0, 0)

    // Pipeline : normalisation → suppression traits de grille → rognage contenu
    const cleaned = cropToContent(removeGridLines(adaptiveNormalize(canvas)))

    // Agrandir jusqu'à au moins 128px sur le plus petit côté
    const factor = Math.max(2, Math.ceil(128 / Math.min(cleaned.width, cleaned.height)))
    const prepared = addWhitePadding(upscaleCanvas(cleaned, factor), 16)

    const result = await worker.recognize(prepared)
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
      upscaleCanvas(
        addWhitePadding(adaptiveNormalize(cropCanvas(fullCanvas, cx, cy, cw, ch)), 8),
        SCALE,
      )

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
      tessedit_pageseg_mode: '6' as unknown as Parameters<
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
