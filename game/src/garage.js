// SOLARA — garage: Sully's upgrade shop. Built fresh for the
// @witty-meteor-32 build.

export const UPGRADES = [
  { id: 'engine', name: 'Tuned Engine', desc: '+15% top speed', cost: 400 },
  { id: 'armor', name: 'Armour Plating', desc: '+40 condition, rams hurt less', cost: 350 },
  { id: 'paint', name: 'Sunset Paint', desc: 'Gold flake, +10 respect', cost: 200 },
];

export class Garage {
  constructor() {
    this.owned = new Set();
  }

  list() { return UPGRADES; }

  // Returns { ok, money } — money after the purchase, or unchanged if it fails.
  buy(id, money) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u || this.owned.has(id) || money < u.cost) return { ok: false, money };
    this.owned.add(id);
    return { ok: true, money: money - u.cost, upgrade: u };
  }

  has(id) { return this.owned.has(id); }
}
