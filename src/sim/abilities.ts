// Tirs des quatre héros (principal et secondaire) et objets qu'ils créent : drones, explosions,
// tourelle, battes. Référence : scr_fire1Check, scr_PetBot_fire2Check, scr_EngiBot_fire2Check,
// scr_fire1CheckBatBot, scr_fire2CheckBatBot, scr_fire1CheckBadaBot, scr_fire2CheckBadaBot et les objets
// obj_PetDrone, obj_explosion_parent, obj_turret_EngiBot, obj_bullet_batte_parent du projet de 2019.
import { CONFIG, STEPS_PER_SECOND } from './config.ts';
import {
  BLOCK_BULLET, BLOCK_MOVE, DEG, IS_WINDOW, angleDiff, boxNormal, distanceToRect, localToWorld, reflectAngle,
  rotateToward, segmentCircle,
} from './geom.ts';
import type { Bat, Drill, Drone, Explosion, Hero, Input, Npc, Seeker, Turret, WindowPane } from './types.ts';
import { petSwarm } from './ulti.ts';
import type { World } from './world.ts';

const A = CONFIG.abilities;
const SHIELD_ARC = 140 * DEG;

function muzzle(h: Hero): { x: number; y: number } {
  return localToWorld(h.x, h.y, h.angle, h.def.muzzle.x, h.def.muzzle.y);
}

function playOneOf(world: World, names: string[], x: number, y: number): void {
  if (names.length > 0) world.emit({ type: 'sound', name: world.rng.pick(names), x, y });
}

function spendEnergy(world: World, h: Hero, amount: number): void {
  h.energy -= amount;
  world.stats.energyUsed += amount;
  h.energyPause = CONFIG.hero.energyPauseSteps;
}

/** Le robot bouclier ne craint que ce qui vient de l'arrière (cône de ±40°). */
export function blockedByFrontShield(npc: Npc, fromX: number, fromY: number): boolean {
  if (npc.def.kind !== 'soldier' || !npc.def.frontShield || npc.shieldHp <= 0 || npc.stun > 0) return false;
  const toSource = Math.atan2(fromY - npc.y, fromX - npc.x);
  if (Math.abs(angleDiff(npc.angle, toSource)) >= SHIELD_ARC) return false;
  // le bouclier encaisse le coup et s'use ; brisé, il ne protège plus (GD-029)
  npc.shieldHp--;
  return true;
}

// ---------- Boucle des tirs du héros ----------

export function stepWeapons(world: World, h: Hero, input: Input): void {
  if (h.def.magazine > 0) {
    if (h.reloadTimer > 0) {
      if (--h.reloadTimer === 0) {
        h.ammo = h.def.magazine;
        world.emit({ type: 'reloadEnd', hero: h.id });
      }
    } else if (input.reloadPressed && h.ammo < h.def.magazine) {
      h.reloadTimer = h.def.reloadSteps;
      world.emit({ type: 'reloadStart', hero: h.id });
    }
  }
  if (h.fireTimer > 0) h.fireTimer--;
  if (h.fire2Timer > 0) h.fire2Timer--;
  const busy = h.dashing || h.bump;
  switch (h.def.kind) {
    case 'PetBot':
      petBotFire1(world, h, input, busy);
      petBotFire2(world, h, input, busy);
      break;
    case 'EngiBot':
      standardFire1(world, h, input, busy);
      engiBotFire2(world, h, input, busy);
      break;
    case 'BatBot':
      // BatBot n'a rien à recharger : R rappelle ses battes (GD-030)
      if (input.reloadPressed) recallBats(world, h);
      batBotFire1(world, h, input, busy);
      batBotFire2(world, h, input, busy);
      break;
    case 'BadaBot':
      badaBotFire1(world, h, input, busy);
      badaBotFire2(world, h, input);
      break;
  }
  h.fire2Was = input.fire2;
}

function shoot(world: World, h: Hero, count: number, precisionDeg: number): void {
  const m = muzzle(h);
  for (let i = 0; i < count; i++) {
    const spread = world.rng.range(-precisionDeg, precisionDeg) * DEG;
    world.fireBullet(h.def.bullet, 'hero', h.x, h.y, m.x, m.y, h.angle + spread, h.id);
  }
  playOneOf(world, h.def.sounds.fire1, h.x, h.y);
  h.ammo -= count;
  world.stats.ammoUsed += count;
  h.sinceShot = 0;
}

function emptyClick(world: World, h: Hero): void {
  h.fireTimer = Math.round(STEPS_PER_SECOND / h.def.shotsPerSecond);
  world.emit({ type: 'emptyClick', hero: h.id });
}

/** Tir principal d'EngiBot : une balle par intervalle tant que le clic est maintenu. */
function standardFire1(world: World, h: Hero, input: Input, busy: boolean): void {
  const canFire = input.fire1 && !input.fire2 && !busy && h.reloadTimer === 0 && h.state !== 'firing2';
  if (canFire && h.ammo > 0) h.state = 'firing1';
  else if (canFire && h.ammo === 0 && h.fireTimer === 0) emptyClick(world, h);
  if (h.state !== 'firing1') return;
  if (h.fireTimer === 0 && canFire && h.ammo > 0) {
    shoot(world, h, 1, h.def.precisionDeg);
    h.fireTimer = Math.round(STEPS_PER_SECOND / h.def.shotsPerSecond);
  } else if (h.fireTimer === 0) {
    h.state = 'standing';
  }
}

