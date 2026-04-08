# Universal Picross — Agent File

## Description du projet

Application web de **picross / nonogramme** entièrement front-end, sans backend.
L'utilisateur peut générer des puzzles, jouer manuellement, importer un puzzle depuis une image ou une photo, transformer n'importe quelle photo en puzzle jouable, et demander une résolution automatique.

L'application fonctionne sur mobile et desktop, peut être installée comme une PWA, supporte le mode hors-ligne et le dark mode.

---

## Stack technique

| Outil | Usage |
|---|---|
| React 19 + TypeScript | UI |
| Vite 8 | Build / dev server |
| Tailwind CSS v4 | Styles (via `@tailwindcss/vite`) |
| Zustand | État global (jeu, debug, paramètres, i18n) |
| Vitest + Testing Library | Tests unitaires et composants |
| Playwright | Tests e2e |
| Prettier | Formatage |
| ESLint (typescript-eslint) | Linting |
| vite-plugin-pwa | Service Worker + manifest |
| Tesseract.js | OCR (lazy-load, ~15 MB) |

---

## Architecture

```
src/
├── lib/               # Logique pure, zéro React
│   ├── types.ts
│   ├── clues.ts            # Calcul d'indices + getClueStatuses (completed/impossible)
│   ├── solver.ts
│   ├── generator.ts        # generatePuzzle (async, Web Worker)
│   ├── generatorWorker.ts  # Worker dédié à la génération de puzzles
│   ├── imageProcessor.ts
│   ├── photoToPuzzle.ts       # Conversion image → grille booléenne + worker wrapper
│   ├── photoToPuzzleWorker.ts # Worker : vérification unicité + ajustement pixels
│   └── preloadOCR.ts       # Préchargement Tesseract pour mode offline
├── store/
│   ├── gameStore.ts     # Zustand — état de jeu (puzzle, grid, status, cheated)
│   ├── debugStore.ts    # Zustand — mode diagnostic (Ctrl+D)
│   └── settingsStore.ts # Zustand — paramètres utilisateur (darkMode, offlineMode)
├── i18n/
│   ├── types.ts         # Locale, TranslationKeys (contrat typé)
│   ├── i18nStore.ts     # Zustand — langue courante + persistence localStorage
│   ├── useTranslation.ts
│   └── translations/    # fr.ts, en.ts, de.ts, it.ts, es.ts, index.ts
├── hooks/
│   ├── useGame.ts
│   ├── useTimer.ts
│   └── useCamera.ts
├── components/
│   ├── ui/              # Button, Spinner
│   ├── game/            # Cell, ClueCell, ClueList, GameGrid, GameBoard,
│   │                    # InputModeToggle, VictoryOverlay
│   ├── solver/          # SolverPanel
│   ├── importer/        # ImageUploader, CameraCapture, CornerSelector, GridMosaic,
│   │                    # GridCorrector, ClueValidator, ImportPanel
│   └── photoToPuzzle/   # PhotoToPuzzlePanel, PixelPreview
└── pages/
    ├── HomePage.tsx     # 4 actions : image, photo, photo→puzzle, génération
    ├── GamePage.tsx     # Import/photo→puzzle + jeu, breadcrumb retour
    └── OptionsPage.tsx  # Langue, dark mode, mode offline
tests/
├── unit/          # Vitest — logique pure + i18n
├── component/     # Vitest + Testing Library
└── e2e/           # Playwright
```

---

## Navigation

L'application utilise une **navigation par état** (pas de router), gérée dans `App.tsx` :
- `page: 'home' | 'game' | 'options'`
- `importMode: 'image' | 'camera' | 'photo' | undefined` pour distinguer import OCR, photo→puzzle, et génération.
- Les callbacks `onImport`, `onGenerated`, `onBack`, `onOptions` relient les pages.
- **Important** : quand on navigue vers le jeu en mode import, le store de jeu est reset (`status: 'idle'`) pour éviter que l'ImportPanel soit court-circuité par un puzzle précédent encore en mémoire.
- GamePage utilise un état local `importDone` pour savoir quand passer du panel d'import au jeu.
- GamePage route vers `ImportPanel` (modes `image`/`camera`) ou `PhotoToPuzzlePanel` (mode `photo`).

