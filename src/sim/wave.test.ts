// Tests de la riposte (GD-086 à GD-088) : après l'ultimatum, la police barre le parking sud ; l'équipe tombe
// dessus en y arrivant, un face-à-face se joue, puis la police tire et la troupe grossit groupe après groupe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.ts';
import { TV_STUDIO } from './additions.ts';
import { BLOCK_MOVE } from './geom.ts';
import { retrySession } from './match.ts';
import { LATE_FOR_DINNER, PLAN_B, POLICE, SCENE, SURRENDER, sceneLines, standoffPhases, standoffShot } from './scenes.ts';
import { GROUND_FLOOR, OBJ, OBJECTIVES, createSession } from './session.ts';
import type { Session } from './session.ts';
import { HOLDING, HUNTING, NORTH_GARAGE, TOO_MANY, waveAlive } from './wave.ts';
import { World } from './world.ts';
import { NO_INPUT } from './types.ts';
import type { Hero, Input, LevelData, SimEvent, SpriteManifest } from './types.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

/** Juste passé la porte nord du local technique : le premier pas sur le parking sud. */
const ARRIVAL = { x: 9700, y: 5200 };
const PRESS: Input = { ...NO_INPUT, dashPressed: true, dash: true };

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

function run(w: World, steps: number, host: Input = NO_INPUT): SimEvent[] {
  const events: SimEvent[] = [];
  for (let i = 0; i < steps; i++) {
    w.step(w.heroes.map((_, slot) => (slot === 0 ? host : NO_INPUT)));
    events.push(...w.drainEvents());
  }
  return events;
}

/** Les robots ne risquent rien : on mesure la troupe, pas le combat. */
function untouchable(w: World): void {
  for (const h of w.heroes) h.invuln = 1e9;
}

/** Le barrage est en place, puis un robot met le pied sur le parking : le face-à-face commence à ce step. */
function faced(names: string[]): { w: World; session: Session; events: SimEvent[] } {
  const { w, session } = after(names);
  untouchable(w);
  run(w, 2);
  put(w.heroes[0], ARRIVAL.x, ARRIVAL.y);
  const events = run(w, 1);
  assert.ok(w.cast >= 0 && w.castScene === SCENE.standoff, 'le face-à-face a commencé');
  return { w, session, events };
}

/** Le face-à-face est passé : la police vient d'ouvrir le feu. */
function engaged(names: string[]): { w: World; session: Session; events: SimEvent[] } {
  const { w, session, events } = faced(names);
  w.skipCast();
  events.push(...w.drainEvents());
  assert.equal(w.waveSteps, 1, 'la riposte a commencé');
  return { w, session, events };
}

const inside = (r: { x0: number; x1: number; y0: number; y1: number }, p: { x: number; y: number }): boolean => p.x > r.x0 && p.x < r.x1 && p.y > r.y0 && p.y < r.y1;
const size = (units: Record<string, number>): number => Object.values(units).reduce((a, b) => a + b, 0);
const gates = (w: World): string[] => w.doors.filter((d) => d.kind === 'button' && d.doorId === CONFIG.wave.gates).map((d) => d.phase);

