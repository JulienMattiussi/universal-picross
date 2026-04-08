/**
 * Template matching: compare preprocessed cell images to known digit templates.
 * Stratégie : on redimensionne les templates à la taille de la case (pas l'inverse).
 * La case reste intacte → zéro déformation.
 */

import { getTemplateBank, CANONICAL_W, CANONICAL_H } from '@/lib/image/templateBank'
import type { DigitTemplate } from '@/lib/image/templateBank'

const MATCH_THRESHOLD = 0.3
const MIN_BLOB_WIDTH = 3
const SEPARATOR_MIN_GAP = 2

/**
 * Binarise un canvas en Uint8Array (0=noir, 255=blanc).
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
 * Redimensionne un template (bitmap CANONICAL_W×CANONICAL_H) à la taille cible,
 * en préservant le ratio d'aspect et en centrant.
 */
function resizeTemplate(tmpl: DigitTemplate, targetW: number, targetH: number): Uint8Array {
  // Dessiner le template sur un canvas canonique
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

  // Redimensionner en préservant le ratio, centré dans targetW×targetH
  const scale = Math.min(targetW / CANONICAL_W, targetH / CANONICAL_H)
  const dw = Math.round(CANONICAL_W * scale)
  const dh = Math.round(CANONICAL_H * scale)
  const ox = Math.round((targetW - dw) / 2)
  const oy = Math.round((targetH - dh) / 2)

  const dst = document.createElement('canvas')
  dst.width = targetW
  dst.height = targetH
  const ctx = dst.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, targetW, targetH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'
  ctx.drawImage(src, ox, oy, dw, dh)

  return binarize(dst)
}

/**
 * Similarité basée sur l'intersection des pixels noirs (IoU - Intersection over Union).
 * Mesure à quel point les formes noires se superposent, indépendamment du fond blanc.
 * Pénalise naturellement les différences de densité.
 */
function shapeSimilarity(a: Uint8Array, b: Uint8Array): number {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0

  let intersection = 0 // pixels noirs dans les deux
  let union = 0 // pixels noirs dans au moins un

  for (let i = 0; i < n; i++) {
    const aBlack = a[i] === 0
    const bBlack = b[i] === 0
    if (aBlack && bBlack) intersection++
    if (aBlack || bBlack) union++
  }

  return union === 0 ? 0 : intersection / union
}

/**
 * Match un bitmap de case (taille originale) contre la banque de templates.
 * Chaque template est redimensionné à la taille de la case.
 * Retourne le chiffre le plus probable ou -1 si sous le seuil.
 */
function matchSingle(
  cellBitmap: Uint8Array,
  cellW: number,
  cellH: number,
): { digit: number; score: number; bestTmpl: DigitTemplate | null } {
  const bank = getTemplateBank()
  let bestDigit = -1
  let bestScore = 0
  let bestTmpl: DigitTemplate | null = null

  for (const tmpl of bank) {
    const resized = resizeTemplate(tmpl, cellW, cellH)
    const score = shapeSimilarity(cellBitmap, resized)
    if (score > bestScore) {
      bestScore = score
      bestDigit = tmpl.digit
      bestTmpl = tmpl
    }
  }

  return { digit: bestDigit, score: bestScore, bestTmpl }
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Détecte les runs de lignes/colonnes contenant du noir dans l'image.
 */
function findBlackRuns(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  horizontal: boolean,
): { start: number; size: number }[] {
  const len = horizontal ? width : height
  const cross = horizontal ? height : width

  const hasBlack: boolean[] = []
  for (let i = 0; i < len; i++) {
    let found = false
    for (let j = 0; j < cross; j++) {
      const px = horizontal ? i : j
      const py = horizontal ? j : i
      const idx = (py * width + px) * 4
      const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
      if (lum < 128) {
        found = true
        break
      }
    }
    hasBlack.push(found)
  }

  const runs: { start: number; size: number }[] = []
  let inRun = false
  let runStart = 0
  for (let i = 0; i <= len; i++) {
    if (i < len && hasBlack[i]) {
      if (!inRun) {
        inRun = true
        runStart = i
      }
    } else if (inRun) {
      inRun = false
      const size = i - runStart
      if (size >= MIN_BLOB_WIDTH) runs.push({ start: runStart, size })
    }
  }

  // Fusionner les runs trop proches
  const merged: { start: number; size: number }[] = []
  for (const run of runs) {
    const last = merged[merged.length - 1]
    if (last && run.start - (last.start + last.size) < SEPARATOR_MIN_GAP) {
      last.size = run.start + run.size - last.start
    } else {
      merged.push({ ...run })
    }
  }

  return merged
}

/**
 * Segmente un canvas en rectangles individuels (un par chiffre).
 * Détecte automatiquement si les chiffres sont côte à côte (horizontal)
 * ou empilés (vertical) et segmente dans la bonne direction.
 */
export function segmentBlobs(canvas: HTMLCanvasElement): Rect[] {
  const ctx = canvas.getContext('2d')!
  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height)

  const hRuns = findBlackRuns(data, width, height, true) // colonnes
  const vRuns = findBlackRuns(data, width, height, false) // lignes

  // Si on trouve plusieurs blobs horizontaux → chiffres côte à côte
  if (hRuns.length > 1) {
    return hRuns.map((r) => ({ x: r.start, y: 0, w: r.size, h: height }))
  }

  // Si on trouve plusieurs blobs verticaux → chiffres empilés
  if (vRuns.length > 1) {
    return vRuns.map((r) => ({ x: 0, y: r.start, w: width, h: r.size }))
  }

  // Un seul blob → toute la zone
  if (hRuns.length === 1) {
    return [{ x: hRuns[0].start, y: 0, w: hRuns[0].size, h: height }]
  }

  return []
}

