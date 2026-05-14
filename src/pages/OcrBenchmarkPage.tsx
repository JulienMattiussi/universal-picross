import { useEffect, useMemo, useState } from 'react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import CornerSelector from '@/components/importer/CornerSelector'
import { freePicross2c } from '@/lib/image/benchmarks/freePicross2c'
import {
  runOcrBenchmark,
  type BenchmarkReport,
  type CellBenchmark,
} from '@/lib/image/benchmarks/runner'
import {
  learnFontBank,
  evaluateReportWithLearnedBank,
  learnedTemplateToDataUrl,
  exportBankAsTypeScript,
  type LearnedTemplate,
} from '@/lib/image/learnedBank'
import type { Point } from '@/lib/image/types'

interface OcrBenchmarkPageProps {
  onBack: () => void
}

type Phase = 'init' | 'corners' | 'running' | 'done'

interface LearnedCellResult {
  iouResult: number[]
  hausdorffResult: number[]
}

type LearnedResults = Map<string, LearnedCellResult>

const STATUS_COLORS = {
  ok: 'bg-status-success/15 text-status-success',
  partial: 'bg-warn-bg text-warn-text',
  fail: 'bg-error-cell text-status-error',
}

const STATUS_LABEL = { ok: 'OK', partial: '~', fail: '✗' }

