/**
 * Grid boundary detection: find grid edges from full image or expand corner points.
 */

import type { Point } from '@/lib/image/types'
import { getLuminosity } from '@/lib/image/profiles'
import { detectGridStructureDark } from '@/lib/image/gridDetection'

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
