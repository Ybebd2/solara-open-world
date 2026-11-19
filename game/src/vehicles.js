// SOLARA — vehicles and the people on the street. Cars are built from boxes
// and cylinders in code (body, cabin, wheels, lights), so the game needs no
// model files. Player driving is arcade physics: accelerate, brake, steer,
// with a little drift. Traffic cars follow the road grid and turn at
// intersections; pedestrians stroll the sidewalks and run when scared.

import * as THREE from 'three';
import { CONFIG, makeRandom, pick, clamp, angleDiff } from './config.js';
import { hitsBuilding, resolveBuildingCollision } from './world.js';

const CAR_COLORS = [0xc0392b, 0x2e6db4, 0xe8e8e8, 0x222222, 0xf5c542, 0x7a4a9e, 0x2e8b57, 0xd96c2b, 0x5a6b7a, 0x9e2b25];
const CAR_NAMES = ['Comet', 'Stallion', 'Fathom', 'Vortex', 'Boulevard', 'Sunrise', 'Prowler', 'Marlin'];

// Build one car's mesh. Returns { group, wheels: [w1..w4] }.
export function makeCarMesh(color, isPolice = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1a1a1a : color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2a33 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glassMat);
  cabin.position.set(0, 1.2, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    group.add(w);
    wheels.push(w);
  }
  // Headlights and taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
    h.position.set(x, 0.6, 2.21);
    group.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    t.position.set(x, 0.6, -2.21);
    group.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 1.6, -0.2);
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(0.7, 1.6, -0.2);
    group.add(bar2);
  }
  return { group, wheels };
}

// One car in the world.
export class Car {
  constructor(scene, x, z, heading, color, isPolice = false) {
    const { group, wheels } = makeCarMesh(color, isPolice);
    this.mesh = group;
    this.wheels = wheels;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.isPolice = isPolice;
    this.name = isPolice ? 'Interceptor' : pick(makeRandom((x * 31 + z * 17) | 0), CAR_NAMES);
    this.color = color;
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
  }

  // Drive with player input: { forward, back, left, right }.
  drive(dt, input, world) {
    const top = this.isPolice ? CONFIG.POLICE_CAR_SPEED : CONFIG.CAR_TOP_SPEED;
    if (input.forward) this.speed += CONFIG.CAR_ACCEL * dt;
    if (input.back) this.speed -= (this.speed > 0.5 ? CONFIG.CAR_BRAKE : CONFIG.CAR_ACCEL * 0.6) * dt;
    if (!input.forward && !input.back) this.speed *= Math.max(0, 1 - 0.8 * dt);
    this.speed = clamp(this.speed, -CONFIG.CAR_REVERSE_SPEED, top);
    const steerTarget = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    this.steer += (steerTarget - this.steer) * Math.min(1, 8 * dt);
    const dir = this.speed >= 0 ? 1 : -1;
    this.heading += this.steer * CONFIG.CAR_STEER * dt * dir * Math.min(1, Math.abs(this.speed) / 8);
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    // Keep the car out of buildings; a bump kills some speed.
    const before = { x: this.pos.x, z: this.pos.z };
    this.pos.x = nx;
    this.pos.z = nz;
    if (hitsBuilding(world.buildings, this.pos.x, this.pos.z, 2.2)) {
      this.pos.x = before.x;
      this.pos.z = before.z;
      this.speed *= 0.4;
    }
    // Keep the car inside the city.
    const lim = world.half + CONFIG.ROAD + 24;
    this.pos.x = clamp(this.pos.x, -lim, lim);
    this.pos.z = clamp(this.pos.z, -lim, lim);
    this.sync(dt);
  }

  // Idle roll: the car sits still but its wheels and lights stay live.
  sync(dt) {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = this.heading;
    const spin = (this.speed * dt) / 0.38;
    for (const w of this.wheels) w.rotation.x += spin;
  }

  dispose(scene) {
    scene.remove(this.mesh);
  }
}

// Traffic: cars that follow the road grid. Each one drives along one road
// (horizontal or vertical) in one direction; at an intersection it sometimes
// turns onto the crossing road; at the city edge it turns back.
export class Traffic {
  constructor(scene, world, count = 14) {
    this.scene = scene;
    this.world = world;
    this.cars = [];
    this.rand = makeRandom(777);
    for (let i = 0; i < count; i++) this.spawn();
  }

  spawn() {
    const { roads, half } = this.world;
    const horizontal = this.rand() < 0.5;
    const road = horizontal ? pick(this.rand, roads.horizontal) : pick(this.rand, roads.vertical);
    const dir = this.rand() < 0.5 ? 1 : -1;
    const lane = 2.2; // right-hand lane offset
    let x, z, heading;
    if (horizontal) {
      z = road.z + (dir > 0 ? lane : -lane);
      x = -half + this.rand() * half * 2;
      heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      x = road.x + (dir > 0 ? -lane : lane);
      z = -half + this.rand() * half * 2;
      heading = dir > 0 ? Math.PI : 0;
    }
    const car = new Car(this.scene, x, z, heading, pick(this.rand, CAR_COLORS));
    car.speed = 9 + this.rand() * 7;
    car.axis = horizontal ? 'x' : 'z';
    car.dir = dir;
    car.road = road;
    this.cars.push(car);
  }

