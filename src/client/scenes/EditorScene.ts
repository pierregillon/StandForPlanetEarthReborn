// Éditeur de niveaux (ADR-018) : la salle entière en caméra libre, tous ses éléments visibles, et de quoi
// poser, déplacer, tourner, régler et retirer le décor, les lumières, les décalques, les portes et les
// fenêtres ; peindre et effacer les murs ; tracer et redimensionner les sols. La sauvegarde réécrit
// public/levels/<salle>.json par le serveur, sans commit (ADR-019).
// Le modèle (éléments, historique) est dans editor/model.ts, les panneaux HTML dans editor/EditorUi.ts.
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import type { FloorManifest } from '../assets.ts';
import { Keys } from '../keys.ts';
import { DEPTH, DRAW_ORDER_STEP, LIGHTING } from '../view/WorldView.ts';
import { EditorModel, EDITABLE, LIGHT_OBJECT, buildCatalog, isFloor, isInstance, isMark, lightProps, lightRadius, patrolPoints, withPatrol } from '../editor/model.ts';
import type { Category, Change, Ent, EntData, Placed } from '../editor/model.ts';
import { cellSize, editWalls, lineCells, wallObjects } from '../editor/walls.ts';
import { EditorUi, HIDDEN_AT_START, colorToLamp, lampColor, markName } from '../editor/EditorUi.ts';
import type { Field, LayerId, Mode, PaletteItem } from '../editor/EditorUi.ts';
import { BLOCK_SIGHT, gmAngleToRad, localToWorld } from '../../sim/geom.ts';
import type { CollisionWorld } from '../../sim/geom.ts';
import { GROUND_FLOOR, MAPS } from '../../sim/session.ts';
import { useLandmarks } from '../../sim/landmarks.ts';
import type { Mark } from '../../sim/landmarks.ts';
import { visibilityPolygon } from '../../sim/visibility.ts';
import { World } from '../../sim/world.ts';
import type { LevelData, LevelDecal, LevelFloor, LevelInstance, LevelWall, SpriteInfo, SpriteManifest } from '../../sim/types.ts';
import { LEVELS } from './BootScene.ts';

type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type Img = Phaser.GameObjects.Image;

const ZOOM = { min: 0.07, max: 3, step: 0.88 };
const TOP = { marker: 5400, light: 5500, overlay: 6000 };
const ANGLE_STEP = 15;
/** Plus petit côté d'un sol ou d'une zone que l'on redimensionne. */
const MIN_SIDE = 16;
const WALL_OBJECTS = wallObjects();
/** Familles que la souris attrape dans chaque mode (parmi celles que l'éditeur sait retoucher). */
const MODE_PICKS: Record<Mode, Category[]> = {
  objects: ['decor', 'light', 'decal', 'door', 'window', 'npc', 'marker'],
  walls: [],
  floors: ['floor'],
  zones: ['fog', 'marker'],
  script: ['script'],
};
/** Noms plus parlants que ceux des objets d'origine, sur la carte. */
const MARKER_LABELS: Record<string, string> = {
  obj_outlet: 'recharge outlet', obj_checkpoint: 'checkpoint', obj_spawnHeros: 'hero spawn', obj_spawnVehicle: 'drop vehicle', obj_nextRoom: 'stairs (next room)',
  obj_previousRoom: 'stairs (previous room)', obj_endLevel: 'level exit zone', obj_card_green: 'green card', obj_card_purple: 'purple card',
};

interface Visual {
  ent: Ent;
  /** Image du sprite, s'il y en a un ; sinon l'élément est un repère dessiné. */
  img: Img | null;
  /** Repère, étiquette : gardent leur taille à l'écran quel que soit le zoom. */
  marks: (Phaser.GameObjects.Shape | Phaser.GameObjects.Text)[];
  /** Cadre d'une zone (brouillard, repère du scénario), à l'échelle de la carte. */
  frame: Phaser.GameObjects.Shape | null;
  /** Texture répétée d'un sol. */
  tile: Phaser.GameObjects.TileSprite | null;
}

interface LampBake {
  key: string;
  stamp: Img;
  glow: Img | null;
  x: number;
  y: number;
  radius: number;
  strength: number;
}

type Drag =
  | { kind: 'pan'; x: number; y: number; camX: number; camY: number; moved: boolean }
  | { kind: 'move'; from: Point; start: Map<Ent, EntData>; lead: Ent; moved: boolean; cycle: Ent[] | null }
  | { kind: 'box'; from: Point; to: Point; add: boolean }
  | { kind: 'rotate'; ent: Ent; before: EntData }
  | { kind: 'resize'; ent: Ent; before: EntData; hx: number; hy: number }
  | { kind: 'wall'; thick: boolean; from: Point; to: Point }
  | { kind: 'erase'; from: Point; to: Point }
  | { kind: 'floor'; tileset: string; from: Point; to: Point }
  | { kind: 'fog'; from: Point; to: Point }
  | { kind: 'point'; ent: Ent; before: EntData; index: number };

const tintOf = (hex: string): number => parseInt(hex.replace('#', ''), 16);
const normAngle = (deg: number): number => {
  const a = ((deg % 360) + 360) % 360;
  return Number((a > 180 ? a - 360 : a).toFixed(3));
};

