import { useEffect, useState } from 'react'
import HomePage, { type ImportMode } from '@/pages/HomePage'
import GamePage from '@/pages/GamePage'
import OptionsPage from '@/pages/OptionsPage'
import { useDebugStore } from '@/store/debugStore'
import { useGameStore } from '@/store/gameStore'
import { useSettingsStore } from '@/store/settingsStore'
import { isOCRCached, preloadOCR } from '@/lib/preloadOCR'

type Page = 'home' | 'game' | 'options'

export default function App() {
  const { debug, toggle } = useDebugStore()
  const [page, setPage] = useState<Page>('home')
  const [importMode, setImportMode] = useState<ImportMode | undefined>()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'd') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggle])

  // Préchargement OCR silencieux si le mode offline est activé
  useEffect(() => {
    const { offlineMode } = useSettingsStore.getState()
    if (!offlineMode) return
    isOCRCached().then((cached) => {
      if (!cached) preloadOCR()
    })
  }, [])

  const handleImport = (mode: ImportMode) => {
    // Reset le jeu précédent pour que l'import reparte de zéro
    useGameStore.setState({ puzzle: null, grid: [], status: 'idle', cheated: false })
    setImportMode(mode)
    setPage('game')
  }

  const handleGenerated = () => {
    setImportMode(undefined)
    setPage('game')
  }

  const goHome = () => {
    setPage('home')
    setImportMode(undefined)
  }

  return (
    <>
      {page === 'home' && (
        <HomePage
          onImport={handleImport}
          onGenerated={handleGenerated}
          onOptions={() => setPage('options')}
        />
      )}
      {page === 'game' && <GamePage importMode={importMode} onBack={goHome} />}
      {page === 'options' && <OptionsPage onBack={goHome} />}

      {debug && (
        <div className="fixed top-3 right-3 bg-gray-800 text-white text-xs font-mono px-2 py-0.5 rounded-full select-none pointer-events-none">
          debug
        </div>
      )}
    </>
  )
}
