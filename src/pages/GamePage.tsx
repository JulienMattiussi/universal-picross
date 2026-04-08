import { useEffect, useRef, useState } from 'react'
import GameBoard from '@/components/game/GameBoard'
import type { InputMode } from '@/components/game/GameGrid'
import InputModeToggle from '@/components/game/InputModeToggle'
import VictoryOverlay from '@/components/game/VictoryOverlay'
import ImportPanel from '@/components/importer/ImportPanel'
import SolverPanel from '@/components/solver/SolverPanel'
import Button from '@/components/ui/Button'
import { useGame } from '@/hooks/useGame'
import { useTimer } from '@/hooks/useTimer'
import { useTranslation } from '@/i18n/useTranslation'

interface GamePageProps {
  /** Mode d'entrée : 'image' ou 'camera' pour le flux import, undefined pour un puzzle généré */
  importMode?: 'image' | 'camera'
  onBack: () => void
}

export default function GamePage({ importMode, onBack }: GamePageProps) {
  const { puzzle, grid, status, cheated, fillCell, markCell, clearCell, reset } = useGame()
  const t = useTranslation()
  const { formatted } = useTimer()
  const boardRef = useRef<HTMLDivElement>(null)
  const [inputMode, setInputMode] = useState<InputMode>('fill')
  const [importDone, setImportDone] = useState(!importMode)

  // Calcul de la taille de cellule selon l'espace disponible
  const cellSize = puzzle ? Math.max(20, Math.min(36, Math.floor(320 / puzzle.cols))) : 32

  // Quand le puzzle est chargé depuis l'import, masquer l'ImportPanel
  useEffect(() => {
    if (importMode && !importDone && status === 'playing') {
      setImportDone(true)
    }
  }, [importMode, importDone, status])

  useEffect(() => {
    setInputMode('fill')
    boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [puzzle])

  const showImport = importMode && !importDone

  return (
    <main className="flex flex-col items-center gap-6 py-6 px-4 min-h-svh">
      {/* Breadcrumb */}
      <div className="w-full max-w-2xl">
        <button
          onClick={onBack}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
        >
          ← {t.common.back}
        </button>
      </div>

      {/* Flux import (image/caméra) */}
      {showImport && (
        <div className="w-full max-w-sm">
          <ImportPanel mode={importMode} />
        </div>
      )}

      {/* Jeu */}
      {puzzle && importDone && (
        <>
          {/* Animation de victoire */}
          {status === 'solved' && <VictoryOverlay cheated={cheated} />}

          {/* Barre supérieure */}
          <div className="flex items-center justify-between w-full max-w-2xl">
            <span className="font-mono text-lg text-gray-600">{formatted}</span>
            {status === 'solved' && (
              <span
                className={cheated ? 'text-red-500 font-semibold' : 'text-green-600 font-semibold'}
              >
                {cheated ? t.game.cheater : t.game.bravo}
              </span>
            )}
            <Button variant="ghost" size="sm" onClick={reset}>
              {t.common.restart}
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
              onClear={clearCell}
              inputMode={inputMode}
            />
          </div>

          {/* Toggle fill / mark / erase */}
          <InputModeToggle value={inputMode} onChange={setInputMode} />

          {/* Solveur */}
          <div className="w-full max-w-sm">
            <SolverPanel />
          </div>
        </>
      )}
    </main>
  )
}
