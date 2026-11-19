// SOLARA — district standing: every district starts NEUTRAL at 55 and
// climbs 8 points when Kai finishes a job inside it. Standing is shown
// on the minimap panel and gates nothing yet — it is the city's memory
// of who Kai is.
import { DISTRICTS } from './config.js';

export class Districts {
  constructor(G) {
    this.G = G;
    this.standing = {};
    for (const d of DISTRICTS) this.standing[d.name] = 55;
  }
  standingFor(name) { return this.standing[name] ?? 55; }
  statusFor(name) {
    const s = this.standingFor(name);
    if (s >= 80) return 'TRUSTED';
    if (s >= 65) return 'FRIENDLY';
    if (s >= 40) return 'NEUTRAL';
    return 'COLD';
  }
  addStanding(name, amount) {
    this.standing[name] = Math.max(0, Math.min(100, this.standingFor(name) + amount));
  }
}
