#!/usr/bin/env node
// Builds the game dictionaries src/i18n/game-en.js, game-fr.js, game-de.js (docs/059): names of items,
// actions and creatures, and messages, from the texts of graphics.dat of DM Amiga 3.6
// (data/engine-texts/); for French and German, the texts of the dungeon (data/DungeonF.DAT.xml,
// data/DungeonG.DAT.xml). Stops if the sources do not line up.
// Usage: node tools/build-i18n.mjs

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseXml } from './xml-parser.mjs';
import { convertDungeon } from './dungeon-converter.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LANGUAGES = {
  en: { items: '0694', actions: '0699', misc: '0700' },
  fr: { items: '0735', actions: '0736', misc: '0737', dungeon: 'DungeonF.DAT.xml', creatureLines: { 18: 2 } }, // CHEVALIER / DE LA MORT
  de: { items: '0745', actions: '0746', misc: '0747', dungeon: 'DungeonG.DAT.xml', creatureLines: { 9: 2 } }, // STEINERNER / GOLEM
};
const ACTION_COUNT = 44;
const CREATURE_COUNT = 25;

// Lines of the miscellaneous texts: key -> [line, English text, to check that the line is the right one].
const MISC = {
  fighter: [0, 'FIGHTER'],
  ninja: [1, 'NINJA'],
  wizard: [2, 'WIZARD'],
  priest: [3, 'PRIEST'],
  north: [22, 'NORTH'],
  south: [23, 'SOUTH'],
  east: [24, 'EAST'],
  west: [25, 'WEST'],
  poisoned: [27, 'POISONED'],
  broken: [28, 'BROKEN'],
  cursed: [29, 'CURSED'],
  burntOut: [31, '(BURNT OUT)'],
  empty: [32, '(EMPTY)'],
  almostEmpty: [33, '(ALMOST EMPTY)'],
  almostFull: [34, '(ALMOST FULL)'],
  full: [35, '(FULL)'],
  strength: [42, 'STRENGTH'],
  dexterity: [43, 'DEXTERITY'],
  wisdom: [44, 'WISDOM'],
  vitality: [45, 'VITALITY'],
  antiMagic: [46, 'ANTI-MAGIC'],
  antiFire: [47, 'ANTI-FIRE'],
  health: [48, 'HEALTH'],
  stamina: [49, 'STAMINA'],
  mana: [50, 'MANA'],
  mumbles: [56, 'MUMBLES A MEANINGLESS SPELL.'],
  needsFlask: [58, 'NEEDS AN EMPTY FLASK IN HAND FOR POTION.'],
  heads: [69, 'IT COMES UP HEADS.'],
  tails: [70, 'IT COMES UP TAILS.'],
  tooFar: [71, "CAN'T REACH"],
  needAmmo: [72, 'NEED AMMO'],
};

// Names of the catalog that are not simply a line of the English list, or that are there twice:
// name in capitals -> line of the list (one line per icon).
const ITEM_LINES = {
  'WATER': 8, // the waterskin, whose state is told apart
  'SCROLL': 31,
  'THE FIRESTAFF': 27,
  'THE FIRESTAFF (COMPLETE)': 29,
  'ROBE (BODY)': 67,
  'FINE ROBE (BODY)': 68,
  'ROBE (LEGS)': 83,
  'FINE ROBE (LEGS)': 84,
  "CASQUE'N COIF": 99,
  'MAGICAL BOX (BLUE)': 132,
  'MAGICAL BOX (GREEN)': 133,
};
const NOT_IN_CATALOG = ['SPEEDBOW', 'CHEST', 'SCROLL', 'MA POTION', 'EE POTION', 'BRO POTION', 'YA POTION', 'VI POTION', 'KU POTION', 'WORM ROUND'];

const engineLines = async (file) => (await readFile(resolve(root, 'data/engine-texts', `${file}.txt`), 'latin1')).replaceAll('\r', '').split('\n').map((line) => line.trim());
const dungeonOf = async (file) => convertDungeon(parseXml(await readFile(resolve(root, 'data', file), 'latin1'))).dungeon;

