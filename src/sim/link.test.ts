// Tests du link et de l'ulti (GD-043).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.ts';
import { linkFactor } from './link.ts';
import { World } from './world.ts';
import { GROUND_FLOOR } from './session.ts';
import { NO_INPUT } from './types.ts';
import type { Hero, Input, LevelData, SpriteManifest } from './types.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

/** Équipe au point de départ (dehors, sans mur), ennemis retirés ; les héros sont alignés, espacés de `gap`. */
function team(names: string[], gap = 200): World {
  const w = new World(ground, sprites, names, 1);
  w.npcs = [];
  w.heroes.forEach((h, i) => {
    h.x = w.heroes[0].x + i * gap;
    h.y = w.heroes[0].y;
  });
  return w;
}

const aimAt = (o: Hero): Input => ({ ...NO_INPUT, aimX: o.x, aimY: o.y });
const run = (w: World, n: number, inputs: Input[] = []): void => {
  for (let i = 0; i < n; i++) w.step(inputs);
};
/** Steps pour que le receveur gagne `points` par des liens à plein débit. */
const stepsFor = (points: number): number => points * CONFIG.link.teamStepsPerEnergy + 2;

test('link : A pose le lien sur l\'allié visé, la réserve passe d\'abord, puis la régénération', () => {
  const w = team(['PetBot', 'BatBot']);
  const [giver, taker] = w.heroes;
  // viser ailleurs ne lie personne
  w.step([{ ...NO_INPUT, aimX: giver.x - 500, aimY: giver.y, linkPressed: true }]);
  assert.equal(giver.linkTo, -1);
  w.step([{ ...aimAt(taker), linkPressed: true }]);
  assert.equal(giver.linkTo, taker.id);
  assert.equal(giver.linkStrength, 1);
  run(w, stepsFor(3));
  assert.equal(giver.energy, 0, 'celui qui donne s\'est vidé');
  assert.equal(taker.energy, 6, 'la réserve est passée');
  run(w, stepsFor(6));
  assert.equal(giver.energy, 0, 'il ne régénère rien pour lui');
  assert.equal(taker.energy, 12, 'sa régénération amplifiée continue d\'arriver');
  run(w, 200);
  assert.equal(taker.energy, 12, 'plafonné, et stable tant que le lien tient');
  // plus rapide que deux robots séparés, qui plafonneraient à 3 chacun
  assert.ok(CONFIG.link.teamStepsPerEnergy < CONFIG.hero.energyTickSteps);
});

test('link : chacun des deux peut le couper ; la distance et les murs le cassent', () => {
  const w = team(['PetBot', 'BatBot']);
  const [giver, taker] = w.heroes;
  const link = (): void => w.step([{ ...aimAt(taker), linkPressed: true }]);
  link();
  w.step([{ ...NO_INPUT, linkPressed: true }]);
  assert.equal(giver.linkTo, -1, 'celui qui donne coupe');
  link();
  w.step([NO_INPUT, { ...NO_INPUT, linkPressed: true }]);
  assert.equal(giver.linkTo, -1, 'celui qui reçoit coupe');
  link();
  taker.x = giver.x + CONFIG.link.maxRange + 20;
  w.step([]);
  assert.equal(giver.linkTo, -1, 'trop loin');
  // un mur entre les deux : la porte d'entrée du bâtiment est fermée au nord du point de départ
  taker.x = giver.x + 200;
  link();
  assert.equal(giver.linkTo, taker.id);
  const wall = w.collision.raycast(giver.x, giver.y, giver.x, giver.y - 3000, 4);
  assert.ok(wall);
  taker.x = giver.x;
  taker.y = giver.y - 3000 * wall.t - 150;
  w.step([]);
  assert.equal(giver.linkTo, -1, 'un mur coupe le lien');
});

test('link : plus on est loin, moins il débite', () => {
  assert.equal(linkFactor(100), 1);
  assert.equal(linkFactor(CONFIG.link.fullRange), 1);
  assert.equal(linkFactor(CONFIG.link.maxRange), CONFIG.link.minFactor);
  const mid = linkFactor((CONFIG.link.fullRange + CONFIG.link.maxRange) / 2);
  assert.ok(mid < 1 && mid > CONFIG.link.minFactor);
  const far = team(['PetBot', 'BatBot'], 900);
  far.step([{ ...aimAt(far.heroes[1]), linkPressed: true }]);
  run(far, stepsFor(3));
  assert.ok(far.heroes[1].energy < 6, 'à 900 px, le lien débite moins');
});

test('link : pas de chaîne ni de boucle', () => {
  const w = team(['PetBot', 'BatBot', 'EngiBot']);
  const [a, b, c] = w.heroes;
  w.step([{ ...aimAt(b), linkPressed: true }]);
  assert.equal(a.linkTo, b.id);
  // b reçoit : il ne peut pas donner (sa touche coupe le lien qu'il reçoit)
  w.step([NO_INPUT, { ...aimAt(c), linkPressed: true }]);
  assert.equal(b.linkTo, -1);
  assert.equal(a.linkTo, -1);
  // a donne à b : c ne peut pas se lier à a, qui donne déjà
  w.step([{ ...aimAt(b), linkPressed: true }]);
  w.step([NO_INPUT, NO_INPUT, { ...NO_INPUT, aimX: a.x, aimY: a.y, linkPressed: true }]);
  assert.equal(c.linkTo, b.id, 'le lien se pose sur b, dans le même axe, qui ne donne pas');
});

