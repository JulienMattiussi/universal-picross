import { create } from 'zustand'
import type { CellState, GameStatus, PicrossPuzzle, PlayGrid } from '@/lib/types'

interface GameStore {
  puzzle: PicrossPuzzle | null
  grid: PlayGrid
  status: GameStatus
  elapsedSeconds: number
  cheated: boolean

  // Actions
  loadPuzzle: (puzzle: PicrossPuzzle) => void
  fillCell: (row: number, col: number) => void
  markCell: (row: number, col: number) => void
  clearCell: (row: number, col: number) => void
  applyGrid: (grid: PlayGrid) => void
  reset: () => void
  setStatus: (status: GameStatus) => void
  tick: () => void
}

function makeEmptyGrid(rows: number, cols: number): PlayGrid {
  return Array.from({ length: rows }, () => Array<CellState>(cols).fill('unknown'))
}

function checkWin(grid: PlayGrid, puzzle: PicrossPuzzle): boolean {
  if (!puzzle.solution) return false
  return grid.every((row, r) =>
    row.every((cell, c) => {
      const shouldBeFilled = puzzle.solution![r][c]
      return shouldBeFilled ? cell === 'filled' : cell !== 'filled'
    }),
  )
}

export const useGameStore = create<GameStore>((set, get) => ({
  puzzle: null,
  grid: [],
  status: 'idle',
  elapsedSeconds: 0,
  cheated: false,

  loadPuzzle: (puzzle) => {
    set({
      puzzle,
      grid: makeEmptyGrid(puzzle.rows, puzzle.cols),
      status: 'playing',
      elapsedSeconds: 0,
      cheated: false,
    })
  },

  fillCell: (row, col) => {
    const { grid, puzzle, status } = get()
    if (status !== 'playing' || !puzzle) return

    const newGrid = grid.map((r) => [...r]) as PlayGrid
    const current = newGrid[row][col]
    newGrid[row][col] =
      current === 'filled' ? 'unknown' : current === 'marked' ? 'marked' : 'filled'

    const won = checkWin(newGrid, puzzle)
    set({ grid: newGrid, status: won ? 'solved' : 'playing' })
  },

  markCell: (row, col) => {
    const { grid, puzzle, status } = get()
    if (status !== 'playing' || !puzzle) return

    const newGrid = grid.map((r) => [...r]) as PlayGrid
    const current = newGrid[row][col]
    newGrid[row][col] =
      current === 'marked' ? 'unknown' : current === 'filled' ? 'filled' : 'marked'

    set({ grid: newGrid })
  },

  clearCell: (row, col) => {
    const { grid, puzzle, status } = get()
    if (status !== 'playing' || !puzzle) return
    if (grid[row][col] === 'unknown') return

    const newGrid = grid.map((r) => [...r]) as PlayGrid
    newGrid[row][col] = 'unknown'
    set({ grid: newGrid })
  },

  applyGrid: (grid) => {
    const { puzzle } = get()
    if (!puzzle) return
    const won = checkWin(grid, puzzle)
    set({ grid, status: won ? 'solved' : 'playing' })
  },

  reset: () => {
    const { puzzle } = get()
    if (!puzzle) return
    set({
      grid: makeEmptyGrid(puzzle.rows, puzzle.cols),
      status: 'playing',
      elapsedSeconds: 0,
      cheated: false,
    })
  },

  setStatus: (status) => set({ status }),

  tick: () => set((s) => ({ elapsedSeconds: s.elapsedSeconds + 1 })),
}))
