import { describe, it, expect } from 'vitest'
import { generatePuzzle, puzzleFromSolution } from '@/lib/generator'
import { computeClues } from '@/lib/clues'
import { solve } from '@/lib/solver'

describe('generatePuzzle', () => {
  it('génère un puzzle avec les bonnes dimensions', () => {
    const puzzle = generatePuzzle(5)
    expect(puzzle.rows).toBe(5)
    expect(puzzle.cols).toBe(5)
    expect(puzzle.clues.rows).toHaveLength(5)
    expect(puzzle.clues.cols).toHaveLength(5)
  })

  it('génère un puzzle résolvable', () => {
    const puzzle = generatePuzzle(5, 'easy')
    const result = solve(puzzle)
    expect(result).not.toBeNull()
  })

  it('génère des puzzles pour chaque difficulté', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const puzzle = generatePuzzle(5, difficulty)
      expect(puzzle.clues.rows).toHaveLength(5)
    }
  })

  it('génère un puzzle avec une solution incluse', () => {
    const puzzle = generatePuzzle(5)
    expect(puzzle.solution).toBeDefined()
    expect(puzzle.solution).toHaveLength(5)
  })

  it('les indices du puzzle correspondent à la solution', () => {
    const puzzle = generatePuzzle(5)
    if (puzzle.solution) {
      const recomputed = computeClues(puzzle.solution)
      expect(recomputed.rows).toEqual(puzzle.clues.rows)
      expect(recomputed.cols).toEqual(puzzle.clues.cols)
    }
  })
})

describe('puzzleFromSolution', () => {
  it('crée un puzzle depuis une grille solution', () => {
    const solution = [
      [true, false, true],
      [false, true, false],
      [true, false, true],
    ]
    const puzzle = puzzleFromSolution(solution)
    expect(puzzle.rows).toBe(3)
    expect(puzzle.cols).toBe(3)
    expect(puzzle.solution).toEqual(solution)
    expect(puzzle.clues.rows).toEqual(computeClues(solution).rows)
    expect(puzzle.clues.cols).toEqual(computeClues(solution).cols)
  })
})
