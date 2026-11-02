// Builds the meshes of one level: one InstancedMesh per tile part (wall, floor,
// door leaf…), so the whole dungeon takes about a hundred draw calls.
// Units: 1 tile = 1 unit; x = east, z = south, y = up. Level floor at y = 0
// inside its group; groups are stacked by the renderer.
//
// Tiles with a state (doors, pits, fake walls) can look different with states
// shown or hidden. Each mesh therefore has a `variant`:
//   'all'    always visible
//   'types'  only when states are hidden (types-only rendering, as in 005)
//   'states' only when states are shown
// The renderer toggles mesh visibility; nothing is rebuilt.
//
// `game: true` builds what the party sees instead (first-person view): only
// the with-states look, and hidden things stay hidden (closed or imaginary
// fake walls look like walls, invisible pits and teleporters are not drawn, a closed
// pit is a plain floor, as in DM (ReDMCSB, F172); a visible teleporter fills its whole
// tile, wall high, translucent). Outside the map is solid rock, as in DM: a ring of
// walls surrounds the level (info `outside: true`).

import * as THREE from 'three';
import { tileState, doorStep, DOOR_CLOSED } from '../../core/tile-states.js';

// Wall height is a setting (fraction of a tile, 1 = cube); doors span it,
// teleporters are 90 % of it, stairs span it.
export const DEFAULT_WALL_HEIGHT = 0.7;
const FLOOR_THICKNESS = 0.05;
const STEPS = 4;
const PIT_SIZE = 0.76; // side of the hole of a pit
export const PIT_DEPTH = 0.6; // of its shaft, in the first-person view
// Alcove: width, bottom and top (shares of the wall height), depth into the wall (tiles).
export const NICHE = { width: 0.5, bottom: 0.33, top: 0.75, depth: 0.2 };
const NICHE_ARCH = { rise: 0.15, segments: 12 }; // height of the arch of an arched alcove
const dimensions = (wallHeight) => ({ wall: wallHeight, door: wallHeight, teleporter: wallHeight * 0.9 });
// Part of the leaf still visible when an open door is raised into the lintel.
const RAISED_DOOR_VISIBLE = 0.15;
const HIDDEN_OPACITY = 0.4; // invisible pits, imaginary walls: faded but visible
const TELEPORTER_GAME_OPACITY = 0.3;

// Rotation (around y) that turns the "+z" stairs model so it rises away from its access side.
const STAIRS_ROTATION = { N: 0, S: Math.PI, W: Math.PI / 2, E: -Math.PI / 2 };

/**
 * A tile with a square hole in it, flat at y = 0, facing up (or down), with the UVs of a floor
 * face or a ceiling panel: its texture continues the one of the tile next to it.
 */
export function pitRimGeometry(facingUp = true) {
  const shape = new THREE.Shape([[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]].map(([x, y]) => new THREE.Vector2(x, y)));
  const half = PIT_SIZE / 2;
  shape.holes.push(new THREE.Path([[-half, -half], [-half, half], [half, half], [half, -half]].map(([x, y]) => new THREE.Vector2(x, y))));
  const geometry = new THREE.ShapeGeometry(shape);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5, uv.getY(i) + 0.5);
  return geometry.rotateX(facingUp ? -Math.PI / 2 : Math.PI / 2);
}

/**
 * The inside of a pit: four walls and a bottom seen from within, open at y = 0, going down
 * by `depth`. Texture: v = 1 at the top of the walls, the bottom takes the colour of v = 0.
 */
export function pitShaftGeometry(depth) {
  const box = new THREE.BoxGeometry(PIT_SIZE, depth, PIT_SIZE).scale(-1, 1, 1).translate(0, -depth / 2, 0); // inside out
  const normal = box.attributes.normal;
  for (let i = 0; i < normal.count; i++) normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i)); // towards the inside
  const uv = box.attributes.uv;
  const bottom = box.groups[3]; // +x, -x, +y, -y, +z, -z
  const index = box.index.array;
  for (let i = bottom.start; i < bottom.start + bottom.count; i++) uv.setY(index[i], 0);
  const top = box.groups[2];
  box.setIndex([...index.slice(0, top.start), ...index.slice(top.start + top.count)]);
  box.clearGroups();
  return box;
}

