import type { PicrossPuzzle, SolutionGrid } from './types'

/**
 * Convertit une image en grille booléenne NxN.
 * L'image est centrée/croppée en carré, redimensionnée, puis seuillée (Otsu).
 */
export function imageToSolutionGrid(imageData: ImageData, gridSize: number): SolutionGrid {
  const { width, height } = imageData

  // Crop carré centré
  const side = Math.min(width, height)
  const ox = Math.floor((width - side) / 2)
  const oy = Math.floor((height - side) / 2)

  // Canvas source croppé
  const src = document.createElement('canvas')
  src.width = side
  src.height = side
  const srcCtx = src.getContext('2d')!
  const srcCanvas = document.createElement('canvas')
  srcCanvas.width = width
  srcCanvas.height = height
  srcCanvas.getContext('2d')!.putImageData(imageData, 0, 0)
  srcCtx.drawImage(srcCanvas, ox, oy, side, side, 0, 0, side, side)

  // Redimensionner à gridSize x gridSize
  const small = document.createElement('canvas')
  small.width = gridSize
  small.height = gridSize
  const ctx = small.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'
  ctx.drawImage(src, 0, 0, gridSize, gridSize)

  const pixels = ctx.getImageData(0, 0, gridSize, gridSize)
  const n = gridSize * gridSize

  // Niveaux de gris
  const gray = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    gray[i] =
      (0.299 * pixels.data[i * 4] +
        0.587 * pixels.data[i * 4 + 1] +
        0.114 * pixels.data[i * 4 + 2]) /
      255
  }

  // Seuil Otsu
  const threshold = otsuThreshold(gray)

  // Classe majoritaire = fond
  let aboveCount = 0
  for (let i = 0; i < n; i++) if (gray[i] > threshold) aboveCount++
  const bgIsLight = aboveCount >= n / 2

  // Grille booléenne
  return Array.from({ length: gridSize }, (_, r) =>
    Array.from({ length: gridSize }, (_, c) => {
      const v = gray[r * gridSize + c]
      return bgIsLight ? v < threshold : v > threshold
    }),
  )
}

function otsuThreshold(grays: Float32Array): number {
  const hist = new Float32Array(256)
  for (let i = 0; i < grays.length; i++) hist[Math.round(grays[i] * 255)]++
  const total = grays.length
  for (let i = 0; i < 256; i++) hist[i] /= total

  let sumAll = 0
  for (let i = 0; i < 256; i++) sumAll += i * hist[i]

  let bestT = 128,
    bestVar = -1,
    w0 = 0,
    sum0 = 0
  for (let t = 0; t < 256; t++) {
    w0 += hist[t]
    sum0 += t * hist[t]
    const w1 = 1 - w0
    if (w0 === 0 || w1 === 0) continue
    const mu0 = sum0 / w0
    const mu1 = (sumAll - sum0) / w1
    const v = w0 * w1 * (mu0 - mu1) ** 2
    if (v > bestVar) {
      bestVar = v
      bestT = t
    }
  }
  return bestT / 255
}

/**
 * Vérifie la solvabilité et ajuste la grille dans un Web Worker.
 * Retourne le puzzle + un flag indiquant si la solution est unique.
 */
export function processPhotoToPuzzle(
  solution: SolutionGrid,
  signal?: AbortSignal,
): Promise<{ puzzle: PicrossPuzzle; unique: boolean }> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./photoToPuzzleWorker.ts', import.meta.url), {
      type: 'module',
    })

    const cleanup = () => {
      worker.terminate()
      signal?.removeEventListener('abort', onAbort)
    }

    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    if (signal?.aborted) {
      worker.terminate()
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    signal?.addEventListener('abort', onAbort)

    worker.onmessage = (e: MessageEvent<{ puzzle: PicrossPuzzle; unique: boolean }>) => {
      cleanup()
      resolve(e.data)
    }

    worker.onerror = (e) => {
      cleanup()
      reject(new Error(e.message))
    }

    worker.postMessage(solution)
  })
}
