// Checks of the pictures of the items (docs/072): every item of the dungeon has its floor picture,
// and the table of item-graphics.js agrees with the labels of graphics.dat (assets/items/floor/labels.json).
// Run: node tools/test-item-graphics.mjs

import { existsSync, readFileSync } from 'node:fs';
import { Dungeon } from '../src/core/dungeon.js';
import { ITEM_POOLS } from '../src/core/contents.js';
import { floorPicture, globalIndex, itemType, coordinateSet, flipsOnRight, pileShift, projectileAspect, projectileView, scalesWithEnergy, MISSILE_PICTURE_COUNT, CHEST_FLOOR, CHEST_ALCOVE, FLOOR_PICTURE_COUNT } from '../src/core/item-graphics.js';

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

// --- Drawing (item 558) ---------------------------------------------------------
check(coordinateSet(CHEST_FLOOR) === 0 && coordinateSet(2) === 1 && coordinateSet(15) === 2 && coordinateSet(46) === 2, 'coordinate sets: chest 0, scroll 1, bow and crossbow 2');
check(flipsOnRight(CHEST_FLOOR) && flipsOnRight(64) && flipsOnRight(80) && !flipsOnRight(CHEST_ALCOVE) && !flipsOnRight(13), 'mirrored on the right: chest and magical boxes only');
const same = (a, b) => a.x === b.x && a.y === b.y;
check(same(pileShift(0, 0), { x: 2, y: -3 }) && same(pileShift(0, 1), { x: 0, y: -2 }), 'pile, NW: first item +2, -3, then 0, -2 (Encyclopaedia, bytes 1457-1460)');
check(same(pileShift(1, 0), { x: -3, y: -3 }) && same(pileShift(2, 0), pileShift(0, 0)), 'pile, NE starts at the 9th pair; SE as NW');
check(same(pileShift(0, 16), pileShift(0, 0)), 'pile: 16 pairs, then again');
check(same(pileShift(0, 0, true), { x: -3, y: -1 }) && same(pileShift(1, 4, true), pileShift(0, 0, true)), 'alcove: N starts at the 3rd pair, E at the 11th (its 5th item as the 1st of N)');
check(same(pileShift(0, 12, true), pileShift(0, 0, true)), 'alcove: 12 pairs, then again');
const shifts = [0, 1, 2, 3].flatMap((cell) => Array.from({ length: 16 }, (_, rank) => pileShift(cell, rank)));
check(shifts.every(({ x, y }) => Math.abs(x) <= 3 && Math.abs(y) <= 3), 'pile shifts within 3 pixels');

// --- Projectiles (docs/075) -----------------------------------------------------
const missileLabels = JSON.parse(readFileSync(new URL('../assets/items/missiles/labels.json', import.meta.url)));
check(Object.keys(missileLabels).length === MISSILE_PICTURE_COUNT, `${MISSILE_PICTURE_COUNT} missile pictures labelled`);
const [N, E, S, W] = [0, 1, 2, 3];
// Every weapon with a picture of its own: its front picture is labelled with its name.
const weaponNames = dungeon.data.catalog.weapon;
for (const [type, name] of Object.entries(weaponNames)) {
  const aspect = projectileAspect({ kind: 'weapon', type: Number(type) });
  if (aspect === null) continue;
  const { picture } = projectileView(aspect, N, S, 0, true, true); // flying towards the party (spinning ones: on an odd tile): its front
  const label = missileLabels[String(picture).padStart(2, '0')];
  if (!label.includes('(Front)') || !label.toLowerCase().includes(name.toLowerCase())) check(false, `${name}: front picture ${picture} (${label})`);
}
check(projectileAspect({ kind: 'weapon', type: 27 }) === 0 && projectileAspect({ kind: 'cloth', type: 0 }) === null && projectileAspect({ kind: 'weapon', type: 2 }) === null, 'arrow has its picture; clothes and torch fly as on the floor');
check(projectileAspect({ spell: 'fireball' }) === 10 && projectileAspect({ spell: 'openDoor' }) === 11 && scalesWithEnergy(10) && !scalesWithEnergy(0), 'spells: fireball, default picture (Zo); their size follows the energy');
const view = (aspect, flight, facing, cell = 0, onRight = true, odd = false) => projectileView(aspect, flight, facing, cell, onRight, odd);
check(view(0, S, N).picture === 0 && view(0, N, N).picture === 1, 'arrow along the view: front when it comes, back when it goes away');
check(view(0, E, N).picture === 2 && view(0, E, N).flipX && !view(0, W, N).flipX, 'arrow across the view: side view, mirrored when it flies to the right');
check(view(0, S, N, 0, false).flipX && !view(0, S, N, 0, true).flipX, 'arrow seen from the front: mirrored on the left of the view');
check(view(2, S, N, 0, true, true).picture === 6 && view(2, S, N, 0, true, false).picture === 7 && view(2, N, N, 0, true, true).picture === 6, 'axe along the view: it spins, front on odd tiles and back on even ones, whichever way it flies');
check(view(2, S, N, 0).flipY && !view(2, S, N, 2).flipY, 'axe along the view: upside down on the far row');
check(view(3, E, N).picture === 10 && view(9, N, N).picture === 26, 'lightning across: its side; throwing star along: its front');
check(view(10, E, N).picture === 28 && !view(10, E, N).flipX, 'fireball: one picture, never mirrored');

console.log(failures ? `\n${failures} failure(s)` : '\nall ok');
process.exit(failures ? 1 : 0);
