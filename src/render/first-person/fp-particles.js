// Particles of the first-person view on the screen (docs/063): one Points object over the pool of
// particles.js. Round and soft, hidden by the walls, they write no depth. Colours are premultiplied
// so that smoke (covers) and fire (adds) share one draw, without changing the blending.

import * as THREE from 'three';
import { createParticles } from '../particles.js';

const MAX_STEP = 0.05; // seconds: a frame late (tab hidden) does not make them jump

const VERTEX = /* glsl */ `
  attribute vec3 tone;
  attribute float alpha;
  attribute float size;
  attribute float glow;
  uniform float scale;
  varying vec3 vTone;
  varying float vAlpha;
  varying float vGlow;
  void main() {
    vTone = tone;
    vAlpha = alpha;
    vGlow = glow;
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_PointSize = size * scale / max(-view.z, 0.05);
  }
`;
const FRAGMENT = /* glsl */ `
  varying vec3 vTone;
  varying float vAlpha;
  varying float vGlow;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    if (d >= 1.0) discard;
    float a = vAlpha * (1.0 - d) * (1.0 - d * 0.5);
    gl_FragColor = vec4(vTone * a, a * (1.0 - vGlow));
  }
`;

/**
 * @param {THREE.Scene} scene
 * @param {number} ceiling height of the ceiling
 */
export function createParticleView(scene, ceiling) {
  const particles = createParticles({ ceiling });
  const { arrays } = particles;
  const geometry = new THREE.BufferGeometry();
  const attributes = [
    ['position', arrays.position, 3],
    ['tone', arrays.color, 3],
    ['alpha', arrays.alpha, 1],
    ['size', arrays.size, 1],
    ['glow', arrays.glow, 1],
  ].map(([name, array, itemSize]) => {
    const attribute = new THREE.BufferAttribute(array, itemSize).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute(name, attribute);
    return attribute;
  });
  geometry.setDrawRange(0, 0);
  const material = new THREE.ShaderMaterial({
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    uniforms: { scale: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  scene.add(points);

  let last = 0;

  return {
    smoke: (at) => {
      if (!particles.count) last = performance.now();
      particles.smoke(at);
    },
    explosion: (at) => {
      if (!particles.count) last = performance.now();
      particles.explosion(at);
    },
    /** Moves the particles to now. */
    update() {
      const now = performance.now();
      particles.update(Math.min((now - last) / 1000, MAX_STEP));
      last = now;
      geometry.setDrawRange(0, particles.count);
      for (const attribute of attributes) attribute.needsUpdate = true;
    },
    active: () => particles.count > 0,
    clear() {
      particles.clear();
      geometry.setDrawRange(0, 0);
    },
    /** A size in tiles gives this many pixels at 1 tile from the eye. */
    resize(heightPixels, fov) {
      material.uniforms.scale.value = heightPixels / (2 * Math.tan((fov * Math.PI) / 360));
    },
    dispose() {
      scene.remove(points);
      geometry.dispose();
      material.dispose();
    },
  };
}
