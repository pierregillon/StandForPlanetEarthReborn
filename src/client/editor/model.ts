// Modèle de l'éditeur de niveaux (ADR-018) : la salle en cours de retouche, ses éléments, l'historique des
// modifications. Sans Phaser ni navigateur : l'affichage est dans EditorScene, les panneaux dans EditorUi.
import { CONFIG } from '../../sim/config.ts';
import type { LevelData, LevelDecal, LevelFloor, LevelInstance, LevelObjectInfo, LevelWall } from '../../sim/types.ts';
import { landmarksFrom, marksOf, mergedLandmarks } from '../../sim/landmarks.ts';
import type { Mark } from '../../sim/landmarks.ts';
import { GROUND_FLOOR } from '../../sim/session.ts';
import { wallObjects, wallRectsOf } from './walls.ts';
import type { WallRect } from './walls.ts';

/**
 * Famille d'un élément. L'éditeur les montre toutes ; seules celles de `EDITABLE` se retouchent pour l'instant
 * (étape 1 : décor, lumières, décalques ; étape 2 : sols, portes, boutons et fenêtres, et les murs, qui ne sont
 * pas des éléments mais des cases ; étape 3 : personnages, brouillard, points d'apparition). Restent les blocs
 * de mur posés en instances, que les salles n'utilisent presque pas.
 */
export type Category = 'decor' | 'light' | 'decal' | 'floor' | 'door' | 'window' | 'npc' | 'fog' | 'wall' | 'marker' | 'script';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'decor', label: 'Furniture & props' },
  { id: 'light', label: 'Lights' },
  { id: 'decal', label: 'Floor decals' },
  { id: 'floor', label: 'Floors' },
  { id: 'door', label: 'Doors & buttons' },
  { id: 'window', label: 'Windows' },
  { id: 'npc', label: 'Characters' },
  { id: 'fog', label: 'Fog zones' },
  { id: 'wall', label: 'Wall blocks' },
  { id: 'marker', label: 'Spawns & triggers' },
  { id: 'script', label: 'Script landmarks' },
];

export const EDITABLE: ReadonlySet<Category> = new Set<Category>(['decor', 'light', 'decal', 'floor', 'door', 'window', 'npc', 'fog', 'marker', 'script']);

export const LIGHT_OBJECT = 'obj_lumiere';
/** Décor sans parent que le jeu dessine quand même (même liste que `DECOR_ONLY` de world.ts). */
const DECOR_ONLY = /^obj_(fauteuilRond\d|mur_dessousFenetre|robot_atelier\d|tapis_accueil)$/;

const isA = (objects: Record<string, LevelObjectInfo>, object: string, ancestor: string): boolean =>
  object === ancestor || (objects[object]?.parents.includes(ancestor) ?? false);

/** Famille d'un type d'objet, d'après les mêmes règles que le chargement d'une salle (`World.addInstance`). */
export function categoryOf(objects: Record<string, LevelObjectInfo>, object: string): Category {
  if (object === LIGHT_OBJECT) return 'light';
  // le bouton d'une porte se règle avec elle : même numéro (`doorId`)
  if (isA(objects, object, 'obj_door_parent') || object === 'obj_button') return 'door';
  if (object === 'obj_fenetre') return 'window';
  if (isA(objects, object, 'obj_localNpc')) return 'npc';
  if (object === 'obj_warFog') return 'fog';
  if (CONFIG.chair.objects.includes(object)) return 'decor';
  if (isA(objects, object, 'obj_mur_parent')) return 'wall';
  if (object === 'obj_foreuse') return 'marker';
  if (isA(objects, object, 'obj_decor_base') || DECOR_ONLY.test(object)) return 'decor';
  return 'marker';
}

export type EntData = LevelInstance | LevelDecal | LevelFloor | Mark;
/** Élément qui a un angle, une échelle et une teinte : tout sauf un sol. */
export type Placed = LevelInstance | LevelDecal;

/** Un élément de la salle : une instance, un décalque, un sol, ou un repère du scénario (ADR-020). `data` est remplacé à chaque modification, jamais modifié en place. */
export interface Ent {
  readonly uid: number;
  readonly kind: 'instance' | 'decal' | 'floor' | 'mark';
  readonly category: Category;
  data: EntData;
}

export const isInstance = (ent: Ent): ent is Ent & { data: LevelInstance } => ent.kind === 'instance';
export const isFloor = (ent: Ent): ent is Ent & { data: LevelFloor } => ent.kind === 'floor';
export const isMark = (ent: Ent): ent is Ent & { data: Mark } => ent.kind === 'mark';

/** Les murs d'une salle : les pièces dessinées et les rectangles de collision qui en découlent. */
export interface WallState {
  walls: LevelWall[];
  wallRects: WallRect[];
}

