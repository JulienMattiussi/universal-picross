import { useState } from 'react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { solve } from '@/lib/solver'
import { useGame } from '@/hooks/useGame'
import { useGameStore } from '@/store/gameStore'
import { useTranslation } from '@/i18n/useTranslation'
import type { PlayGrid } from '@/lib/types'

export default function SolverPanel() {
  const { puzzle, status, applyGrid, setStatus } = useGame()
  const t = useTranslation()
  const [error, setError] = useState<string | null>(null)

  const handleSolve = () => {
    if (!puzzle) return
    setError(null)
    setStatus('solving')

    setTimeout(() => {
      const solution = solve(puzzle)
      if (!solution) {
        setError(t.solver.error)
        setStatus('playing')
        return
      }
      const grid: PlayGrid = solution.map((row) => row.map((cell) => (cell ? 'filled' : 'empty')))
      useGameStore.setState({ cheated: true })
      applyGrid(grid)
      setStatus('solved')
    }, 0)
  }

  if (!puzzle) return null

  return (
    <div className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-800">{t.solver.title}</h3>

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
            {t.solver.solving}
          </>
        ) : (
          t.solver.solveButton
        )}
      </Button>
    </div>
  )
}
