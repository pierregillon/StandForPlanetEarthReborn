// Tests de la riposte (GD-086, GD-087) : après l'ultimatum, la police est en place au sud ; l'équipe la
// découvre en arrivant sur le parking, la troupe grossit groupe après groupe, et le plan d'exfiltration change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.ts';
import { TV_STUDIO } from './additions.ts';
import { BLOCK_MOVE } from './geom.ts';
import { retrySession } from './match.ts';
import { GROUND_FLOOR, OBJ, OBJECTIVES, createSession } from './session.ts';
import type { Session } from './session.ts';
import { HOLDING, HUNTING, NORTH_GATE, TOO_MANY, waveAlive } from './wave.ts';
import { World } from './world.ts';
import { NO_INPUT } from './types.ts';
import type { Hero, Input, LevelData, SimEvent, SpriteManifest } from './types.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

/** Juste passé la porte nord du local technique : le premier pas sur le parking sud. */
const ARRIVAL = { x: 9700, y: 5200 };

/** Partie où l'ultimatum vient de finir : l'équipe est derrière le pupitre, le bâtiment vidé de ses gardes. */
function after(names: string[], keepGuards = false): { w: World; session: Session } {
  const session = createSession(names);
  session.carried.add('green').add('purple');
  session.objective = OBJ.dropPoint;
  const w = new World(ground, sprites, names, 7, session);
  session.rooms.set(GROUND_FLOOR, w);
  if (!keepGuards) w.npcs = [];
  w.heroes.forEach((h, i) => put(h, TV_STUDIO.mark.x + 20, TV_STUDIO.mark.y - 60 + i * 80));
  return { w, session };
}

function put(h: Hero, x: number, y: number): void {
  h.x = x;
  h.y = y;
}

const idle = (w: World): Input[] => w.heroes.map(() => NO_INPUT);

function run(w: World, steps: number): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < steps; i++) {
    w.step(idle(w));
    events.push(...w.drainEvents());
  }
  return events;
}

/** Les robots ne risquent rien : on mesure la troupe, pas le combat. */
function untouchable(w: World): void {
  for (const h of w.heroes) h.invuln = 1e9;
}

/** La police est en place, puis un robot met le pied sur le parking : la riposte commence à ce step. */
function arrived(names: string[]): { w: World; session: Session; events: SimEvent[] } {
  const { w, session } = after(names);
  untouchable(w);
  run(w, 2);
  put(w.heroes[0], ARRIVAL.x, ARRIVAL.y);
  const events = run(w, 1);
  assert.equal(w.waveSteps, 1, 'la riposte a commencé');
  return { w, session, events };
}

const inside = (r: { x0: number; x1: number; y0: number; y1: number }, p: { x: number; y: number }): boolean => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;
const size = (units: Record<string, number>): number => Object.values(units).reduce((a, b) => a + b, 0);

test('à la fin de l\'ultimatum la police se met en place : trois fourgons, dix policiers devant, portails fermés', () => {
  const { w } = after(['PetBot']);
  const gates = w.doors.filter((d) => d.kind === 'button' && d.doorId === CONFIG.wave.gates);
  assert.equal(gates.length, 2);
  const decor = w.decor.length;
  assert.equal(w.waveSteps, -1);
  w.step(NO_INPUT);
  assert.equal(w.waveSteps, 0);
  // trois fourgons, qui ne se chevauchent pas et qui sont des obstacles
  const vans = w.decor.slice(decor);
  assert.deepEqual(vans.map((d) => d.sprite), ['spr_pk_police_van', 'spr_pk_police_van', 'spr_pk_police_van']);
  const parking = TV_STUDIO.parkings.south;
  for (const van of vans) {
    assert.ok(inside(parking, van), 'sur le parking sud');
    assert.equal(w.collision.circleFree(van.x, van.y, 40, BLOCK_MOVE), false, 'on ne le traverse pas');
  }
  for (let i = 0; i < vans.length; i++) for (let j = i + 1; j < vans.length; j++) assert.ok(Math.hypot(vans[i].x - vans[j].x, vans[i].y - vans[j].y) > 380);
  // le premier groupe : dix policiers à pied, à des places libres, loin des portes par où l'équipe arrivera
  const first = waveAlive(w);
  assert.equal(first.length, 10);
  for (const npc of first) {
    assert.equal(npc.object, 'obj_npc_human_pistol');
    assert.ok(inside(parking, npc));
    assert.ok(npc.x - 9584 > 400, 'à distance des portes du local technique');
    assert.ok(w.collision.circleFree(npc.x, npc.y, npc.def.radius * 0.5, BLOCK_MOVE), 'pas dans un fourgon');
    assert.deepEqual([npc.hunt, npc.alerted, npc.patrolType], [HOLDING, false, 'none']);
  }
  for (let i = 0; i < first.length; i++) for (let j = i + 1; j < first.length; j++) assert.ok(Math.hypot(first[i].x - first[j].x, first[i].y - first[j].y) > 90, 'pas l\'un sur l\'autre');
  // rien de tout cela avant l'ultimatum
  const session = createSession(['PetBot']);
  session.objective = OBJ.broadcast;
  const early = new World(ground, sprites, ['PetBot'], 7, session);
  early.npcs = [];
  for (let i = 0; i < 120; i++) early.step(NO_INPUT);
  assert.equal(early.waveSteps, -1);
  assert.equal(early.npcs.length, 0);
});