/** Une modification d'un élément : `before` null = il est créé, `after` null = il est retiré. */
export interface Change {
  ent: Ent;
  before: EntData | null;
  after: EntData | null;
}

interface Step {
  /** Changement d'ordre (devant, derrière) : la liste des éléments avant et après. */
  order?: { before: Ent[]; after: Ent[] };
  /** Murs peints ou effacés, seuls ou avec les éléments de la même étape (une porte posée ouvre le mur). */
  walls?: { before: WallState; after: WallState };
  changes: Change[];
  /** Position de chaque élément retiré, pour le remettre à sa place. */
  indexes: Map<number, number>;
  mergeKey: string | null;
  at: number;
}

/** Modèle d'objet à poser : son type, et une instance existante dont on reprend la couche, l'échelle et les réglages. */
export interface ObjectTemplate {
  object: string;
  info: LevelObjectInfo;
  category: Category;
  sample: LevelInstance;
}

export interface Catalog {
  objects: Map<string, ObjectTemplate>;
  /** Sprites de décalques connus, avec un exemple. */
  decals: Map<string, LevelDecal>;
}

/** Ce qu'on peut poser : tous les types d'objets et de décalques présents dans les salles du jeu. */
export function buildCatalog(levels: LevelData[]): Catalog {
  const objects = new Map<string, ObjectTemplate>();
  const decals = new Map<string, LevelDecal>();
  for (const level of levels) {
    for (const inst of level.instances) {
      const info = level.objects[inst.object];
      if (!info || objects.has(inst.object)) continue;
      objects.set(inst.object, { object: inst.object, info, category: categoryOf(level.objects, inst.object), sample: inst });
    }
    for (const decal of level.decals) if (!decals.has(decal.sprite)) decals.set(decal.sprite, decal);
  }
  return { objects, decals };
}

/** Lampe ou projecteur neuf. Mêmes réglages que les lampes de l'aile est : rayon en pixels, teinte et saturation sur 255. */
export function lightProps(spot: boolean): Record<string, unknown> {
  return spot
    ? { radius: 800, hue: 32, sat: 60, lightIntensity: 0.6, coneAngle: 0, coneHalf: 25 }
    : { radius: 500, hue: 0, sat: 0, lightIntensity: 0.4 };
}

/** Points de patrouille d'un personnage (`"x;y"` dans le fichier, comme dans les salles d'origine). */
export function patrolPoints(inst: LevelInstance): { x: number; y: number }[] {
  const raw = inst.props.patrolPoints;
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => String(p).split(';').map(Number)).filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)).map(([x, y]) => ({ x, y }));
}

/** Le personnage avec ces points de patrouille : il les parcourt dans l'ordre depuis sa place, puis revient. */
export function withPatrol(inst: LevelInstance, points: { x: number; y: number }[]): LevelInstance {
  const props: Record<string, unknown> = { ...inst.props, patrolPoints: points.map((p) => `${Math.round(p.x)};${Math.round(p.y)}`) };
  if (points.length === 0) delete props.patrolPoints;
  return { ...inst, props };
}

export function lightRadius(inst: LevelInstance): number {
  return Number(inst.props.radius ?? 256 * Math.abs(inst.scaleX));
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Deux modifications du même réglage à moins de ce délai n'en font qu'une dans l'historique (curseur que l'on fait glisser). */
const MERGE_MS = 900;

export class EditorModel {
  readonly base: LevelData;
  readonly catalog: Catalog;
  ents: Ent[] = [];
  walls: WallState;
  private nextUid = 1;
  private serial = 0;
  private readonly ids = new Set<string>();
  private done: Step[] = [];
  private undone: Step[] = [];
  /** Longueur de l'historique à la dernière sauvegarde ; -1 si cet état n'est plus atteignable. */
  private savedAt = 0;
  /** Appelé après chaque modification, annulation comprise, avec les éléments touchés. */
  onChange: (changes: Change[]) => void = () => undefined;

  constructor(level: LevelData, catalog: Catalog) {
    this.base = level;
    this.catalog = catalog;
    for (const inst of level.instances) {
      this.ids.add(inst.id);
      this.ents.push({ uid: this.nextUid++, kind: 'instance', category: categoryOf(level.objects, inst.object), data: inst });
    }
    for (const decal of level.decals) this.ents.push({ uid: this.nextUid++, kind: 'decal', category: 'decal', data: decal });
    for (const floor of level.floors) this.ents.push({ uid: this.nextUid++, kind: 'floor', category: 'floor', data: floor });
    this.walls = { walls: level.walls, wallRects: level.wallRects };
    // les repères du scénario n'existent que pour la salle qui le porte
    if (level.name === GROUND_FLOOR) {
      for (const mark of marksOf(mergedLandmarks(level.landmarks))) this.ents.push({ uid: this.nextUid++, kind: 'mark', category: 'script', data: mark });
    }
  }

