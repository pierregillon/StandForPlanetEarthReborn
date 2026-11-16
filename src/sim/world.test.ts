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