test('tant que l\'équipe n\'est pas au sud, rien ne bouge : ni renfort, ni radio, ni changement de consigne', () => {
  const { w } = after(['PetBot', 'BatBot']);
  run(w, 1);
  const places = waveAlive(w).map((n) => [n.x, n.y]);
  // l'équipe traîne sur le plateau, puis traverse le salon de sortie et entre dans le local technique
  let events = run(w, 60 * 20);
  put(w.heroes[0], 8700, 5400);
  events = events.concat(run(w, 60 * 5));
  put(w.heroes[0], 9300, 5600);
  events = events.concat(run(w, 60 * 5));
  assert.equal(w.waveSteps, 0);
  assert.equal(waveAlive(w).length, 10);
  assert.deepEqual(waveAlive(w).map((n) => [n.x, n.y]), places, 'les policiers n\'ont pas quitté leur place');
  assert.ok(w.doors.filter((d) => d.kind === 'button' && d.doorId === CONFIG.wave.gates).every((d) => d.phase === 'closed'));
  assert.equal(events.filter((e) => e.type === 'radio').length, 0);
  assert.equal(w.objective, 'Leave by the south parking lot');
});

test('la riposte commence quand un robot arrive sur le parking : les portails s\'ouvrent, les dix policiers se lancent', () => {
  const { w } = arrived(['PetBot']);
  assert.ok(w.doors.filter((d) => d.kind === 'button' && d.doorId === CONFIG.wave.gates).every((d) => d.phase === 'opening'), 'la police ouvre les portails 4');
  const first = waveAlive(w);
  assert.equal(first.length, 10);
  for (const npc of first) {
    assert.deepEqual([npc.hunt, npc.active, npc.alerted], [HUNTING, true, true]);
    assert.ok(Math.hypot(npc.alertX - ARRIVAL.x, npc.alertY - ARRIVAL.y) < 5, 'ils vont sur le robot');
  }
  assert.ok(first.some((n) => n.surpriseTimer > 0), 'ceux qui n\'avaient rien vu marquent un temps de surprise');
  // ils avancent vraiment
  const before = first.map((n) => Math.hypot(n.x - ARRIVAL.x, n.y - ARRIVAL.y));
  put(w.hero, 8700, 3900);
  run(w, 60 * 4);
  put(w.hero, ARRIVAL.x, ARRIVAL.y);
  assert.ok(first.filter((n, i) => Math.hypot(n.x - ARRIVAL.x, n.y - ARRIVAL.y) < before[i] - 100).length >= 5);

  // un soldat en place qui voit un robot par la porte ouverte suffit aussi
  const b = after(['PetBot']);
  untouchable(b.w);
  run(b.w, 2);
  const sentry = waveAlive(b.w)[0];
  sentry.alerted = true;
  sentry.alertX = 9600;
  sentry.alertY = 5088;
  sentry.alertTimer = 600;
  run(b.w, 1);
  assert.equal(b.w.waveSteps, 1);
  // de même si l'un d'eux tombe, touché de loin
  const c = after(['PetBot']);
  run(c.w, 2);
  c.w.killNpc(waveAlive(c.w)[0]);
  run(c.w, 1);
  assert.equal(c.w.waveSteps, 1);
  // filet de sécurité : l'équipe repart par où elle est venue, vers l'ouest ; la police se lance quand même
  const d = after(['PetBot']);
  untouchable(d.w);
  run(d.w, 2);
  put(d.w.hero, TV_STUDIO.room.x0 - 40, 6047);
  run(d.w, 1);
  assert.equal(d.w.waveSteps, 0, 'encore dans l\'aile');
  put(d.w.hero, TV_STUDIO.room.x0 - 300, 6047);
  run(d.w, 1);
  assert.equal(d.w.waveSteps, 1);
  assert.ok(waveAlive(d.w).every((n) => n.hunt === HUNTING));
});

