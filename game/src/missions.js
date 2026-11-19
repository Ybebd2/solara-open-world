// SOLARA — the eight-job chain. A stage is done when Kai (on foot or in
// his car) comes within its radius of its target; the last stage pays the
// reward, raises the district standing and advances the chain. Mission 4
// is a timed delivery: the clock runs, and a miss sends Kai back to the
// pickup with the timer reset.
import { MISSIONS, WEAPONS, clamp } from './config.js';

export class Missions {
  constructor(G) {
    this.G = G;
    this.list = MISSIONS;
    this.index = 0;
    this.stage = 0;
    this.stageT = 0;
    this.done = false;
  }
  get current() { return this.list[Math.min(this.index, this.list.length - 1)]; }
  get currentStage() { return this.current.stages[Math.min(this.stage, this.current.stages.length - 1)]; }
  get stageCount() { return this.current.stages.length; }

  resetTimer() {
    const s = this.currentStage;
    this.stageT = s.time || 0;
  }

  update(dt) {
    if (this.done || this.G.state !== 'playing') return;
    const G = this.G;
    const stage = this.currentStage;
    if (stage.time && this.stageT <= 0) this.stageT = stage.time;
    if (stage.time) {
      this.stageT -= dt;
      if (this.stageT <= 0) {
        // Out of time: back to the pickup, timer reset.
        G.hud?.toast('Too slow — back to the pickup', 'bad');
        this.stage = 0;
        this.stageT = stage.time;
        const p = G.player;
        p.x = G.config.spawn.x; p.z = G.config.spawn.z;
        return;
      }
    }
    const pos = G.player.onFoot ? G.player : G.player.car;
    if (!pos) return;
    const d = Math.hypot(pos.x - stage.target.x, pos.z - stage.target.z);
    if (d <= stage.radius) this.advance();
  }

  advance() {
    const G = this.G;
    const mission = this.current;
    G.sound?.pickup();
    if (this.stage < mission.stages.length - 1) {
      this.stage++;
      this.resetTimer();
      G.hud?.toast(`${mission.ch} — stage ${this.stage + 1}/${mission.stages.length}`, 'good');
      return;
    }
    // Mission complete: pay out, raise standing, unlock the next weapon.
    const r = mission.reward;
    G.money += r.money;
    G.respect += r.respect;
    G.rp += r.rp;
    const here = G.world.districtAt(G.player.x, G.player.z);
    G.districts.addStanding(here.name, 8);
    G.hud?.toast(`JOB DONE — +$${r.money.toLocaleString()} · +${r.respect} respect · +${r.rp} RP`, 'good');
    G.sound?.payout();
    const next = this.index + 1;
    // Unlock weapons tied to the mission just finished.
    for (const w of WEAPONS) if (w.unlockMission === next) G.player.unlockWeapon(w.slot);
    this.index = Math.min(next, this.list.length - 1);
    this.stage = 0;
    this.resetTimer();
    if (next >= this.list.length) this.done = true;
    G.hud?.refreshMission();
  }
}
