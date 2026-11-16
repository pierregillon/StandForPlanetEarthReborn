// Monde « miroir » d'un client en partie réseau (ADR-014).
// Il est construit depuis la même salle que le monde du serveur, puis tenu à jour par les instantanés reçus.
// Il n'appelle jamais world.step : le serveur seul fait avancer le jeu. Trois choses sont calculées ici pour
// masquer le délai du réseau : le robot du joueur est prédit avec ses propres entrées, les autres personnages
// glissent d'un instantané au suivant, les balles avancent seules entre deux nouvelles.
import { CONFIG } from '../sim/config.ts';
import { BLOCK_BULLET, IS_WINDOW, angleDiff } from '../sim/geom.ts';
import { steerHero } from '../sim/hero.ts';
import { ULTI_ACTION, placeLeap } from '../sim/ulti.ts';
import { createSession } from '../sim/session.ts';
import type { Bullet, Chair, Door, Hero, Input, LevelData, SimEvent, SpriteManifest, WindowPane } from '../sim/types.ts';
import { World } from '../sim/world.ts';
import { SNAPSHOT_EVERY, packInput, unpackInput } from './messages.ts';
import type { RoomStart } from './messages.ts';
import { SnapshotDecoder } from './snapshot.ts';
import type { Entity, Snapshot } from './snapshot.ts';

/** Listes dont les entités glissent d'une position reçue à la suivante. */
const GLIDING = new Set(['heroes', 'npcs', 'bats', 'drones', 'turret']);
/** Durée du glissement : un peu plus que l'écart entre deux instantanés, pour absorber leur irrégularité. */
const GLIDE_MS = (SNAPSHOT_EVERY * 1000 / 60) * 1.25;
/** Au-delà de cet écart, l'entité est placée d'un coup (apparition, changement de salle). */
const TELEPORT_DISTANCE = 400;
/** Entrées gardées pour être rejouées : au-delà, la connexion est de toute façon trop en retard. */
const MAX_PENDING = 120;

interface Glide {
  x0: number; y0: number; a0: number;
  x1: number; y1: number; a1: number;
  t: number;
  /** Instantané qui a lancé ce glissement. */
  n: number;
}

type Moving = { x: number; y: number; angle: number; walkDist?: number };

export class Mirror {
  readonly world: World;
  /** Rang du héros du joueur local. */
  readonly me: number;
  readonly epoch: number;
  readonly playerNames: string[];
  private readonly decoder = new SnapshotDecoder();
  /** Mon héros tel que le serveur le connaît (le héros affiché, lui, est en avance : il est prédit). */
  private readonly shadow: Entity = {};
  /** Mes entrées envoyées que le serveur n'a pas encore jouées. */
  private pending: { q: number; input: Input }[] = [];
  private seq = 0;
  private readonly glides = new Map<Entity, Glide>();
  /** Au moins un instantané reçu : le monde affiché est celui du serveur. */
  ready = false;

  constructor(level: LevelData, sprites: SpriteManifest, start: RoomStart) {
    const session = createSession(start.heroNames, start.room);
    session.spawnNumber = start.spawn;
    this.world = new World(level, sprites, start.heroNames, 1, session);
    this.world.viewHero = start.you;
    this.me = start.you;
    this.epoch = start.epoch;
    this.playerNames = start.playerNames;
  }

  private get hero(): Hero {
    return this.world.heroes[this.me];
  }

  /** Applique un instantané du serveur. `ack` : dernière de mes entrées que le serveur a jouée. */
  receive(snap: Snapshot, ack: number, events: SimEvent[] = []): void {
    const world = this.world;
    const mine = this.hero as unknown as Entity;
    const direct = snap.full === true;
    this.decoder.apply(world, snap, {
      intercept: (list, e, key, value, fresh) => {
        if (e === mine) {
          this.shadow[key] = value;
          return true;
        }
        if (direct || fresh || !GLIDING.has(list) || (key !== 'x' && key !== 'y' && key !== 'angle')) return false;
        this.glideTo(e, key, value as number, snap.n);
        return true;
      },
      changed: (list, e, keys) => {
        if (list === 'doors' && keys.includes('progress')) world.updateDoorObstacle(e as unknown as Door);
        else if (list === 'chairs' && (keys.includes('x') || keys.includes('y'))) this.moveChair(e as unknown as Chair);
        else if (list === 'windows' && keys.includes('broken')) (e as unknown as WindowPane).obstacle.flags &= ~IS_WINDOW;
        else if (list === 'bullets') e.spent = false;
      },
      removed: (_list, e) => {
        this.glides.delete(e);
      },
    });
    for (const e of events) world.emit(e);

    // mon héros : on repart de l'état du serveur et on rejoue les entrées qu'il n'a pas encore vues
    this.pending = this.pending.filter((p) => p.q > ack);
    Object.assign(mine, this.shadow);
    for (const p of this.pending) this.predict(p.input);
    this.ready = true;
  }

