# ADR-001 : Reconnaissance d'images de picross

**Statut** : En cours d'itération (WIP)
**Date de début** : 2026-04-08
**Contexte** : Import de puzzles picross depuis des images (photos, screenshots)

---

## Objectif

Permettre à l'utilisateur d'importer un puzzle picross depuis une image (fichier ou photo) et d'en extraire automatiquement :
1. La structure de la grille (nombre de lignes/colonnes)
2. Les indices (chiffres dans les zones de clues)

Le tout sans backend, 100% front-end.

---

## Architecture du pipeline

```
Image upload
  → Détection automatique des bornes de la grille
  → Sélection/ajustement par l'utilisateur (CornerSelector)
  → Expansion des coins (optionnel)
  → Détection N&B vs Couleur
  → Détection de la structure de grille
  → Découpe en cases individuelles
  → Preprocessing des cases
  → Reconnaissance des chiffres (OCR / Template matching)
  → Validation / Correction par l'utilisateur
  → Résolution du puzzle
```

---

## Évolution des choix techniques

### 1. Détection de la structure de grille

#### v1 : Profils de noirceur (lignes sombres)

**Approche** : Pour chaque ligne/colonne de l'image, compter la proportion de pixels sombres. Les lignes de grille apparaissent comme des pics de noirceur. Chercher un espacement régulier entre ces pics.

**Résultat** : ✅ Fonctionne très bien pour les grilles N&B avec traits noirs.

**Échec** : ❌ Échoue totalement sur les grilles colorées (traits bleu pâle sur fond blanc — aucun pixel "sombre").

#### v2 : Stratégies multiples (edge, saturation, lightness)

**Approche** : Ajouter des profils alternatifs en cascade :
- Edge : transitions de luminosité entre pixels voisins
- Saturation : lignes colorées sur fond désaturé
- Lightness : lignes claires sur fond coloré

**Résultat** : ⚠️ Les stratégies edge/light/saturation trouvaient trop de faux positifs sur les grilles N&B (rangées de cases remplies noires détectées comme des lignes de grille).

**Leçon apprise** : Ne jamais utiliser les stratégies agressives sur des images N&B. La séparation N&B/couleur est un garde-fou indispensable.

**Solution** : Analyser la saturation de la zone croppée (`isColorImage`) pour choisir la stratégie. Seuil 0.15, pixels très sombres/clairs ignorés.

#### v3 : Subdivision des séparateurs

**Approche** : La saturation détecte les séparateurs orange (tous les 5 cases) mais pas les fines lignes entre chaque case. Subdiviser les intervalles trouvés.

**Résultat** : ❌ Instable. La subdivision multipliait les erreurs quand les séparateurs détectés étaient faux (35 colonnes, 70 lignes).

**Leçon apprise** : Ne subdiviser que si le nombre de lignes trouvé est petit (< 10), signe de séparateurs de groupes.

#### v4 : Analyse de bandes (solution actuelle pour la couleur) ✅

**Approche** : Parcourir la grille pixel par pixel sur plusieurs lignes parallèles. Mesurer les bandes de luminosité homogène : `4 28 4 28 4 28...` = traits 4px + cases 28px.

**Résultat** : ✅ Détecte parfaitement le nombre de cases et leurs positions exactes. Testé avec succès sur une grille 15×15 avec alternance bleu/blanc.