  get dirty(): boolean {
    return this.done.length !== this.savedAt;
  }

  get canUndo(): boolean {
    return this.done.length > 0;
  }

  get canRedo(): boolean {
    return this.undone.length > 0;
  }

  markSaved(): void {
    this.savedAt = this.done.length;
    // la prochaine modification ne doit pas se fondre dans une étape déjà sauvegardée
    const last = this.done[this.done.length - 1];
    if (last) last.mergeKey = null;
  }

  private newId(): string {
    let id: string;
    do id = `ed_${Date.now().toString(36)}_${(++this.serial).toString(36)}`;
    while (this.ids.has(id));
    this.ids.add(id);
    return id;
  }

  /** Nouvel élément à partir d'un modèle ; il n'entre dans la salle qu'avec `apply`. */
  makeInstance(object: string, x: number, y: number, angle: number, props?: Record<string, unknown>): Ent | null {
    const template = this.catalog.objects.get(object);
    if (!template) return null;
    const sample = template.sample;
    const data: LevelInstance = { ...clone(sample), id: this.newId(), x, y, angle, props: props ?? clone(sample.props) };
    if (object === LIGHT_OBJECT) {
      data.scaleX = data.scaleY = lightRadius(data) / 150;
      data.tint = '#ffffff';
    }
    return { uid: this.nextUid++, kind: 'instance', category: template.category, data };
  }

  makeDecal(sprite: string, x: number, y: number, angle: number): Ent | null {
    const sample = this.catalog.decals.get(sprite);
    if (!sample) return null;
    return { uid: this.nextUid++, kind: 'decal', category: 'decal', data: { ...clone(sample), x, y, angle } };
  }

  /** Nouveau sol : un rectangle rempli par la texture répétée d'un tileset, motif calé sur son coin haut-gauche. */
  makeFloor(tileset: string, x: number, y: number, w: number, h: number): Ent {
    const data: LevelFloor = { object: tileset.replace(/^til_sol_/, 'obj_textureGenerator_'), tileset, x, y, w, h, phaseX: 0, phaseY: 0 };
    return { uid: this.nextUid++, kind: 'floor', category: 'floor', data };
  }

  /** Nouvelle zone de brouillard : elle se lève quand un robot y entre ; son numéro permet d'y attacher d'autres zones. */
  makeFog(x: number, y: number, w: number, h: number): Ent | null {
    const template = this.catalog.objects.get('obj_warFog');
    if (!template) return null;
    const numbers = this.ents.filter(isInstance).map((e) => Number(e.data.props.warFogNumber)).filter((n) => Number.isFinite(n));
    const data: LevelInstance = {
      ...clone(template.sample), id: this.newId(), x, y, angle: 0, scaleX: w / 64, scaleY: h / 64,
      props: { warFogNumber: Math.max(0, ...numbers) + 1, attachedWarFogNumber: null, apparitionSpeed: 0.08 },
    };
    return { uid: this.nextUid++, kind: 'instance', category: 'fog', data };
  }

  /** Copie d'un élément, décalée. */
  duplicate(ent: Ent, dx: number, dy: number): Ent {
    const data = clone(ent.data);
    data.x += dx;
    data.y += dy;
    if (ent.kind === 'instance') (data as LevelInstance).id = this.newId();
    // (un repère du scénario ne se copie pas : la scène ne le propose pas)
    return { uid: this.nextUid++, kind: ent.kind, category: ent.category, data };
  }

  /**
   * Applique des modifications et les inscrit dans l'historique. `mergeKey` : des modifications successives
   * portant la même clé (un même réglage du même élément) ne comptent que pour une.
   */
  apply(changes: Change[], mergeKey: string | null = null, walls: LevelWall[] | null = null): void {
    const real = changes.filter((c) => c.before !== c.after && JSON.stringify(c.before) !== JSON.stringify(c.after));
    const wallStep = walls && walls !== this.walls.walls ? { before: this.walls, after: { walls, wallRects: wallRectsOf(walls) } } : undefined;
    if (real.length === 0 && !wallStep) return;
    if (wallStep) this.walls = wallStep.after;
    const now = Date.now();
    const last = this.done[this.done.length - 1];
    const indexes = this.perform(real, 'after', new Map());
    if (last && !wallStep && mergeKey !== null && last.mergeKey === mergeKey && now - last.at < MERGE_MS && this.done.length !== this.savedAt) {
      // même réglage qui continue de bouger : l'étape garde son point de départ et prend la nouvelle arrivée
      for (const change of real) {
        const known = last.changes.find((c) => c.ent === change.ent);
        if (known) known.after = change.after;
        else last.changes.push(change);
      }
      last.at = now;
    } else {
      if (this.savedAt > this.done.length) this.savedAt = -1;
      this.done.push({ changes: real, indexes, mergeKey, at: now, walls: wallStep });
    }
    this.undone = [];
    this.onChange(real);
  }

