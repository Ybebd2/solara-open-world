// SOLARA — config for the @witty-meteor-32 build.
// Everything tunable lives here: the island layout, the beach boulevard,
// districts, the eight-job chain, crew, cars, weapons, radio, ranks.
// Numbers are the game's contract — the shots and the GTA-core checks
// stage against them — so they match the design doc exactly.

export const WORLD = {
  half: 200,
  streetStep: 40,
  streetMin: -160,
  streetMax: 160,
  // The ocean is west (negative x). The pier runs west off the beach.
  beachX: -180,
  oceanX: -320,
  pier: { x0: -262, x1: -178, z: 20, width: 12 },
  northGate: { x: 0, z: -196 },
  garage: { x: 60, z: -120 },
};

// The beach road at x = -160 is a 4-lane boulevard: two lanes each way,
// 3.5 m a lane, 14 m of asphalt. Southbound (heading +z) runs the west
// lanes; northbound the east lanes. The double yellow sits on the centre
// line; dashed white splits each direction's pair.
export const BEACH_ROAD = {
  x: -160,
  halfWidth: 7,
  southLeft: -165.25,
  southRight: -161.75,
  northLeft: -158.25,
  northRight: -154.75,
  centreYellow: [-160.45, -159.55],
  laneDividers: [-163.5, -156.5],
};

// Seven districts. Rects tile the island; the first match wins, so the
// order resolves the overlapping edges.
export const DISTRICTS = [
  { name: 'PIER',         x0: -280, x1: -180, z0: -20,  z1: 60,  color: 0x2a7a8a, desc: 'Lupe’s shack and the old wooden pier.' },
  { name: 'BEACH ROAD',   x0: -220, x1: -150, z0: -160, z1: 160, color: 0xc9a86a, desc: 'Palms, sand and the ocean at your shoulder.' },
  { name: 'MARINA',       x0: -150, x1: -120, z0: -160, z1: 160, color: 0x3a6a9a, desc: 'Boats, bait shops and quiet money.' },
  { name: 'DOWNTOWN',     x0: -120, x1: 120,  z0: -120, z1: 120, color: 0xb8860b, desc: 'Neon, traffic and everybody’s business.' },
  { name: 'NORTH GATE',   x0: -120, x1: 200,  z0: -200, z1: -120, color: 0x7a7a8a, desc: 'The way out — if the gate stays open.' },
  { name: 'OLD TOWN',     x0: -200, x1: -120, z0: 120,  z1: 200, color: 0xa06a7a, desc: 'Tile roofs and grandmothers who see everything.' },
  { name: 'SUNSET STRIP', x0: -120, x1: 200,  z0: 120,  z1: 200, color: 0x8a6aa8, desc: 'Bars, arcades and the last light of the day.' },
];

export function standingLabel(v) {
  if (v >= 70) return 'FRIENDLY';
  if (v >= 40) return 'NEUTRAL';
  return 'WARY';
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  }
  return 'DOWNTOWN';
}

export function districtInfo(x, z) {
  const hit = DISTRICTS.find((d) => x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1);
  return hit || DISTRICTS[3];
}

// Map landmarks: letter chip + colour, drawn on the minimap and the
// full map. Positions are world coordinates.
export const LANDMARKS = [
  { id: 'safehouse', icon: 'H', label: 'SAFEHOUSE',  name: 'Solara Loft',    x: -140, z: -140, color: '#7dff8a' },
  { id: 'police',    icon: 'P', label: 'POLICE',     name: 'PCPD HQ',        x: 40,   z: -40,  color: '#ff5d5d' },
  { id: 'gunshop',   icon: 'G', label: 'GUN SHOP',   name: 'Iron & Ivory',   x: -40,  z: 120,  color: '#c99aff' },
  { id: 'respray',   icon: 'R', label: 'RESPRAY',    name: 'Sully’s Garage', x: 60,   z: -120, color: '#ffb347' },
  { id: 'boatyard',  icon: 'B', label: 'BOATYARD',   name: 'Marina Boatyard', x: -140, z: 60,   color: '#7db8ff' },
  { id: 'export',    icon: 'E', label: 'CAR EXPORT', name: 'Port Export',    x: -235, z: -50,  color: '#5ed9d9' },
];

export const SIDE_JOBS = [
  { id: 'side1', icon: '$', label: 'SIDE JOB', name: 'Courier Run', x: 120, z: 120, color: '#ffd23f' },
  { id: 'side2', icon: '$', label: 'SIDE JOB', name: 'Night Watch', x: -80, z: 160, color: '#ffd23f' },
];

// The 8-job chain runs in four acts of two jobs.
export const ACTS = [
  { act: 'ACT I',   title: 'HOMECOMING',      from: 0 },
  { act: 'ACT II',  title: 'SULLY’S FAVOUR',  from: 2 },
  { act: 'ACT III', title: 'BEACH GETAWAY',   from: 4 },
  { act: 'ACT IV',  title: 'MARA’S CALL',     from: 6 },
];

