import Button from '@/components/ui/Button'
import type { GridCellsResult } from '@/lib/imageProcessor'
import { useTranslation } from '@/i18n/useTranslation'

interface GridMosaicProps {
  cells: GridCellsResult
  onConfirm: () => void
  onRetry: () => void
}

/**
 * Affiche la mosaïque des cases découpées pour vérification visuelle.
 * Disposition :
 *   [ vide ] | [col 0] | [col 1] | … | [col N]
 *   [row 0]  | [0,0]   | [0,1]   | … | [0,N]
 *   …
 */
export default function GridMosaic({ cells, onConfirm, onRetry }: GridMosaicProps) {
  const t = useTranslation()
  const { nRows, nCols, colClueCells, rowClueCells, interiorCells } = cells

  // On aplatit toutes les cases dans un tableau ordonné pour le CSS grid
  type CellEntry =
    | { key: string; kind: 'corner' }
    | { key: string; kind: 'col-clue'; url: string; col: number }
    | { key: string; kind: 'row-clue'; url: string; row: number }
    | { key: string; kind: 'interior'; url: string; row: number; col: number }

  const entries: CellEntry[] = []

  // Ligne du haut : coin vide + cases d'indices colonnes
  entries.push({ key: 'corner', kind: 'corner' })
  for (let j = 0; j < nCols; j++)
    entries.push({ key: `col-${j}`, kind: 'col-clue', url: colClueCells[j], col: j })

  // Lignes suivantes : case d'indice ligne + cases intérieures
  for (let i = 0; i < nRows; i++) {
    entries.push({ key: `row-${i}`, kind: 'row-clue', url: rowClueCells[i], row: i })
    for (let j = 0; j < nCols; j++)
      entries.push({
        key: `cell-${i}-${j}`,
        kind: 'interior',
        url: interiorCells[i][j],
        row: i,
        col: j,
      })
  }

  const CELL = 56 // px par case dans la mosaïque

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        {t.mosaic.detected.replace('{rows}', String(nRows)).replace('{cols}', String(nCols))}
      </p>

      <div className="overflow-auto rounded border border-gray-200 p-2">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${nCols + 1}, ${CELL}px)`,
            gap: 2,
          }}
        >
          {entries.map((e) => {
            if (e.kind === 'corner') {
              return (
                <div
                  key={e.key}
                  style={{ width: CELL, height: CELL }}
                  className="rounded bg-gray-100"
                />
              )
            }
            const borderClass =
              e.kind === 'col-clue'
                ? 'border-primary-300'
                : e.kind === 'row-clue'
                  ? 'border-primary-300'
                  : 'border-gray-300'
            return (
              <img
                key={e.key}
                src={e.url}
                style={{ width: CELL, height: CELL, objectFit: 'cover' }}
                className={`rounded border ${borderClass}`}
              />
            )
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400">{t.mosaic.legend}</p>

      <div className="flex gap-2">
        <Button onClick={onConfirm} className="flex-1">
          {t.mosaic.continueOCR}
        </Button>
        <Button variant="secondary" onClick={onRetry}>
          {t.mosaic.recrop}
        </Button>
      </div>
    </div>
  )
}
