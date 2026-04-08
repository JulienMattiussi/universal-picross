/**
 * Grid structure detection: line centers, regular lines, multi-strategy detection.
 */

import type { Band, GridStructure } from '@/lib/image/types'
import {
  toGrayscale,
  getLuminosity,
  rowDarknessProfile,
  colDarknessProfile,
  rowEdgeProfile,
  colEdgeProfile,
  rowSaturationProfile,
  colSaturationProfile,
  rowLightnessProfile,
  colLightnessProfile,
} from '@/lib/image/profiles'

export function findLineCenters(profile: Float32Array, threshold: number): number[] {
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

export function findRegularLines(positions: number[], minCount = 4): number[] | null {
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

/** maxLines : nombre max de lignes accepté (une grille 20×20 a 21 lignes) */
export function tryFindGrid(
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
export function detectGridStructureDark(imageData: ImageData): GridStructure | null {
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
export function detectGridStructure(imageData: ImageData): GridStructure | null {
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
 * Si les lignes détectées sont espacées d'un multiple de N cases (ex: groupes de 5),
 * subdivise pour retrouver chaque case individuelle.
 * Teste les diviseurs 2..6 et garde celui qui produit le meilleur résultat.
 */
export function subdivideLines(lines: number[]): number[] {
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

/**
 * Détection étendue : essaie 3 stratégies en cascade.
 * Utilisée uniquement en fallback quand detectGridStructure échoue.
 */
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

// ---------------------------------------------------------------------------
// Analyse de bandes (debug) — parcourt la grille pixel par pixel
// ---------------------------------------------------------------------------

/**
 * Parcourt une ligne de l'image et retourne les bandes de luminosité homogène.
 * Ex: [{lum:0.95, width:2}, {lum:0.4, width:30}, {lum:0.92, width:2}, ...]
 * = trait 2px, case 30px, trait 2px, ...
 */
export function scanBands(imageData: ImageData, pos: number, horizontal: boolean): Band[] {
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
export function debugBandAnalysis(imageData: ImageData, log: (...args: unknown[]) => void): void {
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
export function detectGridByBands(imageData: ImageData): GridStructure | null {
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
// Détection de grille couleur par balayage de teinte
// ---------------------------------------------------------------------------

/**
 * Parcourt une ligne de pixels et retourne les positions des séparateurs (bordures entre cases).
 * Un séparateur = zone courte où la luminosité diffère du fond des cases.
 */
export function scanLineForSeparators(
  imageData: ImageData,
  pos: number,
  horizontal: boolean,
): number[] {
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
export function regularizePositions(separators: number[], totalLen: number): number[] | null {
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
export function detectGridByHueScan(imageData: ImageData): GridStructure | null {
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
