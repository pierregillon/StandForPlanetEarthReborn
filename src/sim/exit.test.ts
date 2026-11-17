// Tests de la sortie du niveau (GD-089) : le portail nord qui s'ouvre lentement pendant le repli, la zone de
// sortie derrière lui, puis l'extraction, le communiqué d'urgence et la fin du niveau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.ts';
import { TV_STUDIO } from './additions.ts';
import { BLOCK_MOVE } from './geom.ts';
import { AFTERMATH, ALERT, EMERGENCY, HOLD_ON, SCENE, pickupLines, pickupPhases, pickupPose, pickupShot, sceneLines } from './scenes.ts';
import { GROUND_FLOOR, OBJ, OBJECTIVES, createSession } from './session.ts';
import type { Session } from './session.ts';
import { World } from './world.ts';
import { NO_INPUT } from './types.ts';
import type { Hero, Input, LevelData, SimEvent, SpriteManifest } from './types.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

const PRESS: Input = { ...NO_INPUT, dashPressed: true, dash: true };
const USE: Input = { ...NO_INPUT, usePressed: true, use: true };

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

/** Le portail est ouvert et la consigne est de sortir. */
function open(names: string[]): { w: World; session: Session } {
  const { w, session } = at(names, OBJ.northGate);
  w.waveSteps = 1;
  pressGate(w);
  run(w, CONFIG.exit.gateOpenSteps + 5);
  assert.equal(session.objective, OBJ.getOut);
  return { w, session };
}

/** Un point de la zone de sortie. */
const OUT = { x: (TV_STUDIO.exit.zone.x0 + TV_STUDIO.exit.zone.x1) / 2, y: (TV_STUDIO.exit.zone.y0 + TV_STUDIO.exit.zone.y1) / 2 };

test('les consignes de la sortie, et la zone de sortie juste derrière les portails nord', () => {
  assert.deepEqual(OBJECTIVES.slice(OBJ.northGate), ['Plan B: leave by the north garage', 'Hold on. The gate is opening', 'Get out! The pick-up is outside']);
  const { w } = at(['PetBot'], OBJ.northGate);
  const doors = gates(w);
  assert.equal(doors.length, 2);
  const z = TV_STUDIO.exit.zone;
  for (const d of doors) {
    assert.ok(d.x > z.x0 && d.x < z.x1, 'la zone est dans l\'axe du portail');
    assert.ok(z.y1 < d.y && d.y - z.y1 < 120, 'dehors, à quelques pas des battants');
  }
  // tout y est praticable, comme le point où le véhicule se pose
  for (let x = z.x0 + 60; x < z.x1; x += 90) for (let y = z.y0 + 60; y < z.y1 - 50; y += 90) assert.ok(w.collision.circleFree(x, y, 50, BLOCK_MOVE), `libre en ${x}, ${y}`);
  const land = TV_STUDIO.exit.landing;
  assert.ok(land.x > z.x0 && land.x < z.x1 && land.y > z.y0 && land.y < z.y1);
});

test('l\'ultimatum diffusé, le bâtiment est bouclé : des portails nord déjà ouverts se referment', () => {
  const session = createSession(['PetBot']);
  session.carried.add('green').add('purple');
  session.objective = OBJ.broadcast;
  const w = new World(ground, sprites, ['PetBot'], 3, session);
  session.rooms.set(GROUND_FLOOR, w);
  w.npcs = [];
  // en explorant, le robot avait ouvert le portail nord : avant l'ultimatum il s'ouvre en une seconde, sans rien changer
  const before = pressGate(w);
  assert.equal(before.filter((e) => e.type === 'radio').length, 0);
  run(w, 70);
  assert.ok(gates(w).every((d) => d.phase === 'open'), 'ouvert en une seconde');
  assert.equal(session.objective, OBJ.broadcast);
  // l'ultimatum
  put(w.hero, TV_STUDIO.mark.x + 20, TV_STUDIO.mark.y);
  for (let i = 0; i <= CONFIG.broadcast.countdownSteps && w.cast < 0; i++) w.step(NO_INPUT);
  assert.ok(w.cast >= 0);
  w.skipCast();
  assert.ok(gates(w).every((d) => d.phase === 'closed' && d.progress === 0), 'refermés');
  assert.equal(w.buttons.find((b) => b.doorId === CONFIG.exit.gates)?.pressedSteps, -1, 'le bouton est de nouveau à presser');
  assert.deepEqual(session.checkpoint?.save?.doors.filter((id) => gates(w).some((d) => d.id === id)), [], 'et la sauvegarde les retient fermés');
  // on ne passe pas : le battant fermé est un obstacle
  for (const d of gates(w)) assert.equal(w.collision.circleFree(d.x, d.y, 30, BLOCK_MOVE), false);
});

test('pendant le repli, le portail nord met dix secondes à s\'ouvrir : il faut tenir', () => {
  const { w, session } = at(['BatBot', 'EngiBot'], OBJ.northGate);
  w.waveSteps = 1;
  assert.equal(w.objective, 'Plan B: leave by the north garage');
  const events = pressGate(w);
  assert.equal(w.objective, 'Hold on. The gate is opening');
  assert.deepEqual(events.filter((e) => e.type === 'radio'), [{ type: 'radio', speaker: 'PetBot', text: HOLD_ON }], 'la voix du véhicule');
  assert.ok(/hold on/i.test(HOLD_ON));
  const open = CONFIG.exit.gateOpenSteps;
  assert.equal(open, 600);
  run(w, open / 2);
  for (const d of gates(w)) {
    assert.equal(d.phase, 'opening');
    assert.ok(Math.abs(d.progress - 0.5) < 0.02, `à mi-course après cinq secondes (${d.progress.toFixed(2)})`);
  }
  // personne n'est encore sorti : le milieu de l'ouverture est toujours barré
  assert.equal(session.objective, OBJ.holdOn);
  run(w, open / 2 + 3);
  assert.ok(gates(w).every((d) => d.phase === 'open'));
  assert.equal(w.objective, 'Get out! The pick-up is outside');
  // les battants restent ouverts, et un second appui ne redit rien
  run(w, 600);
  assert.ok(gates(w).every((d) => d.phase === 'open'));
  assert.equal(pressGate(w).filter((e) => e.type === 'radio').length, 0);
});

