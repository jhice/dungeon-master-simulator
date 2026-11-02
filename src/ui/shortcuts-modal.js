// Modal listing the keyboard shortcuts (key H, or the toolbar button).
// The keys themselves are bound in main.js and sim/controls.js: keep this list in step.

// A row: [keys, effect]; each key is shown in its own <kbd>.
const SECTIONS = [
  {
    title: 'Général',
    note: null,
    rows: [
      [['H'], 'Afficher ou masquer ces raccourcis'],
      [['P'], 'Ouvrir ou fermer le jeu'],
      [['R'], 'Changer de vue (2D, 3D)'],
      [['I'], 'Inventaire'],
      [['J'], 'Textes'],
      [['Échap'], 'Annuler la sélection'],
      [['F'], 'Aller à la case sélectionnée'],
    ],
  },
  {
    title: 'Jeu',
    note: 'ZQSD et A/E pour les claviers AZERTY.',
    rows: [
      [['W', 'Pavé 5'], 'Avancer'],
      [['S', 'Pavé 2'], 'Reculer'],
      [['A', 'Pavé 1'], 'Pas à gauche'],
      [['D', 'Pavé 3'], 'Pas à droite'],
      [['Q', 'Pavé 4'], 'Tourner à gauche'],
      [['E', 'Pavé 6'], 'Tourner à droite'],
    ],
  },
  {
    title: 'Niveaux',
    note: null,
    rows: [
      [['PgPréc'], 'Niveau précédent'],
      [['PgSuiv'], 'Niveau suivant'],
      [['Début'], 'Premier niveau'],
      [['Fin'], 'Dernier niveau'],
    ],
  },
  {
    title: 'Carte',
    note: null,
    rows: [
      [['+'], 'Zoomer'],
      [['−'], 'Dézoomer'],
      [['0'], 'Ajuster la vue'],
      [['V'], 'États des tuiles'],
      [['O'], 'Objets'],
      [['C'], 'Créatures'],
      [['K'], 'Mécanismes'],
      [['X'], 'Textes'],
      [['T'], 'Tous les liens (sinon sélection)'],
    ],
  },
  {
    title: 'Vue 2D',
    note: null,
    rows: [[['G'], 'Repère global ou local']],
  },
  {
    title: 'Vue 3D',
    note: null,
    rows: [
      [['L'], 'Liens escaliers / trappes'],
      [['N'], 'Étiquettes de niveau'],
      [['M'], 'Mode d’affichage des niveaux'],
    ],
  },
];

function createSection({ title, note, rows }) {
  const section = document.createElement('section');
  const heading = document.createElement('h3');
  heading.textContent = title;
  const list = document.createElement('ul');
  for (const [keys, effect] of rows) {
    const row = document.createElement('li');
    const cell = document.createElement('span');
    cell.className = 'shortcut-keys';
    for (const key of keys) {
      const kbd = document.createElement('kbd');
      kbd.textContent = key;
      cell.append(kbd);
    }
    row.append(cell, effect);
    list.append(row);
  }
  section.append(heading, list);
  if (note) {
    const paragraph = document.createElement('p');
    paragraph.textContent = note;
    section.append(paragraph);
  }
  return section;
}

/**
 * @param {HTMLElement} container
 * @param {HTMLButtonElement} button the toolbar button that toggles the modal
 * @returns {{ toggle(): void, isOpen(): boolean }}
 */
export function createShortcutsModal(container, button) {
  const dialog = document.createElement('dialog');
  dialog.className = 'shortcuts-modal';
  dialog.setAttribute('aria-labelledby', 'shortcuts-title');
  dialog.tabIndex = -1; // focusable: see toggle()

  const header = document.createElement('header');
  const title = document.createElement('h2');
  title.id = 'shortcuts-title';
  title.textContent = 'Raccourcis claviers';
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.title = 'Fermer';
  close.setAttribute('aria-label', 'Fermer');
  close.addEventListener('click', () => dialog.close());
  header.append(title, close);

  const body = document.createElement('div');
  body.className = 'shortcuts-body';
  body.append(...SECTIONS.map(createSection));
  dialog.append(header, body);
  container.append(dialog);

  // A click on the backdrop lands on the dialog itself; its content fills the padding box.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  // showModal() gives the focus back to the button on closing: keep the keyboard for the viewer.
  dialog.addEventListener('close', () => button.blur());

  const toggle = () => {
    if (dialog.open) return dialog.close();
    dialog.showModal();
    dialog.focus(); // showModal() would leave the focus on the close button, with its outline
    return undefined;
  };
  button.addEventListener('click', toggle);

  return { toggle, isOpen: () => dialog.open };
}
