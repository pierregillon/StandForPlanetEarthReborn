// État du jeu envoyé par le serveur aux clients (ADR-014).
// Le serveur fait tourner la simulation ; chaque client a un monde « miroir » construit depuis la même salle,
// que ces instantanés tiennent à jour. On n'envoie que les champs simples qui ont changé depuis l'envoi
// précédent : la connexion (WebSocket) garantit l'ordre et la livraison, ce qui suffit à rendre ce différentiel sûr.
import { CONFIG } from '../sim/config.ts';
import { blankNpc } from '../sim/npc.ts';
import type { World } from '../sim/world.ts';

export type Value = number | string | boolean | null;
export type Entity = Record<string, unknown>;

/** Une liste d'entités synchronisée. */
interface ListDef {
  name: string;
  /** Entités de cette liste dans un monde. Une entité sans `id` est repérée par son rang. */
  get(w: World): Entity[];
  /** Champs jamais envoyés : état interne de la simulation, inutile à l'affichage. */
  skip?: string[];
  /** Champs envoyés à la création, puis seulement quand un autre champ change : le client les fait avancer seul. */
  coast?: string[];
  /**
   * Compteurs qui avancent d'un par step : le client les fait avancer lui-même, le serveur ne les renvoie que
   * quand ils sautent ou repartent de zéro (changement d'animation).
   */
  clock?: string[];
  /** Côté client, pour les entités qui apparaissent en cours de jeu : modèle vide, puis ajout au monde. */
  blank?(): Entity;
  add?(w: World, e: Entity): void;
  remove?(w: World, e: Entity): void;
}

function array(name: 'npcs' | 'doors' | 'buttons' | 'windows' | 'outlets' | 'cards' | 'drills' | 'chairs' | 'fogs' | 'zones', skip: string[] = []): ListDef {
  return {
    name, skip,
    get: (w) => w[name] as unknown as Entity[],
    remove: (w, e) => {
      const list = w[name] as unknown as Entity[];
      const i = list.indexOf(e);
      if (i >= 0) list.splice(i, 1);
    },
  };
}

function spawned(name: 'bullets' | 'drones' | 'seekers' | 'explosions' | 'bats' | 'effects', blank: () => Entity, coast: string[] = [], skip: string[] = []): ListDef {
  return {
    name, coast, blank, skip,
    get: (w) => w[name] as unknown as Entity[],
    add: (w, e) => {
      (w[name] as unknown as Entity[]).push(e);
    },
    remove: (w, e) => {
      const list = w[name] as unknown as Entity[];
      const i = list.indexOf(e);
      if (i >= 0) list.splice(i, 1);
    },
  };
}

/** État commun de la partie, rangé dans une entité unique pour passer par le même différentiel. */
const states = new WeakMap<World, Entity>();
function stateOf(w: World): Entity {
  let s = states.get(w);
  if (!s) {
    s = {};
    states.set(w, s);
  }
  s.exitCountdown = w.exitCountdown;
  s.zoneCountdown = w.zoneCountdown;
  s.objective = w.session.objective;
  s.carried = [...w.session.carried].sort().join(',');
  s.checkpoint = w.session.checkpoint !== null;
  s.introLine = w.introLine;
  s.introLineSteps = w.introLineSteps;
  s.introHold = w.introHold;
  s.cast = w.cast;
  s.castScene = w.castScene;
  s.castReader = w.castReader;
  s.markCountdown = w.markCountdown;
  s.wave = w.waveSteps >= 0;
  s.ended = w.levelEnded;
  Object.assign(s, w.stats);
  return s;
}

