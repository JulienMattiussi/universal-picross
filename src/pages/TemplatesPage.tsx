import { useEffect, useState } from 'react'
import { getTemplateBank, CANONICAL_W, CANONICAL_H } from '@/lib/image/templateBank'
import type { DigitTemplate } from '@/lib/image/templateBank'

function templateToDataUrl(tmpl: DigitTemplate): string {
  const canvas = document.createElement('canvas')
  canvas.width = CANONICAL_W
  canvas.height = CANONICAL_H
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(CANONICAL_W, CANONICAL_H)
  for (let i = 0; i < tmpl.bitmap.length; i++) {
    const v = tmpl.bitmap[i]
    imgData.data[i * 4] = v
    imgData.data[i * 4 + 1] = v
    imgData.data[i * 4 + 2] = v
    imgData.data[i * 4 + 3] = 255
  }
  ctx.putImageData(imgData, 0, 0)
  return canvas.toDataURL()
}

interface TemplatesPageProps {
  onBack: () => void
}

export default function TemplatesPage({ onBack }: TemplatesPageProps) {
  const [urls, setUrls] = useState<{ digit: number; url: string }[]>([])

  useEffect(() => {
    const bank = getTemplateBank()
    setUrls(bank.map((t) => ({ digit: t.digit, url: templateToDataUrl(t) })))
  }, [])

  // Grouper par chiffre
  const byDigit: Record<number, string[]> = {}
  for (const { digit, url } of urls) {
    if (!byDigit[digit]) byDigit[digit] = []
    byDigit[digit].push(url)
  }

  return (
    <main className="flex flex-col items-center gap-6 py-6 px-4 min-h-svh">
      <div className="w-full max-w-4xl">
        <button
          onClick={onBack}
          className="text-sm text-txt-muted hover:text-txt-secondary transition-colors cursor-pointer"
        >
          ← Accueil
        </button>
      </div>

      <h1 className="text-2xl font-bold text-txt">Template Bank ({urls.length} templates)</h1>

      <div className="w-full max-w-4xl flex flex-col gap-6">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <div key={digit}>
            <h2 className="text-lg font-semibold text-txt-secondary mb-2">
              Chiffre {digit} ({byDigit[digit]?.length ?? 0} variantes)
            </h2>
            <div className="flex flex-wrap gap-2">
              {(byDigit[digit] ?? []).map((url, i) => (
                <div
                  key={i}
                  className="border border-brd rounded bg-surface-card p-1 flex items-center justify-center"
                >
                  <img
                    src={url}
                    width={CANONICAL_W}
                    height={CANONICAL_H}
                    style={{ imageRendering: 'pixelated' }}
                    alt={`Template ${digit} #${i}`}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
