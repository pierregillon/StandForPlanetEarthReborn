// État d'une partie qui dépasse une salle : cartes portées, consigne en cours, statistiques, salles visitées.
// Les salles gardent leur état quand on y revient (obj_roomsMemory de l'original).
import { TV_STUDIO } from './additions.ts';
import { CONFIG } from './config.ts';
import type { Stats } from './types.ts';
import type { World } from './world.ts';

/**
 * Consignes de TvTv², dans l'ordre (GD-085). Les trois premières sont celles d'origine (obj_consigne_world2) ;
 * la suite mène à la régie, au plateau et à l'ultimatum, à la place de la sortie vers la zone de forage. Après
 * l'ultimatum, la consigne nomme le parking sud : c'est là que l'équipe doit découvrir la police (GD-087).
 */
export const OBJECTIVES = [
  'Go to the upper floor',
  'Find the studio pass',
  'Go back to ground floor',
  'Take the control room',
  'Reach the studio',
  'Broadcast the message',
  'Leave by the south parking lot',
  'Plan B: leave by the north garage',
  'Hold on. The gate is opening',
  'Get out! The pick-up is outside',
];

/** Rang de chaque consigne dans OBJECTIVES. */
export const OBJ = { upstairs: 0, pass: 1, downstairs: 2, controlRoom: 3, studio: 4, broadcast: 5, dropPoint: 6, northGate: 7, holdOn: 8, getOut: 9 };

/** Consignes de la zone de forage : elle ne fait plus partie de ce niveau, mais reste jouable depuis le menu. */
export const DRILL_OBJECTIVES = ['Destroy the drills', 'Kill SallyBot'];

export const GROUND_FLOOR = 'rm_world2';
export const UPPER_FLOOR = 'rm_world2_1';
export const DRILL_AREA = 'rm_world2_2';

/**
 * État d'une salle au moment d'un point de sauvegarde (GD-087) : ce que « Retry » doit retrouver tel quel. Les
 * entités sont repérées par leur numéro, le même à chaque construction de la salle.
 */
export interface RoomSave {
  /** PNJ encore debout, là où ils étaient ; ceux qui manquent étaient déjà morts. */
  npcs: { id: number; x: number; y: number; angle: number; hp: number; ammo: number; shieldHp: number; shieldBroken: boolean }[];
  /** Morts déjà comptés dans cette salle. */
  killed: { civil: number; soldier: number };
  /** Portes à bouton ou à carte ouvertes, boutons pressés, vitres brisées, brouillards pas encore levés. */
  doors: number[];
  buttons: number[];
  windows: number[];
  fogs: number[];
  outlets: { id: number; energyLeft: number; repairLeft: number }[];
  chairs: { id: number; x: number; y: number; angle: number }[];
}

export interface Session {
  /** Robots de l'équipe, dans l'ordre des joueurs (un seul en solo). */
  heroNames: string[];
  /** Couleurs des cartes ramassées. */
  carried: Set<string>;
  /** Indice de la consigne en cours dans OBJECTIVES. */
  objective: number;
  stats: Stats;
  /** Salles déjà visitées, avec leur état. */
  rooms: Map<string, World>;
  room: string;
  /** Jeu de points d'apparition à utiliser en entrant dans la salle. */
  spawnNumber: number;
  /**
   * Point de sauvegarde activé : Retry y ramène au lieu de recommencer le niveau. `objective` : la consigne à
   * retrouver en y revenant, et `save` : l'état de la salle à ce moment-là (ceux du plateau, posés à la fin de
   * l'ultimatum). Sans `save`, la salle est remise à neuf.
   */
  checkpoint: { room: string; x: number; y: number; objective?: number; save?: RoomSave } | null;
  /**
   * Portes déjà franchies quand la partie commence ailleurs qu'au début (GD-037) : par salle, numéros des
   * portes à bouton et couleurs des portes à carte à trouver ouvertes.
   */
  preOpened: Record<string, { buttons: number[]; cards: string[] }>;
  /** L'introduction complète du niveau a déjà été jouée : un nouveau départ ne rejoue que le largage (GD-078). */
  introSeen: boolean;
}

