// Fabrique les sprites de l'aile est de TvTv² que le jeu d'origine n'avait pas (GD-081, GD-083, ADR-015) : le
// portrait du présentateur, le mobilier du studio et son sol, le maquillage, le bitume et les marquages des parkings. Tout est dessiné par le code, dans le style du jeu :
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

/**
 * Le policier qui somme les robots de se rendre devant le barrage (GD-088). Même format et même trait que le
 * présentateur : uniforme bleu nuit, casquette à écusson, lunettes noires, la bouche ouverte sur un ordre.
 */
function policePortrait(): Made {
  const img = canvas(143, 167);
  const skin: Rgb = [232, 186, 150], skinShade: Rgb = [200, 148, 116], skinDeep: Rgb = [168, 116, 92];
  const navy: Rgb = [40, 56, 104], navyShade: Rgb = [28, 40, 78], navyDark: Rgb = [18, 26, 54];
  const shirt: Rgb = [170, 202, 236], shirtShade: Rgb = [128, 160, 204];
  const gold: Rgb = [246, 204, 78], goldShade: Rgb = [196, 146, 40];
  const lens: Rgb = [26, 28, 40], lensShine: Rgb = [120, 150, 200];

  // l'uniforme, épaules larges, et ses pattes d'épaule
  shape(img, [[-6, 172], [-6, 132], [8, 118], [30, 108], [50, 100], [60, 106], [71, 112], [82, 106], [92, 100], [113, 108], [135, 118], [149, 132], [149, 172]], navy, INK, 3.4);
  polygon(img, [[92, 100], [113, 108], [135, 118], [149, 132], [149, 172], [102, 172], [108, 140], [100, 120]], navyShade);
  polygon(img, [[-6, 150], [20, 138], [36, 172], [-6, 172]], navyShade);
  shape(img, [[14, 116], [40, 105], [45, 113], [20, 125]], navyDark, INK, 2.2);
  shape(img, [[129, 116], [103, 105], [98, 113], [123, 125]], navyDark, INK, 2.2);
  // la chemise, la cravate noire
  shape(img, [[58, 100], [71, 146], [84, 100], [78, 94], [64, 94]], shirt, INK, 2.4);
  polygon(img, [[72, 104], [84, 100], [72, 144]], shirtShade);
  shape(img, [[68, 112], [74, 112], [79, 150], [71, 162], [63, 150]], navyDark, INK, 2.2);
  shape(img, [[65, 104], [77, 104], [75, 113], [67, 113]], navyDark, INK, 2.2);
  // les revers et le col
  shape(img, [[50, 100], [60, 106], [70, 142], [57, 152], [43, 122]], navyShade, INK, 2.6);
  shape(img, [[92, 100], [82, 106], [72, 142], [85, 152], [99, 122]], navyDark, INK, 2.6);
  shape(img, [[56, 97], [66, 104], [61, 116], [53, 104]], shirt, INK, 2.2);
  shape(img, [[86, 97], [76, 104], [81, 116], [89, 104]], shirtShade, INK, 2.2);
  // l'insigne sur la poitrine, la radio d'épaule
  shape(img, [[100, 124], [112, 124], [112, 134], [106, 141], [100, 134]], gold, INK, 2);
  polygon(img, [[106, 125], [112, 124], [112, 134], [106, 140]], goldShade);
  shape(img, rect(28, 122, 12, 18), INK, INK, 0);
  line(img, [[34, 122], [32, 110]], 2, INK);

  // le cou
  shape(img, [[59, 78], [83, 78], [84, 100], [71, 110], [58, 100]], skinShade, INK, 2.6);
  polygon(img, [[60, 84], [82, 84], [80, 94], [71, 98], [62, 94]], skinDeep);

  // les oreilles, puis le visage, mâchoire carrée
  shape(img, [[41, 50], [47, 47], [48, 65], [43, 63]], skin, INK, 2.4);
  shape(img, [[96, 47], [102, 50], [100, 63], [95, 65]], skinShade, INK, 2.4);
  const face: Pt[] = [[47, 40], [50, 30], [60, 24], [82, 24], [92, 30], [96, 42], [96, 66], [92, 80], [83, 90], [71, 93], [59, 90], [50, 80], [46, 66]];
  polygon(img, face, skin);
  polygon(img, [[87, 26], [92, 30], [96, 42], [96, 66], [92, 80], [83, 90], [71, 93], [78, 84], [86, 72], [89, 54], [87, 40]], skinShade);
  line(img, face, 3.2, INK, 1, true);

  // la casquette : la coiffe, le bandeau, l'écusson, puis la visière qui ombre le front
  const crown: Pt[] = [[40, 36], [36, 20], [46, 7], [71, 2], [96, 7], [106, 20], [102, 36]];
  shape(img, crown, navy, INK, 3.2);
  polygon(img, [[90, 6], [96, 7], [106, 20], [102, 36], [92, 36], [96, 22]], navyShade);
  shape(img, [[41, 33], [101, 33], [100, 43], [42, 43]], navyDark, INK, 2.4);
  shape(img, [[65, 12], [77, 12], [79, 22], [71, 30], [63, 22]], gold, INK, 2);
  polygon(img, [[71, 13], [77, 12], [79, 22], [71, 29]], goldShade);
  shape(img, [[38, 42], [104, 42], [110, 50], [71, 54], [32, 50]], INK, INK, 2);
  line(img, [[44, 46], [70, 49], [98, 46]], 1.6, [70, 80, 110]);

  // les lunettes noires
  shape(img, [[50, 56], [68, 56], [67, 66], [58, 69], [51, 64]], lens, INK, 2.4);
  shape(img, [[74, 56], [92, 56], [91, 64], [84, 69], [75, 66]], lens, INK, 2.4);
  line(img, [[68, 58], [74, 58]], 2.4, INK);
  line(img, [[54, 59], [60, 59]], 1.8, lensShine);
  line(img, [[78, 59], [84, 59]], 1.8, lensShine);
  // le nez, et la bouche ouverte sur l'ordre
  line(img, [[71, 62], [69, 72], [74, 74]], 2, INK);
  shape(img, [[61, 78], [82, 78], [79, 87], [64, 87]], [70, 22, 26], INK, 2.2);
  polygon(img, [[63, 79], [80, 79], [79, 82], [64, 82]], [255, 255, 255]);
  line(img, [[55, 72], [58, 80]], 1.6, skinShade);
  line(img, [[87, 72], [84, 80]], 1.6, skinDeep);

  // le bas du buste s'inscrit dans le disque, comme chez les robots
  clipDisc(img, 71.5, 97, 70.5, 97);
  return { name: 'spr_cadre_police', image: img, ox: 71, oy: 97 };
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
  paste(img, sprite('spr_accueil_tapis'), c - 150, c, 0.66);
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
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
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

// ---------- Le salon de maquillage ----------

/** Coiffeuse vue du dessus : un plateau clair, et le long du mur un miroir bordé d'ampoules. */
function makeupTable(): Made {
  const w = 250, h = 100;
  const img = canvas(w, h);
  shape(img, roundRect(2, 14, w - 4, h - 16, 6), [232, 222, 206], LINE, 2.4);
  // le miroir, contre le mur : une bande argentée et sa rangée d'ampoules
  shape(img, roundRect(8, 2, w - 16, 20, 4), [190, 200, 214], LINE, 2);
  polygon(img, rect(14, 6, w - 28, 5), [236, 244, 252]);
  for (let i = 0; i < 9; i++) {
    const x = 24 + i * 25.2;
    polygon(img, arc(x, 16, 5.2, 5.2, 0, TAU, 14), [255, 232, 150]);
    polygon(img, arc(x - 1, 15, 2.2, 2.2, 0, TAU, 10), [255, 255, 236]);
    line(img, arc(x, 16, 5.2, 5.2, 0, TAU, 14), 1.4, LINE, 1, true);
  }
  wear(img, 71, 420);
  // la palette, les pinceaux, les flacons, la houppette
  shape(img, roundRect(34, 46, 62, 34, 4), [60, 58, 70], LINE, 1.8);
  const tones: Rgb[] = [[226, 120, 120], [236, 160, 130], [200, 110, 150], [150, 110, 180], [236, 196, 150], [180, 90, 90], [240, 140, 170], [120, 130, 190]];
  tones.forEach((tone, i) => polygon(img, arc(46 + (i % 4) * 13, 56 + Math.floor(i / 4) * 14, 4.6, 4.6, 0, TAU, 12), tone));
  for (const [x, y, a, tip] of [[118, 44, 0.5, [226, 120, 140]], [130, 50, 0.2, [90, 60, 40]], [140, 44, -0.2, [60, 60, 70]]] as [number, number, number, Rgb][]) {
    line(img, rotate([[x, y], [x, y + 34]], x, y + 17, a), 3.4, [70, 60, 60]);
    polygon(img, rotate(rect(x - 3, y - 6, 6, 9), x, y + 17, a), tip);
  }
  shape(img, arc(176, 62, 12, 12, 0, TAU, 20), [246, 214, 222], LINE, 1.8);
  polygon(img, arc(176, 62, 6, 6, 0, TAU, 14), [255, 240, 244]);
  for (const [x, c] of [[204, [110, 170, 200]], [220, [220, 180, 110]], [234, [170, 120, 190]]] as [number, Rgb][]) {
    shape(img, roundRect(x - 6, 44, 12, 26, 3), c, LINE, 1.6);
    polygon(img, rect(x - 3, 40, 6, 6), [60, 60, 70]);
  }
  line(img, roundRect(2, 14, w - 4, h - 16, 6), 2.4, LINE, 1, true);
  return { name: 'spr_tv_makeup', image: img, ox: w / 2, oy: h / 2 };
}

/** Portant à vêtements vu du dessus : une barre sur deux pieds, et les habits serrés sur leurs cintres. */
function clothesRack(): Made {
  const w = 240, h = 76;
  const img = canvas(w, h);
  for (const x of [14, w - 14]) {
    line(img, [[x, 8], [x, h - 8]], 7, LINE);
    line(img, [[x, 8], [x, h - 8]], 3.6, [150, 154, 166]);
  }
  line(img, [[14, h / 2], [w - 14, h / 2]], 6, LINE);
  line(img, [[14, h / 2], [w - 14, h / 2]], 2.8, [176, 180, 192]);
  const rng = random(83);
  const cloth: Rgb[] = [[58, 98, 184], [196, 62, 70], [236, 232, 222], [70, 74, 86], [226, 180, 80], [110, 150, 110], [150, 96, 160], [40, 44, 56], [214, 130, 150], [236, 232, 222]];
  cloth.forEach((tone, i) => {
    const x = 34 + i * 19.2 + (rng() - 0.5) * 3;
    const half = 22 + rng() * 9;
    shape(img, roundRect(x - 7.5, h / 2 - half, 15, half * 2, 5), tone, LINE, 1.6);
    polygon(img, rect(x - 4.5, h / 2 - half + 4, 3, half * 2 - 8), [255, 255, 255], 0.16);
  });
  return { name: 'spr_tv_rack', image: img, ox: w / 2, oy: h / 2, bbox: [8, 20, w - 9, h - 21] };
}

// ---------- Les parkings ----------

/** Peinture au sol usée par les pneus : des manques dans la couleur, quelques éclats nets. */
function erode(img: Image, seed: number, strength: number): void {
  const rng = random(seed);
  for (let i = 3; i < img.data.length; i += 4) {
    if (img.data[i] === 0) continue;
    const r = rng();
    img.data[i] = Math.round(img.data[i] * (r < strength * 0.35 ? 0.15 + rng() * 0.3 : 0.8 + rng() * 0.2));
  }
  // quelques griffures plus larges
  for (let k = 0; k < (img.width * img.height * strength) / 900; k++) {
    const x = Math.floor(rng() * img.width), y = Math.floor(rng() * img.height), len = 3 + Math.floor(rng() * 9);
    for (let d = 0; d < len; d++) {
      const px = x + d, py = y + Math.floor(d * (rng() - 0.5));
      if (px < img.width && py >= 0 && py < img.height) img.data[(py * img.width + px) * 4 + 3] = Math.round(img.data[(py * img.width + px) * 4 + 3] * 0.25);
    }
  }
}

const PAINT: Rgb = [236, 236, 228];

/** Ligne blanche : une limite de place, un bord de voie. Se teinte en jaune ou en gris au besoin. */
function parkingLine(): Made {
  const w = 400, h = 14;
  const img = canvas(w, h);
  polygon(img, rect(0, 1, w, h - 2), PAINT);
  erode(img, 91, 0.5);
  return { name: 'spr_pk_line', image: img, ox: 0, oy: h / 2 };
}

/** Flèche de sens de circulation, pointe vers le haut du sprite. */
function parkingArrow(): Made {
  const w = 130, h = 300;
  const img = canvas(w, h);
  polygon(img, [[w / 2, 4], [w - 6, 112], [w / 2 + 22, 112], [w / 2 + 22, h - 6], [w / 2 - 22, h - 6], [w / 2 - 22, 112], [6, 112]], PAINT);
  erode(img, 93, 0.55);
  return { name: 'spr_pk_arrow', image: img, ox: w / 2, oy: h / 2 };
}

/** Passage piéton : des bandes blanches, à franchir dans le sens de la largeur du sprite. */
function crosswalk(): Made {
  const w = 420, h = 250;
  const img = canvas(w, h);
  for (let i = 0; i < 6; i++) polygon(img, rect(8 + i * 70, 6, 42, h - 12), PAINT);
  erode(img, 95, 0.5);
  return { name: 'spr_pk_zebra', image: img, ox: w / 2, oy: h / 2 };
}

/** Zone de dépose : un cadre jaune zébré où l'on ne stationne pas. */
function hatchBox(): Made {
  const w = 430, h = 260;
  const img = canvas(w, h);
  const yellow: Rgb = [236, 198, 62];
  for (let x = -h; x < w; x += 44) polygon(img, [[x, h], [x + h, 0], [x + h + 16, 0], [x + 16, h]], yellow);
  // on ne garde que l'intérieur du cadre, puis on trace le cadre
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < 8 || y < 8 || x >= w - 8 || y >= h - 8) img.data[(y * w + x) * 4 + 3] = 0;
  }
  line(img, rect(6, 6, w - 12, h - 12), 10, yellow, 1, true);
  erode(img, 97, 0.5);
  return { name: 'spr_pk_hatch', image: img, ox: w / 2, oy: h / 2 };
}

