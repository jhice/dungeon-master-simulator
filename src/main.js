import { loadDungeon, FACINGS, SIDE_DELTAS } from './core/dungeon.js';
import { describeState } from './core/tile-states.js';
import { tileContents, buildInventory } from './core/contents.js';
import { buildLogic, describeActuator, describeTeleporter, actuatorFamily } from './core/logic.js';
import { buildTexts, textsAt, championSummary } from './core/texts.js';
import { FACE_LABELS, describeItem, describeGroup } from './core/contents.js';
import { FAMILY_COLORS, TELEPORTER_COLORS, TEXT_COLORS, CATEGORY_COLORS } from './render/palette.js';
import { createAsciiRenderer } from './render/ascii/ascii-renderer.js';
import { createDomRenderer } from './render/dom/dom-renderer.js';
import { bindKeys } from './ui/keyboard.js';
import { renderLegend } from './ui/legend.js';
import { createControlPanel } from './ui/control-panel.js';
import { createInventoryPanel } from './ui/inventory-panel.js';
import { createTooltip } from './ui/tooltip.js';
import { createContextMenu } from './ui/context-menu.js';
import { createTextsPanel } from './ui/texts-panel.js';
import { createShortcutsModal } from './ui/shortcuts-modal.js';
import { loadPreferences, savePreferences } from './ui/preferences.js';
import { createGameWindow } from './ui/game-window.js';
import { createChampionPanel } from './ui/champion-panel.js';
import { createSpellPanel } from './ui/spell-panel.js';
import { createSimulation } from './sim/simulation.js';
import { isWaterskin } from './sim/water.js';
import { DEFAULT_LIGHTING } from './render/first-person/lighting-settings.js';
import { DEFAULT_AUDIO } from './audio/audio-settings.js';
import { DEFAULT_ANIMATION } from './render/animation-settings.js';
import { createAudio } from './audio/audio.js';
import { createControls } from './sim/controls.js';
import { BLOCK_LABELS } from './sim/rules.js';
import { SYMBOLS, symbolLabel, spellName } from './core/spell-info.js';
import { itemDetails } from './core/item-info.js';
import { t, gameText, getLanguage } from './i18n/i18n.js';
import { createLanguageSelect } from './ui/language-select.js';

// `create` may be async: the 3D renderer is loaded on demand (Three.js comes from a CDN).
const RENDERERS = {
  dom: { label: '2D', create: (container, dungeon, opts) => createDomRenderer(container, dungeon, opts) },
  three: {
    label: '3D',
    frameless: true, // always shows every level in the global frame
    create: async (container, dungeon, opts) => (await import('./render/three/three-renderer.js')).createThreeRenderer(container, dungeon, opts),
  },
  // Out of the R rotation (docs/012-simulation.md): kept for the command-line tool.
  ascii: { label: 'ASCII', hidden: true, create: (container, dungeon, opts) => createAsciiRenderer(container, dungeon, { ...opts, wide: true }) },
};
const MIN_CELL = 6;
const MAX_CELL = 48;

document.documentElement.lang = getLanguage();

const viewWrap = document.getElementById('view-wrap'); // holds the view and the control panel
const view = document.getElementById('view');
const label = document.getElementById('level-label');
const status = document.getElementById('status');
const legend = document.getElementById('legend');

const dungeon = await loadDungeon('./data/dungeon.json');
// Values of the control panel, restored by its "Valeurs par défaut" button (with the
// renderers' settings, the light and the sounds).
const PANEL_DEFAULTS = {
  frame: 'local',
  autoFit: true, // 2D/ASCII: fit the zoom to the level after each level change (local frame)
  alwaysTooltip: true, // tooltip even on empty tiles (tile info of the status bar)
  showRulers: true, // 2D: coordinates on the top and left edges
  showStates: true,
  showItems: true,
  showCreatures: true,
  showMechanisms: true,
  showTexts: true,
  allLinks: true,
  invincible: false, // test option: the champion loses no health
};
const prefs = loadPreferences({
  renderer: 'dom',
  level: 0,
  cell: null,
  ...PANEL_DEFAULTS,
  textsOpen: false,
  panelOpen: true,
  inventoryOpen: false,
  playing: false, // the game window is open
  gameLayout: null, // its position and width
  lighting: {}, // light of the first-person view (docs/037), over DEFAULT_LIGHTING
  audio: {}, // sounds (docs/041), over DEFAULT_AUDIO
  animation: {}, // animated moves (docs/062), over DEFAULT_ANIMATION
});
if (!RENDERERS[prefs.renderer]) prefs.renderer = 'dom';
view.classList.toggle('hide-rulers', !prefs.showRulers);
prefs.level = Math.min(Math.max(0, prefs.level), dungeon.levelCount - 1);

let renderer = null;
let mounting = null; // pending async creation, to ignore keys meanwhile
let panel = null; // control panel, rebuilt for each renderer
let selection = null; // selected tile { level, x, y }: its logic links are drawn
const logic = buildLogic(dungeon);
const texts = buildTexts(dungeon);

// Right-hand column: control panel (per renderer) above the inventory (persistent).
const side = document.createElement('div');
side.className = 'side-panels';
const controlsSlot = document.createElement('div');
side.append(controlsSlot);
viewWrap.append(side);

const tooltip = createTooltip();
const tileMenu = createContextMenu();
const creatureTypes = new Map(Object.keys(dungeon.data.catalog.creature).map((type) => [gameText.creature(type), Number(type)]));
const inventory = createInventoryPanel(side, buildInventory(dungeon), {
  levelCount: dungeon.levelCount,
  creatureType: (name) => creatureTypes.get(name),
  onLocate: locate,
  open: prefs.inventoryOpen,
  onToggle: (open) => {
    prefs.inventoryOpen = open;
    savePreferences(prefs);
  },
});

const textsPanel = createTextsPanel(side, texts, {
  onLocate: (entry) => locate({ name: entry.champion?.name ?? entry.text.split('\n')[0], level: entry.level, x: entry.x, y: entry.y, inside: entry.inside }),
  open: prefs.textsOpen,
  onToggle: (open) => {
    prefs.textsOpen = open;
    savePreferences(prefs);
  },
});

const layers = () => ({
  items: prefs.showItems,
  creatures: prefs.showCreatures,
  mechanisms: prefs.showMechanisms,
  texts: prefs.showTexts,
});

