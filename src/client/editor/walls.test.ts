// Murs et sols de l'éditeur de niveaux (ADR-018, étape 2), sur les vraies salles : la règle des pièces redonne
// celles d'origine, les collisions sont celles du convertisseur, et un mur peint arrête bien un robot.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EditorModel, buildCatalog } from './model.ts';
import { cellOf, editWalls, expectedPieces, lineCells, wallRectsOf } from './walls.ts';
import { levelProblem, serializeLevel } from '../../sim/levelFile.ts';
import { World } from '../../sim/world.ts';
import type { LevelData, LevelWall, SpriteManifest } from '../../sim/types.ts';

const load = (room: string): LevelData => JSON.parse(readFileSync(new URL(`../../../public/levels/${room}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;
const open = (room: string): EditorModel => {
  const level = load(room);
  return new EditorModel(level, buildCatalog([level]));
};
const shape = (w: LevelWall): string => `${w.object.replace(/^obj_mur_(epais|fin)_?/, '') || 'droit'}@${((w.angle % 360) + 360) % 360}`;

test('la règle des pièces redonne presque toutes les pièces des salles d\'origine', () => {
  for (const room of ['rm_world2', 'rm_world2_1']) {
    const walls = load(room).walls;
    const expected = expectedPieces(walls);
    const same = walls.filter((w, i) => {
      const e = expected[i];
      const turn = (a: number): number => ((a % 360) + 360) % 360;
      // un mur droit est le même à un demi-tour près
      return w.object === e.object && (turn(w.angle) === turn(e.angle) || (/(epais|fin)$/.test(w.object) && turn(w.angle) % 180 === turn(e.angle) % 180));
    }).length;
    assert.ok(same / walls.length > 0.97, `${room} : ${same}/${walls.length}`);
  }
});

test('les rectangles de collision refaits depuis les cases sont ceux du convertisseur', () => {
  // l'étage est tel que le convertisseur l'a écrit : même liste, dans le même ordre
  const upper = load('rm_world2_1');
  assert.deepEqual(wallRectsOf(upper.walls), upper.wallRects);
  // le rez-de-chaussée a été retouché à la main (aile est) : le découpage diffère, pas la surface couverte
  const ground = load('rm_world2');
  const cover = (rects: number[][]): Set<string> => {
    const cells = new Set<string>();
    for (const [x, y, w, h, thick] of rects) for (let a = x; a < x + w; a += 16) for (let b = y; b < y + h; b += 16) cells.add(`${thick}:${a},${b}`);
    return cells;
  };
  assert.deepEqual([...cover(wallRectsOf(ground.walls))].sort(), [...cover(ground.wallRects)].sort());
});

test('peindre un trait pose bouts et pièces droites ; une branche fait un T ; la gomme referme', () => {
  // un coin vide, loin de tout mur
  const base: LevelWall[] = [];
  const line = editWalls(base, { add: { thick: false, cells: lineCells(false, { x: 1000, y: 1000 }, { x: 1150, y: 1010 }) } });
  assert.deepEqual(line.map(shape), ['bout@0', 'droit@0', 'droit@0', 'droit@0', 'bout@180']);
  assert.deepEqual(line.map((w) => [w.x, w.y]), [[1008, 1008], [1040, 1008], [1072, 1008], [1104, 1008], [1136, 1008]]);
  // une branche vers le sud depuis la case du milieu
  const branch = editWalls(line, { add: { thick: false, cells: lineCells(false, { x: 1072, y: 1040 }, { x: 1072, y: 1100 }) } });
  assert.equal(shape(branch[2]), 'T@0');
  assert.deepEqual(branch.slice(5).map(shape), ['droit@90', 'droit@90', 'bout@90']);
  assert.equal(branch[0], line[0], 'les pièces loin du coup de pinceau ne sont pas refaites');
  // une case seule est un plot ; un mur fin qui touche un mur épais s'y raccorde sans bout
  assert.deepEqual(editWalls([], { add: { thick: true, cells: [{ cx: 5, cy: 5 }] } }).map(shape), ['plot@0']);
  const joined = editWalls(editWalls([], { add: { thick: true, cells: [{ cx: 5, cy: 5 }] } }), { add: { thick: false, cells: [{ cx: 12, cy: 10 }, { cx: 13, cy: 10 }] } });
  assert.deepEqual(joined.slice(1).map(shape), ['droit@0', 'bout@180']);
  // la gomme retire ce que son rectangle recouvre, et les voisines redeviennent des bouts
  const cut = editWalls(line, { erase: { x0: 1060, y0: 1000, x1: 1080, y1: 1016 } });
  assert.deepEqual(cut.map(shape), ['bout@0', 'bout@180', 'bout@0', 'bout@180']);
  assert.equal(editWalls(line, { erase: { x0: 0, y0: 0, x1: 10, y1: 10 } }), line, 'rien sous la gomme : rien ne change');
  assert.deepEqual(cellOf(line[0]), { x0: 992, y0: 992 });
});

test('un mur peint dans l\'éditeur entre dans la salle, arrête un robot, et s\'annule', () => {
  const model = open('rm_world2_1');
  const before = serializeLevel(model.toLevel());
  const spawn = model.base.instances.find((i) => i.object === 'obj_spawnHeros') ?? model.base.instances[0];
  // un endroit libre dans la salle d'origine
  const free = new World(model.base, sprites, 'PetBot', 1);
  let spot = { x: 0, y: 0 };
  search: for (let x = 400; x < model.base.width - 400; x += 64) {
    for (let y = 400; y < model.base.height - 400; y += 64) {
      if (free.collision.circleFree(x + 32, y + 32, 120, 1)) {
        spot = { x, y };
        break search;
      }
    }
  }
  assert.ok(spot.x > 0 && spawn, 'un coin libre existe');
  const cells = lineCells(true, { x: spot.x - 64, y: spot.y + 32 }, { x: spot.x + 100, y: spot.y + 32 });
  model.apply([], null, editWalls(model.walls.walls, { add: { thick: true, cells } }));
  assert.equal(model.dirty, true);
  const level = model.toLevel();
  assert.equal(level.walls.length, model.base.walls.length + cells.length);
  assert.equal(levelProblem(level), null);
  assert.deepEqual(level.wallRects, wallRectsOf(level.walls));
  for (const wall of level.walls) assert.ok(level.objects[wall.object], `type déclaré : ${wall.object}`);
  const walled = new World(level, sprites, 'PetBot', 1);
  assert.equal(walled.collision.circleFree(spot.x + 32, spot.y + 32, 20, 1), false, 'le mur bloque');
  assert.ok(model.undo());
  assert.equal(serializeLevel(model.toLevel()), before);
  assert.equal(model.dirty, false);
  assert.ok(model.redo());
  assert.equal(model.toLevel().walls.length, model.base.walls.length + cells.length);
});

test('un sol posé va à la fin de la liste, donc par-dessus ; « derrière » le glisse sous les autres', () => {
  const model = open('rm_world2');
  const floor = model.makeFloor('til_sol_parquet', 320, 320, 640, 480);
  model.apply([{ ent: floor, before: null, after: floor.data }]);
  let level = model.toLevel();
  assert.equal(level.floors.length, model.base.floors.length + 1);
  assert.deepEqual(level.floors.at(-1), { object: 'obj_textureGenerator_parquet', tileset: 'til_sol_parquet', x: 320, y: 320, w: 640, h: 480, phaseX: 0, phaseY: 0 });
  assert.equal(levelProblem(level), null);
  assert.ok(model.reorder([floor], 'back'));
  level = model.toLevel();
  assert.equal(level.floors[0].x, 320);
  assert.deepEqual(level.instances, model.base.instances, 'les objets ne bougent pas');
  // porte posée avec le mur qu'elle ouvre : une seule étape à annuler
  const door = model.makeInstance('obj_automaticDoor', 2000, 1376, 0)!;
  const cut = editWalls(model.walls.walls, { erase: { x0: 1872, y0: 1360, x1: 2128, y1: 1392 } });
  assert.ok(cut.length < model.walls.walls.length, 'il y avait un mur à cet endroit');
  model.apply([{ ent: door, before: null, after: door.data }], null, cut);
  assert.equal(model.toLevel().walls.length, cut.length);
  assert.ok(model.undo());
  assert.equal(model.toLevel().walls.length, model.base.walls.length);
  assert.ok(!model.ents.includes(door));
});