**Avantages** :
- Insensible à la couleur des traits (fonctionne avec n'importe quel contraste)
- Retourne les positions pixel-perfect des lignes (pas juste le nombre)
- 3 scans par axe pour le consensus → robuste aux artefacts

**Contrainte** : Ne fonctionne que sur la zone croppée (pas sur l'image complète).

### 2. Détection automatique des bornes

#### v1 : detectGridStructureDark sur l'image complète

**Approche** : Chercher des lignes sombres régulières sur toute l'image.

**Résultat** : ✅ Fonctionne pour les grilles N&B.

**Échec** : ❌ Aucune détection pour les grilles couleur.

#### v2 : Edge scan depuis les bords

**Approche** : Scanner depuis les 4 bords de l'image vers l'intérieur sur 10 lignes parallèles. Le premier contraste significatif = bord de la grille. Consensus par groupement.

**Résultat** : ⚠️ Fonctionne pour right/bottom mais échoue souvent pour left/top car les chiffres des indices créent des contrastes avant la grille.

**Solution** : Pour left/top, prendre le groupe de positions le plus éloigné du bord (la grille est plus loin que le texte, pas l'inverse).

**Résultat final** : Le cadrage automatique reste approximatif, mais l'analyse de bandes corrige ensuite. Acceptable.

#### v3 : Expansion des coins (expérimental, abandonné)

**Approche** : L'utilisateur clique à l'intérieur de deux cases. L'algorithme étend les coins vers les bords en cherchant des traits de grille.

**Problèmes rencontrés** :
- `findLastEdge` vers le haut/gauche dépassait dans la zone d'indices (luminosité identique cases/indices).
- Les chiffres collés aux bordures formaient des blocs > 5px confondus avec du texte.
- Seuils de largeur de trait (5px vs 15px) difficiles à calibrer.

**Leçon apprise** : L'expansion ne fonctionne pas quand la luminosité des cases est trop proche de celle de la zone d'indices. L'analyse de bandes rend l'expansion moins nécessaire.

**Statut** : Code conservé (`expandCornersToGridEdges`) mais instable. L'analyse de bandes est la solution fiable.

### 3. Découpe des cases

#### v1 : Division uniforme

**Approche** : `cellW = selW / nCols`, `cellH = selH / nRows`.

**Résultat** : ❌ Fonctionne si la sélection est pile sur les bords de la grille. Décalé sinon.

#### v2 : Positions exactes des lignes de grille ✅

**Approche** : Utiliser les positions retournées par la détection (dark ou bandes) pour découper chaque case entre ses deux lignes réelles.

**Résultat** : ✅ Découpe pixel-perfect. Les cases d'indices sont extraites à gauche/au-dessus de la grille avec la bonne largeur/hauteur par case.

**Zone d'indices** : Limitée à 6× la taille d'une case (raisonnable pour une grille 20×20).

### 4. Preprocessing des cases pour la reconnaissance

Pipeline actuel :
```
Image brute de la case
  → adaptiveNormalize (Otsu → N&B, fond blanc, texte noir)
  → removeBorderArtifacts (efface les 6 premiers/derniers pixels de chaque bord si > 40% noirs)
  → removeGridLines (efface colonnes/rangées > 75% noires)
  → cropToContent (rogne au bounding box du contenu noir + 8px de marge)
  → upscaleCanvas (facteur pour atteindre ≥ 128px)
  → addWhitePadding (16px de blanc autour)
```

**Problème résolu** : Les bordures de grille résiduelles (traits coupés lors du découpage) faussaient la reconnaissance. `removeBorderArtifacts` a été ajouté spécifiquement pour ça (marge 6px, seuil 40%).

**État** : ✅ Le preprocessing produit des images propres avec des chiffres noirs centrés sur fond blanc.

### 5. Reconnaissance des chiffres

#### v1 : Tesseract.js sur la case complète

**Approche** : Passer chaque case entière (potentiellement multi-chiffres) à Tesseract.

**Résultat** : ✅ Fonctionne bien pour les grilles N&B avec polices standard.

**Échecs** :
- ❌ Bloque indéfiniment sur certaines cases (29/30 → freeze). Le `Promise.race` avec timeout ne suffit pas car le worker bloqué empêche les appels suivants.
- ❌ Ne reconnaît pas les polices pixelisées/LCD (polices de jeu vidéo).

**Solution pour le blocage** : Terminer et recréer le worker après un timeout (pas juste `Promise.race`).

#### v2 : Template matching

**Approche** : Banque de 260 templates (polices système + pixel-art manuels + géométrique/futuriste), comparaison par similarité.

**Évolution de la métrique** :
- Hamming (pixels identiques) → favorise les templates de même densité globale, pas de même forme.
- IoU (Intersection over Union des pixels noirs) → meilleur mais scores trop bas (23-49%).

**Évolution du redimensionnement** :
- v1 : Redimensionner la case à la taille du template (32×48) → déformation.
- v2 : Redimensionner le template à la taille de la case → zéro déformation de la case. Mais l'upscale nearest-neighbor crée des traits trop épais.
- v3 : Upscale avec smoothing → traits plus fins mais scores IoU restent bas.

**Résultat** : ⚠️ Reconnaît correctement les "1" et parfois les "3" mais échoue sur "2", "6", "5", "7". Le taux d'erreur reste élevé.

**Leçon apprise** : Le template matching artisanal n'est pas assez robuste pour des polices variées, même avec 260 templates. L'IoU est meilleur que le Hamming mais les scores restent bas à cause des différences d'épaisseur de traits entre template et image réelle.

#### v3 : Segmentation + Tesseract par blob (approche actuelle)

**Constat** : Le preprocessing produit des images parfaitement propres (chiffres noirs sur fond blanc bien centrés). Le problème n'est pas l'image mais la façon dont elle est passée à Tesseract (case complète multi-chiffres au lieu de chiffres individuels).

**Approche** :
1. Segmenter la case en blobs individuels (horizontal ET vertical pour les chiffres empilés)
2. Passer chaque blob séparément à Tesseract ET au template matching
3. Tesseract a la priorité, template matching en fallback

**Segmentation** :
- Scanner les colonnes (horizontal) et les lignes (vertical) pour trouver les runs de pixels noirs
- Si plusieurs blobs horizontaux → chiffres côte à côte (indices de lignes)
- Si plusieurs blobs verticaux → chiffres empilés (indices de colonnes)

**Statut** : En cours de test. L'hypothèse est que Tesseract fonctionne mieux sur un seul chiffre isolé que sur une case multi-chiffres.

### 6. Mode debug interactif

**Approche** : En mode debug (Ctrl+D), le validateur affiche les images segmentées cliquables. Au clic, les deux méthodes (Tesseract + template matching) sont lancées et le résultat est loggé en console.

**Format du log** :
```
[Image segmentée 1] [img]  Template: 3  Tesseract: 3
```

**Utilité** : Permet de tester la reconnaissance image par image, de comparer les deux méthodes, et d'identifier précisément quelles images posent problème.

---

## Problèmes non résolus

1. **Reconnaissance des polices pixelisées** : Tesseract échoue même sur un chiffre unique parfaitement isolé dans un carré blanc lorsque la police est non conventionnelle (pixel-art, LCD, géométrique/futuriste). Ce n'est pas un problème de preprocessing ni de segmentation — l'image fournie est propre — c'est une limitation du modèle OCR de Tesseract qui n'est pas entraîné sur ces polices. Le template matching artisanal ne compense pas assez (IoU trop bas). Le template matching par IoU a un biais fondamental : il rapproche des images dont la **largeur de trait** est similaire plutôt que celles dont la **forme** est similaire. Un "2" avec des traits fins matchera mieux un "9" avec des traits fins qu'un "2" avec des traits épais. L'IoU mesure le recouvrement de surface, pas la topologie de la forme. Pistes : entraîner un modèle Tesseract custom, utiliser un réseau de neurones léger (CNN) pour 10 classes, une distance de Hausdorff sur les contours plutôt que l'IoU sur les pixels, ou un service d'OCR spécialisé (mais contraint par le 100% front-end).

2. **Détection automatique des bornes pour la couleur** : Le cadrage automatique (edge scan) est approximatif. L'utilisateur doit souvent ajuster manuellement.

3. **Grilles non carrées** : Le système assume des grilles carrées. Les grilles rectangulaires ne sont pas testées.

---

## Principes retenus

1. **Séparer N&B et couleur le plus tôt possible** dans le pipeline. Les stratégies de détection sont fondamentalement différentes.

2. **L'analyse de bandes est la méthode la plus fiable** pour les grilles couleur. Elle travaille pixel par pixel et n'a pas besoin de chercher des "lignes" — elle mesure l'alternance trait/case directement.

3. **Le preprocessing est excellent** — les images résultantes sont propres. Le problème de reconnaissance est en aval, pas en amont.

4. **Le template matching artisanal a ses limites**. Pour 10 caractères simples, Tesseract devrait suffire s'il reçoit des images propres et individuelles (un seul chiffre par image).

5. **Les seuils en pixels absolus** (pas en pourcentage) fonctionnent mieux pour les traits de grille qui ont une épaisseur fixe (1-5px).

6. **Le debug interactif est indispensable** pour itérer sur la reconnaissance. Le log structuré par phases (BOUNDS → EXPAND → EXTRACT → MATCH → OCR) permet de diagnostiquer précisément où le pipeline échoue.

---

## Fichiers concernés

```
src/lib/image/
  profiles.ts         — Analyse luminosité, saturation, détection N&B/couleur
  canvas.ts           — Manipulation canvas, Otsu, normalisation, removeBorderArtifacts
  gridDetection.ts    — Détection de grille (dark, extended, bandes, hue scan)
  gridBounds.ts       — Détection des bornes (dark + edge scan + expansion)
  cellExtraction.ts   — Découpe des cases (positions exactes)
  ocr.ts              — Reconnaissance (Tesseract + template matching)
  templateBank.ts     — Banque de templates (système + pixel-art + géométrique)
  templateMatch.ts    — Matching, segmentation, IoU
  debugLog.ts         — Système de log structuré
```