// ---------- PetBot : mini-drones à tête chercheuse (GD-093) ----------

const S = A.petBot.seeker;

/** Un drone peut-il prendre ce PNJ pour cible ? Les civils ne sont jamais visés. */
function seekable(npc: Npc): boolean {
  return npc.def.kind !== 'civil' && npc.hp > 0;
}

/**
 * L'ennemi que désigne un point visé par PetBot : le plus proche du point, dans la marge de tolérance du clic,
 * et que PetBot voit. Le jeu s'en sert au clic, l'affichage pour entourer l'ennemi survolé.
 */
export function seekerPick(world: World, h: Hero, x: number, y: number): Npc | null {
  let best: Npc | null = null;
  let bestD = Infinity;
  for (const npc of world.npcs) {
    if (!seekable(npc)) continue;
    const d = Math.hypot(npc.x - x, npc.y - y);
    if (d > npc.def.radius + S.pickMargin || d >= bestD) continue;
    if (world.sightBlocked(h.x, h.y, npc.x, npc.y)) continue;
    best = npc;
    bestD = d;
  }
  return best;
}

/** L'ennemi le plus proche d'un point, dans un rayon, que le drone voit de là où il est. */
function seekerScan(world: World, d: Seeker, x: number, y: number, radius: number): Npc | null {
  let best: Npc | null = null;
  let bestD = radius;
  for (const npc of world.npcs) {
    if (!seekable(npc)) continue;
    const dist = Math.hypot(npc.x - x, npc.y - y);
    if (dist > bestD || world.sightBlocked(d.x, d.y, npc.x, npc.y)) continue;
    best = npc;
    bestD = dist;
  }
  return best;
}

/**
 * Tir principal de PetBot. Cliquer sur un ennemi le verrouille : tant que le clic est tenu, tous les drones le
 * poursuivent, même si le curseur s'en va. Sans ennemi sous le clic, le drone part vers le point visé.
 */
function petBotFire1(world: World, h: Hero, input: Input, busy: boolean): void {
  if (!input.fire1) h.lock = -1;
  else if (!h.fire1Was) h.lock = seekerPick(world, h, input.aimX, input.aimY)?.id ?? -1;
  else if (h.lock >= 0 && !world.npcs.some((n) => n.id === h.lock && seekable(n))) h.lock = -1;
  h.fire1Was = input.fire1;

  const canFire = input.fire1 && !input.fire2 && !busy && h.reloadTimer === 0 && h.state !== 'firing2';
  if (canFire && h.ammo > 0) h.state = 'firing1';
  else if (canFire && h.ammo === 0 && h.fireTimer === 0) emptyClick(world, h);
  if (h.state !== 'firing1') return;
  if (h.fireTimer === 0 && canFire && h.ammo > 0) {
    launchSeeker(world, h, input);
    h.fireTimer = Math.round(STEPS_PER_SECOND / h.def.shotsPerSecond);
  } else if (h.fireTimer === 0) {
    h.state = 'standing';
  }
}

function launchSeeker(world: World, h: Hero, input: Input): void {
  const m = muzzle(h);
  playOneOf(world, h.def.sounds.fire1, h.x, h.y);
  h.ammo--;
  world.stats.ammoUsed++;
  h.sinceShot = 0;
  // un mur entre PetBot et son canon : le drone s'écrase dessus, comme une balle (GD-019)
  const wall = world.collision.raycast(h.x, h.y, m.x, m.y, BLOCK_BULLET);
  if (wall) {
    world.emit({ type: 'impact', x: h.x + (m.x - h.x) * wall.t, y: h.y + (m.y - h.y) * wall.t, angle: h.angle, surface: 'wall' });
    return;
  }
  // un drone est guidé : pas de dispersion, contrairement à la balle qu'il remplace
  let angle = h.angle;
  let scout = 0;
  if (h.lock < 0) {
    // sans cible : droit vers le point cliqué, sauf s'il est plus près de PetBot que son canon
    const dist = Math.hypot(input.aimX - m.x, input.aimY - m.y);
    if (Math.hypot(input.aimX - h.x, input.aimY - h.y) > Math.hypot(m.x - h.x, m.y - h.y) + S.speed) {
      angle = Math.atan2(input.aimY - m.y, input.aimX - m.x);
      scout = dist;
    } else {
      scout = S.speed;
    }
  }
  world.seekers.push({
    id: world.newId(), owner: h.id, x: m.x, y: m.y, angle, target: h.lock, scout, destX: input.aimX, destY: input.aimY,
    travelled: 0, path: null, pathIdx: 0, replan: 0,
  });
}

function stepSeekers(world: World): void {
  for (let i = world.seekers.length - 1; i >= 0; i--) {
    if (stepSeeker(world, world.seekers[i])) world.seekers.splice(i, 1);
  }
}

