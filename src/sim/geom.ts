// Géométrie et collisions : obstacles en boîtes orientées, personnages en cercles.
// Convention d'angle de la simulation : radians, axe y vers le bas, donc sens horaire à l'écran
// (comme Phaser). Un angle GameMaker (degrés, antihoraire) vaut -deg * PI / 180.

export const DEG = Math.PI / 180;
export const TAU = Math.PI * 2;

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Plus petit écart signé pour aller de a vers b, dans ]-PI, PI]. */
export function angleDiff(a: number, b: number): number {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d <= -Math.PI) d += TAU;
  return d;
}

/** Tourne a vers b d'au plus maxStep radians. */
export function rotateToward(a: number, b: number, maxStep: number): number {
  const d = angleDiff(a, b);
  if (Math.abs(d) <= maxStep) return b;
  return a + Math.sign(d) * maxStep;
}

export function gmAngleToRad(deg: number): number {
  return -deg * DEG;
}

/** Position monde d'un point exprimé dans le repère du sprite (relatif à l'origine). */
export function localToWorld(x: number, y: number, angle: number, lx: number, ly: number): { x: number; y: number } {
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  return { x: x + lx * c - ly * sn, y: y + lx * sn + ly * c };
}

export const BLOCK_MOVE = 1;
export const BLOCK_BULLET = 2;
export const BLOCK_SIGHT = 4;
export const BLOCK_SOUND = 8;
/** Vitre intacte : traversée par les balles, qui la brisent. */
export const IS_WINDOW = 16;

export interface Obstacle {
  cx: number;
  cy: number;
  hw: number;
  hh: number;
  cos: number;
  sin: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  flags: number;
  active: boolean;
  /** Entité propriétaire (porte, fenêtre…), pour les effets de jeu. */
  owner: unknown;
  stamp: number;
}

export function makeBox(cx: number, cy: number, hw: number, hh: number, angle: number, flags: number, owner: unknown = null): Obstacle {
  const o: Obstacle = {
    cx, cy, hw, hh, cos: Math.cos(angle), sin: Math.sin(angle),
    minX: 0, minY: 0, maxX: 0, maxY: 0, flags, active: true, owner, stamp: 0,
  };
  updateBounds(o);
  return o;
}

export function updateBounds(o: Obstacle): void {
  const ex = Math.abs(o.hw * o.cos) + Math.abs(o.hh * o.sin);
  const ey = Math.abs(o.hw * o.sin) + Math.abs(o.hh * o.cos);
  o.minX = o.cx - ex;
  o.maxX = o.cx + ex;
  o.minY = o.cy - ey;
  o.maxY = o.cy + ey;
}

/** Distance signée d'un point à une boîte (négative à l'intérieur). */
export function distanceToBox(o: Obstacle, x: number, y: number): number {
  const dx = x - o.cx;
  const dy = y - o.cy;
  const lx = Math.abs(dx * o.cos + dy * o.sin) - o.hw;
  const ly = Math.abs(-dx * o.sin + dy * o.cos) - o.hh;
  if (lx > 0 && ly > 0) return Math.hypot(lx, ly);
  return Math.max(lx, ly);
}

const push = { x: 0, y: 0 };

/** Si le cercle chevauche la boîte, écrit dans `push` le déplacement qui l'en sort. */
function pushCircleOut(o: Obstacle, x: number, y: number, r: number): boolean {
  const dx = x - o.cx;
  const dy = y - o.cy;
  const lx = dx * o.cos + dy * o.sin;
  const ly = -dx * o.sin + dy * o.cos;
  const qx = clamp(lx, -o.hw, o.hw);
  const qy = clamp(ly, -o.hh, o.hh);
  let nx = lx - qx;
  let ny = ly - qy;
  let depth: number;
  const d2 = nx * nx + ny * ny;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    if (d >= r) return false;
    depth = r - d;
    nx /= d;
    ny /= d;
  } else {
    // centre à l'intérieur : sortie par la face la plus proche
    const px = o.hw - Math.abs(lx);
    const py = o.hh - Math.abs(ly);
    if (px < py) {
      nx = lx >= 0 ? 1 : -1;
      ny = 0;
      depth = px + r;
    } else {
      nx = 0;
      ny = ly >= 0 ? 1 : -1;
      depth = py + r;
    }
  }
  push.x = (nx * o.cos - ny * o.sin) * depth;
  push.y = (nx * o.sin + ny * o.cos) * depth;
  return true;
}