async function mountRenderer() {
  const level = renderer?.currentLevel ?? prefs.level;
  renderer?.dispose();
  renderer = null;
  panel?.dispose();
  panel = null;
  const id = prefs.renderer;
  view.dataset.renderer = id;
  status.textContent = t('renderer.loading', { name: RENDERERS[id].label });
  mounting = (async () => {
    try {
      return await RENDERERS[id].create(view, dungeon, {
        frame: prefs.frame,
        showStates: prefs.showStates,
        layers: layers(),
        settings: prefs.settings?.[id],
        onHover: showHover,
        onInfo: showInfo,
        onRequestLevel: showLevel,
        onStepLevel: go,
        onSettingsChange: saveRendererSettings,
        onSelect: select,
        onContextMenu: openTileMenu,
        onFollow: follow,
        tileAt: sim.state.tileAt, // tiles in their current state (simulation)
        contentsAt, // and the items lying there now
      });
    } catch (error) {
      console.error(error);
      status.textContent = t('renderer.unavailable', { name: RENDERERS[id].label, error: error.message });
      return null;
    }
  })();
  const created = await mounting;
  mounting = null;
  if (!created) {
    if (id !== 'dom') {
      // e.g. CDN unreachable for Three.js: fall back to 2D.
      prefs.renderer = 'dom';
      return mountRenderer();
    }
    return;
  }
  renderer = created;
  panel = createControlPanel(controlsSlot, panelSchema(), panelValues(), onPanelChange, {
    open: prefs.panelOpen,
    onToggle: (open) => {
      prefs.panelOpen = open;
      savePreferences(prefs);
    },
  });
  renderLegend(legend, id === 'ascii' ? 'ascii' : 'dom', { showStates: prefs.showStates });
  renderer.setParty?.(game ? sim.party : null);
  showLevel(game ? sim.party.level : level);
  if (!renderer.zoom) setCell(prefs.cell);
}

function showLevel(level) {
  renderer.showLevel(level);
  prefs.level = level;
  savePreferences(prefs);
  const m = dungeon.level(level);
  const frameLabel = RENDERERS[prefs.renderer].frameless ? '' : `, ${t(`frame.${prefs.frame}`)}`;
  label.textContent =
    t('level.header', { level, last: dungeon.levelCount - 1, width: m.width, height: m.height, x: m.offset.x, y: m.offset.y }) +
    ` — ${RENDERERS[prefs.renderer].label}${frameLabel}`;
  if (selection && selection.level !== level) selection = null;
  refreshLinks();
  showHover(null);
  panel?.refresh();
  // 2D/ASCII in the local frame: re-fit the zoom to the new level (the 3D renderer has its own setting).
  if (!renderer.zoom && prefs.frame === 'local' && prefs.autoFit) setCell(null);
}

// --- Logic: selection and links ---------------------------------------------------
// Drawn links: every link of the level ("Tous les liens"), or those of the selection.
function refreshLinks() {
  if (!renderer?.showLinks) return;
  let links = [];
  if (prefs.allLinks && prefs.showMechanisms) links = logic.linksOfLevel(renderer.currentLevel);
  else if (selection) links = [...logic.outgoing(selection.level, selection.x, selection.y), ...logic.incoming(selection.level, selection.x, selection.y)];
  renderer.showLinks(links, selection);
}

function select(info, { navigate = true } = {}) {
  // Clicking stairs takes to the other end, as the labels of teleporters do.
  if (navigate && info.type === 'stairs') {
    const to = stairsTarget(info);
    if (to) return follow(to);
  }
  const same = selection && selection.level === info.level && selection.x === info.x && selection.y === info.y;
  selection = same ? null : { level: info.level, x: info.x, y: info.y };
  refreshLinks();
  if (!selection) return showInfo(t('select.cancelled'));
  const out = logic.outgoing(info.level, info.x, info.y).length;
  const into = logic.incoming(info.level, info.x, info.y).length;
  showInfo(t('select.info', { level: info.level, x: info.x, y: info.y, type: tileName(info.type), out, into }));
}

// Cross-level link label clicked: go to the other end and select it.
function follow(to) {
  showLevel(to.level);
  select({ ...to, type: dungeon.tileAt(to.level, to.x, to.y)?.type ?? '?' }, { navigate: false });
  renderer.highlightTile?.(to.x, to.y);
}

// Other end of a staircase: same global coordinates on the level above or below.
function stairsTarget(info) {
  const level = info.level + (info.detail.direction === 'up' ? -1 : 1);
  const map = dungeon.level(level);
  if (!map) return null;
  return { level, x: info.gx - map.offset.x, y: info.gy - map.offset.y };
}

// Tooltip lines for the texts of a tile: inscription / message in full, champion sheet decoded.
function textLines(info) {
  if (!prefs.showTexts) return [];
  return textsAt(texts, info.level, info.x, info.y).map((entry) => {
    if (entry.champion) {
      return { color: TEXT_COLORS.champion, title: t('tooltip.champion', { name: entry.champion.name, title: entry.champion.title }), details: championSummary(entry.champion) };
    }
    const face = entry.onWall ? ` (${FACE_LABELS[entry.position]})` : '';
    const title = t(entry.kind === 'message' ? 'tooltip.message' : 'tooltip.inscription', { face });
    return { color: TEXT_COLORS[entry.kind], title, details: entry.text.split('\n') };
  });
}

// Tooltip lines for the actuators and teleporter of a tile.
function mechanismLines(info) {
  if (!prefs.showMechanisms) return [];
  const lines = logic.actuatorsAt(info.level, info.x, info.y).map((a) => ({
    color: FAMILY_COLORS[actuatorFamily(a)],
    ...describeActuator(dungeon, a),
  }));
  const teleporter = logic.teleporterAt(info.level, info.x, info.y);
  if (teleporter) lines.push({ color: TELEPORTER_COLORS[teleporter.scope], ...describeTeleporter(dungeon, teleporter) });
  const into = logic.incoming(info.level, info.x, info.y);
  if (into.length) {
    const sources = into.map((l) => (l.from.level === info.level ? `(${l.from.x}, ${l.from.y})` : `${t('level.short', { level: l.from.level })} (${l.from.x}, ${l.from.y})`));
    lines.push({ color: '#ffffff', title: t('tooltip.triggeredBy', { count: into.length }), details: [sources.slice(0, 6).join(' · ') + (sources.length > 6 ? ' …' : '')] });
  }
  return lines;
}

function showHover(info) {
  if (!info) {
    status.textContent = ' ';
    tooltip.hide();
    return;
  }
  const text = tileSummary(info);
  status.textContent = text;
  if (renderer?.setLayers) {
    const contents = contentsAt(info.level, info.x, info.y); // items lying there now
    // The tooltip title repeats the status bar, so it is useful even on an empty tile.
    tooltip.show(text, contents, {
      ...layers(),
      onWall: info.type === 'wall',
      mechanisms: [...textLines(info), ...mechanismLines(info)],
      always: prefs.alwaysTooltip,
    });
  }
}

const tileName = (type) => t(`tile.${type}`);

// One-line description of a tile (status bar, tooltip title).
function tileSummary(info) {
  let text = t('tile.summary', { level: info.level, x: info.x, y: info.y, gx: info.gx, gy: info.gy, type: tileName(info.type) });
  if (info.type === 'stairs') text += ` ${info.detail.direction === 'up' ? '↑' : '↓'} ${t('tile.stairsTo', { level: info.level + (info.detail.direction === 'up' ? -1 : 1) })}`;
  if (info.type === 'door' || info.type === 'stairs') text += ` · ${t('tile.axis', { axis: info.detail.orientation })}`;
  const state = prefs.showStates && info.detail ? describeState(info.type, info.detail) : null;
  if (state) text += ` · ${state}`;
  return text;
}

