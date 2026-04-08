/**
 * Cell extraction: cut grid into individual cell images.
 */

import type { GridCellsResult, GridStructure, Point } from '@/lib/image/types'
import { imageDataToCanvas, cropCanvas } from '@/lib/image/canvas'
import { isColorImage } from '@/lib/image/profiles'
import {
  detectGridStructure,
  detectGridStructureExtended,
  detectGridByBands,
  detectGridByHueScan,
  debugBandAnalysis,
} from '@/lib/image/gridDetection'
import { createDebugLogger, logStep, logData, logSeparator } from '@/lib/image/debugLog'

export function extractGridCells(
  imageData: ImageData,
  p1: Point,
  p2: Point,
  debug = false,
): GridCellsResult | null {
  const log = createDebugLogger('EXTRACT', debug)

  const origX1 = Math.round(Math.min(p1.x, p2.x))
  const origY1 = Math.round(Math.min(p1.y, p2.y))
  const origX2 = Math.round(Math.max(p1.x, p2.x))
  const origY2 = Math.round(Math.max(p1.y, p2.y))

  logSeparator(log, 'Extraction des cases')
  logData(log, 'Sélection', {
    x: origX1,
    y: origY1,
    w: origX2 - origX1,
    h: origY2 - origY1,
  })

  const canvas = imageDataToCanvas(imageData)

  const croppedForColor = cropCanvas(canvas, origX1, origY1, origX2 - origX1, origY2 - origY1)
    .getContext('2d')!
    .getImageData(0, 0, origX2 - origX1, origY2 - origY1)
  const colored = isColorImage(croppedForColor)
  logStep(log, 'Type image', colored ? 'Couleur' : 'N&B')

  if (debug) {
    logSeparator(log, 'Analyse des bandes')
    debugBandAnalysis(croppedForColor, log)
  }

  let x1 = origX1
  let y1 = origY1
  let selW = origX2 - origX1
  let selH = origY2 - origY1
  let grid: GridStructure | null = null
  let method = ''

  if (colored) {
    logSeparator(log, 'Détection couleur')

    grid = detectGridByBands(croppedForColor)
    logStep(
      log,
      'Bandes',
      grid ? `${grid.rowLines.length}r × ${grid.colLines.length}c` : 'échec',
      grid != null,
    )
    if (grid) method = 'bandes'

    if (!grid) {
      grid = detectGridByHueScan(croppedForColor)
      logStep(
        log,
        'Scan teinte',
        grid ? `${grid.rowLines.length}r × ${grid.colLines.length}c` : 'échec',
        grid != null,
      )
      if (grid) method = 'teinte'
    }

    if (!grid) {
      grid = detectGridStructureExtended(croppedForColor)
      logStep(
        log,
        'Étendue',
        grid ? `${grid.rowLines.length}r × ${grid.colLines.length}c` : 'échec',
        grid != null,
      )
      if (grid) method = 'étendue'
    }
  }

  if (!grid) {
    logSeparator(log, 'Détection N&B (lignes sombres)')
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
      logStep(
        log,
        `Sombres +${pad}px`,
        grid ? `${grid.rowLines.length}r × ${grid.colLines.length}c` : 'échec',
        grid != null,
      )
      if (grid) {
        method = `sombres +${pad}px`
        break
      }
    }
  }

  if (!grid) {
    logStep(log, 'Résultat', 'ÉCHEC — aucune grille trouvée', false)
    return null
  }

  const nRows = grid.rowLines.length - 1
  const nCols = grid.colLines.length - 1
  if (nRows < 2 || nCols < 2) return null

  logSeparator(log, 'Résultat')
  logStep(log, 'Grille', `${nRows} × ${nCols} (méthode: ${method})`, true)

  const absColLines = grid.colLines.map((c) => x1 + c)
  const absRowLines = grid.rowLines.map((r) => y1 + r)

  const avgCellW = (absColLines[absColLines.length - 1] - absColLines[0]) / nCols
  const avgCellH = (absRowLines[absRowLines.length - 1] - absRowLines[0]) / nRows
  const clueW = Math.min(absColLines[0], Math.ceil(avgCellW * 6))
  const clueH = Math.min(absRowLines[0], Math.ceil(avgCellH * 6))
  logData(log, 'Taille case moyenne', `${avgCellW.toFixed(1)} × ${avgCellH.toFixed(1)}px`)
  logData(log, 'Zone indices', `L=${clueW}px, H=${clueH}px`)

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
    Array.from({ length: nCols }, (_, j) =>
      cell(
        absColLines[j],
        absRowLines[i],
        absColLines[j + 1] - absColLines[j],
        absRowLines[i + 1] - absRowLines[i],
      ),
    ),
  )

  const colClueCells: string[] = Array.from({ length: nCols }, (_, j) =>
    cell(absColLines[j], absRowLines[0] - clueH, absColLines[j + 1] - absColLines[j], clueH),
  )

  const rowClueCells: string[] = Array.from({ length: nRows }, (_, i) =>
    cell(absColLines[0] - clueW, absRowLines[i], clueW, absRowLines[i + 1] - absRowLines[i]),
  )

  return { nRows, nCols, colClueCells, rowClueCells, interiorCells, colored }
}