// The opening of an alcove on the face of a wall (x across, y from the middle of the wall), counterclockwise.
function nicheOutline(wallHeight, arched) {
  const x = NICHE.width / 2;
  const bottom = (NICHE.bottom - 0.5) * wallHeight;
  const top = (NICHE.top - 0.5) * wallHeight;
  if (!arched) return [[-x, bottom], [x, bottom], [x, top], [-x, top]].map(([u, v]) => new THREE.Vector2(u, v));
  const points = [new THREE.Vector2(-x, bottom), new THREE.Vector2(x, bottom)];
  for (let i = 0; i <= NICHE_ARCH.segments; i++) {
    const a = (Math.PI * i) / NICHE_ARCH.segments;
    points.push(new THREE.Vector2(x * Math.cos(a), top - NICHE_ARCH.rise + NICHE_ARCH.rise * Math.sin(a)));
  }
  return points;
}

// The face of a wall tile with the opening of an alcove (facing +z, at the edge of the tile), with the UVs of a box face.
function nicheFaceGeometry(wallHeight, arched) {
  const [x, y] = [0.5, wallHeight / 2];
  const shape = new THREE.Shape([[-x, -y], [x, -y], [x, y], [-x, y]].map(([u, v]) => new THREE.Vector2(u, v)));
  shape.holes.push(new THREE.Path(nicheOutline(wallHeight, arched)));
  const geometry = new THREE.ShapeGeometry(shape);
  const uv = geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + 0.5, uv.getY(i) / wallHeight + 0.5);
  return geometry.translate(0, 0, 0.5);
}

// The inside of an alcove, seen from the room: its sides and its back. Texture: the sides take
// the upper half (v = 1 at the opening, v = 0.5 at the back), the back takes the lower half.
function nicheInsideGeometry(wallHeight, arched) {
  const outline = nicheOutline(wallHeight, arched);
  const [mouth, back] = [0.5, 0.5 - NICHE.depth];
  const positions = [];
  const normals = [];
  const uvs = [];
  const vertex = (x, y, z, n, u, v) => {
    positions.push(x, y, z);
    normals.push(...n);
    uvs.push(u, v);
  };
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const n = [-(b.y - a.y) / length, (b.x - a.x) / length, 0]; // on the left of a counterclockwise outline: inside
    const [ua, ub] = [i / outline.length, (i + 1) / outline.length];
    vertex(a.x, a.y, mouth, n, ua, 1);
    vertex(b.x, b.y, back, n, ub, 0.5);
    vertex(a.x, a.y, back, n, ua, 0.5);
    vertex(a.x, a.y, mouth, n, ua, 1);
    vertex(b.x, b.y, mouth, n, ub, 1);
    vertex(b.x, b.y, back, n, ub, 0.5);
  });
  for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(outline, [])) {
    for (const { x, y } of [outline[i], outline[j], outline[k]]) {
      vertex(x, y, back, [0, 0, 1], x / NICHE.width + 0.5, ((y / wallHeight + 0.5 - NICHE.bottom) / (NICHE.top - NICHE.bottom)) * 0.5);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  return geometry;
}

/**
 * Part definitions: geometry, colour key in the theme, and a function that
 * pushes instance matrices for a tile.
 */
function partDefinitions(theme, h) {
  return {
    wall: { geometry: new THREE.BoxGeometry(1, h.wall, 1), color: theme.wall },
    fakewall: { geometry: new THREE.BoxGeometry(1, h.wall, 1), color: theme.fakewall },
    floor: { geometry: new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1), color: theme.floor },
    fakewallImaginary: { geometry: new THREE.BoxGeometry(1, h.wall, 1), color: theme.fakewall, opacity: HIDDEN_OPACITY },
    pit: { geometry: new THREE.BoxGeometry(0.76, 0.02, 0.76), color: theme.pit },
    pitHidden: { geometry: new THREE.BoxGeometry(0.76, 0.02, 0.76), color: theme.pit, opacity: HIDDEN_OPACITY },
    pitLid: { geometry: new THREE.BoxGeometry(0.76, 0.02, 0.76), color: theme.pitLid },
    pitLidHidden: { geometry: new THREE.BoxGeometry(0.76, 0.02, 0.76), color: theme.pitLid, opacity: HIDDEN_OPACITY },
    stepUp: { geometry: new THREE.BoxGeometry(1, 1, 1 / STEPS), color: theme.stairsUp },
    stepDown: { geometry: new THREE.BoxGeometry(1, 1, 1 / STEPS), color: theme.stairsDown },
    door: { geometry: new THREE.BoxGeometry(1, h.door, 0.12), color: theme.door },
    teleporter: {
      geometry: new THREE.BoxGeometry(0.7, h.teleporter, 0.7),
      color: theme.teleporter,
      emissive: true,
      opacity: 0.45,
    },
    // First-person view: a full cube, the whole tile from floor to ceiling (a hair smaller,
    // so that its faces do not fight with the walls, floor and ceiling), translucent, and
    // seen from inside too (both sides): a party standing on a teleporter that does not
    // carry it (items only, creatures only) is in a coloured volume.
    // A hollow pit (first-person view): no floor, the rim around the hole and the shaft under it.
    pitRim: { geometry: pitRimGeometry(), color: theme.floor },
    pitShaft: { geometry: pitShaftGeometry(PIT_DEPTH), color: '#ffffff' },
    // A wall tile with an alcove (first-person view): its faces one by one, as no box can have a hole.
    wallFace: { geometry: new THREE.PlaneGeometry(1, h.wall).translate(0, 0, 0.5), color: theme.wall },
    nicheFaceSquare: { geometry: nicheFaceGeometry(h.wall, false), color: theme.wall },
    nicheFaceArched: { geometry: nicheFaceGeometry(h.wall, true), color: theme.wall },
    nicheInsideSquare: { geometry: nicheInsideGeometry(h.wall, false), color: '#ffffff' },
    nicheInsideArched: { geometry: nicheInsideGeometry(h.wall, true), color: '#ffffff' },
    teleporterGame: {
      geometry: new THREE.BoxGeometry(0.996, h.wall - 0.004, 0.996),
      color: theme.teleporter,
      emissive: true,
      opacity: TELEPORTER_GAME_OPACITY,
      doubleSide: true,
      // Drawn after the other translucent things (inscriptions, ornaments on the walls): the
      // automatic sorting uses the centre of the whole instanced mesh, which can put the
      // teleporters first; a wall still hides what is behind it (depth test).
      renderOrder: 1,
    },
  };
}

