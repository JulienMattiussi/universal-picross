import { useState } from 'react'
import Button from '@/components/ui/Button'
import { puzzleFromSolution } from '@/lib/generator'
import { useGame } from '@/hooks/useGame'
import type { ProcessResult } from '@/lib/imageProcessor'

interface GridCorrectorProps {
  result: ProcessResult
  onClose: () => void
}

/**
 * Permet à l'utilisateur de vérifier et corriger les indices extraits par OCR
 * avant de lancer la partie.
 */
export default function GridCorrector({ result, onClose }: GridCorrectorProps) {
  const { loadPuzzle } = useGame()
  const [rows, setRows] = useState<string[]>(
    result.rawClues.rows.map((r) => r.join(' ')),
  )
  const [cols, setCols] = useState<string[]>(
    result.rawClues.cols.map((c) => c.join(' ')),
  )

  const parseClues = (lines: string[]) =>
    lines.map((l) =>
      l
        .split(/\s+/)
        .map(Number)
        .filter((n) => !isNaN(n) && n >= 0),
    )

  const handlePlay = () => {
    const rowClues = parseClues(rows)
    const colClues = parseClues(cols)
    const size = Math.max(rowClues.length, colClues.length)

    // Grille vide — le joueur la remplit
    const emptyGrid = Array.from({ length: size }, () => Array(size).fill(false))
    const puzzle = puzzleFromSolution(emptyGrid)
    puzzle.clues.rows = rowClues
    puzzle.clues.cols = colClues

    loadPuzzle(puzzle)
    onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-600">
        Vérifiez les indices extraits. Confiance OCR :{' '}
        <span
          className={[
            'font-medium',
            result.confidence > 0.8 ? 'text-green-600' : 'text-amber-600',
          ].join(' ')}
        >
          {Math.round(result.confidence * 100)}%
        </span>
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Lignes
          </span>
          {rows.map((r, i) => (
            <input
              key={i}
              value={r}
              onChange={(e) => {
                const next = [...rows]
                next[i] = e.target.value
                setRows(next)
              }}
              className="border border-gray-200 rounded px-2 py-1 text-sm font-mono"
              placeholder="ex: 3 1"
            />
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Colonnes
          </span>
          {cols.map((c, i) => (
            <input
              key={i}
              value={c}
              onChange={(e) => {
                const next = [...cols]
                next[i] = e.target.value
                setCols(next)
              }}
              className="border border-gray-200 rounded px-2 py-1 text-sm font-mono"
              placeholder="ex: 2"
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={handlePlay} className="flex-1">
          Jouer avec ces indices
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Annuler
        </Button>
      </div>
    </div>
  )
}
