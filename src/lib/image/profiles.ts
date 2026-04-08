/**
 * Grayscale conversion, luminosity, and projection profile analysis.
 */

/**
 * Détermine si l'image est colorée ou noir & blanc.
 * Mesure la saturation moyenne (espace HSL) sur un échantillon de pixels,
 * en ignorant les pixels très sombres (< 0.1) et très clairs (> 0.9) qui
 * n'apportent pas d'information chromatique fiable.
 */
export function isColorImage(imageData: ImageData): boolean {
  const { data } = imageData
  const n = data.length / 4
  const step = Math.max(1, Math.floor(n / 2000))
  let totalSat = 0
  let count = 0
  for (let i = 0; i < n; i += step) {
    const r = data[i * 4] / 255
    const g = data[i * 4 + 1] / 255
    const b = data[i * 4 + 2] / 255
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2
    if (l < 0.1 || l > 0.9) continue
    if (max === min) continue
    const sat = l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min)
    totalSat += sat
    count++
  }
  return count > 0 && totalSat / count > 0.15
}

export function toGrayscale(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData
  const gray = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    gray[i] = (0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]) / 255
  }
  return gray
}

/**
 * Mesure la luminosité d'un pixel dans l'image.
 */
export function getLuminosity(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): number {
  const idx = (y * width + x) * 4
  return (0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]) / 255
}

export function rowDarknessProfile(
  gray: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const p = new Float32Array(height)
  for (let y = 0; y < height; y++) {
    let dark = 0
    for (let x = 0; x < width; x++) if (gray[y * width + x] < 0.5) dark++
    p[y] = dark / width
  }
  return p
}

export function colDarknessProfile(
  gray: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const p = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    let dark = 0
    for (let y = 0; y < height; y++) if (gray[y * width + x] < 0.5) dark++
    p[x] = dark / height
  }
  return p
}

/**
 * Profil de variation (edges) : pour chaque ligne/colonne, mesure la différence
 * de luminosité moyenne avec ses voisines. Les lignes de grille (même claires)
 * créent des transitions de luminosité détectables.
 */
export function rowEdgeProfile(gray: Float32Array, width: number, height: number): Float32Array {
  const avg = new Float32Array(height)
  for (let y = 0; y < height; y++) {
    let sum = 0
    for (let x = 0; x < width; x++) sum += gray[y * width + x]
    avg[y] = sum / width
  }
  const profile = new Float32Array(height)
  for (let y = 1; y < height - 1; y++) {
    profile[y] = Math.abs(avg[y] - avg[y - 1]) + Math.abs(avg[y] - avg[y + 1])
  }
  return profile
}

export function colEdgeProfile(gray: Float32Array, width: number, height: number): Float32Array {
  const avg = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = 0; y < height; y++) sum += gray[y * width + x]
    avg[x] = sum / height
  }
  const profile = new Float32Array(width)
  for (let x = 1; x < width - 1; x++) {
    profile[x] = Math.abs(avg[x] - avg[x - 1]) + Math.abs(avg[x] - avg[x + 1])
  }
  return profile
}

/**
 * Profil de saturation : proportion de pixels saturés par ligne/colonne.
 * Les lignes de grille colorées (orange, bleu…) ont une saturation élevée
 * alors que les cases (blanches/grises) sont désaturées.
 */
export function pixelSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  if (max === 0) return 0
  return (max - min) / max
}

export function rowSaturationProfile(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData
  const p = new Float32Array(height)
  for (let y = 0; y < height; y++) {
    let sat = 0
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      sat += pixelSaturation(data[i], data[i + 1], data[i + 2])
    }
    p[y] = sat / width
  }
  return p
}

export function colSaturationProfile(imageData: ImageData): Float32Array {
  const { width, height, data } = imageData
  const p = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    let sat = 0
    for (let y = 0; y < height; y++) {
      const i = (y * width + x) * 4
      sat += pixelSaturation(data[i], data[i + 1], data[i + 2])
    }
    p[x] = sat / height
  }
  return p
}

/**
 * Profil de clarté : proportion de pixels clairs par ligne/colonne.
 * Utile pour détecter des lignes de grille claires sur fond coloré.
 */
export function rowLightnessProfile(
  gray: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const p = new Float32Array(height)
  for (let y = 0; y < height; y++) {
    let light = 0
    for (let x = 0; x < width; x++) if (gray[y * width + x] > 0.5) light++
    p[y] = light / width
  }
  return p
}

export function colLightnessProfile(
  gray: Float32Array,
  width: number,
  height: number,
): Float32Array {
  const p = new Float32Array(width)
  for (let x = 0; x < width; x++) {
    let light = 0
    for (let y = 0; y < height; y++) if (gray[y * width + x] > 0.5) light++
    p[x] = light / height
  }
  return p
}