export function actFor(missionIndex) {
  let current = ACTS[0];
  for (const a of ACTS) {
    if (missionIndex >= a.from) current = a;
  }
  return current;
}

// Crew on Z / X / C. Loyalty 0–10 (+1 per finished job) trims each
// cooldown 3% a point, never below half the base cooldown.
export const CREW = [
  { key: 'Z', name: 'MARA',  call: 'GHOST',    desc: 'Cut 1 wanted star',     cooldown: 80, duration: 0 },
  { key: 'X', name: 'SULLY', call: 'PIT CREW', desc: 'Repair car to 100%',    cooldown: 55, duration: 0 },
  { key: 'C', name: 'KIKI',  call: 'LOOKOUT',  desc: 'Reveal all patrols 20s', cooldown: 70, duration: 20 },
];

export function crewCooldown(c, loyalty) {
  const lv = clamp(loyalty || 0, 0, 10);
  return Math.max(c.cooldown * 0.5, c.cooldown * (1 - lv * 0.03));
}

// In-game clock: starts 17:25, full dusk at 19:22.
export const CLOCK = { startHours: 17 + 25 / 60, duskHours: 19 + 22 / 60, secondsPerHour: 240 };

export const CAR_TYPES = {
  sedan:  { name: 'Vesper',   label: 'SEDAN',  topSpeed: 26, accel: 14, grip: 2.6, color: 0x3f6fb5 },
  pickup: { name: 'Bruto',    label: 'PICKUP', topSpeed: 24, accel: 12, grip: 2.2, color: 0xd76a9e },
  sports: { name: 'Fathom',   label: 'SPORTS', topSpeed: 34, accel: 20, grip: 3.4, color: 0xe86a2a },
  police: { name: 'PCPD Interceptor', label: 'POLICE', topSpeed: 30, accel: 18, grip: 3.0, color: 0xe8e8e8 },
  taxi:   { name: 'Sol Cab',  label: 'TAXI',   topSpeed: 24, accel: 12, grip: 2.4, color: 0xe8b93a },
  van:    { name: 'Cargovan', label: 'VAN',    topSpeed: 22, accel: 10, grip: 2.0, color: 0xe8e8e8 },
};

export const WEAPONS = [
  { slot: 1, name: 'FISTS',    ammo: Infinity, reserve: Infinity, locked: false },
  { slot: 2, name: 'VESPER 9', ammo: 12,       reserve: 60,       locked: false },
  { slot: 3, name: '12G PUMP', ammo: 18,       reserve: 0,        locked: true },
  { slot: 4, name: 'SMG',      ammo: 30,       reserve: 60,       locked: true },
  { slot: 5, name: 'AR-8',     ammo: 24,       reserve: 0,        locked: true },
];

export const RADIO = [
  { freq: 'PUERTO 88.3',  genre: 'Golden Latin', songs: ['Solara Nights — Marisol', 'Golden Coast — The Palms', 'Neon Tide — Vega Blue'] },
  { freq: 'CELESTE 98.1', genre: 'Sunset Synth', songs: ['Midnight Mirage — Celeste', 'Afterglow — Luna Park', 'Sunset Run — The Comets'] },
  { freq: 'SOLARA 98.3',  genre: 'Night Drive',  songs: ['Neon Coast — The Palms', 'Afterglow — Luna Park', 'Midnight Mirage — Celeste'] },
];

