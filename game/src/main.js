// Dustline Highway — main.js
// Boot and the one loop: input every frame, the world in fixed 1/60 s steps,
// the renderer paints what is there. Screens: title, play, paused, game over.
// ?seed=N fixes the world. ?shot=cover|highway|town|mission stages a scene
// for a screenshot. ?selftest=1 plays a scripted run and reports the result.
import { VIEW_W, VIEW_H, WORLD_W, WORLD_H, STEP, SAVE_KEY } from './config.js';
import { makeRng, clamp, dist2 } from './rng.js';
import { buildWorld, onRoad, buildingByKind } from './world.js';
import { SoundBank } from './audio.js';
import { spawnTraffic, spawnParkedCars, spawnPedestrians, stepTrafficCar, stepPedestrian, separateCars } from './traffic.js';
import { makePlayer, addHeat, stepDriving, stepWalking, tryPunch, tryShoot, nearestCar, damagePlayer, carName } from './player.js';
import { makePoliceState, decayWanted, wantedCruiserCount, spawnCruiser, stepCruiser, bustProgress } from './police.js';
import { MISSIONS, createMissionState, startMission, updateMissions, stepEnemies, damageEnemy, missionMarker, currentObjective } from './missions.js';
import { createRenderer, createCamera, updateCamera } from './render.js';
import { drawHud, drawTitle, drawPaused, drawGameOver, drawMissionList } from './hud.js';
import { readSave, writeSave, clearSave } from './save.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER_CAR, ACTION_PUNCH, ACTION_SHOOT, ACTION_MUTE, ACTION_NEW_GAME } from './input.js';
import { stageShot, shotPilot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const selftest = params.get('selftest') === '1';
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const sounds = new SoundBank();
const rng = makeRng(seed);

function newGameState() {
  const world = buildWorld(seed);
  const player = makePlayer(1250, 860);
  const cars = [...spawnParkedCars(world, rng, 10), ...spawnTraffic(world, rng, 9)];
  const peds = spawnPedestrians(world, rng, 16);
  return {
    world, player, cars, peds,
    police: makePoliceState(),
    missions: createMissionState(),
    camera: createCamera(),
    time: 0, storm: 0, stormPhase: rng() * 10,
    particles: [], skids: [], tracers: [],
    toast: '', toastT: 0,
    gunfireT: 0, crashT: 0,
    marker: null, screen: 'title',
    save: readSave(),
    completedBefore: 0,
    gameOverReason: null,
  };
}

const game = newGameState();
window.__game = game; // debug hook: inspect live state from the console
const renderer = createRenderer(canvas);
const input = createInput(canvas);
game.input = input;
game.rng = rng;
game.sounds = sounds;

function say(text) {
  game.toast = text;
  game.toastT = 3.5;
  status.textContent = text;
}

function addParticles(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2;
    const s = (speed || 60) * (0.4 + rng() * 0.8);
    game.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      r: 2 + rng() * 4, life: 0.5 + rng() * 0.5, max: 1,
      color: color || '#d9b078',
    });
  }
  if (game.particles.length > 400) game.particles.splice(0, game.particles.length - 400);
}

const missionCtx = {
  get player() { return game.player; },
  get world() { return game.world; },
  get missions() { return game.missions; },
  sounds,
  addHeat(n) { addHeat(game.player, n); },
  say,
};
game.missionCtx = missionCtx;

function enterOrExitCar() {
  const player = game.player;
  if (player.inCar) {
    const car = player.inCar;
    car.driver = null;
    player.inCar = null;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
    sounds.door();
    say('Out of the ' + carName(car) + '.');
    return;
  }
  const car = nearestCar(game.cars, player.x, player.y, 78);
  if (!car) {
    say('No car close by — walk up to one and press E.');
    return;
  }
  if (!car.parked && Math.abs(car.speed) > 80) {
    say('Too fast to grab — wait for it to slow down.');
    return;
  }
  const wasParked = car.parked;
  car.parked = false;
  car.driver = player;
  player.inCar = car;
  player.x = car.x;
  player.y = car.y;
  sounds.door();
  if (!car.police) {
    addHeat(player, 1);
    say('You stole the ' + carName(car) + '!  +1 wanted star.');
    if (game.missions.index === 1 && game.missions.step === 0) car.stolenForMission = true;
  } else {
    say('You took a sheriff cruiser!');
  }
}

