// Dustline Highway — player.js
// The courier Cole "Dusty" Reyes: walking, running, punching, shooting,
// stealing and driving cars, with health and a wanted heat that crimes add.
import { PLAYER, CAR, WANTED } from './config.js';
import { clamp, dist2, angleDiff } from './rng.js';
import { collideCircle, carHitsBuilding, onRoad, buildingAt } from './world.js';
import { CAR_MODELS } from './traffic.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0,
    health: PLAYER.health, money: 0,
    inCar: null, // the car object when driving, else null
    punchTimer: 0, punchAnim: 0,
    shootTimer: 0, ammo: 12, hasGun: false,
    wanted: 0, heat: 0,
    invuln: 0, dead: false,
    walkPhase: 0,
  };
}

export function addHeat(player, amount) {
  player.heat = Math.min(WANTED.maxStars, player.heat + amount);
  // Ceil, not floor: one crime is one full star until the heat fully cools.
  player.wanted = Math.min(WANTED.maxStars, Math.ceil(player.heat));
}

// Drive the player's car: arcade handling, off-road slowdown, wall bumps.
export function stepDriving(world, player, car, input, dt, onCrash) {
  const road = onRoad(car.x, car.y, world.roads);
  const top = CAR.maxSpeed * (road ? 1 : CAR.offroadFactor);
  if (input.up) car.speed += CAR.accel * dt;
  else if (input.down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
  else car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 260 * dt);
  car.speed = clamp(car.speed, -CAR.maxReverse, top);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * CAR.turnRate * dt * dir * clamp(Math.abs(car.speed) / 120, 0.25, 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  if (carHitsBuilding(world, nx, ny, car.angle, car.len / 2, car.wid / 2)) {
    if (Math.abs(car.speed) > 200) onCrash(Math.abs(car.speed));
    car.speed *= -0.25;
  } else {
    car.x = nx;
    car.y = ny;
  }
  car.x = clamp(car.x, 30, 3570);
  car.y = clamp(car.y, 30, 3570);
  player.x = car.x;
  player.y = car.y;
  player.angle = car.angle;
  return car;
}

// Walk on foot. Returns nothing; moves player and resolves building collision.
export function stepWalking(world, player, input, dt) {
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  const moving = dx !== 0 || dy !== 0;
  if (moving) {
    const len = Math.hypot(dx, dy);
    dx /= len;
    dy /= len;
    const speed = input.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    player.x += dx * speed * dt;
    player.y += dy * speed * dt;
    player.angle = Math.atan2(dy, dx);
    player.walkPhase += dt * 10;
  }
  collideCircle(world, player, PLAYER.radius);
  if (player.punchTimer > 0) player.punchTimer -= dt;
  if (player.punchAnim > 0) player.punchAnim -= dt;
  if (player.shootTimer > 0) player.shootTimer -= dt;
  if (player.invuln > 0) player.invuln -= dt;
}

// Punch: hits the nearest living thing in front of the player.
export function tryPunch(player, targets, onHit) {
  if (player.punchTimer > 0 || player.inCar) return false;
  player.punchTimer = PLAYER.punchCooldown;
  player.punchAnim = 0.22;
  let best = null;
  let bestD = PLAYER.punchRange + 14;
  for (const t of targets) {
    if (t.dead || t.down) continue;
    const d = Math.hypot(t.x - player.x, t.y - player.y);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if (best) {
    onHit(best, PLAYER.punchDamage);
    return true;
  }
  return false;
}

// Shoot toward an angle: hits the first target roughly on that line.
export function tryShoot(player, angle, targets, maxRange, onHit) {
  if (player.shootTimer > 0 || !player.hasGun || player.ammo <= 0) return null;
  player.shootTimer = 0.28;
  player.ammo -= 1;
  let best = null;
  let bestD = maxRange;
  for (const t of targets) {
    if (t.dead) continue;
    const dx = t.x - player.x;
    const dy = t.y - player.y;
    const d = Math.hypot(dx, dy);
    if (d > maxRange) continue;
    const ang = Math.atan2(dy, dx);
    if (Math.abs(angleDiff(angle, ang)) < 0.12 && d < bestD) {
      bestD = d;
      best = t;
    }
  }
  const endX = player.x + Math.cos(angle) * (best ? bestD : maxRange);
  const endY = player.y + Math.sin(angle) * (best ? bestD : maxRange);
  if (best) onHit(best, 34);
  return { x: endX, y: endY, hit: !!best };
}

export function carName(car) {
  return CAR_MODELS[car.modelIdx % CAR_MODELS.length].name;
}

export function nearestCar(cars, x, y, maxD) {
  let best = null;
  let bestD = maxD;
  for (const c of cars) {
    if (c.driver) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

export function damagePlayer(player, amount) {
  if (player.invuln > 0 || player.dead) return;
  player.health -= amount;
  player.invuln = 0.5;
  if (player.health <= 0) {
    player.health = 0;
    player.dead = true;
  }
}