test('link : à quatre avec trois liens, la surcharge se construit aussi vite qu\'à deux avec un lien', () => {
  const two = team(['PetBot', 'BatBot']);
  two.heroes[0].energy = 0;
  two.step([NO_INPUT, { ...aimAt(two.heroes[0]), linkPressed: true }]);
  two.heroes.forEach((h, i) => (h.energy = i === 0 ? 3 : 0));
  const four = team(['PetBot', 'BatBot', 'EngiBot', 'BadaBot'], 100);
  const target = four.heroes[0];
  four.step([NO_INPUT, aimAt(target), aimAt(target), aimAt(target)].map((i, k) => (k === 0 ? i : { ...i, linkPressed: true })));
  assert.equal(four.heroes.filter((h) => h.linkTo === target.id).length, 3);
  four.heroes.forEach((h, i) => (h.energy = i === 0 ? 3 : 0));
  run(two, stepsFor(6));
  run(four, stepsFor(6));
  assert.equal(two.heroes[0].energy, 9);
  assert.equal(four.heroes[0].energy, two.heroes[0].energy, 'même débit total');
  // à quatre, un seul lien débite trois fois moins
  const one = team(['PetBot', 'BatBot', 'EngiBot', 'BadaBot'], 100);
  one.step([NO_INPUT, { ...aimAt(one.heroes[0]), linkPressed: true }]);
  one.heroes.forEach((h, i) => (h.energy = i === 0 ? 3 : 0));
  run(one, stepsFor(6));
  assert.equal(one.heroes[0].energy, 5);
});

test('bornes : leur réserve est partagée entre les joueurs', () => {
  assert.equal(team(['PetBot']).outlets[0].energyLeft, 12);
  assert.equal(team(['PetBot', 'BatBot']).outlets[0].energyLeft, 6);
  assert.equal(team(['PetBot', 'BatBot', 'EngiBot', 'BadaBot']).outlets[0].energyLeft, 3);
});

test('ulti de BatBot : pleine surcharge, 2 s de lancement immobile, bond puis explosion', () => {
  const w = team(['BatBot', 'PetBot']);
  const [bat, pet] = w.heroes;
  const target = { x: bat.x - 500, y: bat.y };
  const aim: Input = { ...NO_INPUT, aimX: target.x, aimY: target.y };
  // pas assez d'énergie : rien
  bat.energy = 11;
  w.step([{ ...aim, ultiPressed: true }]);
  assert.equal(bat.ultiPhase, 0);
  // un coéquipier le charge par un lien
  bat.energy = 3;
  w.step([NO_INPUT, { ...aimAt(bat), linkPressed: true }]);
  run(w, stepsFor(9));
  assert.equal(bat.energy, 12);
  assert.equal(pet.linkTo, bat.id);
  // des ennemis autour du point d'arrivée, un autre trop loin
  const model = new World(ground, sprites, 'PetBot', 2).npcs.filter((n) => n.def.kind === 'soldier');
  const near = model[0];
  const far = model[1];
  near.x = target.x + 150;
  near.y = target.y;
  far.x = target.x - CONFIG.ulti.batBot.radius - 400;
  far.y = target.y;
  near.active = false;
  far.active = false;
  near.fireTimer = 100000;
  far.fireTimer = 100000;
  w.npcs = [near, far];
  const hpNear = near.hp;
  const hpFar = far.hp;

  w.step([{ ...aim, ultiPressed: true }]);
  assert.equal(bat.ultiPhase, 1);
  assert.equal(bat.energy, 0, 'l\'ulti dépense toute l\'énergie');
  assert.equal(pet.linkTo, -1, 'et coupe les liens : il faudra se relier');
  const x0 = bat.x;
  run(w, CONFIG.ulti.castSteps - 2, [{ ...aim, moveX: 1, fire1: true }]);
  assert.equal(bat.ultiPhase, 1);
  assert.equal(bat.x, x0, 'immobile pendant le lancement');
  assert.equal(w.bullets.filter((b) => b.owner === 'hero').length, 0);
  run(w, 3, [aim]);
  assert.equal(bat.ultiPhase, 2, 'il bondit');
  assert.equal(w.damageHero(bat, 1), false, 'intouchable en l\'air');
  run(w, CONFIG.ulti.batBot.leapSteps, [aim]);
  assert.ok(Math.hypot(bat.x - target.x, bat.y - target.y) < 2, 'il atterrit au point visé');
  assert.ok(near.hp <= hpNear - CONFIG.ulti.batBot.damage, 'l\'ennemi proche encaisse');
  assert.equal(far.hp, hpFar, 'l\'ennemi hors du rayon n\'a rien');
  assert.ok(w.drainEvents().some((e) => e.type === 'ultiImpact'));
  run(w, CONFIG.ulti.batBot.recoverSteps + 1, [aim]);
  assert.equal(bat.ultiPhase, 0);
});

test('ulti : perdu si le robot tombe pendant le lancement', () => {
  const w = team(['BatBot', 'PetBot']);
  const bat = w.heroes[0];
  bat.energy = 12;
  w.step([{ ...NO_INPUT, aimX: bat.x - 400, aimY: bat.y, ultiPressed: true }]);
  run(w, 30);
  w.damageHero(bat, 99);
  assert.equal(bat.state, 'dead');
  assert.equal(bat.ultiPhase, 0);
  assert.equal(bat.energy, 0);
});
