// Tests de la fin de mission, première partie (GD-085) : la régie, le plateau, la marque derrière le pupitre,
// l'ultimatum et le point de sauvegarde qui le suit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.ts';
import { CONTROL_ROOM_TAKEN, PICK_UP, ULTIMATUM, castLines, castLive, castPhases, castReader, castShot, vehicleVoice } from './broadcast.ts';
import { typingSteps } from './intro.ts';
import { TV_STUDIO } from './additions.ts';
import { BLOCK_MOVE } from './geom.ts';
import { retrySession } from './match.ts';
import { GROUND_FLOOR, OBJ, OBJECTIVES, createSession } from './session.ts';
import type { Session } from './session.ts';
import { World } from './world.ts';
import { NO_INPUT } from './types.ts';
import type { Hero, Input, LevelData, SimEvent, SpriteManifest } from './types.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

const PRESS: Input = { ...NO_INPUT, dashPressed: true, dash: true };
const HOLD: Input = { ...NO_INPUT, dash: true };

/** Partie revenue au rez-de-chaussée avec les deux cartes : la consigne est « Take the control room ». */
function back(names: string[], objective = OBJ.controlRoom): { w: World; session: Session } {
  const session = createSession(names);
  session.carried.add('green').add('purple');
  session.objective = objective;
  const w = new World(ground, sprites, names, 3, session);
  session.rooms.set(GROUND_FLOOR, w);
  w.npcs = [];
  return { w, session };
}

const idle = (w: World): Input[] => w.heroes.map(() => NO_INPUT);

function put(h: Hero, x: number, y: number): void {
  h.x = x;
  h.y = y;
}

/** Place les robots sur la marque, côte à côte. */
function onMark(w: World, ...slots: number[]): void {
  slots.forEach((slot, i) => put(w.heroes[slot], TV_STUDIO.mark.x + 20, TV_STUDIO.mark.y - 90 + i * 60));
}

/** Monde où l'ultimatum vient de commencer. */
function onAir(names: string[]): { w: World; session: Session; events: SimEvent[] } {
  const { w, session } = back(names, OBJ.broadcast);
  onMark(w, ...names.map((_, i) => i));
  const events: SimEvent[] = [];
  for (let i = 0; i <= CONFIG.broadcast.countdownSteps && w.cast < 0; i++) {
    w.step(idle(w));
    events.push(...w.drainEvents());
  }
  assert.ok(w.cast >= 0, 'l\'ultimatum a commencé');
  return { w, session, events };
}

test('les consignes de la fin : sept, dans l\'ordre du script', () => {
  assert.deepEqual(OBJECTIVES, [
    'Go to the upper floor', 'Find the studio pass', 'Go back to ground floor', 'Take the control room',
    'Reach the studio', 'Broadcast the message', 'Get back to the drop point',
  ]);
  assert.equal(OBJECTIVES[OBJ.controlRoom], 'Take the control room');
  assert.equal(OBJECTIVES[OBJ.dropPoint], 'Get back to the drop point');
});

test('le bouton de la régie : les portes de l\'aile est s\'ouvrent, la consigne change, le robot l\'annonce', () => {
  const { w } = back(['PetBot', 'BatBot']);
  assert.equal(w.objective, 'Take the control room');
  const button = w.buttons.find((b) => b.doorId === CONFIG.broadcast.controlRoomButton);
  assert.ok(button);
  assert.ok(button.x > 6800 && button.x < 8224 && button.y > 3072 && button.y < 4864, 'il est dans la régie');
  const doors = w.doors.filter((d) => d.kind === 'button' && d.doorId === button.doorId);
  assert.equal(doors.length, 2, 'une porte vers le salon d\'attente, une vers le salon de sortie');
  // c'est le deuxième joueur qui appuie
  const bat = w.heroes[1];
  put(bat, button.x + Math.cos(button.angle) * 50, button.y + Math.sin(button.angle) * 50);
  w.step([NO_INPUT, { ...NO_INPUT, usePressed: true, use: true }]);
  const events = w.drainEvents();
  assert.ok(doors.every((d) => d.phase === 'opening'));
  assert.equal(w.objective, 'Reach the studio');
  const radio = events.find((e) => e.type === 'radio');
  assert.ok(radio && radio.type === 'radio');
  assert.equal(radio.speaker, 'BatBot', 'celui qui a appuyé');
  assert.equal(radio.text, CONTROL_ROOM_TAKEN);
  // un second appui ne répète rien
  for (let i = 0; i < 5; i++) w.step([NO_INPUT, { ...NO_INPUT, usePressed: true, use: true }]);
  assert.equal(w.drainEvents().filter((e) => e.type === 'radio').length, 0);
});

