import { useState } from 'react'
import Button from '@/components/ui/Button'
import { puzzleFromSolution } from '@/lib/generator'
import { useGame } from '@/hooks/useGame'
import type { ProcessResult } from '@/lib/imageProcessor'

interface GridCorrectorProps {
  result: ProcessResult
  onClose: () => void
}

const MIN_SIZE = 2
const MAX_SIZE = 20

export default function GridCorrector({ result, onClose }: GridCorrectorProps) {
  const { loadPuzzle } = useGame()

  // Pré-remplissage depuis l'OCR ; on prend au moins 5 entrées
  const initLines = (clues: number[][], minCount: number) => {
    const filled = clues.map((c) => c.join(' '))
    while (filled.length < minCount) filled.push('')
    return filled
  }
  const defaultSize = Math.max(result.rawClues.rows.length, result.rawClues.cols.length, 5)
  const [rows, setRows] = useState<string[]>(() => initLines(result.rawClues.rows, defaultSize))
  const [cols, setCols] = useState<string[]>(() => initLines(result.rawClues.cols, defaultSize))

  const parseClues = (lines: string[]) =>
    lines.map((l) =>
      l
        .split(/\s+/)
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0),
    )

  const addRow = () => rows.length < MAX_SIZE && setRows([...rows, ''])
  const removeRow = () => rows.length > MIN_SIZE && setRows(rows.slice(0, -1))
  const addCol = () => cols.length < MAX_SIZE && setCols([...cols, ''])
  const removeCol = () => cols.length > MIN_SIZE && setCols(cols.slice(0, -1))

  const handlePlay = () => {
    const rowClues = parseClues(rows)
    const colClues = parseClues(cols)
    const size = Math.max(rowClues.length, colClues.length)
    const emptyGrid = Array.from({ length: size }, () => Array(size).fill(false))
    const puzzle = puzzleFromSolution(emptyGrid)
    puzzle.clues.rows = rowClues
    puzzle.clues.cols = colClues
    loadPuzzle(puzzle)
    onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Aperçu de l'image importée */}
      <img
        src={result.imageUrl}
        alt="Picross importé"
        className="w-full max-h-48 object-contain rounded border border-gray-200 bg-gray-50"
      />

      {/* Statut de la détection */}
      <p className="text-sm text-gray-500">
        {result.gridDetected ? (
          <>
            Grille détectée. Confiance OCR :{' '}
            <span
              className={
                result.confidence > 0.7
                  ? 'font-medium text-green-600'
                  : 'font-medium text-amber-600'
              }
            >
              {Math.round(result.confidence * 100)}%
            </span>{' '}
            — vérifiez et corrigez les indices si besoin.
          </>
        ) : (
          "Grille non détectée automatiquement. Saisissez les indices en vous référant à l'image."
        )}
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Lignes */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Lignes ({rows.length})
            </span>
            <div className="flex gap-1">
              <button
                onClick={removeRow}
                disabled={rows.length <= MIN_SIZE}
                className="w-5 h-5 rounded text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer text-sm leading-none"
              >
                −
              </button>
              <button
                onClick={addRow}
                disabled={rows.length >= MAX_SIZE}
                className="w-5 h-5 rounded text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer text-sm leading-none"
              >
                +
              </button>
            </div>
          </div>
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

        {/* Colonnes */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Colonnes ({cols.length})
            </span>
            <div className="flex gap-1">
              <button
                onClick={removeCol}
                disabled={cols.length <= MIN_SIZE}
                className="w-5 h-5 rounded text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer text-sm leading-none"
              >
                −
              </button>
              <button
                onClick={addCol}
                disabled={cols.length >= MAX_SIZE}
                className="w-5 h-5 rounded text-gray-500 hover:text-gray-800 disabled:opacity-30 cursor-pointer text-sm leading-none"
              >
                +
              </button>
            </div>
          </div>
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
