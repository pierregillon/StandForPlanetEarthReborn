// Tests de la sortie du niveau (GD-089, GD-092) : le portail nord, la zone d'extraction au nord du bâtiment où
// toute l'équipe doit se retrouver, puis l'extraction, le communiqué d'urgence et la fin du niveau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.ts';
import { TV_STUDIO } from './landmarks.ts';
import { BLOCK_MOVE } from './geom.ts';
import { AFTERMATH, ALERT, EMERGENCY, EXTRACTION_CALL, SCENE, pickupLines, pickupPhases, pickupPose, pickupShot, sceneLines } from './scenes.ts';
import { GROUND_FLOOR, OBJ, OBJECTIVES, createSession } from './session.ts';
import type { Session } from './session.ts';
import { World } from './world.ts';
import { NO_INPUT } from './types.ts';
import type { Hero, Input, LevelData, SimEvent, SpriteManifest } from './types.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

const PRESS: Input = { ...NO_INPUT, dashPressed: true, dash: true };
const USE: Input = { ...NO_INPUT, usePressed: true, use: true };
const ZONE = TV_STUDIO.exit.zone;

/** Partie à une consigne donnée, le bâtiment vidé de ses gardes, l'équipe sur le dépose-minute. */
function at(names: string[], objective: number): { w: World; session: Session } {
  const session = createSession(names);
  session.carried.add('green').add('purple');
  session.objective = objective;
  const w = new World(ground, sprites, names, 11, session);
  session.rooms.set(GROUND_FLOOR, w);
  w.npcs = [];
  w.heroes.forEach((h, i) => put(h, 10200 + i * 110, 2200));
  for (const h of w.heroes) h.invuln = 1e9;
  return { w, session };
}

function put(h: Hero, x: number, y: number): void {
  h.x = x;
  h.y = y;
}

function run(w: World, steps: number, first: Input = NO_INPUT): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < steps; i++) {
    w.step(w.heroes.map((_, slot) => (slot === 0 ? first : NO_INPUT)));
    events.push(...w.drainEvents());
  }
  return events;
}

const gates = (w: World) => w.doors.filter((d) => d.kind === 'button' && d.doorId === CONFIG.exit.gates);

/** Le premier robot se place devant le bouton du portail nord et appuie. */
function pressGate(w: World): SimEvent[] {
  const button = w.buttons.find((b) => b.doorId === CONFIG.exit.gates);
  assert.ok(button);
  put(w.heroes[0], button.x + Math.cos(button.angle) * 50, button.y + Math.sin(button.angle) * 50);
  return run(w, 1, USE);
}

/** Le portail est ouvert et la consigne est de rejoindre la zone d'extraction. */
function open(names: string[]): { w: World; session: Session } {
  const { w, session } = at(names, OBJ.northGate);
  w.waveSteps = 1;
  pressGate(w);
  run(w, 70);
  assert.equal(session.objective, OBJ.getOut);
  return { w, session };
}

/** Place un robot dans la zone d'extraction, à un rang donné autour de son centre. */
function intoZone(h: Hero, rank = 0): void {
  put(h, ZONE.x - 120 + rank * 120, ZONE.y + 40);
}