function showInfo(text) {
  status.textContent = text;
}

// A message for the player (in-game): in the message area of the game window, as in DM,
// and in the status bar.
function say(text) {
  showInfo(text);
  game?.window.message(text);
}

// Zoom for the CSS renderers: --cell drives the tile size (2D) and the font size (ASCII).
function fitCell() {
  const b = dungeon.bounds;
  const map = dungeon.level(renderer?.currentLevel ?? prefs.level);
  // The 2D view adds rulers (one or two tracks, about a tile each) on the left and top.
  const rulers = prefs.renderer === 'dom' && prefs.showRulers ? (prefs.frame === 'global' ? 2 : 1) : 0;
  const cols = (prefs.frame === 'global' ? b.maxX - b.minX : map.width) + rulers;
  const rows = (prefs.frame === 'global' ? b.maxY - b.minY : map.height) + rulers;
  // The right-hand panels overlay the view: keep the map beside them.
  const width = view.clientWidth - 32 - side.offsetWidth - 12;
  const size = Math.floor(Math.min(width / cols, (view.clientHeight - 32) / rows));
  return Math.min(MAX_CELL, Math.max(MIN_CELL, size));
}

function setCell(size) {
  prefs.cell = size === null ? null : Math.min(MAX_CELL, Math.max(MIN_CELL, size));
  view.style.setProperty('--cell', `${prefs.cell ?? fitCell()}px`);
  savePreferences(prefs);
}

const currentCell = () => Number.parseFloat(view.style.getPropertyValue('--cell')) || fitCell();
const zoom = (step) => (renderer.zoom ? renderer.zoom(step) : setCell(currentCell() + 2 * step));
const resetZoom = () => (renderer.resetView ? renderer.resetView() : setCell(null));

const go = (delta) => {
  const next = Math.min(dungeon.levelCount - 1, Math.max(0, renderer.currentLevel + delta));
  if (next !== renderer.currentLevel) showLevel(next);
};

function nextRenderer() {
  const ids = Object.keys(RENDERERS).filter((id) => !RENDERERS[id].hidden);
  prefs.renderer = ids[(ids.indexOf(prefs.renderer) + 1) % ids.length];
  mountRenderer();
}

function setShowStates(enabled) {
  // ASCII renders types only: no states there.
  if (!renderer.setShowStates) return;
  prefs.showStates = enabled;
  savePreferences(prefs);
  renderer.setShowStates(enabled);
  renderLegend(legend, prefs.renderer, { showStates: enabled });
  panel?.setValues({ showStates: enabled });
  showInfo(t('common.labelled', { label: t('panel.states'), value: t(enabled ? 'common.shown' : 'common.hidden') }));
}

// Settings changed by the renderer itself (e.g. the 3D display mode, key F).
function saveRendererSettings(settings) {
  prefs.settings = { ...prefs.settings, [prefs.renderer]: settings };
  savePreferences(prefs);
}

// Settings of the active renderer, saved per renderer id (prefs.settings.three…).
function changeSettings(changes) {
  if (!renderer?.applySettings) return;
  renderer.applySettings(changes);
  prefs.settings = { ...prefs.settings, [prefs.renderer]: renderer.settings };
  savePreferences(prefs);
  panel?.setValues(changes);
}

function setLayer(key, enabled) {
  if (!renderer.setLayers) return;
  prefs[key] = enabled;
  savePreferences(prefs);
  renderer.setLayers(layers());
  panel?.setValues({ [key]: enabled });
  refreshLinks();
  const names = { showItems: t('panel.items'), showCreatures: t('panel.creatures'), showMechanisms: t('panel.mechanisms'), showTexts: t('panel.texts') };
  showInfo(t('common.labelled', { label: names[key], value: t(enabled ? 'common.shown' : 'common.hidden') }));
}

function setAllLinks(enabled) {
  prefs.allLinks = enabled;
  savePreferences(prefs);
  refreshLinks();
  panel?.setValues({ allLinks: enabled });
  showInfo(t('common.labelled', { label: t('status.allLinks'), value: t(enabled ? 'common.shown' : 'status.selectionOnly') }));
}

// Inventory click: go to the level and point at the tile.
function locate(entry) {
  if (!renderer) return;
  showLevel(entry.level);
  renderer.highlightTile?.(entry.x, entry.y);
  showInfo(`${entry.name} — ${t('common.levelAt', { level: entry.level, x: entry.x, y: entry.y })}${entry.inside ? `, ${t('common.inside', { name: entry.inside })}` : ''}`);
}

function setFrame(global) {
  if (RENDERERS[prefs.renderer].frameless) return;
  prefs.frame = global ? 'global' : 'local';
  mountRenderer(); // the panel is rebuilt with the new value
}

// --- Control panel -------------------------------------------------------------
// Light of the first-person view (docs/037): kept in the preferences, applied at once.
// Only the current settings are kept (older ones of the saved preferences are dropped).
const knownLighting = (values) => Object.fromEntries(Object.entries(values ?? {}).filter(([key]) => key in DEFAULT_LIGHTING));
const lighting = () => ({ ...DEFAULT_LIGHTING, ...knownLighting(prefs.lighting) });
const LIGHTING_SCHEMA = [
  { type: 'heading', label: t('panel.lightHeading') },
  { type: 'range', key: 'intensity', label: t('panel.intensity'), min: 0.1, max: 10, step: 0.1, format: (v) => v.toFixed(1) },
  { type: 'range', key: 'distance', label: t('panel.range'), min: 1, max: 6, step: 0.1, format: (v) => t('panel.tiles', { count: v.toFixed(1) }) },
  { type: 'range', key: 'decay', label: t('panel.decay'), min: 0, max: 10, step: 0.1, format: (v) => v.toFixed(1) },
  { type: 'checkbox', key: 'permanentLight', label: t('panel.permanentLight') },
  { type: 'checkbox', key: 'torchHolders', label: t('panel.torchHolders') },
  { type: 'checkbox', key: 'occlusion', label: t('panel.occlusion') },
  { type: 'heading', label: t('panel.decorHeading') },
  { type: 'checkbox', key: 'ornamentModels', label: t('panel.ornamentModels') },
  { type: 'checkbox', key: 'creatureSprites', label: t('panel.creatureSprites') },
];
// Sounds (docs/041): kept in the preferences as the light.
const knownAudio = (values) => Object.fromEntries(Object.entries(values ?? {}).filter(([key]) => key in DEFAULT_AUDIO));
const audioSettings = () => ({ ...DEFAULT_AUDIO, ...knownAudio(prefs.audio) });
const AUDIO_SCHEMA = [
  { type: 'heading', label: t('panel.soundHeading') },
  { type: 'checkbox', key: 'soundEnabled', label: t('panel.soundEnabled') },
  { type: 'range', key: 'soundVolume', label: t('panel.volume'), min: 0, max: 1, step: 0.05, format: (v) => `${Math.round(v * 100)} %` },
  { type: 'range', key: 'soundRange', label: t('panel.range'), min: 2, max: 16, step: 1, format: (v) => t('panel.tiles', { count: v }) },
];
// Animated moves (docs/062): kept in the preferences as the light, read at each move.
const knownAnimation = (values) => Object.fromEntries(Object.entries(values ?? {}).filter(([key]) => key in DEFAULT_ANIMATION));
const animation = () => ({ ...DEFAULT_ANIMATION, ...knownAnimation(prefs.animation) });
const ANIMATION_SCHEMA = [
  { type: 'heading', label: t('panel.movesHeading') },
  { type: 'checkbox', key: 'smoothMoves', label: t('panel.smoothMoves') },
  { type: 'range', key: 'stepMs', label: t('panel.stepDuration'), min: 100, max: 440, step: 20, format: (v) => `${v} ms` },
  { type: 'range', key: 'turnMs', label: t('panel.turnDuration'), min: 80, max: 400, step: 20, format: (v) => `${v} ms` },
];
function changeAnimation(changes) {
  prefs.animation = { ...knownAnimation(prefs.animation), ...changes };
  savePreferences(prefs);
}
function changeAudio(changes) {
  prefs.audio = { ...knownAudio(prefs.audio), ...changes };
  savePreferences(prefs);
  audio.setSettings(changes);
}
function changeLighting(changes) {
  prefs.lighting = { ...knownLighting(prefs.lighting), ...changes };
  savePreferences(prefs);
  game?.view.setLighting(changes);
}