test('à la fin de l\'ultimatum la police barre le parking sud : trois fourgons, dix policiers en ligne, portails fermés', () => {
  const { w } = after(['PetBot']);
  assert.equal(gates(w).length, 2);
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
  // le premier groupe : dix policiers à pied, en ligne devant les fourgons, loin des portes par où l'équipe arrivera
  const first = waveAlive(w);
  assert.equal(first.length, 10);
  const line = TV_STUDIO.wave.line;
  assert.equal(line.length, 10);
  for (const npc of first) {
    assert.equal(npc.object, 'obj_npc_human_pistol');
    assert.ok(line.some((p) => p.x === npc.x && p.y === npc.y), 'à une place de la ligne');
    assert.ok(npc.x - 9584 > 400, 'à distance des portes du local technique');
    assert.ok(vans.every((van) => van.x > npc.x), 'devant les fourgons, côté bâtiment');
    assert.ok(w.collision.circleFree(npc.x, npc.y, npc.def.radius * 0.5, BLOCK_MOVE), 'pas dans un fourgon');
    assert.ok(Math.cos(npc.angle) < -0.9, 'tourné vers le bâtiment');
    assert.deepEqual([npc.hunt, npc.alerted, npc.patrolType], [HOLDING, false, 'none']);
  }
  for (let i = 0; i < first.length; i++) for (let j = i + 1; j < first.length; j++) assert.ok(Math.hypot(first[i].x - first[j].x, first[i].y - first[j].y) > 90, 'pas l\'un sur l\'autre');
  // le bas du parking reste libre : c'est le passage des groupes qui entreront par les portails
  for (let x = 9700; x <= 10800; x += 100) assert.ok(w.collision.circleFree(x, 6100, 50, BLOCK_MOVE), `passage libre en x = ${x}`);
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
  assert.equal(w.cast, -1);
  assert.equal(waveAlive(w).length, 10);
  assert.deepEqual(waveAlive(w).map((n) => [n.x, n.y]), places, 'les policiers n\'ont pas quitté leur place');
  assert.ok(gates(w).every((p) => p === 'closed'));
  assert.equal(events.filter((e) => e.type === 'radio' || e.type === 'standoff').length, 0);
  assert.equal(w.objective, 'Leave by the south parking lot');
});

test('le face-à-face : un robot arrive sur le parking, le monde se fige, la police somme, le robot répond', () => {
  const { w, events } = faced(['BatBot', 'EngiBot']);
  assert.ok(events.some((e) => e.type === 'standoff'));
  // celui qui est devant le barrage répond, pas celui qui est resté sur le plateau
  assert.equal(w.heroes[w.castReader].def.name, 'BatBot');
  assert.deepEqual(sceneLines(w).map((l) => [l.speaker, l.text]), [[POLICE, SURRENDER], ['BatBot', LATE_FOR_DINNER], ['BatBot', PLAN_B]]);
  assert.ok(/surrounded/i.test(SURRENDER) && /dinner/i.test(LATE_FOR_DINNER) && /north garage/i.test(PLAN_B) && /plan B/i.test(PLAN_B));
  // la ligne tient le robot en joue
  for (const npc of waveAlive(w)) {
    const to = Math.atan2(ARRIVAL.y - npc.y, ARRIVAL.x - npc.x);
    assert.ok(Math.abs(Math.atan2(Math.sin(npc.angle - to), Math.cos(npc.angle - to))) < 0.01);
  }
  // le cadre montre les portes du local technique et le barrage, à la hauteur du robot
  const shot = standoffShot(w);
  const half = CONFIG.camera.viewWidth / 2;
  assert.ok(shot.x - half < 9584 && shot.x + half > 10300 && Math.abs(shot.y - ARRIVAL.y) < CONFIG.camera.viewHeight / 2 - CONFIG.standoff.shotMargin);
  // tout est figé : personne ne bouge, les portails restent fermés, l'horloge attend sur la sommation
  const places = waveAlive(w).map((n) => [n.x, n.y]);
  const p = standoffPhases();
  run(w, p.open + 120);
  assert.deepEqual([w.cast, w.introLine, w.waveSteps], [p.open, 0, 0]);
  assert.deepEqual(waveAlive(w).map((n) => [n.x, n.y]), places);
  assert.ok(gates(w).every((phase) => phase === 'closed'));
  assert.equal(w.objective, 'Leave by the south parking lot');
  // l'hôte fait défiler les trois répliques : un appui finit d'écrire, le suivant passe à la suite
  run(w, 1, PRESS);
  assert.equal(w.introLine, 1, 'la sommation était écrite : on passe à la réponse');
  run(w, 1, PRESS);
  run(w, 1, NO_INPUT);
  run(w, 1, PRESS);
  assert.equal(w.introLine, 2);
  run(w, 1, PRESS);
  run(w, 1, NO_INPUT);
  let end = run(w, 1, PRESS);
  assert.equal(w.introLine, 3);
  for (let i = 0; i < p.total && w.cast >= 0; i++) end = end.concat(run(w, 1));
  // la séquence finit : la police tire, les portails s'ouvrent, la consigne est le plan B
  assert.equal(w.cast, -1);
  assert.deepEqual(end.filter((e) => e.type === 'standoffEnd'), [{ type: 'standoffEnd', skipped: false }]);
  assert.ok(w.waveSteps >= 1);
  assert.ok(gates(w).every((phase) => phase === 'opening'), 'la police ouvre les portails 4');
  assert.equal(w.objective, 'Plan B: leave by the north garage');
  assert.equal(OBJECTIVES[OBJ.northGate], 'Plan B: leave by the north garage');
  const first = waveAlive(w);
  assert.equal(first.length, 10);
  for (const npc of first) assert.deepEqual([npc.hunt, npc.active, npc.alerted, npc.surpriseTimer], [HUNTING, true, true, 0], 'ils tirent sans attendre');
  assert.equal(end.filter((e) => e.type === 'radio').length, 0, 'le plan B est dit dans la séquence, pas à la radio');
  // et ils avancent vraiment
  const before = first.map((n) => Math.hypot(n.x - 9300, n.y - 5600));
  put(w.heroes[0], 9300, 5600);
  run(w, 60 * 4);
  assert.ok(first.filter((n, i) => Math.hypot(n.x - 9300, n.y - 5600) < before[i] - 100).length >= 5);
});

