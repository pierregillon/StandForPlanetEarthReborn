// Tir principal de PetBot : le mini-drone à tête chercheuse (GD-093, GD-094), sur le vrai niveau. Les PNJ utiles
// sont amenés dehors, près du point de départ, là où rien ne gêne, et figés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.ts';
import { HOLDING } from './npc.ts';
import { NO_INPUT } from './types.ts';
import type { Input, LevelData, Npc, Seeker, SimEvent, SpriteManifest } from './types.ts';
import { CONFIG } from './config.ts';

const level = JSON.parse(readFileSync(new URL('../../public/levels/rm_world2.json', import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;
const S = CONFIG.abilities.petBot.seeker;

/** PetBot, prêt à tirer vers la droite, et les PNJ demandés posés à (dx, dy) de lui : immobiles, sourds et aveugles. */
function arena(spots: [string, number, number][]): { w: World; npcs: Npc[]; events: SimEvent[] } {
  const w = new World(level, sprites, 'PetBot', 7);
  const h = w.hero;
  h.arrivalSteps = 0;
  h.deploySteps = 0;
  h.angle = 0;
  const pool = w.npcs.slice();
  const npcs = spots.map(([object, dx, dy]) => {
    const i = pool.findIndex((n) => n.object === object);
    assert.ok(i >= 0, object);
    const npc = pool.splice(i, 1)[0];
    npc.x = h.x + dx;
    npc.y = h.y + dy;
    npc.hp = 10;
    npc.hunt = HOLDING;
    return npc;
  });
  w.npcs = npcs;
  const events: SimEvent[] = [];
  const emit = w.emit.bind(w);
  w.emit = (e) => {
    events.push(e);
    emit(e);
  };
  return { w, npcs, events };
}

function at(w: World, dx: number, dy: number, more: Partial<Input> = {}): Input {
  return { ...NO_INPUT, aimX: w.hero.x + dx, aimY: w.hero.y + dy, ...more };
}

function run(w: World, steps: number, input: Input): void {
  for (let i = 0; i < steps; i++) w.step(input);
}

/** Tire un drone vers (dx, dy) et le laisse voler jusqu'à ce qu'il ait pris cette cible. */
function lockOn(w: World, dx: number, dy: number, target: Npc): Seeker {
  w.step(at(w, dx, dy, { fire1: true }));
  const d = w.seekers[0];
  assert.ok(d);
  for (let i = 0; i < 60 && d.target !== target.id; i++) w.step(at(w, dx, dy));
  assert.equal(d.target, target.id, 'le drone a pris sa cible au point cliqué');
  return d;
}

test('PetBot : le drone va au point cliqué, puis prend l\'ennemi le plus proche de ce point', () => {
  const { w, npcs: [near, far] } = arena([['obj_npc_human_pistol', 700, 220], ['obj_npc_human_pistol', 700, -290]]);
  const h = w.hero;
  w.step(at(w, 700, 0, { fire1: true }));
  assert.equal(w.bullets.length, 0, 'plus de balle');
  assert.equal(h.ammo, h.def.magazine - 1);
  const d = w.seekers[0];
  assert.equal(d.target, -1);
  assert.ok(d.scout > 0);
  // il vole droit vers le point, sans dévier, tant qu'il n'y est pas
  const heading = d.angle;
  run(w, 10, at(w, 700, 0));
  assert.equal(d.angle, heading);
  assert.equal(d.target, -1);
  run(w, 60, at(w, 700, 0));
  assert.equal(w.seekers.length, 0);
  assert.equal(near.hp, 10 - S.damage, 'le plus proche du point cliqué');
  assert.equal(far.hp, 10);
});

test('PetBot : les deux rayons de recherche font 500 px, et un civil n\'est jamais pris pour cible', () => {
  assert.equal(S.seekRadius, 500);
  assert.equal(S.retargetRadius, 500);
  // un soldat à 480 px du point cliqué est pris ; le civil, bien plus près du point, est ignoré
  const { w, npcs: [soldier, civil] } = arena([['obj_npc_human_pistol', 600, -480], ['obj_npc_civil_femme', 600, 130]]);
  w.step(at(w, 600, 0, { fire1: true }));
  run(w, 90, at(w, 600, 0));
  assert.equal(soldier.hp, 10 - S.damage);
  assert.equal(civil.hp, 10);
  // à 520 px du point, il est hors de portée : le drone file tout droit
  const out = arena([['obj_npc_human_pistol', 600, -520]]);
  out.w.step(at(out.w, 600, 0, { fire1: true }));
  run(out.w, 200, at(out.w, 600, 0));
  assert.equal(out.w.seekers.length, 0);
  assert.equal(out.npcs[0].hp, 10);
});

test('PetBot : cliquer sur un ennemi ne le désigne pas, le drone touche ce qu\'il rencontre en route (GD-094)', () => {
  // un soldat sur la ligne de tir, un autre derrière lui sous le clic : c'est le premier qui prend le drone
  const { w, npcs: [front, clicked], events } = arena([['obj_npc_human_pistol', 400, 0], ['obj_npc_human_pistol', 800, 30]]);
  w.step(at(w, 800, 30, { fire1: true }));
  assert.equal(w.seekers[0].target, -1, 'pas de cible au départ, même en cliquant sur un ennemi');
  run(w, 60, at(w, 800, 30));
  assert.equal(w.seekers.length, 0);
  assert.equal(front.hp, 10 - S.damage);
  assert.equal(clicked.hp, 10);
  assert.ok(events.some((e) => e.type === 'impact' && e.surface === 'npc'));
});

test('PetBot : clic tenu, chaque drone part vers le point visé à cet instant', () => {
  const { w } = arena([]);
  const h = w.hero;
  w.step(at(w, 600, -300, { fire1: true }));
  run(w, 22, at(w, 600, 300, { fire1: true }));
  assert.equal(w.seekers.length, 2);
  assert.equal(w.seekers[0].destY, h.y - 300);
  assert.equal(w.seekers[1].destY, h.y + 300);
  // clic tenu jusqu'au bout : un drone par intervalle, le chargeur se vide comme avant
  run(w, 300, at(w, 600, 300, { fire1: true }));
  assert.equal(h.ammo, 0);
  assert.equal(w.stats.ammoUsed, h.def.magazine);
});

test('PetBot : la cible morte en vol, le drone se reporte sur l\'ennemi le plus proche de lui', () => {
  const { w, npcs: [target, other] } = arena([['obj_npc_human_pistol', 600, 200], ['obj_npc_human_pistol', 600, -350]]);
  const d = lockOn(w, 600, 0, target);
  target.hp = 0;
  run(w, 3, at(w, 600, 0));
  assert.ok(!w.npcs.includes(target));
  assert.equal(d.target, other.id);
  run(w, 60, at(w, 600, 0));
  assert.equal(other.hp, 10 - S.damage);
});

test('PetBot : un drone qui poursuit une cible ne touche qu\'elle', () => {
  const { w, npcs: [target, other] } = arena([['obj_npc_human_pistol', 500, -450], ['obj_npc_human_pistol', -600, 0]]);
  const d = lockOn(w, 500, 0, target);
  // un autre soldat vient se mettre entre le drone et sa cible : le drone passe au-dessus
  other.x = (d.x + target.x) / 2;
  other.y = (d.y + target.y) / 2;
  run(w, 60, at(w, 500, 0));
  assert.equal(w.seekers.length, 0);
  assert.equal(target.hp, 10 - S.damage);
  assert.equal(other.hp, 10);
});

test('PetBot : personne autour du point cliqué, le drone file tout droit et finit dans le décor', () => {
  // un soldat hors du rayon de recherche mais plus loin sur la même ligne : il est touché au passage
  const { w, npcs: [inLine, aside] } = arena([['obj_npc_human_pistol', 1100, 0], ['obj_npc_human_pistol', 500, 600]]);
  w.step(at(w, 500, 0, { fire1: true }));
  run(w, 80, at(w, 500, 0));
  assert.equal(w.seekers.length, 0);
  assert.equal(inLine.hp, 10 - S.damage);
  assert.equal(aside.hp, 10, 'hors du rayon de recherche, hors de la ligne');

  // personne nulle part : il finit dans un mur, ou s'éteint au bout de sa course
  const empty = arena([['obj_npc_human_pistol', 300, 900]]);
  empty.w.step(at(empty.w, 500, 0, { fire1: true }));
  run(empty.w, 200, at(empty.w, 500, 0));
  assert.equal(empty.w.seekers.length, 0);
  assert.equal(empty.npcs[0].hp, 10);
  assert.ok(empty.events.some((e) => e.type === 'impact' && e.surface === 'wall'));
});

/** Un endroit libre qu'on ne voit pas depuis (x0, y0), mais qu'un chemin court permet de rejoindre. */
function hiddenSpot(w: World, x0: number, y0: number): { x: number; y: number } {
  for (let dx = -1200; dx <= 1200; dx += 100) {
    for (let dy = -1200; dy <= 1200; dy += 100) {
      const x = x0 + dx;
      const y = y0 + dy;
      if (x < 50 || y < 50 || x > w.width - 50 || y > w.height - 50) continue;
      if (w.nav.isBlockedAt(x, y) || !w.shotBlocked(x0, y0, x, y)) continue;
      const path = w.nav.findPath(x0, y0, x, y);
      if (!path) continue;
      let length = 0;
      let px = x0;
      let py = y0;
      for (const p of path) {
        length += Math.hypot(p.x - px, p.y - py);
        px = p.x;
        py = p.y;
      }
      if (length < 1500) return { x, y };
    }
  }
  throw new Error('aucun endroit caché près du point de départ');
}

function openDoors(w: World): void {
  // les portes automatiques ne s'ouvrent pas pour un drone : on les ouvre, seul le contournement est jugé ici
  for (const door of w.doors) {
    door.progress = 1;
    door.phase = 'open';
    door.blockedOpen = true;
    w.updateDoorObstacle(door);
  }
}

test('PetBot : la cible passée derrière un mur, le drone contourne l\'obstacle ; sans chemin, il s\'écrase', () => {
  const { w, npcs: [target] } = arena([['obj_npc_human_pistol', 500, 150]]);
  openDoors(w);
  const d = lockOn(w, 500, 0, target);
  // la cible disparaît derrière un mur pendant que le drone est en vol
  const spot = hiddenSpot(w, d.x, d.y);
  target.x = spot.x;
  target.y = spot.y;
  run(w, 150, at(w, 500, 0));
  assert.equal(w.seekers.length, 0);
  assert.equal(target.hp, 10 - S.damage, 'le drone a trouvé son chemin');

  // même situation, mais aucun chemin : la tête chercheuse décroche et le drone finit dans le décor
  const lost = arena([['obj_npc_human_pistol', 500, 150]]);
  openDoors(lost.w);
  const stray = lockOn(lost.w, 500, 0, lost.npcs[0]);
  const hide = hiddenSpot(lost.w, stray.x, stray.y);
  lost.w.nav.findPath = () => null;
  lost.npcs[0].x = hide.x;
  lost.npcs[0].y = hide.y;
  run(lost.w, 3, at(lost.w, 500, 0));
  assert.equal(stray.target, -1);
  run(lost.w, 200, at(lost.w, 500, 0));
  assert.equal(lost.w.seekers.length, 0);
  assert.equal(lost.npcs[0].hp, 10);
  assert.ok(lost.events.some((e) => e.type === 'impact' && e.surface === 'wall'));
});

test('PetBot : le robot bouclier arrête le drone de face', () => {
  const { w, npcs: [shield] } = arena([['obj_npc_robot_shield', 500, 0]]);
  shield.angle = Math.PI; // il fait face à PetBot
  const before = shield.shieldHp;
  assert.ok(before > 0);
  w.step(at(w, 500, 0, { fire1: true }));
  run(w, 40, at(w, 500, 0));
  assert.equal(shield.hp, 10);
  assert.equal(shield.shieldHp, before - 1);
});
