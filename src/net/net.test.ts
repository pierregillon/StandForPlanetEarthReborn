// Test de bout en bout du multijoueur, sans navigateur ni WebSocket (ADR-014) : un salon, deux clients
// simulés, chacun avec son monde miroir. On vérifie le salon, puis que les miroirs suivent le serveur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Lobby } from '../../server/game.ts';
import type { Peer } from '../../server/game.ts';
import { NO_INPUT } from '../sim/types.ts';
import { CONFIG } from '../sim/config.ts';
import { TV_STUDIO } from '../sim/additions.ts';
import { OBJ } from '../sim/session.ts';
import { BLOCK_MOVE } from '../sim/geom.ts';
import type { Input, LevelData, SpriteManifest } from '../sim/types.ts';
import type { ClientMessage, LobbyState, RoomStart, ServerMessage } from './messages.ts';
import { Mirror } from './mirror.ts';

const load = <T>(path: string): T => JSON.parse(readFileSync(new URL(`../../public/${path}`, import.meta.url), 'utf8')) as T;
const sprites = load<SpriteManifest>('assets/sprites.json');
const levels: Record<string, LevelData> = {};
for (const room of ['rm_world2', 'rm_world2_1', 'rm_world2_2']) levels[room] = load<LevelData>(`levels/${room}.json`);

/** Client simulé : reçoit les messages du serveur, tient son miroir à jour. */
class FakeClient implements Peer {
  id: number;
  name: string;
  lobby: LobbyState | null = null;
  errors: string[] = [];
  mirror: Mirror | null = null;
  over = false;
  bytes = 0;
  /** Répond « prêt » dès que la salle est annoncée (un vrai client charge d'abord ses images). */
  autoReady = true;
  waiting: { name: string; progress: number }[] = [];
  private readonly server: Lobby;

  constructor(id: number, server: Lobby) {
    this.id = id;
    this.name = `P${id}`;
    this.server = server;
  }

  send(text: string): void {
    this.bytes += text.length;
    const msg = JSON.parse(text) as ServerMessage;
    if (msg.t === 'lobby') this.lobby = msg;
    else if (msg.t === 'error') this.errors.push(msg.text);
    else if (msg.t === 'room') this.enter(msg);
    else if (msg.t === 's' && this.mirror && msg.epoch === this.mirror.epoch) this.mirror.receive(msg.snap, msg.ack, msg.ev);
    else if (msg.t === 'over') this.over = true;
    else if (msg.t === 'wait') this.waiting = msg.players;
  }

  private enter(start: RoomStart): void {
    this.mirror = new Mirror(levels[start.room], sprites, start);
    if (this.autoReady) this.say({ t: 'ready', epoch: start.epoch });
  }

  say(msg: ClientMessage): void {
    this.server.handle(this, JSON.parse(JSON.stringify(msg)) as ClientMessage);
  }

  /** Un step : envoie son entrée, comme le fait le navigateur 60 fois par seconde. */
  play(input: Input): void {
    if (!this.mirror) return;
    this.say({ t: 'i', e: this.mirror.epoch, ...this.mirror.tick(input) });
  }
}

function setup(count: number): { server: Lobby; clients: FakeClient[] } {
  const clients: FakeClient[] = [];
  const server = new Lobby(levels, sprites, () => clients);
  for (let i = 1; i <= count; i++) clients.push(new FakeClient(i, server));
  return { server, clients };
}

