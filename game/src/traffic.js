// SOLARA — traffic: cars cruising the road grid, parked cars to steal,
// pedestrians on the sidewalks who flee a carjack.
import * as THREE from '../vendor/three.module.min.js';
import { makeCar } from './vehicles.js';
import { WORLD, mulberry32, clamp } from './config.js';

const TRAFFIC_DEFS = [
  { name: 'Sol Cab', kind: 'taxi', color: 0x2fa8a0 },
  { name: 'Vireo GT', kind: 'coupe', color: 0xe86a1a },
  { name: 'Bruto', kind: 'sedan', color: 0x3a6fd8 },
  { name: 'Comet RS', kind: 'coupe', color: 0xd8202a },
  { name: 'Tortuga 4x4', kind: 'van', color: 0x4a7a5a },
  { name: 'Pico', kind: 'pickup', color: 0x2fa8a0 },
  { name: 'Lumen', kind: 'sedan', color: 0xc02020 },
  { name: 'Veloce', kind: 'sedan', color: 0x2244aa },
];

const PED_COLORS = [0xe8c93a, 0xc02020, 0x2a7ad8, 0x7a4ad8, 0x3a9e5f, 0xe87a2a];

export class Traffic {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = mulberry32(seed + 7);
    this.cars = [];     // moving traffic
    this.parked = [];   // stealable parked cars
    this.peds = [];
    this._build();
  }

  _build() {
    const rng = this.rng;
    // Moving traffic on the grid roads.
    for (let i = 0; i < 14; i++) {
      const def = TRAFFIC_DEFS[i % TRAFFIC_DEFS.length];
      const car = makeCar(def);
      const vertical = rng() < 0.5;
      const lane = (Math.floor(rng() * 9) - 4) * WORLD.block;
      const along = -300 + rng() * 600;
      car.mesh.position.set(vertical ? lane + (rng() < 0.5 ? 3.6 : -3.6) : along, 0, vertical ? along : lane + (rng() < 0.5 ? 3.6 : -3.6));
      car.angle = vertical ? (rng() < 0.5 ? 0 : Math.PI) : (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      car.mesh.rotation.y = car.angle;
      car.speed = 7 + rng() * 6;
      car.dir = vertical ? Math.sign(Math.cos(car.angle)) : Math.sign(Math.sin(car.angle));
      car.vertical = vertical;
      car.lane = lane;
      this.scene.add(car.mesh);
      this.cars.push(car);
    }
    // Parked cars along the beach road and downtown.
    const spots = [
      { x: 196, z: -40, a: Math.PI / 2 }, { x: 196, z: 30, a: Math.PI / 2 },
      { x: -70, z: 10, a: 0 }, { x: 70, z: -70, a: Math.PI },
      { x: -130, z: 70, a: Math.PI / 2 }, { x: 130, z: 130, a: 0 },
      { x: 10, z: 130, a: Math.PI }, { x: -190, z: -30, a: Math.PI / 2 },
    ];
    spots.forEach((s, i) => {
      const def = TRAFFIC_DEFS[(i + 2) % TRAFFIC_DEFS.length];
      const car = makeCar(def);
      car.mesh.position.set(s.x, 0, s.z);
      car.mesh.rotation.y = s.a;
      car.angle = s.a;
      car.sync();
      this.scene.add(car.mesh);
      this.parked.push(car);
    });
    // Pedestrians.
    for (let i = 0; i < 12; i++) {
      const ped = this._makePed(PED_COLORS[i % PED_COLORS.length]);
      ped.group.position.set(-260 + rng() * 480, 0, -280 + rng() * 560);
      ped.home = ped.group.position.clone();
      ped.flee = 0;
      this.scene.add(ped.group);
      this.peds.push(ped);
    }
  }

  _makePed(shirtColor) {
    const g = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98a5e, roughness: 0.8 });
    const shirt = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.9 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.7, 0.32), shirt);
    torso.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skin);
    head.position.y = 1.62;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), pants);
    legL.position.set(-0.14, 0.35, 0);
    const legR = legL.clone();
    legR.position.x = 0.14;
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.6, 0.18), shirt);
    armL.position.set(-0.36, 1.05, 0);
    const armR = armL.clone();
    armR.position.x = 0.36;
    g.add(torso, head, legL, legR, armL, armR);
    return { group: g, legL, legR, armL, armR, phase: Math.random() * 6, walkSpeed: 0 };
  }

  update(dt, duskT, playerPos, time) {
    // Moving traffic follows its lane; wraps at the city edge.
    for (const c of this.cars) {
      const step = c.speed * dt;
      if (c.vertical) {
        c.mesh.position.z += step * Math.cos(c.angle);
        if (c.mesh.position.z > 310) c.mesh.position.z = -310;
        if (c.mesh.position.z < -310) c.mesh.position.z = 310;
      } else {
        c.mesh.position.x += step * Math.sin(c.angle);
        if (c.mesh.position.x > 310) c.mesh.position.x = -310;
        if (c.mesh.position.x < -310) c.mesh.position.x = 310;
      }
      c.sync();
      c.updateDusk(duskT);
      // Wheels spin.
      for (const w of c.wheels) w.rotation.x += (c.speed * dt) / 0.36;
    }
    for (const c of this.parked) c.updateDusk(duskT);
    // Peds stroll, and flee with arms out when the player carjacks nearby.
    for (const p of this.peds) {
      const d = Math.hypot(p.group.position.x - playerPos.x, p.group.position.z - playerPos.z);
      if (d < 14 && p.flee <= 0) p.flee = 3;
      if (p.flee > 0) {
        p.flee -= dt;
        p.group.position.x += (p.group.position.x - playerPos.x) / Math.max(d, 1) * 4 * dt;
        p.group.position.z += (p.group.position.z - playerPos.z) / Math.max(d, 1) * 4 * dt;
        p.armL.rotation.z = 1.4;
        p.armR.rotation.z = -1.4;
        p.walkSpeed = 8;
      } else {
        p.armL.rotation.z = 0;
        p.armR.rotation.z = 0;
        p.walkSpeed = 1.2;
        p.group.position.x = p.home.x + Math.sin(time * 0.12 + p.phase) * 6;
        p.group.position.z = p.home.z + Math.cos(time * 0.09 + p.phase) * 6;
        p.group.rotation.y = Math.atan2(Math.cos(time * 0.12 + p.phase) * 0.72, Math.cos(time * 0.09 + p.phase) * 0.54);
      }
      const swing = Math.sin(time * p.walkSpeed + p.phase) * 0.5;
      p.legL.rotation.x = swing;
      p.legR.rotation.x = -swing;
      p.group.position.x = clamp(p.group.position.x, -315, 315);
      p.group.position.z = clamp(p.group.position.z, -315, 315);
    }
  }
}
