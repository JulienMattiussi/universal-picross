import { useGameStore } from '@/store/gameStore'

/**
 * Hook principal exposant les actions et l'état de jeu courant.
 */
export function useGame() {
  const puzzle = useGameStore((s) => s.puzzle)
  const grid = useGameStore((s) => s.grid)
  const status = useGameStore((s) => s.status)
  const cheated = useGameStore((s) => s.cheated)
  const loadPuzzle = useGameStore((s) => s.loadPuzzle)
  const fillCell = useGameStore((s) => s.fillCell)
  const markCell = useGameStore((s) => s.markCell)
  const clearCell = useGameStore((s) => s.clearCell)
  const applyGrid = useGameStore((s) => s.applyGrid)
  const reset = useGameStore((s) => s.reset)
  const setStatus = useGameStore((s) => s.setStatus)

  return {
    puzzle,
    grid,
    status,
    cheated,
    loadPuzzle,
    fillCell,
    markCell,
    clearCell,
    applyGrid,
    reset,
    setStatus,
  }
}
