// Modèle de l'éditeur de niveaux (ADR-018) : sur les vraies salles, ne rien toucher ne change rien, et chaque
// modification s'annule exactement.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { EDITABLE, EditorModel, LIGHT_OBJECT, buildCatalog, categoryOf, lightProps, patrolPoints, withPatrol } from './model.ts';
import { TV_STUDIO, landmarksFrom, marksOf, mergedLandmarks } from '../../sim/landmarks.ts';
import { World } from '../../sim/world.ts';
import type { SpriteManifest } from '../../sim/types.ts';
import { levelProblem, serializeLevel } from '../../sim/levelFile.ts';
import type { LevelData, LevelInstance } from '../../sim/types.ts';

const ROOMS = ['rm_world2', 'rm_world2_1', 'rm_world2_2'];
const text = (room: string): string => readFileSync(new URL(`../../../public/levels/${room}.json`, import.meta.url), 'utf8');
const load = (room: string): LevelData => JSON.parse(text(room)) as LevelData;
const open = (room = 'rm_world2'): EditorModel => {
  const level = load(room);
  return new EditorModel(level, buildCatalog([level, ...ROOMS.filter((r) => r !== room).map(load)]));
};

test('une salle ouverte puis réécrite sans retouche redonne son fichier, à l\'octet près', () => {
  for (const room of ROOMS) {
    const model = open(room);
    assert.equal(levelProblem(model.toLevel()), null, room);
    assert.equal(serializeLevel(model.toLevel()), text(room), room);
    assert.equal(model.dirty, false);
  }
});

test('les familles suivent le chargement du jeu : décor, lumières et décalques se retouchent, le reste est montré', () => {
  const level = load('rm_world2');
  const of = (object: string): string => categoryOf(level.objects, object);
  assert.equal(of('obj_table0'), 'decor');
  assert.equal(of('obj_siege_accueil'), 'decor');
  assert.equal(of('obj_fauteuilRond1'), 'decor');
  assert.equal(of(LIGHT_OBJECT), 'light');
  assert.equal(of('obj_automaticDoor'), 'door');
  assert.equal(of('obj_door_cardPurple'), 'door');
  assert.equal(of('obj_fenetre'), 'window');
  assert.equal(of('obj_npc_human_pistol'), 'npc');
  assert.equal(of('obj_warFog'), 'fog');
  assert.equal(of('obj_spawnHeros'), 'marker');
  assert.equal(of('obj_button'), 'door', 'le bouton se règle avec sa porte');
  assert.ok(['decor', 'light', 'decal', 'floor', 'door', 'window', 'npc', 'fog', 'marker'].every((c) => EDITABLE.has(c as never)));
  assert.ok(!EDITABLE.has('wall'), 'les blocs de mur posés en instances restent en lecture seule');
  const model = open();
  assert.equal(model.ents.filter((e) => e.category === 'light').length, 37);
  assert.equal(model.ents.filter((e) => e.kind === 'decal').length, level.decals.length);
});

test('poser, déplacer et retirer : chaque étape s\'annule et se rétablit, les éléments reprennent leur place', () => {
  const model = open();
  const before = serializeLevel(model.toLevel());
  let notified = 0;
  model.onChange = () => notified++;

  const table = model.makeInstance('obj_table0', 5000, 5000, 90)!;
  model.apply([{ ent: table, before: null, after: table.data }]);
  const added = model.toLevel();
  assert.equal(added.instances.length, model.base.instances.length + 1);
  const placed = added.instances[added.instances.length - 1];
  assert.deepEqual([placed.object, placed.x, placed.y, placed.angle, placed.layer], ['obj_table0', 5000, 5000, 90, 'layer_deco']);
  assert.ok(!model.base.instances.some((i) => i.id === placed.id), 'identifiant neuf');
  assert.equal(levelProblem(added), null);

  // un meuble du milieu de la liste est retiré, un autre déplacé, dans la même étape
  const gone = model.ents[40];
  const moved = model.ents.find((e) => e.category === 'decor' && e !== gone)!;
  const index = model.ents.indexOf(gone);
  model.apply([{ ent: gone, before: gone.data, after: null }, { ent: moved, before: moved.data, after: { ...moved.data, x: moved.data.x + 32 } }]);
  assert.ok(!model.ents.includes(gone));
  assert.equal(model.dirty, true);

  assert.ok(model.undo());
  assert.equal(model.ents.indexOf(gone), index, 'l\'élément retiré revient à son rang');
  assert.ok(model.undo());
  assert.equal(serializeLevel(model.toLevel()), before);
  assert.equal(model.dirty, false);
  assert.equal(model.undo(), false);

  assert.ok(model.redo());
  assert.ok(model.redo());
  assert.ok(!model.ents.includes(gone));
  assert.equal(model.toLevel().instances.length, model.base.instances.length);
  assert.equal(model.redo(), false);
  assert.equal(notified, 6);
});

