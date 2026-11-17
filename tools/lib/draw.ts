// Dessin vectoriel sur une image, avec lissage des bords : polygones pleins, traits, semis de points.
// Sert à fabriquer les sprites que le jeu d'origine n'avait pas (ADR-015), dans son style : aplats de
// couleur, contour à l'encre, usure mouchetée.
import type { Image } from './png.ts';

export type Rgb = [number, number, number];
export type Pt = [number, number];
export const TAU = Math.PI * 2;

export function canvas(width: number, height: number): Image {
  return { width, height, data: new Uint8Array(width * height * 4) };
}

/** Pose une couleur sur un pixel (fusion « par-dessus »). */
export function put(img: Image, x: number, y: number, c: Rgb, a: number): void {
  if (a <= 0 || x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (y * img.width + x) * 4;
  const da = img.data[i + 3] / 255;
  const out = a + da * (1 - a);
  for (let k = 0; k < 3; k++) img.data[i + k] = Math.round((c[k] * a + img.data[i + k] * da * (1 - a)) / out);
  img.data[i + 3] = Math.round(out * 255);
}

/** Polygone plein. Chaque ligne de pixels est balayée quatre fois ; la couverture horizontale est exacte. */
export function polygon(img: Image, pts: Pt[], color: Rgb, alpha = 1): void {
  if (pts.length < 3) return;
  let y0 = Infinity, y1 = -Infinity;
  for (const [, y] of pts) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const top = Math.max(0, Math.floor(y0)), bottom = Math.min(img.height - 1, Math.ceil(y1));
  const SUB = 4;
  const cover = new Float32Array(img.width);
  for (let py = top; py <= bottom; py++) {
    cover.fill(0);
    for (let s = 0; s < SUB; s++) {
      const y = py + (s + 0.5) / SUB;
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i], [bx, by] = pts[(i + 1) % pts.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(0, xs[k]), xb = Math.min(img.width, xs[k + 1]);
        if (xb <= xa) continue;
        for (let px = Math.floor(xa); px <= Math.min(img.width - 1, Math.floor(xb)); px++) {
          cover[px] += Math.max(0, Math.min(px + 1, xb) - Math.max(px, xa)) / SUB;
        }
      }
    }
    for (let px = 0; px < img.width; px++) if (cover[px] > 0) put(img, px, py, color, Math.min(1, cover[px]) * alpha);
  }
}

/** Trait d'épaisseur constante le long d'une suite de points, aux bouts et aux angles arrondis. */
export function line(img: Image, pts: Pt[], width: number, color: Rgb, alpha = 1, closed = false): void {
  const all = closed ? [...pts, pts[0]] : pts;
  const half = width / 2;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of all) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  const left = Math.max(0, Math.floor(x0 - half - 1)), top = Math.max(0, Math.floor(y0 - half - 1));
  const right = Math.min(img.width - 1, Math.ceil(x1 + half + 1)), bottom = Math.min(img.height - 1, Math.ceil(y1 + half + 1));
  const w = right - left + 1;
  if (w <= 0 || bottom < top) return;
  // la couverture est le maximum sur tous les segments : les raccords ne s'additionnent pas
  const cover = new Float32Array(w * (bottom - top + 1));
  for (let i = 0; i + 1 < all.length; i++) {
    const [ax, ay] = all[i], [bx, by] = all[i + 1];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    const sx0 = Math.max(left, Math.floor(Math.min(ax, bx) - half - 1)), sx1 = Math.min(right, Math.ceil(Math.max(ax, bx) + half + 1));
    const sy0 = Math.max(top, Math.floor(Math.min(ay, by) - half - 1)), sy1 = Math.min(bottom, Math.ceil(Math.max(ay, by) + half + 1));
    for (let py = sy0; py <= sy1; py++) for (let px = sx0; px <= sx1; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / len2));
      const d = Math.hypot(cx - (ax + t * dx), cy - (ay + t * dy));
      const c = Math.max(0, Math.min(1, half + 0.5 - d));
      const k = (py - top) * w + (px - left);
      if (c > cover[k]) cover[k] = c;
    }
  }
  for (let py = top; py <= bottom; py++) for (let px = left; px <= right; px++) {
    const c = cover[(py - top) * w + (px - left)];
    if (c > 0) put(img, px, py, color, c * alpha);
  }
}

/** Forme pleine cernée d'un contour à l'encre. */
export function shape(img: Image, pts: Pt[], fill: Rgb, ink: Rgb, inkWidth: number): void {
  polygon(img, pts, fill);
  if (inkWidth > 0) line(img, pts, inkWidth, ink, 1, true);
}

