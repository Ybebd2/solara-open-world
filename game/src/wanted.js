// Wanted — 5 stars, EVADING meter, HIDDEN / IN SIGHT. Carjack adds a star.
// Evading fills slowly (3%/s) while no cruiser or officer can see the
// player, and drains fast when one is close. At 100% evading a star drops.
import { TUNING } from './config.js';

export class Wanted {
  constructor() {
    this.stars = 0;
    this.evading = 0;   // 0–100
    this.inSight = false;
  }

  addStar(n = 1) {
    this.stars = Math.min(5, this.stars + n);
    if (this.stars > 0) this.evading = 0;
  }

  removeStar(n = 1) {
    this.stars = Math.max(0, this.stars - n);
    if (this.stars === 0) this.evading = 0;
  }

  // Nearest police distance decides seen/hidden and the evade rate.
  update(dt, player, police) {
    if (this.stars === 0) {
      this.inSight = false;
      this.evading = 0;
      return;
    }
    let nearest = Infinity;
    for (const c of police.cruisers) {
      nearest = Math.min(nearest, Math.hypot(c.x - player.x, c.z - player.z));
    }
    for (const o of police.officers) {
      nearest = Math.min(nearest, Math.hypot(o.x - player.x, o.z - player.z));
    }
    const seen = nearest < TUNING.sightCruiser;
    this.inSight = seen;
    if (seen) {
      this.evading = Math.max(0, this.evading - TUNING.evadeDrainNear * dt);
    } else {
      this.evading = Math.min(100, this.evading + TUNING.evadeFillFar * dt);
      if (this.evading >= 100) {
        this.removeStar(1);
        this.evading = 0;
      }
    }
  }

  get code() {
    return Math.min(3, Math.max(1, this.stars));
  }
}
