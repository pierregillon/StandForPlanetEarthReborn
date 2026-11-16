// Grille de navigation des PNJ et recherche de chemin A* (cases de 32 px comme obj_grid d'origine).
// Écart voulu avec l'original (GD-014) : les murs issus des tuiles sont bien dans la grille.
import type { Obstacle } from './geom.ts';
import { distanceToBox } from './geom.ts';

export interface Point {
  x: number;
  y: number;
}

const SQRT2 = Math.SQRT2;

export class NavGrid {
  readonly cols: number;
  readonly rows: number;
  /** Nombre d'obstacles couvrant chaque case (0 = libre). */
  private readonly blocked: Uint8Array;
  private readonly g: Float32Array;
  private readonly parent: Int32Array;
  private readonly seen: Uint32Array;
  private readonly closed: Uint32Array;
  private searchId = 0;
  private readonly heap: number[] = [];
  private readonly f: Float32Array;

  readonly cellSize: number;
  readonly clearance: number;
  readonly maxExpansions: number;

  constructor(width: number, height: number, cellSize: number, clearance: number, maxExpansions: number) {
    this.cellSize = cellSize;
    this.clearance = clearance;
    this.maxExpansions = maxExpansions;
    this.cols = Math.ceil(width / cellSize);
    this.rows = Math.ceil(height / cellSize);
    const n = this.cols * this.rows;
    this.blocked = new Uint8Array(n);
    this.g = new Float32Array(n);
    this.f = new Float32Array(n);
    this.parent = new Int32Array(n);
    this.seen = new Uint32Array(n);
    this.closed = new Uint32Array(n);
  }

  /** Marque (delta = 1) ou libère (delta = -1) les cases proches de l'obstacle. */
  mark(o: Obstacle, delta: 1 | -1): void {
    const cs = this.cellSize;
    const c0 = Math.max(0, Math.floor((o.minX - this.clearance) / cs));
    const c1 = Math.min(this.cols - 1, Math.floor((o.maxX + this.clearance) / cs));
    const r0 = Math.max(0, Math.floor((o.minY - this.clearance) / cs));
    const r1 = Math.min(this.rows - 1, Math.floor((o.maxY + this.clearance) / cs));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (distanceToBox(o, (c + 0.5) * cs, (r + 0.5) * cs) < this.clearance) {
          const i = r * this.cols + c;
          this.blocked[i] = Math.max(0, this.blocked[i] + delta);
        }
      }
    }
  }

  isBlockedCell(c: number, r: number): boolean {
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return true;
    return this.blocked[r * this.cols + c] !== 0;
  }

  isBlockedAt(x: number, y: number): boolean {
    return this.isBlockedCell(Math.floor(x / this.cellSize), Math.floor(y / this.cellSize));
  }

  /** Case libre la plus proche d'un point (recherche en anneaux), ou -1. */
  private nearestFree(x: number, y: number, maxRing: number): number {
    const c = Math.floor(x / this.cellSize);
    const r = Math.floor(y / this.cellSize);
    for (let ring = 0; ring <= maxRing; ring++) {
      let best = -1;
      let bestD = Infinity;
      for (let dr = -ring; dr <= ring; dr++) {
        for (let dc = -ring; dc <= ring; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== ring) continue;
          if (this.isBlockedCell(c + dc, r + dr)) continue;
          const d = dr * dr + dc * dc;
          if (d < bestD) {
            bestD = d;
            best = (r + dr) * this.cols + c + dc;
          }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** Le segment reste-t-il dans des cases libres ? */
  lineFree(x1: number, y1: number, x2: number, y2: number): boolean {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / (this.cellSize / 2)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (this.isBlockedAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
    }
    return true;
  }

  /** Chemin de (x1, y1) à (x2, y2) : liste de points à suivre, ou null s'il n'y en a pas. */
  findPath(x1: number, y1: number, x2: number, y2: number): Point[] | null {
    const start = this.nearestFree(x1, y1, 4);
    const goal = this.nearestFree(x2, y2, 4);
    if (start < 0 || goal < 0) return null;
    const cols = this.cols;
    const id = ++this.searchId;
    const heap = this.heap;
    heap.length = 0;
    const gc = goal % cols;
    const gr = (goal - gc) / cols;
    const h = (i: number): number => {
      const dc = Math.abs((i % cols) - gc);
      const dr = Math.abs(Math.floor(i / cols) - gr);
      return Math.max(dc, dr) + (SQRT2 - 1) * Math.min(dc, dr);
    };
    this.g[start] = 0;
    this.f[start] = h(start);
    this.parent[start] = -1;
    this.seen[start] = id;
    this.heapPush(start);
    let expansions = 0;
    let found = false;
    while (heap.length > 0) {
      const cur = this.heapPop();
      if (this.closed[cur] === id) continue;
      this.closed[cur] = id;
      if (cur === goal) {
        found = true;
        break;
      }
      if (++expansions > this.maxExpansions) break;
      const cc = cur % cols;
      const cr = (cur - cc) / cols;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nc = cc + dc;
          const nr = cr + dr;
          if (this.isBlockedCell(nc, nr)) continue;
          // pas de diagonale qui rase un coin
          if (dr !== 0 && dc !== 0 && (this.isBlockedCell(cc + dc, cr) || this.isBlockedCell(cc, cr + dr))) continue;
          const ni = nr * cols + nc;
          if (this.closed[ni] === id) continue;
          const ng = this.g[cur] + (dr !== 0 && dc !== 0 ? SQRT2 : 1);
          if (this.seen[ni] === id && ng >= this.g[ni]) continue;
          this.seen[ni] = id;
          this.g[ni] = ng;
          this.f[ni] = ng + h(ni);
          this.parent[ni] = cur;
          this.heapPush(ni);
        }
      }
    }
    if (!found) return null;
    const cs = this.cellSize;
    const cells: Point[] = [];
    for (let i = goal; i >= 0; i = this.parent[i]) {
      const c = i % cols;
      cells.push({ x: (c + 0.5) * cs, y: (Math.floor(i / cols) + 0.5) * cs });
    }
    cells.reverse();
    // simplification : on saute les points intermédiaires quand la ligne droite est libre
    const out: Point[] = [];
    let anchor = 0;
    while (anchor < cells.length - 1) {
      let next = anchor + 1;
      for (let j = cells.length - 1; j > anchor + 1; j--) {
        if (this.lineFree(cells[anchor].x, cells[anchor].y, cells[j].x, cells[j].y)) {
          next = j;
          break;
        }
      }
      out.push(cells[next]);
      anchor = next;
    }
    if (out.length === 0) out.push(cells[cells.length - 1]);
    return out;
  }

  private heapPush(i: number): void {
    const heap = this.heap;
    const f = this.f;
    let pos = heap.length;
    heap.push(i);
    while (pos > 0) {
      const up = (pos - 1) >> 1;
      if (f[heap[up]] <= f[i]) break;
      heap[pos] = heap[up];
      pos = up;
    }
    heap[pos] = i;
  }

  private heapPop(): number {
    const heap = this.heap;
    const f = this.f;
    const top = heap[0];
    const last = heap.pop() as number;
    const n = heap.length;
    if (n > 0) {
      let pos = 0;
      for (;;) {
        let child = pos * 2 + 1;
        if (child >= n) break;
        if (child + 1 < n && f[heap[child + 1]] < f[heap[child]]) child++;
        if (f[heap[child]] >= f[last]) break;
        heap[pos] = heap[child];
        pos = child;
      }
      heap[pos] = last;
    }
    return top;
  }
}
