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
