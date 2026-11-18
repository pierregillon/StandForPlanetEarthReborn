// Fabrique les sprites de la borne de recharge et des cartes d'accès (GD-097, ADR-015). Le jeu les dessinait
// par le code au lancement : ce sont maintenant des images comme les autres, que l'éditeur de niveaux et le
// jeu montrent à l'identique. Le dessin est celui d'avant, repris trait pour trait.
// Usage : npm run make-pickups
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAU, arc, canvas, line, polygon, rect, roundRect } from './lib/draw.ts';
import type { Pt, Rgb } from './lib/draw.ts';
import { linesObject } from './lib/output.ts';
import { encodePng } from './lib/png.ts';
import type { Image } from './lib/png.ts';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ASSETS = path.join(ROOT, 'public', 'assets');

interface Made {
  name: string;
  frames: Image[];
  ox: number;
  oy: number;
}

const rgb = (hex: number): Rgb => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const disc = (cx: number, cy: number, r: number): Pt[] => arc(cx, cy, r, r, 0, TAU, 48);

/**
 * Borne de recharge (GD-006, GD-029) : un boîtier posé au sol, un éclair, et un voyant vert tant qu'elle a de
 * la réserve (image 0), rouge une fois vidée (image 1, GD-031).
 */
function outlet(): Made {
  const frame = (led: number, halo: number): Image => {
    const img = canvas(96, 96);
    polygon(img, disc(48, 50, 44), rgb(0x10141c), 0.55);
    polygon(img, roundRect(14, 14, 68, 68, 12), rgb(0x2a3140));
    line(img, roundRect(14, 14, 68, 68, 12), 4, rgb(0x8b96ad), 1, true);
    polygon(img, roundRect(24, 24, 48, 48, 8), rgb(0x151a24));
    polygon(img, [[52, 28], [36, 52], [47, 52], [43, 70], [61, 44], [50, 44]], rgb(0xffd23c));
    polygon(img, disc(72, 22, 10), rgb(halo));
    polygon(img, disc(72, 22, 7), rgb(led));
    polygon(img, disc(70, 20, 2.5), [255, 255, 255], 0.7);
    return img;
  };
  return { name: 'spr_outlet', frames: [frame(0x4dff88, 0x1f8a45), frame(0xff3030, 0x7a1010)], ox: 48, oy: 48 };
}

/** Carte d'accès (GD-029) : une carte à puce de la couleur de la porte qu'elle ouvre, bande magnétique et liseré blanc. */
function card(color: string, base: number): Made {
  const img = canvas(96, 68);
  polygon(img, roundRect(6, 8, 88, 58, 10), [0, 0, 0], 0.35);
  polygon(img, roundRect(2, 2, 88, 58, 10), rgb(base));
  // reflet du haut : coins arrondis en haut, bord droit en bas
  const sheen: Pt[] = [...arc(12, 12, 10, 10, Math.PI, Math.PI * 1.5, 12), ...arc(80, 12, 10, 10, Math.PI * 1.5, TAU, 12), [90, 24], [2, 24]];
  polygon(img, sheen, [255, 255, 255], 0.28);
  polygon(img, rect(2, 30, 88, 10), rgb(0x10141c), 0.85);
  polygon(img, roundRect(12, 10, 22, 16, 4), rgb(0xffd23c));
  line(img, roundRect(12, 10, 22, 16, 4), 2, rgb(0x8a6a00), 1, true);
  line(img, [[23, 10], [23, 26]], 2, rgb(0x8a6a00));
  line(img, [[12, 18], [34, 18]], 2, rgb(0x8a6a00));
  for (const x of [48, 60, 72]) polygon(img, disc(x, 50, 4), [255, 255, 255], 0.9);
  line(img, roundRect(2, 2, 88, 58, 10), 4, [255, 255, 255], 0.95, true);
  return { name: `spr_card_${color}`, frames: [img], ox: 48, oy: 34 };
}

function write(made: Made[]): void {
  const file = path.join(ASSETS, 'sprites.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  let bytes = 0;
  for (const m of made) {
    const dir = path.join(ASSETS, 'sprites', m.name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    m.frames.forEach((frame, i) => {
      const png = encodePng(frame);
      bytes += png.length;
      writeFileSync(path.join(dir, `${i}.png`), png);
    });
    const { width, height } = m.frames[0];
    manifest[m.name] = {
      w: width, h: height, ox: m.ox, oy: m.oy, frames: m.frames.length,
      bbox: [0, 0, width - 1, height - 1], bboxmode: 0, colkind: 1, sepmasks: false, speed: 0, speedType: 0,
    };
    console.log(`${m.name} : ${m.frames.length} image(s) de ${width} x ${height}`);
  }
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(file, `${linesObject(sorted, '')}\n`);
  console.log(`${made.length} sprites fabriqués, ${Math.round(bytes / 1024)} ko.`);
}

write([outlet(), card('green', 0x35d05a), card('purple', 0xb04cff)]);
