// Vehicles — every car is built from boxes: a low wedge coupe, sedans, a
// teal taxi with a yellow roof sign, a boxy van, a pickup with a flat black
// bed, a red motorcycle with rider, a city bus, and the white PCPD cruiser
// (black hood/roof, gold side line, red light bar). Headlights are bright
// white squares with halo sprites; taillights are a red strip with halo.
// Each car carries halos[] and lampMat so dusk can light them up.
import * as THREE from '../vendor/three.module.min.js';

function lam(color, opts = {}) {
  return new THREE.MeshLambertMaterial({ color, ...opts });
}
function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  return m;
}

const SPECS = {
  coupe: { name: 'VIREO GT', body: 0xe86a1f, w: 4.6, l: 2.1, h: 0.75, cabin: 0x1a1a2e, wheel: 0.42 },
  sedan: { name: 'SEDAN', body: 0x5b7fa6, w: 4.2, l: 1.9, h: 0.8, cabin: 0x222222, wheel: 0.4 },
  taxi: { name: 'TAXI', body: 0x2a9d8f, w: 4.2, l: 1.9, h: 0.8, cabin: 0x222222, wheel: 0.4 },
  van: { name: 'VAN', body: 0xc9a227, w: 4.6, l: 2.2, h: 1.5, cabin: 0x333333, wheel: 0.42 },
  pickup: { name: 'PICKUP', body: 0x2e8b8b, w: 4.4, l: 2.0, h: 0.85, cabin: 0x222222, wheel: 0.42 },
  bus: { name: 'CITY BUS', body: 0x3a6ea5, w: 9.0, l: 2.5, h: 2.2, cabin: 0x1a2a3a, wheel: 0.5 },
  cruiser: { name: 'PCPD CRUISER', body: 0xf5f5f0, w: 4.4, l: 2.0, h: 0.8, cabin: 0x111111, wheel: 0.42 },
  motorcycle: { name: 'MOTO', body: 0xe63946, w: 2.0, l: 0.7, h: 0.6, cabin: 0x222222, wheel: 0.34 },
};

