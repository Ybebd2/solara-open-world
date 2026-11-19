// SOLARA — the garage: three bolt-on upgrades for whatever Kai is
// driving, bought with mission money. Engine raises the top speed,
// armour plates soak damage before the car does, and brakes cut the
// stopping distance. Nothing here is required to finish the game.
export const UPGRADES = [
  { id: 'engine', name: 'Stage 2 Engine', cost: 900, desc: '+6 m/s top speed' },
  { id: 'armour', name: 'Armour Plating', cost: 700, desc: 'car takes half damage' },
  { id: 'brakes', name: 'Race Brakes', cost: 500, desc: 'stops twice as fast' },
];

export class Garage {
  constructor(G) {
    this.G = G;
    this.owned = new Set();
  }
  has(id) { return this.owned.has(id); }
  buy(id) {
    const u = UPGRADES.find((x) => x.id === id);
    if (!u || this.owned.has(id)) return false;
    if (this.G.money < u.cost) { this.G.hud?.toast('Not enough money', 'bad'); return false; }
    this.G.money -= u.cost;
    this.owned.add(id);
    this.G.hud?.toast(`Installed: ${u.name}`, 'good');
    return true;
  }
  // Top speed of the car Kai is driving, with upgrades applied.
  topSpeed() {
    let v = 24;
    if (this.owned.has('engine')) v += 6;
    return v;
  }
}
