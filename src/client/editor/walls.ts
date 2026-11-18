// Murs de l'éditeur de niveaux (ADR-018, étape 2). Un mur est une suite de cases : 64 px pour un mur épais,
// 32 px pour un mur fin. On peint ou on efface des cases ; la pièce dessinée dans chaque case (droit, bout,
// angle, T, croix, plot) se déduit de ses voisines, et les rectangles de collision sont refaits à partir des
// cases, comme le fait le convertisseur des salles d'origine. Sans Phaser ni navigateur.
import type { LevelObjectInfo, LevelWall } from '../../sim/types.ts';

export type WallRect = [number, number, number, number, number];
type Box = [number, number, number, number];

export const cellSize = (thick: boolean): number => (thick ? 64 : 32);

/**
 * Case d'une pièce de mur : son coin haut-gauche (la position d'une pièce est le centre de sa case). Presque
 * tous les murs sont sur la grille de leur épaisseur ; quelques-uns sont décalés d'une demi-case (la cloison
 * du plateau de TvTv²) : une case se repère donc par ses pixels, pas par un rang de grille.
 */
export function cellOf(wall: { x: number; y: number; thick: boolean }): { x0: number; y0: number } {
  const half = cellSize(wall.thick) / 2;
  return { x0: wall.x - half, y0: wall.y - half };
}

const key = (thick: boolean, x0: number, y0: number): string => `${thick ? 'T' : 't'}${x0},${y0}`;

/**
 * Pièce à poser selon les voisines occupées (nord, est, sud, ouest). Table relevée sur les salles d'origine :
 * elle redonne la pièce d'origine dans presque toutes leurs cases. Angles en degrés GameMaker.
 */
const PIECES: Record<string, [string, number]> = {
  '0000': ['plot', 0],
  '0001': ['bout', 180], '0010': ['bout', 270], '0100': ['bout', 0], '1000': ['bout', 90],
  '0101': ['', 0], '1010': ['', 90],
  '0011': ['angle', 270], '0110': ['angle', 0], '1001': ['angle', 180], '1100': ['angle', 90],
  '0111': ['T', 0], '1011': ['T', 270], '1101': ['T', 180], '1110': ['T', 90],
  '1111': ['croix', 0],
};

export function wallObject(thick: boolean, shape: string): string {
  return `obj_mur_${thick ? 'epais' : 'fin'}${shape ? `_${shape}` : ''}`;
}

/** Tous les types de pièces, pour charger leurs sprites et les déclarer dans la salle. */
export function wallObjects(): Record<string, LevelObjectInfo> {
  const objects: Record<string, LevelObjectInfo> = {};
  for (const thick of [true, false]) {
    for (const shape of ['', 'bout', 'angle', 'T', 'croix', 'plot']) {
      const object = wallObject(thick, shape);
      objects[object] = { sprite: object.replace(/^obj_/, 'spr_'), mask: null, parents: ['obj_mur_parent', 'obj_decor_base'], visible: true };
    }
  }
  return objects;
}

/** Index des cases occupées. */
class Grid {
  private readonly cells = new Set<string>();
  /** Carrés de 16 px couverts par un mur épais : un mur fin s'y raccorde, où qu'il soit sur sa grille. */
  private readonly thickBits = new Set<string>();

  constructor(walls: LevelWall[]) {
    for (const wall of walls) {
      const { x0, y0 } = cellOf(wall);
      this.cells.add(key(wall.thick, x0, y0));
      if (!wall.thick) continue;
      for (let x = x0; x < x0 + 64; x += 16) for (let y = y0; y < y0 + 64; y += 16) this.thickBits.add(`${Math.floor(x / 16)},${Math.floor(y / 16)}`);
    }
  }

  has(thick: boolean, x0: number, y0: number): boolean {
    return this.cells.has(key(thick, x0, y0));
  }

  /**
   * La case voisine tient-elle le mur ? Un mur épais ne regarde que les murs épais ; un mur fin se raccorde
   * aussi à un mur épais. Devant une porte ou une fenêtre, un mur finit par un bout, comme dans les salles
   * d'origine.
   */
  private joined(thick: boolean, x0: number, y0: number): boolean {
    if (this.has(thick, x0, y0)) return true;
    if (thick) return false;
    for (let x = x0; x < x0 + 32; x += 16) for (let y = y0; y < y0 + 32; y += 16) if (this.thickBits.has(`${Math.floor(x / 16)},${Math.floor(y / 16)}`)) return true;
    return false;
  }

  piece(thick: boolean, x0: number, y0: number): LevelWall {
    const size = cellSize(thick);
    const mask = [[0, -1], [1, 0], [0, 1], [-1, 0]].map(([dx, dy]) => (this.joined(thick, x0 + dx * size, y0 + dy * size) ? '1' : '0')).join('');
    const [shape, angle] = PIECES[mask];
    return { object: wallObject(thick, shape), thick, x: x0 + size / 2, y: y0 + size / 2, angle, scaleX: 1 };
  }
}

/** La pièce que la règle poserait dans la case de chaque mur : sert à mesurer la règle sur les salles d'origine. */
export function expectedPieces(walls: LevelWall[]): LevelWall[] {
  const grid = new Grid(walls);
  return walls.map((wall) => {
    const { x0, y0 } = cellOf(wall);
    return grid.piece(wall.thick, x0, y0);
  });
}

