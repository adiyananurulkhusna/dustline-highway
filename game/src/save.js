// Dustline Highway — save.js
// Progress in localStorage: money, completed missions, best money, position.
// Saves automatically after every mission and when the game is paused.
import { SAVE_KEY } from './config.js';

export function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  try {
    const data = {
      money: game.player.money,
      completed: game.missions.completed.slice(),
      bestMoney: Math.max(game.player.money, (game.save && game.save.bestMoney) || 0),
      hasGun: game.player.hasGun,
      x: Math.round(game.player.x),
      y: Math.round(game.player.y),
      hasSave: true,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    game.save = data;
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage can be off: nothing to clear.
  }
}
