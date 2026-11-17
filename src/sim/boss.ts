// Boss SallyBot : corps à corps, charge, deux phases. Référence : objects/obj_sallyBot, obj_sallyBot_hitBox,
// scripts scr_setBossBehaviourActions, scr_getBossBehaviour1/2, scr_setBossAction1/2 du projet de 2019
// (docs/reference/jeu-original/02-ennemis-et-ia.md, §6). Le boss est un PNJ de la liste world.npcs : il reçoit
// donc les dégâts comme les autres ; son invulnérabilité est appliquée ici (GD-028).
import { CONFIG, STEPS_PER_SECOND } from './config.ts';
import { BLOCK_MOVE, DEG, distanceToRect, rotateToward } from './geom.ts';
import type { Point } from './nav.ts';
import type { Hero, Npc } from './types.ts';
import type { World } from './world.ts';

const B = CONFIG.boss;

export type BossAction = 'idle' | 'walking' | 'attack' | 'charge' | 'transform' | 'breathing';

export interface BossState {
  npc: Npc;
  phase: 1 | 2;
  action: BossAction;
  /** Sprite de l'action en cours et steps écoulés depuis son début (pour l'affichage). */
  sprite: string;
  anim: number;
  animSteps: number;
  combo: number;
  hitDone: boolean;
  engaged: boolean;
  transformed: boolean;
  /** Steps d'attaque ou de charge cumulés en phase 2 : à 180, le boss doit « respirer ». */
  fatigue: number;
  invulnerable: boolean;
  /** Points de vie à la fin du step précédent : restaurés si le boss était invulnérable. */
  guardedHp: number;
  path: Point[] | null;
  pathIdx: number;
  repathTimer: number;
  /** Le boss est déjà apparu à l'écran : sa barre de vie reste affichée. */
  seen: boolean;
  /** Points de vie de départ et vitesse de marche : ils dépendent du nombre de joueurs (GD-054). */
  maxHp: number;
  speed: number;
  /** Rang du héros visé par la charge en cours, -1 hors charge : le boss vise alors le plus proche. */
  target: number;
}

/** `players` : nombre de joueurs à l'entrée dans la salle. Le boss ne faiblit pas si l'un d'eux quitte la partie. */
export function createBoss(npc: Npc, players = 1): BossState {
  const extra = Math.max(0, players - 1);
  npc.hp = npc.def.maxHealth + B.healthPerExtraPlayer * extra;
  return {
    npc, phase: 1, action: 'idle', sprite: B.sprites.stand1, anim: 0, animSteps: 0, combo: 0, hitDone: false,
    engaged: false, transformed: false, fatigue: 0, invulnerable: false, guardedHp: npc.hp, path: null, pathIdx: 0,
    repathTimer: 0, seen: false, maxHp: npc.hp, speed: B.speed + B.speedPerExtraPlayer * extra, target: -1,
  };
}

function animSteps(world: World, sprite: string): number {
  const info = world.sprite(sprite);
  const fps = info.speedType === 0 ? info.speed : info.speed * STEPS_PER_SECOND;
  return Math.max(1, Math.round((info.frames / fps) * STEPS_PER_SECOND));
}

function start(world: World, b: BossState, action: BossAction, sprite: string): void {
  b.action = action;
  b.sprite = sprite;
  b.anim = 0;
  b.animSteps = animSteps(world, sprite);
  b.hitDone = false;
  if (action !== 'charge') b.target = -1;
}

/** À appeler avant le test de mort : annule les dégâts reçus pendant que le boss était invulnérable. */
export function guardBoss(b: BossState): void {
  if (b.invulnerable && b.npc.hp < b.guardedHp) b.npc.hp = b.guardedHp;
}

/** Proie du boss : le héros debout le plus proche (à défaut, le premier de l'équipe, à terre). */
function prey(world: World, npc: Npc): Hero {
  return world.nearestHero(npc.x, npc.y) ?? world.heroes[0];
}

