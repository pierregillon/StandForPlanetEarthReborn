// Logique du héros : déplacement, visée, dash, tir principal, rechargement, énergie, prises de courant.
// Référence : objects/obj_localPlayer et scripts scr_moveAndCollision, scr_aimHero, scr_dashCheck,
// scr_bumpCheck, scr_fire1Check du projet GameMaker de 2019.
import { stepWeapons } from './abilities.ts';
import { donorsOf, stepLink } from './link.ts';
import { stepUlti } from './ulti.ts';
import { CONFIG } from './config.ts';
import { BLOCK_MOVE, DEG, angleDiff, localToWorld, rotateToward } from './geom.ts';
import type { Hero, Input } from './types.ts';
import type { World } from './world.ts';

export function muzzlePosition(h: Hero): { x: number; y: number } {
  return localToWorld(h.x, h.y, h.angle, h.def.muzzle.x, h.def.muzzle.y);
}

/** Son de déploiement du héros. PetBot n'en a pas à lui : l'original lui donne celui de BatBot. */
export function deploySound(h: Hero): string {
  const name = h.def.kind === 'PetBot' ? 'batBot' : h.def.name.charAt(0).toLowerCase() + h.def.name.slice(1);
  return `snd_${name}_deploiement`;
}

export function stepHero(world: World, h: Hero, input: Input): void {
  h.sinceShot++;
  if (h.state === 'dead') {
    h.deadSteps++;
    h.moving = false;
    return;
  }
  if (h.arrivalSteps > 0) {
    // le véhicule de largage amène le robot, encore replié
    h.moving = false;
    if (--h.arrivalSteps === 0) world.emit({ type: 'deploy', sound: deploySound(h), hero: h.id });
    return;
  }
  if (h.deploySteps > 0) {
    // déploiement : le robot se déplie, immobile et intouchable
    h.deploySteps--;
    h.moving = false;
    return;
  }
  if (h.invuln > 0) h.invuln--;

  if (stepRevive(world, h, input)) {
    // le sauveteur ne bouge pas, ne tire pas et lâche la borne
    h.moving = false;
    h.dashing = false;
    h.charging = false;
    h.linkedOutlet = -1;
    h.state = 'standing';
    return;
  }
  if (stepUlti(world, h, input)) {
    // lancement ou exécution de l'ulti : rien d'autre
    h.moving = false;
    h.dashing = false;
    h.state = 'standing';
    return;
  }
  stepLink(world, h, input);
  stepOutlet(world, h, input);
  steerHero(world, h, input);

  // --- récupération du dash : +1 charge toutes les 2 s tant qu'il en manque ---
  if (h.dashCharges < h.def.dashCharges && h.dashRechargeTimer > 0 && --h.dashRechargeTimer === 0) {
    h.dashCharges++;
    if (h.dashCharges < h.def.dashCharges) h.dashRechargeTimer = CONFIG.hero.dashRechargeSteps;
  }

  stepEnergy(world, h);
  stepWeapons(world, h, input);

  // soin fractionnaire : +1 PV chaque fois qu'un point entier est accumulé
  if (h.healPool >= 1) {
    h.healPool = 0;
    if (h.hp < h.def.maxHealth) {
      h.hp++;
      world.stats.healed++;
      world.emit({ type: 'heal', x: h.x, y: h.y });
    }
  }

  if (h.state !== 'firing1' && h.state !== 'firing2') h.state = h.moving ? 'walking' : 'standing';
}

/**
 * Résurrection d'un coéquipier (scr_resurectAllie) : « utiliser » maintenu près d'un robot à terre, 3 énergies
 * dépensées par tiers du compte à rebours. Sa durée dépend du sauveteur : PetBot relève deux fois plus vite (GD-056). Relâcher annule ; l'énergie déjà dépensée est perdue.
 * Retourne true tant que le héros est occupé à relever quelqu'un.
 */