/**
 * @param {object} [options]
 * @param {number} [options.wallHeight]
 * @param {(level, x, y) => object} [options.tileAt] tile source (default: the dungeon; the simulation passes its state)
 * @param {boolean} [options.game=false] first-person look, see above
 * @param {boolean} [options.hollowPits=false] with `game`: an open visible pit is a real hole
 * @param {(x, y) => Array<{ face: number, arched: boolean }>} [options.niches] with `game`: the alcoves
 *   of a wall tile (faces N, E, S, W), real recesses in the wall
 * @returns {{ group: THREE.Group, meshes: Array<THREE.InstancedMesh|THREE.LineSegments> }}
 * Each mesh has userData.part, userData.variant, userData.baseOpacity and, for
 * instanced meshes, userData.tiles[instanceId] = tile info (for hovering).
 */
export function buildLevelMeshes(dungeon, levelIndex, theme, center, { wallHeight = DEFAULT_WALL_HEIGHT, tileAt, game = false, hollowPits = false, niches } = {}) {
  const map = dungeon.level(levelIndex);
  const h = dimensions(wallHeight);
  const parts = partDefinitions(theme, h);
  const instances = new Map(); // "part:variant" -> [{ matrix, info }]
  const openWallCenters = []; // vanished fake walls, drawn as wireframe outlines
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  const add = (part, info, position, scale = [1, 1, 1], rotationY = 0, variant = 'all') => {
    q.setFromAxisAngle(up, rotationY);
    const key = `${part}:${variant}`;
    if (!instances.has(key)) instances.set(key, []);
    instances.get(key).push({ matrix: m4.clone().compose(new THREE.Vector3(...position), q, new THREE.Vector3(...scale)), info });
  };
  // Same instance with a types-only look and a with-states look.
  const addVariants = (typesPart, statesPart, info, position, scale, rotationY) => {
    if (typesPart === statesPart) return add(typesPart, info, position, scale, rotationY, 'all');
    add(typesPart, info, position, scale, rotationY, 'types');
    if (statesPart) add(statesPart, info, position, scale, rotationY, 'states');
  };

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = tileAt ? tileAt(levelIndex, x, y) : dungeon.tileAt(levelIndex, x, y);
      const gx = x + map.offset.x;
      const gy = y + map.offset.y;
      const info = { level: levelIndex, x, y, gx, gy, type: tile.type, detail: tile.detail };
      const px = gx + 0.5 - center.x;
      const pz = gy + 0.5 - center.z;

      if (tile.type === 'wall') {
        const recesses = niches?.(x, y) ?? [];
        if (recesses.length) addNicheWall(add, info, px, pz, h, recesses);
        else add('wall', info, [px, h.wall / 2, pz]);
        continue;
      }
      if (tile.type === 'fakewall') {
        if (game) addGameFakewall(add, info, px, pz, h);
        else addFakewall(add, openWallCenters, info, px, pz, h);
        continue;
      }
      if (tile.type === 'stairs') {
        addStairs(add, info, px, pz, dungeon.accessSide(levelIndex, x, y), h);
        continue;
      }
      if (tile.type === 'pit' && game && hollowPits && tile.detail.open && !tile.detail.invisible) {
        add('pitRim', info, [px, 0, pz]);
        add('pitShaft', info, [px, 0, pz]);
        continue;
      }
      add('floor', info, [px, -FLOOR_THICKNESS / 2, pz]);
      if (tile.type === 'pit' && game) {
        if (tile.detail.open && !tile.detail.invisible) add(pitPart(tile.detail), info, [px, 0.011, pz]);
      } else if (tile.type === 'pit') addVariants('pit', pitPart(tile.detail), info, [px, 0.011, pz]);
      if (tile.type === 'teleporter' && !game) add('teleporter', info, [px, h.teleporter / 2, pz]);
      if (tile.type === 'teleporter' && game && tile.detail.visible && tile.detail.open) add('teleporterGame', info, [px, h.wall / 2, pz]);
      if (tile.type === 'door') addDoor(add, info, px, pz, h, game);
    }
  }

  if (game) {
    for (let y = -1; y <= map.height; y++) {
      for (let x = -1; x <= map.width; x++) {
        if (x >= 0 && y >= 0 && x < map.width && y < map.height) continue;
        const info = { level: levelIndex, x, y, gx: x + map.offset.x, gy: y + map.offset.y, type: 'wall', outside: true };
        add('wall', info, [info.gx + 0.5 - center.x, h.wall / 2, info.gy + 0.5 - center.z]);
      }
    }
  }

  const group = new THREE.Group();
  group.name = `level-${levelIndex}`;
  const meshes = [];
  for (const [key, list] of instances) {
    const [part, variant] = key.split(':');
    const def = parts[part];
    const material = new THREE.MeshLambertMaterial({
      color: def.color,
      ...(def.emissive && { emissive: def.color, emissiveIntensity: 0.6 }),
      // The first-person view does not restyle its meshes: its translucent parts are set here.
      ...(game && def.opacity !== undefined && { transparent: true, opacity: def.opacity, depthWrite: false }),
      ...(game && def.doubleSide && { side: THREE.DoubleSide }),
    });
    // Each part may appear in several variants: they need their own geometry to be disposed independently.
    const mesh = new THREE.InstancedMesh(def.geometry.clone(), material, list.length);
    list.forEach(({ matrix }, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.name = `${group.name}-${part}-${variant}`;
    if (game && def.renderOrder) mesh.renderOrder = def.renderOrder;
    mesh.userData = { part, variant, tiles: list.map((l) => l.info), baseOpacity: def.opacity ?? 1 };
    group.add(mesh);
    meshes.push(mesh);
  }
  if (openWallCenters.length) {
    const outlines = buildOutlines(openWallCenters, theme.fakewall, h);
    outlines.name = `${group.name}-fakewallOpen-states`;
    group.add(outlines);
    meshes.push(outlines);
  }
  for (const def of Object.values(parts)) def.geometry.dispose();
  return { group, meshes };
}

// A wall tile with alcoves: one part per face, turned from +z to its side (N, E, S, W).
function addNicheWall(add, info, px, pz, h, recesses) {
  [Math.PI, Math.PI / 2, 0, -Math.PI / 2].forEach((rotation, face) => {
    const niche = recesses.find((r) => r.face === face);
    const kind = niche?.arched ? 'Arched' : 'Square';
    add(niche ? `nicheFace${kind}` : 'wallFace', info, [px, h.wall / 2, pz], [1, 1, 1], rotation);
    if (niche) add(`nicheInside${kind}`, info, [px, h.wall / 2, pz], [1, 1, 1], rotation);
  });
}

// Pit look with states: open hole or closed lid, faded when invisible.
function pitPart(detail) {
  const { open, invisible } = tileState('pit', detail);
  if (open) return invisible ? 'pitHidden' : 'pit';
  return invisible ? 'pitLidHidden' : 'pitLid';
}

// Door: the leaf lies across the passage axis (an NS passage gets an east-west leaf).
// With states, an open door is raised like a portcullis: only its lower edge stays
// in the doorway, the rest sticks out above the walls (there is no ceiling), so it
// can be told apart from a closed door at any camera angle but straight down. A door
// moving (simulation, docs/028) is raised by its step.
function addDoor(add, info, px, pz, h, game) {
  const rotation = info.detail.orientation === 'NS' ? 0 : Math.PI / 2;
  const closed = [px, h.door / 2, pz];
  const step = info.detail.broken ? 0 : doorStep(info.detail);
  if (step === DOOR_CLOSED) return add('door', info, closed, [1, 1, 1], rotation, 'all');
  if (!game) add('door', info, closed, [1, 1, 1], rotation, 'types');
  const bottom = ((h.wall - h.door * RAISED_DOOR_VISIBLE) * (DOOR_CLOSED - step)) / DOOR_CLOSED;
  add('door', info, [px, bottom + h.door / 2, pz], [1, 1, 1], rotation, 'states');
}

// Fake wall: a block (types only). With states: block if closed, faded block if
// imaginary (passable illusion), wireframe outline if open (vanished). The last
// two stand on a floor slab.
function addFakewall(add, openWallCenters, info, px, pz, h) {
  const { open, imaginary } = tileState('fakewall', info.detail);
  const block = [px, h.wall / 2, pz];
  if (!open && !imaginary) return add('fakewall', info, block, [1, 1, 1], 0, 'all');
  add('fakewall', info, block, [1, 1, 1], 0, 'types');
  add('floor', info, [px, -FLOOR_THICKNESS / 2, pz], [1, 1, 1], 0, 'states');
  if (open) openWallCenters.push([px, h.wall / 2, pz]);
  else add('fakewallImaginary', info, block, [1, 1, 1], 0, 'states');
}

// Fake wall as the party sees it: a wall while it is there (closed or imaginary), floor once it has vanished.
// An imaginary wall can be walked into: it needs a floor too (its faces are not drawn from inside).
function addGameFakewall(add, info, px, pz, h) {
  const { open, imaginary } = info.detail;
  if (open || imaginary) add('floor', info, [px, -FLOOR_THICKNESS / 2, pz]);
  if (!open) add('wall', info, [px, h.wall / 2, pz]);
}

// Edges of unit wall boxes centred on `centers`, merged into one LineSegments.
function buildOutlines(centers, color, h) {
  const edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, h.wall, 1));
  const src = edges.attributes.position.array;
  const positions = new Float32Array(src.length * centers.length);
  centers.forEach(([cx, cy, cz], k) => {
    for (let i = 0; i < src.length; i += 3) {
      positions[k * src.length + i] = src[i] + cx;
      positions[k * src.length + i + 1] = src[i + 1] + cy;
      positions[k * src.length + i + 2] = src[i + 2] + cz;
    }
  });
  edges.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }));
  lines.userData = { part: 'fakewallOpen', variant: 'states', baseOpacity: 1 };
  return lines;
}