/** Points d'un arc d'ellipse, de l'angle `a0` à `a1` (radians, sens horaire à l'écran). */
export function arc(cx: number, cy: number, rx: number, ry: number, a0 = 0, a1 = TAU, n = 64): Pt[] {
  const pts: Pt[] = [];
  const full = Math.abs(a1 - a0) >= TAU - 1e-6;
  const count = full ? n : n + 1;
  for (let i = 0; i < count; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
  }
  return pts;
}

/** Secteur d'anneau : de l'angle `a0` à `a1`, entre les rayons `r0` et `r1`. */
export function band(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number, n = 48): Pt[] {
  return [...arc(cx, cy, r1, r1, a0, a1, n), ...arc(cx, cy, r0, r0, a1, a0, n)];
}

export function rect(x: number, y: number, w: number, h: number): Pt[] {
  return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
}

/** Rectangle aux coins arrondis. */
export function roundRect(x: number, y: number, w: number, h: number, r: number): Pt[] {
  const q = Math.PI / 2;
  return [
    ...arc(x + w - r, y + r, r, r, -q, 0, 6), ...arc(x + w - r, y + h - r, r, r, 0, q, 6),
    ...arc(x + r, y + h - r, r, r, q, 2 * q, 6), ...arc(x + r, y + r, r, r, 2 * q, 3 * q, 6),
  ];
}

/** Tourne des points autour de (cx, cy), d'un angle en radians. */
export function rotate(pts: Pt[], cx: number, cy: number, angle: number): Pt[] {
  const c = Math.cos(angle), s = Math.sin(angle);
  return pts.map(([x, y]) => [cx + (x - cx) * c - (y - cy) * s, cy + (x - cx) * s + (y - cy) * c] as Pt);
}

/** Courbe de Bézier cubique découpée en segments. */
export function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, n = 24): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    pts.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return pts;
}

/** Hasard reproductible : même graine, même dessin. */
export function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Usure mouchetée, comme sur le mobilier d'origine : de petites taches posées là où l'image est déjà
 * peinte et où `where` l'accepte.
 */
export function speckle(img: Image, rng: () => number, count: number, color: Rgb, alpha: number, where: (x: number, y: number) => boolean = () => true): void {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * img.width), y = Math.floor(rng() * img.height);
    const size = rng() < 0.8 ? 1 : 2;
    for (let dy = 0; dy < size; dy++) for (let dx = 0; dx < size; dx++) {
      const px = x + dx, py = y + dy;
      if (px >= img.width || py >= img.height || img.data[(py * img.width + px) * 4 + 3] < 250 || !where(px, py)) continue;
      put(img, px, py, color, alpha * (0.5 + rng() * 0.5));
    }
  }
}

/** Colle une image sur une autre, réduite ou agrandie, centrée en (cx, cy). */
export function paste(dst: Image, src: Image, cx: number, cy: number, scale = 1, alpha = 1): void {
  const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
  const ox = Math.round(cx - w / 2), oy = Math.round(cy - h / 2);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    // moyenne des pixels sources couverts par ce pixel d'arrivée
    const x0 = Math.floor(x / scale), y0 = Math.floor(y / scale);
    const x1 = Math.max(x0 + 1, Math.min(src.width, Math.floor((x + 1) / scale))), y1 = Math.max(y0 + 1, Math.min(src.height, Math.floor((y + 1) / scale)));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = y0; sy < y1 && sy < src.height; sy++) for (let sx = x0; sx < x1 && sx < src.width; sx++) {
      const i = (sy * src.width + sx) * 4, al = src.data[i + 3] / 255;
      r += src.data[i] * al; g += src.data[i + 1] * al; b += src.data[i + 2] * al; a += al; n++;
    }
    if (n > 0 && a > 0) put(dst, ox + x, oy + y, [r / a, g / a, b / a], (a / n) * alpha);
  }
}

/** Efface ce qui dépasse d'un disque, à partir de la ligne `fromY` : le bas d'un portrait est rond. */
export function clipDisc(img: Image, cx: number, cy: number, r: number, fromY: number): void {
  for (let y = Math.max(0, Math.floor(fromY)); y < img.height; y++) for (let x = 0; x < img.width; x++) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    const keep = Math.max(0, Math.min(1, r + 0.5 - d));
    const i = (y * img.width + x) * 4 + 3;
    img.data[i] = Math.round(img.data[i] * keep);
  }
}
