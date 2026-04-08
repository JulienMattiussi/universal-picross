import type { InputMode } from './GameGrid'
import { useTranslation } from '@/i18n/useTranslation'

interface InputModeToggleProps {
  value: InputMode
  onChange: (mode: InputMode) => void
}

const INACTIVE = 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
const BASE =
  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer'

const ACTIVE_CLASSES: Record<InputMode, string> = {
  fill: 'bg-gray-800 text-white',
  mark: 'bg-primary-500 text-white',
  erase: 'bg-gray-500 text-white',
}

const ICONS: Record<InputMode, React.ReactNode> = {
  fill: null,
  mark: (
    <svg viewBox="0 0 10 10" className="w-4 h-4">
      <line
        x1="1"
        y1="1"
        x2="9"
        y2="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <line
        x1="9"
        y1="1"
        x2="1"
        y2="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  ),
  erase: (
    <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor">
      <path
        d="M3 8h10M6 5l-3 3 3 3M10 5l3 3-3 3"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
}

const MODE_ORDER: InputMode[] = ['fill', 'mark', 'erase']

export default function InputModeToggle({ value, onChange }: InputModeToggleProps) {
  const t = useTranslation()
  const labels: Record<InputMode, string> = {
    fill: t.inputMode.fill,
    mark: t.inputMode.mark,
    erase: t.inputMode.erase,
  }

  return (
    <div className="flex gap-2">
      {MODE_ORDER.map((mode) => {
        const active = value === mode
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={[BASE, active ? ACTIVE_CLASSES[mode] : INACTIVE].join(' ')}
          >
            {mode === 'fill' ? (
              <span
                className={[
                  'inline-block w-4 h-4 rounded-sm',
                  active ? 'bg-white' : 'bg-gray-800',
                ].join(' ')}
              />
            ) : (
              ICONS[mode]
            )}
            {labels[mode]}
          </button>
        )
      })}
    </div>
  )
}
