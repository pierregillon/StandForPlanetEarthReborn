// IA des PNJ : soldats (surprise, poursuite, attaque) et civils (panique, fuite), patrouilles.
// Référence : objects/obj_localNpc*, scripts scr_getTargetEnnemy, scr_getSoldierNPCBehaviour, scr_chaseHero,
// scr_attackHero, scr_processFire, src_patrol, scr_buildNpcPatrolPath, scr_getNpcBehaviourCivil,
// scr_runAwayFromHero du projet GameMaker de 2019 (voir docs/reference/jeu-original/02-ennemis-et-ia.md).
import { CONFIG, STEPS_PER_SECOND } from './config.ts';
import { guardBoss, stepBoss } from './boss.ts';
import type { NpcDef, SoldierDef } from './config.ts';
import { BLOCK_MOVE, BLOCK_SIGHT, DEG, TAU, gmAngleToRad, localToWorld, rotateToward } from './geom.ts';
import type { Point } from './nav.ts';
import type { LevelInstance, Npc } from './types.ts';
import type { World } from './world.ts';

const N = CONFIG.npc;

export function createNpc(world: World, id: number, inst: LevelInstance, def: NpcDef): Npc {
  const p = inst.props;
  const angle = gmAngleToRad(inst.angle);
  const spd = Number(p.normalSpd ?? def.normalSpeed);
  const patrolType = p.patrolType === 'points' || p.patrolType === 'none' ? p.patrolType : 'random';
  const patrolPoints: Point[] = [];
  if (Array.isArray(p.patrolPoints)) {
    for (const raw of p.patrolPoints) {
      const [px, py] = String(raw).split(';').map(Number);
      if (Number.isFinite(px) && Number.isFinite(py)) patrolPoints.push({ x: px, y: py });
    }
    if (patrolPoints.length > 0) patrolPoints.unshift({ x: inst.x, y: inst.y });
  }
  const soldier = def.kind === 'soldier' ? def : null;
  return {
    id, object: inst.object, def, x: inst.x, y: inst.y, angle, dir: angle,
    hp: def.maxHealth, active: false, behaviour: 'none', state: 'standing', spd,
    path: null, pathIdx: 0, waypointTimer: 0, waypointFailures: 0,
    patrolType, patrolPoints, patrolReverse: false, pauseTimer: -1,
    attackRange: soldier ? world.rng.int(soldier.attackRangeMin, soldier.attackRangeMax) : 0,
    ammo: soldier ? soldier.magazine : 0,
    fireTimer: 0, reloadTimer: 0, repathTimer: 0, surpriseTimer: 0, spotted: false, viewRange: N.viewRange,
    alerted: false, alertX: 0, alertY: 0, alertTimer: 0,
    shieldHp: soldier && soldier.frontShield ? N.shieldHits : 0, shieldBroken: false,
    fear: false, fearTimer: 0, stateSteps: 0, walkDist: 0,
  };
}

export function stepNpcs(world: World): void {
  const hero = world.hero;
  // parcours d'une copie : un PNJ peut mourir pendant la boucle
  for (const npc of world.npcs.slice()) {
    if (!npc.active) {
      if (Math.hypot(npc.x - hero.x, npc.y - hero.y) > N.activationRange) continue;
      npc.active = true;
    }
    const boss = npc.def.kind === 'boss' ? world.boss : null;
    if (boss) guardBoss(boss);
    if (npc.hp <= 0) {
      world.killNpc(npc);
      continue;
    }
    if (boss) {
      stepBoss(world, boss);
      continue;
    }
    const before = npc.state;
    if (npc.fireTimer > 0) npc.fireTimer--;
    if (npc.reloadTimer > 0) npc.reloadTimer--;
    if (npc.repathTimer > 0) npc.repathTimer--;
    if (npc.def.kind === 'soldier') stepSoldier(world, npc, npc.def);
    else if (npc.def.kind === 'civil') stepCivil(world, npc);
    const turn = npc.def.kind !== 'soldier' ? 10 : npc.def.frontShield ? N.shieldRotateSpeedDeg : N.rotateSpeedDeg;
    npc.angle = rotateToward(npc.angle, npc.dir, turn * DEG);
    if (npc.def.kind === 'soldier' && npc.def.frontShield && npc.shieldHp <= 0 && !npc.shieldBroken) {
      npc.shieldBroken = true;
      world.emit({ type: 'shieldBroken', x: npc.x, y: npc.y });
    }
    npc.stateSteps = npc.state === before ? npc.stateSteps + 1 : 0;
  }
  separateNpcs(world);
}

