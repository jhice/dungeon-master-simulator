// Stairs of the first-person view (docs/064), after the pictures of DM: a closed tunnel, sloping
// up or down from the access side, with wooden handrails and plaster walls, that fades to black.
// All 58 stairs of the dungeon are walls on three sides and hold no item: the party only ever
// looks in through the access side. So a tunnel can run on past its tile, over the wall tiles
// (above the height of the walls) or under them (below the floor), where nothing else is.
//
// Model: x across, y up, floor of the level at y = 0, access side at z = -0.5, going towards +z.
// Each part is one geometry (one material), with the fade in its vertex colours.

import * as THREE from 'three';

const UP = { width: 0.495, length: 2, steps: 8, railX: 0.43 };
// Going down, a straight slope would be hidden by the edge of the floor in front of it: the floor
// goes down gently, the ceiling steeply (it must be under the floor level at the end of the tile).
const DOWN = { width: 0.4, wall: 0.495, mouth: -0.35, length: 1.6, steps: 7, stepRise: 0.075, ceilingBands: 6, railX: 0.355 };
const STEP_DEPTH = 0.25;
const SEGMENT = 0.1; // length of the pieces of what is long, for its fade
const RAIL = { width: 0.05, height: 0.075 };

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const fadeUp = (z) => clamp01((1.15 - z) / 1.25) ** 1.6;
const fadeDown = (z) => clamp01((0.95 - z) / 1.3) ** 1.5;

// Triangles with their normals, UVs and fade.
function builder(fade) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const vertex = ([x, y, z], normal, [u, v]) => {
    positions.push(x, y, z);
    normals.push(...normal);
    uvs.push(u, v);
    const shade = fade(z);
    colors.push(shade, shade, shade);
  };
  return {
    /** Four corners in turn, facing `normal` (the winding follows it), UVs in the same order. */
    quad(a, b, c, d, normal, uv = [[0, 0], [1, 0], [1, 1], [0, 1]]) {
      const [ux, uy, uz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const [vx, vy, vz] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const facing = (uy * vz - uz * vy) * normal[0] + (uz * vx - ux * vz) * normal[1] + (ux * vy - uy * vx) * normal[2];
      const order = facing > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      const corners = [a, b, c, d];
      for (const i of order) vertex(corners[i], normal, uv[i]);
    },
    geometry() {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      return geometry;
    },
  };
}

// A wall along z at x, cut in pieces for its fade, facing `nx` (±1); UVs: one per tile.
function sideWall(b, x, nx, y0, y1, z0, z1) {
  for (let z = z0; z < z1 - 1e-6; z += SEGMENT) {
    const end = Math.min(z + SEGMENT, z1);
    b.quad([x, y0, z], [x, y0, end], [x, y1, end], [x, y1, z], [nx, 0, 0], [[z, y0], [end, y0], [end, y1], [z, y1]]);
  }
}

// A flat piece across the tunnel, level (facing up or down, `ny`).
function level(b, x0, x1, y, z0, z1, ny) {
  b.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, ny, 0], [[x0 + 0.5, 0], [x1 + 0.5, 0], [x1 + 0.5, 1], [x0 + 0.5, 1]]);
}

// A piece across the tunnel, upright, facing the party; v = 1 at its top (the edge of a step).
function upright(b, x0, x1, y0, y1, z) {
  b.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, -1], [[x0 + 0.5, 0], [x1 + 0.5, 0], [x1 + 0.5, 1], [x0 + 0.5, 1]]);
}

// A beam from (y0, z0) to (y1, z1) at x, in pieces for its fade; the grain runs along it.
function beam(b, x, y0, z0, y1, z1) {
  const [w, h] = [RAIL.width / 2, RAIL.height / 2];
  const pieces = Math.ceil((z1 - z0) / SEGMENT);
  const at = (i) => [y0 + ((y1 - y0) * i) / pieces, z0 + ((z1 - z0) * i) / pieces];
  const length = Math.hypot(y1 - y0, z1 - z0);
  const [ny, nz] = [(z1 - z0) / length, -(y1 - y0) / length]; // up, across the beam
  for (let i = 0; i < pieces; i++) {
    const [ya, za] = at(i);
    const [yb, zb] = at(i + 1);
    const uv = [[0, i], [1, i], [1, i + 1], [0, i + 1]];
    const edge = (sx, sh, sx2, sh2, normal) =>
      b.quad(
        [x + sx * w, ya + sh * h * ny, za + sh * h * nz],
        [x + sx2 * w, ya + sh2 * h * ny, za + sh2 * h * nz],
        [x + sx2 * w, yb + sh2 * h * ny, zb + sh2 * h * nz],
        [x + sx * w, yb + sh * h * ny, zb + sh * h * nz],
        normal,
        uv,
      );
    edge(-1, 1, 1, 1, [0, ny, nz]); // top
    edge(-1, -1, 1, -1, [0, -ny, -nz]); // under
    edge(-1, -1, -1, 1, [-1, 0, 0]);
    edge(1, -1, 1, 1, [1, 0, 0]);
  }
}

// A block, all six faces.
function block(b, x0, x1, y0, y1, z0, z1) {
  level(b, x0, x1, y1, z0, z1, 1);
  level(b, x0, x1, y0, z0, z1, -1);
  upright(b, x0, x1, y0, y1, z0);
  b.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]);
  b.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]);
  b.quad([x1, y0, z0], [x1, y0, z1], [x1, y1, z1], [x1, y1, z0], [1, 0, 0]);
}

