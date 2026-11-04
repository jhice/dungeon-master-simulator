// Keyboard -> simulation commands, by KeyboardEvent.code (physical key), so the
// same keys work in QWERTY and AZERTY. Left hand (WASD + QE) and numeric keypad
// (docs/012-simulation.md § 5); no arrows (docs/055).
// One press, one command: a key held does not repeat (docs/062). Animated moves: one command per
// animation, a key pressed meanwhile waits in a queue.

export const KEY_COMMANDS = {
  KeyW: 'forward',
  KeyS: 'back',
  KeyA: 'left',
  KeyD: 'right',
  KeyQ: 'turnLeft',
  KeyE: 'turnRight',
  Numpad5: 'forward',
  Numpad2: 'back',
  Numpad1: 'left',
  Numpad3: 'right',
  Numpad4: 'turnLeft',
  Numpad6: 'turnRight',
};

const QUEUE_SIZE = 5; // as DM (ReDMCSB COMMAND.C)

/**
 * Resolves a key event to an action, or undefined if the key is not a movement key.
 * The result also has stop(), which forgets the commands waiting.
 * @param {(command: string) => void} onCommand
 * @param {(command: string) => number} [durationOf] duration of the animation of a command, in ms; 0: instant
 * @param {{ schedule?: Function, cancel?: Function }} [timers] setTimeout and clearTimeout, by default
 */
export function createControls(onCommand, durationOf = () => 0, { schedule = (...args) => setTimeout(...args), cancel = (id) => clearTimeout(id) } = {}) {
  let timer = null; // an animation is running
  const queue = [];

  function run(command) {
    onCommand(command);
    const duration = durationOf(command);
    if (duration > 0) timer = schedule(next, duration);
  }

  function next() {
    timer = null;
    while (!timer && queue.length) run(queue.shift());
  }

  const keyAction = (event) => {
    const command = KEY_COMMANDS[event.code];
    if (!command) return undefined;
    return () => {
      if (event.repeat) return; // a key held does nothing more
      if (!timer) run(command);
      else if (queue.length < QUEUE_SIZE) queue.push(command);
    };
  };
  keyAction.stop = () => {
    queue.length = 0;
    if (timer) cancel(timer);
    timer = null;
  };
  return keyAction;
}
