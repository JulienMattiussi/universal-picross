import type { Clue, Clues, SolutionGrid } from './types'

/**
 * Calcule les indices d'une ligne (séquences de cases remplies consécutives).
 * Retourne [0] si la ligne est vide.
 */
export function computeLineClue(line: boolean[]): Clue {
  const groups: number[] = []
  let count = 0

  for (const cell of line) {
    if (cell) {
      count++
    } else if (count > 0) {
      groups.push(count)
      count = 0
    }
  }
  if (count > 0) groups.push(count)

  return groups.length > 0 ? groups : [0]
}

/**
 * Calcule tous les indices (lignes + colonnes) d'une grille solution.
 */
export function computeClues(grid: SolutionGrid): Clues {
  const rows = grid.length
  const cols = grid[0]?.length ?? 0

  const rowClues = grid.map((row) => computeLineClue(row))

  const colClues = Array.from({ length: cols }, (_, c) => {
    const col = Array.from({ length: rows }, (_, r) => grid[r][c])
    return computeLineClue(col)
  })

  return { rows: rowClues, cols: colClues }
}

/**
 * Calcule la longueur minimale d'une ligne pour un indice donné.
 * Ex: [3, 1] → 3 + 1 + 1 (espace) = 5
 */
export function minLineLength(clue: Clue): number {
  if (clue.length === 1 && clue[0] === 0) return 0
  return clue.reduce((sum, n) => sum + n, 0) + (clue.length - 1)
}
