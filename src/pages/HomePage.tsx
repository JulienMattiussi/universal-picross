import GeneratorPanel from '@/components/generator/GeneratorPanel'
import ImportPanel from '@/components/importer/ImportPanel'
import GamePage from './GamePage'
import { useGame } from '@/hooks/useGame'

export default function HomePage() {
  const { status } = useGame()
  const hasGame = status !== 'idle'

  return (
    <main className="flex flex-col items-center gap-8 py-8 px-4 min-h-svh">
      <header className="text-center flex flex-col items-center gap-2">
        <div className="flex items-center gap-3">
          <img src="/favicon.svg" alt="" width={40} height={40} />
          <h1 className="text-3xl font-bold text-gray-900">Universal Picross</h1>
        </div>
        <p className="text-gray-500 text-sm">Générez, jouez et résolvez des nonogrammes</p>
      </header>

      <div className="w-full max-w-sm flex flex-col gap-4">
        <GeneratorPanel />
        <ImportPanel />
      </div>

      {hasGame && <GamePage />}
    </main>
  )
}