// ---------- Soldats ----------

function heroVisible(world: World, npc: Npc, range: number): boolean {
  const h = world.hero;
  if (h.state === 'dead') return false;
  if (Math.hypot(h.x - npc.x, h.y - npc.y) > range) return false;
  return !world.sightBlocked(npc.x, npc.y, h.x, h.y);
}

/** Un héros est entendu s'il tire à portée d'ouïe sans mur épais entre les deux. */
function heroHeard(world: World, x: number, y: number): boolean {
  const h = world.hero;
  if (h.state !== 'firing1' && h.state !== 'firing2') return false;
  if (Math.hypot(h.x - x, h.y - y) > N.hearRange) return false;
  return !world.soundBlocked(x, y, h.x, h.y);
}

/** Le soldat retient où se trouve le héros (vu ou entendu) ; la première fois, il marque un temps de surprise. */
function alertSoldier(npc: Npc, x: number, y: number): void {
  if (!npc.alerted) {
    npc.alerted = true;
    npc.surpriseTimer = N.reactionSteps;
  }
  npc.alertX = x;
  npc.alertY = y;
  npc.alertTimer = N.investigateMemorySteps;
}

function stepSoldier(world: World, npc: Npc, def: SoldierDef): void {
  const hero = world.hero;
  // une fois le héros repéré, le soldat le suit des yeux deux fois plus loin
  const visible = heroVisible(world, npc, npc.spotted ? N.viewRangeAlerted : N.viewRange);
  npc.spotted = visible;
  npc.viewRange = visible ? N.viewRangeAlerted : N.viewRange;
  if (!visible) {
    if (heroHeard(world, npc.x, npc.y)) alertSoldier(npc, hero.x, hero.y);
    investigate(world, npc, def);
    return;
  }
  alertSoldier(npc, hero.x, hero.y);
  const dist = Math.hypot(hero.x - npc.x, hero.y - npc.y);
  const prev = npc.behaviour;
  let next: 'surprised' | 'chase' | 'attack';
  if (npc.surpriseTimer > 0) {
    next = 'surprised';
  } else if (prev === 'attack' && dist <= npc.attackRange) {
    next = 'attack';
  } else if (dist > Math.max(npc.attackRange - world.rng.int(100, 300), def.radius * 2 + hero.def.radius)) {
    next = 'chase';
  } else if (world.shotBlocked(npc.x, npc.y, hero.x, hero.y)) {
    next = 'chase';
  } else {
    next = 'attack';
  }
  npc.behaviour = next;
  const toHero = Math.atan2(hero.y - npc.y, hero.x - npc.x);

  if (next === 'surprised') {
    npc.surpriseTimer--;
    npc.dir = toHero;
    npc.state = 'standing';
  } else if (next === 'chase') {
    if (npc.repathTimer === 0) {
      const path = world.nav.findPath(npc.x, npc.y, hero.x, hero.y);
      if (path) {
        setPath(npc, path);
        npc.repathTimer = N.chaseRepathSteps;
      } else {
        npc.path = null;
        npc.repathTimer = 15; // remake : l'original retentait à chaque step (coûteux)
      }
    }
    if (npc.path) {
      followPath(world, npc, def.normalSpeed * N.chaseSpeedFactor);
      npc.state = 'chasing';
    } else {
      npc.state = 'standing';
    }
    npc.dir = toHero;
  } else {
    // attaque : à l'arrêt, face au héros
    npc.path = null;
    npc.dir = toHero;
    // le robot bouclier pivote lentement, même en attaque : on peut passer dans son dos
    if (!def.frontShield) npc.angle = toHero;
    processFire(world, npc, def);
  }
}

/**
 * Le héros n'est pas en vue (GD-036). Si le soldat l'a entendu ou vient de le perdre de vue, il va voir sur
 * place, en ouvrant les portes automatiques sur son chemin ; sinon il reprend sa ronde.
 */
