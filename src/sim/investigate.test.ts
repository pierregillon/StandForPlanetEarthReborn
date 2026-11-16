// Test du comportement « aller voir » (GD-036) : un soldat qui entend le héros sans le voir rejoint
// l'endroit du bruit au lieu de rester dans sa pièce.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.ts';
import { GROUND_FLOOR } from './session.ts';
import { NO_INPUT } from './types.ts';
import type { Input, LevelData, Npc, SpriteManifest } from './types.ts';
import { CONFIG } from './config.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

/** Cherche un soldat et un point d'où le héros est entendu de lui sans être vu, avec un chemin entre les deux. */
function findHiddenSpot(w: World): { soldier: Npc; x: number; y: number } | null {
  for (const soldier of w.npcs) {
    if (soldier.def.kind !== 'soldier' || soldier.spd === 0) continue;
    for (let k = 0; k < 24; k++) {
      for (const dist of [450, 600, 750]) {
        const a = (k * Math.PI) / 12;
        const x = soldier.x + Math.cos(a) * dist;
        const y = soldier.y + Math.sin(a) * dist;
        if (!w.collision.circleFree(x, y, 50, 1)) continue;
        if (!w.sightBlocked(soldier.x, soldier.y, x, y) || w.soundBlocked(soldier.x, soldier.y, x, y)) continue;
        const path = w.nav.findPath(soldier.x, soldier.y, x, y);
        if (path && path.length < 12) return { soldier, x, y };
      }
    }
  }
  return null;
}

test('un soldat qui entend des tirs sans voir le héros sort voir ce qui se passe', () => {
  const w = new World(ground, sprites, 'PetBot', 9);
  const spot = findHiddenSpot(w);
  assert.ok(spot, 'un soldat et un point caché de lui mais à portée d\'ouïe');
  const { soldier } = spot;
  w.npcs = [soldier];
  const h = w.hero;
  h.x = spot.x;
  h.y = spot.y;
  h.hp = 100000;
  const start = Math.hypot(soldier.x - spot.x, soldier.y - spot.y);
  // le héros tire une demi-seconde, dos au soldat, puis se tait
  const away = Math.atan2(spot.y - soldier.y, spot.x - soldier.x);
  const fire: Input = { ...NO_INPUT, fire1: true, aimX: h.x + Math.cos(away) * 400, aimY: h.y + Math.sin(away) * 400 };
  let surprised = false;
  for (let i = 0; i < 30; i++) {
    w.step(fire);
    if (soldier.behaviour === 'surprised') surprised = true;
  }
  assert.ok(surprised, 'il marque d\'abord un temps de surprise');
  // le héros s'en va loin : le soldat doit quand même venir à l'endroit du bruit
  h.x = 300;
  h.y = 300;
  let closest = start;
  let investigated = false;
  for (let i = 0; i < CONFIG.npc.investigateMemorySteps; i++) {
    w.step(NO_INPUT);
    if (soldier.behaviour === 'investigate') investigated = true;
    closest = Math.min(closest, Math.hypot(soldier.x - spot.x, soldier.y - spot.y));
  }
  assert.ok(investigated, 'il part voir');
  assert.ok(closest <= CONFIG.npc.investigateArriveDistance + 40, `il rejoint l'endroit du bruit (au plus près : ${Math.round(closest)} px, départ ${Math.round(start)} px)`);
  // n'ayant trouvé personne, il reprend sa ronde
  for (let i = 0; i < 400; i++) w.step(NO_INPUT);
  assert.equal(soldier.alerted, false);
  assert.notEqual(soldier.behaviour, 'investigate');
});
