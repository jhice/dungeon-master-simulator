// Which picture of a creature the party sees (docs/066, docs/067): its facing against the direction
// of the view, as the nose of the 3D markers. Without DOM nor Three.js: tested in Node (tools/test-sprites.mjs).
// `side` looks towards the right of the picture, `side2` towards the left.

import { FACINGS } from '../core/dungeon.js';

export const VIEW_FRAMES = { front: 0, side: 1, back: 2, side2: 3 };

// By (creature - view) in quarter turns: same direction, its back; opposite, its face.
const VIEW_BY_TURN = ['back', 'side', 'front', 'side2'];

/** The view direction shown, 0..3, for a pose of the camera in quarter turns (may be past 0..3, or between two). */
export function viewDirection(turns) {
  return ((Math.round(turns) % 4) + 4) % 4;
}

/**
 * @param {string} facing facing of the creature ('N', 'E', 'S', 'W')
 * @param {number} turns direction of the view in quarter turns (camera pose)
 * @param {boolean} hasViews false: the same picture whatever the side (Ghost, Swamp Slime…)
 * @returns {number} index of the frame
 */
export function viewFrame(facing, turns, hasViews = true) {
  if (!hasViews) return VIEW_FRAMES.front;
  const turn = (FACINGS.indexOf(facing) - viewDirection(turns) + 4) % 4;
  return VIEW_FRAMES[VIEW_BY_TURN[turn]];
}

// Places of DM in a tile, as the party sees it (graphics.dat item 558, ReDMCSB F115), in tiles.
const FRONT_ROW = 0.2; // towards the party, from the centre of the tile: with the depth of the sprites, Y = 119 of DM
const HALF_COLUMN = 0.19; // 30 pixels at D1, each side of the centre
const LOW_SET = 1; // coordinate set of DM, "low": its lone creature stands on the front row

/**
 * Where a member stands in its tile when DM places it by the view, not by its sub-tile: a species of half
 * a tile (size 1), side by side seen from the front, one behind the other seen from the side; a lone
 * creature of the low set, on the front row.
 * @param {{ size: number, coordinateSet: number }} species
 * @param {string} facing facing of the group
 * @param {number} turns direction of the view in quarter turns
 * @param {number} index place of the member in its group
 * @param {number} count members left in the group
 * @returns {{ lateral: number, depth: number }|null} to the right of the view, towards the party; null: it stands in its own sub-tile
 */
export function viewSpot({ size, coordinateSet }, facing, turns, index, count) {
  const sideView = (FACINGS.indexOf(facing) - viewDirection(turns) + 4) % 2 === 1;
  if (size === 1) {
    if (count === 1) return { lateral: 0, depth: sideView ? 0 : FRONT_ROW };
    if (sideView) return { lateral: 0, depth: index ? FRONT_ROW : -FRONT_ROW };
    return { lateral: index ? HALF_COLUMN : -HALF_COLUMN, depth: FRONT_ROW };
  }
  return count === 1 && coordinateSet === LOW_SET ? { lateral: 0, depth: FRONT_ROW } : null;
}

/** Frames a species needs for its views: the four of the sides, or the only one. */
export const viewFrames = (hasViews) => (hasViews ? Object.values(VIEW_FRAMES) : [VIEW_FRAMES.front]);
