// Checks of the animated moves (docs/062): motion of the display (no time of its own, no rule reads
// it), shortest turn, queue of the controls, and the party's logic independent of them.
// Run: node tools/test-motion.mjs

import { readFileSync } from 'node:fs';
import { Dungeon } from '../src/core/dungeon.js';
import { createSimulation } from '../src/sim/simulation.js';
import { createControls } from '../src/sim/controls.js';
import { createMotion, nearestQuarter, EASE } from '../src/render/motion.js';
import { lightMasks, updateLightMask } from '../src/render/first-person/light-masks.js';

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failures++;
};

// 1. Motion: from, to, a move not finished goes on from where it is shown.
{
  let time = 0;
  const motion = createMotion(() => time);
  check(motion.sample('a') === null && !motion.active(), 'unknown key: nothing, nothing active');
  motion.move('a', { x: 3 });
  check(motion.sample('a').x === 3 && !motion.active(), 'duration 0: placed at once');
  motion.move('a', { x: 4 }, { duration: 100, ease: EASE.linear });
  check(motion.active(), 'a move is active');
  time = 50;
  check(motion.sample('a').x === 3.5, 'halfway at half the time');
  motion.move('a', { x: 5 }, { duration: 100, ease: EASE.linear });
  check(motion.sample('a').x === 3.5, 'a new move starts where the old one is shown');
  time = 150;
  check(motion.sample('a').x === 5 && !motion.active(), 'ends exactly on its target, then inactive');
  time = 1000;
  check(motion.sample('a').x === 5, 'stays there');
  const rest = { x: 1, y: 1 };
  motion.move('b', { x: 1.07, y: 1 }, { from: rest, duration: 100, ease: EASE.bump });
  time = 1050;
  check(motion.sample('b').x === 1.07, 'bump: at its depth at half the time');
  time = 1100;
  check(Math.abs(motion.sample('b').x - 1) < 1e-9, 'bump: back where it started');
  motion.clear();
  check(motion.sample('a') === null && motion.sample('b') === null, 'clear forgets everything');
}

// 2. Shortest turn, in quarter turns.
check(nearestQuarter(3, 0) === 4, 'W to N turns right, through 4');
check(nearestQuarter(0, 3) === -1, 'N to W turns left, through -1');
check(nearestQuarter(4, 1) === 5, 'after a full turn, N to E still a quarter');
check(nearestQuarter(-1, 2) === -2, 'W (-1) to S turns left');

// 3. Controls, with hand-driven timers.
{
  const run = [];
  let due = null;
  const controls = (duration) =>
    createControls((command) => run.push(command), () => duration, { schedule: (fn) => (due = fn), cancel: () => (due = null) });
  const fire = () => {
    const fn = due;
    due = null;
    fn?.();
  };
  const press = (keys, code, repeat = false) => keys({ code, repeat })?.();

  const keys = controls(300);
  check(keys({ code: 'KeyP', repeat: false }) === undefined, 'other keys are not movement keys');
  press(keys, 'KeyW');
  check(run.join() === 'forward', 'a key moves at once');
  press(keys, 'KeyW', true);
  press(keys, 'KeyW', true);
  fire();
  check(run.length === 1 && due === null, 'a key held does not repeat');

  run.length = 0;
  press(keys, 'KeyW');
  press(keys, 'KeyW', true);
  fire();
  press(keys, 'KeyW', true);
  check(run.length === 1 && due === null, 'nor once the animation is over');

  run.length = 0;
  press(keys, 'KeyW');
  for (const code of ['KeyQ', 'KeyD', 'KeyS', 'KeyA', 'KeyE', 'KeyW']) press(keys, code);
  for (let i = 0; i < 7; i++) fire();
  check(run.join() === 'forward,turnLeft,right,back,left,turnRight', `pressed keys wait in a queue of 5, the next is dropped (${run})`);
  check(due === null, 'the queue done: it stops');

  run.length = 0;
  press(keys, 'KeyW');
  press(keys, 'KeyD');
  keys.stop();
  fire();
  check(run.join() === 'forward' && due === null, 'stop: the queue is forgotten');

  run.length = 0;
  const instant = controls(0);
  press(instant, 'KeyW');
  press(instant, 'KeyW');
  check(run.length === 2 && due === null, 'instant: each press acts at once, without a timer');
  press(instant, 'KeyW', true);
  check(run.length === 2, 'instant: a key held does not repeat either');
}

// 4. Tiles a light sees, on small maps: # stops the light.
{
  const seenFrom = (rows, x, z, reach = 9) => {
    const [width, height] = [rows[0].length, rows.length];
    const masks = lightMasks(width, height, (a, b) => rows[b]?.[a] !== '.', [{ x, z, reach }]);
    return (a, b) => Boolean(masks[b * width + a]);
  };
  const room = ['.....', '.###.', '.....'];
  const behind = seenFrom(room, 0.5, 0.5);
  check(behind(0, 0) && behind(4, 0), 'its own tile and along a corridor');
  check(behind(1, 1) && !behind(2, 2) && !behind(3, 2), 'a wall is lit, what is behind it is not');

  // Thin views past a corner.
  const corner = ['..', '#.', '#.'];
  const strip = seenFrom(['.##', '...', '##.'], 0.5, 0.2);
  check(strip(1, 1), 'a tile seen through a gap');
  check(seenFrom(corner, 1.9, 0.1)(0, 1), 'the wall face seen in grazing');
  const graze = ['.#...', '.....'];
  check(seenFrom(graze, 0.95, 1.05)(4, 1), 'a far tile along the corner of a wall, the eye almost touching it');
  check(seenFrom(['...', '.#.', '...'], 0.05, 0.05)(2, 0), 'a tile beyond the side of a wall, from the corner of the room');

  check(!seenFrom(['.#.', '#..'], 0.5, 0.5)(2, 1), 'no sight through two walls meeting at a corner');
  const west = seenFrom(['.....'], 4.5, 0.5);
  check(west(0, 0), 'to the west, where the angles wrap around');
  const walled = seenFrom(['#....', '.#...', '.....'], 2.5, 1.5);
  check(!walled(0, 0) && !walled(0, 1) && !walled(0, 2) && walled(1, 0) && walled(1, 2), 'a wall across the wrap of the angles hides what is behind it only');
  const far = seenFrom(['.........'], 0.5, 0.5, 2);
  check(far(2, 0) && !far(8, 0), 'not beyond the reach');

  const masks = lightMasks(3, 1, () => false, [{ x: 0.5, z: 0.5, reach: 9 }, { x: 2.5, z: 0.5, reach: 0.5 }]);
  check(masks[0] === 1 && masks[2] === 3, 'one bit per light');
  updateLightMask(masks, 3, 1, () => false, null, 0);
  check(masks[0] === 0 && masks[2] === 2, 'one light computed again leaves the others');
}

// 5. The simulation moves at once whatever the display does, and says what was blocked.
{
  const dungeon = new Dungeon(JSON.parse(readFileSync(new URL('../data/dungeon.json', import.meta.url))));
  const sim = createSimulation(dungeon);
  sim.reset();
  let blocked = null;
  sim.on('blocked', (event) => (blocked = event));
  for (let i = 0; i < 40 && !blocked; i++) sim.command('forward');
  check(blocked?.command === 'forward', `blocked says the command (${blocked?.command}, ${blocked?.reason})`);
}

console.log(failures ? `${failures} failure(s)` : 'all ok');
process.exit(failures ? 1 : 0);
