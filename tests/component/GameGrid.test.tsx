import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GameGrid from '@/components/game/GameGrid'
import type { PlayGrid } from '@/lib/types'

const makeGrid = (rows: number, cols: number): PlayGrid =>
  Array.from({ length: rows }, () => Array(cols).fill('unknown'))

describe('GameGrid', () => {
  it('rend le bon nombre de cases', () => {
    render(
      <GameGrid
        grid={makeGrid(3, 3)}
        cellSize={32}
        onFill={vi.fn()}
        onMark={vi.fn()}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(9)
  })

  it('rend une grille 5×5', () => {
    render(
      <GameGrid
        grid={makeGrid(5, 5)}
        cellSize={32}
        onFill={vi.fn()}
        onMark={vi.fn()}
      />,
    )
    expect(screen.getAllByRole('button')).toHaveLength(25)
  })

  it('propage onFill avec les bonnes coordonnées', () => {
    const onFill = vi.fn()
    const grid = makeGrid(2, 2)
    render(<GameGrid grid={grid} cellSize={32} onFill={onFill} onMark={vi.fn()} />)

    const cells = screen.getAllByRole('button')
    fireEvent.click(cells[3]) // row=1, col=1
    expect(onFill).toHaveBeenCalledWith(1, 1)
  })

  it('a un role grid', () => {
    render(
      <GameGrid
        grid={makeGrid(2, 2)}
        cellSize={32}
        onFill={vi.fn()}
        onMark={vi.fn()}
      />,
    )
    expect(screen.getByRole('grid')).toBeInTheDocument()
  })
})