// Common controls first, then the renderer's own settings.
function panelSchema() {
  const schema = [
    {
      type: 'buttons',
      items: [
        { label: `▲ ${t('panel.up')}`, title: t('panel.upTitle'), action: () => go(-1), disabled: () => renderer.currentLevel === 0 },
        { label: `▼ ${t('panel.down')}`, title: t('panel.downTitle'), action: () => go(+1), disabled: () => renderer.currentLevel === dungeon.levelCount - 1 },
        { label: `▶ ${t('panel.game')}`, title: t('panel.gameTitle'), action: () => (game ? closeGame() : openGame()) },
        {
          type: 'select',
          title: t('panel.levelTitle'),
          options: dungeon.levels.map((_, i) => ({ value: i, label: t('common.level', { level: i }) })),
          value: () => renderer.currentLevel,
          onChange: (value) => showLevel(Number(value)),
        },
      ],
    },
  ];
  if (renderer.setShowStates) schema.push({ type: 'checkbox', key: 'showStates', label: t('panel.states'), shortcut: 'V' });
  if (renderer.setLayers) {
    schema.push({ type: 'checkbox', key: 'showItems', label: t('panel.items'), shortcut: 'O' });
    schema.push({ type: 'checkbox', key: 'showCreatures', label: t('panel.creatures'), shortcut: 'C' });
    schema.push({ type: 'checkbox', key: 'showMechanisms', label: t('panel.mechanisms'), shortcut: 'K' });
    schema.push({ type: 'checkbox', key: 'showTexts', label: t('panel.texts'), shortcut: 'X' });
    schema.push({ type: 'checkbox', key: 'allLinks', label: t('panel.allLinks'), shortcut: 'T' });
  }
  if (renderer.setLayers) schema.push({ type: 'checkbox', key: 'alwaysTooltip', label: t('panel.alwaysTooltip') });
  if (!RENDERERS[prefs.renderer].frameless) {
    schema.push({ type: 'checkbox', key: 'frameGlobal', label: t('panel.frameGlobal'), shortcut: 'G' });
    schema.push({ type: 'checkbox', key: 'autoFit', label: t('panel.autoFit') });
  }
  if (prefs.renderer === 'dom') schema.push({ type: 'checkbox', key: 'showRulers', label: t('panel.rulers') });
  schema.push({ type: 'checkbox', key: 'invincible', label: t('panel.invincible') });
  return [
    ...schema,
    ...(renderer.settingsSchema ?? []),
    ...ANIMATION_SCHEMA,
    ...LIGHTING_SCHEMA,
    ...AUDIO_SCHEMA,
    { type: 'buttons', items: [{ label: t('panel.defaults'), title: t('panel.defaultsTitle'), action: resetPanel }] },
  ];
}

const panelValues = () => ({
  showStates: prefs.showStates,
  showItems: prefs.showItems,
  showCreatures: prefs.showCreatures,
  showMechanisms: prefs.showMechanisms,
  showTexts: prefs.showTexts,
  allLinks: prefs.allLinks,
  frameGlobal: prefs.frame === 'global',
  alwaysTooltip: prefs.alwaysTooltip,
  autoFit: prefs.autoFit,
  showRulers: prefs.showRulers,
  invincible: prefs.invincible,
  ...renderer.settings,
  ...lighting(),
  ...audioSettings(),
  ...animation(),
});

function onPanelChange(allChanges) {
  const lightingChanges = Object.fromEntries(Object.entries(allChanges).filter(([key]) => key in DEFAULT_LIGHTING));
  if (Object.keys(lightingChanges).length) changeLighting(lightingChanges);
  const audioChanges = Object.fromEntries(Object.entries(allChanges).filter(([key]) => key in DEFAULT_AUDIO));
  if (Object.keys(audioChanges).length) changeAudio(audioChanges);
  const animationChanges = Object.fromEntries(Object.entries(allChanges).filter(([key]) => key in DEFAULT_ANIMATION));
  if (Object.keys(animationChanges).length) changeAnimation(animationChanges);
  const changes = Object.fromEntries(Object.entries(allChanges).filter(([key]) => !(key in DEFAULT_LIGHTING) && !(key in DEFAULT_AUDIO) && !(key in DEFAULT_ANIMATION)));
  const { showStates, showItems, showCreatures, showMechanisms, showTexts, allLinks, frameGlobal, alwaysTooltip, autoFit, showRulers, invincible, ...settings } = changes;
  // Simple viewer preferences (no immediate effect beyond the next hover / level change).
  for (const [key, value] of Object.entries({ alwaysTooltip, autoFit })) {
    if (value === undefined) continue;
    prefs[key] = value;
    savePreferences(prefs);
    if (key === 'autoFit' && value && prefs.frame === 'local') setCell(null);
  }
  if (showRulers !== undefined) {
    prefs.showRulers = showRulers;
    savePreferences(prefs);
    view.classList.toggle('hide-rulers', !showRulers);
    if (prefs.cell === null) setCell(null);
  }
  if (invincible !== undefined) {
    prefs.invincible = invincible;
    savePreferences(prefs);
    sim.invincible = invincible;
  }
  if (showStates !== undefined) setShowStates(showStates);
  if (showItems !== undefined) setLayer('showItems', showItems);
  if (showCreatures !== undefined) setLayer('showCreatures', showCreatures);
  if (showMechanisms !== undefined) setLayer('showMechanisms', showMechanisms);
  if (showTexts !== undefined) setLayer('showTexts', showTexts);
  if (allLinks !== undefined) setAllLinks(allLinks);
  if (frameGlobal !== undefined) setFrame(frameGlobal);
  if (Object.keys(settings).length) changeSettings(settings);
}

