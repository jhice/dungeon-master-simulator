# 062 — Transitions, T1 : déplacements animés du groupe

> Première étape du plan de la [doc 061](061-transitions-plan.md), avec coupe nette aux escaliers, trappes et téléporteurs.
> Durées choisies par l'utilisateur après essais : **300 ms** par pas et par quart de tour.
> Seule la vue à la 1re personne est animée. Créatures, projectiles et marqueurs des cartes restent en sauts de case : **T2 à T5 sont en attente, à la demande de l'utilisateur.**

## Ce qui change pour le joueur

- Un pas et un quart de tour glissent au lieu de sauter.
- **Une pression, une commande :** maintenir une touche ne répète rien, en mode animé comme en mode instantané (choix de l'utilisateur).
- Une touche pressée pendant un mouvement attend dans une file de **5 commandes**, comme DM ; au-delà, elle est ignorée.
- Heurter un mur ou une créature donne un petit à-coup, en plus du flash, du son et des dégâts habituels.
- Escaliers, trappes et téléporteurs coupent net, comme avant.
- Panneau, section « Moves (game view) » : case « Animated moves », durées du pas (100 à 440 ms) et du quart de tour (80 à 400 ms). « Valeurs par défaut » les remet en place. Sans animation, le jeu se comporte comme avant.

## Comment c'est construit

| Fichier | Rôle |
|---|---|
| `src/render/motion.js` | Interpolation de nombres, sans DOM ni Three.js. Aucune règle ne la lit |
| `src/render/animation-settings.js` | Réglages et valeurs par défaut |
| `src/sim/controls.js` | File de commandes, une commande par animation |
| `src/render/first-person/fp-renderer.js` | Caméra placée d'après `motion`, boucle de rendu, `setParty(party, duration)`, `bump(side, duration)` |
| `src/main.js` | Choisit quels mouvements sont animés, panneau |
| `src/sim/simulation.js` | Seul ajout : `blocked` donne aussi `command`, pour le sens de l'à-coup |

- **La simulation reste sur sa grille.** La commande part au début du glissement : la position logique est déjà celle d'arrivée, le pas est refusé ou non dès ce moment.
- **Boucle à la demande.** `requestAnimationFrame` ne tourne que pendant une animation. Pendant ce temps, les autres demandes de rendu attendent l'image suivante.
- **Masques de lumière (doc 038).** Pendant un mouvement, seul le masque de la lumière du groupe est recalculé, à chaque image (voir ci-dessous).
- **Courbes.** Pas : moitié linéaire, moitié `smoothstep`, pour que des pas enchaînés ne pulsent pas trop. Rotation : `smoothstep`.
- **File vidée** à la remise à zéro et à la fermeture du jeu.

## Correction après essais : murs noirs pendant une rotation

**Constat de l'utilisateur :** certains murs restent noirs jusqu'à la fin de la rotation.

**Cause :** l'œil, reculé de `pullBack`, tourne autour du centre de la case sans en sortir. La première version ne recalculait les masques qu'au changement de case et à l'arrêt, alors que l'œil voit en tournant des murs que sa position de départ n'éclaire pas. C'est le cas d'environ 80 % des rotations sur les niveaux 0 et 1 (476 sur 572, 1646 sur 2080, à mi-rotation et à la portée par défaut).

**Première correction :** le masque suit l'œil pendant le mouvement. Les porte-torches ne bougent pas, leurs masques sont gardés, et le tableau est réécrit en place.

**Défaut restant, signalé par l'utilisateur :** une mince bande de mur reste noire, vue en rasant un coin. Les masques venaient de rayons tirés vers 5 points de chaque case, et une bande étroite passe entre ces points. Mesure sur les niveaux 0 et 1, en comparant à une ligne de vue très fine :

| Calcul | Points de murs visibles laissés noirs | Coût par calcul |
|---|---|---|
| 5 points, pas du rayon 0,05 (d'origine) | 1266 sur 1,45 million | 0,43 ms |
| 5 points, pas du rayon 0,01 | 2231 | 2 ms |
| 65 points, pas du rayon 0,02 | 127 | 9,6 ms |

Réduire `RAY_STEP` ne pouvait donc pas aider : le défaut vient du nombre de points, et un pas fin laisse moins de rayons frôler les coins.

**Correction définitive :** `src/render/first-person/light-masks.js` ne tire plus de rayons. Les cases sont prises de la plus proche à la plus lointaine, chaque case opaque masque le secteur d'angle qu'elle couvre, et une case est vue s'il lui reste un angle libre. Le long d'un rayon, les cases traversées ne se rapprochent jamais de la lumière, donc celles qui masquent une case passent toujours avant elle.

**Résultat, niveaux 0, 1 et 5, 16 254 positions de l'œil :** sur 7,3 millions de points visibles, 616 restent noirs, tous à 45° exactement entre deux coins, dans un passage de largeur nulle, donc invisibles à l'écran. Coût en Node, niveau 0 : 0,03 ms en moyenne à la portée par défaut, assez peu pour recalculer à chaque image.

## Vérifications

**Tests Node :** `node tools/test-motion.mjs` est nouveau ; les 13 autres scripts passent sans modification.

**Dans Chrome (niveaux 0 et 1, écran rapide, sans capture du ressenti) :**

| Cas | Résultat |
|---|---|
| Repos, y compris après un mouvement | 0 image dessinée |
| Dessin d'une image pendant un mouvement | 0,2 à 0,5 ms en moyenne, 2,4 ms au plus (sur le niveau 0, en lumière permanente) |
| Pas, en 5 images prises à 0, 70, 140, 210 et 270 ms | Avancée progressive, sans anomalie visible |
| Pas + rotation pressés ensemble | Exécutés l'un après l'autre |
| À-coup contre un mur | Le groupe ne bouge pas, retour au repos |
| Mode instantané | 2 pressions = 2 cases et 2 images, aucune boucle |
| Escalier du niveau 0 au niveau 1 | Coupe immédiate, puis rotation animée sur le nouveau niveau |
| Curseur et « Valeurs par défaut » | Enregistré, puis remis à 280 ms |

**Vérifié par l'utilisateur en jeu :** clic pendant un glissement, chute dans une trappe, téléporteur, plaques de pression, disparition des bandes noires. Durées réglées à 300 ms après essais.

## Écarts connus à ce stade

- **Le groupe peut encore aller plus vite que DM** (440 ms au moins par pas) : c'est le choix de 280 ms par défaut, réglable (doc 061, Q1). Le délai selon la charge (`F310`) n'est pas repris.
- **Plus de répétition au maintien d'une touche,** par choix de l'utilisateur.
- **Les rotations sont limitées à leur durée d'animation,** alors que DM ne leur impose pas de délai.
- **Les cartes 2D et 3D sautent** de case en case : le marqueur y arrive avant la caméra.
- **Plaques et mécanismes réagissent au début du pas** (doc 061, § 1).
