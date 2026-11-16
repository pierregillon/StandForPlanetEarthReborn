// Tirs des quatre héros (principal et secondaire) et objets qu'ils créent : drones, explosions,
// tourelle, battes. Référence : scr_fire1Check, scr_PetBot_fire2Check, scr_EngiBot_fire2Check,
// scr_fire1CheckBatBot, scr_fire2CheckBatBot, scr_fire1CheckBadaBot, scr_fire2CheckBadaBot et les objets
// obj_PetDrone, obj_explosion_parent, obj_turret_EngiBot, obj_bullet_batte_parent du projet de 2019.
import { CONFIG, STEPS_PER_SECOND } from './config.ts';
import {
  BLOCK_BULLET, BLOCK_MOVE, DEG, IS_WINDOW, angleDiff, boxNormal, distanceToRect, localToWorld, reflectAngle,
  rotateToward, segmentCircle,
} from './geom.ts';
import type { Bat, Drone, Explosion, Hero, Input, Npc, Turret, WindowPane } from './types.ts';
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
  if (npc.def.kind !== 'soldier' || !npc.def.frontShield) return false;
  const toSource = Math.atan2(fromY - npc.y, fromX - npc.x);
  return Math.abs(angleDiff(npc.angle, toSource)) < SHIELD_ARC;
}

// ---------- Boucle des tirs du héros ----------

export function stepWeapons(world: World, h: Hero, input: Input): void {
  if (h.def.magazine > 0) {
    if (h.reloadTimer > 0) {
      if (--h.reloadTimer === 0) {
        h.ammo = h.def.magazine;
        world.emit({ type: 'reloadEnd' });
      }
    } else if (input.reloadPressed && h.ammo < h.def.magazine && h.charge === 0) {
      h.reloadTimer = h.def.reloadSteps;
      world.emit({ type: 'reloadStart' });
    }
  }
  if (h.fireTimer > 0) h.fireTimer--;
  if (h.fire2Timer > 0) h.fire2Timer--;
  const busy = h.dashing || h.bump || h.charging;
  switch (h.def.kind) {
    case 'PetBot':
      standardFire1(world, h, input, busy);
      petBotFire2(world, h, input, busy);
      break;
    case 'EngiBot':
      standardFire1(world, h, input, busy);
      engiBotFire2(world, h, input, busy);
      break;
    case 'BatBot':
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
    world.fireBullet(h.def.bullet, 'hero', h.x, h.y, m.x, m.y, h.angle + spread);
  }
  playOneOf(world, h.def.sounds.fire1, h.x, h.y);
  h.ammo -= count;
  world.stats.ammoUsed += count;
  h.sinceShot = 0;
}

function emptyClick(world: World, h: Hero): void {
  h.fireTimer = Math.round(STEPS_PER_SECOND / h.def.shotsPerSecond);
  world.emit({ type: 'emptyClick' });
}

/** Tir principal de PetBot et d'EngiBot : une balle par intervalle tant que le clic est maintenu. */
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

// ---------- PetBot : salve de drones ----------

function petBotFire2(world: World, h: Hero, input: Input, busy: boolean): void {
  if (!input.fire2 || busy || h.energy < A.petBot.energyCost) return;
  const level = Math.min(4, Math.floor(h.energy / 3));
  for (const range of A.petBot.droneRanges) {
    const angle = h.angle + world.rng.int(-A.petBot.droneSpreadDeg, A.petBot.droneSpreadDeg) * DEG;
    world.drones.push({ id: world.newId(), x: h.x, y: h.y, angle, speed: 0, range, level, startX: h.x, startY: h.y });
  }
  spendEnergy(world, h, h.energy); // la salve consomme toute l'énergie
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
  if (glass) world.breakWindow(glass.obstacle.owner as WindowPane);
}

// ---------- Explosions ----------

function spriteFps(info: { speed: number; speedType: number }): number {
  return info.speedType === 0 ? info.speed : info.speed * STEPS_PER_SECOND;
}

