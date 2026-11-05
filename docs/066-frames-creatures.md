# 066 — Frames des créatures

Demande de l'utilisateur : exporter chaque frame des GIFs de `assets/creatures/`, un sous-dossier par créature. Ces images remplaceront plus tard les modèles 3D, sans doute en billboards. Rien n'est encore branché dans le rendu.

## Outil

`python3 tools/extract-creature-frames.py` (Python 3 et Pillow, seuls outils d'image présents sur la machine). On peut le relancer : il remplace les PNG des sous-dossiers et réécrit les autres sorties.

| Sortie | Contenu |
|---|---|
| `assets/creatures/<Nom>/NN[-rôle].png` | Une image par frame : 27 créatures, 184 frames. Fond transparent, toutes au format du GIF, donc alignées entre elles |
| `assets/creatures/frames.json` | Pour chaque créature : espèce (`type` de `creature-info.js`), taille, `hasViews`, `attack`, `attackMirror`, et par frame le fichier, la durée, le rôle, `sameAs` si elle répète une frame précédente |
| `docs/assets/creature-frames.png` | Planche de contrôle, attaque encadrée en rouge |

Le nom du dossier vient du nom du fichier (`…,Creature,<Nom>,Screenshot.gif`). Les rôles sont `front`, `side`, `back`, `side2` et `attack`. Les frames sans rôle gardent leur seul numéro.

## Structure des GIFs

**18 créatures** suivent le schéma attendu, avec une quatrième vue en plus : 0 face, 1 côté, 2 dos, **3 autre côté**, puis l'animation. L'autre côté existe donc déjà dans le GIF. C'est le miroir exact de la frame 1 pour 9 de ces créatures. Pour les 9 autres, ce n'est pas un miroir exact.

**9 créatures n'ont ni côté ni dos.** Leurs premières frames sont une animation sur place, et seule la frame 0 reçoit le rôle `front` :

- 7 animées : Black Flame, Ghost, Rock Pile, Screamer, Swamp Slime, Water Elemental, Wizard Eye ;
- 2 réduites à une seule image : Grey Lord et Lord Order.

**Materializer** compte parmi les 18 : il suit le schéma des vues, mais son dos (frame 2) ne montre que l'œil.

## Attaques

Choisies à l'œil, **validées par l'utilisateur sur la planche**. Pour changer : table `ATTACK` du script, puis relancer.

| Frame | Créatures |
|---|---|
| 1 | Rock Pile, Screamer |
| 2 | Water Elemental |
| 3 | Black Flame, Swamp Slime |
| 4 | Ghost, Wizard Eye |
| 5 | Lord Chaos, Magenta Worm, Mummy, Ruster, Scorpion, Stone Golem, Vexirk |
| 6 | Dragon, Pain Rat, Skeleton |
| 7 | Animated Armour, Demon, Oitu, Trolin |
| 8 | Couatl, Giant Wasp |
| 9 | Materializer |
| aucune | Giggler, Grey Lord, Lord Order |

**Remarques :**

- **Giggler :** ses frames 4 à 6 ne sont que de petits décalages de la face, aucune ne se distingue. Il vole au lieu d'attaquer.
- **Screamer :** deux frames seulement, l'attaque est la 1 (trous sombres sur le chapeau).
- **Rock Pile et Water Elemental :** l'attaque est la forme réveillée ou dressée.
- **Materializer :** les frames 9 à 11 montrent la forme pleine.

Quand l'attaque a un miroir exact dans le GIF, `attackMirror` le donne : Ghost, Magenta Worm, Rock Pile, Scorpion, Swamp Slime, Water Elemental. Couatl (9), Pain Rat (8), Oitu (8), Giant Wasp (9) et Animated Armour (8) ont une frame qui y ressemble, mais pas au pixel près.

## Retours de l'utilisateur

- **Vue unique :** les 9 créatures sans vues montrent bien la même image de tous les côtés.
- **Attaques :** celles de la planche sont les bonnes.
- **Grey Lord et Lord Order :** personnages de la fin du jeu, de mémoire de l'utilisateur, et pas des créatures qu'on attaque. Le donjon n'en place aucun : ses groupes n'utilisent que les types 0 à 24. Leurs images restent en réserve, sans usage pour l'instant.
- **Ombres :** elles restent dans le sprite. Elles sont dessinées en noir opaque et resteront donc debout avec l'image.
- **Point d'ancrage :** centré en bas de l'image.
- **Autre côté :** `side2` peut servir directement, sans transformation.

## Faits utiles pour les billboards

Le plan est dans la [doc 067](067-sprites-creatures-plan.md).

- **Sens des profils :** vérifié sur la planche, `side` regarde vers la droite de l'image, `side2` vers la gauche. Seul le Materializer ne permet pas de le dire, son profil étant trop abstrait.
- **Noir :** le dos de Lord Chaos (frame 2) est une silhouette presque entièrement noire. Elle est bien opaque dans le GIF, ce n'est pas une erreur d'export.
- **Noms :** Scorpion, Rock Pile et Dragon s'appellent Giant Scorpion, Rockpile et Red Dragon dans `creature-info.js`. Le champ `type` de `frames.json` fait le lien. Grey Lord et Lord Order n'ont pas d'espèce (`type: null`).

## Sources

- GIFs de `assets/creatures/`, fournis par l'utilisateur (voir `000-sources.md`).
- Pillow (https://python-pillow.org/) : lecture des GIFs et écriture des PNG.
