// La riposte (GD-086 à GD-088) : après l'ultimatum, la police barre le parking sud. Ses fourgons sont en
// travers, dix policiers en ligne devant. Rien ne bouge tant que l'équipe n'y est pas : c'est en arrivant sur
// le parking qu'elle tombe sur le barrage. Un face-à-face se joue (`World.startStandoff`) ; à sa fin la police
// ouvre le feu, les portails 4 s'ouvrent, et un groupe de renfort entre toutes les dix secondes : le sud ne se
// vide jamais. Chaque soldat va droit sur le robot le plus proche. L'effectif dépend du nombre de joueurs (GD-090).
import { CONFIG } from './config.ts';
import { TV_STUDIO } from './landmarks.ts';
import { vehicleVoice } from './broadcast.ts';
import { BLOCK_MOVE } from './geom.ts';
import { HOLDING, HUNTING } from './npc.ts';
import { groundVoice } from './scenes.ts';
import { OBJ } from './session.ts';
import type { Hero, Npc } from './types.ts';
import type { World } from './world.ts';

/**
 * Sans face-à-face (l'équipe a quitté l'aile par l'ouest) : ce que dit la voix du véhicule quand la police se
 * lance, et ce que répond un robot au sol.
 */
export const TOO_MANY = 'The south side is crawling with them. Forty, maybe fifty. Forget the drop point.';
export const NORTH_GARAGE = 'Then it is plan B. We leave by the north garage.';

export { HOLDING, HUNTING };

type Units = Record<string, number>;
type Area = { x0: number; x1: number; y0: number; y1: number };
type Spot = { x: number; y: number };

/** Un groupe de la riposte pour cette partie : les effectifs d'un joueur seul, grossis selon le nombre de joueurs. */
export function waveGroup(players: number): Units {
  const cfg = CONFIG.wave;
  const factor = 1 + cfg.perExtraPlayer * Math.max(0, players - 1);
  return Object.fromEntries(Object.entries(cfg.units).map(([object, count]) => [object, Math.round(count * factor)]));
}

/** Nombre de soldats d'un groupe. */
export function waveGroupSize(players: number): number {
  return Object.values(waveGroup(players)).reduce((a, b) => a + b, 0);
}

/** Plafond de soldats de la riposte debout en même temps. */
export function waveCap(players: number): number {
  return Math.min(CONFIG.wave.maxAlive, CONFIG.wave.maxAliveGroups * waveGroupSize(players));
}