function stepRevive(world: World, h: Hero, input: Input): boolean {
  const cfg = CONFIG.revive;
  const reachable = (a: Hero): boolean => !a.gone && a.state === 'dead'
    && Math.hypot(a.x - h.x, a.y - h.y) <= cfg.range + h.def.radius + a.def.radius;
  let ally = h.reviving >= 0 ? world.heroes[h.reviving] ?? null : null;
  if (ally && (!input.use || h.bump || !reachable(ally))) ally = null;
  if (!ally && h.reviving < 0 && input.use && !h.bump && !h.dashing && h.energy >= cfg.energyCost) {
    // un seul sauveteur par robot à terre
    ally = world.heroes.find((a) => a !== h && reachable(a) && !world.heroes.some((o) => o !== h && o.reviving === a.id)) ?? null;
  }
  if (!ally) {
    h.reviving = -1;
    h.reviveSteps = 0;
    return false;
  }
  h.reviving = ally.id;
  h.reviveSteps++;
  h.energyPause = CONFIG.hero.energyPauseSteps;
  h.angle = rotateToward(h.angle, Math.atan2(ally.y - h.y, ally.x - h.x), h.def.rotateSpeedDeg * DEG);
  if (h.reviveSteps % Math.round(h.def.reviveSteps / cfg.energyCost) === 0 && h.energy > 0) {
    h.energy--;
    world.stats.energyUsed++;
  }
  if (h.reviveSteps >= h.def.reviveSteps) {
    world.raiseHero(ally, cfg.hp);
    world.emit({ type: 'revived', x: ally.x, y: ally.y });
    h.reviving = -1;
    h.reviveSteps = 0;
  }
  return true;
}

/**
 * Dash, visée et déplacement d'un step. Ne dépend que du héros, de son entrée et des collisions : le client
 * d'une partie en réseau l'utilise pour prédire son propre robot sans attendre le serveur (ADR-014).
 */
export function steerHero(world: World, h: Hero, input: Input): void {
  // GD-031 : aucun tir n'immobilise le robot ; le surplus d'énergie le rend plus rapide
  const canMove = !h.bump;
  const boost = 1 + CONFIG.hero.overchargeSpeedBonus * Math.max(0, h.energy - CONFIG.hero.naturalEnergy);
  const walkSpeed = h.def.walkSpeed * h.speedFactor * boost;

  // --- dash : il faut être en train de marcher (pas en train de tirer) ---
  const wantsMove = input.moveX !== 0 || input.moveY !== 0;
  if (input.dashPressed && h.state === 'walking' && wantsMove && h.dashCharges > 0 && !h.dashing && canMove) {
    const dir = Math.atan2(input.moveY, input.moveX);
    const dashSpeed = h.def.walkSpeed * CONFIG.hero.dashSpeedFactor;
    const aheadX = h.x + Math.cos(dir) * dashSpeed;
    const aheadY = h.y + Math.sin(dir) * dashSpeed;
    if (world.collision.circleFree(aheadX, aheadY, h.def.radius, BLOCK_MOVE)) {
      h.dashing = true;
      h.moveAngle = dir;
      h.targetX = h.x + Math.cos(dir) * CONFIG.hero.dashDistance;
      h.targetY = h.y + Math.sin(dir) * CONFIG.hero.dashDistance;
      h.dashCharges--;
      h.dashRechargeTimer = CONFIG.hero.dashRechargeSteps;
    }
  }

  // --- visée : le bout du canon, et non le centre du héros, pointe vers le curseur ---
  if (!h.dashing && !h.bump) {
    const toMouse = Math.atan2(input.aimY - h.y, input.aimX - h.x);
    const aimRange = Math.hypot(input.aimX - h.x, input.aimY - h.y) + 150;
    const farX = h.x + Math.cos(toMouse) * aimRange;
    const farY = h.y + Math.sin(toMouse) * aimRange;
    const muzzle = localToWorld(h.x, h.y, toMouse, h.def.muzzle.x, h.def.muzzle.y);
    const requested = Math.atan2(farY - muzzle.y, farX - muzzle.x);
    h.angle = rotateToward(h.angle, requested, h.def.rotateSpeedDeg * DEG);
  }

  // --- déplacement ---
  h.moving = false;
  if (h.dashing || h.bump) {
    const speed = h.dashing ? h.def.walkSpeed * CONFIG.hero.dashSpeedFactor : CONFIG.hero.bumpSpeed;
    const dist = Math.hypot(h.targetX - h.x, h.targetY - h.y);
    const dir = Math.atan2(h.targetY - h.y, h.targetX - h.x);
    const blocked = moveHero(world, h, dir, Math.min(speed, dist), false);
    if (blocked || dist - speed <= 2) {
      h.dashing = false;
      h.bump = false;
    }
  } else if (canMove && wantsMove) {
    h.moveAngle = Math.atan2(input.moveY, input.moveX);
    moveHero(world, h, h.moveAngle, walkSpeed, true);
    h.moving = true;
    h.walkDist += walkSpeed;
  }
  const clamped = world.clampToRoom(h.x, h.y, CONFIG.hero.roomMargin);
  if (clamped.x !== h.x || clamped.y !== h.y) {
    h.x = clamped.x;
    h.y = clamped.y;
    h.dashing = false;
    h.bump = false;
  }
  separateHero(world, h);
}

