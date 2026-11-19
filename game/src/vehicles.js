// SOLARA v3 — vehicles and the people on the street. Cars are built from
// geometry in code, but they are proper cars now: a shaped body with a sloped
// hood and trunk, a glass cabin, side mirrors, bumpers, wheels with hubcaps,
// headlights and taillights, and a spoiler on the sports car. The pickup has
// a pink cabin and an orange bed; the van is tall; the sports car is low and
// fast-looking. No model files, so the game still runs offline. Player
// driving is arcade physics: accelerate, brake, steer, with a little drift,
// and cars slide along building walls instead of stopping dead. Traffic cars
// follow the road grid and turn at intersections; pedestrians stroll the
// sidewalks and run when scared — and the owner of a stolen car runs off.

import * as THREE from 'three';
import { CONFIG, CAR_TYPES, CAR_COLORS, makeRandom, pick, clamp } from './config.js';
import { hitsBuilding, resolveBuildingCollision } from './world.js';

const CAR_NAMES = ['Comet', 'Stallion', 'Fathom', 'Vortex GT', 'Boulevard', 'Sunrise', 'Prowler', 'Marlin'];
const TYPE_KEYS = Object.keys(CAR_TYPES);

// Build one car's mesh. Returns { group, wheels, headlights }.
// type: 'sedan' | 'sports' | 'pickup' | 'van'. The body is layered: a low
// chassis, a sloped hood, a trunk, and a glass cabin — a car, not a box.
export function makeCarMesh(color, isPolice = false, type = 'sedan') {
  const group = new THREE.Group();
  const spec = CAR_TYPES[type] ?? CAR_TYPES.sedan;
  const bodyMat = new THREE.MeshLambertMaterial({ color: isPolice ? 0x1a1a1a : color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1c2a33 });
  const darkMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const chromeMat = new THREE.MeshLambertMaterial({ color: 0xd8dee8 });
  // Chassis: the low slab the car sits on.
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, spec.bodyH, 4.4), bodyMat);
  body.position.y = 0.35 + spec.bodyH / 2;
  body.castShadow = true;
  group.add(body);
  // Sloped hood (front) and trunk (rear): thin wedges that give the car a
  // silhouette instead of a flat top.
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.22, 1.1), bodyMat);
  hood.position.set(0, 0.35 + spec.bodyH + 0.08, 1.55);
  hood.rotation.x = -0.12;
  hood.castShadow = true;
  group.add(hood);
  if (spec.bed) {
    // Pickup bed: an open orange tray behind the cabin.
    const bedMat = new THREE.MeshLambertMaterial({ color: 0xff7a1a });
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 1.5), bedMat);
    bed.position.set(0, 0.35 + spec.bodyH + 0.2, -1.2);
    bed.castShadow = true;
    group.add(bed);
    const bedWall = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.28, 0.12), bedMat);
    bedWall.position.set(0, 0.35 + spec.bodyH + 0.55, -1.9);
    group.add(bedWall);
  } else {
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 0.9), bodyMat);
    trunk.position.set(0, 0.35 + spec.bodyH + 0.07, -1.6);
    trunk.rotation.x = 0.1;
    group.add(trunk);
  }
  // Cabin: glass, with a coloured roof panel and a windshield slope.
  const cabinMat = spec.bed
    ? new THREE.MeshLambertMaterial({ color: 0xf27ea9 }) // pink cabin on the pickup
    : glassMat;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, spec.cabinH, spec.bed ? 1.1 : 2.1), cabinMat);
  cabin.position.set(0, 0.35 + spec.bodyH + spec.cabinH / 2 + 0.1, spec.bed ? 0.9 : -0.15);
  cabin.castShadow = true;
  group.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.08, spec.bed ? 1.15 : 2.0), bodyMat);
  roof.position.set(0, 0.35 + spec.bodyH + spec.cabinH + 0.14, spec.bed ? 0.9 : -0.15);
  group.add(roof);
  // Side mirrors, bumpers and a grille.
  for (const x of [-1.02, 1.02]) {
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.3), darkMat);
    mirror.position.set(x, 0.35 + spec.bodyH + 0.45, 0.6);
    group.add(mirror);
  }
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.25), chromeMat);
  bumperF.position.set(0, 0.32, 2.25);
  group.add(bumperF);
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.22, 0.25), chromeMat);
  bumperR.position.set(0, 0.32, -2.25);
  group.add(bumperR);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.08), darkMat);
  grille.position.set(0, 0.55, 2.22);
  group.add(grille);
  // Spoiler on the sports car.
  if (spec.spoiler) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), darkMat);
    wing.position.set(0, 0.35 + spec.bodyH + 0.55, -2.05);
    group.add(wing);
    for (const x of [-0.7, 0.7]) {
      const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), darkMat);
      strut.position.set(x, 0.35 + spec.bodyH + 0.32, -2.05);
      group.add(strut);
    }
  }
  // Wheels with hubcaps.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 12);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.32, 10);
  const wheels = [];
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    group.add(w);
    const hub = new THREE.Mesh(hubGeo, chromeMat);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(x, 0.38, z);
    group.add(hub);
    wheels.push(w);
  }
  // Headlights and taillights, with a glow sprite that lights up at dusk.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
  const headlights = [];
  for (const x of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), headMat);
    h.position.set(x, 0.6, 2.21);
    group.add(h);
    headlights.push(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    t.position.set(x, 0.6, -2.21);
    group.add(t);
  }
  if (isPolice) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2244ff }));
    bar.position.set(0, 0.35 + spec.bodyH + spec.cabinH + 0.25, -0.15);
    group.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    bar2.position.set(0.7, 0.35 + spec.bodyH + spec.cabinH + 0.25, -0.15);
    group.add(bar2);
    const badge = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.3, 0.05), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    badge.position.set(0, 0.7, 2.22);
    group.add(badge);
  }
  return { group, wheels, headlights };
}

