// État complet d'une salle en cours de jeu et boucle de simulation (60 steps par seconde).
// Ne dépend ni de Phaser ni du navigateur (ADR-005) : l'affichage lit cet état et consomme `events`.
import { CONFIG, STEPS_PER_SECOND } from './config.ts';
import type { BulletDef, HeroDef } from './config.ts';
import {
  BLOCK_BULLET, BLOCK_MOVE, BLOCK_SIGHT, BLOCK_SOUND, IS_WINDOW,
  CollisionWorld, Rng, angleDiff, clamp, gmAngleToRad, localToWorld, makeBox, segmentCircle,
} from './geom.ts';
import type { Obstacle } from './geom.ts';
import { NavGrid } from './nav.ts';
import { stepHero } from './hero.ts';
import { createNpc, stepNpcs } from './npc.ts';
import type {
  Bullet, Button, DecorItem, Door, Hero, Input, LevelData, LevelInstance, Npc, Outlet,
  SimEvent, SpriteInfo, SpriteManifest, Stats, WindowPane, Zone,
} from './types.ts';

const FALLBACK_SPRITE: SpriteInfo = {
  w: 64, h: 64, ox: 32, oy: 32, frames: 1, bbox: [0, 0, 63, 63], bboxmode: 0, colkind: 1, sepmasks: false, speed: 1, speedType: 1,
};

function isA(level: LevelData, object: string, ancestor: string): boolean {
  return object === ancestor || (level.objects[object]?.parents.includes(ancestor) ?? false);
}

export class World {
  readonly width: number;
  readonly height: number;
  readonly collision: CollisionWorld;
  readonly nav: NavGrid;
  readonly rng: Rng;
  readonly events: SimEvent[] = [];
  readonly stats: Stats = {
    totalCivil: 0, totalSoldier: 0, civilKilled: 0, soldierKilled: 0, damageTaken: 0, healed: 0, ammoUsed: 0, energyUsed: 0,
  };

  tick = 0;
  hero: Hero;
  npcs: Npc[] = [];
  bullets: Bullet[] = [];
  doors: Door[] = [];
  buttons: Button[] = [];
  windows: WindowPane[] = [];
  outlets: Outlet[] = [];
  zones: Zone[] = [];
  decor: DecorItem[] = [];
  /** Consigne affichée au joueur (GD-010). */
  objective = 'Go to the upper floor';
  private nextId = 1;

  readonly level: LevelData;
  readonly sprites: SpriteManifest;

  constructor(level: LevelData, sprites: SpriteManifest, heroName: string, seed = 1) {
    this.level = level;
    this.sprites = sprites;
    this.width = level.width;
    this.height = level.height;
    this.rng = new Rng(seed);
    this.collision = new CollisionWorld(level.width, level.height);
    this.nav = new NavGrid(level.width, level.height, CONFIG.nav.cellSize, CONFIG.nav.clearance, CONFIG.nav.maxExpansions);

    for (const [x, y, w, h, thick] of level.wallRects) {
      const flags = BLOCK_MOVE | BLOCK_BULLET | BLOCK_SIGHT | (thick ? BLOCK_SOUND : 0);
      const o = this.collision.add(makeBox(x + w / 2, y + h / 2, w / 2, h / 2, 0, flags));
      this.nav.mark(o, 1);
    }

    let spawn = { x: level.width / 2, y: level.height / 2 };
    for (const inst of level.instances) {
      if (inst.object === 'obj_spawn1' && Number(inst.props.spawnNumber ?? 1) === 1) spawn = { x: inst.x, y: inst.y };
      this.addInstance(inst);
    }
    this.hero = this.createHero(CONFIG.heroes[heroName], spawn.x, spawn.y);
  }

  sprite(name: string | null | undefined): SpriteInfo {
    return (name && this.sprites[name]) || FALLBACK_SPRITE;
  }

  /** Boîte de collision d'une instance, d'après la boîte englobante de son masque. */
  private instanceBox(inst: LevelInstance, spriteName: string | null, flags: number, owner: unknown = null): Obstacle {
    const sp = this.sprite(spriteName);
    const [l, t, r, b] = sp.bbox;
    const lcx = ((l + r + 1) / 2 - sp.ox) * inst.scaleX;
    const lcy = ((t + b + 1) / 2 - sp.oy) * inst.scaleY;
    const angle = gmAngleToRad(inst.angle);
    const c = localToWorld(inst.x, inst.y, angle, lcx, lcy);
    return makeBox(c.x, c.y, Math.abs((r - l + 1) * inst.scaleX) / 2, Math.abs((b - t + 1) * inst.scaleY) / 2, angle, flags, owner);
  }

