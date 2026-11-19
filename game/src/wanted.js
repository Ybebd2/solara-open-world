// SOLARA — wanted: stars, the evading meter, hidden/searching, and the
// escape payout. Re-authored for the @witty-meteor-32 recording-M build.
//
// The badge under the stars reads IN SIGHT (red pill) while a unit sees
// Kai, and HIDDEN (blue pill) while the search grid runs — once the
// nearest unit is more than 55 m away the EVADING meter climbs (evading
// 15% and rising) and the PCPD panel shows the search rows. Reaching
// 100% escapes: stars clear, +$150 and +20 respect.
import { clamp } from './config.js';

const HIDDEN_RANGE = 55; // beyond this, no unit sees Kai
const CLOSE_RANGE = 18; // inside this, the meter falls back

export class Wanted {
  constructor() {
    this.stars = 0;
    this.evading = 0; // 0..100 — reaching 100 clears the heat
    this.hidden = false; // no police unit close by
    this.searching = false;
    this.escaped = false; // set true the frame an escape pays out
  }

  addStars(n) {
    this.stars = clamp(this.stars + n, 0, 5);
    if (this.stars > 0) this.evading = 0;
    this.escaped = false;
  }

  clear() {
    this.stars = 0;
    this.evading = 0;
    this.searching = false;
    this.hidden = false;
  }

  // closestDist: metres to the nearest police unit. With heat on and
  // nothing close, evading climbs (faster while driving); when a unit
  // closes in, it falls back.
  update(dt, closestDist, playerSpeed) {
    this.escaped = false;
    if (this.stars <= 0) {
      this.evading = 0;
      this.searching = false;
      this.hidden = false;
      return;
    }
    this.hidden = closestDist > HIDDEN_RANGE;
    this.searching = this.hidden;
    if (this.hidden) {
      this.evading += dt * (playerSpeed > 8 ? 26 : 14);
    } else if (closestDist < CLOSE_RANGE) {
      this.evading = Math.max(0, this.evading - dt * 30);
    }
    if (this.evading >= 100) {
      this.evading = 100;
      this.clear();
      this.escaped = true; // main pays $150 + respect on this flag
    }
  }
}
