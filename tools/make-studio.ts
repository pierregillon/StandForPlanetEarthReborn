// Fabrique les sprites du plateau de TvTv² que le jeu d'origine n'avait pas (GD-081, ADR-015) : le portrait
// du présentateur, le mobilier du studio et son sol. Tout est dessiné par le code, dans le style du jeu :
// aplats, contour à l'encre, usure mouchetée ; le logo de la chaîne est repris du sprite d'origine.
// Usage : npm run make-studio
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TAU, arc, band, bezier, canvas, clipDisc, line, paste, polygon, put, random, rect, rotate, roundRect, shape, speckle } from './lib/draw.ts';
import type { Pt, Rgb } from './lib/draw.ts';
import { linesObject } from './lib/output.ts';
import { decodePng, encodePng } from './lib/png.ts';
import type { Image } from './lib/png.ts';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const ASSETS = path.join(ROOT, 'public', 'assets');

const INK: Rgb = [22, 18, 28];
/** Contour du mobilier d'origine : plus fin et moins noir que celui des portraits. */
const LINE: Rgb = [46, 44, 52];

interface Made {
  name: string;
  image: Image;
  ox: number;
  oy: number;
  /** Boîte de collision [gauche, haut, droite, bas] ; l'image entière par défaut. */
  bbox?: [number, number, number, number];
}

function sprite(name: string, frame = 0): Image {
  return decodePng(readFileSync(path.join(ASSETS, 'sprites', name, `${frame}.png`)));
}

// ---------- Le portrait du présentateur ----------

/**
 * Même format que les portraits des robots (spr_cadre_*) : un buste de bande dessinée, cerné d'un trait
 * noir épais, ombré en aplats francs, dont le bas s'inscrit dans un disque.
 */
