# Fenêtre de jeu : poignées de redimensionnement et valeurs par défaut

## Redimensionnement

- La fenêtre se redimensionne par ses deux coins inférieurs (`src/ui/game-window.js`). Le `resize: horizontal` de CSS est retiré, car il ne propose qu'une poignée en bas à droite, avec son propre curseur.
- Curseurs : `nesw-resize` en bas à gauche, `nwse-resize` en bas à droite.
- Le coin gauche garde le bord droit en place, le coin droit garde le bord gauche.
- Seule la largeur est réglable : la hauteur suit, car la vue garde son ratio 4/3.
- La largeur reste entre 240 px et le bord de la fenêtre du navigateur.
- La nouvelle disposition est enregistrée au relâchement de la souris (`prefs.gameLayout`).

## Valeurs par défaut

Le bouton « Valeurs par défaut » du panneau remet aussi la fenêtre de jeu à sa place et à sa taille d'origine : 480 px de large, en haut à droite, à gauche des panneaux. La disposition enregistrée est effacée, même si le jeu est fermé.

## Sources

Aucune source externe.
