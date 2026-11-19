// SOLARA — missions: the 8-job chain (Lupe, Sully, Marco, Brandt,
// Aurora). Beacon column + ground ring mark the target; mission 4 has
// a 90s timer. Built fresh for the @witty-meteor-32 build.
import * as THREE from '../vendor/three.module.min.js';
import { MISSIONS, actFor, dist2d } from './config.js';

export class Missions {
  constructor(scene, hud, onAct) {
    this.scene = scene;
    this.hud = hud;
    this.onAct = onAct || null; // fires when the act changes (title card)
    this.lastAct = null;        // act label of the last card shown
    this.index = 0;
    this.timer = 0;        // seconds left on a timed mission (0 = none)
    this.done = false;
    this.current = MISSIONS[0];
    // Beacon: glowing column + pulsing ring at the target.
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.5, depthWrite: false });
    this.beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 46, 12, 1, true), beaconMat);
    this.beacon.position.y = 23;
    scene.add(this.beacon);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(4.5, 6.5, 28),
      new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.75, side: THREE.DoubleSide, depthWrite: false })
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.y = 0.12;
    scene.add(this.ring);
    this.placeBeacon();
  }

  placeBeacon() {
    const t = this.current.target;
    this.beacon.position.set(t.x, 23, t.z);
    this.ring.position.set(t.x, 0.12, t.z);
  }

  startMission(i) {
    this.index = i;
    this.current = MISSIONS[i];
    this.timer = this.current.timer || 0;
    this.done = false;
    this.placeBeacon();
    this.hud.say(this.current.say, this.current.contact);
    this.hud.toast(`JOB ${i + 1}/8 — ${this.current.title}`);
    // Title card, once per act: when this job opens a new act, tell the
    // caller (main decides if it shows — never in intro, title or shots).
    const act = actFor(i);
    if (act.act !== this.lastAct) {
      this.lastAct = act.act;
      if (this.onAct) this.onAct(act);
    }
  }

  // Returns an event: null | { type:'complete', mission } | { type:'failed' }
  update(dt, px, pz, inCar) {
    if (this.done || !this.current) return null;
    const m = this.current;
    // Timed mission: the clock runs down while the player is on the road.
    if (m.timer) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = m.timer; // retry the same job
        this.hud.say('Too slow. The gate closed — run it again.', m.contact);
        this.hud.toast('JOB FAILED — RETRY');
        return { type: 'failed', mission: m };
      }
    }
    const d = dist2d(px, pz, m.target.x, m.target.z);
    // Mission 2 (borrow a car) completes by getting into any car.
    const reached = m.id === 2 ? inCar : d <= m.radius;
    if (reached) {
      const done = m;
      this.done = true;
      if (this.index + 1 < MISSIONS.length) {
        this.startMission(this.index + 1);
      } else {
        this.current = null;
        this.beacon.visible = false;
        this.ring.visible = false;
      }
      return { type: 'complete', mission: done };
    }
    // Pulse the ring.
    const s = 1 + Math.sin(performance.now() / 280) * 0.08;
    this.ring.scale.set(s, s, 1);
    return null;
  }

  get objective() {
    return this.current ? this.current.objective : 'All jobs done — Solara is yours.';
  }

  // Stage display for the mission panel: the LAST band whose max distance
  // still covers the player. Purely derived from position — it never gates
  // completion, so teleporting to the target jumps to the final stage and
  // the job completes exactly as before. NEXT is the next stage's text, or
  // the next job's title on the last stage.
  stageInfo(px, pz) {
    if (!this.current) return { index: 1, total: 1, text: 'All jobs done — Solara is yours.', next: '' };
    const stages = this.current.stages || [{ max: 999, text: this.current.objective }];
    const d = dist2d(px, pz, this.current.target.x, this.current.target.z);
    let idx = 0;
    for (let i = 0; i < stages.length; i++) if (d <= stages[i].max) idx = i;
    const next = idx + 1 < stages.length
      ? stages[idx + 1].text
      : (this.index + 1 < MISSIONS.length ? `JOB ${this.index + 2}/8 — ${MISSIONS[this.index + 1].title}` : 'Solara is yours');
    return { index: idx + 1, total: stages.length, text: stages[idx].text, next };
  }

  get timerLeft() {
    return this.current && this.current.timer ? Math.max(0, Math.ceil(this.timer)) : 0;
  }
}
