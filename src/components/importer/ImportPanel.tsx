import { useState } from 'react'
import ImageUploader from './ImageUploader'
import CameraCapture from './CameraCapture'
import CornerSelector from './CornerSelector'
import GridMosaic from './GridMosaic'
import GridCorrector from './GridCorrector'
import ClueValidator from './ClueValidator'
import Spinner from '@/components/ui/Spinner'
import {
  detectGridBounds,
  extractGridCells,
  recognizeAllClueCells,
  type GridCellsResult,
  type Point,
} from '@/lib/imageProcessor'
import { puzzleFromSolution } from '@/lib/generator'
import { solve } from '@/lib/solver'
import { useGame } from '@/hooks/useGame'
import { useDebugStore } from '@/store/debugStore'
import { useTranslation } from '@/i18n/useTranslation'

type Phase =
  | 'upload'
  | 'selecting'
  | 'extracting'
  | 'mosaic'
  | 'recognizing'
  | 'validating'
  | 'correcting'

interface ImportPanelProps {
  mode: 'image' | 'camera'
}

export default function ImportPanel({ mode }: ImportPanelProps) {
  const { loadPuzzle, reset } = useGame()
  const { debug } = useDebugStore()
  const t = useTranslation()

  const [phase, setPhase] = useState<Phase>('upload')
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [gridCells, setGridCells] = useState<GridCellsResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recognizeProgress, setRecognizeProgress] = useState({ done: 0, total: 0 })
  const [recognizedValues, setRecognizedValues] = useState<{
    rows: string[]
    cols: string[]
  } | null>(null)
  const [isSolvable, setIsSolvable] = useState<boolean | null>(null)
  const [detectedCorners, setDetectedCorners] = useState<[Point, Point] | null>(null)

  const handleImage = (data: ImageData) => {
    setImageData(data)
    setPhase('selecting')
    setError(null)
    // Détection automatique des bords de la grille (non bloquant)
    setTimeout(() => {
      const bounds = detectGridBounds(data)
      if (bounds) setDetectedCorners(bounds)
    }, 0)
  }

  const handleCornersConfirmed = (p1: Point, p2: Point) => {
    if (!imageData) return
    setError(null)
    setPhase('extracting' as Phase)
    setTimeout(() => {
      try {
        const cells = extractGridCells(imageData, p1, p2)
        if (!cells) {
          setError(t.import.errorGridDetect)
          setPhase('selecting')
          return
        }

        setGridCells(cells)
        if (debug) {
          setPhase('mosaic')
        } else {
          startRecognition(cells)
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t.import.errorCutting)
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
    const solution = solve(puzzle)
    if (solution) puzzle.solution = solution
    loadPuzzle(puzzle)
    reset()
    resetAll()
  }

  const resetAll = () => {
    setPhase('upload')
    setImageData(null)

    setGridCells(null)
    setError(null)
    setRecognizedValues(null)
    setIsSolvable(null)
    setDetectedCorners(null)
  }

  const goBack: Partial<Record<Phase, () => void>> = {
    selecting: resetAll,
    extracting: resetAll,
    mosaic: () => {
      setGridCells(null)

      setError(null)
      setPhase('selecting')
    },
    validating: () => setPhase('mosaic'),
    correcting: () => (debug && gridCells ? setPhase('mosaic') : setPhase('selecting')),
  }

  const PHASE_TITLES: Record<Phase, string> = {
    upload: mode === 'image' ? t.import.phaseUploadImage : t.import.phaseUploadCamera,
    selecting: t.import.phaseSelecting,
    extracting: t.import.phaseSelecting,
    mosaic: t.import.phaseMosaic,
    recognizing: t.import.phaseRecognizing,
    validating: t.import.phaseValidating,
    correcting: t.import.phaseCorrecting,
  }

  const back = goBack[phase]

  return (
    <div className="flex flex-col gap-3 p-4 bg-surface-card rounded-xl border border-brd shadow-sm">
      {/* En-tête avec navigation */}
      <div className="flex items-center gap-2">
        {back && (
          <button
            onClick={back}
            className="text-txt-muted hover:text-txt-secondary transition-colors cursor-pointer text-sm"
            aria-label="Étape précédente"
          >
            ←
          </button>
        )}
        <h3 className="font-semibold text-txt">
          {PHASE_TITLES[phase]}
          {gridCells && phase !== 'upload' && phase !== 'selecting' && phase !== 'extracting' && (
            <span className="ml-2 text-xs font-normal text-txt-muted">
              ({gridCells.colored ? 'Color' : 'N&B'})
            </span>
          )}
        </h3>
      </div>

      {/* Phase upload */}
      {phase === 'upload' &&
        (mode === 'image' ? (
          <ImageUploader onImage={handleImage} />
        ) : (
          <CameraCapture onCapture={handleImage} />
        ))}

      {/* Erreur visible dans toutes les phases */}
      {error && <p className="text-sm text-status-error">{error}</p>}

      {/* Phase sélection des coins */}
      {(phase === 'selecting' || phase === 'extracting') && imageData && (
        <CornerSelector
          imageData={imageData}
          onConfirm={handleCornersConfirmed}
          onCancel={resetAll}
          initialCorners={detectedCorners ?? undefined}
        />
      )}

      {/* Découpage en cours */}
      {phase === 'extracting' && (
        <div className="flex items-center gap-2 py-2 text-sm text-txt-tertiary">
          <Spinner />
          <span>{t.import.extracting}</span>
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
          <span className="text-sm text-txt-secondary font-medium">
            {t.import.recognizingProgress} ({recognizeProgress.done} / {recognizeProgress.total})
          </span>
          <div className="w-full bg-surface-tertiary rounded-full h-2">
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
