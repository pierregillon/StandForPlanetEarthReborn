// Tests des tirs secondaires des quatre héros, sur le vrai niveau (les PNJ utiles sont amenés dehors,
// près du point de départ, là où rien ne gêne).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.ts';
import { petAnchors } from './abilities.ts';
import { NO_INPUT } from './types.ts';
import type { Input, LevelData, Npc, SpriteManifest } from './types.ts';
import { CONFIG } from './config.ts';

const level = JSON.parse(readFileSync(new URL('../../public/levels/rm_world2.json', import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

/** Monde avec le héros demandé, visant vers la droite, et un seul PNJ gardé : un soldat placé devant lui. */
function arena(hero: string, object: string, distance: number): { w: World; npc: Npc; aim: Input } {
  const w = new World(level, sprites, hero, 7);
  const npc = w.npcs.find((n) => n.object === object);
  assert.ok(npc, object);
  w.npcs = [npc];
  npc.x = w.hero.x + distance;
  npc.y = w.hero.y;
  npc.spd = 0;
  w.hero.angle = 0;
  const aim: Input = { ...NO_INPUT, aimX: w.hero.x + 2000, aimY: w.hero.y };
  return { w, npc, aim };
}

function run(w: World, steps: number, input: Input): void {
  for (let i = 0; i < steps; i++) w.step(input);
}

test('PetBot : la salve de drones coûte 3 énergies quel que soit le surplus, tue et soigne', () => {
  const { w, npc, aim } = arena('PetBot', 'obj_npc_human_pistol', 500);
  const h = w.hero;
  h.energy = 6;
  h.hp = 5;
  w.step({ ...aim, fire2: true });
  assert.equal(w.drones.length, 3);
  // GD-043 : plus de paliers, la surcharge ne renforce pas le tir secondaire
  assert.equal(w.drones[0].level, 1);
  assert.equal(h.energy, 3);
  // le soldat ne doit pas tuer le héros pendant le test
  npc.fireTimer = 100000;
  run(w, 60, aim);
  assert.ok(!w.npcs.includes(npc), 'le soldat est tué par un drone');
  assert.ok(w.explosions.length > 0, 'explosions en cours');
  // le héros va se placer dans une explosion : il est soigné
  const e = w.explosions[0];
  h.x = e.x;
  h.y = e.y;
  run(w, 60, aim);
  assert.ok(h.hp > 5, `PV après soin : ${h.hp}`);
  assert.ok(w.stats.healed > 0);
});

test('PetBot : pas de salve sous 3 points d\'énergie', () => {
  const { w, aim } = arena('PetBot', 'obj_npc_human_pistol', 3000);
  w.hero.energy = 2;
  w.step({ ...aim, fire2: true });
  assert.equal(w.drones.length, 0);
  assert.equal(w.hero.energy, 2);
});

test('EngiBot : la tourelle se déploie, tire sur le soldat, puis se replie', () => {
  const { w, npc, aim } = arena('EngiBot', 'obj_npc_robot_lightBot', 700);
  const h = w.hero;
  npc.fireTimer = 100000;
  h.energy = 7;
  w.step({ ...aim, fire2: true });
  assert.equal(h.state, 'firing2');
  run(w, CONFIG.abilities.engiBot.placeAnimSteps, aim);
  assert.ok(w.turret, 'tourelle lancée');
  assert.equal(w.turret.level, 1);
  assert.equal(h.energy, 4, 'la tourelle coûte 3 énergies, pas plus');
  run(w, 400, aim);
  assert.ok(!w.npcs.includes(npc), 'le soldat est tué par la tourelle');
  // repli : revenir contre la tourelle et refaire un tir secondaire
  h.x = w.turret.x;
  h.y = w.turret.y + 50;
  w.step({ ...aim, fire2: true });
  assert.equal(w.turret, null);
});

test('EngiBot : les balles rebondissent sur les murs', () => {
  const { w, aim } = arena('EngiBot', 'obj_npc_human_pistol', 5000);
  const h = w.hero;
  // tir vers le bas : le mur du bas de la carte est à quelques centaines de pixels
  const wall = w.collision.raycast(h.x, h.y, h.x, h.y - 3000, 2);
  assert.ok(wall, 'un mur au-dessus du point de départ');
  w.spawnBullet(h.def.bullet, 'hero', h.x, h.y - 100, -Math.PI / 2);
  const b = w.bullets[0];
  let bounced = false;
  for (let i = 0; i < 120 && w.bullets.includes(b); i++) {
    w.step(aim);
    if (Math.sin(b.angle) > 0) bounced = true;
  }
  assert.ok(bounced, 'la balle est repartie vers le bas');
});

test('BatBot : coup de batte, lancer, rappel', () => {
  const { w, npc, aim } = arena('BatBot', 'obj_npc_robot_lightBot', 110);
  const h = w.hero;
  npc.fireTimer = 100000;
  assert.equal(h.def.magazine, 0);
  run(w, 45, { ...aim, fire1: true });
  assert.ok(!w.npcs.includes(npc), 'deux coups de batte tuent le LightBot (2 PV)');

  // lancer : appui court
  h.energy = 3;
  w.step({ ...aim, fire2: true });
  w.step(aim);
  assert.equal(w.bats.length, 1);
  assert.equal(h.bats, 1);
  assert.equal(h.energy, 2);
  run(w, 90, aim);
  assert.equal(w.bats[0].state, 'stopped');
  // rappel : appui long
  run(w, CONFIG.abilities.batBot.holdStepsForRecall + 1, { ...aim, fire2: true });
  assert.equal(w.bats[0].state, 'returning');
  assert.equal(h.energy, 1);
  run(w, 120, aim);
  assert.equal(w.bats.length, 0);
  assert.equal(h.bats, 2);
});

test('BatBot : sans batte en main, un clic droit rappelle les battes', () => {
  const { w, aim } = arena('BatBot', 'obj_npc_human_pistol', 5000);
  const h = w.hero;
  h.energy = 3;
  const click = (): void => {
    w.step({ ...aim, fire2: true });
    w.step(aim);
  };
  click();
  run(w, 40, aim);
  click();
  assert.equal(h.bats, 0);
  assert.equal(w.bats.length, 2);
  assert.equal(h.energy, 1);
  run(w, 90, aim);
  assert.ok(w.bats.every((b) => b.state === 'stopped'));
  click();
  assert.ok(w.bats.every((b) => b.state === 'returning'), 'les deux battes reviennent');
  assert.equal(h.energy, 0);
  run(w, 150, aim);
  assert.equal(h.bats, 2);
});

test('BatBot : R rappelle les battes, qui frappent aussi au retour', () => {
  const { w, npc, aim } = arena('BatBot', 'obj_npc_robot_shotBot', 5000);
  const h = w.hero;
  npc.fireTimer = 100000;
  npc.y = h.y + 2000;
  h.energy = 3;
  w.step({ ...aim, fire2: true });
  w.step(aim);
  run(w, 90, aim);
  assert.equal(w.bats[0].state, 'stopped');
  // un ennemi se place entre la batte et le héros
  const bat = w.bats[0];
  npc.x = (bat.x + h.x) / 2;
  npc.y = h.y;
  const hp = npc.hp;
  w.step({ ...aim, reloadPressed: true });
  assert.equal(bat.state, 'returning');
  assert.equal(h.energy, 1, 'le rappel coûte 1 énergie');
  run(w, 120, aim);
  assert.ok(npc.hp < hp || !w.npcs.includes(npc), 'la batte frappe au retour');
  assert.equal(h.bats, 2);
  // R sans batte à rappeler ne coûte rien
  const energy = h.energy;
  w.step({ ...aim, reloadPressed: true });
  assert.equal(h.energy, energy);
});

test('BatBot : même en surcharge, la batte lancée reste une batte simple', () => {
  const { w, npc, aim } = arena('BatBot', 'obj_npc_human_pistol', 600);
  npc.fireTimer = 100000;
  w.hero.energy = 6;
  w.step({ ...aim, fire2: true });
  w.step(aim);
  assert.equal(w.bats[0].level, 1);
  assert.equal(w.hero.energy, 5);
  run(w, 40, aim);
  assert.equal(w.explosions.length, 0, 'pas d\'explosion : les paliers ont disparu (GD-043)');
});

test('BadaBot : tir chargé de 3 boules de plasma', () => {
  const { w, npc, aim } = arena('BadaBot', 'obj_npc_robot_shotBot', 500);
  const h = w.hero;
  npc.fireTimer = 100000;
  run(w, 5, aim);
  run(w, 60, { ...aim, fire1: true });
  assert.equal(h.charge, CONFIG.abilities.badaBot.fullChargeSteps);
  w.step(aim);
  assert.equal(w.bullets.filter((b) => b.owner === 'hero').length, 3);
  assert.equal(h.ammo, h.def.magazine - 3);
  run(w, 40, aim);
  assert.ok(!w.npcs.includes(npc), 'le ShotBot est tué par les explosions');
});

test('BadaBot : le bouclier arrête les balles et coûte 1 énergie toutes les 3 balles', () => {
  const { w, npc, aim } = arena('BadaBot', 'obj_npc_human_pistol', 5000);
  const h = w.hero;
  const pistol = npc.def;
  assert.ok(pistol.kind === 'soldier' && pistol.bullet);
  run(w, CONFIG.abilities.badaBot.shieldRaiseSteps + 2, { ...aim, fire2: true });
  assert.ok(h.shieldUp);
  assert.equal(h.energy, 3);
  for (let n = 0; n < 6; n++) {
    w.spawnBullet(pistol.bullet, 'enemy', h.x + 400, h.y, Math.PI);
    run(w, 15, { ...aim, fire2: true });
  }
  assert.equal(h.hp, h.def.maxHealth, 'aucun dégât derrière le bouclier');
  assert.equal(h.energy, 1, '6 balles encaissées = 2 énergies');
  // une balle venue de dos passe
  w.spawnBullet(pistol.bullet, 'enemy', h.x - 400, h.y, 0);
  run(w, 15, { ...aim, fire2: true });
  assert.equal(h.hp, h.def.maxHealth - 1);
});

test('le robot bouclier meurt d\'une explosion dans son dos, pas de face', () => {
  const { w, npc } = arena('BadaBot', 'obj_npc_robot_shield', 400);
  npc.angle = Math.PI; // il regarde le héros, à gauche
  const boom = { sprite: 'spr_BadaBot_plasmaBoom', scale: 1, radius: 120, damage: 20, healFromStep: -1 };
  w.addExplosion({ ...boom, x: npc.x - 80, y: npc.y });
  w.step(NO_INPUT);
  npc.angle = Math.PI;
  assert.ok(w.npcs.includes(npc) && npc.hp === npc.def.maxHealth, 'explosion de face sans effet');
  w.addExplosion({ ...boom, x: npc.x + 80, y: npc.y });
  w.step(NO_INPUT);
  assert.ok(npc.hp <= 0, 'explosion de dos mortelle');
});

test('PetBot : ses trois mini-bots partent de leur place et convergent vers les mêmes points qu\'avant', () => {
  const { w, aim } = arena('PetBot', 'obj_npc_human_pistol', 3000);
  const h = w.hero;
  w.npcs = [];
  run(w, 30, aim);
  const anchors = petAnchors(h);
  assert.equal(anchors.length, 3);
  for (const a of anchors) assert.ok(Math.hypot(a.x - h.x, a.y - h.y) > 40 && Math.hypot(a.x - h.x, a.y - h.y) < 80, 'tout près de PetBot');
  w.step({ ...aim, fire2: true });
  assert.equal(w.drones.length, 3);
  w.drones.forEach((d, i) => {
    assert.ok(Math.hypot(d.x - anchors[i].x, d.y - anchors[i].y) < 1, 'chaque drone part de la place de son mini-bot');
    // sa destination : dans l'axe de la visée de PetBot, à la portée prévue
    const destX = d.startX + Math.cos(d.angle) * d.range;
    const destY = d.startY + Math.sin(d.angle) * d.range;
    assert.ok(Math.abs(Math.hypot(destX - h.x, destY - h.y) - CONFIG.abilities.petBot.droneRanges[i]) < 1);
    const off = Math.abs(Math.atan2(destY - h.y, destX - h.x) - h.angle);
    assert.ok(off <= (CONFIG.abilities.petBot.droneSpreadDeg + 0.5) * Math.PI / 180, 'dans la dispersion habituelle');
  });
});
