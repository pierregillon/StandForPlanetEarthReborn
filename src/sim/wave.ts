// La riposte (GD-086, GD-087) : après l'ultimatum, la police est au sud. Ses fourgons sont sur le parking, un
// premier groupe à pied devant eux. Rien ne bouge tant que l'équipe n'y est pas : c'est en arrivant sur le
// parking qu'elle la découvre. Alors les portails 4 s'ouvrent et la troupe grossit, groupe après groupe, puis
// par des renforts : le sud ne se vide jamais. Chaque soldat va droit sur le robot le plus proche.
import { CONFIG } from './config.ts';
import { TV_STUDIO } from './additions.ts';
import { vehicleVoice } from './broadcast.ts';
import { BLOCK_MOVE } from './geom.ts';
import { GO_ORDER } from './intro.ts';
import { alertSoldier } from './npc.ts';
import { OBJ } from './session.ts';
import type { Hero, Npc } from './types.ts';
import type { World } from './world.ts';

/** Ce que dit la voix du véhicule quand l'équipe découvre la troupe, et ce que répond un robot au sol. */
export const TOO_MANY = 'The south side is crawling with them. Forty, maybe fifty. Forget the drop point.';
export const NORTH_GATE = 'Then we leave through the north gate.';

/** `hunt` d'un PNJ de la vague : en place devant les fourgons, puis à la poursuite des robots. */
export const HOLDING = 1;
export const HUNTING = 2;

type Units = Record<string, number>;
type Area = { x0: number; x1: number; y0: number; y1: number };

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
function freeSpots(world: World, zone: Area, taken: { x: number; y: number }[]): { x: number; y: number }[] {
  const { spacing, clearance } = CONFIG.wave;
  const spots: { x: number; y: number }[] = [];
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

function nearest(heroes: Hero[], p: { x: number; y: number }): Hero | null {
  let best: Hero | null = null;
  for (const h of heroes) if (!best || Math.hypot(h.x - p.x, h.y - p.y) < Math.hypot(best.x - p.x, best.y - p.y)) best = h;
  return best;
}

/** Lance un soldat de la vague sur le robot le plus proche. */
function pursue(world: World, npc: Npc, targets: Hero[]): void {
  npc.hunt = HUNTING;
  const target = nearest(targets, npc);
  if (!target) return;
  npc.alerted = true;
  npc.alertX = target.x;
  npc.alertY = target.y;
  npc.alertTimer = CONFIG.wave.memorySteps;
}

/**
 * Fait apparaître un groupe dans une zone, tourné vers `angle` (degrés GameMaker). `holding` : il reste en
 * place ; sinon il part aussitôt à la poursuite. Retourne le nombre de soldats réellement posés.
 */
function deploy(world: World, units: Units, zone: Area, angle: number, holding: boolean, limit = Infinity): number {
  // on ne pose personne sur un soldat déjà là
  const taken = world.npcs.filter((n) => n.x >= zone.x0 - 200 && n.x <= zone.x1 + 200 && n.y >= zone.y0 - 200 && n.y <= zone.y1 + 200);
  const spots = freeSpots(world, zone, taken);
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
      // ceux qui entrent par les portails savent où aller : pas de temps de surprise
      npc.active = true;
      pursue(world, npc, targets);
      // les chemins ne sont pas tous recalculés au même step
      npc.repathTimer = world.rng.int(0, 40);
    }
    placed++;
  }
  return placed;
}

/** Soldats de la vague encore debout. */
export function waveAlive(world: World): Npc[] {
  return world.npcs.filter((n) => n.hunt > 0 && n.hp > 0);
}

/** Écarte les gardes d'origine qui se trouveraient là où un fourgon vient de se garer. */
function clearOfVans(world: World): void {
  for (const npc of world.npcs) {
    const r = npc.def.radius;
    if (world.collision.circleFree(npc.x, npc.y, r, BLOCK_MOVE)) continue;
    search: for (let d = 40; d <= 480; d += 40) {
      for (let a = 0; a < 12; a++) {
        const x = npc.x + Math.cos((a * Math.PI) / 6) * d;
        const y = npc.y + Math.sin((a * Math.PI) / 6) * d;
        if (!world.collision.circleFree(x, y, r + 8, BLOCK_MOVE)) continue;
        npc.x = x;
        npc.y = y;
        break search;
      }
    }
  }
}

