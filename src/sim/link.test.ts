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
  run(w, CONFIG.ulti.recoverSteps + 1, [aim]);
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

// ---------- Ultis de PetBot, BadaBot et EngiBot (GD-044) ----------

/** Lance l'ulti du premier heros vers `aim` et attend la fin du lancement. */
function castUlti(w: World, aim: Input): void {
  w.heroes[0].energy = CONFIG.hero.maxEnergy;
  w.step([{ ...aim, ultiPressed: true }]);
  run(w, CONFIG.ulti.castSteps, [aim]);
}

test('ulti de PetBot : un essaim le suit et soigne les allies autour de lui', () => {
  const w = team(['PetBot', 'BatBot', 'EngiBot'], 200);
  const [pet, near, far] = w.heroes;
  far.x = pet.x + CONFIG.ulti.petBot.radius + 600;
  pet.hp = 6;
  near.hp = 4;
  far.hp = 4;
  castUlti(w, { ...NO_INPUT, aimX: pet.x, aimY: pet.y - 300 });
  assert.equal(w.effects.length, 1);
  assert.equal(w.effects[0].kind, 'nanos');
  run(w, CONFIG.ulti.recoverSteps + 1);
  // PetBot reste libre de bouger : l'essaim le suit
  run(w, 30, [{ ...NO_INPUT, moveY: 1, aimX: pet.x, aimY: pet.y + 300 }]);
  assert.equal(w.effects[0].x, pet.x);
  assert.equal(w.effects[0].y, pet.y);
  // ses mini-bots tournent autour de lui : pas de salve tant que l'essaim dure (GD-047)
  pet.energy = 6;
  w.step([{ ...NO_INPUT, fire2: true, aimX: pet.x, aimY: pet.y + 300 }]);
  assert.equal(w.drones.length, 0, 'pas de salve pendant l\'ulti');
  assert.equal(pet.energy, 6);
  run(w, 240);
  assert.ok(near.hp >= 8, `allie proche soigne (${near.hp})`);
  assert.ok(pet.hp >= 10, 'PetBot aussi');
  assert.equal(far.hp, 4, 'hors du rayon : rien');
  run(w, CONFIG.ulti.petBot.steps);
  assert.equal(w.effects.length, 0, 'l\'essaim se disperse');
  w.step([{ ...NO_INPUT, fire2: true, aimX: pet.x, aimY: pet.y + 300 }]);
  assert.equal(w.drones.length, 3, 'la salve repart une fois l\'essaim disperse');
});

test('ulti de BadaBot : une vague projette au loin ennemis, chaises et balles sur son passage', () => {
  const w = team(['BadaBot', 'PetBot'], 200);
  const [bada, pet] = w.heroes;
  const cfg = CONFIG.ulti.badaBot;
  const model = new World(ground, sprites, 'PetBot', 2).npcs.filter((n) => n.def.kind === 'soldier');
  const [front, beside, behind] = model;
  // la vague part vers la gauche (terrain degage) : un ennemi sur son passage, un a cote, un dans le dos
  front.x = bada.x - 400;
  front.y = bada.y + 40;
  beside.x = bada.x - 400;
  beside.y = bada.y + cfg.halfWidth + beside.def.radius + 60;
  behind.x = bada.x + 300;
  behind.y = bada.y - 300;
  for (const npc of [front, beside, behind]) {
    npc.active = false;
    npc.fireTimer = 100000;
  }
  w.npcs = [front, beside, behind];
  // un coequipier dans l'axe : il ne sent rien
  pet.x = bada.x - 250;
  pet.y = bada.y;
  // une balle ennemie qui arrive sur BadaBot, loin devant
  w.spawnBullet(front.def.kind === 'soldier' && front.def.bullet ? front.def.bullet : pet.def.bullet, 'enemy', bada.x - 1500, bada.y - 20, 0);
  const bullet = w.bullets[0];
  bullet.speed = 0;
  const aim = { ...NO_INPUT, aimX: bada.x - 600, aimY: bada.y };
  castUlti(w, aim);
  const wave = w.effects[0];
  assert.equal(wave.kind, 'wave');
  assert.equal(wave.radius, cfg.halfWidth);
  assert.ok(wave.length > 1000, 'terrain degage : la vague va loin');
  const start = { front: front.x, beside: beside.x, behind: behind.x, pet: pet.x };
  run(w, 14, [aim]);
  assert.ok(wave.x < bada.x - 500, 'le front avance vite');
  assert.ok(front.thrown > 0, 'l\'ennemi sur le passage est projete');
  assert.ok(front.x < start.front - 100, 'il part dans le sens de la vague');
  assert.equal(beside.thrown, 0, 'celui d\'a cote ne bouge pas');
  assert.equal(behind.thrown, 0);
  assert.equal(pet.x, start.pet, 'les allies ne sont pas repousses');
  run(w, 400, [aim]);
  assert.equal(w.effects.length, 0, 'la vague s\'eteint');
  assert.equal(front.thrown, 0);
  assert.ok(start.front - front.x > 600, `il a ete projete loin (${Math.round(start.front - front.x)} px)`);
  assert.equal(beside.x, start.beside);
  assert.equal(bullet.owner, 'hero', 'la balle ennemie emportee change de camp');
  assert.ok(Math.abs(Math.cos(bullet.angle) + 1) < 1e-6, 'elle repart dans le sens de la vague');
});