test('un réglage que l\'on fait glisser ne compte que pour une étape ; la sauvegarde remet le compteur à zéro', () => {
  const model = open();
  const lamp = model.ents.find((e) => e.category === 'light')!;
  const start = lamp.data as LevelInstance;
  for (const radius of [300, 320, 340]) {
    const d = lamp.data as LevelInstance;
    model.apply([{ ent: lamp, before: d, after: { ...d, props: { ...d.props, radius } } }], `${lamp.uid}:radius`);
  }
  assert.equal((lamp.data as LevelInstance).props.radius, 340);
  model.markSaved();
  assert.equal(model.dirty, false);
  // après la sauvegarde, le même réglage ouvre une nouvelle étape : l'annuler ramène à l'état sauvegardé
  const d = lamp.data as LevelInstance;
  model.apply([{ ent: lamp, before: d, after: { ...d, props: { ...d.props, radius: 400 } } }], `${lamp.uid}:radius`);
  assert.equal(model.dirty, true);
  assert.ok(model.undo());
  assert.equal(model.dirty, false);
  assert.equal((lamp.data as LevelInstance).props.radius, 340);
  assert.ok(model.undo());
  assert.deepEqual(lamp.data, start);
  assert.equal(model.dirty, true, 'on est revenu en deçà de la sauvegarde');
});

test('une lampe neuve a les réglages que le jeu lit ; un objet venu d\'une autre salle apporte son type', () => {
  const model = open('rm_world2_2');
  const lamp = model.makeInstance(LIGHT_OBJECT, 100, 200, 0, lightProps(true))!;
  model.apply([{ ent: lamp, before: null, after: lamp.data }]);
  const table = model.makeInstance('obj_table0', 300, 300, 0)!;
  model.apply([{ ent: table, before: null, after: table.data }]);
  const level = model.toLevel();
  const inst = level.instances.find((i) => i.object === LIGHT_OBJECT)!;
  assert.deepEqual(inst.props, { radius: 800, hue: 32, sat: 60, lightIntensity: 0.6, coneAngle: 0, coneHalf: 25 });
  assert.equal(inst.scaleX, 800 / 150);
  assert.ok(level.objects[LIGHT_OBJECT] && level.objects.obj_table0, 'les types manquants sont ajoutés à la salle');
  assert.equal(levelProblem(level), null);
  const copy = model.duplicate(table, 32, 32);
  assert.notEqual((copy.data as LevelInstance).id, (table.data as LevelInstance).id);
  assert.equal(copy.data.x, 332);
});

test('passer devant ou derrière change l\'ordre de la salle, qui est l\'ordre de dessin, et s\'annule', () => {
  const model = open();
  const before = serializeLevel(model.toLevel());
  const ids = (): string[] => model.toLevel().instances.map((i) => i.id);
  const tables = model.ents.filter((e) => e.kind === 'instance' && (e.data as LevelInstance).object === 'obj_table0');
  const [a, b] = tables;
  const idA = (a.data as LevelInstance).id;
  const idB = (b.data as LevelInstance).id;

  assert.ok(model.reorder([a], 'front'));
  assert.equal(ids().at(-1), idA, 'devant : dernier de la liste, donc dessiné par-dessus');
  assert.equal(model.reorder([a], 'front'), false, 'déjà devant : rien à faire, rien dans l\'historique');
  assert.ok(model.reorder([a, b], 'back'));
  // a venait de passer devant b : derrière, ils gardent cet ordre entre eux
  assert.deepEqual(ids().slice(0, 2), [idB, idA], 'derrière : en tête, dans leur ordre relatif');
  assert.equal(model.toLevel().instances.length, model.base.instances.length);
  assert.equal(levelProblem(model.toLevel()), null);
  assert.equal(model.dirty, true);

  // un élément posé après coup, puis tout est annulé dans l'ordre
  const chair = model.makeInstance('obj_chaise_bleu', 100, 100, 0)!;
  model.apply([{ ent: chair, before: null, after: chair.data }]);
  assert.ok(model.undo() && model.undo());
  assert.equal(ids().at(-1), idA);
  assert.ok(model.undo());
  assert.equal(serializeLevel(model.toLevel()), before);
  assert.equal(model.dirty, false);
  assert.ok(model.redo() && model.redo() && model.redo());
  assert.deepEqual(ids().slice(0, 2), [idB, idA]);
  assert.equal(ids().at(-1), (chair.data as LevelInstance).id);
});

