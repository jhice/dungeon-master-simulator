# 074 — Sprites des objets, I2 : piles, miroir et jeux de coordonnées de DM

Phase I2 du plan de la doc 072, après I1 (doc 073). Les objets de la vue du jeu sont placés comme DM les dessine (graphics.dat item 558, `F115` de `DUNVIEW.C`).

## 1. Données de DM (`src/core/item-graphics.js`)

Recopiées de la page *Graphics.dat Item 558* de l'Encyclopaedia, testées par `node tools/test-item-graphics.mjs`.

- **Piles** (`pileShift(cell, rang, enAlcôve)`) :
  - **Décalages :** 16 paires d'indices (G217) dans un jeu de décalages (G223). Le jeu 0, celui des images à leur taille (D0 au fond, D1 devant), vaut `0, 1, 2, 3, 0, −3, −2, −1` pixels. Plus loin, DM prend des décalages plus petits pour des images plus petites ; ici, la perspective s'en charge.
  - **Au sol :** le 1er objet d'une sous-case prend la paire 0, le suivant la paire 1, et ainsi de suite, modulo 16. Les sous-cases impaires (NE, SO) commencent à la paire 8.
  - **En alcôve :** la pile commence à la paire 2 et reste dans les paires 2 à 13. Une alcôve des faces est ou ouest commence à la paire 10.
- **Miroir à droite** (`flipsOnRight`) : coffre, boîte magique verte, boîte magique bleue. DM les dessine en miroir dans l'allée de droite ou dans la colonne de droite de l'allée centrale, jamais en alcôve.
- **Jeux de coordonnées** (`coordinateSet`) :
  - jeu 0 : 30 images, moyennes ;
  - jeu 1 : 50 images, petites ;
  - jeu 2 : 5 grandes images (arc, arbalète, cottes, plates, jambières).
  - Au sol, le jeu 1 ne diffère du jeu 0 qu'en alcôve. Le jeu 2 est dessiné 2 à 4 pixels plus bas, donc plus près.

## 2. Rendu (`fp-item-sprites.js`)

- **Ordre des piles d'abord :** DM dessine une pile dans l'ordre, le dernier objet posé par-dessus. Chaque objet est 0,02 case plus près du groupe que celui du dessous (`PILE_STEP`, 0,003 en alcôve). Les autres avancées restent sous ce pas, et ne changent donc jamais l'ordre.
  - **Correction, retour de l'utilisateur :** dans la première version, les Hosen restaient toujours devant. Leur image est du jeu 2, que j'avançais de 0,08 case, bien plus que le pas de pile (0,003). Le décalage vertical de pile (±0,075 case) pouvait de même inverser deux objets.
- **Pile au sol :**
  - Un pixel vers la droite vaut 1/160 de case, sur le côté de la vue.
  - Un pixel vers le bas de l'écran avance l'objet de 0,002 case seulement (`PILE_DEPTH_PER_PIXEL`). Avec le jeu 2, l'écart va de −3 à +6 pixels, soit 0,018 case, sous le pas de 0,02.
  - Le tout suit la direction de la vue, comme la poussée de la rangée du fond (doc 073).
- **Pile en alcôve :** même décalage sur la largeur ; vers le bas, presque rien, car l'objet doit aussi rester dans l'ouverture. Les trois places sur la largeur de I1 disparaissent : comme dans DM, les objets d'une alcôve s'empilent presque l'un sur l'autre, et le dernier posé cache en partie les autres.
- **Jeu 2 :** 3 pixels plus bas que le jeu 0 (`SET_2_LOWER`), donc un peu plus près, dans la limite du pas de pile.
- **Miroir :**
  - Une échelle négative sur l'instance renversait la normale : le coffre en miroir était noir.
  - Les trois images concernées ont donc une **jumelle**, un `InstancedMesh` aux UV inversées. Chaque objet est montré par l'une des deux, et l'autre le cache (échelle nulle).
  - Le côté est recalculé à chaque mouvement de la caméra (`face({ x, y, turns })`, appelé par `placeCamera`) : il bascule quand l'objet passe à droite de la colonne du groupe.
  - La sphère englobante des jumelles est recalculée à chaque fois, pour le clic et le découpage.
  - Comme les UV sont inversées dans la géométrie, la lecture de l'alpha au clic (`opaqueAt`) reste juste.
- **Non fait :**
  - Jeu 1 en alcôve : DM dessine les petits objets 5 pixels plus haut, sans doute plus au fond du creux. Le fond de l'alcôve est dans la case du mur, et y placer l'objet changerait sa lumière (doc 073, § 3). Je l'ai laissé.
  - Écart latéral des objets lointains : DM met la rangée du fond de D1 à ±0,29 case de l'axe, contre ±0,25 ici. Sa perspective n'est pas exactement la nôtre, et l'écart reste faible.

## 3. Vérifications (Chrome)

- **Alcôve du niveau 2 en (31, 30) :** les 4 vivres s'empilent au milieu. Le fromage, dernier de la liste, passe devant.
- **Coffre du niveau 2 en (16, 13), sous-case NE :**
  - vu vers l'est, il est à gauche et pas en miroir ;
  - vu vers le nord, il est à droite, en miroir et correctement éclairé ;
  - le clic sur l'instance en miroir le ramasse.
- **Pile de trois vêtements** posés dans une même sous-case : légers décalages, le dernier posé dessus.
- **Après la correction :** des Blue Pants posées sur des Hosen passent devant elles.
- **Tests Node :** les 17 passent.
- **Le « gel » de Chrome (doc 073, § 5) n'en est pas un.** `requestAnimationFrame` ne tournait plus qu'une fois par seconde, sans aucune tâche longue : Chrome ralentit ainsi une fenêtre masquée ou recouverte, et ses captures d'écran expirent. Ce n'est pas le code du projet.

## Sources

- Dungeon Master Encyclopaedia, *Graphics.dat Item 558* : http://dmweb.free.fr/community/documentation/dungeon-master-and-chaos-strikes-back/graphics.dat-item-558/
  - « Items graphics definitions » : drapeaux et jeu de coordonnées de chaque image ;
  - « Coordinates to display items » : les trois jeux ;
  - « Coordinates to display stacks of items » : les paires de la pile ;
  - « Creature images shifts for animations » : les jeux de décalages G223.
  - Page déjà téléchargée pour la doc 072, relue.
- ReDMCSB Release 2 : https://github.com/gondur/ReDMCSB_Release2, `SOURCE/ENGINE/DUNVIEW.C` (`F115`) : début de la pile au sol et en alcôve, paire suivante, choix du jeu de décalages, conditions du miroir.
