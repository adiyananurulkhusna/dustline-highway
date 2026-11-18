// Dustline Highway — render.js
// Drawing only: the desert, the roads, the town, every car and person,
// dust, skid marks and the sunset light. The camera follows the player.
import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, PALETTE } from './config.js';
import { clamp } from './rng.js';
import { onRoad } from './world.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

export function createCamera() {
  return { x: 0, y: 0 };
}

export function updateCamera(cam, targetX, targetY) {
  const wantX = clamp(targetX - VIEW_W / 2, 0, WORLD_W - VIEW_W);
  const wantY = clamp(targetY - VIEW_H / 2, 0, WORLD_H - VIEW_H);
  cam.x += (wantX - cam.x) * 0.12;
  cam.y += (wantY - cam.y) * 0.12;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const fonts = new Map();
  const view = { scale: 1, ox: 0, oy: 0, ratio: 1 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.ratio = ratio;
    view.scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
    view.ox = (window.innerWidth - VIEW_W * view.scale) / 2;
    view.oy = (window.innerHeight - VIEW_H * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, bold) {
    const key = size + (bold ? 'b' : '');
    if (!fonts.has(key)) fonts.set(key, (bold ? 'bold ' : '') + size + 'px ' + FONT);
    ctx.font = fonts.get(key);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.fillText(value, x, y);
  }

  function drawSand(cam) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Dune shading: big soft blobs precomputed from world props.
    const x0 = Math.max(0, Math.floor(cam.x / 400));
    const x1 = Math.min(8, Math.ceil((cam.x + VIEW_W) / 400));
    const y0 = Math.max(0, Math.floor(cam.y / 400));
    const y1 = Math.min(8, Math.ceil((cam.y + VIEW_H) / 400));
    for (let gx = x0; gx <= x1; gx++) {
      for (let gy = y0; gy <= y1; gy++) {
        const h = Math.sin(gx * 12.9898 + gy * 78.233) * 43758.5453;
        const f = h - Math.floor(h);
        if (f < 0.45) continue;
        ctx.fillStyle = f < 0.7 ? PALETTE.sandDark : PALETTE.sandLight;
        ctx.globalAlpha = 0.25;
        ctx.beginPath();
        ctx.ellipse(gx * 400 + 200, gy * 400 + 200, 260, 120, f, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  function drawRoads(cam, world) {
    for (const r of world.roads) {
      if (r.x > cam.x + VIEW_W || r.x + r.w < cam.x || r.y > cam.y + VIEW_H || r.y + r.h < cam.y) continue;
      ctx.fillStyle = r.dirt ? '#a67c4e' : r.highway ? PALETTE.highway : PALETTE.road;
      ctx.fillRect(r.x - cam.x, r.y - cam.y, r.w, r.h);
      // Centre dashes.
      ctx.fillStyle = r.highway ? PALETTE.roadEdge : '#d8cba8';
      const horizontal = r.w > r.h;
      const len = horizontal ? r.w : r.h;
      const start = horizontal ? r.x : r.y;
      for (let d = 0; d < len; d += 64) {
        if (horizontal) ctx.fillRect(r.x + d - cam.x, r.y + r.h / 2 - 3 - cam.y, 34, 6);
        else ctx.fillRect(r.x + r.w / 2 - 3 - cam.x, r.y + d - cam.y, 6, 34);
      }
      if (r.highway) {
        ctx.fillStyle = PALETTE.roadEdge;
        ctx.fillRect(r.x - cam.x, r.y + 8 - cam.y, r.w, 4);
        ctx.fillRect(r.x - cam.x, r.y + r.h - 12 - cam.y, r.w, 4);
      }
    }
  }

  function drawProps(cam, world) {
    for (const p of world.props) {
      if (p.x < cam.x - 60 || p.x > cam.x + VIEW_W + 60 || p.y < cam.y - 60 || p.y > cam.y + VIEW_H + 60) continue;
      const x = p.x - cam.x;
      const y = p.y - cam.y;
      if (p.kind === 'cactus') {
        ctx.strokeStyle = PALETTE.cactus;
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(x, y + 14);
        ctx.lineTo(x, y - 16);
        ctx.moveTo(x, y);
        ctx.lineTo(x - 12, y - 2);
        ctx.lineTo(x - 12, y - 12);
        ctx.moveTo(x, y + 4);
        ctx.lineTo(x + 12, y + 2);
        ctx.lineTo(x + 12, y - 8);
        ctx.stroke();
      } else if (p.kind === 'rock') {
        ctx.fillStyle = PALETTE.rock;
        ctx.beginPath();
        ctx.ellipse(x, y, p.r, p.r * 0.7, p.seed, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#a08a6e';
        ctx.beginPath();
        ctx.ellipse(x - p.r * 0.2, y - p.r * 0.2, p.r * 0.5, p.r * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'dune') {
        ctx.fillStyle = PALETTE.dune;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.ellipse(x, y, p.r, p.r * 0.45, p.seed, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      } else {
        // Sun-bleached bones.
        ctx.strokeStyle = '#efe6cc';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y - 4);
        ctx.moveTo(x - 6, y + 6);
        ctx.lineTo(x + 8, y + 8);
        ctx.stroke();
      }
    }
  }

  function drawBuildings(cam, world) {
    for (const b of world.buildings) {
      if (b.x > cam.x + VIEW_W || b.x + b.w < cam.x || b.y > cam.y + VIEW_H || b.y + b.h < cam.y) continue;
      const x = b.x - cam.x;
      const y = b.y - cam.y;
      // Shadow and walls.
      ctx.fillStyle = 'rgba(60,30,10,0.35)';
      ctx.fillRect(x + 6, y + 8, b.w, b.h);
      ctx.fillStyle = '#e8d3a8';
      ctx.fillRect(x, y, b.w, b.h);
      // Roof.
      ctx.fillStyle = b.color;
      ctx.fillRect(x + 6, y + 6, b.w - 12, b.h - 12);
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 6, y + 6, b.w - 12, b.h - 12);
      // Door + windows.
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(x + b.w / 2 - 10, y + b.h - 16, 20, 16);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(x + 10, y + 10, 16, 12);
      ctx.fillRect(x + b.w - 26, y + 10, 16, 12);
      if (b.kind === 'gas') {
        ctx.fillStyle = '#f2f2f2';
        ctx.fillRect(x - 10, y + b.h + 6, b.w + 20, 26);
        ctx.fillStyle = '#c93b2e';
        text('DUST GAS  •  $2.10', x + b.w / 2, y + b.h + 25, 13, '#c93b2e', 'center', true);
      }
      if (b.label) text(b.label, x + b.w / 2, y - 8, 13, '#5a3a1a', 'center', true);
    }
  }

  function drawCarShape(x, y, angle, len, wid, color, police, siren) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-len / 2 + 3, -wid / 2 + 4, len, wid);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-len / 2, -wid / 2, len, wid, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(30,40,50,0.85)';
    ctx.beginPath();
    ctx.roundRect(-len / 6, -wid / 2 + 4, len / 3, wid - 8, 4);
    ctx.fill();
    ctx.fillStyle = '#ffd94a';
    ctx.fillRect(len / 2 - 4, -wid / 2 + 3, 3, 5);
    ctx.fillRect(len / 2 - 4, wid / 2 - 8, 3, 5);
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(-len / 2 + 1, -wid / 2 + 3, 3, 5);
    ctx.fillRect(-len / 2 + 1, wid / 2 - 8, 3, 5);
    if (police) {
      ctx.fillStyle = '#2b4acb';
      ctx.fillRect(-len / 4, -wid / 2 + 2, len / 2, 5);
      const on = Math.floor(siren * 4) % 2 === 0;
      ctx.fillStyle = on ? '#ff2a2a' : '#2a6cff';
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b4acb';
      text('SHERIFF', 0, -wid / 2 - 6, 10, '#2b4acb', 'center', true);
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, walkPhase, gang) {
    const bob = Math.sin(walkPhase) * 2;
    ctx.save();
    ctx.translate(x, y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(angle);
    // Legs.
    ctx.strokeStyle = '#3a3230';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(-4 + bob, 10);
    ctx.moveTo(0, 2);
    ctx.lineTo(4 - bob, 10);
    ctx.stroke();
    // Body.
    ctx.fillStyle = shirt;
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    // Head.
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(9, 0, 6, 0, Math.PI * 2);
    ctx.fill();
    if (gang) {
      ctx.fillStyle = '#111';
      ctx.fillRect(4, -5, 8, 4);
    } else {
      ctx.fillStyle = '#c9a86a';
      ctx.beginPath();
      ctx.arc(9, -2, 6.5, Math.PI, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWorld(cam, game) {
    const world = game.world;
    drawSand(cam);
    drawRoads(cam, world);
    drawProps(cam, world);
    drawBuildings(cam, world);

    // Mission marker beacon.
    const marker = game.marker;
    if (marker) {
      const mx = marker.x - cam.x;
      const my = marker.y - cam.y;
      const pulse = 1 + Math.sin(game.time * 4) * 0.15;
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(mx, my, 26 * pulse, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(mx, my - 46);
      ctx.lineTo(mx - 10, my - 26);
      ctx.lineTo(mx + 10, my - 26);
      ctx.closePath();
      ctx.fill();
    }

    // Skid marks and dust.
    for (const s of game.skids) {
      ctx.strokeStyle = 'rgba(40,30,20,0.35)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s.x1 - cam.x, s.y1 - cam.y);
      ctx.lineTo(s.x2 - cam.x, s.y2 - cam.y);
      ctx.stroke();
    }
    for (const p of game.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cam.x, p.y - cam.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Parked + traffic cars.
    for (const car of game.cars) {
      if (car.x < cam.x - 80 || car.x > cam.x + VIEW_W + 80 || car.y < cam.y - 80 || car.y > cam.y + VIEW_H + 80) continue;
      if (game.player.inCar === car) continue;
      drawCarShape(car.x - cam.x, car.y - cam.y, car.angle, car.len, car.wid, car.color, car.police, car.siren || 0);
      if (car.parked && game.missions.index === 1 && game.missions.step === 0) {
        text('STEAL ME', car.x - cam.x, car.y - cam.y - 30, 12, '#ffd94a', 'center', true);
      }
    }
    // Police cruisers.
    for (const car of game.police.cruisers) {
      drawCarShape(car.x - cam.x, car.y - cam.y, car.angle, car.len, car.wid, car.color, true, car.siren || 0);
    }
    // Player's car, ringed in gold so it reads as the hero car.
    const pc = game.player.inCar;
    if (pc) {
      ctx.strokeStyle = '#ffd94a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(pc.x - cam.x, pc.y - cam.y, pc.len * 0.72, pc.wid * 0.95, pc.angle, 0, Math.PI * 2);
      ctx.stroke();
      drawCarShape(pc.x - cam.x, pc.y - cam.y, pc.angle, pc.len, pc.wid, pc.color, pc.police, pc.siren || 0);
    }

    // Pedestrians.
    for (const ped of game.peds) {
      if (ped.dead) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(ped.x - cam.x, ped.y - cam.y, 12, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      drawPerson(ped.x - cam.x, ped.y - cam.y, ped.angle, ped.shirt, ped.walkPhase, false);
    }
    // Gang enemies.
    for (const e of game.missions.enemies) {
      if (e.dead) continue;
      drawPerson(e.x - cam.x, e.y - cam.y, e.angle, e.shirt, e.walkPhase, true);
      ctx.fillStyle = '#3a2a1a';
      ctx.fillRect(e.x - cam.x - 14, e.y - cam.y - 26, 28, 5);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(e.x - cam.x - 14, e.y - cam.y - 26, 28 * Math.max(0, e.health / 60), 5);
      text('VIPER', e.x - cam.x, e.y - cam.y - 30, 10, '#e5534b', 'center', true);
    }
    // Player on foot, ringed in gold so Cole reads at a glance.
    if (!game.player.inCar && !game.player.dead) {
      const p = game.player;
      const blink = p.invuln > 0 && Math.floor(p.invuln * 10) % 2 === 0;
      if (!blink) {
        ctx.strokeStyle = 'rgba(255,217,74,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(p.x - cam.x, p.y - cam.y + 8, 15, 8, 0, 0, Math.PI * 2);
        ctx.stroke();
        drawPerson(p.x - cam.x, p.y - cam.y, p.angle, '#c93b2e', p.walkPhase, false);
      }
      if (p.punchAnim > 0) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x - cam.x + Math.cos(p.angle) * 26, p.y - cam.y + Math.sin(p.angle) * 26, 10, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // Bullet tracers.
    for (const b of game.tracers) {
      ctx.strokeStyle = '#fff2a8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x1 - cam.x, b.y1 - cam.y);
      ctx.lineTo(b.x2 - cam.x, b.y2 - cam.y);
      ctx.stroke();
    }

    // Dust storm haze at the edges when the storm is on.
    if (game.storm > 0) {
      ctx.fillStyle = `rgba(214,164,90,${0.14 * game.storm})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    // Sunset vignette.
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, 'rgba(255,140,60,0.10)');
    grad.addColorStop(1, 'rgba(120,40,10,0.16)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  resize();
  window.addEventListener('resize', resize);
  return { ctx, drawWorld, text, view: () => view };
}
