import GameGrid, { type InputMode } from './GameGrid'
import ClueList from './ClueList'
import { getClueStatuses } from '@/lib/clues'
import type { PicrossPuzzle, PlayGrid } from '@/lib/types'

interface GameBoardProps {
  puzzle: PicrossPuzzle
  grid: PlayGrid
  cellSize?: number
  onFill: (row: number, col: number) => void
  onMark: (row: number, col: number) => void
  onClear: (row: number, col: number) => void
  errorCells?: Set<string>
  inputMode?: InputMode
}

export default function GameBoard({
  puzzle,
  grid,
  cellSize = 32,
  onFill,
  onMark,
  onClear,
  errorCells,
  inputMode,
}: GameBoardProps) {
  const maxRowClueCount = Math.max(...puzzle.clues.rows.map((c) => c.length))
  const maxColClueCount = Math.max(...puzzle.clues.cols.map((c) => c.length))

  // Statuts par ligne
  const rowStatuses = puzzle.clues.rows.map((clue, r) => getClueStatuses(clue, grid[r]))

  // Statuts par colonne
  const colStatuses = puzzle.clues.cols.map((clue, c) => {
    const colCells = grid.map((row) => row[c])
    return getClueStatuses(clue, colCells)
  })

  return (
    <div className="inline-flex flex-col items-end select-none">
      {/* Ligne d'indices de colonnes */}
      <div className="flex flex-row" style={{ marginLeft: maxRowClueCount * cellSize }}>
        {puzzle.clues.cols.map((clue, c) => (
          <ClueList
            key={c}
            clue={clue}
            direction="col"
            cellSize={cellSize}
            statuses={colStatuses[c]}
            maxClueCount={maxColClueCount}
          />
        ))}
      </div>

      {/* Indices de lignes + grille */}
      <div className="flex flex-row">
        <div className="flex flex-col">
          {puzzle.clues.rows.map((clue, r) => (
            <ClueList
              key={r}
              clue={clue}
              direction="row"
              cellSize={cellSize}
              statuses={rowStatuses[r]}
              maxClueCount={maxRowClueCount}
            />
          ))}
        </div>
        <GameGrid
          grid={grid}
          cellSize={cellSize}
          onFill={onFill}
          onMark={onMark}
          onClear={onClear}
          errorCells={errorCells}
          inputMode={inputMode}
        />
      </div>
    </div>
  )
}
