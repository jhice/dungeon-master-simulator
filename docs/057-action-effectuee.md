# 057 — Action effectuée : fond clair à la place du nom en jaune

## Demande

Quand Zed effectuait une action, son nom s'affichait en jaune au-dessus du panneau d'actions, en doublon du bouton. Ce nom disparaît : le bouton de l'action effectuée prend un fond plus clair.

Cela remplace, dans la doc 044, l'affichage du nom de l'action dans la zone d'action.

## Comportement

- **Fond clair :** le bouton de l'action s'éclaire pendant 900 ms (`RESULT_MS`), la durée de l'ancien texte jaune, qu'il soit désactivé par la fatigue ou non.
- **Toujours en jaune :** les résultats qui ne doublent pas un bouton, à savoir les dégâts, « Raté », « Sans effet » et « Pas de munitions ».
- **Ligne d'état :** ses messages ne changent pas.
- **Sans fond clair :** les actions qui n'ont pas eu lieu (`NOT_DONE`, `main.js`), à savoir trop fatigué, rien à faire, pas de munitions, et les actions pas encore implémentées.

## Code

- `src/main.js` : `doAction()` appelle `panel.showAction(index)`. Le tableau des résultats ne contient plus que les messages de la ligne d'état.
- `src/ui/champion-panel.js` : `showAction(id)` retrouve le bouton par `data-action`.
- `styles/main.css` : `.champion-action.is-done`.

## Sources

Aucune source externe : demande de l'utilisateur et code du projet.
