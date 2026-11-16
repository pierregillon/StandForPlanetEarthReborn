// Logique du héros : déplacement, visée, dash, tir principal, rechargement, énergie, prises de courant.
// Référence : objects/obj_localPlayer et scripts scr_moveAndCollision, scr_aimHero, scr_dashCheck,
// scr_bumpCheck, scr_fire1Check du projet GameMaker de 2019.
import { stepWeapons } from './abilities.ts';
import { CONFIG } from './config.ts';
import { BLOCK_MOVE, DEG, angleDiff, localToWorld, rotateToward } from './geom.ts';
import type { Hero, Input } from './types.ts';
import type { World } from './world.ts';

export function muzzlePosition(h: Hero): { x: number; y: number } {
  return localToWorld(h.x, h.y, h.angle, h.def.muzzle.x, h.def.muzzle.y);
}

export function stepHero(world: World, input: Input): void {
  const h = world.hero;
  h.sinceShot++;
  if (h.state === 'dead') {
    h.deadSteps++;
    h.moving = false;
    return;
  }
  if (h.deploySteps > 0) {
    // déploiement : le robot se déplie, immobile et intouchable
    h.deploySteps--;
    h.moving = false;
    return;
  }
  if (h.invuln > 0) h.invuln--;

  stepOutlet(world, h, input);
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

  // --- récupération du dash : +1 charge toutes les 2 s tant qu'il en manque ---
  if (h.dashCharges < CONFIG.hero.dashCharges && h.dashRechargeTimer > 0 && --h.dashRechargeTimer === 0) {
    h.dashCharges++;
    if (h.dashCharges < CONFIG.hero.dashCharges) h.dashRechargeTimer = CONFIG.hero.dashRechargeSteps;
  }

  stepEnergy(h);
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

function stepEnergy(h: Hero): void {
  const natural = CONFIG.hero.naturalEnergy;
  if (h.overchargeHold > 0) h.overchargeHold--;
  if (h.energy > natural) {
    // surplus : stable tant que le délai court, puis décroissance lente (GD-029)
    if (h.overchargeHold > 0 || h.charging) {
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
  for (const o of world.outlets) o.inUse = false;
  let outlet = world.outlets.find((o) => o.id === h.linkedOutlet) ?? null;
  const useful = (o: typeof outlet): boolean => !!o
    && ((o.energyLeft > 0 && h.energy < CONFIG.hero.maxEnergy) || (o.repairLeft > 0 && h.hp < h.def.maxHealth));

  if (outlet) {
    // le lien casse si on s'éloigne, si un mur s'interpose, si la borne n'a plus rien à donner, ou sur un nouvel appui
    const far = Math.hypot(outlet.x - h.x, outlet.y - h.y) > cfg.range || world.sightBlocked(outlet.x, outlet.y, h.x, h.y);
    if (far || h.bump || !useful(outlet) || input.usePressed) outlet = null;
  } else if (input.usePressed && !h.bump) {
    const near = world.nearestOutlet(cfg.range);
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