// One car in the world.
export class Car {
  constructor(scene, x, z, heading, color, isPolice = false, type = 'sedan') {
    this.type = isPolice ? 'sedan' : type;
    const { group, wheels, headlights } = makeCarMesh(color, isPolice, this.type);
    this.mesh = group;
    this.wheels = wheels;
    this.headlights = headlights;
    this.pos = new THREE.Vector3(x, 0, z);
    this.heading = heading;
    this.speed = 0;
    this.steer = 0;
    this.isPolice = isPolice;
    this.name = isPolice ? 'Interceptor' : pick(makeRandom((x * 31 + z * 17) | 0), CAR_NAMES);
    this.color = color;
    // Condition 0..100: ramming and crashes wear it down; the garage fixes it.
    this.condition = 100;
    this.upgrades = { engine: false, armor: false, paint: false };
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.y = heading;
    scene.add(this.mesh);
  }

  topSpeed() {
    const base = this.isPolice ? CONFIG.POLICE_CAR_SPEED : CONFIG.CAR_TOP_SPEED;
    return this.upgrades.engine ? base * 1.25 : base;
  }

  damage(amount) {
    // Damage is never negative: a negative amount would silently repair.
    amount = Math.max(0, amount);
    if (this.upgrades.armor) amount *= 0.6;
    this.condition = Math.max(0, this.condition - amount);
    return this.condition;
  }

  repair() {
    this.condition = 100;
  }

