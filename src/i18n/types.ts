export type Locale = 'fr' | 'en' | 'it' | 'de' | 'es'

export const LOCALES: Locale[] = ['fr', 'en', 'it', 'de', 'es']

export interface TranslationKeys {
  common: {
    back: string
    cancel: string
    restart: string
  }

  home: {
    subtitle: string
    openImage: string
    openImageDesc: string
    takePhoto: string
    takePhotoDesc: string
    generate: string
    generateDesc: string
    sizeLabel: string
    difficulty: string
    easy: string
    medium: string
    hard: string
    generateButton: string
    generating: string
  }

  game: {
    bravo: string
    cheater: string
  }

  inputMode: {
    fill: string
    mark: string
    erase: string
  }

  solver: {
    title: string
    solveButton: string
    solving: string
    error: string
  }

  import: {
    phaseUploadImage: string
    phaseUploadCamera: string
    phaseSelecting: string
    phaseMosaic: string
    phaseRecognizing: string
    phaseValidating: string
    phaseCorrecting: string
    recognizingProgress: string
    extracting: string
    errorGridDetect: string
    errorCutting: string
  }

  corner: {
    instruction1: string
    instruction2: string
    instructionAuto: string
    instructionManual: string
    validateSelection: string
  }

  uploader: {
    dropOrClick: string
    clickToChoose: string
    acceptedFormats: string
    processing: string
  }

  camera: {
    capture: string
    photoTaken: string
    takePhotoButton: string
  }

  mosaic: {
    detected: string
    legend: string
    continueOCR: string
    recrop: string
  }

  corrector: {
    noSolution: string
    columns: string
    rows: string
    stillNoSolution: string
    backButton: string
    validateAndPlay: string
  }

  validator: {
    noSolutionWarning: string
    column: string
    row: string
    xOfY: string
    previous: string
    finish: string
    validateNext: string
  }

  options: {
    title: string
    language: string
    offlineMode: string
    offlineDesc: string
    offlineDownloading: string
    offlineReady: string
  }

  languages: {
    fr: string
    en: string
    it: string
    de: string
    es: string
  }
}
