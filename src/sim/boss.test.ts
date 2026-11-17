// Tests de la zone de forage : foreuses destructibles, boss SallyBot, fin du niveau ; et du brouillard de guerre.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.ts';
import { DRILL_AREA, GROUND_FLOOR, createSession } from './session.ts';
import { NO_INPUT } from './types.ts';
import type { LevelData, SpriteManifest } from './types.ts';
import { CONFIG } from './config.ts';

const load = (name: string): LevelData => JSON.parse(readFileSync(new URL(`../../public/levels/${name}.json`, import.meta.url), 'utf8')) as LevelData;
const drillArea = load(DRILL_AREA);
const ground = load(GROUND_FLOOR);
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

function arena(hero = 'PetBot'): World {
  const session = createSession(hero, DRILL_AREA);
  session.objective = 3;
  return new World(drillArea, sprites, hero, 11, session);
}

test('zone de forage : détruire les 3 foreuses puis tuer le boss termine le niveau', () => {
  const w = arena();
  assert.equal(w.drills.length, 3);
  assert.ok(w.boss);
  w.step(NO_INPUT);
  assert.equal(w.objective, 'Destroy the drills');
  // le boss est écarté pour ce test
  w.boss.npc.x = 12000;
  w.boss.npc.y = 500;

  // une balle du héros entame une foreuse
  const drill = w.drills[0];
  w.spawnBullet(w.hero.def.bullet, 'hero', drill.x + drill.radius + 100, drill.y, Math.PI);
  for (let i = 0; i < 10; i++) w.step(NO_INPUT);
  assert.equal(drill.hp, drill.maxHp - 1);
  // une explosion aussi
  w.addExplosion({ x: drill.x + drill.radius + 30, y: drill.y, sprite: 'spr_BadaBot_plasmaBoom', scale: 1, radius: 60, damage: 20, healFromStep: -1 });
  w.step(NO_INPUT);
  assert.ok(drill.destroyed);
  assert.equal(w.objective, 'Destroy the drills');
  for (const d of w.drills) w.damageDrill(d, 1000);
  w.step(NO_INPUT);
  assert.equal(w.objective, 'Kill SallyBot');

  let ended = false;
  w.boss.npc.hp = 0;
  for (let i = 0; i < CONFIG.boss.endDelaySteps + 5 && !ended; i++) {
    w.step(NO_INPUT);
    ended = w.drainEvents().some((e) => e.type === 'levelEnd');
  }
  assert.ok(ended, 'fin du niveau après la mort du boss');
  assert.equal(w.stats.soldierKilled, 1);
});

test('SallyBot poursuit le héros et le frappe au corps à corps', () => {
  const w = arena();
  const h = w.hero;
  assert.ok(w.boss);
  // il attend qu'on s'approche : à l'arrivée dans la salle, il ne bouge pas
  for (let i = 0; i < 120; i++) w.step(NO_INPUT);
  assert.ok(!w.boss.engaged, 'le boss reste en place tant que le héros est loin');
  h.x = w.boss.npc.x;
  h.y = w.boss.npc.y + 500;
  for (let i = 0; i < 600 && h.hp === h.def.maxHealth; i++) w.step({ ...NO_INPUT, aimX: h.x, aimY: h.y - 100 });
  assert.ok(w.boss.engaged);
  assert.ok(h.hp < h.def.maxHealth, 'le héros immobile finit par être frappé');
});

test('SallyBot : transformation à mi-vie, puis invulnérable sauf quand il respire', () => {
  const w = arena();
  const boss = w.boss;
  assert.ok(boss);
  const npc = boss.npc;
  const h = w.hero;
  h.hp = 100000; // le héros encaisse pour la durée du test
  h.x = npc.x;
  h.y = npc.y + 400;
  for (let i = 0; i < 30; i++) w.step(NO_INPUT);
  // phase 1 : vulnérable hors charge
  while (boss.action === 'charge') w.step(NO_INPUT);
  npc.hp = boss.maxHp / 2;
  w.step(NO_INPUT);
  assert.equal(boss.phase, 2);
  assert.equal(boss.action, 'transform');
  assert.ok(!boss.invulnerable, 'vulnérable pendant la transformation');
  for (let i = 0; i < 200 && boss.action === 'transform'; i++) w.step(NO_INPUT);
  assert.ok(boss.invulnerable, 'invulnérable en phase 2');
  const before = npc.hp;
  npc.hp -= 10; // un coup reçu pendant l'invulnérabilité est annulé
  w.step(NO_INPUT);
  assert.equal(npc.hp, before);
  // il finit par s'essouffler
  let breathed = false;
  for (let i = 0; i < 3000 && !breathed; i++) {
    w.step(NO_INPUT);
    breathed = (boss.action as string) === 'breathing';
  }
  assert.ok(breathed, 'le boss respire après 3 s cumulées d\'attaque');
  assert.ok(!boss.invulnerable);
  npc.hp -= 5;
  w.step(NO_INPUT);
  assert.equal(npc.hp, before - 5, 'les dégâts portent pendant la respiration');
});

