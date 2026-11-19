// SOLARA v3 — the city. A procedural sun-soaked coastal city at golden
// hour: a grid of blocks with roads between them, pastel buildings with red
// roofs and neon signs, palms, streetlights, a beach and a pier on the south
// side, and the ocean beyond. Everything is built from three.js geometry
// with materials made in code — no external assets, so the game runs offline.
//
// v3: an in-game clock drives golden hour into dusk — the sky, sun, fog and
// streetlights all follow it; buildings are detailed (setbacks, red roof
// trim, rooftop plant, neon signs, named landmarks) instead of plain boxes;
// the sidewalks are purple; named districts cover the map; ten Sunset Shard
// collectibles are hidden around the city. The module hands the rest of the
// game the road network (for traffic), the building footprints (for
// collision), named places (for missions) and the district lookup.

import * as THREE from 'three';
import { CONFIG, DISTRICTS, makeRandom, pick, clamp } from './config.js';

// A canvas texture of windows: warm lit glass on a coloured facade. One
// texture is shared by every building; the building's own colour tints it.
function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 256);
  const rand = makeRandom(99);
  for (let y = 8; y < 248; y += 18) {
    for (let x = 8; x < 120; x += 18) {
      const lit = rand() < 0.45;
      g.fillStyle = lit ? '#ffd98a' : '#3a2a3a';
      g.fillRect(x, y, 12, 12);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  return t;
}

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#33313a';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#f5c542';
  g.fillRect(30, 0, 4, 28);
  g.fillRect(30, 36, 4, 28);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 8);
  return t;
}

// A neon sign: glowing coloured text on a dark plate, mounted on a facade.
function makeNeonTexture(text, colour) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#140a1e';
  g.fillRect(0, 0, 256, 64);
  g.font = 'bold 34px system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = colour;
  g.shadowBlur = 18;
  g.fillStyle = colour;
  g.fillText(text, 128, 34);
  g.shadowBlur = 0;
  g.fillStyle = '#ffffff';
  g.fillText(text, 128, 34);
  const t = new THREE.CanvasTexture(c);
  return t;
}

// Golden-hour sky stops: the clock runs 17.5 (gold) -> 19.5 (purple dusk).
// Each stop is { sky, fog, sun, sunIntensity, hemi }.
const SKY_STOPS = [
  { h: 17.5, sky: 0xff9e57, fog: 0xf2a35e, sun: 0xffc46b, sunI: 2.6, hemi: 0.95 },
  { h: 18.25, sky: 0xf27a6b, fog: 0xe87a7a, sun: 0xff8f5e, sunI: 2.2, hemi: 0.85 },
  { h: 19.0, sky: 0x9b5f9e, fog: 0x8a5a8e, sun: 0xff7a9e, sunI: 1.6, hemi: 0.7 },
  { h: 19.75, sky: 0x4a3a6e, fog: 0x3a2f5e, sun: 0xb06ab0, sunI: 1.1, hemi: 0.55 },
];

function lerpColor(a, b, t) {
  const ca = new THREE.Color(a);
  const cb = new THREE.Color(b);
  return ca.lerp(cb, t);
}