function doPunch() {
  const player = game.player;
  if (player.inCar) return;
  const targets = [...game.peds, ...game.missions.enemies];
  const hit = tryPunch(player, targets, (t, dmg) => {
    if (t.gang) {
      damageEnemy(missionCtx, t, dmg);
      say('You hit a Viper! (' + Math.max(0, t.health) + ' HP left)');
    } else {
      t.dead = true;
      addHeat(player, 1);
      addParticles(t.x, t.y, 10, '#e8b98a', 80);
      say('You knocked a pedestrian down! The sheriff will hear about this.');
    }
    sounds.punch();
  });
  if (!hit) sounds.punch();
}

function doShoot(angle) {
  const player = game.player;
  if (player.inCar || !player.hasGun) {
    if (!player.hasGun && !player.inCar) say('No gun yet — finish jobs for Rusty and he will arm you.');
    return;
  }
  const targets = [...game.peds, ...game.missions.enemies];
  const result = tryShoot(player, angle, targets, 520, (t, dmg) => {
    if (t.gang) {
      damageEnemy(missionCtx, t, dmg);
    } else {
      t.dead = true;
      addHeat(player, 2);
      say('You shot a pedestrian! Wanted up.');
    }
  });
  if (result) {
    game.tracers.push({ x1: player.x, y1: player.y, x2: result.x, y2: result.y, life: 0.12 });
    game.gunfireT = 1.5;
    sounds.shoot();
  } else if (player.ammo <= 0) {
    say('Out of ammo!');
  }
}

function startNewGame() {
  const fresh = newGameState();
  Object.assign(game, fresh);
  game.input = input;
  game.rng = rng;
  game.sounds = sounds;
  game.screen = 'play';
  say('A new day in Dustline. Visit the diner for work.');
}

function loadSaveIntoGame() {
  const s = game.save;
  if (!s) return;
  game.player.money = s.money || 0;
  game.player.hasGun = !!s.hasGun;
  game.missions.completed = (s.completed || []).slice();
  if (s.x) {
    game.player.x = s.x;
    game.player.y = s.y;
  }
  say('Welcome back, Cole. $' + game.player.money + ' in your pocket.');
}

function gameOver(reason) {
  game.screen = 'over';
  game.gameOverReason = reason;
  if (reason === 'busted') {
    game.player.money = Math.max(0, game.player.money - 100);
    sounds.busted();
  }
  writeSave(game);
}