---

## Contraintes techniques

- **100% front-end** : aucun appel à un serveur externe, pas de backend, pas d'API distante.
- **Pas de SSR** : Vite SPA uniquement. Ne pas introduire Next.js ou Remix.
- **Alias `@/`** pointe vers `src/`. Toujours utiliser cet alias pour les imports internes, jamais de chemins relatifs `../../`.
- **Tailwind v4** : utiliser `@import 'tailwindcss'` dans le CSS, pas de fichier `tailwind.config.js`. Les classes utilitaires sont la norme — pas de CSS custom sauf dans `index.css` et `theme.css`.
- **`npm install` requiert `--legacy-peer-deps`** : `vite-plugin-pwa` n'a pas encore déclaré la compatibilité Vite 8 dans ses peer deps. Le flag est déjà dans le Makefile (`make install`).
- **Tesseract.js est lourd** (~15 MB avec les données de langue) : il doit rester en **import dynamique / lazy-load**, jamais importé statiquement.
- **TypeScript strict** : `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` sont activés. Ne pas désactiver ces options.
- **Pas de dépendances inutiles** : préférer les solutions custom légères quand la complexité est faible (ex : i18n custom plutôt que i18next pour ~80 clés).

---

## Règles de développement

### Structure
- `src/lib/` contient uniquement de la **logique pure** (fonctions, types, algorithmes) — zéro import React.
- `src/store/` contient uniquement les stores Zustand.
- `src/hooks/` contient uniquement des hooks React.
- `src/i18n/` contient tout le système de traduction (types, store, hook, fichiers de traduction).
- `src/components/` est organisé par domaine fonctionnel (`game/`, `ui/`, `importer/`, `photoToPuzzle/`…), pas par type technique.
- Chaque composant est dans son propre fichier. Pas de fichier `index.ts` barrel sauf si explicitement demandé.

### Composants
- Composants simples, unitaires, avec une seule responsabilité.
- Les props sont typées via des interfaces locales (pas de `React.FC<>`).
- Les interactions utilisateur dans `GameGrid.tsx` :
  - **Clic gauche** : fill/unfill selon le `inputMode` (fill, mark, erase).
  - **Clic droit** : toujours mark/unmark, avec support du drag (glisser).
  - **Long-press** (mobile, 400ms) : bascule mark en mode fill uniquement.
  - **Drag** : fonctionne pour les 3 modes (fill, mark, erase) + clic droit.
- Le calcul de `cellSize` s'adapte à la taille de la grille et de l'écran :
  - **Desktop** (>= 640px) : taille fixe de 32px.
  - **Mobile** (< 640px) : calculé pour que `(maxRowClueCount + cols) * cellSize` tienne dans la largeur de l'écran, min 12px. Ne pas appliquer de contrainte de largeur sur desktop (régression constatée).
- Les **séparateurs épais** (toutes les 5 cases) ne s'affichent que si la grille est un multiple de 5 dans les deux dimensions.

### Indices visuels (ClueStatuses)
- `getClueStatuses(clue, cells)` dans `clues.ts` retourne un statut par indice :
  - `completed` (grisé) : un groupe de cases remplies consécutives a la bonne taille, sans exiger de croix autour.
  - `impossible` (rouge) : espace insuffisant, groupe trop grand, ou indice ne rentre dans aucun segment.
- Les statuts sont calculés dans `GameBoard` et propagés via `ClueList` → `ClueCell`.

