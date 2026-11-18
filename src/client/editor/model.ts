// Modèle de l'éditeur de niveaux (ADR-018) : la salle en cours de retouche, ses éléments, l'historique des
// modifications. Sans Phaser ni navigateur : l'affichage est dans EditorScene, les panneaux dans EditorUi.
import { CONFIG } from '../../sim/config.ts';
import type { LevelData, LevelDecal, LevelInstance, LevelObjectInfo } from '../../sim/types.ts';

/**
 * Famille d'un élément. L'éditeur les montre toutes ; seules celles de `EDITABLE` se retouchent pour l'instant
 * (étape 1 : décor, lumières, décalques). Les autres viennent avec leurs outils : murs, sols et portes, puis
 * personnages, brouillard et repères.
 */
export type Category = 'decor' | 'light' | 'decal' | 'door' | 'window' | 'npc' | 'fog' | 'wall' | 'marker';

export const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'decor', label: 'Furniture & props' },
  { id: 'light', label: 'Lights' },
  { id: 'decal', label: 'Floor decals' },
  { id: 'door', label: 'Doors' },
  { id: 'window', label: 'Windows' },
  { id: 'npc', label: 'Characters' },
  { id: 'fog', label: 'Fog zones' },
  { id: 'wall', label: 'Wall blocks' },
  { id: 'marker', label: 'Spawns & triggers' },
];

export const EDITABLE: ReadonlySet<Category> = new Set<Category>(['decor', 'light', 'decal']);

export const LIGHT_OBJECT = 'obj_lumiere';
/** Décor sans parent que le jeu dessine quand même (même liste que `DECOR_ONLY` de world.ts). */
const DECOR_ONLY = /^obj_(fauteuilRond\d|mur_dessousFenetre|robot_atelier\d|tapis_accueil)$/;

const isA = (objects: Record<string, LevelObjectInfo>, object: string, ancestor: string): boolean =>
  object === ancestor || (objects[object]?.parents.includes(ancestor) ?? false);

/** Famille d'un type d'objet, d'après les mêmes règles que le chargement d'une salle (`World.addInstance`). */
export function categoryOf(objects: Record<string, LevelObjectInfo>, object: string): Category {
  if (object === LIGHT_OBJECT) return 'light';
  if (isA(objects, object, 'obj_door_parent')) return 'door';
  if (object === 'obj_fenetre') return 'window';
  if (isA(objects, object, 'obj_localNpc')) return 'npc';
  if (object === 'obj_warFog') return 'fog';
  if (CONFIG.chair.objects.includes(object)) return 'decor';
  if (isA(objects, object, 'obj_mur_parent')) return 'wall';
  if (object === 'obj_foreuse') return 'marker';
  if (isA(objects, object, 'obj_decor_base') || DECOR_ONLY.test(object)) return 'decor';
  return 'marker';
}

export type EntData = LevelInstance | LevelDecal;

/** Un élément de la salle : une instance ou un décalque. `data` est remplacé à chaque modification, jamais modifié en place. */
export interface Ent {
  readonly uid: number;
  readonly kind: 'instance' | 'decal';
  readonly category: Category;
  data: EntData;
}

export const isInstance = (ent: Ent): ent is Ent & { data: LevelInstance } => ent.kind === 'instance';

/** Une modification d'un élément : `before` null = il est créé, `after` null = il est retiré. */
export interface Change {
  ent: Ent;
  before: EntData | null;
  after: EntData | null;
}

interface Step {
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

  /** Copie d'un élément, décalée. */
  duplicate(ent: Ent, dx: number, dy: number): Ent {
    const data = clone(ent.data);
    data.x += dx;
    data.y += dy;
    if (ent.kind === 'instance') (data as LevelInstance).id = this.newId();
    return { uid: this.nextUid++, kind: ent.kind, category: ent.category, data };
  }

  /**
   * Applique des modifications et les inscrit dans l'historique. `mergeKey` : des modifications successives
   * portant la même clé (un même réglage du même élément) ne comptent que pour une.
   */
  apply(changes: Change[], mergeKey: string | null = null): void {
    const real = changes.filter((c) => c.before !== c.after && JSON.stringify(c.before) !== JSON.stringify(c.after));
    if (real.length === 0) return;
    const now = Date.now();
    const last = this.done[this.done.length - 1];
    const indexes = this.perform(real, 'after', new Map());
    if (last && mergeKey !== null && last.mergeKey === mergeKey && now - last.at < MERGE_MS && this.done.length !== this.savedAt) {
      // même réglage qui continue de bouger : l'étape garde son point de départ et prend la nouvelle arrivée
      for (const change of real) {
        const known = last.changes.find((c) => c.ent === change.ent);
        if (known) known.after = change.after;
        else last.changes.push(change);
      }
      last.at = now;
    } else {
      if (this.savedAt > this.done.length) this.savedAt = -1;
      this.done.push({ changes: real, indexes, mergeKey, at: now });
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

  undo(): boolean {
    const step = this.done.pop();
    if (!step) return false;
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
    const indexes = this.perform(step.changes, 'after', step.indexes);
    this.done.push({ ...step, indexes, mergeKey: null });
    this.onChange(step.changes);
    return true;
  }

  /** La salle telle qu'elle sera écrite : les éléments dans leur ordre, et le type de chaque objet utilisé. */
  toLevel(): LevelData {
    const objects = { ...this.base.objects };
    const instances: LevelInstance[] = [];
    const decals: LevelDecal[] = [];
    for (const ent of this.ents) {
      if (ent.kind === 'decal') {
        decals.push(ent.data as LevelDecal);
        continue;
      }
      const inst = ent.data as LevelInstance;
      instances.push(inst);
      const info = this.catalog.objects.get(inst.object)?.info;
      if (!objects[inst.object] && info) objects[inst.object] = info;
    }
    return { ...this.base, objects, instances, decals };
  }
}
