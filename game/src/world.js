// SOLARA — world: the golden-hour coastal city. Sky dome, ocean, pier,
// pastel blocks, beach wall, towers, palms, lamps, neon. Built fresh
// for the @witty-meteor-32 build.
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, BEACH_ROAD, hueLerp, lerp, clamp, rand, pick } from './config.js';

// Twelve warm/cool pastels so the blocks read varied, never a row of
// identical boxes. Roofs stay in the red family.
const PASTELS = [0xf2c9a0, 0xf6d9b8, 0xe8b4a0, 0xf0d0c0, 0xd9e2c0, 0xc9d6e8, 0xe8c9d9, 0xf7e6c8, 0xd9b8f0, 0xf2a0c0, 0xf7e08a, 0xc0e8d9];
const ROOFS = [0xb8442f, 0x8f2f26, 0xc25a3a, 0x9c3a2e];
const NEON_COLOURS = [0xff5da2, 0x39d0ff, 0xffd23f, 0x7dff5e, 0xff7a3c];
// Neon names on the beach strip: readable glowing text, cycled down the
// wall so any two buildings in frame carry a legible sign.
const NEON_SIGNS = [
  { text: "TOMO'S", color: '#ff5da2' },
  { text: 'CASA LUNA', color: '#39d0ff' },
  { text: 'BRISA INN', color: '#7dff5e' },
  { text: 'NEON ROW', color: '#ffd23f' },
  { text: 'PALMS', color: '#ff7a3c' },
  { text: 'SOLARA', color: '#ff5da2' },
];

