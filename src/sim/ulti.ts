// Attaque ultime (GD-043) : disponible à pleine surcharge, elle dépense toute l'énergie. Deux secondes de
// lancement, immobile et vulnérable, puis le coup propre à chaque robot.
// BatBot : il bondit dans la mêlée et son atterrissage explose autour de lui.
import { CONFIG } from './config.ts';
import { BLOCK_MOVE, BLOCK_SIGHT, DEG, IS_WINDOW, rotateToward } from './geom.ts';
import { dropDonors, unlink } from './link.ts';
import type { Hero, Input } from './types.ts';
import type { World } from './world.ts';

const U = CONFIG.ulti;

/** Phases de l'ulti d'un héros. */
export const ULTI_NONE = 0;
export const ULTI_CAST = 1;
export const ULTI_ACTION = 2;
export const ULTI_RECOVER = 3;

/** Robots qui ont déjà leur ulti (les autres arrivent). */
export function hasUlti(h: Hero): boolean {
  return h.def.kind === 'BatBot';
}

export function ultiReady(h: Hero): boolean {
  return hasUlti(h) && h.ultiPhase === ULTI_NONE && h.energy >= CONFIG.hero.maxEnergy && h.state !== 'dead';
}

/** Place un BatBot en plein bond d'après le temps écoulé. Sert aussi à la prédiction côté client. */
export function placeLeap(h: Hero): void {
  const t = Math.min(1, h.ultiSteps / U.batBot.leapSteps);
  h.x = h.ultiFromX + (h.ultiToX - h.ultiFromX) * t;
  h.y = h.ultiFromY + (h.ultiToY - h.ultiFromY) * t;
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
    if (h.ultiSteps >= U.castSteps) startLeap(world, h, input);
    return true;
  }
  if (h.ultiPhase === ULTI_ACTION) {
    placeLeap(h);
    if (h.ultiSteps >= U.batBot.leapSteps) land(world, h);
    return true;
  }
  if (h.ultiSteps >= U.batBot.recoverSteps) h.ultiPhase = ULTI_NONE;
  return true;
}

/** BatBot bondit vers le point visé, jusqu'au premier mur, et se pose sur un endroit libre. */
function startLeap(world: World, h: Hero, input: Input): void {
  const cfg = U.batBot;
  const dir = Math.atan2(input.aimY - h.y, input.aimX - h.x);
  let dist = Math.min(cfg.range, Math.hypot(input.aimX - h.x, input.aimY - h.y));
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
  h.angle = dir;
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
