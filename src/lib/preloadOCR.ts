/**
 * Précharge Tesseract.js (worker WASM + données de langue anglaise) pour le mode offline.
 * Tesseract stocke automatiquement les données en IndexedDB après le premier téléchargement.
 * On crée un worker puis on le ferme immédiatement — l'important est le cache.
 */
export async function preloadOCR(onProgress?: (progress: number) => void): Promise<void> {
  const { createWorker } = await import('tesseract.js')

  const worker = await createWorker('eng', 1, {
    logger: (info: { status: string; progress: number }) => {
      if (
        info.status === 'loading tesseract core' ||
        info.status === 'loading language traineddata'
      ) {
        onProgress?.(info.progress)
      }
    },
  })

  await worker.terminate()
  onProgress?.(1)
}

/**
 * Vérifie si les données Tesseract sont déjà en cache IndexedDB.
 * Tesseract.js utilise idb-keyval sous le capot avec la clé './eng.traineddata'.
 */
export async function isOCRCached(): Promise<boolean> {
  try {
    const { get } = await import('idb-keyval')
    const cached = await get('./eng.traineddata')
    return cached != null
  } catch {
    return false
  }
}
