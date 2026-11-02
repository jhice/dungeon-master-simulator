// Wall ornaments as real 3D objects (docs/053): each one is composed of primitives (a plate,
// an axle, a rod, a ring…), where ornament-art.js only paints a drawing on the face.
// A model stands in the frame of its ornament: origin on the wall, at the centre of the
// rectangle of WALL_ART; x to the right seen from the room, y up, z out of the wall; in tiles.
// What is rounded (a head, a basin) is whole: its back half is hidden in the wall.
// Geometries and materials are shared by all the copies of a model and kept for the life of
// the view (dispose()): the level does not dispose them.

import * as THREE from 'three';
import { IRON, IRON_DARK, IRON_LIGHT, WOOD, WOOD_DARK, BRASS, STONE, STONE_DARK, LOCK_COLORS, LOCK_HOLES, SWITCH_COLORS } from './ornament-art.js';

const HOLE_COLOR = '#0d0b09'; // the dark behind a keyhole or a slot
const BRONZE = '#5a4416';
const CARVED_STONE = '#6a5f52';
const BONE = '#9a9278';
const TOOTH = '#e8e0c8';
const WATER = '#4f8fd0';
const OOZE = '#5a8c28';
const LORD_DARK = '#2a2a32';
const PAINT_GAP = 0.002; // what is painted flat on the wall, against z-fighting
const LEVER_TILT = THREE.MathUtils.degToRad(35); // from the wall: up, or down
const TORCH_TILT = THREE.MathUtils.degToRad(12); // top away from the wall
// A pressure pad: the top of its frame over the floor, the top of its plate up or pressed (tiles).
const PAD = { frame: 0.012, up: 0.034, pressed: 0.006, thickness: 0.05 };

