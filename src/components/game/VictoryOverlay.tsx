import { useEffect, useState } from 'react'
import { useTranslation } from '@/i18n/useTranslation'

interface VictoryOverlayProps {
  cheated: boolean
}

const CONFETTI_COLORS = ['#f97316', '#facc15', '#34d399', '#60a5fa', '#f472b6', '#a78bfa']
const CONFETTI_COUNT = 40

interface Confetto {
  x: number
  delay: number
  duration: number
  color: string
  size: number
  drift: number
}

function makeConfetti(): Confetto[] {
  return Array.from({ length: CONFETTI_COUNT }, () => ({
    x: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 1.5,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    size: 6 + Math.random() * 6,
    drift: -30 + Math.random() * 60,
  }))
}

export default function VictoryOverlay({ cheated }: VictoryOverlayProps) {
  const t = useTranslation()
  const [visible, setVisible] = useState(true)
  const [confetti] = useState(makeConfetti)

  // Masquer après 4 secondes
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
      aria-live="polite"
    >
      {/* Confettis */}
      <div className="absolute inset-0 overflow-hidden">
        {confetti.map((c, i) => (
          <div
            key={i}
            className="absolute rounded-sm animate-confetti"
            style={
              {
                left: `${c.x}%`,
                width: c.size,
                height: c.size * 0.6,
                backgroundColor: c.color,
                animationDelay: `${c.delay}s`,
                animationDuration: `${c.duration}s`,
                '--drift': `${c.drift}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Texte central */}
      <div className="animate-victory-text text-center">
        <span
          className={[
            'text-5xl font-extrabold drop-shadow-lg',
            cheated ? 'text-red-500' : 'text-primary-500',
          ].join(' ')}
        >
          {cheated ? t.game.cheater : t.game.bravo}
        </span>
      </div>
    </div>
  )
}
