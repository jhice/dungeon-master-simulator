# 070 — Sprites des créatures, phase S2 : image d'attaque

Réalisation de la phase S2 du plan (doc 067). Quand un groupe attaque, touché ou non (`championHit` avec `group`), un de ses membres montre son image d'attaque, puis revient à sa vue.

## Règles reprises de DM

| Règle | Source | Où |
|---|---|---|
| L'attaque ne remplace que la **face** : vue de côté ou de dos, elle ne se voit pas. Une espèce à vue unique la montre de partout | `F115`, `DUNVIEW.C` | `viewFrame()`, `creature-views.js` |
| Durée propre à chaque espèce, de 1 tick (Skeleton, Couatl…) à 6 (Vexirk) | *Next attack aspect update ticks* ; `F179`, `GROUP1.C` | `attackTicks`, `frames.json` |
| Miroir au hasard, à chaque attaque, pour 18 espèces | *Flip Attack* ; `F179` | `flipAttack`, `frames.json` |

Le miroir se fait en code, en inversant le U du plan du sprite. Le test du pixel sous le pointeur reste donc juste, et il n'y a pas besoin d'une frame miroir dans le GIF : `attackMirror` de `frames.json` n'est plus lu.

## Écarts avec DM

- **Un seul membre attaque :** la simulation a une attaque par groupe, alors que DM en a une par créature. Le membre qui la montre est tiré au hasard dans la rangée la plus proche du groupe du joueur.
- **Miroir pendant l'attaque :** *Flip During Attack* (Swamp Slime, Vexirk, Dragon) n'est pas repris. Le miroir est tiré une fois par attaque.
- **Temps :** la durée suit l'horloge du rendu (`setTimeout`, `TICK_MS`), pas la simulation. C'est sans effet sur le jeu.

## Correction : le Ruster n'a pas d'image d'attaque

La table de l'Encyclopaedia indique *Attack* : non pour le Ruster et le Giggler. Vérification faite sur les pixels, la frame 5 du Ruster, marquée « attaque » à la doc 066 et validée sur la planche, est **sa face en miroir**, décalée. Elle s'appelle maintenant `05.png`, et le Ruster attaque sans changer d'image, comme dans DM. Pour revenir en arrière : table `ATTACK` du script d'export.

Le Giggler n'avait déjà pas d'attaque. Les 23 autres espèces du donjon ont la leur.

## Vérifications

- **Node :** `node tools/test-sprites.mjs` : image selon la vue, chargement, durées, espèces sans attaque.
- **Chrome sans interface,** copie instrumentée, console sans erreur :
  - Mummies (un seul membre de la rangée avant lève les bras), Magenta Worm, Wizard Eye, Dragon, Ghost, Ruster inchangé ;
  - une vraie attaque du Dragon montre l'image ;
  - déclenchée à la main alors que Zed est mort : l'image est là à 100 ms, et la face est revenue à 1 200 ms (Dragon, 4 ticks, soit 880 ms).
- **Pas vérifié :** une partie jouée à la main ; le miroir n'a été vu que par hasard, sur un Worm.

## Réglage de l'utilisateur

`FRONT_ROW` est passé de 0,2 à 0,01 (`creature-views.js`), réglé à l'œil en jeu. Cette constante sert à la fois à la rangée avant des créatures seules et à l'écart entre deux créatures d'une demi-case vues de côté : les deux Worms sont donc presque l'un sur l'autre dans cette vue, alors que DM les sépare (doc 069). À trancher : deux constantes distinctes règleraient ça.

## Sources

- ReDMCSB Release 2, `SOURCE/ENGINE/DUNVIEW.C` (`F115`), `GROUP1.C` (`F179`), `DEFS.H` : https://github.com/gondur/ReDMCSB_Release2
- Dungeon Master Encyclopaedia, *Creature Details* : http://dmweb.free.fr/community/documentation/dungeon-master-and-chaos-strikes-back/creature-details/
