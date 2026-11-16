// Convertit les salles GameMaker listées dans tools/assets.config.json (clé
// `rooms`) en public/levels/<salle>.json. Format : docs/formats-donnees.md.
// Usage : npm run convert-rooms
import fs from 'node:fs';
import path from 'node:path';
import { inlineJson, linesArray, linesObject, writeIfChanged } from './lib/output.ts';
import { PUBLIC_DIR, loadConfig, loadProject } from './lib/reference.ts';
import { convertRoom } from './lib/rooms.ts';
import type { Level, RoomConversion } from './lib/rooms.ts';

const LEVELS_DIR = path.join(PUBLIC_DIR, 'levels');

/**
 * Valeurs relevées dans docs/reference/jeu-original/03-niveaux-et-interface.md
 * (§1.3), pour signaler tout écart : instances (générateurs de sol compris),
 * tuiles de murs épais et fins, générateurs de sol, décalques.
 */
const EXPECTED: Record<string, { instances: number; thick: number; thin: number; floors: number; decals: number }> = {
  rm_world2: { instances: 570, thick: 622, thin: 1240, floors: 33, decals: 37 },
  rm_world2_1: { instances: 405, thick: 393, thin: 1249, floors: 27, decals: 3 },
  rm_world2_2: { instances: 8, thick: 0, thin: 0, floors: 0, decals: 0 },
  rm_world4: { instances: 260, thick: 723, thin: 243, floors: 22, decals: 0 },
  rm_world4_1: { instances: 535, thick: 716, thin: 2811, floors: 34, decals: 1162 },
};

function serializeLevel(level: Level): string {
  const lines = [
    '{',
    `  "name": ${JSON.stringify(level.name)}, "width": ${level.width}, "height": ${level.height},`,
    `  "background": ${inlineJson(level.background)},`,
    `  "layers": ${linesArray(level.layers, '  ')},`,
    `  "objects": ${linesObject(level.objects as Record<string, unknown>, '  ')},`,
    `  "instances": ${linesArray(level.instances, '  ')},`,
    `  "walls": ${linesArray(level.walls, '  ')},`,
    `  "wallRects": ${linesArray(level.wallRects, '  ')},`,
    `  "floors": ${linesArray(level.floors, '  ')},`,
    `  "decals": ${linesArray(level.decals, '  ')}`,
    '}',
    '',
  ];
  return lines.join('\n');
}

function printSummary(conversion: RoomConversion): number {
  const { level, stats, warnings } = conversion;
  let gaps = 0;
  console.log(`\n=== ${level.name} (${level.width}x${level.height}) ===`);
  console.log(
    `Fond : ${level.background.sprite ?? 'couleur unie'} ${level.background.color}` +
      `${level.background.tiled ? ', répété' : ''}`,
  );
  console.log(
    `Instances : ${stats.totalInstances} (dont ${level.floors.length} générateurs de sol` +
      `${stats.ignoredInstances ? `, ${stats.ignoredInstances} ignorées en plus` : ''}) ; ` +
      `${Object.keys(level.objects).length} types d'objets (pièces de murs comprises)`,
  );
  const counts = [...stats.byObject].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  console.log(`  ${counts.map(([name, count]) => `${name}×${count}`).join(', ') || '(aucune)'}`);
  console.log(
    `Murs : ${stats.thickWalls} épais, ${stats.thinWalls} fins → ${level.wallRects.length} rectangles fusionnés ` +
      `(${stats.thickRects} épais, ${stats.thinRects} fins)`,
  );
  console.log(`Sols : ${level.floors.length} ; décalques : ${level.decals.length}`);

  const expected = EXPECTED[level.name];
  if (expected) {
    const checks: [string, number, number][] = [
      ['instances', stats.totalInstances, expected.instances],
      ['tuiles de murs épais', stats.thickTilesNonEmpty, expected.thick],
      ['tuiles de murs fins', stats.thinTilesNonEmpty, expected.thin],
      ['murs épais créés', stats.thickWalls, expected.thick],
      ['murs fins créés', stats.thinWalls, expected.thin],
      ['générateurs de sol', level.floors.length, expected.floors],
      ['décalques', level.decals.length, expected.decals],
    ];
    const bad = checks.filter(([, actual, wanted]) => actual !== wanted);
    gaps = bad.length;
    if (bad.length === 0) {
      console.log('Contrôle (spec §1.3) : conforme.');
    } else {
      for (const [label, actual, wanted] of bad) {
        console.log(`ÉCART (spec §1.3) : ${label} = ${actual}, attendu ${wanted}.`);
      }
    }
  } else {
    console.log('Contrôle (spec §1.3) : pas de valeurs de référence pour cette salle.');
  }
  for (const warning of warnings) console.log(`  ! ${warning}`);
  return gaps;
}

function main(): void {
  const config = loadConfig();
  const project = loadProject();
  if (config.rooms.length === 0) console.log('Aucune salle dans tools/assets.config.json (clé "rooms").');

  let gaps = 0;
  const written: string[] = [];
  for (const roomName of config.rooms) {
    const conversion = convertRoom(project, roomName);
    const file = path.join(LEVELS_DIR, `${roomName}.json`);
    const content = serializeLevel(conversion.level);
    JSON.parse(content); // garde-fou : la sortie doit rester du JSON valide
    const changed = writeIfChanged(file, content);
    gaps += printSummary(conversion);
    written.push(`${path.relative(process.cwd(), file)} (${(content.length / 1024).toFixed(0)} Ko${changed ? '' : ', inchangé'})`);
  }

  // Sorties obsolètes : fichiers portant le nom d'une salle du projet d'origine
  // qui n'est plus dans la configuration. Les autres fichiers ne sont pas touchés.
  if (fs.existsSync(LEVELS_DIR)) {
    const roomFolders = new Set(fs.readdirSync(path.join(project.refDir, 'rooms')));
    for (const entry of fs.readdirSync(LEVELS_DIR).sort()) {
      const name = entry.replace(/\.json$/, '');
      if (entry.endsWith('.json') && roomFolders.has(name) && !config.rooms.includes(name)) {
        fs.rmSync(path.join(LEVELS_DIR, entry));
        console.log(`Supprimé (salle retirée de la configuration) : ${entry}`);
      }
    }
  }

  console.log(`\nFichiers : ${written.join(', ') || '(aucun)'}`);
  console.log(gaps === 0 ? 'Aucun écart avec la spec.' : `${gaps} écart(s) avec la spec : voir ci-dessus.`);
}

main();
