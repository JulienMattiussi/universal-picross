import { useRef, useState } from 'react'
import ImageUploader from '@/components/importer/ImageUploader'
import CameraCapture from '@/components/importer/CameraCapture'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import PixelPreview from './PixelPreview'
import { imageToSolutionGrid, processPhotoToPuzzle } from '@/lib/photoToPuzzle'
import { useGame } from '@/hooks/useGame'
import { useTranslation } from '@/i18n/useTranslation'
import type { SolutionGrid } from '@/lib/types'

type Phase = 'upload' | 'configure' | 'preview' | 'processing'

interface PhotoToPuzzlePanelProps {
  mode: 'image' | 'camera'
}

export default function PhotoToPuzzlePanel({ mode }: PhotoToPuzzlePanelProps) {
  const t = useTranslation()
  const { loadPuzzle } = useGame()

  const [phase, setPhase] = useState<Phase>('upload')
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [gridSize, setGridSize] = useState(15)
  const [solution, setSolution] = useState<SolutionGrid | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notUnique, setNotUnique] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleImage = (data: ImageData) => {
    setImageData(data)
    setPhase('configure')
    setError(null)
  }

  const handleConvert = () => {
    if (!imageData) return
    const grid = imageToSolutionGrid(imageData, gridSize)

    // Vérification densité
    const total = gridSize * gridSize
    const filled = grid.flat().filter(Boolean).length
    const density = filled / total
    if (density < 0.1 || density > 0.9) {
      setError(t.photoToPuzzle.tooEmpty)
      return
    }

    setError(null)
    setSolution(grid)
    setPhase('preview')
  }

  const handleConfirm = async () => {
    if (!solution) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('processing')
    setNotUnique(false)

    try {
      const { puzzle, unique } = await processPhotoToPuzzle(solution, controller.signal)
      if (controller.signal.aborted) return
      if (!unique) {
        setNotUnique(true)
        setPhase('preview')
        return
      }
      loadPuzzle(puzzle)
    } catch {
      /* AbortError */
    }
  }

  const handlePlayAnyway = async () => {
    if (!solution) return
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setPhase('processing')

    try {
      const { puzzle } = await processPhotoToPuzzle(solution, controller.signal)
      if (!controller.signal.aborted) loadPuzzle(puzzle)
    } catch {
      /* AbortError */
    }
  }

  const handleBack = () => {
    abortRef.current?.abort()
    if (phase === 'configure') {
      setImageData(null)
      setPhase('upload')
    } else if (phase === 'preview' || phase === 'processing') {
      setPhase('configure')
      setSolution(null)
      setNotUnique(false)
    }
  }

  const PHASE_TITLES: Record<Phase, string> = {
    upload: t.photoToPuzzle.title,
    configure: t.photoToPuzzle.chooseSize,
    preview: t.photoToPuzzle.preview,
    processing: t.photoToPuzzle.processing,
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-surface-card rounded-xl border border-brd shadow-sm">
      <div className="flex items-center gap-2">
        {phase !== 'upload' && (
          <button
            onClick={handleBack}
            className="text-txt-muted hover:text-txt-secondary transition-colors cursor-pointer text-sm"
          >
            ←
          </button>
        )}
        <h3 className="font-semibold text-txt">{PHASE_TITLES[phase]}</h3>
      </div>

      {error && <p className="text-sm text-status-error">{error}</p>}

      {/* Phase upload */}
      {phase === 'upload' &&
        (mode === 'image' ? (
          <ImageUploader onImage={handleImage} />
        ) : (
          <CameraCapture onCapture={handleImage} />
        ))}

      {/* Phase configure : choix de taille */}
      {phase === 'configure' && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-sm text-txt-secondary">
              {t.photoToPuzzle.chooseSize} :{' '}
              <span className="font-medium">
                {gridSize}×{gridSize}
              </span>
            </label>
            <input
              type="range"
              min={5}
              max={20}
              value={gridSize}
              onChange={(e) => setGridSize(Number(e.target.value))}
              className="accent-primary-500"
            />
            <div className="flex justify-between text-xs text-txt-muted">
              <span>5</span>
              <span>20</span>
            </div>
          </div>
          <Button onClick={handleConvert} className="w-full">
            {t.photoToPuzzle.convert}
          </Button>
        </div>
      )}

      {/* Phase preview */}
      {phase === 'preview' && solution && (
        <div className="flex flex-col items-center gap-4">
          <p className="text-sm text-txt-secondary">{t.photoToPuzzle.previewDesc}</p>
          <PixelPreview grid={solution} />

          {notUnique && (
            <div className="text-sm text-warn-text bg-warn-bg border border-warn-border rounded-lg px-3 py-2 w-full">
              {t.photoToPuzzle.notUnique}
            </div>
          )}

          <div className="flex gap-2 w-full">
            <Button variant="secondary" onClick={handleBack}>
              ←
            </Button>
            {notUnique ? (
              <Button onClick={handlePlayAnyway} className="flex-1">
                {t.photoToPuzzle.playAnyway}
              </Button>
            ) : (
              <Button onClick={handleConfirm} className="flex-1">
                {t.photoToPuzzle.confirmAndPlay}
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Phase processing */}
      {phase === 'processing' && (
        <div className="flex flex-col items-center gap-3 py-4">
          <Spinner />
          <span className="text-sm text-txt-secondary font-medium">
            {t.photoToPuzzle.processing}
          </span>
          <Button variant="secondary" size="sm" onClick={handleBack}>
            {t.common.cancel}
          </Button>
        </div>
      )}
    </div>
  )
}
