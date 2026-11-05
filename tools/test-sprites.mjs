// Checks of the creature sprites (docs/067): the view seen by the party, and the files of frames.json.
// Run: node tools/test-sprites.mjs

import { existsSync, readFileSync } from 'node:fs';
import { viewDirection, viewFrame, viewFrames, viewSpot, rollIdle, hasIdle, VIEW_FRAMES } from '../src/render/creature-views.js';
import { FACINGS } from '../src/core/dungeon.js';

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failures++;
};

// --- View by facing -------------------------------------------------------------
const { front, side, back, side2 } = VIEW_FRAMES;
const NORTH = 0; // the party looks north
check(viewFrame('S', NORTH) === front, 'a creature looking south faces a party looking north');
check(viewFrame('N', NORTH) === back, 'looking the same way as the party: its back');
check(viewFrame('E', NORTH) === side, 'looking east, party north: towards the right of the view (side)');
check(viewFrame('W', NORTH) === side2, 'looking west, party north: towards the left of the view (side2)');

// The same creature, looking south, as the party turns on the spot.
check(viewFrame('S', 1) === side, 'party east, creature south: towards the right of the view');
check(viewFrame('S', 2) === back, 'party south, creature south: its back');
check(viewFrame('S', 3) === side2, 'party west, creature south: towards the left of the view');

for (const facing of FACINGS) {
  const seen = [0, 1, 2, 3].map((turns) => viewFrame(facing, turns));
  check(new Set(seen).size === 4, `${facing}: four different views around it`);
  check(viewFrame(facing, 4) === seen[0] && viewFrame(facing, -1) === seen[3], `${facing}: turns past 0..3 mean the same`);
}

// --- Halfway in a turn ----------------------------------------------------------
check(viewDirection(0.4) === 0 && viewDirection(0.6) === 1, 'the view changes at the middle of a quarter turn');
check(viewDirection(-0.6) === 3 && viewDirection(4.4) === 0, 'also past 0..3');

// --- Species with one picture ---------------------------------------------------
for (const facing of FACINGS) check(viewFrame(facing, 1, false) === front, `no views, ${facing}: the only picture`);

// --- Life on the spot (DM, F179) ----------------------------------------------------
const draws = (entry, times = 2000) => Array.from({ length: times }, () => rollIdle(entry));
const values = (list, key) => [...new Set(list.map((idle) => idle[key]))].sort((a, b) => a - b).join();
const dragon = draws({ idleFlip: true, idleOffset: [1, 2] });
check(values(dragon, 'dx') === '0' && values(dragon, 'dy') === '-1,0,1', 'Dragon: moves up and down only, by 1 pixel (as the Encyclopaedia says)');
check(dragon.some((idle) => idle.flip) && dragon.some((idle) => !idle.flip), 'flip at random when the species does');
const golem = draws({ idleFlip: false, idleOffset: [3, 1] });
check(values(golem, 'dx') === '-2,-1,0,1,2' && values(golem, 'dy') === '0' && golem.every((idle) => !idle.flip), 'Stone Golem: sideways only, up to 2 pixels, never mirrored');
check(!hasIdle({ idleFlip: false, idleOffset: [0, 0] }) && !hasIdle({ idleFlip: false, idleOffset: [1, 0] }), 'Screamer, Mummy: nothing moves');
check(hasIdle({ idleFlip: true, idleOffset: [0, 0] }) && hasIdle({ idleFlip: false, idleOffset: [2, 1] }), 'Black Flame, Skeleton: something moves');

// --- Attack picture ---------------------------------------------------------------
check(viewFrame('S', NORTH, true, 7) === 7, 'attacking, seen from the front: the attack picture');
check(viewFrame('E', NORTH, true, 7) === side && viewFrame('W', NORTH, true, 7) === side2, 'attacking, seen from the side: still its side');
check(viewFrame('N', NORTH, true, 7) === back, 'attacking, seen from the back: still its back');
check(viewFrame('E', NORTH, false, 3) === 3, 'one picture only: the attack shows from everywhere');
check(viewFrame('S', NORTH, true, null) === front, 'no attack picture: its front');
check(viewFrames(true, 7).includes(7) && viewFrames(false, null).length === 1, 'the attack picture is loaded with the views');

// --- Places in the tile (DM, graphics.dat item 558) ------------------------------
const WORM = { size: 1, coordinateSet: 1 };
const TROLIN = { size: 0, coordinateSet: 0 };
const GOLEM = { size: 2, coordinateSet: 1 };
const DRAGON = { size: 2, coordinateSet: 0 };
const facingUs = viewSpot(WORM, 'S', NORTH, 0, 2);
const facingUs2 = viewSpot(WORM, 'S', NORTH, 1, 2);
check(facingUs.depth === facingUs2.depth && facingUs.lateral === -facingUs2.lateral && facingUs.lateral !== 0, 'two half-tile creatures seen from the front: side by side');
const fromSide = viewSpot(WORM, 'E', NORTH, 0, 2);
const fromSide2 = viewSpot(WORM, 'E', NORTH, 1, 2);
check(fromSide.lateral === 0 && fromSide2.lateral === 0 && fromSide.depth === -fromSide2.depth && fromSide.depth !== 0, 'seen from the side: one behind the other, in the middle');
check(viewSpot(WORM, 'E', NORTH, 0, 1).depth === 0 && viewSpot(WORM, 'S', NORTH, 0, 1).depth > 0, 'alone: centred from the side, front row from the front');
check(viewSpot(GOLEM, 'S', NORTH, 0, 1).depth > 0, 'lone creature of the low set: front row');
check(viewSpot(DRAGON, 'S', NORTH, 0, 1) === null, 'lone creature of the middle set: its place, the centre');
check(viewSpot(TROLIN, 'S', NORTH, 0, 3) === null, 'quarter-tile creatures stay in their sub-tile');

// --- Files ----------------------------------------------------------------------
const manifest = JSON.parse(readFileSync('assets/creatures/frames.json', 'utf8'));
const entries = Object.values(manifest);
const dungeon = JSON.parse(readFileSync('data/dungeon.json', 'utf8'));
const types = new Set(dungeon.creatures.map((group) => group.type));
const byType = new Map(entries.map((entry) => [entry.type, entry]));
check([...types].every((type) => byType.has(type)), `every species placed in the dungeon has sprites (${types.size})`);
const missing = entries.flatMap((entry) =>
  entry.frames.filter((frame) => !existsSync(`assets/creatures/${entry.folder}/${frame.file}`)).map((frame) => `${entry.folder}/${frame.file}`),
);
check(missing.length === 0, `all the files of frames.json exist${missing.length ? `: ${missing}` : ''}`);
check(entries.every((entry) => viewFrames(entry.hasViews, entry.attack).every((index) => entry.frames[index])), 'each species has the frames of its views and attack');
check(entries.every((entry) => entry.attackTicks > 0), 'each species has the duration of its attack');
check(entries.every((entry) => entry.idleTicks > 0 && entry.idleOffset.length === 2), 'each species has its life on the spot');
check(entries.filter((entry) => entry.attack === null).map((entry) => entry.folder).join() === 'Giggler,Grey_Lord,Lord_Order,Ruster', 'no attack picture: Giggler, Ruster, and the two lords');
check(entries.filter((entry) => entry.hasViews).every((entry) => entry.frames[side].role === 'side' && entry.frames[side2].role === 'side2' && entry.frames[back].role === 'back'), 'the view frames have the expected roles');

console.log(failures ? `\n${failures} FAILED` : '\nAll good');
process.exit(failures ? 1 : 0);