test('entrer sur le plateau affiche « Broadcast the message »', () => {
  const { w } = back(['PetBot'], OBJ.studio);
  for (let i = 0; i < 10; i++) w.step(NO_INPUT);
  assert.equal(w.objective, 'Reach the studio', 'pas avant d\'y être');
  const r = TV_STUDIO.room;
  put(w.hero, r.x0 + 260, r.y0 + 200);
  w.step(NO_INPUT);
  assert.equal(w.objective, 'Broadcast the message');
});

test('la marque est derrière le pupitre, et quatre robots y tiennent', () => {
  const { w } = back(['PetBot']);
  const { mark, desk, room } = TV_STUDIO;
  assert.ok(mark.x > desk.x && mark.x < room.x1, 'du côté du présentateur');
  const spots = [[20, -90], [20, -30], [20, 30], [20, 90]];
  for (const [dx, dy] of spots) {
    assert.ok(w.collision.circleFree(mark.x + dx, mark.y + dy, 50, BLOCK_MOVE), `place libre en ${dx}, ${dy}`);
    assert.ok(Math.hypot(dx, dy) <= CONFIG.broadcast.markRadius);
  }
  // on y arrive à pied depuis la porte nord du plateau
  assert.ok(w.nav.findPath(room.x0 + 224, room.y0 + 150, mark.x + 20, mark.y) !== null, 'un chemin mène de la porte à la marque');
});

test('la marque : la moitié de l\'équipe, un compte à rebours, qui s\'annule si on la quitte', () => {
  const { w } = back(['PetBot', 'BatBot', 'BadaBot'], OBJ.broadcast);
  const away = { x: TV_STUDIO.room.x0 + 300, y: TV_STUDIO.room.y0 + 300 };
  for (const h of w.heroes) put(h, away.x + h.id * 110, away.y);
  w.step(idle(w));
  assert.equal(w.markCountdown, -1);
  onMark(w, 0);
  w.step(idle(w));
  assert.equal(w.markCountdown, -1, 'un sur trois ne suffit pas');
  onMark(w, 0, 1);
  w.step(idle(w));
  assert.ok(w.markCountdown > 0, 'deux sur trois : le compte à rebours part');
  for (let i = 0; i < 60; i++) w.step(idle(w));
  assert.ok(w.markCountdown > 0 && w.cast < 0);
  put(w.heroes[1], away.x, away.y);
  w.step(idle(w));
  assert.equal(w.markCountdown, -1, 'il s\'annule');
  // un robot à terre ne compte pas parmi ceux qui attendent
  onMark(w, 0, 1);
  w.heroes[1].state = 'dead';
  w.step(idle(w));
  assert.equal(w.markCountdown, -1);
  // avant la consigne, la marque est inactive
  const early = back(['PetBot']).w;
  onMark(early, 0);
  for (let i = 0; i < CONFIG.broadcast.countdownSteps + 30; i++) early.step(NO_INPUT);
  assert.equal(early.cast, -1);
});

