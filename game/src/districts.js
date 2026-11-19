// Districts — seven named areas, standing starts NEUTRAL · 55 and rises
// +8 on every completed job. The minimap and HUD read the current district
// from the player's position.
import { DISTRICTS } from './config.js';

export class Districts {
  constructor() {
    this.list = DISTRICTS.map((d) => ({ ...d }));
    this.current = this.list[1]; // BEACH ROAD
  }

  // Nearest district centre to (x, z).
  at(x, z) {
    let best = this.list[0];
    let bd = Infinity;
    for (const d of this.list) {
      const dd = (d.x - x) * (d.x - x) + (d.z - z) * (d.z - z);
      if (dd < bd) { bd = dd; best = d; }
    }
    return best;
  }

  update(x, z) {
    this.current = this.at(x, z);
    return this.current;
  }

  // +8 standing on job completion, applied to every district the player
  // has standing in (the city warms to Kai as he works).
  onJobDone() {
    for (const d of this.list) d.standing = Math.min(100, d.standing + 8);
  }

  get name() { return this.current.name; }
  get standing() { return this.current.standing; }
}
