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
├── lib/                   # Logique pure, zéro React
│   ├── types.ts
│   ├── clues.ts                # Calcul d'indices + getClueStatuses
│   ├── solver.ts
│   ├── generator.ts            # generatePuzzle (async, Web Worker)
│   ├── generatorWorker.ts      # Worker dédié à la génération
│   ├── image/                  # Traitement d'image (modulaire)
│   │   ├── types.ts            # Point, GridCellsResult, GridStructure, Band
│   │   ├── profiles.ts         # Analyse luminosité, saturation, edges
│   │   ├── canvas.ts           # Manipulation canvas, Otsu, normalisation
│   │   ├── gridDetection.ts    # Détection de grille (dark, extended, bandes, hue)
│   │   ├── gridBounds.ts       # Détection des bornes (dark + edge scan)
│   │   ├── cellExtraction.ts   # Découpe des cases
│   │   ├── ocr.ts              # Reconnaissance OCR Tesseract
│   │   └── index.ts            # Ré-exports publics
│   ├── photoToPuzzle.ts        # Conversion image → grille booléenne
│   ├── photoToPuzzleWorker.ts  # Worker : unicité + ajustement pixels
│   └── preloadOCR.ts           # Préchargement Tesseract offline
├── store/
│   ├── gameStore.ts     # Zustand — état de jeu (puzzle, grid, status, cheated)
│   ├── debugStore.ts    # Zustand — mode diagnostic (Ctrl+D)
│   └── settingsStore.ts # Zustand — paramètres (darkMode, offlineMode)
├── i18n/
│   ├── types.ts         # Locale, TranslationKeys (contrat typé)
│   ├── i18nStore.ts     # Zustand — langue + persistence localStorage
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
- **`npm install` requiert `--legacy-peer-deps`** : `vite-plugin-pwa` n'a pas encore déclaré la compatibilité Vite 8 dans ses peer deps. Le flag est dans le Makefile (`make install`) et dans `.npmrc` (pour Vercel et tout autre CI). Quand `vite-plugin-pwa` publiera une version compatible Vite 8, retirer `.npmrc` et le flag du Makefile.
- **Tesseract.js est lourd** (~15 MB avec les données de langue) : il doit rester en **import dynamique / lazy-load**, jamais importé statiquement.
- **TypeScript strict** : `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` sont activés. Ne pas désactiver ces options.
- **Pas de dépendances inutiles** : préférer les solutions custom légères quand la complexité est faible (ex : i18n custom plutôt que i18next pour ~80 clés).
- **Modules de traitement d'image** : la logique d'image est dans `src/lib/image/` (pas un seul fichier monolithique). Chaque module < 300 lignes. Les imports pointent vers `@/lib/image` (le barrel `index.ts`).

---

## Règles de développement

### Structure
- `src/lib/` contient uniquement de la **logique pure** (fonctions, types, algorithmes) — zéro import React.
- `src/lib/image/` contient le traitement d'image découpé en modules (profils, canvas, détection, extraction, OCR).
- `src/store/` contient uniquement les stores Zustand.
- `src/hooks/` contient uniquement des hooks React.
- `src/i18n/` contient tout le système de traduction (types, store, hook, fichiers de traduction).
- `src/components/` est organisé par domaine fonctionnel (`game/`, `ui/`, `importer/`, `photoToPuzzle/`…), pas par type technique.
- Chaque composant est dans son propre fichier. Pas de fichier `index.ts` barrel sauf pour les modules multi-fichiers (`image/`, `translations/`).
- **Surveiller la taille des fichiers** : au-delà de ~300 lignes, envisager un découpage. Fichiers critiques à surveiller : `ImportPanel.tsx` (~285 lignes), `HomePage.tsx` (~210 lignes).

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
- Les constantes définies au niveau module qui contiennent des labels doivent être recalculées dans le corps du composant pour accéder au hook `useTranslation()`.

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

### Favicon, OG image et SEO
- **`public/favicon.svg`** : grille picross 5×6 fond orange, forme U en blanc.
- Le favicon est aussi affiché dans le header de `HomePage.tsx` via `<img src="/favicon.svg" />`.
- La couleur de fond du favicon (`fill` sur le `<rect>`) doit rester cohérente avec `primary-600`.
- Syntaxe SVG native pour la transparence : `stroke-opacity="0.2"` — ne pas utiliser `rgba()`.
- **OG image** : `public/og-image.png` (1200×630) pour Discord, Twitter, etc. Meta tags dans `index.html`. Après déploiement, remplacer `/og-image.png` par l'URL absolue pour une compatibilité maximale avec les crawlers.

