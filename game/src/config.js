// SOLARA shared constants — golden-hour coastal city, Kai Mercer.
// All tuning lives here so the other systems read one source of truth.
export const WORLD = {
  // Playable bounds (metres). Beach road runs east-west along z = 0.
  minX: -320, maxX: 320, minZ: -260, maxZ: 260,
  // Golden-hour clock: day starts 17:25, dusk deepens toward 19:22.
  startHours: 17.42, duskStart: 18.0, duskSpan: 1.5,
  // Sea is to the south (positive z is inland/north in our layout).
  seaZ: 150,
};

export const DISTRICTS = [
  { name: 'PIER', x: -250, z: 20, standing: 55 },
  { name: 'BEACH ROAD', x: -80, z: 40, standing: 55 },
  { name: 'MARINA', x: 180, z: 90, standing: 55 },
  { name: 'DOWNTOWN', x: 40, z: -40, standing: 55 },
  { name: 'NORTH GATE', x: -40, z: -180, standing: 55 },
  { name: 'OLD TOWN', x: -180, z: -120, standing: 55 },
  { name: 'SUNSET STRIP', x: 220, z: -140, standing: 55 },
];

export const RANKS = [
  { name: 'ROOKIE', at: 0 },
  { name: 'RUNNER', at: 800 },
  { name: 'HUSTLER', at: 1800 },
  { name: 'ENFORCER', at: 3200 },
  { name: 'FIXER', at: 5200 },
];

export const WEAPONS = [
  { slot: 1, name: 'FISTS', ammo: Infinity, reserve: Infinity, locked: false },
  { slot: 2, name: 'VESPER 9', ammo: 12, reserve: 71, locked: false },
  { slot: 3, name: 'MAKO', ammo: 0, reserve: 0, locked: true },
  { slot: 4, name: 'BREAKER', ammo: 0, reserve: 0, locked: true },
  { slot: 5, name: 'KESTREL', ammo: 0, reserve: 0, locked: true },
];

export const RADIO = [
  { name: 'PUERTO 88.3', track: 'Fog over Dock 9 · Pelícano' },
  { name: 'CELESTE 98.1', track: 'Golden Static · Marisol' },
  { name: 'SOLARA 98.3', track: 'Night Drive · Vesper Coast' },
];

export const PCPD_UNITS = [
  { id: 'PELICAN-11', kind: 'cruiser' },
  { id: 'MANTA-32', kind: 'cruiser' },
  { id: 'BARRACUDA-18', kind: 'cruiser' },
  { id: 'GECKO-25', kind: 'cruiser' },
];

export const CREW = {
  Z: { name: 'MARA', call: 'GHOST', desc: '−1 star', cooldown: 80, need: 'no cruiser within 30 m' },
  X: { name: 'SULLY', call: 'PIT CREW', desc: 'repair 100% in car', cooldown: 55 },
  C: { name: 'KIKI', call: 'LOOKOUT', desc: 'reveal patrols 20 s', cooldown: 70 },
};

// 8-job chain. Mission 4 is the 90 s timed delivery.
export const MISSIONS = [
  { ch: 'CH.1', title: 'HOMECOMING', giver: 'Lupe', stages: 4, reward: 400, respect: 10, target: { x: -250, z: 20 }, next: 'Meet Lupe at the Pier Shack.' },
  { ch: 'CH.2', title: 'BORROWED WHEELS', giver: 'Lupe', stages: 4, reward: 1200, respect: 12, target: { x: -80, z: 40 }, next: 'Repo the orange coupe off Beach Road. Bring it back clean.' },
  { ch: 'CH.3', title: 'SHARK TAX', giver: 'Lupe', stages: 4, reward: 1500, respect: 14, target: { x: 40, z: -40 }, next: 'Collect from the three stalls on Sunset Strip. No receipts.' },
  { ch: 'CH.4', title: 'TIDE RUNNER', giver: 'Marco', stages: 4, reward: 2000, respect: 15, target: { x: 180, z: 90 }, timed: 90, next: 'A 90-second delivery across town. The tide waits for no one.' },
  { ch: 'CH.5', title: 'DIRTY BADGE', giver: 'Brandt', stages: 5, reward: 2600, respect: 18, target: { x: -40, z: -180 }, next: 'Lean on the badge. Quietly.' },
  { ch: 'CH.6', title: 'DOCKSIDE AMBUSH', giver: 'Marco', stages: 5, reward: 3200, respect: 18, target: { x: 220, z: -140 }, next: 'They set the trap. Spring it first.' },
  { ch: 'CH.7', title: 'NEON NIGHTS', giver: 'Aurora', stages: 3, reward: 5000, respect: 25, target: { x: -180, z: -120 }, next: 'Light up Old Town and make it stick.' },
  { ch: 'CH.8', title: 'GOLDEN HOUR', giver: 'Lupe', stages: 4, reward: 8000, respect: 30, target: { x: -250, z: 20 }, next: 'One last job. Then the city is yours.' },
];

export const PALETTE = {
  skyDay: 0xffd9a0, skyDusk: 0x2a1a3a, sun: 0xffb347,
  asphalt: 0x2e3440, sidewalk: 0xd8c9a3, sand: 0xe8d5a8, ocean: 0x2a7f8f,
  building: [0xe8a0b4, 0xf2c14e, 0x7fb3d5, 0xd98880, 0xa569bd, 0x85c1e9, 0xf0a868],
  neonPink: 0xff4fa3, neonTeal: 0x2ee6c8, neonAmber: 0xffb347,
  cruiserWhite: 0xf5f5f0, gold: 0xffd700, red: 0xe63946,
};

export const TUNING = {
  walkSpeed: 6, sprintSpeed: 10, carAccel: 14, carTop: 26, carBrake: 30,
  cruiserTop: 13, cruiserAccel: 10, cruiserSpawnDist: [90, 130],
  officerSpeed: 5, heliHeight: 55, heliSpeed: 16,
  shotDamage: 34, officerHealth: 100,
  evadeFillFar: 3, evadeDrainNear: 12, sightCruiser: 55, sightOfficer: 35,
  ghostBlockDist: 30, crewLoyaltyFloor: 50,
};