// "Valeurs par défaut": every value of the panel (viewer, every renderer, moves, light, sounds),
// and the position and size of the game window.
function resetPanel() {
  Object.assign(prefs, PANEL_DEFAULTS, { settings: {}, lighting: {}, audio: {}, animation: {}, gameLayout: null });
  savePreferences(prefs);
  view.classList.toggle('hide-rulers', !prefs.showRulers);
  sim.invincible = prefs.invincible;
  game?.window.resetLayout();
  game?.view.setLighting(DEFAULT_LIGHTING);
  audio.setSettings(DEFAULT_AUDIO);
  // The renderer is rebuilt with its default settings (and the frame), the panel with it.
  mountRenderer().then(() => showInfo(t('status.panelReset')));
}

// Key -> toggle of a renderer checkbox setting declaring that shortcut (L, E in 3D).
function settingShortcut(key) {
  const field = renderer.settingsSchema?.find((f) => f.type === 'checkbox' && f.shortcut?.toLowerCase() === key);
  if (!field) return undefined;
  return () => {
    const enabled = !renderer.settings[field.key];
    changeSettings({ [field.key]: enabled });
    showInfo(t('common.labelled', { label: field.label, value: t(enabled ? 'common.yes' : 'common.no') }));
  };
}

const GLOBAL_KEYS = {
  PageDown: () => go(+1),
  PageUp: () => go(-1),
  Home: () => showLevel(0),
  End: () => showLevel(dungeon.levelCount - 1),
  r: nextRenderer,
  g: () => setFrame(prefs.frame !== 'global'),
  v: () => setShowStates(!prefs.showStates), // S moves the party (simulation)
  o: () => setLayer('showItems', !prefs.showItems),
  c: () => setLayer('showCreatures', !prefs.showCreatures),
  k: () => setLayer('showMechanisms', !prefs.showMechanisms), // M: 3D display mode
  t: () => setAllLinks(!prefs.allLinks),
  Escape: () => selection && select(selection),
  i: () => inventory.toggle(),
  j: () => textsPanel.toggle(),
  x: () => setLayer('showTexts', !prefs.showTexts),
  '+': () => zoom(+1),
  '=': () => zoom(+1),
  '-': () => zoom(-1),
  0: resetZoom,
  p: () => (game ? closeGame() : openGame()),
  f: teleportToSelection,
};

const shortcutsButton = document.getElementById('shortcuts-button');
const shortcuts = createShortcutsModal(document.body, shortcutsButton);
createLanguageSelect(shortcutsButton);

bindKeys((key, event) => {
  // The modal keeps the keyboard: nothing moves behind it. Escape is closed natively by <dialog>.
  if (shortcuts.isOpen()) return key.toLowerCase() === 'h' ? shortcuts.toggle : undefined;
  if (key.toLowerCase() === 'h') return shortcuts.toggle;
  if (mounting || !renderer) return undefined;
  // In the game, movement keys (by physical key) come first.
  const move = game && moveKey(event);
  if (move) return move;
  const k = key.length === 1 ? key.toLowerCase() : key;
  return renderer.keys?.[k] ?? settingShortcut(k) ?? GLOBAL_KEYS[k];
});
window.addEventListener('resize', () => renderer && !renderer.zoom && prefs.cell === null && setCell(null));

// --- Simulation (docs/012-simulation.md) -------------------------------------------
// One simulation shared by every view: the first-person window, and the party
// marker of the 2D/3D renderers, whose shown level follows the party.
const sim = createSimulation(dungeon);
sim.invincible = prefs.invincible;
// Duration of a game tick (actuator delays are in ticks): DM's game loop advances every 11
// vertical blanks (ReDMCSB MAIN.C), 220 ms on a 50 Hz PAL screen, as the Amiga 3.6 of our sounds (docs/047).
const TICK_MS = (11 * 1000) / 50;
// Sounds of the simulation (docs/041): the files of DM Amiga 3.6, in assets/sounds/.
const audio = createAudio({ base: 'assets/sounds/', party: () => sim.party, tickMs: TICK_MS, settings: audioSettings() });
sim.on('sound', audio.request);
const TURNS = new Set(['turnLeft', 'turnRight']);
const BUMP_SHARE = 0.6; // of the duration of a step
// Duration of the animation of a move, in ms; 0: instant (docs/062).
function moveDuration(command) {
  const { smoothMoves, stepMs, turnMs } = animation();
  return smoothMoves ? (TURNS.has(command) ? turnMs : stepMs) : 0;
}
const moveKey = createControls((command) => sim.command(command), moveDuration);
let game = null; // { window, view, panel } while the game window is open
let opening = false;

async function openGame() {
  if (game || opening) return;
  opening = true;
  const win = createGameWindow({
    layout: prefs.gameLayout ?? undefined,
    onLayoutChange: (layout) => {
      prefs.gameLayout = layout;
      savePreferences(prefs);
    },
    onClose: closeGame,
    onReset: () => sim.reset(),
    // Inventory: a click takes the item in hand (the one held goes back); "Ranger" stows the hand.
    onSelectItem: (i) => sim.takeFromInventory(i),
    onStow: () => sim.stow(),
    onMouth: drink,
  });
  try {
    const { createFirstPersonRenderer } = await import('./render/first-person/fp-renderer.js');
    const view = createFirstPersonRenderer(win.viewport, dungeon, sim.state, {
      onClickFront: clickFront,
      onClickFloor: clickFloor,
      onClickElsewhere: throwHeld,
      onContextMenu: () => sim.hand && sim.stow(), // right click: shortcut of "Ranger"
      colorOf: (item) => CATEGORY_COLORS[item.kind],
      canReach: ({ level, x, y, position, item }) => sim.reachable(level, x, y, position) && Boolean(item || sim.hand),
      // Next to the pointer: the item in hand, or else the item pointed at.
      // The item in hand comes with its details (docs/034): a scroll's text, a potion's power…
      labelOf: (t) => (sim.hand ? itemTooltip(sim.hand) : t?.spot?.item ? itemName(t.spot.item) : null),
      contentsAt,
      lighting: lighting(),
    });
    const panel = createChampionPanel(win.viewport, {
      onAction: doAction,
      onHand: (i) => sim.swapHand(i),
      onRestart: () => sim.reset(),
    });
    const spells = createSpellPanel(win.viewport, {
      onSymbol: (i) => sim.addSymbol(i),
      onDelete: () => sim.deleteSymbol(),
      onCast: () => sim.castSpell(),
    });
    game = { window: win, view, panel, spells };
    view.setLight(sim.light);
    showInventory();
    game.clock = setInterval(() => {
      audio.tick(() => sim.tick());
      game.panel.setReady(sim.fatigue === 0);
    }, TICK_MS);
  } catch (error) {
    console.error(error);
    win.dispose();
    showInfo(t('game.unavailable', { error: error.message }));
    return;
  } finally {
    opening = false;
  }
  prefs.playing = true;
  savePreferences(prefs);
  showParty(sim.party);
}