/**
 * Mise en place, à la fin de l'ultimatum : les fourgons sont garés, le premier groupe est à pied devant eux,
 * tourné vers le bâtiment. Personne ne bouge encore.
 */
export function stageWave(world: World): void {
  world.waveSteps = 0;
  world.waveGroup = 1;
  world.parkVans();
  // un garde d'origine pouvait se tenir à l'emplacement d'un fourgon
  clearOfVans(world);
  world.waveHeld = deploy(world, CONFIG.wave.groups[0].units, TV_STUDIO.wave.hold, 180, true);
}

/**
 * L'équipe a-t-elle trouvé la troupe ? Un robot sur le parking sud, un soldat en place qui l'a vue ou
 * entendue, ou l'un d'eux abattu de loin. Filet de sécurité : si l'équipe quitte l'aile est par où elle est
 * venue, vers l'ouest, la police se lance quand même à sa poursuite.
 */
function found(world: World): boolean {
  const p = TV_STUDIO.parkings.south;
  const west = TV_STUDIO.room.x0 - CONFIG.wave.leftWingMargin;
  if (world.living().some((h) => h.x < west || (h.x > p.x0 && h.x < p.x1 && h.y > p.y0 && h.y < p.y1))) return true;
  const holding = world.npcs.filter((n) => n.hunt === HOLDING);
  return holding.length < world.waveHeld || holding.some((n) => n.alerted || n.spotted);
}

/** La riposte commence : les portails 4 s'ouvrent, ceux qui attendaient devant les fourgons se lancent. */
function launch(world: World): void {
  for (const door of world.doors) if (door.kind === 'button' && door.doorId === CONFIG.wave.gates) world.openDoor(door);
  const targets = world.living();
  for (const npc of world.npcs) {
    if (npc.hunt !== HOLDING) continue;
    npc.active = true;
    const target = nearest(targets, npc);
    // ceux qui n'avaient encore rien vu marquent le temps de surprise de n'importe quel soldat
    if (target) alertSoldier(npc, target.x, target.y);
    pursue(world, npc, targets);
  }
}

/** Le plan change : la voix du véhicule prévient, un robot au sol décide de sortir par le nord. */
function changePlan(world: World): void {
  world.session.objective = OBJ.northGate;
  const players = world.session.heroNames;
  const voice = vehicleVoice(players);
  world.emit({ type: 'radio', speaker: voice, text: TOO_MANY });
  const ground = world.living().map((h) => h.def.name);
  const answer = GO_ORDER.find((name) => ground.includes(name) && name !== voice) ?? GO_ORDER.find((name) => players.includes(name) && name !== voice);
  if (answer) world.emit({ type: 'radio', speaker: answer, text: NORTH_GATE });
}

export function stepWave(world: World): void {
  const cfg = CONFIG.wave;
  // en place : rien ne se passe tant que l'équipe n'est pas arrivée au sud
  if (world.waveSteps === 0) {
    if (!found(world)) return;
    launch(world);
  }
  const t = ++world.waveSteps;
  // les groupes suivants arrivent de dehors, par les portails, de plus en plus nombreux
  const group = cfg.groups[world.waveGroup];
  if (group && t >= group.atSteps) {
    deploy(world, group.units, TV_STUDIO.wave.outside, 90, false);
    world.waveGroup++;
  }
  // puis des renforts, tant qu'il reste de la place dans la troupe
  const last = cfg.groups[cfg.groups.length - 1].atSteps;
  if (!group && (t - last) % cfg.reinforce.everySteps === 0) {
    const room = cfg.reinforce.maxAlive - waveAlive(world).length;
    if (room > 0) deploy(world, cfg.reinforce.units, TV_STUDIO.wave.outside, 90, false, room);
  }
  if (world.session.objective === OBJ.dropPoint && t >= cfg.planChangeSteps) changePlan(world);
  // la traque : ceux qui n'ont plus personne en vue vont là où se trouve le robot le plus proche
  if (t % cfg.huntEverySteps !== 0) return;
  const targets = world.living();
  if (targets.length === 0) return;
  for (const npc of world.npcs) if (npc.hunt === HUNTING && !npc.spotted) pursue(world, npc, targets);
}
