// Tir principal de PetBot : le mini-drone à tête chercheuse (GD-093), sur le vrai niveau. Les PNJ utiles sont
// amenés dehors, près du point de départ, là où rien ne gêne, et figés.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.ts';
import { seekerPick } from './abilities.ts';
import { HOLDING } from './npc.ts';
import { NO_INPUT } from './types.ts';
import type { Input, LevelData, Npc, SimEvent, SpriteManifest } from './types.ts';
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

test('PetBot : cliquer sur un ennemi lance un drone qui le poursuit et ne touche que lui', () => {
  // un soldat sur la ligne de tir, la cible derrière lui : le drone passe au-dessus du premier
  const { w, npcs: [front, target] } = arena([['obj_npc_human_pistol', 400, 0], ['obj_npc_human_pistol', 800, 30]]);
  w.step(at(w, 800, 30, { fire1: true }));
  assert.equal(w.hero.lock, target.id, 'la cible est verrouillée');
  assert.equal(w.seekers.length, 1);
  assert.equal(w.seekers[0].target, target.id);
  assert.equal(w.bullets.length, 0, 'plus de balle');
  assert.equal(w.hero.ammo, w.hero.def.magazine - 1);
  // le clic relâché, le drone continue seul
  run(w, 60, at(w, 800, 30));
  assert.equal(w.seekers.length, 0);
  assert.equal(target.hp, 10 - S.damage);
  assert.equal(front.hp, 10, 'le soldat sur le trajet n\'est pas touché');
});

test('PetBot : la tolérance du clic, et ce qui ne se vise pas', () => {
  const { w, npcs: [soldier, civil] } = arena([['obj_npc_human_pistol', 600, 0], ['obj_npc_civil_femme', 600, 400]]);
  const h = w.hero;
  const edge = soldier.def.radius + S.pickMargin;
  assert.equal(seekerPick(w, h, soldier.x + edge - 2, soldier.y), soldier, 'dans la marge');
  assert.equal(seekerPick(w, h, soldier.x + edge + 2, soldier.y), null, 'juste hors de la marge');
  assert.equal(seekerPick(w, h, civil.x, civil.y), null, 'un civil ne se vise pas');
  // un ennemi que PetBot ne voit pas ne se vise pas non plus
  const hidden = hiddenSpot(w);
  soldier.x = hidden.x;
  soldier.y = hidden.y;
  assert.equal(seekerPick(w, h, soldier.x, soldier.y), null, 'caché derrière un mur');
});

test('PetBot : tant que le clic est tenu, tous les drones suivent la cible verrouillée', () => {
  const { w, npcs: [target, other] } = arena([['obj_npc_human_pistol', 600, -200], ['obj_npc_human_pistol', 600, 300]]);
  const h = w.hero;
  w.step(at(w, 600, -200, { fire1: true }));
  // le curseur s'en va sur l'autre soldat sans relâcher : la cible ne change pas
  run(w, 70, at(w, 600, 300, { fire1: true }));
  assert.equal(h.lock, target.id);
  assert.ok(target.hp <= 10 - 3 * S.damage, `la cible a pris plusieurs drones : ${target.hp}`);
  assert.equal(other.hp, 10, 'l\'autre soldat n\'a rien reçu');
  // relâcher puis recliquer change de cible
  w.step(at(w, 600, 300));
  assert.equal(h.lock, -1);
  w.step(at(w, 600, 300, { fire1: true }));
  assert.equal(h.lock, other.id);
});

test('PetBot : la cible morte, le verrou tombe et le drone en vol se reporte sur l\'ennemi le plus proche', () => {
  const { w, npcs: [target, other] } = arena([['obj_npc_human_pistol', 700, 0], ['obj_npc_human_pistol', 700, 260]]);
  const h = w.hero;
  w.step(at(w, 700, 0, { fire1: true }));
  run(w, 8, at(w, 700, 0, { fire1: true }));
  assert.equal(w.seekers.length, 1);
  target.hp = 0;
  run(w, 3, at(w, 700, 0, { fire1: true }));
  assert.ok(!w.npcs.includes(target));
  assert.equal(h.lock, -1, 'le verrou tombe avec la cible');
  assert.equal(w.seekers[0].target, other.id, 'le drone en vol change de cible');
  run(w, 60, at(w, 2500, -900));
  assert.equal(other.hp, 10 - S.damage);
});

test('PetBot : sans ennemi sous le clic, le drone va au point cliqué puis prend l\'ennemi le plus proche de ce point', () => {
  const { w, npcs: [near, far] } = arena([['obj_npc_human_pistol', 700, 220], ['obj_npc_human_pistol', 700, -290]]);
  const h = w.hero;
  // le point cliqué est hors de la tolérance des deux soldats
  w.step(at(w, 700, 0, { fire1: true }));
  assert.equal(h.lock, -1);
  const d = w.seekers[0];
  assert.equal(d.target, -1);
  assert.ok(d.scout > 0);
  // il vole droit vers le point, sans dévier, tant qu'il n'y est pas
  const heading = d.angle;
  run(w, 10, at(w, 700, 0));
  assert.equal(d.angle, heading);
  assert.equal(d.target, -1);
  run(w, 60, at(w, 700, 0));
  assert.equal(near.hp, 10 - S.damage, 'le plus proche du point cliqué');
  assert.equal(far.hp, 10);
});

