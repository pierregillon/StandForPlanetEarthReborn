// Formats des données produites par les outils (voir docs/formats-donnees.md) et entités de la simulation.
import type { HeroDef, NpcDef, BulletDef } from './config.ts';
import type { Obstacle } from './geom.ts';
import type { Point } from './nav.ts';

// ---------- Données de niveau et d'assets ----------

export interface SpriteInfo {
  w: number;
  h: number;
  ox: number;
  oy: number;
  frames: number;
  /** [gauche, haut, droite, bas], bornes incluses, en pixels du sprite. */
  bbox: [number, number, number, number];
  bboxmode: number;
  colkind: number;
  sepmasks: boolean;
  speed: number;
  speedType: number;
}

export type SpriteManifest = Record<string, SpriteInfo>;

export interface LevelObjectInfo {
  sprite: string | null;
  mask: string | null;
  parents: string[];
  visible: boolean;
}

export interface LevelInstance {
  id: string;
  object: string;
  layer: string;
  depth: number;
  x: number;
  y: number;
  /** Degrés GameMaker (sens antihoraire). */
  angle: number;
  scaleX: number;
  scaleY: number;
  tint: string;
  alpha: number;
  props: Record<string, unknown>;
}

export interface LevelWall {
  object: string;
  thick: boolean;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
}

export interface LevelFloor {
  object: string;
  tileset: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Décalage du motif par rapport au coin haut-gauche du rectangle, s'il y en a un. */
  phaseX?: number;
  phaseY?: number;
}

export interface LevelDecal {
  sprite: string;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  tint: string;
  alpha: number;
  frame: number;
  depth: number;
}

export interface LevelData {
  name: string;
  width: number;
  height: number;
  background: { sprite: string | null; color: string; tiled: boolean };
  objects: Record<string, LevelObjectInfo>;
  instances: LevelInstance[];
  walls: LevelWall[];
  /** [x, y, largeur, hauteur, épais (1) ou fin (0)] */
  wallRects: [number, number, number, number, number][];
  floors: LevelFloor[];
  decals: LevelDecal[];
}

// ---------- Entrées du joueur ----------

export interface Input {
  moveX: number;
  moveY: number;
  /** Position visée, en coordonnées du monde. */
  aimX: number;
  aimY: number;
  fire1: boolean;
  fire2: boolean;
  dashPressed: boolean;
  use: boolean;
  usePressed: boolean;
  reloadPressed: boolean;
}

export const NO_INPUT: Input = {
  moveX: 0, moveY: 0, aimX: 0, aimY: 0, fire1: false, fire2: false,
  dashPressed: false, use: false, usePressed: false, reloadPressed: false,
};

// ---------- Entités ----------

export type HeroState = 'standing' | 'walking' | 'firing1' | 'dead';

export interface Hero {
  def: HeroDef;
  x: number;
  y: number;
  /** Orientation du corps (visée). */
  angle: number;
  /** Direction de déplacement (jambes). */
  moveAngle: number;
  moving: boolean;
  state: HeroState;
  hp: number;
  energy: number;
  energyTimer: number;
  energyPause: number;
  ammo: number;
  /** Steps restants de rechargement, 0 si aucun en cours. */
  reloadTimer: number;
  fireTimer: number;
  /** Steps écoulés depuis le dernier tir (animation). */
  sinceShot: number;
  dashCharges: number;
  dashRechargeTimer: number;
  dashing: boolean;
  bump: boolean;
  targetX: number;
  targetY: number;
  invuln: number;
  walkDist: number;
  deadSteps: number;
  /** Branché sur une prise de courant. */
  charging: boolean;
  chargeTimer: number;
}

export type NpcBehaviour = 'none' | 'surprised' | 'chase' | 'attack' | 'runaway';
export type NpcState = 'standing' | 'walking' | 'chasing' | 'firing' | 'delay_firing' | 'reloading' | 'running';

export interface Npc {
  id: number;
  object: string;
  def: NpcDef;
  x: number;
  y: number;
  /** Orientation du sprite. */
  angle: number;
  /** Direction voulue. */
  dir: number;
  hp: number;
  active: boolean;
  behaviour: NpcBehaviour;
  state: NpcState;
  /** Vitesse de base ; 0 = le PNJ attend sur place. */
  spd: number;
  path: Point[] | null;
  pathIdx: number;
  waypointTimer: number;
  waypointFailures: number;
  patrolType: 'random' | 'points' | 'none';
  patrolPoints: Point[];
  patrolReverse: boolean;
  /** -1 : pas de pause en cours ; 0 : pause terminée ; > 0 : en pause. */
  pauseTimer: number;
  // soldats
  attackRange: number;
  ammo: number;
  fireTimer: number;
  reloadTimer: number;
  repathTimer: number;
  surpriseTimer: number;
  spotted: boolean;
  viewRange: number;
  // civils
  fear: boolean;
  fearTimer: number;
  // animation
  stateSteps: number;
  walkDist: number;
}

export interface Bullet {
  id: number;
  def: BulletDef;
  owner: 'hero' | 'enemy';
  x: number;
  y: number;
  angle: number;
  startX: number;
  startY: number;
}

export type DoorKind = 'auto' | 'button' | 'card';
export type DoorPhase = 'closed' | 'opening' | 'open' | 'closing';

export interface Door {
  id: number;
  kind: DoorKind;
  sprite: string;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  /** Demi-longueur et demi-épaisseur du battant fermé. */
  halfLength: number;
  halfThickness: number;
  doorId: number;
  card: string | null;
  detectionRange: number;
  openSteps: number;
  closeSteps: number;
  stayOpenSteps: number;
  blockedOpen: boolean;
  phase: DoorPhase;
  /** 0 = fermée, 1 = ouverte à fond. */
  progress: number;
  stayTimer: number;
  obstacle: Obstacle;
  inNav: boolean;
}

export interface Button {
  x: number;
  y: number;
  angle: number;
  doorId: number;
}

export interface WindowPane {
  id: number;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  sprite: string;
  broken: boolean;
  obstacle: Obstacle;
}

export interface Outlet {
  id: number;
  x: number;
  y: number;
  /** Un héros est en train de s'y recharger. */
  inUse: boolean;
}

export interface Zone {
  kind: 'stairs';
  x: number;
  y: number;
  radius: number;
  sprite: string;
  active: boolean;
}

/** Élément de décor fixe, dessiné tel quel par l'affichage. */
export interface DecorItem {
  sprite: string;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  tint: string;
  alpha: number;
  depth: number;
  frame: number;
}

export interface Stats {
  totalCivil: number;
  totalSoldier: number;
  civilKilled: number;
  soldierKilled: number;
  damageTaken: number;
  healed: number;
  ammoUsed: number;
  energyUsed: number;
}

// ---------- Événements envoyés à l'affichage ----------

export type SimEvent =
  | { type: 'sound'; name: string; x: number; y: number }
  | { type: 'impact'; x: number; y: number; angle: number; surface: 'wall' | 'npc' | 'shield' }
  | { type: 'npcDeath'; x: number; y: number; angle: number; sprite: string; genre: 'humain' | 'robot' }
  | { type: 'windowBroken'; id: number; x: number; y: number }
  | { type: 'heroHit'; x: number; y: number }
  | { type: 'heroDead'; x: number; y: number }
  | { type: 'reloadStart' }
  | { type: 'reloadEnd' }
  | { type: 'emptyClick' }
  | { type: 'outletTick'; x: number; y: number }
  | { type: 'notify'; text: string };
