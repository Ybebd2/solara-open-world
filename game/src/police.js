// Police — PCPD cruisers, foot officers, and the helicopter at 3 stars.
// Cruisers spawn BEHIND the player's heading (90–130 m) and close in
// instead of ramming at 2 m or spawning ahead. Officers chase on foot.
// The heli hovers above the player with a pale-yellow spotlight cone.
import * as THREE from '../vendor/three.module.min.js';
import { makeCar } from './vehicles.js';
import { TUNING, PCPD_UNITS } from './config.js';

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.cruisers = [];
    this.officers = [];
    this.heli = null;
    this.spawnTimer = 0;
    this.unitIdx = 0;
  }

  unitName() {
    const u = PCPD_UNITS[this.unitIdx % PCPD_UNITS.length];
    this.unitIdx += 1;
    return u.id;
  }

  spawnCruiser(px, pz, heading) {
    // Behind the player's heading, 90–130 m out.
    const dist = 90 + Math.random() * 40;
    const back = heading + Math.PI;
    const x = px + Math.sin(back) * dist;
    const z = pz + Math.cos(back) * dist;
    const car = makeCar('cruiser', { x, z, dir: heading });
    car.name = this.unitName();
    car.status = 'SEARCHING';
    car.speed = 4;
    car.topSpeed = TUNING.cruiserTop;
    car.accel = TUNING.cruiserAccel;
    this.cruisers.push(car);
    this.scene.add(car.mesh);
    return car;
  }

  spawnOfficer(x, z, name) {
    const g = new THREE.Group();
    const body = box(0.6, 0.85, 0.36, lam(0x1a3a5c));
    body.position.y = 1.05;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), lam(0xc68e5e));
    head.position.y = 1.65;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10), lam(0x111111));
    cap.position.y = 1.85;
    g.add(cap);
    const legL = box(0.2, 0.7, 0.22, lam(0x1a1a1a));
    legL.position.set(-0.15, 0.35, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.15;
    g.add(legR);
    g.position.set(x, 0, z);
    this.scene.add(g);
    const off = {
      name: name || this.unitName(), mesh: g, health: TUNING.officerHealth,
      x, z, speed: TUNING.officerSpeed,
    };
    g.userData.officer = off;
    this.officers.push(off);
    return off;
  }

  removeOfficer(off) {
    const i = this.officers.indexOf(off);
    if (i >= 0) this.officers.splice(i, 1);
    this.scene.remove(off.mesh);
  }

  spawnHeli(px, pz) {
    if (this.heli) return this.heli;
    const g = new THREE.Group();
    // White police heli with a navy stripe: the old dark-navy body
    // vanished against the dusk sky in shot 4.
    const body = box(4.2, 1.6, 2.2, lam(0xf5f5f0));
    body.position.y = 0;
    g.add(body);
    const stripe = box(4.3, 0.5, 2.25, lam(0x1a3a5c));
    stripe.position.y = -0.3;
    g.add(stripe);
    const glass = box(1.2, 0.9, 2.0, lam(0x0e1a26));
    glass.position.set(2.0, 0.2, 0);
    g.add(glass);
    const tail = box(4.5, 0.7, 0.7, lam(0xf5f5f0));
    tail.position.set(-4.2, 0.3, 0);
    g.add(tail);
    const tailStripe = box(4.5, 0.22, 0.72, lam(0x1a3a5c));
    tailStripe.position.set(-4.2, 0.1, 0);
    g.add(tailStripe);
    const skidL = box(3.4, 0.15, 0.3, lam(0x111111));
    skidL.position.set(0, -1.2, 0.9);
    g.add(skidL);
    const skidR = skidL.clone();
    skidR.position.z = -0.9;
    g.add(skidR);
    // Rotor disc + blur ring.
    const rotor = new THREE.Mesh(
      new THREE.CylinderGeometry(5.2, 5.2, 0.08, 24),
      new THREE.MeshBasicMaterial({ color: 0xaaaaaa, transparent: true, opacity: 0.45 })
    );
    rotor.position.y = 1.1;
    g.add(rotor);
    this.heliRotor = rotor;
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(5.2, 0.18, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.45 })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.1;
    g.add(ring);
    // Pale-yellow spotlight cone (no washout — soft, narrow).
    // Apex at the heli, widening down to the street: no rotation, so
    // the cone narrows UP toward the helicopter (the old flipped cone
    // read as an inverted funnel, wide at the sky).
    const coneGeo = new THREE.ConeGeometry(7, 50, 20, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = -25;
    g.add(cone);
    // Ground ellipse where the spotlight lands (~3 car-widths).
    const ellipse = new THREE.Mesh(
      new THREE.CircleGeometry(6.5, 24),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.12, depthWrite: false })
    );
    ellipse.rotation.x = -Math.PI / 2;
    ellipse.position.y = -TUNING.heliHeight + 0.1;
    g.add(ellipse);
    g.position.set(px, TUNING.heliHeight, pz);
    this.scene.add(g);
    this.heli = { group: g, x: px, z: pz };
    return this.heli;
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.heli = null;
  }

  update(dt, player, wanted) {
    const px = player.x, pz = player.z;
    const stars = wanted.stars;
    // Keep the right number of cruisers out (one per star, up to 4).
    const want = Math.min(4, stars);
    this.spawnTimer -= dt;
    if (this.cruisers.length < want && this.spawnTimer <= 0) {
      this.spawnCruiser(px, pz, player.yaw || 0);
      this.spawnTimer = 1.2;
    }
    if (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
    }
    // Cruisers chase: steer toward the player, accelerate to top speed.
    for (const c of this.cruisers) {
      const dx = px - c.x, dz = pz - c.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantDir = Math.atan2(dx, dz);
      let diff = wantDir - c.dir;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.dir += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      c.speed = Math.min(c.topSpeed, c.speed + c.accel * dt);
      c.x += Math.sin(c.dir) * c.speed * dt;
      c.z += Math.cos(c.dir) * c.speed * dt;
      c.sync();
      c.status = dist < TUNING.sightCruiser ? 'PURSUIT' : 'SEARCHING';
    }
    // Officers on foot chase the player.
    for (const o of [...this.officers]) {
      const dx = px - o.x, dz = pz - o.z;
      const dist = Math.hypot(dx, dz) || 1;
      if (dist > 2) {
        o.x += (dx / dist) * o.speed * dt;
        o.z += (dz / dist) * o.speed * dt;
        o.mesh.position.set(o.x, 0, o.z);
        o.mesh.rotation.y = Math.atan2(dx, dz);
      }
    }
    // Helicopter at 3+ stars.
    if (stars >= 3) {
      if (!this.heli) this.spawnHeli(px, pz);
      const h = this.heli;
      h.x += (px - h.x) * Math.min(1, 1.2 * dt);
      h.z += (pz - h.z) * Math.min(1, 1.2 * dt);
      h.group.position.set(h.x, TUNING.heliHeight, h.z);
      if (this.heliRotor) this.heliRotor.rotation.y += dt * 18;
    } else if (this.heli) {
      this.removeHeli();
    }
  }
}
