# 067 — Plan : sprites d'origine des créatures dans la vue du jeu

Suite de la doc 066. **S1 est faite (doc 068) ; S2 et S3 restent à faire.** Objectif : dans la vue à la 1re personne, remplacer les cylindres à nez par les sprites d'origine, en billboards, avec une option pour revenir aux cylindres.

## Décisions de l'utilisateur

- Option du panneau, section « Decorations (game view) » : **Original sprites**. Elle bascule entre les modèles actuels et les billboards.
- La vue affichée dépend de la direction de la créature par rapport au groupe, comme le nez aujourd'hui.
- `side2` peut remplacer la transformation en miroir.
- Ombre intégrée au sprite, point d'ancrage centré en bas de l'image.
- Mouvement sur place : frames répétées des GIFs, ou mouvement codé, à voir (recommandation au § 4).

## Hors périmètre

- Les cartes 2D et 3D gardent leurs marqueurs : le panneau parle de la vue du jeu.
- La simulation ne change pas. Elle émet déjà ce qu'il faut (`creaturesMoved`, `championHit`).
- Les déplacements restent en sauts de case : les créatures animées relèvent de T2, en attente (doc 061).
- Grey Lord et Lord Order : le donjon n'en place aucun, et la fin du jeu n'existe pas encore.

## 1. Choix de la vue

Avec les directions numérotées N = 0, E = 1, S = 2, O = 3, et `r = (créature − groupe + 4) % 4` :

| `r` | La créature… | Frame |
|---|---|---|
| 2 | nous fait face | `front` (0) |
| 1 | regarde vers notre droite | `side` (1) |
| 0 | nous tourne le dos | `back` (2) |
| 3 | regarde vers notre gauche | `side2` (3) |

- Les créatures sans vues (`hasViews: false`) gardent toujours leur image de face.
- La direction du groupe est celle **affichée** : pendant un quart de tour animé (`motion.sample`), la vue change à mi-rotation, et non au moment où la simulation a déjà tourné.

## 2. Le billboard

- **Orientation :** un plan vertical, parallèle à l'écran, qui reprend le lacet de la caméra à chaque image (`placeCamera`). Il reste donc de face pendant un quart de tour. La caméra ne s'incline jamais : l'axe vertical suffit.
- **Taille :** une seule échelle pour toutes les espèces, 160 pixels pour une case.
  - Elle vient de ma mémoire de DM, où le mur de face à une case fait environ 160 pixels de large (à vérifier). Avec `WALL_HEIGHT = 0.7`, ce mur ferait 112 pixels de haut, ce qui reste cohérent.
  - Résultat attendu : le Dragon couvre 0,9 case de large, le Stone Golem 90 % de la hauteur d'un mur.
  - Constante unique, à ajuster à l'œil dans le jeu.
- **Position :** la même que les cylindres, au sol, dans la sous-case du membre, ou au centre s'il est seul. Les créatures qui volent sont déjà dessinées haut dans leur image (Giant Wasp) : pas de décalage ajouté.
- **Matériau :** `MeshLambertMaterial`, `alphaTest` pour une découpe nette, filtre `Nearest` pour garder les pixels. Il passe par `patchMaterials` : le sprite reçoit donc la lumière et l'arrêt par les murs comme le reste de la vue.
- **Textures :** chargées à la demande, par espèce, à partir de `frames.json`, et gardées en cache. Un sprite pas encore chargé n'apparaît qu'une fois prêt. `disposeLevelMeshes` libère géométrie et matériau, pas les textures, donc le cache survit aux reconstructions.
- **Membres côte à côte :** deux membres à la même profondeur sont coplanaires et scintilleraient là où ils se recouvrent. Petit décalage en profondeur selon la sous-case.

## 3. Intégration au code

