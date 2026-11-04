# 065 — Textures des trappes et des alcôves

Demande de l'utilisateur, à la suite des escaliers (doc 064) : un rendu plus sombre pour ces deux éléments de la vue à la première personne.

## Alcôves

Le fond a maintenant la couleur la plus sombre du dégradé des bords (`NICHE_BACK`, `fp-renderer.js`). Il n'a plus de blocs de pierre.

## Trappes

- **Bord au sol (`pitRim`) :** inchangé, il garde le sol avec ses joints.
- **Puits (`pitShaft`) :** couleur pleine, celle du sol, sans joints, de la clarté moyenne des dalles (`PIT_SHADE`). Il plonge dans le noir vers le bas : le fondu est conservé pour que le trou se lise comme un trou. La lèvre claire en haut du puits est retirée.
- **Trou au plafond, sous une trappe du niveau du dessus :** le puits qui monte est identique, puisque c'est la même trappe vue d'en bas (validé par l'utilisateur). Son bord garde la couleur et la texture du plafond, dont il fait partie.

## Vérifications

Dans Chrome, avec un accès temporaire à `sim`, retiré ensuite : puits uni à 1 case et trou au plafond ; alcôve avec un objet et trappe à 2 cases avant le passage du puits à la couleur pleine. Aucune erreur dans la console. Le retour du bord aux joints du sol n'a pas été revu à l'écran.

## Sources

Aucune source externe.