test('la zone d\'extraction est dehors, au nord, à quelques secondes de marche du portail (GD-092)', () => {
  assert.deepEqual(OBJECTIVES.slice(OBJ.northGate), ['Plan B: leave by the north garage', 'Get the whole team to the extraction zone']);
  const { w } = at(['PetBot'], OBJ.northGate);
  const doors = gates(w);
  assert.equal(doors.length, 2);
  const gateY = doors[0].y;
  // dans l'axe du portail, entièrement dehors, et loin de lui : on s'éloigne du bâtiment pour y arriver
  assert.ok(ZONE.x > Math.min(...doors.map((d) => d.x)) && ZONE.x < Math.max(...doors.map((d) => d.x)));
  assert.ok(ZONE.y + ZONE.radius < gateY - 500, `le bord de la zone est à ${Math.round(gateY - ZONE.y - ZONE.radius)} px du portail`);
  assert.ok(ZONE.y - ZONE.radius > 100, 'elle tient dans le niveau');
  const walk = (gateY - ZONE.y) / (w.hero.def.walkSpeed * 60);
  assert.ok(walk > 1.2, `il faut marcher (${walk.toFixed(1)} s en ligne droite, sans s'arrêter)`);
  // tout y est praticable, et le chemin depuis le portail est libre
  for (let a = 0; a < 12; a++) for (const r of [0, 0.5, 0.9]) {
    assert.ok(w.collision.circleFree(ZONE.x + Math.cos(a * Math.PI / 6) * ZONE.radius * r, ZONE.y + Math.sin(a * Math.PI / 6) * ZONE.radius * r, 50, BLOCK_MOVE));
  }
  for (let y = ZONE.y; y < gateY - 80; y += 60) assert.ok(w.collision.circleFree(ZONE.x, y, 60, BLOCK_MOVE), `libre en y = ${y}`);
  assert.deepEqual(TV_STUDIO.exit.landing, { x: ZONE.x, y: ZONE.y }, 'le véhicule se pose en son centre');
});

test('le portail nord s\'ouvre comme une porte ordinaire ; ouvert pendant le repli, la radio donne la zone d\'extraction', () => {
  const { w, session } = at(['BatBot', 'EngiBot'], OBJ.northGate);
  w.waveSteps = 1;
  assert.equal(w.objective, 'Plan B: leave by the north garage');
  let events = pressGate(w);
  assert.ok(gates(w).every((d) => d.phase === 'opening' && d.openSteps === 60), 'une seconde, comme les autres portes');
  events = events.concat(run(w, 62));
  assert.ok(gates(w).every((d) => d.phase === 'open'));
  assert.equal(w.objective, 'Get the whole team to the extraction zone');
  assert.deepEqual(events.filter((e) => e.type === 'radio'), [{ type: 'radio', speaker: 'PetBot', text: EXTRACTION_CALL }], 'la voix du véhicule');
  assert.ok(/extraction zone/i.test(EXTRACTION_CALL) && /north/i.test(EXTRACTION_CALL));
  // les battants restent ouverts, et rien n'est redit
  assert.equal(run(w, 600).filter((e) => e.type === 'radio').length, 0);
  assert.ok(gates(w).every((d) => d.phase === 'open'));
  assert.equal(session.objective, OBJ.getOut);

  // avant l'ultimatum, l'ouvrir ne change rien à la consigne, et il reste ouvert ensuite
  const early = at(['PetBot'], OBJ.broadcast);
  const quiet = pressGate(early.w).concat(run(early.w, 70));
  assert.ok(gates(early.w).every((d) => d.phase === 'open'));
  assert.equal(early.session.objective, OBJ.broadcast);
  assert.equal(quiet.filter((e) => e.type === 'radio').length, 0);
  // déjà ouvert quand vient le plan B : la consigne passe aussitôt à la zone d'extraction
  early.session.objective = OBJ.northGate;
  early.w.waveSteps = 1;
  const late = run(early.w, 2);
  assert.equal(early.session.objective, OBJ.getOut);
  assert.equal(late.filter((e) => e.type === 'radio').length, 1);
});

test('une équipe sortie par le nord sans être passée par le sud : la police se lance quand même', () => {
  const { w, session } = at(['PetBot'], OBJ.dropPoint);
  run(w, 2);
  assert.equal(w.waveSteps, 0, 'le barrage est en place');
  pressGate(w);
  run(w, 70);
  assert.equal(session.objective, OBJ.dropPoint, 'ouvrir le portail ne suffit pas');
  assert.equal(w.waveSteps, 0);
  // elle passe le portail
  put(w.hero, 10304, gates(w)[0].y - 200);
  const events = run(w, 3);
  assert.ok(w.waveSteps >= 1, 'la riposte est lancée');
  assert.ok(w.npcs.filter((n) => n.hunt > 0).every((n) => n.hunt === 2), 'la ligne de police se met en chasse');
  assert.equal(w.cast, -1, 'sans face-à-face');
  assert.equal(session.objective, OBJ.getOut);
  assert.deepEqual(events.filter((e) => e.type === 'radio').map((e) => e.type === 'radio' && e.text), [EXTRACTION_CALL]);
});