/** Une carte du jeu, et ses points de départ (GD-032, GD-091). */
export interface StartPoint {
  id: string;
  /** Carte à laquelle il appartient (`MAPS`). */
  map: string;
  room: string;
  title: string;
  text: string;
}

export const MAPS = [
  { id: 'tvtv2', title: 'TvTv² STATION' },
  { id: 'drill', title: 'DRILLING AREA' },
];

/** Points de départ proposés, en solo comme à l'hôte d'une partie à plusieurs. Le premier est le début du niveau. */
export const STARTS: StartPoint[] = [
  { id: 'drop', map: 'tvtv2', room: GROUND_FLOOR, title: 'THE DROP', text: 'Start of the level. The full run.' },
  { id: 'upstairs', map: 'tvtv2', room: UPPER_FLOOR, title: 'UPPER FLOOR', text: 'Start upstairs, with the green card. Find the studio pass.' },
  { id: 'studio', map: 'tvtv2', room: GROUND_FLOOR, title: 'AFTER THE BROADCAST', text: 'On the set, message sent. The police are waiting to the south.' },
  { id: 'boss', map: 'drill', room: DRILL_AREA, title: 'BOSS CHECKPOINT', text: 'Start at the checkpoint, fully restored, with both cards.' },
];

/**
 * Le point de sauvegarde posé sur le plateau à la fin de l'ultimatum (GD-085), et les portes que l'équipe a
 * franchies pour y arriver : celles du bouton de l'escalier et du bouton de la régie, la verte et la violette.
 */
export function studioCheckpoint(): { room: string; x: number; y: number; objective: number } {
  return { room: GROUND_FLOOR, x: TV_STUDIO.regroup.x - 110, y: TV_STUDIO.regroup.y - 40, objective: OBJ.dropPoint };
}

export function studioDoors(): { buttons: number[]; cards: string[] } {
  return { buttons: [1, CONFIG.broadcast.controlRoomButton], cards: ['green', 'purple'] };
}

/**
 * Partie commencée ailleurs qu'au début du niveau (menu de choix du départ, GD-032, GD-091) : l'équipe a déjà
 * ce qu'elle aurait en arrivant là en jouant. `where` : l'identifiant d'un point de départ (`STARTS`), ou le
 * nom d'une salle (son premier point de départ). Dans la zone de forage, on part du point de sauvegarde ; après
 * l'ultimatum, de celui du plateau, le bâtiment encore plein de ses gardes.
 */
export function createSessionAt(heroNames: string | string[], where: string): Session {
  const start = STARTS.find((s) => s.id === where) ?? STARTS.find((s) => s.room === where) ?? STARTS[0];
  const room = start.room;
  const session = createSession(heroNames, room);
  if (start.id === 'studio') {
    session.carried.add('green').add('purple');
    session.objective = OBJ.dropPoint;
    session.checkpoint = studioCheckpoint();
    session.preOpened[GROUND_FLOOR] = studioDoors();
    session.introSeen = true;
  } else if (room === UPPER_FLOOR) {
    session.carried.add('green');
    // pour monter, le héros a ouvert la porte verte et la porte à bouton de l'escalier : en redescendant,
    // il doit les retrouver ouvertes, sinon il resterait enfermé dans la cage d'escalier
    session.preOpened[GROUND_FLOOR] = { buttons: [1], cards: ['green'] };
  } else if (room === DRILL_AREA) {
    session.carried.add('green').add('purple');
    session.checkpoint = { room, x: 0, y: 0 };
  }
  return session;
}

export function createSession(heroNames: string | string[], room = GROUND_FLOOR): Session {
  return {
    heroNames: Array.isArray(heroNames) ? heroNames : [heroNames],
    carried: new Set(),
    objective: 0,
    stats: { totalCivil: 0, totalSoldier: 0, civilKilled: 0, soldierKilled: 0, damageTaken: 0, healed: 0, ammoUsed: 0, energyUsed: 0 },
    rooms: new Map(),
    room,
    spawnNumber: 1,
    checkpoint: null,
    preOpened: {},
    introSeen: false,
  };
}
