// SOLARA — the city: golden-hour coastal grid, beach road, ocean east,
// pastel blocks, palms, lamps, neon. Built once from a seeded RNG.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, DISTRICTS, mulberry32, clamp } from './config.js';

const PASTELS = [0xf2a7c3, 0xf7c873, 0x9fd8c9, 0xc9a7e8, 0xf29b7e, 0x8ecae6, 0xf7d6a0, 0xe8a0b4];

function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05, ...opts }),
  );
  m.position.set(x, y, z);
  return m;
}

function haloSprite(color, scale) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.95)');
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

export function buildWorld(scene, seed) {
  const rng = mulberry32(seed);
  const refs = { lamps: [], windowMats: [], neonMats: [], update: null };

  // Sky + fog + lights.
  const sky = new THREE.Color(0xffb36b);
  scene.background = sky;
  scene.fog = new THREE.Fog(0xe8907c, 120, 520);
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.2);
  sun.position.set(-120, 180, -60);
  scene.add(sun);
  const amb = new THREE.AmbientLight(0xffc9a8, 0.85);
  scene.add(amb);
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x3a4a6b, 0.7);
  scene.add(hemi);

  // Ground slab.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 900),
    new THREE.MeshStandardMaterial({ color: 0x8a7f72, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  scene.add(ground);

  // Ocean: broad turquoise plane east of the beach road.
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 900),
    new THREE.MeshStandardMaterial({ color: 0x2fa8b8, roughness: 0.25, metalness: 0.35 }),
  );
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.set(WORLD.oceanX + 160, -0.02, 0);
  scene.add(ocean);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(46, 900),
    new THREE.MeshStandardMaterial({ color: 0xe8d3a0, roughness: 1 }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(WORLD.oceanX - 12, 0, 0);
  scene.add(sand);

  // Roads: dark asphalt strips on the grid, with centre lines.
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e3138, roughness: 0.95 });
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xd8b13a, roughness: 0.8 });
  const dashMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.8 });
  const roads = [];
  for (let i = -4; i <= 4; i++) {
    const c = i * WORLD.block;
    roads.push({ x: c, z: 0, w: 14, len: 640, vertical: true });
    roads.push({ x: 0, z: c, w: 14, len: 640, vertical: false });
  }
  for (const r of roads) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(r.vertical ? r.w : r.len, r.vertical ? r.len : r.w),
      roadMat,
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(r.x, 0.01, r.z);
    scene.add(m);
    // Double yellow centre line.
    for (const off of [-0.35, 0.35]) {
      const l = new THREE.Mesh(
        new THREE.PlaneGeometry(r.vertical ? 0.28 : r.len, r.vertical ? r.len : 0.28),
        lineMat,
      );
      l.rotation.x = -Math.PI / 2;
      l.position.set(r.vertical ? r.x + off : r.x, 0.02, r.vertical ? r.z : r.z + off);
      scene.add(l);
    }
    // Dashed white lane lines.
    for (let d = -300; d < 300; d += 16) {
      for (const off of [-3.6, 3.6]) {
        const dash = new THREE.Mesh(
          new THREE.PlaneGeometry(r.vertical ? 0.25 : 5, r.vertical ? 5 : 0.25),
          dashMat,
        );
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(r.vertical ? r.x + off : r.x + d, 0.02, r.vertical ? r.z + d : r.z + off);
        scene.add(dash);
      }
    }
  }
  // Zebra crossings at the central intersections.
  const zebraMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.85 });
  for (const [cx, cz] of [[0, 0], [64, 0], [-64, 64], [0, -64], [128, 64]]) {
    for (let k = -3; k <= 3; k++) {
      const z = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 12), zebraMat);
      z.rotation.x = -Math.PI / 2;
      z.position.set(cx + k * 2.1, 0.03, cz);
      scene.add(z);
    }
  }
  // Sidewalk strips along the beach road.
  const walkMat = new THREE.MeshStandardMaterial({ color: 0xcfc4b0, roughness: 1 });
  for (const x of [WORLD.oceanX - 42, WORLD.oceanX - 58]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(6, 640), walkMat);
    w.rotation.x = -Math.PI / 2;
    w.position.set(x, 0.015, 0);
    scene.add(w);
  }

  // Buildings: pastel blocks with window grids. Windows glow at dusk.
  const winGeo = new THREE.PlaneGeometry(1.6, 2.0);
  const litMat = new THREE.MeshStandardMaterial({ color: 0x3a4a6b, emissive: 0xffc46b, emissiveIntensity: 0 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2c3a55, emissive: 0x0a1428, emissiveIntensity: 0.4 });
  refs.windowMats.push(litMat);
  let litCount = 0;
  let winCount = 0;
  const blocks = [];
  for (let bx = -4; bx <= 3; bx++) {
    for (let bz = -4; bz <= 4; bz++) {
      const cx = bx * WORLD.block + WORLD.block / 2;
      const cz = bz * WORLD.block + WORLD.block / 2;
      if (cx > 190 || (Math.abs(cx) < 12 && Math.abs(cz) < 12)) continue; // beach + plaza kept clear
      if (rng() < 0.22) continue;
      blocks.push([cx, cz]);
    }
  }
  for (const [cx, cz] of blocks) {
    const w = 18 + rng() * 16;
    const d = 18 + rng() * 16;
    const h = 12 + rng() * 34;
    const color = PASTELS[Math.floor(rng() * PASTELS.length)];
    const b = box(w, h, d, color, cx, h / 2, cz);
    scene.add(b);
    // Roof lip.
    const lip = box(w + 1.2, 0.8, d + 1.2, 0x2e3138, cx, h + 0.4, cz);
    scene.add(lip);
    // Window grid on the street faces.
    const floors = Math.max(2, Math.floor(h / 5));
    const cols = Math.max(2, Math.floor(w / 5));
    for (let f = 0; f < floors; f++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng() < 0.45;
        const win = new THREE.Mesh(winGeo, lit ? litMat : darkMat);
        win.position.set(cx - w / 2 + 3 + c * 5, 3.5 + f * 5, cz + d / 2 + 0.06);
        scene.add(win);
        winCount++;
        if (lit) litCount++;
        const win2 = new THREE.Mesh(winGeo, lit ? litMat : darkMat);
        win2.position.set(cx - w / 2 + 3 + c * 5, 3.5 + f * 5, cz - d / 2 - 0.06);
        win2.rotation.y = Math.PI;
        scene.add(win2);
        winCount++;
        if (lit) litCount++;
      }
    }
  }
  refs.litFraction = winCount ? litCount / winCount : 0;

  // Street lamps down the beach road and the main streets.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x22242a, roughness: 0.6, metalness: 0.4 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 0 });
  for (let z = -280; z <= 280; z += 40) {
    for (const x of [WORLD.oceanX - 48, -8, 72]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 8), poleMat);
      pole.position.set(x, 3.5, z);
      scene.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.18, 0.18), poleMat);
      arm.position.set(x + 1.1, 6.9, z);
      scene.add(arm);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 10), lampMat);
      bulb.position.set(x + 2.2, 6.7, z);
      scene.add(bulb);
      const halo = haloSprite('rgba(255,230,150,0.55)', 7);
      halo.position.set(x + 2.2, 6.7, z);
      scene.add(halo);
      refs.lamps.push({ bulb, halo, mat: lampMat });
    }
  }
  refs.lampMat = lampMat;

  // Neon signs on the pier and downtown walls.
  const neonDefs = [
    { text: 'SOLARA', color: '#ff5fa2', x: -180, y: 14, z: -40 },
    { text: "MO'S", color: '#39e6c3', x: -120, y: 10, z: 96 },
    { text: 'PIER', color: '#ffb03a', x: -260, y: 8, z: 60 },
    { text: 'TINTA', color: '#ff5fa2', x: 40, y: 12, z: -96 },
  ];
  for (const n of neonDefs) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 128;
    const g = c.getContext('2d');
    g.clearRect(0, 0, 512, 128);
    g.font = 'bold 84px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = n.color;
    g.shadowBlur = 28;
    g.fillStyle = n.color;
    g.fillText(n.text, 256, 66);
    g.shadowBlur = 8;
    g.fillStyle = '#ffffff';
    g.fillText(n.text, 256, 66);
    const tex = new THREE.CanvasTexture(c);
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.35 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(16, 4), mat);
    sign.position.set(n.x, n.y, n.z);
    scene.add(sign);
    const halo = haloSprite(`rgba(255,255,255,0.5)`, 1);
    halo.material.color.set(n.color);
    halo.scale.set(20, 6, 1);
    halo.position.set(n.x, n.y, n.z + 0.4);
    scene.add(halo);
    refs.neonMats.push(mat);
  }

  // Palms along the beach road.
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f9e5f, roughness: 0.9 });
  for (let z = -280; z <= 280; z += 28) {
    const x = WORLD.oceanX - 38 + (rng() - 0.5) * 4;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 9, 7), trunkMat);
    trunk.position.set(x, 4.5, z + (rng() - 0.5) * 6);
    trunk.rotation.z = (rng() - 0.5) * 0.15;
    scene.add(trunk);
    for (let k = 0; k < 5; k++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 4), leafMat);
      const a = (k / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.6, 9.4, z + Math.sin(a) * 1.6);
      leaf.rotation.z = Math.cos(a) * 1.1;
      leaf.rotation.x = -Math.sin(a) * 1.1;
      scene.add(leaf);
    }
  }

  // Pier: wooden deck jutting west into the water (the spawn / mission 1 spot).
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 1 });
  const deck = new THREE.Mesh(new THREE.BoxGeometry(26, 1.2, 60), deckMat);
  deck.position.set(WORLD.pierX, 0.6, WORLD.pierZ);
  scene.add(deck);
  for (let k = -2; k <= 2; k++) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 4, 8), deckMat);
    post.position.set(WORLD.pierX - 12, 0.5, WORLD.pierZ + k * 12);
    scene.add(post);
  }
  // Mission beacon ring at the pier target.
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(4.5, 5.5, 40),
    new THREE.MeshBasicMaterial({ color: 0xffc93a, transparent: true, opacity: 0.9, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(WORLD.pierX, 1.3, WORLD.pierZ);
  scene.add(ring);
  refs.beaconRing = ring;

  // A few benches, bins and bus stops for street detail.
  const benchMat = new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const x = -260 + rng() * 460;
    const z = -280 + rng() * 560;
    if (Math.abs(x) % 64 < 10 || Math.abs(z) % 64 < 10) continue;
    const bench = box(3.2, 0.5, 1.1, 0x5a4632, x, 0.5, z);
    scene.add(bench);
  }

  refs.update = (duskT, hours) => {
    const d = clamp(duskT, 0, 1);
    // Sky slides from gold afternoon into orange-pink dusk.
    sky.setHSL(0.07 - d * 0.035, 0.85, 0.62 - d * 0.16);
    scene.fog.color.copy(sky);
    sun.intensity = 2.2 - d * 1.1;
    sun.color.setHSL(0.09 - d * 0.05, 0.9, 0.62 - d * 0.12);
    amb.intensity = 0.85 - d * 0.25;
    hemi.intensity = 0.7 - d * 0.2;
    lampMat.emissiveIntensity = d * 2.6;
    for (const l of refs.lamps) l.halo.material.opacity = d * 0.85;
    litMat.emissiveIntensity = d * 2.2;
    for (const m of refs.neonMats) m.opacity = 0.35 + d * 0.65;
    refs.beaconRing.material.opacity = 0.55 + 0.35 * Math.sin(hours * 6);
  };

  return refs;
}
