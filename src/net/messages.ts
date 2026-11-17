// Messages échangés entre le navigateur et le serveur de partie (ADR-014), en JSON sur une WebSocket.
import type { Input, SimEvent, Stats } from '../sim/types.ts';
import type { Snapshot } from './snapshot.ts';

export const MAX_PLAYERS = 4;
/** Steps de simulation entre deux instantanés envoyés aux clients (3 = 20 par seconde). */
export const SNAPSHOT_EVERY = 3;

export interface LobbyPlayer {
  id: number;
  name: string;
  /** Robot choisi, ou null tant que le joueur n'a pas choisi. */
  hero: string | null;
}

export interface LoadingPlayer {
  name: string;
  progress: number;
}

/** État du salon, envoyé à tous les navigateurs connectés (y compris ceux restés au menu). */
export interface LobbyState {
  t: 'lobby';
  /** Une partie est ouverte : on peut la rejoindre tant qu'elle n'a pas commencé et qu'il reste une place. */
  open: boolean;
  playing: boolean;
  host: number;
  players: LobbyPlayer[];
  /** Identifiant de ce navigateur, et s'il fait partie du salon. */
  you: number;
  joined: boolean;
}

/** Début d'une salle : le client construit son monde miroir, charge ses images, puis répond « ready ». */
export interface RoomStart {
  t: 'room';
  room: string;
  spawn: number;
  heroNames: string[];
  playerNames: string[];
  /** Rang du héros de ce joueur dans l'équipe. */
  you: number;
  /** Numéro d'ordre de la salle dans la partie : les instantanés d'une salle précédente sont ignorés. */
  epoch: number;
}

export type ServerMessage =
  | LobbyState
  | RoomStart
  | { t: 's'; epoch: number; ack: number; snap: Snapshot; ev?: SimEvent[] }
  /** Joueurs qui chargent encore la salle, avec leur avancement (0 à 1). Liste vide : le jeu reprend. */
  | { t: 'wait'; players: LoadingPlayer[] }
  | { t: 'over' }
  | { t: 'won'; stats: Stats }
  | { t: 'error'; text: string };

export type ClientMessage =
  | { t: 'hello'; name: string }
  | { t: 'create' }
  | { t: 'join' }
  | { t: 'pick'; hero: string | null }
  | { t: 'start' }
  | { t: 'ready'; epoch: number }
  /** Avancement du chargement de la salle, de 0 à 1. */
  | { t: 'loading'; epoch: number; p: number }
  | { t: 'i'; e: number; q: number; v: number[] }
  | { t: 'retry' }
  | { t: 'leave' }
  /** Outil de développement (serveur lancé avec SFPE_DEBUG=1) : place son robot à un endroit. */
  | { t: 'teleport'; x: number; y: number };

/** Entrée d'un step, tassée : [déplacement x, y, visée x, y, boutons]. */
export function packInput(i: Input): number[] {
  const bits = (i.fire1 ? 1 : 0) | (i.fire2 ? 2 : 0) | (i.dashPressed ? 4 : 0) | (i.use ? 8 : 0) | (i.usePressed ? 16 : 0) | (i.reloadPressed ? 32 : 0)
    | (i.linkPressed ? 64 : 0) | (i.ultiPressed ? 128 : 0) | (i.dash ? 256 : 0);
  return [i.moveX, i.moveY, Math.round(i.aimX), Math.round(i.aimY), bits];
}

export function unpackInput(v: number[]): Input {
  const n = (k: number): number => (Number.isFinite(v[k]) ? v[k] : 0);
  const bits = n(4);
  return {
    moveX: Math.sign(n(0)), moveY: Math.sign(n(1)), aimX: n(2), aimY: n(3),
    fire1: (bits & 1) !== 0, fire2: (bits & 2) !== 0, dashPressed: (bits & 4) !== 0,
    use: (bits & 8) !== 0, usePressed: (bits & 16) !== 0, reloadPressed: (bits & 32) !== 0,
    linkPressed: (bits & 64) !== 0, ultiPressed: (bits & 128) !== 0, dash: (bits & 256) !== 0,
  };
}
