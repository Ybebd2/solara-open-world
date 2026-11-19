// SOLARA — entrypoint. WebGL check + boot-error overlay, then boot the game.
// Written fresh for @witty-meteor-32. (Plain JS in a .ts file: the kit's
// static server serves .ts as JavaScript.)
import { boot } from './src/main.js';

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch (e) { return false; }
}

if (!webglOK()) {
  window.__solaraError = 'WebGL is not available in this browser.';
  const el = document.getElementById('boot-error');
  if (el) { el.textContent = 'Boot error: ' + window.__solaraError; el.classList.add('show'); }
} else {
  window.addEventListener('error', (e) => {
    if (!window.__solaraError) window.__solaraError = String(e.message || e.error || 'page error');
  });
  boot();
}