/**
 * Cible d'une charge (GD-054) : un héros au hasard parmi ceux que le boss voit, pour que ceux qui tirent de
 * loin ne soient pas à l'abri pendant qu'un coéquipier l'occupe au contact. Seul en vue, c'est lui ; personne
 * en vue, -1 : le boss charge le plus proche, comme avant.
 */
function chargeTarget(world: World, npc: Npc): number {
  const seen = world.living().filter((h) => !world.sightBlocked(npc.x, npc.y, h.x, h.y));
  if (seen.length === 0) return -1;
  // le hasard n'est consulté qu'à plusieurs : un joueur seul garde exactement le même combat
  return seen.length === 1 ? seen[0].id : seen[world.rng.int(0, seen.length - 1)].id;
}

export function stepBoss(world: World, b: BossState): void {
  const npc = b.npc;
  // en pleine charge, il garde la cible qu'il s'est choisie tant qu'elle est debout
  const chosen = b.action === 'charge' ? world.heroes[b.target] : undefined;
  const h = chosen && !chosen.gone && chosen.state !== 'dead' ? chosen : prey(world, npc);
  const dx = h.x - npc.x;
  const dy = h.y - npc.y;
  const edge = Math.hypot(dx, dy) - npc.def.radius - h.def.radius;
  const toHero = Math.atan2(dy, dx);
  if (!b.engaged) {
    const provoked = npc.hp < b.maxHp || world.drills.some((d) => d.hp < d.maxHp);
    if (h.state === 'dead' || (edge > B.aggroRange && !provoked)) return finish(b);
    b.engaged = true;
  }
  b.anim++;
  if (b.repathTimer > 0) b.repathTimer--;

  // passage en phase 2 à la moitié des points de vie : transformation, pendant laquelle il reste vulnérable
  if (b.phase === 1 && npc.hp <= b.maxHp / 2 && b.action !== 'charge') {
    b.phase = 2;
    start(world, b, 'transform', B.sprites.transform);
  }

  const turn = B.rotateDeg * DEG;
  switch (b.action) {
    case 'transform':
      if (b.anim >= b.animSteps) {
        b.transformed = true;
        start(world, b, 'idle', B.sprites.stand2);
      }
      break;
    case 'breathing':
      if (b.anim >= b.animSteps) {
        b.fatigue = 0;
        start(world, b, 'idle', B.sprites.stand2);
      }
      break;
    case 'attack': {
      npc.angle = rotateToward(npc.angle, toHero, turn);
      const attack = b.phase === 1 ? B.combo[b.combo] : B.attack2;
      const t = b.anim / b.animSteps;
      // le coup touche tous les héros pris dans sa zone
      const struck = !b.hitDone && t >= B.hitWindow[0] && t <= B.hitWindow[1] ? heroesInBox(world, npc, attack.box) : [];
      if (struck.length > 0) {
        b.hitDone = true;
        for (const victim of struck) world.damageHero(victim, attack.damage);
      }
      if (b.phase === 2) b.fatigue++;
      if (b.anim >= b.animSteps) {
        if (b.phase === 1) b.combo = (b.combo + 1) % B.combo.length;
        decide(world, b, edge, true);
      }
      break;
    }
    case 'charge': {
      npc.angle = rotateToward(npc.angle, toHero, turn);
      const info = world.sprite(b.sprite);
      const frame = (b.anim / b.animSteps) * info.frames;
      if (frame >= B.chargeMoveFromFrame) {
        // il percute le premier héros sur sa route, sa cible ou un autre, et s'arrête contre lui
        const bumped = world.living().find((o) => Math.hypot(o.x - npc.x, o.y - npc.y) - npc.def.radius - o.def.radius <= 4);
        const touching = bumped !== undefined;
        if (bumped && !b.hitDone) {
          b.hitDone = true;
          world.damageHero(bumped, B.chargeDamage);
        }
        const nx = npc.x + Math.cos(npc.angle) * B.chargeSpeed;
        const ny = npc.y + Math.sin(npc.angle) * B.chargeSpeed;
        if (!touching && world.collision.circleFree(nx, ny, npc.def.radius * 0.6, BLOCK_MOVE)) {
          npc.x = nx;
          npc.y = ny;
        }
      }
      if (b.phase === 2) b.fatigue++;
      if (b.anim >= b.animSteps) decide(world, b, edge, false);
      break;
    }
    default:
      decide(world, b, edge, false);
      if (b.action === 'walking') walk(world, b, toHero);
  }
  npc.dir = npc.angle;
  npc.state = b.action === 'walking' ? 'walking' : 'standing';
  finish(b);
}

