// SOLARA — districts: per-district standing. Every district opens
// NEUTRAL at 55; finishing a job inside one warms it by 8, capped at
// 100. Standing is flavour and HUD only — it never gates a mission.
// Re-authored for the @witty-meteor-32 recording-M build.
import { DISTRICTS, districtAt, standingLabel } from './config.js';

const OPENING = 55;
const CEILING = 100;

export class Districts {
  constructor() {
    this.standing = {};
    for (const d of DISTRICTS) this.standing[d.name] = OPENING;
  }

  // Snapshot for the district under (x, z): name, value, label, blurb
  // and map colour. Outside the island the fallback is DOWNTOWN.
  info(x, z) {
    const name = districtAt(x, z);
    const def = DISTRICTS.find((d) => d.name === name) || DISTRICTS[3];
    const value = this.standing[name] ?? OPENING;
    return { name, value, label: standingLabel(value), desc: def.desc, color: def.color };
  }

  // Warm the district under (x, z) by `amount`, clamped at the ceiling.
  // Called only from the mission-complete path in main.js.
  bumpAt(x, z, amount) {
    const name = districtAt(x, z);
    const raised = Math.min(CEILING, (this.standing[name] ?? OPENING) + amount);
    this.standing[name] = raised;
    return { name, value: raised, label: standingLabel(raised) };
  }

  // Raw standing for one district by name.
  value(name) {
    return this.standing[name] ?? OPENING;
  }
}