/** Côté client : range l'état commun reçu dans le monde miroir et sa partie. */
export function applyState(w: World): void {
  const s = states.get(w);
  if (!s) return;
  w.exitCountdown = Number(s.exitCountdown ?? -1);
  w.zoneCountdown = Number(s.zoneCountdown ?? -1);
  w.session.objective = Number(s.objective ?? 0);
  w.introLine = Number(s.introLine ?? 0);
  w.introLineSteps = Number(s.introLineSteps ?? 0);
  w.introHold = Number(s.introHold ?? 0);
  w.cast = Number(s.cast ?? -1);
  w.castScene = Number(s.castScene ?? 0);
  w.castReader = Number(s.castReader ?? 0);
  w.markCountdown = Number(s.markCountdown ?? -1);
  // la riposte a commencé : les fourgons de police sont sur le parking
  if (s.wave === true) w.parkVans();
  w.session.carried.clear();
  for (const color of String(s.carried ?? '').split(',')) if (color) w.session.carried.add(color);
  for (const key of Object.keys(w.stats) as (keyof World['stats'])[]) if (typeof s[key] === 'number') w.stats[key] = s[key] as number;
}

/**
 * Tout ce qui est synchronisé. Les compteurs internes des PNJ et des héros sont exclus : ils changent à chaque
 * step et ne servent qu'à la simulation.
 */
export const LISTS: ListDef[] = [
  {
    name: 'state',
    get: (w) => [states.get(w) ?? stateOf(w)],
  },
  {
    name: 'heroes',
    get: (w) => w.heroes as unknown as Entity[],
    // walkDist (animation des jambes) est recalculé par le client à partir du déplacement affiché
    skip: ['energyTimer', 'energyPause', 'fireTimer', 'chargeTimer', 'repairTimer', 'healPool', 'fire2Timer', 'fire1Was', 'fire2Was', 'overchargeHold', 'tanked', 'recallDone', 'walkDist', 'linkTimer'],
    clock: ['sinceShot'],
  },
  {
    ...array('npcs', [
      'dir', 'spd', 'path', 'pathIdx', 'waypointTimer', 'waypointFailures', 'patrolType', 'patrolReverse', 'pauseTimer',
      'attackRange', 'fireTimer', 'repathTimer', 'viewRange', 'alertX', 'alertY', 'alertTimer', 'fearTimer', 'walkDist', 'strafe', 'unseen', 'hunt',
    ]),
    clock: ['stateSteps'],
    // les soldats de la riposte apparaissent en cours de partie (GD-086)
    blank: () => blankNpc() as unknown as Entity,
    add: (w, e) => {
      w.npcs.push(e as unknown as World['npcs'][number]);
    },
  },
  spawned('bullets', () => ({}), ['x', 'y', 'speed', 'steps']),
  spawned('drones', () => ({})),
  spawned('seekers', () => ({}), [], ['scout', 'destX', 'destY', 'travelled', 'pathIdx', 'replan']),
  spawned('explosions', () => ({ hit: new Set<number>() }), ['step']),
  spawned('bats', () => ({ hit: new Set<number>() })),
  // effets d'ultis : le client fait avancer leur durée, et la grenade en vol, lui-même
  spawned('effects', () => ({}), ['steps', 'x', 'y']),
  {
    name: 'turret',
    get: (w) => (w.turret ? [w.turret as unknown as Entity] : []),
    skip: ['fireTimer'],
    blank: () => ({}),
    add: (w, e) => {
      w.turret = e as unknown as World['turret'];
    },
    remove: (w) => {
      w.turret = null;
    },
  },
  {
    name: 'boss',
    get: (w) => (w.boss ? [w.boss as unknown as Entity] : []),
    skip: ['path', 'pathIdx', 'repathTimer', 'guardedHp'],
  },
  {
    name: 'checkpoint',
    get: (w) => (w.checkpoint ? [w.checkpoint as unknown as Entity] : []),
  },
  array('doors', ['stayTimer', 'inNav']),
  array('buttons'),
  array('windows'),
  array('outlets'),
  array('cards'),
  array('drills'),
  array('chairs', ['vx', 'vy']),
  array('fogs'),
  array('zones', ['countdown', 'departed']),
];

const BY_NAME = new Map(LISTS.map((l) => [l.name, l]));

// ---------- Références vers les réglages ----------
// Un champ comme `def` pointe vers un objet de CONFIG : on envoie son chemin, pas son contenu.

