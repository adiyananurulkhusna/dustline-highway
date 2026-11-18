// Dustline Highway — traffic.js
// Traffic cars that follow the road graph, parked cars to steal, and
// pedestrians who stroll the sidewalks and flee from gunfire.
import { makeRng, pick, range, clamp, dist2, angleDiff } from './rng.js';
import { onRoad } from './world.js';

export const CAR_MODELS = [
  { name: 'Dusty Sedan', color: '#b8472f', len: 46, wid: 22, speed: 150 },
  { name: 'Rust Pickup', color: '#7a6a4a', len: 50, wid: 23, speed: 140 },
  { name: 'Sand Buggy', color: '#d8a13a', len: 44, wid: 24, speed: 175 },
  { name: 'Desert Van', color: '#5d7a8c', len: 54, wid: 24, speed: 125 },
  { name: 'Low Coupe', color: '#8c2f56', len: 46, wid: 22, speed: 190 },
  { name: 'Old Cruiser', color: '#4a6b4f', len: 48, wid: 23, speed: 135 },
];

export const PED_SHIRTS = ['#e8e0c8', '#7a9cc6', '#c67a3a', '#9c5a7a', '#5a8c6a', '#d8d8d8'];

export function makeCar(rng, x, y, angle, modelIdx, police) {
  const model = CAR_MODELS[modelIdx % CAR_MODELS.length];
  return {
    x, y, angle, speed: 0, modelIdx,
    color: police ? '#f2f2f2' : model.color,
    len: model.len, wid: model.wid,
    cruise: model.speed * range(rng, 0.85, 1.1),
    police: !!police,
    node: -1, targetNode: -1,
    parked: false, driver: null,
    siren: 0, stuck: 0,
  };
}

export function spawnTraffic(world, rng, count, nearX, nearY) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const node = pick(rng, world.nodes);
    const angle = pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
    const car = makeCar(rng, node.x + range(rng, -30, 30), node.y + range(rng, -30, 30), angle, Math.floor(rng() * CAR_MODELS.length), false);
    car.node = world.nodes.indexOf(node);
    car.targetNode = pick(rng, node.links);
    car.speed = car.cruise * 0.6;
    cars.push(car);
  }
  return cars;
}

export function spawnParkedCars(world, rng, count) {
  const cars = [];
  const spots = [
    { x: 1150, y: 830, a: 0 }, { x: 1250, y: 830, a: 0 },
    { x: 2250, y: 830, a: Math.PI }, { x: 2350, y: 830, a: Math.PI },
    { x: 1560, y: 1200, a: Math.PI / 2 }, { x: 1900, y: 1200, a: -Math.PI / 2 },
    { x: 2700, y: 1980, a: 0 }, { x: 2780, y: 1980, a: 0 },
    { x: 850, y: 1180, a: Math.PI / 2 }, { x: 1650, y: 700, a: 0 },
    { x: 2050, y: 1500, a: Math.PI }, { x: 900, y: 1600, a: -Math.PI / 2 },
  ];
  for (let i = 0; i < Math.min(count, spots.length); i++) {
    const s = spots[i];
    const car = makeCar(rng, s.x, s.y, s.a, i % CAR_MODELS.length, false);
    car.parked = true;
    cars.push(car);
  }
  return cars;
}

export function spawnPedestrians(world, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const node = pick(rng, world.nodes);
    peds.push({
      x: node.x + range(rng, -90, 90),
      y: node.y + range(rng, -90, 90),
      angle: rng() * Math.PI * 2,
      speed: range(rng, 35, 65),
      shirt: pick(rng, PED_SHIRTS),
      walkPhase: rng() * 10,
      flee: 0, dead: false, down: 0,
      targetX: node.x, targetY: node.y,
      retarget: rng() * 4,
    });
  }
  return peds;
}

// One traffic car follows the road graph toward its target node.
export function stepTrafficCar(world, car, dt, rng) {
  if (car.parked || car.driver) return;
  if (car.node < 0 || car.targetNode < 0) {
    // A formerly parked car joining traffic: snap it onto the nearest node.
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < world.nodes.length; i++) {
      const d = dist2(car.x, car.y, world.nodes[i].x, world.nodes[i].y);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    car.node = best;
    car.targetNode = pick(rng, world.nodes[best].links);
    return;
  }
  const target = world.nodes[car.targetNode];
  if (!target) {
    car.targetNode = pick(rng, world.nodes[car.node].links);
    return;
  }
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const d = Math.hypot(dx, dy);
  if (d < 26) {
    car.node = car.targetNode;
    const node = world.nodes[car.node];
    car.targetNode = pick(rng, node.links);
    return;
  }
  const want = Math.atan2(dy, dx);
  const turn = clamp(angleDiff(car.angle, want), -2.2 * dt, 2.2 * dt);
  car.angle += turn;
  car.speed += (car.cruise - car.speed) * Math.min(1, dt * 1.5);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (Math.abs(angleDiff(car.angle, want)) > 1.2) car.speed *= 0.96;
}

// Pedestrians wander between nearby nodes; gunfire makes them run away.
export function stepPedestrian(world, ped, dt, rng, dangerX, dangerY, dangerOn) {
  if (ped.dead) {
    ped.down += dt;
    return;
  }
  if (dangerOn && dist2(ped.x, ped.y, dangerX, dangerY) < 500 * 500) ped.flee = 2.5;
  if (ped.flee > 0) {
    ped.flee -= dt;
    const away = Math.atan2(ped.y - dangerY, ped.x - dangerX);
    ped.angle += clamp(angleDiff(ped.angle, away), -6 * dt, 6 * dt);
    ped.x += Math.cos(ped.angle) * 150 * dt;
    ped.y += Math.sin(ped.angle) * 150 * dt;
  } else {
    ped.retarget -= dt;
    if (ped.retarget <= 0 || dist2(ped.x, ped.y, ped.targetX, ped.targetY) < 30 * 30) {
      const node = pick(rng, world.nodes);
      ped.targetX = node.x + range(rng, -80, 80);
      ped.targetY = node.y + range(rng, -80, 80);
      ped.retarget = range(rng, 4, 9);
    }
    const want = Math.atan2(ped.targetY - ped.y, ped.targetX - ped.x);
    ped.angle += clamp(angleDiff(ped.angle, want), -3 * dt, 3 * dt);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
  ped.walkPhase += dt * 8;
  ped.x = clamp(ped.x, 40, 3560);
  ped.y = clamp(ped.y, 40, 3560);
}

// Keep traffic cars from piling onto each other: gentle separation.
export function separateCars(cars, dt) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      if (a.parked && b.parked) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      const min = 46;
      if (d2 < min * min && d2 > 0.01) {
        const d = Math.sqrt(d2);
        const push = ((min - d) / d) * 0.5 * dt * 60;
        a.x -= dx * push * 0.08;
        a.y -= dy * push * 0.08;
        b.x += dx * push * 0.08;
        b.y += dy * push * 0.08;
      }
    }
  }
}
