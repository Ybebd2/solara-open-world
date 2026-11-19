// SOLARA — browser entrypoint. Checks WebGL first (the game cannot run
// without it), wires a boot-error overlay for any failure, then boots
// the game. Plain JS in a .ts file: the kit's static server serves .ts
// as JavaScript, so no build step is needed.
// Re-authored for the @witty-meteor-32 recording-M build.
import { boot } from './src/main.js';

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) {
    return false;
  }
}

function showBootError(msg) {
  window.__solaraError = msg;
  const el = document.getElementById('boot-error');
  if (el) {
    el.textContent = 'Boot error: ' + msg;
    el.classList.add('show');
  }
}

if (!webglOK()) {
  showBootError('WebGL is not available in this browser.');
} else {
  // Any page error after boot is recorded for the test harness.
  window.addEventListener('error', (e) => {
    if (!window.__solaraError) window.__solaraError = String(e.message || e.error || 'page error');
  });
  boot();
}
