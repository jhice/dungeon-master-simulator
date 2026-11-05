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

/** Frames a species needs for its views: the four of the sides, or the only one. */
export const viewFrames = (hasViews) => (hasViews ? Object.values(VIEW_FRAMES) : [VIEW_FRAMES.front]);