  private glideTo(e: Entity, key: 'x' | 'y' | 'angle', value: number, n: number): void {
    const m = e as unknown as Moving;
    let g = this.glides.get(e);
    if (!g) this.glides.set(e, (g = { x0: m.x, y0: m.y, a0: m.angle, x1: m.x, y1: m.y, a1: m.angle, t: 0, n }));
    if (g.n !== n) {
      // nouvel instantané : on repart de la position affichée
      g.n = n;
      g.x0 = m.x;
      g.y0 = m.y;
      g.a0 = m.angle;
      g.t = 0;
    }
    if (key === 'x') g.x1 = value;
    else if (key === 'y') g.y1 = value;
    else g.a1 = value;
  }

  private moveChair(chair: Chair): void {
    const o = chair.obstacle;
    this.world.collision.update(o, () => {
      o.cx = chair.x + chair.offsetX;
      o.cy = chair.y + chair.offsetY;
    });
  }

  /** Mon robot obéit tout de suite à mes commandes, avec le même code de déplacement que le serveur. */
  private predict(input: Input): void {
    const h = this.hero;
    if (h.gone || h.state === 'dead' || h.arrivalSteps > 0 || h.deploySteps > 0 || h.reviving >= 0) return;
    if (h.ultiPhase > 0) {
      // ulti : immobile pendant le lancement ; le bond de BatBot, lui, se calcule ici comme sur le serveur
      if (h.ultiPhase === ULTI_ACTION) {
        h.ultiSteps++;
        placeLeap(h);
      }
      return;
    }
    steerHero(this.world, h, input);
    if (h.state !== 'firing1' && h.state !== 'firing2') h.state = h.moving ? 'walking' : 'standing';
  }

  /**
   * Un step côté client : prédit mon héros et fait avancer ce que le client extrapole.
   * Retourne l'entrée à envoyer au serveur.
   */
  tick(input: Input): { q: number; v: number[] } {
    const v = packInput(input);
    // on prédit avec l'entrée telle que le serveur la recevra (visée arrondie), pour obtenir le même résultat
    const sent = unpackInput(v);
    const q = ++this.seq;
    this.pending.push({ q, input: sent });
    if (this.pending.length > MAX_PENDING) this.pending.shift();
    if (this.ready) this.predict(sent);
    for (const b of this.world.bullets) this.coast(b);
    for (const e of this.world.explosions) if (e.step < e.totalSteps - 1) e.step++;
    // compteurs d'animation : ils avancent d'un par step, le serveur ne les renvoie que quand ils repartent
    for (const npc of this.world.npcs) npc.stateSteps++;
    for (const h of this.world.heroes) h.sinceShot++;
    if (typeof this.shadow.sinceShot === 'number') this.shadow.sinceShot++;
    return { q, v };
  }

  /** Une balle vole en ligne droite entre deux nouvelles du serveur ; à un mur, elle attend son verdict. */
  private coast(b: Bullet): void {
    if (b.spent) return;
    b.steps++;
    const bounce = b.def.kind === 'bounce';
    if (bounce) {
      b.speed -= CONFIG.abilities.engiBot.bulletDeceleration;
      if (b.speed < CONFIG.abilities.engiBot.bulletMinSpeed) {
        b.spent = true;
        return;
      }
    }
    const nx = b.x + Math.cos(b.angle) * b.speed;
    const ny = b.y + Math.sin(b.angle) * b.speed;
    const wall = this.world.collision.raycast(b.x, b.y, nx, ny, BLOCK_BULLET);
    if (!wall) {
      b.x = nx;
      b.y = ny;
      return;
    }
    b.x += (nx - b.x) * wall.t;
    b.y += (ny - b.y) * wall.t;
    b.spent = true;
  }

  /** À chaque image : fait glisser les personnages vers leur dernière position reçue. */
  frame(dtMs: number): void {
    for (const [e, g] of this.glides) {
      const m = e as unknown as Moving;
      if (Math.hypot(g.x1 - g.x0, g.y1 - g.y0) > TELEPORT_DISTANCE) g.t = 1;
      else g.t = Math.min(1, g.t + dtMs / GLIDE_MS);
      const x = g.x0 + (g.x1 - g.x0) * g.t;
      const y = g.y0 + (g.y1 - g.y0) * g.t;
      // distance parcourue : c'est elle qui anime les jambes
      if (m.walkDist !== undefined && g.t < 1) m.walkDist += Math.hypot(x - m.x, y - m.y);
      m.x = x;
      m.y = y;
      m.angle = g.a0 + angleDiff(g.a0, g.a1) * g.t;
      if (g.t >= 1) this.glides.delete(e);
    }
  }
}