function closeGame() {
  if (!game) return;
  clearInterval(game.clock);
  moveKey.stop();
  game.panel.dispose();
  game.spells.dispose();
  game.view.dispose();
  game.window.dispose();
  game = null;
  prefs.playing = false;
  savePreferences(prefs);
  renderer?.setParty?.(null);
}

// F: the party jumps to the selected tile (to test a place directly), facing unchanged.
function teleportToSelection() {
  if (!selection) return showInfo(t('status.selectFirst'));
  return teleportTo(selection);
}
async function teleportTo(target) {
  if (!game) await openGame();
  const blocked = sim.teleport(target.level, target.x, target.y);
  if (blocked) return showInfo(t('status.teleportBlocked', { reason: BLOCK_LABELS[blocked] }));
  // The party is there: the selection has done its job.
  if (selection) select(selection);
}

// Right click on a tile of the 2D/3D maps: test tools on that tile.
function openTileMenu(info, event) {
  tooltip.hide();
  const { level, x, y } = info;
  const items = sim.state.itemsAt(level, x, y).length;
  const actuators = sim.state.actuatorsAt(level, x, y).length;
  tileMenu.show(event.clientX, event.clientY, `${t('common.levelAt', { level, x, y })} · ${tileName(info.type)}`, [
    { label: t('menu.teleport'), action: () => teleportTo(info) },
    { label: t('menu.collect', { count: items }), disabled: !items, action: () => collectItems(info) },
    { label: t('menu.fire', { count: actuators }), disabled: !actuators, action: () => fireActuators(info) },
  ]);
}
function collectItems({ level, x, y }) {
  const count = sim.collectAll(level, x, y);
  showInfo(t('menu.collected', { count }));
}
function fireActuators({ level, x, y }) {
  const fired = sim.fireAll(level, x, y);
  showInfo(fired ? t('menu.fired', { count: fired }) : t('menu.noneActive'));
}

// Click on the wall or door in front of the party (mouse in the view, or Space); on a
// creature in front, the item held by the cursor is thrown at it, or else the champion
// strikes it with the first melee action of his action hand (docs/044). On a door, the item
// held is thrown: it falls in front of the leaf, which it may break (ReDMCSB F375, docs/051).
// `kind`: what the pointer designates in the view ('front': the wall or the door, even with a
// creature under it; 'creature'); from the keyboard (none), a creature in front comes first.
function clickFront(side = 'right', kind = null) {
  const [dx, dy] = SIDE_DELTAS[sim.party.facing];
  if (kind !== 'front' && sim.state.groupAt(sim.party.level, sim.party.x + dx, sim.party.y + dy)) {
    if (sim.hand) return throwHeld(side);
    const melee = sim.actions.find((a) => a.kind === 'melee');
    return melee ? doAction(melee.index) : say(t('action.noMelee'));
  }
  if (sim.hand && sim.state.tileAt(sim.party.level, sim.party.x + dx, sim.party.y + dy)?.type === 'door') return throwHeld(side);
  const { target, fired, took, placed, filled } = sim.clickFront();
  if (filled) say(filled === 'waterskin' ? t('fountain.waterskin') : t('fountain.flask', { item: gameText.item('Water Flask') }));
  else if (took) say(t('action.taken', { item: itemName(sim.hand) }));
  else if (placed) say(t('action.placed'));
  else if (!fired) say(t(target === 'wall' || target === 'door' ? 'action.nothingHappens' : 'action.nothingInFront'));
}

// An action of the action hand (docs/044), by its index. What a strike or a shot does to a
// creature is shown by the 'creatureHit' handler; the action done is lit in the action panel
// (docs/057), the other results are written in the status bar.
function doAction(index) {
  const { result, item, action, broken, healed, group } = sim.act(index);
  game?.panel.setReady(sim.fatigue === 0); // disabled at once, not at the next tick
  if (!NOT_DONE.has(result)) game?.panel.showAction(index);
  if (result === 'noAmmo') game?.panel.showResult(gameText.misc('needAmmo'));
  const label = action ? gameText.action(action.index) : '';
  const words = {
    nothing: t(action?.kind === 'climb' ? 'action.noPit' : action?.kind === 'heal' ? 'action.nothingToHeal' : 'action.nothingToCast'),
    exhausted: t('action.exhausted'),
    pending: t('action.pending', { label }),
    thrown: t('action.thrown', { item: item && itemName(item) }),
    shot: t('action.shot', { item: item && itemName(item) }),
    noAmmo: t('action.noAmmo'),
    cast: label,
    light: t('action.light'),
    healed: t('action.healed', { name: championName(sim.champion), value: healed }),
    heads: gameText.misc('heads'),
    tails: gameText.misc('tails'),
    climbed: t('action.climbed'),
    done: label,
    nobody: t('action.nobody', { label }),
    frightened: group && t('action.frightened', { name: describeGroup(dungeon, group).name }),
    resisted: group && t('action.resisted', { name: describeGroup(dungeon, group).name }),
    doorHit: broken ? '' : t('action.doorHit'), // broken: see 'doorBroken'
    air: t('action.air'),
    wall: t('action.wall'),
    door: t('action.door'),
  }[result];
  if (words) say(words);
}
// The results of sim.act() where the action did not take place.
const NOT_DONE = new Set(['unavailable', 'dead', 'busy', 'exhausted', 'nothing', 'pending', 'noAmmo']);

// A click with an item held by the cursor, out of reach (or on a creature): it is thrown
// from that side of the view.
function throwHeld(side) {
  if (!sim.hand) return;
  const { result, item } = sim.throwHeld(side);
  game?.panel.setReady(sim.fatigue === 0);
  if (result === 'exhausted') say(t('action.exhausted'));
  else if (result === 'thrown') say(t('action.thrown', { item: itemName(item) }));
}

// The mouth (under the item in hand): the champion drinks what the cursor holds (docs/031, 050).
function drink() {
  if (!sim.hand) return;
  const result = sim.drink();
  if (result?.empty) say(t('drink.empty', { item: itemName(sim.hand) }));
  else if (!result) say(t('drink.notDrinkable', { item: itemName(sim.hand) }));
}

// The champion's box: bars, hands, actions of the action hand.
function showChampion() {
  const describe = (ref) => ref && { name: heldName(ref), color: CATEGORY_COLORS[ref.kind], details: itemTooltip(ref) };
  game?.panel.update(
    sim.champion,
    sim.hands.map(describe),
    sim.actions.map((a) => ({ id: a.index, name: gameText.action(a.index) })),
  );
  game?.spells.update(sim.champion, sim.knownSpells);
}

// Click on the floor, within reach (the 2 front sub-tiles of the party's tile and the 2 near
// ones of the tile in front): the item in hand is put there, or the item clicked comes in hand.
function clickFloor({ level, x, y, position, item }, side) {
  if (sim.hand) {
    if (!sim.drop(level, x, y, position)) throwHeld(side); // out of reach: thrown there
  } else if (item && !sim.pickUp(level, x, y, item)) {
    say(gameText.misc('tooFar'));
  }
}

