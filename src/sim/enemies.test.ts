// Tests des ennemis (GD-058) : réglages par type, vie selon le nombre de joueurs, déplacements en combat.
// Sur le vrai niveau : le soldat utile est amené dehors, près du point de départ, là où rien ne gêne.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { World } from './world.ts';
import { NO_INPUT } from './types.ts';
import type { LevelData, Npc, SpriteManifest } from './types.ts';
import { CONFIG } from './config.ts';

const level = JSON.parse(readFileSync(new URL('../../public/levels/rm_world2.json', import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;
const T = CONFIG.npc.tactics;

/** Un héros qui encaisse tout, et un seul soldat du type demandé, placé à sa droite. */
function duel(object: string, distance: number): { w: World; npc: Npc } {
  const w = new World(level, sprites, 'PetBot', 7);
  const npc = w.npcs.find((n) => n.object === object);
  assert.ok(npc, object);
  w.npcs = [npc];
  npc.x = w.hero.x + distance;
  npc.y = w.hero.y;
  w.hero.hp = 100000;
  return { w, npc };
}

const gap = (w: World, npc: Npc): number => Math.hypot(npc.x - w.hero.x, npc.y - w.hero.y);

test('à plusieurs, les soldats ont plus de vie et les boucliers encaissent plus ; pas les civils', () => {
  const names = ['PetBot', 'BatBot', 'EngiBot', 'BadaBot'];
  const expected: Record<string, number[]> = {
    obj_npc_human_pistol: [1, 2, 2, 3],
    obj_npc_robot_lightBot: [2, 3, 4, 5],
    obj_npc_robot_shield: [3, 5, 6, 8],
    obj_npc_robot_shotBot: [4, 6, 8, 10],
  };
  const shields = [6, 8, 10, 12];
  names.forEach((_, i) => {
    const w = new World(level, sprites, names.slice(0, i + 1), 7);
    for (const [object, hp] of Object.entries(expected)) {
      const npc = w.npcs.find((n) => n.object === object);
      assert.ok(npc, object);
      assert.equal(npc.hp, hp[i], `${object} à ${i + 1} joueur(s)`);
      if (object === 'obj_npc_robot_shield') assert.equal(npc.shieldHp, shields[i]);
    }
    const civil = w.npcs.find((n) => n.def.kind === 'civil');
    assert.ok(civil);
    assert.equal(civil.hp, 1);
  });
});

test('LightBot : rafales de 13 balles en tournant autour de sa cible, puis 0,8 s de surchauffe immobile', () => {
  const { w, npc } = duel('obj_npc_robot_lightBot', 700);
  const def = npc.def;
  assert.ok(def.kind === 'soldier');
  assert.equal(def.normalSpeed * CONFIG.npc.chaseSpeedFactor, 12);
  let shots = 0;
  let pauses = 0;
  let movedFiring = 0;
  let movedPaused = 0;
  let wasPaused = false;
  const perBurst: number[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < 600; i++) {
    const before = { x: npc.x, y: npc.y, bullets: w.bullets.length };
    w.step(NO_INPUT);
    const paused = npc.reloadTimer > 0;
    const step = Math.hypot(npc.x - before.x, npc.y - before.y);
    if (npc.behaviour === 'attack') {
      if (paused && wasPaused) movedPaused += step;
      else if (!paused) movedFiring += step;
    }
    // une balle est comptée à sa naissance : le héros n'est plus invulnérable, d'autres disparaissent sur lui au même step
    for (const b of w.bullets) {
      if (b.owner === 'enemy' && !seen.has(b.id)) {
        seen.add(b.id);
        shots++;
      }
    }
    if (paused && !wasPaused) {
      pauses++;
      perBurst.push(shots);
      shots = 0;
    }
    wasPaused = paused;
    assert.ok(!w.sightBlocked(npc.x, npc.y, w.hero.x, w.hero.y), 'il ne quitte pas sa cible des yeux');
  }
  assert.ok(pauses >= 3, `il surchauffe régulièrement (${pauses})`);
  assert.deepEqual(perBurst.slice(1, 3), [13, 13], 'treize balles par rafale');
  assert.equal(def.reloadSteps, 48);
  assert.ok(movedFiring > 1500, `il tourne en tirant (${Math.round(movedFiring)} px)`);
  assert.ok(movedPaused < 1, 'immobile pendant la surchauffe');
  const d = gap(w, npc);
  assert.ok(d >= T.harassMin - 60 && d <= npc.attackRange + 20, `il garde sa distance (${Math.round(d)} px)`);
});

test('ShotBot : il réagit vite, tire 10 plombs à courte portée et avance entre deux salves', () => {
  const { w, npc } = duel('obj_npc_robot_shotBot', 760);
  const def = npc.def;
  assert.ok(def.kind === 'soldier' && def.bullet);
  assert.equal(def.bulletsPerShot, 10);
  assert.equal(def.bullet.maxDistance, 950);
  assert.equal(def.normalSpeed * CONFIG.npc.chaseSpeedFactor, 10.5);
  assert.equal(def.reactionSteps, 12);
  assert.ok(def.reactionSteps < CONFIG.npc.reactionSteps / 3, 'bien plus vif que les autres soldats');
  assert.ok(npc.attackRange >= 500 && npc.attackRange <= 650);
  let firstShotAt = -1;
  let firstShotStep = -1;
  let salvo = 0;
  for (let i = 0; i < 900; i++) {
    const before = w.bullets.filter((b) => b.owner === 'enemy').length;
    w.step(NO_INPUT);
    const fired = w.bullets.filter((b) => b.owner === 'enemy').length - before;
    if (fired > 0 && firstShotAt < 0) {
      firstShotAt = gap(w, npc);
      firstShotStep = i;
      salvo = fired;
    }
  }
  assert.ok(firstShotAt > 0 && firstShotAt <= 650, `première salve de près (${Math.round(firstShotAt)} px)`);
  assert.ok(firstShotStep < 60, `et sans tarder (${firstShotStep} steps)`);
  assert.equal(salvo, 10);
  const d = gap(w, npc);
  assert.ok(d <= T.rushStop + 10 && d >= T.rushStop - def.normalSpeed - 1, `il finit à bout portant (${Math.round(d)} px)`);
});

test('soldat au pistolet : il tient sa position, et recule si on l\'approche de trop près', () => {
  const { w, npc } = duel('obj_npc_human_pistol', 500);
  const def = npc.def;
  assert.ok(def.kind === 'soldier');
  assert.equal(def.precisionDeg, 5);
  for (let i = 0; i < 120; i++) w.step(NO_INPUT);
  assert.equal(npc.behaviour, 'attack');
  const held = { x: npc.x, y: npc.y };
  for (let i = 0; i < 200; i++) w.step(NO_INPUT);
  assert.deepEqual({ x: npc.x, y: npc.y }, held, 'à bonne distance, il ne bouge pas');
  // le héros vient au contact
  w.hero.x = npc.x - 150;
  for (let i = 0; i < 60; i++) w.step(NO_INPUT);
  assert.ok(gap(w, npc) > 200, `il a reculé (${Math.round(gap(w, npc))} px)`);
  assert.ok(npc.x > held.x, 'en s\'éloignant du héros');
});

test('robot bouclier : il avance sur sa cible, sans manœuvrer', () => {
  const { w, npc } = duel('obj_npc_robot_shield', 600);
  const def = npc.def;
  assert.ok(def.kind === 'soldier');
  assert.equal(def.tactic, 'wall');
  for (let i = 0; i < 400; i++) w.step(NO_INPUT);
  // il frappe et repousse le héros de 350 px à chaque coup, puis revient sur lui
  assert.ok(w.hero.hp < 100000, 'il est venu au contact et a frappé');
  assert.ok(gap(w, npc) < 520, `il reste sur sa cible (${Math.round(gap(w, npc))} px)`);
  assert.ok(Math.abs(npc.y - w.hero.y) < 40, 'en ligne droite');
});

test('ShotBot : il arrive à tirer sur un héros qui ne cesse de bouger', () => {
  const { w, npc } = duel('obj_npc_robot_shotBot', 760);
  let salvos = 0;
  for (let i = 0; i < 600; i++) {
    const before = w.bullets.filter((b) => b.owner === 'enemy').length;
    // le héros court en rond devant lui, sans jamais s'arrêter
    const a = i / 40;
    w.step({ ...NO_INPUT, moveX: Math.cos(a), moveY: Math.sin(a), aimX: npc.x, aimY: npc.y });
    if (w.bullets.filter((b) => b.owner === 'enemy').length > before) salvos++;
  }
  assert.ok(salvos >= 5, `il tire régulièrement (${salvos} salves en 10 s)`);
});

test('civil : il fuit en courant, presque aussi vite que le heros le plus lent (GD-066)', () => {
  const w = new World(level, sprites, 'PetBot', 7);
  const npc = w.npcs.find((n) => n.def.kind === 'civil' && n.spd > 0);
  assert.ok(npc);
  w.npcs = [npc];
  npc.x = w.hero.x + 300;
  npc.y = w.hero.y;
  npc.fear = true;
  npc.fearTimer = 600;
  npc.path = null;
  let fastest = 0;
  for (let i = 0; i < 300; i++) {
    const { x, y } = npc;
    w.step(NO_INPUT);
    if (npc.state === 'running') fastest = Math.max(fastest, Math.hypot(npc.x - x, npc.y - y));
  }
  const expected = npc.spd * CONFIG.npc.fearSpeedFactor;
  assert.ok(Math.abs(fastest - expected) < 0.5, `il court a ${fastest.toFixed(1)} px par step (attendu ${expected.toFixed(1)})`);
  assert.ok(fastest > 9 && fastest < CONFIG.heroes.BadaBot.walkSpeed, 'plus vite qu\'avant, mais on peut encore le rattraper');
});

test('degats : chaque coup compte, sans invulnerabilite apres un degat (GD-070)', () => {
  const w = new World(level, sprites, 'PetBot', 7);
  w.npcs = [];
  const h = w.hero;
  const full = h.hp;
  assert.equal(w.damageHero(h, 1), true);
  assert.equal(w.damageHero(h, 1), true, 'un second coup au meme instant porte aussi');
  assert.equal(w.damageHero(h, 2), true);
  assert.equal(h.hp, full - 4);
  assert.equal(h.invuln, 0);
});

test('un soldat qui retrouve sa cible marque un court temps avant de tirer (GD-075)', () => {
  const { w, npc } = duel('obj_npc_human_pistol', 400);
  const seen = new Set<number>();
  /** Fait tourner le jeu et compte les balles ennemies nées pendant ce temps. */
  const shotsDuring = (steps: number): number => {
    let shots = 0;
    for (let i = 0; i < steps; i++) {
      w.step(NO_INPUT);
      for (const b of w.bullets) {
        if (b.owner === 'enemy' && !seen.has(b.id)) {
          seen.add(b.id);
          shots++;
        }
      }
    }
    return shots;
  };
  assert.ok(shotsDuring(150) > 0, 'il voit le héros, se remet de sa surprise et tire');
  // le héros disparaît, loin, le temps que le soldat le perde de vue ; le soldat est tenu sur place
  const hero = { x: w.hero.x, y: w.hero.y };
  const post = { x: npc.x, y: npc.y };
  w.hero.x += 9000;
  for (let i = 0; i < 40; i++) {
    shotsDuring(1);
    npc.x = post.x;
    npc.y = post.y;
    npc.path = null;
  }
  // il réapparaît au même endroit, en face du soldat, à portée
  w.hero.x = hero.x;
  w.hero.y = hero.y;
  const wait = CONFIG.npc.reacquireSteps;
  assert.equal(shotsDuring(wait - 1), 0, 'pas de tir à l\'instant où il le retrouve');
  assert.equal(shotsDuring(3), 1, 'il tire dès ce court temps écoulé');
});