/** Direction que le drone doit prendre pour rejoindre sa cible, ou null s'il ne peut pas l'atteindre. */
function seekerHeading(world: World, d: Seeker, target: Npc): number | null {
  if (!world.shotBlocked(d.x, d.y, target.x, target.y)) {
    d.path = null;
    d.replan = 0;
    return Math.atan2(target.y - d.y, target.x - d.x);
  }
  // la cible est derrière un obstacle : chemin des PNJ, recalculé de temps en temps car elle bouge
  if (!d.path || --d.replan <= 0) {
    d.path = world.nav.findPath(d.x, d.y, target.x, target.y);
    d.pathIdx = 0;
    d.replan = S.replanSteps;
  }
  const path = d.path;
  if (!path) return null;
  // on vise le point du chemin le plus lointain qu'on peut rejoindre en ligne droite
  while (d.pathIdx < path.length - 1) {
    const next = path[d.pathIdx + 1];
    const here = path[d.pathIdx];
    const reached = Math.hypot(here.x - d.x, here.y - d.y) < S.speed * 1.5;
    if (!reached && (world.shotBlocked(d.x, d.y, next.x, next.y) || !world.nav.lineFree(d.x, d.y, next.x, next.y))) break;
    d.pathIdx++;
  }
  const p = path[d.pathIdx];
  return Math.atan2(p.y - d.y, p.x - d.x);
}

/** Avance un drone d'un step. Retourne true quand il disparaît. */
function stepSeeker(world: World, d: Seeker): boolean {
  let target: Npc | null = null;
  if (d.target >= 0) {
    target = world.npcs.find((n) => n.id === d.target && seekable(n)) ?? null;
    // sa cible est morte en vol : il se reporte une fois sur l'ennemi le plus proche de lui, sinon il file tout droit
    if (!target) target = seekerScan(world, d, d.x, d.y, S.retargetRadius);
    d.target = target ? target.id : -1;
  }
  let nx = d.x + Math.cos(d.angle) * S.speed;
  let ny = d.y + Math.sin(d.angle) * S.speed;
  if (target) {
    const want = seekerHeading(world, d, target);
    if (want === null) {
      // inatteignable : la tête chercheuse décroche
      d.target = -1;
      target = null;
    } else {
      const near = Math.hypot(target.x - d.x, target.y - d.y) < S.snapRange;
      d.angle = near ? want : rotateToward(d.angle, want, S.turnDeg * DEG);
      nx = d.x + Math.cos(d.angle) * S.speed;
      ny = d.y + Math.sin(d.angle) * S.speed;
      // son virage le mènerait dans un mur alors que la route est libre : il tourne d'un coup
      if (d.angle !== want && world.collision.raycast(d.x, d.y, nx, ny, BLOCK_BULLET)) {
        d.angle = want;
        nx = d.x + Math.cos(d.angle) * S.speed;
        ny = d.y + Math.sin(d.angle) * S.speed;
      }
    }
  }
  breakWindows(world, d.x, d.y, nx, ny);
  const wall = world.collision.raycast(d.x, d.y, nx, ny, BLOCK_BULLET);
  let limit = wall ? wall.t : 2;
  // un drone qui poursuit une cible passe au-dessus des autres ; sans cible, il touche le premier venu
  let struck: Npc | null = null;
  for (const npc of target ? [target] : world.npcs) {
    const t = segmentCircle(d.x, d.y, nx, ny, npc.x, npc.y, npc.def.radius + S.radius);
    if (t >= 0 && t < limit) {
      limit = t;
      struck = npc;
    }
  }
  const end = Math.min(1, limit);
  const fromX = d.x;
  const fromY = d.y;
  d.x += (nx - d.x) * end;
  d.y += (ny - d.y) * end;
  if (struck) {
    const blocked = blockedByFrontShield(struck, fromX, fromY);
    world.emit({ type: 'impact', x: d.x, y: d.y, angle: d.angle, surface: blocked ? 'shield' : 'npc' });
    if (!blocked) struck.hp -= S.damage;
    return true;
  }
  if (wall) {
    const drill = wall.obstacle.owner as Drill | null;
    if (drill && drill.tag === 'drill') world.damageDrill(drill, S.damage);
    world.emit({ type: 'impact', x: d.x, y: d.y, angle: d.angle, surface: 'wall' });
    return true;
  }
  d.travelled += S.speed;
  if (d.travelled > S.maxTravel || d.x < 0 || d.y < 0 || d.x > world.width || d.y > world.height) {
    world.emit({ type: 'impact', x: d.x, y: d.y, angle: d.angle, surface: 'wall' });
    return true;
  }
  if (d.scout > 0) {
    d.scout -= S.speed;
    if (d.scout <= 0) {
      // arrivé au point cliqué : il choisit une fois pour toutes, l'ennemi le plus proche de ce point ou tout droit
      d.scout = 0;
      const found = seekerScan(world, d, d.destX, d.destY, S.seekRadius);
      if (found) d.target = found.id;
    }
  }
  return false;
}

// ---------- PetBot : salve de drones ----------

