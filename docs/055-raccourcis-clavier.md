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
- **Touches de déplacement.** Elles sont lues par `KeyboardEvent.code`, donc par position physique. La modale les nomme en QWERTY, avec une note pour l'AZERTY.

## Ajustements

- **Ligne d'aide retirée.** La modale remplace `#hint`, `updateHint()` et `keyHint`. Les indications à la souris qu'elle donnait ne sont plus affichées.
- **Flèches retirées.** Elles ne déplacent plus le groupe et ne changent plus de niveau. Restent `W A S D Q E` et le pavé numérique en jeu, `PgPréc` et `PgSuiv` pour les niveaux. Cela remplace la colonne « Main droite » de la doc 012, § 5.
- **Espace retiré.** On actionne à la souris : le jeu ne cherche pas à se jouer entièrement au clavier.

## Sources

Aucune source externe : les touches viennent du code du projet.
