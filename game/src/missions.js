// SOLARA v3 — missions and the story. Kai Mercer is back in Solara and
// Lupe, the fixer who got him out, has work. Eight jobs in a chain across
// the city's named districts: meet Lupe, steal a car, lose the heat, run a
// delivery, survive a getaway, run Neon Row, work the Old Port, and finish
// as the king of the city. Each mission opens with a line of dialogue from
// its character (Lupe, Sully, Marco, Brandt, Aurora) and names its target on
// the map and in the HUD; finishing one pays cash and respect and opens the
// next. The manager only tracks state — the game decides when a mission's
// condition is met.

import { CONFIG } from './config.js';

// Mission definitions. target is a map position; radius how close counts.
// type: goto (reach the marker), steal (be in a stolen car), lose (clear
// wanted), timed (reach the marker before the clock), escape (reach the
// marker AND have no wanted stars when you get there), collect (visit all
// markers), finale (visit all markers then return to Lupe).
// dialogue: the line the character says when the job opens.
export const MISSIONS = [
  {
    id: 'meet-lupe',
    title: 'Meet Lupe',
    speaker: 'Lupe',
    dialogue: 'Kai. You\u2019re out. I got you out, now you work for me — come to the pier and we\u2019ll talk.',
    text: 'Lupe is waiting on the pier. Go and see her — she has work for you. (WASD to move, Shift to run.)',
    target: 'pier',
    radius: 6,
    type: 'goto',
    reward: 200,
  },
  {
    id: 'borrow-a-car',
    title: 'Borrow a Car',
    speaker: 'Sully',
    dialogue: 'Need wheels? Take any car on the street — walk up to the driver\u2019s door and press F. The owner will run.',
    text: 'Sully needs wheels. Take any car on the street (F to carjack) and bring it to the downtown marker.',
    target: 'downtown',
    radius: 8,
    type: 'steal',
    reward: 400,
  },
  {
    id: 'lose-the-heat',
    title: 'Lose the Heat',
    speaker: 'Lupe',
    dialogue: 'You stole a car and the PCPD is on you. Stay out of sight — when the evading meter fills, you\u2019re clear.',
    text: 'Stealing a car put the Solara Police on you. Stay out of sight until the stars are gone.',
    target: null,
    radius: 0,
    type: 'lose',
    reward: 500,
  },
  {
    id: 'the-delivery',
    title: 'The Delivery',
    speaker: 'Marco',
    dialogue: 'A package for the north gate. Ninety seconds, Kai — the client does not wait, and the cops do not either.',
    text: 'A package for the north gate. Drive it there in 90 seconds — the client does not wait.',
    target: 'northGate',
    radius: 8,
    type: 'timed',
    timeLimit: 90,
    reward: 800,
  },
  {
    id: 'the-getaway',
    title: 'The Getaway',
    speaker: 'Brandt',
    dialogue: 'The job went loud. Get to the beach with the police on your tail — and lose them there before the job counts.',
    text: 'The job went loud. Get to the beach with the police on your tail — and lose them there before the job counts.',
    target: 'beach',
    radius: 10,
    type: 'escape',
    reward: 1200,
  },
  {
    id: 'neon-row-run',
    title: 'Neon Row Run',
    speaker: 'Aurora',
    dialogue: 'Three drops in Neon Row, and make it quick. The lights are pretty, the cops are not.',
    text: 'Three drops around Neon Row, then the job is done. The lights are pretty, the cops are not.',
    target: 'neonRow',
    radius: 8,
    type: 'collect',
    collect: ['neonRow', 'cityCentre', 'malecon'],
    reward: 1500,
  },
  {
    id: 'old-port-job',
    title: 'The Old Port Job',
    speaker: 'Sully',
    dialogue: 'Crates at the Old Port, Kai. Grab them all and bring them to the safehouse. Quiet this time.',
    text: 'Grab the crates at the Old Port, then bring them to the safehouse. Quiet this time.',
    target: 'safehouse',
    radius: 8,
    type: 'collect',
    collect: ['oldPort', 'palmHeights', 'raceStart'],
    reward: 1800,
  },
  {
    id: 'king-of-solara',
    title: 'King of Solara',
    speaker: 'Lupe',
    dialogue: 'One last run, Kai. Three drops, then back to me on the pier. Do it clean and the city is yours.',
    text: 'Three drops around the city, then back to Lupe on the pier. Do it clean and the city is yours.',
    target: 'pier',
    radius: 6,
    type: 'collect',
    collect: ['downtown', 'cityCentre', 'beach'],
    reward: 2500,
  },
];

