// État d'une partie qui dépasse une salle : cartes portées, consigne en cours, statistiques, salles visitées.
// Les salles gardent leur état quand on y revient (obj_roomsMemory de l'original).
import type { Stats } from './types.ts';
import type { World } from './world.ts';

/**
 * Consignes de TvTv², dans l'ordre (GD-085). Les trois premières sont celles d'origine (obj_consigne_world2) ;
 * la suite mène à la régie, au plateau et à l'ultimatum, à la place de la sortie vers la zone de forage.
 */
export const OBJECTIVES = [
  'Go to the upper floor',
  'Find the studio pass',
  'Go back to ground floor',
  'Take the control room',
  'Reach the studio',
  'Broadcast the message',
  'Get back to the drop point',
  'Too many of them. Take the north gate',
];

/** Rang de chaque consigne dans OBJECTIVES. */
export const OBJ = { upstairs: 0, pass: 1, downstairs: 2, controlRoom: 3, studio: 4, broadcast: 5, dropPoint: 6, northGate: 7 };

/** Consignes de la zone de forage : elle ne fait plus partie de ce niveau, mais reste jouable depuis le menu. */
export const DRILL_OBJECTIVES = ['Destroy the drills', 'Kill SallyBot'];

export const GROUND_FLOOR = 'rm_world2';
export const UPPER_FLOOR = 'rm_world2_1';
export const DRILL_AREA = 'rm_world2_2';

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
   * retrouver en y revenant (celui du plateau, posé à la fin de l'ultimatum).
   */
  checkpoint: { room: string; x: number; y: number; objective?: number } | null;
  /**
   * Portes déjà franchies quand la partie commence ailleurs qu'au début (GD-037) : par salle, numéros des
   * portes à bouton et couleurs des portes à carte à trouver ouvertes.
   */
  preOpened: Record<string, { buttons: number[]; cards: string[] }>;
  /** L'introduction complète du niveau a déjà été jouée : un nouveau départ ne rejoue que le largage (GD-078). */
  introSeen: boolean;
}

/**
 * Partie commencée ailleurs qu'au début du niveau (menu de choix du départ, GD-032) : le héros a déjà ce
 * qu'il aurait en arrivant là en jouant. Dans la zone de forage, il part du point de sauvegarde.
 */
export function createSessionAt(heroNames: string | string[], room: string): Session {
  const session = createSession(heroNames, room);
  if (room === UPPER_FLOOR) {
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