test('patrouille et brouillard : ce que l\'éditeur écrit est ce que le jeu lit', () => {
  const sprites = JSON.parse(readFileSync(new URL('../../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;
  const model = open();
  const guard = model.ents.find((e) => e.kind === 'instance' && (e.data as LevelInstance).object === 'obj_npc_human_pistol')!;
  const inst = guard.data as LevelInstance;
  assert.deepEqual(patrolPoints(inst), []);
  const route = [{ x: inst.x + 200, y: inst.y }, { x: inst.x + 200.4, y: inst.y + 160 }];
  const patrolling = withPatrol(inst, route);
  assert.deepEqual(patrolling.props.patrolPoints, [`${inst.x + 200};${inst.y}`, `${inst.x + 200};${inst.y + 160}`], 'format d\'origine, en pixels entiers');
  assert.equal(withPatrol(patrolling, []).props.patrolPoints, undefined);
  model.apply([{ ent: guard, before: inst, after: { ...patrolling, props: { ...patrolling.props, patrolType: 'points' } } }]);

  const fog = model.makeFog(640, 640, 320, 192)!;
  model.apply([{ ent: fog, before: null, after: fog.data }]);
  const fogInst = fog.data as LevelInstance;
  const taken = model.base.instances.map((i) => Number(i.props.warFogNumber)).filter(Number.isFinite);
  assert.ok(!taken.includes(Number(fogInst.props.warFogNumber)), 'numéro de zone libre');
  assert.deepEqual([fogInst.scaleX, fogInst.scaleY, fogInst.props.attachedWarFogNumber], [5, 3, null]);

  const level = model.toLevel();
  assert.equal(levelProblem(level), null);
  const world = new World(level, sprites, 'PetBot', 1);
  const npc = world.npcs.find((n) => n.x === inst.x && n.y === inst.y)!;
  assert.equal(npc.patrolType, 'points');
  // le jeu ajoute la place du personnage en tête du trajet
  assert.deepEqual(npc.patrolPoints, [{ x: inst.x, y: inst.y }, { x: inst.x + 200, y: inst.y }, { x: inst.x + 200, y: inst.y + 160 }]);
  const zone = world.fogs.find((f) => f.x === 640 && f.y === 640)!;
  assert.deepEqual([zone.w, zone.h, zone.number, zone.attached], [320, 192, fogInst.props.warFogNumber, null]);
});

test('repères du scénario : déplacés dans l\'éditeur, écrits dans la salle, relus par le jeu (ADR-020)', () => {
  const sprites = JSON.parse(readFileSync(new URL('../../../public/assets/sprites.json', import.meta.url), 'utf8')) as SpriteManifest;
  const defaults = mergedLandmarks(undefined);
  const marks = marksOf(defaults);
  assert.deepEqual(landmarksFrom(marks), defaults, 'mis à plat puis remis en place, rien ne bouge');
  assert.ok(marks.some((m) => m.path === 'wave.line.9') && marks.some((m) => m.path === 'room' && m.w === 2688) && marks.some((m) => m.path === 'exit.zone' && m.radius === 300));
  assert.equal(marksOf(mergedLandmarks({ mark: { x: 1, y: 2, extra: 3 }, nope: 4 })).find((m) => m.path === 'mark')!.x, 1, 'seuls les repères connus sont repris');

  // seule la salle qui porte le scénario a des repères ; sans retouche, rien n'est écrit dans son fichier
  assert.equal(open('rm_world2_1').ents.filter((e) => e.kind === 'mark').length, 0);
  const model = open();
  assert.equal(model.ents.filter((e) => e.kind === 'mark').length, marks.length);
  assert.equal(model.toLevel().landmarks, undefined);

  const mark = model.ents.find((e) => e.kind === 'mark' && e.data.x === defaults.mark.x && e.data.y === defaults.mark.y && (e.data as { path: string }).path === 'mark')!;
  model.apply([{ ent: mark, before: mark.data, after: { ...mark.data, x: defaults.mark.x + 64 } }]);
  const zone = model.ents.find((e) => e.kind === 'mark' && (e.data as { path: string }).path === 'wave.outside')!;
  model.apply([{ ent: zone, before: zone.data, after: { ...zone.data, x: 10000, w: 500 } }]);
  const level = JSON.parse(serializeLevel(model.toLevel())) as LevelData;
  assert.equal(levelProblem(level), null);
  const saved = level.landmarks as unknown as typeof TV_STUDIO;
  assert.equal(saved.mark.x, defaults.mark.x + 64);
  assert.deepEqual([saved.wave.outside.x0, saved.wave.outside.x1, saved.wave.outside.y0], [10000, 10500, defaults.wave.outside.y0]);
  assert.deepEqual(saved.wave.line, defaults.wave.line, 'les autres repères gardent leur place');

  // le jeu prend les repères de la salle qu'il ouvre, et revient aux valeurs par défaut pour une salle sans repères
  const marked = new World(level, sprites, 'PetBot', 1);
  assert.equal(TV_STUDIO.mark.x, defaults.mark.x + 64);
  assert.equal(TV_STUDIO.wave.outside.x1, 10500);
  assert.ok(marked.npcs.length > 0);
  new World(load('rm_world2'), sprites, 'PetBot', 1);
  assert.deepEqual(JSON.parse(JSON.stringify(TV_STUDIO)), defaults);

  // une salle rouverte garde ses repères, même revenus à leur place par défaut : la clé reste dans le fichier
  const reopened = new EditorModel(level, buildCatalog([level]));
  assert.ok(reopened.toLevel().landmarks);
  assert.equal(serializeLevel(reopened.toLevel()), serializeLevel(level));
});