test('le face-à-face : sans personne aux commandes il défile seul ; l\'hôte peut le passer en tenant la touche', () => {
  const a = faced(['PetBot']);
  let steps = 0;
  while (a.w.cast >= 0 && steps < 60 * 80) {
    run(a.w, 1);
    steps++;
  }
  assert.equal(a.w.cast, -1, 'il se termine seul');
  assert.equal(a.w.session.objective, OBJ.northGate);
  // seul l'hôte passe la séquence
  const b = faced(['PetBot', 'BatBot']);
  for (let i = 0; i < CONFIG.arrival.skipHoldSteps + 5; i++) b.w.step([NO_INPUT, { ...NO_INPUT, dash: true }]);
  assert.ok(b.w.cast >= 0, 'le second joueur ne peut pas');
  let events: SimEvent[] = [];
  for (let i = 0; i < CONFIG.arrival.skipHoldSteps + 5 && b.w.cast >= 0; i++) events = events.concat(run(b.w, 1, { ...NO_INPUT, dash: true }));
  assert.equal(b.w.cast, -1);
  assert.deepEqual(events.filter((e) => e.type === 'standoffEnd'), [{ type: 'standoffEnd', skipped: true }]);
  assert.equal(b.w.waveSteps >= 1 && b.w.session.objective === OBJ.northGate, true);
  // une fois joué, il ne se rejoue pas
  put(b.w.heroes[0], 8700, 3900);
  run(b.w, 30);
  put(b.w.heroes[0], ARRIVAL.x, ARRIVAL.y);
  assert.equal(run(b.w, 30).filter((e) => e.type === 'standoff').length, 0);
});

test('le face-à-face se déclenche aussi quand un policier de la ligne repère un robot, ou tombe', () => {
  const b = after(['PetBot']);
  untouchable(b.w);
  run(b.w, 2);
  const sentry = waveAlive(b.w)[0];
  sentry.alerted = true;
  sentry.alertX = 9600;
  sentry.alertY = 5088;
  sentry.alertTimer = 600;
  run(b.w, 1);
  assert.ok(b.w.cast >= 0 && b.w.castScene === SCENE.standoff);
  const c = after(['PetBot']);
  run(c.w, 2);
  c.w.killNpc(waveAlive(c.w)[0]);
  run(c.w, 1);
  assert.ok(c.w.cast >= 0 && c.w.castScene === SCENE.standoff);
});

