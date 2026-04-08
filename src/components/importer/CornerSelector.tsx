import { useEffect, useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import { expandCornersToGridEdges, type Point } from '@/lib/imageProcessor'
import { useTranslation } from '@/i18n/useTranslation'
import { useDebugStore } from '@/store/debugStore'

interface CornerSelectorProps {
  imageData: ImageData
  onConfirm: (p1: Point, p2: Point) => void
  onCancel: () => void
  /** Coins pré-détectés (coordonnées image originale) pour initialiser la sélection. */
  initialCorners?: [Point, Point]
}

const MARKER_COLOR = '#f97316'
const HIT_RADIUS = 12 // px — rayon de détection pour le drag

export default function CornerSelector({
  imageData,
  onConfirm,
  onCancel,
  initialCorners,
}: CornerSelectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Index du coin en cours de déplacement (-1 = aucun). Ref pour ne pas retriggerer les effets.
  const draggingIdx = useRef<number>(-1)
  const t = useTranslation()
  const { debug } = useDebugStore()
  const [cursor, setCursor] = useState<'crosshair' | 'grab' | 'grabbing'>('crosshair')

  const MAX_W = 560
  const MAX_H = 420
  const scale = Math.min(MAX_W / imageData.width, MAX_H / imageData.height, 1)
  const displayW = Math.round(imageData.width * scale)
  const displayH = Math.round(imageData.height * scale)

  // Initialise les coins à partir de la détection auto (coordonnées image → canvas)
  const [corners, setCorners] = useState<Point[]>(() => {
    if (!initialCorners) return []
    return initialCorners.map((p) => ({ x: p.x * scale, y: p.y * scale }))
  })

  /** Convertit un MouseEvent en coordonnées canvas (corrige le ratio CSS/interne) */
  const canvasPos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const rect = canvasRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvasRef.current!.width / rect.width),
      y: (e.clientY - rect.top) * (canvasRef.current!.height / rect.height),
    }
  }

  /** Retourne l'index du coin proche du point donné, ou -1 */
  const hitCorner = (p: Point): number =>
    corners.findIndex((c) => Math.hypot(c.x - p.x, c.y - p.y) < HIT_RADIUS)

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = canvasPos(e)
    const idx = hitCorner(pos)
    if (idx >= 0) {
      // Commence le drag sur un coin existant
      draggingIdx.current = idx
      setCursor('grabbing')
    } else if (corners.length < 2) {
      // Pose un nouveau coin
      setCorners([...corners, pos])
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = canvasPos(e)
    if (draggingIdx.current >= 0) {
      // Déplace le coin en cours
      const next = [...corners]
      next[draggingIdx.current] = pos
      setCorners(next)
    } else {
      // Met à jour le curseur selon la proximité d'un coin
      setCursor(hitCorner(pos) >= 0 ? 'grab' : 'crosshair')
    }
  }

  const handleMouseUp = () => {
    draggingIdx.current = -1
    setCursor('crosshair')
  }

  // Dessin : redimensionne puis dessine image + overlay dans le même effet
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    canvas.width = displayW
    canvas.height = displayH

    const tmp = document.createElement('canvas')
    tmp.width = imageData.width
    tmp.height = imageData.height
    tmp.getContext('2d')!.putImageData(imageData, 0, 0)
    ctx.drawImage(tmp, 0, 0, displayW, displayH)

    if (corners.length === 0) return

    // Masque hors-sélection + rectangle si 2 coins
    if (corners.length === 2) {
      const [c1, c2] = corners
      const rx = Math.min(c1.x, c2.x)
      const ry = Math.min(c1.y, c2.y)
      const rw = Math.abs(c2.x - c1.x)
      const rh = Math.abs(c2.y - c1.y)
      // Sauvegarder l'image affichée avant le masque
      const snapshot = ctx.getImageData(0, 0, displayW, displayH)
      ctx.fillStyle = 'rgba(0,0,0,0.38)'
      ctx.fillRect(0, 0, displayW, displayH)
      // Restaurer uniquement la zone sélectionnée depuis le snapshot
      const clipCanvas = document.createElement('canvas')
      clipCanvas.width = displayW
      clipCanvas.height = displayH
      clipCanvas.getContext('2d')!.putImageData(snapshot, 0, 0)
      ctx.drawImage(clipCanvas, rx, ry, rw, rh, rx, ry, rw, rh)
      ctx.strokeStyle = MARKER_COLOR
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.strokeRect(rx, ry, rw, rh)
    }

    // Marqueurs de coins
    for (const c of corners) {
      ctx.strokeStyle = MARKER_COLOR
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.beginPath()
      ctx.moveTo(c.x - 14, c.y)
      ctx.lineTo(c.x + 14, c.y)
      ctx.moveTo(c.x, c.y - 14)
      ctx.lineTo(c.x, c.y + 14)
      ctx.stroke()
      ctx.setLineDash([])
      // Cercle de drag (indique qu'on peut déplacer)
      ctx.strokeStyle = MARKER_COLOR
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(c.x, c.y, HIT_RADIUS, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fillStyle = MARKER_COLOR
      ctx.beginPath()
      ctx.arc(c.x, c.y, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }, [corners, imageData, displayW, displayH])

  const handleConfirm = () => {
    if (corners.length < 2) return
    const canvas = canvasRef.current!
    const sx = imageData.width / canvas.width
    const sy = imageData.height / canvas.height
    const rawP1 = { x: corners[0].x * sx, y: corners[0].y * sy }
    const rawP2 = { x: corners[1].x * sx, y: corners[1].y * sy }
    const [p1, p2] = expandCornersToGridEdges(imageData, rawP1, rawP2, debug)
    onConfirm(p1, p2)
  }

  const instructions = [
    t.corner.instruction1cell,
    t.corner.instruction2cell,
    initialCorners ? t.corner.instructionAuto : t.corner.instructionManual,
  ]

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-txt-secondary">{instructions[Math.min(corners.length, 2)]}</p>

      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor }}
        className="rounded border border-brd max-w-full"
      />

      <div className="flex gap-2">
        {corners.length === 2 && (
          <Button onClick={handleConfirm} className="flex-1">
            {t.corner.validateSelection}
          </Button>
        )}
        {corners.length > 0 && (
          <Button variant="secondary" onClick={() => setCorners([])}>
            {t.common.restart}
          </Button>
        )}
        <Button variant="secondary" onClick={onCancel}>
          {t.common.cancel}
        </Button>
      </div>
    </div>
  )
}
