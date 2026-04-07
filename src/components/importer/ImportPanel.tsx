import { useState } from 'react'
import ImageUploader from './ImageUploader'
import CameraCapture from './CameraCapture'
import CornerSelector from './CornerSelector'
import GridMosaic from './GridMosaic'
import GridCorrector from './GridCorrector'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import {
  extractGridCells,
  processImageWithCorners,
  PROCESS_STEPS,
  type GridCellsResult,
  type ProcessResult,
  type ProcessStep,
  type Point,
} from '@/lib/imageProcessor'

const STEP_LABELS: Record<ProcessStep, string> = {
  cropping: "Recadrage de l'image…",
  'analyzing-grid': 'Analyse des lignes de la grille…',
  'extracting-clues': "Extraction des zones d'indices…",
  'loading-ocr': 'Chargement du moteur OCR…',
  'recognizing-rows': 'Lecture des indices de lignes…',
  'recognizing-cols': 'Lecture des indices de colonnes…',
  finalizing: 'Finalisation…',
}

type Tab = 'upload' | 'camera'
type Phase = 'upload' | 'selecting' | 'extracting' | 'mosaic' | 'processing' | 'done'

export default function ImportPanel() {
  const [tab, setTab] = useState<Tab>('upload')
  const [phase, setPhase] = useState<Phase>('upload')
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [corners, setCorners] = useState<[Point, Point] | null>(null)
  const [gridCells, setGridCells] = useState<GridCellsResult | null>(null)
  const [currentStep, setCurrentStep] = useState<ProcessStep | null>(null)
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImage = (data: ImageData) => {
    setImageData(data)
    setPhase('selecting')
    setError(null)
  }

  const handleCornersConfirmed = (p1: Point, p2: Point) => {
    if (!imageData) return
    setError(null)
    // extractGridCells est synchrone mais génère de nombreux canvas/toDataURL —
    // on passe par un microtask pour laisser React rendre le spinner d'abord.
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
        setPhase('mosaic')
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erreur lors du découpage.')
        setPhase('selecting')
      }
    }, 0)
  }

  const handleMosaicConfirmed = async () => {
    if (!imageData || !corners) return
    setPhase('processing')
    setCurrentStep(null)
    const res = await processImageWithCorners(imageData, corners[0], corners[1], setCurrentStep)
    if ('message' in res) {
      setError(res.message)
      setPhase('upload')
    } else {
      setResult(res)
      setPhase('done')
    }
  }

  const reset = () => {
    setPhase('upload')
    setImageData(null)
    setCorners(null)
    setGridCells(null)
    setCurrentStep(null)
    setError(null)
    setResult(null)
  }

  // Retour d'une étape en arrière selon la phase courante
  const goBack: Partial<Record<Phase, () => void>> = {
    selecting: reset,
    extracting: reset,
    mosaic: () => {
      setGridCells(null)
      setCorners(null)
      setError(null)
      setPhase('selecting')
    },
  }

  const PHASE_TITLES: Partial<Record<Phase, string>> = {
    selecting: 'Sélection de la grille',
    extracting: 'Sélection de la grille',
    mosaic: 'Vérification du découpage',
    processing: 'Reconnaissance des indices',
  }

  const currentStepIdx = currentStep ? PROCESS_STEPS.indexOf(currentStep) : -1
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
        <CornerSelector imageData={imageData} onConfirm={handleCornersConfirmed} onCancel={reset} />
      )}

      {/* Découpage en cours (opérations canvas synchrones) */}
      {phase === 'extracting' && (
        <div className="flex items-center gap-2 py-2 text-sm text-gray-500">
          <Spinner />
          <span>Découpage de la grille en cases…</span>
        </div>
      )}

      {/* Phase mosaïque — vérification visuelle du découpage */}
      {phase === 'mosaic' && gridCells && (
        <GridMosaic
          cells={gridCells}
          onConfirm={handleMosaicConfirmed}
          onRetry={() => setPhase('selecting')}
        />
      )}

      {/* Phase traitement — liste des étapes avec suivi */}
      {phase === 'processing' && (
        <div className="flex flex-col gap-3 py-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Spinner />
            <span className="font-medium">
              {currentStep ? STEP_LABELS[currentStep] : 'Démarrage…'}
            </span>
          </div>
          <ol className="flex flex-col gap-1 pl-1">
            {PROCESS_STEPS.map((step, idx) => {
              const done = idx < currentStepIdx
              const active = idx === currentStepIdx
              return (
                <li key={step} className="flex items-center gap-2 text-sm">
                  <span
                    className={[
                      'w-4 text-center font-mono',
                      done ? 'text-green-500' : active ? 'text-primary-500' : 'text-gray-300',
                    ].join(' ')}
                  >
                    {done ? '✓' : active ? '›' : '○'}
                  </span>
                  <span
                    className={done ? 'text-gray-400' : active ? 'text-gray-800' : 'text-gray-400'}
                  >
                    {STEP_LABELS[step]}
                  </span>
                </li>
              )
            })}
          </ol>
        </div>
      )}

      {/* Phase résultat */}
      <Modal open={phase === 'done' && !!result} onClose={reset} title="Vérification des indices">
        {result && <GridCorrector result={result} onClose={reset} />}
      </Modal>
    </div>
  )
}