test('salon : créer, rejoindre, choisir un robot une seule fois, lancer', () => {
  const { server, clients: [a, b, c] } = setup(3);
  b.say({ t: 'join' });
  assert.match(b.errors.pop() ?? '', /No game/);
  a.say({ t: 'create' });
  assert.equal(c.lobby?.open, true, 'ceux restés au menu voient la partie ouverte');
  assert.equal(c.lobby?.joined, false);
  b.say({ t: 'join' });
  assert.equal(a.lobby?.players.length, 2);
  assert.equal(a.lobby?.host, a.id);

  a.say({ t: 'pick', hero: 'PetBot' });
  b.say({ t: 'pick', hero: 'PetBot' });
  assert.equal(b.lobby?.players.find((p) => p.id === b.id)?.hero, null, 'robot déjà pris : refusé');
  b.say({ t: 'pick', hero: 'NoSuchBot' });
  assert.equal(b.lobby?.players.find((p) => p.id === b.id)?.hero, null);
  a.say({ t: 'start' });
  assert.match(a.errors.pop() ?? '', /pick a robot/);
  b.say({ t: 'pick', hero: 'BadaBot' });
  b.say({ t: 'start' });
  assert.equal(server.playing, false, 'seul l\'hôte lance la partie');
  a.say({ t: 'start' });
  assert.equal(server.playing, true);
  assert.deepEqual(server.currentWorld?.heroes.map((h) => h.def.kind), ['PetBot', 'BadaBot']);
  assert.equal(a.mirror?.me, 0);
  assert.equal(b.mirror?.me, 1);

  c.say({ t: 'join' });
  assert.match(c.errors.pop() ?? '', /already started/);
});

test('en jeu : les miroirs suivent le serveur, mon robot est prédit sans attendre', () => {
  const { server, clients: [a, b] } = setup(2);
  a.say({ t: 'create' });
  b.say({ t: 'join' });
  a.say({ t: 'pick', hero: 'PetBot' });
  b.say({ t: 'pick', hero: 'BatBot' });
  a.say({ t: 'start' });
  const world = server.currentWorld;
  assert.ok(world && a.mirror && b.mirror);
  world.npcs = world.npcs.filter((n) => n.def.kind !== 'soldier'); // pas de combat pendant la mesure
  const idle: Input = { ...NO_INPUT, aimX: 5000, aimY: 7000 };
  const step = (ia: Input, ib: Input): void => {
    a.play(ia);
    b.play(ib);
    server.tick();
  };
  // l'introduction : l'horloge s'arrête sur la première réplique, que seul l'hôte peut faire avancer (GD-079)
  for (let i = 0; i < 200; i++) step(idle, idle);
  assert.equal(world.introLine, 0);
  step(idle, { ...idle, dashPressed: true, dash: true });
  for (let i = 0; i < 10; i++) step(idle, idle);
  assert.equal(world.introLine, 0, 'un autre joueur ne fait pas défiler les répliques');
  step({ ...idle, dashPressed: true, dash: true }, idle);
  for (let i = 0; i < 10; i++) step(idle, idle);
  assert.equal(world.introLine, 1, 'l\'hôte passe à la réplique suivante');
  assert.equal(a.mirror.world.introLine, 1, 'les miroirs suivent la réplique en cours');
  assert.equal(b.mirror.world.introLine, 1);
  // coupe vers le plan suivant, puis l'horloge de l'arrivée s'arrête de nouveau sur la réplique
  for (let i = 0; i < 60; i++) step(idle, idle);
  const stopped = world.heroes[0].arrivalSteps;
  for (let i = 0; i < 60; i++) step(idle, idle);
  assert.equal(world.heroes[0].arrivalSteps, stopped, 'l\'horloge de l\'arrivée est arrêtée pendant les répliques');
  // un autre joueur tient la touche : rien ; l'hôte la tient : la séquence est passée
  for (let i = 0; i < 80; i++) step(idle, { ...idle, dash: true });
  assert.equal(world.heroes[0].arrivalSteps, stopped);
  for (let i = 0; i < 80; i++) step({ ...idle, dash: true }, idle);
  assert.equal(world.heroes[0].arrivalSteps, 0, 'l\'hôte passe la séquence en tenant la touche');
  assert.equal(world.heroes[1].arrivalSteps, 0);
  // puis le déploiement
  for (let i = 0; i < 700 && world.heroes.some((h) => h.arrivalSteps > 0 || h.deploySteps > 0); i++) step(idle, idle);
  assert.equal(world.heroes[0].deploySteps, 0);
  assert.equal(a.mirror.world.heroes[0].deploySteps, 0, 'le miroir a suivi le déploiement');

  const right: Input = { ...idle, moveX: 1, aimX: 9000 };
  const x0 = world.heroes[0].x;
  step(right, idle);
  assert.ok(a.mirror.world.heroes[0].x > x0, 'mon robot bouge dès mon step, avant toute réponse du serveur');
  for (let i = 0; i < 59; i++) step(right, idle);
  for (let i = 0; i < 12; i++) step(idle, idle);
  a.mirror.frame(1000);
  b.mirror.frame(1000);
  const sx = world.heroes[0].x;
  assert.ok(sx > x0 + 400, 'le serveur a joué les entrées reçues');
  assert.ok(Math.abs(a.mirror.world.heroes[0].x - sx) < 0.5, `prédiction et serveur d'accord (${a.mirror.world.heroes[0].x} / ${sx})`);
  assert.ok(Math.abs(b.mirror.world.heroes[0].x - sx) < 0.5, 'l\'autre joueur le voit au même endroit');
  assert.ok(Math.abs(a.mirror.world.heroes[0].angle - world.heroes[0].angle) < 0.02);
  // la distance de marche (qui anime le robot) ne doit pas etre recomptee a chaque instantane
  const walked = world.heroes[0].walkDist;
  assert.ok(Math.abs(a.mirror.world.heroes[0].walkDist - walked) < walked * 0.1, `distance de marche : ${a.mirror.world.heroes[0].walkDist} chez le client, ${walked} sur le serveur`);

  // le reste du monde est le même partout
  assert.equal(a.mirror.world.npcs.length, world.npcs.length);
  assert.equal(b.mirror.world.fogs.length, world.fogs.length);
  assert.equal(b.mirror.world.session.objective, world.session.objective);
  const npc = world.npcs[0];
  const seen = b.mirror.world.npcs.find((n) => n.id === npc.id);
  // à quelques pixels près : un PNJ qui marche est vu avec un instantané de retard
  assert.ok(seen && Math.abs(seen.x - npc.x) < 15 && seen.def === npc.def, 'les PNJ sont à leur place, avec leurs réglages');

  // un tir de PetBot (GD-093) : ses mini-drones apparaissent chez l'autre joueur, à leur place
  for (let i = 0; i < 30; i++) step({ ...idle, aimX: 9000, fire1: true }, idle);
  assert.ok(world.heroes[0].ammo < world.heroes[0].def.magazine);
  assert.equal(world.bullets.length, 0);
  assert.ok(world.seekers.length > 0);
  b.mirror.frame(1000);
  const drone = world.seekers[0];
  const shown = b.mirror.world.seekers.find((d) => d.id === drone.id);
  assert.ok(shown && Math.hypot(shown.x - drone.x, shown.y - drone.y) < 150, 'les drones sont visibles chez l\'autre joueur');
  assert.equal(a.mirror.world.heroes[0].ammo, world.heroes[0].ammo);
  for (let i = 0; i < 150; i++) step(idle, idle);
  assert.equal(world.seekers.length, 0);
  assert.equal(b.mirror.world.seekers.length, 0, 'et ils disparaissent quand le serveur les retire');

  // trafic : en régime calme, un client reçoit peu de choses
  a.bytes = 0;
  for (let i = 0; i < 120; i++) step(idle, idle);
  assert.ok(a.bytes / 2 < 6000, `moins de 6 ko/s au repos, avant compression (mesuré : ${Math.round(a.bytes / 2)} o/s)`);
});

