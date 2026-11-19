// SOLARA — save: localStorage save/load. Built fresh for the
// @witty-meteor-32 build.

const KEY = 'solara-save-v3';

export function saveGame(state) {
  try {
    const data = {
      money: state.money,
      respect: state.respect,
      rp: state.rp || 0,
      missionIndex: state.missionIndex,
      hours: state.hours,
      px: state.px,
      pz: state.pz,
      savedAt: Date.now(),
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch (e) { return false; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}
