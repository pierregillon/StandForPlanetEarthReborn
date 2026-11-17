// Attaque ultime (GD-043, GD-044) : disponible à pleine surcharge, elle dépense toute l'énergie. Deux secondes
// de lancement, immobile et vulnérable, puis le coup propre à chaque robot :
//   BatBot  : il bondit dans la mêlée et son atterrissage explose autour de lui ;
//   PetBot  : ses mini-bots tournent autour de lui et répandent un essaim de nanomachines qui soigne les alliés ;
//   BadaBot : il frappe ses boucliers, une vague d'énergie file devant lui et projette tout au loin ;
//   EngiBot : une grenade électromagnétique désactive les robots ennemis, sans effet sur les humains.
import { CONFIG } from './config.ts';
import { BLOCK_MOVE, BLOCK_SIGHT, DEG, IS_WINDOW, rotateToward } from './geom.ts';
import { dropDonors, unlink } from './link.ts';
import type { Hero, Input, Npc, UltiEffect, WindowPane } from './types.ts';
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
    // la vague naît devant lui, là où ses boucliers se heurtent, et s'arrête au premier mur
    const reach = cfg.start + cfg.range;
    const hit = world.collision.raycast(h.x, h.y, h.x + c * reach, h.y + s * reach, BLOCK_SIGHT);
    const length = Math.max(0, (hit ? reach * hit.t : reach) - cfg.start);
    const x = h.x + c * cfg.start;
    const y = h.y + s * cfg.start;
    world.effects.push({
      ...base, kind: 'wave', x, y, fromX: x, fromY: y, total: Math.ceil(length / cfg.speed) + cfg.fadeSteps, radius: cfg.halfWidth, length,
    });
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

/** Ce que chaque vague a déjà projeté : elle ne reprend pas deux fois le même (côté serveur seulement). */
const swept = new WeakMap<UltiEffect, Set<number>>();

/** Position du front de la vague de BadaBot d'après le temps écoulé. Sert aussi au client d'une partie en réseau. */
export function placeWave(e: UltiEffect): void {
  const d = Math.min(e.length, U.badaBot.speed * e.steps);
  e.x = e.fromX + Math.cos(e.angle) * d;
  e.y = e.fromY + Math.sin(e.angle) * d;
}

/**
 * La vague avance d'un pas : tout ce que son front rencontre est projeté droit devant (GD-051). Les ennemis et
 * les chaises partent à sa vitesse ; les balles ennemies sont emportées et changent de camp ; les vitres
 * éclatent. Les héros et leurs objets ne sentent rien. Le boss est trop lourd : il est seulement sonné.
 */
function sweepWave(world: World, e: UltiEffect): void {
  const cfg = U.badaBot;
  const d0 = Math.min(e.length, cfg.speed * (e.steps - 1));
  const d1 = Math.min(e.length, cfg.speed * e.steps);
  if (d1 <= d0) return;
  const c = Math.cos(e.angle);
  const s = Math.sin(e.angle);
  let done = swept.get(e);
  if (!done) swept.set(e, (done = new Set()));
  // les vitres sur le passage du front, sur toute sa largeur
  for (const side of [-1, 0, 1]) {
    const ox = e.fromX - s * side * e.radius;
    const oy = e.fromY + c * side * e.radius;
    const glass = world.collision.raycast(ox + c * d0, oy + s * d0, ox + c * d1, oy + s * d1, IS_WINDOW);
    if (glass) world.breakWindow(glass.obstacle.owner as WindowPane, e.angle);
  }
  /** Le front atteint-il ce corps à ce pas ? Un mur entre l'axe de la vague et lui le protège. */
  const caught = (x: number, y: number, radius: number): boolean => {
    const along = (x - e.fromX) * c + (y - e.fromY) * s;
    const across = -(x - e.fromX) * s + (y - e.fromY) * c;
    if (Math.abs(across) > e.radius + radius || along < d0 - radius || along > d1 + radius) return false;
    const reach = Math.max(0, Math.min(e.length, along));
    return !world.shotBlocked(e.fromX + c * reach, e.fromY + s * reach, x, y);
  };
  for (const npc of world.npcs) {
    if (done.has(npc.id) || !caught(npc.x, npc.y, npc.def.radius)) continue;
    done.add(npc.id);
    npc.active = true;
    if (npc.def.kind === 'boss') {
      npc.stun = Math.max(npc.stun, cfg.dazeSteps);
      continue;
    }
    npc.thrown = cfg.throwDistance;
    npc.thrownAngle = e.angle;
    npc.path = null;
    npc.state = 'standing';
  }
  for (const chair of world.chairs) {
    if (done.has(chair.id) || !caught(chair.obstacle.cx, chair.obstacle.cy, CONFIG.chair.radius)) continue;
    done.add(chair.id);
    chair.vx = c * cfg.speed;
    chair.vy = s * cfg.speed;
    chair.thrown = cfg.throwDistance;
  }
  for (const b of world.bullets) {
    if (b.owner !== 'enemy' || !caught(b.x, b.y, b.def.radius)) continue;
    // la balle est emportée : elle repart droit devant, et c'est maintenant celle de BadaBot
    b.owner = 'hero';
    b.ownerId = e.owner;
    b.angle = e.angle;
    b.speed = Math.max(b.speed, cfg.speed);
    b.startX = b.x;
    b.startY = b.y;
    b.lastHit = -1;
  }
}

/**
 * Un ennemi projeté par la vague file tout droit en tournoyant, ralentit sur la fin, et s'arrête net contre un
 * mur ou un meuble. Il reste ensuite sonné un moment. Appelé par la boucle des PNJ à la place de son comportement.
 */
export function stepThrown(world: World, npc: Npc): void {
  const cfg = U.badaBot;
  const speed = Math.min(cfg.speed, npc.thrown, Math.max(6, npc.thrown * 0.12));
  const c = Math.cos(npc.thrownAngle);
  const s = Math.sin(npc.thrownAngle);
  // par petits pas, pour ne traverser aucun mur
  const hops = Math.ceil(speed / 12);
  const hop = speed / hops;
  let stopped = false;
  for (let i = 0; i < hops && !stopped; i++) {
    const res = world.collision.resolveCircle(npc.x + c * hop, npc.y + s * hop, npc.def.radius * 0.5, BLOCK_MOVE);
    // l'obstacle le dévie à peine : il glisse le long ; il lui barre la route : il s'arrête
    stopped = res.hit && (res.x - npc.x) * c + (res.y - npc.y) * s < hop * 0.35;
    npc.x = res.x;
    npc.y = res.y;
  }
  npc.thrown = stopped ? 0 : Math.max(0, npc.thrown - speed);
  npc.angle += 0.4;
  npc.dir = npc.angle;
  if (npc.thrown < 1) {
    npc.thrown = 0;
    npc.daze = cfg.dazeSteps;
    if (stopped) world.emit({ type: 'impact', x: npc.x + c * npc.def.radius, y: npc.y + s * npc.def.radius, angle: npc.thrownAngle, surface: 'wall' });
  }
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
    } else {
      placeWave(e);
      sweepWave(world, e);
    }
    if (!over) continue;
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
  world.effects.length = 0;
}
