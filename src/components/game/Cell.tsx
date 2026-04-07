import type { CellState } from '@/lib/types'

interface CellProps {
  state: CellState
  row: number
  col: number
  size: number
  onFill: (row: number, col: number) => void
  onMark: (row: number, col: number) => void
  isHighlighted?: boolean
  isError?: boolean
}

const stateClasses: Record<CellState, string> = {
  unknown: 'bg-white hover:bg-indigo-50 active:bg-indigo-100',
  filled: 'bg-gray-800',
  empty: 'bg-white',
  marked: 'bg-white',
}

export default function Cell({
  state,
  row,
  col,
  size,
  onFill,
  onMark,
  isHighlighted = false,
  isError = false,
}: CellProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    onFill(row, col)
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    onMark(row, col)
  }

  // Support long-press pour mobile
  let pressTimer: ReturnType<typeof setTimeout> | null = null

  const handleTouchStart = () => {
    pressTimer = setTimeout(() => {
      onMark(row, col)
      pressTimer = null
    }, 400)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pressTimer !== null) {
      clearTimeout(pressTimer)
      pressTimer = null
      e.preventDefault()
      onFill(row, col)
    }
  }

  const handleTouchMove = () => {
    if (pressTimer !== null) {
      clearTimeout(pressTimer)
      pressTimer = null
    }
  }

  const borderClasses = [
    'border border-gray-300',
    col % 5 === 0 && col !== 0 ? 'border-l-2 border-l-gray-500' : '',
    row % 5 === 0 && row !== 0 ? 'border-t-2 border-t-gray-500' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      aria-label={`Case ${row + 1},${col + 1} : ${state}`}
      className={[
        'relative flex items-center justify-center select-none',
        'transition-colors duration-75 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
        stateClasses[state],
        borderClasses,
        isHighlighted ? 'bg-indigo-50' : '',
        isError ? '!bg-red-200' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{ width: size, height: size }}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchMove={handleTouchMove}
    >
      {state === 'marked' && (
        <svg viewBox="0 0 10 10" className="w-1/2 h-1/2 text-gray-400 pointer-events-none">
          <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="2" />
          <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="2" />
        </svg>
      )}
    </button>
  )
}
