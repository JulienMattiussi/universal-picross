import { useEffect } from 'react'
import HomePage from '@/pages/HomePage'
import { useDebugStore } from '@/store/debugStore'

export default function App() {
  const { debug, toggle } = useDebugStore()

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

  return (
    <>
      <HomePage />
      {debug && (
        <div className="fixed top-3 right-3 bg-gray-800 text-white text-xs font-mono px-2 py-0.5 rounded-full select-none pointer-events-none">
          debug
        </div>
      )}
    </>
  )
}
