// Conversion d'une salle GameMaker (rooms/<nom>/<nom>.yy) vers le format de
// niveau du remake. Spécification : docs/formats-donnees.md et
// docs/reference/jeu-original/03-niveaux-et-interface.md (§2 et §7).
import fs from 'node:fs';
import path from 'node:path';
import {
  convertPropertyValue,
  objectChain,
  objectDefaultProps,
  splitColour,
  stripGmlComments,
} from './reference.ts';
import type { GmSprite, Project, PropValue } from './reference.ts';

// ---------------------------------------------------------------------------
// Format de sortie
// ---------------------------------------------------------------------------

export interface LevelBackground {
  sprite: string | null;
  color: string;
  tiled: boolean;
}

export interface LevelLayer {
  name: string;
  /** instances, tiles, assets ou background. */
  type: string;
  depth: number;
  /** Visibilité réglée dans l'éditeur (le jeu peut la changer à l'exécution). */
  visible: boolean;
}

export interface LevelObject {
  sprite: string | null;
  mask: string | null;
  parents: string[];
  visible: boolean;
}

export interface LevelInstance {
  id: string;
  object: string;
  layer: string;
  depth: number;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  tint: string;
  alpha: number;
  props: Record<string, PropValue>;
}

export interface LevelWall {
  object: string;
  thick: boolean;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
}

/** [x, y, largeur, hauteur, épais (1) ou fin (0)]. */
export type LevelWallRect = [number, number, number, number, number];

export interface LevelFloor {
  object: string;
  tileset: string;
  x: number;
  y: number;
  w: number;
  h: number;
  checkBottomTile: boolean;
  /** Décalage, en pixels, du motif répété au coin haut-gauche du rectangle. */
  phaseX: number;
  phaseY: number;
}

export interface LevelDecal {
  sprite: string;
  x: number;
  y: number;
  angle: number;
  scaleX: number;
  scaleY: number;
  tint: string;
  alpha: number;
  frame: number;
  depth: number;
}

export interface Level {
  name: string;
  width: number;
  height: number;
  background: LevelBackground;
  layers: LevelLayer[];
  objects: Record<string, LevelObject>;
  instances: LevelInstance[];
  walls: LevelWall[];
  wallRects: LevelWallRect[];
  floors: LevelFloor[];
  decals: LevelDecal[];
}

/** Paramètres d'un tileset de sol, tels que les utilise son générateur. */
export interface FloorTilesetUse {
  tileset: string;
  cellSize: number;
  cellsPerLine: number;
  cellsPerColonne: number;
}