function investigate(world: World, npc: Npc, def: SoldierDef): void {
  if (npc.alertTimer <= 0) {
    npc.alerted = false;
    npc.surpriseTimer = 0;
    npc.behaviour = 'none';
    defaultBehaviour(world, npc);
    return;
  }
  npc.alertTimer--;
  const toAlert = Math.atan2(npc.alertY - npc.y, npc.alertX - npc.x);
  if (npc.surpriseTimer > 0) {
    npc.surpriseTimer--;
    npc.behaviour = 'surprised';
    npc.dir = toAlert;
    npc.state = 'standing';
    return;
  }
  npc.behaviour = 'investigate';
  if (Math.hypot(npc.alertX - npc.x, npc.alertY - npc.y) <= N.investigateArriveDistance) {
    // sur place et personne : il regarde autour de lui, puis reprend sa ronde
    npc.alertTimer = 0;
    npc.path = null;
    npc.pauseTimer = N.patrolPauseSteps;
    npc.state = 'standing';
    return;
  }
  if (npc.repathTimer === 0) {
    const path = world.nav.findPath(npc.x, npc.y, npc.alertX, npc.alertY);
    if (path) setPath(npc, path);
    else npc.path = null;
    npc.repathTimer = 45;
  }
  if (npc.path) {
    followPath(world, npc, def.normalSpeed * N.investigateSpeedFactor);
    npc.state = 'chasing';
  } else {
    npc.dir = toAlert;
    npc.state = 'standing';
  }
}

function processFire(world: World, npc: Npc, def: SoldierDef): void {
  if (npc.reloadTimer > 0) {
    npc.state = 'reloading';
  } else if (def.canReload && npc.ammo === 0) {
    npc.reloadTimer = def.reloadSteps;
    npc.ammo = def.magazine;
    npc.state = 'reloading';
  } else if (npc.fireTimer === 0) {
    if (def.melee) shieldBash(world, npc, def);
    else if (def.bullet) {
      const m = localToWorld(npc.x, npc.y, npc.angle, def.muzzle.x, def.muzzle.y);
      for (let i = 0; i < def.bulletsPerShot; i++) {
        const spread = world.rng.range(-def.precisionDeg, def.precisionDeg) * DEG;
        world.fireBullet(def.bullet, 'enemy', npc.x, npc.y, m.x, m.y, npc.angle + spread);
      }
      if (def.fireSound) world.emit({ type: 'sound', name: def.fireSound, x: npc.x, y: npc.y });
    }
    if (def.canReload) npc.ammo--;
    npc.fireTimer = Math.round(STEPS_PER_SECOND / def.shotsPerSecond);
    npc.state = 'firing';
    npc.stateSteps = -1; // relance l'animation de tir
  } else {
    // entre deux tirs (« delay_firing » dans l'original) : même posture, l'animation du tir se termine
    npc.state = 'firing';
  }
}

/** Coup de bouclier : 1 dégât et le héros est repoussé (GD-017). */
function shieldBash(world: World, npc: Npc, def: SoldierDef): void {
  const h = world.hero;
  if (h.state === 'dead') return;
  // position du héros dans le repère du robot
  const dx = h.x - npc.x;
  const dy = h.y - npc.y;
  const c = Math.cos(npc.angle);
  const s = Math.sin(npc.angle);
  const lx = dx * c + dy * s;
  const ly = -dx * s + dy * c;
  const box = N.meleeBox;
  const x0 = def.muzzle.x + box.x0;
  const x1 = def.muzzle.x + box.x1;
  const qx = Math.max(x0, Math.min(lx, x1));
  const qy = Math.max(box.y0, Math.min(ly, box.y1));
  if (Math.hypot(lx - qx, ly - qy) > h.def.radius) return;
  world.damageHero(1, true);
  if (h.hp <= 0 || h.bump) return;
  const aheadX = h.x + c * CONFIG.hero.bumpSpeed;
  const aheadY = h.y + s * CONFIG.hero.bumpSpeed;
  if (!world.collision.circleFree(aheadX, aheadY, h.def.radius, BLOCK_MOVE)) return;
  h.dashing = false;
  h.bump = true;
  h.targetX = h.x + c * CONFIG.hero.bumpDistance;
  h.targetY = h.y + s * CONFIG.hero.bumpDistance;
}

// ---------- Civils ----------