test('filet de sécurité : l\'équipe repart vers l\'ouest, la police se lance sans face-à-face et la radio annonce le plan B', () => {
  const { w } = after(['BatBot', 'EngiBot']);
  untouchable(w);
  run(w, 2);
  put(w.heroes[0], TV_STUDIO.room.x0 - 40, 6047);
  run(w, 1);
  assert.equal(w.waveSteps, 0, 'encore dans l\'aile');
  put(w.heroes[0], TV_STUDIO.room.x0 - 300, 6047);
  let events = run(w, 1);
  assert.equal(w.cast, -1, 'pas de face-à-face : personne n\'est devant le barrage');
  assert.equal(w.waveSteps, 1);
  assert.ok(waveAlive(w).every((n) => n.hunt === HUNTING));
  assert.equal(w.session.objective, OBJ.northGate);
  events = events.concat(run(w, CONFIG.wave.planChangeSteps - 2));
  assert.equal(events.filter((e) => e.type === 'radio').length, 0);
  events = run(w, 3);
  assert.deepEqual(events.filter((e) => e.type === 'radio'), [
    { type: 'radio', speaker: 'PetBot', text: TOO_MANY },
    { type: 'radio', speaker: 'BatBot', text: NORTH_GARAGE },
  ]);
  assert.equal(run(w, 600).filter((e) => e.type === 'radio').length, 0, 'une seule fois');
});

test('la troupe grossit : dix, puis quinze, puis vingt, les deux derniers groupes par les portails', () => {
  const cfg = CONFIG.wave;
  assert.deepEqual(cfg.groups.map((g) => size(g.units)), [10, 15, 20]);
  assert.equal(cfg.reinforce.maxAlive, 45);
  const { w, session } = engaged(['PetBot']);
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
  const { w } = engaged(['PetBot']);
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

test('des renforts remplacent ceux qui tombent, jamais plus de quarante-cinq debout', () => {
  const { w } = engaged(['PetBot']);
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

test('un garde d\'origine qui se tenait à la place d\'un fourgon ou d\'un policier du barrage est écarté', () => {
  const { w } = after(['PetBot'], true);
  untouchable(w);
  const guards = w.npcs.filter((n) => n.def.kind === 'soldier' && inside(TV_STUDIO.parkings.south, n));
  assert.ok(guards.length >= 2);
  const van = TV_STUDIO.wave.vans[1];
  const spot = TV_STUDIO.wave.line[4];
  put(guards[0] as unknown as Hero, van.x, van.y);
  put(guards[1] as unknown as Hero, spot.x + 10, spot.y);
  w.step(NO_INPUT);
  assert.ok(Math.hypot(guards[0].x - van.x, guards[0].y - van.y) > 60);
  assert.ok(Math.hypot(guards[1].x - spot.x, guards[1].y - spot.y) > guards[1].def.radius + 40);
  assert.equal(waveAlive(w).length, 10, 'la ligne est complète');
  for (const n of w.npcs) if (inside(TV_STUDIO.parkings.south, n)) assert.ok(w.collision.circleFree(n.x, n.y, n.def.radius * 0.5, BLOCK_MOVE), `${n.object} n'est pas dans un fourgon`);
});

test('après un échec, « Retry » ramène sur le plateau et le barrage est de nouveau en place, sans avoir bougé', () => {
  const { w, session } = engaged(['PetBot']);
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
  // et le face-à-face se rejoue quand l'équipe revient sur le parking
  put(fresh.hero, ARRIVAL.x, ARRIVAL.y);
  fresh.step(NO_INPUT);
  assert.ok(fresh.cast >= 0 && fresh.castScene === SCENE.standoff);
});

test('une minute de riposte tient dans le budget de calcul du serveur', () => {
  const { w } = engaged(['PetBot', 'BatBot']);
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
