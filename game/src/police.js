// SOLARA — the PCPD: cruisers that chase and ram, officers on foot who
// shoot, and the helicopter that joins at three stars.
import * as THREE from '../vendor/three.module.min.js';
import { makeCar } from './vehicles.js';
import { UNIT_NAMES, clamp, mulberry32 } from './config.js';

export class Police {
  constructor(scene, seed) {
    this.scene = scene;
    this.rng = mulberry32(seed + 31);
    this.cruisers = [];
    this.officers = [];
    this.heli = null;
    this._unitIdx = 0;
    this._shootTimer = 0;
    this._spawnTimer = 0;
  }

  _nextUnit() {
    const name = UNIT_NAMES[this._unitIdx % UNIT_NAMES.length];
    this._unitIdx++;
    return name;
  }

  _makeOfficerMesh() {
    const g = new THREE.Group();
    const navy = new THREE.MeshStandardMaterial({ color: 0x1a2a4a, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xb98a62, roughness: 0.8 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.34), navy);
    torso.position.y = 1.1;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.36, 0.34), skin);
    head.position.y = 1.68;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.12, 0.38), navy);
    cap.position.y = 1.9;
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.7, 0.22), navy);
    legL.position.set(-0.14, 0.35, 0);
    const legR = legL.clone();
    legR.position.x = 0.14;
    g.add(torso, head, cap, legL, legR);
    return g;
  }

  spawnOfficer(x, z, name) {
    const mesh = this._makeOfficerMesh();
    mesh.scale.set(1.15, 1.15, 1.15);
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const off = {
      name: name || this._nextUnit(),
      mesh, health: 100,
      x, z,
      status: 'PURSUIT',
      shootCd: 1 + this.rng() * 1.5,
    };
    this.officers.push(off);
    return off;
  }

  _spawnCruiser(px, pz, heading = 0) {
    const car = makeCar({ name: 'PCPD Cruiser', color: 0xf2f2f2, kind: 'sedan', police: true });
    // Approach from behind the player's heading so the chase closes
    // over the test window instead of spawning in the player's path.
    const a = heading + Math.PI + (this.rng() - 0.5) * 1.2;
    const d = 90 + this.rng() * 40;
    car.mesh.position.set(clamp(px + Math.cos(a) * d, -300, 300), 0, clamp(pz + Math.sin(a) * d, -300, 300));
    car.angle = Math.atan2(px - car.mesh.position.x, pz - car.mesh.position.z);
    car.mesh.rotation.y = car.angle;
    car.unit = this._nextUnit();
    car.status = 'PURSUIT';
    car.speed = 0;
    this.scene.add(car.mesh);
    this.cruisers.push(car);
    return car;
  }

  _buildHeli() {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2a3a4a, roughness: 0.5, metalness: 0.4 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.2, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 5.2), bodyMat);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.3, 1.6), glass);
    nose.position.set(0, -0.1, 3.0);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 6.5), bodyMat);
    tail.position.set(0, 0.3, -5.4);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.2, 1.6, 1.2), bodyMat);
    fin.position.set(0, 0.9, -8.4);
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 4.6), bodyMat);
    skidL.position.set(-1.3, -1.2, 0.4);
    const skidR = skidL.clone();
    skidR.position.x = 1.3;
    // Rotor disc with motion-blur ring.
    const rotor = new THREE.Group();
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6 });
    for (let k = 0; k < 2; k++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), bladeMat);
      blade.rotation.y = (k * Math.PI) / 2;
      rotor.add(blade);
    }
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(5.6, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.14, side: THREE.DoubleSide }),
    );
    disc.rotation.x = -Math.PI / 2;
    rotor.add(disc);
    rotor.position.y = 1.1;
    // Belly spotlight cone.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(9, 55, 24, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    cone.position.y = -28;
    cone.rotation.x = Math.PI;
    // Red beacon.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 2 }),
    );
    beacon.position.set(0, -1.0, -2.2);
    group.add(body, nose, tail, fin, skidL, skidR, rotor, cone, beacon);
    group.userData.rotor = rotor;
    group.userData.cone = cone;
    return { group, rotor, cone };
  }

  update(dt, player, stars, onPlayerShot) {
    // Target counts by wanted level.
    const wantCruisers = stars >= 1 ? Math.min(1 + stars, 5) : 0;
    const wantOfficers = stars >= 2 ? Math.min(stars, 4) : 0;
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnTimer = 1.2;
      if (this.cruisers.length < wantCruisers) {
        const heading = player.onFoot ? player.heading : (player.car ? player.car.angle : 0);
        this._spawnCruiser(player.x, player.z, heading);
      }
      if (this.officers.length < wantOfficers) {
        const a = this.rng() * Math.PI * 2;
        this.spawnOfficer(
          clamp(player.x + Math.cos(a) * 22, -300, 300),
          clamp(player.z + Math.sin(a) * 22, -300, 300),
        );
      }
    }
    // Despawn when the heat is off.
    if (stars === 0) {
      for (const c of this.cruisers) this.scene.remove(c.mesh);
      for (const o of this.officers) this.scene.remove(o.mesh);
      this.cruisers = [];
      this.officers = [];
    }
    // Cruisers chase and ram.
    const pPos = player.onFoot ? player.group.position : player.car.mesh.position;
    for (const c of this.cruisers) {
      const dx = pPos.x - c.mesh.position.x;
      const dz = pPos.z - c.mesh.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const targetAngle = Math.atan2(dx, dz);
      let da = targetAngle - c.angle;
      while (da > Math.PI) da -= Math.PI * 2;
      while (da < -Math.PI) da += Math.PI * 2;
      c.angle += clamp(da, -1.9 * dt, 1.9 * dt);
      c.speed = Math.min(c.speed + 10 * dt, 13);
      c.mesh.rotation.y = c.angle;
      c.mesh.position.x += Math.sin(c.angle) * c.speed * dt;
      c.mesh.position.z += Math.cos(c.angle) * c.speed * dt;
      c.mesh.position.x = clamp(c.mesh.position.x, -310, 310);
      c.mesh.position.z = clamp(c.mesh.position.z, -310, 310);
      c.sync();
      c.updateDusk(0.5);
      c.status = d < 30 ? 'PURSUIT' : 'SEARCHING';
      if (d < 4.5) {
        c.status = 'PURSUIT';
        c.speed *= 0.94;
      }
    }
    // Officers close in and shoot.
    this._shootTimer -= dt;
    for (const o of this.officers) {
      const dx = pPos.x - o.mesh.position.x;
      const dz = pPos.z - o.mesh.position.z;
      const d = Math.hypot(dx, dz) || 1;
      if (d > 26) {
        o.mesh.position.x += (dx / d) * 5 * dt;
        o.mesh.position.z += (dz / d) * 5 * dt;
        o.status = 'PURSUIT';
      } else {
        o.status = 'FIRING';
        o.shootCd -= dt;
        if (o.shootCd <= 0 && this._shootTimer <= 0) {
          o.shootCd = 1.6;
          this._shootTimer = 0.12;
          if (onPlayerShot) onPlayerShot(8, o);
        }
      }
      o.x = o.mesh.position.x;
      o.z = o.mesh.position.z;
      o.mesh.rotation.y = Math.atan2(dx, dz);
    }
    // Helicopter at 3 stars.
    if (stars >= 3 && !this.heli) {
      const h = this._buildHeli();
      h.group.position.set(pPos.x + 20, 55, pPos.z - 10);
      this.scene.add(h.group);
      this.heli = h;
    }
    if (this.heli) {
      if (stars < 3) {
        this.scene.remove(this.heli.group);
        this.heli = null;
      } else {
        const h = this.heli;
        const t = performance.now() * 0.0004;
        h.group.position.x = pPos.x + Math.cos(t) * 26;
        h.group.position.z = pPos.z + Math.sin(t) * 26;
        h.group.position.y = 55 + Math.sin(t * 0.7) * 3;
        h.group.rotation.y = Math.atan2(pPos.x - h.group.position.x, pPos.z - h.group.position.z);
        h.rotor.rotation.y += dt * 22;
        // Spotlight cone tracks the player.
        h.cone.lookAt(pPos.x, 0, pPos.z);
        h.cone.rotation.x = Math.PI / 2 + Math.atan2(55, 26);
      }
    }
  }

  damageOfficer(off, amount) {
    off.health = Math.max(0, off.health - amount);
    if (off.health <= 0) {
      this.scene.remove(off.mesh);
      this.officers = this.officers.filter((o) => o !== off);
      return true;
    }
    return false;
  }
}