/** Liste des soldats d'un groupe, mélangés : les types arrivent entremêlés, pas par paquets. */
function roster(world: World, units: Units): string[] {
  const list: string[] = [];
  for (const [object, count] of Object.entries(units)) for (let i = 0; i < count; i++) list.push(object);
  for (let i = list.length - 1; i > 0; i--) {
    const j = world.rng.int(0, i);
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** Places libres dans une zone, sur une grille, mélangées. */
function freeSpots(world: World, zone: Area, taken: Spot[]): Spot[] {
  const { spacing, clearance } = CONFIG.wave;
  const spots: Spot[] = [];
  for (let y = zone.y0; y <= zone.y1; y += spacing) {
    for (let x = zone.x0; x <= zone.x1; x += spacing) {
      if (!world.collision.circleFree(x, y, clearance, BLOCK_MOVE)) continue;
      if (taken.some((o) => Math.hypot(o.x - x, o.y - y) < spacing * 0.9)) continue;
      spots.push({ x, y });
    }
  }
  for (let i = spots.length - 1; i > 0; i--) {
    const j = world.rng.int(0, i);
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  return spots;
}

function nearest(heroes: Hero[], p: Spot): Hero | null {
  let best: Hero | null = null;
  for (const h of heroes) if (!best || Math.hypot(h.x - p.x, h.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y)) best = h;
  return best;
}

/** Lance un soldat de la vague sur le robot le plus proche : il sait où aller, sans temps de surprise. */
function pursue(npc: Npc, targets: Hero[]): void {
  npc.hunt = HUNTING;
  npc.active = true;
  npc.surpriseTimer = 0;
  const target = nearest(targets, npc);
  if (!target) return;
  npc.alerted = true;
  npc.alertX = target.x;
  npc.alertY = target.y;
  npc.alertTimer = CONFIG.wave.memorySteps;
}

/**
 * Pose un groupe aux places données, tourné vers `angle` (degrés GameMaker). `holding` : il tient sa place ;
 * sinon il part aussitôt à la poursuite. Retourne le nombre de soldats réellement posés.
 */
function deploy(world: World, units: Units, spots: Spot[], angle: number, holding: boolean, limit = Infinity): number {
  const targets = world.living();
  let placed = 0;
  for (const object of roster(world, units)) {
    const spot = spots.pop();
    if (!spot || placed >= limit) break;
    const npc = world.spawnNpc(object, spot.x, spot.y, angle);
    if (!npc) continue;
    // ni ronde ni flânerie : ils tiennent leur place, ou ils courent
    npc.patrolType = 'none';
    npc.hunt = HOLDING;
    if (!holding) {
      pursue(npc, targets);
      // les chemins ne sont pas tous recalculés au même step
      npc.repathTimer = world.rng.int(0, 40);
    }
    placed++;
  }
  return placed;
}

/** Places libres dehors, devant les portails 4, pour un groupe qui arrive. */
function outside(world: World): Spot[] {
  const zone = TV_STUDIO.wave.outside;
  // on ne pose personne sur un soldat déjà là
  const taken = world.npcs.filter((n) => n.x >= zone.x0 - 200 && n.x <= zone.x1 + 200 && n.y >= zone.y0 - 200 && n.y <= zone.y1 + 200);
  return freeSpots(world, zone, taken);
}

/** Soldats de la vague encore debout. */
export function waveAlive(world: World): Npc[] {
  return world.npcs.filter((n) => n.hunt > 0 && n.hp > 0);
}

/** Écarte les gardes d'origine qui se trouveraient dans un fourgon, ou à la place d'un policier du barrage. */
function clearBarricade(world: World): void {
  const line = TV_STUDIO.wave.line;
  for (const npc of world.npcs) {
    const r = npc.def.radius;
    const crowded = (x: number, y: number): boolean => line.some((p) => Math.hypot(p.x - x, p.y - y) < r + 50);
    if (world.collision.circleFree(npc.x, npc.y, r, BLOCK_MOVE) && !crowded(npc.x, npc.y)) continue;
    search: for (let d = 40; d <= 480; d += 40) {
      for (let a = 0; a < 12; a++) {
        const x = npc.x + Math.cos((a * Math.PI) / 6) * d;
        const y = npc.y + Math.sin((a * Math.PI) / 6) * d;
        if (!world.collision.circleFree(x, y, r + 8, BLOCK_MOVE) || crowded(x, y)) continue;
        npc.x = x;
        npc.y = y;
        break search;
      }
    }
  }
}

/**
 * Places du barrage pour `count` soldats : la ligne devant les fourgons d'abord, puis, au-delà de dix, les
 * places libres derrière elle, au plus près. Rendues dans l'ordre inverse : `deploy` les prend par la fin.
 */
function barricade(world: World, count: number): Spot[] {
  const line = TV_STUDIO.wave.line.filter((p) => world.collision.circleFree(p.x, p.y, 30, BLOCK_MOVE));
  const rear = freeSpots(world, TV_STUDIO.wave.rear, line).sort((a, b) => a.x - b.x || a.y - b.y);
  return [...line, ...rear].slice(0, count).reverse();
}

/**
 * Mise en place, à la fin de l'ultimatum : les fourgons barrent le parking, un groupe tient le barrage, en
 * ligne devant eux, tourné vers le bâtiment. Personne ne bouge encore.
 */
export function stageWave(world: World): void {
  world.waveSteps = 0;
  world.parkVans();
  clearBarricade(world);
  const players = world.session.heroNames.length;
  world.waveHeld = deploy(world, waveGroup(players), barricade(world, waveGroupSize(players)), 180, true);
}

/**
 * L'équipe a-t-elle trouvé le barrage ? `face` : un robot arrive à une porte du parking sud, ou s'y trouve
 * déjà. Rien d'autre ne déclenche le face-à-face (GD-092) : tirer dans le local technique ou sur le plateau
 * ne suffit pas, la ligne de police ne réagit à rien tant qu'il n'a pas eu lieu. Si l'un de ses hommes tombe
 * quand même (un tir de loin, une explosion), la scène se joue aussi. `west` : filet de sécurité, l'équipe a
 * quitté l'aile est par où elle est venue ; la police se lance à sa poursuite, sans face-à-face.
 */
function found(world: World): 'face' | 'west' | null {
  const p = TV_STUDIO.parkings.south;
  const team = world.living();
  const range = CONFIG.standoff.doorRange;
  const atDoor = (h: Hero): boolean => TV_STUDIO.wave.doors.some((d) => Math.hypot(h.x - d.x, h.y - d.y) <= range);
  if (team.some((h) => atDoor(h) || (h.x > p.x0 && h.x < p.x1 && h.y > p.y0 && h.y < p.y1))) return 'face';
  if (world.npcs.filter((n) => n.hunt === HOLDING).length < world.waveHeld) return 'face';
  return team.some((h) => h.x < TV_STUDIO.room.x0 - CONFIG.wave.leftWingMargin) ? 'west' : null;
}

/**
 * La police ouvre le feu : les portails 4 s'ouvrent, la ligne se lance, l'horloge des groupes suivants part.
 * Après le face-à-face, la consigne est déjà dite par le robot : elle change aussitôt.
 */
export function engage(world: World): void {
  if (world.waveSteps > 0) return;
  world.waveSteps = 1;
  for (const door of world.doors) if (door.kind === 'button' && door.doorId === CONFIG.wave.gates) world.openDoor(door);
  const targets = world.living();
  for (const npc of world.npcs) if (npc.hunt === HOLDING) pursue(npc, targets);
  if (world.session.objective === OBJ.dropPoint) world.session.objective = OBJ.northGate;
}

/** Sans face-à-face : la voix du véhicule prévient, un robot au sol annonce le plan B. */
function radioPlanB(world: World): void {
  const players = world.session.heroNames;
  const voice = vehicleVoice(players);
  world.emit({ type: 'radio', speaker: voice, text: TOO_MANY });
  const answer = groundVoice(world, voice) ?? players.find((name) => name !== voice);
  if (answer) world.emit({ type: 'radio', speaker: answer, text: NORTH_GARAGE });
}

export function stepWave(world: World): void {
  const cfg = CONFIG.wave;
  // en place : rien ne se passe tant que l'équipe n'est pas arrivée au sud
  if (world.waveSteps === 0) {
    const how = found(world);
    if (how === 'face') world.startStandoff();
    else if (how === 'west') {
      engage(world);
      world.wavePlanB = cfg.planChangeSteps;
    }
    return;
  }
  const t = ++world.waveSteps;
  if (world.wavePlanB > 0 && --world.wavePlanB === 0) radioPlanB(world);
  // un groupe de renfort entre de dehors, par les portails, tant qu'il reste de la place dans la troupe
  if (t % cfg.reinforceEverySteps === 0) {
    const players = world.session.heroNames.length;
    const room = waveCap(players) - waveAlive(world).length;
    if (room > 0) deploy(world, waveGroup(players), outside(world), 90, false, room);
  }
  // la traque : ceux qui n'ont plus personne en vue vont là où se trouve le robot le plus proche
  if (t % cfg.huntEverySteps !== 0) return;
  const targets = world.living();
  if (targets.length === 0) return;
  for (const npc of world.npcs) if (npc.hunt === HUNTING && !npc.spotted) pursue(npc, targets);
}
