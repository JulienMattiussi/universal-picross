import type { CellState } from '@/lib/types'

interface CellProps {
  state: CellState
  row: number
  col: number
  size: number
  isError?: boolean
}

const stateClasses: Record<CellState, string> = {
  unknown: 'bg-white hover:bg-primary-50',
  filled: 'bg-gray-800',
  empty: 'bg-white',
  marked: 'bg-white',
}

export default function Cell({ state, row, col, size, isError = false }: CellProps) {
  const borderClasses = [
    'border border-gray-300',
    col % 5 === 0 && col !== 0 ? 'border-l-2 border-l-gray-500' : '',
    row % 5 === 0 && row !== 0 ? 'border-t-2 border-t-gray-500' : '',
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
        isError ? 'bg-red-200!' : '',
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
