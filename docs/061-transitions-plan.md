# 061 — Transitions animées : plan de travail (phase F)

> Demande de l'utilisateur : [012-simulation.md](012-simulation.md), phase F, « transitions animées et option instantané / transition »,
> pour le déplacement du groupe, des créatures et des projectiles.
> **Document de planification.** Rien n'est implémenté ici. Le 16/9 et la sauvegarde de partie, aussi en phase F, restent à part.
> Les questions du § 7 sont à trancher avant T1.

## 1. Le principe : la simulation reste sur la grille

**La simulation ne change pas de nature.** Le groupe, les créatures et les projectiles restent sur des cases entières, à chaque tick.
Le mouvement fluide est une **interpolation d'affichage**, calculée dans le rendu entre deux états logiques :

| Couche | Contenu | Change ? |
|---|---|---|
| Simulation (`src/sim/`) | positions logiques en cases : collisions, plaques, attaques, perception | Presque pas (§ 5) |
| État visuel (nouveau) | position et angle **affichés**, en flottants, pour chaque entité en mouvement | Nouveau, jetable |
| Renderers | dessinent l'état visuel | Oui |

**Il ne faut donc pas calculer de position sur la grille en temps réel.** La position logique existe déjà et reste la seule vérité. L'information circule
dans un seul sens, de la simulation vers l'affichage : aucune règle ne lit jamais une position affichée. On peut supprimer l'état visuel
à tout moment (mode instantané, chute, téléporteur) sans effet sur la partie.

L'inverse, une simulation en positions continues dont on déduirait la case, compliquerait beaucoup :

- il faudrait décider à quel instant une entité change de case, donc revoir plaques, portes qui se ferment, occupation des cases et perception ;
- la fidélité à ReDMCSB, fondée sur les ticks et les cases (doc 026), serait perdue ;
- les 13 scripts de tests seraient à revoir, alors qu'ils restent valables avec une simple interpolation.

### Conséquence à accepter

La logique est **en avance** sur l'image : quand un pas commence, le groupe occupe déjà la case d'arrivée, et la plaque réagit dès le début du glissement.
Sur une durée d'environ 250 ms, cela ne devrait pas gêner. C'est à confirmer à l'essai, dès T1. Si le décalage se voit, on pourra retarder
les effets d'arrivée à la fin du glissement, sans toucher aux règles.

## 2. Ce que fait l'original

Sources : ReDMCSB, `COMMAND.C`, `CHAMPION.C`, `MAIN.C`, voir [000-sources.md](000-sources.md).

- Après un pas, les commandes de déplacement sont **refusées pendant `G310_i_DisabledMovementTicks`**, décrémenté à chaque tick.
- Ce délai vaut le maximum, parmi les champions vivants, de `F310` : **2 ticks** à charge légère, 3 au-delà de 5/8 de la charge maximale, 4 et plus en surcharge ;
  plus 1 ou 2 si les pieds sont blessés, moins 1 avec les Boots of Speed.
- Les **rotations ne sont pas soumises à ce délai**.
- Les commandes attendent dans une **file de 5 places**.

**Écart actuel :** `REPEAT_MS` (`controls.js`) permet un pas toutes les 160 ms sans condition de charge. Avec un tick à 220 ms (doc 047), DM en demanderait au moins **440 ms**.
Le groupe va donc 2,75 fois plus vite que l'original, alors que le reste du monde suit ses vrais ticks. En mode instantané cela ne se remarque guère ;
une fois les mouvements visibles, si (voir question Q1).

## 3. Le socle : `src/render/motion.js`

Un module sans DOM ni Three.js, testable dans Node (`tools/test-motion.mjs`) :

- `move(key, from, to, durationMs, easing)` : démarre une interpolation, en repartant de la position **affichée** si la précédente n'est pas finie ;
- `sample(key, now)` : position et angle du moment ;
- `active` : reste-t-il une interpolation en cours ?

Clés : le groupe, chaque groupe de créatures (`group`), chaque projectile (`id`). L'état étant rangé **hors des meshes**, il survit aux reconstructions de niveau (cran de porte, levier).

