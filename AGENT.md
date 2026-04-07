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
| OpenCV.js | Détection de grille (lazy-load WebAssembly) |

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
│   └── gameStore.ts     # Zustand
├── hooks/
│   ├── useGame.ts
│   ├── useTimer.ts
│   └── useCamera.ts
├── components/
│   ├── ui/              # Button, Modal, Spinner
│   ├── game/            # Cell, ClueCell, ClueList, GameGrid, GameBoard
│   ├── generator/       # GeneratorPanel
│   ├── solver/          # SolverPanel
│   └── importer/        # ImageUploader, CameraCapture, GridCorrector, ImportPanel
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

- **100% front-end** : aucun appel à un serveur externe, pas de backend, pas d'API distante (sauf chargement lazy d'OpenCV.js depuis CDN).
- **Pas de SSR** : Vite SPA uniquement. Ne pas introduire Next.js ou Remix.
- **Alias `@/`** pointe vers `src/`. Toujours utiliser cet alias pour les imports internes, jamais de chemins relatifs `../../`.
- **Tailwind v4** : utiliser `@import 'tailwindcss'` dans le CSS, pas de fichier `tailwind.config.js`. Les classes utilitaires sont la norme — pas de CSS custom sauf dans `index.css`.
- **Tesseract.js et OpenCV.js sont lourds** (~8MB chacun) : ils doivent rester en **import dynamique / lazy-load**, jamais importés statiquement.
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
- Lancer `npm run test` avant chaque commit pour s'assurer que les 44 tests passent.

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

### Import image / OCR
- OpenCV.js est chargé depuis CDN à la demande — ne pas le bundler.
- Tesseract.js est importé dynamiquement (`await import('tesseract.js')`).
- Après OCR, toujours présenter `GridCorrector` à l'utilisateur pour valider/corriger les indices avant de lancer la partie.

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

```bash
npm run dev            # Serveur de développement (http://localhost:5173)
npm run build          # Build de production (TypeScript + Vite)
npm run test           # Tests unitaires et composants (Vitest)
npm run test:watch     # Tests en mode watch
npm run test:coverage  # Rapport de couverture
npm run test:e2e       # Tests e2e Playwright (nécessite npm run dev)
npm run format         # Formatage Prettier
npm run lint           # Linting ESLint
```
