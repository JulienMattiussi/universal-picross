import { useEffect } from 'react'
import { useGameStore } from '@/store/gameStore'

/**
 * Démarre / arrête le chrono selon le statut de jeu.
 * Appelle tick() toutes les secondes quand status === 'playing'.
 */
export function useTimer() {
  const status = useGameStore((s) => s.status)
  const elapsedSeconds = useGameStore((s) => s.elapsedSeconds)
  const tick = useGameStore((s) => s.tick)

  useEffect(() => {
    if (status !== 'playing') return
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [status, tick])

  const minutes = Math.floor(elapsedSeconds / 60)
  const seconds = elapsedSeconds % 60
  const formatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return { elapsedSeconds, formatted }
}
