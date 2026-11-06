# 076 — Sprites des objets, I4 : icônes

Phase I4, la dernière du plan de la doc 072. Dans l'interface du jeu, les objets sont montrés par leur icône de DM, à la place des carrés de couleur :
- les deux mains de Zed ;
- le curseur qui tient un objet ;
- la case « en main » et la barre d'inventaire du bas de la fenêtre, où le nom passe au survol, comme demandé.

## 1. Images

- `tools/extract-item-graphics.py` assemble les graphismes 42 à 48 dans `assets/items/icons.png` : 7 planches de 256 × 32 empilées, 224 icônes de 16 × 16. L'icône *n* est en x = (n % 16) × 16, y = ⌊n / 16⌋ × 16.
- **Couleur 12 :** c'est le gris `#444444` du fond des cases. DM dessine les icônes sans transparence, sur ce gris (`F038`, `CM1_COLOR_NO_TRANSPARENCY`). Ici, elle est transparente, car il le faut pour le curseur. Les cases reprennent ce gris en fond (`ICON_BACKGROUND`, CSS).

## 2. Icône d'un objet (`itemIcon`, `src/core/item-graphics.js`)

L'icône est l'**indice global** de l'objet (doc 073), modifié selon son état comme le fait `F033` (ReDMCSB, `OBJECT.C`) :

| Objet | Icône |
|---|---|
| Boussole | 0 à 3, l'aiguille suit la direction du groupe |
| Torche | éteinte 4 ; allumée 5 à 7 selon ses charges (table G029 : 0, 1, 1, 1, 2, 2, 2, 2, 3…) |
| Parchemin | fermé (31), car le jeu ne sait pas encore ouvrir un parchemin |
| Gourde | vide 8, avec de l'eau 9 |
| Eye Of Time, Stormring, Flamitt, Staff Of Claws, Bolt Blade, Fury | « vide » sans charges, l'icône suivante avec |

- Illumulet et Jewel Symal changent aussi d'icône dans DM, quand ils sont portés. Le jeu n'a pas encore d'emplacements de corps : ces deux objets gardent l'icône « non porté ».
- **Tests** (`node tools/test-item-graphics.mjs`) :
  - les 611 objets du donjon ont une icône valide ;
  - la boussole, la torche (éteinte, faible, pleine), le parchemin et l'Eye Of Time donnent la bonne icône.

## 3. Interface (`src/ui/item-icons.js`)

- **`paintIcon(élément, icône)` :** l'icône en fond CSS (classe `item-icon`), en pourcentage de l'atlas (`1600% 1400%`). N'importe quel élément carré la montre à sa taille, en pixels nets. Les mains de Zed, dimensionnées en `cqw`, grandissent donc avec la fenêtre.
- **`iconCursor(icône)` :** le curseur d'un objet tenu.
  - C'est l'icône agrandie deux fois, avec un fin contour sombre pour rester visible sur un sol sombre.
  - Le point chaud est au milieu : comme dans DM, l'objet est là où pointe la souris.
  - L'image est construite une fois par icône depuis l'atlas (canvas → data URL).
  - Tant que l'atlas n'est pas chargé, on garde l'ancien carré de couleur (`iconsReady` relance l'affichage une fois l'atlas prêt).
- **Mains de Zed** (`champion-panel.js`) : l'icône par-dessus le gris de la case.
- **Barre d'inventaire** (`game-window.js`) :
  - case « en main » et une case par objet, en carrés de 2,25 rem ;
  - le nom et les détails au survol (`title`), le nom pour les lecteurs d'écran (`aria-label`).
- **Mises à jour :**
  - à chaque changement de l'inventaire ou des mains, comme avant ;
  - quand une torche s'use (`torchesWorn`) ;
  - quand le groupe tourne (`showParty`), pour l'aiguille de la boussole.

## 4. Vérifications (Chrome)

- La barre d'inventaire du départ montre les icônes : Mail Aketon, Blue Pants, Torch, Hosen.
- Une torche prise en main puis mise dans la main droite de Zed passe à l'icône allumée.
- Avec la Mail Aketon en main :
  - le curseur de la vue du jeu est son icône (34 × 34, point chaud 16, 16) ;
  - la case « en main » donne au survol « Held: MAIL AKETON » et son poids.
- **Tests Node :** les 17 passent.

## 5. Bilan du plan 072

| Phase | Doc | Contenu |
|---|---|---|
| I1 | 073 | Images au sol et en alcôve, table objet → image, clic, rangée du fond poussée |
| I2 | 074 | Piles de DM, miroir à droite, jeux de coordonnées, ordre des piles |
| I3 | 075 | Projectiles et sorts en vol, hauteur de vol réglée par l'utilisateur |
| I4 | 076 | Icônes : mains, curseur, barre d'inventaire |

## Sources

- ReDMCSB Release 2 : https://github.com/gondur/ReDMCSB_Release2, `SOURCE/ENGINE/OBJECT.C` (`F033`, icône selon l'état ; `F038`, icône dessinée sans transparence). Fichier lu dans le dossier temporaire de la session.
- ScummVM, moteur DM : https://github.com/scummvm/scummvm, `engines/dm/objectman.cpp`. Seule la table `chargeCountToTorchType` (G029, graphics.dat item 562) est reprise. Fichier lu dans le dossier temporaire.
- Extraction locale de graphics.dat (SCK) de l'utilisateur, graphismes 42 à 48.
- Dungeon Master Encyclopaedia, *Items properties* : indices globaux (doc 073).
