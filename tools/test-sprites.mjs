// Checks of the creature sprites (docs/067): the view seen by the party, and the files of frames.json.
// Run: node tools/test-sprites.mjs

import { existsSync, readFileSync } from 'node:fs';
import { viewDirection, viewFrame, viewFrames, VIEW_FRAMES } from '../src/render/creature-views.js';
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
check(entries.every((entry) => viewFrames(entry.hasViews).every((index) => entry.frames[index])), 'each species has the frames of its views');
check(entries.filter((entry) => entry.hasViews).every((entry) => entry.frames[side].role === 'side' && entry.frames[side2].role === 'side2' && entry.frames[back].role === 'back'), 'the view frames have the expected roles');

console.log(failures ? `\n${failures} FAILED` : '\nAll good');
process.exit(failures ? 1 : 0);
