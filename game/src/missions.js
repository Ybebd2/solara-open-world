// Missions — the 8-job chain from fixer Lupe. A gold beacon cylinder and
// a ground ring mark the target. Reach the target to complete the job:
// pay the reward, add respect, advance the index. Mission 4 is a 90 s
// timed delivery — run out the clock and the job resets.
import * as THREE from '../vendor/three.module.min.js';
import { MISSIONS } from './config.js';

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.list = MISSIONS.map((m) => ({ ...m }));
    this.index = 0;
    this.stage = 1;
    this.timer = 0;
    this.done = false;
    // Gold beacon + ground ring at the active target.
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0xffd700, transparent: true, opacity: 0.35, depthWrite: false,
    });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 40, 16, 1, true), beaconMat);
    this.beacon.position.y = 20;
    scene.add(this.beacon);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd700, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(3, 4.2, 32), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.08;
    scene.add(this.ring);
    this.moveBeacon();
  }

  get current() {
    return this.list[Math.min(this.index, this.list.length - 1)];
  }

  moveBeacon() {
    const t = this.current.target;
    this.beacon.position.set(t.x, 20, t.z);
    this.ring.position.set(t.x, 0.08, t.z);
    this.timer = this.current.timed || 0;
  }

  // Returns a completion event {reward, respect} or null.
  update(dt, player) {
    if (this.done) return null;
    const m = this.current;
    const dx = player.x - m.target.x;
    const dz = player.z - m.target.z;
    const dist = Math.hypot(dx, dz);
    // Stage fills as the player closes in (drives the 4-segment bar).
    this.stage = Math.max(1, Math.min(m.stages, 1 + Math.floor((1 - Math.min(1, dist / 220)) * m.stages)));
    if (m.timed) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = m.timed; // job resets, try again
        return { failed: true, mission: m };
      }
    }
    if (dist < 14) {
      const ev = { reward: m.reward, respect: m.respect, mission: m };
      this.index = Math.min(this.list.length - 1, this.index + 1);
      if (this.index >= this.list.length - 1 && this.list[this.index] === m) this.done = true;
      this.stage = 1;
      this.moveBeacon();
      return ev;
    }
    return null;
  }
}