// Contents of a tile for the views: items lying there now and creature group standing there (simulation).
const itemName = (ref) => describeItem(dungeon, ref).name;
// In the inventory and the hands: a waterskin with its state (docs/050).
const heldName = (ref) => {
  const { name, note } = describeItem(dungeon, ref);
  return isWaterskin(dungeon, ref) ? `${name} ${note}` : name;
};
// Name and details of an item, one per line (docs/034).
const itemTooltip = (ref) => [itemName(ref), ...itemDetails(dungeon, ref)].join('\n');
// A chest stowed once has given its contents to the inventory: it is shown empty
// (dungeon.json keeps its list of contents).
function contentsAt(level, x, y) {
  const contents = tileContents(dungeon, level, x, y, sim.state.itemsAt(level, x, y), sim.state.groupAt(level, x, y));
  for (const item of contents?.items ?? []) {
    if (item.kind === 'container' && sim.state.emptiedChests.has(item.index)) item.contents = [];
  }
  return contents;
}

function showInventory() {
  const hand = sim.hand && { name: heldName(sim.hand), color: CATEGORY_COLORS[sim.hand.kind], details: itemTooltip(sim.hand) };
  game?.window.setInventory(
    sim.inventory.map((ref) => ({ name: heldName(ref), color: CATEGORY_COLORS[ref.kind], details: itemTooltip(ref) })),
    hand,
  );
  game?.view.setHandCursor(hand?.color ?? null);
  game?.view.refreshPointer();
  showChampion();
}

const FACING_LABELS = { N: gameText.misc('north'), E: gameText.misc('east'), S: gameText.misc('south'), W: gameText.misc('west') };

// Status line of the game window: where the party is, and the light (docs/032; drawn by the view since docs/035).
function showStatus() {
  const { level, x, y, facing } = sim.party;
  const { amount, palette, permanent, torches, magical } = sim.light;
  const sources = [...torches.map((torch) => t('light.torch', { charges: torch.charges })), ...(magical ? [t('light.magic', { value: magical })] : [])];
  const light = permanent ? t('light.permanent') : `${amount} (${t('light.palette', { value: palette })}${sources.length ? `, ${sources.join(', ')}` : ''})`;
  game?.window.setStatus(t('game.status', { level, x, y, facing: FACING_LABELS[facing], light }));
}

function showParty(party, duration = 0) {
  if (!game) return;
  game.view.setParty(party, duration);
  showStatus();
  if (!renderer) return; // being mounted: mountRenderer() places the party
  if (renderer.currentLevel !== party.level) showLevel(party.level);
  renderer.setParty?.(party);
}

// A turn or a plain step is animated; stairs, pits and teleporters cut at once (docs/061, Q2).
function partyMoveDuration({ party, from, kind, effects }) {
  if (kind === 'turn') return moveDuration('turnLeft');
  const plainStep = kind === 'step' && !effects?.length && party.level === from.level && Math.abs(party.x - from.x) + Math.abs(party.y - from.y) === 1;
  return plainStep ? moveDuration('forward') : 0;
}
sim.on('partyMoved', (event) => {
  const { party, effects, loop } = event;
  showParty(party, partyMoveDuration(event));
  if (!effects?.length) return;
  showInfo(effects.map(describeEffect).join(' · ') + (loop ? ` · ${t('effect.loop')}` : ''));
  if (effects.some((e) => e.type === 'fall')) game?.window.flash(); // fell through a pit, as a bump
});
sim.on('itemsMoved', ({ to, items }) => {
  showInfo(`${items.map(itemName).join(', ')} → ${t('common.levelAt', { level: to.level, x: to.x, y: to.y })}`);
});

// Status bar text of an arrival effect (stairs, pit, teleporter), see src/sim/rules.js.
function describeEffect({ type, direction, party, detail }) {
  const where = t('common.levelAt', { level: party.level, x: party.x, y: party.y });
  const facing = t('effect.facing', { facing: FACING_LABELS[party.facing] });
  if (type === 'stairs') return `${tileName('stairs')} ${direction === 'down' ? '↓' : '↑'} → ${where}`;
  if (type === 'fall') return `${t('effect.fall')} → ${where}`;
  const same = detail.at.map === party.level && detail.at.x === party.x && detail.at.y === party.y;
  return same ? `${tileName('teleporter')} : ${facing}` : `${tileName('teleporter')} → ${where}, ${facing}`;
}
sim.on('reset', ({ party }) => {
  moveKey.stop();
  showParty(party);
  game?.view.setProjectiles(party.level, []);
  showInventory();
  // Every tile may have changed: redraw the views.
  if (renderer) mountRenderer();
  for (let level = 0; level < dungeon.levelCount; level++) game?.view.updateTile(level);
});

// Items moved (picked up, dropped, taken by a lock): redraw the tile; the inventory changed.
sim.on('itemsChanged', ({ level, x, y }) => {
  game?.view.updateTile(level);
  renderer?.updateTile?.(level, x, y);
});
sim.on('inventoryChanged', () => showInventory());
sim.on('lightChanged', (light) => {
  game?.view.setLight(light);
  showStatus();
});
// A torch in hand lost a charge: its name in the hands and its note change.
sim.on('torchesWorn', ({ torches }) => {
  showInventory();
  if (torches.some((t) => !t.charges)) say(t('light.torchBurnt'));
});
sim.on('championChanged', showChampion);
// Spell area (docs/030): the line of symbols changed; a spell was cast (G1: recognised, no effect yet).
sim.on('symbolsChanged', ({ champion }) => game?.spells.update(champion, sim.knownSpells));
// A scroll held for the first time: its spells go into the grimoire (docs/034).
sim.on('grimoireChanged', ({ learned }) => {
  if (learned.length) say(t('spell.learned', { list: learned.map((s) => `${spellName(s)} (${s.symbols.map(symbolLabel).join(' ')})`).join(', ') }));
  game?.spells.update(sim.champion, sim.knownSpells);
});
sim.on('spellCast', ({ champion, spell, power, reason, item }) => {
  game?.panel.setReady(sim.fatigue === 0);
  const who = championName(champion);
  if (!spell) return say(`${champion.name} ${gameText.misc('mumbles')}`);
  // The spell is named only when the grimoire knows it (docs/034); else its symbols alone.
  const symbols = `${SYMBOLS[0][power - 1]} ${spell.symbols.map(symbolLabel).join(' ')}`;
  const words = sim.knownSpells.includes(spell) ? `${spellName(spell)} (${symbols})` : symbols;
  if (reason === 'needsFlask') return say(`${champion.name} ${gameText.misc('needsFlask')} (${symbols})`);
  if (reason === 'potion') return say(t('spell.castPotion', { name: who, words, item: itemName(item) }));
  say(t('spell.castName', { name: who, words }) + (reason === 'unimplemented' ? ` · ${t('common.notImplemented')}` : ''));
});
const championName = (champion) => champion.name[0] + champion.name.slice(1).toLowerCase();
const DRINK_EFFECTS = { health: t('common.hp'), stamina: gameText.misc('stamina'), mana: gameText.misc('mana'), water: t('drink.water') };
// Water (docs/050): the gauge of the champion follows, out of 2048 (no thirst yet).
const drinkEffect = (champion, effect, gained) =>
  !effect ? t('drink.noEffect') : `+${gained} ${DRINK_EFFECTS[effect]}${effect === 'water' ? ` (${champion.water} / 2048)` : ''}`;
