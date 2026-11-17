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
  // 52 dans la salle d'origine, plus le présentateur, deux invités, la maquilleuse et son client, et
  // l'employée du vestiaire (GD-080, GD-083)
  assert.equal(w.stats.totalCivil, 58);
  assert.ok(w.doors.length >= 36, `portes : ${w.doors.length}`);
  assert.equal(w.buttons.length, 4);
  assert.equal(w.windows.length, 20);
  assert.equal(w.outlets.length, 4, '4 bornes gardées au rez-de-chaussée');
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

test("l'énergie revient à 3 ; un appui relie à la borne, qui recharge en 3 s et répare", () => {
  const w = makeWorld();
  const h = w.hero;
  h.energy = 1;
  for (let i = 0; i < CONFIG.hero.energyTickSteps * 2 + 2; i++) w.step(NO_INPUT);
  assert.equal(h.energy, 3);

  const outlet = w.outlets[0];
  w.npcs = []; // personne ne doit tirer sur le heros pendant le test
  h.x = outlet.x + 60;
  h.y = outlet.y;
  h.energy = 0;
  h.hp = 4;
  w.step({ ...NO_INPUT, usePressed: true, use: true });
  assert.ok(h.charging, 'un seul appui suffit');
  // le héros reste mobile pendant la recharge
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const free = dirs.find(([dx, dy]) => w.collision.circleFree(h.x + dx * 110, h.y + dy * 110, h.def.radius + 5, 1) && !w.sightBlocked(outlet.x, outlet.y, h.x + dx * 110, h.y + dy * 110));
  assert.ok(free, 'une direction libre autour de la borne');
  const start = { x: h.x, y: h.y };
  for (let i = 0; i < 10; i++) w.step({ ...NO_INPUT, moveX: free[0], moveY: free[1], aimX: h.x + 300, aimY: h.y });
  assert.ok(Math.hypot(h.x - start.x, h.y - start.y) > 50 && h.charging, 'il bouge sans casser le lien');
  for (let i = 0; i < 175; i++) w.step(NO_INPUT);
  assert.equal(h.energy, 12, 'recharge complète en 3 secondes');
  assert.equal(h.hp, 9, 'la borne répare 5 points de vie');
  assert.equal(outlet.energyLeft, 0);
  assert.equal(outlet.repairLeft, 0);
  assert.ok(!h.charging, 'le lien se coupe quand la borne est vide');

  // borne épuisée : plus rien à en tirer
  h.energy = 3;
  w.step({ ...NO_INPUT, usePressed: true, use: true });
  assert.ok(!h.charging);
});

test('le lien à la borne casse quand on s\'éloigne ; le surplus tient 15 s puis descend lentement', () => {
  const w = makeWorld();
  const h = w.hero;
  const outlet = w.outlets[0];
  w.npcs = []; // personne ne doit tirer sur le heros pendant le test
  h.x = outlet.x + 60;
  h.y = outlet.y;
  w.step({ ...NO_INPUT, usePressed: true, use: true });
  for (let i = 0; i < 100; i++) w.step(NO_INPUT);
  assert.ok(h.energy >= 9 && h.charging);
  const charged = h.energy;
  // on sort du rayon
  h.x = outlet.x + CONFIG.outlet.range + 200;
  w.step(NO_INPUT);
  assert.ok(!h.charging);
  for (let i = 0; i < CONFIG.hero.overchargeHoldSteps - 5; i++) w.step(NO_INPUT);
  assert.equal(h.energy, charged, 'surplus stable pendant 15 secondes');
  for (let i = 0; i < CONFIG.hero.overchargeDecaySteps + 10; i++) w.step(NO_INPUT);
  assert.equal(h.energy, charged - 1, 'puis -1 toutes les 5 secondes');
});

test('le bouclier du robot se brise après 6 coups de face', () => {
  const w = makeWorld();
  const robot = w.npcs.find((n) => n.object === 'obj_npc_robot_shield');
  assert.ok(robot);
  w.npcs = [robot];
  robot.x = w.hero.x + 600;
  robot.y = w.hero.y;
  robot.spd = 0;
  robot.fireTimer = 1e6;
  const shoot = (): void => {
    robot.angle = Math.PI; // face au héros, à gauche
    robot.dir = Math.PI;
    w.spawnBullet(w.hero.def.bullet, 'hero', robot.x - 150, robot.y, 0);
    for (let i = 0; i < 6; i++) {
      robot.angle = Math.PI;
      w.step(NO_INPUT);
    }
  };
  for (let n = 0; n < CONFIG.npc.shieldHits; n++) shoot();
  assert.equal(robot.hp, robot.def.maxHealth, 'les 6 premiers coups sont encaissés');
  assert.ok(robot.shieldBroken, 'bouclier brisé');
  shoot();
  assert.equal(robot.hp, robot.def.maxHealth - 1, 'ensuite les tirs de face portent');
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

test('la carte verte se ramasse et ouvre la porte verte, pas la violette', () => {
  const w = makeWorld();
  const h = w.hero;
  const green = w.doors.find((d) => d.card === 'green');
  const purple = w.doors.find((d) => d.card === 'purple');
  const card = w.cards.find((c) => c.color === 'green');
  assert.ok(green && purple && card);
  // sans carte : la porte reste fermée
  h.x = green.x;
  h.y = green.y + 90;
  w.step({ ...NO_INPUT, usePressed: true, use: true });
  assert.equal(green.phase, 'closed');
  assert.equal(w.nearCardDoor(), green);
  // on ramasse la carte, puis on revient à la porte
  h.x = card.x;
  h.y = card.y;
  w.step(NO_INPUT);
  assert.ok(card.carried && w.hasCard('green'));
  h.x = green.x;
  h.y = green.y + 90;
  w.step({ ...NO_INPUT, usePressed: true, use: true });
  assert.equal(green.phase, 'opening');
  for (let i = 0; i < 400; i++) w.step(NO_INPUT);
  assert.equal(green.phase, 'open', 'une porte à carte ouverte le reste');
  h.x = purple.x;
  h.y = purple.y + 90;
  w.step({ ...NO_INPUT, usePressed: true, use: true });
  assert.equal(purple.phase, 'closed');
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