test('un joueur qui part : son robot disparaît, l\'hôte change, la partie se ferme au dernier départ', () => {
  const { server, clients: [a, b] } = setup(2);
  a.say({ t: 'create' });
  b.say({ t: 'join' });
  a.say({ t: 'pick', hero: 'EngiBot' });
  b.say({ t: 'pick', hero: 'PetBot' });
  a.say({ t: 'start' });
  server.disconnect(a);
  assert.equal(server.currentWorld?.heroes[0].gone, true);
  assert.equal(b.lobby?.host, b.id);
  for (let i = 0; i < 10; i++) {
    b.play(NO_INPUT);
    server.tick();
  }
  assert.equal(b.mirror?.world.heroes[0].gone, true, 'l\'autre joueur le voit partir');
  b.say({ t: 'leave' });
  assert.equal(server.playerCount, 0);
  a.say({ t: 'create' });
  assert.equal(a.lobby?.joined, true, 'une nouvelle partie peut être créée');
});

test('changement de salle et Retry : le serveur ouvre la salle, les clients rebâtissent leur miroir', () => {
  const { server, clients: [a, b] } = setup(2);
  a.say({ t: 'create' });
  b.say({ t: 'join' });
  a.say({ t: 'pick', hero: 'PetBot' });
  b.say({ t: 'pick', hero: 'EngiBot' });
  a.say({ t: 'start' });
  const ground = server.currentWorld;
  assert.ok(ground && a.mirror && b.mirror);
  ground.npcs = [];
  const run = (n: number): void => {
    for (let i = 0; i < n; i++) {
      a.play(NO_INPUT);
      b.play(NO_INPUT);
      server.tick();
    }
  };
  run(700);
  const firstEpoch = a.mirror.epoch;

  // toute l'équipe sur l'escalier : on monte
  const stairs = ground.zones.find((z) => z.targetRoom === 'rm_world2_1');
  assert.ok(stairs);
  ground.heroes[0].hp = 6;
  for (const h of ground.heroes) {
    h.x = stairs.x;
    h.y = stairs.y;
  }
  run(5);
  const upper = server.currentWorld;
  assert.ok(upper && upper !== ground);
  assert.equal(upper.level.name, 'rm_world2_1');
  assert.equal(a.mirror.world.level.name, 'rm_world2_1', 'le client a rebâti son miroir sur la nouvelle salle');
  assert.equal(a.mirror.epoch, firstEpoch + 1);
  run(10);
  assert.equal(a.mirror.world.heroes[0].hp, 6, 'chacun garde ses points de vie');
  assert.ok(Math.abs(b.mirror.world.heroes[0].x - upper.heroes[0].x) < 1);
  assert.equal(b.mirror.world.session.objective, 1, 'la consigne suivante est affichée chez tout le monde');

  // toute l'équipe à terre : seul l'hôte peut relancer, et la partie recommence au début
  upper.npcs = [];
  for (const h of upper.heroes) upper.damageHero(h, 99, true);
  run(200);
  assert.equal(a.over && b.over, true);
  assert.equal(a.mirror.world.gameOver, true, 'le miroir sait que la partie est perdue');
  b.say({ t: 'retry' });
  assert.equal(server.playing, false);
  a.say({ t: 'retry' });
  assert.equal(server.playing, true);
  run(5);
  assert.equal(server.currentWorld?.level.name, 'rm_world2');
  assert.equal(b.mirror.world.level.name, 'rm_world2');
  assert.equal(b.mirror.world.heroes[1].state !== 'dead', true);
});