test('l\'extraction ne commence que lorsque toute l\'équipe est debout dans la zone', () => {
  // seul
  const a = open(['PetBot']);
  put(a.w.hero, ZONE.x, ZONE.y + ZONE.radius + 60);
  run(a.w, 30);
  assert.equal(a.w.cast, -1, 'au bord, mais dehors');
  assert.equal(a.w.inExitZone(a.w.hero), false);
  intoZone(a.w.hero);
  const events = run(a.w, 1);
  assert.ok(a.w.cast >= 0 && a.w.castScene === SCENE.pickup);
  assert.equal(events.filter((e) => e.type === 'pickup').length, 1);
  // à trois : deux dans la zone ne suffisent pas, il faut le troisième
  const b = open(['PetBot', 'BatBot', 'EngiBot']);
  intoZone(b.w.heroes[0], 0);
  intoZone(b.w.heroes[1], 1);
  run(b.w, 120);
  assert.equal(b.w.cast, -1, 'on ne part pas sans tous les robots');
  intoZone(b.w.heroes[2], 2);
  run(b.w, 1);
  assert.ok(b.w.cast >= 0);
  // un robot à terre, même dans la zone, retient tout le monde : il faut d'abord le relever
  const c = open(['PetBot', 'BatBot']);
  intoZone(c.w.heroes[0], 0);
  intoZone(c.w.heroes[1], 1);
  c.w.heroes[0].invuln = 0;
  c.w.damageHero(c.w.heroes[0], 9999, true);
  run(c.w, 60);
  assert.equal(c.w.cast, -1);
  assert.equal(c.w.inExitZone(c.w.heroes[0]), false);
  // un joueur parti de la partie ne retient personne
  const d = open(['PetBot', 'BatBot']);
  intoZone(d.w.heroes[0], 0);
  run(d.w, 30);
  assert.equal(d.w.cast, -1);
  d.w.removeHero(1);
  run(d.w, 1);
  assert.ok(d.w.cast >= 0);
  // pas avant le plan B : dehors par un autre chemin, rien ne se passe
  const e = at(['PetBot'], OBJ.broadcast);
  intoZone(e.w.hero);
  run(e.w, 30);
  assert.equal(e.w.cast, -1);
});

test('le véhicule de l\'extraction : il arrive par la gauche comme à l\'aller, se pose, saisit les robots, repart à droite', () => {
  const p = pickupPhases();
  assert.ok(p.open < p.flyIn && p.flyIn < p.descend && p.descend < p.grab && p.grab < p.ascend && p.ascend < p.flyOut && p.flyOut < p.watch && p.watch < p.hall && p.hall < p.black && p.black < p.total);
  assert.equal(pickupPose(0).present, false);
  const arriving = pickupPose(p.open + 5);
  assert.ok(arriving.present && arriving.shift < -1000 && arriving.height === 1 && arriving.grab === 0, 'il entre de loin, par la gauche, en vol');
  assert.ok(Math.abs(pickupPose(p.flyIn - 1).shift) < 5, 'et ralentit jusqu\'au centre de la zone');
  assert.ok(pickupPose(p.descend - 1).height < 0.05);
  assert.deepEqual([pickupPose(p.descend).grab, pickupPose(p.descend).height, pickupPose(p.descend).shift], [0, 0, 0]);
  assert.ok(pickupPose(p.grab - 1).grab > 0.95, 'les pinces ont ramené les robots');
  assert.deepEqual([pickupPose(p.ascend - 1).grab, pickupPose(p.ascend - 1).shift], [1, 0], 'il remonte avec eux');
  assert.ok(pickupPose(p.flyOut - 1).shift > 1500 && pickupPose(p.flyOut - 1).grab === 1, 'et repart vers la droite');
  assert.equal(pickupPose(p.flyOut).present, false);
  assert.deepEqual([0, p.flyOut, p.watch, p.hall, p.black, p.total].map(pickupShot), ['landing', 'landing', 'hall', 'hall', 'black', 'black']);
});

