// SOLARA v3 — a gta6-01 entry (Node 22, standard library only). The game is
// this directory's game/ folder: plain static files a desktop browser loads
// offline (game/index.html and its ES modules, three.js vendored under
// game/vendor/, no network request). The program hands it in: it copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored
// make.fun library. It fails fast with a clear message when the game entry
// point is missing, and prints a build summary (dossier size, screenshot
// count, game file count) so a broken hand-in is spotted before it is
// submitted.
//
// v3: golden-hour lighting, a dense HUD, detailed cars and buildings, an
// 8-mission chain with named characters, a police helicopter, a garage, a
// radio, a full map, and a pre-start intro.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const gameEntry = join(here, 'game', 'index.html');
if (!existsSync(gameEntry)) {
  throw new Error(`SOLARA v3 build failed: game entry point missing at ${gameEntry}`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// Fail fast when no screenshot shipped: the dossier needs at least one
// image, and a hand-in with an empty screenshots/ folder would be judged
// on text alone. This catches a broken render step before submission.
const shotFiles = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  : [];
if (shotFiles.length === 0) {
  throw new Error('SOLARA v3 build failed: no screenshots in screenshots/ — the dossier needs at least one');
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Build summary: dossier size, how many screenshots shipped, how many game
// files went in — read back from what was actually written, not assumed.
const dossierBytes = readFileSync(join(out, 'dossier.json')).length;
const shotCount = readdirSync(join(out, 'screenshots')).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).length;
const countFiles = (dir) => readdirSync(dir, { withFileTypes: true }).reduce(
  (n, e) => n + (e.isDirectory() ? countFiles(join(dir, e.name)) : 1), 0);
console.log(`SOLARA v3 build OK: dossier ${dossierBytes} bytes, ${shotCount} screenshots, ${countFiles(join(out, 'game'))} game files -> ${out}`);
