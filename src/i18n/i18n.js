// Languages of the game and of the interface (docs/059): two dictionaries, two ways to read them.
//   t(key, params)   the interface and what this project added: written by hand (ui-*.js)
//   gameText.*       the texts of DM Amiga 3.6, by their game identifier: generated (game-*.js)
// The language is fixed once the page is loaded: changing it reloads the page, so that
// tables of labels can be computed when their module is evaluated.
// No DOM here: the Node tools use it too, in English unless setLanguage() says otherwise.

import uiEn from './ui-en.js';
import uiFr from './ui-fr.js';
import uiDe from './ui-de.js';
import gameEn from './game-en.js';
import gameFr from './game-fr.js';
import gameDe from './game-de.js';

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
];
const DEFAULT_LANGUAGE = 'en';
const STORAGE_KEY = 'dm-viewer:language'; // apart from the preferences: "Valeurs par défaut" keeps it

const UI = { en: uiEn, fr: uiFr, de: uiDe };
const GAME = { en: gameEn, fr: gameFr, de: gameDe };

function storedLanguage() {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY);
  } catch {
    return null; // storage may be unavailable (private mode, blocked site data)
  }
}

let language = UI[storedLanguage()] ? storedLanguage() : DEFAULT_LANGUAGE;

export const getLanguage = () => language;

/** Changes the language at once, without saving it; for the tools. */
export function setLanguage(id) {
  if (UI[id]) language = id;
}

/** Remembers the language for the next page load. */
export function saveLanguage(id) {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, id);
  } catch {
    // ignored: the language is then lost with the page
  }
}

// French counts 0 as singular; English and German do not.
const isOne = (count) => count === 1 || (language === 'fr' && count === 0);

/**
 * A text of the interface; `{name}` is replaced by params.name. An entry { one, other } is chosen
 * by params.count. A key missing in the language falls back on English, then on the key itself.
 */
export function t(key, params = {}) {
  let text = UI[language][key] ?? UI[DEFAULT_LANGUAGE][key] ?? key;
  if (typeof text === 'object') text = isOne(params.count) ? text.one : text.other;
  return text.replace(/\{(\w+)\}/g, (whole, name) => params[name] ?? whole);
}

const gameEntry = (read) => read(GAME[language]) ?? read(GAME[DEFAULT_LANGUAGE]);

/** The texts of the game. */
export const gameText = {
  /** Name of an item, from its English name (the `name` of dungeon.json); unknown names are kept. */
  item: (name) => gameEntry((d) => d.items[name.toUpperCase()]) ?? name,
  /** Name of an action, by its index (action-info.js). */
  action: (index) => gameEntry((d) => d.actions[index]) ?? '',
  /** Name of a creature species, by its type. */
  creature: (type) => gameEntry((d) => d.creatures[type]) ?? `#${type}`,
  /** A word or a message of the engine (MISC in tools/build-i18n.mjs). */
  misc: (key) => gameEntry((d) => d.misc[key]) ?? key,
  /** A text of the dungeon, by its index; undefined in English: dungeon.json has it. */
  text: (index) => GAME[language].texts?.[index],
};
