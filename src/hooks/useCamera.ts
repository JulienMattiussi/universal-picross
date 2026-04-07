import { useRef, useState, useCallback } from 'react'

interface UseCameraReturn {
  videoRef: React.RefObject<HTMLVideoElement | null>
  isStreaming: boolean
  error: string | null
  startCamera: () => Promise<void>
  stopCamera: () => void
  captureFrame: () => ImageData | null
}

/**
 * Hook gérant l'accès à la caméra via getUserMedia.
 */
export function useCamera(): UseCameraReturn {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const startCamera = useCallback(async () => {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsStreaming(true)
    } catch {
      setError('Impossible d\'accéder à la caméra. Vérifiez les permissions.')
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setIsStreaming(false)
  }, [])

  const captureFrame = useCallback((): ImageData | null => {
    const video = videoRef.current
    if (!video || !isStreaming) return null

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0)
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }, [isStreaming])

  return { videoRef, isStreaming, error, startCamera, stopCamera, captureFrame }
}