test('l\'ultimatum en réseau : les miroirs le suivent, l\'hôte le mène, Retry ramène sur le plateau (GD-085)', () => {
  const { server, clients: [a, b] } = setup(2);
  a.say({ t: 'create' });
  b.say({ t: 'join' });
  a.say({ t: 'pick', hero: 'PetBot' });
  b.say({ t: 'pick', hero: 'BatBot' });
  a.say({ t: 'start' });
  const world = server.currentWorld;
  assert.ok(world && a.mirror && b.mirror);
  world.npcs = [];
  const step = (ia: Input = NO_INPUT, ib: Input = NO_INPUT): void => {
    a.play(ia);
    b.play(ib);
    server.tick();
  };
  // on passe l'introduction, puis on place la partie au moment d'entrer en régie
  for (let i = 0; i < 80; i++) step({ ...NO_INPUT, dash: true });
  for (let i = 0; i < 700 && world.heroes.some((h) => h.arrivalSteps > 0 || h.deploySteps > 0); i++) step();
  world.session.objective = OBJ.controlRoom;
  const button = world.buttons.find((k) => k.doorId === CONFIG.broadcast.controlRoomButton);
  assert.ok(button);
  world.heroes[1].x = button.x + Math.cos(button.angle) * 50;
  world.heroes[1].y = button.y + Math.sin(button.angle) * 50;
  for (let i = 0; i < 8; i++) step();
  a.mirror.world.drainEvents();
  step(NO_INPUT, { ...NO_INPUT, usePressed: true, use: true });
  for (let i = 0; i < 8; i++) step();
  const radio = a.mirror.world.drainEvents().find((e) => e.type === 'radio');
  assert.ok(radio && radio.type === 'radio' && radio.speaker === 'BatBot', 'la réplique radio arrive chez l\'autre joueur');
  assert.equal(a.mirror.world.session.objective, OBJ.studio);

  // les deux robots sur la marque : le compte à rebours, puis l'ultimatum, chez tout le monde
  world.heroes.forEach((h, i) => {
    h.x = TV_STUDIO.mark.x + 20;
    h.y = TV_STUDIO.mark.y - 40 + i * 80;
  });
  for (let i = 0; i < 20; i++) step();
  assert.ok(world.markCountdown > 0);
  assert.ok(b.mirror.world.markCountdown > 0, 'le miroir affiche le compte à rebours');
  for (let i = 0; i < CONFIG.broadcast.countdownSteps + 70; i++) step();
  assert.ok(world.cast >= 0);
  assert.ok(a.mirror.world.cast >= 0 && b.mirror.world.cast >= 0, 'les miroirs sont dans la séquence');
  assert.equal(b.mirror.world.castReader, world.castReader);
  assert.equal(world.heroes[world.castReader].def.name, 'BatBot');
  assert.equal(world.introLine, 0);
  // mon robot ne bouge pas pendant la séquence, même prédit
  const x = b.mirror.world.heroes[1].x;
  for (let i = 0; i < 10; i++) step(NO_INPUT, { ...NO_INPUT, moveX: -1 });
  assert.equal(b.mirror.world.heroes[1].x, x);
  // seul l'hôte fait défiler
  step(NO_INPUT, { ...NO_INPUT, dashPressed: true, dash: true });
  for (let i = 0; i < 8; i++) step();
  assert.equal(world.introLine, 0);
  step({ ...NO_INPUT, dashPressed: true, dash: true });
  step();
  step({ ...NO_INPUT, dashPressed: true, dash: true });
  for (let i = 0; i < 8; i++) step();
  assert.equal(world.introLine, 1);
  assert.equal(b.mirror.world.introLine, 1);
  // il passe le reste en tenant la touche
  for (let i = 0; i < 80 && world.cast >= 0; i++) step({ ...NO_INPUT, dash: true });
  for (let i = 0; i < 8; i++) step();
  assert.equal(world.cast, -1);
  assert.equal(b.mirror.world.cast, -1);
  assert.equal(b.mirror.world.session.objective, OBJ.dropPoint);

  // la riposte (GD-086) : les soldats apparus en cours de partie et les fourgons existent aussi chez les clients
  for (let i = 0; i < 20; i++) step();
  assert.equal(world.npcs.length, 18, 'le groupe de la police, pour deux joueurs');
  assert.equal(b.mirror.world.npcs.length, 18, 'le miroir les a créés');
  b.mirror.frame(1000);
  const cop = world.npcs[3];
  const seenCop = b.mirror.world.npcs.find((n) => n.id === cop.id);
  assert.ok(seenCop && seenCop.def === cop.def && Math.abs(seenCop.x - cop.x) < 40 && seenCop.hp === cop.hp, 'avec leurs réglages, à leur place');
  const van = TV_STUDIO.wave.vans[0];
  assert.equal(b.mirror.world.decor.filter((d) => d.sprite === 'spr_pk_police_van').length, 3, 'les fourgons sont sur le parking du miroir');
  assert.equal(b.mirror.world.collision.circleFree(van.x, van.y, 40, BLOCK_MOVE), false, 'et ce sont des obstacles pour la prédiction');
  world.npcs.length = 0;
  for (let i = 0; i < 8; i++) step();
  assert.equal(b.mirror.world.npcs.length, world.npcs.length, 'ceux qui tombent disparaissent du miroir');

  // le barrage a perdu des hommes : le face-à-face commence (GD-088), chez tout le monde, et l'hôte le passe
  assert.ok(world.cast >= 0 && world.castScene === 1);
  assert.deepEqual([b.mirror.world.cast >= 0, b.mirror.world.castScene, b.mirror.world.castReader], [true, 1, world.castReader]);
  for (let i = 0; i < 80 && world.cast >= 0; i++) step({ ...NO_INPUT, dash: true });
  for (let i = 0; i < 8; i++) step();
  assert.equal(world.cast, -1);
  assert.equal(b.mirror.world.cast, -1);
  assert.equal(b.mirror.world.session.objective, OBJ.northGate);

  // toute l'équipe tombe : Retry reprend sur le plateau, après le message
  for (const h of world.heroes) world.damageHero(h, 99, true);
  for (let i = 0; i < 200; i++) step();
  assert.equal(a.over && b.over, true);
  a.say({ t: 'retry' });
  for (let i = 0; i < 12; i++) step();
  const again = server.currentWorld;
  assert.ok(again && again !== world);
  assert.equal(again.level.name, 'rm_world2');
  assert.equal(again.objective, 'Leave by the south parking lot');
  const r = TV_STUDIO.room;
  for (const [i, h] of again.heroes.entries()) {
    assert.ok(h.x > r.x0 && h.x < r.x1 && h.y > r.y0 && h.y < r.y1, 'l\'équipe reprend sur le plateau');
    assert.equal(h.arrivalSteps, 0, 'sans largage');
    const seen = b.mirror.world.heroes[i];
    assert.ok(Math.abs(seen.x - h.x) < 1 && Math.abs(seen.y - h.y) < 1, 'les miroirs la voient au même endroit');
  }
  assert.equal(b.mirror.world.session.objective, OBJ.dropPoint);
  // GD-087 : la salle revient comme au point de sauvegarde (ici, sans aucun garde), et le miroir aussi
  for (let i = 0; i < 12; i++) step();
  assert.equal(again.npcs.length, 18, 'seul le groupe en place devant les fourgons');
  assert.equal(b.mirror.world.npcs.length, 18);
});

