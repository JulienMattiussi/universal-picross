import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import GameBoard from '@/components/game/GameBoard'
import { generatePuzzle } from '@/lib/generator'
import type { PlayGrid } from '@/lib/types'

function makePlayGrid(rows: number, cols: number): PlayGrid {
  return Array.from({ length: rows }, () => Array(cols).fill('unknown'))
}

describe('GameBoard', () => {
  it('rend la grille et les indices', () => {
    const puzzle = generatePuzzle(5)
    const grid = makePlayGrid(5, 5)
    render(
      <GameBoard
        puzzle={puzzle}
        grid={grid}
        onFill={vi.fn()}
        onMark={vi.fn()}
      />,
    )
    expect(screen.getByRole('grid')).toBeInTheDocument()
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(25)
  })

  it('affiche les indices numériques des lignes', () => {
    const puzzle = {
      rows: 3,
      cols: 3,
      clues: {
        rows: [[3], [0], [2]],
        cols: [[2], [1], [2]],
      },
    }
    const grid = makePlayGrid(3, 3)
    render(
      <GameBoard
        puzzle={puzzle}
        grid={grid}
        onFill={vi.fn()}
        onMark={vi.fn()}
      />,
    )
    // Les chiffres 3, 2 doivent apparaître dans les indices
    const allText = screen.getAllByText('3')
    expect(allText.length).toBeGreaterThan(0)
  })
})