export function createModels() {
  const geometries = new Set();
  const materials = new Map(); // key -> material
  const textures = new Set();
  const templates = new Map(); // ornament name -> Group

  const kept = (geometry) => {
    geometries.add(geometry);
    return geometry;
  };
  // A lit material of the models: the occlusion reads its tile at the place of the fragment (fp-occlusion.js).
  const lambert = (options) => {
    const material = new THREE.MeshLambertMaterial(options);
    material.defines = { OCC_AT_POSITION: '' };
    return material;
  };
  const lit = (color) => {
    const key = `lit:${color}`;
    if (!materials.has(key)) materials.set(key, lambert({ color, map: grain() }));
    return materials.get(key);
  };
  // A fine grain over every lit part, so that they do not look like plastic next to the stone.
  let grainTexture = null;
  function grain() {
    if (grainTexture) return grainTexture;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    let seed = 11;
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        seed = (seed * 16807) % 2147483647;
        const v = 228 + (seed % 28);
        g.fillStyle = `rgb(${v} ${v} ${v})`;
        g.fillRect(x, y, 1, 1);
      }
    }
    grainTexture = new THREE.CanvasTexture(canvas);
    grainTexture.colorSpace = THREE.SRGBColorSpace;
    grainTexture.wrapS = grainTexture.wrapT = THREE.RepeatWrapping;
    grainTexture.repeat.set(6, 6);
    textures.add(grainTexture);
    return grainTexture;
  }
  // Unlit, for what gives its own light (a flame). Additive: it adds up over what is behind.
  const glow = (color, opacity) => {
    const key = `glow:${color}:${opacity}`;
    if (!materials.has(key)) {
      materials.set(key, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    }
    return materials.get(key);
  };

  // Translucent and lit (water).
  const liquid = (color, opacity) => {
    const key = `liquid:${color}:${opacity}`;
    if (!materials.has(key)) materials.set(key, lambert({ color, transparent: true, opacity, depthWrite: false }));
    return materials.get(key);
  };
  // Lit, with a light of its own (a gem).
  const gem = (color) => {
    const key = `gem:${color}`;
    if (!materials.has(key)) materials.set(key, lambert({ color, emissive: color, emissiveIntensity: 0.45 }));
    return materials.get(key);
  };

  const part = (geometry, material, [x, y, z] = [0, 0, 0], [rx, ry, rz] = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(kept(geometry), material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    return mesh;
  };
  const sphere = (r) => new THREE.SphereGeometry(r, 12, 8);
  // A cylinder standing along y, or lying along z (out of the wall) or x.
  const rod = (r, length, top = r) => new THREE.CylinderGeometry(top, r, length, 12);
  const alongZ = (geometry) => geometry.rotateX(Math.PI / 2);
  const alongX = (geometry) => geometry.rotateZ(Math.PI / 2);
  // A sphere stretched to these radii.
  const ball = (rx, ry = rx, rz = rx, segments = 16) => new THREE.SphereGeometry(1, segments, Math.ceil(segments * 0.75)).scale(rx, ry, rz);

  // A rectangle with rounded corners and bevelled edges, from z = 0 to z = thickness, with holes.
  function plate(w, h, thickness, { radius = Math.min(w, h) * 0.12, holes = [], bevel = 0.002 } = {}) {
    const shape = new THREE.Shape();
    const x = w / 2 - bevel;
    const y = h / 2 - bevel;
    const r = Math.max(radius - bevel, 0.001);
    shape.moveTo(-x + r, -y);
    shape.lineTo(x - r, -y);
    shape.absarc(x - r, -y + r, r, -Math.PI / 2, 0);
    shape.lineTo(x, y - r);
    shape.absarc(x - r, y - r, r, 0, Math.PI / 2);
    shape.lineTo(-x + r, y);
    shape.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI);
    shape.lineTo(-x, -y + r);
    shape.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5);
    shape.holes = holes;
    return new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(thickness - bevel, 0.001),
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 1,
      curveSegments: 6,
    });
  }

  // --- The objects -----------------------------------------------------------------------

  // A lever in a slotted plate: the rod turns on an axle held by two brass ears.
  function lever(w, h, up) {
    const group = new THREE.Group();
    const plateW = w * 0.5;
    const plateH = h * 0.78;
    const slotW = w * 0.15;
    const slotH = h * 0.5;
    const thickness = 0.012;
    const slot = roundedHole(slotW, slotH);
    group.add(part(plate(plateW, plateH, thickness, { holes: [slot] }), lit(IRON_DARK)));
    group.add(part(new THREE.PlaneGeometry(slotW, slotH), lit(HOLE_COLOR), [0, 0, 0.001]));
    for (const side of [-1, 1]) {
      group.add(part(new THREE.BoxGeometry(w * 0.05, w * 0.14, 0.032), lit(BRASS), [side * (slotW / 2 + w * 0.025), 0, 0.022]));
      for (const end of [-1, 1]) group.add(part(sphere(0.005), lit(IRON_LIGHT), [side * plateW * 0.36, end * plateH * 0.42, thickness]));
    }
    group.add(part(alongX(rod(0.008, slotW + w * 0.1)), lit(BRASS), [0, 0, 0.026]));
    const arm = new THREE.Group();
    arm.position.set(0, 0, 0.026);
    arm.rotation.x = up ? LEVER_TILT : Math.PI - LEVER_TILT;
    const length = h * 0.42;
    arm.add(part(rod(0.0085, length, 0.006), lit(IRON_LIGHT), [0, length / 2, 0]));
    arm.add(part(sphere(0.017), lit(IRON_DARK), [0, length, 0]));
    group.add(arm);
    return group;
  }

  // A ring held out of the wall by an arm, a cup under it; the torch (stick, head, flame) in it.
  function torchHolder(w, h, full) {
    const group = new THREE.Group();
    const ringY = -h * 0.04;
    const ringZ = 0.07;
    const cupY = ringY - 0.06;
    group.add(part(plate(w * 0.3, h * 0.46, 0.01), lit(IRON_DARK), [0, ringY - 0.03, 0]));
    group.add(part(alongZ(rod(0.0055, ringZ)), lit(IRON_LIGHT), [0, ringY, ringZ / 2]));
    group.add(part(alongZ(rod(0.0055, ringZ)), lit(IRON_LIGHT), [0, cupY, ringZ / 2]));
    group.add(part(new THREE.TorusGeometry(0.024, 0.0055, 8, 20).rotateX(Math.PI / 2), lit(IRON_LIGHT), [0, ringY, ringZ]));
    group.add(part(new THREE.CylinderGeometry(0.021, 0.015, 0.012, 14), lit(IRON), [0, cupY, ringZ]));
    for (const end of [-1, 1]) group.add(part(sphere(0.005), lit(IRON_LIGHT), [0, ringY - 0.03 + end * h * 0.19, 0.01]));
    if (!full) return group;

    // Everything of the torch hangs from the point where it rests, and leans with it.
    const torch = new THREE.Group();
    torch.position.set(0, cupY + 0.004, ringZ);
    torch.rotation.x = TORCH_TILT;
    const length = 0.165;
    torch.add(part(rod(0.009, length, 0.0135), lit(WOOD), [0, length / 2, 0]));
    torch.add(part(rod(0.0165, 0.04, 0.019), lit(WOOD_DARK), [0, length, 0]));
    const flameY = length + 0.012;
    torch.add(part(flame(0.03, 0.095), glow('#ff6a14', 0.5), [0, flameY, 0]));
    torch.add(part(flame(0.02, 0.066), glow('#ffb030', 0.75), [0, flameY, 0]));
    torch.add(part(flame(0.01, 0.036), glow('#fff6c8', 1), [0, flameY, 0]));
    const halo = new THREE.Sprite(haloMaterial());
    halo.position.set(0, flameY + 0.035, 0);
    halo.scale.setScalar(0.2);
    torch.add(halo);
    group.add(torch);
    return group;
  }

  // A flame: a smooth drop, turned around y, from its base (y = 0) to its tip.
  function flame(radius, height) {
    const points = Array.from({ length: 17 }, (_, i) => {
      const t = i / 16;
      return new THREE.Vector2(Math.sin(Math.PI * t ** 0.6) ** 1.2 * radius, t * height);
    });
    return new THREE.LatheGeometry(points, 16);
  }

  // The soft light around a flame: a disc always facing the party, fading to nothing.
  function haloMaterial() {
    if (materials.has('halo')) return materials.get('halo');
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 64;
    const g = canvas.getContext('2d');
    const fade = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    fade.addColorStop(0, 'rgb(255 170 70 / 0.55)');
    fade.addColorStop(0.4, 'rgb(255 110 30 / 0.16)');
    fade.addColorStop(1, 'rgb(255 80 10 / 0)');
    g.fillStyle = fade;
    g.fillRect(0, 0, 64, 64);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    textures.add(map);
    materials.set('halo', new THREE.SpriteMaterial({ map, blending: THREE.AdditiveBlending, depthWrite: false }));
    return materials.get('halo');
  }

  // A gilded frame with a moulding, bosses at the corners, and a pane of glass set back in it.
  function mirror(w, h) {
    const group = new THREE.Group();
    const outerW = w * 0.8;
    const outerH = h * 0.96;
    const band = 0.038;
    const innerW = outerW - band * 2;
    const innerH = outerH - band * 2;
    const glassZ = 0.008;
    group.add(part(plate(outerW, outerH, 0.03, { radius: 0.012, holes: [roundedHole(innerW, innerH, 0.006)], bevel: 0.006 }), lit(BRASS)));
    group.add(part(new THREE.PlaneGeometry(innerW + 0.01, innerH + 0.01), lit(BRONZE), [0, 0, 0.001]));
    const liner = plate(innerW + 0.004, innerH + 0.004, 0.016, { radius: 0.004, holes: [roundedHole(innerW - 0.014, innerH - 0.014, 0.002)], bevel: 0.001 });
    group.add(part(liner, lit(BRONZE)));
    group.add(part(new THREE.PlaneGeometry(innerW - 0.012, innerH - 0.012), lambert({ map: glassTexture() }), [0, 0, glassZ]));
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) group.add(part(sphere(0.012), lit(BRONZE), [(sx * (outerW - band)) / 2, (sy * (outerH - band)) / 2, 0.031]));
    }
    return group;
  }

  // The reflection: as the glass of the drawing (ornament-art.js).
  function glassTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const g = canvas.getContext('2d');
    const glass = g.createLinearGradient(0, 0, 128, 128);
    glass.addColorStop(0, '#9fb6c8');
    glass.addColorStop(0.5, '#4a5f72');
    glass.addColorStop(1, '#1e2a36');
    g.fillStyle = glass;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = 'rgb(255 255 255 / 0.5)';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(18, 30);
    g.lineTo(52, 14);
    g.moveTo(20, 46);
    g.lineTo(76, 22);
    g.stroke();
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.add(texture);
    return texture;
  }

  // A coloured plate pierced by its keyhole, a ring around it, a rivet at each corner.
  function lock(w, h, color, hole) {
    const group = new THREE.Group();
    const plateW = w * 0.62;
    const plateH = h * 0.82;
    const thickness = 0.008;
    const { outline, islands } = keyhole(w, h, hole);
    group.add(part(plate(plateW, plateH, thickness, { holes: [outline], radius: 0.008 }), lit(color)));
    group.add(part(new THREE.PlaneGeometry(plateW * 0.8, plateH * 0.8), lit(HOLE_COLOR), [0, 0, 0.001]));
    for (const { x, y, r } of islands) group.add(part(alongZ(rod(r, thickness)), lit(color), [x, y, thickness / 2]));
    group.add(part(new THREE.TorusGeometry(Math.min(plateW, plateH) * 0.42, 0.0028, 6, 28), lit(IRON_DARK), [0, 0, thickness]));
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) group.add(part(sphere(0.0065), lit(IRON_LIGHT), [sx * plateW * 0.41, sy * plateH * 0.41, thickness]));
    }
    return group;
  }

  // A button in the hole of its plate: out of it, or pressed in.
  function pushButton(w, h, color, pressed) {
    const group = new THREE.Group();
    const size = Math.min(w, h) * 0.8;
    const button = size * 0.56;
    const thickness = 0.01;
    const hole = roundedHole(button + 0.006, button + 0.006, Math.max(button * 0.12, 0.002));
    group.add(part(plate(size, size, thickness, { radius: size * 0.08, holes: [hole] }), lit(IRON_DARK)));
    group.add(part(new THREE.PlaneGeometry(button + 0.01, button + 0.01), lit(HOLE_COLOR), [0, 0, PAINT_GAP]));
    const height = pressed ? 0.003 : Math.min(size * 0.3, 0.04);
    const bevel = Math.min(button * 0.08, 0.004);
    group.add(part(plate(button, button, height, { radius: button * 0.14, bevel: pressed ? 0.001 : bevel }), lit(color), [0, 0, 0.004]));
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) group.add(part(sphere(size * 0.028), lit(IRON_LIGHT), [sx * size * 0.4, sy * size * 0.4, thickness]));
    }
    return group;
  }

  // An eye bulging from a stone plate, under its lids.
  function eyeSwitch(w, h) {
    const group = new THREE.Group();
    const rx = w * 0.27;
    const ry = h * 0.2;
    const z = 0.01;
    group.add(part(plate(w * 0.72, h * 0.66, z, { radius: 0.012 }), lit(STONE_DARK)));
    group.add(part(ball(rx, ry, 0.026, 20), lit(TOOTH), [0, 0, z]));
    group.add(part(ball(ry * 0.72, ry * 0.72, 0.012), lit(SWITCH_COLORS.Blue), [0, 0, z + 0.019]));
    group.add(part(ball(ry * 0.36, ry * 0.36, 0.006), lit('#111111'), [0, 0, z + 0.028]));
    for (const side of [-1, 1]) {
      const lid = new THREE.TorusGeometry(1, 0.11, 8, 28, Math.PI).scale(rx * 1.04, side * ry * 1.05, 0.03);
      if (side < 0) flipFaces(lid);
      group.add(part(lid, lit(CARVED_STONE), [0, 0, z + 0.004]));
    }
    return group;
  }

  // A stone in a crack of the wall: sticking out, or pushed in its dark hole.
  function crackSwitch(w, h, pressed) {
    const group = new THREE.Group();
    const X = (f) => (f - 0.5) * w;
    const Y = (f) => (0.5 - f) * h;
    // A line that gets thinner at its ends, as a flat shape painted on the wall.
    const crack = (points, width) => {
      const line = points.map(([x, y], i) => [X(x), Y(y), width * Math.sin((Math.PI * (i + 0.5)) / points.length)]);
      const shape = new THREE.Shape([...line.map(([x, y, d]) => new THREE.Vector2(x - d, y)), ...line.reverse().map(([x, y, d]) => new THREE.Vector2(x + d, y))]);
      return new THREE.ShapeGeometry(shape);
    };
    group.add(part(crack([[0.3, 0.05], [0.42, 0.3], [0.36, 0.48], [0.55, 0.66], [0.5, 0.95]], w * 0.03), lit(HOLE_COLOR), [0, 0, PAINT_GAP]));
    group.add(part(crack([[0.42, 0.3], [0.5, 0.31], [0.6, 0.36]], w * 0.016), lit(HOLE_COLOR), [0, 0, PAINT_GAP]));
    const size = w * 0.27;
    group.add(part(new THREE.PlaneGeometry(size * 1.08, size * 1.08), lit(HOLE_COLOR), [0, 0, PAINT_GAP]));
    group.add(part(plate(size, size, pressed ? 0.003 : 0.03, { radius: size * 0.2, bevel: pressed ? 0.001 : 0.005 }), lit(pressed ? STONE_DARK : STONE), [0, 0, 0.002]));
    return group;
  }

  // A lion's head in its mane spits water into a basin on a foot, standing on the floor.
  function fountain(w, h, centreY) {
    const group = new THREE.Group();
    const R = w * 0.16;
    const head = h * 0.2;
    group.add(part(plate(w * 0.56, h * 0.58, 0.012, { radius: 0.03 }), lit(STONE_DARK), [0, head - h * 0.03, 0]));
    group.add(part(new THREE.TorusGeometry(R * 1.02, R * 0.3, 10, 26), lit(CARVED_STONE), [0, head, 0.016]));
    group.add(part(ball(R * 0.92, R, R * 0.78, 18), lit(STONE), [0, head, 0.02]));
    group.add(part(ball(R * 0.52, R * 0.36, R * 0.42), lit(STONE), [0, head - R * 0.34, R * 0.78]));
    for (const side of [-1, 1]) {
      group.add(part(sphere(R * 0.22), lit(STONE), [side * R * 0.74, head + R * 0.82, 0.03]));
      group.add(part(ball(R * 0.15, R * 0.12, R * 0.07), lit('#111111'), [side * R * 0.38, head + R * 0.24, R * 0.82]));
      group.add(part(new THREE.BoxGeometry(R * 0.5, R * 0.1, R * 0.14), lit(STONE_DARK), [side * R * 0.38, head + R * 0.42, R * 0.8], [0, 0, side * -0.3]));
    }
    group.add(part(ball(R * 0.14, R * 0.1, R * 0.08), lit('#111111'), [0, head - R * 0.14, R * 1.17]));
    const mouth = head - R * 0.6;
    const spout = R * 1.12;
    group.add(part(ball(R * 0.3, R * 0.11, R * 0.14), lit('#111111'), [0, mouth, R * 1.0]));

    const flat = 0.72; // the basin and its foot, flattened against the wall
    const rim = -h * 0.22;
    const radius = w * 0.38;
    const profile = [[0.02, rim - 0.08], [radius * 0.55, rim - 0.068], [radius * 0.86, rim - 0.036], [radius, rim], [radius, rim + 0.006], [radius - 0.012, rim + 0.006], [radius - 0.012, rim - 0.012]];
    group.add(part(new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x, y)), 28).scale(1, 1, flat), lit(STONE)));
    const floor = -centreY;
    const footTop = rim - 0.075;
    group.add(part(new THREE.CylinderGeometry(0.032, 0.05, footTop - floor, 16).scale(1, 1, flat), lit(STONE_DARK), [0, (footTop + floor) / 2, 0]));
    group.add(part(new THREE.CylinderGeometry(0.075, 0.09, 0.03, 18).scale(1, 1, flat), lit(STONE), [0, floor + 0.015, 0]));

    const surface = rim - 0.006;
    group.add(part(new THREE.CircleGeometry(radius - 0.012, 28).rotateX(-Math.PI / 2).scale(1, 1, flat), liquid(WATER, 0.8), [0, surface, 0]));
    group.add(part(rod(0.006, mouth - surface, 0.005), liquid('#a8d0f0', 0.75), [0, (mouth + surface) / 2, spout]));
    group.add(part(new THREE.TorusGeometry(0.016, 0.0025, 6, 18).rotateX(Math.PI / 2), liquid('#d8ecff', 0.7), [0, surface + 0.001, spout]));
    return group;
  }

  // Around the niche of the alcove (fp-decor.js): two columns, a lintel carved VI, a block under the sill.
  function viAltar(w, h, centreY) {
    const group = new THREE.Group();
    const bottom = -0.154; // the niche, from the centre of the rectangle
    const top = 0.14;
    const x = 0.28;
    const floor = -centreY;
    for (const side of [-1, 1]) {
      group.add(part(rod(0.024, top - bottom), lit(STONE), [side * x, (top + bottom) / 2, 0.012]));
      group.add(part(new THREE.BoxGeometry(0.066, 0.016, 0.06), lit(STONE_DARK), [side * x, bottom + 0.008, 0.024]));
      group.add(part(new THREE.BoxGeometry(0.066, 0.016, 0.06), lit(STONE_DARK), [side * x, top - 0.008, 0.024]));
    }
    group.add(part(plate(w, 0.058, 0.05, { radius: 0.006, bevel: 0.004 }), lit(STONE), [0, top + 0.027, 0]));
    const glyph = (width, height, at, tilt = 0) => part(new THREE.BoxGeometry(width, height, 0.004), lit(BRASS), [...at, 0.05], [0, 0, tilt]);
    const glyphH = 0.032;
    group.add(glyph(0.006, glyphH, [-0.024, top + 0.027], 0.32));
    group.add(glyph(0.006, glyphH, [-0.0135, top + 0.027], -0.32));
    group.add(glyph(0.006, glyphH, [0.018, top + 0.027]));
    const blockTop = bottom - 0.012; // under the sill of the niche
    group.add(part(new THREE.BoxGeometry(0.56, blockTop - floor, 0.05), lit(CARVED_STONE), [0, (blockTop + floor) / 2, 0.025]));
    group.add(part(new THREE.BoxGeometry(0.62, 0.03, 0.08), lit(STONE_DARK), [0, floor + 0.015, 0.04]));
    group.add(part(plate(0.42, (blockTop - floor) * 0.55, 0.006, { radius: 0.01 }), lit(STONE_DARK), [0, (blockTop + floor) / 2 + 0.008, 0.05]));
    return group;
  }

  // The horned statue with a gem in its chest: `state` as in ornament-art.js.
  function amalgam(w, h, centreY, state) {
    const group = new THREE.Group();
    const floor = -centreY;
    const flat = 0.6;
    group.add(part(new THREE.BoxGeometry(0.36, 0.05, 0.2), lit(STONE_DARK), [0, floor + 0.025, 0]));
    group.add(part(new THREE.BoxGeometry(0.3, 0.04, 0.16), lit(STONE), [0, floor + 0.07, 0]));
    const waist = floor + 0.09;
    const shoulders = h * 0.22;
    group.add(part(new THREE.CylinderGeometry(0.11, 0.145, shoulders - waist, 16).scale(1, 1, flat), lit(CARVED_STONE), [0, (shoulders + waist) / 2, 0]));
    group.add(part(ball(0.13, 0.044, 0.08), lit(CARVED_STONE), [0, shoulders, 0]));
    for (const side of [-1, 1]) {
      group.add(part(rod(0.028, 0.26, 0.022), lit(STONE_DARK), [side * 0.138, shoulders - 0.13, 0.024]));
      group.add(part(sphere(0.03), lit(STONE_DARK), [side * 0.138, shoulders - 0.26, 0.024]));
      group.add(part(new THREE.ConeGeometry(0.013, 0.065, 8), lit(BONE), [side * 0.058, shoulders + 0.115, 0.012], [0, 0, side * -0.55]));
      group.add(part(ball(0.011, 0.008, 0.005), lit('#1a1410'), [side * 0.024, shoulders + 0.078, 0.052]));
    }
    group.add(part(rod(0.03, 0.04), lit(STONE_DARK), [0, shoulders + 0.04, 0.008]));
    group.add(part(ball(0.058, 0.07, 0.052), lit(CARVED_STONE), [0, shoulders + 0.08, 0.006]));

    const chest = h * 0.05;
    const front = 0.072; // the surface of the chest, at that height
    group.add(part(ball(0.04, 0.04, 0.008), lit('#1a1714'), [0, chest, front]));
    group.add(part(new THREE.TorusGeometry(0.042, 0.006, 8, 24), lit(STONE_DARK), [0, chest, front + 0.001]));
    if (state === 'without') return group;
    const encased = state === 'encased';
    group.add(part(new THREE.OctahedronGeometry(0.032).scale(1, 1.25, 0.65), gem(encased ? '#3a8ac8' : '#7ad0ff'), [0, chest, front + 0.018]));
    if (encased) {
      group.add(part(new THREE.TorusGeometry(0.048, 0.006, 8, 24), lit(BRASS), [0, chest, front + 0.008]));
      for (const tilt of [0.75, -0.75]) group.add(part(new THREE.BoxGeometry(0.094, 0.005, 0.005), lit(BRASS), [0, chest, front + 0.031], [0, 0, tilt]));
    }
    return group;
  }

  // A head of pale stone coming out of the wall, its jaw open on its teeth.
  function ghoulHead(w, h) {
    const group = new THREE.Group();
    const [rx, ry, rz] = [w * 0.27, h * 0.44, 0.085];
    const top = h * 0.06;
    // On the surface of the skull, at this place of its face.
    const onSkull = (x, y) => [x, top + y, rz * Math.sqrt(Math.max(1 - (x / rx) ** 2 - (y / ry) ** 2, 0))];
    group.add(part(ball(rx, ry, rz, 20), lit(BONE), [0, top, 0]));
    group.add(part(ball(rx * 0.74, ry * 0.46, rz * 0.84, 16), lit(CARVED_STONE), [0, top - ry * 0.74, 0.006]));
    const mouth = -ry * 0.62;
    group.add(part(ball(rx * 0.56, ry * 0.15, 0.012), lit('#1a1410'), onSkull(0, mouth)));
    for (let i = -2; i <= 2; i++) {
      const [x, y, z] = onSkull(i * rx * 0.24, mouth + ry * 0.1);
      group.add(part(new THREE.ConeGeometry(0.0085, 0.022, 6).rotateX(Math.PI), lit(TOOTH), [x, y, z + 0.009]));
      const [xl, yl, zl] = onSkull(i * rx * 0.2, mouth - ry * 0.11);
      group.add(part(new THREE.ConeGeometry(0.007, 0.016, 6), lit(TOOTH), [xl, yl, zl + 0.008]));
    }
    for (const side of [-1, 1]) {
      const eye = onSkull(side * rx * 0.42, ry * 0.14);
      group.add(part(ball(rx * 0.25, ry * 0.2, 0.014), lit('#1a1410'), eye));
      const brow = onSkull(side * rx * 0.42, ry * 0.36);
      group.add(part(new THREE.CapsuleGeometry(0.009, rx * 0.5, 4, 8).rotateZ(Math.PI / 2 + side * 0.32), lit(CARVED_STONE), [brow[0], brow[1], brow[2] + 0.002]));
      const cheek = onSkull(side * rx * 0.68, -ry * 0.2);
      group.add(part(ball(rx * 0.2, ry * 0.15, 0.016), lit(BONE), cheek));
    }
    const nose = onSkull(0, -ry * 0.16);
    group.add(part(new THREE.ConeGeometry(0.018, 0.04, 3), lit('#1a1410'), nose));
    return group;
  }

  // Rivets at the four corners of a plate.
  function rivets(group, x, y, z, r = 0.005) {
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) group.add(part(sphere(r), lit(IRON_LIGHT), [sx * x, sy * y, z]));
    }
  }

  // A brass plate with a slot, and a raised lip around the slot.
  function coinSlot(w, h) {
    const group = new THREE.Group();
    const [plateW, plateH] = [w * 0.54, h * 0.66];
    const [slotW, slotH] = [w * 0.08, h * 0.38];
    const thickness = 0.01;
    group.add(part(plate(plateW, plateH, thickness, { holes: [roundedHole(slotW, slotH, 0.003)], radius: 0.01 }), lit(BRASS)));
    group.add(part(new THREE.PlaneGeometry(slotW + 0.006, slotH + 0.006), lit(HOLE_COLOR), [0, 0, PAINT_GAP]));
    const lip = plate(slotW + 0.018, slotH + 0.018, 0.005, { holes: [roundedHole(slotW, slotH, 0.003)], radius: 0.006, bevel: 0.001 });
    group.add(part(lip, lit(BRONZE), [0, 0, thickness]));
    rivets(group, plateW * 0.38, plateH * 0.41, thickness);
    return group;
  }

  // A stone plate pierced by a diamond, set in brass.
  function gemHole(w, h) {
    const group = new THREE.Group();
    const [plateW, plateH] = [w * 0.6, h * 0.72];
    const [rx, ry] = [w * 0.13, h * 0.2];
    const thickness = 0.012;
    const hole = new THREE.Path([[0, -ry], [rx, 0], [0, ry], [-rx, 0]].map(([x, y]) => new THREE.Vector2(x, y)));
    group.add(part(plate(plateW, plateH, thickness, { holes: [hole], radius: 0.012 }), lit(STONE_DARK)));
    group.add(part(new THREE.PlaneGeometry(rx * 2, ry * 2), lit(HOLE_COLOR), [0, 0, PAINT_GAP]));
    group.add(part(new THREE.TorusGeometry(1, 0.05, 6, 4).scale(rx, ry, 1), lit(BRASS), [0, 0, thickness]));
    rivets(group, plateW * 0.4, plateH * 0.42, thickness);
    return group;
  }

  // A hook on its plate: an arm out of the wall, a shank going down, a curve going up to its tip.
  function hook(w, h) {
    const group = new THREE.Group();
    const top = h * 0.22;
    const [armZ, bottom, r, tube] = [0.03, -h * 0.1, 0.024, 0.0055];
    group.add(part(plate(w * 0.2, h * 0.2, 0.008, { radius: 0.006 }), lit(IRON_DARK), [0, top, 0]));
    group.add(part(alongZ(rod(tube, armZ)), lit(IRON_LIGHT), [0, top, armZ / 2]));
    group.add(part(sphere(tube), lit(IRON_LIGHT), [0, top, armZ]));
    group.add(part(rod(tube, top - bottom), lit(IRON_LIGHT), [0, (top + bottom) / 2, armZ]));
    const sweep = Math.PI * 1.15;
    const curve = new THREE.TorusGeometry(r, tube, 8, 18, sweep).rotateZ(Math.PI).rotateY(-Math.PI / 2);
    group.add(part(curve, lit(IRON_LIGHT), [0, bottom, armZ + r]));
    group.add(part(sphere(tube * 1.15), lit(IRON_LIGHT), [0, bottom + r * Math.sin(Math.PI + sweep), armZ + r + r * Math.cos(Math.PI + sweep)]));
    return group;
  }

  // A ring hanging from a staple, on its plate.
  function wallRing(w, h, color, tube) {
    const group = new THREE.Group();
    const top = h * 0.28;
    const R = w * 0.2;
    group.add(part(plate(w * 0.22, h * 0.18, 0.008, { radius: 0.006 }), lit(IRON_DARK), [0, top, 0]));
    group.add(part(new THREE.TorusGeometry(0.013, 0.004, 6, 14).rotateY(Math.PI / 2), lit(IRON_LIGHT), [0, top - 0.004, 0.012]));
    group.add(part(new THREE.TorusGeometry(R, tube, 10, 30), lit(color), [0, top - 0.012 - R, 0.012 + tube / 2], [-0.14, 0, 0]));
    return group;
  }

  // Two chains from the wall, a cuff at the end of each.
  function manacles(w, h) {
    const group = new THREE.Group();
    const top = h * 0.36;
    const link = new THREE.TorusGeometry(0.009, 0.0028, 6, 12).scale(1, 1.5, 1);
    const LINKS = 5;
    const step = 0.021;
    for (const side of [-1, 1]) {
      const x = side * w * 0.22;
      group.add(part(plate(w * 0.12, h * 0.11, 0.008, { radius: 0.005 }), lit(IRON_DARK), [x, top, 0]));
      for (let i = 0; i < LINKS; i++) {
        group.add(part(link, lit(IRON), [x, top - 0.012 - i * step, 0.012 + (i % 2) * 0.002], [0, i % 2 ? Math.PI / 2 : 0, 0]));
      }
      const cuffY = top - 0.012 - LINKS * step - 0.028;
      group.add(part(new THREE.TorusGeometry(0.03, 0.0065, 8, 22), lit(IRON_LIGHT), [x, cuffY, 0.016], [-0.2, 0, 0]));
      group.add(part(sphere(0.0085), lit(IRON_DARK), [x, cuffY + 0.03, 0.018]));
    }
    return group;
  }

  // Iron bars in a frame, over a dark hole.
  function grate(w, h) {
    const group = new THREE.Group();
    const [frameW, frameH] = [w * 0.84, h * 0.78];
    const band = 0.016;
    const [innerW, innerH] = [frameW - band * 2, frameH - band * 2];
    group.add(part(plate(frameW, frameH, 0.016, { holes: [roundedHole(innerW, innerH, 0.004)], radius: 0.008, bevel: 0.003 }), lit(IRON)));
    group.add(part(new THREE.PlaneGeometry(innerW + 0.004, innerH + 0.004), lit(HOLE_COLOR), [0, 0, PAINT_GAP]));
    const BARS = 6;
    for (let i = 1; i < BARS; i++) group.add(part(rod(0.0055, innerH + 0.004), lit(IRON_LIGHT), [-innerW / 2 + (innerW * i) / BARS, 0, 0.009]));
    group.add(part(alongX(rod(0.0045, innerW + 0.004)), lit(IRON), [0, 0, 0.006]));
    rivets(group, frameW / 2 - band / 2, frameH / 2 - band / 2, 0.016, 0.004);
    return group;
  }

  // A round drain with bars, low on the wall; ooze comes over its lip and runs down.
  function slimeOutlet(w, h) {
    const group = new THREE.Group();
    const [rx, ry] = [w * 0.3, h * 0.24];
    const cy = -h * 0.08;
    const hole = new THREE.CircleGeometry(1, 28).scale(rx, ry, 1);
    group.add(part(hole, lit(HOLE_COLOR), [0, cy, PAINT_GAP]));
    group.add(part(new THREE.TorusGeometry(1, 0.1, 8, 32).scale(rx, ry, 0.12), lit(STONE_DARK), [0, cy, 0.008]));
    for (let i = -2; i <= 2; i++) {
      const x = (i * rx * 0.72) / 2;
      const half = ry * Math.sqrt(1 - (x / rx) ** 2);
      group.add(part(rod(0.0055, half * 2), lit(IRON), [x, cy, 0.008]));
    }
    const lip = cy - ry;
    group.add(part(ball(rx * 0.58, 0.014, 0.022), lit(OOZE), [0, lip, 0.014]));
    group.add(part(new THREE.CapsuleGeometry(0.009, 0.05, 4, 8), lit(OOZE), [rx * 0.12, lip - 0.03, 0.009]));
    group.add(part(ball(0.013, 0.018, 0.01), lit(OOZE), [rx * 0.12, lip - 0.066, 0.009]));
    group.add(part(new THREE.CapsuleGeometry(0.006, 0.018, 4, 8), lit(OOZE), [-rx * 0.28, lip - 0.018, 0.009]));
    return group;
  }

  // A dark round shield with a brass rim, a pale diamond and a boss.
  function lordOrder(w) {
    const group = new THREE.Group();
    const R = w * 0.38;
    group.add(part(alongZ(rod(R, 0.018)), lit(LORD_DARK), [0, 0, 0.004]));
    group.add(part(new THREE.TorusGeometry(R, 0.012, 8, 36), lit(BRASS), [0, 0, 0.014]));
    group.add(part(new THREE.OctahedronGeometry(1).scale(R * 0.42, R * 0.8, 0.012), lit(TOOTH), [0, 0, 0.014]));
    group.add(part(ball(R * 0.15, R * 0.15, 0.012), lit(BRASS), [0, 0, 0.025]));
    return group;
  }

  // The holes of a shooter: a stone plate pierced `count` times, rims tinted by what comes out.
  function holes(w, h, count, tint) {
    const group = new THREE.Group();
    const [plateW, plateH] = [w * 0.84, h * 0.6];
    const r = w * 0.06;
    const x = (i) => (count === 1 ? 0 : (-0.3 + (0.6 * i) / (count - 1)) * w);
    const paths = Array.from({ length: count }, (_, i) => new THREE.Path().absarc(x(i), 0, r, 0, Math.PI * 2, true));
    group.add(part(plate(plateW, plateH, 0.012, { holes: paths, radius: 0.012 }), lit(STONE_DARK)));
    group.add(part(new THREE.PlaneGeometry(plateW * 0.92, r * 2.2), lit(HOLE_COLOR), [0, 0, PAINT_GAP]));
    for (let i = 0; i < count; i++) group.add(part(new THREE.TorusGeometry(r, 0.005, 6, 20), lit(tint), [x(i), 0, 0.012]));
    return group;
  }

  // --- On the floor: origin on the floor at the centre of the tile, y up ------------------

  const flat = (geometry) => geometry.rotateX(-Math.PI / 2); // what stands along z, along y
  const padPlate = (height) => PAD.thickness - height; // how far under the floor the plate's bottom goes

  // The frame of a pad over a dark bed, and its plate, which goes up and down (named `plate`).
  // Under the floor, the plate is hidden by it. userData: the heights of the plate.
  function pressurePad(size, round) {
    const group = new THREE.Group();
    const inner = size - 0.05;
    const top = inner - 0.012;
    const bed = round ? new THREE.CircleGeometry(inner / 2 + 0.002, 32) : new THREE.PlaneGeometry(inner + 0.004, inner + 0.004);
    group.add(part(flat(bed), lit(HOLE_COLOR), [0, 0.001, 0]));
    const moving = new THREE.Group();
    moving.name = 'plate';
    if (round) {
      const [R, r] = [size / 2, inner / 2];
      const ring = [[R, 0], [R - 0.005, PAD.frame], [r, PAD.frame], [r, 0]];
      group.add(part(new THREE.LatheGeometry(ring.map(([x, y]) => new THREE.Vector2(x, y)), 36), lit(STONE_DARK)));
      const [T, H] = [top / 2, PAD.thickness];
      const body = [[T, 0], [T, H - 0.006], [T - 0.006, H], [T * 0.62, H], [T * 0.62 - 0.002, H - 0.003], [T * 0.6 - 0.004, H - 0.003], [T * 0.58 - 0.004, H], [0.0001, H]];
      moving.add(part(new THREE.LatheGeometry(body.map(([x, y]) => new THREE.Vector2(x, y)), 36), lit(STONE)));
    } else {
      group.add(part(flat(plate(size, size, PAD.frame, { holes: [roundedHole(inner, inner, 0.008)], radius: 0.014, bevel: 0.003 })), lit(STONE_DARK)));
      moving.add(part(flat(plate(top, top, PAD.thickness, { radius: 0.01, bevel: 0.005 })), lit(STONE)));
      const line = size * 0.012;
      const groove = top * 0.62;
      for (const side of [-1, 1]) {
        moving.add(part(new THREE.BoxGeometry(groove, 0.001, line), lit(STONE_DARK), [0, PAD.thickness + 0.0005, (side * groove) / 2]));
        moving.add(part(new THREE.BoxGeometry(line, 0.001, groove), lit(STONE_DARK), [(side * groove) / 2, PAD.thickness + 0.0005, 0]));
      }
    }
    moving.position.y = -padPlate(PAD.up);
    group.add(moving);
    group.userData.heights = { up: -padPlate(PAD.up), pressed: -padPlate(PAD.pressed) };
    return group;
  }

  // Iron bars over a dark hole, in a frame.
  function floorGrate(size, round) {
    const group = new THREE.Group();
    const R = size / 2;
    const r = R - 0.03;
    const height = 0.012;
    const hole = round ? new THREE.CircleGeometry(r + 0.002, 32) : new THREE.PlaneGeometry(r * 2 + 0.004, r * 2 + 0.004);
    group.add(part(flat(hole), lit(HOLE_COLOR), [0, 0.001, 0]));
    if (round) {
      const ring = [[R, 0], [R - 0.005, height], [r, height], [r, 0]];
      group.add(part(new THREE.LatheGeometry(ring.map(([x, y]) => new THREE.Vector2(x, y)), 36), lit(IRON)));
    } else {
      group.add(part(flat(plate(size, size, height, { holes: [roundedHole(r * 2, r * 2, 0.006)], radius: 0.01, bevel: 0.003 })), lit(IRON)));
    }
    const BARS = 7;
    for (let i = 1; i < BARS; i++) {
      const x = -r + (2 * r * i) / BARS;
      const length = round ? 2 * Math.sqrt(r ** 2 - x ** 2) : r * 2;
      group.add(part(alongZ(rod(0.007, length + 0.004)), lit(IRON_LIGHT), [x, height * 0.5, 0]));
    }
    return group;
  }

  // The outline of a keyhole (a hole of the plate), and the discs of plate left in it.
  // Sizes as fractions of the ornament, as the drawings of ornament-art.js.
  function keyhole(w, h, kind) {
    const X = (f) => (f - 0.5) * w;
    const Y = (f) => (0.5 - f) * h;
    const polygon = (points) => new THREE.Path(points.map(([x, y]) => new THREE.Vector2(X(x), Y(y))));
    // A disc on top of a stem: from the stem's bottom left, up, around the disc, down.
    const discOnStem = (cy, r, half, bottom, extra = []) => {
      const path = new THREE.Path();
      const centreY = Y(cy);
      const a = Math.asin(half / r);
      path.moveTo(-half, Y(bottom));
      path.lineTo(-half, centreY - Math.cos(a) * r);
      path.absarc(0, centreY, r, -Math.PI / 2 - a, -Math.PI * 2.5 + a, true);
      for (const [x, y] of extra) path.lineTo(x, y);
      path.lineTo(half, Y(bottom));
      path.closePath();
      return path;
    };
    if (kind === 'cross') {
      const a = 0.46, b = 0.54, c = 0.36, d = 0.64, e = 0.3, f = 0.42, g = 0.5, i = 0.7;
      return { outline: polygon([[a, e], [b, e], [b, f], [d, f], [d, g], [b, g], [b, i], [a, i], [a, g], [c, g], [c, f], [a, f]]), islands: [] };
    }
    if (kind === 'square') return { outline: polygon([[0.41, 0.41], [0.59, 0.41], [0.59, 0.59], [0.41, 0.59]]), islands: [] };
    if (kind === 'wing') return { outline: polygon([[0.3, 0.42], [0.5, 0.52], [0.7, 0.42], [0.5, 0.66]]), islands: [] };
    if (kind === 'skull') {
      const eye = { y: Y(0.45), r: w * 0.022 };
      return { outline: discOnStem(0.46, w * 0.12, w * 0.05, 0.67), islands: [{ x: -w * 0.05, ...eye }, { x: w * 0.05, ...eye }] };
    }
    if (kind === 'ankh') {
      const half = w * 0.032;
      const barTop = Y(0.5);
      const barBottom = Y(0.55);
      const barX = w * 0.11;
      const extra = [[half, barTop], [barX, barTop], [barX, barBottom], [half, barBottom]];
      const path = discOnStem(0.38, w * 0.08, half, 0.72, extra);
      // The left end of the bar: on the way up, before the disc.
      const outline = new THREE.Path();
      outline.moveTo(-half, Y(0.72));
      outline.lineTo(-half, barBottom);
      outline.lineTo(-barX, barBottom);
      outline.lineTo(-barX, barTop);
      outline.lineTo(-half, barTop);
      outline.curves.push(...path.curves.slice(1));
      return { outline, islands: [{ x: 0, y: Y(0.38), r: w * 0.038 }] };
    }
    return { outline: discOnStem(0.44, w * 0.07, w * 0.03, 0.66), islands: [] };
  }

  const BUILDERS = {
    'Lever Up': (w, h) => lever(w, h, true),
    'Lever Down': (w, h) => lever(w, h, false),
    'Empty Torch Holder': (w, h) => torchHolder(w, h, false),
    'Full Torch Holder': (w, h) => torchHolder(w, h, true),
    'Champion Mirror': (w, h) => mirror(w, h),
    'Eye Switch': (w, h) => eyeSwitch(w, h),
    'Crack Switch In': (w, h) => crackSwitch(w, h, true),
    'Crack Switch Out': (w, h) => crackSwitch(w, h, false),
    'Big Switch In': (w, h) => pushButton(w, h, SWITCH_COLORS.Big, true),
    'Big Switch Out': (w, h) => pushButton(w, h, SWITCH_COLORS.Big, false),
    'Small Switch': (w, h) => pushButton(w, h, SWITCH_COLORS.Small, false),
    'Tiny Switch': (w, h) => pushButton(w, h, SWITCH_COLORS.Tiny, false),
    Fountain: fountain,
    'Vi Altar': viAltar,
    'Amalgam (Without Gem)': (w, h, centreY) => amalgam(w, h, centreY, 'without'),
    'Amalgam (Free Gem)': (w, h, centreY) => amalgam(w, h, centreY, 'free'),
    'Amalgam (Encased Gem)': (w, h, centreY) => amalgam(w, h, centreY, 'encased'),
    "Ghoul's Head": (w, h) => ghoulHead(w, h),
    'Coin Slot': (w, h) => coinSlot(w, h),
    'Gem Hole': (w, h) => gemHole(w, h),
    Hook: (w, h) => hook(w, h),
    'Wood Ring': (w, h) => wallRing(w, h, WOOD, 0.011),
    'Iron Ring': (w, h) => wallRing(w, h, IRON_LIGHT, 0.0065),
    Manacles: (w, h) => manacles(w, h),
    Grate: (w, h) => grate(w, h),
    'Slime Outlet': (w, h) => slimeOutlet(w, h),
    'Lord Order (Outside)': (w) => lordOrder(w),
    'Fireball Holes': (w, h) => holes(w, h, 3, '#c85a20'),
    'Poison Holes': (w, h) => holes(w, h, 3, '#5aa040'),
    'Dagger Holes': (w, h) => holes(w, h, 4, IRON_LIGHT),
  };
  const FLOOR_BUILDERS = {
    'Square Pressure Pad': (size) => pressurePad(size, false),
    'Tiny Pressure Pad': (size) => pressurePad(size, false),
    'Round Pressure Plate': (size) => pressurePad(size, true),
    'Square Grate': (size) => floorGrate(size, false),
    'Round Grate': (size) => floorGrate(size, true),
  };
  for (const color of ['Green', 'Red', 'Blue']) {
    BUILDERS[`${color} Switch In`] = (w, h) => pushButton(w, h, SWITCH_COLORS[color], true);
    BUILDERS[`${color} Switch Out`] = (w, h) => pushButton(w, h, SWITCH_COLORS[color], false);
  }
  for (const [name, color] of Object.entries(LOCK_COLORS)) BUILDERS[`${name} Lock`] = (w, h) => lock(w, h, color, LOCK_HOLES[name]);

  return {
    /** A copy of the model of an ornament (size of its rectangle, height of its centre, in tiles), or null if it has none. */
    build(name, w, h, centreY) {
      if (!BUILDERS[name]) return null;
      if (!templates.has(name)) templates.set(name, BUILDERS[name](w, h, centreY));
      const copy = templates.get(name).clone();
      copy.userData.model = true; // shared geometries and materials: the level does not dispose them
      return copy;
    },
    /**
     * A copy of the model of a floor ornament (its size in tiles), or null if it has none. A pressure
     * pad has `userData.heights` { up, pressed }, the places of its child named `plate`.
     */
    buildFloor(name, size) {
      if (!FLOOR_BUILDERS[name]) return null;
      const key = `floor:${name}`;
      if (!templates.has(key)) templates.set(key, FLOOR_BUILDERS[name](size));
      const copy = templates.get(key).clone();
      copy.userData.model = true;
      return copy;
    },
    /** The shaders changed (occlusion): also for the materials of the models not in the scene. */
    updateMaterials() {
      for (const material of materials.values()) material.needsUpdate = true;
      for (const template of templates.values()) {
        template.traverse((object) => {
          if (object.isMesh) object.material.needsUpdate = true;
        });
      }
    },
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const template of templates.values()) {
        template.traverse((object) => object.isMesh && object.material.dispose());
      }
      for (const material of materials.values()) material.dispose();
      for (const texture of textures) texture.dispose();
      grainTexture = null;
      geometries.clear();
      materials.clear();
      textures.clear();
      templates.clear();
    },
  };
}

// After a negative scale, the faces of a geometry turn their back: turns them again.
function flipFaces(geometry) {
  const index = geometry.index.array;
  for (let i = 0; i < index.length; i += 3) [index[i + 1], index[i + 2]] = [index[i + 2], index[i + 1]];
  return geometry;
}

function roundedHole(w, h, radius = Math.min(w, h) * 0.45) {
  const path = new THREE.Path();
  const x = w / 2;
  const y = h / 2;
  path.moveTo(-x + radius, -y);
  path.lineTo(x - radius, -y);
  path.absarc(x - radius, -y + radius, radius, -Math.PI / 2, 0);
  path.lineTo(x, y - radius);
  path.absarc(x - radius, y - radius, radius, 0, Math.PI / 2);
  path.lineTo(-x + radius, y);
  path.absarc(-x + radius, y - radius, radius, Math.PI / 2, Math.PI);
  path.lineTo(-x, -y + radius);
  path.absarc(-x + radius, -y + radius, radius, Math.PI, Math.PI * 1.5);
  return path;
}
