# 069 — Placement des sprites de créatures

Retours de l'utilisateur sur la phase S1 (doc 068), avec des captures de DM : les pieds trop hauts, les volants trop bas, les Magenta Worms qui dépassent dans les murs.

## Ce que fait DM

Source : item 558 de `graphics.dat` (Encyclopaedia) et `F115` de `DUNVIEW.C` (ReDMCSB).

- **Ancrage :** DM place chaque image par le milieu de son bord **inférieur**, sur des coordonnées données pour chaque case de la vue et chaque emplacement dans la case.
- **Trois jeux de coordonnées,** choisis par espèce (octet 11) :
  - **moyen (0) :** cas général ; à D1, Y = 103 rangée arrière, 111 centre, 119 rangée avant ;
  - **bas (1) :** Scorpion, Pain Rat, Ruster, Stone Golem, Black Flame, Couatl, Magenta Worm ;
  - **haut (2) :** Wizard Eye et Giant Wasp ; à D1, Y = 79, 81 et 85.
- **Créature seule :** au centre pour le jeu moyen. Pour le jeu bas, elle est sur la rangée avant, sauf une créature d'une demi-case vue de côté, qui reste au centre.
- **Créatures d'une demi-case (taille 1) :** leur place dépend de la vue, pas d'une sous-case. Vues de face, elles sont côte à côte sur la rangée avant. Vues de côté, l'une est derrière l'autre, dans l'axe de la case.

Les valeurs de `coordinateSet` sont lues sur la page de l'Encyclopaedia, à la main.

## Ce qui est fait

| Sujet | Réglage | Où |
|---|---|---|
| Pieds plus bas | Le plan avance de 0,22 case vers le groupe | `DEPTH_TOWARDS_PARTY`, `fp-sprites.js` |
| Volants | 30 pixels de D1 au-dessus du sol, soit l'écart entre les jeux 0 et 2 | `FLYING_HEIGHT`, `fp-sprites.js` |
| Jeu de chaque espèce | `coordinateSet` | `frames.json`, table du script d'export |
| Demi-cases, seul du jeu bas | `viewSpot()`, testé dans Node | `src/render/creature-views.js` |

**Pourquoi avancer plutôt que descendre :** un sprite descendu passerait sous le sol, qui le couperait. Avancer le plan produit le même effet à l'écran, et cela correspond à l'idée de l'utilisateur : les pieds sont à l'avant du volume que le plan remplace.

**Calcul du 0,22 :** avec notre caméra (œil à 0,42, FOV 62°, recul de 0,35), les pieds tombent à la hauteur d'écran de DM si le plan avance de la valeur ci-dessous. Une seule valeur suffit, car les écarts sont proches pour le centre et l'arrière.

| Position | Y de DM | Avance exacte depuis le centre de case | Obtenu |
|---|---|---|---|
| Rangée arrière | 103 | -0,01 | -0,03 |
| Centre | 111 | 0,25 | 0,22 |
| Rangée avant, seul ou demi-case | 119 | 0,42 | 0,42 (`FRONT_ROW` = 0,2 ; ramené ensuite à 0,01 par l'utilisateur, soit 0,23, doc 070) |
| Rangée avant, quart de case | 119 | 0,42 | 0,47 (sa sous-case) |

**Limite :** ces hauteurs sont relatives à l'écran. Notre champ de vision étant plus large que celui de DM, les créatures restent plus petites à l'écran que dans DM (une Mummy fait 60 % de la hauteur de vue dans DM), mais leur rapport avec le mur est le bon.

## Vérifications

- **Node :** `node tools/test-sprites.mjs`, avec les places de `viewSpot()`.
- **Chrome sans interface,** copie instrumentée, console sans erreur : Mummies, Black Flame, Worms de face et de côté (conformes aux captures de DM), Giant Wasp, Wizard Eye, Pain Rat, Dragon, Stone Golem, Trolins.
- **À regarder en jeu :** le disque de la Black Flame tombe devant le centre du trou au sol. C'est ce que disent les données de DM (rangée avant), mais je n'ai pas de capture du jeu pour le comparer.

## Pour plus tard

- **Regroupement :** demande de l'utilisateur, quand un groupe se réduit, ses créatures doivent se repositionner. Un Worm seul l'est déjà, le dernier survivant d'une demi-case étant placé par `viewSpot()`. Les créatures d'un quart de case gardent leur sous-case, et le survivant d'un groupe aussi.
- **Rotation des sous-cases :** dans DM, les cellules tournent avec le groupe (`F176`, `Cells`). La simulation ne le fait pas, ce qui n'a plus d'effet sur les demi-cases, mais en garde sur les quarts de case.
- **Autres D :** les coordonnées de D2 et D3 ne sont pas reprises : notre perspective s'en charge.
- **Mouvement sur place (S3) :** l'item 558 décrit aussi les petits décalages aléatoires de DM par espèce (`dx`, `dy` de 0 à ±2 pixels), différents selon l'espèce. Les frames des GIFs les contiennent peut-être déjà : à étudier en S3.

## Sources

- Dungeon Master Encyclopaedia, *Graphics.dat Item 558* : http://dmweb.free.fr/community/documentation/dungeon-master-and-chaos-strikes-back/graphics.dat-item-558/
- ReDMCSB Release 2, `SOURCE/ENGINE/DUNVIEW.C`, `F115` : https://github.com/gondur/ReDMCSB_Release2
- Captures de DM fournies par l'utilisateur (Magenta Worms de face et de côté).
