// SOLARA — the eight-job story chain. Each job is a short stage list of
// "go here" targets with a beacon; finishing a job pays cash + respect.
import { WORLD } from './config.js';

const JOBS = [
  {
    chapter: 'CH.1', title: 'HOMECOMING', giver: 'Lupe',
    brief: 'Meet Lupe at the pier. The city owes you a homecoming.',
    reward: 400, respect: 10,
    stages: [
      { text: 'Meet Lupe at the pier', x: WORLD.pierX, z: WORLD.pierZ, r: 10 },
      { text: 'Hear the job at the kiosk', x: -246, z: 24, r: 8 },
      { text: 'Grab the keys', x: -254, z: 16, r: 8 },
      { text: 'Confirm with Lupe', x: -248, z: 22, r: 10 },
    ],
  },
  {
    chapter: 'CH.2', title: 'BORROWED WHEELS', giver: 'Lupe',
    brief: 'Repo the orange coupe off Beach Road. Bring it back clean.',
    reward: 1200, respect: 12,
    stages: [
      { text: 'Find the coupe on Beach Road', x: 196, z: -40, r: 9 },
      { text: 'Get in the coupe', x: 196, z: -40, r: 9 },
      { text: 'Drive it to the Marina lockup', x: -40, z: 200, r: 10 },
      { text: 'Park it inside the lockup', x: -40, z: 200, r: 10 },
    ],
  },
  {
    chapter: 'CH.3', title: 'SHARK TAX', giver: 'Lupe',
    brief: 'Collect from the three stalls on Sunset Strip. No receipts.',
    reward: 1600, respect: 15,
    stages: [
      { text: 'Collect at the north stall', x: 40, z: 80, r: 8 },
      { text: 'Collect at the middle stall', x: 100, z: 160, r: 8 },
      { text: 'Collect at the south stall', x: 60, z: 260, r: 8 },
      { text: 'Bring the take to Lupe', x: WORLD.pierX, z: WORLD.pierZ, r: 10 },
    ],
  },
  {
    chapter: 'CH.4', title: 'TIDE RUNNER', giver: 'Marco',
    brief: 'A 90-second delivery across town. The tide waits for no one.',
    reward: 2000, respect: 18, timed: 90,
    stages: [
      { text: 'Grab the package at the docks', x: -120, z: 220, r: 8 },
      { text: 'Cut through Downtown', x: 60, z: -40, r: 9 },
      { text: 'Drop it at North Gate', x: -120, z: -220, r: 9 },
      { text: 'Get clear of the gate', x: -60, z: -160, r: 9 },
    ],
  },
  {
    chapter: 'CH.5', title: 'DIRTY BADGE', giver: 'Brandt',
    brief: 'Brandt wants a cruiser gone. Make it look like an accident.',
    reward: 2600, respect: 18,
    stages: [
      { text: 'Meet Brandt in Old Town', x: -240, z: -200, r: 8 },
      { text: 'Tail the patrol route', x: -60, z: -60, r: 10 },
      { text: 'Lose the tail in the Marina', x: 0, z: 240, r: 10 },
      { text: 'Report back to Brandt', x: -240, z: -200, r: 8 },
    ],
  },
  {
    chapter: 'CH.6', title: 'DOCKSIDE AMBUSH', giver: 'Marco',
    brief: 'Marco’s crew is pinned at the docks. Bring the cavalry.',
    reward: 3200, respect: 22,
    stages: [
      { text: 'Reach the dock gate', x: -160, z: 180, r: 9 },
      { text: 'Clear the north container row', x: -200, z: 260, r: 9 },
      { text: 'Clear the south container row', x: -80, z: 280, r: 9 },
      { text: 'Escort Marco out', x: -120, z: 200, r: 9 },
    ],
  },
  {
    chapter: 'CH.7', title: 'NEON NIGHTS', giver: 'Aurora',
    brief: 'Aurora’s opening night. Light the Strip, then vanish.',
    reward: 4200, respect: 25,
    stages: [
      { text: 'Meet Aurora at the Strip', x: 120, z: 200, r: 8 },
      { text: 'Hit the first neon switch', x: 40, z: 120, r: 8 },
      { text: 'Hit the second neon switch', x: 160, z: 280, r: 8 },
      { text: 'Slip away down Beach Road', x: 240, z: 120, r: 10 },
    ],
  },
  {
    chapter: 'CH.8', title: 'GOLDEN HOUR', giver: 'Lupe',
    brief: 'One last job at golden hour. The whole city is watching.',
    reward: 5300, respect: 40,
    stages: [
      { text: 'Meet Lupe at the pier', x: WORLD.pierX, z: WORLD.pierZ, r: 10 },
      { text: 'Take the coast road north', x: 220, z: -200, r: 10 },
      { text: 'Cross Downtown at speed', x: 100, z: 0, r: 10 },
      { text: 'Finish at the Marina', x: -60, z: 260, r: 10 },
    ],
  },
];

export class Missions {
  constructor() {
    this.jobs = JOBS;
    this.index = 0;
    this.stage = 0;
    this.done = false;
    this.timer = 0;
    this.onComplete = null; // (job) => void
    this.onStage = null;    // (job, stage) => void
    this.onFail = null;     // (job) => void
  }

  get current() { return this.jobs[this.index]; }
  get stageCount() { return this.current ? this.current.stages.length : 0; }

  resetTimer() {
    const job = this.current;
    this.timer = job && job.timed ? job.timed : 0;
  }

  update(dt, px, pz) {
    if (this.done || !this.current) return;
    const job = this.current;
    if (job.timed) {
      this.timer -= dt;
      if (this.timer <= 0) {
        // Timeout: restart the job from its first stage, back at spawn.
        this.stage = 0;
        this.timer = job.timed;
        if (this.onFail) this.onFail(job);
        return;
      }
    }
    const s = job.stages[this.stage];
    if (!s) return;
    // Loop so a player standing where several stage targets cluster
    // (mission 1, all on the pier) clears them in one pass.
    while (this.stage < job.stages.length) {
      const cur = job.stages[this.stage];
      const d = Math.hypot(px - cur.x, pz - cur.z);
      if (d >= cur.r) break;
      this.stage++;
      if (this.onStage) this.onStage(job, this.stage);
      if (this.stage >= job.stages.length) {
        const finished = job;
        this.index++;
        this.stage = 0;
        if (this.index >= this.jobs.length) this.done = true;
        else this.resetTimer();
        if (this.onComplete) this.onComplete(finished);
        return;
      }
    }
  }

  target() {
    if (this.done || !this.current) return null;
    return this.current.stages[this.stage];
  }
}