function fail(message) {
  console.error(`build-i18n: ${message}`);
  process.exit(1);
}

const english = await dungeonOf('Dungeon.xml');
const englishItems = await engineLines(LANGUAGES.en.items);

// Line of each item name, in the English list.
const itemLines = new Map(Object.entries(ITEM_LINES));
englishItems.forEach((name, line) => name && !itemLines.has(name) && itemLines.set(name, line));
const catalogNames = ['weapon', 'cloth', 'potion', 'container', 'miscellaneous'].flatMap((kind) => Object.values(english.catalog[kind]));
for (const name of [...catalogNames.map((n) => n.toUpperCase()), ...NOT_IN_CATALOG]) {
  if (!itemLines.has(name)) fail(`item "${name}" not found in the English list`);
}

// Comparison of the structure: only the texts may differ from the English dungeon.
function checkSameStructure(dungeon, file) {
  if (dungeon.texts.length !== english.texts.length) fail(`${file}: ${dungeon.texts.length} texts, ${english.texts.length} expected`);
  const place = (t) => JSON.stringify([t.visible, t.at]);
  dungeon.texts.forEach((t, i) => place(t) !== place(english.texts[i]) && fail(`${file}: text ${i} is not at the same place`));
  const sheet = (text) => text.split('\n').slice(2).join();
  english.texts.forEach((t, i) => {
    if (/\n\n[MF]\n[A-P]{12}\n/.test(t.text) && sheet(t.text) !== sheet(dungeon.texts[i].text)) fail(`${file}: the champion sheet of text ${i} differs`);
  });
  const shape = (d) => JSON.stringify(d.maps.map((m) => m.grid));
  if (shape(dungeon) !== shape(english)) fail(`${file}: the maps differ`);
}

for (const [id, { items, actions, misc, dungeon, creatureLines = {} }] of Object.entries(LANGUAGES)) {
  const itemList = await engineLines(items);
  const actionList = await engineLines(actions);
  const miscList = await engineLines(misc);

  const start = miscList.findIndex((line) => ['NO CREATURE', 'PAS DE CREATURE', 'KEINE WESEN'].includes(line));
  if (start < 0) fail(`${misc}: list of creatures not found`);
  const creatures = [];
  for (let type = 0, line = start + 1; type < CREATURE_COUNT; type++) {
    const count = creatureLines[type] ?? 1;
    creatures.push(miscList.slice(line, line + count).join(' '));
    line += count;
  }
  if (actionList.filter(Boolean).length !== ACTION_COUNT) fail(`${actions}: ${ACTION_COUNT} actions expected`);
  if (id === 'en') {
    for (const [key, [line, text]] of Object.entries(MISC)) if (miscList[line] !== text) fail(`misc "${key}": line ${line} is "${miscList[line]}"`);
    english.catalog.creature && Object.entries(english.catalog.creature).forEach(([type, name]) => creatures[type] !== name.toUpperCase() && fail(`creature ${type}: "${creatures[type]}", "${name}" expected`));
  }

  const dictionary = {
    items: Object.fromEntries([...itemLines].map(([name, line]) => [name, itemList[line]])),
    actions: actionList.slice(0, ACTION_COUNT),
    creatures,
    misc: Object.fromEntries(Object.entries(MISC).map(([key, [line]]) => [key, miscList[line]])),
  };
  if (dungeon) {
    const translated = await dungeonOf(dungeon);
    checkSameStructure(translated, dungeon);
    dictionary.texts = translated.texts.map((t) => t.text);
  }

  const output = resolve(root, `src/i18n/game-${id}.js`);
  const json = JSON.stringify(dictionary, null, 2);
  await writeFile(output, `// Generated by tools/build-i18n.mjs from the texts of DM Amiga 3.6 (docs/059). Do not edit.\nexport default ${json};\n`);
  console.log(`${output}: ${(json.length / 1024).toFixed(0)} KB, ${Object.keys(dictionary.items).length} items, ${creatures.length} creatures, ${dictionary.texts?.length ?? 0} texts`);
}
