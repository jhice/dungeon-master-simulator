// Pictures of the items (docs/072): the picture of an item lying in the dungeon, and its global index
// (which also gives its icon, graphics 42 to 48, phase I4). Indexed by category and type, as the
// catalog of dungeon.json.
// Source: graphics.dat item 559, "Item descriptors" (180 entries), as the Dungeon Master Encyclopaedia
// gives them ("Dungeon Master and Chaos Strikes Back Items properties",
// http://dmweb.free.fr/community/documentation/dungeon-master-and-chaos-strikes-back/items-properties/).
// The floor picture depends on the type only (ReDMCSB DUNGEON.C, F142; DUNVIEW.C, F115).
// Pictures are numbered as "Item on floor NN" (assets/items/floor/NN.png): the descriptor's byte + 1;
// the chest has two, 00 on the floor and 01 in an alcove.

import { ITEM_POOLS } from './contents.js';

export const CHEST_FLOOR = 0;
export const CHEST_ALCOVE = 1;
export const FLOOR_PICTURE_COUNT = 86;

// prettier-ignore
const FLOOR = {
  scroll: [2],
  container: [CHEST_FLOOR],
  potion: [68, 68, 68, 68, 68, 68, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 69, 69, 69, 69, 81],
  weapon: [
    39, 39, 36, 38, 12, 13, 13, 40, 18, 13, 13, 13, 13, 13, 13, 13, 43, 13, 14, 14, 22, 22, 34,
    44, 45, 15, 46, 17, 47, 12, 48, 49, 50, 51, 12, 32, 32, 12, 12, 12, 52, 33, 31, 66, 46, 83,
  ],
  cloth: [
    24, 24, 24, 56, 9, 25, 25, 25, 25, 70, 25, 25, 70, 8, 8, 58, 24, 24, 30, 70, 70, 25, 25, 54, 54, 10, 10, 10, 55,
    55, 11, 55, 20, 20, 20, 20, 10, 20, 53, 21, 23, 57, 11, 53, 21, 23, 57, 11, 53, 21, 23, 57, 11, 53, 20, 23, 82, 85,
  ],
  miscellaneous: [
    35, 7, 16, 16, 41, 42, 5, 84, 5, 19, 19, 19, 19, 19, 19, 19, 19, 63, 63, 63, 63, 63, 63, 63, 63, 77, 4,
    61, 62, 28, 29, 26, 27, 72, 71, 6, 67, 16, 16, 59, 60, 60, 80, 64, 65, 73, 74, 75, 76, 78, 79, 75, 42,
  ],
};

// prettier-ignore
const GLOBAL = {
  scroll: [30],
  container: [144],
  potion: [148, 149, 150, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 195],
  weapon: [
    16, 18, 4, 14, 20, 23, 25, 27, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46,
    47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 135, 143, 28,
  ],
  cloth: [
    80, 81, 82, 112, 114, 67, 83, 68, 84, 69, 70, 85, 86, 71, 87, 119, 72, 88, 113, 89, 73, 74, 90, 103, 104, 96, 97, 98, 105,
    106, 108, 107, 75, 91, 76, 92, 99, 115, 100, 77, 93, 116, 109, 101, 78, 94, 117, 110, 102, 79, 95, 118, 111, 140, 141, 142, 194, 196,
  ],
  miscellaneous: [
    0, 8, 10, 12, 146, 147, 125, 126, 127, 176, 177, 178, 179, 180, 181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 128, 129,
    130, 131, 168, 169, 170, 171, 172, 173, 174, 175, 120, 121, 122, 123, 124, 132, 133, 134, 136, 137, 138, 139, 192, 193, 197, 198,
  ],
};

/** Type of an item reference ({ kind, index }) in its category (scrolls have one type). */
export function itemType(dungeon, { kind, index }) {
  return dungeon.data[ITEM_POOLS[kind]][index]?.type ?? 0;
}

/**
 * Number of the picture of an item lying in the dungeon (assets/items/floor/NN.png), or null if unknown.
 * @param {boolean} [inAlcove] the chest has its own picture in an alcove
 */
