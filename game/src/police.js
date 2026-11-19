// SOLARA v3 — the wanted system and the Solara Police (PCPD). Committing
// a crime adds heat; heat is shown as stars and decays when the player stays
// quiet. While wanted, police cars spawn and chase the player, and at higher
// levels foot officers join in. A police car that corners the player on foot,
// or a player whose health hits zero, ends the run as BUSTED.
//
// v3: every unit has a callsign (BARRACUDA-18, VIPER-07, ...) and a live
// distance the PCPD panel shows; an evading meter rises while no unit can see
// the player, and reaching 100% clears the wanted level with an escape
// reward; at 3+ stars a police helicopter (AIR-1) joins the chase, hovering
// above the player with a spotlight.

import * as THREE from 'three';
import { CONFIG, clamp, angleDiff, makeRandom, pick } from './config.js';
import { Car } from './vehicles.js';

const CALLSIGNS = ['BARRACUDA', 'VIPER', 'SHARK', 'TIGER', 'COBRA', 'FALCON', 'PYTHON', 'JAGUAR'];

export class Wanted {
  constructor() {
    this.heat = 0; // 0..5, float. Stars shown are the ceiling.
    this.stars = 0;
    // Evading 0..100: rises while no police unit is close enough to see the
    // player, falls while one is. At 100 the player has escaped.
    this.evading = 0;
  }

  add(amount) {
    this.heat = clamp(this.heat + amount, 0, CONFIG.WANTED_MAX);
    this.stars = Math.ceil(this.heat);
    this.evading = 0;
  }

  // Decay while the player is quiet (no crime in the last few seconds).
  // evadingVisible: true while any police unit is near the player.
  update(dt, quiet, evadingVisible) {
    if (quiet) this.heat = Math.max(0, this.heat - CONFIG.HEAT_DECAY_PER_SEC * dt);
    this.stars = Math.ceil(this.heat);
    if (this.stars > 0) {
      if (evadingVisible) this.evading = Math.max(0, this.evading - dt * 22);
      else this.evading = Math.min(100, this.evading + dt * 14);
    } else {
      this.evading = 0;
    }
  }

  clear() {
    this.heat = 0;
    this.stars = 0;
    this.evading = 0;
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

// The police helicopter: a dark body with a tail, a spinning main rotor and
// a spotlight cone that tracks the player from above.
export class Helicopter {
  constructor(scene) {
    this.group = new THREE.Group();
    const dark = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    const glass = new THREE.MeshLambertMaterial({ color: 0x1c2a33 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 3.4), dark);
    body.castShadow = true;
    this.group.add(body);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.9, 1.2), glass);
    nose.position.set(0, -0.1, 2.0);
    this.group.add(nose);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.2), dark);
    tail.position.set(0, 0.2, -3.0);
    this.group.add(tail);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.4, 0.8), dark);
    fin.position.set(0, 0.8, -4.4);
    this.group.add(fin);
    this.rotor = new THREE.Mesh(new THREE.BoxGeometry(9, 0.08, 0.5), new THREE.MeshLambertMaterial({ color: 0x333333 }));
    this.rotor.position.y = 0.9;
    this.group.add(this.rotor);
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), dark);
    tailRotor.position.set(0.3, 0.6, -4.4);
    this.group.add(tailRotor);
    // The spotlight: a cone of light aimed at the player.
    this.spot = new THREE.SpotLight(0xfff2b0, 3.5, 90, 0.32, 0.5, 1.2);
    this.spot.position.set(0, -0.6, 0);
    this.group.add(this.spot);
    this.spotTarget = new THREE.Object3D();
    scene.add(this.spotTarget);
    this.spot.target = this.spotTarget;
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(6, 40, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.14, side: THREE.DoubleSide, depthWrite: false })
    );
    beam.position.y = -20;
    beam.rotation.x = Math.PI;
    this.group.add(beam);
    this.pos = new THREE.Vector3(0, CONFIG.HELI_HEIGHT, 0);
    this.group.position.copy(this.pos);
    scene.add(this.group);
    this.name = 'AIR-1';
  }

  update(dt, target) {
    // Hover above the player, drifting to stay over them.
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const d = Math.hypot(dx, dz);
    if (d > 4) {
      const step = Math.min(d, CONFIG.HELI_SPEED * dt);
      this.pos.x += (dx / d) * step;
      this.pos.z += (dz / d) * step;
    }
    // A slow orbit so the hover does not look frozen.
    const t = performance.now() * 0.0002;
    this.pos.x += Math.sin(t) * dt * 2;
    this.pos.z += Math.cos(t) * dt * 2;
    this.pos.y = CONFIG.HELI_HEIGHT + Math.sin(performance.now() * 0.001) * 1.5;
    this.rotor.rotation.y += dt * 22;
    this.group.position.copy(this.pos);
    this.group.rotation.y = Math.atan2(dx, dz);
    this.spotTarget.position.set(target.x, 0, target.z);
    this.spot.position.set(0, -0.6, 0);
  }

  dispose(scene) {
    scene.remove(this.group);
    scene.remove(this.spotTarget);
  }
}

