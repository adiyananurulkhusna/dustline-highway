// Dustline Highway — missions.js
// The story of Dustline: courier Cole "Dusty" Reyes is dragged into the turf
// war between the Dust Vipers and the Road Kings. Six missions, each a small
// stage machine (go to, pick up, escape the law, defeat the gang, timed run).
import { MISSION_REWARDS } from './config.js';
import { dist2 } from './rng.js';
import { buildingByKind } from './world.js';
import { damagePlayer } from './player.js';

export const MISSIONS = [
  {
    title: 'First Run',
    giver: 'Mara Voss — Dustline Diner',
    brief: [
      'Mara: "Cole, you owe me one. Take this parcel to the Sunset Motel, east side."',
      'Mara: "Drive careful. The Vipers are watching every road out of town."',
    ],
    reward: MISSION_REWARDS[0],
    steps: [{ kind: 'goto', place: 'motel', label: 'Deliver the parcel to the Sunset Motel' }],
  },
  {
    title: 'Borrowed Wheels',
    giver: 'Rusty — Rusty\'s Garage',
    brief: [
      'Rusty: "The Kings took my coupe. It is parked by the Coyote Bar, purple, can\'t miss it."',
      'Rusty: "Take it back. If the law sees you, that is your problem, kid."',
    ],
    reward: MISSION_REWARDS[1],
    steps: [
      { kind: 'steal', place: 'bar', label: 'Steal back the purple coupe at the Coyote Bar' },
      { kind: 'goto', place: 'garage', label: 'Bring the coupe to Rusty\'s Garage', inCar: true },
    ],
  },
  {
    title: 'Shake the Tail',
    giver: 'Mara Voss — Dustline Diner',
    brief: [
      'Mara: "You stirred the nest, Cole. Two stars on your head and cruisers everywhere."',
      'Mara: "Lose them. Outrun them, hide in the dunes — just get clean."',
    ],
    reward: MISSION_REWARDS[2],
    steps: [{ kind: 'escape', label: 'Lose the wanted level — get clean' }],
  },
  {
    title: 'Fuel Run',
    giver: 'Mara Voss — Dustline Diner',
    brief: [
      'Mara: "The motel generator is dry and the night bus comes at dusk. Fuel cans at Dust Gas."',
      'Mara: "Ninety seconds, Cole. The desert does not wait."',
    ],
    reward: MISSION_REWARDS[3],
    steps: [
      { kind: 'goto', place: 'gas', label: 'Pick up the fuel cans at Dust Gas', timed: 90 },
      { kind: 'goto', place: 'motel', label: 'Deliver the fuel to the Sunset Motel', timed: 90 },
    ],
  },
  {
    title: 'Turf War',
    giver: 'Rusty — Rusty\'s Garage',
    brief: [
      'Rusty: "Vipers hit the diner! Four of them, right now. Mara is inside."',
      'Rusty: "Take my pistol. Make them regret ever riding into Dustline."',
    ],
    reward: MISSION_REWARDS[4],
    steps: [{ kind: 'defeat', place: 'diner', count: 4, label: 'Defend the Dustline Diner — defeat 4 Vipers' }],
  },
  {
    title: 'Highway King',
    giver: 'Mara Voss — Dustline Diner',
    brief: [
      'Mara: "Last job. The Kings run the highway tonight and the sheriff knows it."',
      'Mara: "Ride the checkpoints, reach Dust Gas, and Dustline is yours, Cole."',
    ],
    reward: MISSION_REWARDS[5],
    steps: [
      { kind: 'goto', x: 500, y: 1950, label: 'Highway checkpoint 1 — west end' },
      { kind: 'goto', x: 3100, y: 1950, label: 'Highway checkpoint 2 — east end' },
      { kind: 'goto', place: 'gas', label: 'Finish at Dust Gas — become the Highway King' },
    ],
  },
];

export function createMissionState() {
  return {
    index: -1, // -1 = no mission active; else index into MISSIONS
    step: 0,
    timer: 0,
    started: false,
    completed: [], // mission indices finished
    enemies: [],
    defeated: 0,
    failed: false,
    dialogue: null,
  };
}

export function placePoint(world, step) {
  if (step.x !== undefined) return { x: step.x, y: step.y };
  const b = buildingByKind(world, step.place);
  if (!b) return { x: 1400, y: 1000 };
  return { x: b.x + b.w / 2, y: b.y + b.h + 60 };
}

export function startMission(ctx, idx) {
  const ms = ctx.missions;
  const def = MISSIONS[idx];
  ms.index = idx;
  ms.step = 0;
  ms.started = true;
  ms.failed = false;
  ms.defeated = 0;
  ms.enemies = [];
  ms.timer = def.steps[0].timed || 0;
  ms.dialogue = { speaker: def.giver, lines: def.brief, t: 0 };
  if (idx === 2) ctx.addHeat(2); // mission 3 opens with a 2-star wanted level
  if (idx === 4) ctx.player.hasGun = true; // Rusty hands Cole a pistol
  if (idx === 5) ctx.addHeat(2);
  ctx.sounds.missionStart();
  ctx.say(def.title + ' — ' + def.giver);
}