export class World {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.streetlights = [];
    this.windowMats = [];
    this.neonMats = [];
    this.palms = [];
    this.buildSky();
    this.buildGround();
    this.buildOcean();
    this.buildPier();
    this.buildCity();
    this.buildBeachWall();
    this.buildTowers();
    // Landmarks, furniture and power lines go up before the palms, so
    // the palm rows never hide the loft or the poles.
    this.buildLandmarkLoft();
    this.buildProps();
    this.buildUtilityPoles();
    this.buildPalms();
    this.buildStreetlights();
    this.buildBeachLamps();
    // Sun + ambient + hemisphere for golden-hour light.
    this.sun = new THREE.DirectionalLight(0xffb347, 1.6);
    this.sun.position.set(-120, 90, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -220; this.sun.shadow.camera.right = 220;
    this.sun.shadow.camera.top = 220; this.sun.shadow.camera.bottom = -220;
    this.sun.shadow.camera.far = 600;
    scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a2a4a, 0.7);
    scene.add(this.hemi);
    this.amb = new THREE.AmbientLight(0x604060, 0.35);
    scene.add(this.amb);
  }

  // Neon sign texture, cached per name+colour: glowing text on a dark
  // backing, so the beach strip's signs are readable words (TOMO'S,
  // CASA LUNA, ...) instead of blank coloured boxes.
  neonSignTex(text, color) {
    if (!this._neonTexCache) this._neonTexCache = new Map();
    const key = text + '|' + color;
    if (this._neonTexCache.has(key)) return this._neonTexCache.get(key);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#1a0512'; cx.fillRect(0, 0, 512, 96);
    cx.font = '900 52px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowColor = color; cx.shadowBlur = 24;
    cx.fillStyle = color; cx.fillText(text, 256, 50);
    cx.shadowBlur = 0; cx.fillStyle = '#ffffff'; cx.fillText(text, 256, 50);
    const tex = new THREE.CanvasTexture(cv);
    this._neonTexCache.set(key, tex);
    return tex;
  }

  buildSky() {
    // Sky dome with a vertical gradient texture: saturated golden-hour
    // colour at the zenith, lightening toward a pale blue-tinged horizon
    // — brighter daylight clarity at the horizon, golden hour kept
    // overhead. Repainted only when the time of day moves.
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 8; this.skyCanvas.height = 256;
    this.skyCtx = this.skyCanvas.getContext('2d');
    this.skyTex = new THREE.CanvasTexture(this.skyCanvas);
    this.skyMat = new THREE.MeshBasicMaterial({ map: this.skyTex, side: THREE.BackSide, fog: false });
    const geo = new THREE.SphereGeometry(900, 24, 16);
    this.sky = new THREE.Mesh(geo, this.skyMat);
    this.group.add(this.sky);
    this.skyDayT = -1;
    this.paintSky(0, new THREE.Color().setHSL(38 / 360, 0.82, 0.62));
    // Sun disc sprite — big and strong, so the sun actually reads in
    // the frame instead of a faint smudge.
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
    const cx = cv.getContext('2d');
    const g = cx.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,240,200,1)'); g.addColorStop(0.35, 'rgba(255,190,90,0.9)'); g.addColorStop(1, 'rgba(255,140,60,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, 128, 128);
    const tex = new THREE.CanvasTexture(cv);
    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    this.sunSprite.scale.set(300, 300, 1);
    this.sunSprite.position.set(-520, 150, -260);
    this.group.add(this.sunSprite);
    // Clouds: flat white puffs drifting high up, so the dusk sky is
    // never a flat magenta field. Each cloud is 3–5 squashed spheres.
    this.clouds = [];
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffe8d8, transparent: true, opacity: 0.8, fog: false });
    const cloudMat2 = new THREE.MeshBasicMaterial({ color: 0xf2d8e8, transparent: true, opacity: 0.7, fog: false });
    for (let i = 0; i < 18; i++) {
      const cl = new THREE.Group();
      const puffs = 3 + Math.floor(Math.random() * 3);
      for (let p = 0; p < puffs; p++) {
        const s = new THREE.Mesh(new THREE.SphereGeometry(rand(30, 48), 8, 6), p % 2 ? cloudMat : cloudMat2);
        s.scale.y = 0.32;
        s.position.set(p * rand(24, 36) - puffs * 15, rand(-3, 4), rand(-8, 8));
        cl.add(s);
      }
      // Evenly spaced around the sky (with a little jitter), so every
      // direction has clouds. Low enough (70–130 m) that a level street
      // camera actually sees them.
      const a = (i / 18) * Math.PI * 2 + rand(-0.2, 0.2), r = rand(200, 420);
      cl.position.set(Math.cos(a) * r, rand(70, 130), Math.sin(a) * r);
      cl.userData.x0 = cl.position.x;
      this.group.add(cl);
      this.clouds.push(cl);
    }
  }

  // Repaint the sky gradient for the current time of day. Canvas top
  // (y=0) is the zenith, middle (y=128) the horizon: the zenith keeps
  // the golden-hour hue, the horizon turns pale blue. Skipped unless
  // the time of day actually moved.
  paintSky(dayT, col) {
    if (Math.abs(dayT - this.skyDayT) < 0.02) return;
    this.skyDayT = dayT;
    const cx = this.skyCtx;
    const H = 256;
    const mid = col.clone().lerp(new THREE.Color(0xffffff), 0.35);
    const hor = col.clone().lerp(new THREE.Color(0xffffff), 0.45).lerp(new THREE.Color(0x9ec8dd), 0.55);
    const g = cx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#' + col.getHexString());
    g.addColorStop(0.28, '#' + mid.getHexString());
    g.addColorStop(0.5, '#' + hor.getHexString());
    g.addColorStop(0.52, '#' + hor.getHexString());
    g.addColorStop(1, '#3a2a4a');
    cx.fillStyle = g;
    cx.fillRect(0, 0, 8, H);
    this.skyTex.needsUpdate = true;
  }

  buildGround() {
    // Base ground: warm sand-toned. It stops at the shoreline (x = -182)
    // so it never covers the ocean plane (y = -0.4, x <= -182).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(532, 700),
      new THREE.MeshStandardMaterial({ color: 0x9c8a6a, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2; ground.position.set(84, -0.05, 0); ground.receiveShadow = true;
    this.group.add(ground);
    // City slab (asphalt grey) over the downtown area. It stops at the
    // sand strip's east edge (x = -170) so it never covers the water.
    const slab = new THREE.Mesh(
      new THREE.PlaneGeometry(380, 420),
      new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.95 })
    );
    slab.rotation.x = -Math.PI / 2; slab.position.set(20, 0, 0); slab.receiveShadow = true;
    this.group.add(slab);
    // Roads: darker strips along the grid. The beach road (x = -160) is
    // a 4-lane boulevard, 14 m wide — every other street stays 7 m.
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2e2e36, roughness: 0.9 });
    for (let x = WORLD.streetMin; x <= WORLD.streetMax; x += WORLD.streetStep) {
      const w = x === BEACH_ROAD.x ? BEACH_ROAD.halfWidth * 2 : 7;
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, 400), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.02, 0); r.receiveShadow = true;
      this.group.add(r);
    }
    for (let z = WORLD.streetMin; z <= WORLD.streetMax; z += WORLD.streetStep) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(400, 7), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(0, 0.02, z); r.receiveShadow = true;
      this.group.add(r);
    }
    // Centre dashes on the 2-lane streets. The beach road gets its own
    // markings (double yellow centre + dashed white lane dividers) in
    // buildProps, so it is skipped here.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8c96a });
    for (let x = WORLD.streetMin; x <= WORLD.streetMax; x += WORLD.streetStep) {
      if (x === BEACH_ROAD.x) continue;
      for (let z = -180; z <= 180; z += 16) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 3), dashMat);
        d.rotation.x = -Math.PI / 2; d.position.set(x, 0.04, z);
        this.group.add(d);
      }
    }
    // Beach sand: a 12 m band between the water (x = -182) and the
    // promenade (x = -170..-167), so the turquoise ocean sits close to
    // the beach road and reads in frame, not 60 m away.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 420),
      new THREE.MeshStandardMaterial({ color: 0xd9b98a, roughness: 1 })
    );
    sand.rotation.x = -Math.PI / 2; sand.position.set(-176, 0.01, 0); sand.receiveShadow = true;
    this.group.add(sand);
  }

  buildOcean() {
    // Turquoise water, not flat navy: a bright sea with white wave lines
    // rolling toward the sand. The water's edge is at x = -182, right
    // against the sand band, so the sea is a broad band — never a thin
    // strip on the horizon.
    this.ocean = new THREE.Mesh(
      new THREE.PlaneGeometry(320, 700, 24, 24),
      new THREE.MeshStandardMaterial({ color: 0x1f8a9a, roughness: 0.3, metalness: 0.25, transparent: true, opacity: 0.94 })
    );
    this.ocean.rotation.x = -Math.PI / 2;
    this.ocean.position.set(-342, -0.4, 0);
    this.group.add(this.ocean);
    // Wave crests: white foam strips parallel to the shore, at several
    // distances out. The nearest one breaks just off the sand.
    this.waves = [];
    for (const [wx, ww, op] of [[-195, 2.0, 0.6], [-215, 2.2, 0.55], [-245, 1.6, 0.4], [-280, 2.6, 0.3], [-320, 1.8, 0.25]]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(ww, 680), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: op }));
      w.rotation.x = -Math.PI / 2;
      w.position.set(wx, -0.25, 0);
      w.userData.x0 = wx;
      this.group.add(w);
      this.waves.push(w);
    }
    // Golden-hour amber glints near the horizon: thin warm strips on
    // the water where the low sun catches it.
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffc860, transparent: true, opacity: 0.3 });
    for (const gx of [-205, -225]) {
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 680), glintMat);
      gl.rotation.x = -Math.PI / 2;
      gl.position.set(gx, -0.22, 0);
      gl.userData.x0 = gx;
      this.group.add(gl);
      this.waves.push(gl);
    }
  }

  buildPier() {
    const p = WORLD.pier;
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(p.x1 - p.x0, 1.2, p.width),
      new THREE.MeshStandardMaterial({ color: 0x8a6a4a, roughness: 0.9 })
    );
    deck.position.set((p.x0 + p.x1) / 2, 0.4, p.z);
    deck.castShadow = true; deck.receiveShadow = true;
    this.group.add(deck);
    // Posts + rails.
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5e4630, roughness: 1 });
    for (let x = p.x0 + 4; x <= p.x1 - 2; x += 14) {
      for (const z of [p.z - p.width / 2 + 0.5, p.z + p.width / 2 - 0.5]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 4, 6), postMat);
        post.position.set(x, -1.2, z);
        this.group.add(post);
      }
      const rail = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 0.3), postMat);
      rail.position.set(x, 1.6, p.z - p.width / 2 + 0.5); this.group.add(rail);
      const rail2 = rail.clone(); rail2.position.z = p.z + p.width / 2 - 0.5; this.group.add(rail2);
    }
    // Shack at the pier end (Lupe's spot).
    const shack = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(7, 4, 5), new THREE.MeshStandardMaterial({ color: 0xe8d9b0, roughness: 0.9 }));
    walls.position.y = 3; walls.castShadow = true; shack.add(walls);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.4, 4), new THREE.MeshStandardMaterial({ color: 0xb8442f, roughness: 0.85 }));
    roof.position.y = 6.2; roof.rotation.y = Math.PI / 4; roof.castShadow = true; shack.add(roof);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 2.6), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
    door.position.set(0, 2.3, 2.55); shack.add(door);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.0), new THREE.MeshStandardMaterial({ color: 0xffd98a, emissive: 0xffb347, emissiveIntensity: 0.7 }));
    win.position.set(-2, 3.2, 2.55); shack.add(win);
    this.windowMats.push(win.material);
    shack.position.set(-252, 0.9, 14);
    this.group.add(shack);
  }

  // One building: pastel walls, plinth, one of three roof silhouettes,
  // roof furniture, an optional setback upper tier, framed windows with
  // depth, a neon bar, and an awning + door on the street face.
  makeBuilding(w, d, h) {
    const pastel = PASTELS[Math.floor(Math.random() * PASTELS.length)];
    const b = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: pastel, roughness: 0.85 }));
    walls.position.y = h / 2; walls.castShadow = true; walls.receiveShadow = true;
    b.add(walls);
    const plinth = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.5, 1.0, d + 0.5),
      new THREE.MeshStandardMaterial({ color: 0x5a4a42, roughness: 0.95 })
    );
    plinth.position.y = 0.5; plinth.receiveShadow = true; b.add(plinth);
    // Roof — hip pyramid, mono-pitch slope, or flat deck + parapet.
    const roofKind = pick(['hip', 'pitch', 'flat']);
    const roofCol = pick(ROOFS);
    if (roofKind === 'hip') {
      const hip = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.72, rand(2.2, 3.6), 4),
        new THREE.MeshStandardMaterial({ color: roofCol, roughness: 0.9 })
      );
      hip.position.y = h + 1.4; hip.rotation.y = Math.PI / 4; hip.castShadow = true; b.add(hip);
    } else if (roofKind === 'pitch') {
      const slope = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.8, 0.35, d + 0.8),
        new THREE.MeshStandardMaterial({ color: roofCol, roughness: 0.9 })
      );
      slope.position.y = h + 0.7;
      slope.rotation.z = 0.16; slope.rotation.x = 0.08; slope.castShadow = true; b.add(slope);
    } else {
      const deck = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.8, 0.7, d + 0.8),
        new THREE.MeshStandardMaterial({ color: roofCol, roughness: 0.9 })
      );
      deck.position.y = h + 0.35; deck.castShadow = true; b.add(deck);
      const parMat = new THREE.MeshStandardMaterial({ color: pastel, roughness: 0.85 });
      for (const [pw, pd, px, pz] of [[w + 0.8, 0.3, 0, d / 2 + 0.25], [w + 0.8, 0.3, 0, -d / 2 - 0.25], [0.3, d + 0.8, w / 2 + 0.25, 0], [0.3, d + 0.8, -w / 2 - 0.25, 0]]) {
        const par = new THREE.Mesh(new THREE.BoxGeometry(pw, 0.9, pd), parMat);
        par.position.set(px, h + 1.1, pz); b.add(par);
      }
    }
    // Roof furniture: water tank + AC box, so no roof is bare.
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.2, 8), new THREE.MeshStandardMaterial({ color: 0x7a7a82, roughness: 0.7, metalness: 0.4 }));
    tank.position.set(w * 0.22, h + 1.9, -d * 0.18); b.add(tank);
    const ac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 1.2), new THREE.MeshStandardMaterial({ color: 0x9a9aa2, roughness: 0.6, metalness: 0.5 }));
    ac.position.set(-w * 0.25, h + 1.2, d * 0.2); b.add(ac);
    // Setback upper tier on a third of the tall buildings.
    if (h > 14 && Math.random() < 0.35) {
      const tw = w * rand(0.5, 0.65), td = d * rand(0.5, 0.65), th = rand(3, 6);
      const tier = new THREE.Mesh(
        new THREE.BoxGeometry(tw, th, td),
        new THREE.MeshStandardMaterial({ color: pick(PASTELS), roughness: 0.85 })
      );
      tier.position.set(rand(-1.5, 1.5), h + 0.9 + th / 2, rand(-1.5, 1.5));
      tier.castShadow = true;
      b.add(tier);
      const tierRoof = new THREE.Mesh(
        new THREE.BoxGeometry(tw + 0.6, 0.7, td + 0.6),
        new THREE.MeshStandardMaterial({ color: pick(ROOFS), roughness: 0.9 })
      );
      tierRoof.position.set(tier.position.x, h + 0.9 + th + 0.35, tier.position.z);
      b.add(tierRoof);
    }
    // Windows with depth: a dark frame box proud of the wall, then the
    // lit (or dark) pane set into it.
    const frameGeo = new THREE.BoxGeometry(2.0, 1.5, 0.14);
    const paneGeo = new THREE.PlaneGeometry(1.6, 1.1);
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.8 });
    const floors = Math.min(5, Math.max(2, Math.floor(h / 4.5)));
    const balconyFloor = h > 12 && Math.random() < 0.4 ? 1 + Math.floor(Math.random() * (floors - 1)) : -1;
    for (let f = 0; f < floors; f++) {
      const y = 2.8 + f * 3.8;
      for (let k = -1; k <= 1; k++) {
        const lit = Math.random() < 0.55;
        const wm = new THREE.MeshStandardMaterial({ color: lit ? 0xffe2a0 : 0x2a3444, emissive: lit ? 0xffb347 : 0x000000, emissiveIntensity: lit ? 0.9 : 0 });
        if (lit) this.windowMats.push(wm);
        for (const side of [1, -1]) {
          const fr = new THREE.Mesh(frameGeo, frameMat);
          fr.position.set(k * w * 0.28, y, side * (d / 2 + 0.05));
          if (side < 0) fr.rotation.y = Math.PI;
          b.add(fr);
          const pn = new THREE.Mesh(paneGeo, wm);
          pn.position.set(k * w * 0.28, y, side * (d / 2 + 0.13));
          if (side < 0) pn.rotation.y = Math.PI;
          b.add(pn);
        }
      }
      for (let k = -1; k <= 1; k += 2) {
        const lit = Math.random() < 0.5;
        const wm = new THREE.MeshStandardMaterial({ color: lit ? 0xffe2a0 : 0x2a3444, emissive: lit ? 0xffb347 : 0x000000, emissiveIntensity: lit ? 0.9 : 0 });
        if (lit) this.windowMats.push(wm);
        for (const side of [1, -1]) {
          const pn = new THREE.Mesh(paneGeo, wm);
          pn.position.set(side * (w / 2 + 0.06), y, k * d * 0.28);
          pn.rotation.y = side * Math.PI / 2;
          b.add(pn);
        }
      }
      if (f === balconyFloor) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.25, 1.6), new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 0.9 }));
        slab.position.set(0, y - 1.1, d / 2 + 0.8); slab.castShadow = true; b.add(slab);
        const rail = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 0.9, 0.08), new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.6, metalness: 0.5 }));
        rail.position.set(0, y - 0.5, d / 2 + 1.55); b.add(rail);
      }
    }
    // Neon bar on the street face.
    const neon = NEON_COLOURS[Math.floor(Math.random() * NEON_COLOURS.length)];
    const nm = new THREE.MeshStandardMaterial({ color: neon, emissive: neon, emissiveIntensity: 1.6 });
    this.neonMats.push(nm);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(rand(3, 5), 0.7, 0.3), nm);
    sign.position.set(0, Math.min(h - 1.2, 7.5), d / 2 + 0.25);
    b.add(sign);
    // Awning over the entrance: a striped slope on two thin poles, so
    // the ground floor reads as a shopfront, not a blank wall.
    if (Math.random() < 0.6) {
      const awnCol = pick([0xff5da2, 0x39d0ff, 0xffd23f, 0x7dff5e, 0xe8e8e8]);
      const awn = new THREE.Mesh(
        new THREE.BoxGeometry(5.5, 0.12, 2.0),
        new THREE.MeshStandardMaterial({ color: awnCol, roughness: 0.8 })
      );
      awn.position.set(0, 2.9, d / 2 + 1.0);
      awn.rotation.x = 0.28;
      awn.castShadow = true;
      b.add(awn);
      for (const ax of [-2.5, 2.5]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.9, 6), frameMat);
        pole.position.set(ax, 1.45, d / 2 + 1.9);
        b.add(pole);
      }
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.4), new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.7 }));
      door.position.set(0, 1.7, d / 2 + 0.06);
      b.add(door);
    }
    return b;
  }

  buildCity() {
    // Buildings fill the blocks between streets. The beachfront column
    // belongs to the beach wall; the central plaza stays open; a few
    // blocks stay empty lots.
    for (let gx = WORLD.streetMin + 20; gx <= WORLD.streetMax - 20; gx += WORLD.streetStep) {
      for (let gz = WORLD.streetMin + 20; gz <= WORLD.streetMax - 20; gz += WORLD.streetStep) {
        if (gx === -140) continue;
        if (Math.abs(gx) < 24 && Math.abs(gz) < 24) continue;
        if (gx === -140 && gz === -140) continue;
        if (Math.random() < 0.18) continue;
        const w = rand(12, 18), d = rand(12, 18), h = rand(9, 30);
        const b = this.makeBuilding(w, d, h);
        b.position.set(gx + rand(-4, 4), 0, gz + rand(-4, 4));
        this.group.add(b);
      }
    }
  }

  // Continuous pastel street wall along the east side of the beach road
  // (x = -140): a Miami / art-deco strip, building after building with
  // almost no gaps, so the beach road is framed on the city side just as
  // the palms + ocean frame it on the sand side. The Solara Loft
  // (z -152..-128) is left out — it already stands there as part of
  // the wall. The detailed face is the WEST (road) face: framed lit
  // windows, awnings, doors and neon signs, all facing the street.
  buildBeachWall() {
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.8 });
    for (let z = -180; z <= 180; z += 15) {
      if (z > -152 && z < -128) continue; // the Solara Loft stands here
      const w = rand(12, 16), d = rand(13, 16), h = rand(9, 22);
      const b = this.makeBuilding(w, d, h);
      // The shared builder faces its detail south (+z); the wall needs
      // it facing WEST (-x, the road). Rotate the whole building so its
      // street face turns to the road, and put the readable neon sign
      // on that face, angled toward a camera looking south down the road.
      b.rotation.y = -Math.PI / 2;
      const ns = NEON_SIGNS[Math.floor(Math.random() * NEON_SIGNS.length)];
      const signTex = this.neonSignTex(ns.text, ns.color);
      const nm = new THREE.MeshStandardMaterial({ map: signTex, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.4 });
      this.neonMats.push(nm);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.5, 1.0), nm);
      // After the -90° turn, the building's old +z face points west.
      sign.position.set(0, Math.min(h - 1.2, 7.5), d / 2 + 0.6);
      sign.rotation.y = -0.7; // angled ~40° toward the north-west
      b.add(sign);
      b.position.set(-140 + rand(-1, 1), 0, z + rand(-1, 1));
      this.group.add(b);
    }
  }

  // Distant towers: four tall slabs on the far edge of the grid, each
  // stepping back twice as it rises, windows lit, a red beacon on top.
  // They give the skyline height the mid-rise blocks cannot.
  buildTowers() {
    const spots = [
      { x: 168, z: -148, h: 58, c: 0xc9d6e8 },
      { x: 172, z: 60, h: 48, c: 0xe8c9d9 },
      { x: 148, z: 168, h: 64, c: 0xf7e08a },
      { x: -100, z: -172, h: 44, c: 0xd9e2c0 },
    ];
    const winGeo = new THREE.PlaneGeometry(1.6, 1.1);
    for (const s of spots) {
      const t = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({ color: s.c, roughness: 0.85 });
      const tiers = [[22, s.h * 0.55], [16, s.h * 0.3], [10, s.h * 0.15]];
      let y = 0;
      for (const [w, th] of tiers) {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(w, th, w), mat);
        slab.position.y = y + th / 2; slab.castShadow = true; t.add(slab);
        y += th;
      }
      const floors = Math.floor(s.h / 4);
      for (let f = 0; f < floors; f++) {
        const wy = 3 + f * 4;
        if (wy > s.h - 2) break;
        const w = wy < s.h * 0.55 ? 22 : wy < s.h * 0.85 ? 16 : 10;
        for (let k = -1; k <= 1; k++) {
          const lit = Math.random() < 0.6;
          const wm = new THREE.MeshStandardMaterial({ color: lit ? 0xffe2a0 : 0x2a3444, emissive: lit ? 0xffb347 : 0x000000, emissiveIntensity: lit ? 0.9 : 0 });
          if (lit) this.windowMats.push(wm);
          for (const [px, pz, ry] of [[k * w * 0.3, w / 2 + 0.06, 0], [k * w * 0.3, -w / 2 - 0.06, Math.PI], [w / 2 + 0.06, k * w * 0.3, Math.PI / 2], [-w / 2 - 0.06, k * w * 0.3, -Math.PI / 2]]) {
            const pane = new THREE.Mesh(winGeo, wm);
            pane.position.set(px, wy, pz); pane.rotation.y = ry; t.add(pane);
          }
        }
      }
      const beacon = new THREE.Mesh(
        new THREE.SphereGeometry(0.7, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 2 })
      );
      beacon.position.y = s.h + 1; t.add(beacon);
      t.position.set(s.x, 0, s.z);
      this.group.add(t);
    }
  }

  buildPalms() {
    // Palm rows line the beach road (x = -160) on BOTH sides, tight
    // enough to read as a green wall from the road: a sand-side row and
    // a city-side row, plus scattered palms in the blocks. Every palm
    // lands in this.palms (shots hide ones near a staged sightline).
    // A palm is a curved trunk, a full drooping crown of fronds and a
    // couple of coconuts — not a stick with a cone on top.
    const trunkGeo = new THREE.CylinderGeometry(0.28, 0.5, 8, 6);
    const frondGeo = new THREE.ConeGeometry(0.75, 4.2, 4);
    const nutGeo = new THREE.SphereGeometry(0.28, 6, 5);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
    const frondMat = new THREE.MeshStandardMaterial({ color: 0x2e8a4a, roughness: 0.9 });
    const frondMat2 = new THREE.MeshStandardMaterial({ color: 0x46a85e, roughness: 0.9 });
    const nutMat = new THREE.MeshStandardMaterial({ color: 0x6a4a22, roughness: 0.9 });
    const makePalm = (x, z, s) => {
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 3.6;
      trunk.scale.y = s;
      trunk.rotation.z = rand(-0.06, 0.06);
      trunk.castShadow = true;
      palm.add(trunk);
      const crownY = 7.3 * s;
      const fronds = 7;
      for (let f = 0; f < fronds; f++) {
        const leaf = new THREE.Mesh(frondGeo, f % 2 ? frondMat : frondMat2);
        const a = (f / fronds) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 1.7, crownY, Math.sin(a) * 1.7);
        leaf.rotation.z = Math.cos(a) * 1.9;
        leaf.rotation.x = -Math.sin(a) * 1.9;
        leaf.scale.set(1, 1, 0.45);
        leaf.castShadow = true;
        palm.add(leaf);
      }
      for (let n = 0; n < 2; n++) {
        const nut = new THREE.Mesh(nutGeo, nutMat);
        const a = rand(0, Math.PI * 2);
        nut.position.set(Math.cos(a) * 0.5, crownY - 0.5, Math.sin(a) * 0.5);
        palm.add(nut);
      }
      palm.position.set(x, 0, z);
      palm.rotation.y = Math.random() * Math.PI * 2;
      this.group.add(palm);
      this.palms.push(palm);
    };
    for (let z = -185; z <= 185; z += 10) makePalm(-171, z + rand(-2, 2), rand(0.9, 1.15));
    for (let z = -180; z <= 180; z += 12) makePalm(-151, z + rand(-2, 2), rand(0.85, 1.1));
    for (let i = 0; i < 20; i++) {
      const x = rand(-195, 195), z = rand(-195, 195);
      if (Math.abs(x % 40) < 8 || Math.abs(z % 40) < 8) continue;
      if (x > -178 && x < -142) continue;
      makePalm(x, z, rand(0.85, 1.15));
    }
  }

  // The Solara Loft — Kai's safehouse: a pink two-storey with a setback
  // upper floor, a hip roof, a striped awning and a big pink neon sign.
  buildLandmarkLoft() {
    const g = new THREE.Group();
    const pink = new THREE.MeshStandardMaterial({ color: 0xf2a0c0, roughness: 0.85 });
    const lilac = new THREE.MeshStandardMaterial({ color: 0xd9b8f0, roughness: 0.85 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8f2f26, roughness: 0.9 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 12), pink);
    base.position.y = 5; base.castShadow = true; base.receiveShadow = true; g.add(base);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(16.5, 1.0, 12.5), new THREE.MeshStandardMaterial({ color: 0x5a4a42, roughness: 0.95 }));
    plinth.position.y = 0.5; g.add(plinth);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(10, 5, 9), lilac);
    upper.position.set(-2, 12.5, -1); upper.castShadow = true; g.add(upper);
    const hip = new THREE.Mesh(new THREE.ConeGeometry(8.4, 3.0, 4), roofMat);
    hip.position.set(0, 11.9, 0); hip.rotation.y = Math.PI / 4; hip.castShadow = true; g.add(hip);
    const hip2 = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.2, 4), roofMat);
    hip2.position.set(-2, 16.4, -1); hip2.rotation.y = Math.PI / 4; g.add(hip2);
    const winMat = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb347, emissiveIntensity: 0.9 });
    this.windowMats.push(winMat);
    const frMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.8 });
    for (const wy of [3, 7]) {
      for (const wx of [-5, 0, 5]) {
        const fr = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.6, 0.14), frMat);
        fr.position.set(wx, wy, 6.05); g.add(fr);
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.3), winMat);
        w.position.set(wx, wy, 6.13); g.add(w);
      }
    }
    const awn = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.12, 1.8), new THREE.MeshStandardMaterial({ color: 0xff5da2, roughness: 0.8 }));
    awn.position.set(0, 3.1, 6.9); awn.rotation.x = 0.28; g.add(awn);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.6), new THREE.MeshStandardMaterial({ color: 0x3a1a2a, roughness: 0.7 }));
    door.position.set(0, 1.8, 6.06); g.add(door);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
    const cx = cv.getContext('2d');
    cx.fillStyle = '#1a0512'; cx.fillRect(0, 0, 512, 96);
    cx.font = '900 56px sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowColor = '#ff5da2'; cx.shadowBlur = 22;
    cx.fillStyle = '#ff9ac6'; cx.fillText('SOLARA LOFT', 256, 50);
    cx.shadowBlur = 0; cx.fillStyle = '#ffd7ea'; cx.fillText('SOLARA LOFT', 256, 50);
    const tex = new THREE.CanvasTexture(cv);
    const signMat = new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1.4 });
    this.neonMats.push(signMat);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.1), signMat);
    sign.position.set(0, 9.2, 6.15); g.add(sign);
    g.position.set(-140, 0, -140);
    this.group.add(g);
  }

  // Street props: tiled sidewalks, double-yellow centre lines, white edge
  // lines, grass patches, benches, trash bins, bus stops, beach umbrellas
  // and a foam line where the ocean meets the sand.
  buildProps() {
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x8a8a92, roughness: 1 });
    const grassMat = new THREE.MeshStandardMaterial({ color: 0x4a7a3a, roughness: 1 });
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.9 });
    const binMat = new THREE.MeshStandardMaterial({ color: 0x3a5a44, roughness: 0.7, metalness: 0.3 });
    const whiteMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xf2c230 });
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
    const streets = [];
    for (let v = WORLD.streetMin; v <= WORLD.streetMax; v += WORLD.streetStep) streets.push(v);
    const swV = new THREE.PlaneGeometry(3, 400);
    const swH = new THREE.PlaneGeometry(400, 3);
    for (const v of streets) {
      for (const off of [-5.5, 5.5]) {
        if (v !== BEACH_ROAD.x) {
          const s1 = new THREE.Mesh(swV, sidewalkMat);
          s1.rotation.x = -Math.PI / 2; s1.position.set(v + off, 0.03, 0); s1.receiveShadow = true; this.group.add(s1);
        }
        const s2 = new THREE.Mesh(swH, sidewalkMat);
        s2.rotation.x = -Math.PI / 2; s2.position.set(0, 0.03, v + off); s2.receiveShadow = true; this.group.add(s2);
      }
    }
    // Beach road east sidewalk (city side), 3 m wide.
    const beachSw = new THREE.Mesh(new THREE.PlaneGeometry(3, 400), sidewalkMat);
    beachSw.rotation.x = -Math.PI / 2; beachSw.position.set(-151.5, 0.03, 0); beachSw.receiveShadow = true; this.group.add(beachSw);
    // Double yellow centre lines + white edge lines on the 2-lane streets.
    const yelV = new THREE.PlaneGeometry(0.28, 400);
    const yelH = new THREE.PlaneGeometry(400, 0.28);
    const edgeV = new THREE.PlaneGeometry(0.35, 400);
    const edgeH = new THREE.PlaneGeometry(400, 0.35);
    for (const v of streets) {
      for (const off of [-0.45, 0.45]) {
        if (v !== BEACH_ROAD.x) {
          const y1 = new THREE.Mesh(yelV, yellowMat);
          y1.rotation.x = -Math.PI / 2; y1.position.set(v + off, 0.05, 0); this.group.add(y1);
        }
        const y2 = new THREE.Mesh(yelH, yellowMat);
        y2.rotation.x = -Math.PI / 2; y2.position.set(0, 0.05, v + off); this.group.add(y2);
      }
      for (const off of [-3.4, 3.4]) {
        if (v !== BEACH_ROAD.x) {
          const e1 = new THREE.Mesh(edgeV, whiteMat);
          e1.rotation.x = -Math.PI / 2; e1.position.set(v + off, 0.05, 0); this.group.add(e1);
        }
        const e2 = new THREE.Mesh(edgeH, whiteMat);
        e2.rotation.x = -Math.PI / 2; e2.position.set(0, 0.05, v + off); this.group.add(e2);
      }
    }
    // Beach road markings: double solid yellow centre, dashed white
    // lane dividers, solid white edge lines.
    for (const off of BEACH_ROAD.centreYellow) {
      const y = new THREE.Mesh(yelV, yellowMat);
      y.rotation.x = -Math.PI / 2; y.position.set(off, 0.05, 0); this.group.add(y);
    }
    const laneDashGeo = new THREE.PlaneGeometry(0.3, 3);
    for (const dx of BEACH_ROAD.laneDividers) {
      for (let z = -196; z <= 196; z += 8) {
        const d = new THREE.Mesh(laneDashGeo, whiteMat);
        d.rotation.x = -Math.PI / 2; d.position.set(dx, 0.05, z); this.group.add(d);
      }
    }
    for (const ex of [-166.8, -153.2]) {
      const e = new THREE.Mesh(edgeV, whiteMat);
      e.rotation.x = -Math.PI / 2; e.position.set(ex, 0.05, 0); this.group.add(e);
    }
    // Curbs: a low raised lip where sidewalk meets road, on every street.
    const curbMat = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 1 });
    const curbV = new THREE.BoxGeometry(0.25, 0.18, 400);
    const curbH = new THREE.BoxGeometry(400, 0.18, 0.25);
    for (const v of streets) {
      for (const off of [-3.6, 3.6]) {
        if (v !== BEACH_ROAD.x) {
          const c1 = new THREE.Mesh(curbV, curbMat);
          c1.position.set(v + off, 0.09, 0); this.group.add(c1);
        }
        const c2 = new THREE.Mesh(curbH, curbMat);
        c2.position.set(0, 0.09, v + off); this.group.add(c2);
      }
    }
    for (const cx of [-167.1, -152.9]) {
      const c = new THREE.Mesh(curbV, curbMat);
      c.position.set(cx, 0.09, 0); this.group.add(c);
    }
    // Crosswalks: zebra stripes across the road at six intersections.
    const stripeGeo = new THREE.PlaneGeometry(0.7, 6.4);
    const crossSpots = [[0, 0, 'x'], [-40, 40, 'z'], [40, -40, 'x'], [-160, 0, 'z'], [-160, 60, 'z'], [-160, -60, 'z']];
    for (const [cx, cz, axis] of crossSpots) {
      for (let k = -2; k <= 2; k++) {
        const st = new THREE.Mesh(stripeGeo, whiteMat);
        st.rotation.x = -Math.PI / 2;
        if (axis === 'x') { st.position.set(cx + k * 1.3, 0.06, cz); }
        else { st.rotation.z = Math.PI / 2; st.position.set(cx, 0.06, cz + k * 1.3); }
        this.group.add(st);
      }
    }
    // Beach promenade: a narrow pale paved walk between the sand and
    // the beach road, under the sand-side palm row.
    const prom = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 390),
      new THREE.MeshStandardMaterial({ color: 0xc9b8a0, roughness: 1 })
    );
    prom.rotation.x = -Math.PI / 2; prom.position.set(-168.5, 0.04, 0); prom.receiveShadow = true; this.group.add(prom);
    // Grass patches in the blocks.
    const grassGeo = new THREE.PlaneGeometry(14, 14);
    for (let i = 0; i < 12; i++) {
      const gx = pick([-140, -100, -60, -20, 20, 60, 100, 140]) + rand(-8, 8);
      const gz = pick([-140, -100, -60, -20, 20, 60, 100, 140]) + rand(-8, 8);
      const patch = new THREE.Mesh(grassGeo, grassMat);
      patch.rotation.x = -Math.PI / 2; patch.position.set(gx, 0.03, gz); patch.receiveShadow = true; this.group.add(patch);
    }
    // Benches (seat + back + legs) with a bin beside each, on pavements.
    const seatGeo = new THREE.BoxGeometry(2.4, 0.18, 0.7);
    const legGeo = new THREE.BoxGeometry(0.18, 0.5, 0.6);
    const backGeo = new THREE.BoxGeometry(2.4, 0.7, 0.14);
    const binGeo = new THREE.CylinderGeometry(0.45, 0.4, 1.0, 8);
    for (let i = 0; i < 18; i++) {
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      const line = pick([-160, -120, -80, -40, 0, 40, 80, 120, 160]);
      const along = rand(-170, 170);
      const off = Math.random() < 0.5 ? 6.8 : -6.8;
      const bx = axis === 'x' ? along : line + off;
      const bz = axis === 'x' ? line + off : along;
      const bench = new THREE.Group();
      const seat = new THREE.Mesh(seatGeo, benchMat); seat.position.y = 0.55; seat.castShadow = true; bench.add(seat);
      const back = new THREE.Mesh(backGeo, benchMat); back.position.set(0, 1.0, -0.3); bench.add(back);
      for (const lx of [-1, 1]) { const leg = new THREE.Mesh(legGeo, benchMat); leg.position.set(lx, 0.25, 0); bench.add(leg); }
      bench.position.set(bx, 0, bz);
      bench.rotation.y = axis === 'x' ? Math.PI / 2 : 0;
      this.group.add(bench);
      const bin = new THREE.Mesh(binGeo, binMat);
      bin.position.set(bx + rand(-2, 2), 0.5, bz + rand(-2, 2)); bin.castShadow = true; this.group.add(bin);
    }
    // Bus stops: shelter roof + bench + yellow sign, at four downtown corners.
    const shelterMat = new THREE.MeshStandardMaterial({ color: 0x2f6fb5, roughness: 0.6, metalness: 0.3 });
    const stopSignMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xcc9900, emissiveIntensity: 0.7 });
    for (const [sx, sz] of [[-116, -76], [116, 76], [-76, 116], [76, -116]]) {
      const stop = new THREE.Group();
      const roof = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.2, 2.2), shelterMat);
      roof.position.y = 2.8; roof.castShadow = true; stop.add(roof);
      for (const px of [-2, 2]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 2.8, 6), binMat);
        pole.position.set(px, 1.4, 0.9); stop.add(pole);
      }
      const seat = new THREE.Mesh(seatGeo, benchMat); seat.position.y = 0.55; stop.add(seat);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.1), stopSignMat);
      sign.position.set(-2.4, 2.2, 0); stop.add(sign);
      stop.position.set(sx, 0, sz);
      this.group.add(stop);
    }
    // Beach umbrellas on the sand: three blue (shifted slightly teal
    // for SOLARA) at the right edge near the chase cluster, plus three
    // more scattered along the sand so the beach reads furnished.
    const umbBlue = [0x2f7fb5, 0x39a0c8, 0x2f8fb5];
    const umbPoleGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.6, 6);
    const umbGeo = new THREE.ConeGeometry(2.2, 1.0, 8);
    const umbSpots = [[-176, 35], [-176, 60], [-176, 85], [-177, -40], [-175, -110], [-177, 140]];
    umbSpots.forEach(([ux, uz], i) => {
      const pole = new THREE.Mesh(umbPoleGeo, benchMat); pole.position.set(ux, 1.3, uz); this.group.add(pole);
      const umb = new THREE.Mesh(umbGeo, new THREE.MeshStandardMaterial({ color: umbBlue[i % umbBlue.length], roughness: 0.8 }));
      umb.position.set(ux, 2.9, uz); umb.castShadow = true; this.group.add(umb);
    });
    // Foam where the ocean meets the sand (the water's edge, x=-183).
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 420), foamMat);
    foam.rotation.x = -Math.PI / 2; foam.position.set(-183, 0.02, 0); this.group.add(foam);
  }

  // Utility poles (tiang listrik): wooden poles with two crossarms,
  // ceramic insulators, a transformer can on every third pole, and wires
  // sagging between consecutive poles. Poles stand at block centres along
  // the beach road and two downtown streets — never in a roadway.
  buildUtilityPoles() {
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a4230, roughness: 1 });
    const armWood = new THREE.MeshStandardMaterial({ color: 0x4a3826, roughness: 1 });
    const ceramic = new THREE.MeshStandardMaterial({ color: 0xd8d4c8, roughness: 0.5 });
    const wireMat = new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.9 });
    const canMat = new THREE.MeshStandardMaterial({ color: 0x6a6a72, roughness: 0.7, metalness: 0.4 });
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 9.5, 7);
    const longArmGeo = new THREE.BoxGeometry(2.6, 0.18, 0.18);
    const shortArmGeo = new THREE.BoxGeometry(2.0, 0.16, 0.16);
    const insGeo = new THREE.CylinderGeometry(0.1, 0.13, 0.28, 6);
    const canGeo = new THREE.BoxGeometry(0.55, 0.9, 0.5);
    // One pole: trunk, two crossarms with an insulator at each end, and a
    // transformer can when it is the third pole on its line.
    const makePole = (x, z, alongX, withCan) => {
      const pole = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, wood);
      trunk.position.y = 4.75; trunk.castShadow = true; pole.add(trunk);
      const arms = [[longArmGeo, 8.9, 1.15], [shortArmGeo, 7.9, 0.85]];
      for (const [geo, y, half] of arms) {
        const arm = new THREE.Mesh(geo, armWood);
        arm.position.y = y;
        if (!alongX) arm.rotation.y = Math.PI / 2;
        pole.add(arm);
        for (const s of [-1, 1]) {
          const ins = new THREE.Mesh(insGeo, ceramic);
          ins.position.set(alongX ? s * half : 0, y + 0.2, alongX ? 0 : s * half);
          pole.add(ins);
        }
      }
      if (withCan) {
        const can = new THREE.Mesh(canGeo, canMat);
        can.position.set(alongX ? 0.45 : 0, 7.2, alongX ? 0 : 0.45);
        pole.add(can);
      }
      pole.position.set(x, 0, z);
      this.group.add(pole);
      return { x, z, alongX, topY: 9.1, lowY: 8.1 };
    };
    // Three lines: beach road (x=-152), downtown x=8 street, downtown z=8
    // street. Eight poles per line at the block centres.
    const centres = [-140, -100, -60, -20, 20, 60, 100, 140];
    const lines = [
      { axis: 'z', fixed: -152 },
      { axis: 'z', fixed: 8 },
      { axis: 'x', fixed: 8 },
    ];
    const built = [];
    for (const line of lines) {
      const row = [];
      centres.forEach((v, i) => {
        const x = line.axis === 'z' ? line.fixed : v;
        const z = line.axis === 'z' ? v : line.fixed;
        row.push(makePole(x, z, line.axis === 'z', i % 3 === 0));
      });
      built.push(row);
    }
    // Sagging wires: four per span (two heights x two arm ends), each a
    // quadratic curve dipping ~1.3 m at mid-span.
    for (const row of built) {
      for (let i = 0; i + 1 < row.length; i++) {
        const a = row[i], b = row[i + 1];
        for (const [y, half] of [[a.topY, 1.15], [a.lowY, 0.85]]) {
          for (const s of [-1, 1]) {
            const p1 = a.alongX
              ? new THREE.Vector3(a.x + s * half, y, a.z)
              : new THREE.Vector3(a.x, y, a.z + s * half);
            const p2 = b.alongX
              ? new THREE.Vector3(b.x + s * half, y, b.z)
              : new THREE.Vector3(b.x, y, b.z + s * half);
            const mid = p1.clone().lerp(p2, 0.5);
            mid.y -= 1.3;
            const wire = new THREE.Mesh(
              new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p1, mid, p2), 10, 0.035, 4, false),
              wireMat
            );
            this.group.add(wire);
          }
        }
      }
    }
  }

  buildStreetlights() {
    // 6 real point lights (software-render safe), rest are emissive poles.
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.6 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc860, emissiveIntensity: 1.4 });
    const spots = [[-151, -80], [-80, 80], [0, -160], [80, 0], [160, 120], [-120, 160]];
    for (const [x, z] of spots) {
      const pole = new THREE.Group();
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 7, 6), poleMat);
      p.position.y = 3.5; pole.add(p);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      head.position.y = 7.1; pole.add(head);
      const light = new THREE.PointLight(0xffc860, 0, 42, 1.6);
      light.position.y = 6.8; pole.add(light);
      this.streetlights.push(light);
      pole.position.set(x, 0, z);
      this.group.add(pole);
    }
  }

  buildBeachLamps() {
    // Street lamps down the beach road (city-side sidewalk, x=-152):
    // poles with heads ON — a white-yellow ball with a soft halo about
    // twice the head's radius — so the night shots read lit down the
    // road, not dark. Emissive only (no real PointLight): the 6-light
    // budget is spent on the downtown lamps.
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
    const cx = cv.getContext('2d');
    const g = cx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,190,1)'); g.addColorStop(0.4, 'rgba(255,210,110,0.5)'); g.addColorStop(1, 'rgba(255,200,90,0)');
    cx.fillStyle = g; cx.fillRect(0, 0, 64, 64);
    const haloTex = new THREE.CanvasTexture(cv);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.6, metalness: 0.6 });
    this.beachLampHalos = [];
    this.beachLampMats = [];
    for (const z of [-20, 10, 40, 70, 100, 130]) {
      const pole = new THREE.Group();
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 7, 6), poleMat);
      p.position.y = 3.5; pole.add(p);
      const lampMat = new THREE.MeshStandardMaterial({ color: 0xffe9b0, emissive: 0xffc860, emissiveIntensity: 0.4 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
      head.position.y = 7.1; pole.add(head);
      this.beachLampMats.push(lampMat);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: 0, depthWrite: false }));
      halo.scale.set(2, 2, 1); // halo radius ~2x the lamp head (r 0.5)
      halo.position.y = 7.1; pole.add(halo);
      this.beachLampHalos.push(halo);
      pole.position.set(-152, 0, z);
      this.group.add(pole);
    }
  }

  // dayT: 0 = 17:25 golden, 1 = 19:22 dusk. Hue travels gold -> pink ->
  // purple the short way round the wheel (through red), never through green.
  // Fleeing pedestrian, arms thrown out: the shot-3 street-life beat.
  // Built from boxes like every other figure in the city — arms raised
  // wide, mid-stride, frozen in the shot. Returns the group.
  addFleePed(x, z) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshStandardMaterial({ color: 0x2fb5a8, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9a986, roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.9 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), shirt);
    torso.position.y = 1.0; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
    head.position.y = 1.62; g.add(head);
    // Arms thrown wide and up — the flee pose.
    for (const ax of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.14), skin);
      arm.position.set(ax * 0.55, 1.35, 0);
      arm.rotation.z = ax * -1.1;
      g.add(arm);
    }
    // Mid-stride legs.
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), pants);
    legL.position.set(-0.14, 0.35, 0.18); legL.rotation.x = 0.4; g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.24), pants);
    legR.position.set(0.14, 0.35, -0.18); legR.rotation.x = -0.4; g.add(legR);
    g.position.set(x, 0, z);
    g.rotation.y = Math.PI / 2;
    this.scene.add(g);
    if (!this.fleePeds) this.fleePeds = [];
    this.fleePeds.push(g);
    return g;
  }

  update(dayT, elapsed) {
    const t = clamp(dayT, 0, 1);
    const hue = t < 0.5 ? hueLerp(38, 348, t * 2) : hueLerp(348, 282, (t - 0.5) * 2);
    const col = new THREE.Color().setHSL(hue / 360, 0.82, lerp(0.62, 0.42, t));
    this.paintSky(t, col);
    this.sunSprite.material.opacity = lerp(1, 0.35, t);
    this.sunSprite.position.y = lerp(150, 60, t);
    this.sun.intensity = lerp(1.6, 0.55, t);
    this.sun.color.setHSL(hue / 360, 0.9, lerp(0.62, 0.5, t));
    this.sun.position.set(lerp(-120, -200, t), lerp(90, 26, t), 60);
    this.hemi.intensity = lerp(0.7, 0.35, t);
    this.amb.intensity = lerp(0.35, 0.5, t);
    // Ocean shimmer + slow wave roll toward the shore; clouds drift.
    this.ocean.position.y = -0.4 + Math.sin(elapsed * 0.5) * 0.08;
    this.waves.forEach((w, i) => {
      w.position.x = w.userData.x0 + Math.sin(elapsed * 0.3 + i * 1.7) * 3;
    });
    this.clouds.forEach((c, i) => {
      c.position.x = c.userData.x0 + Math.sin(elapsed * 0.02 + i) * 18;
    });
    // Streetlights fade in with dusk; windows brighten.
    const lamp = clamp((t - 0.35) * 2.2, 0, 1);
    for (const l of this.streetlights) l.intensity = lamp * 26;
    for (const m of this.windowMats) m.emissiveIntensity = 0.55 + lamp * 0.9;
    for (const m of this.neonMats) m.emissiveIntensity = 1.1 + lamp * 1.2;
    // Beach-road lamps: halo + head brighten with dusk.
    if (this.beachLampHalos) for (const h of this.beachLampHalos) h.material.opacity = lamp * 0.85;
    if (this.beachLampMats) for (const m of this.beachLampMats) m.emissiveIntensity = 0.4 + lamp * 1.4;
  }
}
