# 057 — Action effectuée : fond clair à la place du nom en jaune

## Demande

Quand Zed effectuait une action, son nom s'affichait en jaune au-dessus du panneau d'actions, en doublon du bouton. Ce nom disparaît : le bouton de l'action effectuée prend un fond plus clair.

Cela remplace, dans la doc 044, l'affichage du nom de l'action dans la zone d'action.

## Comportement

- **Fond clair :** le bouton de l'action reste éclairé pendant toute sa fatigue, et s'éteint quand les boutons se réactivent. Une action sans fatigue (« Cogner » dans le vide : 1 divisé par 2, arrondi à 0) reste éclairée un tick, 220 ms, pour rester visible.
- **Zone de résultat :** les résultats qui ne doublent pas un bouton (dégâts, « Raté », « Sans effet », « Pas de munitions ») s'affichent en jaune au-dessus du panneau d'actions, pendant 900 ms (`RESULT_MS`). La zone a la largeur du panneau et la hauteur de 3 actions.
- **Place réservée :** la zone garde sa place même vide (`visibility: hidden`), pour que les boutons ne bougent pas quand un résultat s'affiche.
- **Ligne d'état :** ses messages ne changent pas.
- **Sans fond clair :** les actions qui n'ont pas eu lieu (`NOT_DONE`, `main.js`), à savoir trop fatigué, rien à faire, pas de munitions, et les actions pas encore implémentées.

## Code

- `src/main.js` : `doAction()` appelle `panel.showAction(index)`. Le tableau des résultats ne contient plus que les messages de la ligne d'état.
- `src/ui/champion-panel.js` : `showAction(id)` retrouve le bouton par `data-action` ; `setReady(true)` l'éteint.
- `styles/main.css` : `.champion-action.is-done`, hauteur de `.champion-result`.

## Sources

Aucune source externe : demande de l'utilisateur et code du projet.