test('brouillard : une pièce se dévoile quand le héros en ouvre la porte', () => {
  const w = new World(ground, sprites, 'PetBot', 5);
  const total = w.fogs.length;
  assert.ok(total >= 30, `brouillards : ${total}`);
  for (let i = 0; i < 30; i++) w.step(NO_INPUT);
  assert.equal(w.fogs.length, total, 'rien ne se dévoile tant que le héros est dehors');
  // une porte automatique qui touche un brouillard
  const touches = (d: { x: number; y: number }): boolean => w.fogs.some((f) => d.x >= f.x - 40 && d.x <= f.x + f.w + 40 && d.y >= f.y - 40 && d.y <= f.y + f.h + 40);
  const door = w.doors.find((d) => d.kind === 'auto' && touches(d));
  assert.ok(door, 'une porte automatique au bord d\'un brouillard');
  const nx = Math.cos(door.angle + Math.PI / 2);
  const ny = Math.sin(door.angle + Math.PI / 2);
  w.hero.x = door.x + nx * 150;
  w.hero.y = door.y + ny * 150;
  for (let i = 0; i < 80; i++) w.step(NO_INPUT);
  assert.ok(w.fogs.length < total, 'au moins une pièce dévoilée');
});

test('SallyBot a plusieurs : plus de vie et un peu plus vite par joueur en plus', () => {
  const names = ['PetBot', 'BatBot', 'EngiBot', 'BadaBot'];
  const expected = [{ hp: 60, speed: 7 }, { hp: 100, speed: 8 }, { hp: 140, speed: 9 }, { hp: 180, speed: 10 }];
  expected.forEach((want, i) => {
    const team = names.slice(0, i + 1);
    const session = createSession(team, DRILL_AREA);
    session.objective = 3;
    const w = new World(drillArea, sprites, team, 11, session);
    assert.ok(w.boss);
    assert.equal(w.boss.maxHp, want.hp, `${i + 1} joueur(s)`);
    assert.equal(w.boss.npc.hp, want.hp);
    assert.equal(w.boss.speed, want.speed);
    assert.ok(w.boss.speed < Math.min(...w.heroes.map((h) => h.def.walkSpeed)), 'il reste plus lent que les heros');
  });
});

test('SallyBot a plusieurs : il passe en phase 2 a la moitie de sa vie de depart', () => {
  const team = ['PetBot', 'BatBot'];
  const session = createSession(team, DRILL_AREA);
  session.objective = 3;
  const w = new World(drillArea, sprites, team, 11, session);
  const boss = w.boss;
  assert.ok(boss);
  for (const h of w.heroes) {
    h.hp = 100000;
    h.x = boss.npc.x;
    h.y = boss.npc.y + 400;
  }
  for (let i = 0; i < 30; i++) w.step([NO_INPUT, NO_INPUT]);
  while (boss.action === 'charge') w.step([NO_INPUT, NO_INPUT]);
  boss.npc.hp = 60;
  w.step([NO_INPUT, NO_INPUT]);
  assert.equal(boss.phase, 1, '60 PV sur 100 : encore en phase 1');
  while ((boss.action as string) === 'charge') w.step([NO_INPUT, NO_INPUT]);
  boss.npc.hp = 50;
  w.step([NO_INPUT, NO_INPUT]);
  assert.equal(boss.phase, 2);
});

test('SallyBot a plusieurs : ses charges visent tantot l\'un, tantot l\'autre', () => {
  const team = ['PetBot', 'BatBot'];
  const session = createSession(team, DRILL_AREA);
  session.objective = 3;
  const w = new World(drillArea, sprites, team, 11, session);
  const boss = w.boss;
  assert.ok(boss);
  const [near, far] = w.heroes;
  const targets = new Set<number>();
  let charges = 0;
  let was: string = boss.action;
  const home = { x: boss.npc.x, y: boss.npc.y };
  for (let i = 0; i < 20000 && (targets.size < 2 || charges < 6); i++) {
    // le boss est ramene a sa place a chaque step : les deux heros restent en vue, hors de portee de ses coups,
    // l'un pres, l'autre loin, et ils encaissent
    boss.npc.x = home.x;
    boss.npc.y = home.y;
    near.hp = far.hp = 100000;
    near.x = home.x;
    near.y = home.y + 420;
    far.x = home.x + 60;
    far.y = home.y + 720;
    w.step([NO_INPUT, NO_INPUT]);
    if ((boss.action as string) === 'charge' && was !== 'charge') {
      charges++;
      targets.add(boss.target);
    }
    if ((boss.action as string) !== 'charge') assert.equal(boss.target, -1, 'hors charge, il vise le plus proche');
    was = boss.action;
  }
  assert.ok(charges >= 6, `il a charge (${charges} fois)`);
  assert.deepEqual([...targets].sort(), [near.id, far.id], 'les deux heros ont ete vises');
});
