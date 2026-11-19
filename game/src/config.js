// SOLARA — shared constants and data. No imports: every other module
// reads its numbers, names and mission text from here so the whole game
// agrees on one set of facts.

export const WORLD = {
  // Beach Road runs north-south at x = -250; the ocean is west of x = -275.
  beachRoadX: -250,
  oceanX: -278,
  sandX: -262,
  // Cross streets (east-west) and north-south streets, metres.
  crossZ: [-160, -80, 0, 80, 160],
  northX: [-170, -90, -10, 70, 150],
  cityHalf: 260,
  // Where Kai starts, on the Beach Road sidewalk by the pier.
  spawn: { x: -238, z: -12, heading: Math.PI / 2 },
  // Mission 1's pier target.
  pierTarget: { x: -250, z: 20 },
};

export const DISTRICTS = [
  { name: 'PIER', x0: -260, x1: -200, z0: -260, z1: 260, blurb: 'Salt air and the old boards.' },
  { name: 'BEACH ROAD', x0: -200, x1: -140, z0: -260, z1: 260, blurb: 'Palms, sand and the ocean at your shoulder.' },
  { name: 'MARINA', x0: -140, x1: -40, z0: -260, z1: -60, blurb: 'Yachts, gulls and quiet money.' },
  { name: 'DOWNTOWN', x0: -140, x1: 60, z0: -60, z1: 100, blurb: 'Glass towers and neon that never sleeps.' },
  { name: 'NORTH GATE', x0: -140, x1: 60, z0: 100, z1: 260, blurb: 'Warehouses, trucks and long shadows.' },
  { name: 'OLD TOWN', x0: 60, x1: 260, z0: -60, z1: 100, blurb: 'Brick lanes and bars with no last call.' },
  { name: 'SUNSET STRIP', x0: 60, x1: 260, z0: 100, z1: 260, blurb: 'Motels, diners and the long way home.' },
];

export const RANKS = [
  { name: 'ROOKIE', rp: 0 },
  { name: 'RUNNER', rp: 800 },
  { name: 'HUSTLER', rp: 1800 },
  { name: 'ENFORCER', rp: 3200 },
  { name: 'FIXER', rp: 5200 },
];

export const WEAPONS = [
  { slot: 1, name: 'FISTS', mag: Infinity, reserve: Infinity, damage: 12, locked: false },
  { slot: 2, name: 'VESPER 9', mag: 12, reserve: 72, damage: 34, locked: false },
  { slot: 3, name: '12G PUMP', mag: 6, reserve: 18, damage: 55, locked: true, unlockMission: 2 },
  { slot: 4, name: 'SMG', mag: 30, reserve: 90, damage: 18, locked: true, unlockMission: 4 },
  { slot: 5, name: 'AR-8', mag: 24, reserve: 48, damage: 26, locked: true, unlockMission: 6 },
];

export const CREW = [
  { key: 'Z', name: 'MARA', call: 'GHOST', desc: '-1 star, slips the tail', cooldown: 80, color: '#7fd4ff' },
  { key: 'X', name: 'SULLY', call: 'PIT CREW', desc: 'repair 100% in car', cooldown: 55, color: '#ffd34d' },
  { key: 'C', name: 'KIKI', call: 'LOOKOUT', desc: 'reveal patrols 20 s', cooldown: 70, color: '#ff9ad5' },
];

export const RADIO = [
  { name: 'PUERTO 88.3', genre: 'Golden Latin', track: 'Solara Nights — Marisol' },
  { name: 'CELESTE 98.1', genre: 'Sunset Synth', track: 'Neon Tide — Velvet Static' },
  { name: 'SOLARA 98.3', genre: 'Night Drive', track: 'Midnight Coast — The Palms' },
];