export class Police {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.cars = [];
    this.officers = [];
    this.heli = null;
    this.rand = makeRandom(31337);
    this.spawnTimer = 0;
    this.bustTimer = 0; // how long a police car has held the on-foot player
    this.unitCounter = 0;
  }

  nextCallsign() {
    this.unitCounter += 1;
    return `${pick(this.rand, CALLSIGNS)}-${String(10 + (this.unitCounter * 7) % 89)}`;
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
    car.callsign = this.nextCallsign();
    this.cars.push(car);
    return car;
  }

  spawnOfficerNear(x, z) {
    const o = new Officer(this.scene, x + (this.rand() - 0.5) * 24, z + (this.rand() - 0.5) * 24);
    this.officers.push(o);
    return o;
  }

  // The PCPD panel data: every live unit with its callsign, distance to the
  // player and status. The helicopter reports as AIR-1.
  units(playerPos) {
    const list = this.cars.map((c) => {
      const d = Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z);
      // A unit closer than 25 m is on the player (PURSUIT); anything
      // further out is still combing the grid (SEARCHING).
      return { name: c.callsign ?? 'PCPD', dist: Math.round(d), status: d < 25 ? 'PURSUIT' : 'SEARCHING' };
    });
    if (this.heli) {
      const d = Math.hypot(this.heli.pos.x - playerPos.x, this.heli.pos.z - playerPos.z);
      list.push({ name: 'AIR-1', dist: Math.round(d), status: 'SPOTLIGHT', heli: true });
    }
    return list;
  }

  // True while any police unit is close enough to see the player (so the
  // evading meter falls instead of rising).
  anyUnitNear(playerPos, radius = 45) {
    for (const c of this.cars) {
      if (Math.hypot(c.pos.x - playerPos.x, c.pos.z - playerPos.z) < radius) return true;
    }
    for (const o of this.officers) {
      if (Math.hypot(o.pos.x - playerPos.x, o.pos.z - playerPos.z) < radius) return true;
    }
    return false;
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
    // The helicopter joins at 3+ stars and leaves when the heat is gone.
    if (stars >= CONFIG.HELI_MIN_STARS && !this.heli) {
      this.heli = new Helicopter(this.scene);
      this.heli.pos.set(playerPos.x + 20, CONFIG.HELI_HEIGHT, playerPos.z - 20);
    } else if (stars < CONFIG.HELI_MIN_STARS && this.heli) {
      this.heli.dispose(this.scene);
      this.heli = null;
    }
    if (this.heli) this.heli.update(dt, playerPos);
    // Police cars chase the player: steer toward them and accelerate. The
    // wall-slide in Car.drive lets a chase go around a block instead of
    // stopping dead on a building.
    for (const car of this.cars) {
      const dx = playerPos.x - car.pos.x;
      const dz = playerPos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      const targetHeading = Math.atan2(dx, dz);
      const turn = angleDiff(car.heading, targetHeading);
      // Unstuck: if the car wants to move but its speed is near zero for a
      // second (it is nose-first into a building), reverse and turn hard for
      // a moment so it goes around the block instead of grinding the wall.
      // Speed, not per-frame movement, is the test: at a low frame rate a
      // car accelerating normally still moves little per frame.
      if (dist > 4 && Math.abs(car.speed) < 1.0) {
        car._stuck = (car._stuck ?? 0) + dt;
      } else {
        car._stuck = 0;
      }
      car._unstuck = Math.max(0, (car._unstuck ?? 0) - dt);
      if (car._stuck > 1.0) {
        car._unstuck = 0.9;
        car._stuck = 0;
        // Turn a random way, so the car does not loop on the same wall.
        car._unstuckDir = this.rand() < 0.5 ? 1 : -1;
      }
      const input = car._unstuck > 0
        ? { f: false, b: true, l: car._unstuckDir > 0, r: car._unstuckDir < 0 }
        : {
            f: dist > 4,
            b: false,
            l: turn > 0.12,
            r: turn < -0.12,
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
  }

  clear() {
    for (const c of this.cars) c.dispose(this.scene);
    for (const o of this.officers) o.dispose(this.scene);
    this.cars = [];
    this.officers = [];
    if (this.heli) {
      this.heli.dispose(this.scene);
      this.heli = null;
    }
    this.bustTimer = 0;
  }
}
