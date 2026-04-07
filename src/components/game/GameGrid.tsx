import Cell from './Cell'
import type { PlayGrid } from '@/lib/types'

interface GameGridProps {
  grid: PlayGrid
  cellSize: number
  onFill: (row: number, col: number) => void
  onMark: (row: number, col: number) => void
  errorCells?: Set<string>
}

export default function GameGrid({
  grid,
  cellSize,
  onFill,
  onMark,
  errorCells = new Set(),
}: GameGridProps) {
  return (
    <div
      className="border-2 border-gray-700 inline-block"
      role="grid"
      aria-label="Grille de picross"
    >
      {grid.map((row, r) => (
        <div key={r} className="flex" role="row">
          {row.map((state, c) => (
            <Cell
              key={c}
              state={state}
              row={r}
              col={c}
              size={cellSize}
              onFill={onFill}
              onMark={onMark}
              isError={errorCells.has(`${r},${c}`)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
