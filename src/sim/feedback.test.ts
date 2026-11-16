// Tests des règles ajoutées après les essais de l'utilisateur (GD-031) : point de sauvegarde, dash,
// vitres, chaises à roulettes, vitesse, déploiement.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.ts';
import { DRILL_AREA, GROUND_FLOOR, createSession } from './session.ts';
import { NO_INPUT } from './types.ts';
import type { Input, LevelData, SpriteManifest } from './types.ts';
import { CONFIG } from './config.ts';

const load = (name: string): LevelData => JSON.parse(readFileSync(new URL(`../../public/levels/${name}.json`, import.meta.url), 'utf8')) as LevelData;
const ground = load(GROUND_FLOOR);
const drillArea = load(DRILL_AREA);
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

test('point de sauvegarde : il régénère le héros, et Retry y ramène avec la salle remise à neuf', () => {
  const session = createSession('PetBot', DRILL_AREA);
  session.objective = 3;
  session.carried.add('purple');
  const w = new World(drillArea, sprites, 'PetBot', 2, session);
  const h = w.hero;
  const cp = w.checkpoint;
  assert.ok(cp && !cp.active);
  h.hp = 3;
  h.energy = 1;
  for (let i = 0; i < 30; i++) w.step(NO_INPUT);
  assert.equal(h.hp, 3, 'rien tant qu\'on ne s\'en approche pas');
  h.x = cp.x + 60;
  h.y = cp.y;
  w.step(NO_INPUT);
  assert.ok(cp.active);
  assert.equal(h.hp, h.def.maxHealth);
  assert.equal(h.energy, CONFIG.hero.maxEnergy);
  assert.deepEqual(session.checkpoint && session.checkpoint.room, DRILL_AREA);

  // le héros abîme une foreuse puis meurt : au Retry, la salle est recréée
  w.damageDrill(w.drills[0], 5);
  w.forget();
  const again = new World(drillArea, sprites, 'PetBot', 3, session);
  assert.ok(again.checkpoint && again.checkpoint.active);
  assert.equal(again.hero.hp, again.hero.def.maxHealth);
  assert.equal(again.hero.energy, CONFIG.hero.maxEnergy);
  assert.ok(Math.hypot(again.hero.x - cp.x, again.hero.y - cp.y) < 200, 'il reprend à côté du point de sauvegarde');
  assert.equal(again.drills[0].hp, again.drills[0].maxHp, 'foreuses remises à neuf');
  assert.ok(session.carried.has('purple'), 'les cartes sont gardées');
  assert.equal(session.stats.totalSoldier, 1, 'le boss n\'est compté qu\'une fois');
});

test('le dash rend intouchable', () => {
  const w = new World(ground, sprites, 'PetBot', 4);
  const h = w.hero;
  w.npcs = [];
  const move: Input = { ...NO_INPUT, moveY: -1, aimX: h.x, aimY: h.y - 500 };
  w.step(move);
  w.step({ ...move, dashPressed: true });
  assert.ok(h.dashing);
  assert.equal(w.damageHero(3), false);
  assert.equal(h.hp, h.def.maxHealth);
  for (let i = 0; i < 40; i++) w.step(NO_INPUT);
  assert.ok(!h.dashing);
  assert.equal(w.damageHero(3), true);
});

test('une vitre laisse voir et tirer, mais pas passer', () => {
  const w = new World(ground, sprites, 'PetBot', 4);
  const pane = w.windows[0];
  const o = pane.obstacle;
  const nx = o.hw < o.hh ? o.cos : -o.sin;
  const ny = o.hw < o.hh ? o.sin : o.cos;
  const a = { x: o.cx - nx * 80, y: o.cy - ny * 80 };
  const b = { x: o.cx + nx * 80, y: o.cy + ny * 80 };
  assert.equal(w.sightBlocked(a.x, a.y, b.x, b.y), false, 'on voit à travers');
  assert.equal(w.shotBlocked(a.x, a.y, b.x, b.y), false, 'on tire à travers');
  assert.equal(w.collision.segmentBlocked(a.x, a.y, b.x, b.y, 1), true, 'on ne passe pas');
});

test('le surplus d\'énergie accélère le robot', () => {
  const w = new World(ground, sprites, 'PetBot', 4);
  const h = w.hero;
  w.npcs = [];
  const run = (energy: number): number => {
    h.energy = energy;
    h.overchargeHold = 1000;
    const y0 = h.y;
    for (let i = 0; i < 10; i++) w.step({ ...NO_INPUT, moveY: -1, aimX: h.x, aimY: h.y - 500 });
    return y0 - h.y;
  };
  const normal = run(3);
  const charged = run(12);
  assert.ok(Math.abs(normal - h.def.walkSpeed * 10) < 1, `vitesse de base : ${normal}`);
  assert.ok(charged > normal * 1.3, `à 12 d'énergie : ${charged} contre ${normal}`);
});

test('une chaise à roulettes se pousse', () => {
  const w = new World(ground, sprites, 'PetBot', 4);
  const h = w.hero;
  w.npcs = [];
  assert.ok(w.chairs.length > 10, `chaises : ${w.chairs.length}`);
  // une chaise avec de la place autour d'elle
  const chair = w.chairs.find((c) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => w.collision.circleFree(c.obstacle.cx - dx * 90, c.obstacle.cy - dy * 90, 45, 1)
    && w.collision.circleFree(c.obstacle.cx + dx * 140, c.obstacle.cy + dy * 140, 20, 1)));
  assert.ok(chair, 'une chaise dégagée');
  const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => w.collision.circleFree(chair.obstacle.cx - dx * 90, chair.obstacle.cy - dy * 90, 45, 1)
    && w.collision.circleFree(chair.obstacle.cx + dx * 140, chair.obstacle.cy + dy * 140, 20, 1));
  assert.ok(dir);
  const start = { x: chair.x, y: chair.y };
  h.x = chair.obstacle.cx - dir[0] * 90;
  h.y = chair.obstacle.cy - dir[1] * 90;
  for (let i = 0; i < 20; i++) w.step({ ...NO_INPUT, moveX: dir[0], moveY: dir[1], aimX: h.x + dir[0] * 300, aimY: h.y + dir[1] * 300 });
  const moved = (chair.x - start.x) * dir[0] + (chair.y - start.y) * dir[1];
  assert.ok(moved > 40, `la chaise a avancé de ${moved} px`);
});

test('déploiement : le robot est immobile et intouchable, puis jouable', () => {
  const w = new World(ground, sprites, 'EngiBot', 4);
  const h = w.hero;
  w.npcs = [];
  w.deployHero();
  assert.ok(h.deploySteps > 0 && h.deploySteps <= CONFIG.hero.maxDeploySteps);
  const y0 = h.y;
  w.step({ ...NO_INPUT, moveY: -1, fire1: true, aimX: h.x, aimY: h.y - 300 });
  assert.equal(h.y, y0);
  assert.equal(w.bullets.length, 0);
  assert.equal(w.damageHero(1), false);
  for (let i = 0; i < CONFIG.hero.maxDeploySteps; i++) w.step(NO_INPUT);
  w.step({ ...NO_INPUT, moveY: -1, aimX: h.x, aimY: h.y - 300 });
  assert.ok(h.y < y0);
});
