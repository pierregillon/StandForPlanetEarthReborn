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
  /** Touche de dash tenue : pendant l'introduction, la tenir passe la séquence (GD-079). */
  dash: boolean;
  use: boolean;
  usePressed: boolean;
  reloadPressed: boolean;
  /** Pose ou coupe un lien avec un coéquipier (GD-043). */
  linkPressed: boolean;
  /** Lance l'attaque ultime. */
  ultiPressed: boolean;
}

export const NO_INPUT: Input = {
  moveX: 0, moveY: 0, aimX: 0, aimY: 0, fire1: false, fire2: false,
  dashPressed: false, dash: false, use: false, usePressed: false, reloadPressed: false, linkPressed: false, ultiPressed: false,
};

// ---------- Entités ----------

export type HeroState = 'standing' | 'walking' | 'firing1' | 'firing2' | 'dead';

export interface Hero {
  /** Rang du héros dans l'équipe (0 à 3) : son joueur, son point d'apparition. */
  id: number;
  /** Son joueur a quitté la partie : le robot n'existe plus pour le jeu. */
  gone: boolean;
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
  /** Relié à une borne (il reste mobile dans son rayon). */
  charging: boolean;
  chargeTimer: number;
  repairTimer: number;
  /** Borne à laquelle le héros est relié, ou -1. */
  linkedOutlet: number;
  /** Steps pendant lesquels le surplus d'énergie ne redescend pas encore. */
  overchargeHold: number;
  /** Steps restants de l'animation de déploiement (le héros est alors immobile et intouchable). */
  deploySteps: number;
  deployTotal: number;
  /** Steps restants de l'arrivée par le véhicule de largage, avant le déploiement. */
  arrivalSteps: number;
  arrivalTotal: number;
  /** Link (GD-043) : rang du coéquipier à qui ce héros donne son énergie, -1 s'il ne donne pas. */
  linkTo: number;
  /** Part du prochain point d'énergie déjà passée par le lien. */
  linkTimer: number;
  /** Force du lien selon la distance, de 0 à 1 (affichage). */
  linkStrength: number;
  /** Ulti : phase (0 aucune, 1 lancement, 2 action, 3 récupération) et steps écoulés dans cette phase. */
  ultiPhase: number;
  ultiSteps: number;
  /** Bond de BatBot : départ et arrivée. */
  ultiFromX: number;
  ultiFromY: number;
  ultiToX: number;
  ultiToY: number;
  /** Résurrection en cours : rang du coéquipier relevé (-1 si aucune) et steps écoulés. */
  reviving: number;
  reviveSteps: number;
  /** Soin fractionnaire accumulé (percentOfOneHp d'origine) : +1 PV quand il atteint 1. */
  healPool: number;
  // --- tir secondaire ---
  fire2Timer: number;
  fire2Was: boolean;
  /** Steps depuis lesquels le tir secondaire est maintenu. */
  fire2Hold: number;
  /** Steps écoulés depuis le début de l'animation du tir secondaire, -1 si aucune. */
  fire2Anim: number;
  /** Facteur de vitesse de marche (bouclier de BadaBot). */
  speedFactor: number;
  // BadaBot
  /** Charge du tir de plasma (0 = pas de charge en cours). */
  shieldUp: boolean;
  tanked: number;
  // BatBot
  bats: number;
  swingRight: boolean;
  /** Bras du coup en cours : droite, gauche, ou gauche seule (une batte en main). */
  swing: 'd' | 'g' | 'gg';
  swingSteps: number;
  swingHit: Set<number>;
  recallDone: boolean;
  // EngiBot
  /** Steps avant que la tourelle en cours de pose soit lâchée, 0 si aucune. */
  placingTurret: number;
}

/** Effet laissé dans le monde par un ulti (GD-044) : essaim de PetBot, mur de BadaBot, grenade d'EngiBot. */
export interface UltiEffect {
  id: number;
  kind: 'nanos' | 'wave' | 'emp';
  /** Rang du héros qui l'a lancé. */
  owner: number;
  x: number;
  y: number;
  /** Direction du lancer (la grenade et la vague avancent dans cette direction). */
  angle: number;
  fromX: number;
  fromY: number;
  steps: number;
  total: number;
  /** Rayon d'action (essaim, grenade) ou demi-largeur (vague). */
  radius: number;
  /** Distance parcourue par la vague, ou distance de vol de la grenade. */
  length: number;
}