export class MissionManager {
  constructor() {
    this.index = 0;
    this.done = 0;
    this.timer = 0;
    this.elapsed = 0;
    this.collected = [];
    this.finished = false;
    this.failed = false;
  }

  current() {
    return MISSIONS[this.index] ?? null;
  }

  // The next mission after the current one, for the HUD's "next" line.
  next() {
    return MISSIONS[this.index + 1] ?? null;
  }

  // Chain progress for the HUD and the pause screen: { done, total }.
  progress() {
    return { done: this.done, total: MISSIONS.length };
  }

  start() {
    this.index = 0;
    this.done = 0;
    this.timer = 0;
    this.elapsed = 0;
    this.collected = [];
    this.finished = false;
    this.failed = false;
  }

  // The target position of the current mission, resolved through places.
  targetPos(places) {
    const m = this.current();
    if (!m) return null;
    if (m.type === 'collect') {
      const next = m.collect.find((p) => !this.collected.includes(p));
      return next ? places[next] : places[m.target];
    }
    return m.target ? places[m.target] : null;
  }

  // Called every frame with the live game state. Returns an event:
  // { type: 'complete', reward } | { type: 'failed' } | null.
  update(dt, state) {
    const m = this.current();
    if (!m || this.finished) return null;
    this.elapsed += dt;
    if (m.type === 'timed') {
      this.timer += dt;
      if (this.timer > m.timeLimit) {
        this.failed = true;
        return { type: 'failed' };
      }
    }
    const p = state.playerPos;
    const t = this.targetPos(state.places);
    switch (m.type) {
      case 'goto':
      case 'timed':
        if (t && Math.hypot(p.x - t.x, p.z - t.z) < m.radius) return this.complete();
        break;
      case 'steal':
        if (state.inCar && state.carStolen && t && Math.hypot(p.x - t.x, p.z - t.z) < m.radius) return this.complete();
        break;
      case 'lose':
        // Normally the job ends once the stars clear after a chase. If the
        // heat never came at all (a clean steal), the job cannot stall: after
        // 45 quiet seconds it counts as lost anyway.
        if (state.wantedStars === 0 && (state.wasWanted || this.elapsed > 45)) return this.complete();
        break;
      case 'escape':
        // Reach the beach AND be clean when you get there — arriving with the
        // police still on you does not count, so the player must shake them
        // first or lose them on the sand.
        if (t && Math.hypot(p.x - t.x, p.z - t.z) < m.radius && state.wantedStars === 0) return this.complete();
        break;
      case 'collect': {
        const next = m.collect.find((c) => !this.collected.includes(c));
        if (next) {
          const spot = state.places[next];
          // The drop radius is the mission's own radius (8 on every
          // collect job), not a second hardcoded number.
          if (Math.hypot(p.x - spot.x, p.z - spot.z) < m.radius) {
            this.collected.push(next);
            return { type: 'collected', name: next, left: m.collect.length - this.collected.length };
          }
        } else if (t && Math.hypot(p.x - t.x, p.z - t.z) < m.radius) {
          return this.complete();
        }
        break;
      }
    }
    return null;
  }

  complete() {
    const m = this.current();
    this.done += 1;
    this.index += 1;
    this.timer = 0;
    this.elapsed = 0;
    this.collected = [];
    this.failed = false;
    if (this.index >= MISSIONS.length) this.finished = true;
    return { type: 'complete', reward: m.reward, title: m.title };
  }

  // Retry the current mission after a failure (keeps the chain).
  retry() {
    this.timer = 0;
    this.elapsed = 0;
    this.failed = false;
    this.collected = [];
  }

  // Time left on a timed mission, in seconds (0 when not timed).
  timeLeft() {
    const m = this.current();
    if (!m || m.type !== 'timed') return 0;
    return Math.max(0, m.timeLimit - this.timer);
  }
}
