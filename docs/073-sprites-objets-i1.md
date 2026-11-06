# 073 — Sprites des objets, I1 : images d'origine au sol et en alcôve

Phase I1 du plan de la doc 072. Dans la vue du jeu, les objets posés au sol et dans les alcôves ont leur image de DM, en billboards, à la place des blocs colorés. L'option « Original sprites » du panneau commande les créatures et les objets.

## 1. Images

- **Source :** l'extraction locale de graphics.dat de l'utilisateur (SCK, DM Amiga 3.6). Ses BMP sont numérotés comme sur greatstone ; rien n'a été téléchargé.
- **Outil :** `python3 tools/extract-item-graphics.py [dossier]` copie les graphismes 498 à 583 (« Item on floor 00 » à « 85 ») dans `assets/items/floor/NN.png`, en PNG à palette, avec la couleur 10 transparente (`C10_COLOR_FLESH` de DM). Il écrit aussi `labels.json` (objets dessinés par chaque image, d'après les libellés de SCK) et la planche de contrôle `docs/assets/item-floor.png`.
- 86 images, 356 Ko en tout.

## 2. De l'objet à son image : `src/core/item-graphics.js`

- Tables recopiées des descripteurs d'objets (graphics.dat item 559), d'après la table *Items properties* de l'Encyclopaedia. Pour chaque catégorie et type :
  - le numéro de l'image au sol, qui est l'octet du descripteur + 1 ;
  - l'indice global, qui donnera l'icône en I4.
- Le coffre a deux images : 00 au sol, 01 en alcôve (`floorPicture(kind, type, inAlcove)`).
- D'après ReDMCSB (`F142`), l'image au sol ne dépend que du type. La gourde vide a pourtant une image (37) : DM ne l'utilise pas au sol, nous non plus.
- **Écart entre les sources :** les descripteurs (données de DM pour Atari ST) donnent à Helm Of Darc et Dexhelm l'image de l'Armet (53). Les libellés de SCK les rangent avec le Basinet (10). On suit les données. Le test note l'exception.
- **Test :** `node tools/test-item-graphics.mjs`.
  - Les 611 objets du donjon ont une image et un indice global.
  - Chaque image est bien libellée du nom de son objet.
  - Cas du coffre, et des types inconnus.

## 3. Rendu : `src/render/first-person/fp-item-sprites.js`

- **Un `InstancedMesh` par image**, une instance par objet. Les infos de case sont dans `userData.tiles[i].item`, comme pour les blocs : le clic, l'infobulle et le ramassage marchent sans changement dans `main.js`.
- **Échelle :** 160 pixels par case, la même que les créatures. DM dessine les objets et les créatures à leur taille d'origine à D1 (`F115`). Une épée fait 0,45 case, une pièce 0,06.
- **Au sol :** plan vertical posé par le milieu de son bord bas, au centre de sa sous-case. Il reste parallèle à l'écran : son lacet suit la caméra (`face(turns)`, appelé par `placeCamera`, aussi pendant un quart de tour animé). Dans une pile, chaque objet est 0,012 case plus près du groupe que celui du dessous, pour être dessiné par-dessus. Les décalages de pile de DM viendront en I2.
- **En alcôve :** plan parallèle au mur, juste dans l'ouverture (0,47 case du centre du mur), posé sur le seuil (`NICHE.bottom`). Un billboard face à la caméra sortirait du mur pour une alcôve vue de côté. DM ne dessine d'ailleurs que les objets de l'alcôve d'en face. Trois places sur la largeur, puis une rangée plus près. Avec les décors peints (option « 3D objects » décochée), le plan passe juste devant le mur.
- **Lumière :** matériau Lambert passé par `patchMaterials` (lumière, arrêt par les murs). Sans `OCC_AT_POSITION`, le masque est lu un peu en avant du plan, vers le groupe. Pour un objet en alcôve, c'est donc la case d'en face, comme pour la face du mur.
- **Chargement :** les 86 textures sont demandées au premier niveau construit. Elles restent en cache, et le niveau est reconstruit à leur arrivée : les blocs s'affichent en attendant.
- **Option :** basculer « Original sprites » reconstruit maintenant tout le niveau, objets et créatures, au lieu des seules créatures.

## 4. Clic

- **Pixels transparents :** comme pour les créatures, un pixel transparent laisse passer le pointeur (`sprites.opaqueAt`, liste `SPRITE_PARTS`).
- **Zone de clic agrandie :** sur le sol d'une sous-case qui porte des objets, le clic prend l'objet du dessus, et l'infobulle le nomme. DM agrandit de même la zone des petits objets : une pièce ne fait que 10 pixels de large. Cela vaut aussi avec les blocs.

## 5. Vérifications (Chrome)

- **Niveau 1, (13, 8), face à l'est :** les bottes de cuir et la clé de la case du groupe sont à leur image. L'échelle est cohérente avec les murs et le porte-torche. Le clic ramasse les bottes, et l'infobulle les nomme.
- **Niveau 2, alcôve (31, 30) vue depuis (30, 30) :** pain, fromage, pilon et pomme sont posés sur le seuil.
- **Option :** décochée puis recochée, aucune erreur.
- **Tests Node :** les 17 passent.
- **Gel à surveiller :** au premier essai, un onglet a gelé juste après une téléportation par le menu de la carte (captures d'écran impossibles). Je ne l'ai pas reproduit : dans un nouvel onglet, la même téléportation a marché. La cause n'est pas identifiée. Le serveur Live Server recharge aussi la page à chaque fichier modifié : ce n'est pas un bug.

## 6. Suite

- **I2 :** décalages de pile de DM (item 558, « Coordinates to display stacks of items »), miroir à droite (coffre, boîtes magiques), réglage fin des positions d'après les jeux de coordonnées.
- **I3 :** projectiles.
- **I4 :** icônes dans les mains, le curseur et la barre d'inventaire (nom au survol).

## Sources

- Doc 072 et ses sources.
- Extraction locale de graphics.dat (SCK, Amiga 3.6), dossier indiqué par l'utilisateur : `/home/jhice/Gamedev/sck@1.5.1@20110502.0/sck/output/graphics.dat.bak/`.
- Dungeon Master Encyclopaedia, *Dungeon Master and Chaos Strikes Back Items properties* : http://dmweb.free.fr/community/documentation/dungeon-master-and-chaos-strikes-back/items-properties/ — table des 180 descripteurs d'objets (indice global, image au sol). Page téléchargée dans le dossier temporaire de la session et lue.
- Dungeon Master Encyclopaedia, *Graphics.dat Item 559* : http://dmweb.free.fr/community/documentation/dungeon-master-and-chaos-strikes-back/graphics.dat-item-559/ — format des descripteurs, cas du coffre.
- ReDMCSB Release 2 : https://github.com/gondur/ReDMCSB_Release2, `SOURCE/ENGINE/DUNGEON.C` (`F141`, `F142`) et `DUNVIEW.C` (`F115`).
