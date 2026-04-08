import type { CellState, Clue, Clues, SolutionGrid } from './types'

export type ClueStatus = 'normal' | 'completed' | 'impossible'

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

/**
 * Détermine le statut de chaque indice d'une ligne en fonction des cases jouées.
 *
 * - `completed` : un groupe de cases remplies consécutives correspond à cet indice
 *   (matching gauche → droite, sans exiger de croix autour).
 * - `impossible` : l'indice ne peut plus être satisfait (espace insuffisant
 *   ou groupe existant trop grand).
 * - `normal` : ni l'un ni l'autre.
 */
export function getClueStatuses(clue: Clue, cells: CellState[]): ClueStatus[] {
  // Indice [0] = ligne vide
  if (clue.length === 1 && clue[0] === 0) {
    if (cells.some((c) => c === 'filled')) return ['impossible']
    if (cells.every((c) => c !== 'unknown')) return ['completed']
    return ['normal']
  }

  const n = cells.length
  const statuses: ClueStatus[] = clue.map(() => 'normal')

  // 1. Tous les groupes de cases remplies consécutives (gauche → droite)
  const groups: number[] = []
  let i = 0
  while (i < n) {
    if (cells[i] === 'filled') {
      const s = i
      while (i < n && cells[i] === 'filled') i++
      groups.push(i - s)
    } else i++
  }

  // 2. Associer groupes → indices (gauche → droite, greedy par taille)
  let gi = 0
  for (let c = 0; c < clue.length && gi < groups.length; c++) {
    if (groups[gi] === clue[c]) {
      statuses[c] = 'completed'
      gi++
    }
  }

  // 3. Détection d'impossibilité
  // 3a. Segments disponibles (runs de cellules non marquées)
  const segments: number[] = []
  let seg = 0
  for (let j = 0; j < n; j++) {
    if (cells[j] === 'marked' || cells[j] === 'empty') {
      if (seg > 0) segments.push(seg)
      seg = 0
    } else seg++
  }
  if (seg > 0) segments.push(seg)

  const totalAvailable = segments.reduce((a, b) => a + b, 0)
  const minRequired = clue.reduce((a, b) => a + b, 0) + clue.length - 1

  // 3b. Espace total insuffisant pour tous les indices
  if (minRequired > totalAvailable) {
    for (let c = 0; c < clue.length; c++) {
      if (statuses[c] !== 'completed') statuses[c] = 'impossible'
    }
    return statuses
  }

  // 3c. Un groupe rempli dépasse la plus grande valeur d'indice
  const maxClue = Math.max(...clue)
  for (const g of groups) {
    if (g > maxClue) {
      for (let c = 0; c < clue.length; c++) {
        if (statuses[c] !== 'completed') statuses[c] = 'impossible'
      }
      return statuses
    }
  }

  // 3d. Un indice individuel ne rentre dans aucun segment
  const maxSegment = segments.length > 0 ? Math.max(...segments) : 0
  for (let c = 0; c < clue.length; c++) {
    if (statuses[c] === 'normal' && clue[c] > maxSegment) {
      statuses[c] = 'impossible'
    }
  }

  return statuses
}
