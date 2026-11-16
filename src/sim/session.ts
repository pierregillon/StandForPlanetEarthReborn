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
  };
}