### Internationalisation (i18n)
- **Solution custom sans dépendance** : Zustand store + fichiers de traduction typés.
- 5 langues : français (défaut), anglais, allemand, italien, espagnol.
- ~90 clés organisées par namespace (`home`, `game`, `solver`, `import`, `corner`, `photoToPuzzle`, etc.).
- `TranslationKeys` dans `i18n/types.ts` est le contrat — TypeScript garantit la structure de chaque fichier de traduction, et les tests unitaires vérifient l'absence de valeurs vides.
- `useTranslation()` retourne l'objet typé `t` — autocomplétion complète, pas de clés string.
- Interpolation simple par `.replace('{var}', value)` au site d'appel.
- La langue est persistée en `localStorage` (clé `picross-locale`).
- **Toutes les strings UI passent par `t.xxx.yyy`** — pas de texte en dur dans les composants.
- Les constantes définies au niveau module (ex : `MODES` dans `InputModeToggle`) qui contiennent des labels doivent être recalculées dans le corps du composant pour accéder au hook `useTranslation()`.

### Thème, couleurs et dark mode
- Le thème est centralisé dans **`src/theme.css`** via la directive `@theme` de Tailwind v4.
- **Dark mode** : implémenté via des **CSS custom properties sémantiques** définies dans `:root` (light) et `.dark` (dark) dans `theme.css`. La classe `.dark` est appliquée sur `<html>` par `settingsStore`.
- **Règle critique** : ne jamais utiliser de couleurs Tailwind en dur dans les composants (`bg-white`, `text-gray-700`, `bg-gray-100`, etc.). Toujours utiliser les **tokens sémantiques** :
  - Surfaces : `bg-surface`, `bg-surface-card`, `bg-surface-secondary`, `bg-surface-tertiary`, `bg-surface-inverse`
  - Texte : `text-txt`, `text-txt-secondary`, `text-txt-tertiary`, `text-txt-muted`, `text-txt-disabled`, `text-txt-inverse`
  - Bordures : `border-brd`, `border-brd-strong`, `border-brd-heavy`
  - Jeu : `bg-cell-filled`, `bg-cell-empty`
  - Statuts : `text-status-success`, `text-status-error`, `text-warn-text`, `bg-warn-bg`, `border-warn-border`, `bg-error-cell`
  - UI : `bg-toggle-off`
- Les couleurs `primary-*` (orange) restent des tokens Tailwind classiques (pas de remapping dark).
- Le dark mode est persisté en `localStorage` (clé `picross-settings`), toggle dans la page Options.

### Favicon et icône
- **`public/favicon.svg`** : grille picross 5×6 fond orange, forme U en blanc.
- Le favicon est aussi affiché dans le header de `HomePage.tsx` via `<img src="/favicon.svg" />`.
- La couleur de fond du favicon (`fill` sur le `<rect>`) doit rester cohérente avec `primary-600`.
- Syntaxe SVG native pour la transparence : `stroke-opacity="0.2"` — ne pas utiliser `rgba()` (non supporté par le linter SVG VSCode).
- **OG image** : `public/og-image.png` (1200×630) pour Discord, Twitter, etc. Meta tags dans `index.html`.

### Style
- **Prettier** est configuré (`.prettierrc`) : single quotes, no semi, trailing comma, printWidth 100.
- Toujours lancer `npm run format` avant de commiter.
- Pas d'emoji dans le code source sauf dans l'UI (labels de boutons).
- Pas de commentaires redondants avec le code. Commenter uniquement ce qui n'est pas évident.

### État global
- L'état de jeu passe **exclusivement** par `useGameStore` (Zustand).
- Les paramètres utilisateur (darkMode, offlineMode) passent par `useSettingsStore` (persisté en localStorage).
- La langue passe par `useI18nStore` (persisté en localStorage).
- Les composants n'utilisent pas `useState` pour l'état de jeu — uniquement pour l'état local UI (ex: drag-over, phase d'import).
- Les actions du store (`fillCell`, `markCell`, `clearCell`, `reset`…) sont exposées via le hook `useGame`.

