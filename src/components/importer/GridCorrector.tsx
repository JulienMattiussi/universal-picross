import { useState } from 'react'
import Button from '@/components/ui/Button'
import { puzzleFromSolution } from '@/lib/generator'
import { solve } from '@/lib/solver'
import type { GridCellsResult } from '@/lib/image'
import { useTranslation } from '@/i18n/useTranslation'

interface GridCorrectorProps {
  cells: GridCellsResult
  initialValues: { rows: string[]; cols: string[] }
  onComplete: (rowClues: number[][], colClues: number[][]) => void
  onBack: () => void
}

export default function GridCorrector({
  cells,
  initialValues,
  onComplete,
  onBack,
}: GridCorrectorProps) {
  const t = useTranslation()
  const { nRows, nCols, colClueCells, rowClueCells } = cells

  const [colValues, setColValues] = useState<string[]>([...initialValues.cols])
  const [rowValues, setRowValues] = useState<string[]>([...initialValues.rows])
  const [error, setError] = useState<string | null>(null)

  const parseClue = (s: string) =>
    s
      .split(/\s+/)
      .map(Number)
      .filter((n) => !isNaN(n) && n > 0)

  const handleValidate = () => {
    const rowClues = rowValues.map(parseClue)
    const colClues = colValues.map(parseClue)

    const size = Math.max(rowClues.length, colClues.length)
    const checkPuzzle = puzzleFromSolution(
      Array.from({ length: size }, () => Array(size).fill(false)),
    )
    checkPuzzle.clues.rows = rowClues
    checkPuzzle.clues.cols = colClues

    if (solve(checkPuzzle) === null) {
      setError(t.corrector.stillNoSolution)
      return
    }

    setError(null)
    onComplete(rowClues, colClues)
  }

  const updateCol = (i: number, val: string) => {
    const next = [...colValues]
    next[i] = val
    setColValues(next)
    setError(null)
  }

  const updateRow = (i: number, val: string) => {
    const next = [...rowValues]
    next[i] = val
    setRowValues(next)
    setError(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm text-warn-text bg-warn-bg border border-warn-border rounded-lg px-3 py-2">
        {t.corrector.noSolution}
      </div>

      {/* Colonnes */}
      <div>
        <p className="text-xs font-medium text-txt-tertiary uppercase tracking-wide mb-2">
          {t.corrector.columns} ({nCols})
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: nCols }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-14 h-14 border border-brd rounded bg-surface-secondary overflow-hidden">
                <img
                  src={colClueCells[i]}
                  alt={`${t.corrector.columns} ${i + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>
              <input
                type="text"
                value={colValues[i] ?? ''}
                onChange={(e) => updateCol(i, e.target.value)}
                className="w-14 border border-brd-strong rounded px-1 py-0.5 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="1 2"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Lignes */}
      <div>
        <p className="text-xs font-medium text-txt-tertiary uppercase tracking-wide mb-2">
          {t.corrector.rows} ({nRows})
        </p>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: nRows }, (_, i) => (
            <div key={i} className="flex flex-col items-center gap-1 shrink-0">
              <div className="w-14 h-14 border border-brd rounded bg-surface-secondary overflow-hidden">
                <img
                  src={rowClueCells[i]}
                  alt={`${t.corrector.rows} ${i + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>
              <input
                type="text"
                value={rowValues[i] ?? ''}
                onChange={(e) => updateRow(i, e.target.value)}
                className="w-14 border border-brd-strong rounded px-1 py-0.5 text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                placeholder="1 2"
              />
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-status-error">{error}</p>}

      <div className="flex gap-2">
        <Button variant="secondary" onClick={onBack}>
          {t.corrector.backButton}
        </Button>
        <Button className="flex-1" onClick={handleValidate}>
          {t.corrector.validateAndPlay}
        </Button>
      </div>
    </div>
  )
}