/**
 * Collision légère entre héros (GD-041) : deux robots qui se chevauchent s'écartent doucement. Rien ne
 * bloque : on peut se croiser dans un couloir, et un dash traverse un coéquipier.
 */
function separateHero(world: World, h: Hero): void {
  if (h.dashing || h.bump) return;
  for (const o of world.heroes) {
    if (o === h || o.gone || o.state === 'dead' || o.dashing || o.arrivalSteps > 0) continue;
    const min = (h.def.radius + o.def.radius) * CONFIG.hero.teamSpacing;
    const dx = h.x - o.x;
    const dy = h.y - o.y;
    const d = Math.hypot(dx, dy);
    if (d >= min) continue;
    // exactement superposés : chacun part de son côté, selon son rang
    const ux = d > 0.01 ? dx / d : h.id < o.id ? -1 : 1;
    const uy = d > 0.01 ? dy / d : 0;
    const push = Math.min(CONFIG.hero.teamPushSpeed, (min - d) / 2);
    const res = world.collision.resolveCircle(h.x + ux * push, h.y + uy * push, h.def.radius, BLOCK_MOVE);
    h.x = res.x;
    h.y = res.y;
  }
}

/** Déplace le héros en glissant le long des obstacles. Retourne true s'il a heurté le décor. */
function moveHero(world: World, h: Hero, dir: number, distance: number, collideWithNpcs: boolean): boolean {
  let hit = false;
  // sous-pas : jamais plus d'un demi-rayon à la fois, pour ne pas traverser un mur fin
  const steps = Math.max(1, Math.ceil(distance / (h.def.radius / 2)));
  const dx = (Math.cos(dir) * distance) / steps;
  const dy = (Math.sin(dir) * distance) / steps;
  for (let i = 0; i < steps; i++) {
    const res = world.collision.resolveCircle(h.x + dx, h.y + dy, h.def.radius, BLOCK_MOVE);
    h.x = res.x;
    h.y = res.y;
    if (res.hit) hit = true;
  }
  if (collideWithNpcs) {
    // les PNJ font obstacle à la marche (un dash les traverse, comme dans l'original)
    for (const npc of world.npcs) {
      const min = h.def.radius + npc.def.radius * 0.8;
      const ox = h.x - npc.x;
      const oy = h.y - npc.y;
      const d = Math.hypot(ox, oy);
      if (d < min && d > 0.001) {
        const res = world.collision.resolveCircle(npc.x + (ox / d) * min, npc.y + (oy / d) * min, h.def.radius, BLOCK_MOVE);
        h.x = res.x;
        h.y = res.y;
      }
    }
  }
  return hit;
}

