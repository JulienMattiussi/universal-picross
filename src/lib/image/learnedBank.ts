/**
 * Banque de templates auto-apprise depuis le ground truth d'une fixture OCR.
 *
 * Principe : si une case d'indice est segmentée en N blobs et que le ground
 * truth contient N chiffres, on peut associer chaque blob à son chiffre attendu
 * et l'utiliser comme template pour matcher les autres blobs.
 */

import type { BenchmarkReport, BlobBenchmark } from '@/lib/image/benchmarks/runner'
import { loadImageFromUrl } from '@/lib/image/ocr'

export interface LearnedTemplate {
  digit: number
  bitmap: Uint8Array // 0 = noir, 255 = blanc
  width: number
  height: number
  sourceLabel: string // ex: "Lig 4 #0" — pour debug
}

interface Point {
  x: number
  y: number
}

function binarizeCanvas(canvas: HTMLCanvasElement): {
  bitmap: Uint8Array
  width: number
  height: number
} {
  const { data, width, height } = canvas
    .getContext('2d')!
    .getImageData(0, 0, canvas.width, canvas.height)
  const bitmap = new Uint8Array(width * height)
  for (let i = 0; i < bitmap.length; i++) {
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    bitmap[i] = lum > 128 ? 255 : 0
  }
  return { bitmap, width, height }
}

async function decodeDataUrl(url: string): Promise<HTMLCanvasElement> {
  const img = await loadImageFromUrl(url)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  c.getContext('2d')!.drawImage(img, 0, 0)
  return c
}

/**
 * Extrait les templates depuis un rapport de benchmark.
 * Critère : ne retient que les cases où segmentation = ground truth (N blobs = N chiffres).
 */
export async function learnFontBank(report: BenchmarkReport): Promise<LearnedTemplate[]> {
  const all = [...report.rows, ...report.cols]
  const templates: LearnedTemplate[] = []

  for (const cell of all) {
    if (cell.blobs.length !== cell.expected.length) continue
    for (let i = 0; i < cell.blobs.length; i++) {
      const blob = cell.blobs[i]
      const digit = cell.expected[i]
      const canvas = await decodeDataUrl(blob.url)
      const { bitmap, width, height } = binarizeCanvas(canvas)
      templates.push({
        digit,
        bitmap,
        width,
        height,
        sourceLabel: `${cell.label} #${i}`,
      })
    }
  }

  return templates
}

/**
 * Redimensionne un bitmap de template à une taille cible en préservant le ratio.
 * Centre le contenu, fond blanc autour.
 */
function resizeLearnedBitmap(tmpl: LearnedTemplate, dstW: number, dstH: number): Uint8Array {
  const src = document.createElement('canvas')
  src.width = tmpl.width
  src.height = tmpl.height
  const srcCtx = src.getContext('2d')!
  const imgData = srcCtx.createImageData(tmpl.width, tmpl.height)
  for (let i = 0; i < tmpl.bitmap.length; i++) {
    const v = tmpl.bitmap[i]
    imgData.data[i * 4] = v
    imgData.data[i * 4 + 1] = v
    imgData.data[i * 4 + 2] = v
    imgData.data[i * 4 + 3] = 255
  }
  srcCtx.putImageData(imgData, 0, 0)

  const scale = Math.min(dstW / tmpl.width, dstH / tmpl.height)
  const dw = Math.round(tmpl.width * scale)
  const dh = Math.round(tmpl.height * scale)
  const ox = Math.round((dstW - dw) / 2)
  const oy = Math.round((dstH - dh) / 2)

  const dst = document.createElement('canvas')
  dst.width = dstW
  dst.height = dstH
  const ctx = dst.getContext('2d')!
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, dstW, dstH)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'medium'
  ctx.drawImage(src, ox, oy, dw, dh)

  const data = ctx.getImageData(0, 0, dstW, dstH).data
  const out = new Uint8Array(dstW * dstH)
  for (let i = 0; i < out.length; i++) {
    const lum = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    out[i] = lum > 128 ? 255 : 0
  }
  return out
}

function shapeIou(a: Uint8Array, b: Uint8Array): number {
  let intersection = 0
  let union = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) {
    const aBlack = a[i] === 0
    const bBlack = b[i] === 0
    if (aBlack && bBlack) intersection++
    if (aBlack || bBlack) union++
  }
  return union === 0 ? 0 : intersection / union
}

