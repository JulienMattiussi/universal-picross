import { describe, it, expect } from 'vitest'
import { computeLineClue, computeClues, minLineLength, getClueStatuses } from '@/lib/clues'
import type { CellState } from '@/lib/types'

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

describe('getClueStatuses', () => {
  const u: CellState = 'unknown'
  const f: CellState = 'filled'
  const m: CellState = 'marked'

  // --- normal ---
  it('retourne normal pour une ligne vierge', () => {
    expect(getClueStatuses([3, 1], [u, u, u, u, u])).toEqual(['normal', 'normal'])
  })

  // --- completed ---
  it('détecte un groupe comme completed même sans croix autour', () => {
    // [filled, filled, filled, unknown, unknown] avec clue [3]
    expect(getClueStatuses([3], [f, f, f, u, u])).toEqual(['completed'])
  })

  it('détecte un groupe avec croix comme completed', () => {
    expect(getClueStatuses([3], [f, f, f, m, u])).toEqual(['completed'])
  })

  it('détecte plusieurs groupes en ordre', () => {
    // clue [2, 1] : [f,f,u,f,u]
    expect(getClueStatuses([2, 1], [f, f, u, f, u])).toEqual(['completed', 'completed'])
  })

  it('détecte un groupe en bord de ligne', () => {
    expect(getClueStatuses([2], [f, f])).toEqual(['completed'])
  })

  it('ne marque pas completed si la taille ne correspond pas', () => {
    // clue [3] : [f,f,u,u,u] — groupe de 2, pas 3
    expect(getClueStatuses([3], [f, f, u, u, u])).toEqual(['normal'])
  })

  // --- impossible ---
  it('détecte impossible quand l espace total est insuffisant', () => {
    // clue [3, 2] nécessite 6 cases min, mais seulement 4 dispo → tous impossible
    expect(getClueStatuses([3, 2], [m, u, u, u, u, m])).toEqual(['impossible', 'impossible'])
  })

  it('détecte impossible quand un groupe dépasse le plus grand indice', () => {
    // clue [2] mais un groupe de 3 existe
    expect(getClueStatuses([2], [f, f, f, u, u])).toEqual(['impossible'])
  })

  it('détecte impossible pour indice [0] avec des cases remplies', () => {
    expect(getClueStatuses([0], [f, u, u])).toEqual(['impossible'])
  })

  it('détecte completed pour indice [0] quand tout est marqué', () => {
    expect(getClueStatuses([0], [m, m, m])).toEqual(['completed'])
  })

  it('retourne normal pour indice [0] avec seulement des unknown', () => {
    expect(getClueStatuses([0], [u, u, u])).toEqual(['normal'])
  })

  it('détecte impossible quand l espace est insuffisant globalement', () => {
    // clue [1, 3] nécessite 5 cases min, mais seulement 3 dispo → tous impossible
    expect(getClueStatuses([1, 3], [u, m, u, u])).toEqual(['impossible', 'impossible'])
  })

  it('détecte impossible pour un indice individuel trop grand pour les segments', () => {
    // clue [1, 3] : segments de taille 2 et 2 — assez d'espace total (5≤4? non, 5>4)
    // clue [1, 2] : segments de taille 1 et 2 — total=3, min=4 → impossible
    // Testons un cas ou seul un indice est trop grand pour son segment :
    // clue [1, 3] dans [u, u, m, u, u, u, u] : segments [2, 4], total=6, min=5 → OK
    // Le 3 rentre dans le segment de 4, le 1 dans celui de 2 → tous normal
    expect(getClueStatuses([1, 3], [u, u, m, u, u, u, u])).toEqual(['normal', 'normal'])
  })

  it('détecte impossible quand un indice ne rentre dans aucun segment', () => {
    // clue [1, 4] dans [u, u, m, u, u, u] : segments [2, 3], total=5, min=6 → impossible
    expect(getClueStatuses([1, 4], [u, u, m, u, u, u])).toEqual(['impossible', 'impossible'])
  })
})