### Style
- **Prettier** est configuré (`.prettierrc`) : single quotes, no semi, trailing comma, printWidth 100.
- Toujours lancer `npm run format` avant de commiter.
- Pas d'emoji dans le code source sauf dans l'UI (labels de boutons).
- Pas de commentaires redondants avec le code. Commenter uniquement ce qui n'est pas évident.

### État global
- L'état de jeu passe **exclusivement** par `useGameStore` (Zustand).
- Les paramètres utilisateur (darkMode, offlineMode) passent par `useSettingsStore` (persisté en localStorage).
- La langue passe par `useI18nStore` (persisté en localStorage).
- Les composants n'utilisent pas `useState` pour l'état de jeu — uniquement pour l'état local UI.
- Les actions du store (`fillCell`, `markCell`, `clearCell`, `reset`…) sont exposées via le hook `useGame`.
- **Attention aux closures** : dans les `setTimeout` ou callbacks asynchrones, lire le state depuis `useXxxStore.getState()` et non depuis la closure du render (la valeur peut être stale).

### Générateur
- `generatePuzzle()` est **asynchrone** et tourne dans un **Web Worker** (`generatorWorker.ts`).
- La boucle génère des grilles aléatoires et appelle `solve()` pour vérifier l'unicité — `solve()` étant synchrone et coûteux sur les grosses grilles (20×20), le Web Worker est indispensable.
- Accepte un `AbortSignal` : l'annulation appelle `worker.terminate()` instantanément.
- HomePage affiche un spinner pendant la génération avec un bouton Annuler.
- **Règle critique** : ne jamais remettre `solve()` ou la boucle de génération sur le thread principal — même avec `setTimeout` ou `await`, un `solve()` synchrone de plusieurs secondes gèle le navigateur et empêche l'UI de réagir.

### Solveur
- L'algorithme : **propagation de contraintes itérative** en premier, **backtracking** en fallback.
- Le solveur est synchrone — utilisé sur le thread principal (bouton "Résoudre") et dans les Web Workers (génération, photo→puzzle).
- Quand utilisé via le bouton, `cheated = true` → victoire affiche "Tricheur !".

### Mode diagnostic
- Activé / désactivé par **Ctrl+D**.
- Chip `debug` en position `fixed` top-right dans `App.tsx`.
- En mode debug, les fonctions de traitement d'image logguent dans la console du navigateur :
  - `[bounds]` : détection des bornes de la grille (stratégie dark, edge scan, positions, consensus).
  - `[grid]` : extraction des cases (isColor, stratégies de détection, dimensions, analyse de bandes).
  - `[expand]` : expansion des coins (luminosité de référence, positions trouvées).

### Import image / OCR

#### Modules de traitement d'image (`src/lib/image/`)
- **`profiles.ts`** : analyse de luminosité (grayscale, darkness, edge, saturation, lightness profiles) + détection N&B/couleur.
- **`canvas.ts`** : manipulation canvas (crop, upscale, Otsu, normalisation, padding, suppression traits).
- **`gridDetection.ts`** : toutes les stratégies de détection de grille :
  - Dark (lignes sombres) — fiable pour N&B.
  - Extended (saturation, edge, light) — fallback pour couleur.
  - Bandes (`detectGridByBands`) — analyse pixel-par-pixel des alternances trait/case, la méthode la plus fiable pour les grilles couleur.
  - Hue scan (`detectGridByHueScan`) — scan par séparateurs de luminosité.
- **`gridBounds.ts`** : détection automatique des bornes de la grille sur l'image complète.
- **`cellExtraction.ts`** : découpe des cases (intérieures + indices) en data URLs.
- **`ocr.ts`** : reconnaissance Tesseract avec timeout (10s) et recréation du worker si bloqué.

#### Distinction N&B / Couleur
- `isColorImage()` mesure la saturation sur la zone croppée. Seuil 0.15, pixels très sombres/clairs ignorés.
- **N&B** : `detectGridStructure` (dark uniquement) avec retry/élargissement +5/10/15px.
- **Couleur** : cascade `detectGridByBands` → `detectGridByHueScan` → `detectGridStructureExtended` → fallback dark.
- **Règle critique** : ne jamais utiliser edge/light/bandes sur des images N&B — faux positifs sur les rangées de cases remplies.

#### Détection par analyse de bandes (grilles couleur)
- `scanBands()` parcourt une ligne pixel par pixel et produit une séquence de bandes (largeur + luminosité) : ex: `4 28 4 28 4 28...` = traits 4px + cases 28px.
- `detectGridByBands()` scanne 3 lignes parallèles par axe, identifie les bandes "case" (larges) vs "trait" (fins), et retourne les positions exactes.
- `extractGridCells` utilise ces positions pour un découpage pixel-perfect — chaque case est découpée entre ses deux lignes de grille réelles, pas par division uniforme.
- **En mode debug** : `debugBandAnalysis` affiche la séquence de largeurs de bandes en console.

