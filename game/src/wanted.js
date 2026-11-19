// SOLARA — the wanted level: five stars, an EVADING meter that fills
// while no unit can see Kai, and the HIDDEN / IN SIGHT call. Lose the
// tail completely and a star comes off.
import { clamp } from './config.js';

export class Wanted {
  constructor(G) {
    this.G = G;
    this.stars = 0;
    this.evading = 0;
    this.status = 'HIDDEN';
  }
  // The response code runs one below the star count: three stars is a
  // CODE 2 response, four stars a CODE 3, and so on.
  get code() { return Math.max(1, this.stars - 1); }
  addStar() {
    this.stars = Math.min(5, this.stars + 1);
    this.evading = 0;
    this.status = 'IN SIGHT';
  }
  dropStar() {
    if (this.stars > 0) {
      this.stars -= 1;
      this.evading = 0;
      this.G.hud?.toast('You lost them — heat down', 'good');
    }
  }
  // Seen = any cruiser within 45 m or any officer within 30 m.
  update(dt) {
    const G = this.G;
    if (this.stars <= 0) { this.evading = 0; this.status = 'HIDDEN'; return; }
    const p = G.player;
    let seen = false;
    for (const c of G.police.cruisers) {
      if (c.status !== 'WRECKED' && Math.hypot(c.x - p.x, c.z - p.z) < 45) { seen = true; break; }
    }
    if (!seen) {
      for (const o of G.police.officers) {
        if (Math.hypot(o.x - p.x, o.z - p.z) < 30) { seen = true; break; }
      }
    }
    if (seen) {
      this.status = 'IN SIGHT';
      this.evading = Math.max(0, this.evading - 22 * dt);
    } else {
      this.status = 'HIDDEN';
      this.evading = clamp(this.evading + 13 * dt, 0, 100);
      if (this.evading >= 100) this.dropStar();
    }
  }
}
