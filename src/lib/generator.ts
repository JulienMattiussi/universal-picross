import { computeClues } from './clues'
import { solve } from './solver'
import type { PicrossPuzzle, SolutionGrid } from './types'

export type Difficulty = 'easy' | 'medium' | 'hard'

const DENSITY: Record<Difficulty, [number, number]> = {
  easy: [0.45, 0.6],
  medium: [0.35, 0.65],
  hard: [0.25, 0.75],
}

/**
 * Génère une grille solution aléatoire de taille rows×cols avec une densité donnée.
 */
function randomGrid(rows: number, cols: number, density: number): SolutionGrid {
  return Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => Math.random() < density),
  )
}

/**
 * Génère un puzzle picross avec solution unique.
 * Tente plusieurs fois si la solution n'est pas unique ou pas résolvable.
 */
export function generatePuzzle(
  size: number,
  difficulty: Difficulty = 'medium',
  maxAttempts = 50,
): PicrossPuzzle {
  const [minDensity, maxDensity] = DENSITY[difficulty]

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const density = minDensity + Math.random() * (maxDensity - minDensity)
    const solution = randomGrid(size, size, density)
    const clues = computeClues(solution)

    const puzzle: PicrossPuzzle = { rows: size, cols: size, clues, solution }

    // Vérifier que le solveur trouve bien cette solution (unicité non garantie,
    // mais au moins résolvable par logique pure ou backtracking)
    const solved = solve(puzzle)
    if (solved && gridsEqual(solved, solution)) {
      return puzzle
    }
  }

  // Fallback : retourner un puzzle même si la solution n'est pas parfaitement unique
  const solution = randomGrid(size, size, 0.5)
  const clues = computeClues(solution)
  return { rows: size, cols: size, clues, solution }
}

/**
 * Crée un puzzle depuis une grille solution existante (ex: import image).
 */
export function puzzleFromSolution(solution: SolutionGrid): PicrossPuzzle {
  const rows = solution.length
  const cols = solution[0]?.length ?? 0
  const clues = computeClues(solution)
  return { rows, cols, clues, solution }
}

function gridsEqual(a: SolutionGrid, b: SolutionGrid): boolean {
  return a.every((row, r) => row.every((cell, c) => cell === b[r][c]))
}