test('vague de BadaBot : un ennemi projete reste sonne, un mur arrete la vague', () => {
  const w = team(['BadaBot'], 200);
  const bada = w.heroes[0];
  const cfg = CONFIG.ulti.badaBot;
  const npc = new World(ground, sprites, 'PetBot', 2).npcs.find((n) => n.def.kind === 'soldier');
  assert.ok(npc);
  npc.x = bada.x - 300;
  npc.y = bada.y;
  npc.active = false;
  w.npcs = [npc];
  const aim = { ...NO_INPUT, aimX: bada.x - 600, aimY: bada.y };
  castUlti(w, aim);
  // on attend qu'il s'arrete : il est alors sonne, ne bouge plus et ne se retourne plus
  let guard = 0;
  while ((npc.thrown > 0 || npc.daze === 0) && guard++ < 2000) w.step([aim]);
  assert.ok(npc.daze > 0, 'sonne a l\'arrivee');
  assert.ok(w.collision.circleFree(npc.x, npc.y, npc.def.radius * 0.4, 1), 'il n\'est pas dans un mur');
  const at = { x: npc.x, y: npc.y, angle: npc.angle };
  run(w, cfg.dazeSteps - 2, [aim]);
  assert.deepEqual({ x: npc.x, y: npc.y, angle: npc.angle }, at);
  run(w, 4, [aim]);
  assert.equal(npc.daze, 0, 'puis il reprend ses esprits');
  // face a un mur tout proche, la vague ne va pas plus loin que lui
  const wall = w.collision.raycast(bada.x, bada.y, bada.x, bada.y - 5000, 4);
  if (wall) {
    const up = { ...NO_INPUT, aimX: bada.x, aimY: bada.y - 600 };
    castUlti(w, up);
    const wave = w.effects[0];
    assert.ok(wave.length <= 5000 * wall.t - cfg.start + 1, 'la vague s\'arrete au mur');
  }
});

test('ulti d\'EngiBot : la grenade desactive les robots, pas les humains', () => {
  const w = team(['EngiBot', 'PetBot'], 200);
  const engi = w.heroes[0];
  const model = new World(ground, sprites, 'PetBot', 2).npcs;
  const robot = model.find((n) => n.def.kind === 'soldier' && n.def.genre === 'robot');
  const human = model.find((n) => n.def.kind === 'soldier' && n.def.genre === 'humain');
  assert.ok(robot && human);
  const target = { x: engi.x - 500, y: engi.y };
  robot.x = target.x - 200;
  robot.y = target.y;
  human.x = target.x - 200;
  human.y = target.y + 150;
  w.npcs = [robot, human];
  castUlti(w, { ...NO_INPUT, aimX: target.x, aimY: target.y });
  assert.equal(w.effects[0].kind, 'emp');
  assert.equal(robot.stun, 0, 'la grenade est encore en vol');
  run(w, CONFIG.ulti.engiBot.flySteps + 1);
  assert.ok(Math.abs(w.effects[0].x - target.x) < 2, 'elle eclate au point vise');
  assert.ok(robot.stun > 0, 'le robot est desactive');
  assert.equal(human.stun, 0, 'l\'humain ne sent rien');
  const x = robot.x;
  const angle = robot.angle;
  run(w, 120);
  assert.equal(robot.x, x);
  assert.equal(robot.angle, angle, 'il ne bouge plus');
  run(w, CONFIG.ulti.engiBot.stunSteps);
  assert.equal(robot.stun, 0, 'puis il se reactive');
});