  // A car ahead on the same road, close enough to brake for.
  carAhead(car) {
    for (const o of this.cars) {
      if (o === car) continue;
      if (o.axis !== car.axis) continue;
      const along = car.axis === 'x' ? (o.pos.x - car.pos.x) * car.dir : (o.pos.z - car.pos.z) * car.dir;
      const side = car.axis === 'x' ? Math.abs(o.pos.z - car.pos.z) : Math.abs(o.pos.x - car.pos.x);
      if (along > 0 && along < 14 && side < 3.5) return true;
    }
    return false;
  }

  update(dt) {
    const { roads, half } = this.world;
    for (const car of this.cars) {
      const target = 9 + (car.baseSpeed ?? 0);
      car.baseSpeed = car.baseSpeed ?? 9 + this.rand() * 0;
      const want = this.carAhead(car) ? 0 : target;
      car.speed += (want - car.speed) * Math.min(1, 2 * dt);
      // Turn at an intersection, sometimes.
      const pos = car.axis === 'x' ? car.pos.x : car.pos.z;
      const lines = car.axis === 'x' ? roads.vertical.map((r) => r.x) : roads.horizontal.map((r) => r.z);
      const near = lines.find((l) => Math.abs(pos - l) < 2.5);
      if (near !== undefined && this.rand() < 0.02) {
        // Turn onto the crossing road.
        const wasX = car.axis === 'x';
        car.axis = wasX ? 'z' : 'x';
        car.dir = this.rand() < 0.5 ? 1 : -1;
        car.heading = car.axis === 'x' ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? Math.PI : 0);
        if (wasX) car.pos.z = near;
        else car.pos.x = near;
      }
      // Turn back at the city edge.
      const edge = half + CONFIG.ROAD;
      if (car.axis === 'x' && (car.pos.x > edge || car.pos.x < -edge)) {
        car.dir *= -1;
        car.heading += Math.PI;
      }
      if (car.axis === 'z' && (car.pos.z > edge || car.pos.z < -edge)) {
        car.dir *= -1;
        car.heading += Math.PI;
      }
      const step = car.speed * dt * car.dir;
      if (car.axis === 'x') car.pos.x += step;
      else car.pos.z += step;
      car.sync(dt);
    }
  }
}

// Pedestrians: simple figures that stroll the sidewalks and run away when
// the player is violent or a car comes at them.
export class Pedestrians {
  constructor(scene, world, count = 22) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.rand = makeRandom(4242);
    const shirtColors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0x2ecc71];
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({ color: pick(this.rand, shirtColors) });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.32), shirt);
      body.position.y = 1.05;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
      head.position.y = 1.75;
      head.castShadow = true;
      g.add(head);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
      legs.position.y = 0.35;
      g.add(legs);
      const spot = pick(this.rand, world.sidewalks);
      g.position.set(spot.x + (this.rand() - 0.5) * 40, 0, spot.z + (this.rand() - 0.5) * 40);
      scene.add(g);
      this.list.push({
        mesh: g, x: g.position.x, z: g.position.z,
        heading: this.rand() * Math.PI * 2,
        speed: 1.2 + this.rand() * 0.9,
        scared: 0, tx: g.position.x, tz: g.position.z,
      });
    }
  }

  scare(x, z, radius = 18) {
    for (const p of this.list) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) p.scared = 3;
    }
  }

  update(dt) {
    for (const p of this.list) {
      if (p.scared > 0) {
        p.scared -= dt;
        // Run away from the last scare point.
        p.heading = Math.atan2(p.x - (this.fleeX ?? p.x), p.z - (this.fleeZ ?? p.z));
        p.speed = 4.5;
      } else {
        p.speed = 1.4;
        if (Math.hypot(p.tx - p.x, p.tz - p.z) < 2 || this.rand() < 0.002) {
          const spot = pick(this.rand, this.world.sidewalks);
          p.tx = spot.x + (this.rand() - 0.5) * 40;
          p.tz = spot.z + (this.rand() - 0.5) * 40;
        }
        p.heading = Math.atan2(p.tx - p.x, p.tz - p.z);
      }
      p.x += Math.sin(p.heading) * p.speed * dt;
      p.z += Math.cos(p.heading) * p.speed * dt;
      const pos = { x: p.x, z: p.z };
      resolveBuildingCollision(this.world.buildings, pos, 0.6);
      p.x = pos.x;
      p.z = pos.z;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // A little bob while walking.
      p.mesh.position.y = Math.abs(Math.sin(performance.now() * 0.006 + p.x)) * 0.06;
    }
  }
}
