import type { ClueStatus } from '@/lib/clues'

interface ClueCellProps {
  value: number
  size: number
  status?: ClueStatus
}

const STATUS_CLASSES: Record<ClueStatus, string> = {
  normal: 'text-gray-700',
  completed: 'text-gray-300',
  impossible: 'text-red-500',
}

export default function ClueCell({ value, size, status = 'normal' }: ClueCellProps) {
  return (
    <div
      className={[
        'flex items-center justify-center text-xs font-semibold select-none',
        STATUS_CLASSES[status],
      ].join(' ')}
      style={{ width: size, height: size }}
    >
      {value === 0 ? '' : value}
    </div>
  )
}