test('la troupe grossit : dix, puis quinze, puis vingt, les deux derniers groupes par les portails', () => {
  const cfg = CONFIG.wave;
  assert.deepEqual(cfg.groups.map((g) => size(g.units)), [10, 15, 20]);
  assert.equal(cfg.reinforce.maxAlive, 45);
  const { w, session } = arrived(['PetBot']);
  const soldiers = session.stats.totalSoldier;
  run(w, cfg.groups[1].atSteps - 2);
  assert.equal(waveAlive(w).length, 10);
  run(w, 2);
  const second = waveAlive(w).slice(10);
  assert.equal(second.length, 15);
  assert.ok(second.every((n) => n.y > 6304), 'ils arrivent de dehors, au sud des portails');
  assert.ok(second.every((n) => n.hunt === HUNTING && n.active && n.surpriseTimer === 0), 'et ils savent où aller');
  assert.deepEqual(second.map((n) => n.object).sort().filter((o, i, a) => a.indexOf(o) === i), ['obj_npc_human_pistol', 'obj_npc_robot_shield', 'obj_npc_robot_shotBot']);
  run(w, cfg.groups[2].atSteps - cfg.groups[1].atSteps - 2);
  assert.equal(waveAlive(w).length, 25);
  run(w, 2);
  assert.equal(waveAlive(w).length, 45);
  assert.equal(session.stats.totalSoldier, soldiers + 35, 'ils comptent dans les statistiques de la partie');
  // la troupe est au complet : pas de renfort tant que personne n'est tombé
  run(w, cfg.reinforce.everySteps + 5);
  assert.equal(waveAlive(w).length, 45);
});

test('la troupe traque les robots : l\'équipe repartie vers le nord, elle la suit à travers l\'aile', () => {
  const { w } = arrived(['PetBot']);
  // le robot s'est replié au nord, dans le salon d'attente
  const refuge = { x: 8700, y: 2300 };
  put(w.hero, refuge.x, refuge.y);
  const seen = { tech: false, studio: false };
  let nearest = Infinity;
  for (let i = 0; i < 60 * 90 && nearest > 600; i++) {
    w.step(NO_INPUT);
    put(w.hero, refuge.x, refuge.y);
    if (i % 30 !== 0) continue;
    for (const n of waveAlive(w)) {
      if (inside(TV_STUDIO.techRoom, n)) seen.tech = true;
      if (inside(TV_STUDIO.room, n)) seen.studio = true;
    }
    nearest = Math.min(...waveAlive(w).map((n) => Math.hypot(n.x - refuge.x, n.y - refuge.y)));
  }
  assert.ok(nearest <= 600, `un soldat de la vague arrive au contact dans le salon d'attente (le plus proche est à ${Math.round(nearest)} px)`);
  assert.deepEqual(seen, { tech: true, studio: true }, 'par le local technique, puis le plateau');
});

test('le plan change trois secondes après l\'arrivée : la voix du véhicule prévient, un robot au sol décide', () => {
  const a = arrived(['BatBot', 'EngiBot']);
  assert.equal(a.w.objective, 'Leave by the south parking lot');
  let events = a.events.concat(run(a.w, CONFIG.wave.planChangeSteps - 2));
  assert.equal(events.filter((e) => e.type === 'radio').length, 0, 'pas avant que l\'équipe ait vu la troupe');
  events = run(a.w, 2);
  assert.equal(a.w.objective, 'Too many of them. Take the north gate');
  assert.equal(OBJECTIVES[OBJ.northGate], 'Too many of them. Take the north gate');
  assert.deepEqual(events.filter((e) => e.type === 'radio'), [
    { type: 'radio', speaker: 'PetBot', text: TOO_MANY },
    { type: 'radio', speaker: 'BatBot', text: NORTH_GATE },
  ]);
  assert.equal(run(a.w, 600).filter((e) => e.type === 'radio').length, 0, 'une seule fois');
  // la radio annonce ce qui vient : le deuxième groupe entre après elle
  assert.ok(CONFIG.wave.planChangeSteps < CONFIG.wave.groups[1].atSteps);

  // seul : EngiBot parle depuis le véhicule, le robot au sol répond
  const b = arrived(['PetBot']);
  events = run(b.w, CONFIG.wave.planChangeSteps);
  assert.deepEqual(events.filter((e) => e.type === 'radio').map((e) => e.type === 'radio' && e.speaker), ['EngiBot', 'PetBot']);

  // les quatre robots sont joués : personne à bord, BadaBot prévient et un autre répond
  const c = arrived(['EngiBot', 'PetBot', 'BatBot', 'BadaBot']);
  events = run(c.w, CONFIG.wave.planChangeSteps);
  assert.deepEqual(events.filter((e) => e.type === 'radio').map((e) => e.type === 'radio' && e.speaker), ['BadaBot', 'BatBot']);
});