const refPaths = new Map<object, string>();
const refObjects = new Map<string, object>();
(function index(o: object, path: string): void {
  for (const [k, v] of Object.entries(o)) {
    if (!v || typeof v !== 'object' || refPaths.has(v)) continue;
    const p = path ? `${path}.${k}` : k;
    refPaths.set(v, p);
    refObjects.set(p, v);
    index(v, p);
  }
})(CONFIG, '');

/** Valeur transmissible d'un champ, ou undefined s'il n'est pas synchronisé (objet, tableau, ensemble). */
function encodeValue(v: unknown): Value | undefined {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return undefined;
    if (Number.isInteger(v)) return v;
    // une position au dixième de pixel, un angle ou une proportion au centième
    return Math.abs(v) >= 100 ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100;
  }
  if (typeof v === 'string' || typeof v === 'boolean' || v === null) return v;
  if (typeof v === 'object') {
    const path = refPaths.get(v as object);
    return path === undefined ? undefined : `@${path}`;
  }
  return undefined;
}

function decodeValue(v: Value): unknown {
  if (typeof v === 'string' && v.charCodeAt(0) === 64) return refObjects.get(v.slice(1)) ?? v;
  return v;
}

function idOf(e: Entity, index: number): number {
  return typeof e.id === 'number' ? e.id : index;
}

// ---------- Format ----------

export interface Snapshot {
  /** Step du serveur. */
  n: number;
  /** Instantané complet : à appliquer sur un monde miroir neuf (début de partie, changement de salle). */
  full?: true;
  /** Noms des champs de chaque liste, dans l'ordre de leurs numéros (envoyés quand ils changent). */
  sch?: Record<string, string[]>;
  /** Par liste, une ligne par entité modifiée : [id, numéro de champ, valeur, numéro de champ, valeur, ...]. */
  l?: Record<string, (Value)[][]>;
  /** Par liste, entités disparues. */
  g?: Record<string, number[]>;
  /** Instantané complet : par liste, toutes les entités existantes (le miroir retire les autres). */
  ids?: Record<string, number[]>;
}

// ---------- Serveur ----------

export class SnapshotEncoder {
  private readonly last = new Map<string, Map<number, Value[]>>();
  private readonly schema = new Map<string, Map<string, number>>();
  private lastTick = 0;
  /** Nombre de valeurs envoyées par champ, pour repérer ce qui pèse sur le réseau (outil de mesure). */
  readonly sent = new Map<string, number>();

  /** Oublie ce qui a été envoyé : le prochain instantané sera complet (nouvelle salle, nouvelle partie). */
  reset(): void {
    this.last.clear();
  }

