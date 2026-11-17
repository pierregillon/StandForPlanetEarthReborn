// État complet d'une salle en cours de jeu et boucle de simulation (60 steps par seconde).
// Ne dépend ni de Phaser ni du navigateur (ADR-005) : l'affichage lit cet état et consomme `events`.
import { CONFIG, STEPS_PER_SECOND } from './config.ts';
import type { BulletDef, HeroDef } from './config.ts';
import {
  BLOCK_BULLET, BLOCK_MOVE, BLOCK_SIGHT, BLOCK_SOUND, IS_WINDOW,
  CollisionWorld, Rng, angleDiff, boxNormal, clamp, distanceToBox, gmAngleToRad, localToWorld, makeBox, reflectAngle, segmentCircle,
} from './geom.ts';
import type { Obstacle } from './geom.ts';
import { NavGrid } from './nav.ts';
import { blockedByFrontShield, explosionSteps, shieldIntercept, shieldTank, stepAbilityObjects } from './abilities.ts';
import type { NewExplosion } from './abilities.ts';
import { deploySound, stepHero } from './hero.ts';
import { createBoss } from './boss.ts';
import type { BossState } from './boss.ts';
import { createNpc, stepNpcs } from './npc.ts';
import { DRILL_AREA, GROUND_FLOOR, OBJECTIVES, UPPER_FLOOR, createSession } from './session.ts';
import type { Session } from './session.ts';
import { NO_INPUT } from './types.ts';
import { clearEffects, stepEffects } from './ulti.ts';
import type {
  Bat, Bullet, Button, Card, Chair, Checkpoint, DecorItem, Door, Drill, Drone, Explosion, Fog, Hero, Input, LevelData, LevelInstance, Npc, Outlet,
  SimEvent, SpriteInfo, SpriteManifest, Stats, Turret, UltiEffect, WindowPane, Zone,
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
  /** État partagé entre les salles de la partie (cartes, consigne, statistiques). */
  readonly session: Session;
  readonly stats: Stats;
  /** Points d'apparition : par numéro de jeu, un point par rang de héros (obj_spawn1 à obj_spawn4). */
  private readonly spawns = new Map<number, { x: number; y: number }[]>();
  /** Zone de sortie du niveau (obj_endLevel), active à partir de la consigne « Exit to the drilling area ». */
  private exitZone: Obstacle | null = null;
  /** Steps restants avant de quitter le niveau, -1 hors de la zone de sortie. */
  exitCountdown = -1;
  /** Steps restants avant de changer de salle quand une partie de l'équipe attend sur un passage, -1 sinon. */
  zoneCountdown = -1;
  private ended = false;
  /** Ce que cette salle a ajouté aux statistiques de la partie (retiré si la salle est rejouée). */
  private readonly counted = { civil: 0, soldier: 0, civilKilled: 0, soldierKilled: 0 };

  tick = 0;
  /**
   * Énergie qu'une borne peut donner (GD-043) : la réserve de base, partagée entre les joueurs. Seul, une borne
   * mène à l'ulti ; à plusieurs, il faut aussi se lier.
   */
  outletCapacity: number = CONFIG.outlet.energyCapacity;
  /** L'équipe, dans l'ordre des joueurs. En solo, un seul héros. */
  heroes: Hero[] = [];
  /** Rang du héros que suit l'affichage (celui du joueur local). */
  viewHero = 0;
  npcs: Npc[] = [];
  bullets: Bullet[] = [];
  drones: Drone[] = [];
  explosions: Explosion[] = [];
  bats: Bat[] = [];
  /** Effets d'ultis en cours : essaim, mur, grenade. */
  effects: UltiEffect[] = [];
  turret: Turret | null = null;
  doors: Door[] = [];
  buttons: Button[] = [];
  windows: WindowPane[] = [];
  outlets: Outlet[] = [];
  cards: Card[] = [];
  drills: Drill[] = [];
  chairs: Chair[] = [];
  checkpoint: Checkpoint | null = null;
  fogs: Fog[] = [];
  boss: BossState | null = null;
  private endTimer = -1;
  private exitFired = false;
  zones: Zone[] = [];
  decor: DecorItem[] = [];
  /** La salle va être rejouée de zéro (Retry) : ses PNJ ne doivent pas être comptés deux fois. */
  forget(): void {
    this.stats.totalCivil -= this.counted.civil;
    this.stats.totalSoldier -= this.counted.soldier;
    this.stats.civilKilled -= this.counted.civilKilled;
    this.stats.soldierKilled -= this.counted.soldierKilled;
    this.session.rooms.delete(this.level.name);
  }

  /**
   * Ne garde que `count` bornes, les mieux réparties : la plus proche du départ, puis à chaque fois
   * la plus éloignée de celles déjà gardées (GD-029).
   */
  private keepSpreadOutlets(count: number, from: { x: number; y: number }): void {
    if (this.outlets.length <= count) return;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }): number => Math.hypot(a.x - b.x, a.y - b.y);
    const pool = this.outlets.slice();
    const kept = [pool.reduce((best, o) => (dist(o, from) < dist(best, from) ? o : best))];
    while (kept.length < count) {
      let best = pool[0];
      let bestD = -1;
      for (const o of pool) {
        if (kept.includes(o)) continue;
        const d = Math.min(...kept.map((k) => dist(o, k)));
        if (d > bestD) {
          bestD = d;
          best = o;
        }
      }
      kept.push(best);
    }
    this.outlets = this.outlets.filter((o) => kept.includes(o));
  }

  /** Consigne affichée au joueur (GD-010). */
  private nextId = 1;

  readonly level: LevelData;
  readonly sprites: SpriteManifest;

  constructor(level: LevelData, sprites: SpriteManifest, heroNames: string | string[], seed = 1, session: Session = createSession(heroNames, level.name)) {
    this.session = session;
    this.stats = session.stats;
    this.level = level;
    this.sprites = sprites;
    this.width = level.width;
    this.height = level.height;
    this.rng = new Rng(seed);
    this.outletCapacity = Math.ceil(CONFIG.outlet.energyCapacity / Math.max(1, session.heroNames.length));
    this.collision = new CollisionWorld(level.width, level.height);
    this.nav = new NavGrid(level.width, level.height, CONFIG.nav.cellSize, CONFIG.nav.clearance, CONFIG.nav.maxExpansions);

    for (const [x, y, w, h, thick] of level.wallRects) {
      const flags = BLOCK_MOVE | BLOCK_BULLET | BLOCK_SIGHT | (thick ? BLOCK_SOUND : 0);
      const o = this.collision.add(makeBox(x + w / 2, y + h / 2, w / 2, h / 2, 0, flags));
      this.nav.mark(o, 1);
    }

    for (const inst of level.instances) {
      const spawnSlot = /^obj_spawn([1-4])$/.exec(inst.object);
      if (spawnSlot) {
        const number = Number(inst.props.spawnNumber ?? 1);
        const points = this.spawns.get(number) ?? [];
        points[Number(spawnSlot[1]) - 1] = { x: inst.x, y: inst.y };
        this.spawns.set(number, points);
      }
      this.addInstance(inst);
    }
    const start = this.spawnPoint(session.spawnNumber);
    // point de sauvegarde devant le boss (GD-031) : s'il est déjà activé, on y reprend en pleine forme
    if (level.name === DRILL_AREA) {
      const first = this.spawnPoint(1);
      this.checkpoint = { x: first.x - 230, y: first.y - 60, active: session.checkpoint?.room === level.name };
    }
    const resumed = this.checkpoint?.active === true;
    const spawn = resumed && this.checkpoint ? { x: this.checkpoint.x + 110, y: this.checkpoint.y + 40 } : start;
    this.keepSpreadOutlets(CONFIG.outlet.keepPerRoom[level.name] ?? this.outlets.length, spawn);
    session.heroNames.forEach((name, slot) => {
      // au point de sauvegarde, l'équipe reprend groupée ; sinon chacun a son point d'apparition
      const at = resumed ? { x: spawn.x + (slot % 2) * 100, y: spawn.y + Math.floor(slot / 2) * 100 } : this.spawnPoint(session.spawnNumber, slot);
      const h = this.createHero(CONFIG.heroes[name], at.x, at.y, slot);
      if (resumed) this.restoreHero(h);
      this.heroes.push(h);
    });
    this.openPassedDoors();
  }

  /** Ouvre les portes que le héros a déjà franchies avant le début de la partie (départ choisi au menu). */
  private openPassedDoors(): void {
    const passed = this.session.preOpened[this.level.name];
    if (!passed) return;
    for (const door of this.doors) {
      const open = (door.kind === 'button' && passed.buttons.includes(door.doorId)) || (door.kind === 'card' && door.card !== null && passed.cards.includes(door.card));
      if (!open) continue;
      door.phase = 'open';
      door.progress = 1;
      door.blockedOpen = true;
      this.updateDoorObstacle(door);
    }
    for (const button of this.buttons) if (passed.buttons.includes(button.doorId)) button.pressedSteps = 1000;
  }

  private restoreHero(h: Hero): void {
    h.hp = h.def.maxHealth;
    h.energy = CONFIG.hero.maxEnergy;
    h.overchargeHold = CONFIG.hero.overchargeHoldSteps;
    h.ammo = h.def.magazine;
  }

  /**
   * Un héros se connecte au point de sauvegarde en s'en approchant : toute l'équipe est remise en état,
   * robots à terre compris, une fois par vie.
   */
  private stepCheckpoint(): void {
    const cp = this.checkpoint;
    if (!cp || cp.active) return;
    if (!this.living().some((h) => Math.hypot(h.x - cp.x, h.y - cp.y) <= CONFIG.hero.checkpointRadius)) return;
    cp.active = true;
    this.session.checkpoint = { room: this.level.name, x: cp.x, y: cp.y };
    for (const h of this.present()) {
      if (h.state === 'dead') this.raiseHero(h, h.def.maxHealth);
      this.restoreHero(h);
    }
    this.emit({ type: 'checkpoint', x: cp.x, y: cp.y });
    this.emit({ type: 'notify', text: 'Checkpoint reached - systems fully restored' });
  }

  /** Animation de déploiement au début d'une partie (présente dans l'original, où elle était désactivée). */
  deployHero(withVehicle = false): void {
    const a = CONFIG.arrival;
    const arrivalTotal = a.flyInSteps + a.descendSteps + a.holdSteps + a.ascendSteps + a.flyOutSteps;
    for (const h of this.heroes) {
      const info = this.sprite(`spr_${h.def.name}_deploy`);
      const fps = info.speedType === 0 ? info.speed : info.speed * STEPS_PER_SECOND;
      h.deployTotal = Math.min(CONFIG.hero.maxDeploySteps, Math.max(30, Math.round((info.frames / fps) * STEPS_PER_SECOND)));
      h.deploySteps = h.deployTotal;
      if (withVehicle) {
        // le véhicule de largage amène d'abord l'équipe ; le déploiement commence après son départ
        h.arrivalTotal = arrivalTotal;
        h.arrivalSteps = arrivalTotal;
      } else {
        this.emit({ type: 'deploy', sound: deploySound(h), hero: h.id });
      }
    }
    if (withVehicle) this.emit({ type: 'vehicleArrives', seconds: arrivalTotal / STEPS_PER_SECOND });
  }

  /** Chaises à roulettes : poussées par les héros, elles roulent puis ralentissent ; les murs les arrêtent. */
  private stepChairs(): void {
    const cfg = CONFIG.chair;
    const pushers = this.living().filter((h) => h.moving || h.dashing);
    for (const chair of this.chairs) {
      const o = chair.obstacle;
      for (const h of pushers) {
        const dx = o.cx - h.x;
        const dy = o.cy - h.y;
        const d = Math.hypot(dx, dy);
        if (d > 0.01 && d < h.def.radius + cfg.radius + 6) {
          const speed = h.def.walkSpeed * (h.dashing ? 1.6 : cfg.push);
          chair.vx = (dx / d) * speed;
          chair.vy = (dy / d) * speed;
        }
      }
      const v = Math.hypot(chair.vx, chair.vy);
      if (v < 0.25) {
        chair.vx = 0;
        chair.vy = 0;
        continue;
      }
      this.nav.mark(o, -1);
      o.active = false; // la chaise ne se heurte pas à elle-même
      // par petits pas : une chaise projetée par la vague de BadaBot va trop vite pour un seul contrôle
      const hops = Math.ceil(v / 16);
      let res = { x: o.cx, y: o.cy, hit: false };
      for (let i = 0; i < hops && !res.hit; i++) res = this.collision.resolveCircle(res.x + chair.vx / hops, res.y + chair.vy / hops, cfg.radius, BLOCK_MOVE);
      o.active = true;
      this.collision.update(o, () => {
        o.cx = res.x;
        o.cy = res.y;
      });
      this.nav.mark(o, 1);
      chair.x = res.x - chair.offsetX;
      chair.y = res.y - chair.offsetY;
      chair.angle += v * 0.012;
      // tant qu'elle est projetée, elle ne ralentit pas ; un mur l'arrête
      chair.thrown = res.hit ? 0 : Math.max(0, chair.thrown - v);
      const keep = res.hit ? 0.4 : chair.thrown > 0 ? 1 : cfg.friction;
      chair.vx *= keep;
      chair.vy *= keep;
    }
  }

  /** Consigne affichée au joueur (GD-010). */
  get objective(): string {
    return OBJECTIVES[this.session.objective] ?? '';
  }

  private spawnPoint(spawnNumber: number, slot = 0): { x: number; y: number } {
    const points = this.spawns.get(spawnNumber) ?? this.spawns.get(1) ?? [];
    const first = points[0] ?? { x: this.width / 2, y: this.height / 2 };
    return points[slot] ?? { x: first.x + slot * 100, y: first.y };
  }

  // ---------- Équipe ----------

  /** Héros suivi par l'affichage : le seul en solo, celui du joueur local en partie à plusieurs. */
  get hero(): Hero {
    return this.heroes[this.viewHero] ?? this.heroes[0];
  }

  /** Héros dont le joueur est toujours là, vivants ou à terre. */
  present(): Hero[] {
    return this.heroes.filter((h) => !h.gone);
  }

  /** Héros en état de jouer. */
  living(): Hero[] {
    return this.heroes.filter((h) => !h.gone && h.state !== 'dead');
  }

  /** Le héros de ce type, s'il fait partie de l'équipe (chaque robot n'y figure qu'une fois). */
  heroOf(kind: string): Hero | null {
    return this.heroes.find((h) => h.def.kind === kind && !h.gone) ?? null;
  }

  nearestHero(x: number, y: number): Hero | null {
    let best: Hero | null = null;
    let bestD = Infinity;
    for (const h of this.heroes) {
      if (h.gone || h.state === 'dead') continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    }
    return best;
  }

  /** Relève un héros à terre (résurrection, point de sauvegarde, arrivée dans une nouvelle salle). */
  raiseHero(h: Hero, hp: number): void {
    h.state = 'standing';
    h.hp = hp;
    h.deadSteps = 0;
    h.invuln = CONFIG.revive.invulnSteps;
  }

  /** Le joueur de ce héros a quitté la partie : son robot disparaît, ce qu'il avait lancé aussi. */
  removeHero(id: number): void {
    const h = this.heroes[id];
    if (!h || h.gone) return;
    h.gone = true;
    h.charging = false;
    h.reviving = -1;
    h.linkTo = -1;
    if (h.def.kind === 'BatBot') this.bats.length = 0;
    if (h.def.kind === 'EngiBot') this.turret = null;
  }

  /**
   * L'équipe entre dans cette salle en venant d'une autre : chacun garde ses points de vie, son énergie et son
   * chargeur. Les battes laissées dans l'autre salle sont rendues (GD-026). Un robot à terre est relevé à
   * l'arrivée, avec les points de vie d'une résurrection (GD-039).
   */
  enter(previousTeam: Hero[] | null, spawnNumber: number): void {
    this.heroes = this.heroes.map((old, slot) => this.enterHero(old, previousTeam?.[slot] ?? null, spawnNumber));
    // ce que l'équipe avait laissé derrière elle dans cette salle ne l'attend pas
    clearEffects(this);
    this.bats.length = 0;
    this.drones.length = 0;
    this.bullets.length = 0;
    this.exitCountdown = -1;
    for (const z of this.zones) {
      z.active = false;
      z.countdown = -1;
      z.departed = false;
    }
  }

  private enterHero(old: Hero, previous: Hero | null, spawnNumber: number): Hero {
    const spawn = this.spawnPoint(spawnNumber, old.id);
    const h = this.createHero(old.def, spawn.x, spawn.y, old.id);
    h.gone = old.gone;
    if (previous) {
      h.gone = previous.gone;
      h.hp = previous.hp;
      h.energy = previous.energy;
      h.energyTimer = previous.energyTimer;
      h.ammo = previous.ammo;
      h.reloadTimer = previous.reloadTimer;
      h.dashCharges = previous.dashCharges;
      h.dashRechargeTimer = previous.dashRechargeTimer;
      h.healPool = previous.healPool;
      h.angle = previous.angle;
      h.moveAngle = previous.moveAngle;
      if (previous.state === 'dead') {
        h.hp = CONFIG.revive.hp;
        h.energy = 0;
      }
    }
    return h;
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
      pane.obstacle = this.collision.add(this.instanceBox(inst, maskName, BLOCK_MOVE | IS_WINDOW, pane));
      this.nav.mark(pane.obstacle, 1);
      this.windows.push(pane);
    } else if (inst.object === 'obj_button') {
      this.buttons.push({
        id: this.nextId++, sprite: spriteName ?? 'spr_button', x: inst.x, y: inst.y, angle, scaleX: inst.scaleX, scaleY: inst.scaleY,
        doorId: Number(inst.props.doorId ?? -1), pressedSteps: -1,
      });
    } else if (isA(level, inst.object, 'obj_localNpc')) {
      const def = CONFIG.npcs[inst.object];
      if (!def) return;
      const npc = createNpc(this, this.nextId++, inst, def);
      this.npcs.push(npc);
      if (def.kind === 'boss') this.boss = createBoss(npc, this.session.heroNames.length);
      if (def.kind === 'civil') {
        this.stats.totalCivil++;
        this.counted.civil++;
      } else {
        this.stats.totalSoldier++;
        this.counted.soldier++;
      }
    } else if (inst.object === CONFIG.outlet.replacesObject) {
      this.outlets.push({
        id: this.nextId++, x: inst.x, y: inst.y, inUse: false,
        energyLeft: this.outletCapacity, repairLeft: CONFIG.outlet.repairCapacity,
      });
    } else if (inst.object === 'obj_card_green' || inst.object === 'obj_card_purple') {
      this.cards.push({
        id: this.nextId++, color: inst.object === 'obj_card_green' ? 'green' : 'purple', sprite: spriteName ?? 'spr_doorKey_green',
        x: inst.x, y: inst.y, carried: false,
      });
    } else if (inst.object === 'obj_nextRoom' || inst.object === 'obj_previousRoom') {
      this.zones.push({
        kind: 'stairs', x: inst.x, y: inst.y, radius: 160, sprite: spriteName ?? 'spr_teleporteur_waiting', active: false, countdown: -1, departed: false,
        targetRoom: String(inst.props.nextRoom ?? ''), targetSpawn: Number(inst.props.spawnNumberOfNextRoom ?? 1),
      });
    } else if (inst.object === 'obj_foreuse') {
      const drill: Drill = {
        id: this.nextId++, tag: 'drill', x: inst.x, y: inst.y, hp: CONFIG.drill.maxHealth, maxHp: CONFIG.drill.maxHealth,
        destroyed: false, radius: 0,
      };
      const mask = this.sprite(maskName);
      drill.radius = ((mask.bbox[2] - mask.bbox[0] + 1) / 2) * Math.abs(inst.scaleX);
      // six rectangles fins croisés tous les 30° forment un dodécagone
      for (let k = 0; k < 6; k++) {
        const o = this.collision.add(makeBox(inst.x, inst.y, drill.radius, drill.radius * 0.268, (k * Math.PI) / 6, BLOCK_MOVE | BLOCK_BULLET, drill));
        this.nav.mark(o, 1);
      }
      this.drills.push(drill);
      if (spriteName) this.addDecor(inst, spriteName);
    } else if (inst.object === 'obj_warFog') {
      this.fogs.push({
        id: this.nextId++, x: inst.x, y: inst.y, w: 64 * inst.scaleX, h: 64 * inst.scaleY,
        number: inst.props.warFogNumber === null || inst.props.warFogNumber === undefined ? null : Number(inst.props.warFogNumber),
        attached: inst.props.attachedWarFogNumber === null || inst.props.attachedWarFogNumber === undefined ? null : Number(inst.props.attachedWarFogNumber),
        fadePerStep: Number(inst.props.apparitionSpeed ?? 0.08), enabled: false, alpha: 1,
      });
    } else if (inst.object === 'obj_endLevel') {
      this.exitZone = this.instanceBox(inst, spriteName, 0);
    } else if (CONFIG.chair.objects.includes(inst.object)) {
      const o = this.collision.add(this.instanceBox(inst, maskName, BLOCK_MOVE));
      this.nav.mark(o, 1);
      this.chairs.push({
        id: this.nextId++, sprite: spriteName ?? '', x: inst.x, y: inst.y, angle, scaleX: inst.scaleX, scaleY: inst.scaleY, tint: inst.tint,
        vx: 0, vy: 0, thrown: 0, offsetX: o.cx - inst.x, offsetY: o.cy - inst.y, obstacle: o,
      });
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

  private createHero(def: HeroDef, x: number, y: number, id: number): Hero {
    return {
      id, gone: false, reviving: -1, reviveSteps: 0,
      linkTo: -1, linkTimer: 0, linkStrength: 0, ultiPhase: 0, ultiSteps: 0, ultiFromX: x, ultiFromY: y, ultiToX: x, ultiToY: y,
      def, x, y, angle: -Math.PI / 2, moveAngle: -Math.PI / 2, moving: false, state: 'standing',
      hp: def.maxHealth, energy: CONFIG.hero.naturalEnergy, energyTimer: 0, energyPause: 0,
      ammo: def.magazine, reloadTimer: 0, fireTimer: 0, sinceShot: 9999,
      dashCharges: def.dashCharges, dashRechargeTimer: 0, dashing: false, bump: false, targetX: x, targetY: y,
      deploySteps: 0, deployTotal: 0, arrivalSteps: 0, arrivalTotal: 0,
      invuln: 0, walkDist: 0, deadSteps: 0, charging: false, chargeTimer: 0, repairTimer: 0, linkedOutlet: -1, overchargeHold: 0, healPool: 0,
      fire2Timer: 0, fire2Was: false, fire2Hold: 0, fire2Anim: -1, speedFactor: 1,
      charge: 0, shieldUp: false, tanked: 0,
      bats: 2, swingRight: true, swing: 'd', swingSteps: 0, swingHit: new Set(), recallDone: false,
      placingTurret: 0,
    };
  }

  emit(e: SimEvent): void {
    this.events.push(e);
  }

  /** Vide et retourne les événements produits depuis le dernier appel. */
  drainEvents(): SimEvent[] {
    return this.events.splice(0, this.events.length);
  }

  /** Toute l'équipe est à terre (GD-007) : en solo, le héros ; à plusieurs, plus personne pour relever les autres. */
  get gameOver(): boolean {
    const team = this.present();
    return team.length > 0 && team.every((h) => h.state === 'dead' && h.deadSteps >= CONFIG.hero.deathMenuDelaySteps);
  }

  /** Avance d'un step. `inputs` : l'entrée du joueur en solo, ou une entrée par héros, dans l'ordre de l'équipe. */
  step(inputs: Input | Input[]): void {
    this.tick++;
    const list = Array.isArray(inputs) ? inputs : [inputs];
    this.stepChairs();
    for (const o of this.outlets) o.inUse = false;
    for (const button of this.buttons) if (button.pressedSteps >= 0) button.pressedSteps++;
    for (const h of this.heroes) {
      if (h.gone) continue;
      const input = list[h.id] ?? NO_INPUT;
      stepHero(this, h, input);
      this.stepButtons(h, input);
      this.stepCards(h, input);
    }
    this.stepCheckpoint();
    stepNpcs(this);
    this.stepDoors();
    this.stepBullets();
    stepAbilityObjects(this);
    stepEffects(this);
    this.stepZones();
    this.stepFogs();
    this.stepObjectives();
  }

  // ---------- Dégâts ----------

  /** Dégât infligé au héros. `ignoreInvuln` : le coup de bouclier passe outre l'invulnérabilité. */
  damageHero(h: Hero, amount: number, ignoreInvuln = false): boolean {
    if (h.gone || h.hp <= 0 || h.state === 'dead') return false;
    // intouchable pendant un dash (GD-031), pendant le déploiement et en plein bond (ulti de BatBot)
    if (h.dashing || h.deploySteps > 0 || h.ultiPhase === 2) return false;
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
      h.linkedOutlet = -1;
      h.shieldUp = false;
      h.charge = 0;
      h.fire2Anim = -1;
      h.placingTurret = 0;
      h.speedFactor = 1;
      h.deadSteps = 0;
      h.reviving = -1;
      // un robot qui tombe perd son lien et son ulti en cours de lancement
      h.linkTo = -1;
      h.linkStrength = 0;
      h.ultiPhase = 0;
      // les battes lancées sont perdues à la mort du BatBot, comme dans l'original
      if (h.def.kind === 'BatBot') this.bats.length = 0;
      this.emit({ type: 'heroDead', x: h.x, y: h.y });
    }
    return true;
  }

  killNpc(npc: Npc): void {
    const i = this.npcs.indexOf(npc);
    if (i < 0) return;
    this.npcs.splice(i, 1);
    if (npc.def.kind === 'civil') {
      this.stats.civilKilled++;
      this.counted.civilKilled++;
    } else {
      this.stats.soldierKilled++;
      this.counted.soldierKilled++;
    }
    this.emit({ type: 'sound', name: 'snd_human_explosion', x: npc.x, y: npc.y });
    this.emit({ type: 'npcDeath', x: npc.x, y: npc.y, angle: npc.angle, sprite: npc.def.sprites.dead, genre: npc.def.genre });
  }

  // ---------- Balles ----------

  /**
   * Tire une balle depuis le bout du canon d'un personnage placé en (fromX, fromY).
   * Si un mur sépare le personnage de son canon, la balle s'écrase dessus (GD-019).
   */
  fireBullet(def: BulletDef, owner: 'hero' | 'enemy', fromX: number, fromY: number, x: number, y: number, angle: number, ownerId = -1): void {
    const hit = this.collision.raycast(fromX, fromY, x, y, BLOCK_BULLET);
    if (hit) {
      this.emit({ type: 'impact', x: fromX + (x - fromX) * hit.t, y: fromY + (y - fromY) * hit.t, angle, surface: 'wall' });
      return;
    }
    this.spawnBullet(def, owner, x, y, angle, ownerId);
  }

  spawnBullet(def: BulletDef, owner: 'hero' | 'enemy', x: number, y: number, angle: number, ownerId = -1): void {
    this.bullets.push({ id: this.nextId++, def, owner, ownerId, x, y, angle, startX: x, startY: y, speed: def.speed, lastHit: -1, steps: 0 });
  }

  newId(): number {
    return this.nextId++;
  }

  addExplosion(e: NewExplosion): void {
    this.explosions.push({
      ...e, id: this.nextId++, angle: this.rng.range(0, Math.PI * 2), step: 0, totalSteps: explosionSteps(this, e.sprite), hit: new Set(),
    });
  }

  /** Explosion de la boule de plasma de BadaBot. */
  private plasmaExplosion(x: number, y: number): void {
    const cfg = CONFIG.abilities.badaBot;
    const info = this.sprite('spr_BadaBot_plasmaBoom');
    this.addExplosion({
      x, y, sprite: 'spr_BadaBot_plasmaBoom', radius: cfg.explosionRadius, damage: cfg.explosionDamage, healFromStep: -1,
      scale: (cfg.explosionRadius * 2) / (info.bbox[2] - info.bbox[0] + 1),
    });
    this.emit({ type: 'sound', name: `snd_badaBot_explosion${this.rng.int(1, 3)}`, x, y });
  }

  private stepBullets(): void {
    const bullets = this.bullets;
    for (let i = bullets.length - 1; i >= 0; i--) {
      if (this.stepBullet(bullets[i])) bullets.splice(i, 1);
    }
  }

  /** Avance une balle d'un step. Retourne true si elle disparaît. */
  private stepBullet(b: Bullet): boolean {
    b.steps++;
    const bounce = b.def.kind === 'bounce';
    if (bounce) {
      // balle d'EngiBot : ralentit et disparaît quand elle n'avance plus
      b.speed -= CONFIG.abilities.engiBot.bulletDeceleration;
      if (b.speed < CONFIG.abilities.engiBot.bulletMinSpeed) return true;
    }
    const nx = b.x + Math.cos(b.angle) * b.speed;
    const ny = b.y + Math.sin(b.angle) * b.speed;
    const wall = this.collision.raycast(b.x, b.y, nx, ny, BLOCK_BULLET);
    let limit = wall ? wall.t : 2;

    // personnage (ou bouclier de BadaBot) touché avant le décor ?
    let target: Npc | null = null;
    let heroHit: Hero | null = null;
    let shieldHit: Hero | null = null;
    if (b.owner === 'hero') {
      for (const npc of this.npcs) {
        if (npc.id === b.lastHit) continue;
        const t = segmentCircle(b.x, b.y, nx, ny, npc.x, npc.y, npc.def.radius + b.def.radius);
        if (t >= 0 && t < limit) {
          limit = t;
          target = npc;
        }
      }
    } else {
      for (const h of this.living()) {
        const t = segmentCircle(b.x, b.y, nx, ny, h.x, h.y, h.def.radius + b.def.radius);
        if (t >= 0 && t < limit) {
          limit = t;
          heroHit = h;
          shieldHit = null;
        }
        // le bouclier de BadaBot protège aussi ceux qui se tiennent derrière lui
        const ts = shieldIntercept(h, b.x, b.y, nx, ny);
        if (ts >= 0 && ts <= limit) {
          limit = ts;
          heroHit = null;
          shieldHit = h;
        }
      }
    }

    // les vitres traversées avant l'impact se brisent, sans arrêter la balle
    const end = Math.min(limit, 1);
    const hx = b.x + (nx - b.x) * end;
    const hy = b.y + (ny - b.y) * end;
    const glass = this.collision.raycast(b.x, b.y, hx, hy, IS_WINDOW);
    if (glass) this.breakWindow(glass.obstacle.owner as WindowPane, b.angle);

    // les balles des héros traversent les coéquipiers sans effet (GD-041, GD-042)

    if (shieldHit) {
      shieldTank(this, shieldHit);
      this.emit({ type: 'impact', x: hx, y: hy, angle: b.angle, surface: 'shield' });
      return true;
    }
    if (target) {
      const blocked = blockedByFrontShield(target, b.x, b.y);
      this.emit({ type: 'impact', x: hx, y: hy, angle: b.angle, surface: blocked ? 'shield' : 'npc' });
      if (b.def.kind === 'plasma') {
        this.plasmaExplosion(hx, hy);
        return true;
      }
      if (!blocked) target.hp -= b.def.damage;
      if (!bounce || blocked) return true;
      // rebond sur le PNJ : la balle perd les trois quarts de sa vitesse
      const n = Math.hypot(hx - target.x, hy - target.y) || 1;
      b.angle = reflectAngle(b.angle, (hx - target.x) / n, (hy - target.y) / n);
      b.speed /= 4;
      b.lastHit = target.id;
      b.x = hx;
      b.y = hy;
      return false;
    }
    if (heroHit) {
      this.damageHero(heroHit, b.def.damage);
      return true;
    }
    if (wall) {
      const drill = wall.obstacle.owner as Drill | null;
      if (b.owner === 'hero' && drill && drill.tag === 'drill') this.damageDrill(drill, Math.max(1, b.def.damage));
      this.emit({ type: 'impact', x: hx, y: hy, angle: b.angle, surface: 'wall' });
      if (b.def.kind === 'plasma') {
        this.plasmaExplosion(hx, hy);
        return true;
      }
      if (!bounce) return true;
      // rebond sur le décor : vitesse divisée par deux, recul de 20 px
      const normal = boxNormal(wall.obstacle, hx, hy);
      b.x = hx - Math.cos(b.angle) * 20;
      b.y = hy - Math.sin(b.angle) * 20;
      b.angle = reflectAngle(b.angle, normal.x, normal.y);
      b.speed /= 2;
      b.lastHit = -1;
      return false;
    }
    b.x = nx;
    b.y = ny;
    const out = Math.hypot(b.x - b.startX, b.y - b.startY) > b.def.maxDistance
      || b.x < 0 || b.y < 0 || b.x > this.width || b.y > this.height;
    if (out && b.def.kind === 'plasma') this.plasmaExplosion(b.x, b.y);
    return out;
  }

  breakWindow(pane: WindowPane, angle = 0): void {
    if (pane.broken) return;
    pane.broken = true;
    // une vitre brisée continue de bloquer le passage et la vue, comme dans l'original
    pane.obstacle.flags &= ~IS_WINDOW;
    this.emit({ type: 'windowBroken', id: pane.id, x: pane.obstacle.cx, y: pane.obstacle.cy, angle });
  }

  // ---------- Portes et boutons ----------

  private someoneNear(x: number, y: number, range: number): boolean {
    for (const h of this.heroes) {
      if (!h.gone && h.state !== 'dead' && Math.hypot(h.x - x, h.y - y) <= range + h.def.radius) return true;
    }
    for (const npc of this.npcs) {
      if (npc.active && Math.hypot(npc.x - x, npc.y - y) <= range + npc.def.radius) return true;
    }
    return false;
  }

  openDoor(door: Door): void {
    if (door.phase === 'closed' || door.phase === 'closing') door.phase = 'opening';
  }

  damageDrill(drill: Drill, amount: number): void {
    if (drill.destroyed) return;
    drill.hp -= amount;
    if (drill.hp > 0) return;
    drill.hp = 0;
    drill.destroyed = true;
    this.emit({ type: 'drillDestroyed', id: drill.id, x: drill.x, y: drill.y });
    this.emit({ type: 'sound', name: 'snd_human_explosion', x: drill.x, y: drill.y });
  }

  // ---------- Brouillard de guerre ----------

  private enableFog(fog: Fog): void {
    if (fog.enabled) return;
    fog.enabled = true;
    // les brouillards attachés à celui-ci se lèvent avec lui
    if (fog.number !== null) for (const other of this.fogs) if (other.attached === fog.number) this.enableFog(other);
  }

  private stepFogs(): void {
    const team = this.present();
    for (let i = this.fogs.length - 1; i >= 0; i--) {
      const fog = this.fogs[i];
      // garde-fou du remake : un héros ne reste jamais sous un brouillard (GD-028)
      if (!fog.enabled && team.some((h) => h.x >= fog.x && h.x <= fog.x + fog.w && h.y >= fog.y && h.y <= fog.y + fog.h)) this.enableFog(fog);
      if (!fog.enabled) continue;
      fog.alpha -= fog.fadePerStep;
      if (fog.alpha <= 0) this.fogs.splice(i, 1);
    }
  }

  /** Une porte ouverte à fond devant un héros lève le brouillard des pièces qu'elle touche. */
  private revealThroughDoor(door: Door): void {
    if (!this.living().some((h) => Math.hypot(h.x - door.x, h.y - door.y) <= door.detectionRange + h.def.radius)) return;
    const box = makeBox(door.x, door.y, door.halfLength, door.halfThickness + 8, door.angle, 0);
    for (const fog of this.fogs) {
      if (fog.enabled) continue;
      if (box.maxX >= fog.x && box.minX <= fog.x + fog.w && box.maxY >= fog.y && box.minY <= fog.y + fog.h) this.enableFog(fog);
    }
  }

  private stepDoors(): void {
    for (const door of this.doors) {
      if (door.phase === 'open' && this.fogs.length > 0) this.revealThroughDoor(door);
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
  updateDoorObstacle(door: Door): void {
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

  private stepButtons(h: Hero, input: Input): void {
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
      button.pressedSteps = 0;
      this.emit({ type: 'buttonPressed', x: button.x, y: button.y });
    }
  }

  // ---------- Cartes et portes à carte ----------

  hasCard(color: string | null): boolean {
    return color !== null && this.session.carried.has(color);
  }

  /** Porte à carte fermée à portée du héros (100 px), s'il y en a une. */
  nearCardDoor(h: Hero = this.hero): Door | null {
    if (h.state === 'dead') return null;
    for (const door of this.doors) {
      if (door.kind !== 'card' || door.phase !== 'closed') continue;
      if (Math.hypot(h.x - door.x, h.y - door.y) <= CONFIG.hero.cardDoorRange + h.def.radius) return door;
    }
    return null;
  }

  private stepCards(h: Hero, input: Input): void {
    if (h.state === 'dead') return;
    for (const card of this.cards) {
      if (!card.carried && Math.hypot(h.x - card.x, h.y - card.y) <= h.def.radius + 30) {
        card.carried = true;
        this.session.carried.add(card.color);
        this.emit({ type: 'notify', text: `${card.color === 'green' ? 'Green' : 'Purple'} card found` });
      }
    }
    if (!input.usePressed) return;
    const door = this.nearCardDoor(h);
    if (door && this.hasCard(door.card)) this.openDoor(door);
  }

  /** Bouton utilisable par le héros en ce moment (pour l'aide à l'écran). */
  usableButton(h: Hero = this.hero): Button | null {
    for (const button of this.buttons) {
      if (button.doorId < 0) continue;
      if (Math.hypot(h.x - button.x, h.y - button.y) > CONFIG.hero.useRange + h.def.radius) continue;
      const toHero = Math.atan2(h.y - button.y, h.x - button.x);
      if (Math.abs(angleDiff(button.angle, toHero)) > Math.PI / 2) continue;
      if (this.doors.some((d) => d.kind === 'button' && d.doorId === button.doorId && d.phase === 'closed')) return button;
    }
    return null;
  }

  nearestOutlet(maxDist: number, h: Hero = this.hero): Outlet | null {
    let best: Outlet | null = null;
    let bestD = maxDist;
    for (const o of this.outlets) {
      const d = Math.hypot(o.x - h.x, o.y - h.y);
      // pas de recharge à travers un mur
      if (d <= bestD && !this.sightBlocked(o.x, o.y, h.x, h.y)) {
        bestD = d;
        best = o;
      }
    }
    return best;
  }

  /**
   * Passages vers une autre salle (obj_changeRoom_parent) : toute l'équipe dessus, on part aussitôt ; au moins
   * la moitié, un compte à rebours démarre ; moins, il s'annule. Seul, le passage est donc immédiat.
   */
  private stepZones(): void {
    const team = this.present();
    this.zoneCountdown = -1;
    for (const z of this.zones) {
      let ready = 0;
      for (const h of team) if (h.state !== 'dead' && Math.hypot(h.x - z.x, h.y - z.y) <= z.radius) ready++;
      z.active = ready > 0;
      if (ready === 0) z.departed = false;
      if (!z.targetRoom || ready === 0 || ready * 2 < team.length) {
        z.countdown = -1;
        continue;
      }
      if (z.departed) continue;
      if (ready === team.length) z.countdown = 0;
      else if (z.countdown < 0) z.countdown = CONFIG.hero.exitCountdownSteps;
      else z.countdown--;
      if (z.countdown > 0) {
        this.zoneCountdown = z.countdown;
        continue;
      }
      z.departed = true;
      z.countdown = -1;
      this.emit({ type: 'changeRoom', room: z.targetRoom, spawn: z.targetSpawn });
    }
  }

  /** Enchaînement des consignes du monde 2 (GD-010) et sortie du niveau. */
  private stepObjectives(): void {
    const s = this.session;
    if (s.objective === 0 && this.level.name === UPPER_FLOOR) s.objective = 1;
    if (s.objective === 1 && s.carried.has('purple')) s.objective = 2;
    if (s.objective === 2 && this.level.name === GROUND_FLOOR) s.objective = 3;
    // sortie du niveau : il faut au moins la moitié de l'équipe dans la zone
    const team = this.present();
    const zone = s.objective >= 3 ? this.exitZone : null;
    const waiting = zone ? team.filter((h) => h.state !== 'dead' && distanceToBox(zone, h.x, h.y) <= 0).length : 0;
    const inExit = waiting > 0 && waiting * 2 >= team.length;
    // zone de forage : détruire les foreuses, puis tuer le boss ; l'ordre réel importe peu
    if (this.level.name === DRILL_AREA) {
      if (s.objective === 3) s.objective = 4;
      if (s.objective === 4 && this.drills.every((d) => d.destroyed)) s.objective = 5;
      if (s.objective === 5 && !this.ended && !this.npcs.some((n) => n.def.kind === 'boss')) {
        if (this.endTimer < 0) this.endTimer = CONFIG.boss.endDelaySteps;
        if (--this.endTimer <= 0) {
          this.ended = true;
          this.emit({ type: 'levelEnd' });
        }
      }
    }
    if (!inExit) {
      this.exitCountdown = -1;
      this.exitFired = false;
      return;
    }
    if (this.exitCountdown < 0) this.exitCountdown = CONFIG.hero.exitCountdownSteps;
    if (this.exitCountdown > 0) this.exitCountdown--;
    if (this.exitCountdown === 0 && !this.exitFired) {
      this.exitFired = true;
      this.emit({ type: 'changeRoom', room: DRILL_AREA, spawn: 1 });
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
