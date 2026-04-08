# Universal Picross — Agent File

## Description du projet

Application web de **picross / nonogramme** entièrement front-end, sans backend.
L'utilisateur peut générer des puzzles, jouer manuellement, importer un puzzle depuis une image ou une photo, et demander une résolution automatique.

L'application fonctionne sur mobile et desktop, et peut être installée comme une PWA.

---

## Stack technique

| Outil | Usage |
|---|---|
| React 19 + TypeScript | UI |
| Vite 8 | Build / dev server |
| Tailwind CSS v4 | Styles (via `@tailwindcss/vite`) |
| Zustand | État global |
| Vitest + Testing Library | Tests unitaires et composants |
| Playwright | Tests e2e |
| Prettier | Formatage |
| ESLint (typescript-eslint) | Linting |
| vite-plugin-pwa | Service Worker + manifest |
| Tesseract.js | OCR (lazy-load) |

---

## Architecture

```
src/
├── lib/           # Logique pure, zéro React
│   ├── types.ts
│   ├── clues.ts
│   ├── solver.ts
│   ├── generator.ts
│   └── imageProcessor.ts
├── store/
│   ├── gameStore.ts     # Zustand — état de jeu
│   └── debugStore.ts    # Zustand — mode diagnostic (Ctrl+D)
├── hooks/
│   ├── useGame.ts
│   ├── useTimer.ts
│   └── useCamera.ts
├── components/
│   ├── ui/              # Button, Modal, Spinner
│   ├── game/            # Cell, ClueCell, ClueList, GameGrid, GameBoard
│   ├── generator/       # GeneratorPanel
│   ├── solver/          # SolverPanel
│   └── importer/        # ImageUploader, CameraCapture, CornerSelector, GridMosaic,
│                        # GridCorrector, ClueValidator, ImportPanel
└── pages/
    ├── HomePage.tsx
    └── GamePage.tsx
tests/
├── unit/          # Vitest — logique pure
├── component/     # Vitest + Testing Library
└── e2e/           # Playwright
```

---

## Contraintes techniques

- **100% front-end** : aucun appel à un serveur externe, pas de backend, pas d'API distante.
- **Pas de SSR** : Vite SPA uniquement. Ne pas introduire Next.js ou Remix.
- **Alias `@/`** pointe vers `src/`. Toujours utiliser cet alias pour les imports internes, jamais de chemins relatifs `../../`.
- **Tailwind v4** : utiliser `@import 'tailwindcss'` dans le CSS, pas de fichier `tailwind.config.js`. Les classes utilitaires sont la norme — pas de CSS custom sauf dans `index.css` et `theme.css`.
- **`npm install` requiert `--legacy-peer-deps`** : `vite-plugin-pwa` n'a pas encore déclaré la compatibilité Vite 8 dans ses peer deps. Le flag est déjà dans le Makefile (`make install`).
- **Tesseract.js est lourd** (~8 MB) : il doit rester en **import dynamique / lazy-load**, jamais importé statiquement.
- **TypeScript strict** : `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` sont activés. Ne pas désactiver ces options.

---

## Règles de développement

### Structure
- `src/lib/` contient uniquement de la **logique pure** (fonctions, types, algorithmes) — zéro import React.
- `src/store/` contient uniquement les stores Zustand.
- `src/hooks/` contient uniquement des hooks React.
- `src/components/` est organisé par domaine fonctionnel (`game/`, `ui/`, `importer/`…), pas par type technique.
- Chaque composant est dans son propre fichier. Pas de fichier `index.ts` barrel sauf si explicitement demandé.

### Composants
- Composants simples, unitaires, avec une seule responsabilité.
- Les props sont typées via des interfaces locales (pas de `React.FC<>`).
- Les interactions mobile (long-press → marquer une case) sont gérées dans `Cell.tsx` via `onTouchStart/End`.
- Le calcul de `cellSize` s'adapte à la taille de la grille pour tenir sur mobile.

### Tests
- **Toute logique dans `src/lib/`** doit avoir des tests unitaires dans `tests/unit/`.
- **Tout composant non trivial** doit avoir des tests dans `tests/component/`.
- **Ne pas mocker la logique métier** dans les tests de composants — utiliser les vraies fonctions `lib/`.
- Les tests e2e Playwright couvrent les parcours utilisateur complets (générer → jouer → résoudre).
- Lancer `npm run test` avant chaque commit pour s'assurer que les 49 tests passent.
- Les stores Zustand sont testables directement via `useGameStore.getState()` / `useGameStore.setState()` — reset manuel dans `beforeEach`.

### Thème et couleurs
- Le thème est centralisé dans **`src/theme.css`** via la directive `@theme` de Tailwind v4.
- Toutes les couleurs UI utilisent le token **`primary-*`** (50 → 900) — jamais de couleur Tailwind en dur (`indigo-*`, `orange-*`, etc.) dans les composants.
- Pour changer la palette de couleurs, modifier uniquement `src/theme.css`.
- Fond de page : `--color-surface` défini dans `theme.css`, appliqué sur `body` dans `index.css`.
- Couleur actuelle : orange chaud (`primary-500` = `#f97316`, `primary-600` = `#ea580c`).

### Favicon et icône
- **`public/favicon.svg`** : grille picross 5×6 fond orange, forme U en blanc.
- Le favicon est aussi affiché dans le header de `HomePage.tsx` via `<img src="/favicon.svg" />`.
- La couleur de fond du favicon (`fill` sur le `<rect>`) doit rester cohérente avec `primary-600`.
- Syntaxe SVG native pour la transparence : `stroke-opacity="0.2"` — ne pas utiliser `rgba()` (non supporté par le linter SVG VSCode).

### Style
- **Prettier** est configuré (`.prettierrc`) : single quotes, no semi, trailing comma, printWidth 100.
- Toujours lancer `npm run format` avant de commiter.
- Pas d'emoji dans le code source sauf dans l'UI (labels de boutons).
- Pas de commentaires redondants avec le code. Commenter uniquement ce qui n'est pas évident.

### État global
- L'état de jeu passe **exclusivement** par `useGameStore` (Zustand).
- Les composants n'utilisent pas `useState` pour l'état de jeu — uniquement pour l'état local UI (ex: drag-over, tab actif).
- Les actions du store (`fillCell`, `markCell`, `reset`…) sont exposées via le hook `useGame`.

### Solveur
- L'algorithme : **propagation de contraintes itérative** en premier, **backtracking** en fallback.
- Le solveur tourne de façon synchrone dans un `setTimeout(..., 0)` pour ne pas bloquer le thread UI.
- Ne pas utiliser de Web Worker pour le solveur sauf si des puzzles >20×20 posent des problèmes de performance mesurables.

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

### Détection de victoire
- `checkWin` dans `gameStore.ts` compare case par case contre `puzzle.solution`.
- Une case qui _doit_ être vide peut rester `'unknown'` ou `'marked'` — seul `'filled'` est interdit.
- La victoire est vérifiée à chaque `fillCell` et `applyGrid`.

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
