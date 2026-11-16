// Partie multijoueur côté serveur (ADR-014) : le salon où l'on choisit son robot, puis la simulation, qui
// tourne ici et fait autorité. Les navigateurs envoient leurs entrées et reçoivent des instantanés.
// Ce fichier ne connaît pas les WebSockets : il parle à des « pairs » abstraits, ce qui le rend testable.
import { CONFIG } from '../src/sim/config.ts';
import { isFreshStart, openRoom, retrySession } from '../src/sim/match.ts';
import { GROUND_FLOOR, createSession } from '../src/sim/session.ts';
import type { Session } from '../src/sim/session.ts';
import { NO_INPUT } from '../src/sim/types.ts';
import type { Hero, Input, LevelData, SimEvent, SpriteManifest } from '../src/sim/types.ts';
import type { World } from '../src/sim/world.ts';
import { MAX_PLAYERS, SNAPSHOT_EVERY, unpackInput } from '../src/net/messages.ts';
import type { ClientMessage, LobbyState, RoomStart, ServerMessage } from '../src/net/messages.ts';
import { SnapshotEncoder } from '../src/net/snapshot.ts';

/** Un navigateur connecté. */
export interface Peer {
  id: number;
  name: string;
  send(text: string): void;
}

interface Player {
  peer: Peer;
  hero: string | null;
  /** Rang de son héros dans l'équipe, fixé au début de la partie. */
  slot: number;
  /** Entrées reçues, pas encore jouées : une par step. */
  queue: { q: number; input: Input }[];
  last: Input;
  /** Numéro de la dernière entrée jouée, renvoyé au client pour qu'il recale sa prédiction. */
  ack: number;
  /** Steps écoulés sans entrée reçue. */
  starved: number;
}

type Phase = 'closed' | 'lobby' | 'playing' | 'lost' | 'won';

/** Steps d'attente au plus pour qu'un client ait chargé une salle (20 s). */
const READY_TIMEOUT_STEPS = 20 * 60;
/** Sans entrée reçue depuis ce nombre de steps, le robot s'arrête (onglet masqué, connexion figée). */
const STARVED_STEPS = 12;
const MAX_QUEUE = 6;

export class Lobby {
  private phase: Phase = 'closed';
  private players: Player[] = [];
  private hostId = -1;
  private session: Session | null = null;
  private world: World | null = null;
  private readonly encoder = new SnapshotEncoder();
  private epoch = 0;
  /** Joueurs dont on attend qu'ils aient chargé la salle. */
  private readonly waiting = new Set<number>();
  private waitSteps = 0;
  /** Rangs des héros dont le joueur est parti. */
  private readonly gone = new Set<number>();
  private events: SimEvent[] = [];
  private readonly levels: Record<string, LevelData>;
  private readonly sprites: SpriteManifest;
  /** Tous les navigateurs connectés, y compris ceux restés au menu : ils voient si une partie est ouverte. */
  private readonly audience: () => Peer[];
  /** Accepte les commandes de développement (téléportation). Jamais sur un serveur ouvert à d'autres. */
  private readonly debug: boolean;

  constructor(levels: Record<string, LevelData>, sprites: SpriteManifest, audience: () => Peer[], debug = false) {
    this.levels = levels;
    this.sprites = sprites;
    this.audience = audience;
    this.debug = debug;
  }

  get playing(): boolean {
    return this.phase === 'playing';
  }

  /** Monde en cours (tests et mesures). */
  get currentWorld(): World | null {
    return this.world;
  }

  get playerCount(): number {
    return this.players.length;
  }

  // ---------- Salon ----------

  state(peer: Peer): LobbyState {
    return {
      t: 'lobby',
      open: this.phase === 'lobby' && this.players.length < MAX_PLAYERS,
      playing: this.phase !== 'closed' && this.phase !== 'lobby',
      host: this.hostId,
      players: this.players.map((p) => ({ id: p.peer.id, name: p.peer.name, hero: p.hero })),
      you: peer.id,
      joined: this.players.some((p) => p.peer === peer),
    };
  }

  private broadcastLobby(): void {
    for (const peer of this.audience()) send(peer, this.state(peer));
  }