export interface Drone {
  id: number;
  x: number;
  y: number;
  angle: number;
  speed: number;
  range: number;
  level: number;
  startX: number;
  startY: number;
}

export interface Explosion {
  id: number;
  x: number;
  y: number;
  angle: number;
  sprite: string;
  /** Échelle d'affichage du sprite. */
  scale: number;
  radius: number;
  damage: number;
  step: number;
  totalSteps: number;
  /** Step à partir duquel l'explosion soigne les héros, -1 si elle ne soigne pas. */
  healFromStep: number;
  hit: Set<number>;
}

export interface Turret {
  id: number;
  x: number;
  y: number;
  angle: number;
  moveAngle: number;
  speed: number;
  state: 'flying' | 'deploying' | 'deployed';
  level: number;
  timer: number;
  fireTimer: number;
}

export interface Bat {
  id: number;
  x: number;
  y: number;
  angle: number;
  side: 'd' | 'g';
  /** 1 à 4 : énergie dépensée au lancer. */
  level: number;
  state: 'flying' | 'stopped' | 'returning';
  startX: number;
  startY: number;
  hit: Set<number>;
  steps: number;
  /** Une batte explosive n'explose qu'une fois par trajet (aller, puis retour). */
  exploded: boolean;
}

export type NpcBehaviour = 'none' | 'surprised' | 'investigate' | 'chase' | 'attack' | 'runaway';
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
  /** Le soldat a déjà réagi à la présence du héros (il ne sera pas « surpris » une seconde fois). */
  alerted: boolean;
  /** Dernier endroit où il a vu ou entendu le héros, et steps pendant lesquels il s'en souvient. */
  alertX: number;
  alertY: number;
  alertTimer: number;
  /** Steps pendant lesquels ce robot est désactivé par une grenade électromagnétique. */
  stun: number;
  /** Projeté par la vague de BadaBot (GD-051) : distance qu'il lui reste à parcourir, et dans quelle direction. */
  thrown: number;
  thrownAngle: number;
  /** Steps pendant lesquels il reste sonné après avoir été projeté : il ne bouge pas et ne tire pas. */
  daze: number;
  /** Côté vers lequel il se décale en combat (1 ou -1 ; 0 tant qu'il n'a pas choisi) (GD-058). */
  strafe: number;
  /** Steps écoulés depuis qu'il a vu un héros pour la dernière fois (GD-075). */
  unseen: number;
  /**
   * Soldat de la riposte (GD-086, GD-087) : 0 pour les autres, 1 tant qu'il attend devant les fourgons, 2 quand
   * il traque les robots (`HOLDING`, `HUNTING` dans wave.ts).
   */
  hunt: number;
  /** Coups que le bouclier frontal peut encore encaisser (robot bouclier). */
  shieldHp: number;
  shieldBroken: boolean;
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
  /** Rang du héros qui a tiré, -1 pour un ennemi ou une tourelle. */
  ownerId: number;
  x: number;
  y: number;
  angle: number;
  startX: number;
  startY: number;
  /** Vitesse courante (les balles d'EngiBot ralentissent). */
  speed: number;
  /** Dernier PNJ touché : une balle qui rebondit ne le retouche pas aussitôt. */
  lastHit: number;
  steps: number;
  /** Côté client d'une partie réseau : la balle a atteint un mur et attend que le serveur la retire. */
  spent?: boolean;
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
  id: number;
  sprite: string;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  doorId: number;
  /** Steps écoulés depuis l'appui, -1 s'il n'a jamais été pressé. */
  pressedSteps: number;
}

/** Chaise à roulettes : seul meuble que le héros déplace en le touchant. */
export interface Chair {
  id: number;
  sprite: string;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  tint: string;
  vx: number;
  vy: number;
  /** Projetée par la vague de BadaBot : distance qu'il lui reste à parcourir sans ralentir. */
  thrown: number;
  /** Décalage entre la position de l'instance et le centre de sa boîte de collision. */
  offsetX: number;
  offsetY: number;
  obstacle: Obstacle;
}

/** Point de sauvegarde : s'y connecter régénère le héros et sert de point de reprise. */
export interface Checkpoint {
  x: number;
  y: number;
  active: boolean;
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
  /** Énergie et points de vie que la borne peut encore donner. */
  energyLeft: number;
  repairLeft: number;
}

