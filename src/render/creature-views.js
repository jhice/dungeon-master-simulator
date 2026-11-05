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
 * @param {number|null} attackFrame frame of a creature attacking now. As in DM (ReDMCSB F115), it replaces
 *   the front only: an attack seen from the side or the back does not show.
 * @returns {number} index of the frame
 */
export function viewFrame(facing, turns, hasViews = true, attackFrame = null) {
  const turn = (FACINGS.indexOf(facing) - viewDirection(turns) + 4) % 4;
  const frame = hasViews ? VIEW_FRAMES[VIEW_BY_TURN[turn]] : VIEW_FRAMES.front;
  return frame === VIEW_FRAMES.front && attackFrame !== null ? attackFrame : frame;
}

// Places of DM in a tile, as the party sees it (graphics.dat item 558, ReDMCSB F115), in tiles.
const FRONT_ROW = 0.2; // towards the party, from the centre of the tile (set by eye in the game; DM: Y = 119, docs/069)
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

/**
 * Life of a creature standing still, as DM draws it (ReDMCSB F179): at each update of its aspect, its
 * picture moves by a few pixels, and its front may be mirrored. `idleOffset` is a range: 2 gives -1, 0 or 1.
 * @param {{ idleFlip: boolean, idleOffset: [number, number] }} entry entry of frames.json
 * @returns {{ flip: boolean, dx: number, dy: number }} dx to the right, dy down, in pixels at D1
 */
export function rollIdle({ idleFlip, idleOffset: [rangeX, rangeY] }, random = Math.random) {
  const shift = (range) => Math.floor(random() * range) * (random() < 0.5 ? -1 : 1) || 0;
  return { flip: idleFlip && random() < 0.5, dx: shift(rangeX), dy: shift(rangeY) };
}

/** Does a species move at all when standing still? */
export const hasIdle = ({ idleFlip, idleOffset: [rangeX, rangeY] }) => idleFlip || rangeX > 1 || rangeY > 1;

/** Frames a species needs: the four of the sides, or the only one; and its attack, if it has one. */
export const viewFrames = (hasViews, attackFrame = null) => [
  ...(hasViews ? Object.values(VIEW_FRAMES) : [VIEW_FRAMES.front]),
  ...(attackFrame === null ? [] : [attackFrame]),
];
