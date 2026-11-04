// Displayed movement between two logical positions of the simulation (docs/061): the simulation
// stays on its grid, and no rule ever reads what is here. An animation goes from one set of
// numbers to another ({ x, y, turns }…) and can be dropped at any time without any effect on the game.
// Without DOM nor Three.js: tested in Node (tools/test-motion.mjs).

const clamp01 = (t) => Math.min(Math.max(t, 0), 1);
const smoothstep = (t) => t * t * (3 - 2 * t);

export const EASE = {
  linear: (t) => t,
  smooth: smoothstep,
  // Half linear, half smoothstep: soft ends, but steps in a row do not pulse much.
  gentle: (t) => (t + smoothstep(t)) / 2,
  // There and back: ends where it started (a bump against a wall).
  bump: (t) => Math.sin(Math.PI * t),
};

/**
 * The value closest to `current` that means the facing `index` (0..3), in quarter turns:
 * a turn always takes the shortest way (N is 0 and also 4, after W, 3).
 */
export function nearestQuarter(current, index) {
  const delta = (((index - current + 2) % 4) + 4) % 4 - 2;
  return current + delta;
}

/** @param {() => number} [now] clock in milliseconds */
export function createMotion(now = () => performance.now()) {
  const moves = new Map(); // key -> { from, to, start, duration, ease }
  const rests = new Map(); // key -> values after its last animation

  function valuesAt(move, time) {
    const t = move.duration > 0 ? clamp01((time - move.start) / move.duration) : 1;
    const k = move.ease(t);
    return Object.fromEntries(Object.keys(move.to).map((name) => [name, move.from[name] + (move.to[name] - move.from[name]) * k]));
  }

  const motion = {
    /** Values of a key now, or null if it has none. A finished animation stays at its last values. */
    sample(key, time = now()) {
      const move = moves.get(key);
      if (!move) return rests.get(key) ?? null;
      if (time < move.start + move.duration) return valuesAt(move, time);
      const rest = valuesAt(move, Infinity);
      moves.delete(key);
      rests.set(key, rest);
      return rest;
    },
    /**
     * Animates a key towards `to`, from `from` or else from where it is shown now (so that an
     * animation not finished goes on without a jump). A duration of 0 places it at once.
     */
    move(key, to, { from = null, duration = 0, ease = EASE.gentle } = {}) {
      const start = from ?? motion.sample(key) ?? to;
      moves.delete(key);
      if (duration <= 0) rests.set(key, { ...to });
      else moves.set(key, { from: { ...start }, to: { ...to }, start: now(), duration, ease });
    },
    /** Is an animation still running (the view must keep drawing)? */
    active(time = now()) {
      for (const [key, move] of moves) {
        if (time < move.start + move.duration) return true;
        motion.sample(key, time);
      }
      return false;
    },
    /** Forgets a key, or everything. */
    clear(key) {
      if (key === undefined) {
        moves.clear();
        rests.clear();
      } else {
        moves.delete(key);
        rests.delete(key);
      }
    },
  };
  return motion;
}
