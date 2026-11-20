// World — Solara's golden-hour coastal city. Roads, pastel buildings with
// lit windows, palms, beach, ocean, and the small top-3 details: a
// lifeguard tower, beach umbrella + towel, a food cart by the pier, a
// green traffic light, a pedestrian crossing signal, pawn-shop and diner
// signs, a motel neon, faint dusk stars, and a police-boat light in the
// marina. All geometry is plain three.js boxes/cylinders — no assets.
import * as THREE from '../vendor/three.module.min.js';
import { PALETTE, WORLD } from './config.js';

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = false;
  return m;
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.lamps = [];      // {halo, lampMat}
    this.windows = [];    // emissive window materials
    this.neonMats = [];   // neon sign materials
    this.stars = null;
    this.boatLight = null;
    this.trafficLight = null;
    this.build();
  }

  build() {
    const s = this.scene;
    // --- Ground: big asphalt slab, sand beach strip, ocean plane.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(700, 560),
      lam(PALETTE.asphalt)
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, 0);
    s.add(ground);

    // Beach sand (south edge) and turquoise ocean beyond it.
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(700, 60), lam(PALETTE.sand));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0, 130);
    s.add(sand);
    const ocean = new THREE.Mesh(new THREE.PlaneGeometry(700, 120), lam(PALETTE.ocean));
    ocean.rotation.x = -Math.PI / 2;
    ocean.position.set(0, 0.02, 210);
    s.add(ocean);

    // Sidewalks flanking the beach road.
    for (const z of [-14, 14]) {
      const walk = new THREE.Mesh(new THREE.PlaneGeometry(660, 6), lam(PALETTE.sidewalk));
      walk.rotation.x = -Math.PI / 2;
      walk.position.set(0, 0.02, z);
      s.add(walk);
    }

    // Road markings: double yellow centre line + dashed white lane lines.
    const yellow = lam(0xf2c14e);
    for (const dz of [-0.4, 0.4]) {
      const line = box(660, 0.05, 0.35, yellow);
      line.position.set(0, 0.05, dz);
      s.add(line);
    }
    const white = lam(0xf5f5f0);
    for (let x = -320; x < 320; x += 12) {
      for (const z of [-6, 6]) {
        const dash = box(5, 0.05, 0.3, white);
        dash.position.set(x, 0.05, z);
        s.add(dash);
      }
    }

    // Zebra crossings at the main intersections.
    for (const x of [-80, 40, 180]) {
      for (let i = 0; i < 6; i++) {
        const stripe = box(1.4, 0.05, 9, white);
        stripe.position.set(x - 4 + i * 1.8, 0.06, 0);
        s.add(stripe);
      }
    }

    this.buildings();
    this.palms();
    this.streetProps();
    this.beachDetails();
    this.skyStars();
    this.marinaBoat();
  }

  buildings() {
    const s = this.scene;
    // Pastel art-deco strip along the north side + cross streets.
    const spots = [
      [-280, -40, 26, 22, 0], [-230, -40, 20, 16, 1], [-180, -40, 24, 28, 2],
      [-120, -40, 18, 14, 3], [-60, -40, 26, 20, 4], [0, -40, 22, 30, 5],
      [60, -40, 20, 18, 6], [120, -40, 28, 24, 0], [180, -40, 22, 16, 1],
      [240, -40, 24, 22, 2], [280, -40, 20, 14, 3],
      [-200, -120, 22, 18, 4], [-40, -120, 26, 24, 5], [140, -120, 20, 16, 6],
      [260, -120, 24, 20, 0], [-260, 90, 18, 12, 1], [100, 90, 22, 14, 2],
    ];
    for (const [x, z, w, h, ci] of spots) {
      const color = PALETTE.building[ci % PALETTE.building.length];
      const b = box(w, h, 16, lam(color));
      b.position.set(x, h / 2, z);
      s.add(b);
      // Roof trim.
      const trim = box(w + 0.6, 0.8, 16.6, lam(0xffffff));
      trim.position.set(x, h + 0.4, z);
      s.add(trim);
      // Lit windows: warm yellow emissive planes, glow at dusk.
      // Both faces — shot 1 looks at the city from the beach side.
      const winMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, transparent: true, opacity: 0.25 });
      this.windows.push(winMat);
      const cols = Math.max(2, Math.floor(w / 6));
      const rows = Math.max(2, Math.floor(h / 6));
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if ((c * 7 + r * 3 + Math.floor(x)) % 3 === 0) continue; // some dark
          const win = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), winMat);
          win.position.set(x - w / 2 + 3 + c * (w - 6) / Math.max(1, cols - 1), 3 + r * 5, z + 8.05);
          s.add(win);
          const winB = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.6), winMat);
          winB.position.set(x - w / 2 + 3 + c * (w - 6) / Math.max(1, cols - 1), 3 + r * 5, z - 8.05);
          winB.rotation.y = Math.PI;
          s.add(winB);
        }
      }
    }
    this.storefronts();
  }

  storefronts() {
    const s = this.scene;
    // Neon signs with READABLE text: a canvas texture (glowing letters
    // on a dark backing) instead of a solid colour slab — the old slabs
    // read as blank rectangles in the screenshots.
    const signs = [
      { text: "MO'S", x: -120, y: 12, z: -31, color: '#ff4fa3', w: 12 },
      { text: 'SOLARA', x: -100, y: 16, z: -31, color: '#2ee6c8', w: 18 },
      { text: 'PAWN', x: 20, y: 10, z: -31, color: '#ffb347', w: 9 },
      { text: 'DINER', x: 60, y: 11, z: -31, color: '#ff6b6b', w: 11 },
      { text: 'MOTEL', x: 200, y: 13, z: -31, color: '#c77dff', w: 11 },
    ];
    for (const sg of signs) {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 128;
      const cx = cv.getContext('2d');
      cx.clearRect(0, 0, 512, 128);
      cx.font = 'bold 82px Arial, sans-serif';
      cx.textAlign = 'center'; cx.textBaseline = 'middle';
      cx.shadowColor = sg.color; cx.shadowBlur = 30;
      cx.fillStyle = sg.color;
      cx.fillText(sg.text, 256, 68);
      cx.fillText(sg.text, 256, 68);
      cx.shadowBlur = 6;
      cx.fillStyle = '#ffffff';
      cx.fillText(sg.text, 256, 68);
      const tex = new THREE.CanvasTexture(cv);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95 });
      this.neonMats.push(mat);
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(sg.w, 3.2), mat);
      panel.position.set(sg.x, sg.y, sg.z);
      s.add(panel);
      // Halo: a slightly larger transparent plane behind the sign.
      const halo = new THREE.Mesh(
        new THREE.PlaneGeometry(sg.w + 3, 6),
        new THREE.MeshBasicMaterial({ color: sg.color, transparent: true, opacity: 0.18, depthWrite: false })
      );
      halo.position.set(sg.x, sg.y, sg.z - 0.2);
      s.add(halo);
      this.neonMats.push(halo.material);
    }
  }

  palms() {
    const s = this.scene;
    const trunkMat = lam(0x8b5a2b);
    const frondMat = lam(0x2e8b57);
    const spots = [];
    for (let x = -300; x <= 300; x += 24) {
      spots.push([x, -18]);
      if (Math.abs(x % 48) < 24) spots.push([x + 8, 18]);
    }
    for (const [x, z] of spots) {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 6), trunkMat);
      trunk.position.set(x, 4.5, z);
      s.add(trunk);
      for (let i = 0; i < 6; i++) {
        const frond = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 4), frondMat);
        const a = (i / 6) * Math.PI * 2;
        frond.position.set(x + Math.cos(a) * 2.2, 9.4, z + Math.sin(a) * 2.2);
        frond.rotation.z = Math.cos(a) * 1.1;
        frond.rotation.x = -Math.sin(a) * 1.1;
        s.add(frond);
      }
    }
  }

  streetProps() {
    const s = this.scene;
    // Street lamps with halo sprites (glow at dusk).
    for (let x = -300; x <= 300; x += 40) {
      for (const z of [-16, 16]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 7, 6), lam(0x222222));
        pole.position.set(x, 3.5, z);
        s.add(pole);
        const lampMat = new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.4 });
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 6), lampMat);
        bulb.position.set(x, 7.1, z);
        s.add(bulb);
        const halo = new THREE.Mesh(
          new THREE.SphereGeometry(1.6, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.12, depthWrite: false })
        );
        halo.position.set(x, 7.1, z);
        s.add(halo);
        this.lamps.push({ halo, lampMat });
      }
    }
    // Traffic light (green) + pedestrian crossing signal at Downtown.
    const tl = new THREE.Group();
    const tlPole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 8, 6), lam(0x1a1a1a));
    tlPole.position.y = 4;
    tl.add(tlPole);
    const housing = box(1.2, 3.4, 1.0, lam(0x111111));
    housing.position.set(0, 8.4, 0);
    tl.add(housing);
    const lampCols = [0xff3b30, 0xffcc00, 0x2ee66b];
    const tlLamps = [];
    lampCols.forEach((c, i) => {
      const m = new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: i === 2 ? 1 : 0.25 });
      const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), m);
      lamp.position.set(0, 9.5 - i * 1.05, 0.55);
      tl.add(lamp);
      tlLamps.push(m);
    });
    tl.position.set(38, 0, -12);
    s.add(tl);
    this.trafficLight = { group: tl, lamps: tlLamps };

    // Pedestrian crossing signal (walking man, green).
    const sig = new THREE.Group();
    const sigPole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.22, 5, 6), lam(0x1a1a1a));
    sigPole.position.y = 2.5;
    sig.add(sigPole);
    const sigBox = box(1.0, 1.4, 0.5, lam(0x111111));
    sigBox.position.set(0, 5.4, 0);
    sig.add(sigBox);
    const walkMat = new THREE.MeshBasicMaterial({ color: 0x2ee66b });
    const walk = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), walkMat);
    walk.position.set(0, 5.4, 0.28);
    sig.add(walk);
    sig.position.set(44, 0, -12);
    s.add(sig);

    // Bus stops + benches + bins along the road.
    for (const x of [-160, 100, 240]) {
      const shelter = box(6, 0.3, 2.4, lam(0x3a6ea5));
      shelter.position.set(x, 3.2, -17);
      s.add(shelter);
      for (const dx of [-2.6, 2.6]) {
        const post = box(0.25, 3.2, 0.25, lam(0x333333));
        post.position.set(x + dx, 1.6, -17);
        s.add(post);
      }
      const bench = box(4, 0.5, 1.2, lam(0x8b5a2b));
      bench.position.set(x, 0.6, -17);
      s.add(bench);
    }
  }

  beachDetails() {
    const s = this.scene;
    // Lifeguard tower on the sand (Beach Road, shot 1).
    const tower = new THREE.Group();
    const legMat = lam(0xf5f5f0);
    for (const [dx, dz] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 4.5, 6), legMat);
      leg.position.set(dx, 2.25, dz);
      tower.add(leg);
    }
    const cabin = box(3.6, 2.2, 3.2, lam(0xffffff));
    cabin.position.set(0, 5.4, 0);
    tower.add(cabin);
    const roof = box(4.4, 0.3, 4.0, lam(0xe63946));
    roof.position.set(0, 6.7, 0);
    tower.add(roof);
    const stripe = box(3.7, 0.5, 3.3, lam(0x2a7f8f));
    stripe.position.set(0, 4.6, 0);
    tower.add(stripe);
    tower.position.set(-120, 0, 118);
    s.add(tower);

    // Beach umbrella + towel.
    const umb = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3, 6), lam(0xdddddd));
    pole.position.y = 1.5;
    umb.add(pole);
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 8), lam(0x2a7f8f));
    canopy.position.y = 3.2;
    umb.add(canopy);
    umb.position.set(-100, 0, 112);
    s.add(umb);
    const towel = box(2.2, 0.06, 1.1, lam(0xff6b9d));
    towel.position.set(-96, 0.1, 114);
    towel.rotation.y = 0.5;
    s.add(towel);
    // Two more umbrellas + towels closer to Beach Road, in shot 1's
    // south-facing frame (the old single umbrella sat 100 m out).
    for (const [ux, uz, col] of [[-84, 104, 0xe63946], [-56, 108, 0xf2c14e]]) {
      const u2 = new THREE.Group();
      const p2 = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3, 6), lam(0xdddddd));
      p2.position.y = 1.5;
      u2.add(p2);
      const c2 = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.1, 8), lam(col));
      c2.position.y = 3.2;
      u2.add(c2);
      u2.position.set(ux, 0, uz);
      s.add(u2);
      const t2 = box(2.2, 0.06, 1.1, lam(0x2ee6c8));
      t2.position.set(ux + 4, 0.1, uz + 2);
      t2.rotation.y = -0.4;
      s.add(t2);
    }

    // Food cart near the pier.
    const cart = new THREE.Group();
    const body = box(2.6, 1.6, 1.6, lam(0xf2c14e));
    body.position.y = 1.1;
    cart.add(body);
    const awning = box(3.0, 0.15, 2.0, lam(0xff6b35));
    awning.position.y = 2.1;
    cart.add(awning);
    for (const [dx, dz] of [[-1.1, -0.7], [1.1, -0.7], [-1.1, 0.7], [1.1, 0.7]]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.2, 8), lam(0x222222));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(dx, 0.32, dz);
      cart.add(wheel);
    }
    cart.position.set(-232, 0, 34);
    cart.rotation.y = 0.4;
    s.add(cart);
  }

  skyStars() {
    // Faint stars that fade in at dusk (shot 4).
    const n = 220;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -350 + Math.random() * 700;
      pos[i * 3 + 1] = 90 + Math.random() * 220;
      pos[i * 3 + 2] = -320 + Math.random() * 500;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, transparent: true, opacity: 0, sizeAttenuation: false });
    this.stars = new THREE.Points(geo, mat);
    this.scene.add(this.stars);
  }

  marinaBoat() {
    // Police boat far in the marina, its light glinting (shot 4).
    const boat = new THREE.Group();
    const hull = box(6, 1.2, 2.2, lam(0xffffff));
    hull.position.y = 0.6;
    boat.add(hull);
    const cabin = box(2.4, 1.4, 1.8, lam(0x1a3a5c));
    cabin.position.set(-0.5, 1.8, 0);
    boat.add(cabin);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 1 });
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), lightMat);
    light.position.set(-0.5, 3.0, 0);
    boat.add(light);
    boat.position.set(240, 0.1, 190);
    boat.rotation.y = -0.7;
    this.scene.add(boat);
    this.boatLight = lightMat;
  }

  update(dt, duskT, hours) {
    const glow = THREE.MathUtils.clamp(duskT, 0, 1);
    for (const l of this.lamps) {
      l.halo.material.opacity = 0.05 + glow * 0.3;
      l.lampMat.opacity = 0.35 + glow * 0.65;
    }
    for (const w of this.windows) w.opacity = 0.2 + glow * 0.75;
    for (const n of this.neonMats) n.opacity = 0.55 + glow * 0.45;
    if (this.stars) this.stars.material.opacity = Math.max(0, (glow - 0.55) * 1.4);
    if (this.boatLight) {
      // Slow blink: bright, then a dim glint.
      const t = performance.now() / 1000;
      this.boatLight.opacity = 0.35 + 0.65 * Math.max(0, Math.sin(t * 1.8));
    }
    void dt; void hours;
  }
}
