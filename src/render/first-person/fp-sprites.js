// Creatures of the first-person view as their original sprites (docs/066, docs/067): vertical planes
// parallel to the screen, standing on the floor by the middle of their bottom edge, shadow in the picture.
// Each is an InstancedMesh of one instance: the picking of fp-renderer.js works on it as on the rest.
// Pictures of assets/creatures/ (tools/extract-creature-frames.py), loaded species by species when needed.

import * as THREE from 'three';
import { subcellOffset } from '../../core/contents.js';
import { allTiles } from '../three/level-contents.js';
import { viewFrame, viewFrames } from '../creature-views.js';

const BASE = 'assets/creatures/';
// One scale for all species: the width of the front wall of the next tile in DM (from memory, adjusted by eye).
const PIXELS_PER_TILE = 160;
const ALPHA_CUT = 0.5;

/**
 * @param {object} options
 * @param {() => void} options.onLoaded pictures just arrived: the creatures must be built again
 */
export function createCreatureSprites({ onLoaded }) {
  const species = new Map(); // type -> { entry, frames: { index: texture } | null while loading }
  const loader = new THREE.TextureLoader();
  const quarter = Math.PI / 2;
  let manifest = null; // type -> entry of frames.json
  let shown = []; // { mesh, facing, hasViews, frames }
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
    Promise.all(viewFrames(entry.hasViews).map((index) => loadFrame(entry, index)))
      .then((list) => {
        record.frames = Object.fromEntries(list.map(({ index, texture }) => [index, texture]));
        onLoaded();
      })
      .catch((error) => console.warn(`Creature sprites: ${entry.folder}`, error));
    return null;
  }

  function buildMember(entry, frames, creature, member, info, levelIndex) {
    const [width, height] = entry.size;
    // Origin at the middle of the bottom edge.
    const geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const material = new THREE.MeshLambertMaterial({
      map: frames[viewFrame(creature.facing, turns, entry.hasViews)],
      alphaTest: ALPHA_CUT,
      // Members of a row are in the same plane: without this they would flicker where they overlap.
      polygonOffset: true,
      polygonOffsetUnits: -(member.position ?? 0),
    });
    material.defines = { OCC_AT_POSITION: '' }; // its normal says nothing of its tile
    const mesh = new THREE.InstancedMesh(geometry, material, 1);
    mesh.setMatrixAt(0, new THREE.Matrix4());
    const [u, v] = member.position === null ? [0.5, 0.5] : subcellOffset(member.position);
    mesh.position.set(info.x + u, 0, info.y + v);
    mesh.scale.set(width / PIXELS_PER_TILE, height / PIXELS_PER_TILE, 1);
    mesh.rotation.y = -turns * quarter;
    mesh.name = `level-${levelIndex}-creatureSprite`;
    mesh.userData = { part: 'creatureSprite', layer: 'creatures', variant: 'all', tiles: [info], baseOpacity: 1, creatures: true };
    return { mesh, facing: creature.facing, hasViews: entry.hasViews, frames };
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
        for (const member of creature.members) shown.push(buildMember(entry, frames, creature, member, info, levelIndex));
      }
      return shown.map((sprite) => sprite.mesh);
    },
    /** The camera turned ({ turns } of its pose): the planes stay parallel to the screen, the views follow. */
    face(nextTurns) {
      if (nextTurns === turns) return;
      turns = nextTurns;
      for (const { mesh, facing, hasViews, frames } of shown) {
        mesh.rotation.y = -turns * quarter;
        mesh.material.map = frames[viewFrame(facing, turns, hasViews)];
      }
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
