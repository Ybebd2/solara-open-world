// Garage — upgrade shop for the player's cars. Upgrades are bought with
// cash through buy(id) and modify the active car's stats. The garage has
// no in-game trigger in this build (no garage location on the map); the
// class and its API are the contract, used by the game and the tests.
export const UPGRADES = [
  { id: 'engine', name: 'ENGINE', cost: 800, desc: '+30% top speed' },
  { id: 'armor', name: 'ARMOUR', cost: 600, desc: '+50 armour' },
  { id: 'tires', name: 'TIRES', cost: 400, desc: '+20% acceleration' },
  { id: 'brakes', name: 'BRAKES', cost: 400, desc: 'shorter stops' },
];

export class Garage {
  constructor(game) {
    this.game = game;
    this.owned = new Set();
  }

  buy(id) {
    const up = UPGRADES.find((u) => u.id === id);
    if (!up) return { ok: false, why: 'no such upgrade' };
    if (this.owned.has(id)) return { ok: false, why: 'already owned' };
    if (this.game.money < up.cost) return { ok: false, why: 'not enough cash' };
    this.game.money -= up.cost;
    this.owned.add(id);
    const car = this.game.player.car;
    if (car) this.applyTo(car);
    return { ok: true, upgrade: up };
  }

  applyTo(car) {
    if (this.owned.has('engine')) car.topSpeed = 26 * 1.3;
    if (this.owned.has('tires')) car.accel = 12 * 1.2;
  }

  has(id) { return this.owned.has(id); }
}
