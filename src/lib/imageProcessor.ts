import type { SolutionGrid } from './types'

export interface ProcessResult {
  grid: SolutionGrid
  confidence: number // 0-1, score moyen de confiance de l'OCR
  rawClues: { rows: number[][]; cols: number[][] }
}

export interface ProcessError {
  message: string
  step: 'detection' | 'ocr' | 'parse'
}

/**
 * Charge OpenCV.js en lazy-load (WebAssembly ~8MB).
 * Retourne l'objet cv global une fois prêt.
 */
async function loadOpenCV(): Promise<typeof window.cv> {
  if (typeof window.cv !== 'undefined' && window.cv.Mat) return window.cv

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://docs.opencv.org/4.9.0/opencv.js'
    script.async = true
    script.onload = () => {
      // opencv.js appelle Module.onRuntimeInitialized quand prêt
      if (window.cv && window.cv.Mat) {
        resolve(window.cv)
      } else {
        window.cv = {
          ...window.cv,
          onRuntimeInitialized: () => resolve(window.cv),
        }
      }
    }
    script.onerror = () => reject(new Error('Échec du chargement OpenCV.js'))
    document.head.appendChild(script)
  })
}

/**
 * Convertit une ImageData en canvas pour traitement.
 */
function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')!
  ctx.putImageData(imageData, 0, 0)
  return canvas
}

/**
 * Détecte et extrait la grille de picross depuis une image via OpenCV.
 * Retourne un canvas recadré sur la grille.
 */
async function detectGrid(imageData: ImageData): Promise<HTMLCanvasElement> {
  const cv = await loadOpenCV()
  const canvas = imageDataToCanvas(imageData)
  const src = cv.imread(canvas)

  // Conversion en niveaux de gris
  const gray = new cv.Mat()
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)

  // Seuillage adaptatif
  const binary = new cv.Mat()
  cv.adaptiveThreshold(gray, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2)

  // Détection des contours
  const contours = new cv.MatVector()
  const hierarchy = new cv.Mat()
  cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

  // Trouver le plus grand rectangle (la grille)
  let maxArea = 0
  let bestRect = { x: 0, y: 0, width: src.cols, height: src.rows }

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i)
    const rect = cv.boundingRect(cnt)
    const area = rect.width * rect.height
    if (area > maxArea && rect.width > src.cols * 0.3 && rect.height > src.rows * 0.3) {
      maxArea = area
      bestRect = rect
    }
    cnt.delete()
  }

  // Recadrer sur la grille détectée
  const roi = src.roi(new cv.Rect(bestRect.x, bestRect.y, bestRect.width, bestRect.height))
  const resultCanvas = document.createElement('canvas')
  resultCanvas.width = bestRect.width
  resultCanvas.height = bestRect.height
  cv.imshow(resultCanvas, roi)

  // Nettoyage mémoire WebAssembly
  src.delete(); gray.delete(); binary.delete()
  contours.delete(); hierarchy.delete(); roi.delete()

  return resultCanvas
}

/**
 * Extrait les indices (chiffres) depuis les zones d'indices d'un canvas de grille
 * en utilisant Tesseract.js.
 */
async function extractCluesWithOCR(
  gridCanvas: HTMLCanvasElement,
): Promise<{ rows: number[][]; cols: number[][]; confidence: number }> {
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, {
    logger: () => {}, // Silencer le logger verbose
  })

  await worker.setParameters({
    tessedit_char_whitelist: '0123456789 ',
    tessedit_pageseg_mode: '6' as unknown as Parameters<typeof worker.setParameters>[0]['tessedit_pageseg_mode'],
  })

  // Pour l'instant, on fait une reconnaissance sur toute l'image
  // et on laisse l'utilisateur corriger via GridCorrector
  const result = await worker.recognize(gridCanvas)
  await worker.terminate()

  // Parsing basique : extraire les lignes de chiffres
  const lines = result.data.text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) =>
      l.split(/\s+/)
        .map(Number)
        .filter((n) => !isNaN(n) && n >= 0),
    )
    .filter((l) => l.length > 0)

  const confidence = result.data.confidence / 100

  // Estimation naïve : la moitié des lignes = indices de lignes, l'autre moitié = colonnes
  const half = Math.ceil(lines.length / 2)
  return { rows: lines.slice(0, half), cols: lines.slice(half), confidence }
}

/**
 * Point d'entrée principal : traite une ImageData et retourne un ProcessResult
 * ou lance une ProcessError.
 */
export async function processImage(
  imageData: ImageData,
): Promise<ProcessResult | ProcessError> {
  try {
    const gridCanvas = await detectGrid(imageData)
    const { rows, cols, confidence } = await extractCluesWithOCR(gridCanvas)

    // Construction d'une grille vide avec les indices extraits
    // (l'utilisateur confirmera / corrigera via GridCorrector)
    const size = Math.max(rows.length, cols.length, 5)
    const emptyGrid: SolutionGrid = Array.from({ length: size }, () =>
      Array(size).fill(false),
    )

    return {
      grid: emptyGrid,
      confidence,
      rawClues: { rows, cols },
    }
  } catch (err) {
    return {
      message: err instanceof Error ? err.message : 'Erreur inconnue',
      step: 'detection',
    }
  }
}

// Type augmentation pour window.cv (OpenCV global)
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cv: any
  }
}
