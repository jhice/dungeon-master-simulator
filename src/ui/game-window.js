// Floating, draggable window holding the first-person view (answer Q1): it
// stays above the 2D/3D views, which remain visible. Width is resizable from
// the two bottom corners (the viewport keeps its 4/3 ratio); position and width
// are reported to the caller, which remembers them.
// Below the viewport, a message area (as in DM) prints the messages of the dungeon.

import { t } from '../i18n/i18n.js';

const MIN_WIDTH = 240;
const DEFAULT_WIDTH = 480;
const MESSAGE_LINES = 3; // latest messages kept
const MESSAGE_MS = 12000; // before a message fades out

/**
 * @param {object} options
 * @param {{ left: number, top: number, width: number }} [options.layout] initial position and width, in px
 * @param {(layout: object) => void} [options.onLayoutChange] after a drag or a resize
 * @param {() => void} [options.onClose]
 * @param {() => void} [options.onReset] back to the start position
 * @param {(index: number) => void} [options.onSelectItem] an item of the inventory was clicked: take it in hand
 * @param {() => void} [options.onStow] the "Ranger" button: the item in hand goes into the inventory
 * @param {() => void} [options.onMouth] the mouth of the champion: he drinks what the cursor holds (docs/050)
 * @returns {{ viewport: HTMLElement, setStatus(text), message(text), setInventory(items, hand), flash(), resetLayout(), dispose() }}
 */
export function createGameWindow({ layout, onLayoutChange, onClose, onReset, onSelectItem, onStow, onMouth } = {}) {
  const win = document.createElement('section');
  win.className = 'game-window';
  win.setAttribute('aria-label', t('game.title'));

  const bar = document.createElement('header');
  bar.className = 'game-bar';
  const title = document.createElement('span');
  title.className = 'game-title';
  title.textContent = t('game.title');
  const status = document.createElement('span');
  status.className = 'game-status';
  bar.append(title, status, button('⟲', t('game.restart'), onReset), button('×', t('game.close'), onClose));

  const viewport = document.createElement('div');
  viewport.className = 'game-viewport';
  const messages = document.createElement('div');
  messages.className = 'game-messages';
  messages.setAttribute('aria-live', 'polite');
  // Hand and inventory of the party: the item in hand with the mouth of the champion below it
  // (as DM's inventory), the "Ranger" button, then one chip per item of the inventory
  // (click = take it in hand).
  const inventory = document.createElement('div');
  inventory.className = 'game-inventory';
  const handColumn = document.createElement('div');
  handColumn.className = 'game-hand-column';
  const handSlot = document.createElement('span');
  handSlot.className = 'game-hand';
  const mouth = button(`👄 ${t('game.mouth')}`, t('game.mouthTitle'), onMouth);
  mouth.classList.add('game-mouth');
  handColumn.append(handSlot, mouth);
  const stowButton = button(t('game.stow'), t('game.stowTitle'), onStow);
  const chips = document.createElement('div');
  chips.className = 'game-items';
  inventory.append(handColumn, stowButton, chips);
  win.append(bar, viewport, messages, inventory);
  document.body.append(win);

  const place = ({ left, top, width }) => {
    win.style.width = `${Math.max(MIN_WIDTH, Math.min(width, window.innerWidth - 16))}px`;
    win.style.left = `${clamp(left, 0, window.innerWidth - win.offsetWidth)}px`;
    win.style.top = `${clamp(top, 0, window.innerHeight - bar.offsetHeight)}px`;
  };
  const current = () => ({ left: win.offsetLeft, top: win.offsetTop, width: win.offsetWidth });
  // Default: top right, left of the side panels (17rem), so the map stays visible.
  const defaultLayout = () => ({ left: window.innerWidth - DEFAULT_WIDTH - 300, top: 96, width: DEFAULT_WIDTH });
  place({ ...defaultLayout(), ...layout });

  // Drag by the title bar (not by its buttons).
  let drag = null;
  bar.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest('button')) return;
    drag = { dx: event.clientX - win.offsetLeft, dy: event.clientY - win.offsetTop };
    bar.setPointerCapture(event.pointerId);
  });
  bar.addEventListener('pointermove', (event) => {
    if (drag) place({ ...current(), left: event.clientX - drag.dx, top: event.clientY - drag.dy });
  });
  bar.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = null;
    onLayoutChange?.(current());
  });

  // Resize by the bottom corners; the height follows the width. The left corner keeps
  // the right edge in place, the right corner the left edge.
  const resizeHandle = (side) => {
    const handle = document.createElement('div');
    handle.className = `game-resize game-resize-${side}`;
    let start = null;
    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      start = { x: event.clientX, ...current() };
      handle.setPointerCapture(event.pointerId);
    });
    handle.addEventListener('pointermove', (event) => {
      if (!start) return;
      const dx = event.clientX - start.x;
      if (side === 'right') {
        const width = Math.min(start.width + dx, window.innerWidth - start.left);
        place({ left: start.left, top: start.top, width });
      } else {
        const right = start.left + start.width;
        const width = Math.max(MIN_WIDTH, Math.min(start.width - dx, right));
        place({ left: right - width, top: start.top, width });
      }
    });
    handle.addEventListener('pointerup', () => {
      if (!start) return;
      start = null;
      onLayoutChange?.(current());
    });
    return handle;
  };
  win.append(resizeHandle('left'), resizeHandle('right'));

  const onWindowResize = () => place(current());
  window.addEventListener('resize', onWindowResize);

  return {
    viewport,
    setStatus(text) {
      status.textContent = text;
    },
    /** Prints a message of the dungeon in the message area (it fades out after a while). */
    message(text) {
      const line = document.createElement('p');
      line.textContent = text;
      messages.append(line);
      while (messages.children.length > MESSAGE_LINES) messages.firstChild.remove();
      setTimeout(() => line.classList.add('is-old'), MESSAGE_MS);
    },
    /** Items carried: [{ name, color, details? }], and the item in hand ({ name, color, details? } or null). */
    setInventory(items, hand) {
      handSlot.textContent = hand ? t('game.held', { name: hand.name }) : t('game.nothingHeld');
      handSlot.title = hand?.details ?? '';
      handSlot.classList.toggle('is-empty', !hand);
      handSlot.style.setProperty('--c', hand?.color ?? 'transparent');
      stowButton.disabled = !hand;
      mouth.disabled = !hand;
      chips.replaceChildren(
        ...items.map((item, i) => {
          const chip = button(item.name, `${item.details ?? item.name}\n${t('game.takeHint')}`, () => onSelectItem?.(i));
          chip.className = 'game-item';
          chip.style.setProperty('--c', item.color);
          return chip;
        }),
      );
      if (!items.length) chips.textContent = t('game.inventoryEmpty');
    },
    /** Short visual feedback (blocked move). */
    flash() {
      win.classList.remove('is-bumped');
      void win.offsetWidth; // restart the animation
      win.classList.add('is-bumped');
    },
    /** Back to the default position and size ("Valeurs par défaut"). */
    resetLayout() {
      place(defaultLayout());
    },
    dispose() {
      window.removeEventListener('resize', onWindowResize);
      win.remove();
    },
  };
}

function button(text, label, action) {
  const element = document.createElement('button');
  element.type = 'button';
  element.textContent = text;
  element.title = label;
  element.addEventListener('click', () => {
    action?.();
    element.blur(); // keep the keyboard for the game
  });
  return element;
}

const clamp = (value, min, max) => Math.max(min, Math.min(value, Math.max(min, max)));
