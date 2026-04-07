import ClueCell from './ClueCell'
import type { Clue } from '@/lib/types'

interface ClueListProps {
  clue: Clue
  direction: 'row' | 'col'
  cellSize: number
  completed?: boolean
  maxClueCount: number
}

export default function ClueList({
  clue,
  direction,
  cellSize,
  completed = false,
  maxClueCount,
}: ClueListProps) {
  // Padding pour aligner les indices courts avec les plus longs
  const paddingCount = maxClueCount - clue.length
  const paddedClue = [...Array(paddingCount).fill(null), ...clue]

  if (direction === 'row') {
    return (
      <div className="flex flex-row items-center">
        {paddedClue.map((v, i) => (
          <ClueCell
            key={i}
            value={v ?? 0}
            size={cellSize}
            completed={v !== null && completed}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      {paddedClue.map((v, i) => (
        <ClueCell
          key={i}
          value={v ?? 0}
          size={cellSize}
          completed={v !== null && completed}
        />
      ))}
    </div>
  )
}
