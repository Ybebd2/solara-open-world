// SOLARA — Kai Mercer: a box-built third-person character with a bright
// silver pistol in a two-hand aim, five weapon slots, and the ability to
// steal any parked car. The camera sits a little to his right so the gun
// reads against the street instead of hiding behind his torso.
import * as THREE from '../vendor/three.module.min.js';
import { WEAPONS, clamp } from './config.js';

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export class Player {
  constructor(G) {
    this.G = G;
    this.group = new THREE.Group();
    this.onFoot = true;
    this.car = null;
    this.heading = G.config.spawn.heading;
    this.walkSpeed = 4.2;
    this.sprintSpeed = 7.5;
    this.health = 100;
    this.armour = 50;
    this.aiming = false;
    this.currentSlot = 2;
    this.mags = {};
    this.reserve = {};
    for (const w of WEAPONS) {
      this.mags[w.slot] = w.mag;
      this.reserve[w.slot] = w.reserve;
    }
    this.raycaster = new THREE.Raycaster();
    this._buildMesh();
    this.group.position.set(G.config.spawn.x, 0, G.config.spawn.z);
    this.group.rotation.y = this.heading;
    G.scene.add(this.group);
  }

  get x() { return this.group.position.x; }
  set x(v) { this.group.position.x = v; }
  get z() { return this.group.position.z; }
  set z(v) { this.group.position.z = v; }
  get weaponAmmo() { return this.mags[this.currentSlot]; }
  set weaponAmmo(v) { this.mags[this.currentSlot] = v; }
  get weapon() { return WEAPONS.find((w) => w.slot === this.currentSlot); }

  _buildMesh() {
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const jacket = new THREE.MeshLambertMaterial({ color: 0xe8531f });
    const pants = new THREE.MeshLambertMaterial({ color: 0x23232c });
    const capMat = new THREE.MeshLambertMaterial({ color: 0xb02020 });
    const g = this.group;
    // Legs.
    this.legL = box(0.24, 0.8, 0.26, pants, -0.15, 0.4, 0);
    this.legR = box(0.24, 0.8, 0.26, pants, 0.15, 0.4, 0);
    g.add(this.legL, this.legR);
    // Torso: orange jacket, a little wide so it reads at distance.
    this.torso = box(0.68, 0.78, 0.4, jacket, 0, 1.18, 0);
    g.add(this.torso);
    // Jacket shading: a darker chest panel.
    g.add(box(0.5, 0.5, 0.06, new THREE.MeshLambertMaterial({ color: 0xb93a10 }), 0, 1.2, 0.21));
    // Head + red cap.
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.set(0, 1.78, 0); g.add(head);
    g.add(box(0.56, 0.09, 0.56, capMat, 0, 1.98, 0));
    g.add(box(0.56, 0.07, 0.22, capMat, 0, 1.94, 0.32));
    // Arms: pivots at the shoulders so aim can swing them forward.
    this.armL = new THREE.Group(); this.armL.position.set(-0.4, 1.5, 0);
    this.armR = new THREE.Group(); this.armR.position.set(0.4, 1.5, 0);
    const armGeo = new THREE.BoxGeometry(0.17, 0.72, 0.17);
    const aL = new THREE.Mesh(armGeo, skin); aL.position.y = -0.36; this.armL.add(aL);
    const aR = new THREE.Mesh(armGeo, skin); aR.position.y = -0.36; this.armR.add(aR);
    // Sleeves on the upper arms.
    const sL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), jacket); sL.position.y = -0.15; this.armL.add(sL);
    const sR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.3, 0.2), jacket); sR.position.y = -0.15; this.armR.add(sR);
    g.add(this.armL, this.armR);
    // The pistol: a bright silver 1.3 m slide with a dark grip, held in
    // both hands. The slide is near-white and emissive so it pops against
    // asphalt and sky at full frame.
    this.pistol = new THREE.Group();
    const slideMat = new THREE.MeshLambertMaterial({ color: 0xf2f4f6, emissive: 0xd8dde2, emissiveIntensity: 0.9 });
    const slide = box(0.13, 0.15, 1.3, slideMat, 0, 0.02, 0.45);
    this.pistol.add(slide);
    // A darker barrel tip and a sight rib so the gun has a silhouette.
    this.pistol.add(box(0.09, 0.05, 0.5, new THREE.MeshLambertMaterial({ color: 0x3a3f45 }), 0, 0.11, 0.75));
    this.pistol.add(box(0.14, 0.34, 0.2, new THREE.MeshLambertMaterial({ color: 0x1c1e22 }), 0, -0.16, -0.08));
    this.pistol.visible = false;
    g.add(this.pistol);
    // Muzzle flash sprite.
    const flashTex = (() => {
      const c = document.createElement('canvas'); c.width = 64; c.height = 64;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255,255,220,1)'); grad.addColorStop(1, 'rgba(255,180,60,0)');
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();
    this.flash = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flash.scale.set(1.4, 1.4, 1);
    this.flash.position.set(0, 0.02, 1.15);
    this.pistol.add(this.flash);
    this._flashT = 0;
    this.setAimPose(false);
  }

  // Arms hang at the sides, or rise into a two-hand aim with the pistol
  // level and forward. The pistol sits between the hands, not behind the
  // torso, so a side camera always sees it.
  setAimPose(aiming) {
    this.aiming = aiming;
    const gun = this.currentSlot > 1;
    this.pistol.visible = gun && aiming;
    if (aiming) {
      this.armL.rotation.x = -Math.PI / 2 + 0.12;
      this.armR.rotation.x = -Math.PI / 2 - 0.12;
      this.armL.rotation.z = 0.28; this.armR.rotation.z = -0.28;
      this.pistol.position.set(0, 1.42, 0.55);
      this.pistol.rotation.x = 0;
    } else {
      this.armL.rotation.set(0, 0, 0.12);
      this.armR.rotation.set(0, 0, -0.12);
      this.pistol.position.set(0, 1.42, 0.55);
    }
  }

  setWeapon(slot) {
    const w = WEAPONS.find((x) => x.slot === slot);
    if (!w || w.locked) return;
    this.currentSlot = slot;
    this.mags[slot] = w.mag; // a fresh mag on every draw
    this.setAimPose(this.aiming);
    this.G.hud?.refreshWeapons();
  }

  unlockWeapon(slot) {
    const w = WEAPONS.find((x) => x.slot === slot);
    if (w) { w.locked = false; this.G.hud?.refreshWeapons(); }
  }

  // The aim ray: from Kai's chest, along his facing, dead level. The
  // test places an officer exactly on this ray, so shoot() must use the
  // same raycaster it sets here.
  aimRay() {
    const fx = Math.sin(this.heading), fz = Math.cos(this.heading);
    const o = new THREE.Vector3(this.x + fx * 0.9, 1.45, this.z + fz * 0.9);
    const d = new THREE.Vector3(fx, 0, fz).normalize();
    this.raycaster.set(o, d);
    this.raycaster.far = 80;
    return this.raycaster.ray;
  }

  shoot() {
    const w = this.weapon;
    if (!this.onFoot || !w || w.slot === 1) return null;
    if (this.weaponAmmo <= 0) { this.G.sound?.click(); return null; }
    this.weaponAmmo -= 1;
    this.aimRay();
    this._flashT = 0.07;
    this.flash.material.opacity = 0.95;
    this.G.sound?.shoot();
    let hit = null;
    const targets = this.G.police.officers.map((o) => o.mesh);
    if (targets.length) {
      const hits = this.raycaster.intersectObjects(targets, true);
      if (hits.length) {
        let obj = hits[0].object;
        while (obj && !obj.userData.officer) obj = obj.parent;
        if (obj && obj.userData.officer) {
          const off = obj.userData.officer;
          off.health -= w.damage;
          hit = off;
          if (off.health <= 0) this.G.police.removeOfficer(off);
        }
      }
    }
    return hit;
  }

  interact() {
    const G = this.G;
    if (this.onFoot) {
      const car = G.traffic.nearestParked(this.x, this.z, 4.5);
      if (!car) return false;
      this.car = car;
      this.onFoot = false;
      this.group.visible = false;
      car.taken = true;
      car.speed = 0;
      G.wanted.addStar();
      G.traffic.scarePed(this.x, this.z);
      G.sound?.carDoor();
      G.hud?.toast('Carjacked — +1 star', 'bad');
      return true;
    }
    // Exit the car: step out to its right side.
    const car = this.car;
    const rx = Math.cos(car.heading), rz = -Math.sin(car.heading);
    this.x = car.x + rx * 2.2; this.z = car.z + rz * 2.2;
    this.heading = car.heading;
    this.group.rotation.y = this.heading;
    this.car = null;
    this.onFoot = true;
    this.group.visible = true;
    car.speed = 0;
    car.taken = false;
    return true;
  }

  takeDamage(amount) {
    let left = amount;
    if (this.armour > 0) { const absorbed = Math.min(this.armour, left); this.armour -= absorbed; left -= absorbed; }
    this.health -= left;
    this.G.hud?.flashDamage();
    if (this.health <= 0) this.wasted();
  }

  wasted() {
    const G = this.G;
    G.money = Math.max(0, G.money - 100);
    G.wanted.stars = 0;
    this.health = 100; this.armour = 50;
    if (this.car) { this.car.speed = 0; this.car.taken = false; this.car = null; }
    this.onFoot = true;
    this.group.visible = true;
    this.x = G.config.spawn.x; this.z = G.config.spawn.z;
    this.heading = G.config.spawn.heading;
    G.state = 'wasted';
    G.hud?.showWasted();
    setTimeout(() => { if (G.state === 'wasted') { G.state = 'playing'; G.hud?.hideWasted(); } }, 2500);
  }

  update(dt, input) {
    const G = this.G;
    if (this._flashT > 0) { this._flashT -= dt; if (this._flashT <= 0) this.flash.material.opacity = 0; }
    if (!this.onFoot && this.car) {
      // Driving.
      const car = this.car;
      const accel = input.forward ? 20 : input.back ? -14 : 0;
      car.speed = clamp(car.speed + accel * dt, -6, 24);
      if (!input.forward && !input.back) car.speed *= Math.max(0, 1 - 2.2 * dt);
      const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
      const spd = Math.abs(car.speed);
      if (spd > 0.2) car.heading += steer * 1.9 * (car.speed >= 0 ? 1 : -1) * Math.min(1, spd / 8) * dt;
      const f = car.forward();
      car.x += f.x * car.speed * dt;
      car.z += f.z * car.speed * dt;
      car.x = clamp(car.x, -255, 255); car.z = clamp(car.z, -255, 255);
      this.heading = car.heading;
      // Keep the group on the car so police, HUD and missions read the
      // player's true spot while driving.
      this.group.position.set(car.x, 0, car.z);
      this.group.rotation.y = car.heading;
      return;
    }
    if (!this.onFoot) return;
    // On foot: WASD relative to the camera, sprint on Shift.
    const camFwd = G.cameraForward();
    const camRight = { x: -camFwd.z, z: camFwd.x };
    let mx = 0, mz = 0;
    if (input.forward) { mx += camFwd.x; mz += camFwd.z; }
    if (input.back) { mx -= camFwd.x; mz -= camFwd.z; }
    if (input.left) { mx += camRight.x; mz += camRight.z; }
    if (input.right) { mx -= camRight.x; mz -= camRight.z; }
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      const sp = input.sprint ? this.sprintSpeed : this.walkSpeed;
      mx /= len; mz /= len;
      this.x += mx * sp * dt;
      this.z += mz * sp * dt;
      this.x = clamp(this.x, -258, 258); this.z = clamp(this.z, -258, 258);
      const targetHeading = Math.atan2(mx, mz);
      let d = targetHeading - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += clamp(d, -9 * dt, 9 * dt);
      this.group.rotation.y = this.heading;
      // Walk cycle: legs swing.
      const t = performance.now() / 130;
      this.legL.rotation.x = Math.sin(t) * 0.55;
      this.legR.rotation.x = -Math.sin(t) * 0.55;
    } else {
      this.legL.rotation.x = 0; this.legR.rotation.x = 0;
    }
    this.setAimPose(input.aim || this.aiming);
  }
}
