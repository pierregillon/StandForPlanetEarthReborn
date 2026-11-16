// Tests du passage entre les salles et de l'enchaînement des consignes du monde 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.ts';
import { DRILL_AREA, GROUND_FLOOR, UPPER_FLOOR, createSession, createSessionAt } from './session.ts';
import { NO_INPUT } from './types.ts';
import type { LevelData, SimEvent, SpriteManifest } from './types.ts';
import { CONFIG } from './config.ts';

const load = (name: string): LevelData => JSON.parse(readFileSync(new URL(`../../public/levels/${name}.json`, import.meta.url), 'utf8')) as LevelData;
const ground = load(GROUND_FLOOR);
const upper = load(UPPER_FLOOR);
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

function stepUntil(w: World, type: SimEvent['type'], max: number): SimEvent | null {
  for (let i = 0; i < max; i++) {
    w.step(NO_INPUT);
    const e = w.drainEvents().find((ev) => ev.type === type);
    if (e) return e;
  }
  return null;
}

test('les consignes s\'enchaînent : étage, carte violette, retour, sortie', () => {
  const session = createSession('PetBot');
  const g = new World(ground, sprites, 'PetBot', 3, session);
  session.rooms.set(GROUND_FLOOR, g);
  assert.equal(g.objective, 'Go to the upper floor');
  const totalGround = session.stats.totalSoldier;

  // 1. l'escalier mène à l'étage
  const stairs = g.zones[0];
  assert.equal(stairs.targetRoom, UPPER_FLOOR);
  g.hero.hp = 7;
  g.hero.x = stairs.x;
  g.hero.y = stairs.y;
  const up = stepUntil(g, 'changeRoom', 3);
  assert.ok(up && up.type === 'changeRoom' && up.room === UPPER_FLOOR && up.spawn === 1);

  session.room = UPPER_FLOOR;
  session.spawnNumber = up.spawn;
  const u = new World(upper, sprites, 'PetBot', 4, session);
  session.rooms.set(UPPER_FLOOR, u);
  u.enter(g.heroes, up.spawn);
  assert.equal(u.hero.hp, 7, 'le héros garde ses points de vie');
  assert.ok(session.stats.totalSoldier > totalGround, 'les soldats de l\'étage sont comptés');
  u.step(NO_INPUT);
  assert.equal(u.objective, 'Find the purple key');

  // 2. la carte violette
  const card = u.cards.find((c) => c.color === 'purple');
  assert.ok(card);
  u.hero.x = card.x;
  u.hero.y = card.y;
  u.step(NO_INPUT);
  assert.ok(session.carried.has('purple'));
  assert.equal(u.objective, 'Go back to ground floor');

  // 3. retour au rez-de-chaussée, sur le second jeu de points d'apparition
  const down = u.zones[0];
  u.hero.x = down.x;
  u.hero.y = down.y;
  const back = stepUntil(u, 'changeRoom', 3);
  assert.ok(back && back.type === 'changeRoom' && back.room === GROUND_FLOOR && back.spawn === 2);
  g.enter(u.heroes, back.spawn);
  g.step(NO_INPUT);
  assert.equal(g.objective, 'Exit to the drilling area');
  assert.ok(Math.hypot(g.hero.x - stairs.x, g.hero.y - stairs.y) > stairs.radius, 'le héros arrive à côté de l\'escalier, pas dessus');
  assert.equal(stepUntil(g, 'changeRoom', 30), null, 'pas de retour immédiat à l\'étage');

  // la carte violette ouvre maintenant les portes violettes du rez-de-chaussée
  const purpleDoor = g.doors.find((d) => d.card === 'purple');
  assert.ok(purpleDoor);
  g.hero.x = purpleDoor.x + 90;
  g.hero.y = purpleDoor.y;
  g.step({ ...NO_INPUT, usePressed: true, use: true });
  assert.equal(purpleDoor.phase, 'opening');

  // 4. la zone de sortie, en haut de la carte : 10 secondes à y rester
  g.hero.x = 6560;
  g.hero.y = 400;
  g.step(NO_INPUT);
  assert.ok(g.exitCountdown > 0);
  assert.equal(stepUntil(g, 'changeRoom', CONFIG.hero.exitCountdownSteps - 60), null);
  const out = stepUntil(g, 'changeRoom', 120);
  assert.ok(out && out.type === 'changeRoom' && out.room === DRILL_AREA, 'la sortie mène à la zone de forage');
});

test('départ à l\'étage : en redescendant, les portes déjà franchies sont ouvertes', () => {
  const session = createSessionAt('PetBot', UPPER_FLOOR);
  assert.ok(session.carried.has('green'));
  const g = new World(ground, sprites, 'PetBot', 3, session);
  const stairDoor = g.doors.find((d) => d.kind === 'button' && d.doorId === 1);
  const greenDoor = g.doors.find((d) => d.card === 'green');
  const purpleDoor = g.doors.find((d) => d.card === 'purple');
  assert.ok(stairDoor && greenDoor && purpleDoor);
  assert.equal(stairDoor.phase, 'open');
  assert.equal(greenDoor.phase, 'open');
  assert.equal(purpleDoor.phase, 'closed', 'la porte violette reste à ouvrir');
  // le héros arrive par l'escalier (second jeu de points d'apparition) et peut rejoindre le reste du bâtiment
  g.enter(g.heroes, 2);
  for (let i = 0; i < 300; i++) g.step(NO_INPUT);
  assert.equal(stairDoor.phase, 'open', 'elle reste ouverte');
  assert.ok(g.nav.findPath(g.hero.x, g.hero.y, greenDoor.x, greenDoor.y + 300) !== null || g.nav.findPath(g.hero.x, g.hero.y, greenDoor.x, greenDoor.y - 300) !== null,
    'un chemin mène de l\'escalier au-delà de la porte verte');
  // une partie commencée au début garde ses portes fermées
  const normal = new World(ground, sprites, 'PetBot', 3);
  assert.equal(normal.doors.find((d) => d.kind === 'button' && d.doorId === 1)?.phase, 'closed');
});

test('la zone de sortie est inactive tant que la consigne n\'est pas atteinte', () => {
  const g = new World(ground, sprites, 'PetBot', 3);
  g.hero.x = 6560;
  g.hero.y = 400;
  for (let i = 0; i < 30; i++) g.step(NO_INPUT);
  assert.equal(g.exitCountdown, -1);
});

test('une salle garde son état quand on y revient', () => {
  const session = createSession('PetBot');
  const g = new World(ground, sprites, 'PetBot', 3, session);
  const soldiers = g.npcs.length;
  g.killNpc(g.npcs[0]);
  const door = g.doors.find((d) => d.kind === 'button');
  assert.ok(door);
  g.openDoor(door);
  for (let i = 0; i < 200; i++) g.step(NO_INPUT);
  g.enter(g.heroes, 2);
  assert.equal(g.npcs.length, soldiers - 1);
  assert.equal(door.phase, 'open');
});
