import GameGrid from './GameGrid'
import ClueList from './ClueList'
import type { PicrossPuzzle, PlayGrid } from '@/lib/types'

interface GameBoardProps {
  puzzle: PicrossPuzzle
  grid: PlayGrid
  cellSize?: number
  onFill: (row: number, col: number) => void
  onMark: (row: number, col: number) => void
  errorCells?: Set<string>
}

export default function GameBoard({
  puzzle,
  grid,
  cellSize = 32,
  onFill,
  onMark,
  errorCells,
}: GameBoardProps) {
  const maxRowClueCount = Math.max(...puzzle.clues.rows.map((c) => c.length))
  const maxColClueCount = Math.max(...puzzle.clues.cols.map((c) => c.length))

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
              maxClueCount={maxRowClueCount}
            />
          ))}
        </div>
        <GameGrid
          grid={grid}
          cellSize={cellSize}
          onFill={onFill}
          onMark={onMark}
          errorCells={errorCells}
        />
      </div>
    </div>
  )
}
