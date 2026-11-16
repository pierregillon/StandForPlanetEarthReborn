// Test de bout en bout du multijoueur, sans navigateur ni WebSocket (ADR-014) : un salon, deux clients
// simulés, chacun avec son monde miroir. On vérifie le salon, puis que les miroirs suivent le serveur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Lobby } from '../../server/game.ts';
import type { Peer } from '../../server/game.ts';
import { NO_INPUT } from '../sim/types.ts';
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
  // arrivée par le véhicule puis déploiement
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

  // un tir : la balle apparaît chez l'autre joueur et continue d'avancer entre deux instantanés
  for (let i = 0; i < 30; i++) step({ ...idle, aimX: 9000, fire1: true }, idle);
  assert.ok(world.heroes[0].ammo < world.heroes[0].def.magazine);
  assert.ok(b.mirror.world.bullets.length > 0 || world.bullets.length === 0, 'les balles sont visibles chez l\'autre joueur');
  assert.equal(a.mirror.world.heroes[0].ammo, world.heroes[0].ammo);

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