// A handrail on each side: a beam, and the block that fastens its near end to the wall, with a rivet.
function handrails(rails, rivets, { x, wall, y0, z0, y1, z1, blockY, blockZ }) {
  for (const side of [-1, 1]) {
    beam(rails, side * x, y0, z0, y1, z1);
    const [inner, outer] = [side * (x - RAIL.width), side * wall];
    const [xa, xb] = side > 0 ? [inner, outer] : [outer, inner];
    block(rails, xa, xb, blockY - RAIL.height / 2, blockY + RAIL.height / 2, blockZ - 0.05, blockZ + 0.05);
    const rivet = side * x;
    block(rivets, rivet - 0.008, rivet + 0.008, blockY - 0.008, blockY + 0.008, blockZ - 0.056, blockZ - 0.05);
  }
}

function upGeometries(wallHeight) {
  const parts = { steps: builder(fadeUp), stone: builder(fadeUp), walls: builder(fadeUp), rails: builder(fadeUp), rivets: builder(fadeUp) };
  const { width: w, length, steps, railX } = UP;
  const depth = length / steps;
  const rise = wallHeight * depth; // reaches the height of the walls at the end of the tile
  for (let i = 0; i < steps; i++) {
    const z = -0.5 + i * depth;
    upright(parts.steps, -w, w, i * rise, (i + 1) * rise, z);
    level(parts.steps, -w, w, (i + 1) * rise, z, z + depth, 1);
  }
  const end = -0.5 + length;
  const top = wallHeight * (length + 1);
  // The ceiling rises as the steps, from the ceiling of the corridor.
  for (let z = -0.5; z < end - 1e-6; z += SEGMENT) {
    const y = (at) => wallHeight * (at + 1.5);
    const zb = Math.min(z + SEGMENT, end);
    parts.stone.quad([-w, y(z), z], [w, y(z), z], [w, y(zb), zb], [-w, y(zb), zb], [0, -Math.SQRT1_2, -Math.SQRT1_2], [[0, z], [1, z], [1, zb], [0, zb]]);
  }
  for (const side of [-1, 1]) sideWall(parts.walls, side * w, -side, 0, top, -0.5, end);
  const railY = (z) => wallHeight * (z + 0.5) + 0.24;
  handrails(parts.rails, parts.rivets, { x: railX, wall: w, y0: railY(-0.39), z0: -0.39, y1: railY(end), z1: end, blockY: railY(-0.39), blockZ: -0.39 });
  return parts;
}

function downGeometries(wallHeight) {
  const parts = { steps: builder(fadeDown), stone: builder(fadeDown), walls: builder(fadeDown), rails: builder(fadeDown), rivets: builder(fadeDown) };
  const { width: w, wall, mouth, length, steps, stepRise, ceilingBands, railX } = DOWN;
  const end = -0.5 + length;
  // Steps: the first one under the edge of the floor, none above its neighbour.
  for (let i = 0; i < steps; i++) {
    const z = -0.5 + i * STEP_DEPTH;
    level(parts.steps, -w, w, -(i + 1) * stepRise, z, z + STEP_DEPTH, 1);
    if (i) upright(parts.steps, -w, w, -(i + 1) * stepRise, -i * stepRise, z);
  }
  // The ceiling goes down by bands, each one facing the party, from the ceiling of the corridor to
  // the floor level at the end of the tile.
  const bandDepth = (0.5 - mouth) / 3;
  const bandDrop = wallHeight / 3;
  for (let k = 0; k < ceilingBands; k++) {
    const z = mouth + k * bandDepth;
    const y = wallHeight - (k + 1) * bandDrop;
    upright(parts.steps, -w, w, y, y + bandDrop, z);
    level(parts.stone, -w, w, y, z, z + bandDepth, -1);
  }
  // Walls: the plaster of the mouth and its return, a ledge of floor in front of it, then the cheeks of stone.
  const bottom = -(steps + 1) * stepRise - 0.1;
  for (const side of [-1, 1]) {
    sideWall(parts.walls, side * wall, -side, -0.01, wallHeight, -0.5, mouth);
    const [xa, xb] = side > 0 ? [w, wall] : [-wall, -w];
    upright(parts.stone, xa, xb, 0, wallHeight, mouth);
    level(parts.stone, xa, xb, 0, -0.5, mouth, 1);
    sideWall(parts.stone, side * w, -side, -0.2, 0, -0.5, mouth);
    sideWall(parts.stone, side * w, -side, bottom - 1, wallHeight, mouth, end);
  }
  const railY = (z) => 0.33 - 0.6 * (z + 0.41);
  handrails(parts.rails, parts.rivets, { x: railX, wall, y0: railY(-0.41), z0: -0.41, y1: railY(0.65), z1: 0.65, blockY: railY(-0.41), blockZ: -0.41 });
  return parts;
}

/**
 * The geometries of the stairs, by part name, for level-meshes.js. Their parts: `steps` (with the
 * edge of a step at the top of the texture), `stone`, `walls`, `rails`, `rivets`.
 * @returns {Record<string, THREE.BufferGeometry>} stairsUpSteps, stairsUpStone… stairsDownRivets
 */
export function stairsGeometries(wallHeight) {
  const named = (prefix, parts) => Object.entries(parts).map(([part, b]) => [`${prefix}${part[0].toUpperCase()}${part.slice(1)}`, b.geometry()]);
  return Object.fromEntries([...named('stairsUp', upGeometries(wallHeight)), ...named('stairsDown', downGeometries(wallHeight))]);
}

/** The names of the parts of a staircase going up or down. */
export const stairsParts = (goingUp) => ['Steps', 'Stone', 'Walls', 'Rails', 'Rivets'].map((part) => `stairs${goingUp ? 'Up' : 'Down'}${part}`);
