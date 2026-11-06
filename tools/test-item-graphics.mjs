// Checks of the pictures of the items (docs/072): every item of the dungeon has its floor picture,
// and the table of item-graphics.js agrees with the labels of graphics.dat (assets/items/floor/labels.json).
// Run: node tools/test-item-graphics.mjs

import { existsSync, readFileSync } from 'node:fs';
import { Dungeon } from '../src/core/dungeon.js';
import { ITEM_POOLS } from '../src/core/contents.js';
import { floorPicture, globalIndex, itemType, CHEST_FLOOR, CHEST_ALCOVE, FLOOR_PICTURE_COUNT } from '../src/core/item-graphics.js';

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failures++;
};

const dungeon = new Dungeon(JSON.parse(readFileSync(new URL('../data/dungeon.json', import.meta.url))));
const labels = JSON.parse(readFileSync(new URL('../assets/items/floor/labels.json', import.meta.url)));
const file = (n) => new URL(`../assets/items/floor/${String(n).padStart(2, '0')}.png`, import.meta.url);

for (let n = 0; n < FLOOR_PICTURE_COUNT; n++) {
  if (!existsSync(file(n))) check(false, `picture ${n} exists`);
}
check(Object.keys(labels).length === FLOOR_PICTURE_COUNT, `${FLOOR_PICTURE_COUNT} floor pictures labelled`);

// Names compared without case, punctuation nor state: "Waterskin (Full)" and "Water" are the same item
// in DM; a few names differ between the catalog and graphics.dat.
const ALIASES = { water: 'waterskin', dragonsteak: 'dragonsteack' };
// The descriptors (data of the game, Atari ST) give Helm Of Darc and Dexhelm the picture of the Armet; the labels
// of the Amiga extraction list them with the Basinet. The data wins (docs/072).
const LABEL_EXCEPTIONS = new Set(['Helm Of Darc', 'Dexhelm']);
const norm = (name) => {
  const key = name.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z]/g, '');
  return ALIASES[key] ?? key;
};

let items = 0;
const missing = new Set();
const mismatch = new Set();
for (const kind of Object.keys(ITEM_POOLS)) {
  dungeon.data[ITEM_POOLS[kind]].forEach((entry, index) => {
    items++;
    const type = itemType(dungeon, { kind, index });
    const picture = floorPicture(kind, type);
    if (picture === null || globalIndex(kind, type) === null) {
      missing.add(`${kind} ${type}`);
      return;
    }
    const name = entry.name ?? (kind === 'scroll' ? 'Scroll' : kind);
    if (LABEL_EXCEPTIONS.has(name)) return;
    const names = labels[String(picture).padStart(2, '0')].map(norm);
    if (!names.some((label) => label.startsWith(norm(name)) || norm(name).startsWith(label))) mismatch.add(`${name} -> ${picture} (${names.join(', ')})`);
  });
}
check(missing.size === 0, `each of the ${items} items of the dungeon has a picture${missing.size ? `: missing ${[...missing].join('; ')}` : ''}`);
check(mismatch.size === 0, `each picture is labelled with the name of its item${mismatch.size ? `: ${[...mismatch].join('; ')}` : ''}`);

check(floorPicture('container', 0) === CHEST_FLOOR && floorPicture('container', 0, true) === CHEST_ALCOVE, 'chest: its own picture in an alcove');
check(floorPicture('scroll', 0, true) === 2, 'other items: the same picture in an alcove');
check(floorPicture('weapon', 99) === null && floorPicture('nothing', 0) === null, 'unknown type: no picture');
check(globalIndex('miscellaneous', 0) === 0 && globalIndex('weapon', 2) === 4, 'global index: compass 0, torch 4');

console.log(failures ? `\n${failures} failure(s)` : '\nall ok');
process.exit(failures ? 1 : 0);
