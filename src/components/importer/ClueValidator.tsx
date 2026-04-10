import { useEffect, useState } from 'react'
import Button from '@/components/ui/Button'
import type { GridCellsResult } from '@/lib/image'
import { useTranslation } from '@/i18n/useTranslation'
import { useDebugStore } from '@/store/debugStore'
import {
  adaptiveNormalize,
  removeBorderArtifacts,
  removeGridLines,
  cropToContent,
  upscaleCanvas,
  addWhitePadding,
  smoothAndContrast,
} from '@/lib/image/canvas'
import { segmentBlobs, extractBlob, matchCellDigits } from '@/lib/image/templateMatch'
import { matchDigitHausdorff } from '@/lib/image/hausdorffMatch'
import { loadImageFromUrl } from '@/lib/image/ocr'

interface ClueValidatorProps {
  cells: GridCellsResult
  initialValues: { rows: string[]; cols: string[] }
  solvable: boolean | null
  onComplete: (rowClues: number[][], colClues: number[][]) => void
  onBack: () => void
}

export default function ClueValidator({
  cells,
  initialValues,
  solvable,
  onComplete,
  onBack,
}: ClueValidatorProps) {
  const t = useTranslation()
  const { debug } = useDebugStore()
  const { nRows, nCols, colClueCells, rowClueCells } = cells

  // En mode debug : étape préliminaire avec lignes concaténées
  const [debugStep, setDebugStep] = useState<'lines' | 'individual'>(debug ? 'lines' : 'individual')
  const [colLineCanvas, setColLineCanvas] = useState<HTMLCanvasElement | null>(null)
  const [colLineUrl, setColLineUrl] = useState<string | null>(null)
  const [rowLineCanvas, setRowLineCanvas] = useState<HTMLCanvasElement | null>(null)
  const [rowLineUrl, setRowLineUrl] = useState<string | null>(null)
  const [allLineCanvas, setAllLineCanvas] = useState<HTMLCanvasElement | null>(null)
  const [allLineUrl, setAllLineUrl] = useState<string | null>(null)
  const [linesReady, setLinesReady] = useState(false)

  // Prépare un canvas de case depuis une data URL
  const prepareCellCanvas = async (url: string): Promise<HTMLCanvasElement> => {
    const img = await loadImageFromUrl(url)
    const canvas = document.createElement('canvas')
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    canvas.getContext('2d')!.drawImage(img, 0, 0)
    const cleaned = cropToContent(removeGridLines(removeBorderArtifacts(adaptiveNormalize(canvas))))
    const factor = Math.max(2, Math.ceil(128 / Math.min(cleaned.width, cleaned.height)))
    return smoothAndContrast(addWhitePadding(upscaleCanvas(cleaned, factor), 16), 2, 2)
  }

  // Concatène des canvases en une seule ligne horizontale avec cellules uniformes
  const concatCanvases = (canvases: HTMLCanvasElement[]): HTMLCanvasElement => {
    const pad = 16
    const maxW = Math.max(...canvases.map((c) => c.width))
    const maxH = Math.max(...canvases.map((c) => c.height))
    const cellW = maxW + 8
    const totalW = cellW * canvases.length + pad * 2
    const line = document.createElement('canvas')
    line.width = totalW
    line.height = maxH + pad * 2
    const ctx = line.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, totalW, line.height)
    for (let i = 0; i < canvases.length; i++) {
      const c = canvases[i]
      const x = pad + i * cellW + Math.round((cellW - c.width) / 2)
      const y = Math.round((maxH - c.height) / 2) + pad
      ctx.drawImage(c, x, y)
    }
    return line
  }

  // Extraire tous les blobs individuels d'une liste de cases
  const extractAllBlobs = async (cellUrls: string[]): Promise<HTMLCanvasElement[]> => {
    const allBlobs: HTMLCanvasElement[] = []
    for (const url of cellUrls) {
      const prepared = await prepareCellCanvas(url)
      const blobs = segmentBlobs(prepared)
      for (const b of blobs) {
        allBlobs.push(smoothAndContrast(extractBlob(prepared, b), 2, 2))
      }
    }
    return allBlobs
  }

  // Construire les lignes concaténées au montage (debug seulement)
  useEffect(() => {
    if (!debug) return
    ;(async () => {
      const colBlobs = await extractAllBlobs(colClueCells)
      if (colBlobs.length > 0) {
        const colLine = concatCanvases(colBlobs)
        setColLineCanvas(colLine)
        setColLineUrl(colLine.toDataURL('image/png'))
      }

      const rowBlobs = await extractAllBlobs(rowClueCells)
      if (rowBlobs.length > 0) {
        const rowLine = concatCanvases(rowBlobs)
        setRowLineCanvas(rowLine)
        setRowLineUrl(rowLine.toDataURL('image/png'))
      }

      const allBlobs = [...colBlobs, ...rowBlobs]
      if (allBlobs.length > 0) {
        const allLine = concatCanvases(allBlobs)
        setAllLineCanvas(allLine)
        setAllLineUrl(allLine.toDataURL('image/png'))
      }

      setLinesReady(true)
    })()
  }, [debug, colClueCells, rowClueCells])

  // Lance Tesseract en mode ligne sur une image concaténée
  const recognizeLine = async (canvas: HTMLCanvasElement, lineLabel: string) => {
    const dataUrl = canvas.toDataURL('image/png')
    let tessResult = ''
    try {
      const { createWorker } = await import('tesseract.js')
      const w = await createWorker('eng', 1, { logger: () => {} })
      await w.setParameters({
        tessedit_char_whitelist: '0123456789 ',
        tessedit_pageseg_mode: '7' as unknown as Parameters<
          typeof w.setParameters
        >[0]['tessedit_pageseg_mode'],
      })
      const result = await Promise.race([
        w.recognize(canvas),
        new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
      ])
      if (result) {
        tessResult = result.data.text
          .trim()
          .replace(/[^0-9\n ]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      }
      w.terminate().catch(() => {})
    } catch {
      /* ignore */
    }

    console.log(
      `[${lineLabel}] %c     %c  Tesseract (ligne): %c${tessResult || '(vide)'}`,
      `background:url(${dataUrl}) no-repeat center/contain;padding:32px 64px;border:1px solid #ccc`,
      '',
      tessResult ? 'color:green;font-weight:bold;font-size:14px' : 'color:red;font-size:14px',
    )
  }

  // Flat sequence: col clues first (0..nCols-1), then row clues (nCols..nCols+nRows-1)
  const [current, setCurrent] = useState(0)
  const [values, setValues] = useState<string[]>([...initialValues.cols, ...initialValues.rows])

  const total = nCols + nRows
  const isCol = current < nCols
  const label = isCol
    ? t.validator.column.replace('{n}', String(current + 1))
    : t.validator.row.replace('{n}', String(current - nCols + 1))
  const imageUrl = isCol ? colClueCells[current] : rowClueCells[current - nCols]
  const isLast = current === total - 1

  // En mode debug : générer les images segmentées pour la case courante
  const [blobUrls, setBlobUrls] = useState<string[]>([])
  const [preparedCanvas, setPreparedCanvas] = useState<HTMLCanvasElement | null>(null)
  const [blobCanvases, setBlobCanvases] = useState<HTMLCanvasElement[]>([])

  useEffect(() => {
    if (!debug || debugStep !== 'individual') return
    ;(async () => {
      const prepared = await prepareCellCanvas(imageUrl)
      setPreparedCanvas(prepared)
      const blobs = segmentBlobs(prepared)
      const bCanvases = blobs.map((b) => smoothAndContrast(extractBlob(prepared, b), 2, 2))
      setBlobCanvases(bCanvases)
      setBlobUrls(bCanvases.map((c) => c.toDataURL('image/png')))
    })()
  }, [imageUrl, debug, debugStep])

  // Lance la reconnaissance sur un canvas et logge le résultat
  const recognizeAndLog = async (canvas: HTMLCanvasElement, imageLabel: string) => {
    const dataUrl = canvas.toDataURL('image/png')

    // Template matching (IoU)
    const tmplResult = matchCellDigits(canvas, true)

    // Hausdorff (contours)
    const hausdorff = matchDigitHausdorff(canvas)
    const hausdorffResult = hausdorff.text
    const hausdorffScore = hausdorff.score

    // Tesseract
    let tessResult = ''
    try {
      const { createWorker } = await import('tesseract.js')
      const w = await createWorker('eng', 1, { logger: () => {} })
      await w.setParameters({
        tessedit_char_whitelist: '0123456789 ',
        tessedit_pageseg_mode: '6' as unknown as Parameters<
          typeof w.setParameters
        >[0]['tessedit_pageseg_mode'],
      })
      const padded = addWhitePadding(canvas, 8)
      const result = await Promise.race([
        w.recognize(padded),
        new Promise<null>((r) => setTimeout(() => r(null), 10_000)),
      ])
      if (result) {
        tessResult = result.data.text
          .trim()
          .replace(/[^0-9\n ]/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      }
      w.terminate().catch(() => {})
    } catch {
      /* ignore */
    }

    console.log(
      `[${imageLabel}] %c     %c  Template(IoU): %c${tmplResult || '(vide)'}%c  Hausdorff: %c${hausdorffResult || '(vide)'} (${(hausdorffScore * 100).toFixed(0)}%%)%c  Tesseract: %c${tessResult || '(vide)'}`,
      `background:url(${dataUrl}) no-repeat center/contain;padding:24px 16px;border:1px solid #ccc`,
      '',
      tmplResult ? 'color:green;font-weight:bold' : 'color:red',
      '',
      hausdorffResult ? 'color:green;font-weight:bold' : 'color:red',
      '',
      tessResult ? 'color:green;font-weight:bold' : 'color:red',
    )
  }

  const updateValue = (val: string) => {
    setValues((prev) => {
      const next = [...prev]
      next[current] = val
      return next
    })
  }

  const goNext = () => {
    if (isLast) {
      const parseClue = (s: string) =>
        s
          .split(/\s+/)
          .map(Number)
          .filter((n) => !isNaN(n) && n > 0)
      const colClues = values.slice(0, nCols).map(parseClue)
      const rowClues = values.slice(nCols).map(parseClue)
      onComplete(rowClues, colClues)
    } else {
      setCurrent((c) => c + 1)
    }
  }

  const goPrev = () => {
    if (current === 0) {
      onBack()
    } else {
      setCurrent((c) => c - 1)
    }
  }

  // Overlay plein écran pour afficher une image en grand
  const [overlayUrl, setOverlayUrl] = useState<string | null>(null)

  // Étape debug : lignes concaténées
  if (debug && debugStep === 'lines') {
    return (
      <div className="flex flex-col gap-4">
        {/* Overlay plein écran */}
        {overlayUrl && (
          <div
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center cursor-pointer"
            onClick={() => setOverlayUrl(null)}
          >
            <img
              src={overlayUrl}
              alt="Zoom"
              className="max-w-[95vw] max-h-[90vh] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
          </div>
        )}

        <div className="text-sm text-txt-tertiary font-medium">
          Debug — Lignes concaténées (cliquer pour agrandir, bouton pour Tesseract)
        </div>

        {!linesReady && <p className="text-sm text-txt-muted">Préparation des lignes…</p>}

        {colLineUrl && colLineCanvas && (
          <div>
            <p className="text-xs text-txt-secondary font-medium mb-1">
              Indices colonnes ({nCols})
            </p>
            <div
              className="border border-primary-400 rounded-lg bg-surface-secondary overflow-x-auto cursor-pointer hover:border-primary-600"
              onClick={() => {
                setOverlayUrl(colLineUrl)
                recognizeLine(colLineCanvas, 'Colonnes')
              }}
            >
              <img src={colLineUrl} alt="Ligne colonnes" style={{ imageRendering: 'pixelated' }} />
            </div>
          </div>
        )}

        {rowLineUrl && rowLineCanvas && (
          <div>
            <p className="text-xs text-txt-secondary font-medium mb-1">Indices lignes ({nRows})</p>
            <div
              className="border border-primary-400 rounded-lg bg-surface-secondary overflow-x-auto cursor-pointer hover:border-primary-600"
              onClick={() => {
                setOverlayUrl(rowLineUrl)
                recognizeLine(rowLineCanvas, 'Lignes')
              }}
            >
              <img src={rowLineUrl} alt="Ligne lignes" style={{ imageRendering: 'pixelated' }} />
            </div>
          </div>
        )}

        {allLineUrl && allLineCanvas && (
          <div>
            <p className="text-xs text-txt-secondary font-medium mb-1">
              Tous les indices ({nCols + nRows})
            </p>
            <div
              className="border border-primary-400 rounded-lg bg-surface-secondary overflow-x-auto cursor-pointer hover:border-primary-600"
              onClick={() => {
                setOverlayUrl(allLineUrl)
                recognizeLine(allLineCanvas, 'Tous')
              }}
            >
              <img src={allLineUrl} alt="Ligne complète" style={{ imageRendering: 'pixelated' }} />
            </div>
          </div>
        )}

        <Button className="mt-2" onClick={() => setDebugStep('individual')}>
          Continuer →
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Avertissement grille non soluble */}
      {solvable === false && (
        <div className="text-sm text-warn-text bg-warn-bg border border-warn-border rounded-lg px-3 py-2">
          {t.validator.noSolutionWarning}
        </div>
      )}

      {/* Progress */}
      <div className="text-sm text-txt-tertiary font-medium">
        {label}&nbsp;&nbsp;(
        {t.validator.xOfY
          .replace('{current}', String(current + 1))
          .replace('{total}', String(total))}
        )
      </div>

      {/* Cell image + blobs segmentés en debug */}
      <div className="flex justify-center items-end gap-3">
        <div
          className={[
            'border border-brd rounded-lg bg-surface-secondary overflow-hidden',
            debug && preparedCanvas ? 'cursor-pointer hover:border-primary-500' : '',
          ].join(' ')}
          style={{ width: 128, height: 128 }}
          onClick={() => debug && preparedCanvas && recognizeAndLog(preparedCanvas, 'Image brut')}
        >
          <img
            src={imageUrl}
            alt={label}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              imageRendering: 'pixelated',
            }}
          />
        </div>
        {debug && blobUrls.length > 0 && (
          <div className="flex gap-1">
            {blobUrls.map((url, i) => (
              <div
                key={i}
                className="border border-primary-300 rounded bg-surface-card overflow-hidden cursor-pointer hover:border-primary-500"
                style={{ width: 48, height: 48 }}
                onClick={() =>
                  blobCanvases[i] && recognizeAndLog(blobCanvases[i], `Image segmentée ${i + 1}`)
                }
              >
                <img
                  src={url}
                  alt={`Blob ${i + 1}`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'contain',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Label */}
      <p className="text-center text-sm font-medium text-txt-secondary">{label}</p>

      {/* Input */}
      <input
        type="text"
        className="w-full border border-brd-strong rounded-lg px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        value={values[current] ?? ''}
        onChange={(e) => updateValue(e.target.value)}
        placeholder="ex: 3 1"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') goNext()
        }}
      />

      {/* Navigation buttons */}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={goPrev}>
          {t.validator.previous}
        </Button>
        <Button className="flex-1" onClick={goNext}>
          {isLast ? t.validator.finish : t.validator.validateNext}
        </Button>
      </div>
    </div>
  )
}
