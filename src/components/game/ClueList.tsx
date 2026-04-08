import ClueCell from './ClueCell'
import type { ClueStatus } from '@/lib/clues'
import type { Clue } from '@/lib/types'

interface ClueListProps {
  clue: Clue
  direction: 'row' | 'col'
  cellSize: number
  statuses?: ClueStatus[]
  maxClueCount: number
}

export default function ClueList({
  clue,
  direction,
  cellSize,
  statuses,
  maxClueCount,
}: ClueListProps) {
  // Padding pour aligner les indices courts avec les plus longs
  const paddingCount = maxClueCount - clue.length
  const paddedClue: (number | null)[] = [...Array(paddingCount).fill(null), ...clue]
  const paddedStatuses: (ClueStatus | null)[] = [
    ...Array(paddingCount).fill(null),
    ...(statuses ?? clue.map(() => 'normal' as ClueStatus)),
  ]

  const cells = paddedClue.map((v, i) => (
    <ClueCell
      key={i}
      value={v ?? 0}
      size={cellSize}
      status={v !== null ? (paddedStatuses[i] ?? 'normal') : 'normal'}
    />
  ))

  return (
    <div className={`flex ${direction === 'row' ? 'flex-row' : 'flex-col'} items-center`}>
      {cells}
    </div>
  )
}
