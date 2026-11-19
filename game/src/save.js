// SOLARA — save/load: one localStorage slot for the run state.
// Re-authored for the @witty-meteor-32 recording-M build.

const SLOT = 'solara-save-v3';

// Snapshot the fields a continue needs: cash, standing, progress,
// clock and where Kai stood when the player saved.
export function saveGame(g) {
  const snap = {
    money: g.money,
    respect: g.respect,
    rp: g.rp || 0,
    missionIndex: g.missionIndex,
    hours: g.hours,
    px: g.px,
    pz: g.pz,
    savedAt: Date.now(),
  };
  try {
    localStorage.setItem(SLOT, JSON.stringify(snap));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame() {
  let raw = null;
  try {
    raw = localStorage.getItem(SLOT);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SLOT);
  } catch (e) {
    /* storage unavailable — nothing to clear */
  }
}