export interface RoomConversion {
  level: Level;
  stats: {
    /** Instances non ignorées de la salle, générateurs de sol compris. */
    totalInstances: number;
    ignoredInstances: number;
    byObject: Map<string, number>;
    thickWalls: number;
    thinWalls: number;
    thickTilesNonEmpty: number;
    thinTilesNonEmpty: number;
    thickRects: number;
    thinRects: number;
    missingCreationCode: string[];
  };
  floorTilesets: FloorTilesetUse[];
  /** Sprites dont la salle a besoin (objets et parents, masques, murs, décalques, fond). */
  sprites: Set<string>;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Tables tuile → pièce de mur
// (scripts/scr_createMurEpaisInstanceFromTileCell et scr_createMurFinInstanceFromTileCell)
// ---------------------------------------------------------------------------

interface WallPiece {
  object: string;
  angle: number;
  scaleX: number;
}

const piece = (object: string, angle = 0, scaleX = 1): WallPiece => ({ object, angle, scaleX });

const THICK_PIECES: Record<number, WallPiece> = {
  1: piece('obj_mur_epais'),
  2: piece('obj_mur_epais', 90),
  3: piece('obj_mur_epais_croix'),
  4: piece('obj_mur_epais_plot'),
  5: piece('obj_mur_epais_angle'),
  6: piece('obj_mur_epais_angle', 270),
  7: piece('obj_mur_epais_angle', 180),
  8: piece('obj_mur_epais_angle', 90),
  10: piece('obj_mur_epais_bout'),
  11: piece('obj_mur_epais_bout', 270),
  12: piece('obj_mur_epais_bout', 180),
  13: piece('obj_mur_epais_bout', 90),
  15: piece('obj_mur_epais_T'),
  16: piece('obj_mur_epais_T', 270),
  17: piece('obj_mur_epais_T', 180),
  18: piece('obj_mur_epais_T', 90),
};

const THIN_PIECES: Record<number, WallPiece> = {
  1: piece('obj_mur_fin'),
  2: piece('obj_mur_fin', 90),
  3: piece('obj_mur_fin_croix'),
  4: piece('obj_mur_fin_plot'),
  5: piece('obj_mur_fin_angle'),
  6: piece('obj_mur_fin_angle', 270),
  7: piece('obj_mur_fin_bout'),
  8: piece('obj_mur_fin_bout', 180),
  9: piece('obj_mur_fin_bout', 270),
  10: piece('obj_mur_fin_angle', 90),
  11: piece('obj_mur_fin_angle', 180),
  14: piece('obj_mur_fin_bout', 90),
  15: piece('obj_mur_fin_T', 90),
  16: piece('obj_mur_fin_T'),
  17: piece('obj_mur_fin_T', 180),
  18: piece('obj_mur_fin_T', 270),
  20: piece('obj_mur_fin_45'),
  21: piece('obj_mur_fin_45', 90, -1),
  22: piece('obj_mur_fin_45', 270, -1),
  23: piece('obj_mur_fin_45', 180),
  25: piece('obj_mur_fin_45', 270),
  26: piece('obj_mur_fin_45', 0, -1),
  27: piece('obj_mur_fin_45', 180, -1),
  28: piece('obj_mur_fin_45', 90),
};

/** Couches de tuiles transformées en murs par le code de création des salles. */
const WALL_LAYERS: Record<string, { thick: boolean; grid: number; pieces: Record<number, WallPiece> }> = {
  tiles_mur_epais: { thick: true, grid: 64, pieces: THICK_PIECES },
  tiles_mur_fin: { thick: false, grid: 32, pieces: THIN_PIECES },
};

const FLOOR_GENERATOR_PREFIX = 'obj_textureGenerator_';

// ---------------------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------------------

/** `round()` de GML : arrondi au plus proche, les demis vers l'entier pair. */
export function gmRound(value: number): number {
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

/** `mod` de GML : reste du signe du dividende (comme `%` en JavaScript). */
const gmMod = (a: number, b: number) => a % b;

/** Découpe un code GML en instructions (sur `;` et fins de ligne, hors chaînes et parenthèses). */
function splitStatements(code: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote: string | null = null;
  let depth = 0;
  for (const c of code) {
    if (quote) {
      current += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      current += c;
    } else if (c === '(') {
      depth++;
      current += c;
    } else if (c === ')') {
      depth = Math.max(0, depth - 1);
      current += c;
    } else if (c === ';' || ((c === '\n' || c === '\r') && depth === 0)) {
      if (current.trim()) out.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function splitArguments(text: string): string[] {
  const out: string[] = [];
  let current = '';
  let quote: string | null = null;
  let depth = 0;
  for (const c of text) {
    if (quote) {
      current += c;
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
      current += c;
    } else if (c === '(') {
      depth++;
      current += c;
    } else if (c === ')') {
      depth--;
      current += c;
    } else if (c === ',' && depth === 0) {
      out.push(current.trim());
      current = '';
    } else {
      current += c;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/**
 * Lit un code de création d'instance : affectations simples `nom = valeur` et
 * listes `nom = ds_list_create(); ds_list_add(nom, …)`. Les instructions non
 * reconnues sont renvoyées dans `unparsed`.
 */
export function parseCreationCode(source: string): { props: Record<string, PropValue>; unparsed: string[] } {
  const props: Record<string, PropValue> = {};
  const unparsed: string[] = [];
  for (const statement of splitStatements(stripGmlComments(source))) {
    const listAdd = /^ds_list_add\(\s*([A-Za-z_]\w*)\s*,(.*)\)$/s.exec(statement);
    if (listAdd) {
      const list = Array.isArray(props[listAdd[1]]) ? (props[listAdd[1]] as PropValue[]) : [];
      for (const arg of splitArguments(listAdd[2])) list.push(convertPropertyValue(arg, undefined));
      props[listAdd[1]] = list;
      continue;
    }
    const assignment = /^([A-Za-z_]\w*)\s*=\s*(.+)$/s.exec(statement);
    if (assignment && !assignment[2].startsWith('=')) {
      const value = assignment[2].trim();
      props[assignment[1]] = /^ds_list_create\(\s*\)$/.test(value) ? [] : convertPropertyValue(value, undefined);
      continue;
    }
    unparsed.push(statement);
  }
  return { props, unparsed };
}

/**
 * Rectangle de collision d'un sprite posé en (x, y) : boîte englobante `bbox_*`
 * relative à l'origine, mise à l'échelle puis tournée (angle GameMaker,
 * antihoraire). Renvoie [gauche, haut, largeur, hauteur].
 */
export function spriteBoundsAt(
  sprite: GmSprite,
  x: number,
  y: number,
  angle: number,
  scaleX: number,
  scaleY: number,
): [number, number, number, number] {
  const xs = [(sprite.bboxLeft - sprite.xorig) * scaleX, (sprite.bboxRight + 1 - sprite.xorig) * scaleX];
  const ys = [(sprite.bboxTop - sprite.yorig) * scaleY, (sprite.bboxBottom + 1 - sprite.yorig) * scaleY];
  const quarter = ((Math.round(angle / 90) % 4) + 4) % 4;
  const exact = Math.abs(angle / 90 - Math.round(angle / 90)) < 1e-9;
  const cos = exact ? [1, 0, -1, 0][quarter] : Math.cos((angle * Math.PI) / 180);
  const sin = exact ? [0, 1, 0, -1][quarter] : Math.sin((angle * Math.PI) / 180);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const dx of xs) {
    for (const dy of ys) {
      const rx = dx * cos + dy * sin;
      const ry = -dx * sin + dy * cos;
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx);
      minY = Math.min(minY, ry);
      maxY = Math.max(maxY, ry);
    }
  }
  return [x + minX, y + minY, maxX - minX, maxY - minY];
}

type Rect = [number, number, number, number];

/**
 * Fusionne des rectangles alignés sur les axes : d'abord les voisins jointifs de
 * même hauteur sur une même ligne, puis les rectangles de même largeur empilés.
 */
export function mergeRects(rects: Rect[]): Rect[] {
  const rows = rects.map((r) => [...r] as Rect).sort((a, b) => a[1] - b[1] || a[3] - b[3] || a[0] - b[0]);
  const horizontal: Rect[] = [];
  for (const rect of rows) {
    const last = horizontal[horizontal.length - 1];
    if (last && last[1] === rect[1] && last[3] === rect[3] && rect[0] <= last[0] + last[2]) {
      last[2] = Math.max(last[0] + last[2], rect[0] + rect[2]) - last[0];
    } else {
      horizontal.push(rect);
    }
  }
  horizontal.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
  const merged: Rect[] = [];
  for (const rect of horizontal) {
    const last = merged[merged.length - 1];
    if (last && last[0] === rect[0] && last[2] === rect[2] && rect[1] <= last[1] + last[3]) {
      last[3] = Math.max(last[1] + last[3], rect[1] + rect[3]) - last[1];
    } else {
      merged.push(rect);
    }
  }
  return merged.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2] || a[3] - b[3]);
}

// ---------------------------------------------------------------------------
// Sols : simulation de obj_textureGenerator_parent
// ---------------------------------------------------------------------------

interface FloorGenerator {
  instanceName: string;
  object: string;
  tileset: string;
  checkBottomTile: boolean;
  cellSize: number;
  cellsPerLine: number;
  cellsPerColonne: number;
  spriteHeight: number;
  xStart: number;
  yStart: number;
  xEnd: number;
  yEnd: number;
  hCells: number;
  vCells: number;
  /** Tuiles posées, ligne par ligne ; null tant que le générateur n'est pas initialisé. */
  tiles: Float64Array | null;
  firstTile: number;
}

/** `tilemap_get_at_pixel` : -1 hors de la tilemap. */
function tileAtPixel(generator: FloorGenerator, px: number, py: number): number {
  if (!generator.tiles) return -1;
  const cx = Math.floor((px - generator.xStart) / generator.cellSize);
  const cy = Math.floor((py - generator.yStart) / generator.cellSize);
  if (cx < 0 || cy < 0 || cx >= generator.hCells || cy >= generator.vCells) return -1;
  return generator.tiles[cy * generator.hCells + cx];
}

/** scripts/scr_getTileDataOfOtherTileMapAround : [x trouvé, tuile trouvée] ou null. */
function findNeighbourTile(generator: FloorGenerator, sameObject: FloorGenerator[]): [number, number] | null {
  const py = generator.checkBottomTile ? generator.yEnd + 1 : generator.yStart - 1;
  for (let px = generator.xStart; px < generator.xEnd; px += generator.cellSize) {
    for (const other of sameObject) {
      if (!other.tiles) continue;
      const tile = tileAtPixel(other, px, py);
      if (tile !== -1) return [px, tile];
    }
  }
  return null;
}

/** scripts/scr_getTileDataOfFirstCellFromTile, recopié instruction par instruction. */
function firstCellTile(generator: FloorGenerator, distFromXStart: number, tileDataFound: number): number {
  const { cellSize, cellsPerLine, cellsPerColonne } = generator;
  const cellsUsedPerLine = cellsPerLine - 2;
  const total = cellsPerColonne * cellsPerLine;
  const hCellFromXStart = distFromXStart / cellSize;
  let first: number;
  if (!generator.checkBottomTile) {
    const minOnThisLine = cellsPerLine * Math.floor((tileDataFound + cellsPerLine) / cellsPerLine) + 1;
    const maxOnThisLine = minOnThisLine + cellsUsedPerLine;
    if (distFromXStart === 0) {
      first = tileDataFound + cellsPerLine;
    } else {
      first = tileDataFound + cellsPerLine + Math.sign(distFromXStart) * -hCellFromXStart;
      while (first > maxOnThisLine) first = minOnThisLine + (first - maxOnThisLine);
      while (first < minOnThisLine) first = maxOnThisLine - (minOnThisLine - first) + 1;
    }
  } else {
    const vCellFromXStart = generator.spriteHeight / cellSize;
    const minOnLastLine = cellsPerLine * Math.floor((tileDataFound - cellsPerLine) / cellsPerLine) + 1;
    let minOnThisLine = minOnLastLine - cellsPerLine * vCellFromXStart;
    if (minOnThisLine < 1) minOnThisLine = gmMod(minOnThisLine, total) + total;
    const maxOnThisLine = minOnThisLine + cellsUsedPerLine;
    if (distFromXStart === 0) {
      first = tileDataFound - cellsPerLine * vCellFromXStart;
      if (first < 1) first = gmMod(first, total) + total;
    } else {
      first = tileDataFound - cellsPerLine * vCellFromXStart + Math.sign(distFromXStart) * -hCellFromXStart;
      if (first < 1) first = gmMod(first, total) + total;
      while (first > maxOnThisLine) first = minOnThisLine + (first - maxOnThisLine);
      while (first < minOnThisLine) first = maxOnThisLine - (minOnThisLine - first) + 1;
    }
  }
  return first;
}

/** scripts/scr_setTilesOnTilemap. */
function fillTiles(generator: FloorGenerator, initialTileData: number): Float64Array {
  const { cellsPerLine, cellsPerColonne, hCells, vCells } = generator;
  const cellsUsedPerLine = cellsPerLine - 2;
  const total = cellsPerColonne * cellsPerLine;
  const tiles = new Float64Array(hCells * vCells);
  for (let j = 0; j < vCells; j++) {
    const factor = j % cellsPerColonne;
    let tileData = factor * (cellsPerLine - 1) + factor + initialTileData;
    if (tileData > total) tileData -= total;
    const minOnThisLine = cellsPerLine * Math.floor(tileData / cellsPerLine) + 1;
    const maxOnThisLine = minOnThisLine + cellsUsedPerLine;
    for (let i = 0; i < hCells; i++) {
      if (tileData > maxOnThisLine) tileData = minOnThisLine;
      tiles[j * hCells + i] = tileData;
      tileData++;
    }
  }
  return tiles;
}

/**
 * Initialise les générateurs dans l'ordre de création (seuls les générateurs du
 * même objet se voient) et déduit la phase du motif de chacun. Vérifie case par
 * case que « image de période répétée + phase » redonne les tuiles simulées.
 */
function simulateFloors(generators: FloorGenerator[], warnings: string[]): LevelFloor[] {
  const floors: LevelFloor[] = [];
  for (const generator of generators) {
    const { cellSize, cellsPerLine, cellsPerColonne, hCells, vCells } = generator;
    const sameObject = generators.filter((g) => g.object === generator.object);
    let firstTile = 1;
    const found = findNeighbourTile(generator, sameObject);
    if (found) firstTile = firstCellTile(generator, found[0] - generator.xStart, found[1]);
    generator.firstTile = firstTile;
    generator.tiles = fillTiles(generator, firstTile);

    const total = cellsPerLine * cellsPerColonne;
    const wrapped = firstTile > total ? firstTile - total : firstTile;
    const column = wrapped % cellsPerLine;
    const row = Math.floor(wrapped / cellsPerLine) % cellsPerColonne;
    const period = cellsPerLine - 1;
    let mismatches = 0;
    if (!Number.isInteger(firstTile) || column < 1) {
      mismatches = hCells * vCells;
    } else {
      for (let j = 0; j < vCells; j++) {
        for (let i = 0; i < hCells; i++) {
          const expected = ((row + j) % cellsPerColonne) * cellsPerLine + 1 + ((column - 1 + i) % period);
          if (generator.tiles[j * hCells + i] !== expected) mismatches++;
        }
      }
    }
    if (mismatches > 0) {
      warnings.push(
        `sol ${generator.instanceName} (${generator.object}) : la première tuile simulée (${firstTile}) ne se ramène pas ` +
          `à une simple phase du motif (${mismatches} cases diffèrent sur ${hCells * vCells}) ; phase approchée.`,
      );
    }
    const safeColumn = Number.isFinite(column) ? Math.max(1, Math.round(column)) : 1;
    floors.push({
      object: generator.object,
      tileset: generator.tileset,
      x: generator.xStart,
      y: generator.yStart,
      w: generator.xEnd - generator.xStart,
      h: generator.yEnd - generator.yStart,
      checkBottomTile: generator.checkBottomTile,
      phaseX: (safeColumn - 1) * cellSize,
      phaseY: (Number.isFinite(row) ? row : 0) * cellSize,
    });
  }
  return floors;
}

// ---------------------------------------------------------------------------
// Conversion d'une salle
// ---------------------------------------------------------------------------

function walkLayers(layers: any[], visit: (layer: any) => void): void {
  for (const layer of layers ?? []) {
    visit(layer);
    walkLayers(layer.layers, visit);
  }
}

const LAYER_TYPES: Record<string, string> = {
  GMRInstanceLayer: 'instances',
  GMRTileLayer: 'tiles',
  GMRAssetLayer: 'assets',
  GMRBackgroundLayer: 'background',
};

export function convertRoom(project: Project, roomName: string): RoomConversion {
  const roomDir = path.join(project.refDir, 'rooms', roomName);
  const roomFile = path.join(roomDir, `${roomName}.yy`);
  if (!fs.existsSync(roomFile)) throw new Error(`Salle introuvable : ${roomFile}`);
  const room = JSON.parse(fs.readFileSync(roomFile, 'utf8'));
  const width: number = room.roomSettings.Width;
  const height: number = room.roomSettings.Height;
  const warnings: string[] = [];
  const sprites = new Set<string>();

  const creationOrder = new Map<string, number>();
  (room.instanceCreationOrderIDs as string[]).forEach((id, index) => creationOrder.set(id, index));

  const layers: LevelLayer[] = [];
  const objects: Record<string, LevelObject> = {};
  const instances: { order: number; value: LevelInstance }[] = [];
  const generators: { order: number; value: FloorGenerator }[] = [];
  const walls: LevelWall[] = [];
  const thickRects: Rect[] = [];
  const thinRects: Rect[] = [];
  const decals: LevelDecal[] = [];
  const backgrounds: LevelBackground[] = [];
  const byObject = new Map<string, number>();
  const missingCreationCode: string[] = [];
  let ignoredInstances = 0;
  let sequence = 0;
  let thickTilesNonEmpty = 0;
  let thinTilesNonEmpty = 0;

  const useObject = (name: string): LevelObject | null => {
    if (objects[name]) return objects[name];
    const chain = objectChain(project, name);
    if (chain.length === 0) return null;
    for (const object of chain) {
      if (object.sprite) sprites.add(object.sprite);
      if (object.mask) sprites.add(object.mask);
    }
    const entry: LevelObject = {
      sprite: chain.find((o) => o.sprite)?.sprite ?? null,
      mask: chain.find((o) => o.mask)?.mask ?? null,
      parents: chain.slice(1).map((o) => o.name),
      visible: chain[0].visible,
    };
    objects[name] = entry;
    return entry;
  };

  walkLayers(room.layers, (layer) => {
    const type = LAYER_TYPES[layer.modelName] ?? String(layer.modelName);
    layers.push({ name: layer.name, type, depth: layer.depth, visible: Boolean(layer.visible) });

    if (layer.modelName === 'GMRInstanceLayer') {
      for (const inst of layer.instances as any[]) {
        const order = creationOrder.get(inst.id) ?? 1e9 + sequence;
        sequence++;
        if (inst.ignore) {
          ignoredInstances++;
          continue;
        }
        const objectName = project.nameOf(inst.objId);
        if (!objectName || !project.objects.has(objectName)) {
          warnings.push(`instance ${inst.name} : objet inconnu (${inst.objId}), ignorée.`);
          continue;
        }
        byObject.set(objectName, (byObject.get(objectName) ?? 0) + 1);

        const props = objectDefaultProps(project, objectName);
        for (const override of (inst.properties ?? []) as any[]) {
          const definition = project.propertyById.get(override.propertyId);
          if (!definition) {
            warnings.push(`instance ${inst.name} : propriété surchargée inconnue (${override.propertyId}).`);
            continue;
          }
          props[definition.varName] = convertPropertyValue(String(override.value), definition.varType);
        }
        if (inst.creationCodeFile) {
          const codeFile = path.join(roomDir, inst.creationCodeFile);
          if (fs.existsSync(codeFile)) {
            const parsed = parseCreationCode(fs.readFileSync(codeFile, 'utf8'));
            Object.assign(props, parsed.props);
            for (const statement of parsed.unparsed) {
              warnings.push(`instance ${inst.name} : instruction de création non reconnue « ${statement} ».`);
            }
          } else {
            missingCreationCode.push(`${inst.name} (${objectName})`);
          }
        }

        if (objectName.startsWith(FLOOR_GENERATOR_PREFIX)) {
          const spriteName = objectChain(project, objectName).find((o) => o.sprite)?.sprite ?? null;
          const sprite = spriteName ? project.sprite(spriteName) : null;
          const cellSize = Number(props.cellSize);
          const tileset = typeof props.tileSet === 'string' ? props.tileSet : null;
          if (!sprite || !tileset || !(cellSize > 0)) {
            warnings.push(`sol ${inst.name} (${objectName}) : sprite, tileset ou cellSize manquant, ignoré.`);
            continue;
          }
          if (inst.rotation !== 0 || inst.scaleX <= 0 || inst.scaleY <= 0) {
            warnings.push(`sol ${inst.name} : rotation ou échelle négative non prévue par le générateur.`);
          }
          const spriteWidth = sprite.width * inst.scaleX;
          const spriteHeight = sprite.height * inst.scaleY;
          for (const [label, value] of [
            ['x', inst.x / cellSize],
            ['y', inst.y / cellSize],
            ['x + largeur', (inst.x + spriteWidth) / cellSize],
            ['y + hauteur', (inst.y + spriteHeight) / cellSize],
          ] as [string, number][]) {
            if (Math.abs(value - Math.floor(value) - 0.5) < 1e-9) {
              warnings.push(
                `sol ${inst.name} (${objectName}) : ${label} tombe exactement sur une demi-case (${value}) ; ` +
                  "arrondi vers l'entier pair comme round() de GML.",
              );
            }
          }
          const xStart = cellSize * gmRound(inst.x / cellSize);
          const yStart = cellSize * gmRound(inst.y / cellSize);
          const xEnd = cellSize * gmRound((inst.x + spriteWidth) / cellSize);
          const yEnd = cellSize * gmRound((inst.y + spriteHeight) / cellSize);
          generators.push({
            order,
            value: {
              instanceName: inst.name,
              object: objectName,
              tileset,
              checkBottomTile: props.checkBottomTile === true,
              cellSize,
              cellsPerLine: Number(props.cellsPerLine),
              cellsPerColonne: Number(props.cellsPerColonne),
              spriteHeight,
              xStart,
              yStart,
              xEnd,
              yEnd,
              hCells: Math.max(0, (xEnd - xStart) / cellSize),
              vCells: Math.max(0, (yEnd - yStart) / cellSize),
              tiles: null,
              firstTile: 1,
            },
          });
          continue;
        }

        useObject(objectName);
        const colour = splitColour(inst.colour?.Value ?? 0xffffffff);
        instances.push({
          order,
          value: {
            id: inst.name,
            object: objectName,
            layer: layer.name,
            depth: layer.depth,
            x: inst.x,
            y: inst.y,
            angle: inst.rotation,
            scaleX: inst.scaleX,
            scaleY: inst.scaleY,
            tint: colour.tint,
            alpha: colour.alpha,
            props,
          },
        });
      }
    } else if (layer.modelName === 'GMRTileLayer') {
      const wallLayer = WALL_LAYERS[layer.name];
      const data: number[] = layer.tiles?.TileSerialiseData ?? [];
      const columns: number = layer.tiles?.SerialiseWidth ?? 0;
      const rows: number = layer.tiles?.SerialiseHeight ?? 0;
      const isEmpty = (value: number) => value === 0 || value === 2147483648;
      const nonEmpty = data.filter((v) => !isEmpty(v)).length;
      if (!wallLayer) {
        if (nonEmpty > 0) warnings.push(`couche de tuiles « ${layer.name} » non convertie (${nonEmpty} cases non vides).`);
        return;
      }
      if (wallLayer.thick) thickTilesNonEmpty += nonEmpty;
      else thinTilesNonEmpty += nonEmpty;
      const grid = wallLayer.grid;
      if (layer.prev_tilewidth !== grid || layer.prev_tileheight !== grid || layer.x !== 0 || layer.y !== 0) {
        warnings.push(`couche « ${layer.name} » : taille de case ou décalage inattendu.`);
      }
      const unknown = new Map<number, number>();
      let outside = 0;
      for (let cy = 0; cy < rows; cy++) {
        for (let cx = 0; cx < columns; cx++) {
          const value = data[cy * columns + cx];
          if (isEmpty(value)) continue;
          // Le script d'origine ne parcourt que les cases dont le coin est dans la salle.
          if (cx * grid >= width || cy * grid >= height) {
            outside++;
            continue;
          }
          const wallPiece = wallLayer.pieces[value];
          if (!wallPiece) {
            unknown.set(value, (unknown.get(value) ?? 0) + 1);
            continue;
          }
          const x = cx * grid + grid / 2;
          const y = cy * grid + grid / 2;
          const object = useObject(wallPiece.object);
          const sprite = object?.mask ?? object?.sprite ?? null;
          const spriteData = sprite ? project.sprite(sprite) : null;
          if (!spriteData) {
            warnings.push(`mur ${wallPiece.object} : sprite introuvable, pièce ignorée.`);
            continue;
          }
          walls.push({ object: wallPiece.object, thick: wallLayer.thick, x, y, angle: wallPiece.angle, scaleX: wallPiece.scaleX });
          (wallLayer.thick ? thickRects : thinRects).push(spriteBoundsAt(spriteData, x, y, wallPiece.angle, wallPiece.scaleX, 1));
        }
      }
      if (outside > 0) warnings.push(`couche « ${layer.name} » : ${outside} tuiles hors de la salle, non créées (comme dans le jeu).`);
      for (const [value, count] of [...unknown].sort((a, b) => a[0] - b[0])) {
        warnings.push(`couche « ${layer.name} » : indice de tuile ${value} sans pièce de mur (${count} cases), ignoré comme dans le jeu.`);
      }
    } else if (layer.modelName === 'GMRAssetLayer') {
      for (const asset of (layer.assets ?? []) as any[]) {
        if (asset.ignore) continue;
        const sprite = project.nameOf(asset.spriteId);
        if (!sprite) {
          warnings.push(`décalque ${asset.name} : sprite inconnu (${asset.spriteId}), ignoré.`);
          continue;
        }
        sprites.add(sprite);
        if (asset.userdefined_animFPS) {
          warnings.push(`décalque ${asset.name} (${sprite}) : vitesse d'animation propre (${asset.animationFPS}) non convertie.`);
        }
        const colour = splitColour(asset.colour?.Value ?? 0xffffffff);
        decals.push({
          sprite,
          x: asset.x,
          y: asset.y,
          angle: asset.rotation,
          scaleX: asset.scaleX,
          scaleY: asset.scaleY,
          tint: colour.tint,
          alpha: colour.alpha,
          frame: asset.frameIndex ?? 0,
          depth: layer.depth,
        });
      }
    } else if (layer.modelName === 'GMRBackgroundLayer') {
      const sprite = project.nameOf(layer.spriteId);
      if (sprite) sprites.add(sprite);
      if (Boolean(layer.htiled) !== Boolean(layer.vtiled)) {
        warnings.push(`fond « ${layer.name} » : répétition horizontale et verticale différentes.`);
      }
      if (layer.stretch || layer.x !== 0 || layer.y !== 0 || layer.hspeed !== 0 || layer.vspeed !== 0) {
        warnings.push(`fond « ${layer.name} » : étirement, décalage ou défilement non convertis.`);
      }
      backgrounds.push({
        sprite,
        color: splitColour(layer.colour?.Value ?? 0xffffffff).tint,
        tiled: Boolean(layer.htiled) && Boolean(layer.vtiled),
      });
    }
  });

  if (backgrounds.length > 1) warnings.push(`${backgrounds.length} couches de fond : seule la première est gardée.`);
  if (missingCreationCode.length > 0) {
    warnings.push(
      `${missingCreationCode.length} instance(s) référencent un code de création absent (traitées comme sans code) : ` +
        missingCreationCode.join(', '),
    );
  }

  instances.sort((a, b) => a.order - b.order);
  generators.sort((a, b) => a.order - b.order);
  const floorGenerators = generators.map((g) => g.value);
  const floors = simulateFloors(floorGenerators, warnings);

  // Recouvrements entre sols de types différents (ordre d'affichage non garanti dans le jeu).
  for (let a = 0; a < floors.length; a++) {
    for (let b = a + 1; b < floors.length; b++) {
      const fa = floors[a];
      const fb = floors[b];
      const overlapW = Math.min(fa.x + fa.w, fb.x + fb.w) - Math.max(fa.x, fb.x);
      const overlapH = Math.min(fa.y + fa.h, fb.y + fb.h) - Math.max(fa.y, fb.y);
      if (overlapW > 0 && overlapH > 0) {
        warnings.push(
          `sols ${floorGenerators[a].instanceName} (${fa.object}) et ${floorGenerators[b].instanceName} (${fb.object}) ` +
            `se recouvrent sur ${overlapW}x${overlapH} px.`,
        );
      }
    }
  }

  const floorTilesets = new Map<string, FloorTilesetUse>();
  for (const generator of floorGenerators) {
    const use: FloorTilesetUse = {
      tileset: generator.tileset,
      cellSize: generator.cellSize,
      cellsPerLine: generator.cellsPerLine,
      cellsPerColonne: generator.cellsPerColonne,
    };
    const previous = floorTilesets.get(use.tileset);
    if (previous && JSON.stringify(previous) !== JSON.stringify(use)) {
      warnings.push(`tileset ${use.tileset} : utilisé avec des paramètres différents selon les générateurs.`);
    }
    floorTilesets.set(use.tileset, use);
  }

  const mergedThick = mergeRects(thickRects);
  const mergedThin = mergeRects(thinRects);
  const wallRects: LevelWallRect[] = [
    ...mergedThick.map((r): LevelWallRect => [r[0], r[1], r[2], r[3], 1]),
    ...mergedThin.map((r): LevelWallRect => [r[0], r[1], r[2], r[3], 0]),
  ];

  const sortedObjects: Record<string, LevelObject> = {};
  for (const name of Object.keys(objects).sort()) sortedObjects[name] = objects[name];

  const level: Level = {
    name: roomName,
    width,
    height,
    background: backgrounds[0] ?? { sprite: null, color: '#000000', tiled: false },
    layers,
    objects: sortedObjects,
    instances: instances.map((i) => i.value),
    walls,
    wallRects,
    floors,
    decals,
  };

  return {
    level,
    stats: {
      totalInstances: instances.length + floors.length,
      ignoredInstances,
      byObject,
      thickWalls: walls.filter((w) => w.thick).length,
      thinWalls: walls.filter((w) => !w.thick).length,
      thickTilesNonEmpty,
      thinTilesNonEmpty,
      thickRects: mergedThick.length,
      thinRects: mergedThin.length,
      missingCreationCode,
    },
    floorTilesets: [...floorTilesets.values()].sort((a, b) => (a.tileset < b.tileset ? -1 : 1)),
    sprites,
    warnings,
  };
}