export interface WallChange {
  /** Cases de la grille à remplir, de cette épaisseur. */
  add?: { thick: boolean; cells: { cx: number; cy: number }[] };
  /** Rectangle (en pixels) dont les murs sont retirés : toute pièce qu'il recouvre, même en partie (à 4 px près, pour ne pas emporter la voisine qu'il frôle). */
  erase?: { x0: number; y0: number; x1: number; y1: number };
}

/** Deux cases se touchent par un côté, ou se recouvrent (les coins seuls ne comptent pas). */
function adjacent(a: Box, b: Box): boolean {
  const overlapX = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
  const overlapY = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
  return (overlapX > 0 && overlapY >= 0) || (overlapY > 0 && overlapX >= 0);
}

/**
 * Applique un coup de pinceau ou de gomme. Seules les cases touchées et leurs voisines directes changent de
 * pièce : le reste de la salle garde les pièces qu'il avait, même là où la règle en poserait une autre.
 */
export function editWalls(walls: LevelWall[], change: WallChange): LevelWall[] {
  let next = walls;
  const touched: Box[] = [];
  const box = (wall: LevelWall): Box => {
    const { x0, y0 } = cellOf(wall);
    return [x0, y0, cellSize(wall.thick), cellSize(wall.thick)];
  };
  if (change.erase) {
    const { x0, y0, x1, y1 } = change.erase;
    next = next.filter((wall) => {
      const [bx, by, size] = box(wall);
      const out = bx + size - 4 <= x0 || bx + 4 >= x1 || by + size - 4 <= y0 || by + 4 >= y1;
      if (!out) touched.push(box(wall));
      return out;
    });
  }
  if (change.add) {
    const { thick, cells } = change.add;
    const size = cellSize(thick);
    const before = new Grid(next);
    const fresh: LevelWall[] = [];
    const seen = new Set<string>();
    for (const { cx, cy } of cells) {
      const x0 = cx * size;
      const y0 = cy * size;
      if (before.has(thick, x0, y0) || seen.has(key(thick, x0, y0))) continue;
      seen.add(key(thick, x0, y0));
      const wall: LevelWall = { object: wallObject(thick, ''), thick, x: x0 + size / 2, y: y0 + size / 2, angle: 0, scaleX: 1 };
      fresh.push(wall);
      touched.push(box(wall));
    }
    next = [...next, ...fresh];
  }
  if (touched.length === 0) return walls;
  const grid = new Grid(next);
  return next.map((wall) => {
    const mine = box(wall);
    if (!touched.some((t) => adjacent(t, mine))) return wall;
    return grid.piece(wall.thick, mine[0], mine[1]);
  });
}

/**
 * Fusionne des rectangles alignés sur les axes : d'abord les voisins jointifs de même hauteur sur une même
 * ligne, puis les rectangles de même largeur empilés (même procédé que `mergeRects` du convertisseur).
 */
function mergeRects(rects: Box[]): Box[] {
  const rows = rects.map((r) => [...r] as Box).sort((a, b) => a[1] - b[1] || a[3] - b[3] || a[0] - b[0]);
  const horizontal: Box[] = [];
  for (const rect of rows) {
    const last = horizontal[horizontal.length - 1];
    if (last && last[1] === rect[1] && last[3] === rect[3] && rect[0] <= last[0] + last[2]) last[2] = Math.max(last[0] + last[2], rect[0] + rect[2]) - last[0];
    else horizontal.push(rect);
  }
  horizontal.sort((a, b) => a[0] - b[0] || a[2] - b[2] || a[1] - b[1]);
  const merged: Box[] = [];
  for (const rect of horizontal) {
    const last = merged[merged.length - 1];
    if (last && last[0] === rect[0] && last[2] === rect[2] && rect[1] <= last[1] + last[3]) last[3] = Math.max(last[1] + last[3], rect[1] + rect[3]) - last[1];
    else merged.push(rect);
  }
  return merged.sort((a, b) => a[1] - b[1] || a[0] - b[0] || a[2] - b[2] || a[3] - b[3]);
}

/** Rectangles de collision des murs : chaque pièce bloque sa case entière ; épais d'abord, jamais fusionnés avec les fins. */
export function wallRectsOf(walls: LevelWall[]): WallRect[] {
  const boxes = (thick: boolean): Box[] => {
    const size = cellSize(thick);
    return walls.filter((w) => w.thick === thick).map((w): Box => {
      const { x0, y0 } = cellOf(w);
      return [x0, y0, size, size];
    });
  };
  return [
    ...mergeRects(boxes(true)).map((r): WallRect => [r[0], r[1], r[2], r[3], 1]),
    ...mergeRects(boxes(false)).map((r): WallRect => [r[0], r[1], r[2], r[3], 0]),
  ];
}

/** Cases d'un trait droit entre deux points, le long de l'axe où ils sont le plus éloignés. */
export function lineCells(thick: boolean, from: { x: number; y: number }, to: { x: number; y: number }): { cx: number; cy: number }[] {
  const size = cellSize(thick);
  const a = { cx: Math.floor(from.x / size), cy: Math.floor(from.y / size) };
  const b = { cx: Math.floor(to.x / size), cy: Math.floor(to.y / size) };
  const cells: { cx: number; cy: number }[] = [];
  if (Math.abs(b.cx - a.cx) >= Math.abs(b.cy - a.cy)) {
    for (let cx = Math.min(a.cx, b.cx); cx <= Math.max(a.cx, b.cx); cx++) cells.push({ cx, cy: a.cy });
  } else {
    for (let cy = Math.min(a.cy, b.cy); cy <= Math.max(a.cy, b.cy); cy++) cells.push({ cx: a.cx, cy });
  }
  return cells;
}
