// Items of the first-person view as their original pictures (docs/072): vertical planes standing on the
// floor by the middle of their bottom edge, as DM draws them (ReDMCSB DUNVIEW.C, F115). On the floor they
// stay parallel to the screen; in an alcove, parallel to its wall (DM draws only the alcove in front).
// One InstancedMesh per picture, an instance per item: the picking of fp-renderer.js reads
// tiles[instanceId].item, as with the boxes of level-contents.js.
// Pictures of assets/items/floor/ (tools/extract-item-graphics.py), all loaded at the first build.

import * as THREE from 'three';
import { subcellOffset } from '../../core/contents.js';
import { floorPicture, itemType, FLOOR_PICTURE_COUNT } from '../../core/item-graphics.js';
import { allTiles } from '../three/level-contents.js';
import { NICHE } from '../three/level-meshes.js';

const BASE = 'assets/items/floor/';
// The scale of the creatures (fp-sprites.js): DM draws both at their size at D1.
const PIXELS_PER_TILE = 160;
const ALPHA_CUT = 0.5;
// Items of one sub-tile, from the bottom of the pile: each a little nearer to the party, so that the last
// one put down is drawn over the others (the offsets of DM come in phase I2).
const PILE_STEP = 0.012;
// In an alcove: from the centre of the wall tile. Just inside the mouth of a hollow alcove (the light of its
// item is read in the tile in front, fp-occlusion.js), or just in front of a painted one.
const ALCOVE_OUT = { hollow: 0.47, painted: 0.52 };
const ALCOVE_ROW = [0, -0.12, 0.12]; // places along the width of an alcove, then the same row again, nearer
// Yaw that turns the plane (facing +z) out of a wall face N, E, S, W.
const FACE_YAW = [Math.PI, Math.PI / 2, 0, -Math.PI / 2];
const FACE_DIRECTION = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * @param {object} options
 * @param {() => void} options.onLoaded the pictures just arrived: the items must be built again
 */
export function createItemSprites({ onLoaded }) {
  const loader = new THREE.TextureLoader();
  let textures = null; // picture number -> texture, once all are loaded
  let loading = false;
  let shown = []; // { mesh, floor: [{ index, x, z, rank, scale }] }: floor instances follow the camera
  let turns = 0;
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();

  function load() {
    if (loading) return;
    loading = true;
    const numbers = Array.from({ length: FLOOR_PICTURE_COUNT }, (_, n) => n);
    Promise.all(
      numbers.map(async (n) => {
        const texture = await loader.loadAsync(`${BASE}${String(n).padStart(2, '0')}.png`);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        texture.generateMipmaps = false;
        return [n, texture];
      }),
    )
      .then((list) => {
        textures = new Map(list);
        onLoaded();
      })
      .catch((error) => console.warn('Item sprites: pictures missing', error));
  }

  // A floor item: the plane faces the camera, a little nearer to it for each item below it in its pile.
  function floorMatrix({ x, z, rank, scale }) {
    const angle = turns * (Math.PI / 2);
    const back = rank * PILE_STEP; // towards the party: opposite to where it looks
    v3.set(x - Math.sin(angle) * back, 0, z + Math.cos(angle) * back);
    q.setFromAxisAngle(up, -angle);
    return m4.compose(v3, q, s3.set(scale[0], scale[1], 1));
  }

  function place() {
    for (const { mesh, floor } of shown) {
      if (!floor.length) continue;
      for (const instance of floor) mesh.setMatrixAt(instance.index, floorMatrix(instance));
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  return {
    /** Are the pictures there? If not, they are asked for, and onLoaded() will tell. */
    ready() {
      if (!textures) load();
      return Boolean(textures);
    },
    /**
     * Meshes of the items of a level, as buildLevelContents() gives its boxes (userData.tiles[i].item).
     * @param {(level, x, y) => object|null} contentsAt what the party sees of a tile
     * @param {boolean} hollowAlcoves the alcoves are recesses (fp-models.js), else painted
     * @param {number} wallHeight
     */
    build(dungeon, levelIndex, contentsAt, hollowAlcoves, wallHeight) {
      shown = [];
      if (!textures) return [];
      const map = dungeon.level(levelIndex);
      const byPicture = new Map(); // picture -> [{ info, matrix | floor instance }]
      const add = (picture, entry) => {
        if (!byPicture.has(picture)) byPicture.set(picture, []);
        byPicture.get(picture).push(entry);
      };
      for (const { x, y, gx, gy, detail } of allTiles(dungeon, levelIndex)) {
        const contents = contentsAt(levelIndex, x, y);
        if (!contents?.items.length) continue;
        const info = { level: levelIndex, x, y, gx, gy, type: detail.type, detail };
        const onWall = detail.type === 'wall';
        const piles = new Map(); // position -> count so far
        for (const item of contents.items) {
          const rank = piles.get(item.position) ?? 0;
          piles.set(item.position, rank + 1);
          const picture = floorPicture(item.kind, itemType(dungeon, item), onWall);
          const texture = textures.get(picture);
          if (!texture) continue;
          const scale = [texture.image.width / PIXELS_PER_TILE, texture.image.height / PIXELS_PER_TILE];
          if (onWall) {
            const [dx, dz] = FACE_DIRECTION[item.position];
            const out = hollowAlcoves ? ALCOVE_OUT.hollow : ALCOVE_OUT.painted;
            const along = ALCOVE_ROW[rank % ALCOVE_ROW.length];
            const nearer = Math.floor(rank / ALCOVE_ROW.length) * PILE_STEP;
            v3.set(x + 0.5 + dx * (out + nearer) - dz * along, NICHE.bottom * wallHeight, y + 0.5 + dz * (out + nearer) + dx * along);
            q.setFromAxisAngle(up, FACE_YAW[item.position]);
            add(picture, { info: { ...info, item }, matrix: m4.compose(v3, q, s3.set(scale[0], scale[1], 1)).clone() });
          } else {
            const [u, v] = subcellOffset(item.position);
            add(picture, { info: { ...info, item }, floor: { x: x + u, z: y + v, rank, scale } });
          }
        }
      }
      const meshes = [];
      for (const [picture, list] of byPicture) {
        // Origin at the middle of the bottom edge; the size of the picture is in the matrix of each instance.
        const geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
        const material = new THREE.MeshLambertMaterial({ map: textures.get(picture), alphaTest: ALPHA_CUT });
        const mesh = new THREE.InstancedMesh(geometry, material, list.length);
        const floor = [];
        list.forEach((entry, index) => {
          if (entry.floor) floor.push({ ...entry.floor, index });
          else mesh.setMatrixAt(index, entry.matrix);
        });
        mesh.name = `level-${levelIndex}-itemSprite-${picture}`;
        mesh.userData = { part: 'itemSprite', layer: 'items', variant: 'all', tiles: list.map((entry) => entry.info), baseOpacity: 1 };
        shown.push({ mesh, floor });
        meshes.push(mesh);
      }
      place();
      for (const mesh of meshes) mesh.computeBoundingSphere();
      return meshes;
    },
    /** The camera turned ({ turns } of its pose, maybe on the way): the floor items stay parallel to the screen. */
    face(nextTurns) {
      if (nextTurns === turns) return;
      turns = nextTurns;
      place();
      // The planes turn about their own foot: their bounding spheres barely change.
    },
    dispose() {
      shown = [];
      for (const texture of textures?.values() ?? []) texture.dispose();
      textures = null;
      loading = false;
    },
  };
}
