// Attaque ultime (GD-043, GD-044) : disponible à pleine surcharge, elle dépense toute l'énergie. Deux secondes
// de lancement, immobile et vulnérable, puis le coup propre à chaque robot :
//   BatBot  : il bondit dans la mêlée et son atterrissage explose autour de lui ;
//   PetBot  : ses mini-bots tournent autour de lui et répandent un essaim de nanomachines qui soigne les alliés ;
//   BadaBot : un mur d'énergie infranchissable se dresse devant lui ;
//   EngiBot : une grenade électromagnétique désactive les robots ennemis, sans effet sur les humains.
import { CONFIG } from './config.ts';
import { BLOCK_BULLET, BLOCK_MOVE, BLOCK_SIGHT, DEG, IS_WINDOW, makeBox, rotateToward } from './geom.ts';
import type { Obstacle } from './geom.ts';
import { dropDonors, unlink } from './link.ts';
import type { Hero, Input, UltiEffect } from './types.ts';
import type { World } from './world.ts';

const U = CONFIG.ulti;

/** Phases de l'ulti d'un héros. */
export const ULTI_NONE = 0;
export const ULTI_CAST = 1;
export const ULTI_ACTION = 2;
export const ULTI_RECOVER = 3;

export function ultiReady(h: Hero): boolean {
  return h.ultiPhase === ULTI_NONE && h.energy >= CONFIG.hero.maxEnergy && h.state !== 'dead';
}

/** Place un BatBot en plein bond d'après le temps écoulé. Sert aussi à la prédiction côté client. */
export function placeLeap(h: Hero): void {
  const t = Math.min(1, h.ultiSteps / U.batBot.leapSteps);
  h.x = h.ultiFromX + (h.ultiToX - h.ultiFromX) * t;
  h.y = h.ultiFromY + (h.ultiToY - h.ultiFromY) * t;
}

/** L'essaim de soin de ce PetBot, tant qu'il dure : ses mini-bots sont alors en orbite autour de lui (GD-047). */
export function petSwarm(world: World, h: Hero): UltiEffect | undefined {
  return world.effects.find((e) => e.kind === 'nanos' && e.owner === h.id);
}

/** Avance l'ulti du héros. Retourne true tant qu'il l'occupe : il ne fait alors rien d'autre. */
export function stepUlti(world: World, h: Hero, input: Input): boolean {
  if (h.ultiPhase === ULTI_NONE) {
    if (!input.ultiPressed || !ultiReady(h) || h.dashing || h.bump) return false;
    h.ultiPhase = ULTI_CAST;
    h.ultiSteps = 0;
    // l'ulti dépense tout et coupe tout : les coéquipiers devront se relier
    world.stats.energyUsed += h.energy;
    h.energy = 0;
    dropDonors(world, h);
    unlink(world, h);
    h.charging = false;
    h.linkedOutlet = -1;
    h.shieldUp = false;
    h.charge = 0;
    h.fire2Anim = -1;
    h.placingTurret = 0;
    h.speedFactor = 1;
    world.emit({ type: 'ultiCast', hero: h.id });
    return true;
  }
  h.ultiSteps++;
  if (h.ultiPhase === ULTI_CAST) {
    // lancement : immobile, mais le robot se tourne encore vers sa cible
    h.angle = rotateToward(h.angle, Math.atan2(input.aimY - h.y, input.aimX - h.x), h.def.rotateSpeedDeg * DEG);
    if (h.ultiSteps >= U.castSteps) release(world, h, input);
    return true;
  }
  if (h.ultiPhase === ULTI_ACTION) {
    placeLeap(h);
    if (h.ultiSteps >= U.batBot.leapSteps) land(world, h);
    return true;
  }
  if (h.ultiSteps >= U.recoverSteps) h.ultiPhase = ULTI_NONE;
  return true;
}