// Build the city. Returns { group, roads, buildings, sidewalks, places,
// clouds, half, setClock, clockHours, namedBuildings, collectibles,
// districtAt, streetlights }.
export function buildWorld(scene) {
  const rand = makeRandom(20261119);
  const group = new THREE.Group();
  scene.add(group);
  const { BLOCK, ROAD, GRID } = CONFIG;
  const pitch = BLOCK + ROAD;
  const half = (GRID * pitch) / 2;
  const windowTex = makeWindowTexture();
  const roadTex = makeRoadTexture();

  // The sun and the sky, driven by the in-game clock (see setClock below).
  const sun = new THREE.DirectionalLight(0xffc46b, 2.6);
  sun.position.set(160, 120, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 700;
  scene.add(sun);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x8a5a6a, 0.95);
  scene.add(hemi);
  scene.background = new THREE.Color(0xff9e57);
  scene.fog = new THREE.Fog(0xf2a35e, 220, 640);

  // The clock: hours since midnight. setClock moves the whole atmosphere.
  let clockHours = CONFIG.CLOCK_START_HOURS;
  function setClock(hours) {
    clockHours = hours;
    const stops = SKY_STOPS;
    let a = stops[0];
    let b = stops[stops.length - 1];
    let t = 0;
    for (let i = 0; i < stops.length - 1; i++) {
      if (hours >= stops[i].h && hours <= stops[i + 1].h) {
        a = stops[i];
        b = stops[i + 1];
        t = (hours - a.h) / (b.h - a.h);
        break;
      }
    }
    if (hours < stops[0].h) { a = stops[0]; b = stops[0]; t = 0; }
    if (hours > stops[stops.length - 1].h) { a = stops[stops.length - 1]; b = stops[stops.length - 1]; t = 0; }
    scene.background.copy(lerpColor(a.sky, b.sky, t));
    scene.fog.color.copy(lerpColor(a.fog, b.fog, t));
    sun.color.copy(lerpColor(a.sun, b.sun, t));
    sun.intensity = a.sunI + (b.sunI - a.sunI) * t;
    hemi.intensity = a.hemi + (b.hemi - a.hemi) * t;
    // The sun sinks as the evening goes on: long shadows at golden hour.
    const sink = clamp((hours - 17.5) / 2.25, 0, 1);
    sun.position.set(160 - sink * 60, 120 - sink * 75, 40 + sink * 30);
    return hours >= CONFIG.DUSK_HOURS;
  }
  setClock(clockHours);

  // Ground: warm grass and sand base under everything.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshLambertMaterial({ color: 0x86a85e })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: one asphalt strip per grid line, plus a ring road around the city.
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const roads = { horizontal: [], vertical: [] };
  const roadLines = [];
  for (let i = 0; i <= GRID; i++) roadLines.push(-half + i * pitch - ROAD / 2);
  for (const z of roadLines) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(GRID * pitch + ROAD, ROAD), roadMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0, z);
    m.receiveShadow = true;
    group.add(m);
    roads.horizontal.push({ z, x0: -half - ROAD, x1: half + ROAD });
  }
  for (const x of roadLines) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(ROAD, GRID * pitch + ROAD), roadMat.clone());
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0, 0);
    m.receiveShadow = true;
    group.add(m);
    roads.vertical.push({ x, z0: -half - ROAD, z1: half + ROAD });
  }

  // Sidewalks: purple strips along each block edge (the city's signature).
  const walkMat = new THREE.MeshLambertMaterial({ color: 0x9b7ec2 });
  const sidewalks = [];
  for (let bx = 0; bx < GRID; bx++) {
    for (let bz = 0; bz < GRID; bz++) {
      const cx = -half + ROAD + bx * pitch + BLOCK / 2;
      const cz = -half + ROAD + bz * pitch + BLOCK / 2;
      const w = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK + 4, BLOCK + 4), walkMat);
      w.rotation.x = -Math.PI / 2;
      w.position.set(cx, 0.02, cz);
      w.receiveShadow = true;
      group.add(w);
      sidewalks.push({ x: cx, z: cz });
    }
  }

  // Named landmarks: a few buildings get a name, a neon sign and a taller,
  // more detailed treatment, so the skyline has places you can point at.
  const LANDMARKS = [
    { name: 'SOLARA TOWER', block: [3, 1], colour: 0xf2a7a0, sign: '#ff5a8a' },
    { name: 'THE PALMS', block: [5, 2], colour: 0x7fd1c0, sign: '#37e0c8' },
    { name: 'NEON CASINO', block: [3, 3], colour: 0x9b8cf2, sign: '#ffd23f' },
    { name: 'LUPE\u2019S DINER', block: [1, 5], colour: 0xf7b267, sign: '#ff9e57' },
    { name: 'PORT HOTEL', block: [6, 4], colour: 0x6ec6e8, sign: '#7fd1ff' },
  ];
  const landmarkByBlock = new Map(LANDMARKS.map((l) => [`${l.block[0]},${l.block[1]}`, l]));
  const namedBuildings = [];

  // Buildings: 1-3 per block, varied heights and pastel tints, with setbacks,
  // red roof trim, rooftop plant and neon signs — not plain boxes.
  const buildings = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const neonSigns = ['HOTEL', 'BAR', 'CLUB', 'CAFE', 'TACOS', 'PIER', 'SHOP', 'DANCE'];
  for (let bx = 0; bx < GRID; bx++) {
    for (let bz = 0; bz < GRID; bz++) {
      const cx = -half + ROAD + bx * pitch + BLOCK / 2;
      const cz = -half + ROAD + bz * pitch + BLOCK / 2;
      const nearBeach = bz === GRID - 1;
      const landmark = landmarkByBlock.get(`${bx},${bz}`);
      const count = landmark ? 1 : nearBeach ? 1 : 1 + Math.floor(rand() * 3);
      for (let k = 0; k < count; k++) {
        const w = 12 + rand() * 18;
        const d = 12 + rand() * 18;
        const h = landmark
          ? 52 + rand() * 20
          : nearBeach
            ? 8 + rand() * 10
            : CONFIG.BUILD_MIN_H + rand() * (CONFIG.BUILD_MAX_H - CONFIG.BUILD_MIN_H);
        const ox = (rand() - 0.5) * (BLOCK - w - 6);
        const oz = (rand() - 0.5) * (BLOCK - d - 6);
        const colour = landmark ? landmark.colour : pick(rand, CONFIG.BUILD_COLORS);
        const mat = new THREE.MeshLambertMaterial({ color: colour, map: windowTex });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(cx + ox, h / 2, cz + oz);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        // Setback: a smaller top floor, so the silhouette steps in.
        if (h > 20 && rand() < 0.7) {
          const top = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: colour, map: windowTex }));
          const tw = w * (0.55 + rand() * 0.2);
          const td = d * (0.55 + rand() * 0.2);
          const th = 4 + rand() * 6;
          top.scale.set(tw, th, td);
          top.position.set(cx + ox, h + th / 2, cz + oz);
          top.castShadow = true;
          group.add(top);
        }
        // Red roof trim: a thin red slab capping the roof.
        const roofMat = new THREE.MeshLambertMaterial({ color: pick(rand, CONFIG.ROOF_COLORS) });
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w + 0.6, 0.8, d + 0.6);
        roof.position.set(cx + ox, h + 0.4, cz + oz);
        group.add(roof);
        // Rooftop plant: an AC box and sometimes an antenna or water tower.
        if (rand() < 0.6) {
          const ac = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
          ac.scale.set(w * 0.22, 2, d * 0.22);
          ac.position.set(cx + ox + w * 0.2, h + 1.8, cz + oz);
          group.add(ac);
        }
        if (rand() < 0.3) {
          const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 9, 6), new THREE.MeshLambertMaterial({ color: 0x3a3f46 }));
          ant.position.set(cx + ox - w * 0.25, h + 5, cz + oz);
          group.add(ant);
        }
        // Neon sign on the facade, facing the nearest road.
        const signText = landmark ? landmark.name : pick(rand, neonSigns);
        const signColour = landmark ? landmark.sign : pick(rand, ['#ff5a8a', '#37e0c8', '#ffd23f', '#7fd1ff', '#ff9e57']);
        const sign = new THREE.Mesh(
          new THREE.PlaneGeometry(landmark ? 22 : 12, landmark ? 5.5 : 3),
          new THREE.MeshBasicMaterial({ map: makeNeonTexture(signText, signColour), transparent: true })
        );
        const faceSouth = oz >= 0;
        sign.position.set(cx + ox, Math.min(h * 0.6, 18), cz + oz + (faceSouth ? d / 2 + 0.15 : -d / 2 - 0.15));
        if (!faceSouth) sign.rotation.y = Math.PI;
        group.add(sign);
        if (landmark) namedBuildings.push({ name: landmark.name, x: cx + ox, z: cz + oz, h });
        buildings.push({
          minX: cx + ox - w / 2, maxX: cx + ox + w / 2,
          minZ: cz + oz - d / 2, maxZ: cz + oz + d / 2,
        });
      }
    }
  }

  // Palms along the roads: trunk + a crown of fronds.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6a45 });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 9, 6);
  const frondGeo = new THREE.ConeGeometry(2.6, 3.2, 6);
  for (let i = 0; i < 110; i++) {
    const x = -half + rand() * GRID * pitch;
    const z = -half + rand() * GRID * pitch;
    if (buildings.some((b) => x > b.minX - 2 && x < b.maxX + 2 && z > b.minZ - 2 && z < b.maxZ + 2)) continue;
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 4.5, z);
    trunk.castShadow = true;
    group.add(trunk);
    const frond = new THREE.Mesh(frondGeo, frondMat);
    frond.position.set(x, 10.2, z);
    frond.castShadow = true;
    group.add(frond);
  }

  // Streetlights at intersections; their lamps glow once dusk falls.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 6);
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const streetlights = [];
  for (const z of roadLines) {
    for (const x of roadLines) {
      if (rand() < 0.4) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + ROAD / 2 + 1, 3.5, z + ROAD / 2 + 1);
      group.add(pole);
      const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x + ROAD / 2 + 1, 7.1, z + ROAD / 2 + 1);
      group.add(lamp);
      streetlights.push(lampMat);
    }
  }

  // Beach and ocean on the south side, with a pier Lupe waits on.
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(GRID * pitch + 120, 40),
    new THREE.MeshLambertMaterial({ color: 0xe8d9a0 })
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.03, half + ROAD + 20);
  beach.receiveShadow = true;
  group.add(beach);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 500),
    new THREE.MeshLambertMaterial({ color: 0x2a7ab8 })
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(0, -0.4, half + ROAD + 40 + 250);
  group.add(ocean);
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9a7a52 });
  const pier = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 46), pierMat);
  pier.position.set(-40, 0.6, half + ROAD + 22);
  pier.castShadow = true;
  group.add(pier);

  // Sunset Shards: ten glowing collectibles hidden around the city. A spot
  // inside a building is re-rolled (bounded tries) instead of skipped, so
  // the city really holds all ten — the HUD and the map both promise /10.
  const collectibles = [];
  const shardGeo = new THREE.OctahedronGeometry(0.9);
  const shardMat = new THREE.MeshBasicMaterial({ color: 0xffd23f });
  for (let i = 0; i < CONFIG.COLLECTIBLE_COUNT; i++) {
    let x = 0, z = 0, ok = false;
    for (let tries = 0; tries < 20 && !ok; tries++) {
      x = -half + 20 + rand() * (GRID * pitch - 40);
      z = -half + 20 + rand() * (GRID * pitch - 40);
      ok = !buildings.some((b) => x > b.minX - 3 && x < b.maxX + 3 && z > b.minZ - 3 && z < b.maxZ + 3);
    }
    if (!ok) continue;
    const shard = new THREE.Mesh(shardGeo, shardMat);
    shard.position.set(x, 1.4, z);
    group.add(shard);
    collectibles.push({ mesh: shard, x, z, taken: false, spin: rand() * Math.PI * 2 });
  }

  // A few clouds, drifting slowly (animated by main.js), pink at dusk.
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffd9c0, transparent: true, opacity: 0.85 });
  const clouds = [];
  for (let i = 0; i < 10; i++) {
    const cloud = new THREE.Group();
    for (let j = 0; j < 3; j++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(6 + rand() * 8, 8, 6), cloudMat);
      s.scale.y = 0.45;
      s.position.set(j * 8 - 8, rand() * 2, rand() * 4 - 2);
      cloud.add(s);
    }
    cloud.position.set(-300 + rand() * 600, 90 + rand() * 40, -300 + rand() * 400);
    group.add(cloud);
    clouds.push(cloud);
  }

  const places = {
    pier: { x: -40, z: half + ROAD + 18 },
    downtown: { x: 0, z: -half + ROAD + BLOCK / 2 },
    beach: { x: 30, z: half + ROAD + 14 },
    northGate: { x: 0, z: -half - ROAD },
    cityCentre: { x: 0, z: 0 },
    // v3 places: the garage, the arms shop, the safehouse, the race start,
    // and the district centres the new missions use.
    garage: { x: -half + ROAD + BLOCK / 2 + 30, z: -half + ROAD + BLOCK / 2 },
    armsShop: { x: half - ROAD - BLOCK / 2, z: -half + ROAD + BLOCK / 2 },
    safehouse: { x: -half + ROAD + BLOCK / 2, z: half - ROAD - BLOCK / 2 },
    raceStart: { x: half - ROAD - BLOCK / 2, z: half - ROAD - BLOCK / 2 },
    neonRow: { x: 0, z: 30 },
    palmHeights: { x: -half + ROAD + BLOCK / 2, z: 0 },
    oldPort: { x: half - ROAD - BLOCK / 2, z: 0 },
    malecon: { x: 0, z: half + ROAD + 8 },
  };

  function districtAt(x, z) {
    for (const d of DISTRICTS) {
      if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
    }
    return 'Solara';
  }

  return {
    group, roads, buildings, sidewalks, places, clouds, half,
    setClock, get clockHours() { return clockHours; },
    namedBuildings, collectibles, districtAt, streetlights,
  };
}

// True when the point (x, z) is inside a building footprint (with margin).
export function hitsBuilding(buildings, x, z, margin = 0.6) {
  for (const b of buildings) {
    if (x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin) return b;
  }
  return null;
}

// Push a circle (x, z, radius) out of every building it overlaps.
export function resolveBuildingCollision(buildings, pos, radius) {
  const b = hitsBuilding(buildings, pos.x, pos.z, radius);
  if (!b) return;
  const dxLeft = pos.x - (b.minX - radius);
  const dxRight = (b.maxX + radius) - pos.x;
  const dzTop = pos.z - (b.minZ - radius);
  const dzBottom = (b.maxZ + radius) - pos.z;
  const m = Math.min(dxLeft, dxRight, dzTop, dzBottom);
  if (m === dxLeft) pos.x = b.minX - radius;
  else if (m === dxRight) pos.x = b.maxX + radius;
  else if (m === dzTop) pos.z = b.minZ - radius;
  else pos.z = b.maxZ + radius;
}