  private addDecor(inst: LevelInstance, sprite: string, frame = 0): void {
    this.decor.push({
      sprite, x: inst.x, y: inst.y, angle: gmAngleToRad(inst.angle), scaleX: inst.scaleX, scaleY: inst.scaleY,
      tint: inst.tint, alpha: inst.alpha, depth: inst.depth, frame,
    });
  }

  private addInstance(inst: LevelInstance): void {
    const level = this.level;
    const info = level.objects[inst.object];
    if (!info) return;
    const spriteName = info.sprite;
    const maskName = info.mask ?? info.sprite;
    const angle = gmAngleToRad(inst.angle);

    if (isA(level, inst.object, 'obj_door_parent')) {
      this.addDoor(inst, spriteName ?? 'spr_door');
    } else if (inst.object === 'obj_fenetre') {
      const pane: WindowPane = {
        id: this.nextId++, x: inst.x, y: inst.y, angle, scaleX: inst.scaleX, scaleY: inst.scaleY,
        sprite: spriteName ?? 'spr_murEtFenetre', broken: false, obstacle: null as unknown as Obstacle,
      };
      pane.obstacle = this.collision.add(this.instanceBox(inst, maskName, BLOCK_MOVE | BLOCK_SIGHT | IS_WINDOW, pane));
      this.nav.mark(pane.obstacle, 1);
      this.windows.push(pane);
    } else if (inst.object === 'obj_button') {
      this.buttons.push({ x: inst.x, y: inst.y, angle, doorId: Number(inst.props.doorId ?? -1) });
      if (spriteName) this.addDecor(inst, spriteName);
    } else if (isA(level, inst.object, 'obj_localNpc')) {
      const def = CONFIG.npcs[inst.object];
      if (!def) return;
      const npc = createNpc(this, this.nextId++, inst, def);
      this.npcs.push(npc);
      if (def.kind === 'civil') this.stats.totalCivil++;
      else this.stats.totalSoldier++;
    } else if (inst.object === CONFIG.outlet.replacesObject) {
      this.outlets.push({ id: this.nextId++, x: inst.x, y: inst.y, inUse: false });
    } else if (inst.object === 'obj_nextRoom') {
      this.zones.push({ kind: 'stairs', x: inst.x, y: inst.y, radius: 160, sprite: spriteName ?? 'spr_teleporteur_waiting', active: false });
    } else if (isA(level, inst.object, 'obj_decor_base')) {
      // mobilier et autres obstacles fixes
      const bulletCrossed = inst.props.bulletCrossed === true;
      const o = this.collision.add(this.instanceBox(inst, maskName, BLOCK_MOVE | (bulletCrossed ? 0 : BLOCK_BULLET)));
      if (isA(level, inst.object, 'obj_mobilier_parent') || isA(level, inst.object, 'obj_mur_parent')) this.nav.mark(o, 1);
      if (spriteName && info.visible) this.addDecor(inst, spriteName);
    } else if (info.parents.length === 0 && spriteName && info.visible && DECOR_ONLY.test(inst.object)) {
      this.addDecor(inst, spriteName);
    }
  }

  private addDoor(inst: LevelInstance, sprite: string): void {
    const sp = this.sprite(sprite);
    const [l, t, r, b] = sp.bbox;
    const p = inst.props;
    const kind = p.automaticDoor === true ? 'auto' : isA(this.level, inst.object, 'obj_door_card_parent') ? 'card' : 'button';
    const door: Door = {
      id: this.nextId++, kind, sprite, x: inst.x, y: inst.y, angle: gmAngleToRad(inst.angle),
      scaleX: inst.scaleX, scaleY: inst.scaleY,
      halfLength: ((r - l + 1) * Math.abs(inst.scaleX)) / 2,
      halfThickness: ((b - t + 1) * Math.abs(inst.scaleY)) / 2,
      doorId: Number(p.doorId ?? -1),
      card: inst.object === 'obj_door_cardGreen' ? 'green' : inst.object === 'obj_door_cardPurple' ? 'purple' : null,
      detectionRange: Number(p.detectionRange ?? 200),
      openSteps: Math.max(1, Math.round(Number(p.openTime ?? 0.5) * STEPS_PER_SECOND)),
      closeSteps: Math.max(1, Math.round(Number(p.closeTime ?? 0.5) * STEPS_PER_SECOND)),
      stayOpenSteps: Math.round(Number(p.stayOpenTime ?? 1) * STEPS_PER_SECOND),
      blockedOpen: p.blockedOpen === true,
      phase: 'closed', progress: 0, stayTimer: 0,
      obstacle: null as unknown as Obstacle, inNav: false,
    };
    door.obstacle = this.collision.add(makeBox(door.x, door.y, door.halfLength, door.halfThickness, door.angle, BLOCK_MOVE | BLOCK_BULLET | BLOCK_SIGHT, door));
    if (kind !== 'auto') {
      this.nav.mark(door.obstacle, 1);
      door.inNav = true;
    }
    this.doors.push(door);
  }

