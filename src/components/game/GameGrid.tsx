import { useRef } from 'react'
import Cell from './Cell'
import type { PlayGrid } from '@/lib/types'

export type InputMode = 'fill' | 'mark' | 'erase'

interface GameGridProps {
  grid: PlayGrid
  cellSize: number
  onFill: (row: number, col: number) => void
  onMark: (row: number, col: number) => void
  onClear: (row: number, col: number) => void
  errorCells?: Set<string>
  inputMode?: InputMode
}

export default function GameGrid({
  grid,
  cellSize,
  onFill,
  onMark,
  onClear,
  errorCells = new Set(),
  inputMode = 'fill',
}: GameGridProps) {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0
  const useThickLines = rows % 5 === 0 && cols % 5 === 0

  const gridRef = useRef<HTMLDivElement>(null)

  // État du drag stocké en ref (pas de re-render nécessaire)
  const dragRef = useRef<{
    action: 'fill' | 'unfill' | 'mark' | 'unmark' | 'erase'
    visited: Set<string>
    origin: [number, number]
    active: boolean
  } | null>(null)
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const getCellAt = (clientX: number, clientY: number): [number, number] | null => {
    if (!gridRef.current) return null
    const rect = gridRef.current.getBoundingClientRect()
    const c = Math.floor((clientX - rect.left) / cellSize)
    const r = Math.floor((clientY - rect.top) / cellSize)
    if (r < 0 || r >= grid.length || c < 0 || c >= (grid[0]?.length ?? 0)) return null
    return [r, c]
  }

  const applyToCell = (r: number, c: number) => {
    if (!dragRef.current) return
    const key = `${r},${c}`
    if (dragRef.current.visited.has(key)) return

    const { action } = dragRef.current
    if (action === 'fill' && grid[r][c] !== 'filled' && grid[r][c] !== 'marked') {
      dragRef.current.visited.add(key)
      onFill(r, c)
    } else if (action === 'unfill' && grid[r][c] === 'filled') {
      dragRef.current.visited.add(key)
      onFill(r, c)
    } else if (action === 'mark' && grid[r][c] !== 'marked' && grid[r][c] !== 'filled') {
      dragRef.current.visited.add(key)
      onMark(r, c)
    } else if (action === 'unmark' && grid[r][c] === 'marked') {
      dragRef.current.visited.add(key)
      onMark(r, c)
    } else if (action === 'erase' && grid[r][c] !== 'unknown') {
      dragRef.current.visited.add(key)
      onClear(r, c)
    }
  }

  const cancelLongPress = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current)
      longPressRef.current = null
    }
  }

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.button !== 2) return
    const cell = getCellAt(e.clientX, e.clientY)
    if (!cell) return
    const [r, c] = cell

    e.preventDefault()
    gridRef.current?.setPointerCapture(e.pointerId)

    let action: 'fill' | 'unfill' | 'mark' | 'unmark' | 'erase'
    if (e.button === 2) {
      // Clic droit → toujours mark/unmark
      action = grid[r][c] === 'marked' ? 'unmark' : 'mark'
    } else if (inputMode === 'erase') {
      action = 'erase'
    } else if (inputMode === 'mark') {
      action = grid[r][c] === 'marked' ? 'unmark' : 'mark'
    } else {
      action = grid[r][c] === 'filled' ? 'unfill' : 'fill'
    }
    dragRef.current = { action, visited: new Set(), origin: [r, c], active: false }

    // Long-press uniquement en mode fill + clic gauche (bascule vers mark)
    if (e.button === 0 && inputMode === 'fill') {
      longPressRef.current = setTimeout(() => {
        longPressRef.current = null
        dragRef.current = null
        onMark(r, c)
      }, 400)
    }
  }

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    const cell = getCellAt(e.clientX, e.clientY)
    if (!cell) return
    const [r, c] = cell
    const [r0, c0] = dragRef.current.origin

    // Première cellule différente : on active le mode drag
    if (!dragRef.current.active && (r !== r0 || c !== c0)) {
      cancelLongPress()
      dragRef.current.active = true
      applyToCell(r0, c0)
    }

    if (dragRef.current.active) {
      applyToCell(r, c)
    }
  }

  const handlePointerUp = () => {
    cancelLongPress()
    if (dragRef.current && !dragRef.current.active) {
      // Simple tap : exécuter l'action déterminée au pointerDown
      const [r, c] = dragRef.current.origin
      const { action } = dragRef.current
      if (action === 'erase') {
        onClear(r, c)
      } else if (action === 'mark' || action === 'unmark') {
        onMark(r, c)
      } else {
        if (grid[r][c] !== 'marked') onFill(r, c)
      }
    }
    dragRef.current = null
  }

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  return (
    <div
      ref={gridRef}
      className="border-2 border-gray-700 inline-block touch-none select-none cursor-crosshair"
      role="grid"
      aria-label="Grille de picross"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={handleContextMenu}
    >
      {grid.map((row, r) => (
        <div key={r} className="flex" role="row">
          {row.map((state, c) => (
            <Cell
              key={c}
              state={state}
              row={r}
              col={c}
              size={cellSize}
              isError={errorCells.has(`${r},${c}`)}
              thickTop={useThickLines && r > 0 && r % 5 === 0}
              thickLeft={useThickLines && c > 0 && c % 5 === 0}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
