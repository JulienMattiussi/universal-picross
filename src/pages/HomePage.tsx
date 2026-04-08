import { useRef, useState } from 'react'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { generatePuzzle, type Difficulty } from '@/lib/generator'
import { useGame } from '@/hooks/useGame'
import { useTranslation } from '@/i18n/useTranslation'

export type ImportMode = 'image' | 'camera' | 'photo'

interface HomePageProps {
  onImport: (mode: ImportMode) => void
  onGenerated: () => void
  onOptions: () => void
}

export default function HomePage({ onImport, onGenerated, onOptions }: HomePageProps) {
  const { loadPuzzle } = useGame()
  const t = useTranslation()
  const [size, setSize] = useState(10)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [generating, setGenerating] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const difficulties: { value: Difficulty; label: string }[] = [
    { value: 'easy', label: t.home.easy },
    { value: 'medium', label: t.home.medium },
    { value: 'hard', label: t.home.hard },
  ]

  const handleGenerate = async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setGenerating(true)
    try {
      const puzzle = await generatePuzzle(size, difficulty, 100, controller.signal)
      if (!controller.signal.aborted) {
        loadPuzzle(puzzle)
        onGenerated()
      }
    } catch {
      /* AbortError — ignoré */
    } finally {
      if (abortRef.current === controller) {
        setGenerating(false)
        abortRef.current = null
      }
    }
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    abortRef.current = null
    setGenerating(false)
  }

  return (
    <main className="flex flex-col items-center gap-8 py-8 px-4 min-h-svh">
      <header className="w-full max-w-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" width={40} height={40} />
            <h1 className="text-2xl font-bold text-txt">Universal Picross</h1>
          </div>
          <button
            onClick={onOptions}
            className="text-sm text-txt-muted hover:text-txt-secondary transition-colors cursor-pointer"
            aria-label={t.options.title}
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path
                fillRule="evenodd"
                d="M8.34 1.804A1 1 0 0 1 9.32 1h1.36a1 1 0 0 1 .98.804l.296 1.48a7.024 7.024 0 0 1 1.382.796l1.428-.474a1 1 0 0 1 1.176.454l.68 1.178a1 1 0 0 1-.196 1.258l-1.132 1.006a7.07 7.07 0 0 1 0 1.596l1.132 1.006a1 1 0 0 1 .196 1.258l-.68 1.178a1 1 0 0 1-1.176.454l-1.428-.474a7.024 7.024 0 0 1-1.382.796l-.296 1.48A1 1 0 0 1 10.68 19H9.32a1 1 0 0 1-.98-.804l-.296-1.48a7.024 7.024 0 0 1-1.382-.796l-1.428.474a1 1 0 0 1-1.176-.454l-.68-1.178a1 1 0 0 1 .196-1.258l1.132-1.006a7.07 7.07 0 0 1 0-1.596L3.574 8.896a1 1 0 0 1-.196-1.258l.68-1.178a1 1 0 0 1 1.176-.454l1.428.474A7.024 7.024 0 0 1 8.044 5.684l.296-1.48ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <p className="text-txt-tertiary text-sm mt-1">{t.home.subtitle}</p>
      </header>

      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* Loader de génération */}
        {generating ? (
          <div className="flex flex-col items-center gap-4 p-8 bg-surface-card rounded-xl border border-brd shadow-sm">
            <Spinner />
            <span className="text-sm text-txt-secondary font-medium">{t.home.generating}</span>
            <Button variant="secondary" size="sm" onClick={handleCancel}>
              {t.common.cancel}
            </Button>
          </div>
        ) : (
          <>
            <button
              onClick={() => onImport('image')}
              className="flex items-center gap-4 p-5 bg-surface-card rounded-xl border border-brd shadow-sm hover:border-primary-300 hover:shadow-md transition-all cursor-pointer text-left"
            >
              <span className="text-3xl">📂</span>
              <div>
                <span className="font-semibold text-txt block">{t.home.openImage}</span>
                <span className="text-sm text-txt-tertiary">{t.home.openImageDesc}</span>
              </div>
            </button>

            <button
              onClick={() => onImport('camera')}
              className="flex items-center gap-4 p-5 bg-surface-card rounded-xl border border-brd shadow-sm hover:border-primary-300 hover:shadow-md transition-all cursor-pointer text-left"
            >
              <span className="text-3xl">📷</span>
              <div>
                <span className="font-semibold text-txt block">{t.home.takePhoto}</span>
                <span className="text-sm text-txt-tertiary">{t.home.takePhotoDesc}</span>
              </div>
            </button>

            <button
              onClick={() => onImport('photo')}
              className="flex items-center gap-4 p-5 bg-surface-card rounded-xl border border-brd shadow-sm hover:border-primary-300 hover:shadow-md transition-all cursor-pointer text-left"
            >
              <span className="text-3xl">🖼️</span>
              <div>
                <span className="font-semibold text-txt block">{t.photoToPuzzle.title}</span>
                <span className="text-sm text-txt-tertiary">{t.photoToPuzzle.titleDesc}</span>
              </div>
            </button>

            <div className="flex flex-col gap-4 p-5 bg-surface-card rounded-xl border border-brd shadow-sm">
              <div className="flex items-center gap-4">
                <span className="text-3xl">🎲</span>
                <div>
                  <span className="font-semibold text-txt block">{t.home.generate}</span>
                  <span className="text-sm text-txt-tertiary">{t.home.generateDesc}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm text-txt-secondary">
                  {t.home.sizeLabel} :{' '}
                  <span className="font-medium">
                    {size}×{size}
                  </span>
                </label>
                <input
                  type="range"
                  min={5}
                  max={20}
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="accent-primary-500"
                />
                <div className="flex justify-between text-xs text-txt-muted">
                  <span>5</span>
                  <span>20</span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-sm text-txt-secondary">{t.home.difficulty}</span>
                <div className="flex gap-2">
                  {difficulties.map(({ value, label }) => (
                    <button
                      key={value}
                      className={[
                        'flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                        difficulty === value
                          ? 'bg-primary-500 text-white'
                          : 'bg-surface-tertiary text-txt-secondary hover:bg-primary-50',
                      ].join(' ')}
                      onClick={() => setDifficulty(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleGenerate} className="w-full">
                {t.home.generateButton}
              </Button>
            </div>
          </>
        )}
      </div>

      <footer className="mt-auto pt-8 pb-4">
        <p className="text-xs text-txt-disabled text-center">
          Made with 🧡 by{' '}
          <a
            href="https://github.com/JulienMattiussi/universal-picross"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-400 hover:text-primary-500 transition-colors"
          >
            YavaDeus
          </a>
        </p>
      </footer>
    </main>
  )
}
