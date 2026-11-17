// Tests du jeu à plusieurs héros (GD-039) : entrées par joueur, résurrection, fin de partie, passages entre
// salles, balles soignantes de PetBot, départ d'un joueur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.ts';
import { World } from './world.ts';
import { GROUND_FLOOR } from './session.ts';
import { NO_INPUT } from './types.ts';
import type { Input, LevelData, SpriteManifest } from './types.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

function team(...names: string[]): World {
  const w = new World(ground, sprites, names, 1);
  w.npcs = [];
  return w;
}

test('chaque héros a son point d\'apparition et obéit à son joueur', () => {
  const w = team('PetBot', 'BatBot', 'EngiBot', 'BadaBot');
  assert.equal(w.heroes.length, 4);
  assert.deepEqual(w.heroes.map((h) => h.id), [0, 1, 2, 3]);
  const xs = new Set(w.heroes.map((h) => Math.round(h.x)));
  assert.equal(xs.size, 4, 'quatre points d\'apparition distincts');
  const before = w.heroes.map((h) => h.x);
  const right: Input = { ...NO_INPUT, moveX: 1, aimX: 99999, aimY: w.heroes[1].y };
  for (let i = 0; i < 10; i++) w.step([NO_INPUT, right]);
  assert.equal(w.heroes[0].x, before[0], 'le premier n\'a pas bougé');
  assert.ok(w.heroes[1].x > before[1] + 50, 'le deuxième a avancé');
});

test('en solo, une seule entrée suffit toujours', () => {
  const w = team('PetBot');
  const x = w.hero.x;
  for (let i = 0; i < 10; i++) w.step({ ...NO_INPUT, moveX: 1 });
  assert.ok(w.hero.x > x + 50);
});

test('la partie n\'est perdue que quand toute l\'équipe est à terre', () => {
  const w = team('PetBot', 'BatBot');
  w.damageHero(w.heroes[0], 99);
  for (let i = 0; i < CONFIG.hero.deathMenuDelaySteps + 5; i++) w.step([]);
  assert.equal(w.heroes[0].state, 'dead');
  assert.equal(w.gameOver, false);
  w.damageHero(w.heroes[1], 99);
  for (let i = 0; i < CONFIG.hero.deathMenuDelaySteps + 5; i++) w.step([]);
  assert.equal(w.gameOver, true);
});

test('résurrection : E maintenu 3 s près d\'un robot à terre, pour 3 énergies', () => {
  const w = team('EngiBot', 'BatBot');
  const [medic, fallen] = w.heroes;
  w.damageHero(fallen, 99);
  medic.x = fallen.x - 90;
  medic.y = fallen.y;
  medic.energy = 3;
  const hold: Input = { ...NO_INPUT, use: true };
  // relâcher en cours de route annule, et l'énergie déjà dépensée est perdue
  for (let i = 0; i < 70; i++) w.step([hold]);
  assert.equal(medic.reviving, fallen.id);
  assert.equal(medic.energy, 2);
  w.step([NO_INPUT]);
  assert.equal(medic.reviving, -1);
  assert.equal(fallen.state, 'dead');
  // pas assez d'énergie pour recommencer
  for (let i = 0; i < 10; i++) w.step([hold]);
  assert.equal(medic.reviving, -1);
  medic.energy = 3;
  const x = medic.x;
  for (let i = 0; i < medic.def.reviveSteps; i++) w.step([{ ...hold, moveX: 1 }]);
  assert.equal(medic.x, x, 'le sauveteur ne bouge pas');
  assert.equal(fallen.state, 'standing');
  assert.equal(fallen.hp, CONFIG.revive.hp);
  assert.equal(medic.energy, 0);
  assert.equal(medic.reviving, -1);
  assert.ok(w.drainEvents().some((e) => e.type === 'revived'));
});

test('passage entre salles : toute l\'équipe part aussitôt, la moitié déclenche un compte à rebours', () => {
  const w = team('PetBot', 'BatBot', 'EngiBot');
  const zone = w.zones.find((z) => z.targetRoom !== '');
  assert.ok(zone);
  const leaving = (): boolean => w.drainEvents().some((e) => e.type === 'changeRoom');
  const put = (i: number): void => {
    w.heroes[i].x = zone.x + i * 20;
    w.heroes[i].y = zone.y;
  };
  put(0);
  w.step([]);
  assert.equal(w.zoneCountdown, -1, 'un sur trois : rien');
  assert.equal(leaving(), false);
  put(1);
  w.step([]);
  assert.ok(w.zoneCountdown > 0, 'deux sur trois : compte à rebours');
  assert.equal(leaving(), false);
  put(2);
  w.step([]);
  assert.equal(leaving(), true, 'trois sur trois : départ immédiat');
  w.step([]);
  assert.equal(leaving(), false, 'le départ n\'est demandé qu\'une fois');

  // le compte à rebours va à son terme si personne d'autre ne vient
  const w2 = team('PetBot', 'BatBot');
  const z2 = w2.zones.find((z) => z.targetRoom !== '');
  assert.ok(z2);
  w2.heroes[0].x = z2.x;
  w2.heroes[0].y = z2.y;
  let left = false;
  for (let i = 0; i <= CONFIG.hero.exitCountdownSteps + 2 && !left; i++) {
    w2.step([]);
    left = w2.drainEvents().some((e) => e.type === 'changeRoom');
  }
  assert.equal(left, true);
});