  private player(peer: Peer): Player | undefined {
    return this.players.find((p) => p.peer === peer);
  }

  private addPlayer(peer: Peer): void {
    this.players.push({ peer, hero: null, slot: -1, queue: [], last: NO_INPUT, ack: 0, starved: 0 });
  }

  handle(peer: Peer, msg: ClientMessage): void {
    const me = this.player(peer);
    switch (msg.t) {
      case 'create':
        if (this.phase !== 'closed') return send(peer, { t: 'error', text: 'A game already exists. Join it instead.' });
        this.phase = 'lobby';
        this.hostId = peer.id;
        this.addPlayer(peer);
        return this.broadcastLobby();
      case 'join':
        if (me) return this.broadcastLobby();
        if (this.phase === 'closed') return send(peer, { t: 'error', text: 'No game to join yet.' });
        if (this.phase !== 'lobby') return send(peer, { t: 'error', text: 'The game has already started.' });
        if (this.players.length >= MAX_PLAYERS) return send(peer, { t: 'error', text: 'The game is full.' });
        this.addPlayer(peer);
        return this.broadcastLobby();
      case 'pick': {
        if (!me || this.phase !== 'lobby') return;
        const hero = msg.hero;
        if (hero !== null && (!Object.hasOwn(CONFIG.heroes, hero) || this.players.some((p) => p !== me && p.hero === hero))) {
          // robot inconnu ou déjà pris : le salon renvoyé montre le choix resté en place
          return send(peer, this.state(peer));
        }
        me.hero = hero;
        return this.broadcastLobby();
      }
      case 'start':
        if (!me || this.phase !== 'lobby' || peer.id !== this.hostId) return;
        if (this.players.some((p) => p.hero === null)) return send(peer, { t: 'error', text: 'Every player must pick a robot first.' });
        return this.startMatch();
      case 'ready':
        if (me && msg.epoch === this.epoch) this.waiting.delete(peer.id);
        return;
      case 'i':
        if (me && this.phase === 'playing' && msg.e === this.epoch && Array.isArray(msg.v)) me.queue.push({ q: Number(msg.q) || 0, input: unpackInput(msg.v) });
        return;
      case 'retry':
        if (!me || this.phase !== 'lost' || peer.id !== this.hostId || !this.session) return;
        this.session = retrySession(this.session);
        this.phase = 'playing';
        return this.enterRoom(null);
      case 'leave':
        return this.disconnect(peer);
      case 'teleport': {
        const h = me && this.debug ? this.world?.heroes[me.slot] : null;
        if (h && Number.isFinite(msg.x) && Number.isFinite(msg.y)) {
          h.x = msg.x;
          h.y = msg.y;
        }
        return;
      }
      default:
        return;
    }
  }

  /** Un joueur quitte le salon ou la partie (bouton, onglet fermé, connexion perdue). */
  disconnect(peer: Peer): void {
    const me = this.player(peer);
    if (!me) return;
    this.players = this.players.filter((p) => p !== me);
    this.waiting.delete(peer.id);
    if (me.slot >= 0) {
      this.gone.add(me.slot);
      this.world?.removeHero(me.slot);
    }
    if (this.players.length === 0) {
      this.close();
    } else if (peer.id === this.hostId) {
      this.hostId = this.players[0].peer.id;
    }
    this.broadcastLobby();
  }

  private close(): void {
    this.phase = 'closed';
    this.hostId = -1;
    this.session = null;
    this.world = null;
    this.gone.clear();
    this.waiting.clear();
  }

  // ---------- Partie ----------

  private startMatch(): void {
    this.players.forEach((p, slot) => {
      p.slot = slot;
    });
    this.gone.clear();
    this.session = createSession(this.players.map((p) => p.hero ?? 'PetBot'));
    this.phase = 'playing';
    this.broadcastLobby();
    this.enterRoom(null);
  }

