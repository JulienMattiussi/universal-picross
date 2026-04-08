import { useState } from 'react'
import ImageUploader from './ImageUploader'
import CameraCapture from './CameraCapture'
import CornerSelector from './CornerSelector'
import GridMosaic from './GridMosaic'
import GridCorrector from './GridCorrector'
import ClueValidator from './ClueValidator'
import Spinner from '@/components/ui/Spinner'
import {
  extractGridCells,
  recognizeAllClueCells,
  type GridCellsResult,
  type Point,
} from '@/lib/imageProcessor'
import { puzzleFromSolution } from '@/lib/generator'
import { solve } from '@/lib/solver'
import { useGame } from '@/hooks/useGame'
import { useDebugStore } from '@/store/debugStore'

type Tab = 'upload' | 'camera'
type Phase =
  | 'upload'
  | 'selecting'
  | 'extracting'
  | 'mosaic'
  | 'recognizing'
  | 'validating'
  | 'correcting'

export default function ImportPanel() {
  const { loadPuzzle, reset } = useGame()
  const { debug } = useDebugStore()

  const [tab, setTab] = useState<Tab>('upload')
  const [phase, setPhase] = useState<Phase>('upload')
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [, setCorners] = useState<[Point, Point] | null>(null)
  const [gridCells, setGridCells] = useState<GridCellsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recognizeProgress, setRecognizeProgress] = useState({ done: 0, total: 0 })
  const [recognizedValues, setRecognizedValues] = useState<{
    rows: string[]
    cols: string[]
  } | null>(null)
  const [isSolvable, setIsSolvable] = useState<boolean | null>(null)

  const handleImage = (data: ImageData) => {
    setImageData(data)
    setPhase('selecting')
    setError(null)
  }

  const handleCornersConfirmed = (p1: Point, p2: Point) => {
    if (!imageData) return
    setError(null)
    setPhase('extracting' as Phase)
    setTimeout(() => {
      try {
        const cells = extractGridCells(imageData, p1, p2)
        if (!cells) {
          setError(
            'Impossible de détecter les lignes de la grille. Essayez de sélectionner la zone plus précisément.',
          )
          setPhase('selecting')
          return
        }
        setCorners([p1, p2])
        setGridCells(cells)
        if (debug) {
          setPhase('mosaic')
        } else {
          startRecognition(cells)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur lors du découpage.')
        setPhase('selecting')
      }
    }, 0)
  }

  const startRecognition = async (cells: GridCellsResult) => {
    const total = cells.nCols + cells.nRows
    setRecognizeProgress({ done: 0, total })
    setPhase('recognizing')
    const values = await recognizeAllClueCells(cells, (done, t) =>
      setRecognizeProgress({ done, total: t }),
    )

    const parseClue = (s: string) =>
      s
        .split(/\s+/)
        .map(Number)
        .filter((n) => !isNaN(n) && n > 0)
    const rowClues = values.rows.map(parseClue)
    const colClues = values.cols.map(parseClue)

    const size = Math.max(rowClues.length, colClues.length)
    const checkPuzzle = puzzleFromSolution(
      Array.from({ length: size }, () => Array(size).fill(false)),
    )
    checkPuzzle.clues.rows = rowClues
    checkPuzzle.clues.cols = colClues
    const solvable = solve(checkPuzzle) !== null

    if (debug) {
      setIsSolvable(solvable)
      setRecognizedValues(values)
      setPhase('validating')
    } else if (solvable) {
      handleValidationComplete(rowClues, colClues)
    } else {
      setRecognizedValues(values)
      setPhase('correcting')
    }
  }

  const handleValidationComplete = (rowClues: number[][], colClues: number[][]) => {
    const size = Math.max(rowClues.length, colClues.length)
    const emptyGrid = Array.from({ length: size }, () => Array(size).fill(false))
    const puzzle = puzzleFromSolution(emptyGrid)
    puzzle.clues.rows = rowClues
    puzzle.clues.cols = colClues
    loadPuzzle(puzzle)
    reset()
    resetAll()
  }

  const resetAll = () => {
    setPhase('upload')
    setImageData(null)
    setCorners(null)
    setGridCells(null)
    setError(null)
    setRecognizedValues(null)
    setIsSolvable(null)
  }

  const goBack: Partial<Record<Phase, () => void>> = {
    selecting: resetAll,
    extracting: resetAll,
    mosaic: () => {
      setGridCells(null)
      setCorners(null)
      setError(null)
      setPhase('selecting')
    },
    validating: () => setPhase('mosaic'),
    correcting: () => (debug && gridCells ? setPhase('mosaic') : setPhase('selecting')),
  }

  const PHASE_TITLES: Partial<Record<Phase, string>> = {
    selecting: 'Sélection de la grille',
    extracting: 'Sélection de la grille',
    mosaic: 'Vérification du découpage',
    recognizing: 'Reconnaissance des chiffres',
    validating: 'Validation des indices',
    correcting: 'Correction des indices',
  }

  const back = goBack[phase]

  return (
    <div className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* En-tête avec navigation */}
      <div className="flex items-center gap-2">
        {back && (
          <button
            onClick={back}
            className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer text-sm"
            aria-label="Étape précédente"
          >
            ←
          </button>
        )}
        <h3 className="font-semibold text-gray-800">
          {PHASE_TITLES[phase] ?? 'Importer un picross'}
        </h3>
      </div>

      {/* Phase upload */}
      {phase === 'upload' && (
        <>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(['upload', 'camera'] as const).map((t) => (
              <button
                key={t}
                className={[
                  'flex-1 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer',
                  tab === t
                    ? 'bg-white shadow-sm text-gray-900'
                    : 'text-gray-500 hover:text-gray-700',
                ].join(' ')}
                onClick={() => setTab(t)}
              >
                {t === 'upload' ? '📂 Image' : '📷 Caméra'}
              </button>
            ))}
          </div>
          {tab === 'upload' ? (
            <ImageUploader onImage={handleImage} />
          ) : (
            <CameraCapture onCapture={handleImage} />
          )}
        </>
      )}

      {/* Erreur visible dans toutes les phases */}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Phase sélection des coins */}
      {(phase === 'selecting' || phase === 'extracting') && imageData && (
        <CornerSelector
          imageData={imageData}
          onConfirm={handleCornersConfirmed}
          onCancel={resetAll}
        />
      )}

      {/* Découpage en cours */}
      {phase === 'extracting' && (
        <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
          <Spinner />
          <span>Découpage de la grille en cases…</span>
        </div>
      )}

      {/* Phase mosaïque — mode diagnostic uniquement */}
      {phase === 'mosaic' && gridCells && (
        <GridMosaic
          cells={gridCells}
          onConfirm={() => startRecognition(gridCells)}
          onRetry={() => setPhase('selecting')}
        />
      )}

      {/* Phase reconnaissance OCR avec barre de progression */}
      {phase === 'recognizing' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner />
          <span className="text-sm text-gray-600 font-medium">
            Reconnaissance des chiffres… ({recognizeProgress.done} / {recognizeProgress.total})
          </span>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all"
              style={{
                width: `${recognizeProgress.total ? (recognizeProgress.done / recognizeProgress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Phase validation case par case — mode diagnostic uniquement */}
      {phase === 'validating' && gridCells && recognizedValues && (
        <ClueValidator
          cells={gridCells}
          initialValues={recognizedValues}
          solvable={isSolvable}
          onComplete={handleValidationComplete}
          onBack={() => setPhase('mosaic')}
        />
      )}

      {/* Phase correction — grille non soluble, correction manuelle */}
      {phase === 'correcting' && gridCells && recognizedValues && (
        <GridCorrector
          cells={gridCells}
          initialValues={recognizedValues}
          onComplete={handleValidationComplete}
          onBack={goBack.correcting!}
        />
      )}
    </div>
  )
}