test('l\'extraction : communiqué d\'urgence, radio des robots, puis la fin du niveau', () => {
  const { w } = open(['PetBot', 'BatBot']);
  intoZone(w.heroes[0], 0);
  intoZone(w.heroes[1], 1);
  let events = run(w, 1);
  assert.equal(w.castScene, SCENE.pickup);
  const p = pickupPhases();
  const lines = sceneLines(w);
  assert.deepEqual(lines, pickupLines());
  assert.deepEqual(lines.map((l) => [l.speaker, l.text]), [[EMERGENCY, ALERT[0]], [EMERGENCY, ALERT[1]], ...AFTERMATH]);
  assert.deepEqual(lines.map((l) => [pickupShot(l.at), l.alert === true]), [['hall', true], ['hall', true], ['black', false], ['black', false], ['black', false]]);
  assert.ok(/major threat to mankind/.test(ALERT[1]) && /destroy it on sight/.test(ALERT[1]));
  assert.deepEqual(AFTERMATH.map(([who]) => who), ['BatBot', 'EngiBot', 'BadaBot']);
  // le monde est figé pendant que le véhicule fait son travail ; l'horloge s'arrête sur le communiqué
  const places = w.heroes.map((h) => [h.x, h.y]);
  events = events.concat(run(w, p.hall + 60));
  assert.deepEqual([w.cast, w.introLine], [p.hall, 0]);
  assert.deepEqual(w.heroes.map((h) => [h.x, h.y]), places);
  assert.equal(events.filter((e) => e.type === 'vehicleLeaves').length, 1, 'le véhicule redécolle une fois');
  assert.equal(events.filter((e) => e.type === 'pickupNews').length, 1);
  assert.equal(events.filter((e) => e.type === 'levelEnd').length, 0);
  // l'hôte fait défiler les cinq répliques
  events = [];
  for (let line = 1; line <= 5; line++) {
    events = events.concat(run(w, 1, PRESS), run(w, 1), run(w, 1, PRESS), run(w, 1));
    if (line === 2) events = events.concat(run(w, p.black - p.hall + 5));
    assert.ok(w.introLine >= line, `réplique ${line} passée`);
  }
  events = events.concat(run(w, p.total));
  assert.deepEqual(events.filter((e) => e.type === 'levelEnd'), [{ type: 'levelEnd' }], 'une seule fois');
  assert.equal(w.levelEnded, true);
  // la séquence reste sur son dernier plan, sous l'écran de fin : plus rien n'avance, personne ne perd
  assert.equal(w.cast, p.total);
  assert.equal(run(w, 300, PRESS).length, 0);
  assert.equal(w.gameOver, false);
});

test('l\'extraction : l\'hôte peut la passer, le niveau se termine aussitôt', () => {
  const { w } = open(['PetBot', 'BatBot']);
  intoZone(w.heroes[0], 0);
  intoZone(w.heroes[1], 1);
  run(w, 1);
  assert.ok(w.cast >= 0);
  for (let i = 0; i < CONFIG.arrival.skipHoldSteps + 5; i++) w.step([NO_INPUT, { ...NO_INPUT, dash: true }]);
  assert.equal(w.levelEnded, false, 'le second joueur ne peut pas');
  const events = run(w, CONFIG.arrival.skipHoldSteps + 5, { ...NO_INPUT, dash: true });
  assert.deepEqual(events.filter((e) => e.type === 'levelEnd'), [{ type: 'levelEnd' }]);
  assert.equal(w.levelEnded, true);
});
