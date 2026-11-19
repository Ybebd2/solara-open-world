// SOLARA — districts: seven neighbourhoods, standing starts NEUTRAL · 55
// and climbs 8 points with every job Kai finishes.
import { DISTRICTS, districtAt, clamp } from './config.js';

export class Districts {
  constructor() {
    this.list = DISTRICTS.map((d) => ({ ...d, standing: 55 }));
    this.current = this.list[0];
  }

  update(x, z) {
    this.current = districtAt(x, z);
    const found = this.list.find((d) => d.id === this.current.id);
    if (found) this.current = found;
  }

  jobDone() {
    for (const d of this.list) d.standing = clamp(d.standing + 8, 0, 100);
  }

  get standingLabel() {
    const s = this.current.standing;
    if (s >= 80) return 'HELD';
    if (s >= 60) return 'FRIENDLY';
    return 'NEUTRAL';
  }
}