// Stairs model: STEPS boxes along +z, starting at the access side (z = -0.5 before rotation).
// Up stairs: step tops rise from the floor, boxes stand on the floor (y = 0).
// Down stairs: step tops at floor level, boxes share a base at y = -wall height,
// so the walking surface (seen from above) goes down.
function addStairs(add, info, px, pz, accessSide, h) {
  const goingUp = info.detail.direction === 'up';
  const rotation = STAIRS_ROTATION[accessSide ?? (info.detail.orientation === 'WE' ? 'W' : 'N')];
  const sin = Math.sin(rotation);
  const cos = Math.cos(rotation);
  const stepHeight = h.wall / (STEPS + 1);
  for (let i = 0; i < STEPS; i++) {
    const top = goingUp ? (i + 1) * stepHeight : -i * stepHeight; // previously -(i + 1)
    const bottom = goingUp ? 0 : -h.wall;
    const localZ = -0.5 + (i + 0.5) / STEPS;
    // Rotate the step offset (0, localZ) around y.
    const dx = localZ * sin;
    const dz = localZ * cos;
    add(goingUp ? 'stepUp' : 'stepDown', info, [px + dx, (top + bottom) / 2, pz + dz], [1, top - bottom, 1], rotation);
  }
}

export function disposeLevelMeshes(meshes) {
  for (const mesh of meshes) {
    mesh.geometry.dispose();
    for (const material of [mesh.material].flat()) material.dispose(); // one, or one per face
    mesh.dispose?.(); // InstancedMesh only
  }
}
