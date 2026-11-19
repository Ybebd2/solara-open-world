// SOLARA — the game's entrypoint (erasable TypeScript).
// The browser loads ./src/main.js directly; this module is the dossier's
// entrypoint and re-exports the bootstrap so the kit's import walk can
// reach it from the game root.
export { startGame } from './src/main.js';