/** Places des trois mini-bots de PetBot dans le monde : épaule gauche, épaule droite, tête (GD-045). */
export function petAnchors(h: Hero): { x: number; y: number }[] {
  return A.petBot.petOffsets.map((o) => localToWorld(h.x, h.y, h.angle, o.x, o.y));
}

function petBotFire2(world: World, h: Hero, input: Input, busy: boolean): void {
  if (!input.fire2 || busy || h.energy < A.petBot.energyCost) return;
  // pendant son ulti, ses mini-bots tournent autour de lui : ils ne peuvent pas partir en salve (GD-047)
  if (petSwarm(world, h)) return;
  // toujours le niveau 1 : la surcharge ne renforce plus le tir secondaire, elle sert à l'ulti (GD-043)
  const level = 1;
  const anchors = petAnchors(h);
  A.petBot.droneRanges.forEach((range, i) => {
    // la destination est celle d'avant (visée depuis PetBot, à la portée du drone) ; le mini-bot part de sa
    // place autour de PetBot et converge vers elle. Contre un mur, il part de PetBot lui-même.
    const aim = h.angle + world.rng.int(-A.petBot.droneSpreadDeg, A.petBot.droneSpreadDeg) * DEG;
    const destX = h.x + Math.cos(aim) * range;
    const destY = h.y + Math.sin(aim) * range;
    const from = world.shotBlocked(h.x, h.y, anchors[i].x, anchors[i].y) ? { x: h.x, y: h.y } : anchors[i];
    world.drones.push({
      id: world.newId(), x: from.x, y: from.y, angle: Math.atan2(destY - from.y, destX - from.x), speed: 0,
      range: Math.hypot(destX - from.x, destY - from.y), level, startX: from.x, startY: from.y,
    });
  });
  spendEnergy(world, h, A.petBot.energyCost);
}

function stepDrones(world: World): void {
  for (let i = world.drones.length - 1; i >= 0; i--) {
    const d = world.drones[i];
    if (stepDrone(world, d)) {
      world.drones.splice(i, 1);
      const sprite = `spr_PetDrone_explosion${d.level}`;
      const info = world.sprite(sprite);
      world.addExplosion({
        x: d.x, y: d.y, sprite, scale: 1, radius: A.petBot.explosionRadius[d.level - 1], damage: A.petBot.explosionDamage,
        healFromStep: Math.round((A.petBot.healFromFrame / spriteFps(info)) * STEPS_PER_SECOND),
      });
    }
  }
}

/** Retourne true quand le drone doit exploser. */
function stepDrone(world: World, d: Drone): boolean {
  d.speed = Math.min(A.petBot.droneMaxSpeed, d.speed + A.petBot.droneAcceleration);
  const nx = d.x + Math.cos(d.angle) * d.speed;
  const ny = d.y + Math.sin(d.angle) * d.speed;
  breakWindows(world, d.x, d.y, nx, ny);
  const wall = world.collision.raycast(d.x, d.y, nx, ny, BLOCK_BULLET);
  let limit = wall ? wall.t : 2;
  for (const npc of world.npcs) {
    const t = segmentCircle(d.x, d.y, nx, ny, npc.x, npc.y, npc.def.radius + A.petBot.droneRadius);
    if (t >= 0 && t < limit) limit = t;
  }
  const t = Math.min(1, limit);
  d.x += (nx - d.x) * t;
  d.y += (ny - d.y) * t;
  return limit <= 1 || Math.hypot(d.x - d.startX, d.y - d.startY) >= d.range;
}

function breakWindows(world: World, x1: number, y1: number, x2: number, y2: number): void {
  const glass = world.collision.raycast(x1, y1, x2, y2, IS_WINDOW);
  if (glass) world.breakWindow(glass.obstacle.owner as WindowPane, Math.atan2(y2 - y1, x2 - x1));
}

// ---------- Explosions ----------

function spriteFps(info: { speed: number; speedType: number }): number {
  return info.speedType === 0 ? info.speed : info.speed * STEPS_PER_SECOND;
}

function stepExplosions(world: World): void {
  for (let i = world.explosions.length - 1; i >= 0; i--) {
    const e = world.explosions[i];
    for (const npc of world.npcs) {
      if (e.hit.has(npc.id)) continue;
      if (Math.hypot(npc.x - e.x, npc.y - e.y) > e.radius + npc.def.radius) continue;
      if (world.sightBlocked(e.x, e.y, npc.x, npc.y)) continue;
      e.hit.add(npc.id);
      if (!blockedByFrontShield(npc, e.x, e.y)) npc.hp -= e.damage;
    }
    for (const drill of world.drills) {
      if (e.hit.has(-drill.id) || Math.hypot(e.x - drill.x, e.y - drill.y) - drill.radius > e.radius) continue;
      e.hit.add(-drill.id);
      world.damageDrill(drill, e.damage);
    }
    if (e.healFromStep >= 0 && e.step >= e.healFromStep) {
      for (const hero of world.living()) {
        if (hero.hp < hero.def.maxHealth && Math.hypot(hero.x - e.x, hero.y - e.y) <= e.radius + hero.def.radius) hero.healPool += A.petBot.healPerStep;
      }
    }
    if (++e.step >= e.totalSteps) world.explosions.splice(i, 1);
  }
}

