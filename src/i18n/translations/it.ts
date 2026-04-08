import type { TranslationKeys } from '../types'

export const it: TranslationKeys = {
  common: {
    back: 'Home',
    cancel: 'Annulla',
    restart: 'Ricomincia',
  },
  home: {
    subtitle: 'Genera, gioca e risolvi nonogrammi',
    openImage: "Apri un'immagine",
    openImageDesc: 'Importa un picross da un file',
    takePhoto: 'Scatta una foto',
    takePhotoDesc: 'Scansiona un picross con la fotocamera',
    generate: 'Genera un picross',
    generateDesc: 'Crea un puzzle casuale',
    sizeLabel: 'Dimensione',
    difficulty: 'Difficoltà',
    easy: 'Facile',
    medium: 'Medio',
    hard: 'Difficile',
    generateButton: 'Genera',
    generating: 'Generazione in corso…',
  },
  game: {
    bravo: 'Bravo!',
    cheater: 'Imbroglione!',
  },
  inputMode: {
    fill: 'Riempi',
    mark: 'Segna',
    erase: 'Cancella',
  },
  solver: {
    title: 'Risolutore automatico',
    solveButton: 'Risolvi',
    solving: 'Risoluzione…',
    error: 'Impossibile risolvere questo puzzle.',
  },
  import: {
    phaseUploadImage: "Carica un'immagine",
    phaseUploadCamera: 'Scatta una foto',
    phaseSelecting: 'Selezione della griglia',
    phaseMosaic: 'Verifica del taglio',
    phaseRecognizing: 'Riconoscimento delle cifre',
    phaseValidating: 'Validazione degli indizi',
    phaseCorrecting: 'Correzione degli indizi',
    recognizingProgress: 'Riconoscimento delle cifre…',
    extracting: 'Taglio della griglia in celle…',
    errorGridDetect:
      "Impossibile rilevare le linee della griglia. Prova a selezionare l'area con più precisione.",
    errorCutting: 'Errore durante il taglio.',
  },
  corner: {
    instruction1: 'Clicca sul primo angolo della griglia (es. in alto a sinistra).',
    instruction2: "Clicca sull'angolo opposto (es. in basso a destra).",
    instructionAuto: 'Griglia rilevata automaticamente. Regola se necessario, poi conferma.',
    instructionManual: 'Trascina i punti per regolare, poi conferma.',
    validateSelection: 'Conferma selezione',
  },
  uploader: {
    dropOrClick: "Trascina un'immagine qui o",
    clickToChoose: 'clicca per scegliere',
    acceptedFormats: 'PNG, JPG, WebP accettati',
    processing: "Elaborazione dell'immagine…",
  },
  camera: {
    capture: 'Cattura',
    photoTaken: 'Foto scattata',
    takePhotoButton: 'Scatta una foto',
  },
  mosaic: {
    detected:
      'Griglia rilevata: {rows} × {cols}. Verifica che ogni cella sia tagliata correttamente.',
    legend: 'Celle arancioni = indizi (fuori griglia). Celle grigie = interno della griglia.',
    continueOCR: 'Continua → Riconoscimento cifre',
    recrop: 'Ritaglia',
  },
  corrector: {
    noSolution:
      'Nessuna soluzione trovata con gli indizi riconosciuti. Correggi i valori errati e conferma.',
    columns: 'Colonne',
    rows: 'Righe',
    stillNoSolution: 'La griglia non ha ancora soluzione. Controlla di nuovo gli indizi.',
    backButton: '← Indietro',
    validateAndPlay: 'Conferma e gioca',
  },
  validator: {
    noSolutionWarning:
      'Nessuna soluzione trovata con questi indizi — il riconoscimento ha probabilmente sbagliato su una o più cifre. Verifica e correggi.',
    column: 'Colonna {n}',
    row: 'Riga {n}',
    xOfY: '{current} di {total}',
    previous: '← Precedente',
    finish: 'Fine ✓',
    validateNext: 'Conferma →',
  },
  options: {
    title: 'Opzioni',
    language: 'Lingua',
    offlineMode: 'Modalità offline',
    offlineDesc: 'Precarica i dati OCR (~15 MB) per importare immagini senza connessione internet.',
    offlineDownloading: 'Download in corso…',
    offlineReady: 'Dati OCR in cache',
  },
  languages: {
    fr: 'Français',
    en: 'English',
    it: 'Italiano',
    de: 'Deutsch',
    es: 'Español',
  },
}
