// La riposte (GD-086) : après l'ultimatum, la police arrive en nombre par le sud. Ses fourgons sont sur le
// parking, sa troupe entre par les portails 4, traverse le local technique et le salon de sortie, et rallie
// le plateau ; ensuite elle traque les robots. Tant que l'équipe est là, des renforts arrivent : le sud ne se
// vide jamais.
import { CONFIG } from './config.ts';
import { TV_STUDIO } from './additions.ts';
import { vehicleVoice } from './broadcast.ts';
import { BLOCK_MOVE } from './geom.ts';
import { GO_ORDER } from './intro.ts';
import { OBJ } from './session.ts';
import type { Npc } from './types.ts';
import type { World } from './world.ts';

/** Ce que dit la voix du véhicule quand l'équipe découvre la troupe, et ce que répond un robot au sol. */
export const TOO_MANY = 'The south side is crawling with them. Forty, maybe fifty. Forget the drop point.';
export const NORTH_GATE = 'Then we leave through the north gate.';

/** `hunt` d'un PNJ de la vague : en route vers le plateau, puis à la recherche des robots. */
export const RALLYING = 1;
export const HUNTING = 2;

type Units = Record<string, number>;

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
function freeSpots(world: World, zone: { x0: number; x1: number; y0: number; y1: number }, taken: { x: number; y: number }[]): { x: number; y: number }[] {
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

/** Fait apparaître un groupe dans une zone. Retourne le nombre de soldats réellement posés. */
function deploy(world: World, units: Units, zone: { x0: number; x1: number; y0: number; y1: number }, limit = Infinity): number {
  // on ne pose personne sur un soldat déjà là
  const taken = world.npcs.filter((n) => n.x >= zone.x0 - 200 && n.x <= zone.x1 + 200 && n.y >= zone.y0 - 200 && n.y <= zone.y1 + 200);
  const spots = freeSpots(world, zone, taken);
  const rally = TV_STUDIO.wave.rally;
  let placed = 0;
  for (const object of roster(world, units)) {
    const spot = spots.pop();
    if (!spot || placed >= limit) break;
    const npc = world.spawnNpc(object, spot.x, spot.y, -90);
    if (!npc) continue;
    // ils savent où aller : pas de temps de surprise, et ils ne reprennent pas de ronde en route
    npc.active = true;
    npc.hunt = RALLYING;
    npc.patrolType = 'none';
    npc.alerted = true;
    npc.alertX = rally.x;
    npc.alertY = rally.y;
    npc.alertTimer = CONFIG.wave.memorySteps;
    // les chemins ne sont pas tous recalculés au même step
    npc.repathTimer = world.rng.int(0, 40);
    placed++;
  }
  return placed;
}

/** Soldats de la vague encore debout. */
export function waveAlive(world: World): Npc[] {
  return world.npcs.filter((n) => n.hunt > 0 && n.hp > 0);
}

/** Début de la riposte : les portails 4 s'ouvrent, les fourgons sont là, le premier groupe est à pied devant eux. */
export function startWave(world: World): void {
  const cfg = CONFIG.wave;
  world.waveSteps = 0;
  world.waveGroup = 1;
  world.parkVans();
  for (const door of world.doors) if (door.kind === 'button' && door.doorId === cfg.gates) world.openDoor(door);
  deploy(world, cfg.groups[0].units, TV_STUDIO.wave.parking);
}

/** Les robots au sol ont-ils rencontré la troupe ? Un robot au sud du plateau, ou un soldat de la vague dessus. */
function contact(world: World): boolean {
  const r = TV_STUDIO.room;
  if (world.living().some((h) => h.y > r.y1 && h.x > r.x0)) return true;
  return world.npcs.some((n) => n.hunt > 0 && n.x > r.x0 && n.x < r.x1 && n.y > r.y0 && n.y < r.y1);
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
  const t = ++world.waveSteps;
  // les groupes suivants arrivent de dehors, par les portails
  const group = cfg.groups[world.waveGroup];
  if (group && t >= group.atSteps) {
    deploy(world, group.units, TV_STUDIO.wave.outside);
    world.waveGroup++;
  }
  // puis des renforts, tant qu'il reste de la place dans la troupe
  const last = cfg.groups[cfg.groups.length - 1].atSteps;
  if (!group && (t - last) % cfg.reinforce.everySteps === 0) {
    const room = cfg.reinforce.maxAlive - waveAlive(world).length;
    if (room > 0) deploy(world, cfg.reinforce.units, TV_STUDIO.wave.outside, room);
  }
  if (world.session.objective === OBJ.dropPoint && (t >= cfg.planChangeSteps || contact(world))) changePlan(world);
  // la traque : ceux qui ont atteint le plateau sans trouver personne, et ceux qui ont perdu les robots de
  // vue, vont là où se trouve le robot le plus proche
  if (t % cfg.huntEverySteps !== 0) return;
  const targets = world.living();
  if (targets.length === 0) return;
  for (const npc of world.npcs) {
    if (npc.hunt === 0 || npc.spotted) continue;
    if (npc.hunt === RALLYING && npc.alertTimer > 0) continue;
    npc.hunt = HUNTING;
    let best = targets[0];
    for (const h of targets) if (Math.hypot(h.x - npc.x, h.y - npc.y) < Math.hypot(best.x - npc.x, best.y - npc.y)) best = h;
    npc.alerted = true;
    npc.alertX = best.x;
    npc.alertY = best.y;
    npc.alertTimer = cfg.memorySteps;
  }
}
