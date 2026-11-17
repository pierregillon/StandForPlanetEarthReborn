// Tests de l'introduction du niveau (GD-077 à GD-080) : le journal, la radio, le largage, répliques que
// l'hôte fait défiler, touche tenue qui passe la séquence.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONFIG } from './config.ts';
import { ANCHOR, arrivalPhases, arrivalTotal, crewReleased, dropExchange, introLines, introShot, typingSteps } from './intro.ts';
import { TV_STUDIO } from './additions.ts';
import { retrySession, startTeam } from './match.ts';
import { GROUND_FLOOR, UPPER_FLOOR, createSession } from './session.ts';
import { World } from './world.ts';
import { NO_INPUT } from './types.ts';
import type { Input, LevelData, SpriteManifest } from './types.ts';

const ground = JSON.parse(readFileSync(new URL(`../../public/levels/${GROUND_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
const sprites = JSON.parse(readFileSync(new URL('../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;

const PRESS: Input = { ...NO_INPUT, dashPressed: true, dash: true };

/** Monde où l'arrivée vient de commencer. */
function arriving(names: string[], full = true): World {
  const w = new World(ground, sprites, names, 3);
  w.npcs = [];
  w.deployHero(true, full);
  w.drainEvents();
  return w;
}

/** Horloge de l'arrivée. */
const clock = (w: World): number => w.heroes[0].arrivalTotal - w.heroes[0].arrivalSteps;

/** Laisse tourner le jeu, sans appui, jusqu'à ce que l'horloge de l'arrivée atteigne `target`. */
function runTo(w: World, target: number): void {
  for (let i = 0; i < 3000 && clock(w) < target; i++) w.step(w.heroes.map(() => NO_INPUT));
  assert.equal(clock(w), target);
}

test('arrivée : le journal et le vol stationnaire ne s\'ajoutent qu\'à l\'introduction complète', () => {
  const a = CONFIG.arrival;
  assert.equal(arrivalTotal(true) - arrivalTotal(false), a.hoverSteps + a.news.inSteps + a.news.cutSteps + a.news.exitSteps);
  const full = arrivalPhases(arrivalTotal(true));
  assert.ok(full.full);
  assert.equal(full.hover - full.flyIn, a.hoverSteps);
  const order = [0, full.news, full.cut, full.exit, full.flyIn, full.hover, full.descend, full.hold, full.ascend, full.total];
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], `phase ${i}`);
  // ce que montre la caméra : le plateau, le hall, la sortie du bâtiment, puis le véhicule
  assert.equal(introShot(full, 0).kind, 'studio');
  assert.equal(introShot(full, full.news).kind, 'studio', 'pendant la première phrase du présentateur');
  assert.equal(introShot(full, full.cut).kind, 'hall', 'pendant la deuxième');
  assert.equal(introShot(full, full.cut + 1).kind, 'exit');
  assert.equal(introShot(full, full.exit).kind, 'vehicle');
  const short = arrivalPhases(arrivalTotal(false));
  assert.ok(!short.full);
  assert.deepEqual([short.news, short.cut, short.exit], [0, 0, 0], 'pas de journal');
  assert.equal(short.hover, short.flyIn, 'pas de vol stationnaire');
  assert.equal(introShot(short, 0).kind, 'vehicle');
});

test('le plateau de TvTv² est une pièce fermée, avec son sol, ses deux portes et son décor (GD-081)', () => {
  const w = new World(ground, sprites, 'PetBot', 2);
  const r = TV_STUDIO.room;
  const blocked = (x1: number, y1: number, x2: number, y2: number): boolean => w.collision.segmentBlocked(x1, y1, x2, y2, 1);
  // les murs nord et sud vont de la vitre de la régie à l'ancienne alcôve ; la cloison du décor coupe la pièce
  assert.ok(blocked(9000, r.y0 - 120, 9000, r.y0 + 120), 'mur nord');
  assert.ok(blocked(9000, r.y1 - 120, 9000, r.y1 + 120), 'mur sud');
  assert.ok(blocked(r.x0 + 40, r.y0 - 120, r.x0 + 40, r.y0 + 120), 'le mur nord rejoint la vitre');
  assert.ok(blocked(9560, 3856, 9740, 3856), 'cloison du fond de décor');
  assert.ok(!blocked(9580, r.y0 + 300, 9860, r.y0 + 300), 'passage nord vers les coulisses');
  assert.ok(!blocked(9580, r.y1 - 300, 9860, r.y1 - 300), 'passage sud vers les coulisses');
  // la pièce a la hauteur de la régie : ses murs nord et sud prolongent ceux de la régie (GD-083)
  assert.ok(blocked(7700, r.y0 - 120, 7700, r.y0 + 120) && blocked(7700, r.y1 - 120, 7700, r.y1 + 120), 'murs de la régie au même niveau');
  // derrière le pupitre, un robot a la place de se tenir là où est le présentateur
  const behind = new World(ground, sprites, 'BadaBot', 2);
  behind.npcs = [];
  assert.ok(behind.collision.circleFree(TV_STUDIO.anchor.x, TV_STUDIO.anchor.y, behind.hero.def.radius + 12, 1), 'la place du présentateur est libre pour un robot');
  assert.ok(!blocked(TV_STUDIO.anchor.x, TV_STUDIO.anchor.y, TV_STUDIO.anchor.x - 20, r.y0 + 300), 'on y accède en contournant le pupitre par le nord');
  assert.ok(!blocked(TV_STUDIO.anchor.x, TV_STUDIO.anchor.y, TV_STUDIO.anchor.x - 20, r.y1 - 300), 'ou par le sud');
  // deux portes automatiques : fermées elles arrêtent, et un robot qui approche les ouvre
  const doors = w.doors.filter((d) => d.kind === 'auto' && Math.abs(d.x - 8480) < 2 && (Math.abs(d.y - (r.y0 - 16)) < 2 || Math.abs(d.y - (r.y1 + 16)) < 2));
  assert.equal(doors.length, 2);
  assert.ok(blocked(8480, r.y0 - 120, 8480, r.y0 + 120), 'porte nord fermée');
  w.npcs = [];
  w.hero.x = 8480;
  w.hero.y = r.y0 - 150;
  for (let i = 0; i < 150; i++) w.step({ ...NO_INPUT, moveY: 1, aimX: 8480, aimY: 9000 });
  assert.ok(w.hero.y > r.y0 + 100, `le robot est entré sur le plateau (y = ${Math.round(w.hero.y)})`);
  // le sol de studio couvre la pièce ; la grille de ventilation et les conteneurs de l'alcôve ont disparu
  assert.ok(w.level.floors.some((f) => f.tileset === 'til_sol_studio' && f.x === r.x0 && f.w === r.x1 - r.x0));
  assert.ok(!w.level.decals.some((d) => d.sprite === 'spr_ventilation'));
  assert.ok(w.level.decals.some((d) => d.sprite === 'spr_tv_riser'));
  assert.ok(!w.level.instances.some((i) => i.object === 'obj_container' && i.x >= r.x0 && i.x < r.x1 && i.y >= r.y0 && i.y < r.y1));
  // au départ, aucun garde sur le plateau : seulement le présentateur et des techniciens
  const fresh = new World(ground, sprites, 'PetBot', 2);
  const inside = fresh.npcs.filter((n) => n.x >= r.x0 && n.x < r.x1 && n.y >= r.y0 && n.y < r.y1);
  assert.ok(inside.length >= 3 && inside.every((n) => n.def.kind === 'civil'), `sur le plateau : ${inside.map((n) => n.def.kind).join(', ')}`);
  for (const n of fresh.npcs.filter((o) => o.x > 8256)) assert.ok(fresh.collision.circleFree(n.x, n.y, n.def.radius * 0.5, 1), `personnage dans un obstacle en ${Math.round(n.x)}, ${Math.round(n.y)}`);
  // quatre projecteurs, chacun avec son faisceau braqué sur le présentateur
  const beams = w.level.instances.filter((i) => i.object === 'obj_lumiere' && i.props.coneAngle !== undefined);
  assert.equal(beams.length, 4);
  for (const beam of beams) {
    const toAnchor = Math.atan2(TV_STUDIO.anchor.y - beam.y, TV_STUDIO.anchor.x - beam.x);
    const axis = (-Number(beam.props.coneAngle) * Math.PI) / 180;
    const off = Math.abs(Math.atan2(Math.sin(toAnchor - axis), Math.cos(toAnchor - axis)));
    assert.ok(off < 0.1, `le faisceau en ${beam.x}, ${beam.y} vise le présentateur`);
    assert.ok(Math.hypot(TV_STUDIO.anchor.x - beam.x, TV_STUDIO.anchor.y - beam.y) < Number(beam.props.radius), 'et l\'atteint');
  }
  for (const sprite of ['spr_tv_desk', 'spr_tv_ledwall', 'spr_tv_spot', 'spr_tv_onair', 'spr_camera']) {
    assert.ok(w.decor.some((d) => d.sprite === sprite), sprite);
    assert.ok(sprites[sprite], `${sprite} est dans le manifeste des sprites`);
  }
});

test('l\'aile est : salons, maquillage, vestiaire et parkings se suivent du nord au sud (GD-083)', () => {
  const w = new World(ground, sprites, 'PetBot', 2);
  w.npcs = [];
  const open = (x1: number, y1: number, x2: number, y2: number): boolean => !w.collision.segmentBlocked(x1, y1, x2, y2, 1);
  const { north, south } = TV_STUDIO.lounges;
  // chaque salon communique avec son décrochement, et une porte automatique mène au parking
  assert.ok(open(8600, 2350, 9100, 2350), 'salon d\'attente et maquillage ne font qu\'une pièce');
  assert.ok(open(8600, 5150, 9100, 5150), 'salon de sortie et vestiaire aussi');
  for (const [name, y] of [['nord', 2848], ['sud', 5088]] as [string, number][]) {
    const door = w.doors.find((d) => d.kind === 'auto' && Math.abs(d.x - 9584) < 2 && Math.abs(d.y - y) < 2);
    assert.ok(door, `porte du salon ${name} vers son parking`);
    assert.ok(!open(9400, y, 9760, y), 'fermée, elle arrête');
    assert.ok(!open(9400, y - 300, 9760, y - 300) || name === 'sud', 'la cloison est pleine ailleurs');
  }
  // les parkings sont refaits : bitume, marquages, plus de fourgons géants ni de route hors d'échelle
  for (const p of [TV_STUDIO.parkings.north, TV_STUDIO.parkings.south]) {
    assert.ok(w.level.floors.some((f) => f.tileset === 'til_sol_asphalte' && f.x <= p.x0 && f.x + f.w >= p.x1), 'bitume');
  }
  assert.ok(!w.level.instances.some((i) => i.object === 'obj_car_van'));
  assert.ok(!w.level.decals.some((d) => /^spr_route/.test(d.sprite)));
  assert.ok(w.level.decals.filter((d) => d.sprite === 'spr_pk_line').length >= 20);
  assert.equal(w.level.decals.filter((d) => d.sprite === 'spr_pk_zebra').length, 2);
  // le mobilier propre à chaque zone
  const has = (object: string, zone: { x0: number; x1: number; y0: number; y1: number }): number =>
    w.level.instances.filter((i) => i.object === object && i.x >= zone.x0 && i.x < zone.x1 && i.y >= zone.y0 && i.y < zone.y1).length;
  assert.equal(has('obj_tv_makeup', north), 3, 'trois coiffeuses au nord');
  assert.ok(has('obj_canape', north) >= 2 && has('obj_canape', south) >= 2, 'des canapés dans les deux salons');
  assert.ok(has('obj_tv_rack', south) >= 2 && has('obj_casierModulable', south) >= 3, 'portants et casiers du vestiaire');
  // aucun garde dans les salons au départ, sauf un policier devant chaque porte du plateau
  const fresh = new World(ground, sprites, 'PetBot', 2);
  // (un salon est en L : sa grande pièce à l'ouest de x = 8960, et son décrochement contre le plateau ; le
  // reste du rectangle appartient au parking)
  for (const zone of [north, south]) {
    const notch = (y: number): boolean => (zone === north ? y >= 1952 : y < 5632);
    const guards = fresh.npcs.filter((n) => n.def.kind === 'soldier' && n.x >= zone.x0 && n.x < zone.x1 && n.y >= zone.y0 && n.y < zone.y1
      && (n.x < 8960 || notch(n.y)));
    assert.equal(guards.length, 1, `gardes du salon : ${guards.map((n) => `${Math.round(n.x)},${Math.round(n.y)}`).join(' ')}`);
    assert.ok(Math.abs(guards[0].x - 8480) < 2, 'devant la porte du plateau');
  }
  // les portails d'origine sont toujours là : la sortie par le nord (3) et l'arrivée de la police par le sud (4)
  assert.equal(fresh.doors.filter((d) => d.kind === 'button' && (d.doorId === 3 || d.doorId === 4)).length, 4);
  // le brouillard se lève zone par zone : entrer dans la régie ne découvre plus les salons ni les parkings
  const fogs = fresh.fogs.filter((f) => f.x + f.w > 8240 && f.x < 10976);
  assert.ok(fogs.length >= 8);
  fresh.hero.x = 7400;
  fresh.hero.y = 3968;
  for (let i = 0; i < 30; i++) fresh.step(NO_INPUT);
  assert.ok(fresh.fogs.some((f) => f.x === 8240 && f.y === 1392 && !f.enabled), 'le salon d\'attente reste caché');
  assert.ok(fresh.fogs.some((f) => f.x === 8976 && f.y === 1392 && !f.enabled), 'le dépose-minute aussi');
});

test('pendant le journal, personne ne bouge : ni les gardes en ronde, ni les civils (GD-081)', () => {
  const w = new World(ground, sprites, 'PetBot', 7);
  w.deployHero(true);
  const p = arrivalPhases(w.hero.arrivalTotal);
  const before = w.npcs.map((n) => [n.x, n.y]);
  // le plateau, puis le hall : l'horloge est arrêtée sur la première phrase, puis sur la deuxième
  for (let i = 0; i < 300; i++) w.step(NO_INPUT);
  assert.ok(w.newsOnAir());
  assert.deepEqual(w.npcs.map((n) => [n.x, n.y]), before, 'aucun personnage n\'a bougé');
  // la caméra a retrouvé le véhicule : les rondes reprennent
  while (clock(w) < p.exit) w.step(PRESS);
  assert.ok(!w.newsOnAir());
  for (let i = 0; i < 300; i++) w.step(NO_INPUT);
  assert.ok(w.npcs.some((n, i) => n.x !== before[i][0] || n.y !== before[i][1]), 'les rondes ont repris');
});

test('le présentateur est à son poste derrière le pupitre, face à trois caméras (GD-080)', () => {
  const w = new World(ground, sprites, 'PetBot', 2);
  const anchor = w.npcs.find((n) => n.x === TV_STUDIO.anchor.x && n.y === TV_STUDIO.anchor.y);
  assert.ok(anchor, 'le présentateur');
  assert.equal(anchor.def.kind, 'civil');
  assert.equal(anchor.patrolType, 'none', 'il ne quitte pas son pupitre');
  assert.ok(w.collision.circleFree(anchor.x, anchor.y, anchor.def.radius, 1), 'il n\'est pas dans un obstacle');
  assert.equal(w.decor.filter((d) => d.sprite === 'spr_camera').length, 3);
  assert.ok(w.decor.some((d) => d.sprite === 'spr_tv_desk' && d.x === TV_STUDIO.desk.x));
  // il reste à sa place tant que rien ne l'effraie
  for (let i = 0; i < 600; i++) w.step(NO_INPUT);
  assert.ok(Math.hypot(anchor.x - TV_STUDIO.anchor.x, anchor.y - TV_STUDIO.anchor.y) < 1);
});

test('répliques : le journal, puis la radio en vol, puis l\'échange du largage au sol', () => {
  const total = arrivalTotal(true);
  const p = arrivalPhases(total);
  const lines = introLines(['BadaBot', 'PetBot'], total);
  assert.deepEqual(lines.map((l) => l.speaker), [ANCHOR, ANCHOR, 'BadaBot', 'EngiBot', 'PetBot', 'BatBot', 'BadaBot', 'EngiBot', 'BadaBot']);
  assert.deepEqual(lines.map((l) => l.at), [p.news, p.cut, p.hover, p.hover, p.hover, p.hover, p.hover, p.descend, p.descend]);
  assert.match(lines[0].text, /out of control/);
  assert.match(lines[1].text, /th—$/, 'la deuxième phrase du présentateur est coupée');
  assert.deepEqual(lines.map((l) => l.rumble === true).indexOf(true), 1, 'ce sont les rotors qui la coupent');
  assert.match(lines[4].text, /control room/);
  assert.equal(lines.findIndex((l) => l.release), 8, 'les pinces s\'ouvrent à la réponse');
  // les robots joués quittent leur pince quand la réponse commence, pas avant
  assert.equal(crewReleased(lines, p, p.descend - 1, 7), false);
  assert.equal(crewReleased(lines, p, p.descend, 7), false, 'pendant que celui qui reste parle');
  assert.equal(crewReleased(lines, p, p.descend, 8), true);
  assert.equal(crewReleased(lines, p, p.descend + 1, 9), true);
  // quand le niveau recommence, il ne reste que l'échange du largage
  const again = introLines(['BadaBot', 'PetBot'], arrivalTotal(false));
  assert.deepEqual(again.map((l) => l.speaker), ['EngiBot', 'BadaBot']);
});

test('largage : les quinze équipes possibles ont leur échange', () => {
  const expected: Record<string, [string, string, string]> = {
    'BadaBot': ['EngiBot', 'BadaBot', 'One is enough.'],
    'BatBot': ['EngiBot', 'BatBot', 'Alone? Perfect. More for me.'],
    'PetBot': ['EngiBot', 'PetBot', 'Alone, then. I will be careful.'],
    'EngiBot': ['PetBot', 'EngiBot', 'One unit. Sufficient.'],
    'BadaBot,BatBot': ['EngiBot', 'BadaBot', 'BatBot and I. That will do.'],
    'BadaBot,PetBot': ['EngiBot', 'BadaBot', 'PetBot and I. That will do.'],
    'BadaBot,EngiBot': ['PetBot', 'BadaBot', 'EngiBot and I. That will do.'],
    'BatBot,PetBot': ['EngiBot', 'BatBot', 'Me and PetBot? Poor them.'],
    'BatBot,EngiBot': ['PetBot', 'BatBot', 'Me and EngiBot? Poor them.'],
    'PetBot,EngiBot': ['BatBot', 'PetBot', 'EngiBot and I will manage.'],
    'BadaBot,BatBot,PetBot': ['EngiBot', 'BadaBot', 'Three of us. More than enough.'],
    'BadaBot,BatBot,EngiBot': ['PetBot', 'BadaBot', 'Three of us. More than enough.'],
    'BadaBot,PetBot,EngiBot': ['BatBot', 'BadaBot', 'Three of us. More than enough.'],
    'BatBot,PetBot,EngiBot': ['BadaBot', 'BatBot', 'Three of us? This will be quick.'],
  };
  for (const [team, [giver, taker, answer]] of Object.entries(expected)) {
    const players = team.split(',');
    // l'ordre des joueurs ne change rien
    for (const order of [players, [...players].reverse()]) {
      const [stay, go] = dropExchange(order);
      assert.equal(stay[0], giver, `${team} : qui passe la main`);
      assert.ok(!players.includes(stay[0]), `${team} : celui qui passe la main reste à bord`);
      assert.deepEqual(go, [taker, answer], team);
    }
  }
  assert.deepEqual(dropExchange(['PetBot', 'BatBot', 'EngiBot', 'BadaBot']).map((l) => l[0]), ['BadaBot', 'BatBot'], 'les quatre descendent');
  assert.equal(Object.keys(expected).length, 14);
});

test('une réplique attend l\'appui de l\'hôte : un appui finit de l\'écrire, le suivant passe à la suite (GD-079)', () => {
  const w = arriving(['PetBot']);
  const p = arrivalPhases(w.hero.arrivalTotal);
  const lines = introLines(['PetBot'], w.hero.arrivalTotal);
  // l'image s'ouvre sur le plateau : l'horloge tourne
  runTo(w, p.news);
  // la première phrase s'écrit ; l'horloge ne bouge plus tant que personne n'appuie
  for (let i = 0; i < 200; i++) w.step(NO_INPUT);
  assert.equal(clock(w), p.news, 'l\'horloge est arrêtée');
  assert.equal(w.introLine, 0);
  assert.ok(w.introLineSteps >= typingSteps(lines[0].text), 'la réplique est écrite en entier');
  w.step(PRESS);
  assert.equal(w.introLine, 1, 'un appui passe à la réplique suivante');
  assert.equal(w.introLineSteps, 0);
  // coupe vers le hall : l'horloge tourne un instant, puis s'arrête pour la phrase suivante
  runTo(w, p.cut);
  // appui pendant l'écriture : la réplique s'écrit d'un coup, sans passer à la suivante
  w.step(NO_INPUT);
  w.step(NO_INPUT);
  w.step(PRESS);
  assert.equal(w.introLine, 1);
  assert.equal(w.introLineSteps, typingSteps(lines[1].text));
  // la deuxième phrase du présentateur : les rotors se font entendre dès qu'elle est écrite
  w.step(PRESS);
  assert.equal(w.introLine, 2);
  assert.ok(w.drainEvents().some((e) => e.type === 'vehicleArrives'), 'les rotors couvrent la fin du journal');
  // la caméra sort du bâtiment, le véhicule arrive et se stabilise : l'horloge s'arrête pour la radio
  runTo(w, p.hover);
  // deux appuis par réplique jusqu'à la fin de la radio : le véhicule descend alors
  while (w.introLine < 7) w.step(PRESS);
  w.step(NO_INPUT);
  assert.ok(clock(w) > p.hover, 'l\'horloge repart après la dernière réplique radio');
  runTo(w, p.descend);
  w.step(NO_INPUT);
  assert.equal(clock(w), p.descend, 'posé : l\'horloge s\'arrête pour l\'échange du largage');
  while (w.introLine < lines.length) w.step(PRESS);
  let left = false;
  for (let i = 0; i < 400 && w.hero.arrivalSteps > 0; i++) {
    w.step(NO_INPUT);
    left ||= w.drainEvents().some((e) => e.type === 'vehicleLeaves');
  }
  assert.ok(left, 'le véhicule redécolle');
  assert.equal(w.hero.arrivalSteps, 0);
});

test('sans appui, une réplique finit par laisser la place à la suivante', () => {
  const w = arriving(['PetBot']);
  const p = arrivalPhases(w.hero.arrivalTotal);
  const first = introLines(['PetBot'], w.hero.arrivalTotal)[0];
  runTo(w, p.news);
  const wait = typingSteps(first.text) + CONFIG.arrival.autoAdvanceSteps;
  for (let i = 0; i < wait - 1; i++) w.step(NO_INPUT);
  assert.equal(w.introLine, 0);
  w.step(NO_INPUT);
  assert.equal(w.introLine, 1);
});

test('seul l\'hôte mène la séquence : tenir la touche la passe en entier', () => {
  const w = arriving(['PetBot', 'BatBot']);
  const p = arrivalPhases(w.heroes[0].arrivalTotal);
  for (let i = 0; i < p.news + 5; i++) w.step([NO_INPUT, NO_INPUT]);
  // le deuxième joueur appuie, puis tient la touche : rien ne se passe
  for (let i = 0; i < CONFIG.arrival.skipHoldSteps + 10; i++) w.step([NO_INPUT, PRESS]);
  assert.equal(w.introLine, 0);
  assert.equal(w.introHold, 0);
  assert.ok(w.heroes[0].arrivalSteps > 0);
  // l'hôte tient la touche : la jauge monte, puis la séquence est passée
  w.hostSlot = 1;
  const hold: Input = { ...NO_INPUT, dash: true };
  for (let i = 0; i < CONFIG.arrival.skipHoldSteps - 1; i++) w.step([NO_INPUT, hold]);
  assert.equal(w.introHold, CONFIG.arrival.skipHoldSteps - 1);
  assert.ok(w.heroes[0].arrivalSteps > 1);
  w.step([NO_INPUT, hold]);
  assert.ok(w.heroes.every((h) => h.arrivalSteps === 0), 'le véhicule est parti');
  const events = w.drainEvents();
  assert.ok(events.some((e) => e.type === 'introSkipped'));
  assert.equal(events.filter((e) => e.type === 'deploy').length, 2, 'les deux robots se déploient');
  assert.ok(w.heroes.every((h) => h.deploySteps === h.deployTotal));
  // relâcher avant la fin remet la jauge à zéro
  const again = arriving(['PetBot']);
  for (let i = 0; i < 20; i++) again.step(hold);
  again.step(NO_INPUT);
  assert.equal(again.introHold, 0);
});

test('l\'introduction complète ne joue qu\'une fois par partie', () => {
  const session = createSession('EngiBot');
  const first = new World(ground, sprites, session.heroNames, 5, session);
  startTeam(session, first);
  assert.equal(first.hero.arrivalTotal, arrivalTotal(true));
  assert.ok(first.drainEvents().some((e) => e.type === 'introNews'), 'le journal prend l\'antenne');
  // Retry sans point de sauvegarde : le niveau recommence, mais seul le largage est rejoué
  const retried = retrySession(session);
  const second = new World(ground, sprites, retried.heroNames, 5, retried);
  startTeam(retried, second);
  assert.equal(second.hero.arrivalTotal, arrivalTotal(false));
  const again = second.drainEvents();
  assert.ok(again.some((e) => e.type === 'vehicleArrives') && !again.some((e) => e.type === 'introNews'), 'pas de journal la deuxième fois');
  // à l'étage, pas de véhicule
  const upstairs = createSession('EngiBot', UPPER_FLOOR);
  const level = JSON.parse(readFileSync(new URL(`../../public/levels/${UPPER_FLOOR}.json`, import.meta.url), 'utf8')) as LevelData;
  const third = new World(level, sprites, upstairs.heroNames, 5, upstairs);
  startTeam(upstairs, third);
  assert.equal(third.hero.arrivalTotal, 0);
  assert.equal(upstairs.introSeen, false);
});