test('PetBot : personne autour du point cliqué, le drone file tout droit et touche ce qu\'il rencontre', () => {
  // un soldat loin du point cliqué mais plus loin sur la même ligne : il est touché au passage, comme par une balle
  const { w, npcs: [inLine, aside], events } = arena([['obj_npc_human_pistol', 1100, 0], ['obj_npc_human_pistol', 500, 600]]);
  w.step(at(w, 500, 0, { fire1: true }));
  run(w, 80, at(w, 500, 0));
  assert.equal(w.seekers.length, 0);
  assert.equal(inLine.hp, 10 - S.damage);
  assert.equal(aside.hp, 10, 'hors du rayon de recherche, hors de la ligne');
  assert.ok(events.some((e) => e.type === 'impact' && e.surface === 'npc'));

  // personne nulle part : il finit dans un mur, ou s'éteint au bout de sa course
  const empty = arena([['obj_npc_human_pistol', 300, 900]]);
  empty.w.step(at(empty.w, 500, 0, { fire1: true }));
  run(empty.w, 200, at(empty.w, 500, 0));
  assert.equal(empty.w.seekers.length, 0);
  assert.equal(empty.npcs[0].hp, 10);
  assert.ok(empty.events.some((e) => e.type === 'impact' && e.surface === 'wall'));
});

/** Un endroit libre que PetBot ne voit pas, mais qu'un chemin court permet de rejoindre. */
function hiddenSpot(w: World): { x: number; y: number } {
  const h = w.hero;
  for (let dx = -1200; dx <= 1200; dx += 100) {
    for (let dy = -1200; dy <= 1200; dy += 100) {
      const x = h.x + dx;
      const y = h.y + dy;
      if (x < 50 || y < 50 || x > w.width - 50 || y > w.height - 50) continue;
      if (w.nav.isBlockedAt(x, y) || !w.shotBlocked(h.x, h.y, x, y) || !w.sightBlocked(h.x, h.y, x, y)) continue;
      const path = w.nav.findPath(h.x, h.y, x, y);
      if (!path) continue;
      let length = 0;
      let px = h.x;
      let py = h.y;
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

test('PetBot : la cible passée derrière un mur, le drone contourne l\'obstacle ; sans chemin, il s\'écrase', () => {
  const { w, npcs: [target] } = arena([['obj_npc_human_pistol', 500, 0]]);
  // les portes automatiques ne s'ouvrent pas pour un drone : on les ouvre, seul le contournement est jugé ici
  for (const door of w.doors) {
    door.progress = 1;
    door.phase = 'open';
    door.blockedOpen = true;
    w.updateDoorObstacle(door);
  }
  const spot = hiddenSpot(w);
  w.step(at(w, 500, 0, { fire1: true }));
  assert.equal(w.hero.lock, target.id);
  // la cible disparaît derrière un mur pendant que le drone est en vol
  target.x = spot.x;
  target.y = spot.y;
  run(w, 150, at(w, 500, 0));
  assert.equal(w.seekers.length, 0);
  assert.equal(target.hp, 10 - S.damage, 'le drone a trouvé son chemin');

  // même situation, mais aucun chemin : la tête chercheuse décroche et le drone finit dans le décor
  const lost = arena([['obj_npc_human_pistol', 500, 0]]);
  lost.w.nav.findPath = () => null;
  lost.w.step(at(lost.w, 500, 0, { fire1: true }));
  lost.npcs[0].x = spot.x;
  lost.npcs[0].y = spot.y;
  run(lost.w, 3, at(lost.w, 500, 0));
  assert.equal(lost.w.seekers[0].target, -1);
  run(lost.w, 200, at(lost.w, 500, 0));
  assert.equal(lost.w.seekers.length, 0);
  assert.equal(lost.npcs[0].hp, 10);
  assert.ok(lost.events.some((e) => e.type === 'impact' && e.surface === 'wall'));
});

test('PetBot : le robot bouclier arrête le drone de face, et le chargeur se vide comme avant', () => {
  const { w, npcs: [shield] } = arena([['obj_npc_robot_shield', 500, 0]]);
  const h = w.hero;
  shield.angle = Math.PI; // il fait face à PetBot
  const before = shield.shieldHp;
  assert.ok(before > 0);
  w.step(at(w, 500, 0, { fire1: true }));
  run(w, 40, at(w, 500, 0));
  assert.equal(shield.hp, 10);
  assert.equal(shield.shieldHp, before - 1);
  // clic tenu : un drone par intervalle, jusqu'au chargeur vide
  run(w, 300, at(w, 500, 0, { fire1: true }));
  assert.equal(h.ammo, 0);
  assert.equal(w.stats.ammoUsed, h.def.magazine);
});
