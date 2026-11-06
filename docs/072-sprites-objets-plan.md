# 072 — Plan : sprites d'origine des objets dans la vue du jeu

Suite des docs 067 à 071, qui ont fait la même chose pour les créatures. Objectif : dans la vue à la 1re personne, remplacer les blocs colorés des objets (`level-contents.js`, `BoxGeometry`) par les images d'origine de DM, en billboards, avec une option pour revenir aux blocs.

**Statut : questions tranchées (§ 8), I1 faite (doc 073), I2 faite (doc 074).** Décisions : images prises dans l'extraction locale de graphics.dat de l'utilisateur (SCK), rien à télécharger ; les quatre phases ; billboards ; une seule option, « Original sprites » ; en I4, la barre d'inventaire montre les icônes, le nom au survol ; les particules restent pour les effets des sorts.

## 1. Les images disponibles

Trois familles d'images, dans deux sources.

| Famille | Source | Contenu | Usage |
|---|---|---|---|
| **Objets au sol** | greatstone, graphics.dat Amiga 3.6, graphismes **498 à 583** | 86 images (« Item on floor 00 » à « 85 »), de 6 × 3 px (Eye Of Time) à 80 × 20 px (Bow, Bones) ; plusieurs objets partagent une image (les 10 potions, les 9 épées, les 8 clés…) ; le coffre a deux images : au sol (498) et en alcôve (499) | Vue du jeu |
| **Projectiles** | greatstone, graphismes **454 à 485** | 10 armes lancées vues de face, de dos et de côté (flèche, dague, hache, slayer, massues, fléchette, épée, étoile), éclair, boule de feu, antimatière, poison | Objets en vol, sorts |
| **Explosions** | greatstone, graphismes **486 à 497** | Boule de feu, antimatière, poison, en grand et en trois intensités | Fin d'un sort |
| **Icônes** | greatstone, graphismes **42 à 48** (7 planches de 32 icônes de 16 × 16 px) ; aussi la page *Dungeon Master Items* de l'Encyclopaedia (une icône par objet, versions Atari ST, Super NES, DOS) | L'icône de chaque objet, dans l'inventaire de DM | Mains de Zed, curseur, infobulles |

- La page *Dungeon Master Items* que tu m'as indiquée ne contient que les **icônes d'inventaire** (16 × 16, affichées en 32 × 32). Elles conviennent aux mains et au curseur, pas à la vue : dans le donjon, DM dessine des images différentes, vues de biais sur le sol. Celles-ci ne se trouvent que dans graphics.dat (greatstone).
- **Format :** PNG à palette de 16 couleurs. La couleur **10** (« flesh », un rose chair) est la couleur transparente des objets : DM la passe au blit (`C10_COLOR_FLESH`, `F115` de `DUNVIEW.C`). L'outil d'extraction la rendra transparente.
- **Couleurs :** les objets utilisent la palette du donjon telle quelle. Au contraire des créatures (doc 066, Ghost), aucune recoloration à l'affichage, sauf l'assombrissement à D2 et D3, que la lumière de la vue fait déjà (§ 5).

## 2. De l'objet à son image

Les objets de `dungeon.json` sont repérés par leur catégorie et leur type (catalogue, doc 002).

- **Descripteurs d'objets** (graphics.dat item 559, 180 × 6 octets, *Graphics.dat Item 559* de l'Encyclopaedia) : pour chaque objet, l'**indice global** (qui donne aussi l'icône dans les planches 42 à 48) et l'**indice de l'image au sol**.
- **Définitions des images d'objets** (item 558, 85 × 6 octets, *Graphics.dat Item 558*) : pour chaque image, sa taille, son **jeu de coordonnées** (0 à 2) et deux drapeaux :
  - `FLIP_ON_RIGHT` : image en miroir à droite de l'axe de vue (coffre, les deux boîtes magiques) ;
  - `ALCOVE` : image propre en alcôve (coffre).
- Ces tables seront recopiées dans un nouveau module, `src/core/item-graphics.js`, comme `item-info.js` et `creature-info.js`. Les libellés de greatstone (liste des objets par image) serviront de contrôle croisé dans un test Node.
- Cas à états : gourde pleine ou vide (505 et 535), Firestaff incomplet ou complet (538 et 581), Eye Of Time, boîtes magiques. Le module choisit l'image selon l'état de l'objet, comme pour l'eau (doc 050).

## 3. Comment DM dessine les objets (`F115`, `DUNVIEW.C`)

