// Tests de la riposte (GD-086) : après l'ultimatum, la police arrive par le sud, rallie le plateau, traque
// les robots, et le plan d'exfiltration change.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.ts';
import { TV_STUDIO } from './additions.ts';
import { BLOCK_MOVE } from './geom.ts';
import { retrySession } from './match.ts';
import { GROUND_FLOOR, OBJ, OBJECTIVES, createSession } from './session.ts';
import type { Session } from './session.ts';
import { HUNTING, NORTH_GATE, RALLYING, TOO_MANY, waveAlive } from './wave.ts';
import { World } from './world.ts';
import { NO_INPUT } from './types.ts';
import type { Hero, Input, LevelData, SimEvent, SpriteManifest } from './types.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

/** Partie où l'ultimatum vient de finir : l'équipe est derrière le pupitre, le bâtiment vidé de ses gardes. */
function after(names: string[]): { w: World; session: Session } {
  const session = createSession(names);
  session.carried.add('green').add('purple');
  session.objective = OBJ.dropPoint;
  const w = new World(ground, sprites, names, 7, session);
  session.rooms.set(GROUND_FLOOR, w);
  w.npcs = [];
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

const inside = (r: { x0: number; x1: number; y0: number; y1: number }, p: { x: number; y: number }): boolean => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;

test('la riposte commence à la fin de l\'ultimatum : portails ouverts, trois fourgons, quinze policiers sur le parking', () => {
  const { w } = after(['PetBot']);
  const gates = w.doors.filter((d) => d.kind === 'button' && d.doorId === CONFIG.wave.gates);
  assert.equal(gates.length, 2);
  assert.ok(gates.every((d) => d.phase === 'closed'));
  const decor = w.decor.length;
  assert.equal(w.waveSteps, -1);
  w.step(NO_INPUT);
  assert.equal(w.waveSteps, 0);
  assert.ok(gates.every((d) => d.phase === 'opening'), 'la police ouvre les portails 4');
  // trois fourgons, qui ne se chevauchent pas et qui sont des obstacles
  const vans = w.decor.slice(decor);
  assert.deepEqual(vans.map((d) => d.sprite), ['spr_pk_police_van', 'spr_pk_police_van', 'spr_pk_police_van']);
  const parking = TV_STUDIO.parkings.south;
  for (const van of vans) {
    assert.ok(inside(parking, van), 'sur le parking sud');
    assert.equal(w.collision.circleFree(van.x, van.y, 40, BLOCK_MOVE), false, 'on ne le traverse pas');
  }
  for (let i = 0; i < vans.length; i++) for (let j = i + 1; j < vans.length; j++) assert.ok(Math.hypot(vans[i].x - vans[j].x, vans[i].y - vans[j].y) > 380);
  // le premier groupe : quinze policiers à pied, à des places libres, qui savent où aller
  const first = waveAlive(w);
  assert.equal(first.length, 15);
  for (const npc of first) {
    assert.equal(npc.object, 'obj_npc_human_pistol');
    assert.ok(inside(parking, npc));
    assert.ok(w.collision.circleFree(npc.x, npc.y, npc.def.radius * 0.5, BLOCK_MOVE), 'pas dans un fourgon');
    assert.deepEqual([npc.hunt, npc.active, npc.alerted, npc.surpriseTimer], [RALLYING, true, true, 0]);
    assert.deepEqual([npc.alertX, npc.alertY], [TV_STUDIO.wave.rally.x, TV_STUDIO.wave.rally.y]);
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

test('la riposte : quarante-cinq soldats en trois arrivées, les deux dernières par les portails', () => {
  const { w, session } = after(['PetBot']);
  untouchable(w);
  const cfg = CONFIG.wave;
  assert.deepEqual(cfg.groups.map((g) => Object.values(g.units).reduce((a, b) => a + b, 0)), [15, 15, 15]);
  const soldiers = session.stats.totalSoldier;
  run(w, cfg.groups[1].atSteps - 1);
  assert.equal(waveAlive(w).length, 15);
  run(w, 2);
  const second = waveAlive(w).slice(15);
  assert.equal(second.length, 15);
  assert.ok(second.every((n) => n.y > 6304), 'ils arrivent de dehors, au sud des portails');
  assert.deepEqual(second.map((n) => n.object).sort().filter((o, i, a) => a.indexOf(o) === i), ['obj_npc_human_pistol', 'obj_npc_robot_shield', 'obj_npc_robot_shotBot']);
  run(w, cfg.groups[2].atSteps - cfg.groups[1].atSteps);
  assert.equal(waveAlive(w).length, 45);
  assert.equal(session.stats.totalSoldier, soldiers + 45, 'ils comptent dans les statistiques de la partie');
  // la troupe est au complet : pas de renfort tant que personne n'est tombé
  run(w, cfg.reinforce.everySteps + 5);
  assert.equal(waveAlive(w).length, 45);
});

test('la troupe entre par le local technique, traverse le salon de sortie et rallie le plateau', () => {
  const { w } = after(['PetBot']);
  untouchable(w);
  // le robot est sorti par le nord : personne à voir sur le plateau
  put(w.hero, 8700, 2300);
  const seen = { tech: false, lounge: false, studio: false };
  for (let i = 0; i < 60 * 40 && !seen.studio; i++) {
    w.step(NO_INPUT);
    for (const n of w.npcs) {
      if (n.hunt === 0) continue;
      if (inside(TV_STUDIO.techRoom, n)) seen.tech = true;
      else if (inside(TV_STUDIO.lounges.south, n)) seen.lounge = true;
      if (inside(TV_STUDIO.room, n)) seen.studio = true;
    }
  }
  assert.deepEqual(seen, { tech: true, lounge: true, studio: true });
  assert.ok(w.tick < 60 * 30, `le premier soldat est sur le plateau en moins de 30 secondes (${Math.round(w.tick / 60)} s)`);
});

test('la troupe traque les robots : arrivée au plateau sans trouver personne, elle va où ils sont', () => {
  const { w } = after(['PetBot']);
  untouchable(w);
  // le robot s'est replié au nord, dans le salon d'attente
  const refuge = { x: 8700, y: 2300 };
  put(w.hero, refuge.x, refuge.y);
  let nearest = Infinity;
  for (let i = 0; i < 60 * 75 && nearest > 600; i++) {
    w.step(NO_INPUT);
    put(w.hero, refuge.x, refuge.y);
    if (i % 30 === 0) nearest = Math.min(...waveAlive(w).map((n) => Math.hypot(n.x - refuge.x, n.y - refuge.y)));
  }
  assert.ok(nearest <= 600, `un soldat de la vague arrive au contact dans le salon d'attente (le plus proche est à ${Math.round(nearest)} px)`);
  assert.ok(waveAlive(w).some((n) => n.hunt === HUNTING));
});

test('le plan change au premier contact : la voix du véhicule prévient, un robot au sol décide', () => {
  // 1. un robot passe au sud du plateau
  const a = after(['BatBot', 'EngiBot']);
  let events = run(a.w, 30);
  assert.equal(a.w.objective, 'Get back to the drop point');
  assert.equal(events.filter((e) => e.type === 'radio').length, 0);
  put(a.w.heroes[1], 8500, 5200);
  events = run(a.w, 2);
  assert.equal(a.w.objective, 'Too many of them. Take the north gate');
  assert.equal(OBJECTIVES[OBJ.northGate], 'Too many of them. Take the north gate');
  const radio = events.filter((e) => e.type === 'radio');
  assert.deepEqual(radio, [
    { type: 'radio', speaker: 'PetBot', text: TOO_MANY },
    { type: 'radio', speaker: 'BatBot', text: NORTH_GATE },
  ]);
  assert.equal(run(a.w, 120).filter((e) => e.type === 'radio').length, 0, 'une seule fois');

  // 2. personne ne bouge : un soldat de la vague entre sur le plateau, ou le temps passe
  const b = after(['PetBot']);
  untouchable(b.w);
  events = [];
  let changedAt = -1;
  for (let i = 0; i < CONFIG.wave.planChangeSteps + 5 && changedAt < 0; i++) {
    events.push(...run(b.w, 1));
    if (b.w.session.objective === OBJ.northGate) changedAt = b.w.waveSteps;
  }
  assert.ok(changedAt > 0 && changedAt <= CONFIG.wave.planChangeSteps, 'au plus tard après le délai');
  const onSet = b.w.npcs.some((n) => n.hunt > 0 && inside(TV_STUDIO.room, n));
  assert.ok(onSet || changedAt === CONFIG.wave.planChangeSteps, 'un soldat de la vague est entré sur le plateau, ou le délai est écoulé');
  assert.deepEqual(events.filter((e) => e.type === 'radio').map((e) => e.type === 'radio' && e.speaker), ['EngiBot', 'PetBot']);

  // 3. les quatre robots sont joués : personne à bord, BadaBot prévient et un autre répond
  const c = after(['EngiBot', 'PetBot', 'BatBot', 'BadaBot']);
  put(c.w.heroes[0], 8500, 5200);
  events = run(c.w, 2);
  assert.deepEqual(events.filter((e) => e.type === 'radio').map((e) => e.type === 'radio' && e.speaker), ['BadaBot', 'BatBot']);
});

test('des renforts remplacent ceux qui tombent : le sud ne se vide pas', () => {
  const { w } = after(['PetBot']);
  untouchable(w);
  const cfg = CONFIG.wave;
  run(w, cfg.groups[2].atSteps + 2);
  assert.equal(waveAlive(w).length, 45);
  for (const npc of waveAlive(w).slice(0, 20)) w.killNpc(npc);
  assert.equal(waveAlive(w).length, 25);
  run(w, cfg.reinforce.everySteps);
  const per = Object.values(cfg.reinforce.units).reduce((x, y) => x + y, 0);
  assert.equal(waveAlive(w).length, 25 + per, 'un groupe de renfort');
  // et encore, jusqu'au plafond, jamais au-delà
  run(w, cfg.reinforce.everySteps * 6);
  assert.equal(waveAlive(w).length, cfg.reinforce.maxAlive);
});

test('après un échec, « Retry » ramène sur le plateau et la riposte reprend du début', () => {
  const { w, session } = after(['PetBot']);
  session.checkpoint = { room: GROUND_FLOOR, x: TV_STUDIO.regroup.x - 110, y: TV_STUDIO.regroup.y - 40, objective: OBJ.dropPoint };
  put(w.hero, 8500, 5200);
  run(w, 5);
  assert.equal(session.objective, OBJ.northGate);
  retrySession(session);
  assert.equal(session.objective, OBJ.dropPoint, 'la consigne du point de sauvegarde');
  const fresh = new World(ground, sprites, session.heroNames, 9, session);
  assert.equal(fresh.waveSteps, -1);
  fresh.step(NO_INPUT);
  assert.equal(waveAlive(fresh).length, 15);
  assert.equal(fresh.decor.filter((d) => d.sprite === 'spr_pk_police_van').length, 3);
});

test('une minute de riposte tient dans le budget de calcul du serveur', () => {
  const { w } = after(['PetBot', 'BatBot']);
  untouchable(w);
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
