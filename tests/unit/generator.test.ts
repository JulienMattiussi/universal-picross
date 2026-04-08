import { describe, it, expect, vi, beforeEach } from 'vitest'
import { computeClues } from '@/lib/clues'
import { solve } from '@/lib/solver'
import type { PicrossPuzzle } from '@/lib/types'

// Mock Worker car jsdom ne les supporte pas
class MockWorker {
  onmessage: ((e: MessageEvent) => void) | null = null
  onerror: ((e: ErrorEvent) => void) | null = null
  postMessage(data: { size: number; difficulty: string; maxAttempts: number }) {
    // Simule le worker : génère un puzzle synchrone simple
    const { size } = data
    const solution = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => (r + c) % 2 === 0),
    )
    const clues = computeClues(solution)
    const puzzle: PicrossPuzzle = { rows: size, cols: size, clues, solution }
    setTimeout(() => this.onmessage?.({ data: puzzle } as MessageEvent), 0)
  }
  terminate() {}
  addEventListener() {}
  removeEventListener() {}
}

beforeEach(() => {
  vi.stubGlobal('Worker', MockWorker)
})

describe('generatePuzzle', () => {
  it('génère un puzzle avec les bonnes dimensions', async () => {
    const { generatePuzzle } = await import('@/lib/generator')
    const puzzle = await generatePuzzle(5)
    expect(puzzle.rows).toBe(5)
    expect(puzzle.cols).toBe(5)
    expect(puzzle.clues.rows).toHaveLength(5)
    expect(puzzle.clues.cols).toHaveLength(5)
  })

  it('génère un puzzle avec une solution incluse', async () => {
    const { generatePuzzle } = await import('@/lib/generator')
    const puzzle = await generatePuzzle(5)
    expect(puzzle.solution).toBeDefined()
    expect(puzzle.solution).toHaveLength(5)
  })

  it('les indices du puzzle correspondent à la solution', async () => {
    const { generatePuzzle } = await import('@/lib/generator')
    const puzzle = await generatePuzzle(5)
    if (puzzle.solution) {
      const recomputed = computeClues(puzzle.solution)
      expect(recomputed.rows).toEqual(puzzle.clues.rows)
      expect(recomputed.cols).toEqual(puzzle.clues.cols)
    }
  })

  it('respecte le signal d annulation', async () => {
    const { generatePuzzle } = await import('@/lib/generator')
    const controller = new AbortController()
    controller.abort()
    await expect(generatePuzzle(5, 'medium', 100, controller.signal)).rejects.toThrow('Aborted')
  })
})

describe('puzzleFromSolution', () => {
  it('crée un puzzle depuis une grille solution', async () => {
    const { puzzleFromSolution } = await import('@/lib/generator')
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

describe('solve integration', () => {
  it('génère un puzzle résolvable', async () => {
    const { puzzleFromSolution } = await import('@/lib/generator')
    const solution = [
      [true, true, false, false, true],
      [false, true, true, false, false],
      [true, false, true, true, false],
      [false, false, true, false, true],
      [true, true, false, true, true],
    ]
    const puzzle = puzzleFromSolution(solution)
    const result = solve(puzzle)
    expect(result).not.toBeNull()
  })
})
