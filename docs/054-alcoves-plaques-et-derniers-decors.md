# 054 — Alcôves creuses, trappe fermée, plaques de sol et derniers décors en 3D

> Demandes de l'utilisateur :
> - voir si l'on devrait voir plus loin à travers la porte à ouvertures du niveau 1, en (3, 13), vue depuis (2, 13) ;
> - enchaîner sur : vraies alcôves, trappe fermée comme le sol, décors restants ;
> - mettre en 3D les déclencheurs au sol, appuyés ou relevés.
>
> Sources : ReDMCSB, `DUNGEON.C` (`F172`). Voir [000-sources.md](000-sources.md). Suite de la doc [053](053-decors-en-objets-3d.md).

## 1. La porte du niveau 1 : portée de la lumière

Ce n'est pas un défaut de la porte. Depuis (2, 13), l'œil est à 4,35 cases de la porte suivante, en (6, 13), et la lumière porte à 3,7 cases par défaut (`distance`). Par l'ouverture, on voit surtout cette porte, donc du noir ; le Screamer, en (4, 13), est dans la portée.

Vérifié dans la même position : avec une portée de 6, la porte en barreaux de bois apparaît par l'ouverture. Sans occlusion, à 3,7, le fond reste noir. Le réglage par défaut n'a pas été changé.

## 2. Alcôves creuses

- Une case de mur portant une alcôve n'est plus une boîte : `level-meshes.js` pose ses 4 faces une à une (`wallFace`), l'une percée (`nicheFaceSquare` ou `nicheFaceArched`), avec l'intérieur du creux (`nicheInsideSquare` ou `nicheInsideArched`).
- Dimensions : `NICHE`, avec 0,2 case de profondeur. `Arched Alcove` a une voûte ; `Square Alcove` et `Vi Altar` sont rectangulaires.
- Sans ombre dans la vue, la profondeur vient aussi de la texture : les côtés s'assombrissent vers le fond (`nicheInsideTexture`).
- Les objets sont dans le creux (`alcoveDepth`, `level-contents.js`), côte à côte, puis sur une seconde rangée au-dessus. Au-delà de 6 objets, ils dépassent du haut.
- L'option « décors en objets 3D » coupée, on retrouve l'aplat sombre.

## 3. Trappe fermée

ReDMCSB (`F172`) traite une trappe fermée comme un couloir. Dans la vue du jeu, elle est donc identique au sol, avec ou sans l'option, et elle peut porter un décor de sol, comme une trappe invisible. Le couvercle brun ne reste que dans les vues 2D et 3D de carte.

Conséquence : une trappe fermée ne se repère plus dans la vue du jeu, comme dans DM.

## 4. Plaques de sol et grilles (`buildFloor`, `fp-models.js`)

- `Square Pressure Pad`, `Tiny Pressure Pad`, `Round Pressure Plate` : un cadre, un fond sombre et une dalle mobile (enfant nommé `plate`).
- La dalle dépasse de 0,034 case relevée, et de 0,006 appuyée, sous le haut du cadre (0,012).
- Elle s'abaisse sous le groupe, un objet ou une créature qui ne lévite pas (`pressPads`, `fp-decor.js`), recalculé à chaque rendu, sans reconstruire le niveau. Le mouvement est instantané.
- C'est une règle physique : tout ce qui pèse appuie. Une plaque réservée au groupe s'abaisse donc aussi sous un objet, sans se déclencher (`pressedOn`, `sim/logic.js`, reste seul juge).
- `Square Grate`, `Round Grate` : barreaux dans un cadre, sur un fond sombre.
- Restent peints : mousse, flaque, fissure, `Black Flame Pit`. Les actuators sans graphisme restent invisibles, comme dans DM.

## 5. Décors muraux ajoutés