export function makeCar(type, opts = {}) {
  const spec = SPECS[type] || SPECS.sedan;
  const g = new THREE.Group();
  const halos = [];
  // Shared lamp material: emissive intensity rises at dusk.
  const lampMat = new THREE.MeshStandardMaterial({
    color: 0xfff6d8, emissive: 0xffe9a8, emissiveIntensity: 0.4,
  });

  if (type === 'motorcycle') {
    // Red bike + rider, leaning slightly.
    const bike = box(0.5, 0.7, 1.9, lam(spec.body));
    bike.position.y = 0.55;
    g.add(bike);
    const seat = box(0.45, 0.25, 0.8, lam(0x111111));
    seat.position.set(0, 0.95, -0.3);
    g.add(seat);
    const rider = new THREE.Group();
    const torso = box(0.55, 0.7, 0.4, lam(0xe63946));
    torso.position.y = 1.35;
    rider.add(torso);
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), lam(0xe63946));
    helmet.position.y = 1.9;
    rider.add(helmet);
    const leg = box(0.2, 0.7, 0.2, lam(0x222222));
    leg.position.set(0.2, 0.9, 0.25);
    rider.add(leg);
    const leg2 = leg.clone();
    leg2.position.x = -0.2;
    rider.add(leg2);
    g.add(rider);
    for (const dz of [-1.0, 1.0]) {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.18, 10), lam(0x111111));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(0, 0.34, dz);
      g.add(wheel);
    }
    const head = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), lampMat);
    head.position.set(0, 0.7, 1.02);
    g.add(head);
    const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    tail.position.set(0, 0.7, -1.02);
    tail.rotation.y = Math.PI;
    g.add(tail);
  } else {
    // Body + cabin + wheels.
    const body = box(spec.w, spec.h, spec.l, lam(spec.body));
    body.position.y = 0.55 + spec.h / 2;
    g.add(body);
    if (type !== 'bus') {
      const cab = box(spec.w * 0.5, 0.55, spec.l * 0.85, lam(spec.cabin));
      cab.position.set(-spec.w * 0.05, 0.55 + spec.h + 0.27, 0);
      g.add(cab);
    } else {
      // Bus: tall windows band.
      const band = box(spec.w * 0.92, 0.9, spec.l + 0.06, lam(0xbfd9e8));
      band.position.set(0, 1.9, 0);
      g.add(band);
    }
    if (type === 'pickup') {
      // Flat black bed behind the cab.
      const bed = box(spec.w * 0.42, 0.28, spec.l * 0.9, lam(0x111111));
      bed.position.set(spec.w * 0.26, 0.55 + spec.h + 0.1, 0);
      g.add(bed);
    }
    if (type === 'taxi') {
      // Yellow taxi sign on the roof.
      const sign = box(0.9, 0.3, 0.5, lam(0xffd700));
      sign.position.set(0, 0.55 + spec.h + 0.7, 0);
      g.add(sign);
    }
    if (type === 'cruiser') {
      // Black hood + roof, thin gold side line, red light bar.
      const hood = box(spec.w * 0.28, 0.12, spec.l * 0.96, lam(0x111111));
      hood.position.set(spec.w * 0.36, 0.55 + spec.h + 0.06, 0);
      g.add(hood);
      const roof = box(spec.w * 0.3, 0.1, spec.l * 0.9, lam(0x111111));
      roof.position.set(-spec.w * 0.05, 0.55 + spec.h + 0.6, 0);
      g.add(roof);
      const gold = box(spec.w * 0.9, 0.08, 0.04, lam(0xffd700));
      gold.position.set(0, 0.75, spec.l / 2 + 0.01);
      g.add(gold);
      const gold2 = gold.clone();
      gold2.position.z = -spec.l / 2 - 0.01;
      g.add(gold2);
      const bar = box(0.5, 0.22, 1.1, new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      bar.position.set(-spec.w * 0.05, 0.55 + spec.h + 0.75, 0);
      g.add(bar);
      const barHalo = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.15, depthWrite: false })
      );
      barHalo.position.copy(bar.position);
      g.add(barHalo);
      halos.push(barHalo);
    }
    // Wheels.
    const wheelGeo = new THREE.CylinderGeometry(spec.wheel, spec.wheel, 0.3, 10);
    const wheelMat = lam(0x111111);
    const wx = spec.w / 2 - 0.7;
    const wz = spec.l / 2 - 0.15;
    for (const [dx, dz] of [[-wx, -wz], [wx, -wz], [-wx, wz], [wx, wz]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.x = Math.PI / 2;
      wheel.position.set(dx, spec.wheel, dz);
      g.add(wheel);
    }
    // Headlights: two bright white squares + halo pools on the road.
    for (const dz of [-spec.l / 2 + 0.28, spec.l / 2 - 0.28]) {
      const hl = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), lampMat);
      hl.position.set(spec.w / 2 + 0.02, 0.85, dz);
      hl.rotation.y = Math.PI / 2;
      g.add(hl);
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(0.9, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0.1, depthWrite: false })
      );
      halo.position.set(spec.w / 2 + 1.2, 0.7, dz);
      halo.scale.set(1.4, 0.6, 1);
      g.add(halo);
      halos.push(halo);
    }
    // Taillights: red strip + halo.
    const tail = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, spec.l * 0.8),
      new THREE.MeshBasicMaterial({ color: 0xff2222 })
    );
    tail.position.set(-spec.w / 2 - 0.02, 0.9, 0);
    tail.rotation.y = -Math.PI / 2;
    g.add(tail);
    const tailHalo = new THREE.Mesh(
      new THREE.SphereGeometry(0.8, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xff4444, transparent: true, opacity: 0.12, depthWrite: false })
    );
    tailHalo.position.set(-spec.w / 2 - 0.9, 0.85, 0);
    tailHalo.scale.set(1.2, 0.6, 1.6);
    g.add(tailHalo);
    halos.push(tailHalo);
  }

  const car = {
    type, name: opts.name || spec.name, mesh: g,
    x: opts.x || 0, z: opts.z || 0, dir: opts.dir || 0,
    speed: 0, topSpeed: opts.topSpeed || 16, accel: 12,
    halos, lampMat, condition: 100,
    update(dt, duskT) {
      const glow = Math.max(0, Math.min(1, duskT));
      for (const h of this.halos) h.material.opacity = 0.08 + glow * 0.5;
      this.lampMat.emissiveIntensity = 0.35 + glow * 2.2;
    },
    sync() {
      this.mesh.position.set(this.x, 0, this.z);
      this.mesh.rotation.y = this.dir;
    },
  };
  car.sync();
  return car;
}
