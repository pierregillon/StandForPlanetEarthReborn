// Tests du passage entre les salles et de l'enchaînement des consignes du monde 2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.ts';
import { DRILL_AREA, GROUND_FLOOR, MAPS, OBJ, STARTS, UPPER_FLOOR, createSession, createSessionAt } from './session.ts';
import { TV_STUDIO } from './additions.ts';
import { BLOCK_MOVE } from './geom.ts';
import { isFreshStart } from './match.ts';
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

test('les consignes s\'enchaînent : étage, carte violette, retour, régie', () => {
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
  assert.equal(u.objective, 'Find the studio pass');

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
  assert.equal(g.objective, 'Take the control room');
  assert.ok(Math.hypot(g.hero.x - stairs.x, g.hero.y - stairs.y) > stairs.radius, 'le héros arrive à côté de l\'escalier, pas dessus');
  assert.equal(stepUntil(g, 'changeRoom', 30), null, 'pas de retour immédiat à l\'étage');

  // la carte violette ouvre maintenant les portes violettes du rez-de-chaussée
  const purpleDoor = g.doors.find((d) => d.card === 'purple');
  assert.ok(purpleDoor);
  g.hero.x = purpleDoor.x + 90;
  g.hero.y = purpleDoor.y;
  g.step({ ...NO_INPUT, usePressed: true, use: true });
  assert.equal(purpleDoor.phase, 'opening');

  // 4. l'ancienne zone de sortie, en haut de la carte, ne mène plus à la zone de forage (GD-085)
  g.hero.x = 6560;
  g.hero.y = 400;
  g.step(NO_INPUT);
  assert.equal(g.exitCountdown, -1);
  assert.equal(stepUntil(g, 'changeRoom', CONFIG.hero.exitCountdownSteps + 60), null, 'on ne quitte plus le niveau par là');
  assert.equal(g.objective, 'Take the control room');
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

test('la zone de forage reste jouable depuis le menu, avec ses propres consignes', () => {
  const session = createSessionAt('PetBot', DRILL_AREA);
  const d = new World(load(DRILL_AREA), sprites, 'PetBot', 3, session);
  assert.equal(d.objective, 'Destroy the drills');
  for (const drill of d.drills) d.damageDrill(drill, 100000);
  assert.equal(d.objective, 'Kill SallyBot');
});

test('l\'ancienne zone de sortie est inactive dès le début', () => {
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

test('les points de départ : chaque carte a les siens, le premier est le début du niveau (GD-091)', () => {
  assert.deepEqual(MAPS.map((m) => m.id), ['tvtv2', 'drill']);
  assert.deepEqual(STARTS.map((s) => [s.id, s.map, s.room]), [
    ['drop', 'tvtv2', GROUND_FLOOR], ['upstairs', 'tvtv2', UPPER_FLOOR], ['studio', 'tvtv2', GROUND_FLOOR], ['boss', 'drill', DRILL_AREA],
  ]);
  for (const map of MAPS) assert.ok(STARTS.some((s) => s.map === map.id), `${map.id} a au moins un point de départ`);
  assert.equal(new Set(STARTS.map((s) => s.id)).size, STARTS.length);
  // par identifiant, ou par nom de salle comme avant
  assert.equal(createSessionAt('PetBot', 'upstairs').room, UPPER_FLOOR);
  assert.equal(createSessionAt('PetBot', DRILL_AREA).checkpoint?.room, DRILL_AREA);
  const drop = createSessionAt(['PetBot', 'BatBot'], 'drop');
  assert.deepEqual([drop.room, drop.objective, drop.checkpoint, drop.carried.size], [GROUND_FLOOR, 0, null, 0]);
  assert.ok(isFreshStart(drop, null), 'le début du niveau commence par le largage');
  assert.equal(createSessionAt('PetBot', 'nowhere').room, GROUND_FLOOR, 'inconnu : le début du niveau');
});

test('départ « après l\'ultimatum » : l\'équipe est sur le plateau, le message est diffusé, la police attend au sud', () => {
  const names = ['PetBot', 'BatBot', 'EngiBot'];
  const session = createSessionAt(names, 'studio');
  assert.equal(session.room, GROUND_FLOOR);
  assert.equal(session.objective, OBJ.dropPoint);
  assert.ok(session.carried.has('green') && session.carried.has('purple'));
  assert.equal(isFreshStart(session, null), false, 'pas de largage : on reprend à un point de sauvegarde');
  const g = new World(ground, sprites, names, 3, session);
  session.rooms.set(GROUND_FLOOR, g);
  assert.equal(g.objective, 'Leave by the south parking lot');
  const r = TV_STUDIO.room;
  const onSet = (p: { x: number; y: number }): boolean => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;
  for (const h of g.heroes) {
    assert.ok(onSet(h), 'sur le plateau');
    assert.ok(g.collision.circleFree(h.x, h.y, h.def.radius, BLOCK_MOVE), 'à une place libre');
    assert.deepEqual([h.arrivalSteps, h.hp], [0, h.def.maxHealth]);
  }
  for (let i = 0; i < g.heroes.length; i++) for (let j = i + 1; j < g.heroes.length; j++) assert.ok(Math.hypot(g.heroes[i].x - g.heroes[j].x, g.heroes[i].y - g.heroes[j].y) >= 90);
  // le présentateur et les cadreurs sont partis ; le reste du bâtiment est plein de ses gardes
  assert.equal(g.npcs.filter((n) => n.def.kind === 'civil' && onSet(n)).length, 0);
  assert.ok(g.npcs.filter((n) => n.def.kind === 'soldier').length > 20);
  // les portes franchies pour arriver là sont ouvertes, les portails nord fermés
  assert.ok(g.doors.filter((d) => d.kind === 'button' && (d.doorId === 1 || d.doorId === CONFIG.broadcast.controlRoomButton)).every((d) => d.phase === 'open'));
  assert.ok(g.doors.filter((d) => d.card !== null).every((d) => d.phase === 'open'));
  assert.ok(g.doors.filter((d) => d.kind === 'button' && d.doorId === CONFIG.exit.gates).every((d) => d.phase === 'closed'));
  // le message ne se rejoue pas, et la police se met en place au premier step : un groupe pour trois joueurs
  g.step(names.map(() => NO_INPUT));
  assert.equal(g.cast, -1);
  assert.equal(g.waveSteps, 0);
  assert.equal(g.npcs.filter((n) => n.hunt > 0).length, 22);
  assert.equal(g.decor.filter((d) => d.sprite === 'spr_pk_police_van').length, 3);
});