export function floorPicture(kind, type, inAlcove = false) {
  const picture = FLOOR[kind]?.[type];
  if (picture === undefined) return null;
  return picture === CHEST_FLOOR && inAlcove ? CHEST_ALCOVE : picture;
}

/** Global index of an item type (graphics.dat item 559), or null if unknown. */
export function globalIndex(kind, type) {
  return GLOBAL[kind]?.[type] ?? null;
}

// Drawing of the floor pictures (graphics.dat item 558, "Items graphics definitions"; ReDMCSB DUNVIEW.C, F115).
// Coordinate set of each picture: 0 by default, 2 for the large ones (bow, crossbow, armours), drawn a little lower
// on the screen, so nearer; set 1 differs from set 0 only in alcoves.
const SET_2 = new Set([15, 20, 21, 23, 46]);
// prettier-ignore
const SET_1 = new Set([
  2, 3, 4, 5, 6, 10, 12, 13, 16, 17, 19, 22, 26, 27, 28, 29, 31, 32, 33, 35, 36, 39, 40, 43, 44, 47, 48, 49, 50, 51,
  54, 59, 60, 61, 62, 63, 64, 65, 67, 68, 69, 74, 75, 76, 78, 79, 80, 81, 83, 84,
]);
// Mirrored on the right of the view (lane on the right, or right column of the middle lane), not in an alcove:
// the chest and the two magical boxes.
const FLIP_ON_RIGHT = new Set([CHEST_FLOOR, 64, 80]);

/** Coordinate set (0, 1 or 2) of a floor picture. */
export function coordinateSet(picture) {
  return SET_2.has(picture) ? 2 : SET_1.has(picture) ? 1 : 0;
}

/** Is a floor picture mirrored on the right of the view? */
export function flipsOnRight(picture) {
  return FLIP_ON_RIGHT.has(picture);
}

// Piles: the items of a sub-tile, or of an alcove, are shifted by a few pixels, one pair of shifts per item in the
// order they were put down (G217, 16 pairs of indices in a shift set). Shift set 0 is the one of the pictures at
// their size (D0 back, D1 front); further, DM uses smaller shifts for the smaller pictures (sets 1, 2).
const SHIFT_SET_0 = [0, 1, 2, 3, 0, -3, -2, -1]; // pixels (G223, set 0)
// prettier-ignore
const PILE_SHIFTS = [
  [2, 5], [0, 6], [5, 7], [3, 0], [7, 1], [1, 2], [6, 3], [3, 3],
  [5, 5], [2, 6], [7, 7], [1, 0], [3, 1], [6, 2], [1, 3], [5, 3],
];

/**
 * Shift of the rank-th item of a pile (0: the first put down), in pixels at the size of the pictures:
 * { x: to the right of the screen, y: down the screen }. In DM, the pile of an odd cell (NE, SW; an alcove of the
 * east or west face) starts at the 9th pair; a pile in an alcove starts at the 3rd pair and keeps to pairs 3 to 14.
 * @param {number} cell sub-tile 0..3 (NW, NE, SE, SW), or face 0..3 (N, E, S, W) of an alcove
 */
export function pileShift(cell, rank, inAlcove = false) {
  const odd = (cell & 1) << 3;
  let index;
  if (inAlcove) {
    index = 2 + odd;
    for (let i = 0; i < rank; i++) index = index + 1 >= 14 ? 2 : index + 1;
  } else {
    index = (odd + rank) & 15;
  }
  const [x, y] = PILE_SHIFTS[index];
  return { x: SHIFT_SET_0[x], y: SHIFT_SET_0[y] };
}