sim.on('potionDrunk', ({ champion, name, effect, gained }) => say(t('drink.drinks', { name: championName(champion), item: gameText.item(name), effect: drinkEffect(champion, effect, gained) })));
// What a strike or a projectile did to a creature: the damage in the action area (not for a
// thrown item or a fireball, which land later and must not hide the actions, docs/057), a word in the status bar.
sim.on('creatureHit', ({ result, damage, group, killed, destroyed, thrown, spell }) => {
  if (!thrown && !spell) game?.panel.showResult(result === 'hit' ? String(damage) : t(result === 'immaterial' ? 'combat.noEffect' : 'combat.missed'));
  const { name } = describeGroup(dungeon, group);
  if (destroyed) say(t('combat.destroyed', { name }));
  else if (killed) say(t('combat.killed', { name }));
  else if (result === 'immaterial') say(t('combat.immaterial', { name }));
  else if (thrown) say(result === 'hit' ? t('combat.hit', { name, damage }) : t('combat.noDamage', { name }));
  else if (spell) say(t('combat.burnt', { name, damage }));
});
// A spell ends in the air: particles of its colour (docs/063).
sim.on('explosion', (event) => game?.view.spellBurst(event));
// A fireball broke a door (docs/033).
sim.on('doorBroken', ({ by }) => {
  say(t(`door.brokenBy.${by === 'melee' || by === 'thrown' ? by : 'fireball'}`));
  game?.window.flash();
});
sim.on('itemStolen', ({ group, item }) => say(t('combat.stolen', { name: describeGroup(dungeon, group).name, item: itemName(item) })));
sim.on('groupFled', ({ group, reason }) => reason === 'fear' && say(t('combat.fled', { name: describeGroup(dungeon, group).name })));
// Items in flight: redrawn in the first-person view once per frame.
let projectileFrame = 0;
sim.on('projectilesMoved', () => {
  projectileFrame ||= requestAnimationFrame(() => {
    projectileFrame = 0;
    game?.view.setProjectiles(sim.party.level, sim.projectilesOn(sim.party.level));
  });
});
sim.on('championHit', ({ result, damage }) => result === 'hit' && game?.panel.wounded(damage));
const deathCause = ({ group, spell, fall, wall }) =>
  group ? t('death.group', { name: describeGroup(dungeon, group).name }) : t(spell ? 'death.spell' : fall ? 'death.fall' : wall ? 'death.wall' : 'death.door');
sim.on('championDied', (event) => say(t('death.message', { name: event.champion.name, cause: deathCause(event) })));
sim.on('championHit', ({ door, spell, fall, damage }) => {
  if (door) say(t('door.closedOnParty', { damage }));
  if (fall) say(t('combat.fall', { damage }));
  if (spell) {
    say(t('combat.fireball', { damage }));
    game?.window.flash();
  }
});
sim.on('doorCrushed', ({ group, killed, destroyed }) => {
  const { name } = describeGroup(dungeon, group);
  say(destroyed ? t('door.crushedAll', { name }) : killed ? t('door.crushed', { name, count: killed }) : t('door.closedOn', { name }));
});

// Creatures moved: their tiles are redrawn in 2D, only the creature markers of their level
// in 3D and in the first person view; once per frame, as several move in the same tick.
const movedTiles = new Map(); // "level:x,y" -> { level, x, y }
let movedFrame = 0;
sim.on('creaturesMoved', ({ group, from, to, generated, killed, position }) => {
  if (killed) game?.view.creatureSmoke({ ...from, position, type: group.type });
  if (generated) {
    const { count, name } = describeGroup(dungeon, group);
    showInfo(t('status.generated', { count, name, x: to.x, y: to.y }));
  }
  for (const tile of [from, to]) if (tile) movedTiles.set(`${tile.level}:${tile.x},${tile.y}`, tile);
  movedFrame ||= requestAnimationFrame(redrawCreatures);
});
// A group noticed the party (C2): it comes after it.
sim.on('groupAlerted', ({ group, seen }) => {
  const { count, name } = describeGroup(dungeon, group);
  showInfo(t(seen ? 'status.seenBy' : 'status.foundBy', { count, name: count > 1 ? `${count} × ${name}` : name }));
});
function redrawCreatures() {
  movedFrame = 0;
  const levels = new Set();
  for (const { level, x, y } of movedTiles.values()) {
    levels.add(level);
    if (!renderer?.updateCreatures) renderer?.updateTile?.(level, x, y);
  }
  movedTiles.clear();
  for (const level of levels) {
    renderer?.updateCreatures?.(level);
    game?.view.updateCreatures(level);
  }
}

// A rotation changed the ornament shown on a wall face (lever, torch holder, alcove revealed).
sim.on('ornamentChanged', ({ level }) => game?.view.updateTile(level));

// A mechanism changed a tile: redraw it everywhere and say so.
const STATE_WORDS = {
  door: [t('tile.door'), t('state.open'), t('state.closed')],
  pit: [t('tile.pit'), t('state.open'), t('state.closed')],
  teleporter: [t('tile.teleporter'), t('state.enabled'), t('state.disabled')],
  fakewall: [t('tile.fakewall'), t('state.vanished'), t('state.returned')],
};
sim.on('tileChanged', ({ level, x, y, type, detail }) => {
  game?.view.updateTile(level);
  renderer?.updateTile?.(level, x, y);
  if (type === 'door' && detail.moving) return; // said once it has stopped
  const [name, open, closed] = STATE_WORDS[type];
  showInfo(`${name} — ${t('common.labelled', { label: t('common.levelAt', { level, x, y }), value: detail.broken ? t('state.broken') : detail.open ? open : closed })}`);
});
// Messages: a text on a wall appears (or vanishes) on its face; a text on the floor is printed.
sim.on('textChanged', ({ level, onWall }) => {
  if (onWall) game?.view.updateTile(level);
});
sim.on('textShown', ({ index }) => game?.window.message(dungeon.data.texts[index].text.replaceAll('\n', ' ')));
const BUMP_TURNS = { forward: 0, right: 1, back: 2, left: 3 }; // quarter turns from the facing
sim.on('blocked', ({ party, reason, command }) => {
  const duration = moveDuration(command);
  if (duration) game?.view.bump(FACINGS[(FACINGS.indexOf(party.facing) + BUMP_TURNS[command]) % 4], duration * BUMP_SHARE);
  game?.window.flash();
  showInfo(t('status.blocked', { reason: BLOCK_LABELS[reason] }));
});

mountRenderer();
if (prefs.playing) openGame();