function extractContour(bitmap: Uint8Array, w: number, h: number): Point[] {
  const contour: Point[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (bitmap[y * w + x] !== 0) continue
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

function directedHausdorff(a: Point[], b: Point[]): number {
  if (a.length === 0 || b.length === 0) return 1
  let maxDist = 0
  for (const pa of a) {
    let minDist = Infinity
    for (const pb of b) {
      const d = Math.abs(pa.x - pb.x) + Math.abs(pa.y - pb.y)
      if (d < minDist) minDist = d
    }
    if (minDist > maxDist) maxDist = minDist
  }
  return maxDist
}

function hausdorffNormalized(a: Point[], b: Point[], diag: number): number {
  const d = Math.max(directedHausdorff(a, b), directedHausdorff(b, a))
  return Math.min(d / diag, 1)
}

export interface LearnedMatchResult {
  iou: { digit: number; score: number }
  hausdorff: { digit: number; score: number }
}

function matchBitmapAgainstLearnedBank(
  bitmap: Uint8Array,
  width: number,
  height: number,
  bank: LearnedTemplate[],
): LearnedMatchResult {
  const diag = Math.sqrt(width * width + height * height)
  const blobContour = extractContour(bitmap, width, height)

  let bestIou = { digit: -1, score: 0 }
  let bestHaus = { digit: -1, score: 0 }

  for (const tmpl of bank) {
    const resized = resizeLearnedBitmap(tmpl, width, height)

    const iou = shapeIou(bitmap, resized)
    if (iou > bestIou.score) bestIou = { digit: tmpl.digit, score: iou }

    const tmplContour = extractContour(resized, width, height)
    if (tmplContour.length > 0) {
      const dist = hausdorffNormalized(blobContour, tmplContour, diag)
      const score = 1 - dist
      if (score > bestHaus.score) bestHaus = { digit: tmpl.digit, score }
    }
  }

  return { iou: bestIou, hausdorff: bestHaus }
}

/**
 * Compare un blob (data URL) contre tous les templates appris.
 */
export async function matchBlobAgainstLearnedBank(
  blobUrl: string,
  bank: LearnedTemplate[],
): Promise<LearnedMatchResult> {
  const canvas = await decodeDataUrl(blobUrl)
  const { bitmap, width, height } = binarizeCanvas(canvas)
  return matchBitmapAgainstLearnedBank(bitmap, width, height, bank)
}

/**
 * Variante synchrone pour un canvas déjà chargé. Utilisée dans le pipeline OCR
 * où les canvas sont créés en mémoire et pas via data URL.
 */
export function matchCanvasAgainstLearnedBank(
  canvas: HTMLCanvasElement,
  bank: LearnedTemplate[],
): LearnedMatchResult {
  const { bitmap, width, height } = binarizeCanvas(canvas)
  return matchBitmapAgainstLearnedBank(bitmap, width, height, bank)
}

/**
 * Convertit un bitmap appris en data URL pour affichage UI.
 */
export function learnedTemplateToDataUrl(tmpl: LearnedTemplate): string {
  const c = document.createElement('canvas')
  c.width = tmpl.width
  c.height = tmpl.height
  const ctx = c.getContext('2d')!
  const imgData = ctx.createImageData(tmpl.width, tmpl.height)
  for (let i = 0; i < tmpl.bitmap.length; i++) {
    const v = tmpl.bitmap[i]
    imgData.data[i * 4] = v
    imgData.data[i * 4 + 1] = v
    imgData.data[i * 4 + 2] = v
    imgData.data[i * 4 + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)
  return c.toDataURL()
}

interface BlobLearnedResult extends LearnedMatchResult {
  blobIndex: number
}

/**
 * Évalue chaque blob d'un rapport contre la banque apprise.
 * Retourne, par case, la liste des digits prédits (selon IoU et Hausdorff).
 */
export async function evaluateReportWithLearnedBank(
  report: BenchmarkReport,
  bank: LearnedTemplate[],
  onProgress?: (done: number, total: number) => void,
): Promise<
  Map<
    string,
    {
      iouResult: number[]
      hausdorffResult: number[]
      perBlob: BlobLearnedResult[]
    }
  >
> {
  const results = new Map<
    string,
    {
      iouResult: number[]
      hausdorffResult: number[]
      perBlob: BlobLearnedResult[]
    }
  >()
  const all = [...report.rows, ...report.cols]
  const totalBlobs = all.reduce((s, c) => s + c.blobs.length, 0)
  let done = 0

  for (const cell of all) {
    const perBlob: BlobLearnedResult[] = []
    for (let i = 0; i < cell.blobs.length; i++) {
      const r = await matchBlobAgainstLearnedBank(cell.blobs[i].url, bank)
      perBlob.push({ blobIndex: i, ...r })
      done++
      onProgress?.(done, totalBlobs)
    }
    results.set(cell.label, {
      iouResult: perBlob.map((b) => b.iou.digit).filter((d) => d >= 0),
      hausdorffResult: perBlob.map((b) => b.hausdorff.digit).filter((d) => d >= 0),
      perBlob,
    })
  }

  return results
}

export type { BlobBenchmark }

/**
 * Encode un template appris en PNG data URL (compression native du navigateur).
 */
function templateToPng(tmpl: LearnedTemplate): string {
  const c = document.createElement('canvas')
  c.width = tmpl.width
  c.height = tmpl.height
  const ctx = c.getContext('2d')!
  const imgData = ctx.createImageData(tmpl.width, tmpl.height)
  for (let i = 0; i < tmpl.bitmap.length; i++) {
    const v = tmpl.bitmap[i]
    imgData.data[i * 4] = v
    imgData.data[i * 4 + 1] = v
    imgData.data[i * 4 + 2] = v
    imgData.data[i * 4 + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)
  return c.toDataURL('image/png')
}

/**
 * Décode un template depuis une data URL PNG. Utilisé au chargement des banques packagées.
 */
export async function decodeLearnedTemplateFromPng(
  digit: number,
  png: string,
  sourceLabel = 'packaged',
): Promise<LearnedTemplate> {
  const img = await loadImageFromUrl(png)
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  c.getContext('2d')!.drawImage(img, 0, 0)
  const { bitmap, width, height } = binarizeCanvas(c)
  return { digit, bitmap, width, height, sourceLabel }
}

/**
 * Génère le contenu d'un fichier TypeScript packageant une banque apprise.
 * Le fichier exporte une fonction `getXxxBank(): Promise<LearnedTemplate[]>` qui
 * décode les templates au premier appel et les met en cache.
 */
export function exportBankAsTypeScript(
  bank: LearnedTemplate[],
  packName: string,
  fixtureLabel: string,
): string {
  const fnName = `get${packName.charAt(0).toUpperCase()}${packName.slice(1)}Bank`
  const entries = bank.map((t) => `  { digit: ${t.digit}, png: '${templateToPng(t)}' },`).join('\n')

  return `// Auto-generated bank pack from OCR benchmark.
// Source: ${fixtureLabel}
// Generated: ${new Date().toISOString()}
// ${bank.length} templates.

import { decodeLearnedTemplateFromPng, type LearnedTemplate } from '@/lib/image/learnedBank'

const TEMPLATE_DATA: { digit: number; png: string }[] = [
${entries}
]

let cached: LearnedTemplate[] | null = null

export async function ${fnName}(): Promise<LearnedTemplate[]> {
  if (cached) return cached
  cached = await Promise.all(
    TEMPLATE_DATA.map(({ digit, png }) =>
      decodeLearnedTemplateFromPng(digit, png, '${packName} #' + digit),
    ),
  )
  return cached
}
`
}

/**
 * Pré-scan : sélectionne la banque apprise qui matche le mieux les blobs d'un set
 * de cases test. Retourne le nom de la banque + score médian.
 */
export interface BankCandidate {
  name: string
  bank: LearnedTemplate[]
}

export async function selectBestLearnedBank(
  testBlobUrls: string[],
  candidates: BankCandidate[],
): Promise<{ name: string; bank: LearnedTemplate[]; medianScore: number } | null> {
  if (candidates.length === 0 || testBlobUrls.length === 0) return null

  const results: { name: string; bank: LearnedTemplate[]; medianScore: number }[] = []

  for (const candidate of candidates) {
    const scores: number[] = []
    for (const url of testBlobUrls) {
      const match = await matchBlobAgainstLearnedBank(url, candidate.bank)
      scores.push(Math.max(match.iou.score, match.hausdorff.score))
    }
    scores.sort((a, b) => a - b)
    const median = scores[Math.floor(scores.length / 2)]
    results.push({ name: candidate.name, bank: candidate.bank, medianScore: median })
  }

  results.sort((a, b) => b.medianScore - a.medianScore)
  return results[0]
}