test('les balles des héros traversent les coéquipiers, sans les soigner ni les blesser', () => {
  const w = team('PetBot', 'BatBot');
  const [pet, ally] = w.heroes;
  ally.hp = 5;
  const aim: Input = { ...NO_INPUT, aimX: ally.x, aimY: ally.y };
  for (let i = 0; i < 40; i++) w.step([aim]);
  // une seule balle, tirée à la main vers le coéquipier
  w.spawnBullet(pet.def.bullet, 'hero', pet.x + 60, pet.y, 0, pet.id);
  for (let i = 0; i < 20; i++) w.step([aim]);
  assert.equal(ally.hp, 5, 'la balle de PetBot ne soigne pas');
  assert.equal(w.bullets.length, 1, 'la balle continue sa route');
  assert.ok(w.bullets[0].x > ally.x + 100, 'elle a dépassé le coéquipier');
  // les balles des autres robots traversent aussi, sans soigner
  ally.hp = 5;
  w.bullets.length = 0;
  w.spawnBullet(w.heroes[1].def.bullet, 'hero', pet.x - 200, pet.y, 0, 1);
  for (let i = 0; i < 12; i++) w.step([aim]);
  assert.equal(w.bullets.length, 1);
  assert.equal(pet.hp, pet.def.maxHealth);
});

test('collision légère : deux robots superposés s\'écartent, sans se bloquer', () => {
  const w = team('PetBot', 'BadaBot');
  const [a, b] = w.heroes;
  b.x = a.x;
  b.y = a.y;
  for (let i = 0; i < 40; i++) w.step([]);
  const min = (a.def.radius + b.def.radius) * CONFIG.hero.teamSpacing;
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) >= min - 1, 'ils ne se chevauchent plus');
  // on peut traverser un coéquipier en marchant : il gêne, il ne bloque pas
  b.x = a.x + 150;
  b.y = a.y;
  const start = a.x;
  for (let i = 0; i < 60; i++) w.step([{ ...NO_INPUT, moveX: 1, aimX: a.x + 500, aimY: a.y }]);
  assert.ok(a.x > start + 350, `il est passé (${Math.round(a.x - start)} px)`);
});

test('en changeant de salle, un robot à terre est relevé et chacun garde son état', () => {
  const w = team('PetBot', 'BatBot');
  w.heroes[0].hp = 7;
  w.damageHero(w.heroes[1], 99);
  const next = new World(ground, sprites, ['PetBot', 'BatBot'], 2);
  next.enter(w.heroes, 2);
  assert.equal(next.heroes[0].hp, 7);
  assert.equal(next.heroes[1].state, 'standing');
  assert.equal(next.heroes[1].hp, CONFIG.revive.hp);
  assert.notEqual(Math.round(next.heroes[0].y), Math.round(next.heroes[1].y), 'points d\'arrivée distincts');
});

test('un joueur qui part ne compte plus', () => {
  const w = team('PetBot', 'BatBot');
  w.removeHero(1);
  assert.equal(w.present().length, 1);
  w.damageHero(w.heroes[0], 99);
  for (let i = 0; i < CONFIG.hero.deathMenuDelaySteps + 5; i++) w.step([]);
  assert.equal(w.gameOver, true, 'le seul joueur restant est à terre');
});

test('rôles (GD-056) : vie, vitesse, dashs et résurrection propres à chaque robot', () => {
  const w = team('PetBot', 'EngiBot', 'BatBot', 'BadaBot');
  const [pet, engi, bat, bada] = w.heroes;
  assert.deepEqual(w.heroes.map((h) => h.hp), [12, 10, 14, 16]);
  assert.deepEqual(w.heroes.map((h) => h.def.walkSpeed), [11.5, 14, 13, 10.5]);
  assert.deepEqual(w.heroes.map((h) => h.dashCharges), [2, 2, 3, 1]);
  assert.equal(CONFIG.abilities.batBot.swingDamage, 2);
  // le tank reste plus rapide que le boss à quatre joueurs
  assert.ok(bada.def.walkSpeed > CONFIG.boss.speed + 3 * CONFIG.boss.speedPerExtraPlayer);
  // PetBot relève un coéquipier en 1,5 s, toujours pour 3 énergies ; les autres en 3 s
  assert.equal(pet.def.reviveSteps, 90);
  assert.equal(engi.def.reviveSteps, 180);
  w.damageHero(bat, 99);
  pet.x = bat.x - 90;
  pet.y = bat.y;
  pet.energy = 3;
  const hold: Input[] = [{ ...NO_INPUT, use: true }, NO_INPUT, NO_INPUT, NO_INPUT];
  for (let i = 0; i < 89; i++) w.step(hold);
  assert.equal(bat.state, 'dead');
  w.step(hold);
  assert.equal(bat.state, 'standing', 'relevé en 1,5 s');
  assert.equal(pet.energy, 0);
  assert.equal(bada.hp, 16);
});

test('dashs : BadaBot n\'en a qu\'un, BatBot en recharge trois', () => {
  const w = team('BatBot', 'BadaBot');
  const [bat, bada] = w.heroes;
  bat.dashCharges = 0;
  bat.dashRechargeTimer = CONFIG.hero.dashRechargeSteps;
  bada.dashCharges = 0;
  bada.dashRechargeTimer = CONFIG.hero.dashRechargeSteps;
  for (let i = 0; i < CONFIG.hero.dashRechargeSteps * 4; i++) w.step([NO_INPUT, NO_INPUT]);
  assert.equal(bat.dashCharges, 3);
  assert.equal(bada.dashCharges, 1);
});