// Missions. Stages are display bands by distance to the target — they
// never gate completion. A stage is the LAST band whose max distance
// still covers the player's distance, so teleporting to the target
// jumps to the final stage and the job completes as normal.
export const MISSIONS = [
  { id: 1, title: 'HOMECOMING', contact: 'Lupe', objective: 'Meet Lupe at the end of the pier', target: { x: -250, z: 20 }, radius: 7, reward: 400, respect: 20, say: 'Kai. You made it home. The city missed you — and so did I.',
    stages: [{ max: 999, text: 'Head west down the pier' }, { max: 25, text: 'Meet Lupe at the end of the pier' }] },
  { id: 2, title: 'BORROWED WHEELS', contact: 'Lupe', objective: 'Borrow a car — carjack any parked car', target: { x: -160, z: 60 }, radius: 10, reward: 1200, respect: 12, say: 'Wheels first. Take anything with four doors. Try not to make it personal.',
    stages: [{ max: 999, text: 'Find a car on the street' }, { max: 120, text: 'Head to the beach road' }, { max: 40, text: 'Get close to a parked car' }, { max: 0, text: 'Carjack any parked car' }] },
  { id: 3, title: "SULLY'S FAVOUR", contact: 'Sully', objective: 'Drive to Sully’s garage', target: { x: 60, z: -120 }, radius: 9, reward: 300, respect: 15, say: 'Kai! The Bruto needs a look. Bring it round back, no questions.',
    stages: [{ max: 999, text: 'Drive to Sully’s garage' }, { max: 120, text: 'Cut through downtown' }, { max: 40, text: 'Pull into the garage' }] },
  { id: 4, title: 'NORTH GATE RUN', contact: 'Marco', objective: 'Deliver the package to the North Gate in 90 seconds', target: { x: 0, z: -196 }, radius: 8, reward: 600, respect: 25, timer: 90, say: 'Ninety seconds, Kai. The gate closes. Do not stop for anyone.',
    stages: [{ max: 999, text: 'Gun it to the North Gate' }, { max: 120, text: 'Through downtown — don’t stop' }, { max: 40, text: 'Deliver the package at the gate' }] },
  { id: 5, title: 'BEACH GETAWAY', contact: 'Aurora', objective: 'Lose the cops on the beach road', target: { x: -170, z: 140 }, radius: 12, reward: 800, respect: 30, say: 'They are on you. Beach road, full throttle — I will meet you at the pier.',
    stages: [{ max: 999, text: 'Lose the cops on the beach road' }, { max: 100, text: 'Keep moving — they’re closing in' }, { max: 40, text: 'Reach the beach rendezvous' }] },
  { id: 6, title: 'BRANDT’S DEBT', contact: 'Brandt', objective: 'Collect from Brandt’s man downtown', target: { x: 40, z: 40 }, radius: 8, reward: 700, respect: 20, say: 'Brandt pays his debts. Make sure his man knows the same.',
    stages: [{ max: 999, text: 'Drive downtown to Brandt’s man' }, { max: 100, text: 'Find the man downtown' }, { max: 40, text: 'Collect the debt' }] },
  { id: 7, title: 'MARA’S CALL', contact: 'Mara', objective: 'Meet Mara at the marina', target: { x: -150, z: -100 }, radius: 8, reward: 900, respect: 25, say: 'You always did like the water at dusk. I have a job that pays real money.',
    stages: [{ max: 999, text: 'Meet Mara at the marina' }, { max: 80, text: 'Cut across the marina' }, { max: 40, text: 'Find Mara by the water' }] },
  { id: 8, title: 'GOLDEN HOUR', contact: 'Lupe', objective: 'Return to Lupe at the pier — the city is yours', target: { x: -250, z: 20 }, radius: 7, reward: 1500, respect: 50, say: 'Look at that sky, Kai. Solara is ours now. Every light, every street.',
    stages: [{ max: 999, text: 'Return to Lupe at the pier' }, { max: 80, text: 'Head west along the beach road' }, { max: 40, text: 'Meet Lupe — the city is yours' }] },
];

// PCPD pursuit units. Cruisers take the first four in order; officers on
// foot take the last two; the helicopter is AIR-1. Roles drive the live
// status words: RAMMING / FLANKING / PURSUIT / SEARCHING; a cruiser
// whose condition hits 0 reads WRECKED.
export const PCPD_UNITS = [
  { name: 'PELICAN-11', role: 'PURSUIT' },
  { name: 'MANTA-32', role: 'SEARCHING' },
  { name: 'BARRACUDA-18', role: 'RAMMING' },
  { name: 'GECKO-25', role: 'CHASE' },
  { name: 'VIPER-07', role: 'FLANKING' },
  { name: 'SHARK-22', role: 'RAMMING' },
  { name: 'HAMMER-04', role: 'PURSUIT' },
  { name: 'KITE-1', role: 'MARKSMAN' },
  { name: 'MARLIN-3', role: 'SHORE WATCH' },
];
export const PCPD_AIR = { name: 'AIR-1', role: 'AIR' };

// Street rank, driven by RP. RP grows on job completion (respect × 20)
// and on escapes (+150).
export const RANKS = [
  { name: 'ROOKIE', at: 0 },
  { name: 'RUNNER', at: 800 },
  { name: 'HUSTLER', at: 1800 },
  { name: 'ENFORCER', at: 3200 },
  { name: 'FIXER', at: 5200 },
];

export function rankFor(rp) {
  let r = 0;
  for (let i = 0; i < RANKS.length; i++) if (rp >= RANKS[i].at) r = i;
  const next = r + 1 < RANKS.length ? RANKS[r + 1].at : null;
  return { index: r, name: RANKS[r].name, next };
}

export function condLabel(cond) {
  if (cond >= 80) return 'PRISTINE';
  if (cond >= 50) return 'DENTED';
  if (cond >= 25) return 'SMOKING';
  return 'WRECKED';
}

// Short-way hue interpolation: goes through red (0/360), never green.
export function hueLerp(h1, h2, t) {
  let d = ((h2 - h1 + 540) % 360) - 180;
  return (((h1 + d * t) % 360) + 360) % 360;
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2d(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return Math.sqrt(dx * dx + dz * dz); }
export function rand(a, b) { return a + Math.random() * (b - a); }
export function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