function update(dt) {
  const player = game.player;
  game.time += dt;
  game.storm = 0.35 + 0.35 * Math.sin(game.time * 0.05 + game.stormPhase);
  if (game.missions.dialogue) game.missions.dialogue.t += dt;
  if (game.toastT > 0) game.toastT -= dt;
  if (game.gunfireT > 0) game.gunfireT -= dt;
  if (player.invuln > 0) player.invuln -= dt;

  // --- player ---
  if (player.inCar) {
    const car = player.inCar;
    const prevX = car.x;
    const prevY = car.y;
    stepDriving(game.world, player, car, input.held, dt, (speed) => {
      sounds.crash();
      addParticles(car.x, car.y, 14, '#c9b48a', 140);
      damagePlayer(player, Math.round(speed / 40));
      game.crashT = 0.4;
    });
    // Skid marks on hard turns, dust off-road.
    const turning = (input.held.left || input.held.right) && Math.abs(car.speed) > 260;
    if (turning && rng() < 0.6) {
      game.skids.push({ x1: prevX, y1: prevY, x2: car.x, y2: car.y });
      if (game.skids.length > 120) game.skids.shift();
    }
    if (!onRoad(car.x, car.y, game.world.roads) && Math.abs(car.speed) > 150 && rng() < 0.5) {
      addParticles(car.x, car.y, 2, '#d9b078', 50);
    }
    // Run over pedestrians.
    for (const ped of game.peds) {
      if (ped.dead) continue;
      if (dist2(ped.x, ped.y, car.x, car.y) < 30 * 30 && Math.abs(car.speed) > 60) {
        ped.dead = true;
        addHeat(player, 1);
        sounds.crash();
        addParticles(ped.x, ped.y, 12, '#e8b98a', 100);
        say('You ran someone over! Wanted up.');
      }
    }
    // Ram police cruisers.
    for (const c of game.police.cruisers) {
      if (dist2(c.x, c.y, car.x, car.y) < 48 * 48 && Math.abs(car.speed) > 120) {
        addHeat(player, 2);
        c.speed *= 0.3;
        car.speed *= 0.6;
        sounds.crash();
        say('You rammed a sheriff cruiser!');
      }
    }
    sounds.setEngine(Math.abs(car.speed) / 560, true);
  } else {
    stepWalking(game.world, player, input.held, dt);
    sounds.setEngine(0, false);
  }

  // --- traffic + pedestrians ---
  for (const car of game.cars) {
    if (car.driver === player) continue;
    stepTrafficCar(game.world, car, dt, rng);
  }
  separateCars([...game.cars, ...game.police.cruisers], dt);
  for (const ped of game.peds) {
    stepPedestrian(game.world, ped, dt, rng, player.x, player.y, game.gunfireT > 0);
  }

  // --- police ---
  decayWanted(player, game.police, dt);
  const wantCount = wantedCruiserCount(player.wanted);
  game.police.spawnTimer -= dt;
  if (game.police.cruisers.length < wantCount && game.police.spawnTimer <= 0) {
    game.police.cruisers.push(spawnCruiser(game.world, rng, player));
    game.police.spawnTimer = 0.9;
    if (game.police.cruisers.length === 1) sounds.siren();
  }
  if (game.police.cruisers.length > wantCount) {
    // Extra cruisers give up and drive off.
    game.police.cruisers.splice(wantCount);
  }
  for (const c of game.police.cruisers) {
    stepCruiser(game.world, c, player, dt, (cruiser) => {
      if (player.inCar) {
        damagePlayer(player, 4);
        sounds.crash();
      }
    });
  }
  const bust = bustProgress(game.police, player, dt);
  if (bust > 1.6) {
    gameOver('busted');
    return;
  }

  // --- missions ---
  const before = game.missions.completed.length;
  updateMissions(missionCtx, dt);
  stepEnemies(missionCtx, dt);
  if (game.missions.completed.length > before) {
    writeSave(game);
  }
  game.marker = missionMarker(missionCtx);

  // --- particles / tracers ---
  for (const p of game.particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
  for (const t of game.tracers) t.life -= dt;
  game.tracers = game.tracers.filter((t) => t.life > 0);

  updateCamera(game.camera, player.x, player.y);

  if (player.dead) {
    gameOver('wasted');
  }
}

function shootAngle() {
  const m = input.mouse();
  const v = renderer.view();
  const sx = (m.x - v.ox) / v.scale;
  const sy = (m.y - v.oy) / v.scale;
  const wx = game.camera.x + sx;
  const wy = game.camera.y + sy;
  return Math.atan2(wy - game.player.y, wx - game.player.x);
}

function handleActions() {
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) {
    const muted = sounds.toggleMute();
    say(muted ? 'Sound off.' : 'Sound on.');
  }
  if (game.screen === 'title') {
    if (actions & ACTION_CONFIRM) {
      sounds.unlock();
      if (game.save && game.save.hasSave) loadSaveIntoGame();
      game.screen = 'play';
      say('A new day in Dustline. Visit the diner for work.');
    }
    return;
  }
  if (game.screen === 'over') {
    if (actions & ACTION_CONFIRM) {
      startNewGame();
      // Keep the money and completed missions: a setback, not a wipe.
      const s = readSave();
      if (s) {
        game.player.money = s.money || 0;
        game.missions.completed = (s.completed || []).slice();
      }
      game.player.x = 1250;
      game.player.y = 860;
    }
    return;
  }
  if (game.screen === 'paused') {
    if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) game.screen = 'play';
    return;
  }
  // Playing.
  if (actions & ACTION_PAUSE) {
    game.screen = 'paused';
    writeSave(game);
    return;
  }
  if (actions & ACTION_ENTER_CAR) enterOrExitCar();
  if (actions & ACTION_PUNCH) doPunch();
  if (actions & ACTION_SHOOT) doShoot(shootAngle());
  if (actions & ACTION_NEW_GAME) {
    clearSave();
    startNewGame();
  }
  // Start the next mission by walking into the diner marker.
  if (game.missions.index < 0 && game.missions.completed.length < MISSIONS.length) {
    const diner = buildingByKind(game.world, 'diner');
    if (diner) {
      const cx = diner.x + diner.w / 2;
      const cy = diner.y + diner.h + 40;
      if (dist2(game.player.x, game.player.y, cx, cy) < 120 * 120) {
        startMission(missionCtx, game.missions.completed.length);
      }
    }
  }
}

function draw() {
  const ctx = renderer.ctx;
  const v = renderer.view();
  ctx.setTransform(v.scale * v.ratio, 0, 0, v.scale * v.ratio, v.ox * v.ratio, v.oy * v.ratio);
  ctx.fillStyle = '#1a1208';
  ctx.fillRect(-v.ox, -v.oy, VIEW_W + v.ox * 2, VIEW_H + v.oy * 2);
  if (game.screen === 'title') {
    renderer.drawWorld(game.camera, { ...game, marker: null });
    drawTitle(ctx, game);
    return;
  }
  renderer.drawWorld(game.camera, game);
  drawHud(ctx, game);
  drawMissionList(ctx, game);
  if (game.screen === 'paused') drawPaused(ctx, game);
  else if (game.screen === 'over') drawGameOver(ctx, game, game.gameOverReason);
}

