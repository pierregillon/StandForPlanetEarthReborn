// Sauvegarde de l'éditeur de niveaux (ADR-018), dans un dépôt Git jetable : le fichier est réécrit et commité
// seul, avec un message qui dit ce qui a changé.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { describeChanges, saveLevel } from './levels.ts';
import { serializeLevel } from '../src/sim/levelFile.ts';
import type { LevelData } from '../src/sim/types.ts';

const original = (): LevelData => JSON.parse(readFileSync(new URL('../public/levels/rm_world2_2.json', import.meta.url), 'utf8')) as LevelData;

test('describeChanges compte ce qui est ajouté, modifié et retiré', () => {
  const before = original();
  const after = original();
  after.instances[0] = { ...after.instances[0], x: after.instances[0].x + 10 };
  after.instances.push({ ...after.instances[1], id: 'ed_new' });
  after.instances.splice(2, 1);
  after.decals.push({ sprite: 'spr_tapis', x: 0, y: 0, angle: 0, scaleX: 1, scaleY: 1, tint: '#ffffff', alpha: 1, frame: 0, depth: 600 });
  assert.equal(describeChanges(before, after), '1 objet ajouté, 1 objet modifié, 1 objet retiré, 1 décalque en plus');
  assert.equal(describeChanges(before, before), '');
});

test('saveLevel écrit le fichier et fait un commit limité à ce fichier', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sfpe-levels-'));
  const git = (...args: string[]): string => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  try {
    mkdirSync(join(root, 'public', 'levels'), { recursive: true });
    const level = original();
    const file = join(root, 'public', 'levels', `${level.name}.json`);
    writeFileSync(file, serializeLevel(level));
    writeFileSync(join(root, 'other.txt'), 'un');
    git('init', '-q');
    git('config', 'user.email', 'test@example.invalid');
    git('config', 'user.name', 'Test');
    git('config', 'commit.gpgsign', 'false');
    git('add', '.');
    git('commit', '-q', '-m', 'départ');

    const same = await saveLevel(root, level);
    assert.deepEqual([same.ok, same.commit, same.summary], [true, null, '']);

    // un autre fichier est modifié et indexé : il ne doit pas partir dans le commit de la carte
    writeFileSync(join(root, 'other.txt'), 'deux');
    git('add', 'other.txt');
    const edited: LevelData = { ...level, instances: [...level.instances, { ...level.instances[0], id: 'ed_test', x: 123 }] };
    const saved = await saveLevel(root, edited);
    assert.equal(saved.ok, true);
    assert.equal(saved.note, '');
    assert.equal(saved.summary, '1 objet ajouté');
    assert.equal(saved.commit, git('rev-parse', '--short', 'HEAD'));
    assert.equal(readFileSync(file, 'utf8'), serializeLevel(edited));
    assert.equal(git('log', '-1', '--format=%s'), `Carte ${level.name} (éditeur) : 1 objet ajouté`);
    assert.equal(git('show', '--name-only', '--format=', 'HEAD'), `public/levels/${level.name}.json`);
    assert.equal(git('status', '--porcelain'), 'M  other.txt', 'le reste de l\'index est intact');
    // une ligne par élément : le diff de la carte ne montre que l'objet ajouté
    assert.match(git('show', '--stat', '--format=', 'HEAD'), /1 insertion\(\+\), 1 deletion\(-\)|2 insertions\(\+\), 1 deletion\(-\)/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