/**
 * Extrait un sous-canvas à partir d'un rectangle.
 */
export function extractBlob(canvas: HTMLCanvasElement, rect: Rect): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = rect.w
  out.height = rect.h
  out.getContext('2d')!.drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h)
  return out
}

/**
 * Convertit un bitmap binaire en data URL pour l'affichage debug.
 */
function bitmapToDataUrl(bitmap: Uint8Array, w: number, h: number): string {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(w, h)
  for (let i = 0; i < bitmap.length; i++) {
    const v = bitmap[i]
    imgData.data[i * 4] = v
    imgData.data[i * 4 + 1] = v
    imgData.data[i * 4 + 2] = v
    imgData.data[i * 4 + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas.toDataURL()
}

/**
 * Reconnaît les chiffres dans un canvas prétraité par template matching.
 * Retourne une string type "3 1 2" ou "" si rien reconnu.
 */
export function matchCellDigits(prepared: HTMLCanvasElement, debug = false): string {
  const blobs = segmentBlobs(prepared)
  if (blobs.length === 0) {
    if (debug) console.log('%c[MATCH] aucun blob trouvé', 'color: #ef4444')
    return ''
  }

  const digits: string[] = []

  for (const blob of blobs) {
    const blobCanvas = extractBlob(prepared, blob)
    const cellBitmap = binarize(blobCanvas)
    const { digit, score, bestTmpl } = matchSingle(cellBitmap, blobCanvas.width, blobCanvas.height)

    if (debug) {
      const ok = digit >= 0 && score >= MATCH_THRESHOLD
      const cellUrl = bitmapToDataUrl(cellBitmap, blobCanvas.width, blobCanvas.height)
      const tmplRawUrl = bestTmpl ? bitmapToDataUrl(bestTmpl.bitmap, CANONICAL_W, CANONICAL_H) : ''
      const tmplScaledUrl = bestTmpl
        ? bitmapToDataUrl(
            resizeTemplate(bestTmpl, blobCanvas.width, blobCanvas.height),
            blobCanvas.width,
            blobCanvas.height,
          )
        : ''

      console.log(
        `[MATCH] blob ${blob.w}×${blob.h} → %c${ok ? digit : '?'}%c (${(score * 100).toFixed(0)}%)\n` +
          `Case: %c     %c  Tmpl brut: %c     %c  Tmpl upscalé: %c     `,
        ok
          ? 'color:green;font-weight:bold;font-size:16px'
          : 'color:red;font-weight:bold;font-size:16px',
        '',
        `background:url(${cellUrl}) no-repeat center/contain;padding:24px 16px;border:1px solid #ccc`,
        '',
        `background:url(${tmplRawUrl}) no-repeat center/contain;padding:24px 16px;border:1px solid #ccc`,
        '',
        `background:url(${tmplScaledUrl}) no-repeat center/contain;padding:24px 16px;border:1px solid #ccc`,
      )
    }

    if (digit >= 0 && score >= MATCH_THRESHOLD) {
      digits.push(String(digit))
    }
  }

  return digits.join(' ')
}
