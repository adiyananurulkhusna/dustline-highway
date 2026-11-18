// Dustline Highway — hud.js
// Everything drawn on top of the world: health, cash, wanted stars, the
// mission objective, dialogue, the minimap, and the menu screens.
import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, MISSION_REWARDS } from './config.js';
import { MISSIONS, currentObjective, missionMarker } from './missions.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function drawHud(ctx, game) {
  const { player, missions } = game;
  ctx.textBaseline = 'alphabetic';
  // Top-left: cash and health.
  ctx.fillStyle = 'rgba(20,12,6,0.55)';
  ctx.fillRect(12, 12, 250, 86);
  ctx.fillStyle = '#f2c14e';
  ctx.font = 'bold 26px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('$' + player.money, 26, 44);
  ctx.fillStyle = '#e8e0c8';
  ctx.font = '16px ' + FONT;
  ctx.fillText('COLE "DUSTY" REYES', 26, 66);
  // Health bar.
  ctx.fillStyle = '#3a2a1a';
  ctx.fillRect(26, 74, 150, 12);
  ctx.fillStyle = player.health > 30 ? '#7ac74f' : '#e5534b';
  ctx.fillRect(26, 74, 150 * Math.max(0, player.health / 100), 12);
  ctx.fillStyle = '#e8e0c8';
  ctx.font = '12px ' + FONT;
  ctx.fillText('HP ' + Math.ceil(player.health), 182, 85);

  // Wanted stars, top centre.
  const cx = VIEW_W / 2;
  ctx.fillStyle = 'rgba(20,12,6,0.55)';
  ctx.fillRect(cx - 130, 12, 260, 44);
  ctx.font = 'bold 24px ' + FONT;
  ctx.textAlign = 'center';
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < player.wanted ? '#ffd94a' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', cx - 88 + i * 44, 44);
  }
  if (player.wanted > 0) {
    ctx.fillStyle = '#ff6a4a';
    ctx.font = 'bold 13px ' + FONT;
    ctx.fillText('WANTED', cx, 74);
  }

  // Mission objective bar, under the stars.
  const obj = currentObjective(game);
  ctx.fillStyle = 'rgba(20,12,6,0.55)';
  const ow = Math.min(560, ctx.measureText(obj).width + 90);
  ctx.fillRect(cx - ow / 2, 84, ow, 34);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 15px ' + FONT;
  ctx.fillText('◆ ' + obj, cx, 107);

  // Mission timer.
  if (missions.index >= 0 && missions.timer > 0) {
    ctx.fillStyle = missions.timer < 15 ? '#ff6a4a' : '#f2c14e';
    ctx.font = 'bold 22px ' + FONT;
    ctx.fillText(Math.ceil(missions.timer) + 's', cx, 152);
  }

  // Car speed + weapon, bottom-left.
  if (player.inCar) {
    ctx.fillStyle = 'rgba(20,12,6,0.55)';
    ctx.fillRect(12, VIEW_H - 64, 190, 52);
    ctx.fillStyle = '#e8e0c8';
    ctx.font = 'bold 24px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText(Math.round(Math.abs(player.inCar.speed) * 0.22) + ' mph', 26, VIEW_H - 30);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = '#c9b48a';
    ctx.fillText(player.inCar.police ? 'SHERIFF CRUISER' : 'E — leave car', 26, VIEW_H - 16);
  } else if (player.hasGun) {
    ctx.fillStyle = 'rgba(20,12,6,0.55)';
    ctx.fillRect(12, VIEW_H - 64, 190, 52);
    ctx.fillStyle = '#e8e0c8';
    ctx.font = 'bold 18px ' + FONT;
    ctx.textAlign = 'left';
    ctx.fillText('PISTOL  •  ammo ' + player.ammo, 26, VIEW_H - 30);
    ctx.font = '13px ' + FONT;
    ctx.fillStyle = '#c9b48a';
    ctx.fillText('F punch  •  SPACE shoot', 26, VIEW_H - 16);
  }

  // Toast message, bottom centre.
  if (game.toast && game.toastT > 0) {
    ctx.font = 'bold 17px ' + FONT;
    ctx.textAlign = 'center';
    const w = ctx.measureText(game.toast).width + 40;
    ctx.fillStyle = 'rgba(20,12,6,0.7)';
    ctx.fillRect(VIEW_W / 2 - w / 2, VIEW_H - 96, w, 32);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillText(game.toast, VIEW_W / 2, VIEW_H - 73);
  }

  drawMinimap(ctx, game);
  drawDialogue(ctx, game);
  drawEdgeArrow(ctx, game);
}

