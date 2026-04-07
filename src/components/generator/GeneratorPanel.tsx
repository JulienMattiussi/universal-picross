import { useState } from 'react'
import Button from '@/components/ui/Button'
import { generatePuzzle, type Difficulty } from '@/lib/generator'
import { useGame } from '@/hooks/useGame'

const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: 'easy', label: 'Facile' },
  { value: 'medium', label: 'Moyen' },
  { value: 'hard', label: 'Difficile' },
]

export default function GeneratorPanel() {
  const [size, setSize] = useState(10)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const { loadPuzzle } = useGame()

  const handleGenerate = () => {
    const puzzle = generatePuzzle(size, difficulty)
    loadPuzzle(puzzle)
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
      <h3 className="font-semibold text-gray-800">Nouveau puzzle</h3>

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
          className="accent-indigo-600"
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
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
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
  )
}
