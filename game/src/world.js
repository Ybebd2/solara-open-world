// SOLARA — the city itself: sky, ocean, roads, buildings, palms, lamps
// and the mission beacon. Everything is boxes, planes and canvas
// textures: cheap enough for a software renderer, shaped enough to read
// as a real coastal city at golden hour.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, DISTRICTS, mulberry32, clamp, lerp } from './config.js';

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roadTexture() {
  return canvasTexture(128, 512, (g, w, h) => {
    g.fillStyle = '#26262c'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2e2e35';
    for (let i = 0; i < 200; i++) g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    // Double yellow centre line.
    g.fillStyle = '#d8b13a';
    g.fillRect(w / 2 - 7, 0, 4, h); g.fillRect(w / 2 + 3, 0, 4, h);
    // Dashed white lane lines.
    g.fillStyle = '#e8e8e8';
    for (let y = 0; y < h; y += 64) { g.fillRect(26, y, 4, 34); g.fillRect(w - 30, y, 4, 34); }
  });
}

function windowTexture(rng, litRatio) {
  return canvasTexture(128, 192, (g, w, h) => {
    g.fillStyle = '#1c2438'; g.fillRect(0, 0, w, h);
    const cols = 4, rows = 6, cw = w / cols, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const lit = rng() < litRatio;
        g.fillStyle = lit ? '#ffcf6e' : '#2c3a58';
        g.fillRect(c * cw + 6, r * ch + 8, cw - 12, ch - 16);
        if (lit) { g.fillStyle = 'rgba(255,220,130,0.5)'; g.fillRect(c * cw + 6, r * ch + 8, cw - 12, 5); }
      }
    }
  });
}

function neonTexture(text, color) {
  return canvasTexture(256, 96, (g, w, h) => {
    g.fillStyle = '#120a18'; g.fillRect(0, 0, w, h);
    g.font = 'bold 52px Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 22;
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2 + 2);
    g.shadowBlur = 6; g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2 + 2);
  });
}

function haloTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(255,240,200,0.95)');
    grad.addColorStop(0.35, 'rgba(255,220,140,0.45)');
    grad.addColorStop(1, 'rgba(255,220,140,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}

function skyTexture(duskT) {
  // Golden hour at duskT 0, deep dusk at duskT 1.
  const top = [126, 107, 191], mid = [255, 126, 95], hor = [255, 154, 60];
  const top2 = [38, 38, 92], mid2 = [198, 93, 138], hor2 = [255, 107, 107];
  const mix = (a, b) => a.map((v, i) => Math.round(lerp(v, b[i], duskT)));
  const [tr, tg, tb] = mix(top, top2);
  const [mr, mg, mb] = mix(mid, mid2);
  const [hr, hg, hb] = mix(hor, hor2);
  return canvasTexture(4, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, `rgb(${tr},${tg},${tb})`);
    grad.addColorStop(0.55, `rgb(${mr},${mg},${mb})`);
    grad.addColorStop(1, `rgb(${hr},${hg},${hb})`);
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
  });
}

const NEON_SIGNS = [
  { text: "MO'S", color: '#ff5fa2' },
  { text: 'SOLARA', color: '#39e6c3' },
  { text: 'TATTOO', color: '#ff5fa2' },
  { text: 'PIER BAR', color: '#ffb347' },
  { text: 'HOTEL', color: '#39e6c3' },
  { text: 'TACOS', color: '#ff8a5c' },
  { text: 'NEON', color: '#c58cff' },
  { text: 'SURF', color: '#39e6c3' },
];

const PASTELS = [0xe8dcc8, 0xf2b8a0, 0xf6d9a0, 0xa8d8c8, 0xc9b8e8, 0xe8a8a8, 0xd8c8a8, 0xb8d0e8];