test('des renforts remplacent ceux qui tombent, jamais plus de quarante-cinq debout', () => {
  const { w } = arrived(['PetBot']);
  const cfg = CONFIG.wave;
  run(w, cfg.groups[2].atSteps + 2);
  assert.equal(waveAlive(w).length, 45);
  for (const npc of waveAlive(w).slice(0, 20)) w.killNpc(npc);
  assert.equal(waveAlive(w).length, 25);
  run(w, cfg.reinforce.everySteps);
  assert.equal(waveAlive(w).length, 25 + size(cfg.reinforce.units), 'un groupe de renfort');
  // et encore, jusqu'au plafond, jamais au-delà
  run(w, cfg.reinforce.everySteps * 6);
  assert.equal(waveAlive(w).length, cfg.reinforce.maxAlive);
});

test('un garde d\'origine qui se tenait à la place d\'un fourgon est écarté', () => {
  const { w } = after(['PetBot'], true);
  untouchable(w);
  const guard = w.npcs.find((n) => n.def.kind === 'soldier' && inside(TV_STUDIO.parkings.south, n));
  assert.ok(guard);
  const van = TV_STUDIO.wave.vans[1];
  guard.x = van.x;
  guard.y = van.y;
  w.step(NO_INPUT);
  assert.ok(Math.hypot(guard.x - van.x, guard.y - van.y) > 60);
  for (const n of w.npcs) if (inside(TV_STUDIO.parkings.south, n)) assert.ok(w.collision.circleFree(n.x, n.y, n.def.radius * 0.5, BLOCK_MOVE), `${n.object} n'est pas dans un fourgon`);
});

test('après un échec, « Retry » ramène sur le plateau et la police est de nouveau en place, sans avoir bougé', () => {
  const { w, session } = arrived(['PetBot']);
  session.checkpoint = { room: GROUND_FLOOR, x: TV_STUDIO.regroup.x - 110, y: TV_STUDIO.regroup.y - 40, objective: OBJ.dropPoint };
  run(w, CONFIG.wave.groups[1].atSteps);
  assert.equal(session.objective, OBJ.northGate);
  assert.equal(waveAlive(w).length, 25);
  retrySession(session);
  assert.equal(session.objective, OBJ.dropPoint, 'la consigne du point de sauvegarde');
  const fresh = new World(ground, sprites, session.heroNames, 9, session);
  fresh.npcs = [];
  assert.equal(fresh.waveSteps, -1);
  for (let i = 0; i < 120; i++) fresh.step(NO_INPUT);
  assert.equal(fresh.waveSteps, 0);
  assert.equal(waveAlive(fresh).length, 10);
  assert.ok(waveAlive(fresh).every((n) => n.hunt === HOLDING));
  assert.equal(fresh.decor.filter((d) => d.sprite === 'spr_pk_police_van').length, 3);
});

test('une minute de riposte tient dans le budget de calcul du serveur', () => {
  const { w } = arrived(['PetBot', 'BatBot']);
  let worst = 0;
  const t0 = performance.now();
  for (let i = 0; i < 60 * 60; i++) {
    const a = performance.now();
    w.step(idle(w));
    worst = Math.max(worst, performance.now() - a);
    w.drainEvents();
  }
  const mean = (performance.now() - t0) / 3600;
  assert.ok(mean < 6, `un step coûte en moyenne ${mean.toFixed(2)} ms (budget : 16,7 ms)`);
  console.log(`riposte : ${mean.toFixed(2)} ms par step en moyenne, ${worst.toFixed(1)} ms au pire`);
});
