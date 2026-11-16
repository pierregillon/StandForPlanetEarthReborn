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
  if (h.invuln > 0) h.invuln--;

  stepOutlet(world, h, input);
  // BatBot reste immobile pendant l'animation de lancer (staticFire2 dans l'original)
  const throwing = h.def.kind === 'BatBot' && h.fire2Anim >= 0;
  const canMove = !h.bump && !h.charging && !throwing;
  const walkSpeed = h.def.walkSpeed * h.speedFactor;

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
    h.energy += h.energy < natural ? 1 : -1;
  }
}

/** Remake (GD-006) : maintenir « utiliser » près d'une prise recharge l'énergie au-delà du maximum naturel. */
function stepOutlet(world: World, h: Hero, input: Input): void {
  for (const o of world.outlets) o.inUse = false;
  const outlet = input.use && !h.dashing && !h.bump ? world.nearestOutlet(CONFIG.outlet.range) : null;
  if (!outlet || h.energy >= CONFIG.hero.maxEnergy) {
    h.charging = false;
    h.chargeTimer = 0;
    if (outlet) outlet.inUse = false;
    return;
  }
  h.charging = true;
  outlet.inUse = true;
  h.energyPause = CONFIG.hero.energyPauseSteps;
  if (++h.chargeTimer >= CONFIG.outlet.stepsPerEnergy) {
    h.chargeTimer = 0;
    h.energy++;
    world.emit({ type: 'outletTick', x: outlet.x, y: outlet.y });
  }
}

/** Le héros regarde-t-il à peu près vers ce point ? (utile à l'affichage) */
export function heroFacing(h: Hero, x: number, y: number, tolerance: number): boolean {
  return Math.abs(angleDiff(h.angle, Math.atan2(y - h.y, x - h.x))) <= tolerance;
}