export function buildWorld(G) {
  const scene = G.scene;
  const rng = mulberry32(1);
  const out = { lamps: [], buildings: [], signs: [], palms: [] };

  // ---- sky dome + sun ----
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTexture(0), side: THREE.BackSide, fog: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), skyMat);
  scene.add(sky);
  const sunMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false, transparent: true, opacity: 0.95 });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(34, 24), sunMat);
  sun.position.set(-420, 120, -320); sun.lookAt(0, 60, 0);
  scene.add(sun);
  out.skyMat = skyMat; out.sunMat = sunMat; out.sky = sky;
  out._skyDusk = -1;

  // ---- lights ----
  const hemi = new THREE.HemisphereLight(0xffd9b0, 0x2a2a3a, 0.85);
  scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xffb36b, 1.6);
  dir.position.set(-180, 220, -140);
  scene.add(dir);
  out.sunLight = dir; out.hemi = hemi;

  // ---- ground, ocean, sand ----
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(700, 700),
    new THREE.MeshLambertMaterial({ color: 0x3a3a40 }),
  );
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.05, 0);
  scene.add(ground);
  const ocean = new THREE.Mesh(
    new THREE.PlaneGeometry(120, 700),
    new THREE.MeshLambertMaterial({ color: 0x1e6f7e }),
  );
  ocean.rotation.x = -Math.PI / 2; ocean.position.set(-340, 0.02, 0);
  scene.add(ocean);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 700),
    new THREE.MeshLambertMaterial({ color: 0xd9c08a }),
  );
  sand.rotation.x = -Math.PI / 2; sand.position.set(-264, 0.0, 0);
  scene.add(sand);

  // ---- roads ----
  const roadTex = roadTexture();
  roadTex.wrapS = roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const addRoad = (x, z, w, len, alongX) => {
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(alongX ? len / 60 : w / 14, alongX ? w / 14 : len / 60);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshLambertMaterial({ map: tex }));
    m.rotation.x = -Math.PI / 2;
    if (alongX) m.rotation.z = Math.PI / 2;
    m.position.set(x, 0.03, z);
    scene.add(m);
  };
  // Beach Road (north-south) and the grid.
  addRoad(WORLD.beachRoadX, 0, 16, 520, false);
  for (const z of WORLD.crossZ) addRoad(0, z, 14, 520, true);
  for (const x of WORLD.northX) addRoad(x, 0, 14, 520, false);

  // Zebra crossings at a few intersections.
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2f2f2 });
  const addZebra = (x, z, alongX) => {
    for (let i = -2; i <= 2; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(alongX ? 1.1 : 5.5, 0.06, alongX ? 5.5 : 1.1), stripeMat);
      s.position.set(x + (alongX ? 0 : i * 1.6), 0.06, z + (alongX ? i * 1.6 : 0));
      scene.add(s);
    }
  };
  addZebra(-250, 0, false); addZebra(-250, 80, false); addZebra(-90, 0, true);
  addZebra(70, 80, true); addZebra(-170, -80, false); addZebra(0, 160, true);

  // ---- buildings ----
  const winTexDay = windowTexture(mulberry32(7), 0.12);
  const winTexDusk = windowTexture(mulberry32(7), 0.42);
  const blockXs = [-250, -170, -90, -10, 70, 150, 230];
  const blockZs = [-240, -160, -80, 0, 80, 160, 240];
  let signIdx = 0;
  for (let bi = 0; bi < blockXs.length - 1; bi++) {
    for (let bj = 0; bj < blockZs.length - 1; bj++) {
      const x0 = blockXs[bi] + 10, x1 = blockXs[bi + 1] - 10;
      const z0 = blockZs[bj] + 10, z1 = blockZs[bj + 1] - 10;
      if (x1 - x0 < 18 || z1 - z0 < 18) continue;
      // One or two buildings per block.
      const n = rng() < 0.45 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const w = (x1 - x0) / n - 6;
        const d = (z1 - z0) - 8;
        const h = 9 + rng() * 26;
        const cx = x0 + (w / 2) + 3 + k * (w + 6);
        const cz = (z0 + z1) / 2;
        const color = PASTELS[Math.floor(rng() * PASTELS.length)];
        const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }));
        b.position.set(cx, h / 2, cz);
        scene.add(b);
        // Window face on the street side (west face for beach-side blocks).
        const win = new THREE.Mesh(
          new THREE.PlaneGeometry(Math.min(w, d) * 0.92, h * 0.88),
          new THREE.MeshBasicMaterial({ map: winTexDusk }),
        );
        win.position.set(cx - w / 2 - 0.06, h * 0.47, cz);
        win.rotation.y = -Math.PI / 2;
        scene.add(win);
        const win2 = win.clone();
        win2.position.set(cx + w / 2 + 0.06, h * 0.47, cz);
        win2.rotation.y = Math.PI / 2;
        scene.add(win2);
        const rec = { mesh: b, x: cx, z: cz, w, d, h, winMat: win.material };
        out.buildings.push(rec);
        // Neon sign on some buildings, facing the street. Beach-road
        // blocks always get one so the neon reads in every street shot.
        if ((bi === 0 || rng() < 0.5) && signIdx < NEON_SIGNS.length * 3) {
          const s = NEON_SIGNS[signIdx % NEON_SIGNS.length]; signIdx++;
          const sign = new THREE.Mesh(
            new THREE.PlaneGeometry(11, 4.2),
            new THREE.MeshBasicMaterial({ map: neonTexture(s.text, s.color), transparent: true }),
          );
          sign.position.set(cx - w / 2 - 0.12, Math.min(h - 2.5, 9), cz);
          sign.rotation.y = -Math.PI / 2;
          scene.add(sign);
          out.signs.push(sign);
          // Beach-road blocks also get a south-facing sign, so the neon
          // reads from a camera looking north up the street. Bigger and
          // higher than the west signs so it clears the dialogue bar.
          if (bi === 0 && signIdx < NEON_SIGNS.length * 3) {
            const s2 = NEON_SIGNS[signIdx % NEON_SIGNS.length]; signIdx++;
            const sign2 = new THREE.Mesh(
              new THREE.PlaneGeometry(16, 6),
              new THREE.MeshBasicMaterial({ map: neonTexture(s2.text, s2.color), transparent: true }),
            );
            sign2.position.set(cx, Math.max(10, h - 4), cz + d / 2 + 0.12);
            sign2.rotation.y = 0;
            scene.add(sign2);
            out.signs.push(sign2);
          }
        }
      }
    }
  }

  // ---- palms along Beach Road ----
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e6b34 });
  const makePalm = (x, z) => {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.34, 7, 6), trunkMat);
    trunk.position.y = 3.5; g.add(trunk);
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.12, 0.9), frondMat);
      const a = (i / 6) * Math.PI * 2;
      f.position.set(Math.cos(a) * 1.5, 7.1, Math.sin(a) * 1.5);
      f.rotation.y = -a; f.rotation.z = 0.5;
      g.add(f);
    }
    g.position.set(x, 0, z);
    scene.add(g);
    out.palms.push(g);
  };
  for (let z = -220; z <= 220; z += 44) { makePalm(-241, z); makePalm(-259, z + 22); }

  // ---- street lamps ----
  const lampTex = haloTexture();
  const postMat = new THREE.MeshLambertMaterial({ color: 0x222226 });
  const ballMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  const lampPositions = [];
  for (let z = -220; z <= 220; z += 55) { lampPositions.push([-242, z]); lampPositions.push([-170, z + 27]); lampPositions.push([-90, z]); lampPositions.push([70, z + 27]); }
  for (const [x, z] of lampPositions) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 5.4, 6), postMat);
    post.position.set(x, 2.7, z); scene.add(post);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), ballMat.clone());
    ball.position.set(x, 5.6, z); scene.add(ball);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: lampTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(4.5, 4.5, 1); halo.position.set(x, 5.6, z); scene.add(halo);
    out.lamps.push({ ball, halo, x, z });
  }

  // ---- mission beacon ----
  const beamMat = new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.6, 60, 12, 1, true), beamMat);
  beam.position.set(WORLD.pierTarget.x, 30, WORLD.pierTarget.z);
  scene.add(beam);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.2, 3.4, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.85, side: THREE.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2; ring.position.set(WORLD.pierTarget.x, 0.08, WORLD.pierTarget.z);
  scene.add(ring);
  out.beacon = { beam, ring };

  // District label helper: which district contains (x, z).
  out.districtAt = (x, z) => {
    for (const d of DISTRICTS) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
    return DISTRICTS[1];
  };

  // Per-frame lighting: sky gradient, lamp glow, sun colour by time of day.
  out.update = (hours) => {
    const duskT = clamp((hours - 18) / 1.5, 0, 1);
    if (Math.abs(duskT - out._skyDusk) > 0.04) {
      out._skyDusk = duskT;
      skyMat.map = skyTexture(duskT);
      skyMat.needsUpdate = true;
      dir.color.setHSL(0.07 - duskT * 0.03, 0.9, 0.62 - duskT * 0.12);
      dir.intensity = 1.6 - duskT * 0.7;
      hemi.intensity = 0.85 - duskT * 0.3;
      sunMat.opacity = 0.95 - duskT * 0.35;
    }
    const lampGlow = clamp((duskT - 0.25) * 1.6, 0, 1);
    for (const l of out.lamps) {
      l.halo.material.opacity = lampGlow * 0.85;
      l.ball.material.color.setHex(lampGlow > 0.3 ? 0xffe9a8 : 0xcfd4de);
    }
  };

  return out;
}
