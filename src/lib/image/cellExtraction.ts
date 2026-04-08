/**
 * Cell extraction: cut grid into individual cell images.
 */

import type { GridCellsResult } from '@/lib/image/types'
import type { Point } from '@/lib/image/types'
import { imageDataToCanvas, cropCanvas } from '@/lib/image/canvas'
import { isColorImage } from '@/lib/image/profiles'
import {
  detectGridStructure,
  detectGridStructureExtended,
  detectGridByBands,
  detectGridByHueScan,
  debugBandAnalysis,
} from '@/lib/image/gridDetection'
import type { GridStructure } from '@/lib/image/types'

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