let accumulator = 0;
let last = performance.now();
const MAX_FRAME = 0.25;

function frame(now) {
  requestAnimationFrame(frame);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  handleActions();
  if (shot) shotPilot(game);
  if (game.screen === 'play') {
    while (accumulator >= STEP) {
      update(STEP);
      accumulator -= STEP;
      if (game.screen !== 'play') break;
    }
  } else {
    accumulator = 0;
  }
  draw();
  if (selftest) selftestTick();
  if (shot) {
    shotFrames += 1;
    const readyAt = shot === 'cover' || shot === 'highway' ? 70 : 100;
    if (shotFrames === readyAt) window.__shotReady = true;
  }
}

let shotFrames = 0;

// --- Self test: scripted play, reported on document.title and console. ---
const selfResults = [];
let selfStep = 0;
let selfTimer = 0;
let selfDone = false;
let selfT0 = 0; // game.time when the current step started
function selfCheck(name, ok) {
  selfResults.push(name + ':' + (ok ? 'PASS' : 'FAIL'));
  console.log('[selftest] ' + name + ' ' + (ok ? 'PASS' : 'FAIL'));
}
// Waits use game time, not frames: headless frame rates vary wildly.
function selfElapsed() {
  return game.time - selfT0;
}
function selfNext(step) {
  selfStep = step;
  selfTimer = 0;
  selfT0 = game.time;
}
function selftestTick() {
  if (selfDone) return;
  selfTimer += 1;
  const player = game.player;
  if (selfStep === 0) {
    game.screen = 'play';
    input.press('up', true);
    if (selfElapsed() > 1.0) {
      selfCheck('walk-moves', player.y < 860);
      input.press('up', false);
      selfNext(1);
    }
  } else if (selfStep === 1) {
    if (selfTimer === 1) {
      player.x = 1150;
      player.y = 800;
      input.queue(ACTION_ENTER_CAR);
    }
    if (selfElapsed() > 0.3) {
      selfCheck('enter-car', !!player.inCar);
      selfNext(2);
    }
  } else if (selfStep === 2) {
    input.press('up', true);
    if (selfElapsed() > 2.0) {
      selfCheck('drive-moves', Math.abs(player.inCar.speed) > 100);
      input.press('up', false);
      input.queue(ACTION_ENTER_CAR);
      selfNext(3);
    }
  } else if (selfStep === 3) {
    if (selfTimer === 1) {
      const ped = game.peds[0];
      ped.x = player.x + 20;
      ped.y = player.y;
      ped.dead = false;
      player.angle = 0;
      input.queue(ACTION_PUNCH);
    }
    if (selfElapsed() > 0.3) {
      selfCheck('punch-knocks-ped', game.peds[0].dead);
      selfNext(4);
    }
  } else if (selfStep === 4) {
    player.hasGun = true;
    player.ammo = 12;
    const e = game.peds[1];
    e.x = player.x + 100;
    e.y = player.y;
    e.dead = false;
    const before = player.ammo;
    doShoot(0);
    selfCheck('shoot-fires', player.ammo === before - 1);
    selfNext(5);
  } else if (selfStep === 5) {
    if (selfTimer === 1) {
      startMission(missionCtx, 0);
      const motel = buildingByKind(game.world, 'motel');
      player.x = motel.x + motel.w / 2;
      player.y = motel.y + motel.h + 60;
    }
    if (selfElapsed() > 0.6) {
      selfCheck('mission-1-completes', game.missions.completed.includes(0) && player.money >= 150);
      selfNext(6);
    }
  } else if (selfStep === 6) {
    if (selfTimer === 1) addHeat(player, 2);
    if (selfElapsed() > 4.0) {
      selfCheck('police-spawn-on-wanted', game.police.cruisers.length >= 2);
      selfCheck('wanted-stars', player.wanted >= 1);
      selfNext(7);
    }
  } else if (selfStep === 7) {
    const ok = writeSave(game);
    const back = readSave();
    selfCheck('save-roundtrip', ok && back && back.money === player.money);
    const fails = selfResults.filter((r) => r.endsWith('FAIL'));
    document.title = fails.length === 0 ? 'SELFTEST PASS ' + selfResults.length + '/' + selfResults.length : 'SELFTEST FAIL: ' + fails.join(',');
    console.log('[selftest] DONE ' + document.title);
    window.__selftest = selfResults.slice();
    selfDone = true;
  }
}

if (shot) {
  stageShot(game, shot);
  game.screen = 'play';
}
if (selftest) {
  game.screen = 'play';
}
status.textContent = 'Dustline Highway. Press Enter or click to start.';
requestAnimationFrame(frame);