function stepCivil(world: World, npc: Npc): void {
  if (npc.fear) {
    if (npc.fearTimer > 0) npc.fearTimer--;
    else {
      npc.fear = false;
      npc.path = null;
    }
  }
  // la recherche d'une cause de peur est étalée dans le temps (1 civil sur 6 par step)
  if (!npc.fear && (world.tick + npc.id) % 6 === 0 && fearSource(world, npc)) {
    npc.fear = true;
    npc.patrolType = 'random';
    npc.fearTimer = N.fearSteps;
    npc.path = null;
  }
  if (!npc.fear) {
    npc.behaviour = 'none';
    defaultBehaviour(world, npc);
    return;
  }
  npc.behaviour = 'runaway';
  const fearSpeed = npc.spd * N.fearSpeedFactor;
  if (!npc.path) {
    npc.state = 'standing';
    if (fearSpeed <= 0 || npc.repathTimer > 0) return;
    npc.repathTimer = 20;
    const threat = nearestThreat(world, npc);
    if (!threat || Math.hypot(threat.x - npc.x, threat.y - npc.y) >= N.viewRange) return;
    const away = Math.atan2(npc.y - threat.y, npc.x - threat.x) + world.rng.range(-20, 20) * DEG;
    const target = farthestPoint(world, npc.x, npc.y, away, Math.max(world.width, world.height));
    if (Math.hypot(target.x - npc.x, target.y - npc.y) < npc.def.radius) return;
    const path = world.nav.findPath(npc.x, npc.y, target.x, target.y);
    if (path) setPath(npc, path);
  }
  if (npc.path) {
    followPath(world, npc, fearSpeed);
    npc.state = 'running';
  }
}

function fearSource(world: World, npc: Npc): boolean {
  if (heroHeard(world, npc.x, npc.y)) return true;
  for (const other of world.npcs) {
    if (other === npc) continue;
    const d = Math.hypot(other.x - npc.x, other.y - npc.y);
    if (other.def.kind === 'soldier') {
      if (other.behaviour === 'attack' && d <= N.hearRange && !world.soundBlocked(npc.x, npc.y, other.x, other.y)) return true;
    } else if (other.fear && d < N.viewRange && !world.sightBlocked(npc.x, npc.y, other.x, other.y)) {
      return true; // contagion de la panique
    }
  }
  return false;
}

function nearestThreat(world: World, npc: Npc): Point | null {
  if (world.hero.state !== 'dead') return world.hero;
  let best: Npc | null = null;
  let bestD = Infinity;
  for (const other of world.npcs) {
    if (other.def.kind !== 'soldier') continue;
    const d = Math.hypot(other.x - npc.x, other.y - npc.y);
    if (d < bestD) {
      bestD = d;
      best = other;
    }
  }
  return best;
}

// ---------- Patrouille, attente, chemins ----------

function defaultBehaviour(world: World, npc: Npc): void {
  if (npc.spd === 0) {
    npc.path = null;
    npc.state = 'standing';
    return;
  }
  if (npc.pauseTimer > 0) {
    npc.pauseTimer--;
    npc.state = 'standing';
    return;
  }
  if (!npc.path) {
    npc.state = 'standing';
    if (npc.pauseTimer === -1) {
      npc.pauseTimer = N.patrolPauseSteps + world.rng.pick(N.patrolPauseExtraSteps);
      return;
    }
    npc.pauseTimer = -1;
    const path = buildPatrolPath(world, npc);
    if (!path) return;
    setPath(npc, path);
  }
  followPath(world, npc, N.patrolSpeed);
  if (npc.path) npc.state = 'walking';
}

function buildPatrolPath(world: World, npc: Npc): Point[] | null {
  if (npc.patrolType === 'none') return null;
  if (npc.patrolType === 'points') {
    if (npc.patrolPoints.length < 2) return null;
    const points = npc.patrolReverse ? npc.patrolPoints.slice().reverse() : npc.patrolPoints.slice();
    npc.patrolReverse = !npc.patrolReverse;
    return points.slice(1);
  }
  // deux points candidats, on garde le plus éloigné (décolle le PNJ des murs)
  let best: Point | null = null;
  let bestD = -1;
  for (let i = 0; i < 2; i++) {
    const far = farthestPoint(world, npc.x, npc.y, world.rng.range(0, TAU), N.patrolRange);
    const p = { x: world.rng.range(Math.min(npc.x, far.x), Math.max(npc.x, far.x)), y: world.rng.range(Math.min(npc.y, far.y), Math.max(npc.y, far.y)) };
    const d = Math.hypot(p.x - npc.x, p.y - npc.y);
    if (d > bestD) {
      bestD = d;
      best = p;
    }
  }
  if (!best || bestD < npc.def.radius) return null;
  return world.nav.findPath(npc.x, npc.y, best.x, best.y);
}

