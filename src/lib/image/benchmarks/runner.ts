import type { OcrFixture } from '@/lib/image/benchmarks/freePicross2c'
import type { GridCellsResult, Point } from '@/lib/image/types'
import { extractGridCells } from '@/lib/image/cellExtraction'
import { loadImageFromUrl } from '@/lib/image/ocr'
import {
  adaptiveNormalize,
  removeBorderArtifacts,
  removeGridLines,
  cropToContent,
  upscaleCanvas,
  addWhitePadding,
} from '@/lib/image/canvas'
import { segmentBlobs, extractBlob, matchSingleBlob } from '@/lib/image/templateMatch'
import { matchDigitHausdorff } from '@/lib/image/hausdorffMatch'

export interface BlobBenchmark {
  url: string
  width: number
  height: number
  tesseractText: string
  iou: { digit: number; score: number }
  hausdorff: { digit: number; score: number }
}

export interface CellBenchmark {
  label: string
  type: 'row' | 'col'
  index: number
  originalUrl: string
  preparedUrl: string
  blobs: BlobBenchmark[]
  expected: number[]
  tesseractResult: number[]
  iouResult: number[]
  hausdorffResult: number[]
  status: {
    tesseract: 'ok' | 'partial' | 'fail'
    iou: 'ok' | 'partial' | 'fail'
    hausdorff: 'ok' | 'partial' | 'fail'
  }
}

export interface MethodStats {
  correctCells: number
  correctDigits: number
  totalDigits: number
}

export interface BenchmarkReport {
  fixture: OcrFixture
  imageWidth: number
  imageHeight: number
  cornersUsed: [Point, Point]
  rows: CellBenchmark[]
  cols: CellBenchmark[]
  summary: {
    totalCells: number
    tesseract: MethodStats
    iou: MethodStats
    hausdorff: MethodStats
  }
}

function canvasFromImage(img: HTMLImageElement): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  c.getContext('2d')!.drawImage(img, 0, 0)
  return c
}

function canvasToImageData(canvas: HTMLCanvasElement): ImageData {
  return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
}

async function prepareCellCanvas(url: string): Promise<HTMLCanvasElement> {
  const img = await loadImageFromUrl(url)
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  canvas.getContext('2d')!.drawImage(img, 0, 0)
  const cleaned = cropToContent(removeGridLines(removeBorderArtifacts(adaptiveNormalize(canvas))))
  const factor = Math.max(2, Math.ceil(128 / Math.min(cleaned.width, cleaned.height)))
  return addWhitePadding(upscaleCanvas(cleaned, factor), 16)
}

function parseDigits(text: string): number[] {
  return text
    .split(/\s+/)
    .map((s) => parseInt(s, 10))
    .filter((n) => !isNaN(n) && n > 0)
}

function compareDigitLists(predicted: number[], expected: number[]): 'ok' | 'partial' | 'fail' {
  if (predicted.length === expected.length && predicted.every((v, i) => v === expected[i])) {
    return 'ok'
  }
  const correct = expected.filter((v, i) => predicted[i] === v).length
  if (correct === 0) return 'fail'
  return 'partial'
}

function countDigitMatches(predicted: number[], expected: number[]): number {
  let correct = 0
  for (let i = 0; i < expected.length; i++) {
    if (predicted[i] === expected[i]) correct++
  }
  return correct
}

export interface RunnerOptions {
  onProgress?: (done: number, total: number, label: string) => void
  cornersOverride?: [Point, Point]
}