// ---------- EngiBot : tourelle ----------

function engiBotFire2(world: World, h: Hero, input: Input, busy: boolean): void {
  if (h.placingTurret > 0) {
    h.fire2Anim++;
    h.state = 'firing2';
    if (--h.placingTurret === 0) {
      const m = muzzle(h);
      const level = h.energy >= A.engiBot.turretCost ? 1 : 0;
      if (level >= 1) {
        world.turret = {
          id: world.newId(), x: m.x, y: m.y, angle: h.angle, moveAngle: h.angle + world.rng.range(-1, 1) * DEG,
          speed: A.engiBot.turretThrowSpeed, state: 'flying', level, timer: 0, fireTimer: 0,
        };
        spendEnergy(world, h, A.engiBot.turretCost);
      }
      h.fire2Anim = -1;
      h.state = 'standing';
    }
    return;
  }
  if (!input.fire2 || input.fire1 || busy || h.fire2Timer > 0) return;
  h.fire2Timer = h.def.fire2CooldownSteps;
  const t = world.turret;
  if (t && Math.hypot(t.x - h.x, t.y - h.y) <= A.engiBot.foldDistance + h.def.radius + A.engiBot.turretRadius) {
    foldTurret(world);
    return;
  }
  if (h.energy < A.engiBot.turretCost) return;
  foldTurret(world);
  h.placingTurret = A.engiBot.placeAnimSteps;
  h.fire2Anim = 0;
  h.state = 'firing2';
  playOneOf(world, h.def.sounds.fire2, h.x, h.y);
}

function foldTurret(world: World): void {
  const t = world.turret;
  if (!t) return;
  world.emit({ type: 'turretFolded', x: t.x, y: t.y });
  world.emit({ type: 'sound', name: 'snd_engiBot_tourelleDeploiement_inv', x: t.x, y: t.y });
  world.turret = null;
}

function stepTurret(world: World, t: Turret): void {
  if (t.state === 'flying') {
    const nx = t.x + Math.cos(t.moveAngle) * t.speed;
    const ny = t.y + Math.sin(t.moveAngle) * t.speed;
    const hit = world.collision.raycast(t.x, t.y, nx, ny, BLOCK_MOVE);
    if (hit) {
      const n = boxNormal(hit.obstacle, t.x + (nx - t.x) * hit.t, t.y + (ny - t.y) * hit.t);
      t.moveAngle = reflectAngle(t.moveAngle, n.x, n.y);
      t.speed /= 2;
    } else {
      t.x = nx;
      t.y = ny;
    }
    t.speed -= A.engiBot.turretThrowDeceleration;
    if (t.speed <= 0) {
      const info = world.sprite('spr_turet_deploy');
      t.state = 'deploying';
      t.timer = Math.round((info.frames / spriteFps(info)) * STEPS_PER_SECOND);
      world.emit({ type: 'sound', name: 'snd_engiBot_tourelleDeploiement', x: t.x, y: t.y });
    }
    return;
  }
  if (t.state === 'deploying') {
    if (--t.timer <= 0) t.state = 'deployed';
    return;
  }
  if (t.fireTimer > 0) t.fireTimer--;
  // cible : le soldat visible le plus proche (GD-023 : les civils ne sont pas visés)
  let target: Npc | null = null;
  let best = A.engiBot.turretRange;
  for (const npc of world.npcs) {
    if (npc.def.kind === 'civil') continue;
    const d = Math.hypot(npc.x - t.x, npc.y - t.y);
    if (d <= best && !world.sightBlocked(t.x, t.y, npc.x, npc.y)) {
      best = d;
      target = npc;
    }
  }
  if (!target) return;
  const wanted = Math.atan2(target.y - t.y, target.x - t.x);
  t.angle = rotateToward(t.angle, wanted, A.engiBot.turretRotateDeg * DEG);
  if (t.angle !== wanted || t.fireTimer > 0) return;
  const mx = t.x + Math.cos(t.angle) * A.engiBot.turretMuzzle;
  const my = t.y + Math.sin(t.angle) * A.engiBot.turretMuzzle;
  const spread = world.rng.range(-A.engiBot.turretPrecisionDeg, A.engiBot.turretPrecisionDeg) * DEG;
  world.fireBullet(A.engiBot.turretBullet, 'hero', t.x, t.y, mx, my, t.angle + spread);
  world.emit({ type: 'sound', name: `snd_engiBot_tourelleFire_${world.rng.int(1, 3)}`, x: t.x, y: t.y });
  t.fireTimer = Math.round(STEPS_PER_SECOND / t.level); // cadence = niveau en tirs par seconde
}

// ---------- BatBot : coups de batte, lancer, rappel ----------

