import type { Point } from '@/lib/image/types'

export interface OcrFixture {
  id: string
  label: string
  imageUrl: string
  size: { rows: number; cols: number }
  rowClues: number[][]
  colClues: number[][]
  defaultCorners: [Point, Point]
}

export const freePicross2c: OcrFixture = {
  id: 'free-picross-2c',
  label: 'Free Picross — Level 2-C (15×15)',
  imageUrl: '/test-fixtures/free-picross-2c.webp',
  size: { rows: 15, cols: 15 },
  rowClues: [
    [6],
    [2, 3, 1],
    [2, 1, 1, 1],
    [5, 1, 1, 1],
    [2, 3, 1, 1, 1],
    [1, 3, 3, 2],
    [1, 3, 2],
    [7, 3],
    [3, 3],
    [1, 2],
    [2, 2],
    [1, 2],
    [2, 2],
    [1, 3],
    [3],
  ],
  colClues: [
    [3],
    [2, 1],
    [1, 2],
    [6],
    [6],
    [1, 3, 1],
    [1, 1],
    [1, 2],
    [1, 3, 1],
    [2, 1, 6],
    [2, 1, 1, 1, 1],
    [2, 1, 1, 2],
    [1, 3, 8],
    [1, 9],
    [6],
  ],
  defaultCorners: [
    { x: 377, y: 394 },
    { x: 866, y: 868 },
  ],
}