  encode(w: World): Snapshot {
    const full = this.last.size === 0;
    const elapsed = w.tick - this.lastTick;
    this.lastTick = w.tick;
    const snap: Snapshot = { n: w.tick };
    if (full) {
      snap.full = true;
      snap.ids = {};
    }
    stateOf(w);
    for (const def of LISTS) {
      const items = def.get(w);
      let known = this.last.get(def.name);
      if (!known) this.last.set(def.name, (known = new Map()));
      let schema = this.schema.get(def.name);
      if (!schema) this.schema.set(def.name, (schema = new Map()));
      const schemaSize = schema.size;
      const seen = new Set<number>();
      const rows: Value[][] = [];
      for (let i = 0; i < items.length; i++) {
        const e = items[i];
        const id = idOf(e, i);
        seen.add(id);
        let prev = known.get(id);
        const fresh = !prev;
        if (!prev) known.set(id, (prev = []));
        const row: Value[] = [id];
        let coasting: [number, Value][] | null = null;
        for (const key in e) {
          if (key === 'id' || def.skip?.includes(key)) continue;
          const v = encodeValue(e[key]);
          if (v === undefined) continue;
          let k = schema.get(key);
          if (k === undefined) schema.set(key, (k = schema.size));
          const was = prev[k];
          if (was === v) continue;
          if (!fresh && def.clock?.includes(key) && typeof was === 'number' && typeof v === 'number') {
            // compteur : inutile de l'envoyer s'il a simplement avancé au rythme des steps
            prev[k] = v;
            if (v > was && v <= was + elapsed) continue;
            row.push(k, v);
            continue;
          }
          if (!fresh && def.coast?.includes(key)) {
            (coasting ??= []).push([k, v]);
            continue;
          }
          prev[k] = v;
          row.push(k, v);
          this.sent.set(`${def.name}.${key}`, (this.sent.get(`${def.name}.${key}`) ?? 0) + 1);
        }
        // un autre champ a changé (rebond d'une balle, par exemple) : on recale aussi ce que le client extrapole
        if (coasting && row.length > 1) {
          for (const [k, v] of coasting) {
            prev[k] = v;
            row.push(k, v);
          }
        }
        if (row.length > 1 || fresh) rows.push(row);
      }
      if (rows.length > 0) (snap.l ??= {})[def.name] = rows;
      const gone: number[] = [];
      for (const id of known.keys()) {
        if (seen.has(id)) continue;
        known.delete(id);
        gone.push(id);
      }
      if (gone.length > 0) (snap.g ??= {})[def.name] = gone;
      if (snap.ids) snap.ids[def.name] = [...seen];
      if (full || schema.size !== schemaSize) (snap.sch ??= {})[def.name] = [...schema.keys()];
    }
    return snap;
  }
}

// ---------- Client ----------

export interface ApplyHooks {
  /**
   * Appelé avant d'écrire un champ reçu. Retourner true pour s'en charger soi-même (interpolation, héros
   * prédit) : le champ n'est alors pas écrit dans l'entité.
   */
  intercept?(list: string, e: Entity, key: string, value: unknown, fresh: boolean): boolean;
  /** Appelé après la mise à jour d'une entité, avec les champs reçus. */
  changed?(list: string, e: Entity, keys: string[]): void;
  /** Appelé quand une entité disparaît. */
  removed?(list: string, e: Entity): void;
}

export class SnapshotDecoder {
  private readonly schema = new Map<string, string[]>();

  apply(w: World, snap: Snapshot, hooks: ApplyHooks = {}): void {
    if (snap.sch) for (const [name, keys] of Object.entries(snap.sch)) this.schema.set(name, keys);
    for (const def of LISTS) {
      const rows = snap.l?.[def.name];
      const gone = snap.g?.[def.name];
      const ids = snap.ids?.[def.name];
      if (!rows && !gone && !ids) continue;
      const items = def.get(w);
      const byId = new Map<number, Entity>();
      items.forEach((e, i) => byId.set(idOf(e, i), e));
      const schema = this.schema.get(def.name) ?? [];
      for (const row of rows ?? []) {
        const id = row[0] as number;
        let e = byId.get(id);
        const fresh = !e;
        if (!e) {
          // une entité inconnue qui ne peut pas être créée ici, ou dont on n'a reçu qu'une mise à jour partielle
          if (!def.blank || !def.add) continue;
          e = def.blank();
          e.id = id;
        }
        const keys: string[] = [];
        for (let i = 1; i + 1 < row.length; i += 2) {
          const key = schema[row[i] as number];
          if (key === undefined) continue;
          const value = decodeValue(row[i + 1]);
          keys.push(key);
          if (!hooks.intercept?.(def.name, e, key, value, fresh)) e[key] = value;
        }
        if (fresh) {
          def.add?.(w, e);
          byId.set(id, e);
        }
        hooks.changed?.(def.name, e, keys);
      }
      const drop = (e: Entity | undefined): void => {
        if (!e) return;
        hooks.removed?.(def.name, e);
        def.remove?.(w, e);
      };
      for (const id of gone ?? []) drop(byId.get(id));
      if (ids) {
        const keep = new Set(ids);
        for (const [id, e] of byId) if (!keep.has(id)) drop(e);
      }
    }
    applyState(w);
  }
}

export function listNames(): string[] {
  return [...BY_NAME.keys()];
}
