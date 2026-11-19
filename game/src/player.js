// Player — Kai Mercer on foot and behind the wheel. Third-person, WASD
// walk/drive, Shift sprint, F enter/carjack, click shoot, 1–5 weapons.
// The VESPER 9 pistol is bright silver and held LEVEL in a two-hand aim:
// the arm group pitches down to aim, and the pistol counter-rotates so
// its slide never points at the sky.
import * as THREE from '../vendor/three.module.min.js';
import { WEAPONS, TUNING } from './config.js';

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
function box(w, h, d, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

export class Player {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.onFoot = true;
    this.car = null;
    this.weaponSlot = 1;
    this.weaponAmmo = Infinity;
    this.raycaster = new THREE.Raycaster();
    this.yaw = 0;         // facing angle
    this.aimPitch = -0.12; // slight downward aim
    this.health = 100;
    this.armour = 0;
    this.build();
    scene.add(this.group);
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  build() {
    const g = this.group;
    // Kai: green jacket, dark hair, dark pants. ~1.8 m tall.
    const jacket = lam(0x2e7d5b);
    const pants = lam(0x222831);
    const skin = lam(0xc68e5e);
    const hair = lam(0x1a1a1a);

    const torso = box(0.62, 0.75, 0.36, jacket);
    torso.position.y = 1.15;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.72;
    g.add(head);
    const hairM = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10, 0, Math.PI * 2, 0, 1.4), hair);
    hairM.position.y = 1.76;
    g.add(hairM);
    const legL = box(0.22, 0.75, 0.26, pants);
    legL.position.set(-0.16, 0.38, 0);
    g.add(legL);
    const legR = legL.clone();
    legR.position.x = 0.16;
    g.add(legR);

    // Arms: a group that pitches to aim. The pistol inside counter-rotates
    // so the slide stays level.
    this.armGroup = new THREE.Group();
    this.armGroup.position.set(0, 1.45, 0.1);
    g.add(this.armGroup);
    const armMat = lam(0x2e7d5b);
    const armL = box(0.18, 0.55, 0.2, armMat);
    armL.position.set(-0.3, -0.1, 0.25);
    armL.rotation.x = -1.2;
    this.armGroup.add(armL);
    const armR = box(0.18, 0.55, 0.2, armMat);
    armR.position.set(0.3, -0.1, 0.25);
    armR.rotation.x = -1.2;
    this.armGroup.add(armR);

    // VESPER 9: bright silver slide, oversized (1.0 m) so it reads clearly
    // at the shot camera — ≥8% of screen width. Slide level, slight
    // downward aim.
    this.pistol = new THREE.Group();
    const silver = new THREE.MeshStandardMaterial({
      color: 0xd8d8d8, metalness: 0.25, roughness: 0.35,
      emissive: 0x888888, emissiveIntensity: 0.35,
    });
    const slide = box(0.1, 0.12, 1.0, silver);
    slide.position.set(0, 0, 0.35);
    this.pistol.add(slide);
    const grip = box(0.09, 0.24, 0.13, lam(0x222222));
    grip.position.set(0, -0.13, -0.08);
    grip.rotation.x = 0.3;
    this.pistol.add(grip);
    const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), silver);
    muzzle.rotation.x = Math.PI / 2;
    muzzle.position.set(0, 0, 0.88);
    this.pistol.add(muzzle);
    this.pistol.position.set(0, -0.28, 0.45);
    this.armGroup.add(this.pistol);
    this.pistol.visible = false;
    this.updateAimPose();
  }

  updateAimPose() {
    // Arm pitches down by 1.35 rad to aim; the pistol counter-rotates by
    // +1.35 so the slide stays level instead of pointing at the sky.
    const aim = this.weaponSlot === 2 ? -1.35 : 0;
    this.armGroup.rotation.x = aim;
    this.pistol.rotation.x = -aim + this.aimPitch;
    this.pistol.visible = this.weaponSlot === 2;
  }

  setWeapon(slot) {
    const w = WEAPONS.find((x) => x.slot === slot);
    if (!w || w.locked) return false;
    this.weaponSlot = slot;
    this.weaponAmmo = w.ammo;
    this.updateAimPose();
    return true;
  }

  // Ray from the player's chest, horizontal, along the camera's facing.
  // Horizontal matters: a ray angled down from the camera passes over a
  // 1.85 m officer's head at 6 m, so shots would never land.
  aimRay() {
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.y = 0;
    dir.normalize();
    const origin = new THREE.Vector3(this.group.position.x, 1.4, this.group.position.z);
    this.raycaster.set(origin, dir);
    return this.raycaster.ray;
  }

  // Move on foot (WASD relative to camera yaw) or drive (W/S gas/brake,
  // A/D steer). dt is clamped game seconds.
  move(keys, dt, camYaw) {
    if (this.car) {
      const car = this.car;
      const fwd = (keys.has('KeyW') ? 1 : 0) - (keys.has('KeyS') ? 1 : 0);
      if (fwd > 0) car.speed = Math.min(car.topSpeed, car.speed + car.accel * dt);
      else if (fwd < 0) car.speed = Math.max(-8, car.speed - car.accel * 1.4 * dt);
      else car.speed *= Math.max(0, 1 - 2.2 * dt);
      const steer = (keys.has('KeyA') ? 1 : 0) - (keys.has('KeyD') ? 1 : 0);
      if (Math.abs(car.speed) > 0.5) car.dir += steer * 1.9 * dt * Math.sign(car.speed);
      car.x += Math.sin(car.dir) * car.speed * dt;
      car.z += Math.cos(car.dir) * car.speed * dt;
      car.sync();
      this.group.position.set(car.x, 0, car.z);
      this.group.visible = false;
      this.yaw = car.dir;
      return;
    }
    this.group.visible = true;
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = sprint ? TUNING.sprintSpeed : TUNING.walkSpeed;
    let mx = 0, mz = 0;
    if (keys.has('KeyW')) mz += 1;
    if (keys.has('KeyS')) mz -= 1;
    if (keys.has('KeyA')) mx -= 1;
    if (keys.has('KeyD')) mx += 1;
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz);
      mx /= len; mz /= len;
      // Camera-relative: forward is -Z rotated by camYaw.
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
      const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
      const dx = fx * mz + rx * mx;
      const dz = fz * mz + rz * mx;
      this.group.position.x += dx * speed * dt;
      this.group.position.z += dz * speed * dt;
      this.yaw = Math.atan2(dx, dz);
      this.group.rotation.y = this.yaw;
    }
    // Keep inside the city.
    this.group.position.x = Math.max(-320, Math.min(320, this.group.position.x));
    this.group.position.z = Math.max(-260, Math.min(260, this.group.position.z));
  }

  // Enter the nearest parked car (carjack: +1 star handled by the game),
  // or exit the current car.
  enterCar(car) {
    if (this.car) {
      const c = this.car;
      this.car = null;
      this.onFoot = true;
      this.group.position.set(c.x + 2.5, 0, c.z + 1);
      this.group.visible = true;
      return null;
    }
    if (!car) return null;
    this.car = car;
    this.onFoot = false;
    this.group.visible = false;
    return car;
  }
}
