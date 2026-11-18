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
import { arrivalPhases, arrivalTotal as arrivalDuration, clawOf, introLines, introShot, typingSteps } from './intro.ts';
import { blockedByFrontShield, explosionSteps, shieldIntercept, shieldTank, stepAbilityObjects } from './abilities.ts';
import type { NewExplosion } from './abilities.ts';
import { deploySound, stepHero } from './hero.ts';
import { createBoss } from './boss.ts';
import type { BossState } from './boss.ts';
import { createNpc, stepNpcs } from './npc.ts';
import { DRILL_AREA, DRILL_OBJECTIVES, GROUND_FLOOR, OBJ, OBJECTIVES, UPPER_FLOOR, createSession, studioCheckpoint, studioDoors } from './session.ts';
import { CONTROL_ROOM_TAKEN, castReader, vehicleVoice } from './broadcast.ts';
import { EXTRACTION_CALL, SCENE, pickupPhases, sceneLines, sceneTotal, standoffSpeaker } from './scenes.ts';
import { TV_STUDIO, useLandmarks } from './landmarks.ts';
import { HOLDING, engage, stageWave, stepWave } from './wave.ts';
import type { RoomSave, Session } from './session.ts';
import { NO_INPUT } from './types.ts';
import { clearEffects, stepEffects } from './ulti.ts';
import type {
  Bat, Bullet, Button, Card, Chair, Checkpoint, DecorItem, Door, Drill, Drone, Explosion, Fog, Hero, Input, LevelData, LevelInstance, Npc, Outlet,
  Seeker, SimEvent, SpriteInfo, SpriteManifest, Stats, Turret, UltiEffect, WindowPane, Zone,
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
  /** Mini-drones à tête chercheuse du tir principal de PetBot (GD-093). */
  seekers: Seeker[] = [];
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
  /** Nombre d'instances déjà ajoutées : le rang de celle en cours. */
  private order = 0;

  readonly level: LevelData;
  readonly sprites: SpriteManifest;

  constructor(level: LevelData, sprites: SpriteManifest, heroNames: string | string[], seed = 1, session: Session = createSession(heroNames, level.name)) {
    this.session = session;
    this.stats = session.stats;
    // les repères du scénario sont ceux du rez-de-chaussée tel qu'il est sur le disque (ADR-020)
    if (level.name === GROUND_FLOOR) useLandmarks(level.landmarks);
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
    // reprise à un point de sauvegarde : la borne de la zone de forage, ou le plateau après l'ultimatum (GD-085)
    const saved = session.checkpoint?.room === level.name ? this.checkpoint ?? session.checkpoint : null;
    const resumed = saved !== null;
    // la salle revient telle qu'elle était au point de sauvegarde : mêmes survivants, mêmes portes (GD-087)
    const save = session.checkpoint?.room === level.name ? session.checkpoint.save : undefined;
    if (save) this.restoreRoom(save);
    // après l'ultimatum, plus personne de la chaîne n'est sur le plateau : ni présentateur ni cadreurs
    if (resumed && level.name === GROUND_FLOOR) {
      const r = TV_STUDIO.room;
      const gone = this.npcs.filter((n) => n.def.kind === 'civil' && n.x > r.x0 && n.x < r.x1 && n.y > r.y0 && n.y < r.y1);
      this.npcs = this.npcs.filter((n) => !gone.includes(n));
      this.stats.totalCivil -= gone.length;
      this.counted.civil -= gone.length;
    }
    const spawn = saved ? { x: saved.x + 110, y: saved.y + 40 } : start;
    // Les bornes gardées sont choisies depuis l'entrée principale de la salle, jamais depuis l'endroit par où
    // l'on arrive : le monde miroir d'un client, reconstruit à chaque entrée, doit garder les mêmes que le
    // serveur. Sinon, au retour de l'étage, le joueur voyait des bornes que le serveur n'avait pas.
    this.keepSpreadOutlets(CONFIG.outlet.keepPerRoom[level.name] ?? this.outlets.length, this.spawnPoint(1));
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

  /** État de la salle à retrouver après un « Retry » (GD-087). */
  private saveRoom(): RoomSave {
    return {
      npcs: this.npcs.map((n) => ({ id: n.id, x: n.x, y: n.y, angle: n.angle, hp: n.hp, ammo: n.ammo, shieldHp: n.shieldHp, shieldBroken: n.shieldBroken })),
      killed: { civil: this.counted.civilKilled, soldier: this.counted.soldierKilled },
      doors: this.doors.filter((d) => d.kind !== 'auto' && (d.phase === 'open' || d.phase === 'opening')).map((d) => d.id),
      buttons: this.buttons.filter((b) => b.pressedSteps >= 0).map((b) => b.id),
      windows: this.windows.filter((p) => p.broken).map((p) => p.id),
      fogs: this.fogs.filter((f) => !f.enabled).map((f) => f.id),
      outlets: this.outlets.map((o) => ({ id: o.id, energyLeft: o.energyLeft, repairLeft: o.repairLeft })),
      chairs: this.chairs.map((c) => ({ id: c.id, x: c.x, y: c.y, angle: c.angle })),
    };
  }

  /**
   * Remet la salle, tout juste construite, dans l'état enregistré : les PNJ tombés avant la sauvegarde ne
   * reviennent pas, les survivants reprennent leur place et leurs points de vie, calmes ; portes, boutons,
   * vitres, brouillards, bornes et chaises sont comme l'équipe les avait laissés.
   */
  private restoreRoom(save: RoomSave): void {
    const alive = new Map(save.npcs.map((n) => [n.id, n]));
    this.npcs = this.npcs.filter((npc) => {
      const was = alive.get(npc.id);
      if (!was) return false;
      npc.x = was.x;
      npc.y = was.y;
      npc.angle = was.angle;
      npc.dir = was.angle;
      npc.hp = was.hp;
      npc.ammo = was.ammo;
      npc.shieldHp = was.shieldHp;
      npc.shieldBroken = was.shieldBroken;
      return true;
    });
    // les morts d'avant la sauvegarde restent comptés
    this.stats.civilKilled += save.killed.civil;
    this.counted.civilKilled += save.killed.civil;
    this.stats.soldierKilled += save.killed.soldier;
    this.counted.soldierKilled += save.killed.soldier;
    for (const door of this.doors) {
      if (!save.doors.includes(door.id)) continue;
      door.phase = 'open';
      door.progress = 1;
      door.stayTimer = door.stayOpenSteps;
      this.updateDoorObstacle(door);
    }
    for (const button of this.buttons) if (save.buttons.includes(button.id)) button.pressedSteps = 1000;
    for (const pane of this.windows) {
      if (!save.windows.includes(pane.id)) continue;
      pane.broken = true;
      pane.obstacle.flags &= ~IS_WINDOW;
    }
    this.fogs = this.fogs.filter((f) => save.fogs.includes(f.id));
    for (const outlet of this.outlets) {
      const was = save.outlets.find((o) => o.id === outlet.id);
      if (!was) continue;
      outlet.energyLeft = was.energyLeft;
      outlet.repairLeft = was.repairLeft;
    }
    for (const chair of this.chairs) {
      const was = save.chairs.find((c) => c.id === chair.id);
      if (!was || (was.x === chair.x && was.y === chair.y)) continue;
      const o = chair.obstacle;
      this.nav.mark(o, -1);
      this.collision.update(o, () => {
        o.cx = was.x + chair.offsetX;
        o.cy = was.y + chair.offsetY;
      });
      this.nav.mark(o, 1);
      chair.x = was.x;
      chair.y = was.y;
      chair.angle = was.angle;
    }
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
  deployHero(withVehicle = false, fullIntro = true): void {
    const arrivalTotal = arrivalDuration(fullIntro);
    // chaque robot arrive dans sa pince, toujours la même (GD-078) : il est posé là où elle se trouve quand
    // le véhicule touche le sol (le véhicule se pose de façon à déposer le joueur 1 sur son point de départ)
    const lead = this.heroes[0];
    const leadClaw = lead ? clawOf(lead.def.name) : null;
    const origin = lead && leadClaw ? { x: lead.x - leadClaw.x, y: lead.y - leadClaw.y } : null;
    for (const h of this.heroes) {
      if (withVehicle && origin && h !== lead) {
        const claw = clawOf(h.def.name);
        const x = origin.x + claw.x;
        const y = origin.y + claw.y;
        if (this.collision.circleFree(x, y, h.def.radius, BLOCK_MOVE)) {
          h.x = x;
          h.y = y;
          h.targetX = x;
          h.targetY = y;
        }
      }
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
    this.introLine = 0;
    this.introLineSteps = 0;
    this.introHold = 0;
    // introduction complète : le journal d'abord, les rotors ne s'entendent qu'à la fin de sa dernière phrase
    this.introRumbled = !(withVehicle && fullIntro);
    if (withVehicle) this.emit(fullIntro ? { type: 'introNews' } : { type: 'vehicleArrives', seconds: arrivalTotal / STEPS_PER_SECOND });
  }

  /**
   * L'hôte passe l'introduction (GD-077) : le véhicule disparaît et les robots joués, déjà à leur place,
   * commencent à se déployer au step suivant.
   */
  skipArrival(): boolean {
    const riding = this.heroes.filter((h) => !h.gone && h.arrivalSteps > 1);
    if (riding.length === 0) return false;
    for (const h of riding) h.arrivalSteps = 1;
    this.introWaiting = false;
    this.introHold = 0;
    this.introLine = 9999; // plus aucune réplique à jouer
    this.emit({ type: 'introSkipped' });
    return true;
  }

  /**
   * Le journal de l'introduction est à l'image (GD-081) : la caméra montre des pièces loin des robots, et
   * personne n'y bouge. Les rondes des gardes et les allées et venues des civils reprennent quand la caméra
   * retrouve le véhicule.
   */
  newsOnAir(): boolean {
    const lead = this.heroes.find((h) => !h.gone && h.arrivalSteps > 0);
    return lead !== undefined && introShot(arrivalPhases(lead.arrivalTotal), lead.arrivalTotal - lead.arrivalSteps).kind !== 'vehicle';
  }

  /**
   * Déroulé de l'introduction (GD-079). L'horloge de l'arrivée s'arrête sur chaque réplique : l'hôte appuie
   * sur la touche de dash pour finir de l'écrire, puis pour passer à la suivante. S'il tient la touche, toute
   * la séquence est passée.
   */
  private stepIntro(host: Input | undefined): void {
    const a = CONFIG.arrival;
    this.introWaiting = false;
    const team = this.heroes.filter((h) => !h.gone && h.arrivalTotal > 0);
    const lead = team.find((h) => h.arrivalSteps > 0);
    if (!lead) {
      this.introHold = 0;
      return;
    }
    if (host?.dash) {
      if (++this.introHold >= a.skipHoldSteps) {
        this.skipArrival();
        return;
      }
    } else {
      this.introHold = 0;
    }
    const t = lead.arrivalTotal - lead.arrivalSteps;
    const phases = arrivalPhases(lead.arrivalTotal);
    const lines = introLines(team.map((h) => h.def.name), lead.arrivalTotal);
    const line = lines[this.introLine];
    if (!line || line.at > t) {
      if (t === phases.hold) this.emit({ type: 'vehicleLeaves', seconds: (phases.total - phases.hold) / STEPS_PER_SECOND });
      return;
    }
    this.introWaiting = true;
    const written = typingSteps(line.text);
    if (line.rumble && !this.introRumbled && this.introLineSteps >= written) {
      this.introRumbled = true;
      this.emit({ type: 'vehicleArrives', seconds: (phases.total - line.at) / STEPS_PER_SECOND });
    }
    if (host?.dashPressed && this.introLineSteps < written) {
      // premier appui : la réplique s'écrit d'un coup
      this.introLineSteps = written;
    } else if (host?.dashPressed || ++this.introLineSteps >= written + a.autoAdvanceSteps) {
      this.introLine++;
      this.introLineSteps = 0;
    }
  }

  // ---------- Régie, plateau, ultimatum (GD-085) ----------

  /** Un robot appuie sur le bouton de la régie : le direct est coupé, la voie du plateau est ouverte. */
  private takeControlRoom(h: Hero): void {
    if (this.level.name !== GROUND_FLOOR || this.session.objective !== OBJ.controlRoom) return;
    this.session.objective = OBJ.studio;
    this.emit({ type: 'radio', speaker: h.def.name, text: CONTROL_ROOM_TAKEN });
  }

  /** Robots vivants à la place du présentateur, sur la marque. */
  private onMark(): Hero[] {
    const { mark } = TV_STUDIO;
    return this.living().filter((h) => Math.hypot(h.x - mark.x, h.y - mark.y) <= CONFIG.broadcast.markRadius);
  }

  /**
   * La marque derrière le pupitre : quand la moitié de l'équipe s'y tient, un compte à rebours démarre ; s'ils
   * la quittent, il s'annule. À zéro, l'ultimatum commence.
   */
  private stepMark(): void {
    const s = this.session;
    if (s.objective === OBJ.studio) {
      const r = TV_STUDIO.room;
      if (this.living().some((h) => h.x > r.x0 && h.x < r.x1 && h.y > r.y0 && h.y < r.y1)) s.objective = OBJ.broadcast;
    }
    const waiting = s.objective === OBJ.broadcast ? this.onMark() : [];
    if (waiting.length === 0 || waiting.length * 2 < this.present().length) {
      this.markCountdown = -1;
      return;
    }
    if (this.markCountdown < 0) this.markCountdown = CONFIG.broadcast.countdownSteps;
    if (--this.markCountdown > 0) return;
    this.markCountdown = -1;
    const reader = waiting.find((h) => h.def.name === castReader(waiting.map((o) => o.def.name))) ?? waiting[0];
    this.cast = 0;
    this.castScene = SCENE.ultimatum;
    this.castReader = reader.id;
    this.castSirens = false;
    this.introLine = 0;
    this.introLineSteps = 0;
    this.introHold = 0;
    // ceux qui sont derrière le pupitre regardent les caméras ; les balles en vol disparaissent
    for (const h of waiting) {
      h.angle = Math.PI;
      h.moving = false;
    }
    this.bullets.length = 0;
    this.seekers.length = 0;
    this.emit({ type: 'castStart' });
  }

  /**
   * Le face-à-face avec le barrage (GD-088) : l'équipe arrive sur le parking sud et tombe sur la police. Le monde
   * se fige, un policier somme les robots de se rendre, l'un d'eux répond. À la fin, la police ouvre le feu.
   */
  startStandoff(): void {
    if (this.cast >= 0) return;
    this.cast = 0;
    this.castScene = SCENE.standoff;
    this.castReader = standoffSpeaker(this);
    this.introLine = 0;
    this.introLineSteps = 0;
    this.introHold = 0;
    this.bullets.length = 0;
    this.seekers.length = 0;
    // le brouillard du parking finit de se lever d'un coup : figé à mi-course, il voilerait toute la scène
    const p = TV_STUDIO.parkings.south;
    this.fogs = this.fogs.filter((f) => f.x + f.w <= p.x0 || f.x >= p.x1 || f.y + f.h <= p.y0 || f.y >= p.y1);
    // les portes du parking s'ouvrent en grand : la scène commence à la porte, il faut voir le barrage (GD-092)
    for (const door of this.doors) {
      if (door.kind !== 'auto' || !TV_STUDIO.wave.doors.some((d) => Math.hypot(door.x - d.x, door.y - d.y) < 40)) continue;
      door.phase = 'open';
      door.progress = 1;
      door.stayTimer = door.stayOpenSteps;
      this.updateDoorObstacle(door);
    }
    const team = this.living();
    for (const h of team) h.moving = false;
    // la ligne de police tient les robots en joue
    for (const npc of this.npcs) {
      if (npc.hunt !== HOLDING || team.length === 0) continue;
      const target = team.reduce((best, h) => (Math.hypot(h.x - npc.x, h.y - npc.y) < Math.hypot(best.x - npc.x, best.y - npc.y) ? h : best));
      npc.angle = Math.atan2(target.y - npc.y, target.x - npc.x);
      npc.dir = npc.angle;
    }
    this.emit({ type: 'standoff' });
  }

  /** Séquence en cours : mêmes règles que l'introduction (GD-079), l'hôte lit à son rythme ou passe tout. */
  private stepCast(host: Input | undefined): void {
    if (this.ended) return;
    const a = CONFIG.arrival;
    if (host?.dash) {
      if (++this.introHold >= a.skipHoldSteps) {
        this.endCast(true);
        return;
      }
    } else {
      this.introHold = 0;
    }
    const line = sceneLines(this)[this.introLine];
    if (!line || line.at > this.cast) {
      if (++this.cast >= sceneTotal(this)) this.endCast(false);
      else if (this.castScene === SCENE.pickup) {
        // le véhicule redécolle avec l'équipe ; puis le communiqué passe à l'antenne
        const p = pickupPhases();
        if (this.cast === p.grab) this.emit({ type: 'vehicleLeaves', seconds: (p.flyOut - p.grab) / STEPS_PER_SECOND });
        if (this.cast === p.watch) this.emit({ type: 'pickupNews' });
      }
      return;
    }
    const written = typingSteps(line.text);
    if (line.siren && !this.castSirens && this.introLineSteps >= written) {
      this.castSirens = true;
      this.emit({ type: 'sirens' });
    }
    if (host?.dashPressed && this.introLineSteps < written) {
      this.introLineSteps = written;
    } else if (host?.dashPressed || ++this.introLineSteps >= written + a.autoAdvanceSteps) {
      this.introLine++;
      this.introLineSteps = 0;
    }
  }

  /**
   * Fin de l'ultimatum, lu ou passé : la consigne suivante s'affiche et un point de sauvegarde est posé sur le
   * plateau. Après un échec, l'équipe y reprend sans relire le message, portes déjà franchies ouvertes.
   */
  private endCast(skipped: boolean): void {
    if (this.castScene === SCENE.pickup) {
      // l'extraction est la fin du niveau : la séquence reste sur son dernier plan, sous l'écran de fin
      if (this.ended) return;
      this.ended = true;
      this.cast = sceneTotal(this);
      this.introLine = 9999;
      this.introLineSteps = 0;
      this.introHold = 0;
      this.emit({ type: 'levelEnd' });
      return;
    }
    this.cast = -1;
    this.introLine = 9999;
    this.introLineSteps = 0;
    this.introHold = 0;
    const s = this.session;
    if (this.castScene === SCENE.standoff) {
      // le plan B est dit : la police tire, les renforts suivent (GD-088)
      engage(this);
      this.emit({ type: 'standoffEnd', skipped });
      return;
    }
    s.objective = OBJ.dropPoint;
    s.checkpoint = { ...studioCheckpoint(), save: this.saveRoom() };
    s.preOpened[this.level.name] = studioDoors();
    if (!this.castSirens) this.emit({ type: 'sirens' });
    this.castSirens = true;
    this.emit({ type: 'castEnd', skipped });
  }

  // ---------- La sortie par le portail nord (GD-089) ----------

  private northGates(): Door[] {
    return this.doors.filter((d) => d.kind === 'button' && d.doorId === CONFIG.exit.gates);
  }

  /**
   * Le repli par le nord (GD-089, GD-092). Les portails s'ouvrent comme une porte ordinaire ; ouverts, la voix
   * du véhicule donne la zone d'extraction, dehors, au nord du bâtiment. L'extraction commence quand toute
   * l'équipe y est, vivante : on ne part pas sans tous les robots. Un robot à terre doit d'abord être relevé.
   */
  private stepExit(): void {
    const s = this.session;
    const open = this.northGates().every((d) => d.phase === 'open');
    // une équipe sortie par le nord sans être passée par le sud : la police se lance quand même
    if (s.objective === OBJ.dropPoint && open && this.living().some((h) => h.y < this.northGates()[0].y - 60 && h.x > TV_STUDIO.room.x0)) engage(this);
    if (s.objective === OBJ.northGate && open) {
      s.objective = OBJ.getOut;
      this.emit({ type: 'radio', speaker: vehicleVoice(s.heroNames), text: EXTRACTION_CALL });
    }
    if (s.objective < OBJ.getOut || this.cast >= 0) return;
    const team = this.present();
    if (team.length === 0 || !team.every((h) => this.inExitZone(h))) return;
    this.cast = 0;
    this.castScene = SCENE.pickup;
    this.introLine = 0;
    this.introLineSteps = 0;
    this.introHold = 0;
    this.bullets.length = 0;
    this.seekers.length = 0;
    for (const h of team) h.moving = false;
    this.emit({ type: 'pickup' });
  }

  /** Ce robot est-il debout dans la zone d'extraction ? */
  inExitZone(h: Hero): boolean {
    const z = TV_STUDIO.exit.zone;
    return !h.gone && h.state !== 'dead' && Math.hypot(h.x - z.x, h.y - z.y) <= z.radius;
  }

  /** Le niveau est fini (l'extraction a eu lieu, ou le boss de la zone de forage est tombé). */
  get levelEnded(): boolean {
    return this.ended;
  }

  /** Passe la séquence en cours (caméra libre). */
  skipCast(): void {
    if (this.cast >= 0) this.endCast(true);
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
    if (this.level.name === DRILL_AREA) return DRILL_OBJECTIVES[this.drills.every((d) => d.destroyed) ? 1 : 0];
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
    this.seekers.length = 0;
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
      tint: inst.tint, alpha: inst.alpha, depth: inst.depth, frame, shadow: Number(inst.props.shadow ?? 0), order: this.order,
    });
  }

  private addInstance(inst: LevelInstance): void {
    // rang de l'instance dans la salle : l'ordre du fichier décide de ce qui est dessiné devant (GD-095)
    this.order++;
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
        vx: 0, vy: 0, thrown: 0, offsetX: o.cx - inst.x, offsetY: o.cy - inst.y, obstacle: o, depth: inst.depth, order: this.order,
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
      shieldUp: false, tanked: 0,
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
  /** Rang du héros dont le joueur mène l'introduction : l'hôte de la partie (0 en solo). */
  hostSlot = 0;
  /** Introduction : rang de la réplique en cours (ou de la prochaine), et steps depuis qu'elle s'écrit. */
  introLine = 0;
  introLineSteps = 0;
  /** Steps depuis lesquels l'hôte tient la touche qui passe la séquence. */
  introHold = 0;
  /** Une réplique est à l'écran : l'horloge de l'arrivée est arrêtée. */
  introWaiting = false;
  /** Les rotors du véhicule ont commencé à se faire entendre. */
  private introRumbled = true;
  /**
   * Ultimatum (GD-085) : son horloge, en steps, ou -1 hors de la séquence. Ses répliques réutilisent
   * `introLine`, `introLineSteps` et `introHold` : une seule séquence joue à la fois.
   */
  cast = -1;
  /** Laquelle joue : l'ultimatum, ou le face-à-face avec le barrage (`SCENE`). */
  castScene = 0;
  /** Rang du robot qui lit le message, ou qui répond à la police. */
  castReader = 0;
  /** Steps restants avant le début de l'ultimatum quand l'équipe est sur la marque, -1 sinon. */
  markCountdown = -1;
  private castSirens = false;
  /**
   * La riposte (GD-086, GD-087) : -1 avant l'ultimatum ; 0 quand la police est en place au sud et attend ;
   * puis les steps écoulés depuis que la police a ouvert le feu.
   */
  waveSteps = -1;
  /** Soldats du premier groupe posés devant les fourgons. */
  waveHeld = 0;
  /** Steps avant l'annonce radio du plan B, quand la riposte part sans face-a-face ; 0 sinon. */
  wavePlanB = 0;
  private vansParked = false;

  step(inputs: Input | Input[]): void {
    this.tick++;
    const list = Array.isArray(inputs) ? inputs : [inputs];
    if (this.cast >= 0) {
      // l'ultimatum est à l'antenne : tout le niveau est figé, seules ses répliques avancent
      this.stepCast(list[this.hostSlot]);
      return;
    }
    this.stepIntro(list[this.hostSlot]);
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
    if (!this.newsOnAir()) stepNpcs(this);
    this.stepDoors();
    this.stepBullets();
    stepAbilityObjects(this);
    stepEffects(this);
    this.stepZones();
    this.stepFogs();
    this.stepObjectives();
  }

  // ---------- Dégâts ----------

  /**
   * Dégât infligé au héros. Chaque coup compte : il n'y a plus d'invulnérabilité après un dégât (GD-070).
   * Il ne reste que celle du réveil après une résurrection ; `ignoreInvuln` : le coup de bouclier passe outre.
   */
  damageHero(h: Hero, amount: number, ignoreInvuln = false): boolean {
    if (h.gone || h.hp <= 0 || h.state === 'dead') return false;
    // intouchable pendant un dash (GD-031), pendant le déploiement et en plein bond (ulti de BatBot)
    if (h.dashing || h.deploySteps > 0 || h.ultiPhase === 2) return false;
    if (h.invuln > 0 && !ignoreInvuln) return false;
    h.hp -= amount;
    this.stats.damageTaken += amount;
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
      if (button.doorId === CONFIG.broadcast.controlRoomButton) this.takeControlRoom(h);
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
        this.emit({ type: 'notify', text: card.color === 'green' ? 'Green card found' : 'Studio pass found - purple card' });
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

  /**
   * Enchaînement des consignes de TvTv² (GD-010, GD-085). La zone de sortie d'origine (`exitZone`, dehors au
   * nord) ne mène plus à la zone de forage : la sortie du niveau sera le portail nord (livraison C3).
   */
  private stepObjectives(): void {
    const s = this.session;
    // zone de forage, jouable depuis le menu : détruire les foreuses, puis tuer le boss ; l'ordre réel importe peu
    if (this.level.name === DRILL_AREA) {
      if (!this.ended && this.drills.every((d) => d.destroyed) && !this.npcs.some((n) => n.def.kind === 'boss')) {
        if (this.endTimer < 0) this.endTimer = CONFIG.boss.endDelaySteps;
        if (--this.endTimer <= 0) {
          this.ended = true;
          this.emit({ type: 'levelEnd' });
        }
      }
      return;
    }
    if (s.objective === OBJ.upstairs && this.level.name === UPPER_FLOOR) s.objective = OBJ.pass;
    if (s.objective === OBJ.pass && s.carried.has('purple')) s.objective = OBJ.downstairs;
    if (s.objective === OBJ.downstairs && this.level.name === GROUND_FLOOR) s.objective = OBJ.controlRoom;
    if (this.level.name !== GROUND_FLOOR) return;
    this.stepMark();
    // après l'ultimatum, la police se met en place au sud ; au retour sur le plateau après un échec, aussi
    if (s.objective >= OBJ.dropPoint && this.cast < 0) {
      if (this.waveSteps < 0) stageWave(this);
      else stepWave(this);
      this.stepExit();
    }
  }

  /** Les fourgons de police se garent sur le parking sud (GD-086) : des obstacles comme les autres meubles. */
  parkVans(): void {
    if (this.vansParked) return;
    this.vansParked = true;
    for (const [i, van] of TV_STUDIO.wave.vans.entries()) {
      this.addInstance({
        id: `wave_van_${i}`, object: 'obj_pk_police_van', layer: 'layer_deco', depth: 200, x: van.x, y: van.y, angle: van.angle,
        scaleX: 1, scaleY: 1, tint: '#ffffff', alpha: 1, props: { bulletCrossed: false },
      });
    }
  }

  /** Fait apparaître un PNJ en cours de partie. `angle` en degrés GameMaker. */
  spawnNpc(object: string, x: number, y: number, angle: number): Npc | null {
    const count = this.npcs.length;
    this.addInstance({ id: `spawn_${this.nextId}`, object, layer: 'layer_npc', depth: 0, x, y, angle, scaleX: 1, scaleY: 1, tint: '#ffffff', alpha: 1, props: {} });
    return this.npcs.length > count ? this.npcs[this.npcs.length - 1] : null;
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
