// SOLARA — game entrypoint.
// The real boot lives in ./src/main.js (the page loads that module
// directly); this file re-exports it so the dossier lists the load
// order plainly.
export { startGame } from './src/main.js';
