// The spell area of DM (docs/030), right of the champion's box: a tab with the caster's
// name, the row of the 6 symbols of the current step (power, element, form, class), and the
// line of the symbols chosen, which casts the spell when clicked; the arrow deletes the last
// symbol. Symbols are drawn from the Atari ST glyphs (7 × 7 pixels, spell-glyphs.js).
// The book button opens the grimoire: the spells known from the scrolls read (docs/034).

import { SYMBOLS, spellManaCost, findSpell, symbolLabel, spellName } from '../core/spell-info.js';
import { t } from '../i18n/i18n.js';
import { GLYPHS } from '../core/spell-glyphs.js';

const SVG = 'http://www.w3.org/2000/svg';

/**
 * @param {HTMLElement} container the game viewport
 * @param {object} options
 * @param {(index: number) => void} options.onSymbol a symbol of the row was chosen (0..5)
 * @param {() => void} options.onDelete the arrow
 * @param {() => void} options.onCast the line of symbols chosen
 */
export function createSpellPanel(container, { onSymbol, onDelete, onCast }) {
  const panel = element('div', 'spell-panel');
  const header = element('div', 'spell-header');
  const tab = element('div', 'spell-tab');
  const book = element('button', 'spell-book');
  book.type = 'button';
  const grimoire = element('div', 'spell-grimoire');
  grimoire.hidden = true;
  book.addEventListener('click', () => {
    grimoire.hidden = !grimoire.hidden;
    book.classList.toggle('is-open', !grimoire.hidden);
    book.blur();
  });
  // header.append(tab, book);
  header.append(tab);
  const row = element('div', 'spell-row');
  const choices = Array.from({ length: 6 }, (_, i) => {
    const button = element('button', 'spell-symbol');
    button.type = 'button';
    button.addEventListener('click', () => {
      onSymbol(i);
      button.blur(); // keep the keyboard for the game
    });
    row.append(button);
    return button;
  });
  const line = element('div', 'spell-line');
  const cast = element('button', 'spell-cast');
  cast.type = 'button';
  cast.title = t('spell.cast');
  cast.addEventListener('click', () => {
    onCast();
    cast.blur();
  });
  const del = element('button', 'spell-delete');
  del.type = 'button';
  del.title = t('spell.delete');
  del.append(arrowIcon());
  del.addEventListener('click', () => {
    onDelete();
    del.blur();
  });
  line.append(cast, del);
  panel.append(header, row, line, book, grimoire);
  container.append(panel);

  let shownKnown = null; // names of the spells listed, to rebuild the list only when they change
  // The grimoire: one line per spell known, its symbols (without the power) and its name.
  function showGrimoire(known) {
    book.textContent = t('spell.grimoire', { count: known.length });
    book.title = t(known.length ? 'spell.grimoireTitle' : 'spell.grimoireEmptyTitle');
    const key = known.map((s) => s.name).join();
    if (key === shownKnown) return;
    shownKnown = key;
    grimoire.replaceChildren(
      ...known.map((spell) => {
        const entry = element('div', 'spell-known');
        const symbols = element('span', 'spell-known-symbols');
        symbols.append(...spell.symbols.map(glyph));
        symbols.title = spell.symbols.map(symbolLabel).join(' ');
        const label = element('span');
        label.textContent = spellName(spell);
        entry.append(symbols, label);
        return entry;
      }),
    );
    if (!known.length) grimoire.textContent = t('spell.noneKnown');
  }

  return {
    /**
     * Shows the caster ({ name, symbols: indices per step, dead }) and the grimoire: the spells
     * known ([spell of spell-info.js]); the line names its spell when it is a known one.
     */
    update(champion, known = []) {
      const step = champion.symbols.length;
      // tab.textContent = champion.name;
      tab.textContent = t('spell.tab');
      choices.forEach((button, i) => {
        const name = SYMBOLS[step]?.[i];
        button.replaceChildren(...(name ? [glyph(name)] : []));
        button.disabled = !name || champion.dead;
        button.title = name ? symbolLabel(name) : '';
      });
      const names = champion.symbols.map((index, s) => SYMBOLS[s][index]);
      cast.replaceChildren(...names.map(glyph));
      cast.disabled = !names.length || champion.dead;
      // The mana cost is shown, not spent yet (docs/029 Q2).
      const spell = findSpell(champion.symbols);
      const name = spell && known.includes(spell) ? ` : ${spellName(spell)}` : '';
      cast.title = names.length ? t('spell.castLine', { symbols: names.map(symbolLabel).join(' ') + name, mana: spellManaCost(champion.symbols) }) : t('spell.chooseSymbols');
      del.disabled = !names.length || champion.dead;
      showGrimoire(known);
    },
    dispose() {
      panel.remove();
    },
  };
}

// A glyph as an SVG of 7 × 7 squares, in the current colour.
const glyphPaths = new Map();
function glyph(name) {
  if (!glyphPaths.has(name)) {
    let d = '';
    GLYPHS[name].forEach((row, y) => [...row].forEach((c, x) => c === '#' && (d += `M${x} ${y}h1v1h-1z`)));
    glyphPaths.set(name, d);
  }
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 7 7');
  svg.setAttribute('class', 'spell-glyph');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', glyphPaths.get(name));
  svg.append(path);
  return svg;
}

// The arrow of the delete button, pixel style as in DM.
function arrowIcon() {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 9 7');
  svg.setAttribute('class', 'spell-glyph');
  const path = document.createElementNS(SVG, 'path');
  path.setAttribute('d', 'M0 3h1v1h-1zM1 2h1v3h-1zM2 1h1v5h-1zM3 0h1v7h-1zM4 2h5v3h-5z');
  svg.append(path);
  return svg;
}

function element(tag, className) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  return e;
}
