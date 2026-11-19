// SOLARA — save / load through localStorage (F8 / F9).
export class SaveGame {
  constructor(key = 'solara-save-v1') {
    this.key = key;
  }

  save(state) {
    try {
      const data = {
        money: state.money,
        respect: state.respect,
        missionIndex: state.missions.index,
        missionStage: state.missions.stage,
        hours: state.hours,
        px: state.player.x,
        pz: state.player.z,
        health: state.player.health,
        armour: state.player.armour,
        garage: state.garage.owned,
        districts: state.districts.list.map((d) => d.standing),
        savedAt: Date.now(),
      };
      localStorage.setItem(this.key, JSON.stringify(data));
      return data;
    } catch (e) {
      return null;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(this.key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  apply(game, data) {
    if (!data) return false;
    game.money = data.money ?? game.money;
    game.respect = data.respect ?? game.respect;
    game.hours = data.hours ?? game.hours;
    game.missions.index = data.missionIndex ?? 0;
    game.missions.stage = data.missionStage ?? 0;
    game.missions.done = game.missions.index >= game.missions.jobs.length;
    game.missions.resetTimer();
    game.player.health = data.health ?? 100;
    game.player.armour = data.armour ?? 0;
    game.player.group.position.set(data.px ?? -238, 0, data.pz ?? -12);
    if (Array.isArray(data.garage)) game.garage.owned = [...data.garage];
    if (Array.isArray(data.districts)) {
      data.districts.forEach((s, i) => {
        if (game.districts.list[i]) game.districts.list[i].standing = s;
      });
    }
    return true;
  }
}
