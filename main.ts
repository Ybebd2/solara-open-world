// SOLARA (gta6-01, @witty-meteor-32) — open-world crime game in a
// golden-hour pier city. Kai Mercer takes jobs from fixer Lupe: steal
// cars, outrun the PCPD, and survive the police helicopter that joins
// the chase once the heat hits 3 stars. The world is 3D, built on
// three.js vendored under game/, with a dense HUD, a wanted system and
// timed deliveries. This file is the entrypoint program (Node 22,
// standard library only). It hands the game in by copying game/ and
// screenshots/ from beside this file to /output and writing
// /output/dossier.json — the summary the judge reads — with the vendored
// make.fun library.
//
// Serve the game locally with `node serve.ts`, then open http://localhost:8903.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files in game/ or 48 MiB of game files, in
// all, or a path under game/ over 1000 bytes).
const bytes = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), bytes);
console.log(`dossier: ${bytes.length} bytes -> ${join(out, 'dossier.json')}`);