  /** Ouvre la salle courante de la partie et l'annonce aux joueurs, qui la chargent avant que le jeu reprenne. */
  private enterRoom(arriving: Hero[] | null): void {
    const session = this.session;
    if (!session) return;
    const fresh = isFreshStart(session, arriving);
    const world = openRoom(session, this.levels[session.room], this.sprites, arriving, (Date.now() & 0xffff) + 1);
    for (const slot of this.gone) world.removeHero(slot);
    // au rez-de-chaussée, le véhicule de largage amène l'équipe (GD-035)
    if (fresh) world.deployHero(session.room === GROUND_FLOOR);
    this.world = world;
    this.encoder.reset();
    this.events = [];
    this.epoch++;
    this.waitSteps = 0;
    this.waiting.clear();
    const playerNames: string[] = [];
    for (const p of this.players) playerNames[p.slot] = p.peer.name;
    for (const p of this.players) {
      p.queue = [];
      p.starved = 0;
      p.ack = 0;
      this.waiting.add(p.peer.id);
      const start: RoomStart = {
        t: 'room', room: session.room, spawn: session.spawnNumber, heroNames: session.heroNames, playerNames,
        you: p.slot, epoch: this.epoch,
      };
      send(p.peer, start);
    }
  }

  /** Un step de simulation. Appelé 60 fois par seconde par l'horloge du serveur. */
  tick(): void {
    const world = this.world;
    const session = this.session;
    if (this.phase !== 'playing' || !world || !session) return;
    if (this.waiting.size > 0 && ++this.waitSteps < READY_TIMEOUT_STEPS) return;
    this.waiting.clear();

    const inputs: Input[] = [];
    for (const p of this.players) inputs[p.slot] = this.nextInput(p);
    world.step(inputs);

    let nextRoom: { room: string; spawn: number } | null = null;
    for (const e of world.drainEvents()) {
      if (e.type === 'changeRoom') nextRoom = e;
      else if (e.type === 'levelEnd') this.phase = 'won';
      else this.events.push(e);
    }
    if (this.phase === 'playing' && world.gameOver) this.phase = 'lost';

    if (nextRoom && this.phase === 'playing' && this.levels[nextRoom.room]) {
      session.room = nextRoom.room;
      session.spawnNumber = nextRoom.spawn;
      this.enterRoom(world.heroes);
      return;
    }
    if (world.tick % SNAPSHOT_EVERY === 0 || this.phase !== 'playing') this.sendSnapshot(world);
    if (this.phase === 'lost') this.broadcast({ t: 'over' });
    if (this.phase === 'won') this.broadcast({ t: 'won', stats: session.stats });
  }

  /** Entrée à jouer ce step pour un joueur : la suivante de sa file, à défaut la dernière connue. */
  private nextInput(p: Player): Input {
    // file trop longue (rafale après un trou de connexion) : on rattrape en gardant les appuis de touche
    while (p.queue.length > MAX_QUEUE) {
      const dropped = p.queue.shift();
      const next = p.queue[0];
      if (!dropped || !next) break;
      next.input.dashPressed ||= dropped.input.dashPressed;
      next.input.usePressed ||= dropped.input.usePressed;
      next.input.reloadPressed ||= dropped.input.reloadPressed;
    }
    const next = p.queue.shift();
    if (next) {
      p.last = next.input;
      p.ack = next.q;
      p.starved = 0;
      return next.input;
    }
    if (++p.starved > STARVED_STEPS) return { ...NO_INPUT, aimX: p.last.aimX, aimY: p.last.aimY };
    return { ...p.last, dashPressed: false, usePressed: false, reloadPressed: false };
  }

  private sendSnapshot(world: World): void {
    const snap = JSON.stringify(this.encoder.encode(world));
    const events = this.events.length > 0 ? `,"ev":${JSON.stringify(this.events)}` : '';
    this.events = [];
    for (const p of this.players) p.peer.send(`{"t":"s","epoch":${this.epoch},"ack":${p.ack},"snap":${snap}${events}}`);
  }

  private broadcast(msg: ServerMessage): void {
    for (const p of this.players) send(p.peer, msg);
  }

  /** Mesure : nombre de valeurs envoyées par champ depuis le début (pour repérer ce qui pèse sur le réseau). */
  traffic(): [string, number][] {
    return [...this.encoder.sent].sort((a, b) => b[1] - a[1]);
  }
}

function send(peer: Peer, msg: ServerMessage): void {
  peer.send(JSON.stringify(msg));
}
