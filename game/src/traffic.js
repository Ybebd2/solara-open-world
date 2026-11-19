// SOLARA — traffic: the cars that stream along the roads, the parked cars
// Kai can steal, and the pedestrians on the sidewalks (one of whom flees,
// arms out, when a carjack happens in front of them).
import * as THREE from '../vendor/three.module.min.js';
import { WORLD, mulberry32, clamp } from './config.js';
import { makeCar } from './vehicles.js';

const TRAFFIC_KINDS = [
  { kind: 'sedan', color: 0x2a5db0, name: 'Meridian' },
  { kind: 'sedan', color: 0xc03028, name: 'Comet' },
  { kind: 'sedan', color: 0xe8e8e8, name: 'Alba' },
  { kind: 'sedan', color: 0x3a3a40, name: 'Nocturne' },
  { kind: 'taxi', color: 0x2a9d8f, name: 'Taxi' },
  { kind: 'van', color: 0xd8d8d8, name: 'Box Van' },
  { kind: 'pickup', color: 0x2a9d8f, name: 'Flatbed' },
  { kind: 'motorcycle', color: 0xc02020, name: 'Red Bike' },
  { kind: 'coupe', color: 0xe86a1c, name: 'Fathom' },
];

const PARKED_SPOTS = [
  { x: -246, z: 40, heading: Math.PI, kind: 'sedan', color: 0x8a8f96, name: 'Bruto' },
  { x: -254, z: -60, heading: 0, kind: 'sedan', color: 0x2a5db0, name: 'Meridian' },
  { x: -246, z: 120, heading: Math.PI, kind: 'coupe', color: 0xe86a1c, name: 'Fathom' },
  { x: -166, z: -20, heading: Math.PI / 2, kind: 'sedan', color: 0xc03028, name: 'Comet' },
  { x: -86, z: 60, heading: -Math.PI / 2, kind: 'van', color: 0xd8d8d8, name: 'Box Van' },
  { x: -6, z: -100, heading: Math.PI / 2, kind: 'pickup', color: 0x2a9d8f, name: 'Flatbed' },
  { x: 74, z: 30, heading: -Math.PI / 2, kind: 'sedan', color: 0xe8e8e8, name: 'Alba' },
  { x: 154, z: -40, heading: Math.PI / 2, kind: 'sedan', color: 0x3a3a40, name: 'Nocturne' },
  { x: -246, z: -140, heading: 0, kind: 'taxi', color: 0x2a9d8f, name: 'Taxi' },
  { x: -94, z: 140, heading: -Math.PI / 2, kind: 'sedan', color: 0x8a8f96, name: 'Bruto' },
];

class Ped {
  constructor(scene, x, z) {
    this.group = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
    const shirt = new THREE.MeshLambertMaterial({ color: 0x4a7ab0 });
    const pants = new THREE.MeshLambertMaterial({ color: 0x2a2a30 });
    const mk = (w, h, d, mat, px, py, pz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(px, py, pz); this.group.add(m); return m;
    };
    mk(0.22, 0.75, 0.22, pants, -0.14, 0.38, 0);
    mk(0.22, 0.75, 0.22, pants, 0.14, 0.38, 0);
    mk(0.62, 0.7, 0.34, shirt, 0, 1.1, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
    head.position.set(0, 1.68, 0); this.group.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), new THREE.MeshLambertMaterial({ color: 0x2a1a10 }));
    hair.position.set(0, 1.76, -0.03); hair.scale.set(1, 0.7, 1); this.group.add(hair);
    this.armL = mk(0.16, 0.62, 0.16, skin, -0.4, 1.15, 0);
    this.armR = mk(0.16, 0.62, 0.16, skin, 0.4, 1.15, 0);
    this.group.position.set(x, 0, z);
    this.heading = 0;
    this.speed = 1.2;
    this.fleeing = false;
    scene.add(this.group);
  }
  setFlee(on) {
    this.fleeing = on;
    this.armL.rotation.z = on ? 1.25 : 0;
    this.armR.rotation.z = on ? -1.25 : 0;
  }
}

export class Traffic {
  constructor(G) {
    this.G = G;
    this.cars = [];
    this.parked = [];
    this.peds = [];
    this.frozen = false;
    const rng = mulberry32(11);
    // Moving traffic on the grid.
    const roads = [];
    for (const z of WORLD.crossZ) { roads.push({ alongX: true, at: z }); roads.push({ alongX: true, at: z }); }
    for (const x of WORLD.northX) roads.push({ alongX: false, at: x });
    roads.push({ alongX: false, at: WORLD.beachRoadX });
    for (let i = 0; i < 14; i++) {
      const r = roads[i % roads.length];
      const spec = TRAFFIC_KINDS[Math.floor(rng() * TRAFFIC_KINDS.length)];
      const car = makeCar(spec.kind, spec.color, spec.name);
      const dir = rng() < 0.5 ? 1 : -1;
      const lane = (rng() < 0.5 ? -3.4 : 3.4);
      if (r.alongX) {
        car.x = -240 + rng() * 480;
        car.z = r.at + lane * dir;
        car.heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.x = r.at + lane * dir;
        car.z = -240 + rng() * 480;
        car.heading = dir > 0 ? 0 : Math.PI;
      }
      car.speed = 8 + rng() * 6;
      car._road = r; car._dir = dir; car._lane = lane;
      car.mesh.position.y = 0;
      G.scene.add(car.mesh);
      this.cars.push(car);
    }
    // Parked cars.
    for (const s of PARKED_SPOTS) {
      const car = makeCar(s.kind, s.color, s.name);
      car.x = s.x; car.z = s.z; car.heading = s.heading; car.speed = 0;
      G.scene.add(car.mesh);
      this.parked.push(car);
    }
    // Pedestrians on the sidewalks.
    const pedSpots = [[-240, -40], [-240, 60], [-160, 20], [-80, -30], [60, 100], [140, -60], [-240, 160], [10, -140]];
    for (const [x, z] of pedSpots) this.peds.push(new Ped(G.scene, x, z));
  }

  nearestParked(x, z, maxD) {
    let best = null, bd = maxD;
    for (const c of this.parked) {
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // The closest pedestrian to (x, z) starts fleeing, arms out.
  scarePed(x, z) {
    let best = null, bd = 30;
    for (const p of this.peds) {
      const d = Math.hypot(p.group.position.x - x, p.group.position.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    if (best) {
      best.setFlee(true);
      const dx = best.group.position.x - x, dz = best.group.position.z - z;
      best.heading = Math.atan2(dx, dz);
    }
  }

  setDusk(duskT) {
    for (const c of this.cars) c.setDusk(duskT);
    for (const c of this.parked) c.setDusk(duskT);
  }

  update(dt) {
    if (this.frozen) return;
    const B = WORLD.cityHalf;
    for (const c of this.cars) {
      const f = c.forward();
      c.x += f.x * c.speed * dt;
      c.z += f.z * c.speed * dt;
      if (c.x > B) c.x = -B; if (c.x < -B) c.x = B;
      if (c.z > B) c.z = -B; if (c.z < -B) c.z = B;
    }
    for (const p of this.peds) {
      const sp = p.fleeing ? 3.4 : p.speed;
      p.group.position.x += Math.sin(p.heading) * sp * dt;
      p.group.position.z += Math.cos(p.heading) * sp * dt;
      p.group.rotation.y = p.heading;
      p.group.position.x = clamp(p.group.position.x, -B, B);
      p.group.position.z = clamp(p.group.position.z, -B, B);
      if (!p.fleeing && Math.random() < dt * 0.02) p.heading = Math.random() * Math.PI * 2;
    }
  }
}