function inside(polygon: Point[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

export class EditorScene extends Phaser.Scene {
  private model!: EditorModel;
  private ui: EditorUi | null = null;
  private sprites!: SpriteManifest;
  private readonly visuals = new Map<number, Visual>();
  /** Rang de chaque élément dans la salle : à profondeur égale, le plus grand est dessiné devant, comme en jeu (GD-095). */
  private readonly ranks = new Map<number, number>();
  private wallImgs: Img[] = [];
  /** Les murs tels qu'ils sont dessinés : s'ils ne sont plus ceux du modèle, il faut les redessiner. */
  private wallsDrawn: LevelWall[] | null = null;
  private floorInfo: FloorManifest = {};
  private mode: Mode = 'objects';
  /** Numéro de la dernière porte à bouton posée ou sélectionnée : le prochain bouton posé l'ouvrira. */
  private lastDoorId: number | null = null;
  private readonly layers = new Map<LayerId, boolean>();
  private selection: Ent[] = [];
  private hover: Ent | null = null;
  private overlay!: Phaser.GameObjects.Graphics;
  private camX = 0;
  private camY = 0;
  private zoom = 0.5;
  private cursor: Point = { x: 0, y: 0 };
  private tool: PaletteItem | null = null;
  private ghost: Img | null = null;
  private ghostAngle = 0;
  private snap = 16;
  private snapBefore = 16;
  private drag: Drag | null = null;
  private ready = false;
  private busy = false;
  // aperçu de l'éclairage
  private lit = false;
  private darkness: Phaser.GameObjects.RenderTexture | null = null;
  private readonly lamps = new Map<number, LampBake>();
  private collision: CollisionWorld | null = null;
  private litStale = true;
  private rebuildAt = 0;

  constructor() {
    super('Editor');
  }

  create(data: { room?: string }): void {
    const room = data.room && LEVELS.includes(data.room) ? data.room : LEVELS[0];
    const { width, height } = this.scale;
    this.ready = false;
    this.busy = false;
    this.selection = [];
    this.hover = null;
    this.tool = null;
    this.ghost = null;
    this.drag = null;
    this.lit = false;
    this.litStale = true;
    this.collision = null;
    this.darkness = null;
    this.lamps.clear();
    this.visuals.clear();
    this.wallImgs = [];
    this.wallsDrawn = null;
    this.mode = 'objects';
    this.lastDoorId = null;
    this.layers.clear();
    this.cameras.main.setBackgroundColor('#10131c').setZoom(1).setScroll(0, 0);
    const loading = this.add.text(width / 2, height / 2, 'Loading the level…', { fontFamily: 'Aldo', fontSize: '44px', color: '#cfd8ff' }).setOrigin(0.5);
    this.input.setDefaultCursor('default');
    Keys.clearPressed();
    // la version du disque, pas celle chargée au démarrage : le fichier a pu changer depuis (git, autre onglet)
    fetch(`levels/${room}.json`, { cache: 'no-store' })
      .then((res) => (res.ok ? (res.json() as Promise<LevelData>) : Promise.reject(new Error(String(res.status)))))
      .catch(() => this.cache.json.get(`level:${room}`) as LevelData)
      .then((level) => {
        if (!this.scene.isActive()) return;
        loading.destroy();
        this.cache.json.add(`level:${room}`, level);
        this.open(level);
      });
  }

  // ---------- Ouverture ----------

  private open(level: LevelData): void {
    this.sprites = this.cache.json.get('sprites') as SpriteManifest;
    const all = LEVELS.map((name) => this.cache.json.get(`level:${name}`) as LevelData);
    // la salle ouverte d'abord : ses propres objets servent de modèles avant ceux des autres salles
    this.model = new EditorModel(level, buildCatalog([level, ...all.filter((l) => l.name !== level.name)]));
    this.model.onChange = (changes) => this.changed(changes);
    this.floorInfo = (this.cache.json.get('floors') ?? {}) as FloorManifest;
    for (const id of ['walls', 'floor', 'decor', 'light', 'decal', 'door', 'window', 'npc', 'fog', 'wall', 'marker', 'script'] as LayerId[]) this.layers.set(id, !HIDDEN_AT_START.has(id));
    this.buildStatic(level);
    this.drawWalls();
    this.rank();
    for (const ent of this.model.ents) this.show(ent);
    this.overlay = this.add.graphics().setDepth(TOP.overlay);

    const map = MAPS.find((m) => m.rooms.some((r) => r.room === level.name));
    const title = map ? `${map.title} · ${map.rooms.find((r) => r.room === level.name)?.title ?? level.name}` : level.name;
    this.ui = new EditorUi(title, this.model.catalog, Object.keys(this.floorInfo).sort(), level.name === GROUND_FLOOR, (object) => this.objectSprite(object), {
      exit: () => void this.leave(),
      save: (thenExit) => void this.save(thenExit),
      undo: () => this.undo(),
      redo: () => this.redo(),
      snap: (step) => {
        this.snap = step;
      },
      lights: (on) => this.setLit(on),
      tool: (item) => this.setTool(item),
      mode: (mode) => this.setMode(mode),
      layer: (id, visible) => this.setLayer(id, visible),
      edit: (field, value) => this.edit(field, value),
      prop: (key, value) => this.setProp(key, value),
      action: (name) => {
        if (name === 'delete') this.removeSelection();
        else if (name === 'duplicate') this.duplicateSelection();
        else if (name === 'fit') this.fit();
        else if (name === 'front' || name === 'back') this.reorder(name);
        else if (name === 'addPoint') this.setTool({ kind: 'patrol' });
        else if (name === 'dropPoint') this.dropPatrolPoint();
        else this.flip(name === 'flipX');
      },
    });

    this.fit();
    const onKey = (e: KeyboardEvent): void => this.key(e);
    const onUnload = (e: BeforeUnloadEvent): void => {
      if (this.model.dirty) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    this.input.on('pointerdown', this.pointerDown, this);
    this.input.on('pointermove', this.pointerMove, this);
    this.input.on('pointerup', this.pointerUp, this);
    this.input.on('pointerupoutside', this.pointerUp, this);
    this.input.on('wheel', this.wheel, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
      this.input.off('pointerdown', this.pointerDown, this);
      this.input.off('pointermove', this.pointerMove, this);
      this.input.off('pointerup', this.pointerUp, this);
      this.input.off('pointerupoutside', this.pointerUp, this);
      this.input.off('wheel', this.wheel, this);
      this.ui?.destroy();
      this.ui = null;
      for (const lamp of this.lamps.values()) if (this.textures.exists(lamp.key)) this.textures.remove(lamp.key);
      this.lamps.clear();
      this.ready = false;
    });
    this.ready = true;
    this.ensureAssets();
    // accès depuis la console, pour le débogage et les essais automatiques
    (window as unknown as { sfpeEditor: unknown }).sfpeEditor = this;
  }

  private info(sprite: string | null): SpriteInfo | null {
    return sprite ? this.sprites[sprite] ?? null : null;
  }

  private objectSprite(object: string): string | null {
    const sprite = (this.model.base.objects[object] ?? this.model.catalog.objects.get(object)?.info)?.sprite ?? null;
    return sprite && this.textures.exists(frameKey(sprite, 0)) ? sprite : null;
  }

  private entSprite(ent: Ent): string | null {
    if (ent.kind === 'mark' || ent.kind === 'floor') return null;
    if (ent.kind === 'decal') {
      const sprite = (ent.data as LevelDecal).sprite;
      return this.textures.exists(frameKey(sprite, 0)) ? sprite : null;
    }
    if (ent.category === 'light' || ent.category === 'fog') return null;
    return this.objectSprite((ent.data as LevelInstance).object);
  }

  private buildStatic(level: LevelData): void {
    this.add.rectangle(0, 0, level.width, level.height, tintOf(level.background.color)).setOrigin(0, 0).setDepth(DEPTH.background - 1);
    const bg = level.background.sprite;
    if (bg && this.textures.exists(frameKey(bg, 0))) this.add.tileSprite(0, 0, level.width, level.height, frameKey(bg, 0)).setOrigin(0, 0).setDepth(DEPTH.background);
  }

  /** Redessine toutes les pièces de mur : une image par case, comme le jeu. */
  private drawWalls(): void {
    for (const img of this.wallImgs) img.destroy();
    this.wallImgs = [];
    const visible = this.layers.get('walls') ?? true;
    for (const w of this.model.walls.walls) {
      const sprite = (this.model.base.objects[w.object] ?? WALL_OBJECTS[w.object])?.sprite ?? null;
      const sp = this.info(sprite);
      if (!sprite || !sp || !this.textures.exists(frameKey(sprite, 0))) continue;
      this.wallImgs.push(this.add.image(w.x, w.y, frameKey(sprite, 0)).setOrigin(sp.ox / sp.w, sp.oy / sp.h)
        .setDepth(w.thick ? DEPTH.wallThick : DEPTH.wallThin).setAngle(-w.angle).setScale(w.scaleX, 1).setVisible(visible));
    }
    this.wallsDrawn = this.model.walls.walls;
  }

  /** Texture répétée d'un sol, découpée dans l'image de son tileset (mêmes clés que le jeu) ; null si l'image n'est pas chargée. */
  private floorTexture(tileset: string): string | null {
    const info = this.floorInfo[tileset];
    const srcKey = `floorsrc:${tileset}`;
    if (!info || !this.textures.exists(srcKey)) return null;
    const key = `floor:${tileset}`;
    if (!this.textures.exists(key)) {
      const canvas = this.textures.createCanvas(key, info.periodW, info.periodH);
      if (!canvas) return null;
      canvas.context.drawImage(this.textures.get(srcKey).getSourceImage() as HTMLImageElement, info.srcX, info.srcY, info.periodW, info.periodH, 0, 0, info.periodW, info.periodH);
      canvas.refresh();
    }
    return key;
  }

  /**
   * Le jeu ne charge que les images des salles telles qu'elles sont : l'éditeur charge en plus les pièces de
   * mur et les textures de sol qu'aucune salle n'utilise encore, pour pouvoir les poser.
   */
  private ensureAssets(): void {
    let queued = 0;
    for (const info of Object.values(WALL_OBJECTS)) {
      const sprite = info.sprite ?? '';
      if (!this.sprites[sprite] || this.textures.exists(frameKey(sprite, 0))) continue;
      this.load.image(frameKey(sprite, 0), `assets/sprites/${sprite}/0.png`);
      queued++;
    }
    for (const [tileset, info] of Object.entries(this.floorInfo)) {
      if (this.textures.exists(`floorsrc:${tileset}`)) continue;
      this.load.image(`floorsrc:${tileset}`, `assets/${info.image}`);
      queued++;
    }
    if (queued === 0) return;
    this.load.once('complete', () => {
      if (!this.ready) return;
      this.drawWalls();
      for (const ent of this.model.ents) if (ent.kind === 'floor' && !this.visuals.get(ent.uid)?.tile) this.show(ent);
    });
    this.load.start();
  }

  // ---------- Éléments ----------

  private rank(): void {
    this.ranks.clear();
    this.model.ents.forEach((ent, i) => this.ranks.set(ent.uid, i));
  }

  private depthOf(ent: Ent): number {
    const order = (this.ranks.get(ent.uid) ?? this.model.ents.length) * DRAW_ORDER_STEP;
    if (ent.kind === 'decal') return DEPTH.decal + order;
    if (ent.kind === 'floor') return DEPTH.floor + order;
    if (ent.kind === 'mark') return TOP.marker;
    const inst = ent.data as LevelInstance;
    switch (ent.category) {
      case 'light': return TOP.light;
      case 'fog': return DEPTH.fog - 10;
      case 'door': return DEPTH.door;
      case 'window': return DEPTH.window;
      case 'npc': return DEPTH.character;
      default: return this.entSprite(ent) ? -inst.depth + order : TOP.marker;
    }
  }

  private place(img: Img, sprite: string, data: Placed, depth: number): Img {
    const sp = this.sprites[sprite];
    return img.setTexture(frameKey(sprite, 0)).setOrigin(sp.ox / sp.w, sp.oy / sp.h).setPosition(data.x, data.y).setRotation(gmAngleToRad(data.angle))
      .setScale(data.scaleX, data.scaleY).setTint(tintOf(data.tint)).setAlpha(data.alpha).setDepth(depth);
  }

  private show(ent: Ent): void {
    this.hide(ent);
    const visible = this.layers.get(ent.category) ?? true;
    const visual: Visual = { ent, img: null, marks: [], frame: null, tile: null };
    if (isFloor(ent)) {
      const floor = ent.data;
      const key = this.floorTexture(floor.tileset);
      if (key) {
        visual.tile = this.add.tileSprite(floor.x, floor.y, floor.w, floor.h, key).setOrigin(0, 0).setDepth(this.depthOf(ent)).setVisible(visible);
        visual.tile.tilePositionX = floor.phaseX ?? 0;
        visual.tile.tilePositionY = floor.phaseY ?? 0;
      } else {
        // texture pas encore chargée : un cadre en attendant
        visual.frame = this.add.rectangle(floor.x, floor.y, floor.w, floor.h, 0x5c7cfa, 0.15).setOrigin(0, 0).setStrokeStyle(2, 0x5c7cfa, 0.8).setDepth(DEPTH.floor + 1).setVisible(visible);
      }
      this.visuals.set(ent.uid, visual);
      return;
    }
    if (isMark(ent)) {
      // repère du scénario : un cadre, un cercle ou un losange, avec son nom
      const mark = ent.data;
      const color = 0xf783ac;
      if (mark.w !== undefined && mark.h !== undefined) {
        visual.frame = this.add.rectangle(mark.x, mark.y, mark.w, mark.h, color, 0.06).setOrigin(0, 0).setStrokeStyle(4, color, 0.9).setDepth(TOP.marker - 1);
        visual.marks.push(this.label(mark.x + mark.w / 2, mark.y + 24, markName(mark.path), '#f783ac'));
      } else {
        if (mark.radius !== undefined) visual.frame = this.add.circle(mark.x, mark.y, mark.radius, color, 0.08).setStrokeStyle(4, color, 0.9).setDepth(TOP.marker - 1);
        visual.marks.push(this.add.rectangle(mark.x, mark.y, 18, 18, color, 1).setStrokeStyle(3, 0x10131c).setAngle(45).setDepth(TOP.marker));
        visual.marks.push(this.label(mark.x, mark.y + 24, markName(mark.path), '#f783ac'));
      }
      visual.frame?.setVisible(visible);
      for (const m of visual.marks) m.setVisible(visible);
      this.visuals.set(ent.uid, visual);
      return;
    }
    const sprite = this.entSprite(ent);
    const data = ent.data as Placed;
    if (sprite) {
      const frame = ent.kind === 'decal' ? Math.min((data as LevelDecal).frame, this.sprites[sprite].frames - 1) : 0;
      visual.img = this.place(this.add.image(0, 0, frameKey(sprite, 0)), sprite, data, this.depthOf(ent)).setFrame(0).setTexture(frameKey(sprite, Math.max(0, frame)));
      // un objet que le jeu ne dessine pas (repère de l'éditeur d'origine) : montré, en transparence
      if (ent.kind === 'instance' && this.model.base.objects[(data as LevelInstance).object]?.visible === false) visual.img.setAlpha(0.5);
      // une zone étirée sur une partie de la carte (sortie du niveau) : en transparence, pour voir dessous
      if (this.zoneLike(ent)) visual.img.setAlpha(0.25);
      if (ent.category === 'marker') {
        const object = (data as LevelInstance).object;
        visual.marks.push(this.label(data.x, data.y + 30, MARKER_LABELS[object] ?? object.replace(/^obj_/, ''), '#ffd43b'));
      }
    } else if (ent.category === 'light') {
      const p = (data as LevelInstance).props;
      const color = tintOf(lampColor(Number(p.hue ?? 0), Number(p.sat ?? 0)));
      visual.marks.push(this.add.circle(data.x, data.y, 15, color, 1).setStrokeStyle(3, 0x10131c).setDepth(TOP.light));
      visual.marks.push(this.add.circle(data.x, data.y, 5, 0x10131c, 1).setDepth(TOP.light + 1));
    } else if (ent.category === 'fog') {
      const inst = data as LevelInstance;
      visual.frame = this.add.rectangle(inst.x, inst.y, 64 * inst.scaleX, 64 * inst.scaleY, 0x8fb4ff, 0.07).setOrigin(0, 0).setStrokeStyle(4, 0x8fb4ff, 0.8).setDepth(DEPTH.fog - 10);
      const n = inst.props.warFogNumber ?? (inst.props.attachedWarFogNumber !== null && inst.props.attachedWarFogNumber !== undefined ? `→ ${String(inst.props.attachedWarFogNumber)}` : '');
      visual.marks.push(this.label(inst.x + 32 * inst.scaleX, inst.y + 32 * inst.scaleY, `fog ${String(n)}`, '#8fb4ff'));
    } else {
      const inst = data as LevelInstance;
      visual.marks.push(this.add.rectangle(inst.x, inst.y, 22, 22, 0xffd43b, 1).setStrokeStyle(3, 0x10131c).setAngle(45).setDepth(TOP.marker));
      visual.marks.push(this.label(inst.x, inst.y + 26, MARKER_LABELS[inst.object] ?? inst.object.replace(/^obj_/, ''), '#ffd43b'));
    }
    visual.img?.setVisible(visible);
    visual.frame?.setVisible(visible);
    for (const m of visual.marks) m.setVisible(visible);
    this.visuals.set(ent.uid, visual);
  }

  private label(x: number, y: number, text: string, color: string): Phaser.GameObjects.Text {
    return this.add.text(x, y, text, { fontFamily: 'monospace', fontSize: '15px', color, stroke: '#10131c', strokeThickness: 4 }).setOrigin(0.5).setDepth(TOP.marker + 1);
  }

  private hide(ent: Ent): void {
    const visual = this.visuals.get(ent.uid);
    if (!visual) return;
    visual.img?.destroy();
    visual.frame?.destroy();
    visual.tile?.destroy();
    for (const m of visual.marks) m.destroy();
    this.visuals.delete(ent.uid);
  }

  /** Rectangle d'un élément qui en est un (sol, zone de brouillard) : on le redimensionne par ses poignées. */
  private rectOf(ent: Ent, data: EntData = ent.data): Rect | null {
    if (ent.kind === 'floor') {
      const f = data as LevelFloor;
      return { x: f.x, y: f.y, w: f.w, h: f.h };
    }
    if (ent.category === 'fog') {
      const i = data as LevelInstance;
      return { x: i.x, y: i.y, w: 64 * i.scaleX, h: 64 * i.scaleY };
    }
    if (ent.kind === 'mark') {
      const m = data as Mark;
      return m.w !== undefined && m.h !== undefined ? { x: m.x, y: m.y, w: m.w, h: m.h } : null;
    }
    return null;
  }

  private withRect(ent: Ent, data: EntData, r: Rect): EntData {
    if (ent.kind === 'floor') return { ...(data as LevelFloor), x: r.x, y: r.y, w: r.w, h: r.h };
    if (ent.kind === 'mark') return { ...(data as Mark), x: r.x, y: r.y, w: r.w, h: r.h };
    return { ...(data as LevelInstance), x: r.x, y: r.y, scaleX: r.w / 64, scaleY: r.h / 64 };
  }

  /** Contour d'un élément, en coordonnées de la carte : sert à le désigner et à l'encadrer. */
  private outline(ent: Ent, data: EntData = ent.data): Point[] {
    const rect = this.rectOf(ent, data);
    if (rect) return [{ x: rect.x, y: rect.y }, { x: rect.x + rect.w, y: rect.y }, { x: rect.x + rect.w, y: rect.y + rect.h }, { x: rect.x, y: rect.y + rect.h }];
    const placed = data as Placed;
    const sp = this.info(this.entSprite(ent));
    if (sp) {
      const angle = gmAngleToRad(placed.angle);
      return [[0, 0], [sp.w, 0], [sp.w, sp.h], [0, sp.h]].map(([px, py]) => localToWorld(placed.x, placed.y, angle, (px - sp.ox) * placed.scaleX, (py - sp.oy) * placed.scaleY));
    }
    const r = 20 / this.zoom;
    return [{ x: data.x - r, y: data.y - r }, { x: data.x + r, y: data.y - r }, { x: data.x + r, y: data.y + r }, { x: data.x - r, y: data.y + r }];
  }

  /** Élément qui couvre une partie de la carte (brouillard, zone de sortie) : il se retouche en mode Zones. */
  private zoneLike(ent: Ent): boolean {
    if (ent.category === 'fog') return true;
    if (ent.category !== 'marker' || ent.kind !== 'instance') return false;
    const inst = ent.data as LevelInstance;
    return Math.max(Math.abs(inst.scaleX), Math.abs(inst.scaleY)) > 3;
  }

  private pickable(ent: Ent): boolean {
    if (!EDITABLE.has(ent.category) || !MODE_PICKS[this.mode].includes(ent.category) || !(this.layers.get(ent.category) ?? true)) return false;
    return this.zoneLike(ent) === (this.mode === 'zones');
  }

  /**
   * Le point est-il sur l'élément ? Les rectangles des repères du scénario se recouvrent presque tous (plateau,
   * salons, parkings) : on les attrape par leur bord, ou par l'intérieur une fois sélectionnés.
   */
  private hits(ent: Ent, x: number, y: number): boolean {
    const rect = ent.kind === 'mark' && !this.selection.includes(ent) ? this.rectOf(ent) : null;
    if (!rect) return inside(this.outline(ent), x, y);
    const reach = 12 / this.zoom;
    const within = x >= rect.x - reach && x <= rect.x + rect.w + reach && y >= rect.y - reach && y <= rect.y + rect.h + reach;
    const deep = x > rect.x + reach && x < rect.x + rect.w - reach && y > rect.y + reach && y < rect.y + rect.h - reach;
    return within && !deep;
  }

  /** Éléments retouchables sous un point, celui du dessus d'abord ; à profondeur égale, le plus petit. */
  private under(x: number, y: number): Ent[] {
    const hits: { ent: Ent; depth: number; area: number; order: number }[] = [];
    this.model.ents.forEach((ent, order) => {
      if (!this.pickable(ent) || !this.hits(ent, x, y)) return;
      const corners = this.outline(ent);
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      hits.push({ ent, depth: this.depthOf(ent), area: (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys)), order });
    });
    return hits.sort((a, b) => b.depth - a.depth || a.area - b.area || b.order - a.order).map((h) => h.ent);
  }

  // ---------- Modifications ----------

  private changed(changes: Change[]): void {
    this.rank();
    for (const change of changes) {
      if (change.ent.data && this.model.ents.includes(change.ent)) this.show(change.ent);
      else this.hide(change.ent);
    }
    // un élément ajouté, retiré ou passé devant décale le rang des autres
    for (const visual of this.visuals.values()) (visual.img ?? visual.tile)?.setDepth(this.depthOf(visual.ent));
    const wallsChanged = this.model.walls.walls !== this.wallsDrawn;
    if (wallsChanged) this.drawWalls();
    this.selection = this.selection.filter((ent) => this.model.ents.includes(ent));
    if (this.hover && !this.model.ents.includes(this.hover)) this.hover = null;
    this.ui?.setSelection(this.selection);
    // l'aperçu de l'éclairage : une lampe modifiée est redessinée tout de suite ; un autre élément a pu
    // déplacer une ombre, tout est alors recalculé un instant plus tard
    if (wallsChanged || changes.some((c) => c.ent.category !== 'light')) {
      this.litStale = true;
      this.rebuildAt = this.time.now + 350;
    } else if (this.lit && !this.litStale) {
      for (const change of changes) this.bakeLamp(change.ent);
    } else {
      this.litStale = true;
    }
  }

  /** L'élément déplacé de (dx, dy) ; la patrouille d'un personnage le suit. */
  private shifted(ent: Ent, data: EntData, dx: number, dy: number): EntData {
    const moved = { ...data, x: data.x + dx, y: data.y + dy };
    if (ent.category !== 'npc' || ent.kind !== 'instance') return moved;
    const points = patrolPoints(data as LevelInstance);
    return points.length === 0 ? moved : withPatrol(moved as LevelInstance, points.map((p) => ({ x: p.x + dx, y: p.y + dy })));
  }

  private dropPatrolPoint(): void {
    const ent = this.selection[0];
    if (!ent || this.selection.length !== 1 || !isInstance(ent)) return;
    const points = patrolPoints(ent.data);
    if (points.length === 0) return;
    this.mutate([ent], (d) => withPatrol(d as LevelInstance, points.slice(0, -1)));
  }

  /** Réglage quelconque de l'instance sélectionnée (section « All settings » du panneau). */
  private setProp(key: string, value: unknown): void {
    const ent = this.selection[0];
    if (!ent || this.selection.length !== 1 || !isInstance(ent)) return;
    this.mutate([ent], (d) => ({ ...(d as LevelInstance), props: { ...(d as LevelInstance).props, [key]: value } }));
    this.ui?.rebuild(this.selection);
  }

  private mutate(ents: Ent[], next: (data: EntData, ent: Ent) => EntData, mergeKey: string | null = null): void {
    this.model.apply(ents.map((ent) => ({ ent, before: ent.data, after: next(ent.data, ent) })), mergeKey);
  }

  private select(ents: Ent[]): void {
    this.selection = ents;
    this.ui?.setSelection(ents);
    // le prochain bouton posé ouvrira la porte à bouton que l'on vient de choisir
    const door = ents.length === 1 && isInstance(ents[0]) && ents[0].data.object === 'obj_door' ? Number(ents[0].data.props.doorId) : NaN;
    if (Number.isFinite(door)) this.lastDoorId = door;
  }

  private undo(): void {
    if (!this.model.undo()) this.ui?.toast('Nothing to undo');
  }

  private redo(): void {
    if (!this.model.redo()) this.ui?.toast('Nothing to redo');
  }

  private removeSelection(): void {
    // les repères du scénario sont en nombre fixe : le code du jeu les attend tous
    const ents = this.selection.filter((ent) => ent.kind !== 'mark');
    if (ents.length < this.selection.length) this.ui?.toast('Script landmarks can be moved, not deleted.');
    if (ents.length === 0) return;
    this.model.apply(ents.map((ent) => ({ ent, before: ent.data, after: null })));
  }

  private duplicateSelection(): void {
    if (this.selection.some((ent) => ent.kind === 'mark')) return;
    if (this.selection.length === 0) return;
    const step = this.snap > 1 ? Math.max(this.snap, 32) : 32;
    const copies = this.selection.map((ent) => this.model.duplicate(ent, step, step));
    this.model.apply(copies.map((ent) => ({ ent, before: null, after: ent.data })));
    this.select(copies);
  }

  private reorder(where: 'front' | 'back'): void {
    if (this.selection.length === 0) return;
    if (!this.model.reorder(this.selection, where)) this.ui?.toast(where === 'front' ? 'Already in front' : 'Already at the back');
  }

  private flip(horizontal: boolean): void {
    this.mutate(this.selection, (d, ent) => {
      if (ent.kind === 'floor' || ent.kind === 'mark') return d;
      const placed = d as Placed;
      return horizontal ? { ...placed, scaleX: -placed.scaleX } : { ...placed, scaleY: -placed.scaleY };
    });
  }

  /** Angle « utile » d'un élément : la direction du faisceau pour un projecteur, son orientation sinon ; null s'il n'en a pas. */
  private angleOf(ent: Ent, data: EntData = ent.data): number | null {
    if (this.rectOf(ent)) return null;
    // un repère du scénario n'a un angle que s'il en faut un (fourgon, caméra)
    if (ent.kind === 'mark') return (data as Mark).angle ?? null;
    if (ent.category !== 'light') return (data as Placed).angle;
    const cone = (data as LevelInstance).props.coneAngle;
    return cone === undefined ? null : Number(cone);
  }

  private withAngle(ent: Ent, data: EntData, angle: number): EntData {
    if (this.rectOf(ent)) return data;
    if (ent.kind === 'mark') return (data as Mark).angle === undefined ? data : { ...(data as Mark), angle: normAngle(angle) };
    if (ent.category !== 'light') return { ...(data as Placed), angle: normAngle(angle) };
    const inst = data as LevelInstance;
    return inst.props.coneAngle === undefined ? data : { ...inst, props: { ...inst.props, coneAngle: normAngle(angle) } };
  }

  /** Portes et fenêtres suivent les murs : elles tournent par quarts de tour. */
  private turnStep(categories: Category[]): number {
    return categories.length > 0 && categories.every((c) => c === 'door' || c === 'window') ? 90 : ANGLE_STEP;
  }

  /** Tourne la sélection de `deg` degrés (sens antihoraire, comme les angles du jeu) ; un groupe tourne autour de son centre. */
  private rotateSelection(deg: number): void {
    const ents = this.selection;
    if (ents.length === 0) return;
    const cx = ents.reduce((s, e) => s + e.data.x, 0) / ents.length;
    const cy = ents.reduce((s, e) => s + e.data.y, 0) / ents.length;
    const a = (deg * Math.PI) / 180;
    this.mutate(ents, (d, ent) => {
      const turned = this.withAngle(ent, d, (this.angleOf(ent, d) ?? 0) + deg);
      if (ents.length === 1) return turned;
      const dx = d.x - cx;
      const dy = d.y - cy;
      return { ...turned, x: Number((cx + dx * Math.cos(a) + dy * Math.sin(a)).toFixed(2)), y: Number((cy - dx * Math.sin(a) + dy * Math.cos(a)).toFixed(2)) };
    }, `rotate:${ents.map((e) => e.uid).join(',')}`);
  }

  private edit(field: Field, value: number | string | boolean): void {
    const ent = this.selection[0];
    if (!ent || this.selection.length !== 1) return;
    const props = (d: EntData, patch: Record<string, unknown>, drop: string[] = []): EntData => {
      const inst = d as LevelInstance;
      const next: Record<string, unknown> = { ...inst.props, ...patch };
      for (const key of drop) delete next[key];
      return { ...inst, props: next };
    };
    this.mutate([ent], (d) => {
      switch (field) {
        case 'x': case 'y': case 'scaleX': case 'scaleY': case 'alpha': return { ...d, [field]: Number(value) };
        case 'tint': return { ...d, tint: String(value) };
        case 'angle': return this.withAngle(ent, d, Number(value));
        case 'bulletCrossed': return props(d, { bulletCrossed: value === true });
        case 'shadow': return Number(value) > 0 ? props(d, { shadow: Number(value) }) : props(d, {}, ['shadow']);
        case 'radius':
          if (ent.kind === 'mark') return { ...(d as Mark), radius: Math.max(20, Number(value)) };
          return { ...props(d, { radius: Number(value) }), scaleX: Number(value) / 150, scaleY: Number(value) / 150 };
        case 'intensity': return props(d, { lightIntensity: Number(value) });
        case 'color': return props(d, { ...colorToLamp(String(value)) });
        case 'spot': return value === true ? props(d, { coneAngle: 0, coneHalf: 25 }) : props(d, {}, ['coneAngle', 'coneHalf']);
        case 'coneHalf': return props(d, { coneHalf: Number(value) });
        case 'w': case 'h': {
          const side = Math.max(MIN_SIDE, Number(value));
          if (ent.kind === 'floor') return { ...d, [field]: side };
          const r = this.rectOf(ent, d);
          return r ? this.withRect(ent, d, field === 'w' ? { ...r, w: side } : { ...r, h: side }) : d;
        }
        case 'patrolType': return props(d, { patrolType: String(value) });
        case 'fogNumber': return props(d, { warFogNumber: value === '' ? null : Number(value) });
        case 'fogAttached': return props(d, { attachedWarFogNumber: value === '' ? null : Number(value) });
        case 'phaseX': case 'phaseY': return { ...d, [field]: Number(value) };
        case 'tileset': return { ...(d as LevelFloor), tileset: String(value), object: String(value).replace(/^til_sol_/, 'obj_textureGenerator_') };
        case 'doorId': return props(d, { doorId: Number(value) });
        case 'blockedOpen': return props(d, { blockedOpen: value === true });
        default: return d;
      }
    }, `${ent.uid}:${field}`);
    // le projecteur a des réglages que la lampe n'a pas : le panneau change
    if (field === 'spot' || field === 'tileset') this.ui?.rebuild(this.selection);
    if (field === 'doorId' && isInstance(ent) && ent.data.object === 'obj_door') this.lastDoorId = Number(value);
  }

  // ---------- Outil de pose ----------

  private setMode(mode: Mode): void {
    if (mode === this.mode) return;
    this.setTool(null);
    this.select([]);
    this.hover = null;
    this.mode = mode;
    this.ui?.setMode(mode);
    // le brouillard recouvre la carte : masqué d'ordinaire, montré quand on vient le retoucher
    for (const [wanted, layer] of [['zones', 'fog'], ['script', 'script']] as const) {
      if (mode !== wanted || (this.layers.get(layer) ?? true)) continue;
      this.setLayer(layer, true);
      this.ui?.checkLayer(layer, true);
    }
  }

  private setTool(item: PaletteItem | null): void {
    this.tool = item;
    this.ghost?.destroy();
    this.ghost = null;
    this.ghostAngle = 0;
    this.ui?.setTool(item);
    if (!item) return;
    // ajouter des points de patrouille : le personnage reste sélectionné
    if (item.kind !== 'patrol') this.select([]);
    const sprite = item.kind === 'object' ? this.objectSprite(item.object) : item.kind === 'decal' ? item.sprite : null;
    if (sprite && this.textures.exists(frameKey(sprite, 0))) this.ghost = this.add.image(0, 0, frameKey(sprite, 0)).setDepth(TOP.overlay - 1);
  }

  /** Numéros de porte déjà pris dans la salle (portes à bouton et boutons). */
  private doorIds(): number[] {
    return this.model.ents.filter(isInstance).map((e) => Number(e.data.props.doorId)).filter((n) => Number.isFinite(n) && n >= 0);
  }

  private newEnt(item: PaletteItem, at: Point): Ent | null {
    if (item.kind === 'object') {
      const ent = this.model.makeInstance(item.object, at.x, at.y, this.ghostAngle);
      if (!ent || !isInstance(ent)) return ent;
      // une porte à bouton neuve prend un numéro libre ; un bouton neuf ouvre la dernière porte posée ou choisie
      if (item.object === 'obj_door') {
        this.lastDoorId = Math.max(0, ...this.doorIds()) + 1;
        ent.data = { ...ent.data, props: { ...ent.data.props, doorId: this.lastDoorId } };
      } else if (item.object === 'obj_button') {
        ent.data = { ...ent.data, props: { ...ent.data.props, doorId: this.lastDoorId ?? Math.max(0, ...this.doorIds()) } };
      }
      return ent;
    }
    if (item.kind === 'decal') return this.model.makeDecal(item.sprite, at.x, at.y, this.ghostAngle);
    if (item.kind !== 'light') return null;
    const props = lightProps(item.spot);
    if (item.spot) props.coneAngle = this.ghostAngle;
    return this.model.makeInstance(LIGHT_OBJECT, at.x, at.y, 0, props);
  }

  private placeAt(at: Point): void {
    if (!this.tool) return;
    const ent = this.newEnt(this.tool, at);
    if (!ent) {
      this.ui?.toast('This element cannot be placed in this room.', true);
      return;
    }
    // une porte ou une fenêtre s'ouvre dans le mur : les pièces qu'elle recouvre sont retirées du même geste
    let walls: LevelWall[] | null = null;
    if ((ent.category === 'door' || ent.category === 'window') && isInstance(ent) && ent.data.object !== 'obj_button') {
      const corners = this.outline(ent);
      const xs = corners.map((c) => c.x);
      const ys = corners.map((c) => c.y);
      walls = editWalls(this.model.walls.walls, { erase: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } });
    }
    this.model.apply([{ ent, before: null, after: ent.data }], null, walls);
    this.select([ent]);
  }

  // ---------- Souris ----------

  private worldPoint(p: Phaser.Input.Pointer): Point {
    const { width, height } = this.scale;
    return { x: this.camX + (p.x - width / 2) / this.zoom, y: this.camY + (p.y - height / 2) / this.zoom };
  }

  private snapped(v: number, free: boolean): number {
    return free || this.snap <= 1 ? Math.round(v) : Math.round(v / this.snap) * this.snap;
  }

  private altDown(): boolean {
    return Keys.isDown('AltLeft', 'AltRight');
  }

  /** Poignées de redimensionnement de l'élément seul sélectionné, si c'est un rectangle : coins et milieux des côtés. */
  private resizeHandles(): { ent: Ent; hx: number; hy: number; x: number; y: number }[] {
    const ent = this.selection[0];
    if (this.selection.length !== 1 || !ent || this.tool) return [];
    const r = this.rectOf(ent);
    if (!r) return [];
    const handles: { ent: Ent; hx: number; hy: number; x: number; y: number }[] = [];
    for (const hx of [-1, 0, 1]) for (const hy of [-1, 0, 1]) if (hx !== 0 || hy !== 0) handles.push({ ent, hx, hy, x: r.x + ((hx + 1) / 2) * r.w, y: r.y + ((hy + 1) / 2) * r.h });
    return handles;
  }

  /** Poignée de rotation de l'élément seul sélectionné : un rond au bout d'un trait, dans la direction de son angle. */
  private handle(): { ent: Ent; x: number; y: number } | null {
    const ent = this.selection[0];
    if (this.selection.length !== 1 || !ent || this.tool) return null;
    const angle = this.angleOf(ent);
    if (angle === null) return null;
    const corners = this.outline(ent);
    const reach = ent.category === 'light' ? 90 / this.zoom : Math.max(...corners.map((c) => Math.hypot(c.x - ent.data.x, c.y - ent.data.y))) + 34 / this.zoom;
    const a = gmAngleToRad(angle);
    return { ent, x: ent.data.x + Math.cos(a) * reach, y: ent.data.y + Math.sin(a) * reach };
  }

  private pointerDown(p: Phaser.Input.Pointer): void {
    if (!this.ready || this.busy) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    const at = this.worldPoint(p);
    if (p.rightButtonDown() || p.middleButtonDown() || Keys.isDown('Space')) {
      this.drag = { kind: 'pan', x: p.x, y: p.y, camX: this.camX, camY: this.camY, moved: false };
      return;
    }
    if (!p.leftButtonDown()) return;
    const shift = p.event.shiftKey;
    if (this.tool?.kind === 'wall') {
      this.drag = this.tool.tool === 'erase' ? { kind: 'erase', from: at, to: at } : { kind: 'wall', thick: this.tool.tool === 'thick', from: at, to: at };
      return;
    }
    if (this.tool?.kind === 'floor' || this.tool?.kind === 'fog') {
      const from = { x: this.snapped(at.x, p.event.altKey), y: this.snapped(at.y, p.event.altKey) };
      this.drag = this.tool.kind === 'fog' ? { kind: 'fog', from, to: from } : { kind: 'floor', tileset: this.tool.tileset, from, to: from };
      return;
    }
    if (this.tool?.kind === 'patrol') {
      // chaque clic ajoute un point à la patrouille du personnage sélectionné
      const ent = this.selection[0];
      if (!ent || !isInstance(ent) || ent.category !== 'npc') {
        this.setTool(null);
        return;
      }
      const point = { x: this.snapped(at.x, p.event.altKey), y: this.snapped(at.y, p.event.altKey) };
      this.mutate([ent], (d) => {
        const inst = withPatrol(d as LevelInstance, [...patrolPoints(d as LevelInstance), point]);
        return { ...inst, props: { ...inst.props, patrolType: 'points' } };
      });
      return;
    }
    if (this.tool) {
      this.placeAt({ x: this.snapped(at.x, p.event.altKey), y: this.snapped(at.y, p.event.altKey) });
      return;
    }
    const sole = this.selection.length === 1 ? this.selection[0] : null;
    if (sole && isInstance(sole) && sole.category === 'npc') {
      // un point de patrouille se déplace par son rond
      const index = patrolPoints(sole.data).findIndex((pt) => Math.hypot(at.x - pt.x, at.y - pt.y) < 12 / this.zoom);
      if (index >= 0) {
        this.drag = { kind: 'point', ent: sole, before: sole.data, index };
        return;
      }
    }
    const grip = this.resizeHandles().find((h) => Math.abs(at.x - h.x) < 10 / this.zoom && Math.abs(at.y - h.y) < 10 / this.zoom);
    if (grip) {
      this.drag = { kind: 'resize', ent: grip.ent, before: grip.ent.data, hx: grip.hx, hy: grip.hy };
      return;
    }
    const handle = this.handle();
    if (handle && Math.hypot(at.x - handle.x, at.y - handle.y) < 14 / this.zoom) {
      this.drag = { kind: 'rotate', ent: handle.ent, before: handle.ent.data };
      return;
    }
    const stack = this.under(at.x, at.y);
    const top = stack.find((e) => this.selection.includes(e)) ?? stack[0];
    if (!top) {
      this.drag = { kind: 'box', from: at, to: at, add: shift };
      return;
    }
    let cycle: Ent[] | null = null;
    if (shift) {
      this.select(this.selection.includes(top) ? this.selection.filter((e) => e !== top) : [...this.selection, top]);
      if (!this.selection.includes(top)) return;
    } else if (!this.selection.includes(top)) {
      this.select([top]);
    } else if (this.selection.length === 1 && stack.length > 1) {
      // déjà sélectionné : un clic sans déplacement passera à l'élément du dessous
      cycle = stack;
    }
    this.drag = { kind: 'move', from: at, start: new Map(this.selection.map((e) => [e, e.data])), lead: top, moved: false, cycle };
  }

  private pointerMove(p: Phaser.Input.Pointer): void {
    if (!this.ready) return;
    const at = this.worldPoint(p);
    this.cursor = at;
    const drag = this.drag;
    if (!drag) {
      this.hover = this.tool ? null : this.under(at.x, at.y)[0] ?? null;
      return;
    }
    if (drag.kind === 'pan') {
      if (Math.hypot(p.x - drag.x, p.y - drag.y) > 4) drag.moved = true;
      this.camX = drag.camX - (p.x - drag.x) / this.zoom;
      this.camY = drag.camY - (p.y - drag.y) / this.zoom;
    } else if (drag.kind === 'box' || drag.kind === 'wall' || drag.kind === 'erase') {
      drag.to = at;
    } else if (drag.kind === 'floor' || drag.kind === 'fog') {
      drag.to = { x: this.snapped(at.x, p.event.altKey), y: this.snapped(at.y, p.event.altKey) };
    } else if (drag.kind === 'point') {
      const inst = drag.before as LevelInstance;
      const points = patrolPoints(inst);
      points[drag.index] = { x: this.snapped(at.x, p.event.altKey), y: this.snapped(at.y, p.event.altKey) };
      this.preview(drag.ent, withPatrol(inst, points));
    } else if (drag.kind === 'resize') {
      const r = this.rectOf(drag.ent, drag.before);
      if (!r) return;
      // le côté saisi suit le curseur, calé sur la grille ; le côté opposé ne bouge pas
      let x0 = r.x;
      let y0 = r.y;
      let x1 = r.x + r.w;
      let y1 = r.y + r.h;
      const sx = this.snapped(at.x, p.event.altKey);
      const sy = this.snapped(at.y, p.event.altKey);
      if (drag.hx < 0) x0 = Math.min(sx, x1 - MIN_SIDE);
      if (drag.hx > 0) x1 = Math.max(sx, x0 + MIN_SIDE);
      if (drag.hy < 0) y0 = Math.min(sy, y1 - MIN_SIDE);
      if (drag.hy > 0) y1 = Math.max(sy, y0 + MIN_SIDE);
      this.preview(drag.ent, this.withRect(drag.ent, drag.before, { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }));
    } else if (drag.kind === 'move') {
      if (!drag.moved && Math.hypot(at.x - drag.from.x, at.y - drag.from.y) < 5 / this.zoom) return;
      drag.moved = true;
      // l'élément saisi se cale sur la grille ; les autres gardent leur écart avec lui
      const lead = drag.start.get(drag.lead)!;
      const free = p.event.altKey;
      const dx = this.snapped(lead.x + at.x - drag.from.x, free) - lead.x;
      const dy = this.snapped(lead.y + at.y - drag.from.y, free) - lead.y;
      for (const [ent, start] of drag.start) this.preview(ent, this.shifted(ent, start, dx, dy));
    } else {
      const d = drag.before;
      let angle = (Math.atan2(-(at.y - d.y), at.x - d.x) * 180) / Math.PI;
      const step = this.turnStep([drag.ent.category]);
      if (!p.event.altKey || step === 90) angle = Math.round(angle / step) * step;
      this.preview(drag.ent, this.withAngle(drag.ent, d, angle));
    }
  }

  /** Pendant un glisser : l'élément est montré à sa nouvelle place, l'historique n'est écrit qu'au relâcher. */
  private preview(ent: Ent, data: EntData): void {
    ent.data = data;
    this.show(ent);
  }

  private pointerUp(p: Phaser.Input.Pointer): void {
    const drag = this.drag;
    this.drag = null;
    if (!drag || !this.ready) return;
    if (drag.kind === 'pan') {
      // clic droit sans déplacement : on lâche l'outil de pose
      if (!drag.moved && this.tool) this.setTool(null);
    } else if (drag.kind === 'box') {
      const x0 = Math.min(drag.from.x, drag.to.x);
      const x1 = Math.max(drag.from.x, drag.to.x);
      const y0 = Math.min(drag.from.y, drag.to.y);
      const y1 = Math.max(drag.from.y, drag.to.y);
      if (x1 - x0 < 5 / this.zoom && y1 - y0 < 5 / this.zoom) {
        if (!drag.add) this.select([]);
        return;
      }
      const hit = this.model.ents.filter((e) => this.pickable(e) && e.data.x >= x0 && e.data.x <= x1 && e.data.y >= y0 && e.data.y <= y1);
      this.select(drag.add ? [...new Set([...this.selection, ...hit])] : hit);
    } else if (drag.kind === 'wall') {
      // un trait droit de cases, de l'épaisseur choisie
      const cells = lineCells(drag.thick, drag.from, drag.to);
      this.model.apply([], null, editWalls(this.model.walls.walls, { add: { thick: drag.thick, cells } }));
    } else if (drag.kind === 'erase') {
      const erase = { x0: Math.min(drag.from.x, drag.to.x), y0: Math.min(drag.from.y, drag.to.y), x1: Math.max(drag.from.x, drag.to.x), y1: Math.max(drag.from.y, drag.to.y) };
      this.model.apply([], null, editWalls(this.model.walls.walls, { erase }));
    } else if (drag.kind === 'floor' || drag.kind === 'fog') {
      const x = Math.min(drag.from.x, drag.to.x);
      const y = Math.min(drag.from.y, drag.to.y);
      const w = Math.abs(drag.to.x - drag.from.x);
      const h = Math.abs(drag.to.y - drag.from.y);
      if (w < MIN_SIDE || h < MIN_SIDE) {
        this.ui?.toast(drag.kind === 'fog' ? 'Drag a rectangle over the room to hide.' : 'Drag a rectangle to lay the floor.');
        return;
      }
      const ent = drag.kind === 'fog' ? this.model.makeFog(x, y, w, h) : this.model.makeFloor(drag.tileset, x, y, w, h);
      if (!ent) {
        this.ui?.toast('No fog zone to copy from in the game rooms.', true);
        return;
      }
      this.model.apply([{ ent, before: null, after: ent.data }]);
      // le sol est posé : on lâche la texture, pour le déplacer ou le redimensionner tout de suite
      this.setTool(null);
      this.select([ent]);
    } else if (drag.kind === 'move') {
      if (!drag.moved) {
        if (drag.cycle && !p.event.shiftKey) this.select([drag.cycle[(drag.cycle.indexOf(drag.lead) + 1) % drag.cycle.length]]);
        return;
      }
      const changes = [...drag.start].map(([ent, before]) => ({ ent, before, after: ent.data }));
      for (const c of changes) c.ent.data = c.before;
      this.model.apply(changes);
    } else {
      const after = drag.ent.data;
      drag.ent.data = drag.before;
      this.model.apply([{ ent: drag.ent, before: drag.before, after }]);
    }
  }

  private wheel(p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number): void {
    if (!this.ready) return;
    const before = this.worldPoint(p);
    this.zoom = Phaser.Math.Clamp(this.zoom * (dy > 0 ? ZOOM.step : 1 / ZOOM.step), ZOOM.min, ZOOM.max);
    // le point sous le curseur reste sous le curseur
    const after = this.worldPoint(p);
    this.camX += before.x - after.x;
    this.camY += before.y - after.y;
  }

  private fit(): void {
    const { width, height } = this.scale;
    const level = this.model.base;
    // la carte entière, entre les deux panneaux
    this.zoom = Phaser.Math.Clamp(Math.min((width - 620) / level.width, (height - 120) / level.height), ZOOM.min, ZOOM.max);
    this.camX = level.width / 2;
    this.camY = level.height / 2;
  }

  // ---------- Clavier ----------

  private key(e: KeyboardEvent): void {
    if (!this.ready || this.busy || EditorUi.typing()) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    const done = (): void => e.preventDefault();
    if (ctrl && k === 'z') {
      if (e.shiftKey) this.redo();
      else this.undo();
      return done();
    }
    if (ctrl && k === 'y') {
      this.redo();
      return done();
    }
    if (ctrl && k === 's') {
      void this.save(false);
      return done();
    }
    if (ctrl && k === 'd') {
      this.duplicateSelection();
      return done();
    }
    if (ctrl) return;
    if (k === 'escape') {
      if (this.tool) this.setTool(null);
      else if (this.selection.length > 0) this.select([]);
      else void this.leave();
      return done();
    }
    if (k === 'delete' || k === 'backspace') {
      this.removeSelection();
      return done();
    }
    if (k === 'r') {
      // sens horaire à l'écran, Maj pour l'autre sens ; Alt : au degré près
      const placing = this.tool?.kind === 'object' ? this.model.catalog.objects.get(this.tool.object)?.category : undefined;
      const step = this.turnStep(this.tool ? (placing ? [placing] : []) : this.selection.map((s) => s.category));
      const deg = (e.altKey && step !== 90 ? 1 : step) * (e.shiftKey ? 1 : -1);
      if (this.tool) this.ghostAngle = normAngle(this.ghostAngle + deg);
      else this.rotateSelection(deg);
      return done();
    }
    if (k === 'f' || k === 'b') {
      this.reorder(k === 'f' ? 'front' : 'back');
      return done();
    }
    if (k === 'g') {
      if (this.snap > 1) {
        this.snapBefore = this.snap;
        this.snap = 1;
      } else {
        this.snap = this.snapBefore;
      }
      this.ui?.setSnap(this.snap);
      return done();
    }
    if (k === 'l') {
      this.ui?.setLights(!this.lit, true);
      return done();
    }
    if (k === '0') return this.fit();
    if (k === '1') {
      this.zoom = 1;
      return;
    }
    const arrows: Record<string, [number, number]> = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
    if (arrows[k] && this.selection.length > 0) {
      const n = e.shiftKey ? 10 : 1;
      this.mutate(this.selection, (d, ent) => this.shifted(ent, d, arrows[k][0] * n, arrows[k][1] * n), `nudge:${this.selection.map((s) => s.uid).join(',')}`);
      done();
    }
  }

  // ---------- Couches ----------

  private setLayer(id: LayerId, visible: boolean): void {
    this.layers.set(id, visible);
    if (id === 'walls') for (const img of this.wallImgs) img.setVisible(visible);
    else {
      for (const visual of this.visuals.values()) {
        if (visual.ent.category !== id) continue;
        visual.img?.setVisible(visible);
        visual.frame?.setVisible(visible);
        visual.tile?.setVisible(visible);
        for (const m of visual.marks) m.setVisible(visible);
      }
      if (!visible) this.select(this.selection.filter((e) => e.category !== id));
    }
  }

  // ---------- Aperçu de l'éclairage ----------

  private setLit(on: boolean): void {
    this.lit = on;
    if (on && this.litStale) this.rebuildLights();
    this.darkness?.setVisible(on);
    for (const lamp of this.lamps.values()) lamp.glow?.setVisible(on);
  }

  /** Recalcule tout l'aperçu : les obstacles de la salle telle qu'elle est, puis la zone éclairée de chaque lampe. */
  private rebuildLights(): void {
    this.litStale = false;
    try {
      // le même monde que le jeu construirait : murs, portes fermées et mobilier font les mêmes ombres
      this.collision = new World(this.model.toLevel(), this.sprites, 'PetBot', 1).collision;
    } catch (error) {
      this.collision = null;
      console.warn('Lighting preview without shadows:', error);
    }
    const { width, height } = this.scale;
    this.darkness ??= this.add.renderTexture(0, 0, width, height).setOrigin(0, 0).setDepth(DEPTH.darkness);
    for (const [uid, lamp] of [...this.lamps]) {
      if (!this.model.ents.some((e) => e.uid === uid)) this.dropLamp(uid, lamp);
    }
    for (const ent of this.model.ents) if (ent.category === 'light') this.bakeLamp(ent);
  }

  private dropLamp(uid: number, lamp: LampBake): void {
    lamp.stamp.destroy();
    lamp.glow?.destroy();
    if (this.textures.exists(lamp.key)) this.textures.remove(lamp.key);
    this.lamps.delete(uid);
  }

  /** Zone éclairée d'une lampe, comme `WorldView.bakeLamp` : un dégradé découpé par ce que la lampe « voit ». */
  private bakeLamp(ent: Ent): void {
    const old = this.lamps.get(ent.uid);
    if (old) this.dropLamp(ent.uid, old);
    if (!this.model.ents.includes(ent) || !isInstance(ent)) return;
    const inst = ent.data;
    const radius = lightRadius(inst);
    const intensity = Number(inst.props.lightIntensity ?? 0.5);
    const s = LIGHTING.bakeScale;
    const size = Math.ceil(radius * 2 * s) + 2;
    const key = `edlamp:${ent.uid}`;
    const texture = this.textures.createCanvas(key, size, size);
    if (!texture) return;
    const ctx = texture.context;
    const mid = size / 2;
    ctx.save();
    if (this.collision) {
      const polygon = visibilityPolygon(this.collision, inst.x, inst.y, radius, BLOCK_SIGHT, LIGHTING.wallReach);
      ctx.beginPath();
      polygon.forEach((p, i) => {
        if (i === 0) ctx.moveTo(mid + (p.x - inst.x) * s, mid + (p.y - inst.y) * s);
        else ctx.lineTo(mid + (p.x - inst.x) * s, mid + (p.y - inst.y) * s);
      });
      ctx.closePath();
      ctx.clip();
    }
    const gradient = ctx.createRadialGradient(mid, mid, 0, mid, mid, radius * s);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    if (inst.props.coneAngle !== undefined) {
      const angle = gmAngleToRad(Number(inst.props.coneAngle));
      const half = (Number(inst.props.coneHalf ?? 25) * Math.PI) / 180;
      for (const [k, alpha] of [[1, 0.4], [0.82, 0.3], [0.62, 0.3]]) {
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(mid, mid);
        ctx.arc(mid, mid, radius * s, angle - half * k, angle + half * k);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      ctx.fillRect(0, 0, size, size);
    }
    ctx.restore();
    texture.refresh();
    const sat = Number(inst.props.sat ?? 0) / 255;
    let glow: Img | null = null;
    if (sat > 0.05) {
      const color = Phaser.Display.Color.HSVToRGB(Number(inst.props.hue ?? 0) / 255, 1, 1) as Phaser.Types.Display.ColorObject;
      glow = this.add.image(inst.x, inst.y, key).setScale(1 / s).setBlendMode(Phaser.BlendModes.ADD).setTint(color.color)
        .setAlpha(Math.min(1, intensity * sat * LIGHTING.colorStrength)).setDepth(DEPTH.fog - 1).setVisible(this.lit);
    }
    this.lamps.set(ent.uid, { key, stamp: this.make.image({ key, add: false }), glow, x: inst.x, y: inst.y, radius, strength: intensity * LIGHTING.strength });
  }

  private drawDarkness(): void {
    const rt = this.darkness;
    if (!rt || !this.lit) return;
    const { width, height } = this.scale;
    const z = this.zoom;
    const left = this.camX - width / 2 / z;
    const top = this.camY - height / 2 / z;
    // le calque fait la taille de l'écran : il est posé sur la partie visible de la carte, à l'échelle inverse du zoom
    rt.setPosition(left, top).setScale(1 / z);
    rt.clear();
    rt.fill(0x000000, LIGHTING.ambient);
    if (!(this.layers.get('light') ?? true)) return;
    for (const lamp of this.lamps.values()) {
      const sx = (lamp.x - left) * z;
      const sy = (lamp.y - top) * z;
      const r = lamp.radius * z;
      if (sx < -r || sy < -r || sx > width + r || sy > height + r) continue;
      lamp.stamp.setScale(z / LIGHTING.bakeScale).setAlpha(Math.min(1, lamp.strength));
      rt.erase(lamp.stamp, sx, sy);
    }
  }

  // ---------- Image par image ----------

  update(_time: number, delta: number): void {
    if (!this.ready) return;
    const { width, height } = this.scale;
    const level = this.model.base;
    if (!EditorUi.typing() && !Keys.isDown('ControlLeft', 'ControlRight', 'MetaLeft', 'MetaRight')) {
      const speed = ((Keys.isDown('ShiftLeft', 'ShiftRight') ? 3200 : 1300) / this.zoom) * (delta / 1000);
      const idle = this.selection.length === 0;
      const held = (letter: string, arrow: string): number => (Keys.isDown(letter) || (idle && Keys.isDown(arrow)) ? 1 : 0);
      this.camX += (held('KeyD', 'ArrowRight') - held('KeyA', 'ArrowLeft')) * speed;
      this.camY += (held('KeyS', 'ArrowDown') - held('KeyW', 'ArrowUp')) * speed;
    }
    const margin = 600;
    this.camX = Phaser.Math.Clamp(this.camX, -margin, level.width + margin);
    this.camY = Phaser.Math.Clamp(this.camY, -margin, level.height + margin);
    this.cameras.main.setZoom(this.zoom).setScroll(this.camX - width / 2, this.camY - height / 2);

    // repères et étiquettes : même taille à l'écran à tous les zooms
    const k = Math.min(4, 1 / this.zoom);
    for (const visual of this.visuals.values()) for (const m of visual.marks) m.setScale(k);

    if (this.lit && this.litStale && this.time.now >= this.rebuildAt && !this.drag) this.rebuildLights();
    this.drawDarkness();
    this.drawGhost();
    this.drawOverlay();
    this.ui?.setStatus({
      dirty: this.model.dirty, canUndo: this.model.canUndo, canRedo: this.model.canRedo, zoom: this.zoom, x: this.cursor.x, y: this.cursor.y,
      hint: this.hint(),
    });
  }

  private hint(): string {
    const tool = this.tool;
    if (tool?.kind === 'wall') return tool.tool === 'erase' ? 'Drag a box over the walls to remove · Esc to stop' : 'Drag to draw a straight wall · Esc to stop';
    if (tool?.kind === 'floor') return 'Drag a rectangle to lay this floor · Esc to stop';
    if (tool?.kind === 'fog') return 'Drag a rectangle over the room to hide · Esc to stop';
    if (tool?.kind === 'patrol') return 'Click to add patrol points, in walking order · Esc to stop';
    if (tool) return 'Click to place · R rotates · Esc or right-click to stop';
    if (this.selection.length > 0) return `${this.selection.length} selected`;
    return this.mode === 'walls' ? 'Pick a wall tool on the left' : this.mode === 'floors' ? 'Click a floor, or pick a texture on the left' : this.mode === 'zones' ? 'Click a zone, or draw a new fog zone' : this.mode === 'script' ? 'Drag a landmark to move it' : '';
  }

  private drawGhost(): void {
    const ghost = this.ghost;
    if (!ghost || !this.tool) return;
    const free = this.altDown();
    const x = this.snapped(this.cursor.x, free);
    const y = this.snapped(this.cursor.y, free);
    const sprite = this.tool.kind === 'object' ? this.objectSprite(this.tool.object) : this.tool.kind === 'decal' ? this.tool.sprite : null;
    const sample = this.tool.kind === 'object' ? this.model.catalog.objects.get(this.tool.object)?.sample : this.tool.kind === 'decal' ? this.model.catalog.decals.get(this.tool.sprite) : null;
    if (!sprite || !sample) return;
    this.place(ghost, sprite, { ...(sample as Placed), x, y, angle: this.ghostAngle }, TOP.overlay - 1).setAlpha(0.6);
  }

  private drawLightShape(g: Phaser.GameObjects.Graphics, inst: LevelInstance, alpha: number): void {
    const radius = lightRadius(inst);
    const color = tintOf(lampColor(Number(inst.props.hue ?? 0), Number(inst.props.sat ?? 0)));
    g.lineStyle(2 / this.zoom, color, alpha);
    if (inst.props.coneAngle === undefined) {
      g.strokeCircle(inst.x, inst.y, radius);
      return;
    }
    const a = gmAngleToRad(Number(inst.props.coneAngle));
    const half = (Number(inst.props.coneHalf ?? 25) * Math.PI) / 180;
    g.beginPath();
    g.moveTo(inst.x, inst.y);
    g.arc(inst.x, inst.y, radius, a - half, a + half);
    g.closePath();
    g.strokePath();
  }

  private drawOverlay(): void {
    const g = this.overlay;
    const px = 1 / this.zoom;
    g.clear();
    const frame = (ent: Ent, color: number, width: number, alpha: number): void => {
      g.lineStyle(width * px, color, alpha);
      g.strokePoints(this.outline(ent).map((p) => new Phaser.Math.Vector2(p.x, p.y)), true, true);
      if (ent.category === 'light') this.drawLightShape(g, ent.data as LevelInstance, alpha);
    };
    if (this.hover && !this.selection.includes(this.hover) && !this.drag) frame(this.hover, 0xffffff, 1.5, 0.7);
    for (const ent of this.selection) frame(ent, 0xffd43b, 2.5, 1);
    const handle = this.handle();
    if (handle) {
      g.lineStyle(2 * px, 0xffd43b, 0.9);
      g.lineBetween(handle.ent.data.x, handle.ent.data.y, handle.x, handle.y);
      g.fillStyle(0xffd43b, 1).fillCircle(handle.x, handle.y, 8 * px);
      g.lineStyle(2 * px, 0x10131c, 1).strokeCircle(handle.x, handle.y, 8 * px);
    }
    if (this.tool?.kind === 'light') {
      const free = this.altDown();
      const props = lightProps(this.tool.spot);
      if (this.tool.spot) props.coneAngle = this.ghostAngle;
      const at = { x: this.snapped(this.cursor.x, free), y: this.snapped(this.cursor.y, free) };
      g.fillStyle(0xffffff, 0.8).fillCircle(at.x, at.y, 12 * px);
      this.drawLightShape(g, { x: at.x, y: at.y, scaleX: 1, props } as LevelInstance, 0.8);
    }
    // en mode sols, le contour de chaque sol : on voit où ils commencent et lesquels se recouvrent
    if (this.mode === 'floors' && (this.layers.get('floor') ?? true)) {
      g.lineStyle(1 * px, 0x66d9e8, 0.55);
      for (const ent of this.model.ents) {
        if (ent.kind !== 'floor') continue;
        const f = ent.data as LevelFloor;
        g.strokeRect(f.x, f.y, f.w, f.h);
      }
    }
    for (const grip of this.resizeHandles()) {
      g.fillStyle(0xffd43b, 1).fillRect(grip.x - 5 * px, grip.y - 5 * px, 10 * px, 10 * px);
      g.lineStyle(1.5 * px, 0x10131c, 1).strokeRect(grip.x - 5 * px, grip.y - 5 * px, 10 * px, 10 * px);
    }
    const drag = this.drag;
    if (this.tool?.kind === 'wall' && this.tool.tool !== 'erase') {
      // les cases que le trait va remplir ; au repos, celle sous le curseur
      const thick = this.tool.tool === 'thick';
      const size = cellSize(thick);
      const cells = drag?.kind === 'wall' ? lineCells(thick, drag.from, drag.to) : lineCells(thick, this.cursor, this.cursor);
      g.fillStyle(0x51cf66, drag?.kind === 'wall' ? 0.55 : 0.3);
      for (const c of cells) g.fillRect(c.cx * size, c.cy * size, size, size);
      g.lineStyle(1.5 * px, 0x51cf66, 1);
      for (const c of cells) g.strokeRect(c.cx * size, c.cy * size, size, size);
    }
    // patrouille du personnage sélectionné ou survolé : de sa place à chaque point, dans l'ordre
    for (const ent of new Set([...this.selection, ...(this.hover ? [this.hover] : [])])) {
      if (ent.category !== 'npc' || !isInstance(ent)) continue;
      const points = patrolPoints(ent.data);
      if (points.length === 0) continue;
      g.lineStyle(2 * px, 0x74c0fc, 0.9);
      g.strokePoints([ent.data, ...points].map((pt) => new Phaser.Math.Vector2(pt.x, pt.y)), false, false);
      for (const pt of points) {
        g.fillStyle(0x74c0fc, 1).fillCircle(pt.x, pt.y, 7 * px);
        g.lineStyle(1.5 * px, 0x10131c, 1).strokeCircle(pt.x, pt.y, 7 * px);
      }
    }
    if (drag?.kind === 'erase' || drag?.kind === 'floor' || drag?.kind === 'fog') {
      const color = drag.kind === 'erase' ? 0xff6b6b : drag.kind === 'fog' ? 0x8fb4ff : 0x66d9e8;
      const x = Math.min(drag.from.x, drag.to.x);
      const y = Math.min(drag.from.y, drag.to.y);
      g.fillStyle(color, 0.2).fillRect(x, y, Math.abs(drag.to.x - drag.from.x), Math.abs(drag.to.y - drag.from.y));
      g.lineStyle(1.5 * px, color, 1).strokeRect(x, y, Math.abs(drag.to.x - drag.from.x), Math.abs(drag.to.y - drag.from.y));
    }
    if (this.drag?.kind === 'box') {
      const { from, to } = this.drag;
      g.fillStyle(0x5c7cfa, 0.15).fillRect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y));
      g.lineStyle(1.5 * px, 0x5c7cfa, 1).strokeRect(Math.min(from.x, to.x), Math.min(from.y, to.y), Math.abs(to.x - from.x), Math.abs(to.y - from.y));
    }
    // limites de la salle
    g.lineStyle(2 * px, 0x5c7cfa, 0.5).strokeRect(0, 0, this.model.base.width, this.model.base.height);
  }

  // ---------- Sauvegarde et sortie ----------

  private async save(thenExit: boolean): Promise<boolean> {
    if (this.busy) return false;
    if (!this.model.dirty) {
      if (thenExit) this.scene.start('Menu');
      else this.ui?.toast('No changes to save');
      return true;
    }
    const level = this.model.toLevel();
    this.busy = true;
    this.ui?.setBusy(true);
    let note = '';
    let ok = false;
    try {
      const res = await fetch(`/api/levels/${level.name}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(level) });
      const result = (await res.json()) as { ok: boolean; summary?: string; note?: string };
      ok = result.ok;
      // le fichier est écrit, pas commité : c'est à l'utilisateur de décider quand (ADR-019)
      note = result.ok ? (result.summary ? `Saved to public/levels/${level.name}.json (not committed)` : result.note || 'Saved') : result.note || 'The server refused the level.';
    } catch (error) {
      note = `Could not reach the game server: ${error instanceof Error ? error.message : String(error)}`;
    }
    this.busy = false;
    this.ui?.setBusy(false);
    if (!ok) {
      this.ui?.toast(note, true);
      return false;
    }
    this.model.markSaved();
    // la prochaine partie lancée depuis le menu charge cette version, sans recharger la page
    this.cache.json.add(`level:${level.name}`, level);
    if (level.name === GROUND_FLOOR) useLandmarks(level.landmarks);
    if (thenExit) {
      this.registry.set('editorNote', note);
      this.scene.start('Menu');
    } else {
      this.ui?.toast(note);
    }
    return true;
  }

  private async leave(): Promise<void> {
    if (this.busy || !this.ui) return;
    if (!this.model.dirty) {
      this.scene.start('Menu');
      return;
    }
    this.busy = true;
    const choice = await this.ui.ask('This level has unsaved changes.', ['Save & exit', 'Discard changes', 'Keep editing']);
    this.busy = false;
    if (choice === 0) void this.save(true);
    else if (choice === 1) this.scene.start('Menu');
  }
}
