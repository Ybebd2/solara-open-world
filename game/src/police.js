// SOLARA — police: cruiser chase/ram AI, officers on foot, helicopter
// with spotlight at 3+ stars. Built fresh for the @witty-meteor-32 build.
import * as THREE from '../vendor/three.module.min.js';
import { Car } from './vehicles.js';
import { PCPD_UNITS, PCPD_AIR, clamp, dist2d, rand } from './config.js';

export class Police {
  constructor(scene) {
    this.scene = scene;
    this.cruisers = [];   // Car (police type)
    this.officers = [];   // { mesh, health, name }
    this.heli = null;     // { group, cone, pool }
    this.heliDisc = null;
    this.airDeployed = false; // true while the heli is up (3+ stars)
    this.unitNames = PCPD_UNITS;
    this.sirenPhase = 0;
    // Staged unit rows for a screenshot: when set, the PCPD panel shows
    // exactly these rows (name/dist/status) instead of the live list.
    // Shot mode only — live play always computes real units.
    this.stagedUnits = null;
  }

  // Remove every police unit (cruisers, officers, heli) and clear staged
  // rows — shot mode starts from a clean slate.
  removeAll() {
    for (const c of this.cruisers) this.scene.remove(c.mesh);
    this.cruisers = [];
    for (const o of this.officers) this.scene.remove(o.mesh);
    this.officers = [];
    this.removeHeli();
    this.stagedUnits = null;
  }

  spawnCruiser(x, z) {
    const c = new Car('police', x, z, 0);
    this.scene.add(c.mesh);
    this.cruisers.push(c);
    return c;
  }

  // Cruiser at an exact pose: heading set, mesh rotated, lights on.
  spawnCruiserAt(x, z, heading) {
    const c = this.spawnCruiser(x, z);
    c.heading = heading;
    c.mesh.rotation.y = heading + Math.PI;
    c.setDusk(1);
    return c;
  }