test('qui lit le message, et qui parle depuis le véhicule', () => {
  assert.equal(castReader(['EngiBot', 'PetBot']), 'PetBot');
  assert.equal(castReader(['BatBot', 'EngiBot', 'BadaBot']), 'BadaBot');
  assert.equal(castReader(['EngiBot']), 'EngiBot');
  assert.equal(vehicleVoice(['BadaBot']), 'EngiBot');
  assert.equal(vehicleVoice(['EngiBot', 'BadaBot']), 'PetBot');
  assert.equal(vehicleVoice(['EngiBot', 'PetBot']), 'BatBot');
  assert.equal(vehicleVoice(['EngiBot', 'PetBot', 'BatBot']), 'BadaBot');
  assert.equal(vehicleVoice(['EngiBot', 'PetBot', 'BatBot', 'BadaBot']), 'BadaBot', 'personne à bord : BadaBot, au sol');
  // sept phrases en direct, lues par le même robot, puis la voix du véhicule
  const lines = castLines(['PetBot', 'EngiBot'], 'PetBot');
  assert.equal(lines.length, 8);
  assert.deepEqual(lines.slice(0, 7).map((l) => l.text), ULTIMATUM);
  assert.ok(lines.slice(0, 7).every((l) => l.speaker === 'PetBot' && l.live === true));
  assert.deepEqual([lines[7].speaker, lines[7].text, lines[7].live], ['BatBot', PICK_UP, undefined]);
  assert.equal(lines.filter((l) => l.siren).length, 1, 'les sirènes montent sur une seule phrase');
  // les plans : le plateau, le hall, le pupitre, la neige, puis le plateau sans cadre
  const p = castPhases();
  assert.deepEqual([p.open, p.hall, p.desk, p.cut].map(castShot), ['studio', 'hall', 'desk', 'after']);
  assert.equal(castShot(p.desk + 1), 'static');
  assert.deepEqual(lines.map((l) => castShot(l.at)), ['studio', 'studio', 'studio', 'hall', 'hall', 'hall', 'desk', 'after']);
  assert.ok(castLive(p.desk) && !castLive(p.desk + 1) && !castLive(-1), 'l\'antenne est coupée après la septième phrase');
});

test('l\'ultimatum : tout le niveau est figé, l\'hôte fait défiler les huit répliques', () => {
  const { w, session, events } = onAir(['EngiBot', 'BatBot']);
  assert.ok(events.some((e) => e.type === 'castStart'));
  assert.equal(w.heroes[w.castReader].def.name, 'BatBot', 'le premier de la liste parmi ceux qui sont sur la marque');
  assert.equal(w.markCountdown, -1);
  const lines = castLines(session.heroNames, 'BatBot');
  const p = castPhases();
  // rien ne bouge : ni les robots, ni un garde posé à côté
  const before = w.heroes.map((h) => [h.x, h.y]);
  const tick = w.tick;
  const move: Input = { ...NO_INPUT, moveX: -1, fire1: true, aimX: 0, aimY: 0 };
  for (let i = 0; i < p.open; i++) w.step([move, move]);
  assert.deepEqual(w.heroes.map((h) => [h.x, h.y]), before);
  assert.equal(w.bullets.length, 0);
  assert.equal(w.tick, tick + p.open);
  assert.equal(w.cast, p.open, 'l\'horloge s\'arrête sur la première phrase');
  // l'horloge attend l'appui : premier appui, la phrase s'écrit d'un coup ; second appui, la suivante
  for (let i = 0; i < 30; i++) w.step(idle(w));
  assert.deepEqual([w.cast, w.introLine], [p.open, 0]);
  w.step([PRESS, NO_INPUT]);
  assert.equal(w.introLineSteps, typingSteps(lines[0].text));
  w.step([PRESS, NO_INPUT]);
  assert.deepEqual([w.introLine, w.introLineSteps], [1, 0]);
  // le second joueur n'est pas l'hôte : ses appuis ne font rien
  for (let i = 0; i < 3; i++) w.step([NO_INPUT, PRESS]);
  assert.equal(w.introLine, 1);
  // on lit tout : deux appuis par phrase
  const seen: SimEvent[] = [];
  for (let i = 0; i < 2000 && w.cast >= 0; i++) {
    w.step([i % 4 === 0 ? PRESS : NO_INPUT, NO_INPUT]);
    seen.push(...w.drainEvents());
  }
  assert.equal(w.cast, -1);
  assert.equal(seen.filter((e) => e.type === 'sirens').length, 1);
  const end = seen.find((e) => e.type === 'castEnd');
  assert.ok(end && end.type === 'castEnd' && !end.skipped);
  assert.equal(w.objective, 'Get back to the drop point');
  // le jeu reprend
  put(w.heroes[0], TV_STUDIO.room.x0 + 400, TV_STUDIO.mark.y - 500);
  const x = w.heroes[0].x;
  for (let i = 0; i < 20; i++) w.step([{ ...NO_INPUT, moveX: 1 }, NO_INPUT]);
  assert.ok(w.heroes[0].x > x + 20, 'les robots bougent de nouveau');
  assert.equal(w.cast, -1, 'la marque est éteinte : le message ne se relit pas');
});

