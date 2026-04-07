import { describe, it, expect } from 'vitest'
import { solve } from '@/lib/solver'
import { computeClues } from '@/lib/clues'
import type { PicrossPuzzle } from '@/lib/types'

function makePuzzle(solution: boolean[][]): PicrossPuzzle {
  const clues = computeClues(solution)
  return {
    rows: solution.length,
    cols: solution[0].length,
    clues,
    solution,
  }
}

describe('solve', () => {
  it('résout un puzzle trivial 1×1 rempli', () => {
    const puzzle = makePuzzle([[true]])
    expect(solve(puzzle)).toEqual([[true]])
  })

  it('résout un puzzle trivial 1×1 vide', () => {
    const puzzle = makePuzzle([[false]])
    expect(solve(puzzle)).toEqual([[false]])
  })

  it('résout un puzzle 2×2 simple', () => {
    const solution = [
      [true, false],
      [false, true],
    ]
    const puzzle = makePuzzle(solution)
    expect(solve(puzzle)).toEqual(solution)
  })

  it('résout un puzzle 3×3 par propagation pure', () => {
    // Croix : toutes les cases de la ligne/colonne du milieu
    const solution = [
      [false, true, false],
      [true, true, true],
      [false, true, false],
    ]
    const puzzle = makePuzzle(solution)
    expect(solve(puzzle)).toEqual(solution)
  })

  it('résout un puzzle 5×5', () => {
    const solution = [
      [true, true, false, false, false],
      [false, true, true, false, false],
      [false, false, true, true, false],
      [false, false, false, true, true],
      [true, false, false, false, true],
    ]
    const puzzle = makePuzzle(solution)
    expect(solve(puzzle)).toEqual(solution)
  })

  it('résout un puzzle entièrement rempli', () => {
    const solution = [
      [true, true, true],
      [true, true, true],
      [true, true, true],
    ]
    const puzzle = makePuzzle(solution)
    expect(solve(puzzle)).toEqual(solution)
  })

  it('résout un puzzle entièrement vide', () => {
    const solution = [
      [false, false, false],
      [false, false, false],
      [false, false, false],
    ]
    const puzzle = makePuzzle(solution)
    expect(solve(puzzle)).toEqual(solution)
  })

  it('résout un puzzle 4×4 nécessitant du backtracking', () => {
    const solution = [
      [true, false, true, false],
      [false, true, false, true],
      [true, false, true, false],
      [false, true, false, true],
    ]
    const puzzle = makePuzzle(solution)
    const result = solve(puzzle)
    expect(result).not.toBeNull()
    // On vérifie juste que la solution trouvée est cohérente avec les indices
    if (result) {
      const resolvedClues = computeClues(result)
      expect(resolvedClues.rows).toEqual(puzzle.clues.rows)
      expect(resolvedClues.cols).toEqual(puzzle.clues.cols)
    }
  })

  it('retourne null pour un puzzle impossible', () => {
    // Puzzle avec indices contradictoires
    const puzzle: PicrossPuzzle = {
      rows: 2,
      cols: 2,
      clues: {
        rows: [[3], [3]], // impossible dans une grille 2×2
        cols: [[2], [2]],
      },
    }
    expect(solve(puzzle)).toBeNull()
  })
})
