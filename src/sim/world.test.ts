// Tests de fumée de la simulation sur le vrai niveau converti (sans navigateur).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.ts';
import { NO_INPUT } from './types.ts';
import type { Input, LevelData, SpriteManifest } from './types.ts';
import { CONFIG } from './config.ts';

const level = JSON.parse(readFileSync(new URL('../../public/levels/rm_world2.json', import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

function makeWorld(): World {
  return new World(level, sprites, 'PetBot', 42);
}

test('le niveau se charge avec ses entités', () => {
  const w = makeWorld();
  assert.equal(w.stats.totalSoldier, 36);
  assert.equal(w.stats.totalCivil, 52);
  assert.ok(w.doors.length >= 36, `portes : ${w.doors.length}`);
  assert.equal(w.buttons.length, 4);
  assert.equal(w.windows.length, 20);
  assert.equal(w.outlets.length, 10);
  assert.ok(w.collision.all.length > 300);
});

test('le héros apparaît dans une zone libre et peut marcher', () => {
  const w = makeWorld();
  const start = { x: w.hero.x, y: w.hero.y };
  const input: Input = { ...NO_INPUT, moveY: -1, aimX: start.x, aimY: start.y - 500 };
  for (let i = 0; i < 30; i++) w.step(input);
  assert.ok(start.y - w.hero.y > 100, `déplacement vertical : ${start.y - w.hero.y}`);
});

test('la simulation tourne 60 secondes sans erreur et assez vite', () => {
  const w = makeWorld();
  const t0 = performance.now();
  const input: Input = { ...NO_INPUT, aimX: w.hero.x + 100, aimY: w.hero.y };
  for (let i = 0; i < 3600; i++) w.step(input);
  const ms = (performance.now() - t0) / 3600;
  assert.ok(ms < 4, `temps moyen par step : ${ms.toFixed(3)} ms`);
  assert.ok(Number.isFinite(w.hero.x) && Number.isFinite(w.hero.y));
  for (const npc of w.npcs) assert.ok(Number.isFinite(npc.x) && Number.isFinite(npc.y), `PNJ ${npc.id}`);
});

test('tirer vide le chargeur et R le remplit', () => {
  const w = makeWorld();
  const fire: Input = { ...NO_INPUT, fire1: true, aimX: w.hero.x, aimY: w.hero.y - 300 };
  const magazine = w.hero.def.magazine;
  for (let i = 0; i < 20 * magazine + 40; i++) w.step(fire);
  assert.equal(w.hero.ammo, 0);
  assert.equal(w.stats.ammoUsed, magazine);
  w.step({ ...NO_INPUT, reloadPressed: true });
  assert.ok(w.hero.reloadTimer > 0);
  for (let i = 0; i < w.hero.def.reloadSteps; i++) w.step(NO_INPUT);
  assert.equal(w.hero.ammo, magazine);
});

test("l'énergie revient à 3 puis une prise la fait monter", () => {
  const w = makeWorld();
  w.hero.energy = 1;
  for (let i = 0; i < CONFIG.hero.energyTickSteps * 2 + 2; i++) w.step(NO_INPUT);
  assert.equal(w.hero.energy, 3);
  const outlet = w.outlets[0];
  w.hero.x = outlet.x + 60;
  w.hero.y = outlet.y;
  for (let i = 0; i < CONFIG.outlet.stepsPerEnergy * 3; i++) w.step({ ...NO_INPUT, use: true });
  assert.equal(w.hero.energy, 6);
  assert.ok(w.hero.charging);
});

test('le robot bouclier frappe et repousse le héros, et ne craint que les tirs dans le dos', () => {
  const w = makeWorld();
  const h = w.hero;
  const robot = w.npcs.find((n) => n.object === 'obj_npc_robot_shield');
  assert.ok(robot);
  // on amène le robot dehors, face au héros, là où rien ne gêne
  robot.x = h.x + 130;
  robot.y = h.y;
  const startX = h.x;
  let minX = h.x;
  for (let i = 0; i < 240 && h.hp === h.def.maxHealth; i++) w.step(NO_INPUT);
  assert.ok(h.hp < h.def.maxHealth, 'le héros doit avoir été frappé');
  for (let i = 0; i < 30; i++) {
    w.step(NO_INPUT);
    minX = Math.min(minX, h.x);
  }
  assert.ok(startX - minX > 200, `repoussement : ${startX - minX} px`);

  // de face : aucun dégât ; de dos : dégât
  const hpBefore = robot.hp;
  const face = Math.atan2(h.y - robot.y, h.x - robot.x);
  robot.angle = face;
  w.bullets.length = 0;
  w.spawnBullet(h.def.bullet, 'hero', robot.x + Math.cos(face) * 150, robot.y + Math.sin(face) * 150, face + Math.PI);
  for (let i = 0; i < 8; i++) w.step(NO_INPUT);
  assert.equal(robot.hp, hpBefore, 'tir de face bloqué par le bouclier');
  robot.angle = Math.atan2(h.y - robot.y, h.x - robot.x);
  const back = robot.angle + Math.PI;
  w.spawnBullet(h.def.bullet, 'hero', robot.x + Math.cos(back) * 150, robot.y + Math.sin(back) * 150, back + Math.PI);
  let hit = false;
  for (let i = 0; i < 8 && !hit; i++) {
    // l'angle du robot suit le héros : on le fige dos à la balle
    robot.angle = back + Math.PI;
    w.step(NO_INPUT);
    hit = robot.hp < hpBefore || !w.npcs.includes(robot);
  }
  assert.ok(hit, 'tir dans le dos efficace');
});

test('une balle brise une vitre sans être arrêtée', () => {
  const w = makeWorld();
  const pane = w.windows[0];
  const o = pane.obstacle;
  // tir perpendiculaire à la vitre, à travers son milieu
  const nx = o.hw < o.hh ? o.cos : -o.sin;
  const ny = o.hw < o.hh ? o.sin : o.cos;
  w.spawnBullet(w.hero.def.bullet, 'hero', o.cx - nx * 60, o.cy - ny * 60, Math.atan2(ny, nx));
  const bullet = w.bullets[0];
  for (let i = 0; i < 5; i++) w.step(NO_INPUT);
  assert.ok(pane.broken, 'vitre brisée');
  assert.ok(w.bullets.includes(bullet), 'la balle continue');
});

test('une balle ennemie blesse le héros, qui meurt à 0 PV', () => {
  const w = makeWorld();
  const h = w.hero;
  const bullet = CONFIG.npcs.obj_npc_human_pistol;
  assert.ok(bullet.kind === 'soldier' && bullet.bullet);
  for (let n = 0; n < 900 && h.state !== 'dead'; n++) {
    if (n % 45 === 0) w.spawnBullet(bullet.bullet, 'enemy', h.x - 100, h.y, 0);
    w.step(NO_INPUT);
  }
  assert.equal(h.state, 'dead');
  assert.equal(w.stats.damageTaken, h.def.maxHealth);
  for (let i = 0; i < CONFIG.hero.deathMenuDelaySteps; i++) w.step(NO_INPUT);
  assert.ok(w.gameOver);
});
