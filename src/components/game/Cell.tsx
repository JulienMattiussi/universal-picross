import type { CellState } from '@/lib/types'

interface CellProps {
  state: CellState
  row: number
  col: number
  size: number
  isError?: boolean
  thickTop?: boolean
  thickLeft?: boolean
}

const stateClasses: Record<CellState, string> = {
  unknown: 'bg-cell-empty hover:bg-primary-50',
  filled: 'bg-cell-filled',
  empty: 'bg-cell-empty',
  marked: 'bg-cell-empty',
}

export default function Cell({
  state,
  row,
  col,
  size,
  isError = false,
  thickTop = false,
  thickLeft = false,
}: CellProps) {
  const borderClasses = [
    'border border-brd-strong',
    thickLeft ? 'border-l-2 border-l-brd-heavy' : '',
    thickTop ? 'border-t-2 border-t-brd-heavy' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      role="gridcell"
      aria-label={`Case ${row + 1},${col + 1} : ${state}`}
      className={[
        'relative flex items-center justify-center',
        stateClasses[state],
        borderClasses,
        isError ? 'bg-error-cell!' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: size, height: size }}
    >
      {state === 'marked' && (
        <svg viewBox="0 0 10 10" className="w-1/2 h-1/2 text-primary-400 pointer-events-none">
          <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="2" />
          <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}
    </div>
  )
}
