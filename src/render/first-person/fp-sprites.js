// Creatures of the first-person view as their original sprites (docs/066, docs/067): vertical planes
// parallel to the screen, standing on the floor by the middle of their bottom edge, shadow in the picture.
// Each is an InstancedMesh of one instance: the picking of fp-renderer.js works on it as on the rest.
// Pictures of assets/creatures/ (tools/extract-creature-frames.py), loaded species by species when needed.

import * as THREE from 'three';
import { subcellOffset } from '../../core/contents.js';
import { allTiles } from '../three/level-contents.js';
import { creatureInfo } from '../../core/creature-info.js';
import { viewFrame, viewFrames, viewSpot } from '../creature-views.js';

const BASE = 'assets/creatures/';
// One scale for all species: the width of the front wall of the next tile in DM (from memory, adjusted by eye).
const PIXELS_PER_TILE = 160;
const ALPHA_CUT = 0.5;
// A flat picture stands for a creature with some depth: its feet are at the front of it. So the plane
// comes nearer to the party, as it cannot go under the floor. This value puts the feet where DM has them
// on the screen, all rows alike (graphics.dat item 558, docs/069).
const DEPTH_TOWARDS_PARTY = 0.22;
const FLYING_SET = 2; // coordinate set of DM: Giant Wasp, Wizard Eye
const FLYING_HEIGHT = 30 / PIXELS_PER_TILE; // difference of its Y with the middle set at D1

/**
 * @param {object} options
 * @param {() => void} options.onLoaded pictures just arrived: the creatures must be built again
 * @param {() => void} options.onChanged a picture changed by itself (end of an attack): draw again
 * @param {number} options.tickMs duration of a tick of the game
 */