function batBotFire1(world: World, h: Hero, input: Input, busy: boolean): void {
  if (h.swingSteps > 0) {
    h.swingSteps--;
    swingHits(world, h);
  }
  const canFire = input.fire1 && !input.fire2 && !busy && h.bats > 0 && h.state !== 'firing2';
  if (canFire) h.state = 'firing1';
  if (h.state !== 'firing1') return;
  if (h.fireTimer === 0 && canFire) {
    h.swing = h.bats >= 2 ? (h.swingRight ? 'd' : 'g') : 'gg';
    h.swingRight = !h.swingRight;
    h.swingSteps = A.batBot.swingSteps;
    h.swingHit = new Set();
    h.sinceShot = 0;
    // avec une seule batte en main, la cadence est divisée par deux
    h.fireTimer = Math.round(STEPS_PER_SECOND / (h.bats >= 2 ? h.def.shotsPerSecond : h.def.shotsPerSecond / 2));
    playOneOf(world, h.def.sounds.fire1, h.x, h.y);
  } else if (h.fireTimer === 0) {
    h.state = 'standing';
  }
}

function swingHits(world: World, h: Hero): void {
  const box = A.batBot.swingBox;
  const c = Math.cos(h.angle);
  const s = Math.sin(h.angle);
  breakWindows(world, h.x, h.y, h.x + c * box.x1, h.y + s * box.x1);
  for (const drill of world.drills) {
    if (h.swingHit.has(-drill.id) || Math.hypot(h.x + c * box.x1 * 0.7 - drill.x, h.y + s * box.x1 * 0.7 - drill.y) - drill.radius > 40) continue;
    h.swingHit.add(-drill.id);
    world.damageDrill(drill, A.batBot.swingDamage);
  }
  for (const npc of world.npcs) {
    if (h.swingHit.has(npc.id)) continue;
    const dx = npc.x - h.x;
    const dy = npc.y - h.y;
    if (distanceToRect(dx * c + dy * s, -dx * s + dy * c, box.x0, box.y0, box.x1, box.y1) > npc.def.radius) continue;
    if (world.sightBlocked(h.x, h.y, npc.x, npc.y)) continue;
    h.swingHit.add(npc.id);
    const robot = npc.def.genre === 'robot';
    world.emit({ type: 'sound', name: `${robot ? 'snd_batBot_hitRobot' : 'snd_batBot_hitHuman'}${world.rng.int(1, 3)}`, x: npc.x, y: npc.y });
    if (blockedByFrontShield(npc, h.x, h.y)) {
      world.emit({ type: 'impact', x: npc.x, y: npc.y, angle: h.angle, surface: 'shield' });
    } else {
      npc.hp -= A.batBot.swingDamage;
      world.emit({ type: 'impact', x: npc.x, y: npc.y, angle: h.angle, surface: 'npc' });
    }
  }
}

/** Coût et niveau de la batte lancée selon l'énergie : 1 (moins de 4), 2 (4 à 6), 3 (7 à 9), 4 (10 et plus). */
export function batThrowLevel(energy: number): number {
  return energy < 4 ? 1 : energy <= 6 ? 2 : energy <= 9 ? 3 : 4;
}

function batBotFire2(world: World, h: Hero, input: Input, busy: boolean): void {
  if (h.fire2Anim >= 0) {
    h.state = 'firing2';
    if (++h.fire2Anim >= A.batBot.throwAnimSteps) {
      h.fire2Anim = -1;
      h.state = 'standing';
    }
  }
  if (input.fire2 && !h.fire2Was) {
    h.fire2Hold = 0;
    h.recallDone = false;
  }
  if (input.fire2) {
    // appui long : rappel des battes au sol
    if (++h.fire2Hold >= A.batBot.holdStepsForRecall && !h.recallDone) {
      h.recallDone = true;
      recallBats(world, h);
    }
    return;
  }
  if (!h.fire2Was) return;
  if (h.fire2Hold >= A.batBot.holdStepsForRecall) return;
  // appui court relâché sans batte en main : les battes reviennent (GD-025)
  if (h.bats < 1) {
    recallBats(world, h);
    return;
  }
  // appui court relâché : lancer
  const level = 1;
  if (h.energy < level || h.fire2Timer > 0 || busy) return;
  const side = h.bats >= 2 ? 'd' : 'g';
  const m = muzzle(h);
  const angle = h.angle + world.rng.range(-h.def.precisionDeg, h.def.precisionDeg) * DEG;
  world.bats.push({ id: world.newId(), x: m.x, y: m.y, angle, side, level, state: 'flying', startX: m.x, startY: m.y, hit: new Set(), steps: 0, exploded: false });
  h.swing = side;
  h.fire2Timer = h.def.fire2CooldownSteps;
  h.fire2Anim = 0;
  h.state = 'firing2';
  h.bats--;
  spendEnergy(world, h, level);
  playOneOf(world, h.def.sounds.fire2, h.x, h.y);
}

/**
 * Rappelle les battes : toutes celles qui ne reviennent pas déjà, au sol ou en vol, comme dans l'original.
 * Coûte 1 énergie, seulement s'il y en a une à rappeler.
 */
function recallBats(world: World, h: Hero): void {
  const away = world.bats.filter((b) => b.state !== 'returning');
  if (h.energy < A.batBot.recallCost || away.length === 0) return;
  for (const b of away) {
    b.state = 'returning';
    b.hit = new Set();
    b.exploded = false;
  }
  spendEnergy(world, h, A.batBot.recallCost);
  world.emit({ type: 'sound', name: 'snd_batBot_fire2_souffle', x: h.x, y: h.y });
}

