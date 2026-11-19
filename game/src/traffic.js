// SOLARA — traffic: moving cars on the road grid + parked cars at the
// kerb + scooter riders on the beach road. NaN guard: speed is clamped
// only for cars that HAVE a cruise speed; parked cars have cruise ===
// undefined and must never go through Math.min(speed, undefined).
// Built fresh for the @witty-meteor-32 build.
import { Car, makeScooterMesh } from './vehicles.js';
import { WORLD, BEACH_ROAD, rand, pick, clamp } from './config.js';

// Mixed traffic: sedans, taxis, pickups, vans and a low sports car, in
// bright varied paint — the roads read busy, not uniform. Taxis keep
// their yellow, vans stay white.
const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'pickup', 'sports', 'van'];
const TRAFFIC_COLORS = [0xe86a2a, 0x2fb5a8, 0x9a5fd9, 0xf2d13c, 0xe8e8e8, 0xd93a3a, 0x3f9a4a, 0x3f6fb5, 0xe89ac0, 0x8a8a8a];

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];     // all cars (moving + parked)
    this.moving = [];   // { car, cruise, axis, dir }
    this.parked = [];   // Car, cruise === undefined
    this.scooters = []; // { mesh, z, dir, speed }
    this.spawnMoving();
    this.spawnParked();
    this.spawnScooters();
  }

  spawnScooters() {
    // Two commuters on scooters looping the beach road — street life.
    // They ride the outer lanes, both ways.
    for (const [z0, dir, col, sx] of [[-60, 1, 0xff5da2, BEACH_ROAD.southLeft], [80, -1, 0x39d0ff, BEACH_ROAD.northRight]]) {
      const mesh = makeScooterMesh(col);
      mesh.position.set(sx, 0, z0);
      // Scooter front (lamp) is local -z: rotation PI faces south (+z),
      // rotation 0 faces north (-z) — matching the direction of travel.
      mesh.rotation.y = dir > 0 ? Math.PI : 0;
      this.scene.add(mesh);
      this.scooters.push({ mesh, z: z0, dir, speed: rand(6, 8) });
    }
  }

  spawnMoving() {
    const streets = [];
    for (let s = WORLD.streetMin; s <= WORLD.streetMax; s += WORLD.streetStep) streets.push(s);
    for (let i = 0; i < 18; i++) {
      const type = pick(TRAFFIC_TYPES);
      // The first six cars are biased onto the beach road, so the
      // boulevard reads busy in normal play, not just in staged shots.
      const onBeach = i < 6;
      const axis = onBeach ? 'z' : (Math.random() < 0.5 ? 'x' : 'z');
      const line = onBeach ? BEACH_ROAD.x : pick(streets);
      const dir = Math.random() < 0.5 ? 1 : -1;
      // Lane offset from the street centre: 2-lane streets use ±2.2;
      // the 4-lane beach road uses its four lane centres.
      let lane;
      if (line === BEACH_ROAD.x) {
        const centres = dir > 0 ? [BEACH_ROAD.southLeft, BEACH_ROAD.southRight] : [BEACH_ROAD.northLeft, BEACH_ROAD.northRight];
        lane = pick(centres) - BEACH_ROAD.x;
      } else {
        lane = dir > 0 ? 2.2 : -2.2;
      }
      const along = rand(-170, 170);
      const x = axis === 'x' ? along : line + lane;
      const z = axis === 'x' ? line + lane : along;
      const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      const paint = type === 'taxi' ? undefined : type === 'van' ? 0xe8e8e8 : pick(TRAFFIC_COLORS);
      const car = new Car(type, x, z, heading, paint);
      car.cruise = rand(7, 12); // defined cruise speed — only moving cars have this
      this.scene.add(car.mesh);
      this.cars.push(car);
      this.moving.push({ car, cruise: car.cruise, axis, dir });
    }
  }

  spawnParked() {
    const streets = [];
    for (let s = WORLD.streetMin; s <= WORLD.streetMax; s += WORLD.streetStep) streets.push(s);
    for (let i = 0; i < 16; i++) {
      const type = pick(['sedan', 'sedan', 'pickup', 'taxi', 'sports', 'van']);
      const axis = Math.random() < 0.5 ? 'x' : 'z';
      // The first four park at the beach-road kerbs, so the boulevard
      // reads lined with cars even between the moving traffic.
      const onBeach = i < 4;
      const line = onBeach ? BEACH_ROAD.x : pick(streets);
      const ax = onBeach ? 'z' : axis;
      // Kerb offset: 2-lane streets park at ±5.4; the beach road parks
      // at its asphalt edges (±6.3 from the centre line).
      let side = Math.random() < 0.5 ? 5.4 : -5.4;
      if (line === BEACH_ROAD.x) side = Math.random() < 0.5 ? 6.3 : -6.3;
      const along = rand(-165, 165);
      const x = ax === 'x' ? along : line + side;
      const z = ax === 'x' ? line + side : along;
      const heading = ax === 'x' ? (side > 0 ? Math.PI / 2 : -Math.PI / 2) : (side > 0 ? 0 : Math.PI);
      const paint = type === 'taxi' ? undefined : type === 'van' ? 0xe8e8e8 : pick(TRAFFIC_COLORS);
      const car = new Car(type, x, z, heading, paint);
      car.cruise = undefined; // parked: no cruise — the NaN guard relies on this
      this.scene.add(car.mesh);
      this.cars.push(car);
      this.parked.push(car);
    }
  }

  // Parked car at an exact spot (staged shots): type, position and
  // heading are the caller's, cruise stays undefined (parked).
  spawnParkedAt(type, x, z, heading) {
    const paint = type === 'taxi' ? undefined : type === 'van' ? 0xe8e8e8 : pick(TRAFFIC_COLORS);
    const car = new Car(type, x, z, heading, paint);
    car.cruise = undefined;
    this.scene.add(car.mesh);
    this.cars.push(car);
    this.parked.push(car);
    return car;
  }

  update(dt) {
    for (const m of this.moving) {
      const c = m.car;
      // Clamp ONLY when cruise is defined; parked cars never reach this branch.
      if (m.cruise !== undefined) {
        c.speed = Math.min(c.speed + 4 * dt, m.cruise);
        c.speed = clamp(c.speed, 0, m.cruise);
      }
      const step = c.speed * dt * m.dir;
      if (m.axis === 'x') {
        c.mesh.position.x += step;
        if (c.mesh.position.x > 175) c.mesh.position.x = -175;
        if (c.mesh.position.x < -175) c.mesh.position.x = 175;
      } else {
        c.mesh.position.z += step;
        if (c.mesh.position.z > 175) c.mesh.position.z = -175;
        if (c.mesh.position.z < -175) c.mesh.position.z = 175;
      }
      // Front is local -z: rotation.y = heading + PI points the front
      // along the direction of motion (southbound = PI, northbound = 0,
      // eastbound = -PI/2, westbound = PI/2). Without the +PI the cars
      // drive backwards — fronts toward the chase camera.
      c.mesh.rotation.y = m.axis === 'x' ? (m.dir > 0 ? -Math.PI / 2 : Math.PI / 2) : (m.dir > 0 ? Math.PI : 0);
    }
    // Scooter riders cruise the beach road and loop at the ends.
    for (const s of this.scooters) {
      s.z += s.speed * dt * s.dir;
      if (s.z > 175) { s.z = 175; s.dir = -1; s.mesh.rotation.y = 0; }
      if (s.z < -175) { s.z = -175; s.dir = 1; s.mesh.rotation.y = Math.PI; }
      s.mesh.position.z = s.z;
    }
  }

  // Claim a traffic car for the player (carjack): it stops being
  // driven by traffic — otherwise traffic.update would keep moving it
  // under the player. It stays in this.cars (still raycastable).
  claim(car) {
    const i = this.moving.findIndex((m) => m.car === car);
    if (i >= 0) this.moving.splice(i, 1);
  }

  // Nearest car (moving or parked) within maxDist of (x, z).
  nearestCar(x, z, maxDist) {
    let best = null, bestD = maxDist;
    for (const c of this.cars) {
      const dx = c.x - x, dz = c.z - z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  setDusk(d) {
    for (const c of this.cars) c.setDusk(d);
  }
}