test('la téléportation de développement est refusée par défaut', () => {
  const { server, clients: [a] } = setup(1);
  a.say({ t: 'create' });
  a.say({ t: 'pick', hero: 'PetBot' });
  a.say({ t: 'start' });
  const x = server.currentWorld?.heroes[0].x;
  a.say({ t: 'teleport', x: 100, y: 100 });
  assert.equal(server.currentWorld?.heroes[0].x, x);
});

test('chargement d\'une salle : le jeu attend que tous les joueurs soient prêts, et dit qui charge', () => {
  const { server, clients: [a, b] } = setup(2);
  b.autoReady = false;
  a.say({ t: 'create' });
  b.say({ t: 'join' });
  a.say({ t: 'pick', hero: 'PetBot' });
  b.say({ t: 'pick', hero: 'BatBot' });
  a.say({ t: 'start' });
  const world = server.currentWorld;
  assert.ok(world && a.mirror && b.mirror);
  // bien plus longtemps que l'ancienne limite de 20 s : on attend toujours
  for (let i = 0; i < 3000; i++) {
    a.play({ ...NO_INPUT, moveX: 1 });
    server.tick();
  }
  assert.equal(world.tick, 0, 'le jeu n\'a pas commencé');
  assert.deepEqual(a.waiting, [{ name: 'P2', progress: 0 }]);
  b.say({ t: 'loading', epoch: b.mirror.epoch, p: 0.6 });
  assert.deepEqual(a.waiting, [{ name: 'P2', progress: 0.6 }]);
  b.say({ t: 'ready', epoch: b.mirror.epoch });
  assert.deepEqual(a.waiting, []);
  const x = world.heroes[0].x;
  for (let i = 0; i < 10; i++) server.tick();
  assert.equal(world.tick, 10);
  assert.equal(world.heroes[0].x, x, 'les entrées envoyées pendant l\'attente n\'ont pas été gardées');

  // un joueur qui part pendant son chargement ne bloque pas les autres
  const { server: s2, clients: [c, d] } = setup(2);
  d.autoReady = false;
  c.say({ t: 'create' });
  d.say({ t: 'join' });
  c.say({ t: 'pick', hero: 'PetBot' });
  d.say({ t: 'pick', hero: 'BatBot' });
  c.say({ t: 'start' });
  s2.disconnect(d);
  assert.deepEqual(c.waiting, []);
  s2.tick();
  assert.equal(s2.currentWorld?.tick, 1);
});