/** Main vers laquelle revient une batte : droite ou gauche selon la batte. */
export function batHand(h: Hero, side: 'd' | 'g'): { x: number; y: number } {
  return localToWorld(h.x, h.y, h.angle, A.batBot.hand.x, side === 'd' ? A.batBot.hand.y : -A.batBot.hand.y);
}

function stepBats(world: World): void {
  const h = world.heroOf('BatBot');
  if (!h) {
    world.bats.length = 0;
    return;
  }
  for (let i = world.bats.length - 1; i >= 0; i--) {
    const b = world.bats[i];
    b.steps++;
    const toHero = Math.hypot(h.x - b.x, h.y - b.y);
    // la batte est reprise en marchant dessus, ou à son retour
    if (b.state !== 'flying' && h.state !== 'dead' && h.def.kind === 'BatBot' && toHero <= h.def.radius + A.batBot.pickupDistance) {
      world.bats.splice(i, 1);
      h.bats = Math.min(2, h.bats + 1);
      continue;
    }
    if (b.state === 'flying') flyBat(world, b);
    else if (b.state === 'returning') returnBat(world, b, h);
  }
}

function stopBat(world: World, b: Bat): void {
  b.state = 'stopped';
  const lvl = A.batBot.levels[b.level - 1];
  if (lvl.explosionRadius > 0 && !b.exploded) {
    b.exploded = true;
    world.addExplosion({
      x: b.x, y: b.y, sprite: 'spr_bullet2_explosion', radius: lvl.explosionRadius, damage: lvl.explosionDamage, healFromStep: -1,
      scale: (lvl.explosionRadius * 2) / world.sprite('spr_bullet2_explosion').w,
    });
    world.emit({ type: 'sound', name: 'snd_batBot_fire2_souffle', x: b.x, y: b.y });
  }
}

function flyBat(world: World, b: Bat): void {
  const lvl = A.batBot.levels[b.level - 1];
  const speed = CONFIG.heroes.BatBot.bullet.speed;
  const nx = b.x + Math.cos(b.angle) * speed;
  const ny = b.y + Math.sin(b.angle) * speed;
  breakWindows(world, b.x, b.y, nx, ny);
  const wall = world.collision.raycast(b.x, b.y, nx, ny, BLOCK_BULLET);
  let limit = wall ? wall.t : 2;
  let target: Npc | null = null;
  for (const npc of world.npcs) {
    if (b.hit.has(npc.id)) continue;
    const t = segmentCircle(b.x, b.y, nx, ny, npc.x, npc.y, npc.def.radius + CONFIG.heroes.BatBot.bullet.radius);
    if (t >= 0 && t < limit) {
      if (lvl.pierce) {
        // batte perçante : traverse en blessant, explose seulement à l'arrêt (GD-023)
        b.hit.add(npc.id);
        if (!blockedByFrontShield(npc, b.x, b.y)) npc.hp -= CONFIG.heroes.BatBot.bullet.damage;
      } else {
        limit = t;
        target = npc;
      }
    }
  }
  const t = Math.min(1, limit);
  b.x += (nx - b.x) * t;
  b.y += (ny - b.y) * t;
  if (target) {
    b.hit.add(target.id);
    // niveau 1 : dégât direct ; niveaux explosifs : seule l'explosion blesse
    if (lvl.explosionRadius === 0 && !blockedByFrontShield(target, b.startX, b.startY)) target.hp -= CONFIG.heroes.BatBot.bullet.damage;
    world.emit({ type: 'impact', x: b.x, y: b.y, angle: b.angle, surface: 'npc' });
    stopBat(world, b);
  } else if (wall && limit <= 1) {
    const drill = wall.obstacle.owner as Drill | null;
    if (drill && drill.tag === 'drill') world.damageDrill(drill, CONFIG.heroes.BatBot.bullet.damage);
    // recule un peu pour ne pas rester dans le mur
    b.x -= Math.cos(b.angle) * 24;
    b.y -= Math.sin(b.angle) * 24;
    world.emit({ type: 'sound', name: `snd_batBot_hitMur${world.rng.int(1, 2)}`, x: b.x, y: b.y });
    world.emit({ type: 'impact', x: b.x, y: b.y, angle: b.angle, surface: 'wall' });
    stopBat(world, b);
  } else if (Math.hypot(b.x - b.startX, b.y - b.startY) >= CONFIG.heroes.BatBot.bullet.maxDistance
    || b.x < 70 || b.y < 70 || b.x > world.width - 70 || b.y > world.height - 70) {
    stopBat(world, b);
  }
}

/**
 * Batte rappelée : elle vole vers la main du BatBot tant qu'aucun mur ne les sépare, et frappe ce qu'elle
 * croise comme à l'aller (GD-030) : 3 dégâts par ennemi, ou son explosion si elle est explosive.
 */
