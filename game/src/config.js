// SOLARA — shared constants and helpers.
// A golden-hour coastal city: Kai Mercer, fixer Lupe, the PCPD, 7 districts.

export const WORLD = {
  size: 640,            // playable ground spans -320..320 on x and z
  roadHalf: 7,          // half-width of a road lane pair
  block: 64,            // city block pitch
  pierX: -250, pierZ: 20,
  spawnX: -238, spawnZ: -12,
  garageX: 60, garageZ: -120,
  oceanX: 250,          // beach / ocean starts east of this
};

export const DISTRICTS = [
  { id: 'PIER',        name: 'PIER',        x0: -320, z0: -80,  x1: -180, z1: 120 },
  { id: 'BEACH',       name: 'BEACH ROAD',  x0: 180,  z0: -320, x1: 320,  z1: 320 },
  { id: 'MARINA',      name: 'MARINA',      x0: -180, z0: 120,  x1: 60,   z1: 320 },
  { id: 'DOWNTOWN',    name: 'DOWNTOWN',    x0: -60,  z0: -140, x1: 180,  z1: 60 },
  { id: 'NORTHGATE',   name: 'NORTH GATE',  x0: -180, z0: -320, x1: -60,  z1: -140 },
  { id: 'OLDTOWN',     name: 'OLD TOWN',    x0: -320, z0: -320, x1: -180, z1: -80 },
  { id: 'SUNSET',      name: 'SUNSET STRIP',x0: -60,  z0: 60,   x1: 180,  z1: 320 },
];

export const WEAPONS = [
  { id: 1, name: 'FISTS',    label: 'FISTS',    ammo: Infinity, unlock: 0 },
  { id: 2, name: 'VESPER 9', label: 'VESPER 9', ammo: 12,       unlock: 0 },
  { id: 3, name: 'MAKO',     label: 'MAKO',     ammo: 24,       unlock: 2 },
  { id: 4, name: 'BREAKER',  label: 'BREAKER',  ammo: 8,        unlock: 4 },
  { id: 5, name: 'KESTREL',  label: 'KESTREL',  ammo: 30,       unlock: 6 },
];

export const CREW = [
  { key: 'Z', id: 'MARA',  name: 'MARA / GHOST',    desc: '−1 star',        cooldown: 80 },
  { key: 'X', id: 'SULLY', name: 'SULLY / PIT CREW', desc: 'repair car 100%', cooldown: 55 },
  { key: 'C', id: 'KIKI',  name: 'KIKI / LOOKOUT',  desc: 'reveal patrols',  cooldown: 70 },
];

export const RANKS = [
  { name: 'ROOKIE',   rp: 0 },
  { name: 'RUNNER',   rp: 800 },
  { name: 'HUSTLER',  rp: 1800 },
  { name: 'ENFORCER', rp: 3200 },
  { name: 'FIXER',    rp: 5200 },
];

export const RADIO = [
  { name: 'PUERTO 88.3',  song: 'Fog over Dock 9 · Pelícano' },
  { name: 'CELESTE 98.1', song: 'Neon Tide · Marina Luz' },
  { name: 'SOLARA 98.3',  song: 'Night Drive · Vesper Coast' },
];

export const GARAGE_UPGRADES = [
  { id: 'engine', name: 'Tuned Engine',  desc: '+15% top speed',        cost: 400 },
  { id: 'armor',  name: 'Armour Plating', desc: '+40 condition, rams hurt less', cost: 350 },
  { id: 'paint',  name: 'Sunset Paint',  desc: 'Gold flake, +10 respect', cost: 200 },
];

export const UNIT_NAMES = [
  'PELICAN-11', 'MANTA-32', 'BARRACUDA-18', 'GECKO-25',
  'FALCON-07', 'OSPREY-21', 'STINGRAY-04', 'HERON-19',
];

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// Deterministic PRNG so ?seed=1 renders the same city every run.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function fmtMoney(n) {
  return '$' + Math.round(n).toLocaleString('en-US');
}

export function fmtClock(hours) {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
  }
  return DISTRICTS[3];
}