// The eight-job chain. Each mission is a list of stages; a stage is done
// when Kai (or his car) comes within its radius of its target. The last
// stage pays the reward and advances the chain.
export const MISSIONS = [
  {
    ch: 'CH.1', title: 'BACK ON THE PIER', giver: 'LUPE', role: 'FIXER · PIER SHACK',
    brief: 'Kai, you are back. Walk the pier and pick up where you left off.',
    reply: 'Back where it started. Let us see what Solara remembers.',
    stages: [{ text: 'Head to the pier marker', target: { x: -250, z: 20 }, radius: 6 }],
    reward: { money: 400, respect: 8, rp: 160 },
  },
  {
    ch: 'CH.2', title: 'BORROWED WHEELS', giver: 'LUPE', role: 'FIXER · PIER SHACK',
    brief: 'Borrow my coupe, Kai. Bring her back without a scratch — or do not come back.',
    reply: 'On it, Lupe. No scratch — I promise nothing.',
    stages: [
      { text: 'Get close to a parked car', target: { x: -238, z: 30 }, radius: 8 },
      { text: 'Drive the coupe to the beach road', target: { x: -250, z: 90 }, radius: 10 },
      { text: 'Lose the heat at the marina', target: { x: -120, z: -120 }, radius: 12 },
      { text: 'Return the coupe to Lupe', target: { x: -250, z: 20 }, radius: 8 },
    ],
    reward: { money: 1200, respect: 12, rp: 240 },
  },
  {
    ch: 'CH.3', title: 'THE MARINA LEDGER', giver: 'SULLY', role: 'MECHANIC · NORTH GATE',
    brief: 'A ledger sits in a marina office. Walk in quiet, walk out with it.',
    reply: 'Quiet is my middle name. Mostly.',
    stages: [
      { text: 'Reach the marina office', target: { x: -110, z: -140 }, radius: 8 },
      { text: 'Grab the ledger', target: { x: -110, z: -140 }, radius: 4 },
      { text: 'Bring it to Sully', target: { x: -60, z: 130 }, radius: 8 },
    ],
    reward: { money: 1500, respect: 14, rp: 280 },
  },
  {
    ch: 'CH.4', title: 'NORTH GATE RUN', giver: 'MARCO', role: 'DRIVER · OLD TOWN',
    brief: 'Ninety seconds. A package, a gate, no questions. Drive like the city is on fire.',
    reply: 'Ninety seconds is a lifetime. Watch me.',
    stages: [
      { text: 'Pick up the package', target: { x: -40, z: 140 }, radius: 8 },
      { text: 'Deliver before the clock dies', target: { x: 120, z: -40 }, radius: 10, time: 90 },
    ],
    reward: { money: 2200, respect: 18, rp: 360 },
  },
  {
    ch: 'CH.5', title: 'THE LONG WAY ROUND', giver: 'BRANDT', role: 'BROKER · DOWNTOWN',
    brief: 'Three drops, three corners of the city. The PCPD is watching the direct roads.',
    reply: 'Then I will take the scenic route. Every time.',
    stages: [
      { text: 'Drop one — Sunset Strip', target: { x: 150, z: 180 }, radius: 8 },
      { text: 'Drop two — Old Town', target: { x: 140, z: 20 }, radius: 8 },
      { text: 'Drop three — Marina', target: { x: -100, z: -180 }, radius: 8 },
    ],
    reward: { money: 2600, respect: 20, rp: 400 },
  },
  {
    ch: 'CH.6', title: 'STATIC ON THE LINE', giver: 'LUPE', role: 'FIXER · PIER SHACK',
    brief: 'Someone is listening to my phones. Find the van, take its box, bring it to me.',
    reply: 'Ears cost extra. I will collect.',
    stages: [
      { text: 'Find the listening van', target: { x: 30, z: -120 }, radius: 10 },
      { text: 'Take the box', target: { x: 30, z: -120 }, radius: 5 },
      { text: 'Bring it to the pier', target: { x: -250, z: 20 }, radius: 8 },
    ],
    reward: { money: 3000, respect: 22, rp: 440 },
  },
  {
    ch: 'CH.7', title: 'THE TIDE TURNS', giver: 'AURORA', role: 'DRIVER · MARINA',
    brief: 'The tide is coming in and so are they. Get the boat papers out of the marina.',
    reply: 'Water never stopped me. Neither will they.',
    stages: [
      { text: 'Reach the marina slips', target: { x: -130, z: -200 }, radius: 10 },
      { text: 'Grab the papers', target: { x: -130, z: -200 }, radius: 5 },
      { text: 'Escape along Beach Road', target: { x: -250, z: 140 }, radius: 12 },
    ],
    reward: { money: 3600, respect: 26, rp: 520 },
  },
  {
    ch: 'CH.8', title: 'GOLDEN HOUR', giver: 'AURORA', role: 'DRIVER · MARINA',
    brief: 'The sky is full of rotors, Kai. Finish it — tonight.',
    reply: 'One last run. Then the city is ours.',
    stages: [
      { text: 'Return to Lupe at the pier', target: { x: -250, z: 20 }, radius: 8 },
      { text: 'Head west along the beach road', target: { x: -250, z: 180 }, radius: 12 },
      { text: 'Lose the helicopter at the pier', target: { x: -250, z: -180 }, radius: 12 },
    ],
    reward: { money: 5000, respect: 30, rp: 600 },
  },
];

// Named PCPD units the HUD lists. A unit's distance and status are live.
export const UNIT_NAMES = ['PELICAN-11', 'MANTA-32', 'BARRACUDA-18', 'GECKO-25', 'TIGER-07', 'HERON-03'];

// Small seeded RNG so traffic, buildings and shots are deterministic.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2d = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
