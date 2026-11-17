// Enchaînement des salles d'une partie, commun au jeu solo (dans le navigateur) et au serveur multijoueur.
import { GROUND_FLOOR, createSession } from './session.ts';
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

/**
 * Début d'une partie : l'équipe se déploie. Au rez-de-chaussée, le véhicule de largage l'amène d'abord
 * (GD-035), avec l'introduction complète la première fois seulement (GD-078).
 */
export function startTeam(session: Session, world: World): void {
  const withVehicle = session.room === GROUND_FLOOR;
  world.deployHero(withVehicle, !session.introSeen);
  if (withVehicle) session.introSeen = true;
}

/**
 * Retry après une défaite : reprise au point de sauvegarde s'il est activé (GD-031), sa salle étant remise à
 * neuf ; sinon tout le niveau recommence, sans carte, avec la même équipe (GD-029).
 */
export function retrySession(session: Session): Session {
  const cp = session.checkpoint;
  if (!cp) {
    const fresh = createSession(session.heroNames);
    fresh.introSeen = session.introSeen;
    return fresh;
  }
  session.rooms.get(cp.room)?.forget();
  session.room = cp.room;
  if (cp.objective !== undefined) session.objective = cp.objective;
  return session;
}
