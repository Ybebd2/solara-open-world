// SOLARA — Sully's garage: upgrades for the car Kai is driving.
// Press G near the garage (60, -120) to buy the next upgrade.
import { GARAGE_UPGRADES, WORLD } from './config.js';

export class Garage {
  constructor() {
    this.owned = [];
    this.x = WORLD.garageX;
    this.z = WORLD.garageZ;
    this.onBuy = null; // (upgrade) => void
  }

  near(x, z) {
    return Math.hypot(x - this.x, z - this.z) < 14;
  }

  next() {
    return GARAGE_UPGRADES.find((u) => !this.owned.includes(u.id)) || null;
  }

  list() {
    return GARAGE_UPGRADES.map((u) => ({ ...u, owned: this.owned.includes(u.id) }));
  }

  buy(id, money) {
    const up = GARAGE_UPGRADES.find((u) => u.id === id);
    if (!up || this.owned.includes(id)) return { ok: false, reason: 'owned' };
    if (money < up.cost) return { ok: false, reason: 'broke' };
    this.owned.push(id);
    if (this.onBuy) this.onBuy(up);
    return { ok: true, upgrade: up };
  }

  buyNext(money) {
    const up = this.next();
    if (!up) return { ok: false, reason: 'all-owned' };
    return this.buy(up.id, money);
  }
}