function stepEnergy(world: World, h: Hero): void {
  const natural = CONFIG.hero.naturalEnergy;
  if (h.overchargeHold > 0) h.overchargeHold--;
  // celui qui donne par un lien ne régénère rien pour lui : sa régénération part chez son coéquipier (GD-043)
  if (h.linkTo >= 0) {
    h.energyTimer = 0;
    return;
  }
  if (h.energy > natural) {
    // surplus : stable tant que le délai court ou qu'il est alimenté, puis décroissance lente (GD-029)
    if (h.overchargeHold > 0 || h.charging || donorsOf(world, h).length > 0) {
      h.energyTimer = 0;
    } else if (++h.energyTimer >= CONFIG.hero.overchargeDecaySteps) {
      h.energyTimer = 0;
      h.energy--;
    }
    return;
  }
  if (h.energyPause > 0) {
    h.energyPause--;
    h.energyTimer = 0;
    return;
  }
  if (h.energy === natural) {
    h.energyTimer = 0;
    return;
  }
  if (++h.energyTimer >= CONFIG.hero.energyTickSteps) {
    h.energyTimer = 0;
    h.energy++;
  }
}

/**
 * Bornes de recharge (GD-006, GD-029). Un appui sur « utiliser » relie le robot à la borne ; il reste libre
 * de bouger et de tirer dans son rayon. La borne donne de l'énergie et répare, jusqu'à épuisement de sa réserve.
 */
function stepOutlet(world: World, h: Hero, input: Input): void {
  const cfg = CONFIG.outlet;
  let outlet = world.outlets.find((o) => o.id === h.linkedOutlet) ?? null;
  const useful = (o: typeof outlet): boolean => !!o
    && ((o.energyLeft > 0 && h.energy < CONFIG.hero.maxEnergy) || (o.repairLeft > 0 && h.hp < h.def.maxHealth));

  if (outlet) {
    // le lien casse si on s'éloigne, si un mur s'interpose, si la borne n'a plus rien à donner, ou sur un nouvel appui
    const far = Math.hypot(outlet.x - h.x, outlet.y - h.y) > cfg.range || world.sightBlocked(outlet.x, outlet.y, h.x, h.y);
    if (far || h.bump || !useful(outlet) || input.usePressed) outlet = null;
  } else if (input.usePressed && !h.bump) {
    const near = world.nearestOutlet(cfg.range, h);
    if (useful(near)) outlet = near;
  }

  if (!outlet) {
    if (h.charging && h.energy > CONFIG.hero.naturalEnergy) h.overchargeHold = CONFIG.hero.overchargeHoldSteps;
    h.charging = false;
    h.linkedOutlet = -1;
    h.chargeTimer = 0;
    h.repairTimer = 0;
    return;
  }
  h.charging = true;
  h.linkedOutlet = outlet.id;
  outlet.inUse = true;
  if (outlet.energyLeft > 0 && h.energy < CONFIG.hero.maxEnergy && ++h.chargeTimer >= cfg.stepsPerEnergy) {
    h.chargeTimer = 0;
    h.energy++;
    outlet.energyLeft--;
    world.emit({ type: 'outletTick', x: outlet.x, y: outlet.y });
  }
  if (outlet.repairLeft > 0 && h.hp < h.def.maxHealth && ++h.repairTimer >= cfg.stepsPerRepair) {
    h.repairTimer = 0;
    h.hp++;
    outlet.repairLeft--;
    world.stats.healed++;
    world.emit({ type: 'heal', x: h.x, y: h.y });
  }
  if (outlet.energyLeft === 0 && outlet.repairLeft === 0) world.emit({ type: 'outletEmpty', x: outlet.x, y: outlet.y });
}

/** Le héros regarde-t-il à peu près vers ce point ? (utile à l'affichage) */
export function heroFacing(h: Hero, x: number, y: number, tolerance: number): boolean {
  return Math.abs(angleDiff(h.angle, Math.atan2(y - h.y, x - h.x))) <= tolerance;
}