- **Ancrage :** chaque image est posée par le **milieu de son bord bas**, aux coordonnées de son jeu pour la case vue et la sous-case.
- **Taille :** image d'origine pour la sous-case arrière de D0 et la sous-case avant de D1 ; réduite ensuite (×20/32 à D2, ×16/32 à D3, avec la palette assombrie). Les créatures suivent la même règle : **la même échelle de 160 px par case** (`PIXELS_PER_TILE`, `fp-sprites.js`) convient donc aux objets, et la perspective de Three.js fait la réduction.
- **Visibilité :** DM ne dessine des objets que de D3 à D0, sur l'allée centrale et les deux allées voisines.
- **Piles :** les objets d'une même sous-case ne s'empilent pas en hauteur. Chacun est décalé de quelques pixels, en X et en Y, selon une table de 16 décalages (item 558, « Coordinates to display stacks of items »), le dernier posé dessus. Dans une alcôve, la suite repart au décalage 2 après le 13e objet.
- **Clic :** seul l'objet du **dessus** de la pile est saisissable, sur l'allée centrale, à D0 et à D1 (sous-cases arrière). Sa zone de clic est agrandie quand elle fait moins de 14 pixels de haut.
- **Objets en vol :** une arme qui a ses images de projectile les montre, de face, de dos ou de côté selon sa direction par rapport au groupe, en 6 tailles ; les autres objets sont dessinés en vol avec leur image au sol (`DrawProjectileAsObject`).

## 4. Le billboard

Même principe que les créatures (doc 067, § 2), avec les différences des objets :

- **Plan vertical, parallèle à l'écran**, posé au sol par le milieu de son bord bas, au lacet de la caméra. Les images de DM sont déjà dessinées vues de biais : un plan couché à plat les écraserait (§ 8, Q3).
- **Position :** le centre de la sous-case, comme les blocs actuels (`subcellOffset`), puis le décalage de pile de DM, converti en unités par `PIXELS_PER_TILE`.
- **Alcôves :** au fond du creux (`NICHE.depth`, doc 054), avec l'image d'alcôve si elle existe.
- **Matériau :** `MeshLambertMaterial`, `alphaTest`, filtre `Nearest`, passé par `patchMaterials` (lumière et arrêt par les murs, docs 037 et 038).
- **Lot d'images :** un donjon place 606 objets. Un `InstancedMesh` **par image** et par niveau, avec une instance par objet, garde peu d'appels de dessin. À chaque changement de lacet (`placeCamera`), les matrices des instances sont recalculées : quelques dizaines par niveau visible, coût négligeable.
- **Textures :** les 86 images, chargées une fois au premier niveau construit, gardées en cache (comme les créatures). `disposeLevelMeshes` ne les libère pas.
- **Coffre et contenu :** l'anneau « a un contenu » reste réservé aux cartes. Dans la vue, l'image du coffre suffit.

### Clic