  spawnOfficer(x, z, name) {
    const g = new THREE.Group();
    const uni = new THREE.MeshStandardMaterial({ color: 0x1c2a44, roughness: 0.85 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc99a72, roughness: 0.7 });
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.8, 0.34), uni);
    torso.position.y = 1.05; torso.castShadow = true; g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 10, 8), skin);
    head.position.y = 1.68; g.add(head);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.1, 10), uni);
    cap.position.y = 1.86; g.add(cap);
    for (const lx of [-0.15, 0.15]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.72, 0.26), uni);
      leg.position.set(lx, 0.36, 0); g.add(leg);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
    const off = { mesh: g, health: 100, name: name || 'OFFICER' };
    this.officers.push(off);
    return off;
  }

  spawnHeli() {
    if (this.heli) return this.heli;
    this.airDeployed = true;
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x22242c, roughness: 0.5, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.4, 5.2), bodyMat);
    body.castShadow = true; g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0x88bbdd, roughness: 0.15, metalness: 0.6 }));
    glass.position.set(0, 0.2, -2.2); g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 4.4), bodyMat);
    tail.position.set(0, 0.3, 4.2); g.add(tail);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    rotor.position.y = 1.1; g.add(rotor);
    this.heliRotor = rotor;
    // Rotor disc: a translucent blurred ring so the spinning rotor reads
    // as a disc in motion, not a single thin bar.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(5.5, 24),
      new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
    );
    disc.rotation.x = -Math.PI / 2; disc.position.y = 1.12; g.add(disc);
    this.heliDisc = disc;
    const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111 }));
    tailRotor.position.set(0.45, 0.4, 6.2); g.add(tailRotor);
    // Landing skids: two rails under the body on short struts.
    const skidMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6, metalness: 0.5 });
    for (const sx of [-0.9, 0.9]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 4.6), skidMat);
      rail.position.set(sx, -1.0, 0); g.add(rail);
      for (const sz of [-1.4, 1.4]) {
        const strut = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.1), skidMat);
        strut.position.set(sx, -0.75, sz); g.add(strut);
      }
    }
    // Spotlight cone + ground pool, sized for the default hover (30 m)
    // by setHeliSpot — call it again after moving the heli lower.
    const coneGeo = new THREE.ConeGeometry(7, 30, 16, 1, true);
    const coneMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = -15; cone.rotation.x = Math.PI; g.add(cone);
    const pool = new THREE.Mesh(
      new THREE.CircleGeometry(7, 20),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.3, depthWrite: false })
    );
    pool.rotation.x = -Math.PI / 2; pool.position.y = -29.5; g.add(pool);
    g.position.set(0, 30, 0);
    this.scene.add(g);
    this.heli = { group: g, cone, pool, spotAlt: 30 };
    return this.heli;
  }

  // Heli at an exact hover pose (shot 4): position set, spotlight
  // resized for the low hover by the caller via setHeliSpot.
  spawnHeliAt(x, y, z) {
    const h = this.spawnHeli();
    h.group.position.set(x, y, z);
    return h;
  }
  // the cone runs belly-to-ground and the pool is ~3 car-widths across
  // (radius 3 m) — a readable lit ellipse, never a white washout.
  setHeliSpot(alt) {
    if (!this.heli) return;
    const { cone, pool } = this.heli;
    cone.scale.set(3 / 7, alt / 30, 3 / 7);
    cone.position.y = -alt / 2;
    pool.scale.set(3 / 7, 3 / 7, 1);
    pool.position.y = -alt + 0.06;
    this.heli.spotAlt = alt;
  }

  removeHeli() {
    if (!this.heli) return;
    this.scene.remove(this.heli.group);
    this.heli = null;
    this.airDeployed = false;
  }

  // Officer standing still at an exact spot (shot mode — the live
  // update() would chase the player, but shots freeze the loop).
  spawnOfficerAt(x, z) {
    return this.spawnOfficer(x, z, 'OFFICER');
  }

  // Chase: cruisers steer at the player and ram; officers chase on foot.
  // Returns the closest cruiser distance (for HUD / evading).
  update(dt, px, pz, stars, playerSpeed) {
    // Spawn cruisers up to the wanted level (at least 1 while wanted).
    const want = stars > 0 ? Math.min(stars, 4) : 0;
    while (this.cruisers.length < want) {
      const a = rand(0, Math.PI * 2);
      this.spawnCruiser(px + Math.cos(a) * rand(45, 70), pz + Math.sin(a) * rand(45, 70));
    }
    while (this.cruisers.length > want) {
      const c = this.cruisers.pop();
      this.scene.remove(c.mesh);
    }
    let closest = Infinity;
    for (const c of this.cruisers) {
      const d = dist2d(c.x, c.z, px, pz);
      closest = Math.min(closest, d);
      const target = Math.atan2(px - c.x, pz - c.z);
      let dh = target - c.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.heading += clamp(dh, -2.2 * dt, 2.2 * dt);
      c.mesh.rotation.y = c.heading + Math.PI;
      const spd = d > 6 ? c.type.topSpeed * 0.92 : c.type.topSpeed * 0.4;
      c.mesh.position.x += Math.sin(c.heading) * spd * dt;
      c.mesh.position.z += Math.cos(c.heading) * spd * dt;
      c.speed = spd;
      // Ram: shove the player car when close (handled by main via distance).
    }
    // Officers: spawn a couple on foot when wanted and player is on foot.
    if (stars >= 1 && this.officers.length < 2) {
      this.spawnOfficer(px + rand(-25, 25), pz + rand(-25, 25), 'OFFICER-' + (this.officers.length + 1));
    }
    for (const o of this.officers) {
      const d = dist2d(o.mesh.position.x, o.mesh.position.z, px, pz);
      if (d > 2.5) {
        const a = Math.atan2(px - o.mesh.position.x, pz - o.mesh.position.z);
        o.mesh.position.x += Math.sin(a) * 4.5 * dt;
        o.mesh.position.z += Math.cos(a) * 4.5 * dt;
        o.mesh.rotation.y = a;
      }
    }
    // Helicopter at 3+ stars, hovering over the player with a spotlight.
    if (stars >= 3) {
      const h = this.spawnHeli();
      h.group.position.x += (px - h.group.position.x) * 0.9 * dt;
      h.group.position.z += (pz - h.group.position.z) * 0.9 * dt;
      h.group.position.y = 30;
      h.group.rotation.y += dt * 0.25;
      if (this.heliRotor) this.heliRotor.rotation.y += dt * 22;
      if (this.heliDisc) this.heliDisc.rotation.z += dt * 22;
    } else {
      this.removeHeli();
    }
    this.sirenPhase += dt;
    return closest;
  }

  // Live unit list for the PCPD HUD panel: name, distance, status.
  // Cruisers first (callsign + live status: PURSUIT / RAMMING / FLANKING /
  // SEARCHING / WRECKED), then the helicopter, then officers on foot
  // (callsign + role as status: MARKSMAN / SHORE WATCH). The HUD shows
  // the first five rows plus a "+N more" line. When stagedUnits is set
  // (shot mode), unitsForHud returns those exact rows instead.
  units(px, pz, evading) {
    const out = [];
    this.cruisers.forEach((c, i) => {
      const d = dist2d(c.x, c.z, px, pz);
      const u = this.unitNames[i % 4];
      let status = evading > 50 ? 'SEARCHING' : 'PURSUIT';
      if (c.condition <= 0) status = 'WRECKED';
      else if (evading <= 50 && u.role === 'RAMMING' && d < 12) status = 'RAMMING';
      else if (evading <= 50 && u.role === 'FLANKING') status = 'FLANKING';
      out.push({ name: u.name, dist: Math.round(d), status });
    });
    if (this.heli) {
      out.push({ name: PCPD_AIR.name, dist: Math.round(dist2d(this.heli.group.position.x, this.heli.group.position.z, px, pz)), status: PCPD_AIR.role });
    }
    this.officers.forEach((o, i) => {
      const u = this.unitNames[this.unitNames.length - 2 + (i % 2)];
      out.push({ name: u.name, dist: Math.round(dist2d(o.mesh.position.x, o.mesh.position.z, px, pz)), status: u.role });
    });
    return out;
  }

  // The PCPD panel's source of rows: staged rows in shot mode, live
  // units otherwise. Staged rows are exact { name, dist, status }.
  unitsForHud(px, pz, evading) {
    if (this.stagedUnits) return this.stagedUnits;
    return this.units(px, pz, evading);
  }

  setDusk(d) {
    for (const c of this.cruisers) c.setDusk(d);
  }
}
