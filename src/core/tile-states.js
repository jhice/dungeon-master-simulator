// States of the tiles that have one: doors, pits and fake walls.
// Meaning of the flags (from the DM engine, consistent with the data):
//   door     open        the door is raised/open
//            step        simulation only: 0 = open … 4 = closed (DOOR_CLOSED), see below
//   pit      open        the pit is a hole (closed = covered, behaves as floor)
//            invisible   the game does not draw it (looks like floor)
//            imaginary   drawn but harmless (none in DM)
//   fakewall open        the wall has vanished (passable, not drawn)
//            imaginary   illusory wall: drawn but passable

import { t } from '../i18n/i18n.js';

// Doors move by steps, one per tick (ReDMCSB, TIMELINE.C, F241): 0 = open … 4 = closed.
// The party and projectiles pass while the door is closed by 1/4 at most; a creature,
// while it is closed no more than its height (vertical doors) or 1/4 (horizontal ones).
// dungeon.json only has `open`; the simulation adds `step`, and keeps `open` = step 0.
export const DOOR_CLOSED = 4;
export const doorStep = (detail) => detail.step ?? (detail.open ? 0 : DOOR_CLOSED);
/** Whether something of `height` (1 = the party, a projectile) passes the door. */
export const doorPassable = (detail, height = 1) => Boolean(detail.broken) || doorStep(detail) <= height;

/** State flags of a tile, or null for tiles without state. */
export function tileState(type, detail) {
  switch (type) {
    case 'door':
      return { open: detail.open };
    case 'pit':
      return { open: detail.open, invisible: detail.invisible, imaginary: detail.imaginary };
    case 'fakewall':
      return { open: detail.open, imaginary: detail.imaginary };
    default:
      return null;
  }
}

/** CSS-friendly modifiers: ['is-open'|'is-closed', 'is-invisible', 'is-imaginary']. */
export function stateModifiers(type, detail) {
  const state = tileState(type, detail);
  if (!state) return [];
  const modifiers = [state.open ? 'is-open' : 'is-closed'];
  if (state.invisible) modifiers.push('is-invisible');
  if (state.imaginary) modifiers.push('is-imaginary');
  return modifiers;
}

/** Human-readable state, for the status bar: e.g. "fermée, invisible". */
export function describeState(type, detail) {
  const state = tileState(type, detail);
  if (!state) return null;
  if (type === 'fakewall') {
    if (state.open) return t('state.fakewall.open');
    return t(state.imaginary ? 'state.fakewall.imaginary' : 'state.fakewall.closed');
  }
  if (type === 'door' && detail.broken) return t('state.door.broken');
  if (type === 'door' && doorStep(detail) > 0 && doorStep(detail) < DOOR_CLOSED) return t('state.door.step', { step: doorStep(detail), of: DOOR_CLOSED });
  const words = [t(state.open ? 'state.open' : 'state.closed')];
  if (state.invisible) words.push(t('state.invisible'));
  if (state.imaginary) words.push(t('state.imaginary'));
  return words.join(', ');
}