function anchorPortrait(): Made {
  const img = canvas(143, 167);
  const skin: Rgb = [244, 200, 164], skinShade: Rgb = [214, 160, 126], skinDeep: Rgb = [182, 126, 100];
  const hair: Rgb = [92, 58, 36], hairLight: Rgb = [134, 90, 54], hairDark: Rgb = [60, 36, 26];
  const suit: Rgb = [58, 98, 184], suitShade: Rgb = [40, 70, 140], suitDark: Rgb = [28, 50, 104];
  const shirt: Rgb = [240, 242, 246], shirtShade: Rgb = [198, 206, 222];
  const tie: Rgb = [208, 58, 58], tieShade: Rgb = [156, 36, 44];

  // le costume, épaules larges
  shape(img, [[-6, 172], [-6, 132], [8, 118], [30, 108], [50, 100], [60, 106], [71, 112], [82, 106], [92, 100], [113, 108], [135, 118], [149, 132], [149, 172]], suit, INK, 3.4);
  polygon(img, [[92, 100], [113, 108], [135, 118], [149, 132], [149, 172], [102, 172], [108, 140], [100, 120]], suitShade);
  polygon(img, [[-6, 150], [20, 138], [36, 172], [-6, 172]], suitShade);
  // la chemise et la cravate
  shape(img, [[58, 100], [71, 146], [84, 100], [78, 94], [64, 94]], shirt, INK, 2.4);
  polygon(img, [[72, 104], [84, 100], [72, 144]], shirtShade);
  shape(img, [[68, 112], [74, 112], [79, 150], [71, 162], [63, 150]], tie, INK, 2.2);
  polygon(img, [[71, 113], [74, 113], [78, 150], [71, 160]], tieShade);
  shape(img, [[65, 104], [77, 104], [75, 113], [67, 113]], tie, INK, 2.2);
  // les revers
  shape(img, [[50, 100], [60, 106], [70, 142], [57, 152], [43, 122]], suitShade, INK, 2.6);
  shape(img, [[92, 100], [82, 106], [72, 142], [85, 152], [99, 122]], suitDark, INK, 2.6);
  // le col
  shape(img, [[56, 97], [66, 104], [61, 116], [53, 104]], shirt, INK, 2.2);
  shape(img, [[86, 97], [76, 104], [81, 116], [89, 104]], shirtShade, INK, 2.2);
  // micro-cravate
  shape(img, rect(88, 126, 6, 10), INK, INK, 0);
  line(img, [[91, 136], [93, 150], [88, 166]], 1.6, INK);

  // le cou
  shape(img, [[59, 78], [83, 78], [84, 100], [71, 110], [58, 100]], skinShade, INK, 2.6);
  polygon(img, [[60, 84], [82, 84], [80, 94], [71, 98], [62, 94]], skinDeep);

  // les oreilles, puis le visage
  shape(img, [[41, 50], [47, 47], [48, 65], [43, 63]], skin, INK, 2.4);
  shape(img, [[96, 47], [102, 50], [100, 63], [95, 65]], skinShade, INK, 2.4);
  const face: Pt[] = [[47, 42], [50, 30], [60, 22], [82, 22], [92, 30], [96, 44], [96, 64], [91, 78], [82, 88], [71, 92], [60, 88], [51, 78], [46, 64]];
  polygon(img, face, skin);
  polygon(img, [[87, 26], [92, 30], [96, 44], [96, 64], [91, 78], [82, 88], [71, 92], [77, 83], [85, 72], [89, 54], [87, 40]], skinShade);
  line(img, face, 3.2, INK, 1, true);

  // les cheveux, raie sur le côté et mèche relevée
  const mane: Pt[] = [[42, 50], [41, 30], [49, 15], [64, 7], [85, 5], [99, 13], [105, 30], [101, 50], [96, 45], [94, 33], [84, 27], [70, 31], [58, 27], [51, 35], [47, 48]];
  polygon(img, mane, hair);
  polygon(img, [[91, 10], [99, 13], [105, 30], [101, 50], [96, 45], [94, 33], [88, 24]], hairDark);
  polygon(img, [[53, 18], [66, 11], [83, 10], [73, 16], [60, 23]], hairLight);
  line(img, mane, 3.2, INK, 1, true);
  line(img, [[58, 27], [62, 18], [72, 13]], 1.8, INK);

  // le visage : sourcils, yeux, nez, sourire de présentateur
  line(img, [[52, 46], [59, 43], [66, 46]], 3.2, INK);
  line(img, [[76, 46], [83, 43], [90, 46]], 3.2, INK);
  for (const cx of [60, 83]) {
    shape(img, [[cx - 7, 53], [cx, 50], [cx + 7, 53], [cx, 57]], [255, 255, 255], INK, 1.8);
    polygon(img, arc(cx + 0.5, 53.4, 2.7, 2.7, 0, TAU, 16), INK);
  }
  polygon(img, [[72, 55], [77, 66], [74, 69], [70, 67]], skinShade);
  line(img, [[71, 53], [69, 66], [74, 69]], 2, INK);
  shape(img, [[60, 74], [71, 76], [83, 73], [79, 80], [71, 83], [63, 80]], [255, 255, 255], INK, 2);
  line(img, [[66, 85], [71, 86], [76, 85]], 1.6, skinDeep);
  line(img, [[56, 69], [58, 75]], 1.6, skinShade);

  // l'oreillette
  polygon(img, arc(100, 56, 2.8, 2.8, 0, TAU, 14), INK);
  line(img, [[100, 58], [104, 66], [100, 74], [104, 82], [100, 90], [103, 98]], 1.6, INK);

  // le bas du buste s'inscrit dans le disque, comme chez les robots
  clipDisc(img, 71.5, 97, 70.5, 97);
  return { name: 'spr_cadre_anchor', image: img, ox: 71, oy: 97 };
}

// ---------- Le mobilier du plateau, vu du dessus ----------

/** Usure d'un meuble : petites taches claires et sombres, comme sur le mobilier d'origine. */
function wear(img: Image, seed: number, amount: number): void {
  const rng = random(seed);
  speckle(img, rng, amount, [255, 255, 255], 0.28);
  speckle(img, rng, Math.round(amount * 0.6), [0, 0, 0], 0.16);
}