### Générateur
- `generatePuzzle()` est **asynchrone** et tourne dans un **Web Worker** (`generatorWorker.ts`).
- La boucle génère des grilles aléatoires et appelle `solve()` pour vérifier l'unicité de la solution — `solve()` étant synchrone et coûteux sur les grosses grilles (20×20), le Web Worker est indispensable pour ne pas geler le thread UI.
- Accepte un `AbortSignal` : l'annulation appelle `worker.terminate()` qui tue le calcul instantanément.
- HomePage affiche un spinner pendant la génération avec un bouton Annuler.
- **Règle critique** : ne jamais remettre `solve()` ou la boucle de génération sur le thread principal — même avec `setTimeout` ou `await`, un `solve()` synchrone de plusieurs secondes gèle le navigateur et empêche l'UI de réagir (le clic Annuler n'est jamais traité).

### Solveur
- L'algorithme : **propagation de contraintes itérative** en premier, **backtracking** en fallback.
- Le solveur tourne de façon synchrone — utilisé directement dans le thread principal pour la résolution à la demande (bouton "Résoudre") et dans les Web Workers pour la génération et la conversion photo→puzzle.
- Quand le solveur est utilisé via le bouton, `cheated` est mis à `true` dans le store → l'animation de victoire affiche "Tricheur !" au lieu de "Bravo !".

### Mode diagnostic
- Activé / désactivé par **Ctrl+D** depuis n'importe où dans l'application.
- État global dans `src/store/debugStore.ts` (Zustand).
- Quand actif : chip `debug` affiché en position `fixed` top-right dans `App.tsx`.
- Listener Ctrl+D enregistré une seule fois dans `App.tsx` via `useEffect`.

### Import image / OCR
- **Détection de grille 100% Canvas 2D** : profils de noirceur (projections ligne/colonne), détection de lignes régulières. Aucune dépendance externe (pas d'OpenCV).
- Tesseract.js est importé dynamiquement (`await import('tesseract.js')`).
- **Détection automatique des bords** : à l'upload, `detectGridBounds()` analyse l'image complète et pré-positionne les coins dans `CornerSelector` via la prop `initialCorners`. L'utilisateur n'a qu'à ajuster et valider.
- **Retry avec élargissement** : si `extractGridCells` échoue avec la sélection exacte, il retente automatiquement en élargissant la zone de +5px, +10px, +15px de chaque côté. Cela compense un cadrage serré qui coupe les lignes extérieures. Toujours utiliser des **marges en pixels absolus** (pas en pourcentage) car les traits de grille ont une épaisseur fixe (1-3px).
- **Flux normal** (mode diagnostic désactivé) :
  1. Upload → détection auto des bords → sélection des coins (pré-positionnés si détectés) → extraction → OCR avec barre de progression
  2. Si le solveur trouve une solution → chargement direct du jeu
  3. Si la grille est invalide → `GridCorrector` (toutes les cases simultanément, images + inputs)
- **Flux diagnostic** (mode diagnostic activé) :
  1. Sélection → mosaïque (`GridMosaic`) → OCR → `ClueValidator` (case par case)
  2. `ClueValidator` affiche un avertissement si la grille n'est pas soluble
- **Règle critique** : après injection des indices dans un puzzle importé, toujours appeler `solve(puzzle)` pour obtenir la vraie solution et l'affecter à `puzzle.solution`. Sans ça, `checkWin` compare contre une grille vide et la victoire n'est jamais détectée.
- Le pipeline OCR est agnostique à la couleur : conversion en niveaux de gris (luminance) + seuillage Otsu adaptatif + inversion automatique fond clair/sombre. Fonctionne pour les picross colorés tant que le contraste est suffisant.

### Photo vers puzzle
- Flux séparé de l'import OCR, avec son propre composant `PhotoToPuzzlePanel` et sa logique dans `photoToPuzzle.ts`.
- Pipeline : upload image → choix taille (5-20) → crop carré centré → resize NxN → niveaux de gris → seuil Otsu → grille booléenne → preview → vérification unicité (Web Worker) → jeu.
- `imageToSolutionGrid()` : conversion image → `SolutionGrid`, tourne sur le thread principal (rapide pour ≤20×20).
- `processPhotoToPuzzle()` : lance `photoToPuzzleWorker.ts` qui vérifie l'unicité via `solve()` et ajuste les pixels divergents (jusqu'à 50 tentatives). Accepte `AbortSignal`.
- Si la solution n'est pas unique après ajustement → avertissement + "Jouer quand même".
- Vérification de densité (< 10% ou > 90%) → erreur avant conversion.
- `PixelPreview` : composant de prévisualisation de la grille en noir/blanc.