test('l\'ultimatum : sans appui, chaque réplique finit par laisser la place à la suivante', () => {
  const { w } = onAir(['PetBot']);
  const p = castPhases();
  const lines = castLines(['PetBot'], 'PetBot');
  for (let i = 0; i < p.open; i++) w.step(NO_INPUT);
  const wait = typingSteps(lines[0].text) + CONFIG.arrival.autoAdvanceSteps;
  for (let i = 0; i < wait - 1; i++) w.step(NO_INPUT);
  assert.equal(w.introLine, 0);
  w.step(NO_INPUT);
  assert.equal(w.introLine, 1);
});

test('l\'ultimatum : l\'hôte le passe en tenant la touche, et lui seul', () => {
  const { w } = onAir(['PetBot', 'BatBot']);
  w.hostSlot = 1;
  for (let i = 0; i < CONFIG.arrival.skipHoldSteps + 5; i++) w.step([HOLD, NO_INPUT]);
  assert.ok(w.cast >= 0, 'le premier joueur n\'est pas l\'hôte');
  w.drainEvents();
  for (let i = 0; i < CONFIG.arrival.skipHoldSteps - 1; i++) w.step([NO_INPUT, HOLD]);
  assert.ok(w.cast >= 0);
  w.step([NO_INPUT, HOLD]);
  assert.equal(w.cast, -1);
  const events = w.drainEvents();
  const end = events.find((e) => e.type === 'castEnd');
  assert.ok(end && end.type === 'castEnd' && end.skipped);
  assert.ok(events.some((e) => e.type === 'sirens'), 'les sirènes s\'entendent quand même');
  assert.equal(w.objective, 'Get back to the drop point');
});

test('après l\'ultimatum, « Retry » ramène sur le plateau sans relire le message', () => {
  const { w, session } = onAir(['PetBot', 'EngiBot']);
  w.skipCast();
  assert.deepEqual(session.checkpoint && [session.checkpoint.room, session.checkpoint.objective], [GROUND_FLOOR, OBJ.dropPoint]);
  // la partie continue, puis l'équipe tombe
  session.objective = OBJ.dropPoint;
  const again = retrySession(session);
  assert.equal(again, session, 'la même partie, reprise au point de sauvegarde');
  assert.equal(session.rooms.has(GROUND_FLOOR), false, 'la salle est remise à neuf');
  const fresh = new World(ground, sprites, session.heroNames, 5, session);
  assert.equal(fresh.objective, 'Get back to the drop point');
  const r = TV_STUDIO.room;
  for (const h of fresh.heroes) {
    assert.ok(h.x > r.x0 && h.x < r.x1 && h.y > r.y0 && h.y < r.y1, 'sur le plateau');
    assert.ok(fresh.collision.circleFree(h.x, h.y, h.def.radius, BLOCK_MOVE), 'à une place libre');
    assert.equal(h.hp, h.def.maxHealth);
  }
  assert.ok(Math.hypot(fresh.heroes[0].x - fresh.heroes[1].x, fresh.heroes[0].y - fresh.heroes[1].y) >= 90, 'pas l\'un sur l\'autre');
  // plus personne de la chaîne sur le plateau : le présentateur n'est pas revenu à son pupitre
  assert.equal(fresh.npcs.filter((n) => n.def.kind === 'civil' && n.x > r.x0 && n.x < r.x1 && n.y > r.y0 && n.y < r.y1).length, 0);
  assert.ok(fresh.npcs.some((n) => n.def.kind === 'civil'), 'les autres civils du bâtiment sont là');
  // les portes déjà franchies sont ouvertes, le message ne se rejoue pas
  assert.ok(fresh.doors.filter((d) => d.kind === 'button' && d.doorId === CONFIG.broadcast.controlRoomButton).every((d) => d.phase === 'open'));
  assert.ok(fresh.doors.filter((d) => d.card === 'purple').every((d) => d.phase === 'open'));
  fresh.npcs = [];
  onMark(fresh, 0, 1);
  for (let i = 0; i < CONFIG.broadcast.countdownSteps + 30; i++) fresh.step(idle(fresh));
  assert.equal(fresh.cast, -1);
});
