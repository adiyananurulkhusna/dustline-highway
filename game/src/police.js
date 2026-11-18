// Dustline Highway — police.js
// The wanted system: heat decays when the player is unseen, and the sheriff's
// cruisers spawn, chase, ram, and (on foot) bust the player.
import { WANTED } from './config.js';
import { clamp, dist2, angleDiff, pick } from './rng.js';
import { makeCar } from './traffic.js';
import { carHitsBuilding } from './world.js';

export function makePoliceState() {
  return { cruisers: [], bustTimer: 0, sirenTimer: 0, spawnTimer: 0 };
}

// Wanted heat decays only while no cruiser can see the player.
export function decayWanted(player, police, dt) {
  const seen = police.cruisers.some((c) => dist2(c.x, c.y, player.x, player.y) < 620 * 620);
  if (!seen && player.wanted > 0) {
    player.heat = Math.max(0, player.heat - WANTED.decayPerSec * dt);
    player.wanted = Math.min(WANTED.maxStars, Math.ceil(player.heat));
  }
  return seen;
}

export function wantedCruiserCount(wanted) {
  const w = Math.max(0, Math.min(WANTED.maxStars, wanted));
  return WANTED.policePerStar[w] || 0;
}

export function spawnCruiser(world, rng, player) {
  const angle = rng() * Math.PI * 2;
  const d = 700 + rng() * 300;
  const x = clamp(player.x + Math.cos(angle) * d, 80, 3520);
  const y = clamp(player.y + Math.sin(angle) * d, 80, 3520);
  const car = makeCar(rng, x, y, angle, 0, true);
  car.cruise = WANTED.policeSpeed[Math.max(1, player.wanted)] || 430;
  car.speed = car.cruise * 0.7;
  car.siren = rng() * 10;
  return car;
}

// One cruiser chases the player: steer toward them, ram on contact.
export function stepCruiser(world, car, player, dt, onRam) {
  const want = Math.atan2(player.y - car.y, player.x - car.x);
  const turn = clamp(angleDiff(car.angle, want), -3.0 * dt, 3.0 * dt);
  car.angle += turn;
  const targetSpeed = car.cruise;
  car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (carHitsBuilding(world, nx, ny, car.angle, car.len / 2, car.wid / 2)) {
    car.speed *= 0.4;
    car.angle += 0.6 * dt * (car.stuck > 0.5 ? 1 : -1);
    car.stuck += dt;
  } else {
    car.x = nx;
    car.y = ny;
    car.stuck = Math.max(0, car.stuck - dt);
  }
  car.siren += dt;
  const d = Math.hypot(player.x - car.x, player.y - car.y);
  if (d < 46) onRam(car, d);
  return d;
}

// Busted: on foot, a cruiser close by and slow starts the bust timer.
export function bustProgress(police, player, dt) {
  if (player.inCar || player.wanted === 0) {
    police.bustTimer = 0;
    return 0;
  }
  const near = police.cruisers.some((c) => {
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    return d < 70 && Math.abs(c.speed) < 120;
  });
  if (near) police.bustTimer += dt;
  else police.bustTimer = Math.max(0, police.bustTimer - dt * 2);
  return police.bustTimer;
}
