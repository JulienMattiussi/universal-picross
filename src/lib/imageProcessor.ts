export interface Point {
  x: number
  y: number
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
  /** true si l'image a été détectée comme colorée */
  colored: boolean
}

// ---------------------------------------------------------------------------
// Détection de grille par analyse de projections (canvas 2D pur, sans libs)
// ---------------------------------------------------------------------------

/**
 * Détermine si l'image est colorée ou noir & blanc.
 * Mesure la saturation moyenne (espace HSL) sur un échantillon de pixels,
 * en ignorant les pixels très sombres (< 0.1) et très clairs (> 0.9) qui
 * n'apportent pas d'information chromatique fiable.
 */
function isColorImage(imageData: ImageData): boolean {
  const { data } = imageData
  const n = data.length / 4
  const step = Math.max(1, Math.floor(n / 2000))
  let totalSat = 0
  let count = 0
  for (let i = 0; i < n; i += step) {
    const r = data[i * 4] / 255
    const g = data[i * 4 + 1] / 255
    const b = data[i * 4 + 2] / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    if (l < 0.1 || l > 0.9) continue
    if (max === min) continue
    const sat = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)
    totalSat += sat
    count++
  }
  return count > 0 && totalSat / count > 0.15
}

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

/**
 * Profil de variation (edges) : pour chaque ligne/colonne, mesure la différence
 * de luminosité moyenne avec ses voisines. Les lignes de grille (même claires)
 * créent des transitions de luminosité détectables.
 */
function rowEdgeProfile(gray: Float32Array, width: number, height: number): Float32Array {
  const avg = new Float32Array(height)
  for (let y = 0; y < height; y++) {
    let sum = 0
    for (let x = 0; x < width; x++) sum += gray[y * width + x]
    avg[y] = sum / width
  }
  const profile = new Float32Array(height)
  for (let y = 1; y < height - 1; y++) {
    profile[y] = Math.abs(avg[y] - avg[y - 1]) + Math.abs(avg[y] - avg[y + 1])
  }
  return profile
}

function colEdgeProfile(gray: Float32Array, width: number, height: number): Float32Array {
  const avg = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = 0; y < height; y++) sum += gray[y * width + x]
    avg[x] = sum / height
  }
  const profile = new Float32Array(width)
  for (let x = 1; x < width - 1; x++) {
    profile[x] = Math.abs(avg[x] - avg[x - 1]) + Math.abs(avg[x] - avg[x + 1])
  }
  return profile
}

/**
 * Profil de clarté : proportion de pixels clairs par ligne/colonne.
 * Utile pour détecter des lignes de grille claires sur fond coloré.
 */
function rowLightnessProfile(gray: Float32Array, width: number, height: number): Float32Array {
  const p = new Float32Array(height)
  for (let y = 0; y < height; y++) {
    let light = 0
    for (let x = 0; x < width; x++) if (gray[y * width + x] > 0.5) light++
    p[y] = light / width
  }
  return p
}

function colLightnessProfile(gray: Float32Array, width: number, height: number): Float32Array {
  const p = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    let light = 0
    for (let y = 0; y < height; y++) if (gray[y * width + x] > 0.5) light++
    p[x] = light / height
  }
  return p
}

function tryFindGrid(
  hProfile: Float32Array,
  vProfile: Float32Array,
  thresholds: number[],
): GridStructure | null {
  for (const threshold of thresholds) {
    const rowLines = findRegularLines(findLineCenters(hProfile, threshold))
    const colLines = findRegularLines(findLineCenters(vProfile, threshold))
    if (rowLines && colLines && rowLines.length >= 4 && colLines.length >= 4)
      return { rowLines, colLines }
  }
  return null
}

/**
 * Détection conservative : lignes sombres uniquement.
 * Utilisée par detectGridBounds sur l'image complète (évite les faux positifs
 * dans les zones de texte/indices).
 */
