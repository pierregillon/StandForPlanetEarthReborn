// Serveur du jeu : sert les fichiers statiques (dist/ puis public/).
// Le code serveur du futur multijoueur vivra ici (voir ADR-002).
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { createReadStream, statSync } from 'node:fs';
import { extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const STATIC_DIRS = [join(ROOT, 'dist'), join(ROOT, 'public')];

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.map': 'application/json',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg',
  '.ttf': 'font/ttf',
  '.woff2': 'font/woff2',
};

function findFile(urlPath: string): string | null {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  if (clean.split(/[/\\]/).includes('..')) return null;
  for (const dir of STATIC_DIRS) {
    const file = join(dir, clean === '' ? 'index.html' : clean);
    if (!file.startsWith(dir)) continue;
    try {
      const st = statSync(file);
      if (st.isFile()) return file;
    } catch {
      // essai du dossier suivant
    }
  }
  return null;
}

export function startServer(port = Number(process.env.PORT ?? 3000)): Server {
  const server = createServer((req, res) => {
    const urlPath = (req.url ?? '/').split('?')[0];
    const file = findFile(urlPath === '/' ? '/index.html' : urlPath);
    if (!file) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    createReadStream(file).pipe(res);
  });
  server.listen(port, () => {
    console.log(`Stand For Planet Earth : http://localhost:${port}`);
  });
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
