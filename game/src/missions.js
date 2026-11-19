// SOLARA — missions and the story. Kai Mercer is back in Solara and Mara,
// the fixer who got him out, has work. Six jobs in a chain: meet Mara, steal
// a car, lose the heat, run a delivery, survive a getaway, and finish as the
// king of the city. Each mission names its target on the map and in the HUD;
// finishing one pays cash and opens the next. The manager only tracks state —
// the game decides when a mission's condition is met.

import { CONFIG } from './config.js';

// Mission definitions. target is a map position; radius how close counts.
// type: goto (reach the marker), steal (be in a stolen car), lose (clear
// wanted), timed (reach the marker before the clock), collect (visit all
// markers), finale (visit all markers then return to Mara).
export const MISSIONS = [
  {
    id: 'meet-mara',
    title: 'Meet Mara',
    text: 'Mara is waiting on the pier. Go and see her — she has work for you.',
    target: 'pier',
    radius: 6,
    type: 'goto',
    reward: 200,
  },
  {
    id: 'borrow-a-car',
    title: 'Borrow a Car',
    text: 'Mara needs wheels. Take any car on the street (E to enter) and bring it to the downtown marker.',
    target: 'downtown',
    radius: 8,
    type: 'steal',
    reward: 400,
  },
  {
    id: 'lose-the-heat',
    title: 'Lose the Heat',
    text: 'Stealing a car put the Solara Police on you. Stay out of sight until the stars are gone.',
    target: null,
    radius: 0,
    type: 'lose',
    reward: 500,
  },
  {
    id: 'the-delivery',
    title: 'The Delivery',
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
    text: 'The job went loud. Get to the beach with the police on your tail — and lose them there.',
    target: 'beach',
    radius: 10,
    type: 'goto',
    reward: 1200,
  },
  {
    id: 'king-of-solara',
    title: 'King of Solara',
    text: 'Three drops around the city, then back to Mara on the pier. Do it clean and the city is yours.',
    target: 'pier',
    radius: 6,
    type: 'collect',
    collect: ['downtown', 'cityCentre', 'beach'],
    reward: 2000,
  },
];

export class MissionManager {
  constructor() {
    this.index = 0;
    this.done = 0;
    this.timer = 0;
    this.collected = [];
    this.finished = false;
    this.failed = false;
  }

  current() {
    return MISSIONS[this.index] ?? null;
  }

  start() {
    this.index = 0;
    this.done = 0;
    this.timer = 0;
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
        if (state.wantedStars === 0 && state.wasWanted) return this.complete();
        break;
      case 'collect': {
        const next = m.collect.find((c) => !this.collected.includes(c));
        if (next) {
          const spot = state.places[next];
          if (Math.hypot(p.x - spot.x, p.z - spot.z) < 8) {
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
    this.collected = [];
    this.failed = false;
    if (this.index >= MISSIONS.length) this.finished = true;
    return { type: 'complete', reward: m.reward, title: m.title };
  }

  // Retry the current mission after a failure (keeps the chain).
  retry() {
    this.timer = 0;
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
