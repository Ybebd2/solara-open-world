// SOLARA — Kai Mercer on foot and behind the wheel.
import * as THREE from '../vendor/three.module.min.js';
import { WEAPONS, clamp } from './config.js';

export class Player {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.onFoot = true;
    this.car = null;
    this.weapon = 2;
    this.weaponAmmo = 12;
    this.reserveAmmo = 71;
    this.health = 100;
    this.armour = 0;
    this.walkSpeed = 6;
    this.heading = 0;
    this.raycaster = new THREE.Raycaster();
    this.camera = null;
    this._build();
    scene.add(this.group);
  }

  _build() {
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.75 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0x2a9d8f, roughness: 0.85 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x1c1f26, roughness: 0.9 });
    const shoe = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
    const hair = new THREE.MeshStandardMaterial({ color: 0x14100c, roughness: 0.95 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), shirt);
    torso.position.y = 1.12;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.38, 0.36), skin);
    head.position.y = 1.7;
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), hair);
    hairTop.position.y = 1.92;
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.3, 0.1), hair);
    hairBack.position.set(0, 1.78, -0.16);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.24), pants);
    legL.position.set(-0.15, 0.36, 0);
    const legR = legL.clone();
    legR.position.x = 0.15;
    const shoeL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.4), shoe);
    shoeL.position.set(-0.15, 0.06, 0.05);
    const shoeR = shoeL.clone();
    shoeR.position.x = 0.15;

    // Arms: right arm holds the pistol, left arm supports in a two-hand aim.
    this.armR = new THREE.Group();
    const armRMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
    armRMesh.position.y = -0.28;
    this.armR.add(armRMesh);
    const handR = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), skin);
    handR.position.y = -0.6;
    this.armR.add(handR);
    this.armR.position.set(0.4, 1.42, 0);

    this.armL = new THREE.Group();
    const armLMesh = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.62, 0.2), shirt);
    armLMesh.position.y = -0.28;
    this.armL.add(armLMesh);
    const handL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.18), skin);
    handL.position.y = -0.6;
    this.armL.add(handL);
    this.armL.position.set(-0.4, 1.42, 0);

    // The VESPER 9: bright silver slide, 1.3 m, unmistakable at full frame.
    const silver = new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.35, metalness: 0.5, emissive: 0x666666, emissiveIntensity: 0.35 });
    const grip = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7 });
    this.pistol = new THREE.Group();
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 1.3), silver);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8), silver);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.02, 0.72);
    const gripMesh = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.3, 0.16), grip);
    gripMesh.position.set(0, -0.16, -0.45);
    gripMesh.rotation.x = 0.25;
    this.pistol.add(slide, barrel, gripMesh);
    this.pistol.position.set(0, -0.62, 0.35);
    this.armR.add(this.pistol);

    this.group.add(torso, head, hairTop, hairBack, legL, legR, shoeL, shoeR, this.armL, this.armR);
    this.legL = legL;
    this.legR = legR;
    this.torso = torso;
    this._walkPhase = 0;
    this._updateAimPose();
  }

  _updateAimPose() {
    const armed = this.onFoot && this.weapon > 1;
    this.pistol.visible = armed;
    if (armed) {
      // Two-hand aim: both arms forward, gun level. The pistol counter-rotates
      // the arm's -1.35 so its slide points forward, not at the sky.
      this.armR.rotation.x = -1.35;
      this.armL.rotation.x = -1.2;
      this.armL.rotation.z = 0.5;
      this.pistol.rotation.x = 1.35;
    } else {
      this.armR.rotation.x = 0;
      this.armR.rotation.z = 0;
      this.armL.rotation.x = 0;
      this.armL.rotation.z = 0;
      this.pistol.rotation.x = 0;
    }
  }

  setWeapon(id) {
    const w = WEAPONS.find((x) => x.id === id);
    if (!w) return false;
    this.weapon = id;
    this.weaponAmmo = w.ammo === Infinity ? Infinity : w.ammo;
    if (id === 2) this.reserveAmmo = 71;
    this._updateAimPose();
    return true;
  }

  get x() { return this.group.position.x; }
  get z() { return this.group.position.z; }

  aimRay() {
    if (!this.camera) return;
    this.raycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
  }

  takeDamage(amount) {
    let rest = amount;
    if (this.armour > 0) {
      const absorbed = Math.min(this.armour, rest);
      this.armour -= absorbed;
      rest -= absorbed;
    }
    this.health = Math.max(0, this.health - rest);
    return this.health;
  }

  update(dt, keys, camYaw) {
    if (!this.onFoot) return;
    let fx = 0, fz = 0;
    if (keys.has('KeyW')) fz -= 1;
    if (keys.has('KeyS')) fz += 1;
    if (keys.has('KeyA')) fx -= 1;
    if (keys.has('KeyD')) fx += 1;
    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const speed = this.walkSpeed * (sprint ? 1.7 : 1);
    if (fx !== 0 || fz !== 0) {
      const len = Math.hypot(fx, fz);
      fx /= len; fz /= len;
      // Move relative to the camera yaw.
      const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
      const mx = fx * cos - fz * sin;
      const mz = fx * sin + fz * cos;
      this.group.position.x = clamp(this.group.position.x + mx * speed * dt, -315, 315);
      this.group.position.z = clamp(this.group.position.z + mz * speed * dt, -315, 315);
      this.heading = Math.atan2(mx, mz);
      this.group.rotation.y = this.heading;
      this._walkPhase += dt * (sprint ? 11 : 7);
      const swing = Math.sin(this._walkPhase) * 0.45;
      if (this.weapon <= 1) {
        this.legL.rotation.x = swing;
        this.legR.rotation.x = -swing;
      } else {
        this.legL.rotation.x = swing * 0.5;
        this.legR.rotation.x = -swing * 0.5;
      }
    } else {
      this.legL.rotation.x = 0;
      this.legR.rotation.x = 0;
    }
    this._updateAimPose();
  }

  enterCar(car) {
    this.car = car;
    this.onFoot = false;
    this.group.visible = false;
    this._updateAimPose();
  }

  exitCar() {
    if (!this.car) return;
    const a = this.car.angle;
    this.group.position.set(
      this.car.mesh.position.x - Math.sin(a + Math.PI / 2) * 2.4,
      0,
      this.car.mesh.position.z - Math.cos(a + Math.PI / 2) * 2.4,
    );
    this.car = null;
    this.onFoot = true;
    this.group.visible = true;
    this._updateAimPose();
  }
}
