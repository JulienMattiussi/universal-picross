import { useState } from 'react'
import Button from '@/components/ui/Button'
import { generatePuzzle, type Difficulty } from '@/lib/generator'
import { useGame } from '@/hooks/useGame'

export type ImportMode = 'image' | 'camera'

interface HomePageProps {
  onImport: (mode: ImportMode) => void
  onGenerated: () => void
  onOptions: () => void
}

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Facile' },
  { value: 'medium', label: 'Moyen' },
  { value: 'hard', label: 'Difficile' },
]

export default function HomePage({ onImport, onGenerated, onOptions }: HomePageProps) {
  const { loadPuzzle } = useGame()
  const [size, setSize] = useState(10)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')

  const handleGenerate = () => {
    const puzzle = generatePuzzle(size, difficulty)
    loadPuzzle(puzzle)
    onGenerated()
  }

  return (
    <main className="flex flex-col items-center gap-8 py-8 px-4 min-h-svh">
      {/* Header + lien options */}
      <header className="w-full max-w-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/favicon.svg" alt="" width={40} height={40} />
            <h1 className="text-2xl font-bold text-gray-900">Universal Picross</h1>
          </div>
          <button
            onClick={onOptions}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
            aria-label="Options"
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
        <p className="text-gray-500 text-sm mt-1">Générez, jouez et résolvez des nonogrammes</p>
      </header>

      <div className="w-full max-w-sm flex flex-col gap-4">
        {/* Action 1 : Ouvrir une image */}
        <button
          onClick={() => onImport('image')}
          className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary-300 hover:shadow-md transition-all cursor-pointer text-left"
        >
          <span className="text-3xl">📂</span>
          <div>
            <span className="font-semibold text-gray-900 block">Ouvrir une image</span>
            <span className="text-sm text-gray-500">Importer un picross depuis un fichier</span>
          </div>
        </button>

        {/* Action 2 : Prendre une photo */}
        <button
          onClick={() => onImport('camera')}
          className="flex items-center gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm hover:border-primary-300 hover:shadow-md transition-all cursor-pointer text-left"
        >
          <span className="text-3xl">📷</span>
          <div>
            <span className="font-semibold text-gray-900 block">Prendre une photo</span>
            <span className="text-sm text-gray-500">Scanner un picross avec la caméra</span>
          </div>
        </button>

        {/* Action 3 : Générer */}
        <div className="flex flex-col gap-4 p-5 bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🎲</span>
            <div>
              <span className="font-semibold text-gray-900 block">Générer un picross</span>
              <span className="text-sm text-gray-500">Créer un puzzle aléatoire</span>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-600">
              Taille :{' '}
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
            <div className="flex justify-between text-xs text-gray-400">
              <span>5</span>
              <span>20</span>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-sm text-gray-600">Difficulté</span>
            <div className="flex gap-2">
              {DIFFICULTIES.map(({ value, label }) => (
                <button
                  key={value}
                  className={[
                    'flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer',
                    difficulty === value
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-primary-50',
                  ].join(' ')}
                  onClick={() => setDifficulty(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleGenerate} className="w-full">
            Générer
          </Button>
        </div>
      </div>
    </main>
  )
}
