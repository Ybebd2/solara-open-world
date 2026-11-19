// SOLARA — cars. Every car carries halos + lampMat so the dusk checks can
// read them, and x/z/speed synced from the mesh each frame.
import * as THREE from '../vendor/three.module.min.js';
import { clamp } from './config.js';

function haloSprite(color, scale) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  grad.addColorStop(0, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.35, color);
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(scale, scale, 1);
  return s;
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export function makeCar(def) {
  const { name, color, kind = 'sedan', police = false } = def;
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.45 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.6 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8 });
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff2b0, emissiveIntensity: 0 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xaa0a0a, emissive: 0xff1a1a, emissiveIntensity: 0.2 });

  const long = kind === 'coupe' ? 4.6 : kind === 'van' ? 5.2 : kind === 'pickup' ? 4.8 : 4.4;
  const wide = kind === 'motorcycle' ? 0.8 : 2.0;
  const bodyH = kind === 'van' ? 1.5 : 0.75;

  if (kind === 'motorcycle') {
    group.add(box(0.5, 0.5, 2.2, paint, 0, 0.75, 0));
    group.add(box(0.9, 0.9, 0.7, glass, 0, 1.05, -0.2));
    // Rider.
    const rider = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.9, 0.5),
      new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.8 }));
    rider.position.set(0, 1.35, 0.25);
    group.add(rider);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.3 }));
    helm.position.set(0, 1.95, 0.2);
    group.add(helm);
  } else {
    // Wedge body: low nose, higher tail.
    const body = box(wide, bodyH, long, paint, 0, 0.62, 0);
    body.rotation.x = 0;
    group.add(body);
    const nose = box(wide * 0.94, 0.42, 1.1, paint, 0, 0.42, long / 2 + 0.35);
    group.add(nose);
    const cabin = box(wide * 0.82, 0.62, long * 0.42, glass, 0, 1.2, -long * 0.08);
    group.add(cabin);
    if (kind === 'coupe') {
      const spoiler = box(wide * 0.9, 0.09, 0.4, dark, 0, 1.02, -long / 2 - 0.1);
      group.add(spoiler);
      const skirt = box(wide * 1.02, 0.14, long * 0.9, dark, 0, 0.22, 0);
      group.add(skirt);
    }
    if (kind === 'van') {
      group.add(box(wide * 0.9, 0.9, long * 0.5, paint, 0, 1.6, -long * 0.15));
    }
    if (kind === 'pickup') {
      group.add(box(wide * 0.86, 0.5, long * 0.34, dark, 0, 0.85, -long * 0.28));
    }
  }

  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
  const wheels = [];
  const wheelPos = kind === 'motorcycle'
    ? [[0, 0.36, 0.85], [0, 0.36, -0.85]]
    : [[-wide / 2, 0.36, long / 2 - 0.8], [wide / 2, 0.36, long / 2 - 0.8],
       [-wide / 2, 0.36, -long / 2 + 0.8], [wide / 2, 0.36, -long / 2 + 0.8]];
  for (const [x, y, z] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, dark);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, y, z);
    group.add(w);
    wheels.push(w);
  }

  // Headlights: two bright white squares + halo sprites + beam pools.
  const halos = [];
  const headZ = long / 2 + 0.95;
  for (const x of [-0.62, 0.62]) {
    if (kind === 'motorcycle') break;
    const lamp = box(0.42, 0.26, 0.1, lampMat, x, 0.55, headZ - 0.4);
    group.add(lamp);
    const halo = haloSprite('rgba(255,244,190,0.8)', 2.6);
    halo.position.set(x, 0.55, headZ + 0.3);
    group.add(halo);
    halos.push(halo);
    // Beam pool on the asphalt ahead.
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 5),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0, depthWrite: false }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(x, 0.04, headZ + 3.2);
    group.add(pool);
    halos.push(pool);
  }
  // Taillight strip: full-width red, with halo.
  if (kind !== 'motorcycle') {
    const tail = box(wide * 0.92, 0.2, 0.08, tailMat, 0, 0.68, -long / 2 - 0.42);
    group.add(tail);
    const tailHalo = haloSprite('rgba(255,40,40,0.7)', 3.4);
    tailHalo.position.set(0, 0.68, -long / 2 - 0.8);
    group.add(tailHalo);
    halos.push(tailHalo);
  }

  if (police) {
    // Black hood + roof, gold side line, red roof light bar.
    const hood = box(wide * 0.96, 0.06, 1.5, dark, 0, 1.0, long / 2 - 0.6);
    group.add(hood);
    const roof = box(wide * 0.84, 0.06, long * 0.4, dark, 0, 1.53, -long * 0.08);
    group.add(roof);
    const gold = new THREE.MeshStandardMaterial({ color: 0xd8b13a, roughness: 0.4, metalness: 0.5 });
    for (const s of [-1, 1]) group.add(box(0.05, 0.12, long * 0.9, gold, s * (wide / 2 + 0.01), 0.62, 0));
    const barMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xff2020, emissiveIntensity: 1.6 });
    const bar = box(1.1, 0.22, 0.4, barMat, 0, 1.66, -long * 0.08);
    group.add(bar);
    group.userData.lightBarMat = barMat;
  }

  if (kind === 'taxi') {
    const signMat = new THREE.MeshStandardMaterial({ color: 0xffd23a, emissive: 0xffd23a, emissiveIntensity: 0.7 });
    group.add(box(0.9, 0.24, 0.5, signMat, 0, 1.62, -long * 0.08));
  }

  const car = {
    name, kind, police,
    mesh: group,
    x: 0, z: 0, angle: 0,
    speed: 0, condition: 100,
    halos, lampMat, tailMat, wheels,
    topSpeed: kind === 'coupe' ? 34 : kind === 'motorcycle' ? 30 : 26,
    accel: 14,
    updateDusk(duskT) {
      const d = clamp(duskT, 0, 1);
      lampMat.emissiveIntensity = 0.4 + d * 2.4;
      tailMat.emissiveIntensity = 0.2 + d * 1.6;
      for (const h of halos) {
        if (h.material && h.material.opacity !== undefined) h.material.opacity = d * 0.8;
      }
      if (group.userData.lightBarMat) {
        group.userData.lightBarMat.emissiveIntensity = 1.2 + d * 1.6;
      }
    },
    sync() {
      this.x = group.position.x;
      this.z = group.position.z;
    },
  };
  return car;
}