export function drawMinimap(ctx, game) {
  const size = 190;
  const x0 = VIEW_W - size - 14;
  const y0 = 14;
  const scale = size / WORLD_W;
  ctx.fillStyle = 'rgba(20,12,6,0.72)';
  ctx.fillRect(x0 - 6, y0 - 6, size + 12, size + 12);
  ctx.fillStyle = '#c98f4e';
  ctx.fillRect(x0, y0, size, size);
  // Roads.
  ctx.fillStyle = '#4a4038';
  for (const r of game.world.roads) {
    ctx.fillRect(x0 + r.x * scale, y0 + r.y * scale, Math.max(2, r.w * scale), Math.max(2, r.h * scale));
  }
  // Buildings.
  ctx.fillStyle = '#6b4a2e';
  for (const b of game.world.buildings) {
    ctx.fillRect(x0 + b.x * scale, y0 + b.y * scale, Math.max(2, b.w * scale), Math.max(2, b.h * scale));
  }
  // Mission marker.
  const m = missionMarker(game);
  if (m) {
    ctx.fillStyle = '#ffd94a';
    ctx.beginPath();
    ctx.arc(x0 + m.x * scale, y0 + m.y * scale, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Police.
  ctx.fillStyle = '#3a6cff';
  for (const c of game.police.cruisers) {
    ctx.beginPath();
    ctx.arc(x0 + c.x * scale, y0 + c.y * scale, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = x0 + game.player.x * scale;
  const py = y0 + game.player.y * scale;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(game.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(9, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#f2c14e';
  ctx.lineWidth = 2;
  ctx.strokeRect(x0 - 6, y0 - 6, size + 12, size + 12);
  ctx.fillStyle = '#e8e0c8';
  ctx.font = 'bold 12px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('DUSTLINE', x0, y0 + size + 22);
}

function drawDialogue(ctx, game) {
  // Screenshot scenes hide the dialogue box so the town stays visible.
  if (game.shotName) return;
  const d = game.missions.dialogue;
  if (!d || d.t > 9) return;
  const lines = d.lines;
  const h = 30 + lines.length * 24 + 18;
  const y = VIEW_H - h - 110;
  ctx.fillStyle = 'rgba(24,14,6,0.85)';
  ctx.fillRect(220, y, VIEW_W - 440, h);
  ctx.strokeStyle = '#f2c14e';
  ctx.lineWidth = 2;
  ctx.strokeRect(220, y, VIEW_W - 440, h);
  ctx.fillStyle = '#f2c14e';
  ctx.font = 'bold 15px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText(d.speaker, 240, y + 28);
  ctx.fillStyle = '#f2e8c8';
  ctx.font = '15px ' + FONT;
  lines.forEach((line, i) => ctx.fillText(line, 240, y + 54 + i * 24));
}

// Arrow at the screen edge pointing at the off-screen mission marker.
function drawEdgeArrow(ctx, game) {
  const m = missionMarker(game);
  if (!m) return;
  const cam = game.camera;
  const sx = m.x - cam.x;
  const sy = m.y - cam.y;
  if (sx > 60 && sx < VIEW_W - 60 && sy > 60 && sy < VIEW_H - 60) return;
  const cx = Math.max(50, Math.min(VIEW_W - 270, sx));
  const cy = Math.max(50, Math.min(VIEW_H - 50, sy));
  const ang = Math.atan2(sy - cy, sx - cx);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = '#ffd94a';
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 13px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(Math.round(Math.hypot(m.x - game.player.x, m.y - game.player.y) / 10) * 10 + 'm', cx, cy + 30);
}

function menuPanel(ctx, title, lines, prompt, accent) {
  ctx.fillStyle = 'rgba(24,10,4,0.82)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = accent || '#f2c14e';
  ctx.font = 'bold 64px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, 170);
  ctx.fillStyle = '#f2e8c8';
  ctx.font = '19px ' + FONT;
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, 240 + i * 32));
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 21px ' + FONT;
  ctx.fillText(prompt, VIEW_W / 2, 240 + lines.length * 32 + 44);
}

export function drawTitle(ctx, game) {
  menuPanel(ctx, 'DUSTLINE HIGHWAY', [
    'A desert open-world crime story.',
    'Cole "Dusty" Reyes, courier for hire, is caught between',
    'the Dust Vipers and the Road Kings in the town of Dustline.',
    '',
    'WASD / arrows — move & drive      E — steal / enter car',
    'SHIFT — run      F — punch      SPACE / click — shoot',
    'P — pause      M — mute      Complete 6 missions to own the highway.',
    '',
    'Best run: $' + (game.save ? game.save.bestMoney : 0) + '   •   Missions done: ' + game.missions.completed.length + ' / 6',
  ], game.save && game.save.hasSave ? 'Press ENTER — continue, or N — new game' : 'Press ENTER or click to start', '#f2c14e');
  ctx.fillStyle = '#c9b48a';
  ctx.font = '14px ' + FONT;
  ctx.textAlign = 'center';
  ctx.fillText('An original game. No Rockstar, no GTA assets — every name, place and sound is made up for Dustline.', VIEW_W / 2, VIEW_H - 24);
}

export function drawPaused(ctx, game) {
  menuPanel(ctx, 'PAUSED', [
    'Money $' + game.player.money + '   •   Health ' + Math.ceil(game.player.health),
    'Missions completed: ' + game.missions.completed.length + ' / ' + MISSIONS.length,
    'Next: ' + currentObjective(game),
    '',
    'Progress saves automatically after every mission.',
  ], 'Press P or ENTER to resume  •  Q to quit to title', '#e8e0c8');
}

export function drawGameOver(ctx, game, reason) {
  menuPanel(ctx, reason === 'busted' ? 'BUSTED!' : 'WASTED', [
    reason === 'busted'
      ? 'The sheriff hauled Cole in. The fine stings, but Dustline still needs its courier.'
      : 'Cole went down in the dust. The Vipers will hear about this.',
    '',
    'Money kept: $' + game.player.money,
    'Missions completed: ' + game.missions.completed.length + ' / ' + MISSIONS.length,
  ], 'Press ENTER to get back out there', '#e5534b');
}

export function drawMissionList(ctx, game) {
  // Small mission tracker, top-right under the minimap.
  const x0 = VIEW_W - 204;
  const y0 = 252;
  ctx.fillStyle = 'rgba(20,12,6,0.55)';
  ctx.fillRect(x0 - 6, y0 - 6, 204, 24 + MISSIONS.length * 20);
  ctx.fillStyle = '#f2c14e';
  ctx.font = 'bold 13px ' + FONT;
  ctx.textAlign = 'left';
  ctx.fillText('JOBS — DUSTLINE', x0, y0 + 14);
  ctx.font = '12px ' + FONT;
  MISSIONS.forEach((m, i) => {
    const done = game.missions.completed.includes(i);
    const active = game.missions.index === i;
    ctx.fillStyle = done ? '#7ac74f' : active ? '#ffd94a' : '#c9b48a';
    ctx.fillText((done ? '✓ ' : active ? '► ' : '· ') + (i + 1) + '. ' + m.title + '  $' + m.reward, x0, y0 + 34 + i * 20);
  });
}
