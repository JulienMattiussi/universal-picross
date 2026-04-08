import { useRef, useState } from 'react'
import Spinner from '@/components/ui/Spinner'
import { useTranslation } from '@/i18n/useTranslation'

interface ImageUploaderProps {
  onImage: (imageData: ImageData) => void
}

export default function ImageUploader({ onImage }: ImageUploaderProps) {
  const t = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return
    setLoading(true)
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      setLoading(false)
      onImage(imageData)
    }
    img.onerror = () => setLoading(false)
    img.src = url
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  return (
    <div
      className={[
        'border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer',
        dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-300 hover:border-primary-300',
      ].join(' ')}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      role="button"
      aria-label="Charger une image de picross"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {loading ? (
        <div className="flex flex-col items-center gap-2">
          <Spinner />
          <span className="text-sm text-gray-500">{t.uploader.processing}</span>
        </div>
      ) : (
        <>
          <p className="text-gray-500 text-sm">
            {t.uploader.dropOrClick}{' '}
            <span className="text-primary-600 font-medium">{t.uploader.clickToChoose}</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">{t.uploader.acceptedFormats}</p>
        </>
      )}
    </div>
  )
}
