// Fabrique les sprites que le jeu d'origine n'a pas : les animations des attaques ultimes (GD-043).
//   node tools/make-sprites.ts
// Chaque animation est construite à partir des images existantes du robot (mêmes proportions, mêmes
// couleurs, même origine) auxquelles s'ajoutent des tracés d'énergie dans le style de l'original :
// aplats magenta à reflet rose, comme les arcs de ses coups de batte.
// Les images sont écrites dans public/assets/sprites et déclarées dans sprites.json.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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

/** Sprites fabriqués autrefois et abandonnés depuis : leurs images et leur entrée sont retirées. */
const RETIRED = ['spr_BadaBot_ulti_wall', 'spr_BadaBot_ulti_cast', 'spr_BadaBot_ulti_wave'];

function write(made: Made[]): void {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as Record<string, unknown>;
  for (const name of RETIRED) {
    rmSync(path.join(SPRITES, name), { recursive: true, force: true });
    delete manifest[name];
  }
  let bytes = 0;
  for (const sprite of made) {
    const dir = path.join(SPRITES, sprite.name);
    // on repart d'un dossier vide : une animation raccourcie ne garde pas ses anciennes images
    rmSync(dir, { recursive: true, force: true });
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

// ---------- Postures de lancement ----------
// Le sprite d'un robot ne contient que le robot (GD-044). Les effets d'énergie sont des sprites à part,
// dessinés en blanc pour être teintés à la couleur de chaque robot et superposés par le jeu.

/** Sprites de corps réutilisés : taille et origine de chacun. */
const BODY: Record<string, { size: number; ox: number; oy: number }> = {
  spr_BatBot_fire1_d: { size: 248, ox: 95, oy: 124 },
  spr_BatBot_deploy: { size: 248, ox: 95, oy: 124 },
  spr_PetBot_deploy: { size: 154, ox: 43, oy: 73 },
  spr_BadaBot_fire2: { size: 266, ox: 141, oy: 133 },
  spr_BadaBot_stand: { size: 266, ox: 130, oy: 132 },
  spr_EngiBot_shotTuret: { size: 168, ox: 59, oy: 83 },
};

/**
 * Posture de lancement d'un ulti : 16 images à 8 par seconde, soit les 2 s du lancement. Le robot prend la
 * pose en quelques images puis la tient, parfaitement immobile (GD-048) : un robot ne respire pas, c'est
 * l'énergie autour de lui qui s'anime. `sequence` : pour chaque image, le sprite d'origine et son numéro d'image.
 */
function castPose(name: string, sequence: [string, number][]): Made {
  const first = BODY[sequence[0][0]];
  const pad = 12;
  const size = first.size + pad * 2;
  const frames = sequence.map(([sprite, frame]) => {
    const body = BODY[sprite];
    const img = canvas(size, size);
    blit(img, loadFrame(sprite, frame), { x: first.ox + pad, y: first.oy + pad, ox: body.ox, oy: body.oy, scale: 1 });
    return img;
  });
  return { name, width: size, height: size, ox: first.ox + pad, oy: first.oy + pad, fps: 8, frames };
}

/** La même image tenue `count` fois. */
function held(sprite: string, frame: number, count: number): [string, number][] {
  return Array.from({ length: count }, (): [string, number] => [sprite, frame]);
}

/** BatBot : il lève ses battes, prêt à frapper (l'armé de son coup de batte), et ne bouge plus. */
function batBotCast(): Made {
  return castPose('spr_BatBot_ulti_cast', [['spr_BatBot_deploy', 33], ['spr_BatBot_fire1_d', 3], ...held('spr_BatBot_fire1_d', 4, 14)]);
}

/** PetBot : il tient sa position, immobile ; ce sont ses mini-bots qui s'animent autour de lui (GD-047). */
function petBotCast(): Made {
  return castPose('spr_PetBot_ulti_cast', held('spr_PetBot_deploy', 79, 16));
}

/** EngiBot : immobile, le bras armé, puis le geste du lancer sur les quatre dernières images. */
function engiBotCast(): Made {
  const toss: [string, number][] = [6, 9, 11, 13].map((f) => ['spr_EngiBot_shotTuret', f]);
  return castPose('spr_EngiBot_ulti_cast', [...held('spr_EngiBot_shotTuret', 0, 12), ...toss]);
}

// ---------- Effets communs, teintables ----------

const FX = 320;
const FXM = FX / 2;

/**
 * Énergie qui se concentre pendant le lancement, en deux calques blancs de 30 images (15 par seconde) :
 * le premier passe sous le robot (trois croissants qui se resserrent en tournant de plus en plus vite),
 * le second par-dessus (reflets, étincelles aspirées, éclat final).
 */
function ultiCharge(): Made[] {
  const count = 30;
  const under: Image[] = [];
  const above: Image[] = [];
  const rand = random(7);
  const sparks = Array.from({ length: 16 }, () => ({ angle: rand() * TAU, phase: rand(), size: 2 + rand() * 2.5 }));
  for (let i = 0; i < count; i++) {
    const p = i / (count - 1);
    const a = canvas(FX, FX);
    const b = canvas(FX, FX);
    const turn = TAU * (1.1 * p + 2.4 * p * p);
    const radius = 122 - 56 * p;
    const half = 4 + 9 * p;
    for (let k = 0; k < 3; k++) {
      const from = turn + (k * TAU) / 3;
      crescent(a, FXM, FXM, radius, half, from, 1.45, WHITE, 0.3 + 0.7 * p);
      crescent(b, FXM, FXM, radius - half * 0.35, half * 0.35, from + 1.45 * 0.12, 1.45 * 0.76, WHITE, 0.3 + 0.7 * p);
    }
    if (p > 0.3) {
      const inner = (p - 0.3) / 0.7;
      for (let k = 0; k < 2; k++) crescent(a, FXM, FXM, 58 - 14 * inner, 2 + 4 * inner, -turn * 1.3 + k * Math.PI, 2.1, WHITE, 0.2 + 0.4 * inner);
    }
    for (const s of sparks) {
      const life = (p * 3.2 + s.phase) % 1;
      const r = 150 - 118 * life;
      const angle = s.angle + life * 1.6;
      disc(b, FXM + Math.cos(angle) * r, FXM + Math.sin(angle) * r, s.size * (1.2 - 0.6 * life), WHITE, Math.min(1, p * 1.6) * (0.35 + 0.65 * life));
    }
    if (p > 0.9) {
      const k = (p - 0.9) / 0.1;
      for (let j = 0; j < 4; j++) crescent(b, FXM, FXM, 60 + 70 * k, 5 * (1 - k) + 2, j * (TAU / 4) + 0.4, 1.3, WHITE, 0.9 * (1 - k * 0.5));
    }
    under.push(a);
    above.push(b);
  }
  return [
    { name: 'spr_ulti_charge', width: FX, height: FX, ox: FXM, oy: FXM, fps: 15, frames: under },
    { name: 'spr_ulti_charge_top', width: FX, height: FX, ox: FXM, oy: FXM, fps: 15, frames: above },
  ];
}

/** Nuage de poussière : des volutes épaisses qui cachent le centre, s'écartent et se dissipent vite. */
function dustCloud(): Made {
  const size = 420;
  const mid = size / 2;
  const count = 14;
  const rand = random(11);
  const LIGHT: Rgb = [222, 216, 204];
  const SHADE: Rgb = [160, 154, 144];
  const puffs = Array.from({ length: 20 }, (_, k) => ({
    angle: (k / 20) * TAU * 3 + (rand() - 0.5) * 0.4, reach: k < 5 ? 0.12 * k : 0.5 + ((k * 7) % 10) / 20, size: (k < 5 ? 58 : 38) + rand() * 22, lag: rand() * 0.1,
  }));
  const frames: Image[] = [];
  for (let i = 0; i < count; i++) {
    const p = i / (count - 1);
    const img = canvas(size, size);
    for (const pass of [0, 1]) {
      for (const puff of puffs) {
        const q = Math.max(0, Math.min(1, (p - puff.lag) / (1 - puff.lag)));
        // dès la première image le nuage est épais et couvre le robot ; ensuite il s'écarte
        const ease = 0.3 + 0.7 * (1 - (1 - q) ** 2);
        const r = 150 * ease * puff.reach;
        const s = puff.size * (0.75 + 0.55 * ease) * (1 - 0.35 * q * q);
        const alpha = q < 0.35 ? 1 : Math.max(0, 1 - (q - 0.35) / 0.65);
        const x = mid + Math.cos(puff.angle) * r;
        const y = mid + Math.sin(puff.angle) * r;
        // d'abord le bord sombre de toutes les volutes, puis leur cœur clair : elles se fondent en un nuage
        if (pass === 0) disc(img, x, y, s + 3, SHADE, alpha);
        else disc(img, x - s * 0.08, y - s * 0.1, s * 0.86, LIGHT, alpha);
      }
    }
    frames.push(img);
  }
  return { name: 'spr_ulti_dust', width: size, height: size, ox: mid, oy: mid, fps: 20, frames };
}

// ---------- BatBot ----------

const BAT = { ox: 95, oy: 124 };

/**
 * Bond : BatBot tournoie, battes écartées, dans un anneau d'énergie. La pose de base est celle de son coup
 * de batte, où l'original dessine déjà les battes démultipliées par la vitesse.
 */
function batBotLeap(): Made {
  const frames: Image[] = [];
  const count = 8;
  const whirl = loadFrame('spr_BatBot_fire1_d', 2);
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU;
    const img = canvas(FX, FX);
    for (let k = 0; k < 2; k++) crescent(img, FXM, FXM, 96, 5, angle + k * Math.PI + 0.5, 2.3, SMEAR, 0.4);
    for (let k = 0; k < 2; k++) energyArc(img, FXM, FXM, 122, 11, angle + k * Math.PI, 2.5, 0.95);
    blit(img, whirl, { x: FXM, y: FXM, ox: BAT.ox, oy: BAT.oy, angle });
    frames.push(img);
  }
  return { name: 'spr_BatBot_ulti_leap', width: FX, height: FX, ox: FXM, oy: FXM, fps: 30, frames };
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
    for (const ray of rays) {
      const c = Math.cos(ray.angle);
      const s = Math.sin(ray.angle);
      streak(img, mid + c * radius * 0.5, mid + s * radius * 0.5, mid + c * radius * ray.reach, mid + s * radius * ray.reach, ray.width * (1 - p), 0.6, SMEAR, 0.55 * (1 - p));
    }
    if (p > 0.12) {
      const q = (p - 0.12) / 0.88;
      const r2 = 30 + 150 * (1 - (1 - q) ** 3);
      for (let k = 0; k < 7; k++) crescent(img, mid, mid, r2, 9 * (1 - q) + 1.5, k * (TAU / 7) - 0.5 * p, (TAU / 7) * (0.9 - 0.45 * q), PINK, 0.85 * (1 - q));
    }
    for (let k = 0; k < 5; k++) {
      energyArc(img, mid, mid, radius, 24 * (1 - p) ** 1.2 + 3, k * (TAU / 5) + 0.35 * p, (TAU / 5) * (0.97 - 0.5 * p), 1 - p ** 3);
    }
    for (const chip of chips) {
      const r = 40 + 230 * ease * chip.reach;
      disc(img, mid + Math.cos(chip.angle) * r, mid + Math.sin(chip.angle) * r, chip.size * (1 - 0.5 * p), DARK, 1 - p);
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

// ---------- PetBot : l'essaim de nanomachines ----------

/**
 * Essaim : des dizaines de nanomachines en orbite dans toute la zone de soin, dans les deux sens, suivies d'une
 * courte traînée. 24 images qui bouclent (chaque machine fait un nombre entier de tours). Blanc, teinté en vert
 * par le jeu. Pas de cercle dessiné : ce sont les mini-bots de PetBot qui tracent les leurs (GD-047).
 */
function petBotNanos(): Made {
  const size = 512;
  const mid = size / 2;
  const count = 24;
  const rand = random(5);
  const bots = Array.from({ length: 84 }, () => ({
    // répartis à surface égale entre le pied de PetBot et le bord de la zone
    angle: rand() * TAU, radius: Math.sqrt(64 ** 2 + rand() * (240 ** 2 - 64 ** 2)), turns: (rand() < 0.5 ? 1 : -1) * (rand() < 0.3 ? 2 : 1), size: 2.2 + rand() * 2.6, bright: 0.55 + rand() * 0.45,
  }));
  const frames: Image[] = [];
  for (let i = 0; i < count; i++) {
    const p = i / count;
    const img = canvas(size, size);
    for (const bot of bots) {
      const angle = bot.angle + p * TAU * bot.turns;
      const wobble = bot.radius + 6 * Math.sin(p * TAU * 2 + bot.angle * 5);
      // traînée derrière la machine, puis la machine : un petit losange
      crescent(img, mid, mid, wobble, bot.size * 0.5, angle - (bot.turns > 0 ? 0.16 : 0), 0.16, WHITE, bot.bright * 0.45);
      const x = mid + Math.cos(angle) * wobble;
      const y = mid + Math.sin(angle) * wobble;
      fill(img, [x - bot.size - 1, y - bot.size - 1, x + bot.size + 1, y + bot.size + 1], (px, py) => Math.abs(px - x) + Math.abs(py - y) - bot.size, WHITE, bot.bright);
    }
    frames.push(img);
  }
  return { name: 'spr_PetBot_ulti_nanos', width: size, height: size, ox: mid, oy: mid, fps: 24, frames };
}

// ---------- EngiBot : la grenade électromagnétique ----------

/** Grenade : une cartouche aux couleurs d'EngiBot, qui tourne ; son voyant bleu clignote. */
function engiBotGrenade(): Made {
  const size = 72;
  const mid = size / 2;
  const RED: Rgb = [226, 96, 106];
  const SHADOW: Rgb = [150, 52, 62];
  const BLUE: Rgb = [96, 200, 255];
  const count = 8;
  const frames: Image[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const img = canvas(size, size);
    // corps : une gélule, contour sombre comme les robots
    streak(img, mid - c * 12, mid - s * 12, mid + c * 12, mid + s * 12, 13, 13, DARK, 1);
    streak(img, mid - c * 12, mid - s * 12, mid + c * 12, mid + s * 12, 10.5, 10.5, RED, 1);
    streak(img, mid - c * 12 + s * 4, mid - s * 12 - c * 4, mid + c * 12 + s * 4, mid + s * 12 - c * 4, 3, 3, SHADOW, 0.8);
    // bague et voyant
    streak(img, mid - s * 11, mid + c * 11, mid + s * 11, mid - c * 11, 3, 3, DARK, 1);
    disc(img, mid, mid, 7, DARK, 1);
    disc(img, mid, mid, 5, i % 2 === 0 ? BLUE : WHITE, 1);
    frames.push(img);
  }
  return { name: 'spr_EngiBot_ulti_grenade', width: size, height: size, ox: mid, oy: mid, fps: 16, frames };
}

/**
 * Impulsion : un anneau d'éclairs brisés qui s'élargit, doublé d'un second, avec des décharges radiales.
 * 16 images. Blanc, teinté en bleu électrique par le jeu, qui l'étire jusqu'au rayon de la grenade.
 */
function engiBotPulse(): Made {
  const size = 512;
  const mid = size / 2;
  const count = 16;
  const rand = random(17);
  const frames: Image[] = [];
  /** Anneau en zigzag : des segments droits dont le rayon saute d'un point au suivant. */
  const jagged = (img: Image, radius: number, jitter: number, half: number, alpha: number, points: number): void => {
    let prev: [number, number] | null = null;
    let first: [number, number] | null = null;
    for (let k = 0; k <= points; k++) {
      const a = (k / points) * TAU;
      const r = radius + (k === points ? 0 : (rand() - 0.5) * 2 * jitter);
      const pt: [number, number] = k === points && first ? first : [mid + Math.cos(a) * r, mid + Math.sin(a) * r];
      if (prev) streak(img, prev[0], prev[1], pt[0], pt[1], half, half, WHITE, alpha);
      else first = pt;
      prev = pt;
    }
  };
  for (let i = 0; i < count; i++) {
    const p = i / (count - 1);
    const ease = 1 - (1 - p) ** 2.4;
    const img = canvas(size, size);
    const radius = 26 + 214 * ease;
    const fade = 1 - p ** 2;
    if (p < 0.3) disc(img, mid, mid, 30 + 120 * (p / 0.3), WHITE, 0.85 * (1 - p / 0.3));
    jagged(img, radius, 9, 3.2 * (1 - 0.6 * p), fade, 40);
    jagged(img, radius * 0.72, 7, 2 * (1 - 0.6 * p), fade * 0.7, 30);
    if (p > 0.15) jagged(img, radius * 0.45, 6, 1.4, fade * 0.45, 22);
    // décharges : des éclairs courts qui partent de l'anneau
    for (let k = 0; k < 12; k++) {
      const a = rand() * TAU;
      let r = radius * (0.75 + rand() * 0.2);
      let x = mid + Math.cos(a) * r;
      let y = mid + Math.sin(a) * r;
      for (let j = 0; j < 3; j++) {
        r += 9 + rand() * 9;
        const b = a + (rand() - 0.5) * 0.25;
        const nx = mid + Math.cos(b) * r;
        const ny = mid + Math.sin(b) * r;
        streak(img, x, y, nx, ny, 1.5, 0.6, WHITE, fade * 0.9);
        x = nx;
        y = ny;
      }
    }
    frames.push(img);
  }
  return { name: 'spr_EngiBot_ulti_pulse', width: size, height: size, ox: mid, oy: mid, fps: 30, frames };
}

// ---------- EngiBot : le rechargement ----------

/**
 * Rechargement d'EngiBot (GD-071) : son fusil en accordéon se comprime puis se détend. Tout est tiré de sa
 * posture de tir d'origine (`spr_EngiBot_shot`, image 0), redessinée image par image :
 *  - le soufflet (les blocs et les anneaux entre la crosse et le canon) est écrasé vers la crosse, et gonfle un
 *    peu en hauteur ; le canon, rigide, recule d'autant ;
 *  - le bras droit, qui tient le canon, suit le mouvement : il pivote autour de l'épaule ;
 *  - le reste du robot ne bouge pas (un robot ne respire pas, GD-048).
 * Déroulé : le fusil claque en arrière, tient comprimé pendant que le soufflet chauffe par crans, puis se
 * détend d'un coup en dépassant sa longueur, crache de la vapeur et un anneau de lumière au canon, et se
 * stabilise.
 */
function engiBotReload(): Made {
  const base = loadFrame('spr_EngiBot_shot', 0);
  const body = { size: 168, ox: 59, oy: 83 };
  const pad = 12;
  const size = body.size + pad * 2;
  const count = 28;
  // repères relevés sur le sprite, en pixels de l'image d'origine
  const fold0 = 52; // début du soufflet, contre la crosse : ce point ne bouge pas
  const fold1 = 96; // fin du soufflet : au-delà, le canon rigide
  const mid = 140.5; // axe du fusil
  const muzzle = 121;
  const HEAT: Rgb = [255, 214, 120];
  const STEAM: Rgb = [236, 236, 242];
  const SPARK: Rgb = [255, 240, 190];

  /** Le fusil : crosse, soufflet et canon. Les anneaux du soufflet dépassent un peu plus haut que les blocs. */
  const isGun = (x: number, y: number): boolean => {
    if (x < 51 || x > 122 || y > 153) return false;
    if (x <= 60) return y >= 128;
    return y >= (x <= 98 ? 127 : 129);
  };
  /** Le bras droit : l'avant-bras, à droite du corps, et le bout du bras qui passe sous lui. */
  const isArm = (x: number, y: number): boolean =>
    (x >= 99 && y >= 72 && y <= 128) || (x >= 91 && x <= 98 && y >= 99 && y <= 108 && Math.hypot(x - 58, y - 84) > 41.5);
  /** Le trait commun au corps et au bras, le long du disque : il reste aussi avec le corps. */
  const shared = (x: number, y: number): boolean => x === 99 && y <= 97;

  /** Couleur de l'image d'origine en (u, v), interpolée, en ne gardant que les pixels de `part`. */
  const sample = (u: number, v: number, part: (x: number, y: number) => boolean): [number, number, number, number] => {
    const x = Math.floor(u);
    const y = Math.floor(v);
    const fx = u - x;
    const fy = v - y;
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    for (const [px, py, w] of [[x, y, (1 - fx) * (1 - fy)], [x + 1, y, fx * (1 - fy)], [x, y + 1, (1 - fx) * fy], [x + 1, y + 1, fx * fy]]) {
      if (w <= 0 || px < 0 || py < 0 || px >= base.width || py >= base.height || !part(px, py)) continue;
      const i = (py * base.width + px) * 4;
      const wa = (base.data[i + 3] / 255) * w;
      r += base.data[i] * wa;
      g += base.data[i + 1] * wa;
      b += base.data[i + 2] * wa;
      a += wa;
    }
    return a > 0 ? [r / a, g / a, b / a, a] : [0, 0, 0, 0];
  };

  /** Longueur du soufflet (1 au repos) à l'instant t, de 0 à 1. */
  const squeeze = (t: number): number => {
    if (t < 0.1) return 1 - 0.42 * (t / 0.1) ** 2; // il claque en arrière, de plus en plus vite
    if (t < 0.18) {
      const u = (t - 0.1) / 0.08;
      return 0.62 - 0.04 * Math.cos(u * TAU) * (1 - u); // petit rebond contre la butée
    }
    if (t < 0.6) return 0.62 - 0.04 * ((t - 0.18) / 0.42); // tenu : la pression monte encore un peu
    if (t < 0.68) {
      const u = (t - 0.6) / 0.08;
      return 0.58 + 0.54 * (1 - (1 - u) ** 3); // il se détend d'un coup et dépasse sa longueur
    }
    if (t < 0.9) {
      const u = (t - 0.68) / 0.22;
      return 1 + 0.12 * Math.exp(-4 * u) * Math.cos(u * TAU * 1.5); // puis oscille en s'amortissant
    }
    return 1;
  };
  /** Chaleur du soufflet : elle monte par trois crans pendant qu'il est comprimé, puis retombe. */
  const heat = (t: number): number => {
    if (t < 0.14) return 0;
    if (t < 0.6) {
      const u = (t - 0.14) / 0.46;
      const step = Math.min(2, Math.floor(u * 3));
      const within = u * 3 - step;
      return (step + Math.min(1, within / 0.35)) / 3;
    }
    return Math.max(0, 1 - (t - 0.6) / 0.2);
  };

  const frames = Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const c = squeeze(t);
    const shift = (fold1 - fold0) * (1 - c); // recul du canon
    const bulge = 1 + 0.1 * Math.max(0, 1 - c) / 0.42; // le soufflet écrasé gonfle en hauteur
    const hot = heat(t);
    const flash = t >= 0.6 && t < 0.68 ? 1 - (t - 0.6) / 0.08 : 0;
    const img = canvas(size, size);

    // 1. le bras droit, dessous : il pivote pour que la main reste sur le canon
    for (let y = 70; y <= 129; y++) {
      const k = Math.max(0, Math.min(1, (y - 76) / 50));
      for (let x = 70; x <= 128; x++) {
        const [r, g, b, a] = sample(x + shift * k, y, isArm);
        if (a > 0) over(img, x + pad, y + pad, [r, g, b], a);
      }
    }
    // 2. le corps, inchangé, sans le bras ni le fusil
    for (let y = 0; y < base.height; y++) {
      for (let x = 0; x < base.width; x++) {
        if (isGun(x, y) || (isArm(x, y) && !shared(x, y))) continue;
        const i = (y * base.width + x) * 4;
        const a = base.data[i + 3] / 255;
        if (a > 0) over(img, x + pad, y + pad, [base.data[i], base.data[i + 1], base.data[i + 2]], a);
      }
    }
    // 3. le fusil : crosse fixe, soufflet écrasé, canon reculé
    const foldEnd = fold0 + (fold1 - fold0) * c;
    for (let y = 122; y <= 158; y++) {
      for (let x = 50; x <= 130; x++) {
        let u = x;
        let v = y;
        const folded = x >= fold0 && x < foldEnd;
        if (folded) {
          u = fold0 + (x - fold0) / c;
          v = mid + (y + 0.5 - mid) / bulge - 0.5;
        } else if (x >= foldEnd) {
          u = x + shift;
        }
        let [r, g, b, a] = sample(u, v, isGun);
        if (a <= 0) continue;
        // le métal du soufflet rougit puis blanchit ; les traits noirs restent noirs
        if (folded && r + g + b > 300) {
          const k = hot * 0.6;
          r += (HEAT[0] - r) * k;
          g += (HEAT[1] - g) * k;
          b += (HEAT[2] - b) * k;
          r += (255 - r) * flash * 0.5;
          g += (255 - g) * flash * 0.5;
          b += (255 - b) * flash * 0.5;
        }
        over(img, x + pad, y + pad, [r, g, b], a);
      }
    }
    // 4. la détente : vapeur chassée du soufflet, de part et d'autre, et anneau de lumière au canon
    const sinceRelease = (t - 0.6) / 0.3;
    if (sinceRelease >= 0 && sinceRelease < 1) {
      const next = random(71);
      for (let i = 0; i < 8; i++) {
        const side = i % 2 === 0 ? -1 : 1;
        const along = fold0 + 6 + next() * (fold1 - fold0 - 10);
        const reach = 9 + next() * 12;
        const drift = -4 - next() * 9; // la vapeur part aussi un peu vers l'arrière
        const life = 0.55 + next() * 0.45;
        const u = sinceRelease / life;
        if (u >= 1) continue;
        const e = 1 - (1 - u) ** 2;
        disc(img, along + drift * e + pad, mid + side * (13 + reach * e) + pad, 2.5 + 6 * e, STEAM, 0.6 * (1 - u) ** 1.3);
      }
    }
    const ring = (t - 0.62) / 0.14;
    if (ring >= 0 && ring < 1) {
      const cx = muzzle - shift + 5 + pad;
      const cy = mid + pad;
      const radius = 4 + 13 * ring;
      const half = 2.4 * (1 - ring) + 0.6;
      fill(img, [cx - radius - 4, cy - radius - 4, cx + radius + 4, cy + radius + 4],
        (x, y) => Math.abs(Math.hypot((x - cx) * 1.5, y - cy) - radius) - half, SPARK, 0.9 * (1 - ring));
    }
    return img;
  });
  return { name: 'spr_EngiBot_reload', width: size, height: size, ox: body.ox + pad, oy: body.oy + pad, fps: 20, frames };
}

// ---------- PetBot : le rechargement ----------

/**
 * Rechargement de PetBot (GD-072) : une transfusion. PetBot est le soigneur ; un tuyau annelé relie son dos,
 * frappé d'une croix rouge, à son arme, dont le canon porte trois voyants. Il se recharge en pompant trois
 * doses de sérum de son dos vers son arme. Tout est tiré de sa posture de repos (`spr_PetBot_move`, image 0) :
 *  - la culasse, sous le canon, recule, et les trois voyants s'éteignent d'avant en arrière ;
 *  - trois fois de suite, la croix de son dos s'illumine, une dose verte file le long du tuyau jusqu'à l'arme,
 *    et un voyant s'allume en vert, d'arrière en avant ;
 *  - la culasse claque en avant, les trois voyants jettent un éclat et reviennent au rouge : l'arme est prête.
 * La dernière image est sa posture de repos, à l'identique.
 */
function petBotReload(): Made {
  const base = loadFrame('spr_PetBot_move', 0);
  const size = 154;
  const count = 24;
  const SERUM: Rgb = [112, 255, 146];
  const SERUM_CORE: Rgb = [230, 255, 236];
  const OFF: Rgb = [38, 50, 42];
  const GLOW: Rgb = [255, 96, 104];
  // repères relevés sur le sprite
  const lights = [{ x: 93, y: 96.5 }, { x: 111.5, y: 96.5 }, { x: 130, y: 96.5 }]; // voyants, de l'arrière vers l'avant
  const cross = { x: 17.5, y: 72.5 };
  /** Axe du tuyau, du dos jusqu'à l'arme. */
  const hose = [[17.5, 86], [19, 90], [22.5, 95], [26, 100], [29.5, 105], [33.5, 110], [38.5, 114], [44.5, 118.5], [51.5, 121.5], [60, 122.5], [69, 122], [77, 121], [83, 120.5]];
  const lengths = hose.map((p, i) => (i === 0 ? 0 : Math.hypot(p[0] - hose[i - 1][0], p[1] - hose[i - 1][1])));
  const total = lengths.reduce((a, b) => a + b, 0);
  /** Point du tuyau à `d` pixels de son départ. */
  const along = (d: number): { x: number; y: number } => {
    let left = Math.max(0, Math.min(total, d));
    for (let i = 1; i < hose.length; i++) {
      if (left <= lengths[i] || i === hose.length - 1) {
        const k = lengths[i] > 0 ? Math.min(1, left / lengths[i]) : 0;
        return { x: hose[i - 1][0] + (hose[i][0] - hose[i - 1][0]) * k, y: hose[i - 1][1] + (hose[i][1] - hose[i - 1][1]) * k };
      }
      left -= lengths[i];
    }
    return { x: hose[0][0], y: hose[0][1] };
  };
  /** La culasse : le bloc qui coulisse sous le canon. */
  const isSlide = (x: number, y: number): boolean => x >= 100 && x <= 116 && y >= 104 && y <= 113;
  const pixel = (x: number, y: number): [number, number, number, number] => {
    if (x < 0 || y < 0 || x >= base.width || y >= base.height) return [0, 0, 0, 0];
    const i = (y * base.width + x) * 4;
    return [base.data[i], base.data[i + 1], base.data[i + 2], base.data[i + 3] / 255];
  };

  const travel = 0.2; // part du rechargement que met une dose à parcourir le tuyau
  const arrivals = [0.31, 0.6, 0.88];
  const lockAt = 0.9;

  const frames = Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    const img = canvas(size, size);
    // recul de la culasse : elle recule au début, reste en arrière, puis claque en avant et dépasse d'un pixel
    let back = 6;
    if (t < 0.02) back = 0;
    else if (t < 0.09) back = 6 * (1 - (1 - (t - 0.02) / 0.07) ** 2);
    else if (t >= lockAt) {
      const u = Math.min(1, (t - lockAt) / 0.05);
      back = u < 1 ? 6 * (1 - u) ** 2 - 1.2 * Math.sin(u * Math.PI) : 0;
    }
    back = Math.round(back);
    // 1. la culasse, dessous : elle rentre sous le raccord de l'arme
    for (let y = 104; y <= 113; y++) {
      for (let x = 92; x <= 118; x++) {
        if (!isSlide(x + back, y)) continue;
        const [r, g, b, a] = pixel(x + back, y);
        if (a > 0) over(img, x, y, [r, g, b], a);
      }
    }
    // 2. le robot, sans sa culasse
    for (let y = 0; y < base.height; y++) {
      for (let x = 0; x < base.width; x++) {
        if (isSlide(x, y)) continue;
        const [r, g, b, a] = pixel(x, y);
        if (a > 0) over(img, x, y, [r, g, b], a);
      }
    }
    // 3. les voyants du canon : éteints d'avant en arrière, puis rallumés en vert un à un par les doses
    lights.forEach((light, i) => {
      const offAt = 0.03 + (2 - i) * 0.03;
      if (t < offAt || t >= 0.97) return; // rouge d'origine
      if (t >= 0.93) {
        // l'éclat final : blanc, qui retombe sur le rouge d'origine
        const u = (t - 0.93) / 0.04;
        disc(img, light.x, light.y, 6 * (1 - u * 0.4), WHITE, 0.55 * (1 - u));
        disc(img, light.x, light.y, 2.3, WHITE, 1 - u);
        return;
      }
      const since = t - arrivals[i];
      if (since < 0) {
        disc(img, light.x, light.y, 2.3, OFF, 1);
        return;
      }
      const pop = Math.max(0, 1 - since / 0.07);
      disc(img, light.x, light.y, 4.6 + 3 * pop, SERUM, 0.28 + 0.4 * pop);
      disc(img, light.x, light.y, 2.3, SERUM, 1);
      disc(img, light.x, light.y, 1.2, SERUM_CORE, 0.7 + 0.3 * pop);
    });
    // 4. la croix du dos s'illumine au départ de chaque dose
    for (const arrival of arrivals) {
      const u = (t - (arrival - travel)) / 0.1;
      if (u < 0 || u >= 1) continue;
      disc(img, cross.x, cross.y, 11, GLOW, 0.3 * (1 - u));
      for (let y = 64; y <= 81; y++) {
        for (let x = 9; x <= 25; x++) {
          const [r, g] = pixel(x, y);
          if (r > 180 && g < 110) over(img, x, y, [255, 236, 236], 0.75 * (1 - u));
        }
      }
    }
    // 5. les doses : une goutte lumineuse qui file le long du tuyau, avec sa traînée
    for (const arrival of arrivals) {
      const u = (t - (arrival - travel)) / travel;
      if (u < 0 || u >= 1) continue;
      const d = u * total;
      const appear = Math.min(1, u / 0.12);
      for (let k = 5; k >= 1; k--) {
        const p = along(d - k * 3.2);
        if (d - k * 3.2 < 0) continue;
        disc(img, p.x, p.y, 5 - k * 0.6, SERUM, 0.5 * (1 - k / 6) * appear);
      }
      const head = along(d);
      disc(img, head.x, head.y, 5.6, SERUM, 0.9 * appear);
      disc(img, head.x, head.y, 2.9, SERUM_CORE, 0.95 * appear);
    }
    // la dose entre dans l'arme : un éclat au bout du tuyau
    for (const arrival of arrivals) {
      const u = (t - arrival) / 0.07;
      if (u < 0 || u >= 1) continue;
      const end = along(total);
      disc(img, end.x + 2, end.y, 6 + 3 * u, SERUM, 0.55 * (1 - u));
    }
    // 6. la culasse claque : une étincelle à son bout
    const spark = (t - (lockAt + 0.03)) / 0.07;
    if (spark >= 0 && spark < 1) disc(img, 117, 108.5, 2.5 + 3 * spark, WHITE, 0.85 * (1 - spark));
    return img;
  });
  return { name: 'spr_PetBot_reload', width: size, height: size, ox: 43, oy: 73, fps: 20, frames };
}

export function makeSprites(): void {
  write([
    batBotCast(), petBotCast(), engiBotCast(), engiBotReload(), petBotReload(),
    ...ultiCharge(), dustCloud(),
    batBotLeap(), batBotBlast(), batBotCrater(),
    petBotNanos(), engiBotGrenade(), engiBotPulse(),
  ]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) makeSprites();
