// État d'une case du jeu
export type CellState = 'unknown' | 'filled' | 'empty' | 'marked'

// Grille 2D de cases (solution binaire : true = remplie)
export type SolutionGrid = boolean[][]

// Grille 2D de l'état en cours de partie
export type PlayGrid = CellState[][]

// Un groupe de cases consécutives remplies (ex: [3, 1, 2])
export type Clue = number[]

// Indices d'une ligne ou colonne
export type Clues = {
  rows: Clue[]
  cols: Clue[]
}

// Puzzle complet
export interface PicrossPuzzle {
  rows: number
  cols: number
  clues: Clues
  solution?: SolutionGrid
}

// État de la partie en cours
export type GameStatus = 'idle' | 'playing' | 'solved' | 'solving'

export interface GameState {
  puzzle: PicrossPuzzle | null
  grid: PlayGrid
  status: GameStatus
  elapsedSeconds: number
}