test('une équipe venue au nord sans passer par le sud : le bouton lance aussi la police', () => {
  const { w, session } = at(['PetBot'], OBJ.dropPoint);
  run(w, 2);
  assert.equal(w.waveSteps, 0, 'le barrage est en place');
  const events = pressGate(w);
  assert.equal(session.objective, OBJ.holdOn);
  assert.ok(w.waveSteps >= 1, 'la riposte est lancée');
  assert.ok(w.npcs.filter((n) => n.hunt > 0).every((n) => n.hunt === 2), 'la ligne de police se met en chasse');
  assert.deepEqual(events.filter((e) => e.type === 'radio').map((e) => e.type === 'radio' && e.text), [HOLD_ON]);
  assert.equal(w.cast, -1, 'sans face-à-face');
});

test('l\'extraction commence quand la moitié de l\'équipe, vivante, est dans la zone de sortie', () => {
  // seul
  const a = open(['PetBot']);
  run(a.w, 30);
  assert.equal(a.w.cast, -1);
  put(a.w.hero, OUT.x, OUT.y);
  const events = run(a.w, 1);
  assert.ok(a.w.cast >= 0 && a.w.castScene === SCENE.pickup);
  assert.equal(events.filter((e) => e.type === 'pickup').length, 1);
  // à trois : un seul dehors ne suffit pas, deux oui
  const b = open(['PetBot', 'BatBot', 'EngiBot']);
  put(b.w.heroes[0], OUT.x, OUT.y);
  run(b.w, 30);
  assert.equal(b.w.cast, -1);
  put(b.w.heroes[1], OUT.x + 100, OUT.y);
  run(b.w, 1);
  assert.ok(b.w.cast >= 0);
  // un robot à terre dehors ne compte pas ; resté dedans, il n'empêche pas les deux autres de partir
  const c = open(['PetBot', 'BatBot']);
  put(c.w.heroes[0], OUT.x, OUT.y);
  c.w.heroes[0].invuln = 0;
  c.w.damageHero(c.w.heroes[0], 9999, true);
  run(c.w, 30);
  assert.equal(c.w.cast, -1, 'un robot à terre ne déclenche rien');
  put(c.w.heroes[1], OUT.x + 100, OUT.y);
  run(c.w, 1);
  assert.ok(c.w.cast >= 0, 'son coéquipier vivant, oui : il est la moitié de l\'équipe');
  // pas avant le plan B : dehors par un autre chemin, rien ne se passe
  const d = at(['PetBot'], OBJ.broadcast);
  put(d.w.hero, OUT.x, OUT.y);
  run(d.w, 30);
  assert.equal(d.w.cast, -1);
});

test('le véhicule de l\'extraction : il arrive du nord, se pose, saisit les robots, repart', () => {
  const p = pickupPhases();
  assert.ok(p.open < p.flyIn && p.flyIn < p.descend && p.descend < p.grab && p.grab < p.ascend && p.ascend < p.flyOut && p.flyOut < p.watch && p.watch < p.hall && p.hall < p.black && p.black < p.total);
  assert.equal(pickupPose(0).present, false);
  const arriving = pickupPose(p.open + 5);
  assert.ok(arriving.present && arriving.north > 1000 && arriving.height === 1 && arriving.grab === 0, 'il entre de loin, par le nord, en vol');
  assert.ok(pickupPose(p.flyIn - 1).north < 5, 'et ralentit jusqu\'au point de pose');
  assert.ok(pickupPose(p.descend - 1).height < 0.05);
  assert.deepEqual([pickupPose(p.descend).grab, pickupPose(p.descend).height], [0, 0]);
  assert.ok(pickupPose(p.grab - 1).grab > 0.95, 'les pinces ont ramené les robots');
  assert.deepEqual([pickupPose(p.ascend - 1).grab, pickupPose(p.ascend - 1).north], [1, 0], 'il remonte avec eux');
  assert.ok(pickupPose(p.flyOut - 1).north > 1500 && pickupPose(p.flyOut - 1).grab === 1, 'et repart vers le nord');
  assert.equal(pickupPose(p.flyOut).present, false);
  assert.deepEqual([0, p.flyOut, p.watch, p.hall, p.black, p.total].map(pickupShot), ['landing', 'landing', 'hall', 'hall', 'black', 'black']);
});

test('l\'extraction : communiqué d\'urgence, radio des robots, puis la fin du niveau', () => {
  const { w } = open(['PetBot', 'BatBot']);
  put(w.heroes[0], OUT.x, OUT.y);
  put(w.heroes[1], OUT.x + 100, OUT.y + 60);
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
  put(w.heroes[0], OUT.x, OUT.y);
  run(w, 1);
  assert.ok(w.cast >= 0);
  for (let i = 0; i < CONFIG.arrival.skipHoldSteps + 5; i++) w.step([NO_INPUT, { ...NO_INPUT, dash: true }]);
  assert.equal(w.levelEnded, false, 'le second joueur ne peut pas');
  const events = run(w, CONFIG.arrival.skipHoldSteps + 5, { ...NO_INPUT, dash: true });
  assert.deepEqual(events.filter((e) => e.type === 'levelEnd'), [{ type: 'levelEnd' }]);
  assert.equal(w.levelEnded, true);
});
