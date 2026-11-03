// Dungeon logic as a graph: actuators (triggers, gates, generators…) and
// teleporters, with the links between tiles they create. Renderer-agnostic:
// renderers only receive the links to draw.

import { decodeItemId } from './item-ids.js';
import { t, gameText } from '../i18n/i18n.js';

// Families of actuators, for markers and colours.
export const FAMILY_LABELS = {
  floorTrigger: t('family.floorTrigger'),
  wallTrigger: t('family.wallTrigger'),
  logic: t('family.logic'),
  shooter: t('family.shooter'),
  generator: t('family.generator'),
  portrait: t('family.portrait'),
  inactive: t('family.inactive'),
};

export const ACTION_LABELS = {
  set: t('logic.action.set'),
  clear: t('logic.action.clear'),
  toggle: t('logic.action.toggle'),
  hold: t('logic.action.hold'),
};

export function actuatorFamily(a) {
  if (a.generator) return 'generator';
  if (a.kind === 'floor') return 'floorTrigger';
  if (a.type === 5 || a.type === 6) return 'logic';
  if (a.missile || [8, 9, 10].includes(a.type)) return 'shooter';
  if (a.type === 127) return 'portrait';
  if (a.type === 0) return 'inactive';
  return 'wallTrigger';
}

const SCOPE_LABELS = { all: t('logic.scope.all'), creatures: t('logic.scope.creatures'), items: t('logic.scope.items'), items_party: t('logic.scope.itemsParty') };

/** Short description of an actuator: { title, details: string[] }. */
export function describeActuator(dungeon, a) {
  const details = [];
  if (a.dataNote === 'item identifier') {
    const item = decodeItemId(dungeon, a.data);
    details.push(t('logic.expected', { item: gameText.item(item.name) }) + (item.certainty === 'confirmed' ? '' : ` (${t(`logic.certainty.${item.certainty}`)})`));
  } else if (a.generator) {
    const count = a.generator.isMax ? t('logic.upTo', { count: a.generator.count }) : `${a.generator.count}`;
    details.push(t('logic.generates', { count, name: gameText.creature(a.data) }));
  } else if (a.dataNote) {
    details.push(a.dataNote);
  }
  if (a.gate) {
    const bits = (b) => b.map((v) => (v ? 1 : 0)).join('');
    details.push(t('logic.gate', { current: bits(a.gate.current), reference: bits(a.gate.reference) }));
  }
  if (a.type === 6) details.push(t('logic.counter', { value: a.data }));
  if (a.missile) details.push(t('item.power', { power: a.missile.power }));
  if (a.remote) details.push(`→ ${ACTION_LABELS[a.action] ?? a.action} (${a.remote.x}, ${a.remote.y})`);
  if (a.local) details.push(t('logic.localAction', { name: a.local.name ?? a.local.action }));
  if (a.delay) details.push(t('logic.delay', { value: a.delay }));
  if (a.onceOnly) details.push(t('logic.once'));
  if (a.revert) details.push(t('logic.reverted'));
  return { title: a.typeName ?? `actuator ${a.type}`, details };
}

export function describeTeleporter(dungeon, teleporter) {
  const destMap = dungeon.level(teleporter.dest.map);
  const details = [
    t('logic.destination', { level: teleporter.dest.map, x: teleporter.dest.x, y: teleporter.dest.y }),
    t('logic.carries', { what: SCOPE_LABELS[teleporter.scope] ?? teleporter.scope }),
  ];
  if (teleporter.rotation || teleporter.rotationType === 'absolute') {
    details.push(teleporter.rotationType === 'absolute' ? t('logic.finalFacing', { dir: t(`dir.${teleporter.rotation / 90}`) }) : t('logic.rotation', { value: teleporter.rotation }));
  }
  if (teleporter.sound) details.push(t('logic.sound'));
  if (!destMap) details.push(t('logic.badDestination'));
  return { title: t('tile.teleporter'), details };
}

const keyOf = (level, x, y) => `${level}:${x},${y}`;

/**
 * Builds the logic graph once.
 * Link: { kind: 'actuator'|'teleporter', from: {level,x,y}, to: {level,x,y},
 *         action?, delay?, once?, family?, scope?, index }
 * @returns {{ links, outgoing(level,x,y), incoming(level,x,y), actuatorsAt(level,x,y), teleporterAt(level,x,y), linksOfLevel(level) }}
 */
export function buildLogic(dungeon) {
  const links = [];
  const out = new Map();
  const into = new Map();
  const actuatorsByTile = new Map();
  const teleporterByTile = new Map();
  const push = (map, key, value) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  };
  const addLink = (link) => {
    links.push(link);
    push(out, keyOf(link.from.level, link.from.x, link.from.y), link);
    push(into, keyOf(link.to.level, link.to.x, link.to.y), link);
  };

  dungeon.data.actuators.forEach((a, index) => {
    const from = { level: a.at.map, x: a.at.x, y: a.at.y };
    push(actuatorsByTile, keyOf(from.level, from.x, from.y), { ...a, index });
    if (!a.remote) return;
    addLink({
      kind: 'actuator',
      index,
      family: actuatorFamily(a),
      action: a.action,
      delay: a.delay,
      once: a.onceOnly,
      from,
      to: { level: a.at.map, x: a.remote.x, y: a.remote.y },
    });
  });

  dungeon.data.teleporters.forEach((t, index) => {
    const from = { level: t.at.map, x: t.at.x, y: t.at.y };
    teleporterByTile.set(keyOf(from.level, from.x, from.y), { ...t, index });
    addLink({ kind: 'teleporter', index, scope: t.scope, from, to: { level: t.dest.map, x: t.dest.x, y: t.dest.y } });
  });

  return {
    links,
    outgoing: (level, x, y) => out.get(keyOf(level, x, y)) ?? [],
    incoming: (level, x, y) => into.get(keyOf(level, x, y)) ?? [],
    actuatorsAt: (level, x, y) => actuatorsByTile.get(keyOf(level, x, y)) ?? [],
    teleporterAt: (level, x, y) => teleporterByTile.get(keyOf(level, x, y)) ?? null,
    linksOfLevel: (level) => links.filter((l) => l.from.level === level || l.to.level === level),
  };
}
