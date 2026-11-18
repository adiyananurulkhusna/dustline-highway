// Dustline Highway — shots.js
// The screenshot scenes behind ?shot=cover|highway|town|mission (with &seed=N).
// Each one stages a real, playable moment of the game — a police chase through
// town, a highway drive, a walk through town, a turf-war mission — then lets
// the normal loop run it, so the frame is a true render of the game's own code.
// The same seed always gives the same frame.
import { spawnTraffic } from './traffic.js';
import { startMission } from './missions.js';
import { addHeat } from './player.js';
import { spawnCruiser } from './police.js';

function nodeIndex(world, x, y) {
  return world.nodes.findIndex((n) => n.x === x && n.y === y);
}

function placePlayerCar(game, x, y, angle) {
  const car = game.cars.find((c) => c.parked);
  if (!car) return null;
  car.parked = false;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 420;
  car.color = '#e5382a'; // Cole's signature red coupe, easy to spot.
  game.player.inCar = car;
  car.driver = game.player;
  game.player.x = x;
  game.player.y = y;
  return car;
}

function chaseSetup(game, wanted, cruiserCount) {
  addHeat(game.player, wanted);
  game.player.wanted = wanted;
  game.police.cruisers = [];
  for (let i = 0; i < cruiserCount; i++) {
    const c = spawnCruiser(game.world, game.rng, game.player);
    c.x = game.player.x - 200 - i * 120;
    c.y = game.player.y; // on the same street, so they chase down the road
    c.angle = game.player.angle;
    c.speed = 430;
    game.police.cruisers.push(c);
  }
}

// Line traffic up along one road, in lanes, spaced out — never a pile-up.
function lineUpTraffic(game, roadY, x0, x1, count, eastFirst) {
  const fresh = spawnTraffic(game.world, game.rng, count);
  const laneA = roadY - 38;
  const laneB = roadY + 38;
  fresh.forEach((c, i) => {
    const east = (i % 2 === 0) === eastFirst;
    c.parked = false;
    c.x = x0 + ((x1 - x0) * (i + 1)) / (count + 1);
    c.y = east ? laneA : laneB;
    c.angle = east ? 0 : Math.PI;
    c.speed = c.cruise;
    c.node = nodeIndex(game.world, east ? 700 : 2450, roadY === 1950 ? 1950 : roadY);
    c.targetNode = nodeIndex(game.world, east ? 2450 : 700, roadY === 1950 ? 1950 : roadY);
    if (c.node < 0 || c.targetNode < 0) {
      c.node = 0;
      c.targetNode = 1;
    }
    game.cars.push(c);
  });
}

function hideDialogueSoon(game) {
  if (game.missions.dialogue) game.missions.dialogue.t = 8.9;
}

// Drive straight ahead for the shot: hold W, steer gently toward the road.
export function shotPilot(game) {
  if (game.shotName !== 'cover' && game.shotName !== 'highway') return;
  const input = game.input;
  const p = game.player;
  input.press('up', true);
  const ahead = p.inCar ? p.inCar : p;
  const laneY = game.shotLaneY || 1950;
  const dy = laneY - ahead.y;
  let targetAngle = ahead.angle;
  if (Math.abs(dy) > 40) targetAngle = dy > 0 ? Math.PI / 2 : -Math.PI / 2;
  let diff = targetAngle - ahead.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  input.press('left', diff < -0.08);
  input.press('right', diff > 0.08);
}

export function stageShot(game, name) {
  game.shotName = name;
  if (name === 'cover') {
    // Police chase down a town street: wanted 3, three cruisers, mission live,
    // buildings on both sides so the town reads at a glance.
    game.player.money = 1250;
    game.shotLaneY = 1300;
    placePlayerCar(game, 1050, 1300, 0);
    chaseSetup(game, 3, 3);
    lineUpTraffic(game, 1300, 1300, 2400, 5, true);
    startMission(game.missionCtx, 0);
    hideDialogueSoon(game);
    game.storm = 0.6;
    game.camera.x = game.player.x - 640;
    game.camera.y = game.player.y - 360;
  } else if (name === 'highway') {
    // Open desert highway at speed, racing the Highway King checkpoints.
    // Cole starts past checkpoint 1, chasing checkpoint 2 with traffic ahead.
    game.player.money = 640;
    game.shotLaneY = 1950;
    placePlayerCar(game, 1400, 1950, 0);
    game.player.inCar.speed = 260; // cruising, so the traffic ahead stays in frame
    lineUpTraffic(game, 1950, 1900, 2400, 5, true);
    startMission(game.missionCtx, 5);
    game.missions.step = 1; // checkpoint 2, east end, ahead of the player
    hideDialogueSoon(game);
    game.storm = 0.4;
    game.camera.x = game.player.x - 640;
    game.camera.y = game.player.y - 360;
  } else if (name === 'mission') {
    // Turf war at the diner: Vipers attacking, Cole armed, wanted 1.
    game.player.money = 980;
    game.player.hasGun = true;
    game.player.ammo = 24;
    game.player.x = 1250;
    game.player.y = 900;
    game.player.angle = -Math.PI / 2;
    addHeat(game.player, 1);
    startMission(game.missionCtx, 4);
    hideDialogueSoon(game);
    game.camera.x = game.player.x - 640;
    game.camera.y = game.player.y - 360;
  } else {
    // town: on foot by the diner, morning in Dustline, first job waiting.
    // Standing near the diner auto-starts mission 1 on the first frame.
    game.player.money = 120;
    game.player.x = 1250;
    game.player.y = 860;
    game.player.angle = -Math.PI / 2;
    game.camera.x = game.player.x - 640;
    game.camera.y = game.player.y - 360;
  }
  game.screen = 'play';
}
