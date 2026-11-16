// Fabrique les sprites que le jeu d'origine n'a pas : les animations des attaques ultimes (GD-043).
//   node tools/make-sprites.ts
// Chaque animation est construite à partir des images existantes du robot (mêmes proportions, mêmes
// couleurs, même origine) auxquelles s'ajoutent des tracés d'énergie dans le style de l'original :
// aplats magenta à reflet rose, comme les arcs de ses coups de batte.
// Les images sont écrites dans public/assets/sprites et déclarées dans sprites.json.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { linesObject } from './lib/output.ts';
import { decodePng, encodePng } from './lib/png.ts';
import type { Image } from './lib/png.ts';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const SPRITES = path.join(ROOT, 'public', 'assets', 'sprites');
const MANIFEST = path.join(ROOT, 'public', 'assets', 'sprites.json');

type Rgb = [number, number, number];
const MAGENTA: Rgb = [254, 0, 209];
const PINK: Rgb = [255, 132, 232];
const WHITE: Rgb = [255, 255, 255];
const SMEAR: Rgb = [206, 206, 214];
const DARK: Rgb = [28, 28, 34];
const TAU = Math.PI * 2;

// ---------- Dessin ----------

function canvas(width: number, height: number): Image {
  return { width, height, data: Buffer.alloc(width * height * 4) };
}

function loadFrame(sprite: string, frame: number): Image {
  return decodePng(readFileSync(path.join(SPRITES, sprite, `${frame}.png`)));
}

/** Pose un pixel par-dessus l'image (mélange « normal », alpha de 0 à 1). */
function over(dst: Image, x: number, y: number, c: Rgb, a: number): void {
  if (a <= 0 || x < 0 || y < 0 || x >= dst.width || y >= dst.height) return;
  const i = (y * dst.width + x) * 4;
  const da = dst.data[i + 3] / 255;
  const oa = a + da * (1 - a);
  for (let k = 0; k < 3; k++) dst.data[i + k] = Math.round((c[k] * a + dst.data[i + k] * da * (1 - a)) / oa);
  dst.data[i + 3] = Math.round(oa * 255);
}

/**
 * Remplit une forme décrite par sa distance signée (négative à l'intérieur), avec un bord lissé d'un pixel.
 * `box` : [x0, y0, x1, y1], zone à parcourir.
 */
function fill(dst: Image, box: number[], distance: (x: number, y: number) => number, color: Rgb, alpha: number): void {
  const x0 = Math.max(0, Math.floor(box[0]));
  const y0 = Math.max(0, Math.floor(box[1]));
  const x1 = Math.min(dst.width - 1, Math.ceil(box[2]));
  const y1 = Math.min(dst.height - 1, Math.ceil(box[3]));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const cover = Math.max(0, Math.min(1, 0.5 - distance(x + 0.5, y + 0.5)));
      if (cover > 0) over(dst, x, y, color, cover * alpha);
    }
  }
}

function disc(dst: Image, cx: number, cy: number, r: number, color: Rgb, alpha: number): void {
  fill(dst, [cx - r - 1, cy - r - 1, cx + r + 1, cy + r + 1], (x, y) => Math.hypot(x - cx, y - cy) - r, color, alpha);
}

/**
 * Croissant : un arc de cercle épais au milieu, effilé aux deux bouts, comme les traînées des battes.
 * `from` et `span` en radians ; `half` : demi-épaisseur au milieu.
 */
function crescent(dst: Image, cx: number, cy: number, radius: number, half: number, from: number, span: number, color: Rgb, alpha: number): void {
  const reach = radius + half + 1;
  fill(dst, [cx - reach, cy - reach, cx + reach, cy + reach], (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const rel = (((Math.atan2(dy, dx) - from) % TAU) + TAU) % TAU;
    if (rel > span) return 9;
    return Math.abs(Math.hypot(dx, dy) - radius) - half * Math.sin((rel / span) * Math.PI) ** 0.7;
  }, color, alpha);
}

/** Croissant magenta à reflet rose sur son bord intérieur. */
function energyArc(dst: Image, cx: number, cy: number, radius: number, half: number, from: number, span: number, alpha: number): void {
  crescent(dst, cx, cy, radius, half, from, span, MAGENTA, alpha);
  crescent(dst, cx, cy, radius - half * 0.35, half * 0.35, from + span * 0.12, span * 0.76, PINK, alpha);
}

