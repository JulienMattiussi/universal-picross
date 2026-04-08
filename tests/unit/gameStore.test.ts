import { describe, it, expect, beforeEach } from 'vitest'
import { useGameStore } from '@/store/gameStore'
import { puzzleFromSolution } from '@/lib/generator'
import { computeClues } from '@/lib/clues'
import { solve } from '@/lib/solver'

function freshStore() {
  useGameStore.setState({ puzzle: null, grid: [], status: 'idle', elapsedSeconds: 0 })
  return useGameStore.getState()
}

describe('détection de victoire — puzzle généré', () => {
  beforeEach(() => freshStore())

  it('passe à "solved" quand toutes les cases correspondent à la solution', () => {
    const solution = [
      [true, false, true],
      [false, true, false],
      [true, false, true],
    ]
    const puzzle = puzzleFromSolution(solution)
    useGameStore.getState().loadPuzzle(puzzle)

    for (let r = 0; r < 3; r++)
      for (let c = 0; c < 3; c++) if (solution[r][c]) useGameStore.getState().fillCell(r, c)

    expect(useGameStore.getState().status).toBe('solved')
  })

  it('reste en "playing" si la grille est incomplète', () => {
    const solution = [
      [true, true],
      [true, true],
    ]
    const puzzle = puzzleFromSolution(solution)
    useGameStore.getState().loadPuzzle(puzzle)

    useGameStore.getState().fillCell(0, 0) // une seule case remplie sur 4

    expect(useGameStore.getState().status).toBe('playing')
  })

  it('reste en "playing" si une case remplie est incorrecte', () => {
    const solution = [
      [true, false],
      [false, true],
    ]
    const puzzle = puzzleFromSolution(solution)
    useGameStore.getState().loadPuzzle(puzzle)

    // (0,1) est rempli en premier (incorrect) — bloque la victoire même quand
    // les cases obligatoires sont ensuite remplies, car checkWin vérifie à chaque coup
    useGameStore.getState().fillCell(0, 1) // incorrecte : doit rester vide
    useGameStore.getState().fillCell(0, 0)
    useGameStore.getState().fillCell(1, 1)

    expect(useGameStore.getState().status).toBe('playing')
  })
})

describe('détection de victoire — puzzle importé', () => {
  beforeEach(() => freshStore())

  it('passe à "solved" quand la solution est obtenue par le solveur après injection des indices', () => {
    // Simule le flux handleValidationComplete :
    // on part d'une grille vide, on injecte les vrais indices, puis on résout.
    const realSolution = [
      [true, true, false],
      [false, true, true],
      [true, false, true],
    ]
    const size = realSolution.length
    const emptyGrid = Array.from({ length: size }, () => Array(size).fill(false))
    const puzzle = puzzleFromSolution(emptyGrid)
    puzzle.clues = computeClues(realSolution)

    // Correction appliquée dans ImportPanel.handleValidationComplete
    const solved = solve(puzzle)
    expect(solved).not.toBeNull()
    if (solved) puzzle.solution = solved

    useGameStore.getState().loadPuzzle(puzzle)

    for (let r = 0; r < size; r++)
      for (let c = 0; c < size; c++) if (solved![r][c]) useGameStore.getState().fillCell(r, c)

    expect(useGameStore.getState().status).toBe('solved')
  })

  it('ne passe jamais à "solved" si puzzle.solution est la grille vide (régression)', () => {
    // Reproduit le bug original : solution = grille vide, solve() non appelé.
    const realSolution = [
      [true, false],
      [false, true],
    ]
    const emptyGrid = Array.from({ length: 2 }, () => Array(2).fill(false))
    const puzzle = puzzleFromSolution(emptyGrid) // solution = tout false
    puzzle.clues = computeClues(realSolution)
    // NE PAS appeler solve() — c'est l'ancien comportement bugué

    useGameStore.getState().loadPuzzle(puzzle)
    useGameStore.getState().fillCell(0, 0)
    useGameStore.getState().fillCell(1, 1)

    // Avec solution = grille vide, checkWin compare à des cases qui doivent toutes
    // être non-remplies, donc remplir des cases empêche toujours la victoire.
    expect(useGameStore.getState().status).toBe('playing')
  })
})