**Boucle de rendu.** La vue à la 1re personne rend à la demande. Elle garde ce principe : une boucle `requestAnimationFrame` tourne **seulement tant que `active` est vrai**, puis s'arrête.

**Mode instantané.** Une durée de 0 prend le même chemin de code. Réglages dans `animation-settings.js` et une section du panneau, avec le bouton « Valeurs par défaut » existant.

## 4. Par type d'entité

### Groupe

- **Pas :** `placeCamera()` prend une position et un angle flottants. La lumière du groupe est un enfant de la caméra : elle suit toute seule.
- **Rotation :** interpolation de l'angle par le chemin le plus court. La caméra tourne autour du centre de la case, à `pullBack` = 0,35, donc reste dans la case (< 0,5).
- **Entrées :** `controls.js` passe à une file courte (2 commandes). La commande suivante part à la fin du glissement, qu'elle peut raccourcir. La simulation reçoit la commande **au départ** de son glissement : le résultat (bloqué, chute) est donc connu dès ce moment.
- **Mur heurté :** petit à-coup aller-retour, en plus du son et des 2 PV (doc 045). Peu coûteux, et le choc se comprend mieux.
- **Escaliers, trappes, téléporteurs :** coupe nette, comme aujourd'hui. Le critère existe déjà : `partyMoved` donne `from`, `kind` et `effects`. On n'anime que `kind: 'step'`, sans effet, ainsi que les rotations.

### Projectiles

Le cas le plus simple : `projectiles.on()` donne déjà un `id`, un sous-case et une direction, à raison d'un demi-case par tick.

**Extrapoler plutôt qu'interpoler.** On anime du point actuel vers le **point suivant**, à vitesse constante, jusqu'au tick suivant :

- l'interpolation vers le dernier point afficherait le projectile avec un tick de retard : une boule de feu exploserait et sonnerait 220 ms avant d'avoir touché ;
- avec l'extrapolation, le projectile arrive à l'instant où la simulation résout le choc, l'image et le son coïncident ;
- seul ajustement : s'arrêter à la face du mur quand la case suivante ne laisse pas passer. `on()` pourra indiquer ce point d'arrêt (seul ajout à la simulation).

### Créatures

- **Données :** `creaturesMoved` donne déjà `from`, `to`, `turned`, `carried`. On coupe net si `carried` ou s'il y a changement de niveau.
- **Durée :** `moveTicks` varie de 1 (Giant Wasp) à 185 (Rockpile). Répartir le glissement sur tout l'intervalle donnerait un Rockpile qui rampe pendant 40 secondes ; une durée fixe donnerait des pas suivis de pauses. Proposition : `min(moveTicks × tick, 400 ms)`.
- **Rendu, le vrai morceau :** les créatures sont des `InstancedMesh` reconstruits à chaque mouvement (`buildLevelCreatures`). Il faut :
  - garder l'origine de chaque instance (groupe, membre) ;
  - réécrire les matrices des instances en mouvement à chaque image, y compris juste après une reconstruction ;
  - recalculer la sphère englobante : dans Three.js 0.170, l'`InstancedMesh` s'en sert pour le culling et le raycasting, et une sphère périmée ferait disparaître les créatures ou les rendrait incliquables.
- **Partage :** ce code sert aussi à la carte 3D (`level-contents.js`).

### Cartes 2D et 3D

- **3D :** le marqueur du groupe et les créatures utilisent `motion.js` ; la boucle de rendu devra suivre le même principe.
- **2D :** le marqueur du groupe glisse avec une transition CSS. Les créatures sont dessinées **dans les cellules** : les faire glisser demande une couche flottante au-dessus de la grille (voir Q3).
- **Projectiles :** les cartes ne les affichent pas aujourd'hui. Hors périmètre.

## 5. Ce qui change dans la simulation

Presque rien :

