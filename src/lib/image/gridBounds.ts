/**
 * Grid boundary detection: find grid edges from full image or expand corner points.
 */

import type { Point } from '@/lib/image/types'
import { getLuminosity } from '@/lib/image/profiles'
import { detectGridStructureDark } from '@/lib/image/gridDetection'
import { createDebugLogger, logStep, logData, logSeparator } from '@/lib/image/debugLog'

export function detectGridBounds(imageData: ImageData, debug = false): [Point, Point] | null {
  const log = createDebugLogger('BOUNDS', debug)
  logSeparator(log, 'Auto-détection des bornes')

  // Stratégie 1 : lignes sombres (grilles N&B)
  const grid = detectGridStructureDark(imageData)
  logStep(
    log,
    'Lignes sombres (N&B)',
    grid ? `${grid.rowLines.length}r × ${grid.colLines.length}c` : 'aucune',
    grid != null,
  )
  if (grid && grid.rowLines.length >= 4 && grid.colLines.length >= 4) {
    const result: [Point, Point] = [
      { x: grid.colLines[0], y: grid.rowLines[0] },
      { x: grid.colLines[grid.colLines.length - 1], y: grid.rowLines[grid.rowLines.length - 1] },
    ]
    logData(log, 'Bornes trouvées', result)
    return result
  }

  // Stratégie 2 : scan de contrastes depuis les bords (grilles couleur)
  const edgeResult = detectGridBoundsByEdgeScan(imageData, debug)
  logStep(log, 'Résultat final', edgeResult ? 'bornes trouvées' : 'échec', edgeResult != null)
  if (edgeResult) logData(log, 'Bornes', edgeResult)
  return edgeResult
}

function detectGridBoundsByEdgeScan(imageData: ImageData, debug: boolean): [Point, Point] | null {
  const log = createDebugLogger('BOUNDS', debug)
  const { width, height, data } = imageData
  const SAMPLE_COUNT = 10
  const THRESHOLD = 0.08
  const TOLERANCE = 10

  logSeparator(log, `Scan des bords (${width}×${height})`)

  function findEdge(label: string, horizontal: boolean, fromStart: boolean): number | null {
    const scanLen = horizontal ? width : height
    const crossLen = horizontal ? height : width
    const positions: number[] = []

    for (let s = 0; s < SAMPLE_COUNT; s++) {
      const crossPos = Math.floor((crossLen * (s + 1)) / (SAMPLE_COUNT + 1))
      const refIdx = fromStart ? 0 : scanLen - 1
      const rx = horizontal ? refIdx : crossPos
      const ry = horizontal ? crossPos : refIdx
      const refLum = getLuminosity(data, width, rx, ry)

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

    const valid = positions.filter((p) => p >= 0)
    if (valid.length < 2) {
      logStep(log, `  ${label}`, `échec (${valid.length} positions valides)`, false)
      return null
    }

    valid.sort((a, b) => a - b)

    const groups: number[][] = []
    for (const p of valid) {
      const lastGroup = groups[groups.length - 1]
      if (lastGroup && Math.abs(p - lastGroup[lastGroup.length - 1]) <= TOLERANCE) {
        lastGroup.push(p)
      } else {
        groups.push([p])
      }
    }

    const ordered = fromStart ? [...groups].reverse() : groups
    const bestGroup = ordered.find((g) => g.length >= 2)

    if (!bestGroup) {
      logStep(log, `  ${label}`, `échec (pas de groupe ≥ 2)`, false)
      logData(log, `  ${label} positions`, positions)
      return null
    }

    const result = Math.round(bestGroup.reduce((a, b) => a + b, 0) / bestGroup.length)
    logStep(log, `  ${label}`, `${result}px (${bestGroup.length} concordants)`, true)
    return result
  }

  const left = findEdge('Gauche', true, true)
  const right = findEdge('Droite', true, false)
  const top = findEdge('Haut', false, true)
  const bottom = findEdge('Bas', false, false)

  if (left == null || right == null || top == null || bottom == null) return null
  if (right - left < 50 || bottom - top < 50) return null

  return [
    { x: left, y: top },
    { x: right, y: bottom },
  ]
}

export function expandCornersToGridEdges(
  imageData: ImageData,
  p1: Point,
  p2: Point,
  debug = false,
): [Point, Point] {
  const log = createDebugLogger('EXPAND', debug)
  const { width, height, data } = imageData
  const MAX_SEARCH = 300
  const THRESHOLD = 0.08

  logSeparator(log, 'Expansion des coins')
  logData(log, 'Points cliqués', { p1, p2 })

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
        if (edgeWidth <= 5) return pos
        break
      }
    }
    return startPos
  }

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
        if (Math.abs(pos - edgeStart) > 15) break
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
  logData(log, 'Luminosité référence', { H: refLumH.toFixed(3), V: refLumV.toFixed(3) })

  const left = findFirstEdge(x1, midY, -1, true, refLumH)
  const top = findFirstEdge(y1, midX, -1, false, refLumV)
  const right = findLastEdge(x2, midY, 1, true, refLumH)
  const bottom = findLastEdge(y2, midX, 1, false, refLumV)

  logStep(log, 'Gauche (1er trait)', `${x1} → ${left}`)
  logStep(log, 'Haut (1er trait)', `${y1} → ${top}`)
  logStep(log, 'Droite (dernier trait)', `${x2} → ${right}`)
  logStep(log, 'Bas (dernier trait)', `${y2} → ${bottom}`)

  return [
    { x: left, y: top },
    { x: right, y: bottom },
  ]
}
