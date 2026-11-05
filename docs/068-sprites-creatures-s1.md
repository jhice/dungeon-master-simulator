# 068 — Sprites d'origine des créatures, phase S1

Réalisation de la phase S1 du plan (doc 067) : dans la vue à la 1re personne, les créatures sont dessinées avec leurs images d'origine (doc 066). Les cartes 2D et 3D ne changent pas.

## Ce qui marche

- **Option :** « Original sprites » (« Sprites d'origine », « Original-Sprites »), dans la section « Decorations (game view) » du panneau, cochée par défaut (`creatureSprites`, `lighting-settings.js`). Décochée, la vue revient aux cylindres à nez.
- **Billboards :** un plan vertical parallèle à l'écran, posé au sol par le milieu de son bord inférieur, dans la sous-case du membre ou au centre s'il est seul. Il reste parallèle à l'écran pendant un quart de tour.
- **Vue selon la direction :** `src/render/creature-views.js`, sans DOM ni Three.js. `side` si la créature regarde vers notre droite, `side2` vers notre gauche ; la vue change à mi-rotation. Les 9 créatures à vue unique gardent leur image.
- **Échelle :** 160 pixels par case (`PIXELS_PER_TILE`, `fp-sprites.js`). Rendu satisfaisant sur Trolin, Skeleton, Stone Golem et Dragon, à confirmer en jeu.
- **Lumière :** matériau Lambert, donc mêmes lumières et même arrêt par les murs que le reste de la vue. Le test du masque se fait à la position du pixel (`OCC_AT_POSITION`), comme les objets 3D.
- **Pointeur :** chaque sprite est un `InstancedMesh` d'une instance, le code de `target()` reste le même. Un pixel transparent laisse passer le pointeur vers ce qui est derrière (`opaqueAt`).

## Changements de code à connaître

- `buildLevelContents` a une option `withCreatures` : la vue du jeu construit ses créatures à part (`creatureMeshes`, `fp-renderer.js`).
- `rebuildCreatures` ne libère plus l'ancien jeu de créatures tout de suite, mais après le rendu suivant, comme un niveau (doc 052). Seuls les sprites utilisent leur programme de shader : le libérer tout de suite le ferait recompiler à chaque pas de créature.
- Les textures sont chargées par espèce à la première apparition (frames des vues seulement). Une créature n'apparaît qu'une fois ses images arrivées.

## Vérifications

- **Node :** `node tools/test-sprites.mjs` : vues par direction, milieu de rotation, vue unique, fichiers de `frames.json`, espèces du donjon.
- **Chrome sans interface,** copie instrumentée du projet, console sans erreur :
  - face, deux profils et dos ;
  - groupe de 3 Trolins, 2 Skeletons, Ghost, Stone Golem, Dragon ;
  - quart de tour capturé en cours ;
  - case du panneau (bascule et préférence enregistrée) ;
  - curseur en main seulement sur les pixels opaques ;
  - clic sur le corps : l'action de mêlée part (événement `creatureHit`) ;
  - reconstruction des créatures : 1 à 3 ms.
- **Pas vérifié :** une partie jouée à la main, l'extension Chrome étant déconnectée. Les coups observés au test n'ont pas enlevé de PV (Zed mourait vite, sans lumière ni préparation), donc seul le départ de l'attaque est vérifié, pas des dégâts sur un sprite.

## Limites connues

- La créature qui attaque, et le mouvement sur place, viennent en S2 et S3 (doc 067).
- Sprites coupés par les murs et créatures sous une porte : rien de gênant sur les cas testés, à surveiller en jeu.

## Sources

- Docs 052, 066, 067 du projet. Three.js 0.170 : `InstancedMesh`, `TextureLoader`.