/** Fin du lancement : le coup part. */
function release(world: World, h: Hero, input: Input): void {
  const dir = Math.atan2(input.aimY - h.y, input.aimX - h.x);
  h.angle = dir;
  if (h.def.kind === 'BatBot') {
    startLeap(world, h, dir, Math.hypot(input.aimX - h.x, input.aimY - h.y));
    return;
  }
  // les trois autres laissent un effet dans le monde ; le robot reprend aussitôt la main
  h.ultiPhase = ULTI_RECOVER;
  h.ultiSteps = 0;
  const c = Math.cos(dir);
  const s = Math.sin(dir);
  const base = { id: world.newId(), owner: h.id, angle: dir, fromX: h.x, fromY: h.y, steps: 0, length: 0 };
  if (h.def.kind === 'PetBot') {
    world.effects.push({ ...base, kind: 'nanos', x: h.x, y: h.y, total: U.petBot.steps, radius: U.petBot.radius });
  } else if (h.def.kind === 'BadaBot') {
    const cfg = U.badaBot;
    const wall: UltiEffect = { ...base, kind: 'wall', x: h.x + c * cfg.distance, y: h.y + s * cfg.distance, total: cfg.steps, radius: cfg.halfThickness, length: cfg.halfLength };
    world.effects.push(wall);
    raiseWall(world, wall);
  } else {
    const cfg = U.engiBot;
    // la grenade vole vers le point visé et s'arrête au premier mur
    let dist = Math.min(cfg.range, Math.hypot(input.aimX - h.x, input.aimY - h.y));
    const hit = world.collision.raycast(h.x, h.y, h.x + c * dist, h.y + s * dist, BLOCK_SIGHT | IS_WINDOW);
    if (hit) dist = Math.max(0, dist * hit.t - 20);
    world.effects.push({ ...base, kind: 'emp', x: h.x, y: h.y, total: cfg.flySteps + cfg.pulseSteps, radius: cfg.radius, length: dist });
  }
  world.emit({ type: 'ultiFx', kind: h.def.kind, x: h.x, y: h.y });
}

// ---------- BatBot : le bond ----------

/** BatBot bondit vers le point visé, jusqu'au premier mur, et se pose sur un endroit libre. */
function startLeap(world: World, h: Hero, dir: number, wanted: number): void {
  const cfg = U.batBot;
  let dist = Math.min(cfg.range, wanted);
  const c = Math.cos(dir);
  const s = Math.sin(dir);
  // il passe par-dessus les meubles et les ennemis, pas à travers un mur, une porte ou une vitre
  const wall = world.collision.raycast(h.x, h.y, h.x + c * dist, h.y + s * dist, BLOCK_SIGHT | IS_WINDOW);
  if (wall) dist = Math.max(0, dist * wall.t - h.def.radius - 8);
  while (dist > 0 && !world.collision.circleFree(h.x + c * dist, h.y + s * dist, h.def.radius, BLOCK_MOVE)) dist = Math.max(0, dist - 16);
  h.ultiFromX = h.x;
  h.ultiFromY = h.y;
  h.ultiToX = h.x + c * dist;
  h.ultiToY = h.y + s * dist;
  h.moveAngle = dir;
  h.ultiPhase = ULTI_ACTION;
  h.ultiSteps = 0;
  world.emit({ type: 'ultiLeap', hero: h.id });
}

/** Atterrissage : tout ce qui est en vue dans le rayon encaisse le choc, boucliers compris. */
function land(world: World, h: Hero): void {
  const cfg = U.batBot;
  h.x = h.ultiToX;
  h.y = h.ultiToY;
  for (const npc of world.npcs) {
    if (Math.hypot(npc.x - h.x, npc.y - h.y) > cfg.radius + npc.def.radius) continue;
    if (world.sightBlocked(h.x, h.y, npc.x, npc.y)) continue;
    npc.hp -= cfg.damage;
  }
  for (const drill of world.drills) {
    if (Math.hypot(drill.x - h.x, drill.y - h.y) - drill.radius <= cfg.radius) world.damageDrill(drill, cfg.damage);
  }
  for (const pane of world.windows) {
    if (Math.hypot(pane.obstacle.cx - h.x, pane.obstacle.cy - h.y) <= cfg.radius) world.breakWindow(pane, Math.atan2(pane.obstacle.cy - h.y, pane.obstacle.cx - h.x));
  }
  h.ultiPhase = ULTI_RECOVER;
  h.ultiSteps = 0;
  world.emit({ type: 'ultiImpact', hero: h.id, x: h.x, y: h.y, radius: cfg.radius });
  world.emit({ type: 'sound', name: 'snd_batBot_fire2_souffle', x: h.x, y: h.y });
}

