// Items of the first-person view as their original pictures (docs/072): vertical planes standing on the
// floor by the middle of their bottom edge, as DM draws them (ReDMCSB DUNVIEW.C, F115). On the floor they
// stay parallel to the screen; in an alcove, parallel to its wall (DM draws only the alcove in front).
// One InstancedMesh per picture, an instance per item: the picking of fp-renderer.js reads
// tiles[instanceId].item, as with the boxes of level-contents.js.
// Pictures of assets/items/floor/ (tools/extract-item-graphics.py), all loaded at the first build.
// As DM (docs/074): the items of a pile are shifted by a few pixels each, the chest and the magical boxes are
// mirrored on the right of the view, the large pictures (coordinate set 2) stand a little nearer.

import * as THREE from 'three';
import { subcellOffset } from '../../core/contents.js';
import { floorPicture, itemType, coordinateSet, flipsOnRight, pileShift, FLOOR_PICTURE_COUNT, MISSILE_PICTURE_COUNT } from '../../core/item-graphics.js';
import { allTiles } from '../three/level-contents.js';
import { NICHE } from '../three/level-meshes.js';

const BASE = 'assets/items/floor/';
const MISSILES = 'assets/items/missiles/'; // projectiles (docs/075)
// The scale of the creatures (fp-sprites.js): DM draws both at their size at D1.
const PIXELS_PER_TILE = 160;
const ALPHA_CUT = 0.5;
// Order of a pile: DM draws its items in order, the last put down over the others. Each item is this much nearer
// to the party than the one below, and the offsets below stay within one step, so they never change the order.
const PILE_STEP = { floor: 0.02, alcove: 0.003 };
// Pile shifts (pileShift(), in pixels at the size of the pictures): a pixel to the right is 1/160 tile; a pixel down
// the screen brings the item nearer, by a little only, to keep the order (on the floor, -3..+6 pixels with the
// coordinate set 2: 0.018 tile; in an alcove, where the item must also stay in the mouth, next to nothing).
const PILE_DEPTH_PER_PIXEL = { floor: 0.002, alcove: 0.0002 };
const SET_2_LOWER = 3; // pixels: coordinate set 2 is 2 to 4 pixels lower than set 0 at D0 and D1
// The row of a tile away from the party is further than its sub-tiles say: DM draws it as if 0.40 tile past the
// centre on the party's tile (y 131 of 135), 0.35 on the next one; its front row is where the sub-tiles say
// (graphics.dat item 558, "Coordinates to display items", through our camera: docs/073). Without this, the items
// of the far half of the party's tile stand below the bottom of the view.
const BACK_ROW_PUSH = 0.14;
const SUB_TILE_REACH = 0.25; // distance of a sub-tile from the centre of its tile, along one axis
// In an alcove: from the centre of the wall tile. Just inside the mouth of a hollow alcove (the light of its
// item is read in the tile in front, fp-occlusion.js), or just in front of a painted one.
const ALCOVE_OUT = { hollow: 0.48, painted: 0.52 };
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
  let missiles = null; // the same, for the projectiles
  let loading = false;
  let shown = []; // { mesh, floor: [{ index, x, z, cx, cz, shift, nearer, flips, scale }] }: they follow the camera
  let pose = { x: 0, y: 0, turns: 0 }; // of the camera: its tile and quarter turns
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const v3 = new THREE.Vector3();
  const s3 = new THREE.Vector3();

  function load() {
    if (loading) return;
    loading = true;
    const all = (base, count) =>
      Promise.all(
        Array.from({ length: count }, async (_, n) => {
          const texture = await loader.loadAsync(`${base}${String(n).padStart(2, '0')}.png`);
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.magFilter = THREE.NearestFilter;
          texture.minFilter = THREE.NearestFilter;
          texture.generateMipmaps = false;
          return [n, texture];
        }),
      ).then((list) => new Map(list));
    Promise.all([all(BASE, FLOOR_PICTURE_COUNT), all(MISSILES, MISSILE_PICTURE_COUNT)])
      .then(([floor, flying]) => {
        textures = floor;
        missiles = flying;
        onLoaded();
      })
      .catch((error) => console.warn('Item sprites: pictures missing', error));
  }

  const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0); // an instance shown by the twin mesh
  // A floor item: the plane faces the camera, a little nearer to it for each item below it in its pile.
  // A picture mirrored on the right is shown by a twin mesh, whose UVs are mirrored (a negative scale would turn
  // its normal away from the light): each instance is shown by one of the two, hidden (scale 0) in the other.
  function floorMatrix({ x, z, cx, cz, shift, nearer, flips, scale }, mirrored) {
    const angle = pose.turns * (Math.PI / 2);
    const [forwardX, forwardZ] = [Math.sin(angle), -Math.cos(angle)];
    const [rightX, rightZ] = [Math.cos(angle), Math.sin(angle)];
    // How far the sub-tile is in the back row (0 front row… 1 back row), smooth on the way of a turn.
    const away = Math.min(Math.max(((x - cx) * forwardX + (z - cz) * forwardZ) / SUB_TILE_REACH, 0), 1);
    const step = away * BACK_ROW_PUSH - nearer; // away from the party
    const lateral = shift.x / PIXELS_PER_TILE;
    v3.set(x + forwardX * step + rightX * lateral, 0, z + forwardZ * step + rightZ * lateral);
    // Mirrored on the right of the view: right of the party's column, as DM's right lane and right column.
    const onRight = flips && (x - (pose.x + 0.5)) * rightX + (z - (pose.y + 0.5)) * rightZ > 0;
    if (onRight !== mirrored) return HIDDEN;
    q.setFromAxisAngle(up, -angle);
    return m4.compose(v3, q, s3.set(scale[0], scale[1], 1));
  }

  function place() {
    for (const { mesh, floor, mirrored } of shown) {
      if (!floor.length) continue;
      for (const instance of floor) mesh.setMatrixAt(instance.index, floorMatrix(instance, mirrored));
      mesh.instanceMatrix.needsUpdate = true;
      // Instances of a twin appear and vanish: its bounding sphere (picking, culling) must follow.
      if (mesh.userData.twin) mesh.computeBoundingSphere();
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
          const shift = pileShift(item.position, rank, onWall);
          if (onWall) {
            // Out of the face (dx, dz); to the right of the party looking at it: (dz, -dx).
            const [dx, dz] = FACE_DIRECTION[item.position];
            const out = (hollowAlcoves ? ALCOVE_OUT.hollow : ALCOVE_OUT.painted) + shift.y * PILE_DEPTH_PER_PIXEL.alcove + rank * PILE_STEP.alcove;
            const along = shift.x / PIXELS_PER_TILE;
            v3.set(x + 0.5 + dx * out + dz * along, NICHE.bottom * wallHeight, y + 0.5 + dz * out - dx * along);
            q.setFromAxisAngle(up, FACE_YAW[item.position]);
            add(picture, { info: { ...info, item }, matrix: m4.compose(v3, q, s3.set(scale[0], scale[1], 1)).clone() });
          } else {
            const [u, v] = subcellOffset(item.position);
            const lower = shift.y + (coordinateSet(picture) === 2 ? SET_2_LOWER : 0); // pixels down the screen
            const nearer = rank * PILE_STEP.floor + lower * PILE_DEPTH_PER_PIXEL.floor;
            const floor = { x: x + u, z: y + v, cx: x + 0.5, cz: y + 0.5, shift, nearer, flips: flipsOnRight(picture), scale };
            add(picture, { info: { ...info, item }, floor });
          }
        }
      }
      const meshes = [];
      for (const [picture, list] of byPicture) {
        const floor = list.flatMap((entry, index) => (entry.floor ? [{ ...entry.floor, index }] : []));
        const twin = flipsOnRight(picture) && floor.length > 0;
        for (const mirrored of twin ? [false, true] : [false]) {
          // Origin at the middle of the bottom edge; the size of the picture is in the matrix of each instance.
          const geometry = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
          if (mirrored) {
            const uv = geometry.attributes.uv;
            for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
          }
          const material = new THREE.MeshLambertMaterial({ map: textures.get(picture), alphaTest: ALPHA_CUT });
          const mesh = new THREE.InstancedMesh(geometry, material, list.length);
          list.forEach((entry, index) => {
            if (!entry.floor) mesh.setMatrixAt(index, mirrored ? HIDDEN : entry.matrix); // alcoves: never mirrored
          });
          mesh.name = `level-${levelIndex}-itemSprite-${picture}${mirrored ? '-mirrored' : ''}`;
          mesh.userData = { part: 'itemSprite', layer: 'items', variant: 'all', tiles: list.map((entry) => entry.info), baseOpacity: 1, twin };
          shown.push({ mesh, floor, mirrored });
          meshes.push(mesh);
        }
      }
      place();
      for (const mesh of meshes) mesh.computeBoundingSphere();
      return meshes;
    },
    /**
     * The camera moved ({ x, y, turns } of its pose, maybe on the way): the floor items stay parallel to the screen,
     * and the mirrored ones follow the side of the view they are on.
     */
    face(next) {
      if (next.x === pose.x && next.y === pose.y && next.turns === pose.turns) return;
      pose = { x: next.x, y: next.y, turns: next.turns };
      place();
      // The planes turn about their own foot: their bounding spheres barely change.
    },
    /** Texture of a floor picture or ('missile') of a projectile picture, or null while they load. */
    texture(picture, missile = false) {
      return (missile ? missiles : textures)?.get(picture) ?? null;
    },
    dispose() {
      shown = [];
      for (const texture of [...(textures?.values() ?? []), ...(missiles?.values() ?? [])]) texture.dispose();
      textures = missiles = null;
      loading = false;
    },
  };
}
