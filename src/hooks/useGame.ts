import { useGameStore } from '@/store/gameStore'

/**
 * Hook principal exposant les actions et l'état de jeu courant.
 */
export function useGame() {
  const puzzle = useGameStore((s) => s.puzzle)
  const grid = useGameStore((s) => s.grid)
  const status = useGameStore((s) => s.status)
  const loadPuzzle = useGameStore((s) => s.loadPuzzle)
  const fillCell = useGameStore((s) => s.fillCell)
  const markCell = useGameStore((s) => s.markCell)
  const applyGrid = useGameStore((s) => s.applyGrid)
  const reset = useGameStore((s) => s.reset)
  const setStatus = useGameStore((s) => s.setStatus)

  return { puzzle, grid, status, loadPuzzle, fillCell, markCell, applyGrid, reset, setStatus }
}
