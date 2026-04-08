import type { ClueStatus } from '@/lib/clues'

interface ClueCellProps {
  value: number
  size: number
  status?: ClueStatus
}

const STATUS_CLASSES: Record<ClueStatus, string> = {
  normal: 'text-txt-secondary',
  completed: 'text-txt-disabled',
  impossible: 'text-status-error',
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