  private perform(changes: Change[], side: 'before' | 'after', indexes: Map<number, number>): Map<number, number> {
    const removed = new Map<number, number>();
    for (const change of changes) {
      const from = side === 'after' ? change.before : change.after;
      const to = change[side];
      if (to === null) {
        const index = this.ents.indexOf(change.ent);
        if (index >= 0) {
          removed.set(change.ent.uid, index);
          this.ents.splice(index, 1);
        }
      } else if (from === null) {
        const index = indexes.get(change.ent.uid);
        change.ent.data = to;
        if (index === undefined || index > this.ents.length) this.ents.push(change.ent);
        else this.ents.splice(index, 0, change.ent);
      } else {
        change.ent.data = to;
      }
    }
    return removed;
  }

  /**
   * Passe des éléments devant tous les autres, ou derrière. L'ordre de la salle est l'ordre de dessin : à
   * profondeur égale, le dernier de la liste est dessiné par-dessus (GD-095). Renvoie faux si rien ne bouge.
   */
  reorder(ents: Ent[], where: 'front' | 'back'): boolean {
    const moved = this.ents.filter((e) => ents.includes(e));
    const rest = this.ents.filter((e) => !ents.includes(e));
    const after = where === 'front' ? [...rest, ...moved] : [...moved, ...rest];
    if (moved.length === 0 || after.every((e, i) => e === this.ents[i])) return false;
    if (this.savedAt > this.done.length) this.savedAt = -1;
    this.done.push({ order: { before: [...this.ents], after: [...after] }, changes: moved.map((ent) => ({ ent, before: ent.data, after: ent.data })), indexes: new Map(), mergeKey: null, at: Date.now() });
    this.ents = after;
    this.undone = [];
    this.onChange(this.done[this.done.length - 1].changes);
    return true;
  }

  undo(): boolean {
    const step = this.done.pop();
    if (!step) return false;
    if (step.walls) this.walls = step.walls.before;
    if (step.order) {
      this.ents = [...step.order.before];
      this.undone.push(step);
      this.onChange(step.changes);
      return true;
    }
    // dans l'ordre inverse : les éléments retirés reprennent leur place un par un
    const reversed = [...step.changes].reverse();
    const indexes = this.perform(reversed, 'before', step.indexes);
    this.undone.push({ ...step, indexes });
    this.onChange(step.changes);
    return true;
  }

  redo(): boolean {
    const step = this.undone.pop();
    if (!step) return false;
    if (step.walls) this.walls = step.walls.after;
    if (step.order) {
      this.ents = [...step.order.after];
      this.done.push(step);
      this.onChange(step.changes);
      return true;
    }
    const indexes = this.perform(step.changes, 'after', step.indexes);
    this.done.push({ ...step, indexes, mergeKey: null });
    this.onChange(step.changes);
    return true;
  }

  /** La salle telle qu'elle sera écrite : les éléments dans leur ordre, les murs, et le type de chaque objet utilisé. */
  toLevel(): LevelData {
    const objects = { ...this.base.objects };
    const instances: LevelInstance[] = [];
    const decals: LevelDecal[] = [];
    const floors: LevelFloor[] = [];
    const marks: Mark[] = [];
    for (const ent of this.ents) {
      if (ent.kind === 'decal') decals.push(ent.data as LevelDecal);
      else if (ent.kind === 'floor') floors.push(ent.data as LevelFloor);
      else if (ent.kind === 'mark') marks.push(ent.data as Mark);
      else {
        const inst = ent.data as LevelInstance;
        instances.push(inst);
        const info = this.catalog.objects.get(inst.object)?.info;
        if (!objects[inst.object] && info) objects[inst.object] = info;
      }
    }
    // une pièce de mur posée par l'éditeur peut être d'un type que la salle n'avait pas (croix, plot)
    const pieces = wallObjects();
    for (const wall of this.walls.walls) if (!objects[wall.object] && pieces[wall.object]) objects[wall.object] = pieces[wall.object];
    const level: LevelData = { ...this.base, objects, instances, walls: this.walls.walls, wallRects: this.walls.wallRects, floors, decals };
    // les repères ne sont écrits dans la salle que s'ils y étaient déjà ou s'ils ont quitté leur place par défaut
    if (marks.length > 0) {
      const landmarks = landmarksFrom(marks) as unknown as Record<string, unknown>;
      if (this.base.landmarks !== undefined || JSON.stringify(landmarks) !== JSON.stringify(mergedLandmarks(undefined))) level.landmarks = landmarks;
    }
    return level;
  }
}