/**
 * Pupitre du présentateur : un arc qui bombe vers les caméras (vers la gauche du sprite), dessus crème,
 * bandeau violet de la chaîne côté caméras. Le présentateur se tient dans le creux, à droite.
 */
function desk(): Made {
  const img = canvas(190, 430);
  const cx = 470, cy = 215, half = 0.47;
  const a0 = Math.PI - half, a1 = Math.PI + half;
  shape(img, band(cx, cy, 360, 430, a0, a1), [236, 228, 198], LINE, 2.4);
  polygon(img, band(cx, cy, 414, 429, a0 + 0.004, a1 - 0.004), [106, 79, 143]);
  line(img, arc(cx, cy, 412, 412, a0, a1, 40), 2.2, [240, 200, 90]);
  line(img, arc(cx, cy, 372, 372, a0 + 0.03, a1 - 0.03, 40), 1.4, [196, 186, 152]);
  wear(img, 11, 900);
  // ce qui traîne sur un pupitre : tablette, feuilles, tasse, micro
  shape(img, rotate(roundRect(82, 150, 40, 54, 5), 102, 177, -0.12), [52, 56, 68], LINE, 2);
  polygon(img, rotate(rect(87, 156, 30, 42), 102, 177, -0.12), [96, 150, 214]);
  shape(img, rotate(rect(84, 246, 34, 44), 101, 268, 0.16), [250, 250, 246], LINE, 1.8);
  shape(img, rotate(rect(90, 240, 34, 44), 107, 262, 0.05), [255, 255, 255], LINE, 1.8);
  for (let i = 0; i < 4; i++) line(img, rotate([[95, 250 + i * 8], [118, 250 + i * 8]], 107, 262, 0.05), 1.4, [150, 150, 160]);
  shape(img, arc(112, 110, 11, 11, 0, TAU, 20), [240, 240, 244], LINE, 2);
  polygon(img, arc(112, 110, 7, 7, 0, TAU, 16), [96, 62, 40]);
  line(img, [[122, 320], [86, 312]], 4, [40, 42, 50]);
  polygon(img, arc(84, 311, 6.5, 6.5, 0, TAU, 16), [28, 28, 34]);
  line(img, band(cx, cy, 360, 430, a0, a1), 2.4, LINE, 1, true);
  return { name: 'spr_tv_desk', image: img, ox: 95, oy: 215, bbox: [40, 22, 150, 408] };
}

/** Estrade du plateau : un disque aux couleurs de la chaîne, son logo d'origine (spr_accueil_tapis) au centre. */
function riser(): Made {
  const size = 660, c = size / 2;
  const img = canvas(size, size);
  shape(img, arc(c, c, 322, 322, 0, TAU, 120), [84, 68, 118], LINE, 3);
  polygon(img, arc(c, c, 300, 300, 0, TAU, 120), [62, 50, 92]);
  line(img, arc(c, c, 300, 300, 0, TAU, 120), 2, [40, 32, 60], 1, true);
  line(img, arc(c, c, 284, 284, 0, TAU, 120), 4, [240, 200, 90], 1, true);
  polygon(img, arc(c, c, 268, 268, 0, TAU, 120), [72, 58, 104]);
  wear(img, 23, 5200);
  paste(img, sprite('spr_accueil_tapis'), c - 96, c, 0.66);
  return { name: 'spr_tv_riser', image: img, ox: c, oy: c };
}

