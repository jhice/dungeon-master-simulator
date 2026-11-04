// Stairs of the first-person view (docs/064), after the pictures of DM: a closed tunnel with the
// walls and the floor colour of the level, wooden handrails, that fades to black.
// All 58 stairs of the dungeon are walls on three sides and hold no item: the party only ever
// looks in through the access side. So the steps can run on past their tile: over the wall tile
// behind (above the height of the walls), or under it (below the floor), where nothing else is.
//
// Model: x across, y up, floor of the level at y = 0, access side at z = -0.5, going towards +z.
// Each part is one geometry (one material), with the fade in its vertex colours. Textures are laid
// at one repeat per tile, on every face: nothing is stretched.

import * as THREE from 'three';

const WIDTH = 0.495; // half; a hair inside the walls around
const STEP_DEPTH = 0.25;
const STEPS = 8;
const LENGTH = STEPS * STEP_DEPTH;
const END = -0.5 + LENGTH;
const RAIL_X = 0.43;
const RAIL = { width: 0.05, height: 0.075 };
const SEGMENT = 0.1; // length of the pieces of what is long, for its fade
const NOSE = { size: 0.012, tint: 0.45 }; // the dark line that parts two steps
const BACK = 0.002; // in front of the wall behind, where a face is level with it
// Going down: a slope as steep as the way up would be hidden by the edge of the floor in front of it.
const DOWN_STEP_RISE = 0.09;
const DOWN_CEILING_RISE = 0.15; // at its start, over the ceiling of the corridor: less crushing
const DOWN_CEILING_END = 1.25; // where it meets the steps

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const fadeUp = (x, y, z) => clamp01((1.15 - z) / 1.25) ** 1.6; // along the way up
const fadeDown = (x, y) => clamp01((y + 0.6) / 0.6) ** 1.5; // under the floor of the level