/** Point le plus lointain atteignable en ligne droite sans croiser mur ni porte. */
function farthestPoint(world: World, x: number, y: number, angle: number, maxDist: number): Point {
  const ex = x + Math.cos(angle) * maxDist;
  const ey = y + Math.sin(angle) * maxDist;
  const hit = world.collision.raycast(x, y, ex, ey, BLOCK_SIGHT);
  const reach = Math.max(0, (hit ? hit.t * maxDist : maxDist) - 60);
  return world.clampToRoom(x + Math.cos(angle) * reach, y + Math.sin(angle) * reach, 80);
}

function setPath(npc: Npc, path: Point[]): void {
  npc.path = path;
  npc.pathIdx = 0;
  npc.waypointFailures = 0;
  npc.waypointTimer = -1;
}

/** Avance le long du chemin. Le chemin est abandonné (path = null) à son terme ou après trop d'échecs. */
function followPath(world: World, npc: Npc, speed: number): void {
  const path = npc.path;
  if (!path || speed <= 0) return;
  let wp = path[npc.pathIdx];
  if (npc.waypointTimer < 0) npc.waypointTimer = waypointBudget(npc, wp, speed);
  const reached = Math.hypot(wp.x - npc.x, wp.y - npc.y) <= Math.max(speed, npc.def.radius / 2);
  if (reached || npc.waypointTimer === 0) {
    if (reached) npc.waypointFailures = 0;
    else if (++npc.waypointFailures > N.maxWaypointFailures) {
      npc.path = null;
      return;
    }
    if (++npc.pathIdx >= path.length) {
      npc.path = null;
      return;
    }
    wp = path[npc.pathIdx];
    npc.waypointTimer = waypointBudget(npc, wp, speed);
  }
  npc.waypointTimer--;
  const dir = Math.atan2(wp.y - npc.y, wp.x - npc.x);
  const step = Math.min(speed, Math.hypot(wp.x - npc.x, wp.y - npc.y));
  const res = world.collision.resolveCircle(npc.x + Math.cos(dir) * step, npc.y + Math.sin(dir) * step, npc.def.radius * 0.5, BLOCK_MOVE);
  npc.walkDist += Math.hypot(res.x - npc.x, res.y - npc.y);
  npc.x = res.x;
  npc.y = res.y;
  npc.dir = dir;
}

/** Temps accordé pour atteindre un point (1 s dans l'original, allongé ici car les segments sont plus longs). */
function waypointBudget(npc: Npc, wp: Point, speed: number): number {
  return Math.max(N.waypointTimeoutSteps, Math.ceil((Math.hypot(wp.x - npc.x, wp.y - npc.y) / speed) * 1.5) + 30);
}

/** Les PNJ ne se superposent pas, ni entre eux ni avec le héros. */
function separateNpcs(world: World): void {
  const npcs = world.npcs;
  for (let i = 0; i < npcs.length; i++) {
    const a = npcs[i];
    if (!a.active) continue;
    const aMoves = a.state === 'walking' || a.state === 'chasing' || a.state === 'running';
    for (let j = i + 1; j < npcs.length; j++) {
      const b = npcs[j];
      const min = (a.def.radius + b.def.radius) * 0.8;
      const dx = b.x - a.x;
      if (dx > min || dx < -min) continue;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      if (d >= min || d < 0.001) continue;
      const bMoves = b.state === 'walking' || b.state === 'chasing' || b.state === 'running';
      if (!aMoves && !bMoves) continue; // deux PNJ immobiles posés l'un contre l'autre ne bougent pas
      const pushLen = (min - d) / (aMoves && bMoves ? 2 : 1);
      const ux = dx / d;
      const uy = dy / d;
      if (aMoves) {
        a.x -= ux * pushLen;
        a.y -= uy * pushLen;
      }
      if (bMoves) {
        b.x += ux * pushLen;
        b.y += uy * pushLen;
      }
    }
  }
  const h = world.hero;
  if (h.state === 'dead') return;
  for (const npc of npcs) {
    if (npc.state !== 'walking' && npc.state !== 'chasing' && npc.state !== 'running') continue;
    const min = h.def.radius + npc.def.radius * 0.8;
    const dx = npc.x - h.x;
    const dy = npc.y - h.y;
    const d = Math.hypot(dx, dy);
    if (d >= min || d < 0.001) continue;
    npc.x += (dx / d) * (min - d);
    npc.y += (dy / d) * (min - d);
  }
}
