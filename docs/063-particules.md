# 063 — Particules : fumée des morts, éclats des sorts

Retour visuel dans la vue à la première personne, à la demande de l'utilisateur. Les particules servent à l'œil seulement : aucune règle de la simulation ne les lit.

## 1. Ce qu'on voit

| Événement | Effet |
|---|---|
| Une créature meurt (coup, sort, porte) | Nuage de fumée grise qui monte, à la place de ce membre du groupe, à la mesure de la hauteur de l'espèce |
| Une boule de feu explose | Éclair, gerbe orange, étincelles qui retombent, un peu de suie |
| Open Door touche un mur, une porte ou une créature | Éclair, gerbe bleue, étincelles |
| Un sort s'éteint en vol, ou une Black Flame absorbe une boule de feu | Petit éclat de la couleur du sort |

- La couleur est celle du sort en vol (`SPELL_COLORS`, `particles.js`), déclinée du presque blanc vers le sombre. Un futur sort n'a qu'à y ajouter sa couleur.
- La taille d'un éclat suit l'énergie restante du sort.

## 2. Réalisation

- **`src/render/particles.js`**, sans DOM ni Three.js : réserve de 800 particules, recettes `smoke()` et `explosion()`, `update(dt)` qui remplit des tableaux. Au-delà de 800, les nouvelles particules sont ignorées.
- **`src/render/first-person/fp-particles.js`** : un seul objet `THREE.Points` sur ces tableaux, avec un petit shader. Les couleurs sont prémultipliées : la fumée couvre et le feu s'ajoute, dans un même rendu. Les murs cachent les particules, qui n'écrivent pas dans le tampon de profondeur.
- **`fp-renderer.js`** : la boucle d'images tourne aussi tant qu'il reste des particules. Les masques de lumière ne sont recalculés que si la caméra bouge. Changer de niveau efface les particules.
- **Simulation :** deux événements portent ce qu'il faut, sans changer aucune règle.
  - `explosion` donne maintenant `position` (sous-case), `energy` et `fizzled`. Open Door et les sorts éteints l'émettent aussi (`burst()`, `magic.js` ; crochet `fizzle`, `projectiles.js`).
  - `creaturesMoved` avec `killed` donne `position`, la sous-case du membre tué.

## 3. Lumière

- Le feu et les sorts brillent par eux-mêmes, même dans le noir.
- La fumée n'est pas éclairée par la scène. Sa teinte est calculée à sa naissance d'après les lumières qui atteignent sa case (`litAt()`, `fp-renderer.js`).
- Hors de portée, elle garde 30 % de sa teinte (`SMOKE_MIN_LIGHT`) : **écart volontaire**, sinon une mort dans le noir ne se voit pas du tout (constaté au premier essai).

## 4. Vérifications

- `node tools/test-particles.mjs` : durée de vie, couleur dominante, montée de la fumée, limites sol et plafond, réserve bornée, événements de la simulation.
- Chrome, images du canvas capturées pendant le jeu, avec un accès temporaire à `sim` (retiré ensuite) :
  - boule de feu et Open Door contre un mur ;
  - mort au corps à corps, éclairée et dans le noir complet ;
  - boule de feu tuant un groupe de 4 : 4 nuages, à la place de chacun, puis le butin.

## 5. Limites

- Les particules traversent les murs au lieu de s'y arrêter : la partie derrière le mur est simplement cachée.
- Une explosion n'éclaire pas les murs voisins. Un éclair de lumière demanderait une lumière de plus dans le calcul des masques (doc 038).
- Pas d'option dans le panneau, et rien sur les cartes 2D et 3D.
- La fidélité à DM n'a pas été recherchée, ni comparée à ReDMCSB : les nombres (quantité, vitesse, durée) sont réglés à l'œil.

## 6. Sources

Aucune source externe pour cette étape.