// --- Projectiles (docs/075) -------------------------------------------------------------------------------------
// Pictures of the projectiles (graphics.dat item 558, "Projectile graphics definitions", 14 aspects; ReDMCSB
// DUNVIEW.C, F115), numbered from the first (assets/items/missiles/NN.png). Aspect types (GraphicInfo & 3):
// 0 back view and spin (axe, clubs), 1 back view (arrow, dagger…), 2 no back view, spin (lightning, star),
// 3 neither (spells). `side`: there is a side view (after the back view if any). `magic`: the size follows the
// energy of the projectile.
export const MISSILE_PICTURE_COUNT = 32;
// prettier-ignore
const PROJECTILE_ASPECTS = [
  { first: 0, type: 1, side: true }, // arrow
  { first: 3, type: 1, side: true }, // dagger
  { first: 6, type: 0, side: true }, // axe, hardcleave
  { first: 9, type: 2, side: true, magic: true }, // lightning bolt
  { first: 11, type: 1, side: true }, // slayer
  { first: 14, type: 0, side: true }, // stone club
  { first: 17, type: 0, side: true }, // club
  { first: 20, type: 1, side: true }, // poison dart
  { first: 23, type: 1, side: true }, // swords
  { first: 26, type: 2, side: true }, // throwing star
  { first: 28, type: 3, magic: true }, // fireball
  { first: 29, type: 3, magic: true }, // other spells (Zo, harm non-material…)
  { first: 30, type: 3, magic: true }, // poison blob (slime)
  { first: 31, type: 3, magic: true }, // poison bolt, poison cloud
];
// Weapons thrown with a picture of their own (graphics.dat item 559, weapon descriptors, bits 12-8), by type;
// the others fly as their floor picture.
// prettier-ignore
const WEAPON_PROJECTILE = {
  27: 0, 8: 1, 18: 2, 19: 2, 28: 4, 24: 5, 23: 6, 31: 7, 32: 9,
  5: 8, 6: 8, 9: 8, 10: 8, 11: 8, 12: 8, 13: 8, 14: 8, 15: 8, 17: 8, // swords
};
// Spells in flight (F142): fireball, lightning, poison; any other the default picture.
const SPELL_PROJECTILE = { fireball: 10, lightningBolt: 3, poisonBolt: 13, poisonCloud: 13, slime: 12 };
const DEFAULT_SPELL_PROJECTILE = 11;

/** Projectile aspect (index above) of a thrown item ({ kind, type }) or a spell, or null: the item flies as on the floor. */
export function projectileAspect({ kind, type, spell }) {
  if (spell) return SPELL_PROJECTILE[spell] ?? DEFAULT_SPELL_PROJECTILE;
  return kind === 'weapon' ? (WEAPON_PROJECTILE[type] ?? null) : null;
}

/** Does the size of this aspect follow the energy of the projectile (spells)? */
export const scalesWithEnergy = (aspect) => Boolean(PROJECTILE_ASPECTS[aspect].magic);

/**
 * The picture of a projectile as the party sees it, as F115 chooses it: { picture (assets/items/missiles/NN),
 * flipX, flipY }.
 * @param {number} aspect projectileAspect()
 * @param {number} flight direction of the flight, 0..3 (N, E, S, W)
 * @param {number} facing direction of the party, 0..3
 * @param {number} cell sub-tile of the projectile, 0..3 (NW, NE, SE, SW)
 * @param {boolean} onRight right of the party's column (DM: lane on the right, or right column of the middle lane)
 * @param {boolean} oddTile (x + y) of its tile is odd: a spinning projectile shows its other face
 */
export function projectileView(aspect, flight, facing, cell, onRight, oddTile) {
  const { first, type, side } = PROJECTILE_ASPECTS[aspect];
  if (type === 3) return { picture: first, flipX: false, flipY: false };
  // View cell as DM numbers it: 0 far left, 1 far right, 2 near right, 3 near left.
  const viewCell = (cell - facing + 4) % 4;
  const spinsWithBack = type === 0;
  if (flight % 2 !== facing % 2) {
    // Across the view: its side view, pointing left; mirrored when it flies to the right.
    let flipX = flight === (facing + 1) % 4;
    let flipY = false;
    if (spinsWithBack) {
      flipY = oddTile;
      flipX = viewCell === 0 || viewCell === 3;
      if (!flipY) flipX = !flipX;
    }
    return { picture: first + (type === 2 ? 1 : 2), flipX, flipY };
  }
  // Along the view: its front, or its back when it flies away (spinning: every other tile).
  const front = type >= 2 || (type === 1 && flight !== facing) || (spinsWithBack && oddTile);
  return {
    picture: first + (front ? 0 : 1),
    flipX: Boolean(side) && !onRight,
    flipY: spinsWithBack && viewCell < 2,
  };
}
