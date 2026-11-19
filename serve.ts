// SOLARA — zero-dependency static file server. Serves the repo root so
// the game runs offline in a browser; .ts files are served as
// JavaScript (both main.ts files are plain JS). Usage:
//   node serve.ts <port>
// Defaults to port 8901; the screenshot harness uses 8903.
// Re-authored for the @witty-meteor-32 recording-M build.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const PORT = Number(process.argv[2] || 8901);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.ts': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/game/index.html';
    // Strip any leading ../ segments, then require the result to stay
    // inside the repo root — no directory traversal.
    const file = resolve(join(ROOT, normalize(p).replace(/^(\.\.[\/\\])+/, '')));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[extname(file)] || 'application/octet-stream',
      'cache-control': 'no-store',
    });
    res.end(data);
  } catch (e) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  }
});

server.listen(PORT, () => console.log(`SOLARA serving ${ROOT} on http://localhost:${PORT}/game/index.html`));
