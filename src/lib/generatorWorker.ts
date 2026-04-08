import { computeClues } from './clues'
import { solve } from './solver'
import type { PicrossPuzzle, SolutionGrid } from './types'
import type { Difficulty } from './generator'

const DENSITY: Record<Difficulty, [number, number]> = {
  easy: [0.45, 0.6],
  medium: [0.35, 0.65],
  hard: [0.25, 0.75],
}

function randomGrid(rows: number, cols: number, density: number): SolutionGrid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.random() < density),
  )
}

function gridsEqual(a: SolutionGrid, b: SolutionGrid): boolean {
  return a.every((row, r) => row.every((cell, c) => cell === b[r][c]))
}

self.onmessage = (
  e: MessageEvent<{ size: number; difficulty: Difficulty; maxAttempts: number }>,
) => {
  const { size, difficulty, maxAttempts } = e.data
  const [minDensity, maxDensity] = DENSITY[difficulty]

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const density = minDensity + Math.random() * (maxDensity - minDensity)
    const solution = randomGrid(size, size, density)
    const clues = computeClues(solution)
    const puzzle: PicrossPuzzle = { rows: size, cols: size, clues, solution }

    const solved = solve(puzzle)
    if (solved && gridsEqual(solved, solution)) {
      self.postMessage(puzzle)
      return
    }
  }

  // Fallback
  const solution = randomGrid(size, size, 0.5)
  const clues = computeClues(solution)
  self.postMessage({ rows: size, cols: size, clues, solution })
}