// Triangles with their normals, UVs and fade.
function builder(fade) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const colors = [];
  const vertex = (point, normal, uv, tint) => {
    positions.push(...point);
    normals.push(...normal);
    uvs.push(...uv);
    const shade = fade(...point) * tint;
    colors.push(shade, shade, shade);
  };
  return {
    /** Four corners in turn, facing `normal` (the winding follows it), UVs in the same order. */
    quad(a, b, c, d, normal, uv = [[0, 0], [1, 0], [1, 1], [0, 1]], tint = 1) {
      const [ux, uy, uz] = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const [vx, vy, vz] = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const facing = (uy * vz - uz * vy) * normal[0] + (uz * vx - ux * vz) * normal[1] + (ux * vy - uy * vx) * normal[2];
      const order = facing > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      const corners = [a, b, c, d];
      for (const i of order) vertex(corners[i], normal, uv[i], tint);
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

// A wall along z at x, cut in pieces for its fade, facing `nx` (±1). Its texture spans one tile
// across and the height of a wall, as on the walls of the level.
function sideWall(b, x, nx, y0, y1, z0, z1, wallHeight) {
  const v = (y) => y / wallHeight;
  for (let z = z0; z < z1 - 1e-6; z += SEGMENT) {
    const end = Math.min(z + SEGMENT, z1);
    b.quad([x, y0, z], [x, y0, end], [x, y1, end], [x, y1, z], [nx, 0, 0], [[z, v(y0)], [end, v(y0)], [end, v(y1)], [z, v(y1)]]);
  }
}

// A flat piece across the tunnel (facing up or down, `ny`); its texture is laid as on the floor.
function level(b, x0, x1, y, z0, z1, ny, tint) {
  b.quad([x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1], [0, ny, 0], [[x0 + 0.5, z0], [x1 + 0.5, z0], [x1 + 0.5, z1], [x0 + 0.5, z1]], tint);
}

// A piece across the tunnel, upright, facing the party.
function upright(b, x0, x1, y0, y1, z, tint) {
  b.quad([x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [0, 0, -1], [[x0 + 0.5, y0], [x1 + 0.5, y0], [x1 + 0.5, y1], [x0 + 0.5, y1]], tint);
}

// A beam from (y0, z0) to (y1, z1) at x, in pieces for its fade; the grain runs along it.
function beam(b, x, y0, z0, y1, z1) {
  const [w, h] = [RAIL.width / 2, RAIL.height / 2];
  const pieces = Math.ceil(Math.abs(z1 - z0) / SEGMENT);
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
function handrails(rails, rivets, { y0, z0, y1, z1 }) {
  for (const side of [-1, 1]) {
    beam(rails, side * RAIL_X, y0, z0, y1, z1);
    const [inner, outer] = [side * (RAIL_X - RAIL.width), side * WIDTH];
    const [xa, xb] = side > 0 ? [inner, outer] : [outer, inner];
    block(rails, xa, xb, y0 - RAIL.height / 2, y0 + RAIL.height / 2, z0 - 0.05, z0 + 0.05);
    const rivet = side * RAIL_X;
    block(rivets, rivet - 0.008, rivet + 0.008, y0 - 0.008, y0 + 0.008, z0 - 0.056, z0 - 0.05);
  }
}

const newParts = (fade) => ({ steps: builder(fade), walls: builder(fade), ceiling: builder(fade), rails: builder(fade), rivets: builder(fade) });

// The first step is at the level of the floor; the steps reach the height of the walls at the end
// of the tile, and go on over the wall tile behind.
function upGeometries(wallHeight) {
  const parts = newParts(fadeUp);
  const rise = wallHeight * STEP_DEPTH;
  for (let i = 0; i < STEPS; i++) {
    const z = -0.5 + i * STEP_DEPTH;
    const y = i * rise;
    if (i) {
      upright(parts.steps, -WIDTH, WIDTH, y - rise + NOSE.size, y, z - BACK);
      upright(parts.steps, -WIDTH, WIDTH, y - rise, y - rise + NOSE.size, z - BACK, NOSE.tint);
    }
    level(parts.steps, -WIDTH, WIDTH, y, z - BACK, z + STEP_DEPTH - BACK, 1);
  }
  // The ceiling rises as the steps, from the ceiling of the corridor.
  const ceilingY = (z) => wallHeight * (z + 1.5);
  for (let z = -0.5; z < END - 1e-6; z += SEGMENT) {
    const zb = Math.min(z + SEGMENT, END);
    parts.ceiling.quad([-WIDTH, ceilingY(z), z], [WIDTH, ceilingY(z), z], [WIDTH, ceilingY(zb), zb], [-WIDTH, ceilingY(zb), zb], [0, -Math.SQRT1_2, -Math.SQRT1_2], [[0, z], [1, z], [1, zb], [0, zb]]);
  }
  for (const side of [-1, 1]) sideWall(parts.walls, side * WIDTH, -side, 0, ceilingY(END), -0.5, END, wallHeight);
  const railY = (z) => wallHeight * (z + 0.5) + 0.24;
  handrails(parts.rails, parts.rivets, { y0: railY(-0.39), z0: -0.39, y1: railY(END), z1: END });
  return parts;
}

// A smooth ceiling comes down, from a little higher than the corridor's, to pass under the wall tile
// behind at the end of the tile; it meets the steps, which go down more gently, in the dark.
function downGeometries(wallHeight) {
  const parts = newParts(fadeDown);
  const top = wallHeight + DOWN_CEILING_RISE;
  for (let i = 0; i < STEPS; i++) {
    const z = -0.5 + i * STEP_DEPTH;
    const y = -(i + 1) * DOWN_STEP_RISE;
    level(parts.steps, -WIDTH, WIDTH, y, z, z + NOSE.size * 2, 1, NOSE.tint);
    level(parts.steps, -WIDTH, WIDTH, y, z + NOSE.size * 2, z + STEP_DEPTH, 1);
  }
  const ceilingY = (z) => top * (0.5 - z);
  const along = Math.hypot(top, 1); // length of the ceiling for one tile
  const normal = [0, -1 / along, -top / along];
  for (let z = -0.5; z < DOWN_CEILING_END - 1e-6; z += SEGMENT) {
    const zb = Math.min(z + SEGMENT, DOWN_CEILING_END);
    const [va, vb] = [(z + 0.5) * along, (zb + 0.5) * along];
    parts.ceiling.quad([-WIDTH, ceilingY(z), z], [WIDTH, ceilingY(z), z], [WIDTH, ceilingY(zb), zb], [-WIDTH, ceilingY(zb), zb], normal, [[0, va], [1, va], [1, vb], [0, vb]]);
  }
  const bottom = -(STEPS + 1) * DOWN_STEP_RISE;
  for (const side of [-1, 1]) {
    sideWall(parts.walls, side * WIDTH, -side, 0, top, -0.5, 0.5, wallHeight);
    // Under the floor, in two rows, for the fade.
    sideWall(parts.walls, side * WIDTH, -side, -0.6, 0, -0.5, END, wallHeight);
    sideWall(parts.walls, side * WIDTH, -side, bottom, -0.6, -0.5, END, wallHeight);
  }
  const railY = (z) => 0.33 - 0.6 * (z + 0.41);
  handrails(parts.rails, parts.rivets, { y0: railY(-0.41), z0: -0.41, y1: railY(0.65), z1: 0.65 });
  return parts;
}

/**
 * The geometries of the stairs, by part name, for level-meshes.js. Their parts: `steps`, `walls`,
 * `ceiling`, `rails`, `rivets`.
 * @returns {Record<string, THREE.BufferGeometry>} stairsUpSteps, stairsUpWalls… stairsDownRivets
 */
export function stairsGeometries(wallHeight) {
  const named = (prefix, parts) => Object.entries(parts).map(([part, b]) => [`${prefix}${part[0].toUpperCase()}${part.slice(1)}`, b.geometry()]);
  return Object.fromEntries([...named('stairsUp', upGeometries(wallHeight)), ...named('stairsDown', downGeometries(wallHeight))]);
}

/** The names of the parts of a staircase going up or down. */
export const stairsParts = (goingUp) => ['Steps', 'Walls', 'Ceiling', 'Rails', 'Rivets'].map((part) => `stairs${goingUp ? 'Up' : 'Down'}${part}`);
