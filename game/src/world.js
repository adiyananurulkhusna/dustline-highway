// Dustline Highway — world.js
// Builds the desert town of Dustline: the highway, the town street grid,
// named buildings (diner, motel, gas station, garage, sheriff office),
// cacti, rocks and dunes. Also answers collision and "on road?" queries.
import { WORLD_W, WORLD_H, PALETTE } from './config.js';
import { makeRng, range, pick, clamp } from './rng.js';

export const ROAD_W = 150;
export const HIGHWAY_W = 230;

// Town street grid (centrelines). The highway runs east-west at y=1950.
export const STREETS_X = [700, 1050, 1400, 1750, 2100, 2450];
export const STREETS_Y = [600, 950, 1300, 1650];
export const HIGHWAY_Y = 1950;

export function buildWorld(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const props = [];
  const roads = [];

  // Highway across the whole map.
  roads.push({ x: 0, y: HIGHWAY_Y - HIGHWAY_W / 2, w: WORLD_W, h: HIGHWAY_W, highway: true });
  // Town streets.
  for (const x of STREETS_X) roads.push({ x: x - ROAD_W / 2, y: 300, w: ROAD_W, h: 1650, highway: false });
  for (const y of STREETS_Y) roads.push({ x: 400, y: y - ROAD_W / 2, w: 2350, h: ROAD_W, highway: false });
  // Dirt road down to the south dunes.
  roads.push({ x: 1400 - 60, y: 1950, w: 120, h: 1300, highway: false, dirt: true });

  function addBuilding(name, x, y, w, h, color, label, kind) {
    buildings.push({ name, x, y, w, h, color, label: label || name, kind: kind || 'shop' });
  }

  // Named landmarks (story locations).
  addBuilding('Dustline Diner', 1080, 640, 220, 150, PALETTE.roofA, 'DUSTLINE DINER', 'diner');
  addBuilding('Sunset Motel', 2180, 620, 300, 150, PALETTE.roofB, 'SUNSET MOTEL', 'motel');
  addBuilding('Rusty Garage', 1480, 990, 240, 170, PALETTE.roofC, "RUSTY'S GARAGE", 'garage');
  addBuilding('Sheriff Office', 1830, 990, 200, 150, PALETTE.roofD, 'SHERIFF', 'sheriff');
  addBuilding('Gas Station', 2600, 1750, 260, 170, PALETTE.roofA, 'DUST GAS', 'gas');
  addBuilding('General Store', 760, 990, 200, 150, PALETTE.roofB, 'GENERAL STORE', 'shop');
  addBuilding('Water Tower', 2500, 1000, 90, 90, PALETTE.water, 'WATER', 'tower');
  addBuilding('Coyote Bar', 760, 1340, 210, 140, PALETTE.roofD, 'COYOTE BAR', 'bar');
  addBuilding('Dust Church', 2180, 1340, 180, 160, '#e8dcc0', 'CHAPEL', 'church');

  // Houses fill the remaining blocks.
  const houseNames = ['Casa Rosa', 'Adobe House', 'Trailer', 'Bunkhouse', 'Cabin'];
  const blocks = [];
  for (let i = 0; i < STREETS_X.length - 1; i++) {
    for (let j = 0; j < STREETS_Y.length - 1; j++) {
      const bx = STREETS_X[i] + ROAD_W / 2 + 30;
      const by = STREETS_Y[j] + ROAD_W / 2 + 30;
      const bw = STREETS_X[i + 1] - STREETS_X[i] - ROAD_W - 60;
      const bh = STREETS_Y[j + 1] - STREETS_Y[j] - ROAD_W - 60;
      blocks.push({ bx, by, bw, bh });
    }
  }
  for (const b of blocks) {
    const n = 1 + Math.floor(rng() * 2);
    for (let k = 0; k < n; k++) {
      const w = range(rng, 90, 150);
      const h = range(rng, 80, 130);
      const x = b.bx + rng() * Math.max(1, b.bw - w);
      const y = b.by + rng() * Math.max(1, b.bh - h);
      if (buildings.some((bb) => rectsOverlap(x, y, w, h, bb.x - 20, bb.y - 20, bb.w + 40, bb.h + 40))) continue;
      addBuilding(pick(rng, houseNames), x, y, w, h, pick(rng, [PALETTE.roofA, PALETTE.roofB, PALETTE.roofC, PALETTE.roofD]), null, 'house');
    }
  }

  // Desert props: cacti, rocks, dunes, bones. Dense outside town, sparse inside.
  for (let i = 0; i < 520; i++) {
    const x = rng() * WORLD_W;
    const y = rng() * WORLD_H;
    if (onRoad(x, y, roads)) continue;
    if (buildings.some((b) => x > b.x - 30 && x < b.x + b.w + 30 && y > b.y - 30 && y < b.y + b.h + 30)) continue;
    const kind = pick(rng, ['cactus', 'cactus', 'rock', 'rock', 'dune', 'bones']);
    props.push({ kind, x, y, r: kind === 'rock' ? range(rng, 14, 30) : kind === 'dune' ? range(rng, 40, 90) : range(rng, 10, 18), seed: rng() * 10 });
  }

  // Road network graph: nodes at every street/highway crossing.
  const nodes = [];
  const nodeId = {};
  function addNode(x, y) {
    const key = x + ',' + y;
    if (nodeId[key] !== undefined) return nodeId[key];
    const id = nodes.length;
    nodes.push({ x, y, links: [] });
    nodeId[key] = id;
    return id;
  }
  for (const x of STREETS_X) for (const y of STREETS_Y) addNode(x, y);
  for (const x of STREETS_X) addNode(x, HIGHWAY_Y);
  addNode(400, HIGHWAY_Y);
  addNode(3200, HIGHWAY_Y);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];
      if (a.x !== b.x && a.y !== b.y) continue;
      const between = nodes.some((n, k) => {
        if (k === i || k === j) return false;
        if (a.x === b.x) return n.x === a.x && n.y > Math.min(a.y, b.y) && n.y < Math.max(a.y, b.y);
        return n.y === a.y && n.x > Math.min(a.x, b.x) && n.x < Math.max(a.x, b.x);
      });
      if (!between) {
        a.links.push(j);
        b.links.push(i);
      }
    }
  }

  return { seed, buildings, props, roads, nodes };
}