function finish(b: BossState): void {
  // phase 1 : invulnérable pendant la charge ; phase 2 : vulnérable seulement transformation et respiration
  b.invulnerable = b.action === 'charge' || (b.phase === 2 && b.action !== 'transform' && b.action !== 'breathing');
  b.guardedHp = b.npc.hp;
}

function heroesInBox(world: World, npc: Npc, box: { x0: number; y0: number; x1: number; y1: number }): Hero[] {
  const c = Math.cos(npc.angle);
  const s = Math.sin(npc.angle);
  return world.living().filter((h) => {
    const dx = h.x - npc.x;
    const dy = h.y - npc.y;
    return distanceToRect(dx * c + dy * s, -dx * s + dy * c, box.x0, box.y0, box.x1, box.y1) <= h.def.radius;
  });
}

/** Choisit l'action suivante quand le boss est libre de ses mouvements. */
function decide(world: World, b: BossState, edge: number, wasAttacking: boolean): void {
  const standing = b.phase === 1 ? B.sprites.stand1 : B.sprites.stand2;
  if (world.living().length === 0) {
    if (b.action !== 'idle') start(world, b, 'idle', standing);
    return;
  }
  if (b.phase === 2 && b.fatigue >= B.breatheAfterSteps) {
    start(world, b, 'breathing', B.sprites.breathe);
    world.emit({ type: 'notify', text: 'SallyBot is out of breath!' });
    return;
  }
  // il enchaîne les coups tant que la cible reste proche, sinon il doit revenir au contact
  if (edge <= (wasAttacking ? B.keepAttackingRange : B.attackRange)) {
    b.path = null;
    start(world, b, 'attack', b.phase === 1 ? B.combo[b.combo].sprite : B.attack2.sprite);
    return;
  }
  if (b.action !== 'walking') {
    start(world, b, 'walking', b.phase === 1 ? B.sprites.walk1 : B.sprites.walk2);
    b.repathTimer = 0;
  }
  if (b.repathTimer > 0) return;
  b.repathTimer = B.repathSteps;
  if (world.rng.next() < B.chargeChance) {
    b.path = null;
    start(world, b, 'charge', b.phase === 1 ? B.sprites.charge1 : B.sprites.charge2);
    b.target = chargeTarget(world, b.npc);
    return;
  }
  const target = prey(world, b.npc);
  b.path = world.nav.findPath(b.npc.x, b.npc.y, target.x, target.y);
  b.pathIdx = 0;
}

function walk(world: World, b: BossState, toHero: number): void {
  const npc = b.npc;
  let target: Point = prey(world, npc);
  if (b.path && b.pathIdx < b.path.length) {
    target = b.path[b.pathIdx];
    if (Math.hypot(target.x - npc.x, target.y - npc.y) <= b.speed * 2) {
      b.pathIdx++;
      return;
    }
  }
  const dir = Math.atan2(target.y - npc.y, target.x - npc.x);
  const res = world.collision.resolveCircle(npc.x + Math.cos(dir) * b.speed, npc.y + Math.sin(dir) * b.speed, npc.def.radius * 0.6, BLOCK_MOVE);
  npc.walkDist += Math.hypot(res.x - npc.x, res.y - npc.y);
  npc.x = res.x;
  npc.y = res.y;
  npc.angle = rotateToward(npc.angle, toHero, B.rotateDeg * 2 * DEG);
}
