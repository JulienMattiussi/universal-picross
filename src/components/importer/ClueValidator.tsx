import { useState } from 'react'
import Button from '@/components/ui/Button'
import type { GridCellsResult } from '@/lib/image'
import { useTranslation } from '@/i18n/useTranslation'

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
  const { nRows, nCols, colClueCells, rowClueCells } = cells

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

      {/* Cell image */}
      <div className="flex justify-center">
        <div
          className="border border-brd rounded-lg bg-surface-secondary overflow-hidden"
          style={{ width: 128, height: 128 }}
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
