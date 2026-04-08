import { useEffect, useRef, useState } from 'react'
import GameBoard from '@/components/game/GameBoard'
import type { InputMode } from '@/components/game/GameGrid'
import VictoryOverlay from '@/components/game/VictoryOverlay'
import ImportPanel from '@/components/importer/ImportPanel'
import SolverPanel from '@/components/solver/SolverPanel'
import Button from '@/components/ui/Button'
import { useGame } from '@/hooks/useGame'
import { useTimer } from '@/hooks/useTimer'

interface GamePageProps {
  /** Mode d'entrée : 'image' ou 'camera' pour le flux import, undefined pour un puzzle généré */
  importMode?: 'image' | 'camera'
  onBack: () => void
}

export default function GamePage({ importMode, onBack }: GamePageProps) {
  const { puzzle, grid, status, cheated, fillCell, markCell, clearCell, reset } = useGame()
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
          ← Accueil
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
                {cheated ? 'Tricheur !' : 'Bravo !'}
              </span>
            )}
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
              onClear={clearCell}
              inputMode={inputMode}
            />
          </div>

          {/* Toggle fill / mark / erase */}
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode('fill')}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer',
                inputMode === 'fill'
                  ? 'bg-gray-800 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              <span
                className={[
                  'inline-block w-4 h-4 rounded-sm',
                  inputMode === 'fill' ? 'bg-white' : 'bg-gray-800',
                ].join(' ')}
              />
              Remplir
            </button>
            <button
              onClick={() => setInputMode('mark')}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer',
                inputMode === 'mark'
                  ? 'bg-primary-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
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
              Marquer
            </button>
            <button
              onClick={() => setInputMode('erase')}
              className={[
                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors cursor-pointer',
                inputMode === 'erase'
                  ? 'bg-gray-500 text-white'
                  : 'bg-white text-gray-600 border border-gray-300 hover:bg-gray-50',
              ].join(' ')}
            >
              <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor">
                <path
                  d="M3 8h10M6 5l-3 3 3 3M10 5l3 3-3 3"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Effacer
            </button>
          </div>

          {/* Solveur */}
          <div className="w-full max-w-sm">
            <SolverPanel />
          </div>
        </>
      )}
    </main>
  )
}