export async function runOcrBenchmark(
  fixture: OcrFixture,
  options: RunnerOptions = {},
): Promise<BenchmarkReport> {
  const img = await loadImageFromUrl(fixture.imageUrl)
  const canvas = canvasFromImage(img)
  const imageData = canvasToImageData(canvas)
  const corners = options.cornersOverride ?? fixture.defaultCorners

  const cells: GridCellsResult | null = extractGridCells(imageData, corners[0], corners[1], false)
  if (!cells) throw new Error("Échec de l'extraction des cases")

  const total = cells.nCols + cells.nRows

  // Initialise Tesseract worker
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('eng', 1, { logger: () => {} })
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789 ',
    tessedit_pageseg_mode: '6' as unknown as Parameters<
      typeof worker.setParameters
    >[0]['tessedit_pageseg_mode'],
  })

  const tesseractBlob = async (canvas: HTMLCanvasElement): Promise<string> => {
    const padded = addWhitePadding(canvas, 8)
    try {
      const res = await worker.recognize(padded)
      return res.data.text
        .trim()
        .replace(/[^0-9\n ]/g, '')
        .replace(/\n+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    } catch {
      return ''
    }
  }

  const processOne = async (
    url: string,
    expected: number[],
    label: string,
    type: 'row' | 'col',
    index: number,
  ): Promise<CellBenchmark> => {
    const prepared = await prepareCellCanvas(url)
    const blobRects = segmentBlobs(prepared)
    const blobs: BlobBenchmark[] = []

    for (const rect of blobRects) {
      const blobCanvas = extractBlob(prepared, rect)
      const tess = await tesseractBlob(blobCanvas)
      const iou = matchSingleBlob(blobCanvas)
      const haus = matchDigitHausdorff(blobCanvas)
      blobs.push({
        url: blobCanvas.toDataURL(),
        width: rect.w,
        height: rect.h,
        tesseractText: tess,
        iou: { digit: iou.digit, score: iou.score },
        hausdorff: { digit: haus.digit, score: haus.score },
      })
    }

    const tesseractResult = parseDigits(blobs.map((b) => b.tesseractText).join(' '))
    const iouResult = blobs.map((b) => b.iou.digit).filter((d) => d >= 0)
    const hausdorffResult = blobs.map((b) => b.hausdorff.digit).filter((d) => d >= 0)

    return {
      label,
      type,
      index,
      originalUrl: url,
      preparedUrl: prepared.toDataURL(),
      blobs,
      expected,
      tesseractResult,
      iouResult,
      hausdorffResult,
      status: {
        tesseract: compareDigitLists(tesseractResult, expected),
        iou: compareDigitLists(iouResult, expected),
        hausdorff: compareDigitLists(hausdorffResult, expected),
      },
    }
  }

  const rows: CellBenchmark[] = []
  const cols: CellBenchmark[] = []
  let done = 0

  for (let j = 0; j < cells.nCols; j++) {
    options.onProgress?.(done, total, `Col ${j + 1}`)
    cols.push(
      await processOne(cells.colClueCells[j], fixture.colClues[j], `Col ${j + 1}`, 'col', j),
    )
    done++
  }

  for (let i = 0; i < cells.nRows; i++) {
    options.onProgress?.(done, total, `Lig ${i + 1}`)
    rows.push(
      await processOne(cells.rowClueCells[i], fixture.rowClues[i], `Lig ${i + 1}`, 'row', i),
    )
    done++
  }

  await worker.terminate()

  const allCells = [...rows, ...cols]
  const computeStats = (method: 'tesseract' | 'iou' | 'hausdorff'): MethodStats => {
    let correctCells = 0
    let correctDigits = 0
    let totalDigits = 0
    for (const c of allCells) {
      const predicted =
        method === 'tesseract'
          ? c.tesseractResult
          : method === 'iou'
            ? c.iouResult
            : c.hausdorffResult
      if (c.status[method] === 'ok') correctCells++
      correctDigits += countDigitMatches(predicted, c.expected)
      totalDigits += c.expected.length
    }
    return { correctCells, correctDigits, totalDigits }
  }

  return {
    fixture,
    imageWidth: imageData.width,
    imageHeight: imageData.height,
    cornersUsed: corners,
    rows,
    cols,
    summary: {
      totalCells: allCells.length,
      tesseract: computeStats('tesseract'),
      iou: computeStats('iou'),
      hausdorff: computeStats('hausdorff'),
    },
  }
}
