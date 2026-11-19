// SOLARA — the PCPD: white cruisers with red light bars that chase and
// ram, officers on foot who close in and shoot, and the helicopter that
// arrives at three stars with a pale spotlight cone on the road.
import * as THREE from '../vendor/three.module.min.js';
import { UNIT_NAMES, clamp } from './config.js';
import { makeCar } from './vehicles.js';

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function makeOfficerMesh() {
  const g = new THREE.Group();
  const navy = new THREE.MeshLambertMaterial({ color: 0x1d2f55 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x14141a });
  g.add(box(0.26, 0.8, 0.26, dark, -0.15, 0.4, 0));
  g.add(box(0.26, 0.8, 0.26, dark, 0.15, 0.4, 0));
  const torso = box(0.66, 0.75, 0.38, navy, 0, 1.16, 0);
  g.add(torso);
  // A pale badge dot and a duty belt so the uniform reads.
  g.add(box(0.1, 0.1, 0.02, new THREE.MeshLambertMaterial({ color: 0xd8b13a }), -0.18, 1.3, 0.2));
  g.add(box(0.6, 0.09, 0.4, dark, 0, 0.82, 0));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin);
  head.position.set(0, 1.76, 0); g.add(head);
  g.add(box(0.5, 0.08, 0.5, navy, 0, 1.95, 0));
  // Arms hang down; one holds a sidearm when close.
  g.add(box(0.15, 0.6, 0.15, navy, -0.4, 1.15, 0));
  g.add(box(0.15, 0.6, 0.15, navy, 0.4, 1.15, 0));
  return g;
}

export class Police {
  constructor(G) {
    this.G = G;
    this.cruisers = [];
    this.officers = [];
    this.heli = null;
    this._unitIdx = 0;
    this._spawnT = 0;
    this.frozen = false;
    this.airDeployed = false;
  }

  _nextUnitName() {
    const n = UNIT_NAMES[this._unitIdx % UNIT_NAMES.length];
    this._unitIdx++;
    return n;
  }

  spawnOfficer(x, z, name) {
    const mesh = makeOfficerMesh();
    mesh.position.set(x, 0, z);
    const off = { name: name || this._nextUnitName(), x, z, mesh, health: 100, status: 'PURSUIT', shootT: 1 + Math.random() };
    mesh.userData.officer = off;
    // Keep x/z live on the object for the HUD.
    Object.defineProperty(off, 'x', { get: () => mesh.position.x, set: (v) => { mesh.position.x = v; }, configurable: true });
    Object.defineProperty(off, 'z', { get: () => mesh.position.z, set: (v) => { mesh.position.z = v; }, configurable: true });
    this.G.scene.add(mesh);
    this.officers.push(off);
    return off;
  }

  removeOfficer(off) {
    this.G.scene.remove(off.mesh);
    const i = this.officers.indexOf(off);
    if (i >= 0) this.officers.splice(i, 1);
  }

  spawnCruiser(x, z, name) {
    const car = makeCar('cruiser', 0xf2f2f2, name || this._nextUnitName());
    car.x = x; car.z = z;
    car.speed = 0;
    car.health = 100;
    car.status = 'PURSUIT';
    car.mesh.position.y = 0;
    this.G.scene.add(car.mesh);
    this.cruisers.push(car);
    return car;
  }

  wreckCruiser(car) {
    car.status = 'WRECKED';
    car.speed = 0;
    car.health = 0;
    car.mesh.rotation.z = 0.06;
  }