- `target()` lit déjà `tiles[instanceId]` d'un `InstancedMesh` : le clic sur un objet marche sans autre changement.
- **Petits objets :** une pièce fait 10 × 4 px, soit 6 cm sur une case. Comme DM, la zone de clic sera agrandie : un pixel transparent ne compte pas (lecture de l'alpha à `hit.uv`, comme les créatures), mais la sous-case entière reste cliquable au sol (c'est déjà le cas : `onClickFloor` prend l'objet du dessus de la sous-case).
- Écart assumé avec DM : on garde le ramassage partout où le groupe atteint la case (`canReach`), pas seulement sur l'allée centrale.

## 5. Ce qui ne change pas

- **Simulation :** rien. Elle donne déjà le contenu des cases (`contentsAt`) et les objets en vol.
- **Cartes 2D et 3D :** elles gardent leurs blocs colorés et leurs anneaux.
- **Assombrissement par la distance :** DM change la palette à D2 et D3. Ici, la lumière du groupe s'en charge déjà ; pas de recoloration.
- **Particules (doc 063) :** elles restent, sauf décision contraire pour les explosions (Q2).

## 6. Intégration au code

| Fichier | Changement |
|---|---|
| `tools/extract-item-graphics.py` (nouveau) | Télécharge les graphismes 42 à 48 et 454 à 583 de greatstone, rend la couleur 10 transparente, écrit `assets/items/floor/NN.png`, `assets/items/missiles/NN.png`, `assets/items/icons.png` (une planche unique) et une planche de contrôle |
| `src/core/item-graphics.js` (nouveau) | Tables des items 558 et 559 : image au sol, jeu de coordonnées, drapeaux, icône, image de projectile ; fonctions pures `floorGraphic(item)`, `iconIndex(item)`, `missileGraphic(item, relative)` |
| `src/render/first-person/fp-item-sprites.js` (nouveau) | Cache des textures, `InstancedMesh` par image, piles, alcôves, mise à jour du lacet |
| `src/render/first-person/fp-renderer.js` | Objets en sprites ou en blocs dans `build` et les reconstructions ; lacet dans `placeCamera` ; projectiles (I3) |
| `src/render/three/level-contents.js` | Inchangé pour les cartes ; fournit la liste des objets vus, déjà calculée |
| `src/ui/champion-panel.js`, curseur de `fp-renderer.js` | Icônes à la place des carrés de couleur (I4) |
| `lighting-settings.js`, `main.js`, `src/i18n/ui-*.js` | Option du panneau (Q4) |
| `tools/test-item-graphics.mjs` (nouveau) | Chaque objet du catalogue a une image ; contrôle croisé avec les libellés de greatstone ; décalages de pile |

## 7. Phases

| Phase | Contenu | Critère de fin |
|---|---|---|
| **I1** | Extraction des images, table `item-graphics.js`, billboards au sol et en alcôve, option, clic | Au départ, les objets du Hall et du niveau 1 ont leur image d'origine ; on ramasse et on pose comme avant ; l'option revient aux blocs |
| **I2** | Fidélité de DM : décalages de pile, miroir à droite, image du coffre en alcôve, réglage fin des positions d'après les jeux de coordonnées (comme la doc 069 pour les créatures) | Une pile de 5 objets s'étale comme dans DM ; le coffre change d'image en alcôve |
| **I3** | Projectiles : armes lancées avec leurs vues de face, de dos et de côté ; autres objets avec leur image au sol ; sorts (boule de feu, éclair, poison) ; explosions selon Q2 | Une dague lancée se voit de dos en s'éloignant ; une boule de feu a son image de DM |
| **I4** | Icônes : mains de Zed, curseur (icône agrandie), infobulles | Plus aucun carré de couleur pour un objet dans l'interface du jeu |

I1 et I2 peuvent être faites ensemble si I1 est rapide.

## 8. Questions à trancher

1. **Source des images.** Les images de la vue n'existent que dans graphics.dat (greatstone, Amiga 3.6). Comme pour les sons (doc 042), il faut les **télécharger dans le projet** (`assets/items/`). D'accord ? Pour les icônes, greatstone (Amiga, cohérent avec le reste) ou l'Encyclopaedia (Atari ST) ?
2. **Périmètre.** Je propose les quatre phases. Les projectiles (I3) et les icônes (I4) sont-ils à faire maintenant, ou plus tard ? Et pour les sorts : remplacer les sphères lumineuses par les images de DM, et les éclats de particules par les explosions de DM, ou garder les particules ?
3. **Orientation.** Billboard vertical face à la caméra (recommandé : c'est l'aspect de DM, et la cohérence avec les créatures), ou plan légèrement incliné vers l'arrière, pour qu'un objet semble mieux posé au sol quand on s'en approche ?
4. **Option du panneau.** La case **Original sprites** commande-t-elle aussi les objets (recommandé : une seule case pour « l'aspect DM »), ou une case séparée, « Item sprites » ?

### Réponses

1. Si ça t'arrange, j'ai les images extraites en local depuis graphics.dat, dans ce dossier : /home/jhice/Gamedev/sck@1.5.1@20110502.0/sck/output/graphics.dat.bak / à voir ce qui est le plus simple
2. ok pour les 4 phases. dans l'inventaire en bas de la fenêtre on peut masquer le nom, mettre l'icône et afficher le nom au survol. on garde les particules existantes pour les effets.
3. go billboard et on avisera
4. une seule option, OK

> **Suite donnée (Claude) :**
> 1. Extraction locale retenue : les BMP de SCK ont la numérotation de greatstone (Amiga 3.6), et la couleur 10 y est bien la couleur transparente. Les tables des items 558 et 559 n'y sont pas : la correspondance objet → image vient de la table *Items properties* de l'Encyclopaedia (doc 073, § 2).
> 2. I4 couvrira les mains, le curseur, et la barre d'inventaire (icône, nom au survol). Les sorts en vol (I3) prendront les images de DM ; leurs éclats restent des particules (doc 063), sans les images d'explosion.
> 3. Billboards en I1 ; les objets en alcôve restent parallèles à leur mur (doc 073, § 3).
> 4. La case « Original sprites » commande créatures et objets.

## Sources

- Docs 002, 008, 042, 050, 054, 066 à 071 du projet, et le code cité ci-dessus.
- Dungeon Master Encyclopaedia, *Dungeon Master Items* : http://dmweb.free.fr/games/dungeon-master/solutions/items/ (lien de l'utilisateur) — liste des objets, icônes d'inventaire 16 × 16 (Atari ST, Super NES, DOS). Page téléchargée dans le dossier temporaire de la session et lue.
- graphics.dat de DM Amiga 3.6 (greatstone) : http://greatstone.free.fr/dm/db_data/dm_amiga_36_caps/graphics.dat/graphics.dat.html — libellés et tailles des graphismes 42 à 48 et 454 à 583. Quelques images téléchargées dans le dossier temporaire pour vérifier format, taille et couleur transparente ; rien n'est encore copié dans le projet.
- Dungeon Master Encyclopaedia, *Graphics.dat Item 558* : http://dmweb.free.fr/community/documentation/dungeon-master-and-chaos-strikes-back/graphics.dat-item-558/ — définitions des images d'objets et de projectiles, coordonnées d'affichage, décalages des piles.
- Dungeon Master Encyclopaedia, *Graphics.dat Item 559* : http://dmweb.free.fr/community/documentation/dungeon-master-and-chaos-strikes-back/graphics.dat-item-559/ — descripteurs d'objets (indice global, image au sol).
- ReDMCSB Release 2 (miroir GitHub) : https://github.com/gondur/ReDMCSB_Release2, `SOURCE/ENGINE/DUNVIEW.C` (`F115` : dessin des objets, échelles, miroir, piles, zones de clic, projectiles dessinés comme objets) et `DUNGEON.C` (tables `ObjectInfo`). Fichiers lus dans le dossier temporaire de la session.
