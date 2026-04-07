import { describe, it, expect } from 'vitest'
import { computeLineClue, computeClues, minLineLength } from '@/lib/clues'

describe('computeLineClue', () => {
  it('retourne [0] pour une ligne vide', () => {
    expect(computeLineClue([false, false, false])).toEqual([0])
  })

  it('retourne [1] pour une seule case remplie', () => {
    expect(computeLineClue([false, true, false])).toEqual([1])
  })

  it('retourne [3] pour trois cases consécutives', () => {
    expect(computeLineClue([true, true, true])).toEqual([3])
  })

  it('retourne [3, 1] pour deux groupes', () => {
    expect(computeLineClue([true, true, true, false, true])).toEqual([3, 1])
  })

  it('retourne [1, 1, 1] pour trois cases séparées', () => {
    expect(computeLineClue([true, false, true, false, true])).toEqual([1, 1, 1])
  })

  it('gère une ligne entièrement remplie', () => {
    expect(computeLineClue([true, true, true, true])).toEqual([4])
  })

  it('gère un groupe en début de ligne', () => {
    expect(computeLineClue([true, true, false, false])).toEqual([2])
  })

  it('gère un groupe en fin de ligne', () => {
    expect(computeLineClue([false, false, true, true])).toEqual([2])
  })
})

describe('computeClues', () => {
  it('calcule les indices pour une grille 2×2', () => {
    const grid = [
      [true, false],
      [false, true],
    ]
    const clues = computeClues(grid)
    expect(clues.rows).toEqual([[1], [1]])
    expect(clues.cols).toEqual([[1], [1]])
  })

  it('calcule les indices pour une grille 3×3 connue', () => {
    const grid = [
      [true, true, false],
      [false, true, true],
      [true, false, false],
    ]
    const clues = computeClues(grid)
    expect(clues.rows).toEqual([[2], [2], [1]])
    expect(clues.cols).toEqual([[1, 1], [2], [1]])
  })

  it('gère une grille entièrement vide', () => {
    const grid = [
      [false, false],
      [false, false],
    ]
    const clues = computeClues(grid)
    expect(clues.rows).toEqual([[0], [0]])
    expect(clues.cols).toEqual([[0], [0]])
  })

  it('gère une grille entièrement remplie', () => {
    const grid = [
      [true, true],
      [true, true],
    ]
    const clues = computeClues(grid)
    expect(clues.rows).toEqual([[2], [2]])
    expect(clues.cols).toEqual([[2], [2]])
  })
})

describe('minLineLength', () => {
  it('retourne 0 pour [0]', () => {
    expect(minLineLength([0])).toBe(0)
  })

  it('retourne la longueur pour [3]', () => {
    expect(minLineLength([3])).toBe(3)
  })

  it('retourne longueur + espaces pour [3, 1]', () => {
    expect(minLineLength([3, 1])).toBe(5) // 3 + 1 espace + 1
  })

  it('retourne la bonne valeur pour [1, 1, 1]', () => {
    expect(minLineLength([1, 1, 1])).toBe(5) // 1+1+1 + 2 espaces
  })
})
