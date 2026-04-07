import { useEffect, useRef } from 'react'
import GameBoard from '@/components/game/GameBoard'
import SolverPanel from '@/components/solver/SolverPanel'
import Button from '@/components/ui/Button'
import { useGame } from '@/hooks/useGame'
import { useTimer } from '@/hooks/useTimer'

export default function GamePage() {
  const { puzzle, grid, status, fillCell, markCell, reset } = useGame()
  const { formatted } = useTimer()
  const boardRef = useRef<HTMLDivElement>(null)

  // Calcul de la taille de cellule selon l'espace disponible
  const cellSize = puzzle ? Math.max(20, Math.min(36, Math.floor(320 / puzzle.cols))) : 32

  useEffect(() => {
    boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [puzzle])

  if (!puzzle) return null

  return (
    <div className="flex flex-col items-center gap-6 py-6 px-4">
      {/* Barre supérieure */}
      <div className="flex items-center justify-between w-full max-w-2xl">
        <span className="font-mono text-lg text-gray-600">{formatted}</span>
        {status === 'solved' && <span className="text-green-600 font-semibold">Résolu !</span>}
        <Button variant="ghost" size="sm" onClick={reset}>
          Recommencer
        </Button>
      </div>

      {/* Plateau */}
      <div ref={boardRef} className="overflow-auto max-w-full">
        <GameBoard
          puzzle={puzzle}
          grid={grid}
          cellSize={cellSize}
          onFill={fillCell}
          onMark={markCell}
        />
      </div>

      {/* Solveur */}
      <div className="w-full max-w-sm">
        <SolverPanel />
      </div>
    </div>
  )
}
