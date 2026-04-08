import { computeClues } from './clues'
import { solve } from './solver'
import type { PicrossPuzzle, SolutionGrid } from './types'

function gridsEqual(a: SolutionGrid, b: SolutionGrid): boolean {
  return a.every((row, r) => row.every((cell, c) => cell === b[r][c]))
}

function cloneSolution(grid: SolutionGrid): SolutionGrid {
  return grid.map((row) => [...row])
}

/**
 * Tente d'ajuster la grille pour obtenir une solution unique.
 * Stratégie : identifier les cellules où le solveur diverge et les flipper.
 */
function adjustForUniqueness(
  original: SolutionGrid,
  maxAttempts: number,
): { solution: SolutionGrid; unique: boolean } {
  let current = cloneSolution(original)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const clues = computeClues(current)
    const rows = current.length
    const cols = current[0].length
    const puzzle: PicrossPuzzle = { rows, cols, clues }
    const solved = solve(puzzle)

    if (!solved) {
      // Grille non soluble — flipper une cellule aléatoire pour débloquer
      const r = Math.floor(Math.random() * rows)
      const c = Math.floor(Math.random() * cols)
      current[r][c] = !current[r][c]
      continue
    }

    if (gridsEqual(solved, current)) {
      return { solution: current, unique: true }
    }

    // Trouver les cellules divergentes et flipper la première
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (solved[r][c] !== current[r][c]) {
          current[r][c] = solved[r][c]
          break
        }
      }
      // On ne flippe qu'une cellule par tentative
      break
    }
  }

  // Dernière vérification
  const clues = computeClues(current)
  const rows = current.length
  const cols = current[0].length
  const puzzle: PicrossPuzzle = { rows, cols, clues }
  const solved = solve(puzzle)
  const unique = solved !== null && gridsEqual(solved, current)

  return { solution: current, unique }
}

self.onmessage = (e: MessageEvent<SolutionGrid>) => {
  const original = e.data
  const { solution, unique } = adjustForUniqueness(original, 50)

  const rows = solution.length
  const cols = solution[0].length
  const clues = computeClues(solution)
  const puzzle: PicrossPuzzle = { rows, cols, clues, solution }

  self.postMessage({ puzzle, unique })
}
