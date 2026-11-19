// SOLARA — garage: Sully's upgrade shop. Three upgrades, one purchase
// each, paid from the run's cash. Re-authored for the
// @witty-meteor-32 recording-M build.

export const UPGRADES = [
  { id: 'engine', name: 'Tuned Engine', desc: '+15% top speed', cost: 400 },
  { id: 'armor', name: 'Armour Plating', desc: '+40 condition, rams hurt less', cost: 350 },
  { id: 'paint', name: 'Sunset Paint', desc: 'Gold flake, +10 respect', cost: 200 },
];

export class Garage {
  constructor() {
    this.owned = new Set();
  }

  list() {
    return UPGRADES;
  }

  has(id) {
    return this.owned.has(id);
  }

  // Buy one upgrade. Returns { ok, money } — money after the purchase,
  // or unchanged when the upgrade is unknown, already owned, or the
  // player cannot afford it.
  buy(id, money) {
    const item = UPGRADES.find((u) => u.id === id);
    if (!item) return { ok: false, money };
    if (this.owned.has(id)) return { ok: false, money };
    if (money < item.cost) return { ok: false, money };
    this.owned.add(id);
    return { ok: true, money: money - item.cost, upgrade: item };
  }
}
