/**
 * Reconnaissance de chiffres par distance de Hausdorff sur les contours.
 * Compare la forme (topologie) plutôt que la surface (IoU).
 * Insensible à l'épaisseur des traits.
 */

import { getTemplateBank, CANONICAL_W, CANONICAL_H } from '@/lib/image/templateBank'
import type { DigitTemplate } from '@/lib/image/templateBank'

const MATCH_THRESHOLD = 0.6

interface Point {
  x: number
  y: number
}

/**
 * Extrait les pixels de contour (bord de forme noire) d'un bitmap binaire.
 */
function extractContour(bitmap: Uint8Array, w: number, h: number): Point[] {
  const contour: Point[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bitmap[y * w + x] !== 0) continue // pas noir
      // Pixel noir avec au moins un voisin blanc → contour
      let isBorder = false
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ]) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= w || ny < 0 || ny >= h || bitmap[ny * w + nx] !== 0) {
          isBorder = true
          break
        }
      }
      if (isBorder) contour.push({ x, y })
    }
  }
  return contour
}

/**
 * Distance de Hausdorff dirigée : max distance de chaque point de A vers le plus proche dans B.
 * Normalisée par la diagonale.
 */
function directedHausdorff(a: Point[], b: Point[]): number {
  if (a.length === 0 || b.length === 0) return 1

  let maxDist = 0
  for (const pa of a) {
    let minDist = Infinity
    for (const pb of b) {
      const d = Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y) // Manhattan (plus rapide)
      if (d < minDist) minDist = d
    }
    if (minDist > maxDist) maxDist = minDist
  }
  return maxDist
}

/**
 * Distance de Hausdorff symétrique normalisée (0 = identique, 1 = très différent).
 */
function hausdorffDistance(a: Point[], b: Point[], diag: number): number {
  const d = Math.max(directedHausdorff(a, b), directedHausdorff(b, a))
  return Math.min(d / diag, 1)
}

/**
 * Binarise un canvas en Uint8Array.
 */
function binarize(canvas: HTMLCanvasElement): Uint8Array {
  const { data, width, height } = canvas
    .getContext('2d')!
    .getImageData(0, 0, canvas.width, canvas.height)
  const n = width * height
  const bitmap = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    bitmap[i] = lum > 128 ? 255 : 0
  }
  return bitmap
}

/**
 * Redimensionne un template à la taille cible (même méthode que templateMatch.ts).
 */
function resizeTemplateBitmap(tmpl: DigitTemplate, tw: number, th: number): Uint8Array {
  const src = document.createElement('canvas')
  src.width = CANONICAL_W
  src.height = CANONICAL_H
  const srcCtx = src.getContext('2d')!
  const srcImg = srcCtx.createImageData(CANONICAL_W, CANONICAL_H)
  for (let i = 0; i < tmpl.bitmap.length; i++) {
    const v = tmpl.bitmap[i]
    srcImg.data[i * 4] = v
    srcImg.data[i * 4 + 1] = v
    srcImg.data[i * 4 + 2] = v
    srcImg.data[i * 4 + 3] = 255
  }
  srcCtx.putImageData(srcImg, 0, 0)

  const scale = Math.min(tw / CANONICAL_W, th / CANONICAL_H)
  const dw = Math.round(CANONICAL_W * scale)
  const dh = Math.round(CANONICAL_H * scale)
  const ox = Math.round((tw - dw) / 2)
  const oy = Math.round((th - dh) / 2)

  const dst = document.createElement('canvas')
  dst.width = tw
  dst.height = th
  const ctx = dst.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, tw, th)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'
  ctx.drawImage(src, ox, oy, dw, dh)

  return binarize(dst)
}

/**
 * Reconnaît un chiffre par distance de Hausdorff sur les contours.
 */
function matchSingleHausdorff(
  cellBitmap: Uint8Array,
  cellW: number,
  cellH: number,
): { digit: number; score: number } {
  const cellContour = extractContour(cellBitmap, cellW, cellH)
  if (cellContour.length === 0) return { digit: -1, score: 0 }

  const diag = Math.sqrt(cellW * cellW + cellH * cellH)
  const bank = getTemplateBank()

  let bestDigit = -1
  let bestScore = 0

  for (const tmpl of bank) {
    const tmplBitmap = resizeTemplateBitmap(tmpl, cellW, cellH)
    const tmplContour = extractContour(tmplBitmap, cellW, cellH)
    if (tmplContour.length === 0) continue

    const dist = hausdorffDistance(cellContour, tmplContour, diag)
    const score = 1 - dist // 1 = identique, 0 = très différent

    if (score > bestScore) {
      bestScore = score
      bestDigit = tmpl.digit
    }
  }

  return { digit: bestDigit, score: bestScore }
}

/**
 * Reconnaît un chiffre unique dans un canvas par Hausdorff.
 * Retourne le chiffre et le score, ou "" si sous le seuil.
 */
export function matchDigitHausdorff(canvas: HTMLCanvasElement): {
  text: string
  score: number
  digit: number
} {
  const bitmap = binarize(canvas)
  const { digit, score } = matchSingleHausdorff(bitmap, canvas.width, canvas.height)

  if (digit >= 0 && score >= MATCH_THRESHOLD) {
    return { text: String(digit), score, digit }
  }
  return { text: '', score, digit }
}
