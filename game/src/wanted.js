// SOLARA — the wanted system: five gold stars, evasion, HIDDEN / IN SIGHT,
// and the escape payout.
import { clamp } from './config.js';

export class Wanted {
  constructor() {
    this.stars = 0;
    this.evading = 0;      // 0..100 — fills while hidden
    this.inSight = false;
    this._escapeTimer = 0;
  }

  addStars(n) {
    this.stars = clamp(this.stars + n, 0, 5);
    this.evading = 0;
  }

  removeStars(n) {
    this.stars = clamp(this.stars - n, 0, 5);
    if (this.stars === 0) this.evading = 0;
  }

  update(dt, police, playerPos) {
    if (this.stars === 0) {
      this.inSight = false;
      this.evading = 0;
      return 0;
    }
    // Seen if any cruiser or officer is close.
    let seen = false;
    for (const c of police.cruisers) {
      if (Math.hypot(c.x - playerPos.x, c.z - playerPos.z) < 55) { seen = true; break; }
    }
    if (!seen) {
      for (const o of police.officers) {
        if (Math.hypot(o.x - playerPos.x, o.z - playerPos.z) < 35) { seen = true; break; }
      }
    }
    this.inSight = seen;
    if (seen) {
      this.evading = Math.max(0, this.evading - dt * 14);
      this._escapeTimer = 0;
    } else {
      this.evading = Math.min(100, this.evading + dt * 3);
      if (this.evading >= 100) {
        this._escapeTimer += dt;
        if (this._escapeTimer > 1) {
          const paid = this.stars * 150;
          this.stars = 0;
          this.evading = 0;
          this._escapeTimer = 0;
          return paid;
        }
      }
    }
    return 0;
  }

  get code() {
    return this.stars <= 1 ? 1 : this.stars <= 3 ? 2 : 3;
  }
}