  private createHero(def: HeroDef, x: number, y: number): Hero {
    return {
      def, x, y, angle: -Math.PI / 2, moveAngle: -Math.PI / 2, moving: false, state: 'standing',
      hp: def.maxHealth, energy: CONFIG.hero.naturalEnergy, energyTimer: 0, energyPause: 0,
      ammo: def.magazine, reloadTimer: 0, fireTimer: 0, sinceShot: 9999,
      dashCharges: CONFIG.hero.dashCharges, dashRechargeTimer: 0, dashing: false, bump: false, targetX: x, targetY: y,
      invuln: 0, walkDist: 0, deadSteps: 0, charging: false, chargeTimer: 0,
    };
  }

  emit(e: SimEvent): void {
    this.events.push(e);
  }

  /** Vide et retourne les événements produits depuis le dernier appel. */
  drainEvents(): SimEvent[] {
    return this.events.splice(0, this.events.length);
  }

  get gameOver(): boolean {
    return this.hero.state === 'dead' && this.hero.deadSteps >= CONFIG.hero.deathMenuDelaySteps;
  }

  step(input: Input): void {
    this.tick++;
    stepHero(this, input);
    this.stepButtons(input);
    stepNpcs(this);
    this.stepDoors();
    this.stepBullets();
    this.stepZones();
  }

  // ---------- Dégâts ----------

  /** Dégât infligé au héros. `ignoreInvuln` : le coup de bouclier passe outre l'invulnérabilité. */
  damageHero(amount: number, ignoreInvuln = false): boolean {
    const h = this.hero;
    if (h.hp <= 0 || h.state === 'dead') return false;
    if (h.invuln > 0 && !ignoreInvuln) return false;
    h.hp -= amount;
    this.stats.damageTaken += amount;
    h.invuln = this.rng.int(CONFIG.hero.invulnMinSteps, CONFIG.hero.invulnMaxSteps);
    this.emit({ type: 'heroHit', x: h.x, y: h.y });
    if (h.hp <= 0) {
      h.hp = 0;
      h.state = 'dead';
      h.energy = 0;
      h.dashing = false;
      h.bump = false;
      h.charging = false;
      h.deadSteps = 0;
      this.emit({ type: 'heroDead', x: h.x, y: h.y });
    }
    return true;
  }

  killNpc(npc: Npc): void {
    const i = this.npcs.indexOf(npc);
    if (i < 0) return;
    this.npcs.splice(i, 1);
    if (npc.def.kind === 'civil') this.stats.civilKilled++;
    else this.stats.soldierKilled++;
    this.emit({ type: 'sound', name: 'snd_human_explosion', x: npc.x, y: npc.y });
    this.emit({ type: 'npcDeath', x: npc.x, y: npc.y, angle: npc.angle, sprite: npc.def.sprites.dead, genre: npc.def.genre });
  }

  // ---------- Balles ----------

  /**
   * Tire une balle depuis le bout du canon d'un personnage placé en (fromX, fromY).
   * Si un mur sépare le personnage de son canon, la balle s'écrase dessus (GD-019).
   */
  fireBullet(def: BulletDef, owner: 'hero' | 'enemy', fromX: number, fromY: number, x: number, y: number, angle: number): void {
    const hit = this.collision.raycast(fromX, fromY, x, y, BLOCK_BULLET);
    if (hit) {
      this.emit({ type: 'impact', x: fromX + (x - fromX) * hit.t, y: fromY + (y - fromY) * hit.t, angle, surface: 'wall' });
      return;
    }
    this.spawnBullet(def, owner, x, y, angle);
  }

  spawnBullet(def: BulletDef, owner: 'hero' | 'enemy', x: number, y: number, angle: number): void {
    this.bullets.push({ id: this.nextId++, def, owner, x, y, angle, startX: x, startY: y });
  }