/** Trait droit effilé, de demi-largeur w0 au départ à w1 à l'arrivée. */
function streak(dst: Image, x0: number, y0: number, x1: number, y1: number, w0: number, w1: number, color: Rgb, alpha: number): void {
  const pad = Math.max(w0, w1) + 1;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len2 = dx * dx + dy * dy || 1;
  fill(dst, [Math.min(x0, x1) - pad, Math.min(y0, y1) - pad, Math.max(x0, x1) + pad, Math.max(y0, y1) + pad], (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / len2));
    return Math.hypot(x - x0 - dx * t, y - y0 - dy * t) - (w0 + (w1 - w0) * t);
  }, color, alpha);
}

interface Placement {
  /** Position, dans l'image d'arrivée, de l'origine du sprite source. */
  x: number;
  y: number;
  /** Origine dans le sprite source. */
  ox: number;
  oy: number;
  angle?: number;
  scale?: number;
  alpha?: number;
  /** Teinte mêlée aux couleurs du sprite : [couleur, proportion]. */
  tint?: [Rgb, number];
}

/** Dessine un sprite tourné et mis à l'échelle autour de son origine (interpolation bilinéaire). */
function blit(dst: Image, src: Image, p: Placement): void {
  const scale = p.scale ?? 1;
  const cos = Math.cos(-(p.angle ?? 0));
  const sin = Math.sin(-(p.angle ?? 0));
  const sample = (u: number, v: number): [number, number, number, number] => {
    const x = Math.floor(u);
    const y = Math.floor(v);
    const fx = u - x;
    const fy = v - y;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (const [px, py, w] of [[x, y, (1 - fx) * (1 - fy)], [x + 1, y, fx * (1 - fy)], [x, y + 1, (1 - fx) * fy], [x + 1, y + 1, fx * fy]]) {
      if (px < 0 || py < 0 || px >= src.width || py >= src.height) continue;
      const i = (py * src.width + px) * 4;
      const wa = (src.data[i + 3] / 255) * w;
      r += src.data[i] * wa;
      g += src.data[i + 1] * wa;
      b += src.data[i + 2] * wa;
      a += wa;
    }
    return a > 0 ? [r / a, g / a, b / a, a] : [0, 0, 0, 0];
  };
  for (let y = 0; y < dst.height; y++) {
    for (let x = 0; x < dst.width; x++) {
      const dx = (x + 0.5 - p.x) / scale;
      const dy = (y + 0.5 - p.y) / scale;
      const [r, g, b, a] = sample(dx * cos - dy * sin + p.ox - 0.5, dx * sin + dy * cos + p.oy - 0.5);
      if (a <= 0) continue;
      const k = p.tint ? p.tint[1] : 0;
      const t = p.tint ? p.tint[0] : WHITE;
      over(dst, x, y, [r + (t[0] - r) * k, g + (t[1] - g) * k, b + (t[2] - b) * k], a * (p.alpha ?? 1));
    }
  }
}

/** Hasard reproductible : les mêmes sprites à chaque exécution. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Écriture ----------

interface Made {
  name: string;
  width: number;
  height: number;
  ox: number;
  oy: number;
  /** Images par seconde. */
  fps: number;
  frames: Image[];
}

function write(made: Made[]): void {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, unknown>;
  let bytes = 0;
  for (const sprite of made) {
    const dir = path.join(SPRITES, sprite.name);
    mkdirSync(dir, { recursive: true });
    sprite.frames.forEach((frame, i) => {
      const png = encodePng(frame);
      bytes += png.length;
      writeFileSync(path.join(dir, `${i}.png`), png);
    });
    manifest[sprite.name] = {
      w: sprite.width, h: sprite.height, ox: sprite.ox, oy: sprite.oy, frames: sprite.frames.length,
      bbox: [0, 0, sprite.width - 1, sprite.height - 1], bboxmode: 0, colkind: 1, sepmasks: false, speed: sprite.fps, speedType: 0,
    };
    console.log(`${sprite.name} : ${sprite.frames.length} images de ${sprite.width} x ${sprite.height}, ${sprite.fps} par seconde`);
  }
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(MANIFEST, `${linesObject(sorted, '')}\n`);
  console.log(`${made.length} sprites fabriqués, ${Math.round(bytes / 1024)} ko.`);
}

// ---------- BatBot ----------

/** Origine des sprites de corps de BatBot (248 x 248), et celle des sprites fabriqués, plus grands. */
const BAT = { ox: 95, oy: 124 };
const SIZE = 320;
const MID = SIZE / 2;

