// Checks of the dictionaries (docs/059): same keys and same parameters in the three languages,
// every key used by the code exists, no French text left in the code, the three dungeons line up,
// the scrolls teach the same spells in every language, the languages are read as expected.
// Run: node tools/test-i18n.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import uiEn from '../src/i18n/ui-en.js';
import uiFr from '../src/i18n/ui-fr.js';
import uiDe from '../src/i18n/ui-de.js';
import gameEn from '../src/i18n/game-en.js';
import gameFr from '../src/i18n/game-fr.js';
import gameDe from '../src/i18n/game-de.js';
import { t, gameText, setLanguage } from '../src/i18n/i18n.js';
import { spellsInText, SPELLS } from '../src/core/spell-info.js';
import { decodeChampion } from '../src/core/texts.js';

let failures = 0;
const check = (ok, label) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${label}`);
  if (!ok) failures++;
};
const root = fileURLToPath(new URL('..', import.meta.url));
const data = JSON.parse(readFileSync(join(root, 'data/dungeon.json')));

// --- Interface
const paramsOf = (value) => [...new Set((typeof value === 'object' ? Object.values(value).join() : value).match(/\{\w+\}/g) ?? [])].sort().join();
for (const [id, ui] of [['fr', uiFr], ['de', uiDe]]) {
  const missing = Object.keys(uiEn).filter((key) => !(key in ui));
  const extra = Object.keys(ui).filter((key) => !(key in uiEn));
  check(!missing.length && !extra.length, `${id}: same keys as English${missing.length ? `, missing ${missing}` : ''}${extra.length ? `, extra ${extra}` : ''}`);
  const params = Object.keys(uiEn).filter((key) => key in ui && paramsOf(uiEn[key]) !== paramsOf(ui[key]));
  check(!params.length, `${id}: same parameters as English${params.length ? `: ${params}` : ''}`);
}

const sources = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith('.js') && !path.includes('/i18n/')) sources.push([path, readFileSync(path, 'utf8')]);
  }
})(join(root, 'src'));
const used = new Set();
for (const [, code] of sources) {
  for (const m of code.matchAll(/\b(?:t|translate)\(\s*'([\w.]+)'/g)) used.add(m[1]);
  for (const m of code.matchAll(/\(\s*\w[\w.?]*(?: === '\w+')? \? '([a-z]\w*\.[\w.]+)' : (?:[\w.?]+(?: === '\w+')? \? '([a-z]\w*\.[\w.]+)' : )*'([a-z]\w*\.[\w.]+)'/g)) [m[1], m[2], m[3]].filter(Boolean).forEach((key) => used.add(key));
}
const unknown = [...used].filter((key) => !(key in uiEn));
check(used.size > 300 && !unknown.length, `${used.size} keys used by the code, all in the dictionary${unknown.length ? `; unknown: ${unknown}` : ''}`);

for (const spell of SPELLS) if (!(`spell.${spell.name}` in uiEn)) check(false, `spell "${spell.name}" has no name`);
check(['wall', 'floor', 'pit', 'stairs', 'door', 'teleporter', 'fakewall'].every((type) => `tile.${type}` in uiEn), 'every tile type has a name');

// French left in the code: accents in strings (comments and the "Valeurs par défaut" mentions aside).
const french = sources.flatMap(([path, code]) =>
  code.split('\n').flatMap((line, i) => {
    const text = line.replace(/\/\/.*$/, '');
    return !/^\s*(\*|\/\*)/.test(line) && /['"`][^'"`]*[éèêàçùôî’][^'"`]*['"`]/.test(text) ? [`${path.slice(root.length)}:${i + 1}`] : [];
  }),
);
check(!french.length, `no French text left in the code${french.length ? `: ${french.join(' ')}` : ''}`);

// --- Game
for (const [id, game] of [['en', gameEn], ['fr', gameFr], ['de', gameDe]]) {
  check(game.actions.length === 44 && game.creatures.length === 25 && game.actions.every(Boolean) && game.creatures.every(Boolean), `${id}: 44 actions, 25 creatures`);
  const names = ['weapon', 'cloth', 'potion', 'container', 'miscellaneous'].flatMap((kind) => Object.values(data.catalog[kind]));
  const missing = names.filter((name) => !game.items[name.toUpperCase()]);
  check(!missing.length, `${id}: every item of the catalog has a name${missing.length ? `, not ${missing}` : ''}`);
}
check(gameEn.creatures[9] === 'STONE GOLEM' && gameFr.creatures[18] === 'CHEVALIER DE LA MORT' && gameDe.creatures[9] === 'STEINERNER GOLEM', 'names of creatures on two lines joined');
check(gameFr.creatures[24] === 'DRAGON ROUGE' && gameDe.creatures[24] === 'ROTER DRACHEN', 'creatures aligned up to the last one');
check(gameFr.items.WATER === 'GOURDE' && gameDe.items['ROBE (LEGS)'] === gameDe.items.ROBE && gameFr.items["CASQUE'N COIF"] === 'CAMAIL', 'items with several lines');

for (const [id, game] of [['fr', gameFr], ['de', gameDe]]) {
  check(game.texts.length === data.texts.length, `${id}: ${data.texts.length} texts`);
  const sheets = data.texts.map((entry, i) => [decodeChampion(entry.text), decodeChampion(game.texts[i])]).filter(([english]) => english);
  const same = sheets.every(([a, b]) => b && a.name === b.name && a.health === b.health && a.mana === b.mana && JSON.stringify(a.attributes) === JSON.stringify(b.attributes));
  check(sheets.length === 24 && same, `${id}: the 24 champion sheets decode with the same values`);
  // Each scroll of the dungeon teaches the same spells as in English.
  const differ = [...new Set(data.scrolls.map((s) => s.text))].filter((i) => {
    const names = (text) => spellsInText(text).map((s) => s.name).join();
    return names(data.texts[i].text) !== names(game.texts[i]);
  });
  check(!differ.length, `${id}: scrolls teach the same spells${differ.length ? `, not ${differ}` : ''}`);
}

// --- Reading
check(t('combat.missed') === 'Missed' && gameText.creature(24) === 'RED DRAGON', 'English by default');
check(t('item.charges', { count: 1 }) === '1 charge' && t('item.charges', { count: 0 }) === '0 charges', 'English plural');
check(t('no.such.key') === 'no.such.key' && t('common.labelled', { label: 'A' }) === 'A: {value}', 'unknown key and missing parameter kept');
check(gameText.item('Torch') === 'TORCH' && gameText.item('Nothing') === 'Nothing', 'item by its English name');
check(gameText.text(4) === undefined, 'English texts come from dungeon.json');
setLanguage('fr');
check(t('combat.missed') === 'Raté' && gameText.item('Torch') === 'TORCHE' && gameText.action(2) === 'ENTAILLER', 'French');
check(t('item.charges', { count: 0 }) === '0 charge', 'French plural');
check(gameText.text(4) === 'HALL DES\nCHAMPIONS', 'French text of the dungeon');
setLanguage('de');
check(t('combat.missed') === 'Daneben' && gameText.creature(24) === 'ROTER DRACHEN' && gameText.misc('tooFar') === 'ZU WEIT WEG', 'German');
setLanguage('xx');
check(t('combat.missed') === 'Daneben', 'unknown language ignored');
setLanguage('en');

console.log(failures ? `\n${failures} failure(s)` : '\nall ok');
process.exit(failures ? 1 : 0);