/** Projecteur de studio sur trépied, tourné vers la droite du sprite. */
function spot(): Made {
  const img = canvas(150, 150);
  const c = 75;
  for (const a of [Math.PI / 3, Math.PI, -Math.PI / 3]) {
    const tip: Pt = [c + Math.cos(a) * 60, c + Math.sin(a) * 60];
    line(img, [[c, c], tip], 7.5, LINE);
    line(img, [[c, c], tip], 4, [120, 122, 132]);
    shape(img, arc(tip[0], tip[1], 6, 6, 0, TAU, 14), [40, 42, 50], LINE, 1.6);
  }
  // les volets, puis la tête et sa lentille
  shape(img, [[104, 50], [130, 34], [136, 42], [112, 58]], [44, 46, 54], LINE, 2);
  shape(img, [[104, 100], [130, 116], [136, 108], [112, 92]], [44, 46, 54], LINE, 2);
  shape(img, roundRect(54, 52, 52, 46, 7), [70, 72, 84], LINE, 2.4);
  for (let i = 0; i < 4; i++) line(img, [[60 + i * 7, 57], [60 + i * 7, 93]], 2, [46, 48, 58]);
  shape(img, rect(104, 50, 9, 50), [255, 238, 168], LINE, 2);
  polygon(img, rect(106, 54, 3, 42), [255, 255, 236]);
  shape(img, arc(c, c, 8, 8, 0, TAU, 16), [52, 54, 62], LINE, 2);
  wear(img, 31, 260);
  return { name: 'spr_tv_spot', image: img, ox: c, oy: c, bbox: [54, 52, 105, 97] };
}

/** Mur d'écrans du décor, vu du dessus : une rangée de dalles lumineuses dans leur châssis. */
function ledWall(): Made {
  const w = 608, h = 44;
  const img = canvas(w, h);
  shape(img, roundRect(1, 1, w - 2, h - 2, 6), [38, 40, 50], LINE, 2.4);
  const rng = random(41);
  for (let i = 0; i < 8; i++) {
    const x = 10 + i * 74;
    const tone = 0.75 + rng() * 0.25;
    polygon(img, rect(x, 8, 68, 28), [Math.round(50 * tone), Math.round(140 * tone), Math.round(236 * tone)]);
    polygon(img, rect(x, 8, 68, 9), [Math.round(120 * tone), Math.round(200 * tone), 255]);
    polygon(img, rect(x + 6, 11, 24, 3), [230, 246, 255], 0.8);
    line(img, rect(x, 8, 68, 28), 1.6, [20, 22, 30], 1, true);
  }
  return { name: 'spr_tv_ledwall', image: img, ox: w / 2, oy: h / 2 };
}