function returnBat(world: World, b: Bat, h: Hero): void {
  if (world.shotBlocked(b.x, b.y, h.x, h.y)) return; // elle attend que la voie soit libre
  const lvl = A.batBot.levels[b.level - 1];
  const speed = h.def.bullet.speed;
  const hand = batHand(h, b.side);
  b.angle = Math.atan2(hand.y - b.y, hand.x - b.x);
  const step = Math.min(speed, Math.hypot(hand.x - b.x, hand.y - b.y));
  const nx = b.x + Math.cos(b.angle) * step;
  const ny = b.y + Math.sin(b.angle) * step;
  for (const npc of world.npcs) {
    if (b.hit.has(npc.id)) continue;
    if (segmentCircle(b.x, b.y, nx, ny, npc.x, npc.y, npc.def.radius + h.def.bullet.radius) < 0) continue;
    b.hit.add(npc.id);
    world.emit({ type: 'impact', x: npc.x, y: npc.y, angle: b.angle, surface: 'npc' });
    if (lvl.explosionRadius > 0) {
      if (b.exploded) continue;
      b.exploded = true;
      world.addExplosion({
        x: npc.x, y: npc.y, sprite: 'spr_bullet2_explosion', radius: lvl.explosionRadius, damage: lvl.explosionDamage, healFromStep: -1,
        scale: (lvl.explosionRadius * 2) / world.sprite('spr_bullet2_explosion').w,
      });
    } else if (!blockedByFrontShield(npc, b.x, b.y)) {
      npc.hp -= h.def.bullet.damage;
    }
  }
  b.x = nx;
  b.y = ny;
}

// ---------- BadaBot : plasma chargé, bouclier ----------

/**
 * Tir principal de BadaBot (GD-073) : une salve de trois boules de plasma, tirées ensemble, tant que le clic est
 * maintenu. Il n'y a plus de charge à tenir : dans le code de 2019, il fallait garder le clic appuyé pour passer
 * de une à trois boules.
 */
function badaBotFire1(world: World, h: Hero, input: Input, busy: boolean): void {
  if (h.state === 'firing1' && h.fireTimer === 0) h.state = 'standing';
  if (!input.fire1 || busy || h.reloadTimer > 0 || h.fireTimer > 0) return;
  if (h.ammo === 0) {
    emptyClick(world, h);
    return;
  }
  shoot(world, h, Math.min(A.badaBot.salvo, h.ammo), A.badaBot.salvoPrecisionDeg);
  h.fireTimer = Math.round(STEPS_PER_SECOND / h.def.shotsPerSecond);
  if (h.state !== 'firing2') h.state = 'firing1';
}

function badaBotFire2(world: World, h: Hero, input: Input): void {
  const want = input.fire2 && h.energy > 0 && !h.dashing && !h.bump;
  if (want && h.fire2Anim < 0 && h.fire2Timer === 0) {
    h.fire2Timer = h.def.fire2CooldownSteps;
    h.fire2Anim = 0;
    playOneOf(world, h.def.sounds.fire2, h.x, h.y);
  }
  if (h.fire2Anim < 0) return;
  if (!want) {
    h.fire2Anim = -1;
    h.shieldUp = false;
    h.speedFactor = 1;
    if (h.state === 'firing2') h.state = 'standing';
    return;
  }
  h.fire2Anim++;
  h.state = 'firing2';
  h.speedFactor = A.badaBot.shieldSpeedFactor;
  h.energyPause = CONFIG.hero.energyPauseSteps; // pas de régénération bouclier levé
  if (h.fire2Anim >= A.badaBot.shieldRaiseSteps) h.shieldUp = true;
}

/** Une balle ennemie touche-t-elle le bouclier levé ? Retourne le paramètre t du segment, ou -1. */
export function shieldIntercept(h: Hero, x1: number, y1: number, x2: number, y2: number): number {
  if (!h.shieldUp) return -1;
  const box = A.badaBot.shieldBox;
  const c = Math.cos(h.angle);
  const s = Math.sin(h.angle);
  // échantillonnage du segment dans le repère du héros
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const dx = x1 + (x2 - x1) * t - h.x;
    const dy = y1 + (y2 - y1) * t - h.y;
    if (distanceToRect(dx * c + dy * s, -dx * s + dy * c, box.x0, box.y0, box.x1, box.y1) === 0) return t;
  }
  return -1;
}

/** Le bouclier encaisse une balle : toutes les 5 balles, il coûte 1 énergie (GD-073). */
export function shieldTank(world: World, h: Hero): void {
  if (++h.tanked >= A.badaBot.bulletsPerEnergy) {
    h.tanked = 0;
    h.energy = Math.max(0, h.energy - 1);
    world.stats.energyUsed++;
  }
}

// ---------- Boucle des objets créés par les héros ----------

export function stepAbilityObjects(world: World): void {
  stepSeekers(world);
  stepDrones(world);
  if (world.turret) stepTurret(world, world.turret);
  stepBats(world);
  stepExplosions(world);
}

export type NewExplosion = Pick<Explosion, 'x' | 'y' | 'sprite' | 'scale' | 'radius' | 'damage' | 'healFromStep'>;

export function explosionSteps(world: World, sprite: string): number {
  const info = world.sprite(sprite);
  return Math.max(1, Math.round((info.frames / spriteFps(info)) * STEPS_PER_SECOND));
}