test('les bornes gardées ne dépendent pas de la porte par où l\'on entre dans la salle', async () => {
  const { World } = await import('../sim/world.ts');
  const { GROUND_FLOOR, createSession } = await import('../sim/session.ts');
  const { readFileSync } = await import('node:fs');
  const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8'));
  const manifest = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8'));
  const outletsFrom = (spawnNumber: number): string[] => {
    const session = createSession(['PetBot', 'BatBot'], GROUND_FLOOR);
    session.spawnNumber = spawnNumber;
    return new World(ground, manifest, ['PetBot', 'BatBot'], 1, session).outlets.map((o) => `${o.id}:${o.x},${o.y}`);
  };
  // le serveur garde le monde de la première visite (entrée 1) ; le client reconstruit le sien au retour de
  // l'étage (entrée 2) : les deux doivent avoir les mêmes bornes
  assert.equal(outletsFrom(1).length, 4);
  assert.deepEqual(outletsFrom(2), outletsFrom(1));
});

test('l\'hôte choisit le point de départ : après l\'ultimatum, toute l\'équipe commence sur le plateau (GD-091)', () => {
  const { server, clients: [a, b] } = setup(2);
  a.say({ t: 'create' });
  b.say({ t: 'join' });
  a.say({ t: 'pick', hero: 'PetBot' });
  b.say({ t: 'pick', hero: 'BatBot' });
  // un point de départ inconnu est refusé, et seul l'hôte choisit
  a.say({ t: 'start', at: 'nowhere' });
  assert.match(a.errors.pop() ?? '', /Unknown starting point/);
  assert.equal(server.playing, false);
  b.say({ t: 'start', at: 'studio' });
  assert.equal(server.playing, false, 'seul l\'hôte lance la partie');
  a.say({ t: 'start', at: 'studio' });
  assert.equal(server.playing, true);
  const world = server.currentWorld;
  assert.ok(world);
  assert.equal(world.level.name, 'rm_world2');
  assert.equal(world.objective, 'Leave by the south parking lot');
  const r = TV_STUDIO.room;
  for (const h of world.heroes) {
    assert.ok(h.x > r.x0 && h.x < r.x1 && h.y > r.y0 && h.y < r.y1, 'sur le plateau');
    assert.equal(h.arrivalSteps, 0, 'sans largage');
  }
  // les miroirs sont dans la même partie : même salle, même consigne, mêmes places, et le barrage de police
  for (let i = 0; i < 12; i++) {
    a.play(NO_INPUT);
    b.play(NO_INPUT);
    server.tick();
  }
  for (const client of [a, b]) {
    const mirror = client.mirror;
    assert.ok(mirror);
    assert.equal(mirror.world.level.name, 'rm_world2');
    assert.equal(mirror.world.session.objective, OBJ.dropPoint);
    assert.ok(mirror.world.session.carried.has('purple'));
    assert.equal(mirror.world.npcs.length, world.npcs.length);
    assert.equal(mirror.world.decor.filter((d) => d.sprite === 'spr_pk_police_van').length, 3);
  }
  const seen = b.mirror?.world.heroes[0];
  assert.ok(seen && Math.abs(seen.x - world.heroes[0].x) < 2 && Math.abs(seen.y - world.heroes[0].y) < 2);
  // la zone de forage aussi
  const other = setup(1);
  other.clients[0].say({ t: 'create' });
  other.clients[0].say({ t: 'pick', hero: 'EngiBot' });
  other.clients[0].say({ t: 'start', at: 'boss' });
  assert.equal(other.server.currentWorld?.level.name, 'rm_world2_2');
  // sans choix, le début du niveau
  const plain = setup(1);
  plain.clients[0].say({ t: 'create' });
  plain.clients[0].say({ t: 'pick', hero: 'EngiBot' });
  plain.clients[0].say({ t: 'start' });
  assert.equal(plain.server.currentWorld?.level.name, 'rm_world2');
  assert.ok((plain.server.currentWorld?.heroes[0].arrivalSteps ?? 0) > 0, 'avec le largage');
});
