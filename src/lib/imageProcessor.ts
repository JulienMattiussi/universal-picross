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
 * Profil de saturation : proportion de pixels saturés par ligne/colonne.
 * Les lignes de grille colorées (orange, bleu…) ont une saturation élevée
 * alors que les cases (blanches/grises) sont désaturées.
 */
function pixelSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === 0) return 0
  return (max - min) / max
}

function rowSaturationProfile(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData
  const p = new Float32Array(height)
  for (let y = 0; y < height; y++) {
    let sat = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      sat += pixelSaturation(data[i], data[i + 1], data[i + 2])
    }
    p[y] = sat / width
  }
  return p
}

function colSaturationProfile(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData
  const p = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    let sat = 0
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4
      sat += pixelSaturation(data[i], data[i + 1], data[i + 2])
    }
    p[x] = sat / height
  }
  return p
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

/** maxLines : nombre max de lignes accepté (une grille 20×20 a 21 lignes) */
function tryFindGrid(
  hProfile: Float32Array,
  vProfile: Float32Array,
  thresholds: number[],
  maxLines = 25,
): GridStructure | null {
  for (const threshold of thresholds) {
    const rowLines = findRegularLines(findLineCenters(hProfile, threshold))
    const colLines = findRegularLines(findLineCenters(vProfile, threshold))
    if (
      rowLines &&
      colLines &&
      rowLines.length >= 4 &&
      colLines.length >= 4 &&
      rowLines.length <= maxLines &&
      colLines.length <= maxLines
    )
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
/**
 * Si les lignes détectées sont espacées d'un multiple de N cases (ex: groupes de 5),
 * subdivise pour retrouver chaque case individuelle.
 * Teste les diviseurs 2..6 et garde celui qui produit le meilleur résultat.
 */
function subdivideLines(lines: number[]): number[] {
  if (lines.length < 2) return lines
  const spacings = lines.slice(1).map((l, i) => l - lines[i])
  const avgSpacing = spacings.reduce((a, b) => a + b, 0) / spacings.length

  for (const divisor of [5, 4, 3, 2, 6]) {
    const subSpacing = avgSpacing / divisor
    if (subSpacing < 4) continue // trop petit pour être une case
    // Vérifier que tous les espacements sont proches d'un multiple du diviseur
    const tol = subSpacing * 0.3
    const allMatch = spacings.every(
      (s) => Math.abs(s - Math.round(s / subSpacing) * subSpacing) <= tol,
    )
    if (!allMatch) continue

    // Subdiviser
    const result: number[] = [lines[0]]
    for (let i = 0; i < lines.length - 1; i++) {
      const steps = Math.round((lines[i + 1] - lines[i]) / subSpacing)
      const step = (lines[i + 1] - lines[i]) / steps
      for (let s = 1; s <= steps; s++) {
        result.push(Math.round(lines[i] + s * step))
      }
    }
    return result
  }
  return lines
}

/** @internal Réservé pour le mode couleur futur */
export function detectGridStructureExtended(imageData: ImageData): GridStructure | null {
  // D'abord la détection standard (lignes sombres)
  const standard = detectGridStructure(imageData)
  if (standard) return standard

  // Saturation : les lignes de grille colorées ressortent en saturation
  const hSat = rowSaturationProfile(imageData)
  const vSat = colSaturationProfile(imageData)
  // Saturation avec seuils élevés uniquement pour éviter le bruit
  const satResult = tryFindGrid(hSat, vSat, [0.3, 0.25, 0.2, 0.15])
  if (satResult) {
    // Si peu de lignes trouvées (< 10), ce sont probablement les séparateurs
    // de groupes (5×5). Subdiviser pour retrouver chaque case individuelle.
    const rowLines =
      satResult.rowLines.length < 10 ? subdivideLines(satResult.rowLines) : satResult.rowLines
    const colLines =
      satResult.colLines.length < 10 ? subdivideLines(satResult.colLines) : satResult.colLines
    if (
      rowLines.length >= 4 &&
      colLines.length <= 25 &&
      colLines.length >= 4 &&
      rowLines.length <= 25
    )
      return { rowLines, colLines }
  }

  const { width, height } = imageData
  const gray = toGrayscale(imageData)

  // Transitions de luminosité (seuils conservateurs)
  const hEdge = rowEdgeProfile(gray, width, height)
  const vEdge = colEdgeProfile(gray, width, height)
  const edgeResult = tryFindGrid(hEdge, vEdge, [0.08, 0.06, 0.04])
  if (edgeResult) return edgeResult

  // Lignes claires
  const hLight = rowLightnessProfile(gray, width, height)
  const vLight = colLightnessProfile(gray, width, height)
  const lightResult = tryFindGrid(hLight, vLight, [0.5, 0.4, 0.35, 0.3])
  if (lightResult) return lightResult

  return null
}

/**
 * Tente de détecter automatiquement les bords de la grille de jeu sur l'image complète.
 * Retourne les deux coins opposés (haut-gauche, bas-droit) en coordonnées image,
 * ou null si aucune grille régulière n'est trouvée.
 */
export function detectGridBounds(imageData: ImageData, debug = false): [Point, Point] | null {
  const log = debug ? (...args: unknown[]) => console.log('[bounds]', ...args) : () => {}

  // Stratégie 1 : lignes sombres (grilles N&B)
  const grid = detectGridStructureDark(imageData)
  log('dark', grid ? `${grid.rowLines.length}r × ${grid.colLines.length}c` : 'null')
  if (grid && grid.rowLines.length >= 4 && grid.colLines.length >= 4) {
    const result: [Point, Point] = [
      { x: grid.colLines[0], y: grid.rowLines[0] },
      { x: grid.colLines[grid.colLines.length - 1], y: grid.rowLines[grid.rowLines.length - 1] },
    ]
    log('result (dark)', result)
    return result
  }

  // Stratégie 2 : scan de contrastes depuis les bords (grilles couleur)
  const edgeResult = detectGridBoundsByEdgeScan(imageData, log)
  log('result (edgeScan)', edgeResult)
  return edgeResult
}

/**
 * Détecte les bords de la grille en scannant depuis les 4 bords de l'image vers l'intérieur.
 * Sur plusieurs lignes parallèles, cherche la première position où un contraste
 * apparaît de manière cohérente (même position ± tolérance sur toutes les lignes).
 */
function detectGridBoundsByEdgeScan(
  imageData: ImageData,
  log: (...args: unknown[]) => void = () => {},
): [Point, Point] | null {
  const { width, height, data } = imageData
  const SAMPLE_COUNT = 10
  const THRESHOLD = 0.08
  const TOLERANCE = 10

  log('edgeScan start', { width, height, threshold: THRESHOLD })

  function findEdge(label: string, horizontal: boolean, fromStart: boolean): number | null {
    const scanLen = horizontal ? width : height
    const crossLen = horizontal ? height : width
    const positions: number[] = []
    const refLums: number[] = []

    for (let s = 0; s < SAMPLE_COUNT; s++) {
      const crossPos = Math.floor((crossLen * (s + 1)) / (SAMPLE_COUNT + 1))

      const refIdx = fromStart ? 0 : scanLen - 1
      const rx = horizontal ? refIdx : crossPos
      const ry = horizontal ? crossPos : refIdx
      const refLum = getLuminosity(data, width, rx, ry)
      refLums.push(refLum)

      let found = false
      for (let i = 0; i < scanLen; i++) {
        const pos = fromStart ? i : scanLen - 1 - i
        const x = horizontal ? pos : crossPos
        const y = horizontal ? crossPos : pos
        const lum = getLuminosity(data, width, x, y)

        if (Math.abs(lum - refLum) > THRESHOLD) {
          positions.push(pos)
          found = true
          break
        }
      }
      if (!found) positions.push(-1)
    }

    log(
      `  ${label}: refLums=[${refLums.map((l) => l.toFixed(2)).join(', ')}] positions=[${positions.join(', ')}]`,
    )

    const valid = positions.filter((p) => p >= 0)
    if (valid.length < 2) {
      log(`  ${label}: FAILED — only ${valid.length} valid positions`)
      return null
    }

    // Pour les bords "fromStart" (left, top), la grille est plus loin que le texte
    // → chercher le groupe de positions les plus éloignées du bord.
    // Pour les bords "fromEnd" (right, bottom), la grille est plus loin aussi
    // → chercher le groupe le plus éloigné.
    valid.sort((a, b) => a - b)

    // Grouper les positions proches (± tolérance)
    const groups: number[][] = []
    for (const p of valid) {
      const lastGroup = groups[groups.length - 1]
      if (lastGroup && Math.abs(p - lastGroup[lastGroup.length - 1]) <= TOLERANCE) {
        lastGroup.push(p)
      } else {
        groups.push([p])
      }
    }

    // Pour fromStart (left, top) : la grille est plus loin du bord que le texte
    // → prendre le dernier groupe (le plus éloigné) qui a au moins 2 membres.
    // Pour fromEnd (right, bottom) : prendre le premier groupe (le plus éloigné du bord opposé).
    const ordered = fromStart ? [...groups].reverse() : groups
    const bestGroup = ordered.find((g) => g.length >= 2)

    if (!bestGroup) {
      log(`  ${label}: FAILED — no group with >= 2 positions`)
      return null
    }

    const result = Math.round(bestGroup.reduce((a, b) => a + b, 0) / bestGroup.length)
    log(`  ${label}: OK pos=${result} (group of ${bestGroup.length})`)
    return result
  }

  const left = findEdge('left', true, true)
  const right = findEdge('right', true, false)
  const top = findEdge('top', false, true)
  const bottom = findEdge('bottom', false, false)

  log('edgeScan results', { left, right, top, bottom })

  if (left == null || right == null || top == null || bottom == null) return null
  if (right - left < 50 || bottom - top < 50) return null

  return [
    { x: left, y: top },
    { x: right, y: bottom },
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
// Détection de grille couleur par balayage de teinte
// ---------------------------------------------------------------------------

/**
 * Parcourt une ligne de pixels et retourne les positions des séparateurs (bordures entre cases).
 * Un séparateur = zone courte où la luminosité diffère du fond des cases.
 */
function scanLineForSeparators(imageData: ImageData, pos: number, horizontal: boolean): number[] {
  const { width, height, data } = imageData
  const len = horizontal ? width : height

  const lum = new Float32Array(len)
  for (let i = 0; i < len; i++) {
    const px = horizontal ? i : pos
    const py = horizontal ? pos : i
    const idx = (py * width + px) * 4
    lum[i] = (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255
  }

  // Calculer la luminosité médiane (fond des cases)
  const sorted = [...lum].sort()
  const median = sorted[Math.floor(sorted.length / 2)]
  const threshold = 0.06

  // Trouver les zones qui s'écartent de la médiane (séparateurs)
  const separators: number[] = []
  let inSep = false
  let sepStart = 0
  for (let i = 0; i < len; i++) {
    const isSep = Math.abs(lum[i] - median) > threshold
    if (isSep && !inSep) {
      inSep = true
      sepStart = i
    } else if (!isSep && inSep) {
      inSep = false
      separators.push(Math.round((sepStart + i) / 2))
    }
  }

  return separators
}

/**
 * À partir de positions de séparateurs bruts, trouve un espacement régulier
 * et reconstruit les positions de toutes les lignes de grille.
 */
function regularizePositions(separators: number[], totalLen: number): number[] | null {
  if (separators.length < 2) return null

  // Calculer tous les espacements entre séparateurs consécutifs
  const spacings = separators.slice(1).map((s, i) => s - separators[i])

  // Trouver le plus petit espacement fréquent (= taille d'une case)
  const minSpacing = Math.min(...spacings)
  const maxSpacing = Math.max(...spacings)

  // Si les espacements sont réguliers, utiliser directement
  if (maxSpacing - minSpacing <= minSpacing * 0.3) {
    return separators
  }

  // Sinon, chercher le GCD approximatif des espacements (taille d'une case)
  let cellSize = minSpacing
  for (const s of spacings) {
    const ratio = s / cellSize
    if (Math.abs(ratio - Math.round(ratio)) > 0.3) {
      // Pas un multiple propre — essayer un cellSize plus petit
      cellSize = Math.min(cellSize, s / Math.round(ratio))
    }
  }
  if (cellSize < totalLen * 0.02) return null // trop petit

  // Reconstruire les lignes régulières à partir du premier séparateur
  const first = separators[0]
  const lines: number[] = []
  for (let pos = first; pos <= totalLen; pos += cellSize) {
    lines.push(Math.round(pos))
  }
  // Ajouter aussi avant le premier séparateur si possible
  for (let pos = first - cellSize; pos >= 0; pos -= cellSize) {
    lines.unshift(Math.round(pos))
  }

  return lines.length >= 4 ? lines : null
}

/**
 * Détecte la structure de grille en scannant les séparateurs à plusieurs positions,
 * puis reconstruit les positions exactes des lignes.
 */
function detectGridByHueScan(imageData: ImageData): GridStructure | null {
  const { width, height } = imageData
  const sampleCount = 5

  // Scanner les colonnes (balayages horizontaux)
  const colScans: number[][] = []
  for (let s = 0; s < sampleCount; s++) {
    const y = Math.floor((height * (s + 1)) / (sampleCount + 1))
    const seps = scanLineForSeparators(imageData, y, true)
    if (seps.length >= 3) colScans.push(seps)
  }

  // Scanner les lignes (balayages verticaux)
  const rowScans: number[][] = []
  for (let s = 0; s < sampleCount; s++) {
    const x = Math.floor((width * (s + 1)) / (sampleCount + 1))
    const seps = scanLineForSeparators(imageData, x, false)
    if (seps.length >= 3) rowScans.push(seps)
  }

  if (colScans.length === 0 || rowScans.length === 0) return null

  // Prendre le scan qui a le plus de séparateurs (le plus complet)
  const bestColScan = colScans.reduce((a, b) => (a.length >= b.length ? a : b))
  const bestRowScan = rowScans.reduce((a, b) => (a.length >= b.length ? a : b))

  const colLines = regularizePositions(bestColScan, width)
  const rowLines = regularizePositions(bestRowScan, height)

  if (!colLines || !rowLines) return null
  if (colLines.length < 4 || colLines.length > 25) return null
  if (rowLines.length < 4 || rowLines.length > 25) return null

  return { rowLines, colLines }
}

// ---------------------------------------------------------------------------
// Expansion de coins : depuis deux points intérieurs, cherche les bords de la grille
// ---------------------------------------------------------------------------

/**
 * Mesure la luminosité d'un pixel dans l'image.
 */
function getLuminosity(data: Uint8ClampedArray, width: number, x: number, y: number): number {
  const idx = (y * width + x) * 4
  return (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255
}

/**
 * Depuis deux points cliqués à l'intérieur de cases (coins opposés),
 * étend chaque bord vers l'extérieur en cherchant le dernier trait de grille.
 *
 * Stratégie : on part du bord de la sélection et on avance vers l'extérieur.
 * On compare la luminosité de chaque pixel à la luminosité de référence
 * (moyenne de la case cliquée). Un "trait" = zone courte (< 15px) qui diffère.
 * On retient la position après le dernier trait trouvé = bord extérieur de la grille.
 * Si on tombe sur une zone épaisse qui diffère (> 15px), c'est du texte/indices → stop.
 */
export function expandCornersToGridEdges(
  imageData: ImageData,
  p1: Point,
  p2: Point,
  debug = false,
): [Point, Point] {
  const { width, height, data } = imageData
  const MAX_SEARCH = 300
  const THRESHOLD = 0.08

  function refLuminosity(cx: number, cy: number): number {
    let sum = 0
    let count = 0
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const x = Math.max(0, Math.min(width - 1, Math.round(cx) + dx))
        const y = Math.max(0, Math.min(height - 1, Math.round(cy) + dy))
        sum += getLuminosity(data, width, x, y)
        count++
      }
    }
    return sum / count
  }

  /**
   * Cherche le premier trait en partant de startPos dans la direction step.
   * Retourne la position juste après le premier trait fin trouvé.
   * Utilisé vers le haut et la gauche (direction des indices).
   */
  function findFirstEdge(
    startPos: number,
    fixedPos: number,
    step: number,
    horizontal: boolean,
    refLum: number,
  ): number {
    let inEdge = false
    let edgeStart = 0

    for (let i = 1; i <= MAX_SEARCH; i++) {
      const pos = startPos + step * i
      if (step > 0 && pos >= (horizontal ? width - 1 : height - 1)) break
      if (step < 0 && pos <= 0) break

      const x = horizontal ? pos : fixedPos
      const y = horizontal ? fixedPos : pos
      const lum = getLuminosity(data, width, x, y)
      const diff = Math.abs(lum - refLum)

      if (!inEdge && diff > THRESHOLD) {
        inEdge = true
        edgeStart = pos
      } else if (inEdge && diff <= THRESHOLD) {
        const edgeWidth = Math.abs(pos - edgeStart)
        if (edgeWidth <= 5) return pos // trait de grille (1-5px)
        break // zone épaisse (chiffre, texte)
      }
    }

    return startPos // aucun trait trouvé, garder la position d'origine
  }

  /**
   * Cherche le dernier trait en partant de startPos dans la direction step.
   * Traverse tous les traits fins et retourne la position après le dernier.
   * Utilisé vers le bas et la droite (bord extérieur de la grille).
   */
  function findLastEdge(
    startPos: number,
    fixedPos: number,
    step: number,
    horizontal: boolean,
    refLum: number,
  ): number {
    let lastEdgeEnd = startPos
    let inEdge = false
    let edgeStart = 0

    for (let i = 1; i <= MAX_SEARCH; i++) {
      const pos = startPos + step * i
      if (step > 0 && pos >= (horizontal ? width - 1 : height - 1)) break
      if (step < 0 && pos <= 0) break

      const x = horizontal ? pos : fixedPos
      const y = horizontal ? fixedPos : pos
      const lum = getLuminosity(data, width, x, y)
      const diff = Math.abs(lum - refLum)

      if (!inEdge && diff > THRESHOLD) {
        inEdge = true
        edgeStart = pos
      } else if (inEdge && diff <= THRESHOLD) {
        inEdge = false
        const edgeWidth = Math.abs(pos - edgeStart)
        if (edgeWidth > 15) break // zone épaisse (texte, hors grille)
        lastEdgeEnd = pos
      }
    }

    return lastEdgeEnd
  }

  const x1 = Math.round(Math.min(p1.x, p2.x))
  const y1 = Math.round(Math.min(p1.y, p2.y))
  const x2 = Math.round(Math.max(p1.x, p2.x))
  const y2 = Math.round(Math.max(p1.y, p2.y))

  const midY = Math.round((y1 + y2) / 2)
  const midX = Math.round((x1 + x2) / 2)

  const refLumH = (refLuminosity(x1, midY) + refLuminosity(x2, midY)) / 2
  const refLumV = (refLuminosity(midX, y1) + refLuminosity(midX, y2)) / 2

  // Vers les indices (haut, gauche) : premier trait seulement
  const left = findFirstEdge(x1, midY, -1, true, refLumH)
  const top = findFirstEdge(y1, midX, -1, false, refLumV)
  // Vers l'extérieur (bas, droite) : dernier trait
  const right = findLastEdge(x2, midY, 1, true, refLumH)
  const bottom = findLastEdge(y2, midX, 1, false, refLumV)

  const result: [Point, Point] = [
    { x: left, y: top },
    { x: right, y: bottom },
  ]
  if (debug) {
    console.log('[expand] input', { p1, p2 })
    console.log('[expand] refLum', { H: refLumH.toFixed(3), V: refLumV.toFixed(3) })
    console.log('[expand] result', { left, top, right, bottom })
  }
  return result
}

// ---------------------------------------------------------------------------
// Analyse de bandes (debug) — parcourt la grille pixel par pixel
// ---------------------------------------------------------------------------

interface Band {
  /** Luminosité moyenne de la bande (0-1) */
  lum: number
  /** Largeur en pixels */
  width: number
}

/**
 * Parcourt une ligne de l'image et retourne les bandes de luminosité homogène.
 * Ex: [{lum:0.95, width:2}, {lum:0.4, width:30}, {lum:0.92, width:2}, ...]
 * = trait 2px, case 30px, trait 2px, ...
 */
function scanBands(imageData: ImageData, pos: number, horizontal: boolean): Band[] {
  const { width, height, data } = imageData
  const len = horizontal ? width : height
  const bands: Band[] = []
  const TOLERANCE = 0.06

  let bandStart = 0
  let bandLum = getLuminosity(data, width, horizontal ? 0 : pos, horizontal ? pos : 0)

  for (let i = 1; i < len; i++) {
    const x = horizontal ? i : pos
    const y = horizontal ? pos : i
    const lum = getLuminosity(data, width, x, y)

    if (Math.abs(lum - bandLum) > TOLERANCE) {
      bands.push({ lum: bandLum, width: i - bandStart })
      bandStart = i
      bandLum = lum
    } else {
      // Moyenne glissante de la luminosité de la bande
      bandLum = (bandLum * (i - bandStart) + lum) / (i - bandStart + 1)
    }
  }
  bands.push({ lum: bandLum, width: len - bandStart })

  return bands
}

/**
 * Analyse la structure de bandes de la zone croppée et affiche le résultat en console.
 */
function debugBandAnalysis(imageData: ImageData, log: (...args: unknown[]) => void): void {
  const { width, height } = imageData
  const sampleCount = 3

  log('=== BAND ANALYSIS ===')
  log(`image size: ${width} × ${height}`)

  // Scans horizontaux
  for (let s = 0; s < sampleCount; s++) {
    const y = Math.floor((height * (s + 1)) / (sampleCount + 1))
    const bands = scanBands(imageData, y, true)
    const widths = bands.map((b) => b.width)
    const sorted = [...widths].sort((a, b) => b - a)
    const large = widths.filter((w) => w > 5)
    log(
      `H y=${y}: ${widths.join(' ')} → ${large.length} large bands (top: ${sorted.slice(0, 5).join(', ')})`,
    )
  }

  // Scans verticaux
  for (let s = 0; s < sampleCount; s++) {
    const x = Math.floor((width * (s + 1)) / (sampleCount + 1))
    const bands = scanBands(imageData, x, false)
    const widths = bands.map((b) => b.width)
    const sorted = [...widths].sort((a, b) => b - a)
    const large = widths.filter((w) => w > 5)
    log(
      `V x=${x}: ${widths.join(' ')} → ${large.length} large bands (top: ${sorted.slice(0, 5).join(', ')})`,
    )
  }

  log('=== END BAND ANALYSIS ===')
}

/**
 * Détecte la grille par analyse de bandes de luminosité.
 * Identifie l'alternance trait/case, en déduit le nombre de cases et leurs positions.
 * Retourne un GridStructure avec les positions des lignes de séparation.
 */
function detectGridByBands(imageData: ImageData): GridStructure | null {
  const { width, height } = imageData
  const sampleCount = 3

  function extractCellPositions(bands: Band[]): number[] | null {
    if (bands.length < 5) return null

    // Trouver la largeur médiane des grandes bandes (cases)
    const widths = bands.map((b) => b.width)
    const sorted = [...widths].sort((a, b) => b - a)
    // La largeur "case" est la plus fréquente parmi les grandes bandes
    const largeBands = widths.filter((w) => w > sorted[0] * 0.5)
    if (largeBands.length < 3) return null
    const medianCell = largeBands.sort((a, b) => a - b)[Math.floor(largeBands.length / 2)]

    // Seuil : une bande est une "case" si sa largeur > 50% de la médiane
    const cellThreshold = medianCell * 0.5

    // Parcourir les bandes et extraire les positions des séparations
    const lines: number[] = []
    let pos = 0
    for (const band of bands) {
      if (band.width >= cellThreshold) {
        // C'est une case — les lignes de grille sont aux bords
        lines.push(pos)
        lines.push(pos + band.width)
      }
      pos += band.width
    }

    // Dédupliquer les positions proches (< 8px)
    const deduped: number[] = [lines[0]]
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] - deduped[deduped.length - 1] >= 8) {
        deduped.push(lines[i])
      }
    }

    return deduped.length >= 4 ? deduped : null
  }

  // Scanner horizontalement à plusieurs hauteurs, garder le meilleur
  let bestColLines: number[] | null = null
  for (let s = 0; s < sampleCount; s++) {
    const y = Math.floor((height * (s + 1)) / (sampleCount + 1))
    const bands = scanBands(imageData, y, true)
    const positions = extractCellPositions(bands)
    if (positions && (!bestColLines || positions.length > bestColLines.length)) {
      bestColLines = positions
    }
  }

  // Scanner verticalement à plusieurs positions
  let bestRowLines: number[] | null = null
  for (let s = 0; s < sampleCount; s++) {
    const x = Math.floor((width * (s + 1)) / (sampleCount + 1))
    const bands = scanBands(imageData, x, false)
    const positions = extractCellPositions(bands)
    if (positions && (!bestRowLines || positions.length > bestRowLines.length)) {
      bestRowLines = positions
    }
  }

  if (!bestColLines || !bestRowLines) return null
  if (bestColLines.length < 4 || bestColLines.length > 25) return null
  if (bestRowLines.length < 4 || bestRowLines.length > 25) return null

  return { rowLines: bestRowLines, colLines: bestColLines }
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
  debug = false,
): GridCellsResult | null {
  const log = debug ? (...args: unknown[]) => console.log('[grid]', ...args) : () => {}

  const origX1 = Math.round(Math.min(p1.x, p2.x))
  const origY1 = Math.round(Math.min(p1.y, p2.y))
  const origX2 = Math.round(Math.max(p1.x, p2.x))
  const origY2 = Math.round(Math.max(p1.y, p2.y))
  log('selection', { origX1, origY1, origX2, origY2, w: origX2 - origX1, h: origY2 - origY1 })

  const canvas = imageDataToCanvas(imageData)

  const croppedForColor = cropCanvas(canvas, origX1, origY1, origX2 - origX1, origY2 - origY1)
    .getContext('2d')!
    .getImageData(0, 0, origX2 - origX1, origY2 - origY1)
  const colored = isColorImage(croppedForColor)
  log('isColor', colored)

  if (debug) debugBandAnalysis(croppedForColor, log)

  let x1 = origX1
  let y1 = origY1
  let selW = origX2 - origX1
  let selH = origY2 - origY1
  let grid: GridStructure | null = null

  if (colored) {
    // Priorité : analyse de bandes (la plus fiable sur les grilles couleur)
    grid = detectGridByBands(croppedForColor)
    log('bands', grid ? `${grid.rowLines.length}r × ${grid.colLines.length}c` : 'null')

    if (!grid) {
      grid = detectGridByHueScan(croppedForColor)
      log('hueScan', grid ? `${grid.rowLines.length}r × ${grid.colLines.length}c` : 'null')
    }

    if (!grid) {
      grid = detectGridStructureExtended(croppedForColor)
      log('extended', grid ? `${grid.rowLines.length}r × ${grid.colLines.length}c` : 'null')
    }
  }

  if (!grid) {
    const EXPAND_PX = [0, 5, 10, 15]
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

      grid = detectGridStructure(croppedData)
      log(`dark pad=${pad}`, grid ? `${grid.rowLines.length}r × ${grid.colLines.length}c` : 'null')
      if (grid) break
    }
  }

  if (!grid) {
    log('FAILED — no grid found')
    return null
  }

  const nRows = grid.rowLines.length - 1
  const nCols = grid.colLines.length - 1
  if (nRows < 2 || nCols < 2) return null
  log('final grid', `${nRows} rows × ${nCols} cols`)

  // Positions des lignes dans l'image originale (décaler les coordonnées croppées)
  const absColLines = grid.colLines.map((c) => x1 + c)
  const absRowLines = grid.rowLines.map((r) => y1 + r)

  // Zone d'indices : espace disponible, limité à 6 cases max
  const avgCellW = (absColLines[absColLines.length - 1] - absColLines[0]) / nCols
  const avgCellH = (absRowLines[absRowLines.length - 1] - absRowLines[0]) / nRows
  const clueW = Math.min(absColLines[0], Math.ceil(avgCellW * 6))
  const clueH = Math.min(absRowLines[0], Math.ceil(avgCellH * 6))

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

  // Découper chaque case en utilisant les positions exactes des lignes
  const interiorCells: string[][] = Array.from({ length: nRows }, (_, i) =>
    Array.from({ length: nCols }, (_, j) =>
      cell(
        absColLines[j],
        absRowLines[i],
        absColLines[j + 1] - absColLines[j],
        absRowLines[i + 1] - absRowLines[i],
      ),
    ),
  )

  // Cases d'indices colonnes (au-dessus de la grille)
  const colClueCells: string[] = Array.from({ length: nCols }, (_, j) =>
    cell(absColLines[j], absRowLines[0] - clueH, absColLines[j + 1] - absColLines[j], clueH),
  )

  // Cases d'indices lignes (à gauche de la grille)
  const rowClueCells: string[] = Array.from({ length: nRows }, (_, i) =>
    cell(absColLines[0] - clueW, absRowLines[i], clueW, absRowLines[i + 1] - absRowLines[i]),
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