/**
 * Lancement de l'ulti (2 s) : BatBot ramène ses battes en croix devant lui, l'énergie converge en spirale,
 * il tremble de plus en plus, puis il écarte les bras pour bondir. Les poses viennent de son déploiement.
 */
function batBotCast(): Made {
  const frames: Image[] = [];
  const count = 30;
  const rand = random(7);
  const sparks = Array.from({ length: 16 }, () => ({ angle: rand() * TAU, phase: rand(), size: 2 + rand() * 2.5, kind: Math.floor(rand() * 3) }));
  for (let i = 0; i < count; i++) {
    const p = i / (count - 1);
    const img = canvas(SIZE, SIZE);
    // pose : déploiement à rebours jusqu'aux battes croisées, tenue en tremblant, puis ouverture
    let pose: number;
    if (p < 0.25) pose = Math.round(33 - (33 - 12) * (p / 0.25));
    else if (p < 0.88) pose = 12 + Math.round(Math.sin(i * 1.9));
    else pose = Math.round(12 + (24 - 12) * ((p - 0.88) / 0.12));
    const shake = p < 0.25 ? 0 : 1 + 2.2 * p;
    const jx = Math.round((rand() - 0.5) * 2 * shake);
    const jy = Math.round((rand() - 0.5) * 2 * shake);

    // énergie derrière le robot : trois croissants qui se resserrent en tournant de plus en plus vite
    const turn = TAU * (1.1 * p + 2.4 * p * p);
    const radius = 122 - 56 * p;
    for (let k = 0; k < 3; k++) energyArc(img, MID, MID, radius, 4 + 9 * p, turn + (k * TAU) / 3, 1.45, 0.3 + 0.7 * p);
    if (p > 0.3) {
      const inner = (p - 0.3) / 0.7;
      for (let k = 0; k < 2; k++) crescent(img, MID, MID, 58 - 14 * inner, 2 + 4 * inner, -turn * 1.3 + k * Math.PI, 2.1, PINK, 0.25 + 0.5 * inner);
    }

    blit(img, loadFrame('spr_BatBot_deploy', pose), { x: MID + jx, y: MID + jy, ox: BAT.ox, oy: BAT.oy, tint: [MAGENTA, 0.32 * p * p] });

    // étincelles aspirées vers lui, par-dessus
    for (const s of sparks) {
      const life = (p * 3.2 + s.phase) % 1;
      const r = 150 - 118 * life;
      const a = s.angle + life * 1.6;
      disc(img, MID + Math.cos(a) * r, MID + Math.sin(a) * r, s.size * (1.2 - 0.6 * life), [MAGENTA, PINK, WHITE][s.kind], Math.min(1, p * 1.6) * (0.35 + 0.65 * life));
    }
    // au moment de partir : un éclat
    if (p > 0.9) {
      const k = (p - 0.9) / 0.1;
      for (let j = 0; j < 4; j++) crescent(img, MID, MID, 60 + 70 * k, 5 * (1 - k) + 2, j * (TAU / 4) + 0.4, 1.3, WHITE, 0.9 * (1 - k * 0.5));
    }
    frames.push(img);
  }
  return { name: 'spr_BatBot_ulti_cast', width: SIZE, height: SIZE, ox: MID, oy: MID, fps: 15, frames };
}

/**
 * Bond : BatBot tournoie, battes écartées, dans un anneau d'énergie. La pose de base est celle de son coup
 * de batte, où l'original dessine déjà les battes démultipliées par la vitesse.
 */
function batBotLeap(): Made {
  const frames: Image[] = [];
  const count = 8;
  const whirl = loadFrame('spr_BatBot_fire1_d', 0);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU;
    const img = canvas(SIZE, SIZE);
    // traînées grises du mouvement, puis l'anneau d'énergie
    for (let k = 0; k < 2; k++) crescent(img, MID, MID, 96, 5, angle + k * Math.PI + 0.5, 2.3, SMEAR, 0.4);
    for (let k = 0; k < 2; k++) energyArc(img, MID, MID, 122, 11, angle + k * Math.PI, 2.5, 0.95);
    blit(img, whirl, { x: MID, y: MID, ox: BAT.ox, oy: BAT.oy, angle, tint: [MAGENTA, 0.12] });
    frames.push(img);
  }
  return { name: 'spr_BatBot_ulti_leap', width: SIZE, height: SIZE, ox: MID, oy: MID, fps: 30, frames };
}