function detectGridStructureDark(imageData: ImageData): GridStructure | null {
  const { width, height } = imageData
  const gray = toGrayscale(imageData)
  const hDark = rowDarknessProfile(gray, width, height)
  const vDark = colDarknessProfile(gray, width, height)
  return tryFindGrid(hDark, vDark, [0.5, 0.4, 0.35, 0.3, 0.25, 0.2])
}

/**
 * Détection standard : lignes sombres uniquement.
 * Code identique à l'algorithme original qui fonctionnait sur les grilles N&B.
 */
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

/**
 * Détection étendue : essaie 3 stratégies en cascade.
 * Utilisée uniquement en fallback quand detectGridStructure échoue.
 */
function detectGridStructureExtended(imageData: ImageData): GridStructure | null {
  // D'abord la détection standard
  const standard = detectGridStructure(imageData)
  if (standard) return standard

  const { width, height } = imageData
  const gray = toGrayscale(imageData)

  // Transitions de luminosité (grilles avec traits clairs ou colorés)
  const hEdge = rowEdgeProfile(gray, width, height)
  const vEdge = colEdgeProfile(gray, width, height)
  const edgeResult = tryFindGrid(hEdge, vEdge, [0.08, 0.06, 0.04, 0.03, 0.02])
  if (edgeResult) return edgeResult

  // Lignes claires (grilles claires sur fond coloré)
  const hLight = rowLightnessProfile(gray, width, height)
  const vLight = colLightnessProfile(gray, width, height)
  const lightResult = tryFindGrid(hLight, vLight, [0.5, 0.4, 0.35, 0.3, 0.25, 0.2])
  if (lightResult) return lightResult

  return null
}

/**
 * Tente de détecter automatiquement les bords de la grille de jeu sur l'image complète.
 * Retourne les deux coins opposés (haut-gauche, bas-droit) en coordonnées image,
 * ou null si aucune grille régulière n'est trouvée.
 */
export function detectGridBounds(imageData: ImageData): [Point, Point] | null {
  const grid = detectGridStructureDark(imageData)
  if (!grid) return null
  const { rowLines, colLines } = grid
  if (rowLines.length < 4 || colLines.length < 4) return null
  return [
    { x: colLines[0], y: rowLines[0] },
    { x: colLines[colLines.length - 1], y: rowLines[rowLines.length - 1] },
  ]
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
  const origX1 = Math.round(Math.min(p1.x, p2.x))
  const origY1 = Math.round(Math.min(p1.y, p2.y))
  const origX2 = Math.round(Math.max(p1.x, p2.x))
  const origY2 = Math.round(Math.max(p1.y, p2.y))

  const canvas = imageDataToCanvas(imageData)

  // Analyse de la couleur sur la zone croppée (pas l'image complète qui peut
  // avoir des éléments UI colorés autour de la grille N&B)
  const croppedForColor = cropCanvas(canvas, origX1, origY1, origX2 - origX1, origY2 - origY1)
    .getContext('2d')!
    .getImageData(0, 0, origX2 - origX1, origY2 - origY1)
  const colored = isColorImage(croppedForColor)
  const detect = colored ? detectGridStructureExtended : detectGridStructure

  // Tente la détection avec la sélection exacte, puis en élargissant par paliers
  // de 5 px pour capturer les lignes extérieures coupées par un cadrage serré.
  const EXPAND_PX = [0, 5, 10, 15]
  let grid: GridStructure | null = null
  let x1 = origX1
  let y1 = origY1
  let selW = origX2 - origX1
  let selH = origY2 - origY1

  for (const pad of EXPAND_PX) {
    x1 = Math.max(0, origX1 - pad)
    y1 = Math.max(0, origY1 - pad)
    const ex2 = Math.min(imageData.width, origX2 + pad)
    const ey2 = Math.min(imageData.height, origY2 + pad)
    selW = ex2 - x1
    selH = ey2 - y1

    const croppedData = cropCanvas(canvas, x1, y1, selW, selH)
      .getContext('2d')!
      .getImageData(0, 0, selW, selH)

    grid = detect(croppedData)
    if (grid) break
  }

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

  return { nRows, nCols, colClueCells, rowClueCells, interiorCells, colored }
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