/** Lettres de 5 × 7 points pour l'enseigne. */
const FONT: Record<string, string[]> = {
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  N: ['10001', '11001', '10101', '10101', '10011', '10001', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

/** Enseigne lumineuse « ON AIR », posée au-dessus des portes du plateau. */
function onAir(): Made {
  const w = 132, h = 44, s = 3;
  const img = canvas(w, h);
  shape(img, roundRect(1, 1, w - 2, h - 2, 7), [34, 30, 34], LINE, 2.4);
  polygon(img, roundRect(6, 6, w - 12, h - 12, 4), [214, 44, 44]);
  polygon(img, roundRect(6, 6, w - 12, 10, 4), [244, 92, 80]);
  const text = 'ON AIR';
  let x = Math.round((w - (text.length * 6 - 1) * s) / 2);
  for (const ch of text) {
    FONT[ch].forEach((row, ry) => {
      [...row].forEach((bit, rx) => {
        if (bit === '1') polygon(img, rect(x + rx * s, 12 + ry * s, s, s), [255, 244, 230]);
      });
    });
    x += 6 * s;
  }
  return { name: 'spr_tv_onair', image: img, ox: w / 2, oy: h / 2, bbox: [60, 18, 70, 26] };
}

/** Câbles au sol, scotchés par endroits, qui partent d'un boîtier. */
function cables(): Made {
  const w = 460, h = 300;
  const img = canvas(w, h);
  const runs: Pt[][] = [
    bezier([40, 150], [150, 40], [260, 250], [430, 90]),
    bezier([40, 158], [170, 260], [300, 60], [440, 210]),
    bezier([40, 146], [120, 120], [220, 20], [400, 30]),
  ];
  for (const run of runs) {
    line(img, run, 7, [30, 30, 36]);
    line(img, run.map(([x, y]) => [x - 1, y - 1.2] as Pt), 2, [92, 94, 104]);
  }
  for (const [x, y, a] of [[150, 118, 0.7], [262, 152, -0.5], [330, 92, 0.3], [218, 60, -0.9]] as [number, number, number][]) {
    shape(img, rotate(rect(x - 22, y - 8, 44, 16), x, y, a), [232, 204, 84], LINE, 1.6);
  }
  shape(img, roundRect(14, 128, 46, 44, 6), [58, 60, 72], LINE, 2.4);
  for (let i = 0; i < 3; i++) polygon(img, arc(26 + i * 11, 150, 3.2, 3.2, 0, TAU, 10), [140, 220, 150]);
  return { name: 'spr_tv_cables', image: img, ox: w / 2, oy: h / 2 };
}

// ---------- Le sol du plateau ----------

/**
 * Sol de studio : des dalles de résine sombre, lisses, à peine mouchetées, séparées par un joint fin. Il
 * remplace le béton fissuré du hall, qui n'a rien d'un plateau de télévision.
 */
function studioFloor(): Image {
  const size = 336, tile = 168;
  const img = canvas(size, size);
  const rng = random(57);
  for (let ty = 0; ty < 2; ty++) for (let tx = 0; tx < 2; tx++) {
    const tone = (tx + ty) % 2 === 0 ? 0 : 5;
    polygon(img, rect(tx * tile, ty * tile, tile, tile), [50 + tone, 54 + tone, 64 + tone]);
  }
  // reflets très doux, en diagonale, pour l'aspect lisse
  for (let i = 0; i < 9; i++) {
    const x = rng() * size, y = rng() * size, len = 40 + rng() * 70;
    line(img, [[x, y], [x + len, y - len * 0.35]], 5 + rng() * 6, [255, 255, 255], 0.022);
  }
  speckle(img, rng, 520, [255, 255, 255], 0.1);
  speckle(img, rng, 380, [0, 0, 0], 0.16);
  for (const k of [0, tile]) {
    polygon(img, rect(k, 0, 2, size), [28, 30, 38]);
    polygon(img, rect(0, k, size, 2), [28, 30, 38]);
    polygon(img, rect(k + 2, 0, 1, size), [76, 80, 92], 0.6);
    polygon(img, rect(0, k + 2, size, 1), [76, 80, 92], 0.6);
  }
  return img;
}

// ---------- Écriture ----------

function write(made: Made[]): void {
  const file = path.join(ASSETS, 'sprites.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  let bytes = 0;
  for (const m of made) {
    const dir = path.join(ASSETS, 'sprites', m.name);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const png = encodePng(m.image);
    bytes += png.length;
    writeFileSync(path.join(dir, '0.png'), png);
    manifest[m.name] = {
      w: m.image.width, h: m.image.height, ox: m.ox, oy: m.oy, frames: 1,
      bbox: m.bbox ?? [0, 0, m.image.width - 1, m.image.height - 1], bboxmode: 0, colkind: 1, sepmasks: false, speed: 1, speedType: 1,
    };
    console.log(`${m.name} : ${m.image.width} x ${m.image.height}`);
  }
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(file, `${linesObject(sorted, '')}\n`);
  console.log(`${made.length} sprites fabriqués, ${Math.round(bytes / 1024)} ko.`);
}

/** Le sol rejoint les textures de sol du jeu et leur manifeste. */
function writeFloor(name: string, image: Image): void {
  const file = path.join(ASSETS, 'floors.json');
  const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(path.join(ASSETS, 'floors', `${name}.png`), encodePng(image));
  manifest[name] = { image: `floors/${name}.png`, srcX: 0, srcY: 0, periodW: image.width, periodH: image.height, cellSize: 16 };
  const sorted = Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  writeFileSync(file, `${linesObject(sorted, '')}\n`);
  console.log(`${name} : sol de ${image.width} x ${image.height}`);
}

export function makeStudio(): void {
  write([anchorPortrait(), desk(), riser(), spot(), ledWall(), onAir(), cables()]);
  writeFloor('til_sol_studio', studioFloor());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) makeStudio();

void put;
