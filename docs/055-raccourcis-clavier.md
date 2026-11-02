# Raccourcis clavier : bouton et modale

## Ce qui a été ajouté

- Un bouton « Raccourcis claviers `H` » dans la barre du haut, à côté de `level-label` (`index.html`).
- Une modale (`src/ui/shortcuts-modal.js`), ouverte et fermée par le bouton ou la touche `H`.
- Chaque ligne suit le format `<kbd>Touche</kbd> Effet`. Une action à plusieurs touches a un `<kbd>` par touche.
- Sections : Général, Jeu, Niveaux, Carte, Vue 2D, Vue 3D.

## Comportement

- Fermeture : `H`, `Échap`, le bouton ×, ou un clic sur le fond.
- Tant que la modale est ouverte, aucun autre raccourci ne répond : le filtre est en tête du résolveur de touches de `main.js`.
  `Échap` ferme donc la modale sans annuler la sélection de la carte.
- La simulation n'est pas mise en pause : les ticks continuent derrière la modale.
- À la fermeture, le bouton perd le focus, pour qu'`Espace` n'ouvre pas la modale de nouveau en jeu.

## Points à connaître

- **Liste écrite à la main.** Les touches sont liées dans `main.js` et `src/sim/controls.js`, et les réglages de la 3D dans `three-renderer.js`.
  Un nouveau raccourci doit aussi être ajouté dans `SECTIONS` (`shortcuts-modal.js`).
- **Touches de déplacement.** Elles sont lues par `KeyboardEvent.code`, donc par position physique. La modale les nomme en AZERTY, comme la ligne d'aide, avec une note pour le QWERTY.
- **Ligne d'aide.** `#hint` reste en place, bien qu'elle répète une partie de la modale.

## Sources

Aucune source externe : les touches viennent du code du projet.
