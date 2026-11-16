// État d'une partie qui dépasse une salle : cartes portées, consigne en cours, statistiques, salles visitées.
// Les salles gardent leur état quand on y revient (obj_roomsMemory de l'original).
import type { Stats } from './types.ts';
import type { World } from './world.ts';

/** Consignes du monde 2, dans l'ordre (obj_consigne_world2). Les deux dernières arrivent avec la zone de forage. */
export const OBJECTIVES = [
  'Go to the upper floor',
  'Find the purple key',
  'Go back to ground floor',
  'Exit to the drilling area',
  'Destroy the drills',
  'Kill SallyBot',
];

export const GROUND_FLOOR = 'rm_world2';
export const UPPER_FLOOR = 'rm_world2_1';
export const DRILL_AREA = 'rm_world2_2';

export interface Session {
  heroName: string;
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
  /** Point de sauvegarde activé : Retry y ramène au lieu de recommencer le niveau. */
  checkpoint: { room: string; x: number; y: number } | null;
  /**
   * Portes déjà franchies quand la partie commence ailleurs qu'au début (GD-037) : par salle, numéros des
   * portes à bouton et couleurs des portes à carte à trouver ouvertes.
   */
  preOpened: Record<string, { buttons: number[]; cards: string[] }>;
}

/**
 * Partie commencée ailleurs qu'au début du niveau (menu de choix du départ, GD-032) : le héros a déjà ce
 * qu'il aurait en arrivant là en jouant. Dans la zone de forage, il part du point de sauvegarde.
 */
export function createSessionAt(heroName: string, room: string): Session {
  const session = createSession(heroName, room);
  if (room === UPPER_FLOOR) {
    session.carried.add('green');
    // pour monter, le héros a ouvert la porte verte et la porte à bouton de l'escalier : en redescendant,
    // il doit les retrouver ouvertes, sinon il resterait enfermé dans la cage d'escalier
    session.preOpened[GROUND_FLOOR] = { buttons: [1], cards: ['green'] };
  } else if (room === DRILL_AREA) {
    session.carried.add('green').add('purple');
    session.objective = 3;
    session.checkpoint = { room, x: 0, y: 0 };
  }
  return session;
}

export function createSession(heroName: string, room = GROUND_FLOOR): Session {
  return {
    heroName,
    carried: new Set(),
    objective: 0,
    stats: { totalCivil: 0, totalSoldier: 0, civilKilled: 0, soldierKilled: 0, damageTaken: 0, healed: 0, ammoUsed: 0, energyUsed: 0 },
    rooms: new Map(),
    room,
    spawnNumber: 1,
    checkpoint: null,
    preOpened: {},
  };
}
