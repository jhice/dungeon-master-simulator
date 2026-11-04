// Which tiles each light of the first-person view sees (docs/038, docs/062). Exact on the grid, not
// sampled by rays, whose gaps left dark a thin strip of wall seen past a corner: tiles are taken
// from the nearest to the light, and each opaque one hides the angles it spans. A tile is seen if
// some of its angles are still free, so an opaque tile is seen too (its faces are lit). Along a ray,
// the tiles crossed never get nearer to the light, so a tile's hiders always come before it.
// Without DOM nor Three.js: tested in Node (tools/test-motion.mjs).

const EPSILON = 1e-6; // radians: a gap narrower than that between two tiles is no gap

// The angles of a tile from a point: [low, high], maybe beyond ±π (added as two parts).
function spanOf(px, pz, x, y) {
  const middle = Math.atan2(y + 0.5 - pz, x + 0.5 - px);
  let low = 0;
  let high = 0;
  for (const [cx, cy] of [[x, y], [x + 1, y], [x, y + 1], [x + 1, y + 1]]) {
    let delta = Math.atan2(cy - pz, cx - px) - middle;
    if (delta > Math.PI) delta -= 2 * Math.PI;
    if (delta < -Math.PI) delta += 2 * Math.PI;
    low = Math.min(low, delta);
    high = Math.max(high, delta);
  }
  return [middle + low, middle + high];
}

// `hidden`: sorted intervals of angles in -π..π, not overlapping.
function hide(hidden, low, high) {
  if (low < -Math.PI) {
    hide(hidden, low + 2 * Math.PI, Math.PI);
    low = -Math.PI;
  }
  if (high > Math.PI) {
    hide(hidden, -Math.PI, high - 2 * Math.PI);
    high = Math.PI;
  }
  let i = 0;
  while (i < hidden.length && hidden[i][1] < low - EPSILON) i++;
  let end = i;
  while (end < hidden.length && hidden[end][0] <= high + EPSILON) {
    low = Math.min(low, hidden[end][0]);
    high = Math.max(high, hidden[end][1]);
    end++;
  }
  hidden.splice(i, end - i, [low, high]);
}

function isFree(hidden, low, high) {
  if (low < -Math.PI) return isFree(hidden, low + 2 * Math.PI, Math.PI) || isFree(hidden, -Math.PI, high);
  if (high > Math.PI) return isFree(hidden, low, Math.PI) || isFree(hidden, -Math.PI, high - 2 * Math.PI);
  let from = low;
  for (const [a, b] of hidden) {
    if (b <= from) continue;
    if (a >= high) break;
    if (a > from + EPSILON) return true;
    from = b;
    if (from >= high - EPSILON) return false;
  }
  return from < high - EPSILON;
}

/**
 * Bits of the lights seeing each tile: Uint8Array(width × height), bit i for sources[i].
 * @param {number} width
 * @param {number} height
 * @param {(x, y) => boolean} opaque
 * @param {Array<{ x: number, z: number, reach: number }|null>} sources light positions (in tiles) and reach
 */
export function lightMasks(width, height, opaque, sources) {
  const masks = new Uint8Array(width * height);
  sources.forEach((source, bit) => updateLightMask(masks, width, height, opaque, source, bit));
  return masks;
}

/** Computes again the bit of one light in the masks, in place (a light that moved, docs/062). */
export function updateLightMask(masks, width, height, opaque, source, bit) {
  const others = ~(1 << bit);
  for (let i = 0; i < masks.length; i++) masks[i] &= others;
  if (!source) return;
  const { x: px, z: pz } = source;
  const [sx, sy] = [Math.floor(px), Math.floor(pz)];
  const r = Math.ceil(source.reach);
  const tiles = [];
  for (let y = Math.max(0, sy - r); y <= Math.min(height - 1, sy + r); y++) {
    for (let x = Math.max(0, sx - r); x <= Math.min(width - 1, sx + r); x++) {
      const dx = Math.max(x - px, 0, px - x - 1);
      const dy = Math.max(y - pz, 0, pz - y - 1);
      tiles.push({ x, y, distance: dx * dx + dy * dy });
    }
  }
  tiles.sort((a, b) => a.distance - b.distance);
  const hidden = [];
  for (const { x, y } of tiles) {
    // Its own tile never hides anything: a light is at a place it lights.
    if (x === sx && y === sy) {
      masks[y * width + x] |= 1 << bit;
      continue;
    }
    const [low, high] = spanOf(px, pz, x, y);
    if (!isFree(hidden, low, high)) continue;
    masks[y * width + x] |= 1 << bit;
    if (opaque(x, y)) hide(hidden, low, high);
  }
}