export function createCreatureSprites({ onLoaded, onChanged, tickMs }) {
  const species = new Map(); // type -> { entry, frames: { index: texture } | null while loading }
  const loader = new THREE.TextureLoader();
  const quarter = Math.PI / 2;
  let manifest = null; // type -> entry of frames.json
  let shown = []; // { mesh, entry, frames, groupId, index, facing, flipped… }
  const attacks = new Map(); // group id -> { index (member), flip, timer }: attack showing now
  let turns = 0;

  fetch(`${BASE}frames.json`)
    .then((response) => response.json())
    .then((json) => {
      manifest = new Map(Object.values(json).filter((entry) => entry.type !== null).map((entry) => [entry.type, entry]));
      onLoaded();
    })
    .catch((error) => console.warn('Creature sprites: no frames.json', error));

  async function loadFrame(entry, index) {
    const texture = await loader.loadAsync(`${BASE}${entry.folder}/${entry.frames[index].file}`);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return { index, texture };
  }

  // The frames of a species, or null while they load (asked once).
  function framesOf(type) {
    const known = species.get(type);
    if (known) return known.frames;
    const entry = manifest?.get(type);
    if (!entry) return null;
    const record = { entry, frames: null };
    species.set(type, record);
    Promise.all(viewFrames(entry.hasViews, entry.attack).map((index) => loadFrame(entry, index)))
      .then((list) => {
        record.frames = Object.fromEntries(list.map(({ index, texture }) => [index, texture]));
        onLoaded();
      })
      .catch((error) => console.warn(`Creature sprites: ${entry.folder}`, error));
    return null;
  }

  // The plane in front of the view, at its place in the tile. On the way of a turn it follows the camera.
  function place(sprite) {
    const { mesh, species, facing, index, count, position, x, y } = sprite;
    const angle = turns * quarter;
    const [forwardX, forwardZ] = [Math.sin(angle), -Math.cos(angle)];
    const [rightX, rightZ] = [Math.cos(angle), Math.sin(angle)];
    const spot = viewSpot(species, facing, turns, index, count);
    const [u, v] = spot || position === null ? [0.5, 0.5] : subcellOffset(position);
    const lateral = spot?.lateral ?? 0;
    const depth = (spot?.depth ?? 0) + DEPTH_TOWARDS_PARTY;
    mesh.position.set(x + u + rightX * lateral - forwardX * depth, species.coordinateSet === FLYING_SET ? FLYING_HEIGHT : 0, y + v + rightZ * lateral - forwardZ * depth);
    mesh.rotation.y = -angle;
  }

  // The picture of a sprite: its view, or its attack, maybe mirrored (the U of its own plane).
  function showFrame(sprite) {
    const { mesh, entry, frames, facing, groupId, index } = sprite;
    const attack = attacks.get(groupId);
    const attacking = attack?.index === index;
    const frame = viewFrame(facing, turns, entry.hasViews, attacking ? entry.attack : null);
    mesh.material.map = frames[frame];
    const flipped = attacking && frame === entry.attack && attack.flip;
    if (flipped === sprite.flipped) return;
    sprite.flipped = flipped;
    const uv = mesh.geometry.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    uv.needsUpdate = true;
  }

  // Who shows the attack: the simulation has one attack per group; a member of the row nearest to the party.
  function attacker(members) {
    const angle = turns * quarter;
    const away = ({ mesh }) => mesh.position.x * Math.sin(angle) - mesh.position.z * Math.cos(angle);
    const nearest = Math.min(...members.map(away));
    const row = members.filter((sprite) => away(sprite) < nearest + 0.05);
    return row[Math.floor(Math.random() * row.length)].index;
  }

  function buildMember(entry, frames, creature, member, index, info, levelIndex) {
    const [width, height] = entry.size;
    // Origin at the middle of the bottom edge.
    const geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const material = new THREE.MeshLambertMaterial({
      alphaTest: ALPHA_CUT,
      // Members of a row are in the same plane: without this they would flicker where they overlap.
      polygonOffset: true,
      polygonOffsetUnits: -index,
    });
    material.defines = { OCC_AT_POSITION: '' }; // its normal says nothing of its tile
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    mesh.setMatrixAt(0, new THREE.Matrix4());
    mesh.scale.set(width / PIXELS_PER_TILE, height / PIXELS_PER_TILE, 1);
    mesh.name = `level-${levelIndex}-creatureSprite`;
    mesh.userData = { part: 'creatureSprite', layer: 'creatures', variant: 'all', tiles: [info], baseOpacity: 1, creatures: true };
    const species = { size: creatureInfo(creature.type).size, coordinateSet: entry.coordinateSet };
    const sprite = { mesh, entry, species, frames, groupId: creature.index, facing: creature.facing, flipped: false, index, count: creature.members.length, position: member.position, x: info.x, y: info.y };
    place(sprite);
    showFrame(sprite);
    return sprite;
  }

  return {
    /** Meshes of the creatures of a level (those whose pictures are there), as buildLevelCreatures(). */
    build(dungeon, levelIndex, contentsAt) {
      shown = [];
      const map = dungeon.level(levelIndex);
      for (const { x, y, detail } of allTiles(dungeon, levelIndex)) {
        const creature = contentsAt(levelIndex, x, y)?.creature;
        if (!creature) continue;
        const frames = framesOf(creature.type);
        if (!frames) continue;
        const entry = manifest.get(creature.type);
        const info = { level: levelIndex, x, y, gx: x + map.offset.x, gy: y + map.offset.y, type: detail.type, detail };
        creature.members.forEach((member, index) => shown.push(buildMember(entry, frames, creature, member, index, info, levelIndex)));
      }
      return shown.map((sprite) => sprite.mesh);
    },
    /** The camera turned ({ turns } of its pose): the planes stay parallel to the screen, the views follow. */
    face(nextTurns) {
      if (nextTurns === turns) return;
      turns = nextTurns;
      for (const sprite of shown) {
        place(sprite);
        showFrame(sprite);
      }
    },
    /**
     * A group attacks: one of its members shows its attack picture for the time DM gives its species
     * (Next attack aspect update ticks), mirrored at random if its species does (Flip Attack).
     * @returns {boolean} did a picture change?
     */
    attack(group) {
      const members = shown.filter((sprite) => sprite.groupId === group.id);
      const entry = members[0]?.entry;
      if (!entry || entry.attack === null) return false;
      clearTimeout(attacks.get(group.id)?.timer);
      const timer = setTimeout(() => {
        attacks.delete(group.id);
        shown.filter((sprite) => sprite.groupId === group.id).forEach(showFrame);
        onChanged();
      }, entry.attackTicks * tickMs);
      attacks.set(group.id, { index: attacker(members), flip: entry.flipAttack && Math.random() < 0.5, timer });
      members.forEach(showFrame);
      return true;
    },
    /** Is the picture opaque where this raycast hit it? A transparent pixel lets the pointer through. */
    opaqueAt(hit) {
      const image = hit.object.material.map?.image;
      if (!image || !hit.uv) return true;
      const x = Math.min(Math.floor(hit.uv.x * image.width), image.width - 1);
      const y = Math.min(Math.floor((1 - hit.uv.y) * image.height), image.height - 1);
      return alphaOf(image, x, y) >= ALPHA_CUT * 255;
    },
    dispose() {
      shown = [];
      for (const { timer } of attacks.values()) clearTimeout(timer);
      attacks.clear();
      for (const { frames } of species.values()) {
        for (const texture of Object.values(frames ?? {})) texture.dispose();
      }
      species.clear();
    },
  };
}

// Alpha of a pixel of a picture; its pixels are read once, at the first pointing.
const alphaCache = new WeakMap();
function alphaOf(image, x, y) {
  let data = alphaCache.get(image);
  if (!data) {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    data = context.getImageData(0, 0, image.width, image.height).data;
    alphaCache.set(image, data);
  }
  return data[(y * image.width + x) * 4 + 3];
}
