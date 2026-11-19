// SOLARA — save and load. One localStorage key holds money, respect,
// RP, the mission index, the garage and the radio station. Everything is
// wrapped: a browser without storage simply plays fresh.
const KEY = 'solara-save-v1';

export class SaveGame {
  constructor(G) {
    this.G = G;
  }
  write() {
    try {
      const G = this.G;
      const data = {
        money: G.money, respect: G.respect, rp: G.rp,
        missionIndex: G.missions.index, missionStage: G.missions.stage,
        garage: [...G.garage.owned], radioStation: G.radioStation,
        hours: G.hours,
      };
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch { return false; }
  }
  read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }
  apply(data) {
    if (!data) return false;
    const G = this.G;
    if (typeof data.money === 'number') G.money = data.money;
    if (typeof data.respect === 'number') G.respect = data.respect;
    if (typeof data.rp === 'number') G.rp = data.rp;
    if (typeof data.missionIndex === 'number') G.missions.index = Math.min(data.missionIndex, G.missions.list.length - 1);
    if (typeof data.missionStage === 'number') G.missions.stage = data.missionStage;
    if (Array.isArray(data.garage)) for (const id of data.garage) G.garage.owned.add(id);
    if (typeof data.radioStation === 'number') G.radioStation = data.radioStation % 3;
    if (typeof data.hours === 'number') G.hours = data.hours;
    G.hud?.refreshAll();
    return true;
  }
}
