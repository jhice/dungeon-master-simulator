# 071 — Sprites des créatures, phase S3 : mouvement sur place

Réalisation de la phase S3 du plan (doc 067), et réglage de l'espacement des groupes. C'est la dernière phase du plan.

## Changement par rapport au plan

Le plan recommandait de garder les frames des GIFs. L'analyse pixel par pixel a montré que **ces frames sont presque toutes la face décalée de quelques pixels ou mise en miroir** : les GIFs enregistrent l'animation que DM calcule en jeu. Le mouvement est donc codé d'après les règles de DM, avec trois avantages :

- pas de frames à charger ni à ordonner ;
- le rythme est celui de DM, propre à chaque espèce ;
- les profils et le dos bougent aussi, ce que les GIFs ne montrent pas.

**Exceptions à cette analyse :** Black Flame (frames 1 et 4) et Pain Rat (frames 4, 5, 7, 8) ont des frames qui diffèrent aussi autrement. Elles ne sont pas utilisées. Je n'ai pas cherché d'où viennent ces différences.

## Règles reprises de DM

Source : `F179` (`GROUP1.C`), `F115` (`DUNVIEW.C`), colonnes de *Creature Details*.

- **Rythme :** toutes les *Non attack aspect update ticks* de l'espèce, soit de 1 tick (Wizard Eye, Giant Wasp, Ghost, Black Flame…) à 15 (Screamer, Rockpile, Stone Golem). Tout le groupe bouge en même temps, chaque membre avec son propre tirage.
- **Décalage :** tiré de -(n-1) à n-1 pixels de D1, d'après *Maximum Horizontal / Vertical Offset* (`idleOffset`). Pour n = 1 : aucun décalage.
- **Miroir :** au hasard, sur la face seulement, pour les espèces à *Flip Non Attack* (`idleFlip`).
- **Sans aucun mouvement :** Mummy, Vexirk, Screamer, Rockpile, Lord Chaos.

## Réalisation

- `rollIdle()` et `hasIdle()`, `src/render/creature-views.js`, testés dans Node.
- `tick()` de `fp-sprites.js`, appelé par l'horloge du jeu (`view.tick()`, `main.js`), à 220 ms.
- **Coût :** une image n'est demandée que si un groupe proche a bougé. Au-delà de 4 cases du groupe, plus rien n'est mis à jour, car DM ne dessine pas si loin.

## Écarts avec DM

- **Vers le bas :** une créature au sol s'arrête au niveau du sol, sinon il lui couperait les pieds. Elle bouge donc moins vers le bas que dans DM.
- **Pendant une attaque :** le mouvement continue, alors que DM attend la fin de l'image d'attaque. Le miroir de l'attaque reste celui de son propre tirage.
- **Départ :** chaque groupe commence à un moment au hasard, pour que les groupes en vue ne bougent pas ensemble.

## Espacement des groupes

`GROUP_SPREAD` (`fp-sprites.js`, 0,8) rapproche du centre de la case les créatures d'un quart de case, sans toucher à `SUBCELLS`, que partagent les objets et les cartes. 1 rend les sous-cases telles quelles ; 0,8 donne ±0,20, entre les ±0,22 et ±0,18 de DM à D1.

Les créatures d'une demi-case ont leur propre écart (`HALF_COLUMN`, `creature-views.js`).

`FRONT_ROW` est revenu à 0,2 par l'utilisateur : la question posée à la doc 070 est close.

## Vérifications

- **Node :** `node tools/test-sprites.mjs` : tirages du Dragon et du Stone Golem conformes à l'Encyclopaedia, espèces sans mouvement, données de toutes les espèces.
- **Chrome sans interface,** copie instrumentée, console sans erreur, 4 captures à 500 ms d'intervalle : Trolin, Giant Wasp et Black Flame changent à chaque capture ; Screamer et Mummy ne changent pas.
- **Pas vérifié :** le rendu à la main dans une vraie partie, ni la fluidité ressentie.

## Sources

- ReDMCSB Release 2, `SOURCE/ENGINE/GROUP1.C` (`F179`), `DUNVIEW.C` (`F115`), `DEFS.H` : https://github.com/gondur/ReDMCSB_Release2
- Dungeon Master Encyclopaedia, *Creature Details* et *Graphics.dat Item 558* : http://dmweb.free.fr/community/documentation/dungeon-master-and-chaos-strikes-back/creature-details/