export function rectsOverlap(x1, y1, w1, h1, x2, y2, w2, h2) {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

export function onRoad(x, y, roads) {
  for (const r of roads) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
  }
  return null;
}

export function buildingAt(world, x, y) {
  for (const b of world.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export function buildingByKind(world, kind) {
  return world.buildings.find((b) => b.kind === kind) || null;
}

// Push a circle (pos.x, pos.y, r) out of buildings and world bounds.
export function collideCircle(world, pos, r) {
  let hit = false;
  pos.x = clamp(pos.x, r, WORLD_W - r);
  pos.y = clamp(pos.y, r, WORLD_H - r);
  for (const b of world.buildings) {
    const cx = clamp(pos.x, b.x, b.x + b.w);
    const cy = clamp(pos.y, b.y, b.y + b.h);
    const dx = pos.x - cx;
    const dy = pos.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        pos.x = cx + (dx / d) * r;
        pos.y = cy + (dy / d) * r;
      } else {
        pos.x = b.x - r;
      }
    }
  }
  return hit;
}

// A car is a rotated rectangle; test its corners and centre against buildings.
export function carHitsBuilding(world, x, y, angle, halfLen, halfWid) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const pts = [
    [halfLen, halfWid], [halfLen, -halfWid], [-halfLen, halfWid], [-halfLen, -halfWid], [0, 0],
  ];
  for (const [lx, ly] of pts) {
    const px = x + lx * cos - ly * sin;
    const py = y + lx * sin + ly * cos;
    if (buildingAt(world, px, py)) return true;
  }
  return false;
}
