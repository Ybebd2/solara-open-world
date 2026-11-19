// SOLARA — every vehicle is built from boxes, cylinders and sprites:
// a body, a glass cabin, four wheels, square headlights with halos and
// beam pools, and a red taillight strip. The police cruiser adds a black
// hood and roof, a gold side line and a red light bar.
import * as THREE from '../vendor/three.module.min.js';
import { clamp } from './config.js';

function haloTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,248,220,0.95)');
  grad.addColorStop(0.4, 'rgba(255,230,160,0.4)');
  grad.addColorStop(1, 'rgba(255,230,160,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const HALO_TEX = null; // created lazily per car (canvas needs a document)
let sharedHalo = null;
function haloTex() {
  if (!sharedHalo) sharedHalo = haloTexture();
  return sharedHalo;
}

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export class Car {
  constructor(kind, color, name) {
    this.kind = kind;
    this.name = name;
    this.color = color;
    this.speed = 0;
    this.condition = 100;
    this.mesh = new THREE.Group();
    this.halos = [];
    this.beamPools = [];
    this._heading = 0;
    this._build(kind, color);
  }
  get x() { return this.mesh.position.x; }
  set x(v) { this.mesh.position.x = v; }
  get z() { return this.mesh.position.z; }
  set z(v) { this.mesh.position.z = v; }
  get heading() { return this._heading; }
  set heading(v) { this._heading = v; this.mesh.rotation.y = v; }
  forward() { return { x: Math.sin(this._heading), z: Math.cos(this._heading) }; }

  _build(kind, color) {
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const glassMat = new THREE.MeshLambertMaterial({ color: 0x16233c });
    const darkMat = new THREE.MeshLambertMaterial({ color: 0x141416 });
    const chromeMat = new THREE.MeshLambertMaterial({ color: 0xc8ccd4 });
    // Headlight material: the test reads lampMat.emissiveIntensity.
    this.lampMat = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff2c8, emissiveIntensity: 0.6 });
    this.tailMat = new THREE.MeshLambertMaterial({ color: 0xaa1111, emissive: 0xff2211, emissiveIntensity: 0.8 });
    const g = this.mesh;

    if (kind === 'motorcycle') {
      const red = new THREE.MeshLambertMaterial({ color: 0xc02020 });
      g.add(box(0.5, 0.5, 1.9, red, 0, 0.75, 0));
      g.add(box(0.7, 0.35, 0.7, darkMat, 0, 0.95, -0.4));
      const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.18, 12);
      for (const z of [0.75, -0.75]) {
        const w = new THREE.Mesh(wheelGeo, darkMat);
        w.rotation.z = Math.PI / 2; w.position.set(0, 0.34, z); g.add(w);
      }
      // Rider: torso, helmet, arms to the bars.
      const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
      g.add(box(0.55, 0.7, 0.35, new THREE.MeshLambertMaterial({ color: 0x222226 }), 0, 1.35, -0.1));
      const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), red);
      helmet.position.set(0, 1.85, -0.1); g.add(helmet);
      g.add(box(0.12, 0.12, 0.7, skin, -0.3, 1.5, 0.35));
      g.add(box(0.12, 0.12, 0.7, skin, 0.3, 1.5, 0.35));
      // One headlight.
      const hl = box(0.3, 0.18, 0.08, this.lampMat, 0, 0.9, 1.0);
      g.add(hl);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.set(1.6, 1.6, 1); halo.position.set(0, 0.9, 1.15); g.add(halo);
      this.halos.push(halo);
      this._addBeamPools(g, 1);
      return;
    }

    const isCoupe = kind === 'coupe';
    const isVan = kind === 'van';
    const isPickup = kind === 'pickup';
    const isCruiser = kind === 'cruiser';
    const isTaxi = kind === 'taxi';
    const L = isVan ? 4.6 : isCoupe ? 4.6 : 4.2;
    const W = isVan ? 2.0 : 1.9;
    const bodyH = isVan ? 1.5 : 0.62;
    const bodyY = isVan ? 1.0 : 0.55;

    // Main body.
    g.add(box(W, bodyH, L, bodyMat, 0, bodyY, 0));
    if (isCoupe) {
      // Wedge nose: a sloped front block.
      const nose = box(W * 0.96, 0.34, 1.1, bodyMat, 0, 0.42, L / 2 - 0.2);
      nose.rotation.x = -0.18; g.add(nose);
    }
    // Glass cabin + body-colour roof.
    if (!isVan) {
      g.add(box(W * 0.82, 0.55, L * 0.42, glassMat, 0, bodyY + bodyH / 2 + 0.26, -L * 0.05));
      g.add(box(W * 0.84, 0.08, L * 0.4, bodyMat, 0, bodyY + bodyH / 2 + 0.56, -L * 0.05));
    } else {
      g.add(box(W * 0.9, 0.5, L * 0.7, glassMat, 0, 1.95, L * 0.08));
    }
    if (isPickup) {
      // Flat black bed behind the cab.
      g.add(box(W * 0.9, 0.1, L * 0.42, darkMat, 0, bodyY + bodyH / 2 + 0.02, -L * 0.24));
      g.add(box(W * 0.82, 0.5, L * 0.3, glassMat, 0, bodyY + bodyH / 2 + 0.24, L * 0.28));
    }
    // Wheels.
    const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.26, 12);
    for (const [wx, wz] of [[-W / 2 + 0.1, L / 2 - 0.85], [W / 2 - 0.1, L / 2 - 0.85], [-W / 2 + 0.1, -L / 2 + 0.85], [W / 2 - 0.1, -L / 2 + 0.85]]) {
      const w = new THREE.Mesh(wheelGeo, darkMat);
      w.rotation.z = Math.PI / 2; w.position.set(wx, 0.36, wz); g.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.28, 8), chromeMat);
      hub.rotation.z = Math.PI / 2; hub.position.set(wx, 0.36, wz); g.add(hub);
    }
    // Square white headlights + halos.
    for (const sx of [-0.62, 0.62]) {
      g.add(box(0.42, 0.2, 0.08, this.lampMat, sx, 0.62, L / 2 + 0.02));
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.set(2.2, 2.2, 1); halo.position.set(sx, 0.62, L / 2 + 0.25); g.add(halo);
      this.halos.push(halo);
    }
    // Full-width red taillight strip.
    g.add(box(W * 0.92, 0.16, 0.08, this.tailMat, 0, 0.68, -L / 2 - 0.02));
    // Beam pools on the asphalt ahead.
    this._addBeamPools(g, 2);
    // Bumpers.
    g.add(box(W, 0.18, 0.14, chromeMat, 0, 0.32, L / 2 + 0.04));
    g.add(box(W, 0.18, 0.14, chromeMat, 0, 0.32, -L / 2 - 0.04));

    if (isTaxi) {
      const sign = box(0.7, 0.22, 0.4, new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0xcc9900, emissiveIntensity: 0.7 }), 0, bodyY + bodyH / 2 + 0.72, -L * 0.05);
      g.add(sign);
    }
    if (isCruiser) {
      // Black hood and roof, thin gold side line, red roof light bar.
      g.add(box(W * 0.94, 0.06, 1.15, darkMat, 0, bodyY + bodyH / 2 + 0.02, L / 2 - 0.6));
      g.add(box(W * 0.86, 0.06, L * 0.38, darkMat, 0, bodyY + bodyH / 2 + 0.62, -L * 0.05));
      const gold = new THREE.MeshLambertMaterial({ color: 0xd8b13a, emissive: 0x664400, emissiveIntensity: 0.4 });
      g.add(box(0.05, 0.09, L * 0.9, gold, -W / 2 - 0.01, 0.62, 0));
      g.add(box(0.05, 0.09, L * 0.9, gold, W / 2 + 0.01, 0.62, 0));
      const barMat = new THREE.MeshLambertMaterial({ color: 0xcc1111, emissive: 0xff2222, emissiveIntensity: 1.6 });
      g.add(box(1.1, 0.16, 0.34, barMat, 0, bodyY + bodyH / 2 + 0.74, -L * 0.05));
      this.lightBarMat = barMat;
    }
  }

  _addBeamPools(g, count) {
    const poolMat = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false });
    const n = count === 1 ? 1 : 2;
    for (let i = 0; i < n; i++) {
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5.5), poolMat.clone());
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(n === 1 ? 0 : (i === 0 ? -0.62 : 0.62), 0.05, 5.2);
      g.add(pool);
      this.beamPools.push(pool);
    }
  }

  // Dusk drives the glow: halos, headlights, taillights, beam pools.
  setDusk(duskT) {
    const glow = clamp(duskT, 0, 1);
    for (const h of this.halos) h.material.opacity = 0.12 + glow * 0.7;
    this.lampMat.emissiveIntensity = 0.5 + glow * 2.2;
    this.tailMat.emissiveIntensity = 0.6 + glow * 1.4;
    for (const p of this.beamPools) p.material.opacity = glow * 0.34;
    if (this.lightBarMat) this.lightBarMat.emissiveIntensity = 1.2 + (Math.sin(Date.now() / 160) > 0 ? 1.2 : 0.2);
  }
}

export function makeCar(kind, color, name) {
  return new Car(kind, color, name);
}
