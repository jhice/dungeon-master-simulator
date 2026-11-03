// Modal listing the keyboard shortcuts (key H, or the toolbar button).
// The keys themselves are bound in main.js and sim/controls.js: keep this list in step.

import { t } from '../i18n/i18n.js';

// A row: [keys, effect]; each key is shown in its own <kbd>.
const SECTIONS = [
  {
    title: t('shortcuts.general'),
    note: null,
    rows: [
      [['H'], t('shortcuts.help')],
      [['P'], t('shortcuts.game')],
      [['R'], t('shortcuts.view')],
      [['I'], t('shortcuts.inventory')],
      [['J'], t('shortcuts.texts')],
      [[t('key.escape')], t('shortcuts.cancelSelection')],
      [['F'], t('shortcuts.goToSelection')],
    ],
  },
  {
    title: t('shortcuts.playing'),
    note: t('shortcuts.azerty'),
    rows: [
      [['W', t('key.numpad', { key: 5 })], t('shortcuts.forward')],
      [['S', t('key.numpad', { key: 2 })], t('shortcuts.backward')],
      [['A', t('key.numpad', { key: 1 })], t('shortcuts.strafeLeft')],
      [['D', t('key.numpad', { key: 3 })], t('shortcuts.strafeRight')],
      [['Q', t('key.numpad', { key: 4 })], t('shortcuts.turnLeft')],
      [['E', t('key.numpad', { key: 6 })], t('shortcuts.turnRight')],
    ],
  },
  {
    title: t('shortcuts.levels'),
    note: null,
    rows: [
      [[t('key.pageUp')], t('shortcuts.previousLevel')],
      [[t('key.pageDown')], t('shortcuts.nextLevel')],
      [[t('key.home')], t('shortcuts.firstLevel')],
      [[t('key.end')], t('shortcuts.lastLevel')],
    ],
  },
  {
    title: t('shortcuts.map'),
    note: null,
    rows: [
      [['+'], t('shortcuts.zoomIn')],
      [['−'], t('shortcuts.zoomOut')],
      [['0'], t('shortcuts.fit')],
      [['V'], t('panel.states')],
      [['O'], t('panel.items')],
      [['C'], t('panel.creatures')],
      [['K'], t('panel.mechanisms')],
      [['X'], t('panel.texts')],
      [['T'], t('panel.allLinks')],
    ],
  },
  {
    title: t('shortcuts.view2d'),
    note: null,
    rows: [[['G'], t('shortcuts.frame')]],
  },
  {
    title: t('shortcuts.view3d'),
    note: null,
    rows: [
      [['L'], t('settings.links')],
      [['N'], t('settings.labels')],
      [['M'], t('shortcuts.displayMode')],
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
  button.firstChild.textContent = `${t('shortcuts.title')} `;
  const dialog = document.createElement('dialog');
  dialog.className = 'shortcuts-modal';
  dialog.setAttribute('aria-labelledby', 'shortcuts-title');
  dialog.tabIndex = -1; // focusable: see toggle()

  const header = document.createElement('header');
  const title = document.createElement('h2');
  title.id = 'shortcuts-title';
  title.textContent = t('shortcuts.title');
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '×';
  close.title = t('common.close');
  close.setAttribute('aria-label', t('common.close'));
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