function StatusBadge({ status }: { status: 'ok' | 'partial' | 'fail' }) {
  return (
    <span
      className={`inline-flex items-center justify-center min-w-6 h-5 px-1.5 rounded text-xs font-bold ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}

function fmtDigits(arr: number[]): string {
  return arr.length === 0 ? '∅' : arr.join(' ')
}

function statusFor(predicted: number[], expected: number[]): 'ok' | 'partial' | 'fail' {
  if (predicted.length === expected.length && predicted.every((v, i) => v === expected[i])) {
    return 'ok'
  }
  const correct = expected.filter((v, i) => predicted[i] === v).length
  if (correct === 0) return 'fail'
  return 'partial'
}

function CellRow({
  cell,
  learnedResult,
}: {
  cell: CellBenchmark
  learnedResult?: LearnedCellResult
}) {
  return (
    <tr className="border-b border-brd align-top">
      <td className="px-2 py-2 text-xs font-mono text-txt-secondary whitespace-nowrap">
        {cell.label}
      </td>
      <td className="px-2 py-2">
        <img
          src={cell.originalUrl}
          alt={`${cell.label} original`}
          className="border border-brd bg-white"
          style={{ height: 32, imageRendering: 'pixelated' }}
        />
      </td>
      <td className="px-2 py-2">
        <img
          src={cell.preparedUrl}
          alt={`${cell.label} préparé`}
          className="border border-brd bg-white"
          style={{ height: 48, imageRendering: 'pixelated' }}
        />
      </td>
      <td className="px-2 py-2">
        <div className="flex gap-1 flex-wrap">
          {cell.blobs.map((b, i) => (
            <div
              key={i}
              className="flex flex-col items-center gap-0.5 border border-brd p-1 bg-white rounded"
            >
              <img
                src={b.url}
                alt={`blob ${i}`}
                style={{ height: 32, imageRendering: 'pixelated' }}
              />
              <div className="text-[9px] font-mono text-txt-tertiary">
                {b.width}×{b.height}
              </div>
              <div className="text-[10px] font-mono text-txt-secondary">
                T:{b.tesseractText || '·'}
              </div>
              <div className="text-[10px] font-mono text-txt-secondary">
                I:{b.iou.digit >= 0 ? b.iou.digit : '·'}({(b.iou.score * 100).toFixed(0)}%)
              </div>
              <div className="text-[10px] font-mono text-txt-secondary">
                H:{b.hausdorff.digit >= 0 ? b.hausdorff.digit : '·'}(
                {(b.hausdorff.score * 100).toFixed(0)}%)
              </div>
            </div>
          ))}
        </div>
      </td>
      <td className="px-2 py-2 font-mono text-xs">
        <div className="flex items-center gap-2">
          <StatusBadge status={cell.status.tesseract} />
          <span>{fmtDigits(cell.tesseractResult)}</span>
        </div>
      </td>
      <td className="px-2 py-2 font-mono text-xs">
        <div className="flex items-center gap-2">
          <StatusBadge status={cell.status.iou} />
          <span>{fmtDigits(cell.iouResult)}</span>
        </div>
      </td>
      <td className="px-2 py-2 font-mono text-xs">
        <div className="flex items-center gap-2">
          <StatusBadge status={cell.status.hausdorff} />
          <span>{fmtDigits(cell.hausdorffResult)}</span>
        </div>
      </td>
      {learnedResult && (
        <>
          <td className="px-2 py-2 font-mono text-xs">
            <div className="flex items-center gap-2">
              <StatusBadge status={statusFor(learnedResult.iouResult, cell.expected)} />
              <span>{fmtDigits(learnedResult.iouResult)}</span>
            </div>
          </td>
          <td className="px-2 py-2 font-mono text-xs">
            <div className="flex items-center gap-2">
              <StatusBadge status={statusFor(learnedResult.hausdorffResult, cell.expected)} />
              <span>{fmtDigits(learnedResult.hausdorffResult)}</span>
            </div>
          </td>
        </>
      )}
      <td className="px-2 py-2 font-mono text-xs font-bold text-txt">{fmtDigits(cell.expected)}</td>
    </tr>
  )
}

function ResultsTable({
  title,
  cells,
  learnedResults,
}: {
  title: string
  cells: CellBenchmark[]
  learnedResults?: LearnedResults
}) {
  return (
    <section className="w-full">
      <h2 className="text-lg font-semibold text-txt-secondary mb-2">{title}</h2>
      <div className="overflow-x-auto border border-brd rounded">
        <table className="w-full text-sm">
          <thead className="bg-surface-secondary">
            <tr>
              <th className="px-2 py-2 text-left">Case</th>
              <th className="px-2 py-2 text-left">Original</th>
              <th className="px-2 py-2 text-left">Préparé</th>
              <th className="px-2 py-2 text-left">Blobs</th>
              <th className="px-2 py-2 text-left">Tesseract</th>
              <th className="px-2 py-2 text-left">IoU</th>
              <th className="px-2 py-2 text-left">Hausdorff</th>
              {learnedResults && (
                <>
                  <th className="px-2 py-2 text-left bg-warn-bg/30">Apprise IoU</th>
                  <th className="px-2 py-2 text-left bg-warn-bg/30">Apprise Haus</th>
                </>
              )}
              <th className="px-2 py-2 text-left">Attendu</th>
            </tr>
          </thead>
          <tbody>
            {cells.map((c) => (
              <CellRow key={c.label} cell={c} learnedResult={learnedResults?.get(c.label)} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function MethodStat({
  name,
  stats,
  total,
}: {
  name: string
  stats: { correctCells: number; correctDigits: number; totalDigits: number }
  total: number
}) {
  const cellPct = total === 0 ? 0 : (stats.correctCells / total) * 100
  const digitPct = stats.totalDigits === 0 ? 0 : (stats.correctDigits / stats.totalDigits) * 100
  return (
    <div className="flex flex-col gap-1 p-3 border border-brd rounded bg-surface-card">
      <div className="text-sm font-semibold text-txt">{name}</div>
      <div className="text-xs text-txt-secondary">
        Cases :{' '}
        <span className="font-mono">
          {stats.correctCells}/{total}
        </span>{' '}
        ({cellPct.toFixed(0)}
        %)
      </div>
      <div className="text-xs text-txt-secondary">
        Chiffres :{' '}
        <span className="font-mono">
          {stats.correctDigits}/{stats.totalDigits}
        </span>{' '}
        ({digitPct.toFixed(0)}%)
      </div>
    </div>
  )
}

export default function OcrBenchmarkPage({ onBack }: OcrBenchmarkPageProps) {
  const fixture = freePicross2c

  const [phase, setPhase] = useState<Phase>('init')
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [corners, setCorners] = useState<[Point, Point]>(fixture.defaultCorners)
  const [report, setReport] = useState<BenchmarkReport | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0, label: '' })
  const [error, setError] = useState<string | null>(null)
  const [learnedBank, setLearnedBank] = useState<LearnedTemplate[] | null>(null)
  const [learnedResults, setLearnedResults] = useState<LearnedResults | null>(null)
  const [learning, setLearning] = useState<'idle' | 'learning' | 'evaluating'>('idle')
  const [learnProgress, setLearnProgress] = useState({ done: 0, total: 0 })

  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth
      c.height = img.naturalHeight
      const ctx = c.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      setImageData(ctx.getImageData(0, 0, c.width, c.height))
      setPhase('corners')
    }
    img.onerror = () => setError('Impossible de charger la fixture')
    img.src = fixture.imageUrl
  }, [fixture.imageUrl])

  const handleRun = async (p1: Point, p2: Point) => {
    setCorners([p1, p2])
    setPhase('running')
    setError(null)
    setLearnedBank(null)
    setLearnedResults(null)
    try {
      const r = await runOcrBenchmark(fixture, {
        cornersOverride: [p1, p2],
        onProgress: (done, total, label) => setProgress({ done, total, label }),
      })
      setReport(r)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
      setPhase('corners')
    }
  }

  const handleLearn = async () => {
    if (!report) return
    setError(null)
    setLearning('learning')
    try {
      const bank = await learnFontBank(report)
      setLearnedBank(bank)
      setLearning('evaluating')
      const results = await evaluateReportWithLearnedBank(report, bank, (done, total) =>
        setLearnProgress({ done, total }),
      )
      setLearnedResults(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'apprentissage")
    } finally {
      setLearning('idle')
    }
  }

  const learnedStats = useMemo(() => {
    if (!report || !learnedResults) return null
    const all = [...report.rows, ...report.cols]
    let iouCells = 0
    let iouDigits = 0
    let hausCells = 0
    let hausDigits = 0
    let total = 0
    for (const cell of all) {
      const r = learnedResults.get(cell.label)
      if (!r) continue
      if (statusFor(r.iouResult, cell.expected) === 'ok') iouCells++
      if (statusFor(r.hausdorffResult, cell.expected) === 'ok') hausCells++
      for (let i = 0; i < cell.expected.length; i++) {
        total++
        if (r.iouResult[i] === cell.expected[i]) iouDigits++
        if (r.hausdorffResult[i] === cell.expected[i]) hausDigits++
      }
    }
    return {
      totalCells: all.length,
      totalDigits: total,
      iou: { correctCells: iouCells, correctDigits: iouDigits, totalDigits: total },
      hausdorff: { correctCells: hausCells, correctDigits: hausDigits, totalDigits: total },
    }
  }, [report, learnedResults])

  const bankByDigit = useMemo(() => {
    if (!learnedBank) return null
    const byDigit = new Map<number, LearnedTemplate[]>()
    for (const t of learnedBank) {
      if (!byDigit.has(t.digit)) byDigit.set(t.digit, [])
      byDigit.get(t.digit)!.push(t)
    }
    return byDigit
  }, [learnedBank])

  return (
    <main className="flex flex-col gap-6 py-6 px-4 min-h-svh max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="text-sm text-txt-muted hover:text-txt-secondary transition-colors cursor-pointer"
        >
          ← Accueil
        </button>
        <h1 className="text-2xl font-bold text-txt">Benchmark OCR</h1>
        <div />
      </header>

      <div className="text-sm text-txt-secondary">
        Fixture : <span className="font-mono">{fixture.label}</span>
      </div>

      {error && <p className="text-status-error">{error}</p>}

      {phase === 'init' && (
        <div className="flex items-center gap-2 text-sm text-txt-tertiary">
          <Spinner /> Chargement de la fixture…
        </div>
      )}

      {phase === 'corners' && imageData && (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-txt-secondary">
            Ajuste les coins si nécessaire, puis lance le benchmark. Les coins par défaut sont des
            estimations.
          </p>
          <CornerSelector
            imageData={imageData}
            initialCorners={corners}
            onConfirm={handleRun}
            onCancel={onBack}
          />
        </section>
      )}

      {phase === 'running' && (
        <div className="flex flex-col items-center gap-3 py-8">
          <Spinner />
          <div className="text-sm text-txt-secondary">
            {progress.label} — {progress.done}/{progress.total}
          </div>
          <div className="w-full max-w-md bg-surface-tertiary rounded-full h-2">
            <div
              className="bg-primary-500 h-2 rounded-full transition-all"
              style={{
                width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {phase === 'done' && report && (
        <>
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-txt-secondary">Résultats globaux</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <MethodStat
                name="Tesseract"
                stats={report.summary.tesseract}
                total={report.summary.totalCells}
              />
              <MethodStat
                name="Template IoU"
                stats={report.summary.iou}
                total={report.summary.totalCells}
              />
              <MethodStat
                name="Hausdorff"
                stats={report.summary.hausdorff}
                total={report.summary.totalCells}
              />
            </div>
            <div className="text-xs text-txt-tertiary font-mono">
              Image : {report.imageWidth}×{report.imageHeight}px — Coins utilisés : (
              {Math.round(report.cornersUsed[0].x)}, {Math.round(report.cornersUsed[0].y)}) → (
              {Math.round(report.cornersUsed[1].x)}, {Math.round(report.cornersUsed[1].y)})
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => setPhase('corners')}>Re-lancer</Button>
              <Button onClick={handleLearn} disabled={learning !== 'idle'}>
                {learning === 'learning'
                  ? 'Apprentissage…'
                  : learning === 'evaluating'
                    ? `Évaluation… (${learnProgress.done}/${learnProgress.total})`
                    : learnedResults
                      ? 'Re-apprendre'
                      : 'Apprendre la banque + ré-évaluer'}
              </Button>
            </div>
          </section>

          {learnedBank && bankByDigit && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-txt-secondary">
                  Banque apprise ({learnedBank.length} templates extraits)
                </h2>
                <Button
                  onClick={() => {
                    const content = exportBankAsTypeScript(
                      learnedBank,
                      'freePicross',
                      fixture.label,
                    )
                    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = 'freePicross.ts'
                    a.click()
                    setTimeout(() => URL.revokeObjectURL(url), 1000)
                  }}
                >
                  Exporter en .ts
                </Button>
              </div>
              <div className="text-xs text-txt-tertiary">
                Critère : cases dont la segmentation correspond exactement au ground truth.
              </div>
              <div className="flex flex-col gap-2">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => {
                  const items = bankByDigit.get(d) ?? []
                  return (
                    <div key={d} className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-bold w-8 text-txt">{d}</span>
                      <span className="text-xs text-txt-tertiary">({items.length})</span>
                      {items.map((t, i) => (
                        <img
                          key={i}
                          src={learnedTemplateToDataUrl(t)}
                          alt={`${d} #${i}`}
                          title={t.sourceLabel}
                          className="border border-brd bg-white"
                          style={{ height: 40, imageRendering: 'pixelated' }}
                        />
                      ))}
                    </div>
                  )
                })}
              </div>
              {learnedStats && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <MethodStat
                    name="Apprise — IoU"
                    stats={learnedStats.iou}
                    total={learnedStats.totalCells}
                  />
                  <MethodStat
                    name="Apprise — Hausdorff"
                    stats={learnedStats.hausdorff}
                    total={learnedStats.totalCells}
                  />
                </div>
              )}
            </section>
          )}

          <ResultsTable
            title={`Colonnes (${report.cols.length})`}
            cells={report.cols}
            learnedResults={learnedResults ?? undefined}
          />
          <ResultsTable
            title={`Lignes (${report.rows.length})`}
            cells={report.rows}
            learnedResults={learnedResults ?? undefined}
          />
        </>
      )}
    </main>
  )
}
