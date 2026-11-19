// Traffic — moving cars on the beach road and cross streets, plus parked
// cars the player can steal. Traffic types: teal taxi (+yellow sign),
// boxy van, pickup with a flat black bed, RED MOTORCYCLE + rider, sedans,
// and a city bus. Cars wrap around the road ends so the street stays busy.
import { makeCar } from './vehicles.js';
import { WORLD } from './config.js';

const LANES = [-8.5, -3, 3, 8.5];

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.parked = [];
    this.build();
  }

  build() {
    // Moving traffic: a dense cluster on the beach road + cross streets.
    const moving = [
      { type: 'taxi', x: -140, z: -3, dir: 0, speed: 9 },
      { type: 'van', x: -90, z: 3, dir: Math.PI, speed: 8 },
      { type: 'pickup', x: -40, z: -8.5, dir: 0, speed: 10 },
      { type: 'motorcycle', x: 10, z: 8.5, dir: Math.PI, speed: 13 },
      { type: 'sedan', x: 60, z: -3, dir: 0, speed: 9 },
      { type: 'sedan', x: 110, z: 3, dir: Math.PI, speed: 8 },
      { type: 'bus', x: 160, z: -8.5, dir: 0, speed: 7 },
      { type: 'taxi', x: 220, z: 8.5, dir: Math.PI, speed: 9 },
      { type: 'van', x: -200, z: -3, dir: 0, speed: 8 },
      { type: 'sedan', x: 260, z: 3, dir: Math.PI, speed: 9 },
      { type: 'motorcycle', x: -260, z: 8.5, dir: 0, speed: 12 },
      { type: 'pickup', x: 290, z: -8.5, dir: Math.PI, speed: 10 },
    ];
    for (const m of moving) {
      const car = makeCar(m.type, { x: m.x, z: m.z, dir: m.dir });
      car.speed = m.speed;
      car.baseSpeed = m.speed;
      this.cars.push(car);
      this.scene.add(car.mesh);
    }
    // Parked cars (stealable). First one is the orange coupe for the
    // carjack check — it sits on Beach Road.
    const parked = [
      { type: 'coupe', name: 'VIREO GT', x: -78, z: 8, dir: 0.3 },
      { type: 'sedan', name: 'SEDAN', x: 30, z: -8, dir: -0.2 },
      { type: 'pickup', name: 'PICKUP', x: 150, z: 8, dir: 0.1 },
      { type: 'taxi', name: 'TAXI', x: -160, z: -8, dir: 0.5 },
      { type: 'van', name: 'VAN', x: 210, z: -8, dir: -0.4 },
    ];
    for (const p of parked) {
      const car = makeCar(p.type, { name: p.name, x: p.x, z: p.z, dir: p.dir });
      this.parked.push(car);
      this.scene.add(car.mesh);
    }
  }

  // Nearest parked car within range of (x, z).
  nearestParked(x, z, range = 6) {
    let best = null;
    let bd = range;
    for (const c of this.parked) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  update(dt, duskT) {
    for (const c of this.cars) {
      // Drive along the lane; wrap at the road ends.
      const fwd = c.dir === 0 ? 1 : -1;
      c.x += fwd * c.speed * dt;
      if (c.x > WORLD.maxX) c.x = WORLD.minX;
      if (c.x < WORLD.minX) c.x = WORLD.maxX;
      c.sync();
      c.update(dt, duskT);
    }
    for (const c of this.parked) c.update(dt, duskT);
  }
}
