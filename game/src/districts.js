// SOLARA — districts: per-district standing. Every district opens
// NEUTRAL at 55. Finishing a job inside a district warms it by 8
// (capped at 100). Standing is flavour and HUD only; it never gates a
// mission. Built fresh for the @witty-meteor-32 build.
import { DISTRICTS, districtAt, standingLabel } from './config.js';

const START_STANDING = 55;
const STANDING_CAP = 100;

export class Districts {
  constructor() {
    // Plain object keyed by district name — the HUD reads it directly.
    this.standing = {};
    for (const d of DISTRICTS) this.standing[d.name] = START_STANDING;
  }

  // Full snapshot for the district under (x, z): name, value, label,
  // blurb and map colour. Falls back to DOWNTOWN when the point is outside.
  info(x, z) {
    const name = districtAt(x, z);
    const def = DISTRICTS.find((d) => d.name === name) || DISTRICTS[3];
    const value = this.standing[name] ?? START_STANDING;
    return { name, value, label: standingLabel(value), desc: def.desc, color: def.color };
  }

  // Warm the district under (x, z) by `amount`, clamped at the cap.
  // Called only from the mission-complete path in main.js.
  bumpAt(x, z, amount) {
    const name = districtAt(x, z);
    const raised = Math.min(STANDING_CAP, (this.standing[name] ?? START_STANDING) + amount);
    this.standing[name] = raised;
    return { name, value: raised, label: standingLabel(raised) };
  }

  // Raw standing for one district by name.
  value(name) {
    return this.standing[name] ?? START_STANDING;
  }
}
