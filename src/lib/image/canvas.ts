/**
 * Canvas manipulation helpers: crop, upscale, threshold, normalize.
 */

export function imageDataToCanvas(imageData: ImageData): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  canvas.getContext('2d')!.putImageData(imageData, 0, 0)
  return canvas
}

export function cropCanvas(
  src: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number,
): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = Math.max(1, w)
  out.height = Math.max(1, h)
  out.getContext('2d')!.drawImage(src, x, y, w, h, 0, 0, w, h)
  return out
}

export function upscaleCanvas(src: HTMLCanvasElement, factor: number): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width * factor
  out.height = src.height * factor
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(src, 0, 0, out.width, out.height)
  return out
}

/**
 * Calcule le seuil optimal (méthode d'Otsu) sur un tableau de valeurs en [0,1].
 * Maximise la variance inter-classe pour séparer fond et texte.
 */
export function otsuThreshold(grays: Float32Array): number {
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
 * Convertit en noir et blanc avec seuillage adaptatif (Otsu).
 * Gère automatiquement fond clair sur texte sombre et l'inverse.
 * Résultat : texte noir sur fond blanc — format attendu par Tesseract.
 */
export function adaptiveNormalize(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width
  out.height = src.height
  const ctx = out.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  const imgData = ctx.getImageData(0, 0, out.width, out.height)
  const { data } = imgData
  const n = data.length / 4

  const grays = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    grays[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255
  }

  const threshold = otsuThreshold(grays)

  // La classe majoritaire est le fond.
  // On utilise le seuil Otsu (et non 0.5) pour éviter que les fonds gris
  // (zone d'indices hors grille) soient classés comme fond sombre.
  let aboveThreshold = 0
  for (let i = 0; i < n; i++) if (grays[i] > threshold) aboveThreshold++
  const bgIsLight = aboveThreshold >= n / 2

  for (let i = 0; i < n; i++) {
    const isText = bgIsLight ? grays[i] < threshold : grays[i] > threshold
    const v = isText ? 0 : 255
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v
    data[i * 4 + 3] = 255
  }

  ctx.putImageData(imgData, 0, 0)
  return out
}

/** Ajoute un liseré blanc autour de l'image pour améliorer la détection Tesseract aux bords. */
export function addWhitePadding(src: HTMLCanvasElement, pad: number): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = src.width + pad * 2
  out.height = src.height + pad * 2
  const ctx = out.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(src, pad, pad)
  return out
}

/**
 * Supprime les colonnes et rangées quasi-entièrement noires (traits de grille).
 * Doit être appliqué sur une image déjà normalisée en N&B.
 */
export function removeGridLines(src: HTMLCanvasElement, threshold = 0.75): HTMLCanvasElement {
  const ctx = src.getContext('2d')!
  const imgData = ctx.getImageData(0, 0, src.width, src.height)
  const { data, width, height } = imgData

  for (let x = 0; x < width; x++) {
    let black = 0
    for (let y = 0; y < height; y++) if (data[(y * width + x) * 4] === 0) black++
    if (black / height > threshold) {
      for (let y = 0; y < height; y++) {
        const i = (y * width + x) * 4
        data[i] = data[i + 1] = data[i + 2] = 255
      }
    }
  }

  for (let y = 0; y < height; y++) {
    let black = 0
    for (let x = 0; x < width; x++) if (data[(y * width + x) * 4] === 0) black++
    if (black / width > threshold) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4
        data[i] = data[i + 1] = data[i + 2] = 255
      }
    }
  }

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  out.getContext('2d')!.putImageData(imgData, 0, 0)
  return out
}

/**
 * Supprime les bords noirs résiduels (bordures de grille coupées lors du découpage).
 * Efface les lignes/colonnes sur les bords extérieurs tant qu'elles sont majoritairement noires.
 */
export function removeBorderArtifacts(src: HTMLCanvasElement, margin = 6): HTMLCanvasElement {
  const ctx = src.getContext('2d')!
  const imgData = ctx.getImageData(0, 0, src.width, src.height)
  const { data, width, height } = imgData

  const isBlack = (x: number, y: number) => data[(y * width + x) * 4] === 0
  const whiten = (x: number, y: number) => {
    const i = (y * width + x) * 4
    data[i] = data[i + 1] = data[i + 2] = 255
  }

  // Bord gauche
  for (let x = 0; x < margin && x < width; x++) {
    let black = 0
    for (let y = 0; y < height; y++) if (isBlack(x, y)) black++
    if (black / height > 0.4) for (let y = 0; y < height; y++) whiten(x, y)
  }

  // Bord droit
  for (let x = width - 1; x >= width - margin && x >= 0; x--) {
    let black = 0
    for (let y = 0; y < height; y++) if (isBlack(x, y)) black++
    if (black / height > 0.4) for (let y = 0; y < height; y++) whiten(x, y)
  }

  // Bord haut
  for (let y = 0; y < margin && y < height; y++) {
    let black = 0
    for (let x = 0; x < width; x++) if (isBlack(x, y)) black++
    if (black / width > 0.4) for (let x = 0; x < width; x++) whiten(x, y)
  }

  // Bord bas
  for (let y = height - 1; y >= height - margin && y >= 0; y--) {
    let black = 0
    for (let x = 0; x < width; x++) if (isBlack(x, y)) black++
    if (black / width > 0.4) for (let x = 0; x < width; x++) whiten(x, y)
  }

  const out = document.createElement('canvas')
  out.width = width
  out.height = height
  out.getContext('2d')!.putImageData(imgData, 0, 0)
  return out
}

/**
 * Rogne au contenu noir utile (bounding-box des pixels noirs restants) + marge blanche.
 * Permet de présenter à Tesseract uniquement les chiffres, sans espace mort.
 */
export function cropToContent(src: HTMLCanvasElement, pad = 8): HTMLCanvasElement {
  const ctx = src.getContext('2d')!
  const { data, width, height } = ctx.getImageData(0, 0, src.width, src.height)

  let minX = width,
    maxX = -1,
    minY = height,
    maxY = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4] === 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }

  if (maxX < 0) return src // aucun pixel noir trouvé

  const cx = Math.max(0, minX - pad)
  const cy = Math.max(0, minY - pad)
  const cw = Math.min(width, maxX + pad + 1) - cx
  const ch = Math.min(height, maxY + pad + 1) - cy
  return cropCanvas(src, cx, cy, cw, ch)
}
