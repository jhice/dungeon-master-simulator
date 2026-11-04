// Checks of the particles (docs/063): the pool and its colours (no DOM, no Three.js), and the events
// of the simulation that start them.
// Run: node tools/test-particles.mjs

import { readFileSync } from 'node:fs';
import { Dungeon, SIDE_DELTAS } from '../src/core/dungeon.js';
import { createSimulation } from '../src/sim/simulation.js';
import { SYMBOLS } from '../src/core/spell-info.js';
import { createParticles, SPELL_COLORS } from '../src/render/particles.js';

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failures++;
};

// A draw that always gives the same sequence.
function seeded(seed = 1) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

// 1. Life: a burst lives, then the pool is empty.
{
  const p = createParticles({ random: seeded() });
  check(p.count === 0, 'nothing at first');
  p.explosion({ x: 1, y: 0.45, z: 1, color: SPELL_COLORS.fireball, soot: true });
  const fire = p.count;
  check(fire > 40, `an explosion: ${fire} particles`);
  p.update(0.02);
  check(p.count === fire, 'all alive just after');
  for (let i = 0; i < 200; i++) p.update(0.02);
  check(p.count === 0, 'all gone after 4 s');
}

// 2. Colour: a burst takes the colour of its spell.
{
  const dominant = (color) => {
    const p = createParticles({ random: seeded() });
    p.explosion({ x: 0, y: 0.45, z: 0, color });
    for (let i = 0; i < 12; i++) p.update(0.02); // past the white heart of the flash
    let [r, b] = [0, 0];
    for (let i = 0; i < p.count; i++) {
      r += p.arrays.color[i * 3] * p.arrays.alpha[i];
      b += p.arrays.color[i * 3 + 2] * p.arrays.alpha[i];
    }
    return r > b ? 'red' : 'blue';
  };
  check(dominant(SPELL_COLORS.fireball) === 'red', 'Fireball: towards red');
  check(dominant(SPELL_COLORS.openDoor) === 'blue', 'Open Door: towards blue');
}

// 3. Smoke covers and rises, tinted by the light; fire adds its light. Nothing leaves the room.
{
  const p = createParticles({ random: seeded(), ceiling: 0.7 });
  p.smoke({ x: 2, z: 2, height: 0.5, tint: 0.5 });
  p.update(0.01);
  const count = p.count;
  const y0 = p.arrays.position[1];
  const r0 = p.arrays.color[0];
  check(count > 16 && p.arrays.glow[0] === 0, `smoke: ${count} particles, covering`);
  check(r0 < 0.5, 'smoke: dimmed by the light of its spot');
  for (let i = 0; i < 20; i++) p.update(0.02);
  check(p.arrays.position[1] > y0, 'smoke: rises');
  const fire = createParticles({ random: seeded(), ceiling: 0.7 });
  fire.explosion({ x: 0, y: 0.45, z: 0, color: '#ffffff', scale: 1.3 });
  let inside = true;
  for (let t = 0; t < 40; t++) {
    fire.update(0.02);
    for (let i = 0; i < fire.count; i++) inside &&= fire.arrays.position[i * 3 + 1] >= 0.01 - 1e-6 && fire.arrays.position[i * 3 + 1] <= 0.7 + 1e-6; // stored as Float32
  }
  check(inside, 'fire: between the floor and the ceiling');
}

// 4. The pool is bounded: bursts over its capacity are dropped, not an error.
{
  const p = createParticles({ random: seeded() });
  for (let i = 0; i < 40; i++) p.explosion({ x: 0, y: 0.45, z: 0, color: '#ffffff' });
  p.update(0.01);
  check(p.count === 800, 'bounded to 800');
}

// 5. Simulation: what starts them.
{
  const dungeon = new Dungeon(JSON.parse(readFileSync(new URL('../data/dungeon.json', import.meta.url))));
  const sim = createSimulation(dungeon);
  const bursts = [];
  const deaths = [];
  sim.on('explosion', (e) => bursts.push(e));
  sim.on('creaturesMoved', (e) => e.killed && deaths.push(e));
  const cast = (line) => {
    sim.tick(sim.fatigue);
    line.split(' ').forEach((name, step) => sim.addSymbol(SYMBOLS[step].indexOf(name)));
    return sim.castSpell();
  };
  const face = (facing) => {
    while (sim.party.facing !== facing) sim.command('turnRight');
  };
  // A floor tile of level 1 with `free` floor tiles to the north, then a wall (no creature on them).
  const spot = (free) => {
    for (let y = free + 1; y < 31; y++) {
      for (let x = 1; x < 31; x++) {
        const clear = Array.from({ length: free + 1 }, (_, i) => y - i).every((ty) => dungeon.tileAt(1, x, ty)?.type === 'floor' && !sim.state.groupAt(1, x, ty));
        if (clear && dungeon.tileAt(1, x, y - free - 1)?.type === 'wall' && !sim.teleport(1, x, y)) return { x, y };
      }
    }
    return null;
  };

  // Against the wall in front: on the party's tile, on the row of the wall (north: sub-tile 0 or 1).
  sim.reset();
  Object.assign(sim.champion, { health: 500, maxHealth: 500 });
  const wall = spot(0);
  face('N');
  bursts.length = 0;
  cast('Lo Ful Ir');
  sim.tick(3);
  check(bursts.length === 1 && bursts[0].spell === 'fireball' && !bursts[0].fizzled, 'Fireball against a wall: one burst');
  check(bursts[0]?.x === wall.x && bursts[0]?.y === wall.y && [0, 1].includes(bursts[0]?.position), 'on the sub-tile by the wall');

  sim.tick(sim.fatigue);
  bursts.length = 0;
  cast('Lo Zo');
  sim.tick(3);
  check(bursts.length === 1 && bursts[0].spell === 'openDoor', 'Open Door against a wall: its own burst');

  // Out of energy in the air: a wisp.
  sim.reset();
  Object.assign(sim.champion, { health: 500, maxHealth: 500, maxMana: 0 });
  sim.champion.skills.Fire = 1;
  check(spot(6) !== null, 'a long corridor');
  face('N');
  bursts.length = 0;
  cast('Lo Ful Ir');
  sim.tick(12);
  check(bursts.length === 1 && bursts[0].fizzled, 'a weak Fireball fades in the air');

  // A creature killed by a fireball: the burst, and a death with its sub-tile.
  sim.reset();
  Object.assign(sim.champion, { health: 500, maxHealth: 500 });
  sim.champion.skills.Fire = 6;
  const group = dungeon.data.creatures
    .map((c) => sim.state.groupAt(c.at.map, c.at.x, c.at.y))
    .find((g) => {
      if (!g || g.type !== 12) return false;
      return Object.entries(SIDE_DELTAS).some(([facing, [dx, dy]]) => {
        if (dungeon.tileAt(g.level, g.x - dx, g.y - dy)?.type !== 'floor' || sim.state.groupAt(g.level, g.x - dx, g.y - dy) || sim.teleport(g.level, g.x - dx, g.y - dy)) return false;
        face(facing);
        return true;
      });
    });
  if (group) {
    for (const member of group.members) member.hp = 1;
    const positions = group.members.map((m) => m.position);
    bursts.length = 0;
    deaths.length = 0;
    cast('Ee Ful Ir');
    sim.tick(4);
    check(bursts.length > 0, 'Fireball on a creature: a burst');
    check(deaths.length === positions.length && deaths.every((d) => d.from.x === group.x && positions.includes(d.position)), `${deaths.length} death(s), with their sub-tile`);
  } else check(false, 'a Skeleton to kill');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
