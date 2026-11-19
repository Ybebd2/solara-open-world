// SOLARA — the wanted system and the Solara Police. Committing a crime adds
// heat; heat is shown as stars and decays when the player stays quiet. While
// wanted, police cars spawn and chase the player, and at higher levels foot
// officers join in. A police car that corners the player on foot, or a player
// whose health hits zero, ends the run as BUSTED.

import * as THREE from 'three';
import { CONFIG, clamp, angleDiff, makeRandom } from './config.js';
import { Car } from './vehicles.js';

export class Wanted {
  constructor() {
    this.heat = 0; // 0..5, float. Stars shown are the ceiling.
    this.stars = 0;
  }

  add(amount) {
    this.heat = clamp(this.heat + amount, 0, CONFIG.WANTED_MAX);
    this.stars = Math.ceil(this.heat);
  }

  // Decay while the player is quiet (no crime in the last few seconds).
  update(dt, quiet) {
    if (quiet) this.heat = Math.max(0, this.heat - CONFIG.HEAT_DECAY_PER_SEC * dt);
    this.stars = Math.ceil(this.heat);
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
  }
}

// One foot officer: a dark-blue figure that runs at the player and punches.
class Officer {
  constructor(scene, x, z) {
    this.group = new THREE.Group();
    const uni = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.35), uni);
    body.position.y = 1.15;
    body.castShadow = true;
    this.group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), skin);
    head.position.y = 1.85;
    this.group.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.12, 10), new THREE.MeshLambertMaterial({ color: 0x0a1a3a }));
    cap.position.y = 2.05;
    this.group.add(cap);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), uni);
    legs.position.y = 0.35;
    this.group.add(legs);
    this.group.position.set(x, 0, z);
    scene.add(this.group);
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = 0;
    this.punchCooldown = 0;
  }

  update(dt, target, onHit) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 1.6) {
      this.heading = Math.atan2(dx, dz);
      this.pos.x += Math.sin(this.heading) * CONFIG.POLICE_FOOT_SPEED * dt;
      this.pos.z += Math.cos(this.heading) * CONFIG.POLICE_FOOT_SPEED * dt;
    } else if (this.punchCooldown <= 0) {
      this.punchCooldown = 0.9;
      if (onHit) onHit(8);
    }
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;
  }

  dispose(scene) {
    scene.remove(this.group);
  }
}

export class Police {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.cars = [];
    this.officers = [];
    this.rand = makeRandom(31337);
    this.spawnTimer = 0;
    this.bustTimer = 0; // how long a police car has held the on-foot player
    this.sirenPhase = 0;
  }

  // How many police cars and officers the current stars call for.
  desiredCounts(stars) {
    if (stars <= 0) return { cars: 0, officers: 0 };
    if (stars === 1) return { cars: 1, officers: 0 };
    if (stars === 2) return { cars: 2, officers: 0 };
    if (stars === 3) return { cars: 2, officers: 2 };
    if (stars === 4) return { cars: 3, officers: 3 };
    return { cars: 4, officers: 4 };
  }

  spawnCarNear(x, z) {
    // Spawn on a road, a little way from the player.
    const road = this.world.roads.horizontal[Math.floor(this.rand() * this.world.roads.horizontal.length)];
    const sx = x + (this.rand() < 0.5 ? -1 : 1) * (30 + this.rand() * 30);
    const car = new Car(this.scene, sx, road.z, this.rand() * Math.PI * 2, 0x111111, true);
    car.baseSpeed = CONFIG.POLICE_CAR_SPEED;
    this.cars.push(car);
    return car;
  }

  spawnOfficerNear(x, z) {
    const o = new Officer(this.scene, x + (this.rand() - 0.5) * 24, z + (this.rand() - 0.5) * 24);
    this.officers.push(o);
    return o;
  }

  // Keep the force at the level the stars call for; remove it when wanted 0.
  update(dt, stars, playerPos, onFoot, onPlayerHit, onBusted) {
    const want = this.desiredCounts(stars);
    this.spawnTimer -= dt;
    if (this.cars.length < want.cars && this.spawnTimer <= 0) {
      this.spawnCarNear(playerPos.x, playerPos.z);
      this.spawnTimer = 1.5;
    }
    if (this.officers.length < want.officers && this.spawnTimer <= 0) {
      this.spawnOfficerNear(playerPos.x, playerPos.z);
      this.spawnTimer = 1.5;
    }
    while (this.cars.length > want.cars) {
      const c = this.cars.pop();
      c.dispose(this.scene);
    }
    while (this.officers.length > want.officers) {
      const o = this.officers.pop();
      o.dispose(this.scene);
    }
    // Police cars chase the player: steer toward them and accelerate.
    for (const car of this.cars) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      const turn = angleDiff(car.heading, targetHeading);
      const input = {
        forward: dist > 4,
        back: false,
        left: turn > 0.12,
        right: turn < -0.12,
      };
      car.drive(dt, input, this.world);
      // Ramming the on-foot player: a bump that hurts and can bust them.
      if (onFoot && dist < 3.2) {
        this.bustTimer += dt;
        if (this.bustTimer > 1.6 && onBusted) onBusted();
      } else if (onFoot && dist < 6) {
        // A near miss still shakes the player.
        if (onPlayerHit) onPlayerHit(0);
      }
    }
    if (!onFoot || this.cars.length === 0) this.bustTimer = Math.max(0, this.bustTimer - dt);
    for (const o of this.officers) {
      o.update(dt, playerPos, onPlayerHit);
    }
    this.sirenPhase += dt;
  }

  clear() {
    for (const c of this.cars) c.dispose(this.scene);
    for (const o of this.officers) o.dispose(this.scene);
    this.cars = [];
    this.officers = [];
    this.bustTimer = 0;
  }
}
