// Enchaînement des salles d'une partie, commun au jeu solo (dans le navigateur) et au serveur multijoueur.
import type { Session } from './session.ts';
import type { Hero, LevelData, SpriteManifest } from './types.ts';
import { World } from './world.ts';

/**
 * Monde de la salle courante de la partie : créé à la première visite, repris tel quel ensuite.
 * `arriving` : l'équipe telle qu'elle a quitté la salle précédente, ou null au début d'une partie.
 */
export function openRoom(session: Session, level: LevelData, sprites: SpriteManifest, arriving: Hero[] | null, seed: number): World {
  let world = session.rooms.get(session.room);
  if (!world) {
    world = new World(level, sprites, session.heroNames, seed, session);
    session.rooms.set(session.room, world);
  }
  if (arriving) world.enter(arriving, session.spawnNumber);
  world.drainEvents();
  return world;
}

/** Début d'une partie : personne n'arrive d'une autre salle et aucun point de sauvegarde n'est actif. */
export function isFreshStart(session: Session, arriving: Hero[] | null): boolean {
  return session.rooms.size === 0 && !arriving && !session.checkpoint;
}
