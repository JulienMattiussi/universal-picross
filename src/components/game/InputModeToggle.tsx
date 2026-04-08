import type { InputMode } from './GameGrid'

interface InputModeToggleProps {
  value: InputMode
  onChange: (mode: InputMode) => void
}

const INACTIVE = 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50'
const BASE =
  'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer'

const MODES: { mode: InputMode; label: string; activeClass: string; icon: React.ReactNode }[] = [
  {
    mode: 'fill',
    label: 'Remplir',
    activeClass: 'bg-gray-800 text-white',
    icon: null, // géré ci-dessous (la couleur du carré dépend de l'état actif)
  },
  {
    mode: 'mark',
    label: 'Marquer',
    activeClass: 'bg-primary-500 text-white',
    icon: (
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
  },
  {
    mode: 'erase',
    label: 'Effacer',
    activeClass: 'bg-gray-500 text-white',
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor">
        <path
          d="M3 8h10M6 5l-3 3 3 3M10 5l3 3-3 3"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

export default function InputModeToggle({ value, onChange }: InputModeToggleProps) {
  return (
    <div className="flex gap-2">
      {MODES.map(({ mode, label, activeClass, icon }) => {
        const active = value === mode
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            className={[BASE, active ? activeClass : INACTIVE].join(' ')}
          >
            {mode === 'fill' ? (
              <span
                className={[
                  'inline-block w-4 h-4 rounded-sm',
                  active ? 'bg-white' : 'bg-gray-800',
                ].join(' ')}
              />
            ) : (
              icon
            )}
            {label}
          </button>
        )
      })}
    </div>
  )
}
