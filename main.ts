// SOLARA — dossier runner. Builds makefun/dossier/v1 from game/ and
// screenshots/ and writes it to MAKEFUN_OUTPUT_DIR (default ./out).
// Run: MAKEFUN_OUTPUT_DIR=out node main.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || join(root, 'out');
mkdirSync(outDir, { recursive: true });
const bytes = buildDossier(root, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), bytes);
console.log(`dossier: ${bytes.length} bytes -> ${join(outDir, 'dossier.json')}`);