  spawnHeli() {
    if (this.heli) return this.heli;
    const g = new THREE.Group();
    // A mid-grey fuselage so the shape reads as a solid object against
    // the bright cone and the dusk sky.
    const dark = new THREE.MeshLambertMaterial({ color: 0x5a6478 });
    const glass = new THREE.MeshLambertMaterial({ color: 0x3a5a7a });
    // Fuselage, tail boom, skids. The fuselage is long on purpose: the
    // shot needs it to read at distance.
    g.add(box(2.8, 2.0, 7.0, dark, 0, 0, 0));
    g.add(box(2.2, 1.4, 1.6, glass, 0, 0.1, 3.4));
    g.add(box(0.55, 0.55, 6.0, dark, 0, 0.4, -6.0));
    g.add(box(0.2, 1.5, 0.2, dark, 0, 1.1, -8.6));
    g.add(box(1.8, 0.12, 0.3, dark, -1.0, -1.1, 0.8));
    g.add(box(1.8, 0.12, 0.3, dark, 1.0, -1.1, 0.8));
    g.add(box(0.2, 0.12, 4.2, dark, -1.0, -1.1, 0));
    g.add(box(0.2, 0.12, 4.2, dark, 1.0, -1.1, 0));
    // A red navigation lamp on the belly.
    const nav = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    nav.position.set(0, -1.0, 1.5);
    g.add(nav);
    // Rotor disc + blur ring.
    const rotor = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(6.0, 6.0, 0.08, 24), new THREE.MeshBasicMaterial({ color: 0x999999, transparent: true, opacity: 0.28 }));
    rotor.add(disc);
    const ring = new THREE.Mesh(new THREE.RingGeometry(5.0, 6.0, 24), new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.3, side: THREE.DoubleSide }));
    ring.rotation.x = -Math.PI / 2; rotor.add(ring);
    rotor.position.y = 1.5;
    g.add(rotor);
    // Spotlight cone: apex at the belly, base on the road. ConeGeometry
    // puts its apex at +height/2, so with no rotation the apex sits at
    // the heli and the wide base lands on the ground.
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.03, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(2.2, 30, 20, 1, true), coneMat);
    cone.position.y = -15;
    g.add(cone);
    const ellipse = new THREE.Mesh(
      new THREE.CircleGeometry(2.6, 24),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    ellipse.rotation.x = -Math.PI / 2;
    ellipse.scale.set(1, 1.6, 1);
    g.add(ellipse);
    this.heli = { group: g, rotor, cone, ellipse, name: 'AIR-1', y: 30 };
    g.position.set(this.G.player.x + 20, 30, this.G.player.z - 10);
    this.G.scene.add(g);
    this.airDeployed = true;
    this.layoutHeli();
    return this.heli;
  }

  // Keep the cone and the ground ellipse honest for the heli's altitude:
  // the cone spans belly-to-road, the ellipse sits on the asphalt.
  layoutHeli() {
    const h = this.heli;
    if (!h) return;
    const alt = h.group.position.y;
    h.cone.scale.y = alt / 30;
    h.cone.position.y = -alt / 2;
    h.ellipse.position.y = -alt + 0.12;
    h.y = alt;
  }

  removeHeli() {
    if (!this.heli) return;
    this.G.scene.remove(this.heli.group);
    this.heli = null;
    this.airDeployed = false;
  }

  update(dt) {
    if (this.frozen) return;
    const G = this.G;
    const p = G.player;
    const stars = G.wanted.stars;
    // Cruisers: one per star, up to four, spawned at range.
    const wantCruisers = stars >= 1 ? Math.min(stars, 4) : 0;
    if (this.cruisers.length < wantCruisers) {
      const a = Math.random() * Math.PI * 2;
      const x = p.x + Math.sin(a) * 38, z = p.z + Math.cos(a) * 38;
      const c = this.spawnCruiser(x, z);
      c.heading = Math.atan2(p.x - x, p.z - z);
    }
    // Chase: steer at the player, faster than any street car.
    for (const c of this.cruisers) {
      if (c.status === 'WRECKED') continue;
      const dx = p.x - c.x, dz = p.z - c.z;
      const d = Math.hypot(dx, dz) || 1;
      const want = Math.atan2(dx, dz);
      let diff = want - c.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.heading += clamp(diff, -2.6 * dt, 2.6 * dt);
      c.speed = clamp(c.speed + 26 * dt, 0, 19);
      const f = c.forward();
      c.x += f.x * c.speed * dt;
      c.z += f.z * c.speed * dt;
      c.status = d < 60 ? 'PURSUIT' : 'SEARCHING';
      // Ram: shove the player's car and rattle the player.
      if (d < 3.2 && p.car) {
        p.car.speed *= 0.94;
        p.car.x += f.x * 1.2 * dt; p.car.z += f.z * 1.2 * dt;
      }
    }
    // Officers on foot at two stars and up.
    if (stars >= 2 && this.officers.length < 3 && this._spawnT <= 0) {
      const a = Math.random() * Math.PI * 2;
      this.spawnOfficer(p.x + Math.sin(a) * 26, p.z + Math.cos(a) * 26);
      this._spawnT = 4;
    }
    this._spawnT -= dt;
    for (const o of [...this.officers]) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const d = Math.hypot(dx, dz) || 1;
      const sp = 3.1;
      o.x += (dx / d) * sp * dt;
      o.z += (dz / d) * sp * dt;
      o.mesh.rotation.y = Math.atan2(dx, dz);
      o.status = d < 40 ? 'PURSUIT' : 'SEARCHING';
      o.shootT -= dt;
      if (d < 26 && o.shootT <= 0) {
        o.shootT = 1.6;
        p.takeDamage(8);
        G.sound?.shotDistant();
      }
    }
    // Helicopter at three stars.
    if (stars >= 3 && !this.heli) this.spawnHeli();
    if (stars < 3 && this.heli) this.removeHeli();
    if (this.heli) {
      const h = this.heli;
      // Hover above and slightly behind the player, rotor spinning.
      h.group.position.x += ((p.x + 14) - h.group.position.x) * Math.min(1, 1.4 * dt);
      h.group.position.z += ((p.z - 8) - h.group.position.z) * Math.min(1, 1.4 * dt);
      h.group.position.y = 30 + Math.sin(performance.now() / 900) * 1.2;
      h.rotor.rotation.y += dt * 22;
      this.layoutHeli();
    }
    // Heat dies: cruisers drift off when the wanted level clears.
    if (stars === 0) {
      for (const c of [...this.cruisers]) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d > 90) { this.G.scene.remove(c.mesh); this.cruisers.splice(this.cruisers.indexOf(c), 1); }
      }
      for (const o of [...this.officers]) {
        const d = Math.hypot(o.x - p.x, o.z - p.z);
        if (d > 70) this.removeOfficer(o);
      }
    }
  }
}
