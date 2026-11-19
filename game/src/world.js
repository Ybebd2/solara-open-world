// SOLARA — the city. A procedural sun-soaked coastal city: a grid of blocks
// with roads between them, buildings with lit windows, palms, streetlights,
// a beach and a pier on the south side, and the ocean beyond. Everything is
// built from three.js geometry with materials made in code — no external
// assets, so the game runs offline. The module also hands the rest of the game
// the road network (for traffic), the building footprints (for collision) and
// named places (for missions).

import * as THREE from 'three';
import { CONFIG, makeRandom, pick } from './config.js';

// A canvas texture of windows: dark glass on a lit facade. One texture is
// shared by every building; the building's own colour tints it.
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
      const lit = rand() < 0.35;
      g.fillStyle = lit ? '#ffd98a' : '#2a3644';
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
  g.fillStyle = '#2e3138';
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

// Build the city. Returns { group, roads, buildings, sidewalks, places }.
// roads: { horizontal: [ { z, x0, x1 } ], vertical: [ { x, z0, z1 } ] } — the
// centre lines traffic follows. buildings: [{ minX, maxX, minZ, maxZ }] for
// collision. places: named spots missions use.
export function buildWorld(scene) {
  const rand = makeRandom(20261119);
  const group = new THREE.Group();
  scene.add(group);
  const { BLOCK, ROAD, GRID } = CONFIG;
  const pitch = BLOCK + ROAD;
  const half = (GRID * pitch) / 2;
  const windowTex = makeWindowTexture();
  const roadTex = makeRoadTexture();

  // Sky, sun and fog: a warm late afternoon.
  scene.background = new THREE.Color(0x87b5d6);
  scene.fog = new THREE.Fog(0x9fc3dd, 220, 620);
  const sun = new THREE.DirectionalLight(0xffe0a8, 2.4);
  sun.position.set(120, 180, 60);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -260;
  sun.shadow.camera.right = 260;
  sun.shadow.camera.top = 260;
  sun.shadow.camera.bottom = -260;
  sun.shadow.camera.far = 600;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9));

  // Ground: grass and sand base under everything.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1200, 1200),
    new THREE.MeshLambertMaterial({ color: 0x7fae62 })
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
    m.position.set(0, 0, z + ROAD / 2 - ROAD / 2);
    m.position.z = z;
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

  // Sidewalks: pale strips along each block edge.
  const walkMat = new THREE.MeshLambertMaterial({ color: 0xb9b3a4 });
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

  // Buildings: 1-3 towers per block, varied heights and tints, with a few
  // rooftop details. The south row (nearest the beach) stays low.
  const buildings = [];
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let bx = 0; bx < GRID; bx++) {
    for (let bz = 0; bz < GRID; bz++) {
      const cx = -half + ROAD + bx * pitch + BLOCK / 2;
      const cz = -half + ROAD + bz * pitch + BLOCK / 2;
      const nearBeach = bz === GRID - 1;
      const count = nearBeach ? 1 : 1 + Math.floor(rand() * 3);
      for (let k = 0; k < count; k++) {
        const w = 12 + rand() * 18;
        const d = 12 + rand() * 18;
        const h = nearBeach
          ? 8 + rand() * 10
          : CONFIG.BUILD_MIN_H + rand() * (CONFIG.BUILD_MAX_H - CONFIG.BUILD_MIN_H);
        const ox = (rand() - 0.5) * (BLOCK - w - 6);
        const oz = (rand() - 0.5) * (BLOCK - d - 6);
        const colour = pick(rand, CONFIG.BUILD_COLORS);
        const mat = new THREE.MeshLambertMaterial({ color: colour, map: windowTex });
        const b = new THREE.Mesh(boxGeo, mat);
        b.scale.set(w, h, d);
        b.position.set(cx + ox, h / 2, cz + oz);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        // Rooftop box, for a skyline that is not flat.
        if (rand() < 0.5) {
          const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8a8f96 }));
          roof.scale.set(w * 0.3, 2.5, d * 0.3);
          roof.position.set(cx + ox, h + 1.25, cz + oz);
          group.add(roof);
        }
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
  for (let i = 0; i < 90; i++) {
    const x = -half + rand() * GRID * pitch;
    const z = -half + rand() * GRID * pitch;
    // Keep palms on sidewalks, out of the road and out of buildings.
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

  // Streetlights at intersections.
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 7, 6);
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  for (const z of roadLines) {
    for (const x of roadLines) {
      if (rand() < 0.4) continue;
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x + ROAD / 2 + 1, 3.5, z + ROAD / 2 + 1);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x + ROAD / 2 + 1, 7.1, z + ROAD / 2 + 1);
      group.add(lamp);
    }
  }

  // Beach and ocean on the south side, with a pier Mara waits on.
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

  // A few clouds, drifting slowly (animated by main.js).
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
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
  };

  return { group, roads, buildings, sidewalks, places, clouds, half };
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
