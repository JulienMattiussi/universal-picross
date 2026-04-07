import type { Clue, PicrossPuzzle, SolutionGrid } from './types'

// Valeur interne d'une case : true = remplie, false = vide, null = inconnu
type MaybeCell = boolean | null
type WorkGrid = MaybeCell[][]

/**
 * Génère toutes les façons valides de placer un indice dans une ligne de longueur `len`.
 * Initialise à false, ne pose que les `true`.
 */
function generateArrangements(clue: Clue, len: number): boolean[][] {
  const results: boolean[][] = []
  const isEmpty = clue.length === 1 && clue[0] === 0

  if (isEmpty) {
    results.push(Array<boolean>(len).fill(false))
    return results
  }

  function place(groupIdx: number, startPos: number, current: boolean[]) {
    if (groupIdx === clue.length) {
      results.push([...current])
      return
    }

    const groupSize = clue[groupIdx]
    const remaining = clue.slice(groupIdx + 1)
    const minRemaining =
      remaining.length > 0
        ? remaining.reduce((a, b) => a + b, 0) + remaining.length
        : 0
    const maxStart = len - groupSize - minRemaining

    for (let pos = startPos; pos <= maxStart; pos++) {
      const arr = [...current]
      for (let i = pos; i < pos + groupSize; i++) arr[i] = true
      place(groupIdx + 1, pos + groupSize + 1, arr)
    }
  }

  place(0, 0, Array<boolean>(len).fill(false))
  return results
}

/**
 * Détermine les cases certaines par intersection de tous les arrangements valides.
 * Retourne null si aucun arrangement n'est compatible (puzzle impossible).
 */
function solveLine(clue: Clue, line: MaybeCell[]): MaybeCell[] | null {
  const len = line.length
  const arrangements = generateArrangements(clue, len)

  const valid = arrangements.filter((arr) =>
    arr.every((cell, i) => line[i] === null || line[i] === cell),
  )

  if (valid.length === 0) return null

  return Array.from({ length: len }, (_, i) => {
    const allTrue = valid.every((arr) => arr[i] === true)
    const allFalse = valid.every((arr) => arr[i] === false)
    if (allTrue) return true
    if (allFalse) return false
    return null
  })
}

/**
 * Résout un picross par propagation de contraintes itérative + backtracking.
 * Retourne la grille solution ou null si impossible.
 */
export function solve(puzzle: PicrossPuzzle): SolutionGrid | null {
  const { rows, cols } = puzzle
  const grid: WorkGrid = Array.from({ length: rows }, () =>
    Array<MaybeCell>(cols).fill(null),
  )
  return propagateAndSolve(grid, puzzle)
}

function propagateAndSolve(grid: WorkGrid, puzzle: PicrossPuzzle): SolutionGrid | null {
  const { rows, cols, clues } = puzzle
  let changed = true

  while (changed) {
    changed = false

    for (let r = 0; r < rows; r++) {
      const result = solveLine(clues.rows[r], grid[r])
      if (!result) return null
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === null && result[c] !== null) {
          grid[r][c] = result[c]
          changed = true
        }
      }
    }

    for (let c = 0; c < cols; c++) {
      const col: MaybeCell[] = grid.map((row) => row[c])
      const result = solveLine(clues.cols[c], col)
      if (!result) return null
      for (let r = 0; r < rows; r++) {
        if (grid[r][c] === null && result[r] !== null) {
          grid[r][c] = result[r]
          changed = true
        }
      }
    }
  }

  const unknownCell = findUnknown(grid, rows, cols)
  if (unknownCell) {
    return backtrack(grid, puzzle, unknownCell)
  }

  return grid.map((row) => row.map((cell) => cell === true))
}

function findUnknown(grid: WorkGrid, rows: number, cols: number): [number, number] | null {
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (grid[r][c] === null) return [r, c]
    }
  }
  return null
}

function cloneGrid(grid: WorkGrid): WorkGrid {
  return grid.map((row) => [...row])
}

function backtrack(
  grid: WorkGrid,
  puzzle: PicrossPuzzle,
  [r, c]: [number, number],
): SolutionGrid | null {
  for (const value of [true, false] as const) {
    const newGrid = cloneGrid(grid)
    newGrid[r][c] = value
    const solved = propagateAndSolve(newGrid, puzzle)
    if (solved) return solved
  }
  return null
}
