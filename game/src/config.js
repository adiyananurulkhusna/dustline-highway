// Dustline Highway — config.js
// Every tunable constant of the game in one place: world size, palette,
// player and vehicle tuning, wanted rules, mission payouts.
export const WORLD_W = 3600;
export const WORLD_H = 3600;
export const VIEW_W = 1280;
export const VIEW_H = 720;

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PALETTE = {
  sand: '#d9a05b',
  sandDark: '#c98f4e',
  sandLight: '#e8b878',
  dune: '#caa06a',
  road: '#4a4038',
  roadEdge: '#e8d27a',
  highway: '#3d3630',
  sidewalk: '#b98d5f',
  roofA: '#8a4b2d',
  roofB: '#5d6b54',
  roofC: '#7a5a34',
  roofD: '#96502e',
  water: '#3f7d8c',
  cactus: '#4e7a3a',
  rock: '#8d7a63',
  policeBlue: '#2b4acb',
  policeWhite: '#f2f2f2',
  playerShirt: '#c93b2e',
  gold: '#f2c14e',
};

export const PLAYER = {
  radius: 14,
  walkSpeed: 210,
  runSpeed: 330,
  health: 100,
  punchDamage: 25,
  punchRange: 34,
  punchCooldown: 0.35,
};

export const CAR = {
  accel: 520,
  brake: 900,
  reverseAccel: 300,
  maxSpeed: 560,
  maxReverse: 160,
  turnRate: 2.6,
  offroadFactor: 0.55,
  radius: 20,
};

// Wanted: stars 0..5. Each crime adds heat; heat decays when unseen.
export const WANTED = {
  stealCar: 1,
  hitPedestrian: 1,
  shoot: 1,
  killPedestrian: 2,
  ramPolice: 2,
  decayPerSec: 0.045,
  maxStars: 5,
  policePerStar: [0, 2, 3, 4, 5, 6],
  policeSpeed: [0, 430, 470, 510, 550, 590],
};

export const MISSION_REWARDS = [150, 300, 400, 350, 600, 1200];

export const SAVE_KEY = 'dustline-highway-save-v1';