/** Potelet vu du dessus : il sépare le trottoir de la chaussée. */
function bollard(): Made {
  const s = 46, c = s / 2;
  const img = canvas(s, s);
  polygon(img, arc(c + 4, c + 5, 15, 15, 0, TAU, 24), [0, 0, 0], 0.28);
  shape(img, arc(c, c, 15, 15, 0, TAU, 28), [236, 198, 62], LINE, 2.4);
  polygon(img, arc(c, c, 11, 11, 0, TAU, 28), [44, 44, 52]);
  polygon(img, arc(c, c, 6.5, 6.5, 0, TAU, 20), [250, 226, 120]);
  polygon(img, arc(c - 2, c - 2, 2, 2, 0, TAU, 10), [255, 250, 220]);
  return { name: 'spr_pk_bollard', image: img, ox: c, oy: c, bbox: [8, 8, 37, 37] };
}

/**
 * Fourgon de police vu du dessus, l'avant vers le haut (GD-086) : ceux qui amènent la troupe sur le parking sud.
 * Il est dessiné à la taille du jeu : le fourgon d'origine (spri_car_van), prévu pour être agrandi sept fois,
 * serait flou à cette échelle.
 */
function policeVan(): Made {
  const w = 236, h = 470, cx = w / 2;
  const img = canvas(w, h);
  const navy: Rgb = [30, 46, 98];
  const navyLight: Rgb = [48, 70, 136];
  const white: Rgb = [232, 236, 244];
  // ombre portée, décalée vers le bas à droite
  polygon(img, roundRect(34, 30, 182, 428, 34), [0, 0, 0], 0.3);
  // roues, qui dépassent à peine de la caisse
  for (const y of [92, 356]) for (const x of [18, w - 40]) shape(img, roundRect(x, y, 22, 62, 7), [26, 24, 30], LINE, 2);
  // caisse, capot plus clair à l'avant
  shape(img, roundRect(26, 16, 184, 432, 34), navy, LINE, 3);
  polygon(img, roundRect(34, 22, 168, 60, 26), navyLight);
  // rétroviseurs
  for (const x of [10, w - 30]) shape(img, roundRect(x, 96, 20, 12, 4), navy, LINE, 2);
  // pare-brise et lunette arrière
  shape(img, [[46, 92], [w - 46, 92], [w - 38, 136], [38, 136]], [126, 196, 232], LINE, 2.4);
  polygon(img, [[52, 97], [cx - 8, 97], [cx - 20, 131], [46, 131]], [176, 226, 248], 0.75);
  shape(img, roundRect(52, 418, w - 104, 18, 6), [70, 118, 156], LINE, 2);
  // toit blanc, bandes de damier sur les flancs
  shape(img, roundRect(44, 168, w - 88, 236, 12), white, LINE, 2.4);
  for (let i = 0; i < 12; i++) {
    const y = 172 + i * 19;
    if (i % 2 === 0) {
      polygon(img, rect(30, y, 12, 19), [250, 214, 60]);
      polygon(img, rect(w - 42, y, 12, 19), [250, 214, 60]);
    }
  }
  // rampe lumineuse : rouge à gauche, bleu à droite
  shape(img, roundRect(46, 142, w - 92, 20, 6), [40, 40, 48], LINE, 2);
  polygon(img, roundRect(50, 145, 56, 14, 4), [236, 56, 56]);
  polygon(img, roundRect(w - 106, 145, 56, 14, 4), [66, 132, 255]);
  polygon(img, roundRect(cx - 9, 145, 18, 14, 3), [244, 244, 248]);
  // « POLICE » sur le toit, lisible depuis l'arrière du fourgon
  const s = 3, text = 'POLICE';
  let x = Math.round(cx - ((text.length * 6 - 1) * s) / 2);
  for (const ch of text) {
    FONT[ch].forEach((row, ry) => {
      [...row].forEach((bit, rx) => {
        if (bit === '1') polygon(img, rect(x + rx * s, 276 + ry * s, s, s), navy);
      });
    });
    x += 6 * s;
  }
  // feux arrière
  for (const fx of [36, w - 54]) polygon(img, roundRect(fx, 440, 18, 7, 2), [226, 52, 52]);
  return { name: 'spr_pk_police_van', image: img, ox: cx, oy: h / 2, bbox: [26, 16, 209, 447] };
}