  private stepBullets(): void {
    const bullets = this.bullets;
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (this.stepBullet(bullets[i])) bullets.splice(i, 1);
    }
  }

  /** Avance une balle d'un step. Retourne true si elle disparaît. */
  private stepBullet(b: Bullet): boolean {
    const nx = b.x + Math.cos(b.angle) * b.def.speed;
    const ny = b.y + Math.sin(b.angle) * b.def.speed;
    const wall = this.collision.raycast(b.x, b.y, nx, ny, BLOCK_BULLET);
    let limit = wall ? wall.t : 2;

    // personnage touché avant le décor ?
    let target: Npc | null = null;
    let heroHit = false;
    if (b.owner === 'hero') {
      for (const npc of this.npcs) {
        const t = segmentCircle(b.x, b.y, nx, ny, npc.x, npc.y, npc.def.radius + b.def.radius);
        if (t >= 0 && t < limit) {
          limit = t;
          target = npc;
        }
      }
    } else if (this.hero.state !== 'dead') {
      const t = segmentCircle(b.x, b.y, nx, ny, this.hero.x, this.hero.y, this.hero.def.radius + b.def.radius);
      if (t >= 0 && t < limit) {
        limit = t;
        heroHit = true;
      }
    }

    // les vitres traversées avant l'impact se brisent, sans arrêter la balle
    const end = Math.min(limit, 1);
    const glass = this.collision.raycast(b.x, b.y, b.x + (nx - b.x) * end, b.y + (ny - b.y) * end, IS_WINDOW);
    if (glass) this.breakWindow(glass.obstacle.owner as WindowPane);

    const hx = b.x + (nx - b.x) * end;
    const hy = b.y + (ny - b.y) * end;
    if (target) {
      this.bulletHitsNpc(b, target, hx, hy);
      return true;
    }
    if (heroHit) {
      this.damageHero(b.def.damage);
      return true;
    }
    if (wall) {
      this.emit({ type: 'impact', x: hx, y: hy, angle: b.angle, surface: 'wall' });
      return true;
    }
    b.x = nx;
    b.y = ny;
    if (Math.hypot(b.x - b.startX, b.y - b.startY) > b.def.maxDistance) return true;
    return b.x < 0 || b.y < 0 || b.x > this.width || b.y > this.height;
  }

  private bulletHitsNpc(b: Bullet, npc: Npc, hx: number, hy: number): void {
    if (npc.def.kind === 'soldier' && npc.def.frontShield) {
      // dégâts seulement si l'impact vient de l'arrière (cône de ±40°)
      const toBullet = Math.atan2(b.y - npc.y, b.x - npc.x);
      if (Math.abs(angleDiff(npc.angle, toBullet)) <= (140 * Math.PI) / 180) {
        this.emit({ type: 'impact', x: hx, y: hy, angle: b.angle, surface: 'shield' });
        return;
      }
    }
    this.emit({ type: 'impact', x: hx, y: hy, angle: b.angle, surface: 'npc' });
    npc.hp -= b.def.damage;
  }

  breakWindow(pane: WindowPane): void {
    if (pane.broken) return;
    pane.broken = true;
    // une vitre brisée continue de bloquer le passage et la vue, comme dans l'original
    pane.obstacle.flags &= ~IS_WINDOW;
    this.emit({ type: 'windowBroken', id: pane.id, x: pane.obstacle.cx, y: pane.obstacle.cy });
  }

  // ---------- Portes et boutons ----------

  private someoneNear(x: number, y: number, range: number): boolean {
    const h = this.hero;
    if (h.state !== 'dead' && Math.hypot(h.x - x, h.y - y) <= range + h.def.radius) return true;
    for (const npc of this.npcs) {
      if (npc.active && Math.hypot(npc.x - x, npc.y - y) <= range + npc.def.radius) return true;
    }
    return false;
  }

  openDoor(door: Door): void {
    if (door.phase === 'closed' || door.phase === 'closing') door.phase = 'opening';
  }

  private stepDoors(): void {
    for (const door of this.doors) {
      const before = door.progress;
      if (this.someoneNear(door.x, door.y, door.detectionRange)) {
        if (door.kind === 'auto' && door.phase === 'closed') door.phase = 'opening';
        else if (door.phase === 'open') door.stayTimer = door.stayOpenSteps;
        else if (door.phase === 'closing') door.phase = 'opening';
      }
      if (door.phase === 'opening') {
        door.progress = Math.min(1, door.progress + 1 / door.openSteps);
        if (door.progress >= 1) {
          door.phase = 'open';
          door.stayTimer = door.stayOpenSteps;
        }
      } else if (door.phase === 'open') {
        if (!door.blockedOpen && --door.stayTimer <= 0) door.phase = 'closing';
      } else if (door.phase === 'closing') {
        door.progress = Math.max(0, door.progress - 1 / door.closeSteps);
        if (door.progress <= 0) door.phase = 'closed';
      }
      if (door.progress !== before) this.updateDoorObstacle(door);
      // grille des PNJ : une porte non automatique est un obstacle tant qu'elle n'est pas ouverte à fond
      if (door.kind !== 'auto') {
        const shouldBlock = door.phase !== 'open';
        if (shouldBlock !== door.inNav) {
          // la case est marquée avec la boîte de la porte fermée
          const full = makeBox(door.x, door.y, door.halfLength, door.halfThickness, door.angle, 0);
          this.nav.mark(full, shouldBlock ? 1 : -1);
          door.inNav = shouldBlock;
        }
      }
    }
  }

  /** Le battant coulisse vers une extrémité : sa boîte raccourcit avec l'ouverture. */
  private updateDoorObstacle(door: Door): void {
    const table = CONFIG.door.panelLength[door.sprite] ?? CONFIG.door.panelLength.spr_door;
    const frame = Math.round(door.progress * (table.length - 1));
    const length = Math.min(door.halfLength * 2, table[frame] * Math.abs(door.scaleX));
    const side = door.scaleX < 0 ? 1 : -1; // extrémité où se range le battant
    const localCenter = side * (door.halfLength - length / 2);
    const c = localToWorld(door.x, door.y, door.angle, localCenter, 0);
    this.collision.update(door.obstacle, () => {
      door.obstacle.cx = c.x;
      door.obstacle.cy = c.y;
      door.obstacle.hw = length / 2;
    });
  }

  private stepButtons(input: Input): void {
    const h = this.hero;
    if (!input.usePressed || h.state === 'dead') return;
    for (const button of this.buttons) {
      if (button.doorId < 0) continue;
      const dist = Math.hypot(h.x - button.x, h.y - button.y);
      if (dist > CONFIG.hero.useRange + h.def.radius) continue;
      // le héros doit être du côté avant du bouton
      const toHero = Math.atan2(h.y - button.y, h.x - button.x);
      if (Math.abs(angleDiff(button.angle, toHero)) > Math.PI / 2) continue;
      for (const door of this.doors) {
        if (door.kind === 'button' && door.doorId === button.doorId && door.phase === 'closed') this.openDoor(door);
      }
    }
  }

  /** Bouton utilisable par le héros en ce moment (pour l'aide à l'écran). */
  usableButton(): Button | null {
    const h = this.hero;
    for (const button of this.buttons) {
      if (button.doorId < 0) continue;
      if (Math.hypot(h.x - button.x, h.y - button.y) > CONFIG.hero.useRange + h.def.radius) continue;
      const toHero = Math.atan2(h.y - button.y, h.x - button.x);
      if (Math.abs(angleDiff(button.angle, toHero)) > Math.PI / 2) continue;
      if (this.doors.some((d) => d.kind === 'button' && d.doorId === button.doorId && d.phase === 'closed')) return button;
    }
    return null;
  }

  nearestOutlet(maxDist: number): Outlet | null {
    let best: Outlet | null = null;
    let bestD = maxDist;
    for (const o of this.outlets) {
      const d = Math.hypot(o.x - this.hero.x, o.y - this.hero.y);
      if (d <= bestD) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  private stepZones(): void {
    const h = this.hero;
    for (const z of this.zones) {
      const inside = h.state !== 'dead' && Math.hypot(h.x - z.x, h.y - z.y) <= z.radius;
      if (inside && !z.active) this.emit({ type: 'notify', text: 'The upper floor is not open yet.' });
      z.active = inside;
    }
  }

  // ---------- Requêtes utilisées par les PNJ ----------

  sightBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    return this.collision.segmentBlocked(x1, y1, x2, y2, BLOCK_SIGHT);
  }

  soundBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    return this.collision.segmentBlocked(x1, y1, x2, y2, BLOCK_SOUND);
  }

  shotBlocked(x1: number, y1: number, x2: number, y2: number): boolean {
    return this.collision.segmentBlocked(x1, y1, x2, y2, BLOCK_BULLET);
  }

  clampToRoom(x: number, y: number, margin: number): { x: number; y: number } {
    return { x: clamp(x, margin, this.width - margin), y: clamp(y, margin, this.height - margin) };
  }
}

/** Objets sans parent qui ne sont que du décor dessiné (aucune collision dans l'original). */
const DECOR_ONLY = /^obj_(fauteuilRond\d|mur_dessousFenetre|robot_atelier\d|tapis_accueil)$/;
