// Particles of the first-person view (docs/063), for the eye only: no rule of the simulation reads
// them. A burst adds particles to a fixed pool, `update()` moves them and fills the arrays read by
// fp-particles.js. Without DOM nor Three.js: tested in Node (tools/test-particles.mjs).
//
// A particle goes through a ramp of colours while its size goes from `size` to `sizeEnd`. `glow` 1:
// it adds its light (fire, spells); 0: it covers what is behind it (smoke), and is lit by `tint`.

const CAPACITY = 800;
const FADE_IN = 0.08; // share of the life
const BOUNCE = 0.35; // speed kept on the floor and the ceiling

export const SPELL_COLORS = { fireball: '#ff7a1a', openDoor: '#4a8cff' };
const SMOKE_RAMP = ['#a8a6a2', '#74726e', '#44423f'].map(rgb);
const SOOT_RAMP = ['#6a6661', '#3e3b38', '#211f1d'].map(rgb);

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const WHITE = [1, 1, 1];
const BLACK = [0, 0, 0];

/**
 * @param {object} [options]
 * @param {number} [options.floor] lowest height of a particle
 * @param {number} [options.ceiling] highest height of a particle
 * @param {() => number} [options.random]
 */
export function createParticles({ floor = 0.01, ceiling = Infinity, random = Math.random } = {}) {
  const live = [];
  const arrays = {
    position: new Float32Array(CAPACITY * 3),
    color: new Float32Array(CAPACITY * 3),
    alpha: new Float32Array(CAPACITY),
    size: new Float32Array(CAPACITY),
    glow: new Float32Array(CAPACITY),
  };

  const between = (low, high) => low + random() * (high - low);

  function add(particle) {
    if (live.length < CAPACITY) live.push({ age: 0, gravity: 0, drag: 0, tint: 1, glow: 0, alpha: 1, ...particle });
  }

  // A uniform direction on the sphere, at a speed.
  function outward(speed) {
    const y = between(-1, 1);
    const angle = between(0, Math.PI * 2);
    const r = Math.sqrt(1 - y * y);
    return { vx: Math.cos(angle) * r * speed, vy: y * speed, vz: Math.sin(angle) * r * speed };
  }

  function smokeAt(x, y, z, count, { spread, rise, life, size, sizeEnd, alpha, ramp, tint }) {
    for (let i = 0; i < count; i++) {
      const out = outward(between(0.05, 0.25));
      add({
        x: x + between(-spread, spread),
        y: y + between(-spread, spread),
        z: z + between(-spread, spread),
        vx: out.vx,
        vy: out.vy * 0.4 + between(rise * 0.5, rise),
        vz: out.vz,
        drag: 1.2,
        life: between(life * 0.6, life),
        size: between(size * 0.7, size),
        sizeEnd: between(sizeEnd * 0.7, sizeEnd),
        alpha,
        ramp,
        tint,
      });
    }
  }

  return {
    arrays,
    /** Number of particles alive: the first ones of the arrays. */
    get count() {
      return live.length;
    },
    /**
     * A creature dies: a cloud of smoke as tall as it is, rising.
     * @param {{ x: number, z: number, height: number, tint?: number }} at feet of the creature, its height
     */
    smoke({ x, z, height, tint = 1 }) {
      const spread = Math.max(0.1, height * 0.3);
      const count = Math.round(16 + 34 * Math.min(height, 1));
      smokeAt(x, Math.max(height * 0.5, floor + spread), z, count, { spread, rise: 0.32, life: 1.5, size: 0.2, sizeEnd: 0.55, alpha: 0.6, ramp: SMOKE_RAMP, tint });
    },
    /**
     * A spell ends in the air: a flash, a burst of its colour, sparks; `soot` adds dark smoke.
     * @param {{ x: number, y: number, z: number, color: string, scale?: number, soot?: boolean, tint?: number }} at
     */
    explosion({ x, y, z, color, scale = 1, soot = false, tint = 1 }) {
      const base = rgb(color);
      const ramp = [mix(base, WHITE, 0.75), base, mix(base, BLACK, 0.65)];
      const sparks = [mix(base, WHITE, 0.85), mix(base, WHITE, 0.2), base];
      add({ x, y, z, vx: 0, vy: 0, vz: 0, life: 0.18, size: 0.5 * scale, sizeEnd: 1.1 * scale, glow: 1, ramp: [WHITE, mix(base, WHITE, 0.5), base] });
      for (let i = Math.round(44 * scale); i > 0; i--) {
        add({
          x, y, z,
          ...outward(between(0.4, 2) * scale),
          drag: 4.5,
          life: between(0.3, 0.75),
          size: between(0.1, 0.24) * scale,
          sizeEnd: 0.03,
          alpha: 0.9,
          glow: 1,
          ramp,
        });
      }
      for (let i = Math.round(18 * scale); i > 0; i--) {
        add({
          x, y, z,
          ...outward(between(1.2, 2.8) * scale),
          drag: 1.5,
          gravity: 2.4,
          life: between(0.4, 0.9),
          size: 0.05,
          sizeEnd: 0.015,
          glow: 1,
          ramp: sparks,
        });
      }
      if (soot) smokeAt(x, y, z, Math.round(14 * scale), { spread: 0.12 * scale, rise: 0.22, life: 1.4, size: 0.16 * scale, sizeEnd: 0.42 * scale, alpha: 0.5, ramp: SOOT_RAMP, tint });
    },
    /** Moves everything by `dt` seconds and fills the arrays. */
    update(dt) {
      let n = 0;
      for (const p of live) {
        p.age += dt;
        if (p.age >= p.life) continue;
        const slow = Math.exp(-p.drag * dt);
        p.vx *= slow;
        p.vz *= slow;
        p.vy = p.vy * slow - p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        if (p.y < floor || p.y > ceiling) {
          p.y = Math.min(Math.max(p.y, floor), ceiling);
          p.vy *= -BOUNCE;
        }
        const t = p.age / p.life;
        const at = t * (p.ramp.length - 1);
        const stop = Math.min(Math.floor(at), p.ramp.length - 2);
        const from = p.ramp[stop];
        const to = p.ramp[stop + 1];
        const k = at - stop;
        live[n] = p;
        arrays.position[n * 3] = p.x;
        arrays.position[n * 3 + 1] = p.y;
        arrays.position[n * 3 + 2] = p.z;
        for (let c = 0; c < 3; c++) arrays.color[n * 3 + c] = (from[c] + (to[c] - from[c]) * k) * p.tint;
        arrays.alpha[n] = p.alpha * Math.min(t / FADE_IN, 1) * (1 - t);
        arrays.size[n] = p.size + (p.sizeEnd - p.size) * t;
        arrays.glow[n] = p.glow;
        n++;
      }
      live.length = n;
    },
    clear() {
      live.length = 0;
    },
  };
}