/**
 * Bitume : un gris sombre au grain serré, semé de gravillons clairs, avec quelques reprises plus foncées.
 * Il remplace les pavés et la route hors d'échelle des deux quais.
 */
function asphalt(): Image {
  const size = 336;
  const img = canvas(size, size);
  const rng = random(67);
  polygon(img, rect(0, 0, size, size), [66, 66, 72]);
  // le grain : chaque pixel s'écarte un peu du gris de base
  for (let i = 0; i < size * size; i++) {
    const d = Math.round((rng() - 0.5) * 16);
    for (let k = 0; k < 3; k++) img.data[i * 4 + k] = Math.max(0, Math.min(255, img.data[i * 4 + k] + d));
  }
  speckle(img, rng, 2600, [210, 210, 214], 0.3);
  speckle(img, rng, 1800, [20, 20, 24], 0.35);
  // reprises de bitume, plus sombres, qui se raccordent d'un bord à l'autre de la texture
  for (let k = 0; k < 3; k++) {
    const x = rng() * size, y = rng() * size, rx = 30 + rng() * 40, ry = 12 + rng() * 18, a = rng() * Math.PI;
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      polygon(img, rotate(arc(x + ox, y + oy, rx, ry, 0, TAU, 20), x + ox, y + oy, a), [34, 34, 40], 0.22);
    }
  }
  return img;
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
  write([
    anchorPortrait(), policePortrait(), desk(), riser(), spot(), ledWall(), onAir(), cables(),
    makeupTable(), clothesRack(),
    parkingLine(), parkingArrow(), crosswalk(), hatchBox(), bollard(), policeVan(),
  ]);
  writeFloor('til_sol_studio', studioFloor());
  writeFloor('til_sol_asphalte', asphalt());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) makeStudio();

void put;