#### Détection automatique des bornes (`detectGridBounds`)
- Stratégie 1 : `detectGridStructureDark` (lignes sombres, fiable pour N&B).
- Stratégie 2 : `detectGridBoundsByEdgeScan` — scanne depuis les 4 bords de l'image vers l'intérieur sur 10 lignes parallèles. Groupe les positions de premier contraste par proximité (±10px). Pour `left`/`top` (direction indices), prend le groupe **le plus éloigné du bord** avec ≥2 membres (la grille est plus loin que le texte). Pour `right`/`bottom`, prend le groupe le plus éloigné du bord opposé.
- **Problème connu** : le bord gauche et le haut sont souvent mal détectés car les indices (chiffres) créent des contrastes avant la grille. Le cadrage automatique est approximatif — l'utilisateur peut ajuster manuellement.

#### Expansion des coins (`expandCornersToGridEdges`)
- Depuis deux points cliqués à l'intérieur de cases, cherche les bords de la grille.
- `findFirstEdge` (haut, gauche — direction indices) : s'arrête au premier trait fin (≤5px). Les chiffres collés aux traits font >5px → pas de dépassement.
- `findLastEdge` (bas, droite — bord extérieur) : traverse tous les traits fins (≤15px) → s'arrête au dernier.
- Luminosité de référence = moyenne 5×5 autour du point cliqué.
- **Problème connu** : si la luminosité des cases est trop proche de celle de la zone d'indices (toutes quasi blanches), l'expansion peut déborder. Le cadrage par bandes corrige ensuite.

#### OCR
- Tesseract.js importé dynamiquement (`await import('tesseract.js')`).
- **Timeout 10s par case** : si Tesseract bloque, le worker est **terminé et recréé** (pas juste un `Promise.race` — le worker bloqué empêcherait les appels suivants).
- Pipeline par case : normalisation → suppression traits → rognage contenu → upscale → OCR.
- `repairClueString` : sépare les chiffres collés (ex: "11" → "1 1" si max=5).

#### Validation post-OCR
- En mode debug : `ClueValidator` (case par case) → si non solvable → `GridCorrector`.
- En mode normal : si solvable → jeu direct, sinon → `GridCorrector`.
- `handleValidationComplete` vérifie la solvabilité avant de charger le puzzle. Si `solve()` retourne null → redirige vers `GridCorrector`.

### Photo vers puzzle
- Flux séparé de l'import OCR, avec `PhotoToPuzzlePanel` et `photoToPuzzle.ts`.
- Pipeline : choix source (image/caméra) → choix taille (5-20) → crop carré → resize NxN → Otsu → preview → unicité (Web Worker) → jeu.
- `processPhotoToPuzzle()` lance un worker qui ajuste les pixels pour l'unicité (50 tentatives max).
- `PixelPreview` : prévisualisation de la grille en noir/blanc.

### Mode hors-ligne
- PWA (`vite-plugin-pwa`) : assets pré-cachés par le Service Worker.
- Le jeu fonctionne offline nativement.
- L'import OCR nécessite un préchargement (~15 MB) → option "Mode hors-ligne" dans Options.
- `preloadOCR()` : crée un worker Tesseract (provoque le téléchargement), puis le ferme. Cache en IndexedDB.
- Au démarrage : si `offlineMode` activé et cache vide, précharge silencieusement.

### Détection de victoire
- `checkWin` compare case par case contre `puzzle.solution`.
- Cases vides : `'unknown'` ou `'marked'` acceptés — seul `'filled'` interdit.
- Vérifiée à chaque `fillCell` et `applyGrid`.
- Animation : confettis + "Bravo !" ou "Tricheur !".

### Tests
- **Toute logique dans `src/lib/`** doit avoir des tests unitaires dans `tests/unit/`.
- **Tout composant non trivial** doit avoir des tests dans `tests/component/`.
- **Ne pas mocker la logique métier** dans les tests de composants.
- **Tests i18n** : vérifient clés identiques dans toutes les langues + aucune valeur vide.
- **Web Workers** : jsdom ne les supporte pas → mocker avec `vi.stubGlobal('Worker', MockWorker)`.
- Les stores Zustand sont testables via `getState()` / `setState()` — reset dans `beforeEach`.

---

## Workflow obligatoire après chaque modification

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
