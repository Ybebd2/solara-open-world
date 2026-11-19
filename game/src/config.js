// SOLARA v3 — shared constants and a seeded random generator. Every number
// that shapes the city, the cars, the police, the missions, the radio and the
// garage lives here, so the whole game can be retuned from one file. The
// random generator is seeded, so the city is the same on every load and the
// screenshots are reproducible.
//
// v3: golden-hour clock, named districts, car types with condition, five
// weapon slots (three to unlock), garage upgrades, two radio stations,
// respect, collectibles, and the police helicopter.

export const CONFIG = {
  // City: a grid of blocks. BLOCK is the size of one city block in metres,
  // ROAD the width of the road between blocks, GRID how many blocks a side.
  BLOCK: 60,
  ROAD: 14,
  GRID: 7,
  // Buildings: height range and the palette of a sun-soaked coastal city.
  // v3: pastel pink, orange and turquoise facades with red roofs — the
  // golden-hour look, not beige cubes.
  BUILD_MIN_H: 10,
  BUILD_MAX_H: 72,
  BUILD_COLORS: [0xf2a7a0, 0xf7b267, 0x7fd1c0, 0xe88ca0, 0xf5d76e, 0x9b8cf2, 0xff9e7a, 0x6ec6e8, 0xf2c14e, 0xe07a5f],
  ROOF_COLORS: [0xc0392b, 0x8e2f23, 0xa93226, 0x7a1f1f],
  // Street life: how many traffic cars and pedestrians fill the city.
  TRAFFIC_COUNT: 16,
  PED_COUNT: 26,
  PARKED_COUNT: 12,
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
  // A police car that gets this close to the player's car is ramming it.
  POLICE_RAM_DIST: 4.5,
  // Combat.
  PISTOL_DAMAGE: 34,
  PISTOL_AMMO: 12,
  PISTOL_RANGE: 60,
  PUNCH_DAMAGE: 12,
  PUNCH_RANGE: 2.4,
  // Missions pay in cash; cash is saved with the game.
  SAVE_KEY: 'solara-save-v1',
  // --- v3: golden hour. The in-game clock starts at 17:30 (golden hour)
  // and drifts toward dusk. The sky, sun and fog follow it.
  CLOCK_START_HOURS: 17.5,
  CLOCK_SPEED: 0.004, // game-hours per real second: ~4 min to cross dusk
  DUSK_HOURS: 19.0, // headlights and neon come on past this
  // --- v3: respect 0..100, grows on escapes and missions.
  RESPECT_PER_MISSION: 6,
  RESPECT_PER_ESCAPE: 5,
  ESCAPE_REWARD_CASH: 250,
  // --- v3: collectibles — Sunset Shards hidden around the city.
  COLLECTIBLE_COUNT: 10,
  COLLECTIBLE_REWARD: 50,
  // --- v3: the police helicopter joins at 3+ stars.
  HELI_MIN_STARS: 3,
  HELI_HEIGHT: 42,
  HELI_SPEED: 26,
};

// Named districts: rectangles in world space. districtAt() in world.js maps
// a position to one of these names for the HUD and the map.
export const DISTRICTS = [
  { name: 'The Beach', x0: -260, x1: 260, z0: 180, z1: 320 },
  { name: 'Malecon', x0: -260, x1: 260, z0: 130, z1: 180 },
  { name: 'Neon Row', x0: -90, x1: 90, z0: -40, z1: 90 },
  { name: 'Palm Heights', x0: -260, x1: -90, z0: -260, z1: 130 },
  { name: 'Old Port', x0: 90, x1: 260, z0: -260, z1: 130 },
  { name: 'Downtown', x0: -90, x1: 90, z0: -260, z1: -40 },
];

// Car types: a proper shape per type, not one box for everything. The
// pickup has a pink cabin and an orange bed; the van is tall; the sports car
// is low with a spoiler.
export const CAR_TYPES = {
  sedan: { name: 'Comet', bodyH: 0.75, cabinH: 0.65, spoiler: false, bed: false },
  sports: { name: 'Vortex GT', bodyH: 0.6, cabinH: 0.5, spoiler: true, bed: false },
  pickup: { name: 'Marlin', bodyH: 0.8, cabinH: 0.7, spoiler: false, bed: true },
  van: { name: 'Boulevard', bodyH: 1.15, cabinH: 0.6, spoiler: false, bed: false },
};
export const CAR_COLORS = [0xc0392b, 0x2e6db4, 0xe8e8e8, 0x222222, 0xf5c542, 0x7a4a9e, 0x2e8b57, 0xd96c2b, 0x5a6b7a, 0xf27ea9, 0xff7a1a, 0x19b5a6];

// Weapon slots 1-5. Slots 1 and 2 are owned from the start; 3-5 are locked
// until the player buys them (press the number key, cash is deducted).
export const WEAPONS = [
  { id: 'fists', name: 'FISTS', price: 0, ammo: Infinity, damage: 12, range: 2.4, locked: false },
  { id: 'pistol', name: 'PISTOL', price: 0, ammo: 12, damage: 34, range: 60, locked: false },
  { id: 'smg', name: 'SMG', price: 500, ammo: 30, damage: 18, range: 55, locked: true },
  { id: 'shotgun', name: 'SHOTGUN', price: 800, ammo: 8, damage: 60, range: 28, locked: true },
  { id: 'rifle', name: 'RIFLE', price: 1200, ammo: 10, damage: 55, range: 90, locked: true },
];

// Sully's Garage upgrades. Each applies to the car the player is driving.
export const GARAGE_UPGRADES = [
  { id: 'engine', name: 'Turbo Engine', desc: '+25% top speed', price: 600 },
  { id: 'armor', name: 'Reinforced Armor', desc: 'Condition restored + tougher', price: 400 },
  { id: 'paint', name: 'Sunset Paint', desc: 'A fresh golden paint job', price: 200 },
];

// Radio stations. Each has a name, a frequency, and a song list; the melody
// is a synthesized note pattern, a different key per station.
export const RADIO = [
  {
    id: 'solara-fm',
    name: 'SOLARA FM',
    freq: '98.1',
    tag: 'Sunset Drive',
    songs: [
      { artist: 'The Palms', title: 'Golden Hour' },
      { artist: 'Velvet Coast', title: 'Neon Skyline' },
      { artist: 'Marisol', title: 'Palm Shadows' },
    ],
    // A major-key sunset melody (frequencies in Hz).
    notes: [523, 659, 784, 659, 880, 784, 659, 523, 587, 659, 784, 880, 784, 659, 587, 523],
  },
  {
    id: 'neon-fm',
    name: 'NEON',
    freq: '101.5',
    tag: 'Night Pulse',
    songs: [
      { artist: 'Chrome Hearts', title: 'Midnight Run' },
      { artist: 'Luna Ray', title: 'Afterglow' },
      { artist: 'The Vandals', title: 'Street Lights' },
    ],
    // A minor-key night drive.
    notes: [440, 523, 659, 523, 587, 523, 440, 392, 440, 523, 587, 659, 587, 523, 440, 392],
  },
];

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
