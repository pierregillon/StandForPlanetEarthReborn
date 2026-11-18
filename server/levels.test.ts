// Sauvegarde de l'éditeur de niveaux (ADR-018, ADR-019), dans un dossier jetable : le fichier est réécrit,
// rien n'est commité, et le résumé dit ce qui a changé.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
  // passer un objet devant ou derrière ne change que l'ordre du fichier
  const swapped = original();
  swapped.instances.push(swapped.instances.shift()!);
  assert.equal(describeChanges(before, swapped), 'ordre d\'affichage modifié');
});

test('saveLevel écrit le fichier, sans toucher à Git, et dit ce qui a changé', () => {
  const root = mkdtempSync(join(tmpdir(), 'sfpe-levels-'));
  try {
    mkdirSync(join(root, 'public', 'levels'), { recursive: true });
    const level = original();
    const file = join(root, 'public', 'levels', `${level.name}.json`);
    writeFileSync(file, serializeLevel(level));

    assert.deepEqual(saveLevel(root, level), { ok: true, summary: '', note: 'Nothing to save: the level is unchanged.' });

    const edited: LevelData = { ...level, instances: [...level.instances, { ...level.instances[0], id: 'ed_test', x: 123 }] };
    assert.deepEqual(saveLevel(root, edited), { ok: true, summary: '1 objet ajouté', note: '' });
    assert.equal(readFileSync(file, 'utf8'), serializeLevel(edited));
    // une ligne par élément : la retouche n'ajoute qu'une ligne (et la virgule de la précédente)
    const lines = (text: string): Set<string> => new Set(text.split('\n'));
    const was = lines(serializeLevel(level));
    assert.equal([...lines(serializeLevel(edited))].filter((l) => !was.has(l)).length, 2);
    // rien d'autre n'est créé : pas de dépôt, pas de fichier à côté (ADR-019)
    assert.deepEqual(readdirSync(root), ['public']);
    assert.deepEqual(readdirSync(join(root, 'public', 'levels')), [`${level.name}.json`]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
