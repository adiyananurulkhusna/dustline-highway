// Dustline Highway — input.js
// Keyboard and mouse input. Held keys give movement/steering; one-shot
// presses (enter car, punch, pause, confirm) are queued as bit flags and
// taken once by the loop, so a press between frames is never lost.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER_CAR = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_MUTE = 32;
export const ACTION_NEW_GAME = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Enter', 'Space']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(canvas) {
  const held = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;

  window.addEventListener('keydown', (event) => {
    const c = event.code;
    if (UP.has(c)) held.up = true;
    else if (DOWN.has(c)) held.down = true;
    else if (LEFT.has(c)) held.left = true;
    else if (RIGHT.has(c)) held.right = true;
    else if (RUN.has(c)) held.run = true;
    else if (c === 'KeyE') {
      if (!event.repeat) actions |= ACTION_ENTER_CAR;
    } else if (c === 'KeyF') {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (c === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (c === 'KeyN') {
      if (!event.repeat) actions |= ACTION_NEW_GAME;
    } else if (c === 'KeyQ') {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (CONFIRM.has(c)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
      if (c === 'Space' && !event.repeat) actions |= ACTION_SHOOT;
    } else if (PAUSE.has(c)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(c)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    const c = event.code;
    if (UP.has(c)) held.up = false;
    else if (DOWN.has(c)) held.down = false;
    else if (LEFT.has(c)) held.left = false;
    else if (RIGHT.has(c)) held.right = false;
    else if (RUN.has(c)) held.run = false;
  });
  window.addEventListener('blur', () => {
    held.up = held.down = held.left = held.right = held.run = false;
    mouseDown = false;
  });
  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    actions |= ACTION_CONFIRM;
    actions |= ACTION_SHOOT;
  });
  canvas.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    held,
    mouse() {
      return { x: mouseX, y: mouseY, down: mouseDown };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // Test hook: pretend keys are held (used by ?selftest=1 only).
    press(code, down) {
      const map = { up: 'up', down: 'down', left: 'left', right: 'right', run: 'run' };
      if (map[code]) held[map[code]] = down;
    },
    queue(action) {
      actions |= action;
    },
  };
}
