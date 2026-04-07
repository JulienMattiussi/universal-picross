import { useState } from 'react'
import ImageUploader from './ImageUploader'
import CameraCapture from './CameraCapture'
import GridCorrector from './GridCorrector'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import { processImage, type ProcessResult } from '@/lib/imageProcessor'

type Tab = 'upload' | 'camera'

export default function ImportPanel() {
  const [tab, setTab] = useState<Tab>('upload')
  const [processing, setProcessing] = useState(false)
  const [result, setResult] = useState<ProcessResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleImage = async (imageData: ImageData) => {
    setProcessing(true)
    setError(null)
    const res = await processImage(imageData)
    setProcessing(false)

    if ('message' in res) {
      setError(res.message)
    } else {
      setResult(res)
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-800">Importer un picross</h3>

      {/* Onglets */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {(['upload', 'camera'] as const).map((t) => (
          <button
            key={t}
            className={[
              'flex-1 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer',
              tab === t ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
            onClick={() => setTab(t)}
          >
            {t === 'upload' ? '📂 Image' : '📷 Caméra'}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {processing ? (
        <div className="flex flex-col items-center gap-2 py-4">
          <Spinner />
          <span className="text-sm text-gray-500">Analyse de l'image…</span>
        </div>
      ) : tab === 'upload' ? (
        <ImageUploader onImage={handleImage} />
      ) : (
        <CameraCapture onCapture={handleImage} />
      )}

      <Modal
        open={!!result}
        onClose={() => setResult(null)}
        title="Vérification des indices"
      >
        {result && (
          <GridCorrector result={result} onClose={() => setResult(null)} />
        )}
      </Modal>
    </div>
  )
}
