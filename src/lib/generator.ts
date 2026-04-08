import { computeClues } from './clues'
import type { PicrossPuzzle, SolutionGrid } from './types'

export type Difficulty = 'easy' | 'medium' | 'hard'

/**
 * Génère un puzzle picross avec solution unique dans un Web Worker.
 * Le thread UI reste libre. L'annulation via `signal` termine le worker immédiatement.
 */
export function generatePuzzle(
  size: number,
  difficulty: Difficulty = 'medium',
  maxAttempts = 100,
  signal?: AbortSignal,
): Promise<PicrossPuzzle> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./generatorWorker.ts', import.meta.url), { type: 'module' })

    const cleanup = () => {
      worker.terminate()
      signal?.removeEventListener('abort', onAbort)
    }

    const onAbort = () => {
      cleanup()
      reject(new DOMException('Aborted', 'AbortError'))
    }

    if (signal?.aborted) {
      worker.terminate()
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    signal?.addEventListener('abort', onAbort)

    worker.onmessage = (e: MessageEvent<PicrossPuzzle>) => {
      cleanup()
      resolve(e.data)
    }

    worker.onerror = (e) => {
      cleanup()
      reject(new Error(e.message))
    }

    worker.postMessage({ size, difficulty, maxAttempts })
  })
}

/**
 * Crée un puzzle depuis une grille solution existante (ex: import image).
 */
export function puzzleFromSolution(solution: SolutionGrid): PicrossPuzzle {
  const rows = solution.length
  const cols = solution[0]?.length ?? 0
  const clues = computeClues(solution)
  return { rows, cols, clues, solution }
}
