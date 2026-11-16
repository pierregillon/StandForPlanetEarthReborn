// Lecture et écriture PNG minimales, avec les seuls modules intégrés de Node.
// Lecture : 8 bits par canal, non entrelacé, types de couleur 0, 2, 3, 4 et 6.
// Écriture : RGBA 8 bits, déterministe.
import zlib from 'node:zlib';

export interface Image {
  width: number;
  height: number;
  /** RGBA, 4 octets par pixel, ligne par ligne. */
  data: Uint8Array;
}

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

interface Chunk {
  type: string;
  data: Buffer;
  /** Le bloc complet (longueur, type, données, CRC). */
  raw: Buffer;
}

function readChunks(file: Buffer): Chunk[] {
  if (file.length < 8 || !file.subarray(0, 8).equals(SIGNATURE)) throw new Error('Signature PNG invalide');
  const chunks: Chunk[] = [];
  let pos = 8;
  while (pos + 12 <= file.length) {
    const length = file.readUInt32BE(pos);
    const type = file.toString('latin1', pos + 4, pos + 8);
    chunks.push({ type, data: file.subarray(pos + 8, pos + 8 + length), raw: file.subarray(pos, pos + 12 + length) });
    pos += 12 + length;
    if (type === 'IEND') break;
  }
  return chunks;
}

/** Largeur et hauteur d'un PNG sans le décoder. */
export function pngSize(file: Buffer): { width: number; height: number } {
  if (file.length < 24 || !file.subarray(0, 8).equals(SIGNATURE)) throw new Error('Signature PNG invalide');
  return { width: file.readUInt32BE(16), height: file.readUInt32BE(20) };
}

/** Blocs de gestion des couleurs : GameMaker les ignore, les navigateurs non. */
const COLOUR_CHUNKS = new Set(['gAMA', 'cHRM', 'iCCP', 'sRGB']);

/**
 * Retire les blocs de profil de couleur d'un PNG (sans toucher aux pixels) pour
 * que le navigateur affiche les valeurs brutes, comme GameMaker. Renvoie le
 * tampon d'origine si rien n'est à retirer.
 */
export function stripColourChunks(file: Buffer): { data: Buffer; removed: string[] } {
  const chunks = readChunks(file);
  const removed = chunks.filter((c) => COLOUR_CHUNKS.has(c.type)).map((c) => c.type);
  if (removed.length === 0) return { data: file, removed };
  const kept = chunks.filter((c) => !COLOUR_CHUNKS.has(c.type)).map((c) => c.raw);
  return { data: Buffer.concat([SIGNATURE, ...kept]), removed };
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

export function decodePng(file: Buffer): Image {
  const chunks = readChunks(file);
  const header = chunks.find((c) => c.type === 'IHDR');
  if (!header) throw new Error('Bloc IHDR absent');
  const width = header.data.readUInt32BE(0);
  const height = header.data.readUInt32BE(4);
  const bitDepth = header.data[8];
  const colourType = header.data[9];
  const interlace = header.data[12];
  if (bitDepth !== 8 || interlace !== 0) {
    throw new Error(`PNG non géré (profondeur ${bitDepth}, entrelacement ${interlace})`);
  }
  const channelsByType: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
  const channels = channelsByType[colourType];
  if (!channels) throw new Error(`Type de couleur PNG non géré (${colourType})`);
  const palette = chunks.find((c) => c.type === 'PLTE')?.data;
  const transparency = chunks.find((c) => c.type === 'tRNS')?.data;
  const raw = zlib.inflateSync(Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const stride = width * channels;
  if (raw.length < (stride + 1) * height) throw new Error('Données PNG tronquées');

  const pixels = new Uint8Array(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    const dst = y * stride;
    for (let x = 0; x < stride; x++) {
      const left = x >= channels ? pixels[dst + x - channels] : 0;
      const up = y > 0 ? pixels[dst + x - stride] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[dst + x - stride - channels] : 0;
      let value = raw[src + x];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) value += paeth(left, up, upLeft);
      else if (filter !== 0) throw new Error(`Filtre PNG inconnu (${filter})`);
      pixels[dst + x] = value & 0xff;
    }
  }

  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    const d = i * 4;
    if (colourType === 6) {
      data[d] = pixels[s];
      data[d + 1] = pixels[s + 1];
      data[d + 2] = pixels[s + 2];
      data[d + 3] = pixels[s + 3];
    } else if (colourType === 2) {
      data[d] = pixels[s];
      data[d + 1] = pixels[s + 1];
      data[d + 2] = pixels[s + 2];
      data[d + 3] = 255;
      if (transparency && transparency.length >= 6) {
        if (pixels[s] === transparency[1] && pixels[s + 1] === transparency[3] && pixels[s + 2] === transparency[5]) {
          data[d + 3] = 0;
        }
      }
    } else if (colourType === 0) {
      data[d] = data[d + 1] = data[d + 2] = pixels[s];
      data[d + 3] = transparency && transparency.length >= 2 && transparency[1] === pixels[s] ? 0 : 255;
    } else if (colourType === 4) {
      data[d] = data[d + 1] = data[d + 2] = pixels[s];
      data[d + 3] = pixels[s + 1];
    } else {
      if (!palette) throw new Error('Palette PNG absente');
      const index = pixels[s];
      data[d] = palette[index * 3];
      data[d + 1] = palette[index * 3 + 1];
      data[d + 2] = palette[index * 3 + 2];
      data[d + 3] = transparency && index < transparency.length ? transparency[index] : 255;
    }
  }
  return { width, height, data };
}

let crcTable: Uint32Array | null = null;

function crc32(buffer: Buffer): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

export function encodePng(image: Image): Buffer {
  const { width, height, data } = image;
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  const candidates = [0, 1, 2, 3, 4].map(() => new Uint8Array(stride));
  for (let y = 0; y < height; y++) {
    const row = y * stride;
    let best = 0;
    let bestScore = Infinity;
    for (let filter = 0; filter < 5; filter++) {
      const out = candidates[filter];
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const value = data[row + x];
        const left = x >= 4 ? data[row + x - 4] : 0;
        const up = y > 0 ? data[row + x - stride] : 0;
        const upLeft = y > 0 && x >= 4 ? data[row + x - stride - 4] : 0;
        let predicted = 0;
        if (filter === 1) predicted = left;
        else if (filter === 2) predicted = up;
        else if (filter === 3) predicted = (left + up) >> 1;
        else if (filter === 4) predicted = paeth(left, up, upLeft);
        const delta = (value - predicted) & 0xff;
        out[x] = delta;
        score += delta < 128 ? delta : 256 - delta;
      }
      if (score < bestScore) {
        bestScore = score;
        best = filter;
      }
    }
    raw[y * (stride + 1)] = best;
    raw.set(candidates[best], y * (stride + 1) + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    SIGNATURE,
    makeChunk('IHDR', header),
    makeChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    makeChunk('IEND', Buffer.alloc(0)),
  ]);
}

export function cropImage(image: Image, x: number, y: number, width: number, height: number): Image {
  if (x < 0 || y < 0 || x + width > image.width || y + height > image.height) {
    throw new Error(`Découpe hors de l'image (${x},${y} ${width}x${height} dans ${image.width}x${image.height})`);
  }
  const data = new Uint8Array(width * height * 4);
  for (let row = 0; row < height; row++) {
    const start = ((y + row) * image.width + x) * 4;
    data.set(image.data.subarray(start, start + width * 4), row * width * 4);
  }
  return { width, height, data };
}
