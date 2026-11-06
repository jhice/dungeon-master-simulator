// Icons of the items in the interface (docs/076): hands of the champion, inventory bar, cursor.
// One atlas, assets/items/icons.png (tools/extract-item-graphics.py): icon n at column n % 16, row ⌊n / 16⌋,
// 16 × 16 pixels. In CSS, as a background in percents of the atlas, so that any square element shows it;
// for the cursor, a picture made once per icon from the atlas.

import { ICON_SIZE, ICON_BACKGROUND } from '../core/item-graphics.js';

const ATLAS = 'assets/items/icons.png';
const COLUMNS = 16;
const ROWS = 14;
const CURSOR_SCALE = 2;

let atlas = null; // the picture, once loaded
/** Resolves when the atlas is loaded (the cursor needs its pixels). */
export const iconsReady = new Promise((resolve) => {
  const image = new Image();
  image.onload = () => {
    atlas = image;
    resolve();
  };
  image.onerror = () => {
    console.warn('Item icons: no atlas', ATLAS);
    resolve();
  };
  image.src = ATLAS;
});

/** Shows icon `index` as the background of an element (class item-icon, styles/main.css), or nothing (null). */
export function paintIcon(element, index) {
  const has = index !== null && index !== undefined;
  element.classList.toggle('item-icon', has);
  if (!has) {
    element.style.removeProperty('--icon-x');
    element.style.removeProperty('--icon-y');
    return;
  }
  element.style.setProperty('--icon-x', `${((index % COLUMNS) / (COLUMNS - 1)) * 100}%`);
  element.style.setProperty('--icon-y', `${(Math.floor(index / COLUMNS) / (ROWS - 1)) * 100}%`);
}

const cursors = new Map();
/**
 * CSS cursor of an item held by the pointer: its icon, twice its size, the hot spot in its middle (as in DM,
 * the item is where the pointer is); null while the atlas loads.
 */
export function iconCursor(index) {
  if (!atlas || index === null || index === undefined) return null;
  if (!cursors.has(index)) {
    const size = ICON_SIZE * CURSOR_SCALE;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size + 2;
    const context = canvas.getContext('2d');
    context.imageSmoothingEnabled = false;
    // A thin dark outline, so that the icon stays visible on a dark floor.
    context.fillStyle = 'rgb(0 0 0 / 0.6)';
    for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]]) {
      context.drawImage(atlas, (index % COLUMNS) * ICON_SIZE, Math.floor(index / COLUMNS) * ICON_SIZE, ICON_SIZE, ICON_SIZE, dx, dy, size, size);
    }
    context.globalCompositeOperation = 'source-in';
    context.fillRect(0, 0, size + 2, size + 2);
    context.globalCompositeOperation = 'source-over';
    context.drawImage(atlas, (index % COLUMNS) * ICON_SIZE, Math.floor(index / COLUMNS) * ICON_SIZE, ICON_SIZE, ICON_SIZE, 1, 1, size, size);
    const middle = Math.round(size / 2);
    cursors.set(index, `url("${canvas.toDataURL()}") ${middle} ${middle}, auto`);
  }
  return cursors.get(index);
}

export { ICON_BACKGROUND };