  // Drive with player input: { f, b, l, r } (the same shape the frame loop
  // builds for the on-foot player). A car that meets a building slides along
  // the wall (try the full step, then X only, then Z only) instead of
  // stopping dead, so a chase can go around a block.
  drive(dt, input, world) {
    const top = this.topSpeed();
    if (input.f) this.speed += CONFIG.CAR_ACCEL * dt;
    if (input.b) this.speed -= (this.speed > 0.5 ? CONFIG.CAR_BRAKE : CONFIG.CAR_ACCEL * 0.6) * dt;
    if (!input.f && !input.b) this.speed *= Math.max(0, 1 - 0.8 * dt);
    this.speed = clamp(this.speed, -CONFIG.CAR_REVERSE_SPEED, top);
    const steerTarget = (input.l ? 1 : 0) - (input.r ? 1 : 0);
    this.steer += (steerTarget - this.steer) * Math.min(1, 8 * dt);
    const dir = this.speed >= 0 ? 1 : -1;
    this.heading += this.steer * CONFIG.CAR_STEER * dt * dir * Math.min(1, Math.abs(this.speed) / 8);
    const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
    const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
    // Slide along buildings: full step, else X only, else Z only, else stay.
    if (!hitsBuilding(world.buildings, nx, nz, 2.2)) {
      this.pos.x = nx;
      this.pos.z = nz;
    } else if (!hitsBuilding(world.buildings, nx, this.pos.z, 2.2)) {
      this.pos.x = nx;
      this.speed *= 0.7;
    } else if (!hitsBuilding(world.buildings, this.pos.x, nz, 2.2)) {
      this.pos.z = nz;
      this.speed *= 0.7;
    } else {
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
// turns onto the crossing road; at the city edge it turns back. The player's
// car is skipped: once you steal a traffic car, the AI hands it to you and
// never fights your steering.
export class Traffic {
  constructor(scene, world, count = 16) {
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
    const type = pick(this.rand, TYPE_KEYS);
    const car = new Car(this.scene, x, z, heading, pick(this.rand, CAR_COLORS), false, type);
    car.speed = 9 + this.rand() * 7;
    car.baseSpeed = car.speed;
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

  // playerCar: the car the player is driving, if it is a traffic car — the
  // AI leaves it alone so the player is the one driving.
  update(dt, playerCar = null) {
    const { roads, half } = this.world;
    for (const car of this.cars) {
      if (playerCar && car === playerCar) continue;
      const target = car.baseSpeed ?? 9;
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

// Pedestrians: figures with shirts, arms and hair that stroll the sidewalks
// and run away when the player is violent or a car comes at them.
export class Pedestrians {
  constructor(scene, world, count = 26) {
    this.scene = scene;
    this.world = world;
    this.list = [];
    this.rand = makeRandom(4242);
    this.fleeX = 0;
    this.fleeZ = 0;
    const shirtColors = [0xe74c3c, 0x3498db, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0x2ecc71, 0xf27ea9, 0x19b5a6];
    const skinColors = [0xd9a066, 0xc98a5a, 0xe8b98a, 0x8a5a3a];
    for (let i = 0; i < count; i++) {
      const g = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({ color: pick(this.rand, shirtColors) });
      const skin = new THREE.MeshLambertMaterial({ color: pick(this.rand, skinColors) });
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.32), shirt);
      body.position.y = 1.05;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), skin);
      head.position.y = 1.75;
      head.castShadow = true;
      g.add(head);
      const hair = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshLambertMaterial({ color: pick(this.rand, [0x1a1a1a, 0x5a3a1a, 0x8a8a8a, 0x2a1a0a]) }));
      hair.position.y = 1.8;
      g.add(hair);
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
      legs.position.y = 0.35;
      g.add(legs);
      for (const x of [-0.36, 0.36]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.65, 0.2), shirt);
        arm.position.set(x, 1.1, 0);
        g.add(arm);
      }
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

  // Scare everyone near (x, z): they run AWAY from that point for 3 seconds.
  scare(x, z, radius = 18) {
    this.fleeX = x;
    this.fleeZ = z;
    for (const p of this.list) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) p.scared = 3;
    }
  }

  // The owner of a stolen car: one pedestrian right by the car who runs off
  // screaming the moment it is taken.
  spawnFleeingOwner(x, z) {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: 0xe74c3c });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.9, 0.32), shirt);
    body.position.y = 1.05;
    body.castShadow = true;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
    head.position.y = 1.75;
    g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), new THREE.MeshLambertMaterial({ color: 0x2c3e50 }));
    legs.position.y = 0.35;
    g.add(legs);
    g.position.set(x + 2, 0, z + 1);
    this.scene.add(g);
    this.list.push({
      mesh: g, x: x + 2, z: z + 1,
      heading: Math.atan2(2, 1),
      speed: 5,
      scared: 4, tx: x + 30, tz: z + 30,
    });
    this.fleeX = x;
    this.fleeZ = z;
  }

  update(dt) {
    for (const p of this.list) {
      if (p.scared > 0) {
        p.scared -= dt;
        // Run away from the scare point.
        p.heading = Math.atan2(p.x - this.fleeX, p.z - this.fleeZ);
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
