// Sauvegarde de l'éditeur de niveaux (ADR-018) : PUT /api/levels/<salle> réécrit public/levels/<salle>.json
// et en fait un commit, pour que l'historique des cartes soit dans Git sans y penser.
// Réservé à la machine qui fait tourner le serveur : l'éditeur écrit sur le disque.
import { execFile } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { join } from 'node:path';
import { levelProblem, serializeLevel } from '../src/sim/levelFile.ts';
import type { LevelData } from '../src/sim/types.ts';

const MAX_BYTES = 8 * 1024 * 1024;
const LOCAL = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

export interface SaveResult {
  ok: boolean;
  /** Ce qui a changé depuis la version précédente, en une phrase ; vide si rien n'a changé. */
  summary: string;
  /** Empreinte courte du commit créé ; null s'il n'y en a pas eu (rien de changé, ou Git a refusé : voir `note`). */
  commit: string | null;
  note: string;
}

function git(root: string, args: string[]): Promise<{ code: number; out: string }> {
  return new Promise((done) => {
    execFile('git', args, { cwd: root }, (error, stdout, stderr) => {
      const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0;
      done({ code, out: `${stdout}${stderr}`.trim() });
    });
  });
}

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** Compare deux versions d'une salle : ce qui a été ajouté, retiré ou modifié, par famille d'éléments. */
export function describeChanges(before: LevelData, after: LevelData): string {
  const parts: string[] = [];
  const old = new Map(before.instances.map((i) => [i.id, JSON.stringify(i)]));
  let added = 0;
  let changed = 0;
  for (const inst of after.instances) {
    const was = old.get(inst.id);
    if (was === undefined) added++;
    else if (was !== JSON.stringify(inst)) changed++;
    old.delete(inst.id);
  }
  if (added) parts.push(`${plural(added, 'objet ajouté', 'objets ajoutés')}`);
  if (changed) parts.push(`${plural(changed, 'objet modifié', 'objets modifiés')}`);
  if (old.size) parts.push(`${plural(old.size, 'objet retiré', 'objets retirés')}`);
  // les autres éléments n'ont pas d'identifiant : on compte ceux qui n'ont pas leur pareil dans l'autre version
  const lists: [keyof LevelData, string, string][] = [
    ['decals', 'décalque', 'décalques'], ['walls', 'pièce de mur', 'pièces de mur'], ['floors', 'sol', 'sols'],
  ];
  for (const [key, one, many] of lists) {
    const left = new Map<string, number>();
    for (const item of before[key] as unknown[]) {
      const k = JSON.stringify(item);
      left.set(k, (left.get(k) ?? 0) + 1);
    }
    let fresh = 0;
    for (const item of after[key] as unknown[]) {
      const k = JSON.stringify(item);
      const n = left.get(k) ?? 0;
      if (n > 0) left.set(k, n - 1);
      else fresh++;
    }
    let gone = 0;
    for (const n of left.values()) gone += n;
    if (fresh) parts.push(`${plural(fresh, one, many)} en plus`);
    if (gone) parts.push(`${plural(gone, one, many)} en moins`);
  }
  return parts.join(', ');
}

/** Écrit la salle et en fait un commit, limité à son fichier. */
export async function saveLevel(root: string, level: LevelData): Promise<SaveResult> {
  const relative = `public/levels/${level.name}.json`;
  const file = join(root, relative);
  const before = readFileSync(file, 'utf8');
  const content = serializeLevel(level);
  if (content === before) return { ok: true, summary: '', commit: null, note: 'Nothing to save: the level is unchanged.' };
  const summary = describeChanges(JSON.parse(before) as LevelData, level) || 'mise en forme';
  writeFileSync(file, content);
  const message = `Carte ${level.name} (éditeur) : ${summary}`;
  const add = await git(root, ['add', '--', relative]);
  if (add.code !== 0) return { ok: true, summary, commit: null, note: `Saved, but not committed: ${add.out || 'git add failed'}` };
  // `--only` : seul ce fichier part dans le commit, même si d'autres changements sont déjà indexés
  const commit = await git(root, ['commit', '--only', '-m', message, '--', relative]);
  if (commit.code !== 0) return { ok: true, summary, commit: null, note: `Saved, but not committed: ${commit.out || 'git commit failed'}` };
  const hash = await git(root, ['rev-parse', '--short', 'HEAD']);
  return { ok: true, summary, commit: hash.code === 0 ? hash.out : null, note: '' };
}

function readBody(req: IncomingMessage): Promise<string | null> {
  return new Promise((done) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        done(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => done(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => done(null));
  });
}

/**
 * Traite une requête de l'éditeur. Renvoie faux si l'adresse n'est pas la sienne. `onSaved` reçoit la salle
 * écrite : le serveur de partie s'en sert pour la prochaine partie à plusieurs.
 */
export function handleEditorRequest(root: string, req: IncomingMessage, res: ServerResponse, onSaved: (level: LevelData) => void): boolean {
  const urlPath = (req.url ?? '/').split('?')[0];
  const match = /^\/api\/levels\/([\w-]+)$/.exec(urlPath);
  if (!match) return false;
  const reply = (status: number, body: unknown): void => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  const name = match[1];
  // l'éditeur écrit sur le disque : seul un navigateur de cette machine, sur la page du jeu, y a droit
  const origin = req.headers.origin;
  if (!LOCAL.has(req.socket.remoteAddress ?? '') || (origin !== undefined && origin !== `http://${req.headers.host}`)) {
    reply(403, { ok: false, note: 'The level editor only saves from the machine that runs the game server.' });
    return true;
  }
  if (req.method !== 'PUT') {
    reply(405, { ok: false, note: 'Use PUT.' });
    return true;
  }
  if (!existsSync(join(root, 'public', 'levels', `${name}.json`))) {
    reply(404, { ok: false, note: `Unknown level: ${name}` });
    return true;
  }
  void readBody(req).then(async (text) => {
    let level: unknown;
    try {
      level = text === null ? null : JSON.parse(text);
    } catch {
      level = null;
    }
    const problem = level === null ? 'unreadable or too large' : levelProblem(level) ?? ((level as LevelData).name !== name ? 'name does not match the address' : null);
    if (problem) {
      reply(400, { ok: false, note: `Level refused: ${problem}` });
      return;
    }
    try {
      const result = await saveLevel(root, level as LevelData);
      onSaved(level as LevelData);
      reply(200, result);
    } catch (error) {
      reply(500, { ok: false, note: `Could not write the level: ${error instanceof Error ? error.message : String(error)}` });
    }
  });
  return true;
}