// ---------- Effets laissés dans le monde ----------

/** Obstacle de chaque mur d'énergie (il n'est pas transmis sur le réseau : chaque monde construit le sien). */
const wallObstacles = new WeakMap<UltiEffect, Obstacle>();

/**
 * Dresse le mur de BadaBot : il arrête les déplacements et les balles, dans les deux sens et pour tout le
 * monde, mais pas le regard. Ceux qui se trouvent à son emplacement sont repoussés du côté le plus proche.
 * Appelé aussi par le client d'une partie en réseau, pour son monde miroir.
 */
export function raiseWall(world: World, wall: UltiEffect): void {
  if (wallObstacles.has(wall)) return;
  const o = world.collision.add(makeBox(wall.x, wall.y, wall.radius, wall.length, wall.angle, BLOCK_MOVE | BLOCK_BULLET, wall));
  wallObstacles.set(wall, o);
  world.nav.mark(o, 1);
  const c = Math.cos(wall.angle);
  const s = Math.sin(wall.angle);
  const eject = (body: { x: number; y: number }, radius: number): void => {
    const dx = body.x - wall.x;
    const dy = body.y - wall.y;
    const across = dx * c + dy * s;
    const along = -dx * s + dy * c;
    const reach = wall.radius + radius + 2;
    if (Math.abs(across) >= reach || Math.abs(along) >= wall.length + radius) return;
    const push = (across >= 0 ? reach : -reach) - across;
    body.x += c * push;
    body.y += s * push;
  };
  for (const npc of world.npcs) eject(npc, npc.def.radius);
  for (const h of world.heroes) if (!h.gone) eject(h, h.def.radius);
}

export function dropWall(world: World, wall: UltiEffect): void {
  const o = wallObstacles.get(wall);
  if (!o) return;
  wallObstacles.delete(wall);
  world.nav.mark(o, -1);
  world.collision.update(o, () => {
    o.active = false;
  });
}

/** Position de la grenade d'EngiBot pendant son vol. */
export function placeGrenade(e: UltiEffect): void {
  const t = Math.min(1, e.steps / U.engiBot.flySteps);
  e.x = e.fromX + Math.cos(e.angle) * e.length * t;
  e.y = e.fromY + Math.sin(e.angle) * e.length * t;
}

export function stepEffects(world: World): void {
  for (let i = world.effects.length - 1; i >= 0; i--) {
    const e = world.effects[i];
    e.steps++;
    const owner = world.heroes[e.owner];
    let over = e.steps >= e.total;
    if (e.kind === 'nanos') {
      // l'essaim suit PetBot ; il se disperse si PetBot tombe
      if (!owner || owner.gone || owner.state === 'dead') {
        over = true;
      } else {
        e.x = owner.x;
        e.y = owner.y;
        for (const h of world.living()) {
          if (h.hp < h.def.maxHealth && Math.hypot(h.x - e.x, h.y - e.y) <= e.radius + h.def.radius) h.healPool += U.petBot.healPerStep;
        }
      }
    } else if (e.kind === 'emp') {
      placeGrenade(e);
      if (e.steps === U.engiBot.flySteps) detonate(world, e);
    }
    if (!over) continue;
    if (e.kind === 'wall') dropWall(world, e);
    world.effects.splice(i, 1);
  }
}

/** La grenade éclate : les robots ennemis à portée sont désactivés, murs ou pas ; les humains ne sentent rien. */
function detonate(world: World, e: UltiEffect): void {
  for (const npc of world.npcs) {
    if (npc.def.genre !== 'robot' || Math.hypot(npc.x - e.x, npc.y - e.y) > e.radius + npc.def.radius) continue;
    npc.stun = U.engiBot.stunSteps;
  }
  world.emit({ type: 'ultiFx', kind: 'emp', x: e.x, y: e.y });
}

/** Retire tous les effets (changement de salle). */
export function clearEffects(world: World): void {
  for (const e of world.effects) if (e.kind === 'wall') dropWall(world, e);
  world.effects.length = 0;
}
