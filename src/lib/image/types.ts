export interface Point {
  x: number
  y: number
}

export interface GridCellsResult {
  nRows: number
  nCols: number
  colClueCells: string[]
  rowClueCells: string[]
  interiorCells: string[][]
  colored: boolean
}

export interface GridStructure {
  rowLines: number[]
  colLines: number[]
}

export interface Band {
  lum: number
  width: number
}
