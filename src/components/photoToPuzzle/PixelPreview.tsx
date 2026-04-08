import type { SolutionGrid } from '@/lib/types'

interface PixelPreviewProps {
  grid: SolutionGrid
  maxSize?: number
}

export default function PixelPreview({ grid, maxSize = 280 }: PixelPreviewProps) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const cellSize = Math.floor(maxSize / Math.max(rows, cols))

  return (
    <div
      className="inline-grid border-2 border-brd-heavy rounded"
      style={{
        gridTemplateColumns: `repeat(${cols}, ${cellSize}px)`,
        gridTemplateRows: `repeat(${rows}, ${cellSize}px)`,
      }}
    >
      {grid.flatMap((row, r) =>
        row.map((filled, c) => (
          <div
            key={`${r}-${c}`}
            className={filled ? 'bg-cell-filled' : 'bg-cell-empty'}
            style={{ width: cellSize, height: cellSize }}
          />
        )),
      )}
    </div>
  )
}
