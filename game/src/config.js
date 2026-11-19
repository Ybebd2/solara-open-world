// SOLARA — shared constants and a seeded random generator. Every number that
// shapes the city, the cars, the police and the missions lives here, so the
// whole game can be retuned from one file. The random generator is seeded, so
// the city is the same on every load and the screenshots are reproducible.

export const CONFIG = {
  // City: a grid of blocks. BLOCK is the size of one city block in metres,
  // ROAD the width of the road between blocks, GRID how many blocks a side.
  BLOCK: 60,
  ROAD: 14,
  GRID: 7,
  // Buildings: height range and the palette of a sun-soaked coastal city.
  BUILD_MIN_H: 10,
  BUILD_MAX_H: 64,
  BUILD_COLORS: [0xd8c9a3, 0xc9b18c, 0xe8dcc0, 0xb8a888, 0xd9c2a8, 0xcbb59a, 0xe0cfa8, 0xbf9f7a],
  // Player on foot.
  WALK_SPEED: 7,
  RUN_SPEED: 12,
  JUMP_SPEED: 9,
  GRAVITY: 26,
  PLAYER_HEALTH: 100,
  // Cars: arcade handling, metres per second.
  CAR_TOP_SPEED: 38,
  CAR_ACCEL: 22,
  CAR_BRAKE: 34,
  CAR_STEER: 1.9,
  CAR_REVERSE_SPEED: 12,
  // Wanted: stars 0-5. Each crime adds heat; heat decays when the player is
  // quiet and out of sight. Police spawn while wanted > 0.
  WANTED_MAX: 5,
  HEAT_PER_CAR_STEAL: 1,
  HEAT_PER_PEDESTRIAN_HIT: 1,
  HEAT_PER_POLICE_HIT: 1,
  HEAT_DECAY_PER_SEC: 0.06,
  POLICE_CAR_SPEED: 34,
  POLICE_FOOT_SPEED: 8,
  // Combat.
  PISTOL_DAMAGE: 34,
  PISTOL_AMMO: 12,
  PISTOL_RANGE: 60,
  PUNCH_DAMAGE: 12,
  PUNCH_RANGE: 2.4,
  // Missions pay in cash; cash is saved with the game.
  SAVE_KEY: 'solara-save-v1',
};

// mulberry32: a small seeded generator. seed is a number; next() returns a
// float in [0, 1). The same seed always gives the same city.
export function makeRandom(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick one item from an array with a seeded random.
export function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length)];
}

// Clamp a number between lo and hi.
export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Move a value toward a target by at most step (frame-rate independent).
export function approach(v, target, step) {
  if (v < target) return Math.min(v + step, target);
  if (v > target) return Math.max(v - step, target);
  return v;
}

// Shortest signed angle difference, in radians.
export function angleDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
