// SOLARA — the player on foot. A third-person character: WASD moves relative
// to the camera, Shift runs, Space jumps, F punches, and a click fires the
// pistol (a hitscan shot with a short cooldown and a magazine). The camera
// orbits with the mouse while the pointer is locked, and otherwise follows
// behind the player's heading. Health, ammo and the punch are all here.

import * as THREE from 'three';
import { CONFIG, clamp, approach } from './config.js';
import { resolveBuildingCollision } from './world.js';

export class Player {
  constructor(scene) {
    this.group = new THREE.Group();
    // A simple figure: jacket, head, legs, arms. Kai wears a teal jacket.
    const jacket = new THREE.MeshLambertMaterial({ color: 0x1f8a8a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2c3e50 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.35), jacket);
    body.position.y = 1.15;
    body.castShadow = true;
    this.group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.85;
    head.castShadow = true;
    this.group.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    hair.position.y = 1.9;
    this.group.add(hair);
    this.legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.26), pants);
    this.legL.position.set(-0.16, 0.38, 0);
    this.group.add(this.legL);
    this.legR = this.legL.clone();
    this.legR.position.x = 0.16;
    this.group.add(this.legR);
    this.armL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.7, 0.22), jacket);
    this.armL.position.set(-0.42, 1.2, 0);
    this.group.add(this.armL);
    this.armR = this.armL.clone();
    this.armR.position.x = 0.42;
    this.group.add(this.armR);
    // The pistol, held in the right hand when shooting.
    this.gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.16, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    this.gun.position.set(0.42, 1.0, 0.3);
    this.gun.visible = false;
    this.group.add(this.gun);
    scene.add(this.group);

    this.pos = new THREE.Vector3(0, 0, 0);
    this.velY = 0;
    this.grounded = true;
    this.heading = 0;
    this.camYaw = 0;
    this.camPitch = 0.32;
    this.health = CONFIG.PLAYER_HEALTH;
    this.ammo = CONFIG.PISTOL_AMMO;
    this.ammoMax = CONFIG.PISTOL_AMMO;
    this.cooldown = 0;
    this.punchCooldown = 0;
    this.muzzle = 0;
    this.walkPhase = 0;
    this.moving = false;
  }

  place(x, z, heading = 0) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.camYaw = heading;
    this.group.position.copy(this.pos);
    this.group.rotation.y = heading;
  }

  // input: { f, b, l, r, run, jump, punch, shoot }, cameraYaw, dt.
  update(dt, input, world, onShoot, onPunch) {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.muzzle = Math.max(0, this.muzzle - dt * 4);
    const yaw = this.camYaw;
    let mx = 0, mz = 0;
    if (input.f) { mx += Math.sin(yaw); mz += Math.cos(yaw); }
    if (input.b) { mx -= Math.sin(yaw); mz -= Math.cos(yaw); }
    if (input.l) { mx -= Math.cos(yaw); mz += Math.sin(yaw); }
    if (input.r) { mx += Math.cos(yaw); mz -= Math.sin(yaw); }
    const len = Math.hypot(mx, mz);
    this.moving = len > 0;
    if (this.moving) {
      mx /= len; mz /= len;
      const speed = input.run ? CONFIG.RUN_SPEED : CONFIG.WALK_SPEED;
      this.pos.x += mx * speed * dt;
      this.pos.z += mz * speed * dt;
      this.heading = Math.atan2(mx, mz);
      this.walkPhase += dt * speed * 1.6;
    }
    // Jump and gravity.
    if (input.jump && this.grounded) {
      this.velY = CONFIG.JUMP_SPEED;
      this.grounded = false;
    }
    this.velY -= CONFIG.GRAVITY * dt;
    this.pos.y += this.velY * dt;
    if (this.pos.y <= 0) {
      this.pos.y = 0;
      this.velY = 0;
      this.grounded = true;
    }
    resolveBuildingCollision(world.buildings, this.pos, 0.7);
    const lim = world.half + CONFIG.ROAD + 30;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);
    // Walk swing.
    const swing = this.moving ? Math.sin(this.walkPhase) * 0.55 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.7;
    this.armR.rotation.x = swing * 0.7;
    // Punch: a quick arm swing that calls back to the game.
    if (input.punch && this.punchCooldown <= 0) {
      this.punchCooldown = 0.45;
      this.armR.rotation.x = -1.6;
      if (onPunch) onPunch();
    }
    // Shoot: a hitscan pistol shot, one per click, with a magazine.
    if (input.shoot && this.cooldown <= 0) {
      this.cooldown = 0.28;
      this.muzzle = 1;
      this.gun.visible = true;
      if (this.ammo > 0) {
        this.ammo -= 1;
        if (onShoot) onShoot();
      }
    }
    if (this.ammo <= 0 && this.cooldown <= 0 && input.shoot) {
      // Empty click: reload after a beat.
      this.ammo = this.ammoMax;
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  // The camera target: a point just above the player's head.
  headPos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + 1.8, this.pos.z);
  }

  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }

  heal(amount) {
    this.health = Math.min(CONFIG.PLAYER_HEALTH, this.health + amount);
  }

  dispose(scene) {
    scene.remove(this.group);
  }
}

// Third-person camera: orbits the target on mouse drag / pointer lock, keeps
// a fixed distance, and never goes under the ground.
export class FollowCamera {
  constructor(camera) {
    this.camera = camera;
    this.distance = 9;
    this.yaw = 0;
    this.pitch = 0.32;
  }

  // target: Vector3 to look at. yaw/pitch are the orbit angles.
  update(target, yaw, pitch) {
    this.yaw = yaw;
    this.pitch = clamp(pitch, -0.15, 1.1);
    const d = this.distance;
    const cx = target.x - Math.sin(yaw) * Math.cos(this.pitch) * d;
    const cz = target.z - Math.cos(yaw) * Math.cos(this.pitch) * d;
    const cy = target.y + Math.sin(this.pitch) * d + 1.2;
    this.camera.position.set(cx, Math.max(cy, 1.2), cz);
    this.camera.lookAt(target.x, target.y + 0.6, target.z);
  }

  // The camera for driving: further back, lower, following the car's heading.
  updateDriving(target, heading, speed) {
    const d = 11 + Math.min(4, Math.abs(speed) * 0.08);
    const cx = target.x - Math.sin(heading) * d;
    const cz = target.z - Math.cos(heading) * d;
    this.camera.position.set(cx, target.y + 4.2, cz);
    this.camera.lookAt(target.x + Math.sin(heading) * 6, target.y + 1.2, target.z + Math.cos(heading) * 6);
  }
}
