import { useState } from 'react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { solve } from '@/lib/solver'
import { useGame } from '@/hooks/useGame'
import type { PlayGrid } from '@/lib/types'

export default function SolverPanel() {
  const { puzzle, status, applyGrid, setStatus } = useGame()
  const [error, setError] = useState<string | null>(null)

  const handleSolve = () => {
    if (!puzzle) return
    setError(null)
    setStatus('solving')

    // Lancement asynchrone pour ne pas bloquer l'UI
    setTimeout(() => {
      const solution = solve(puzzle)
      if (!solution) {
        setError('Impossible de résoudre ce puzzle.')
        setStatus('playing')
        return
      }
      const grid: PlayGrid = solution.map((row) => row.map((cell) => (cell ? 'filled' : 'empty')))
      applyGrid(grid)
      setStatus('solved')
    }, 0)
  }

  if (!puzzle) return null

  return (
    <div className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-800">Solveur automatique</h3>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <Button
        variant="secondary"
        onClick={handleSolve}
        disabled={status === 'solving' || status === 'solved'}
        className="w-full"
      >
        {status === 'solving' ? (
          <>
            <Spinner size="sm" />
            Résolution…
          </>
        ) : (
          'Résoudre'
        )}
      </Button>
    </div>
  )
}