/** Paramètre t dans [0, 1] de l'entrée du segment dans la boîte, ou -1. */
export function segmentBox(o: Obstacle, x1: number, y1: number, x2: number, y2: number): number {
  const ax = x1 - o.cx;
  const ay = y1 - o.cy;
  const bx = x2 - o.cx;
  const by = y2 - o.cy;
  const lx1 = ax * o.cos + ay * o.sin;
  const ly1 = -ax * o.sin + ay * o.cos;
  const dx = bx * o.cos + by * o.sin - lx1;
  const dy = -bx * o.sin + by * o.cos - ly1;
  let t0 = 0;
  let t1 = 1;
  if (Math.abs(dx) < 1e-9) {
    if (lx1 < -o.hw || lx1 > o.hw) return -1;
  } else {
    let ta = (-o.hw - lx1) / dx;
    let tb = (o.hw - lx1) / dx;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  if (Math.abs(dy) < 1e-9) {
    if (ly1 < -o.hh || ly1 > o.hh) return -1;
  } else {
    let ta = (-o.hh - ly1) / dy;
    let tb = (o.hh - ly1) / dy;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
    if (ta > t0) t0 = ta;
    if (tb < t1) t1 = tb;
    if (t0 > t1) return -1;
  }
  return t0;
}

/** Paramètre t dans [0, 1] de l'entrée du segment dans le cercle, ou -1. */
export function segmentCircle(x1: number, y1: number, x2: number, y2: number, cx: number, cy: number, r: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const fx = x1 - cx;
  const fy = y1 - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return -1;
  const b = 2 * (fx * dx + fy * dy);
  const disc = b * b - 4 * a * c;
  if (disc < 0) return -1;
  const t = (-b - Math.sqrt(disc)) / (2 * a);
  return t >= 0 && t <= 1 ? t : -1;
}

/** Normale (dans le monde) de la face de la boite la plus proche du point. */
export function boxNormal(o: Obstacle, x: number, y: number): { x: number; y: number } {
  const dx = x - o.cx;
  const dy = y - o.cy;
  const lx = dx * o.cos + dy * o.sin;
  const ly = -dx * o.sin + dy * o.cos;
  let nx = 0;
  let ny = 0;
  if (o.hw - Math.abs(lx) < o.hh - Math.abs(ly)) nx = lx >= 0 ? 1 : -1;
  else ny = ly >= 0 ? 1 : -1;
  return { x: nx * o.cos - ny * o.sin, y: nx * o.sin + ny * o.cos };
}

/** Direction apres rebond sur une surface de normale (nx, ny). */
export function reflectAngle(angle: number, nx: number, ny: number): number {
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const dot = dx * nx + dy * ny;
  return Math.atan2(dy - 2 * dot * ny, dx - 2 * dot * nx);
}

/** Distance d'un point (repere local) a un rectangle aligne ; 0 a l'interieur. */
export function distanceToRect(lx: number, ly: number, x0: number, y0: number, x1: number, y1: number): number {
  const qx = lx < x0 ? x0 : lx > x1 ? x1 : lx;
  const qy = ly < y0 ? y0 : ly > y1 ? y1 : ly;
  return Math.hypot(lx - qx, ly - qy);
}

export interface RayHit {
  t: number;
  obstacle: Obstacle;
}

/** Ensemble d'obstacles rangés dans une grille pour des requêtes rapides. */
export class CollisionWorld {
  private readonly cell = 256;
  private readonly cols: number;
  private readonly rows: number;
  private readonly cells: Obstacle[][];
  private stamp = 0;
  private readonly found: Obstacle[] = [];
  readonly all: Obstacle[] = [];

  constructor(width: number, height: number) {
    this.cols = Math.ceil(width / this.cell) + 1;
    this.rows = Math.ceil(height / this.cell) + 1;
    this.cells = Array.from({ length: this.cols * this.rows }, () => []);
  }

  add(o: Obstacle): Obstacle {
    this.all.push(o);
    this.forEachCell(o.minX, o.minY, o.maxX, o.maxY, (list) => list.push(o));
    return o;
  }

  /** À appeler quand un obstacle déjà ajouté change de taille ou de position. */
  update(o: Obstacle, change: () => void): void {
    this.forEachCell(o.minX, o.minY, o.maxX, o.maxY, (list) => {
      const i = list.indexOf(o);
      if (i >= 0) list.splice(i, 1);
    });
    change();
    updateBounds(o);
    this.forEachCell(o.minX, o.minY, o.maxX, o.maxY, (list) => list.push(o));
  }

  private forEachCell(minX: number, minY: number, maxX: number, maxY: number, fn: (list: Obstacle[]) => void): void {
    const c0 = clamp(Math.floor(minX / this.cell), 0, this.cols - 1);
    const c1 = clamp(Math.floor(maxX / this.cell), 0, this.cols - 1);
    const r0 = clamp(Math.floor(minY / this.cell), 0, this.rows - 1);
    const r1 = clamp(Math.floor(maxY / this.cell), 0, this.rows - 1);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) fn(this.cells[r * this.cols + c]);
  }

  /** Copie de la liste des obstacles actifs qui touchent la zone et ont un des drapeaux demandés. */
  obstaclesIn(minX: number, minY: number, maxX: number, maxY: number, mask: number): Obstacle[] {
    return this.query(minX, minY, maxX, maxY, mask).slice();
  }

  /** Obstacles actifs dont la boîte englobante touche la zone et qui ont un des drapeaux demandés. */
  private query(minX: number, minY: number, maxX: number, maxY: number, mask: number): Obstacle[] {
    const out = this.found;
    out.length = 0;
    const stamp = ++this.stamp;
    this.forEachCell(minX, minY, maxX, maxY, (list) => {
      for (let i = 0; i < list.length; i++) {
        const o = list[i];
        if (o.stamp === stamp) continue;
        o.stamp = stamp;
        if (!o.active || (o.flags & mask) === 0) continue;
        if (o.maxX < minX || o.minX > maxX || o.maxY < minY || o.minY > maxY) continue;
        out.push(o);
      }
    });
    return out;
  }

  /** Sort un cercle des obstacles. Retourne la position corrigée et si un contact a eu lieu. */
  resolveCircle(x: number, y: number, r: number, mask: number): { x: number; y: number; hit: boolean } {
    let hit = false;
    for (let iter = 0; iter < 4; iter++) {
      let moved = false;
      const list = this.query(x - r, y - r, x + r, y + r, mask);
      for (let i = 0; i < list.length; i++) {
        if (pushCircleOut(list[i], x, y, r)) {
          x += push.x;
          y += push.y;
          moved = true;
          hit = true;
        }
      }
      if (!moved) break;
    }
    return { x, y, hit };
  }

  circleFree(x: number, y: number, r: number, mask: number): boolean {
    const list = this.query(x - r, y - r, x + r, y + r, mask);
    for (let i = 0; i < list.length; i++) if (pushCircleOut(list[i], x, y, r)) return false;
    return true;
  }

  /** Premier obstacle rencontré par le segment (le plus proche du départ). */
  raycast(x1: number, y1: number, x2: number, y2: number, mask: number, ignore: Obstacle | null = null): RayHit | null {
    const list = this.query(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), mask);
    let best: RayHit | null = null;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === ignore) continue;
      const t = segmentBox(o, x1, y1, x2, y2);
      if (t >= 0 && (best === null || t < best.t)) best = { t, obstacle: o };
    }
    return best;
  }

  segmentBlocked(x1: number, y1: number, x2: number, y2: number, mask: number): boolean {
    const list = this.query(Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2), mask);
    for (let i = 0; i < list.length; i++) if (segmentBox(list[i], x1, y1, x2, y2) >= 0) return true;
    return false;
  }
}

/** Générateur pseudo-aléatoire déterministe (mulberry32) : la simulation n'utilise pas Math.random. */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(lo: number, hi: number): number {
    return lo + (hi - lo) * this.next();
  }

  /** Entier dans [lo, hi] inclus. */
  int(lo: number, hi: number): number {
    return lo + Math.floor(this.next() * (hi - lo + 1));
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)];
  }
}
