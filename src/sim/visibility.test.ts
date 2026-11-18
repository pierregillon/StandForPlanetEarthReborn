// Tests de la zone éclairée par une lampe (GD-038) : les murs font de l'ombre, une porte qui s'ouvre laisse
// passer la lumière.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BLOCK_SIGHT, CollisionWorld, makeBox } from './geom.ts';
import { visibilityPolygon } from './visibility.ts';
import { World } from './world.ts';
import { GROUND_FLOOR } from './session.ts';
import { NO_INPUT } from './types.ts';
import type { LevelData, SpriteManifest } from './types.ts';
import type { Point } from './nav.ts';

/** Le point est-il dans le polygone ? (règle pair-impair) */
function inside(polygon: Point[], x: number, y: number): boolean {
  let odd = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) odd = !odd;
  }
  return odd;
}

test('sans obstacle, la zone éclairée est le disque entier', () => {
  const c = new CollisionWorld(2000, 2000);
  const polygon = visibilityPolygon(c, 1000, 1000, 400, BLOCK_SIGHT);
  for (const p of polygon) assert.ok(Math.abs(Math.hypot(p.x - 1000, p.y - 1000) - 400) < 1e-6);
  assert.ok(inside(polygon, 1300, 1000));
});

test('un mur fait de l\'ombre derrière lui, pas à côté', () => {
  const c = new CollisionWorld(2000, 2000);
  // mur vertical à droite de la lampe, de 200 px de haut
  c.add(makeBox(1200, 1000, 10, 100, 0, BLOCK_SIGHT));
  const polygon = visibilityPolygon(c, 1000, 1000, 400, BLOCK_SIGHT);
  assert.ok(inside(polygon, 1100, 1000), 'devant le mur : éclairé');
  assert.ok(!inside(polygon, 1300, 1000), 'derrière le mur : dans l\'ombre');
  assert.ok(!inside(polygon, 1350, 1100), 'l\'ombre s\'élargit en s\'éloignant');
  assert.ok(inside(polygon, 1200, 1250), 'à côté du mur : éclairé');
  assert.ok(inside(polygon, 700, 1000), 'de l\'autre côté de la lampe : éclairé');
});

test('la lumière entre de quelques pixels dans le mur qu\'elle touche', () => {
  const c = new CollisionWorld(2000, 2000);
  c.add(makeBox(1200, 1000, 20, 100, 0, BLOCK_SIGHT));
  assert.ok(!inside(visibilityPolygon(c, 1000, 1000, 400, BLOCK_SIGHT), 1195, 1000));
  assert.ok(inside(visibilityPolygon(c, 1000, 1000, 400, BLOCK_SIGHT, 26), 1195, 1000));
});

test('sur le vrai niveau, ouvrir une porte laisse passer la lumière', () => {
  const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
  const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;
  const w = new World(ground, sprites, 'PetBot', 1);
  const lamps = ground.instances.filter((i) => i.object === 'obj_lumiere');
  // 11 lampes d'origine et 26 ajoutées à l'aile est, toutes dans le fichier du niveau depuis ADR-018
  assert.equal(lamps.length, 37);
  // cherche une lampe et une porte fermée qu'elle voit : un point juste derrière la porte est dans l'ombre
  let found = false;
  for (const lamp of lamps) {
    const radius = Number(lamp.props.radius);
    for (const door of w.doors) {
      const dist = Math.hypot(door.x - lamp.x, door.y - lamp.y);
      if (door.phase !== 'closed' || dist > radius * 0.7 || dist < 80) continue;
      if (w.collision.raycast(lamp.x, lamp.y, door.x, door.y, BLOCK_SIGHT)?.obstacle !== door.obstacle) continue;
      const bx = door.x + ((door.x - lamp.x) / dist) * 60;
      const by = door.y + ((door.y - lamp.y) / dist) * 60;
      const closed = visibilityPolygon(w.collision, lamp.x, lamp.y, radius, BLOCK_SIGHT);
      assert.ok(!inside(closed, bx, by), 'porte fermée : ombre derrière');
      w.npcs = [];
      w.openDoor(door);
      for (let i = 0; i < door.openSteps + 5; i++) w.step(NO_INPUT);
      assert.equal(door.progress, 1);
      const open = visibilityPolygon(w.collision, lamp.x, lamp.y, radius, BLOCK_SIGHT);
      assert.ok(inside(open, bx, by), 'porte ouverte : la lumière passe');
      found = true;
      break;
    }
    if (found) break;
  }
  assert.ok(found, 'au moins une lampe éclaire une porte');
});