export function currentStep(ctx) {
  const ms = ctx.missions;
  if (ms.index < 0) return null;
  return MISSIONS[ms.index].steps[ms.step] || null;
}

export function currentObjective(ctx) {
  const ms = ctx.missions;
  if (ms.index < 0) {
    if (ms.completed.length >= MISSIONS.length) return 'Story complete — Dustline is yours. Free roam!';
    return 'Visit the Dustline Diner to start the next job';
  }
  const step = currentStep(ctx);
  return step ? step.label : '';
}

export function missionMarker(ctx) {
  const step = currentStep(ctx);
  if (!step) return null;
  if (step.kind === 'escape') return null;
  if (step.kind === 'defeat') {
    const p = placePoint(ctx.world, step);
    return { x: p.x, y: p.y, label: step.label };
  }
  const p = placePoint(ctx.world, step);
  return { x: p.x, y: p.y, label: step.label };
}

function completeStep(ctx) {
  const ms = ctx.missions;
  ms.step += 1;
  const def = MISSIONS[ms.index];
  if (ms.step >= def.steps.length) {
    ctx.player.money += def.reward;
    ms.completed.push(ms.index);
    ms.dialogue = { speaker: def.giver, lines: ['Job done. $' + def.reward + ' is yours, Cole.'], t: 0 };
    ctx.say('Mission complete: ' + def.title + '  +$' + def.reward);
    ctx.sounds.cash();
    ms.index = -1;
    ms.step = 0;
    ms.enemies = [];
  } else {
    const next = def.steps[ms.step];
    ms.timer = next.timed || 0;
    ctx.say('Next: ' + next.label);
  }
}

function spawnGang(ctx, step) {
  const p = placePoint(ctx.world, step);
  const ms = ctx.missions;
  ms.enemies = [];
  for (let i = 0; i < step.count; i++) {
    ms.enemies.push({
      x: p.x + (i - step.count / 2) * 70,
      y: p.y + (i % 2) * 60 - 30,
      angle: 0, speed: 150 + i * 8, health: 60, dead: false,
      shirt: '#22201e', gang: true, attackTimer: 0, walkPhase: i,
    });
  }
}

// Advance the active mission one tick. Returns 'complete' | 'fail' | null.
export function updateMissions(ctx, dt) {
  const ms = ctx.missions;
  if (ms.index < 0) return null;
  const def = MISSIONS[ms.index];
  const step = def.steps[ms.step];
  const player = ctx.player;

  if (step.timed) {
    ms.timer -= dt;
    if (ms.timer <= 0) {
      ms.failed = true;
      ms.index = -1;
      ms.enemies = [];
      ctx.say('Too slow — the job fell through. Visit the diner to try again.');
      return 'fail';
    }
  }

  if (step.kind === 'goto' || step.kind === 'steal') {
    const p = placePoint(ctx.world, step);
    if (step.kind === 'steal') {
      if (player.inCar && player.inCar.stolenForMission) completeStep(ctx);
      return null;
    }
    const needCar = step.inCar;
    const close = dist2(player.x, player.y, p.x, p.y) < 110 * 110;
    if (close && (!needCar || player.inCar)) completeStep(ctx);
  } else if (step.kind === 'escape') {
    if (player.wanted === 0) completeStep(ctx);
  } else if (step.kind === 'defeat') {
    if (ms.enemies.length === 0) spawnGang(ctx, step);
    if (ms.defeated >= step.count) completeStep(ctx);
  }
  return null;
}

// Gang members run at the player and swing when close.
export function stepEnemies(ctx, dt) {
  const ms = ctx.missions;
  for (const e of ms.enemies) {
    if (e.dead) continue;
    const dx = ctx.player.x - e.x;
    const dy = ctx.player.y - e.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      e.angle = Math.atan2(dy, dx);
      e.x += Math.cos(e.angle) * e.speed * dt;
      e.y += Math.sin(e.angle) * e.speed * dt;
    }
    e.attackTimer -= dt;
    if (d < 40 && e.attackTimer <= 0) {
      e.attackTimer = 0.9;
      damagePlayer(ctx.player, 8);
      ctx.sounds.punch();
    }
    e.walkPhase += dt * 8;
  }
}

// The player hit an enemy: damage it, count defeats, drop a little cash.
export function damageEnemy(ctx, enemy, amount) {
  enemy.health -= amount;
  if (enemy.health <= 0 && !enemy.dead) {
    enemy.dead = true;
    ctx.missions.defeated += 1;
    ctx.player.money += 15;
    ctx.sounds.pickup();
  }
}
