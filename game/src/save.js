// Save — F8 quick-saves, F9 loads. The save holds money, respect, mission
// index, player position, hour, and owned garage upgrades in localStorage.
// Loading restores them and puts Kai back on his feet at the saved spot.
const KEY = 'solara-save-v1';

export class Save {
  constructor(game) {
    this.game = game;
  }

  write() {
    const g = this.game;
    const data = {
      money: g.money, respect: g.respect, missionIndex: g.missions.index,
      hours: g.hours, radioIdx: g.radioIdx,
      x: g.player.x, z: g.player.z,
      upgrades: [...g.garage.owned],
      at: Date.now(),
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  load() {
    const d = this.read();
    if (!d) return false;
    const g = this.game;
    g.money = d.money;
    g.respect = d.respect;
    g.missions.index = d.missionIndex;
    g.missions.stage = 1;
    g.missions.moveBeacon();
    g.hours = d.hours;
    g.radioIdx = d.radioIdx || 0;
    g.garage.owned = new Set(d.upgrades || []);
    if (g.player.car) g.player.enterCar();
    g.player.group.position.set(d.x, 0, d.z);
    g.player.group.visible = true;
    g.player.onFoot = true;
    return true;
  }
}