| Élément | Changement |
|---|---|
| `projectiles.on()` | Ajout du point d'arrêt devant un obstacle |
| Commandes | Délai de déplacement façon `F310`, **si** Q1 retient la fidélité |

Les règles, l'horloge et les tests existants ne bougent pas.

## 6. Risques et points à surveiller

| Risque | Parade |
|---|---|
| **Occultation de la lumière (doc 038) :** les masques sont calculés par case, depuis la position de la caméra. Les recalculer à chaque image coûterait cher, et ne le faire qu'à l'arrivée ferait sauter la lumière | Recalcul au **franchissement** d'une case. Un petit saut de lumière peut rester visible : à juger à l'essai |
| **Rendu continu :** `decor.pressPads` et le reste de `render()` passent d'un appel occasionnel à un appel par image | Ne les exécuter que si l'état a changé ; mesurer comme dans la doc 052 |
| **Clic pendant un glissement :** le picking compare les cases au groupe logique, déjà arrivé, alors que le rayon part de la caméra en mouvement | Devrait suffire sur 250 ms ; à tester sur les boutons muraux |
| **Reconstruction pendant une animation :** une porte reconstruit les meshes | L'état visuel est hors des meshes (§ 3) ; réappliquer les matrices avant le rendu |
| **Horloge :** le tick vient d'un `setInterval`, pas de `requestAnimationFrame` | Dater chaque interpolation avec `performance.now()` et borner sa progression à 1 |
| **Remise à zéro, mort, fermeture de la fenêtre** | `motion.clear()` |

## 7. Questions à trancher

1. **Vitesse du groupe.** Recommandation : **durée réglable, 280 ms par défaut, rotation à 180 ms**.
   - 440 ms est la valeur de DM. À cette vitesse, le groupe avance au même rythme que ses projectiles (un demi-case par tick), mais la doc 012 met en garde contre une marche trop lente.
   - Au-dessous de 440 ms, le groupe peut rattraper ses propres boules de feu. L'original l'en empêche d'ailleurs en partie (`G311`), ce que la simulation ne reproduit pas encore.
   - Le délai lié à la charge (`F310`) peut attendre C3c.
2. **Escaliers, trappes, téléporteurs :** coupe nette (recommandé pour commencer), ou glissement vers la case puis coupe, plus fondu ou petite chute ? Le second demande de retarder le changement de niveau dans la vue, d'où T5.
3. **Créatures en 2D :** à inclure (couche flottante) ou à garder en sauts de case ? Recommandation : sauts au début. Les cartes sont des outils de suivi, et c'est le poste le moins visible pour son coût.
4. **Portes :** elles ne sont pas dans la demande et avancent par crans, un par tick (doc 028). Recommandation : les lisser plus tard. La reconstruction par cran pourrait devenir un simple déplacement du battant.

## 8. Découpage

Une étape par session, chacune jouable et commitée. Les docs suivantes prennent les numéros libres.

| Étape | Contenu | Critère de fin | Poids |
|---|---|---|---|
| T1 | `motion.js` et son test, boucle à la demande, réglages ; groupe dans la vue 1re personne : pas, rotations, file d'entrées, à-coup, occultation | Marche fluide, touche maintenue sans saccade, mode instantané identique à aujourd'hui, aucun rendu au repos | Moyen |
| T2 | Projectiles en extrapolation | Une Fireball touche à l'image exacte de son explosion et de son son | Faible |
| T3 | Créatures : origine des instances, matrices par image, durée par espèce, vue 1re personne et carte 3D | Les créatures glissent, restent cliquables pendant le mouvement, y compris si une porte voisine bouge | Le plus lourd |
| T4 | Marqueur du groupe sur les cartes 2D et 3D ; créatures en 2D selon Q3 | Le suivi des cartes reste fluide | Faible |
| T5 | Optionnelle : escaliers, trappes, téléporteurs selon Q2 ; portes selon Q4 | — | Moyen |

**Ordre :** le groupe d'abord, parce que le ressenti et la question de la vitesse se jugent là ; les projectiles ensuite, pour valider le socle sur un cas simple ; les créatures après.
