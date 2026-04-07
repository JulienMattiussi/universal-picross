interface ClueCellProps {
  value: number
  size: number
  completed?: boolean
}

export default function ClueCell({ value, size, completed = false }: ClueCellProps) {
  return (
    <div
      className={[
        'flex items-center justify-center text-xs font-semibold select-none',
        completed ? 'text-gray-300' : 'text-gray-700',
      ].join(' ')}
      style={{ width: size, height: size }}
    >
      {value === 0 ? '' : value}
    </div>
  )
}