/** Atterrissage : éclair, anneau de choc qui s'élargit en se morcelant, traînées et éclats projetés. */
function batBotBlast(): Made {
  const size = 512;
  const mid = size / 2;
  const frames: Image[] = [];
  const count = 14;
  const rand = random(21);
  const rays = Array.from({ length: 14 }, (_, k) => ({ angle: (k / 14) * TAU + (rand() - 0.5) * 0.3, reach: 0.8 + rand() * 0.25, width: 3 + rand() * 4 }));
  const chips = Array.from({ length: 22 }, () => ({ angle: rand() * TAU, reach: 0.55 + rand() * 0.5, size: 2.5 + rand() * 3.5 }));
  for (let i = 0; i < count; i++) {
    const p = i / (count - 1);
    const ease = 1 - (1 - p) ** 3;
    const img = canvas(size, size);
    const radius = 52 + 186 * ease;
    // traînées grises projetées
    for (const ray of rays) {
      const c = Math.cos(ray.angle);
      const s = Math.sin(ray.angle);
      const r0 = radius * 0.5;
      const r1 = radius * ray.reach;
      streak(img, mid + c * r0, mid + s * r0, mid + c * r1, mid + s * r1, ray.width * (1 - p), 0.6, SMEAR, 0.55 * (1 - p));
    }
    // second anneau, rose, en retard sur le premier
    if (p > 0.12) {
      const q = (p - 0.12) / 0.88;
      const r2 = 30 + 150 * (1 - (1 - q) ** 3);
      for (let k = 0; k < 7; k++) crescent(img, mid, mid, r2, 9 * (1 - q) + 1.5, k * (TAU / 7) - 0.5 * p, (TAU / 7) * (0.9 - 0.45 * q), PINK, 0.85 * (1 - q));
    }
    // anneau de choc principal : cinq croissants qui s'écartent
    for (let k = 0; k < 5; k++) {
      energyArc(img, mid, mid, radius, 24 * (1 - p) ** 1.2 + 3, k * (TAU / 5) + 0.35 * p, (TAU / 5) * (0.97 - 0.5 * p), 1 - p ** 3);
    }
    // éclats sombres
    for (const chip of chips) {
      const r = 40 + 230 * ease * chip.reach;
      disc(img, mid + Math.cos(chip.angle) * r, mid + Math.sin(chip.angle) * r, chip.size * (1 - 0.5 * p), DARK, 1 - p);
    }
    // éclair central des premières images
    if (p < 0.4) {
      const q = p / 0.4;
      disc(img, mid, mid, 50 + 150 * q, MAGENTA, 0.55 * (1 - q));
      disc(img, mid, mid, 36 + 110 * q, PINK, 0.7 * (1 - q));
      disc(img, mid, mid, 24 + 70 * q, WHITE, 0.95 * (1 - q));
    }
    frames.push(img);
  }
  return { name: 'spr_BatBot_ulti_blast', width: size, height: size, ox: mid, oy: mid, fps: 30, frames };
}

/** Sol fissuré laissé par l'atterrissage. */
function batBotCrater(): Made {
  const size = 360;
  const mid = size / 2;
  const img = canvas(size, size);
  const rand = random(3);
  disc(img, mid, mid, 118, DARK, 0.1);
  disc(img, mid, mid, 74, DARK, 0.16);
  for (let k = 0; k < 10; k++) {
    let angle = (k / 10) * TAU + (rand() - 0.5) * 0.4;
    let x = mid + Math.cos(angle) * 14;
    let y = mid + Math.sin(angle) * 14;
    const steps = 4 + Math.floor(rand() * 3);
    for (let j = 0; j < steps; j++) {
      angle += (rand() - 0.5) * 0.9;
      const len = 20 + rand() * 22;
      const nx = x + Math.cos(angle) * len;
      const ny = y + Math.sin(angle) * len;
      const w = 3.2 * (1 - j / steps) + 0.5;
      streak(img, x, y, nx, ny, w, w * 0.7, DARK, 0.8);
      // une petite branche, de temps en temps
      if (rand() < 0.35) {
        const b = angle + (rand() < 0.5 ? 1 : -1) * (0.6 + rand() * 0.5);
        streak(img, x, y, x + Math.cos(b) * len * 0.6, y + Math.sin(b) * len * 0.6, w * 0.6, 0.4, DARK, 0.7);
      }
      x = nx;
      y = ny;
    }
  }
  return { name: 'spr_BatBot_ulti_crater', width: size, height: size, ox: mid, oy: mid, fps: 1, frames: [img] };
}

export function makeSprites(): void {
  write([batBotCast(), batBotLeap(), batBotBlast(), batBotCrater()]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) makeSprites();