export interface Card {
  id: number;
  color: 'green' | 'purple';
  sprite: string;
  x: number;
  y: number;
  /** Ramassée : elle suit le héros et ne peut pas être posée. */
  carried: boolean;
}

export interface Drill {
  id: number;
  tag: 'drill';
  x: number;
  y: number;
  /** La foreuse est ronde : sa collision est un disque (approché par un polygone à 12 côtés). */
  radius: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
}

/** Brouillard de guerre : rectangle opaque couvrant une pièce, levé quand le héros en ouvre la porte. */
export interface Fog {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  number: number | null;
  attached: number | null;
  fadePerStep: number;
  enabled: boolean;
  alpha: number;
}

export interface Zone {
  kind: 'stairs';
  x: number;
  y: number;
  radius: number;
  sprite: string;
  active: boolean;
  /** Steps restants avant le départ quand une partie seulement de l'équipe attend, -1 sinon. */
  countdown: number;
  /** Le départ a été demandé : on ne le redemande pas tant que la zone n'a pas été quittée. */
  departed: boolean;
  /** Salle d'arrivée et jeu de points d'apparition à y utiliser. */
  targetRoom: string;
  targetSpawn: number;
}

/** Élément de décor fixe, dessiné tel quel par l'affichage. */
export interface DecorItem {
  /** Hauteur du meuble, s'il porte une ombre sous les projecteurs (GD-082) ; 0 sinon. */
  shadow: number;
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
  | { type: 'heal'; x: number; y: number }
  | { type: 'turretFolded'; x: number; y: number }
  | { type: 'npcDeath'; x: number; y: number; angle: number; sprite: string; genre: 'humain' | 'robot' }
  | { type: 'windowBroken'; id: number; x: number; y: number; angle: number }
  | { type: 'buttonPressed'; x: number; y: number }
  | { type: 'checkpoint'; x: number; y: number }
  | { type: 'deploy'; sound: string; hero: number }
  | { type: 'vehicleArrives'; seconds: number }
  /** L'ultimatum commence (GD-085). */
  | { type: 'castStart' }
  /** L'ultimatum est fini, ou l'hôte l'a passé (`skipped`). */
  | { type: 'castEnd'; skipped: boolean }
  /** Le face-à-face avec le barrage de police commence (GD-088) ; puis il finit, et la police ouvre le feu. */
  | { type: 'standoff' }
  | { type: 'standoffEnd'; skipped: boolean }
  /** L'extraction commence (GD-089) : le véhicule revient ; puis le communiqué d'urgence passe à l'antenne. */
  | { type: 'pickup' }
  | { type: 'pickupNews' }
  /** Les sirènes de la police montent. */
  | { type: 'sirens' }
  /** Radio en jeu : une réplique courte, qui n'arrête pas la partie. */
  | { type: 'radio'; speaker: string; text: string }
  /** Le véhicule redécolle ; `seconds` : le temps qu'il met à sortir de l'écran. */
  | { type: 'vehicleLeaves'; seconds: number }
  /** L'introduction complète commence : le journal de TvTv² est à l'antenne. */
  | { type: 'introNews' }
  /** L'hôte a passé l'introduction : le véhicule disparaît, les robots se déploient. */
  | { type: 'introSkipped' }
  | { type: 'heroHit'; x: number; y: number }
  | { type: 'heroDead'; x: number; y: number }
  | { type: 'reloadStart'; hero: number }
  | { type: 'reloadEnd'; hero: number }
  | { type: 'emptyClick'; hero: number }
  | { type: 'revived'; x: number; y: number }
  | { type: 'linked'; from: number; to: number }
  | { type: 'unlinked'; from: number; to: number }
  | { type: 'ultiCast'; hero: number }
  | { type: 'ultiLeap'; hero: number }
  | { type: 'ultiImpact'; hero: number; x: number; y: number; radius: number }
  /** Un ulti produit son effet : `kind` est le robot qui le lance, ou 'emp' quand sa grenade éclate. */
  | { type: 'ultiFx'; kind: string; x: number; y: number }
  | { type: 'outletTick'; x: number; y: number }
  | { type: 'notify'; text: string }
  | { type: 'changeRoom'; room: string; spawn: number }
  | { type: 'levelEnd' }
  | { type: 'drillDestroyed'; id: number; x: number; y: number }
  | { type: 'shieldBroken'; x: number; y: number }
  | { type: 'outletEmpty'; x: number; y: number };