| Décor | Pièces |
|---|---|
| Coin Slot | Plaque de laiton percée, lèvre autour de la fente, rivets |
| Gem Hole | Plaque de pierre percée en losange, sertie de laiton |
| Hook | Platine, bras, tige, crochet recourbé |
| Wood Ring, Iron Ring | Platine, anneau d'attache, anneau suspendu |
| Manacles | Deux platines, chaînes de maillons, bracelets |
| Grate | Cadre, barreaux, fond sombre |
| Slime Outlet | Bouche ovale à barreaux, bave qui coule |
| Lord Order | Écu sombre, bord de laiton, losange, bosse centrale |
| Fireball, Poison, Dagger Holes | Plaque percée, bords teintés selon le projectile |

Restent peints, car ce sont des marques sur le mur : `Slime`, `Crack`, `Dent 1`, `Scratches`.

Ce sont des interprétations à partir des dessins de `ornament-art.js`, pas les graphismes de DM.

## 6. Problème connu, non résolu : décors noirs par intermittence

**Symptôme.** Dans les captures de Chrome sans interface, tous les objets 3D du niveau 10 visibles depuis (6, 14), face à l'est, sont sortis entièrement noirs (`Dagger Holes`, `Fireball Holes`), alors que les murs autour étaient normaux.

**Reproduction.** Enchaîner des téléportations sur les niveaux 0, 2, 3, 5, 7 et 8, puis le niveau 10.

| Série | Résultat |
|---|---|
| Sans instrumentation | Noir dans 7 parties sur 17 |
| Avec lecture de pixel après chaque rendu | 0 partie sur 12 |
| 28 passages du niveau 8 au niveau 10, lecture après chaque rendu | Une seule valeur sombre, sur un rendu tardif |
| Niveau 10 seul, 20 s, 90 rendus | Jamais |

**Ce qui est établi.**

- Un rendu suivant, sans autre action, fait revenir la bonne image.
- Dans l'état fautif, les matériaux des objets et des murs ont le même masque d'occlusion et des programmes valides ; aucune erreur en console.

**Ce qui ne l'est pas.**

- La cause, qui n'a pas été trouvée.
- Si le défaut existait avant cette étape : le code de la doc 053 n'a pas été soumis au même essai.
- Si le défaut existe dans un navigateur normal : il n'y a été ni observé ni cherché. La disparition avec la lecture de pixels pourrait indiquer un problème de synchronisation du GPU propre à ce mode de capture.

**Pistes pour reprendre.** Comme la vue n'est redessinée qu'à la demande, une image fautive resterait affichée jusqu'au rendu suivant. Pour la chercher : repartir de la séquence ci-dessus, comparer l'image avec `gl.finish()` après le rendu, puis observer dans un Chrome avec interface.

## 7. Vérifications

- **Alcôves :** clics sur Vi Altar (niveau 0), alcôve carrée (niveau 2) et voûtée (niveau 6) : l'objet se prend et se repose ; un clic sur le mur, ailleurs, ne change rien.
- **Plaque du niveau 0, (6, 9) :** dalle à -0,016 à vide, -0,044 sous le groupe, de nouveau -0,016 après son départ, -0,044 sous un objet, -0,016 une fois l'objet retiré.
- **Reconstruction d'un niveau :** 4,9 ms au niveau 0, 11,3 au niveau 1, 6,6 au niveau 2, 8,5 au niveau 5, 6,2 au niveau 8, 2,1 au niveau 13. Moyennes de 10, rendu compris ; le protocole n'est pas celui de la doc 053, les chiffres ne se comparent donc pas directement.
- **Mémoire :** 210 géométries et 42 textures avant et après 60 reconstructions.
- **Tests Node :** les 12 passent.
- **Vus à l'écran :** tous les décors du tableau du § 5 ; Lord Order une seule fois, sur le mur du niveau 0, en (9, 0).

Non testés :

- une plaque sous une créature (seule la règle du code la couvre) ;
- une torche en main dans le noir réel ;
- l'Amalgam sans gemme (déjà signalé dans la doc 053).
