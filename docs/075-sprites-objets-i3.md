# 075 — Sprites des objets, I3 : projectiles

Phase I3 du plan de la doc 072. Avec l'option « Original sprites », les objets lancés et les sorts en vol ont leurs images de DM, à la place des cubes et des sphères. Les explosions restent des particules (doc 063), comme décidé (doc 072, § 8).

## 1. Images

- `tools/extract-item-graphics.py` copie aussi les graphismes 454 à 485 (« Missile … ») dans `assets/items/missiles/NN.png`, avec la couleur 10 transparente, et leurs libellés dans `labels.json`.
- On a 32 images :
  - 10 armes lancées, vues de face, de dos et de côté ;
  - l'éclair, de face et de côté ;
  - l'étoile de jet, sans vue de dos ;
  - 4 sorts : boule de feu, sort par défaut (Zo…), boule de poison, poison.

## 2. Données et choix de la vue (`src/core/item-graphics.js`)

- **14 aspects de projectiles** (item 558, « Projectile graphics definitions ») : première image, type (`GraphicInfo & 3`), vue de côté, taille selon l'énergie (sorts). Les types :

| Type | Sens | Projectiles |
|---|---|---|
| 0 | vue de dos et rotation | hache, massues |
| 1 | vue de dos sans rotation | flèche, dague, slayer, fléchette, épée |
| 2 | ni vue de dos ni rotation | éclair, étoile de jet |
| 3 | une seule image | sorts |

- **Arme → image :** d'après les libellés des images (bits 12-8 des descripteurs d'armes, item 559) :
  - flèche ; dague ; hache et Hardcleave ; slayer ; massue de pierre ; massue ; fléchette ;
  - les épées (Bolt Blade, Delta, Diamond Edge, Falchion, Fury, Rapier, Sabre, Samurai Sword, Sword, The Inquisitor) ;
  - étoile de jet.
  - Les autres objets volent avec leur image au sol, comme dans DM (`DrawProjectileAsObject`).
- **Sort → image** (`F142`) : boule de feu, éclair, poison ; tout autre sort, dont Zo (Open Door), prend l'image par défaut.
- **`projectileView(aspect, vol, regard, sous-case, àDroite, caseImpaire)`** reprend `F115` :
  - **En travers de la vue :**
    - on voit le côté, pointe à gauche, en miroir quand le projectile va vers la droite ;
    - une hache ou une massue tourne : à l'envers une case sur deux, avec un miroir selon sa colonne.
  - **Dans l'axe de la vue :**
    - de face quand le projectile arrive, de dos quand il s'éloigne (type 1) ;
    - en miroir à gauche de la vue ;
    - une arme qui tourne montre sa face sur les cases impaires et son dos sur les cases paires, à l'envers sur la rangée du fond de sa case.
- **Tests** (`node tools/test-item-graphics.mjs`) :
  - chaque arme qui a ses images pointe sur une vue de face libellée de son nom ;
  - les cas de vue et de miroir.

## 3. Rendu (`fp-renderer.js`, `setProjectiles`)

- Un plan face à la caméra par projectile. Son lacet suit la caméra pendant un quart de tour (`placeCamera`). Les miroirs sont faits en inversant les UV de sa géométrie.
- **Hauteur :** DM dessine tous les projectiles sur la même ligne de l'écran (y 47 sur 136), au milieu de l'image d'un projectile, ou au bas de l'image d'un objet au sol. Comparée à ses murs, cette ligne est à 0,73 de leur hauteur à D1, et plus haut au-delà. Ici, une hauteur fixe de 0,5 case (`FLIGHT_LINE`). À la hauteur de l'œil (0,45 au début), les projectiles se collaient au point de fuite et semblaient lointains.
- **Taille :** 160 pixels par case. DM dessine les projectiles à leur taille sur la case du groupe, et la perspective fait le reste. Un sort est en plus multiplié par `max(96, énergie + 1) / 256`, comme les sphères (doc 033).
- **Lumière :** un sort brille (`MeshBasicMaterial`) ; un objet lancé est éclairé (`MeshLambertMaterial`).
- **Repli :**
  - avec l'option décochée, ou avant le chargement des images, on garde les cubes et les sphères ;
  - le chargement est commun avec les objets au sol (`itemSprites.texture()`).

## 4. Vérifications (Chrome)

- **Vue de test** créée dans la page, avec des projectiles fixes dans le couloir de départ (niveau 0, groupe en (1, 3) face au sud) :
  - flèche en travers, vue de côté, pointe vers sa direction de vol ;
  - flèche qui arrive, de face, en miroir à gauche ;
  - dague qui s'éloigne, de dos ;
  - boule de feu à pleine énergie.
- **En jeu :**
  - boules de feu (Lo et Mon Ful Ir) : seule l'explosion apparaît sur la capture, car la capture est plus lente que le vol ;
  - torche lancée.
  - Aucune erreur dans la console.
- **Tests Node :** les 17 passent.

## Sources

- Dungeon Master Encyclopaedia, *Graphics.dat Item 558*, « Projectile graphics definitions » : http://dmweb.free.fr/community/documentation/dungeon-master-and-chaos-strikes-back/graphics.dat-item-558/ (page déjà téléchargée, relue).
- Dungeon Master Encyclopaedia, *Graphics.dat Item 559*, « Weapon items descriptors » (bits 12-8 : image du projectile) : http://dmweb.free.fr/community/documentation/dungeon-master-and-chaos-strikes-back/graphics.dat-item-559/
- ReDMCSB Release 2 : https://github.com/gondur/ReDMCSB_Release2, `SOURCE/ENGINE/DUNVIEW.C` (`F115`, dessin des projectiles) et `DUNGEON.C` (`F142`, aspect d'un projectile ou d'une explosion).
- Extraction locale de graphics.dat (SCK) de l'utilisateur, graphismes 454 à 485.
