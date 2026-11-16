// Connexion du navigateur au serveur de partie (ADR-014) : une WebSocket, gardée d'une scène à l'autre.
import Phaser from 'phaser';
import type { ClientMessage, LoadingPlayer, LobbyState, RoomStart, ServerMessage } from '../../net/messages.ts';

const REGISTRY_KEY = 'connection';

export class Connection {
  private readonly ws: WebSocket;
  /** Dernier état du salon reçu. */
  lobby: LobbyState | null = null;
  /** Dernière salle annoncée par le serveur : la scène de jeu s'ouvre dessus. */
  room: RoomStart | null = null;
  /** Joueurs qui chargent encore cette salle : tant qu'il en reste, le jeu est à l'arrêt pour tout le monde. */
  waiting: LoadingPlayer[] = [];
  /** Messages de jeu reçus depuis cette annonce, à traiter par la scène de jeu. */
  private inbox: ServerMessage[] = [];
  /** Dernier refus du serveur (partie pleine, déjà commencée...). */
  error = '';
  closed = false;
  private readonly outbox: string[] = [];

  constructor(name: string) {
    const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${scheme}://${window.location.host}/ws`);
    this.ws.onopen = () => {
      for (const text of this.outbox.splice(0)) this.ws.send(text);
    };
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data)) as ServerMessage;
      if (msg.t === 'lobby') this.lobby = msg;
      else if (msg.t === 'error') this.error = msg.text;
      else if (msg.t === 'wait') this.waiting = msg.players;
      else if (msg.t === 'room') {
        // nouvelle salle : ce qui restait à traiter concernait la précédente
        this.room = msg;
        this.inbox = [];
      } else this.inbox.push(msg);
    };
    this.ws.onclose = () => {
      this.closed = true;
    };
    this.send({ t: 'hello', name });
  }

  send(msg: ClientMessage): void {
    const text = JSON.stringify(msg);
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(text);
    else if (this.ws.readyState === WebSocket.CONNECTING) this.outbox.push(text);
  }

  /** Messages de jeu reçus depuis le dernier appel. */
  take(): ServerMessage[] {
    return this.inbox.splice(0);
  }

  get isHost(): boolean {
    return this.lobby !== null && this.lobby.host === this.lobby.you;
  }

  close(): void {
    this.closed = true;
    this.ws.close();
  }

  // ---------- Partage entre les scènes ----------

  static current(scene: Phaser.Scene): Connection | null {
    const conn = scene.registry.get(REGISTRY_KEY) as Connection | null | undefined;
    return conn && !conn.closed ? conn : null;
  }

  static open(scene: Phaser.Scene, name: string): Connection {
    Connection.current(scene)?.close();
    const conn = new Connection(name);
    scene.registry.set(REGISTRY_KEY, conn);
    return conn;
  }

  /** Quitte la partie et coupe la connexion. */
  static leave(scene: Phaser.Scene): void {
    const conn = scene.registry.get(REGISTRY_KEY) as Connection | null | undefined;
    if (conn && !conn.closed) {
      conn.send({ t: 'leave' });
      conn.close();
    }
    scene.registry.set(REGISTRY_KEY, null);
  }
}

/** Nom du joueur : demandé une fois, puis gardé par le navigateur. `?name=` dans l'adresse l'impose. */
export function playerName(): string {
  const forced = new URLSearchParams(window.location.search).get('name');
  if (forced) return forced;
  let name = '';
  try {
    name = window.localStorage.getItem('sfpe.name') ?? '';
    if (!name) {
      name = (window.prompt('Your name?', 'Player') ?? '').trim();
      if (name) window.localStorage.setItem('sfpe.name', name);
    }
  } catch {
    // stockage local indisponible : on garde le nom par défaut
  }
  return name || 'Player';
}