function stepExplosions(world: World): void {
  const hero = world.hero;
  for (let i = world.explosions.length - 1; i >= 0; i--) {
    const e = world.explosions[i];
    for (const npc of world.npcs) {
      if (e.hit.has(npc.id)) continue;
      if (Math.hypot(npc.x - e.x, npc.y - e.y) > e.radius + npc.def.radius) continue;
      if (world.sightBlocked(e.x, e.y, npc.x, npc.y)) continue;
      e.hit.add(npc.id);
      if (!blockedByFrontShield(npc, e.x, e.y)) npc.hp -= e.damage;
    }
    if (e.healFromStep >= 0 && e.step >= e.healFromStep && hero.state !== 'dead' && hero.hp < hero.def.maxHealth
      && Math.hypot(hero.x - e.x, hero.y - e.y) <= e.radius + hero.def.radius) {
      hero.healPool += A.petBot.healPerStep;
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
      const level = Math.min(4, Math.floor(h.energy / 3));
      if (level >= 1) {
        world.turret = {
          id: world.newId(), x: m.x, y: m.y, angle: h.angle, moveAngle: h.angle + world.rng.range(-1, 1) * DEG,
          speed: A.engiBot.turretThrowSpeed, state: 'flying', level, timer: 0, fireTimer: 0,
        };
        spendEnergy(world, h, level * 3); // toutes les barres pleines sont consommées
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
    if (npc.def.kind !== 'soldier') continue;
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
  const level = batThrowLevel(h.energy);
  if (h.energy < level || h.fire2Timer > 0 || busy) return;
  const side = h.bats >= 2 ? 'd' : 'g';
  const m = muzzle(h);
  const angle = h.angle + world.rng.range(-h.def.precisionDeg, h.def.precisionDeg) * DEG;
  world.bats.push({ id: world.newId(), x: m.x, y: m.y, angle, side, level, state: 'flying', startX: m.x, startY: m.y, hit: new Set(), steps: 0 });
  h.swing = side;
  h.fire2Timer = h.def.fire2CooldownSteps;
  h.fire2Anim = 0;
  h.state = 'firing2';
  h.bats--;
  spendEnergy(world, h, level);
  playOneOf(world, h.def.sounds.fire2, h.x, h.y);
}

/** Rappelle les battes au sol : coûte 1 énergie, seulement s'il y en a une à rappeler. */
function recallBats(world: World, h: Hero): void {
  const grounded = world.bats.filter((b) => b.state === 'stopped');
  if (h.energy < A.batBot.recallCost || grounded.length === 0) return;
  for (const b of grounded) {
    b.state = 'returning';
    b.hit = new Set();
  }
  spendEnergy(world, h, A.batBot.recallCost);
}

function stepBats(world: World): void {
  const h = world.hero;
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
  if (lvl.explosionRadius > 0) {
    world.addExplosion({
      x: b.x, y: b.y, sprite: 'spr_bullet2_explosion', radius: lvl.explosionRadius, damage: lvl.explosionDamage, healFromStep: -1,
      scale: (lvl.explosionRadius * 2) / world.sprite('spr_bullet2_explosion').w,
    });
    world.emit({ type: 'sound', name: 'snd_batBot_fire2_souffle', x: b.x, y: b.y });
  }
}

function flyBat(world: World, b: Bat): void {
  const lvl = A.batBot.levels[b.level - 1];
  const speed = world.hero.def.bullet.speed;
  const nx = b.x + Math.cos(b.angle) * speed;
  const ny = b.y + Math.sin(b.angle) * speed;
  breakWindows(world, b.x, b.y, nx, ny);
  const wall = world.collision.raycast(b.x, b.y, nx, ny, BLOCK_BULLET);
  let limit = wall ? wall.t : 2;
  let target: Npc | null = null;
  for (const npc of world.npcs) {
    if (b.hit.has(npc.id)) continue;
    const t = segmentCircle(b.x, b.y, nx, ny, npc.x, npc.y, npc.def.radius + world.hero.def.bullet.radius);
    if (t >= 0 && t < limit) {
      if (lvl.pierce) {
        // batte perçante : traverse en blessant, explose seulement à l'arrêt (GD-023)
        b.hit.add(npc.id);
        if (!blockedByFrontShield(npc, b.x, b.y)) npc.hp -= world.hero.def.bullet.damage;
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
    if (lvl.explosionRadius === 0 && !blockedByFrontShield(target, b.startX, b.startY)) target.hp -= world.hero.def.bullet.damage;
    world.emit({ type: 'impact', x: b.x, y: b.y, angle: b.angle, surface: 'npc' });
    stopBat(world, b);
  } else if (wall && limit <= 1) {
    // recule un peu pour ne pas rester dans le mur
    b.x -= Math.cos(b.angle) * 24;
    b.y -= Math.sin(b.angle) * 24;
    world.emit({ type: 'sound', name: `snd_batBot_hitMur${world.rng.int(1, 2)}`, x: b.x, y: b.y });
    world.emit({ type: 'impact', x: b.x, y: b.y, angle: b.angle, surface: 'wall' });
    stopBat(world, b);
  } else if (Math.hypot(b.x - b.startX, b.y - b.startY) >= world.hero.def.bullet.maxDistance
    || b.x < 70 || b.y < 70 || b.x > world.width - 70 || b.y > world.height - 70) {
    stopBat(world, b);
  }
}

/** Batte rappelée : vole vers le BatBot en ignorant les murs et blesse les PNJ croisés. */
function returnBat(world: World, b: Bat, h: Hero): void {
  const speed = h.def.bullet.speed;
  b.angle = Math.atan2(h.y - b.y, h.x - b.x);
  const nx = b.x + Math.cos(b.angle) * speed;
  const ny = b.y + Math.sin(b.angle) * speed;
  for (const npc of world.npcs) {
    if (b.hit.has(npc.id)) continue;
    if (segmentCircle(b.x, b.y, nx, ny, npc.x, npc.y, npc.def.radius + h.def.bullet.radius) < 0) continue;
    b.hit.add(npc.id);
    if (!blockedByFrontShield(npc, b.x, b.y)) npc.hp -= h.def.bullet.damage;
    world.emit({ type: 'impact', x: npc.x, y: npc.y, angle: b.angle, surface: 'npc' });
  }
  b.x = nx;
  b.y = ny;
}

// ---------- BadaBot : plasma chargé, bouclier ----------

function badaBotFire1(world: World, h: Hero, input: Input, busy: boolean): void {
  if (h.state === 'firing1' && h.fireTimer === 0) h.state = 'standing';
  const ready = h.fireTimer === 0 && !busy && h.reloadTimer === 0;
  if (input.fire1 && ready && h.ammo > 0) {
    h.charge = Math.min(A.badaBot.fullChargeSteps, h.charge + 1);
    return;
  }
  if (input.fire1 && ready && h.ammo === 0) emptyClick(world, h);
  if (h.charge === 0) return;
  if (!input.fire1 && ready) {
    // relâchement : 1 à 3 boules selon la charge, de moins en moins précises
    const tier = Math.floor((h.charge - 1) / A.badaBot.chargePerBall);
    const balls = Math.min(1 + tier, h.ammo); // l'original pouvait descendre sous zéro munition
    shoot(world, h, balls, h.def.precisionDeg + tier * A.badaBot.precisionPerBallDeg);
    h.fireTimer = Math.round(STEPS_PER_SECOND / h.def.shotsPerSecond);
    if (h.state !== 'firing2') h.state = 'firing1';
  }
  h.charge = 0;
}

function badaBotFire2(world: World, h: Hero, input: Input): void {
  const want = input.fire2 && h.energy > 0 && !h.dashing && !h.bump && !h.charging;
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

/** Le bouclier encaisse une balle : toutes les 3 balles, il coûte 1 énergie. */
export function shieldTank(world: World, h: Hero): void {
  if (++h.tanked >= A.badaBot.bulletsPerEnergy) {
    h.tanked = 0;
    h.energy = Math.max(0, h.energy - 1);
    world.stats.energyUsed++;
  }
}

// ---------- Boucle des objets créés par les héros ----------

export function stepAbilityObjects(world: World): void {
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