| Fichier | Changement |
|---|---|
| `src/render/first-person/fp-sprites.js` (nouveau) | Cache des textures, construction des billboards, choix de la frame (fonction pure, testable dans Node), mise à jour du lacet |
| `src/render/first-person/fp-renderer.js` | Reconstruit sprites ou cylindres dans `build` et `rebuildCreatures`, met à jour les sprites dans `placeCamera`, traite l'option dans `setLighting` |
| `src/render/first-person/lighting-settings.js` | `creatureSprites: true` |
| `src/main.js` | Case à cocher sous `ornamentModels` ; `championHit` transmis à la vue (phase S2) |
| `src/i18n/ui-{en,fr,de}.js` | « Original sprites », « Sprites d'origine », « Original-Sprites » |
| `tools/test-sprites.mjs` (nouveau) | Tests Node du choix de la frame |

- **Clic :** `target()` ne garde que les `InstancedMesh` et lit `tiles[instanceId]`. Chaque billboard sera un `InstancedMesh` d'une seule instance : le clic, la frappe et la porte devant la créature marchent sans autre changement. Le plan étant plus large que le cylindre, un clic sur un pixel transparent devra traverser le sprite, pour atteindre un objet au sol derrière (lecture de l'alpha à `hit.uv`).
- **Chemin des fichiers :** `frames.json` et les PNG sont chargés par `fetch` et `TextureLoader`, en relatif, comme `assets/sounds/`.
- **Option désactivée :** le code actuel de `buildLevelCreatures` reste intact. Les cartes s'en servent toujours.
- **Valeur par défaut :** sprites activés, car les cylindres étaient des marqueurs provisoires. « Valeurs par défaut » remet donc les sprites.

## 4. Phases

| Phase | Contenu | Critère de fin |
|---|---|---|
| **S1** | Option du panneau, billboards fixes, vue selon la direction, clic | En tournant autour d'une créature, on voit face, côtés et dos ; la frappe au clic marche ; l'option revient aux cylindres |
| **S2** | Frame d'attaque | Une créature qui attaque montre son attaque, touchée ou non, puis revient à sa vue |
| **S3** | Mouvement sur place, avec les frames des GIFs | Une créature immobile vit, sans recalcul inutile quand rien ne change |

**S2 :** sur `championHit` portant un `group`, affichage de la frame `attack` pendant une durée fixe, en temps de rendu (valeur provisoire : 2 ticks). Si elle existe, `attackMirror` alterne avec elle, comme les GIFs. Le Giggler n'a pas de frame d'attaque, il ne change pas. La durée réelle reste à chercher dans ReDMCSB.

**S3, recommandation : garder les frames des GIFs.** Elles sont d'origine, déjà dessinées, et un mouvement codé n'imiterait que moins bien leurs petits décalages.

- Frames utilisées : celles de `frames.json` hors vues et hors attaque, qui ne concernent que la vue de face. De côté et de dos, l'image reste fixe, car les GIFs n'ont rien d'autre.
- Rythme : les durées des GIFs, avec une phase différente par membre pour éviter que tout un groupe bouge d'un bloc.
- Coût : la vue ne se dessine qu'à la demande. Un minuteur ne demandera une image que si une frame visible change.

## 5. Risques

- **Sprites coupés par les murs :** un sprite large en sous-case ou vu en biais peut entrer dans un mur voisin, et le mur en masque une partie. Si ça se voit trop : le rapprocher du centre de sa case quand il touche un mur.
- **Portes :** une créature sous un battant était une affaire de hauteur du cylindre (`standingHeight`, doc 028). Le sprite gardera la hauteur de son image, donc à regarder en jeu.
- **Captures sans interface :** le problème connu des objets noirs (doc 054, § 6) peut gêner les vérifications automatiques. Les vérifications visuelles se feront de préférence avec l'extension Chrome.

## Sources

- Docs 028, 052, 054, 061, 066 du projet, et le code cité ci-dessus.
- L'échelle de 160 pixels par case vient de ma mémoire de DM, sans source vérifiée (à ajuster à l'œil).
