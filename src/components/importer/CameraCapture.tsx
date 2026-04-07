import { useState } from 'react'
import Button from '@/components/ui/Button'
import { useCamera } from '@/hooks/useCamera'

interface CameraCaptureProps {
  onCapture: (imageData: ImageData) => void
}

export default function CameraCapture({ onCapture }: CameraCaptureProps) {
  const { videoRef, isStreaming, error, startCamera, stopCamera, captureFrame } = useCamera()
  const [captured, setCaptured] = useState(false)

  const handleCapture = () => {
    const frame = captureFrame()
    if (frame) {
      stopCamera()
      setCaptured(true)
      onCapture(frame)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-500">{error}</p>}

      {isStreaming ? (
        <>
          <video ref={videoRef} className="w-full rounded-lg bg-black" playsInline muted />
          <div className="flex gap-2">
            <Button onClick={handleCapture} className="flex-1">
              Capturer
            </Button>
            <Button variant="secondary" onClick={stopCamera}>
              Annuler
            </Button>
          </div>
        </>
      ) : (
        <Button variant="secondary" onClick={startCamera} disabled={captured} className="w-full">
          {captured ? 'Photo prise ✓' : '📷 Prendre une photo'}
        </Button>
      )}
    </div>
  )
}