### Mode hors-ligne
- L'application est une **PWA** (`vite-plugin-pwa`) : tous les assets du build sont pré-cachés par le Service Worker.
- **Le jeu fonctionne offline** nativement (génération, résolution, interface).
- **L'import OCR nécessite un préchargement** : Tesseract.js télécharge ~15 MB de données (WASM + langue) depuis un CDN, stockées en IndexedDB par le navigateur.
- Option **"Mode hors-ligne"** dans la page Options : toggle qui active le préchargement.
- `preloadOCR()` dans `lib/preloadOCR.ts` : crée un worker Tesseract (provoque le téléchargement), puis le ferme. Le cache IndexedDB persiste.
- `isOCRCached()` : vérifie la présence des données en IndexedDB via `idb-keyval`.
- Au **démarrage** (`App.tsx`) : si `offlineMode` est activé et que le cache est vide, précharge silencieusement en arrière-plan.
- Paramètre persisté en `localStorage` (clé `picross-settings`).

### Détection de victoire
- `checkWin` dans `gameStore.ts` compare case par case contre `puzzle.solution`.
- Une case qui _doit_ être vide peut rester `'unknown'` ou `'marked'` — seul `'filled'` est interdit.
- La victoire est vérifiée à chaque `fillCell` et `applyGrid`.
- Animation de victoire (`VictoryOverlay`) : confettis + texte "Bravo !" ou "Tricheur !" selon le flag `cheated`.

### Tests
- **Toute logique dans `src/lib/`** doit avoir des tests unitaires dans `tests/unit/`.
- **Tout composant non trivial** doit avoir des tests dans `tests/component/`.
- **Ne pas mocker la logique métier** dans les tests de composants — utiliser les vraies fonctions `lib/`.
- Les tests e2e Playwright couvrent les parcours utilisateur complets (générer → jouer → résoudre).
- Les stores Zustand sont testables directement via `useGameStore.getState()` / `useGameStore.setState()` — reset manuel dans `beforeEach`.
- **Tests i18n** (`tests/unit/i18n.test.ts`) : vérifient que chaque langue a exactement les mêmes clés que la référence (fr) et qu'aucune valeur n'est vide.
- **Web Workers en tests** : jsdom ne supporte pas les Web Workers. `generatePuzzle` utilise un worker, donc les tests mockent `Worker` avec `vi.stubGlobal('Worker', MockWorker)`. Le mock simule le worker de manière synchrone.

---

## Workflow obligatoire après chaque modification

Après chaque session de travail (ajout de fonctionnalité, correction de bug, refactoring), toujours exécuter dans cet ordre :

```bash
make format-check   # Vérifie le formatage Prettier
make typecheck      # Vérifie les types TypeScript
```

Si l'un des deux échoue, corriger avant de considérer le travail terminé.

---

## Commandes utiles

Préférer le Makefile aux commandes `npm run` directement :

```bash
make install        # npm install --legacy-peer-deps + playwright install
make start          # Serveur de développement (http://localhost:5173)
make build          # Build de production
make test-unit      # Tests unitaires et composants (Vitest)
make test-e2e       # Tests e2e Playwright
make test           # Tous les tests
make format         # Formatage Prettier
make format-check   # Vérification formatage (sans écrire)
make typecheck      # Vérification TypeScript
make lint           # ESLint
make fix            # format + lint
make check          # build + lint + typecheck + test-unit
make clean          # Supprime dist/ et node_modules/
```
