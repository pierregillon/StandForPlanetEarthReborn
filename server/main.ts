// Serveur du jeu : sert les fichiers statiques (dist/ puis public/) et héberge la partie multijoueur
// (WebSocket sur /ws, voir ADR-014).
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { createReadStream, readFileSync, statSync } from 'node:fs';
import { WebSocketServer } from 'ws';
import { Lobby } from './game.ts';
import type { Peer } from './game.ts';
import type { ClientMessage } from '../src/net/messages.ts';
import { STEPS_PER_SECOND } from '../src/sim/config.ts';
import { DRILL_AREA, GROUND_FLOOR, UPPER_FLOOR } from '../src/sim/session.ts';
import type { LevelData, SpriteManifest } from '../src/sim/types.ts';
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

interface FoundFile {
  path: string;
  mtimeMs: number;
  size: number;
}

function findFile(urlPath: string): FoundFile | null {
  const clean = normalize(decodeURIComponent(urlPath)).replace(/^([/\\])+/, '');
  if (clean.split(/[/\\]/).includes('..')) return null;
  for (const dir of STATIC_DIRS) {
    const file = join(dir, clean === '' ? 'index.html' : clean);
    if (!file.startsWith(dir)) continue;
    try {
      const st = statSync(file);
      if (st.isFile()) return { path: file, mtimeMs: st.mtimeMs, size: st.size };
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
    // le navigateur garde les fichiers et demande seulement s'ils ont changé (réponse 304, sans contenu)
    const etag = `"${Math.round(file.mtimeMs).toString(36)}-${file.size.toString(36)}"`;
    if (req.headers['if-none-match'] === etag) {
      res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' });
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[extname(file.path).toLowerCase()] ?? 'application/octet-stream',
      'Content-Length': file.size,
      'Cache-Control': 'no-cache',
      ETag: etag,
    });
    createReadStream(file.path).pipe(res);
  });
  attachGame(server);
  server.listen(port, () => {
    console.log(`Stand For Planet Earth : http://localhost:${port}`);
  });
  return server;
}

/**
 * Partie multijoueur : une WebSocket par navigateur, un seul salon pour l'instant, et l'horloge qui fait
 * avancer la simulation à 60 steps par seconde.
 */
function attachGame(server: Server): void {
  const load = <T>(path: string): T => JSON.parse(readFileSync(join(ROOT, 'public', path), 'utf8')) as T;
  const levels: Record<string, LevelData> = {};
  for (const room of [GROUND_FLOOR, UPPER_FLOOR, DRILL_AREA]) levels[room] = load<LevelData>(`levels/${room}.json`);
  const peers = new Map<Peer, { bytesWritten: number; bytesRead: number }>();
  const lobby = new Lobby(levels, load<SpriteManifest>('assets/sprites.json'), () => [...peers.keys()], process.env.SFPE_DEBUG === '1' || process.argv.includes('--sfpe-debug'));

  // les instantanés sont du JSON répétitif : la compression le réduit beaucoup, pour un coût négligeable
  const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 16 * 1024, perMessageDeflate: { threshold: 200 } });
  let nextId = 1;
  wss.on('connection', (ws, req) => {
    const peer: Peer = {
      id: nextId++,
      name: 'Player',
      send: (text) => {
        if (ws.readyState === ws.OPEN) ws.send(text);
      },
    };
    peers.set(peer, req.socket);
    ws.on('message', (data) => {
      let msg: ClientMessage;
      try {
        msg = JSON.parse(String(data)) as ClientMessage;
      } catch {
        return;
      }
      if (!msg || typeof msg !== 'object') return;
      if (msg.t === 'hello') {
        peer.name = String(msg.name ?? '').replace(/[^\w \-]/g, '').trim().slice(0, 14) || `Player ${peer.id}`;
        peer.send(JSON.stringify(lobby.state(peer)));
        return;
      }
      lobby.handle(peer, msg);
    });
    ws.on('close', () => {
      peers.delete(peer);
      lobby.disconnect(peer);
    });
    ws.on('error', () => ws.close());
  });

  const stepMs = 1000 / STEPS_PER_SECOND;
  let last = performance.now();
  let late = 0;
  setInterval(() => {
    const now = performance.now();
    // jamais plus de 6 steps d'un coup : après un blocage, le jeu ralentit au lieu de s'emballer
    late = Math.min(late + now - last, stepMs * 6);
    last = now;
    while (late >= stepMs) {
      late -= stepMs;
      lobby.tick();
    }
  }, 4);

  // mesure du trafic réel (après compression), affichée toutes les 10 s pendant une partie
  let sentBefore = 0;
  let receivedBefore = 0;
  setInterval(() => {
    let sent = 0;
    let received = 0;
    for (const socket of peers.values()) {
      sent += socket.bytesWritten;
      received += socket.bytesRead;
    }
    const players = Math.max(1, lobby.playerCount);
    if (lobby.playing) {
      const kb = (bytes: number): string => (Math.max(0, bytes) / 10 / players / 1024).toFixed(1);
      console.log(`[multi] ${lobby.playerCount} joueur(s) : ${kb(sent - sentBefore)} ko/s envoyés et ${kb(received - receivedBefore)} ko/s reçus par joueur`);
    }
    sentBefore = sent;
    receivedBefore = received;
  }, 10_000);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  startServer();
}
