// Copie dans public/assets/ les sprites, textures de sol et sons utiles au
// remake, et écrit les manifestes sprites.json, floors.json et sounds.json.
// Format : docs/formats-donnees.md. Réglages : tools/assets.config.json.
// Usage : npm run extract-assets   (ajouter -- --verbose pour le détail par sprite)
import fs from 'node:fs';
import path from 'node:path';
import { formatBytes, linesObject, pruneDirectory, writeIfChanged } from './lib/output.ts';
import { cropImage, decodePng, encodePng, pngSize, stripColourChunks } from './lib/png.ts';
import { PUBLIC_DIR, listGmlFiles, loadConfig, loadProject, makeMatcher, stripGmlComments } from './lib/reference.ts';
import type { Project } from './lib/reference.ts';
import { convertRoom } from './lib/rooms.ts';
import type { FloorTilesetUse } from './lib/rooms.ts';

const ASSETS_DIR = path.join(PUBLIC_DIR, 'assets');
const SPRITES_DIR = path.join(ASSETS_DIR, 'sprites');
const FLOORS_DIR = path.join(ASSETS_DIR, 'floors');
const SOUNDS_DIR = path.join(ASSETS_DIR, 'sounds');
const SIZE_BUDGET = 40 * 1024 * 1024;
const VERBOSE = process.argv.includes('--verbose');

const warnings: string[] = [];
const keep = new Set<string>();
let filesWritten = 0;

function output(file: string, content: Buffer | string): void {
  keep.add(file);
  if (writeIfChanged(file, content)) filesWritten++;
}

// ---------------------------------------------------------------------------
// Choix des sprites
// ---------------------------------------------------------------------------

interface DynamicPattern {
  prefix: string;
  suffix: string;
  file: string;
  matches: string[];
}

interface Selection {
  /** sprite → raisons de sa présence. */
  reasons: Map<string, Set<string>>;
  roomSprites: Set<string>;
  dynamic: DynamicPattern[];
  excluded: string[];
  excludedButNeededByRooms: string[];
  floorTilesets: FloorTilesetUse[];
}

function selectSprites(project: Project, rooms: string[], excludePatterns: string[], includePatterns: string[]): Selection {
  const allSprites = new Set(project.spriteNames);
  const candidates = new Map<string, Set<string>>();
  const add = (sprite: string | null, reason: string) => {
    if (!sprite) return;
    if (!candidates.has(sprite)) candidates.set(sprite, new Set());
    candidates.get(sprite)!.add(reason);
  };

  // (a) Sprites nécessaires aux salles converties.
  const roomSprites = new Set<string>();
  const floorTilesets = new Map<string, FloorTilesetUse>();
  const roomPropSprites = new Map<string, Set<string>>();
  for (const room of rooms) {
    const conversion = convertRoom(project, room);
    const propStrings = new Set<string>();
    for (const instance of conversion.level.instances) {
      for (const value of Object.values(instance.props)) if (typeof value === 'string') propStrings.add(value);
    }
    roomPropSprites.set(room, propStrings);
    for (const sprite of conversion.sprites) {
      roomSprites.add(sprite);
      add(sprite, `salle ${room}`);
    }
    for (const use of conversion.floorTilesets) floorTilesets.set(use.tileset, use);
  }

  // (b) Sprites référencés par un objet…
  for (const object of project.objects.values()) {
    add(object.sprite, `objet ${object.name}`);
    add(object.mask, `masque de ${object.name}`);
    // … ou donnés comme valeur d'une variable d'objet (ex. legs_type, hitSprite).
    for (const value of [...object.properties, ...object.overrides].map((p) => p.value.trim())) {
      if (allSprites.has(value)) add(value, `variable de l'objet ${object.name}`);
    }
  }
  for (const [room, instanceSprites] of roomPropSprites) {
    for (const sprite of instanceSprites) if (allSprites.has(sprite)) add(sprite, `variable d'instance dans ${room}`);
  }

  // … ou cités dans le GML des objets, des scripts et des salles converties.
  const gmlFiles = [
    ...listGmlFiles(path.join(project.refDir, 'objects')),
    ...listGmlFiles(path.join(project.refDir, 'scripts')),
    ...rooms.flatMap((room) => listGmlFiles(path.join(project.refDir, 'rooms', room))),
  ];
  const dynamic: DynamicPattern[] = [];
  const dynamicRe = /"(spr_\w*)"\s*\+(?:[^;"\n]*\+\s*"(\w+)")?/g;
  for (const file of gmlFiles) {
    const relative = path.relative(project.refDir, file).replace(/\\/g, '/');
    const code = stripGmlComments(fs.readFileSync(file, 'utf8'));
    for (const token of code.match(/[A-Za-z_]\w*/g) ?? []) {
      if (allSprites.has(token)) add(token, `gml ${relative}`);
    }
    // Noms construits à l'exécution : "spr_xxx" + … (+ "suffixe").
    for (const match of code.matchAll(dynamicRe)) {
      const prefix = match[1];
      const suffix = match[2] ?? '';
      const matches = project.spriteNames.filter(
        (name) => name.startsWith(prefix) && name.endsWith(suffix) && name.length > prefix.length + suffix.length,
      );
      if (!dynamic.some((d) => d.prefix === prefix && d.suffix === suffix && d.file === relative)) {
        dynamic.push({ prefix, suffix, file: relative, matches });
      }
      for (const name of matches) add(name, `nom dynamique "${prefix}"+…${suffix ? `+"${suffix}"` : ''} (${relative})`);
    }
  }

  const isExcluded = makeMatcher(excludePatterns);
  const isIncluded = makeMatcher(includePatterns);
  const reasons = new Map<string, Set<string>>();
  const excluded: string[] = [];
  for (const [sprite, why] of candidates) {
    if (isExcluded(sprite) && !isIncluded(sprite)) excluded.push(sprite);
    else reasons.set(sprite, why);
  }
  for (const sprite of project.spriteNames) {
    if (isIncluded(sprite)) {
      if (!reasons.has(sprite)) reasons.set(sprite, new Set());
      reasons.get(sprite)!.add('includeSprites');
    }
  }
  excluded.sort();
  return {
    reasons,
    roomSprites,
    dynamic,
    excluded,
    excludedButNeededByRooms: excluded.filter((s) => roomSprites.has(s)),
    floorTilesets: [...floorTilesets.values()].sort((a, b) => (a.tileset < b.tileset ? -1 : 1)),
  };
}

// ---------------------------------------------------------------------------
// Sprites
// ---------------------------------------------------------------------------

interface SpriteReport {
  name: string;
  frames: number;
  bytes: number;
  reasons: string[];
  neededByRooms: boolean;
}

function extractSprites(project: Project, selection: Selection): SpriteReport[] {
  const manifest: Record<string, unknown> = {};
  const reports: SpriteReport[] = [];
  let strippedFiles = 0;
  for (const name of [...selection.reasons.keys()].sort()) {
    const sprite = project.sprite(name);
    if (!sprite) {
      warnings.push(`sprite ${name} : fichier .yy introuvable, non copié (${[...selection.reasons.get(name)!].join(' ; ')}).`);
      continue;
    }
    let bytes = 0;
    let frames = 0;
    for (const framePath of sprite.framePaths) {
      if (!fs.existsSync(framePath)) {
        warnings.push(`sprite ${name} : image ${path.basename(framePath)} absente ; les images suivantes sont décalées.`);
        continue;
      }
      const source = fs.readFileSync(framePath);
      const size = pngSize(source);
      if (size.width !== sprite.width || size.height !== sprite.height) {
        warnings.push(`sprite ${name} image ${frames} : PNG ${size.width}x${size.height} ≠ sprite ${sprite.width}x${sprite.height}.`);
      }
      const { data, removed } = stripColourChunks(source);
      if (removed.length > 0) strippedFiles++;
      output(path.join(SPRITES_DIR, name, `${frames}.png`), data);
      bytes += data.length;
      frames++;
    }
    manifest[name] = {
      w: sprite.width,
      h: sprite.height,
      ox: sprite.xorig,
      oy: sprite.yorig,
      frames,
      bbox: [sprite.bboxLeft, sprite.bboxTop, sprite.bboxRight, sprite.bboxBottom],
      bboxmode: sprite.bboxmode,
      colkind: sprite.colkind,
      sepmasks: sprite.sepmasks,
      speed: sprite.playbackSpeed,
      speedType: sprite.playbackSpeedType,
    };
    reports.push({
      name,
      frames,
      bytes,
      reasons: [...selection.reasons.get(name)!],
      neededByRooms: selection.roomSprites.has(name),
    });
  }
  output(path.join(ASSETS_DIR, 'sprites.json'), `${linesObject(manifest, '')}\n`);
  if (strippedFiles > 0) {
    console.log(`Profils de couleur retirés de ${strippedFiles} image(s) (blocs gAMA/cHRM/iCCP/sRGB, pixels inchangés).`);
  }
  return reports;
}

// ---------------------------------------------------------------------------
// Sols : une image par tileset, égale à une période du motif
// ---------------------------------------------------------------------------

function extractFloors(project: Project, uses: FloorTilesetUse[]): number {
  const manifest: Record<string, unknown> = {};
  let bytes = 0;
  for (const use of uses) {
    const tileset = project.tileset(use.tileset);
    const sprite = tileset?.sprite ? project.sprite(tileset.sprite) : null;
    if (!tileset || !sprite || sprite.framePaths.length === 0 || !fs.existsSync(sprite.framePaths[0])) {
      warnings.push(`sol ${use.tileset} : tileset ou image source introuvable, non extrait.`);
      continue;
    }
    const { cellSize, cellsPerLine, cellsPerColonne } = use;
    const columns = Math.floor((sprite.width - tileset.tileXOff + tileset.tileHSep) / (tileset.tileWidth + tileset.tileHSep));
    const rows = Math.floor((sprite.height - tileset.tileYOff + tileset.tileVSep) / (tileset.tileHeight + tileset.tileVSep));
    if (
      tileset.tileWidth !== cellSize ||
      tileset.tileHeight !== cellSize ||
      tileset.tileXOff !== 0 ||
      tileset.tileYOff !== 0 ||
      tileset.tileHSep !== 0 ||
      tileset.tileVSep !== 0 ||
      columns !== cellsPerLine ||
      rows !== cellsPerColonne
    ) {
      warnings.push(
        `sol ${use.tileset} : la grille du tileset (${columns}x${rows} tuiles de ${tileset.tileWidth} px) ne correspond pas ` +
          `au générateur (${cellsPerLine}x${cellsPerColonne} cases de ${cellSize} px) ; motif à vérifier.`,
      );
    }
    // Le générateur pose les tuiles des colonnes 1 à cellsPerLine-1 (la colonne 0
    // contient la tuile 0, « vide » pour GameMaker) et de toutes les lignes.
    const periodW = (cellsPerLine - 1) * cellSize;
    const periodH = cellsPerColonne * cellSize;
    const source = fs.readFileSync(sprite.framePaths[0]);
    const file = path.join(FLOORS_DIR, `${use.tileset}.png`);
    let entry: Record<string, unknown>;
    let note = '';
    try {
      const image = decodePng(source);
      const period = cropImage(image, cellSize, 0, periodW, periodH);
      const margin = cropImage(image, 0, 0, cellSize, periodH);
      const lastColumn = cropImage(image, periodW, 0, cellSize, periodH);
      const marginIsCopy = Buffer.from(margin.data).equals(Buffer.from(lastColumn.data));
      note = marginIsCopy ? 'colonne 0 = copie de la dernière colonne' : 'colonne 0 ≠ dernière colonne (marge non utilisée)';
      const encoded = encodePng(period);
      output(file, encoded);
      bytes += encoded.length;
      entry = { image: `floors/${use.tileset}.png`, srcX: 0, srcY: 0, periodW, periodH, cellSize };
    } catch (error) {
      // Repli : image entière, la période est le rectangle (srcX, srcY, periodW, periodH).
      warnings.push(`sol ${use.tileset} : découpe impossible (${(error as Error).message}) ; image entière copiée.`);
      const { data } = stripColourChunks(source);
      output(file, data);
      bytes += data.length;
      entry = { image: `floors/${use.tileset}.png`, srcX: cellSize, srcY: 0, periodW, periodH, cellSize };
    }
    manifest[use.tileset] = entry;
    console.log(
      `  ${use.tileset} : source ${tileset.sprite} ${sprite.width}x${sprite.height}, cases de ${cellSize} px, ` +
        `période ${periodW}x${periodH} px${note ? ` (${note})` : ''}`,
    );
  }
  output(path.join(ASSETS_DIR, 'floors.json'), `${linesObject(manifest, '')}\n`);
  return bytes;
}

// ---------------------------------------------------------------------------
// Sons
// ---------------------------------------------------------------------------

function audioExtension(data: Buffer): string | null {
  const head = data.toString('latin1', 0, 4);
  if (head === 'RIFF' && data.toString('latin1', 8, 12) === 'WAVE') return 'wav';
  if (head === 'OggS') return 'ogg';
  if (head.startsWith('ID3')) return 'mp3';
  if (data.length > 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0) return 'mp3';
  return null;
}

function extractSounds(project: Project, excludePatterns: string[]): { count: number; bytes: number; excluded: string[] } {
  const isExcluded = makeMatcher(excludePatterns);
  const manifest: Record<string, unknown> = {};
  const excluded: string[] = [];
  let bytes = 0;
  for (const name of project.soundNames) {
    if (isExcluded(name)) {
      excluded.push(name);
      continue;
    }
    const source = path.join(project.refDir, 'sounds', name, name);
    if (!fs.existsSync(source)) {
      warnings.push(`son ${name} : fichier audio introuvable.`);
      continue;
    }
    const data = fs.readFileSync(source);
    const extension = audioExtension(data);
    if (!extension) {
      warnings.push(`son ${name} : format audio non reconnu, non copié.`);
      continue;
    }
    output(path.join(SOUNDS_DIR, `${name}.${extension}`), data);
    manifest[name] = { file: `sounds/${name}.${extension}`, bytes: data.length };
    bytes += data.length;
    console.log(`  ${name}.${extension} : ${formatBytes(data.length)}`);
  }
  output(path.join(ASSETS_DIR, 'sounds.json'), `${linesObject(manifest, '')}\n`);
  const soundsDir = path.join(project.refDir, 'sounds');
  const undeclared = fs.existsSync(soundsDir)
    ? fs.readdirSync(soundsDir).filter((name) => !project.soundNames.includes(name)).sort()
    : [];
  if (undeclared.length > 0) {
    console.log(`  (dossiers de sons absents du .yyp, donc inexistants dans le jeu, ignorés : ${undeclared.join(', ')})`);
  }
  return { count: Object.keys(manifest).length, bytes, excluded };
}

// ---------------------------------------------------------------------------
// Programme principal
// ---------------------------------------------------------------------------

function shortReasons(reasons: string[]): string {
  const objects = reasons.filter((r) => r.startsWith('objet ') || r.startsWith('masque de ') || r.startsWith('variable '));
  const rooms = reasons.filter((r) => r.startsWith('salle ')).map((r) => r.slice(6));
  const gml = reasons.filter((r) => r.startsWith('gml '));
  const other = reasons.filter((r) => r.startsWith('nom dynamique') || r === 'includeSprites');
  const parts: string[] = [];
  if (rooms.length) parts.push(`salles ${rooms.join('+')}`);
  if (objects.length) parts.push(objects.slice(0, 3).join(', ') + (objects.length > 3 ? `, +${objects.length - 3}` : ''));
  if (gml.length) parts.push(`${gml.length} fichier(s) GML`);
  if (other.length) parts.push(other[0].replace(/ \(.*\)$/, ''));
  return parts.join(' ; ');
}

function main(): void {
  const config = loadConfig();
  const project = loadProject();

  const selection = selectSprites(project, config.rooms, config.excludeSprites, config.includeSprites);

  console.log('=== Sprites ===');
  const reports = extractSprites(project, selection);
  const totalBytes = reports.reduce((sum, r) => sum + r.bytes, 0);
  const totalFrames = reports.reduce((sum, r) => sum + r.frames, 0);
  const roomReports = reports.filter((r) => r.neededByRooms);
  console.log(
    `${reports.length} sprites, ${totalFrames} images, ${formatBytes(totalBytes)} ` +
      `(dont ${roomReports.length} sprites / ${formatBytes(roomReports.reduce((s, r) => s + r.bytes, 0))} nécessaires aux salles ` +
      `${config.rooms.join(', ')}) ; ${project.spriteNames.length} sprites dans le projet d'origine.`,
  );
  console.log(`Exclus par excludeSprites (${selection.excluded.length}) : ${selection.excluded.join(', ') || '(aucun)'}`);
  if (selection.excludedButNeededByRooms.length > 0) {
    warnings.push(
      `sprites exclus mais utilisés par les salles converties : ${selection.excludedButNeededByRooms.join(', ')}.`,
    );
  }
  console.log('Noms de sprites construits à l\'exécution :');
  for (const d of selection.dynamic) {
    console.log(`  "${d.prefix}" + …${d.suffix ? ` + "${d.suffix}"` : ''} (${d.file}) → ${d.matches.join(', ') || '(aucun sprite)'}`);
  }
  console.log('Les 30 sprites les plus lourds :');
  for (const r of [...reports].sort((a, b) => b.bytes - a.bytes || (a.name < b.name ? -1 : 1)).slice(0, 30)) {
    const sprite = project.sprite(r.name)!;
    console.log(
      `  ${formatBytes(r.bytes).padStart(10)}  ${r.name} (${sprite.width}x${sprite.height}, ${r.frames} img)` +
        `${r.neededByRooms ? ' [salles]' : ''} — ${shortReasons(r.reasons)}`,
    );
  }
  if (VERBOSE) {
    console.log('Détail par sprite :');
    for (const r of reports) console.log(`  ${r.name} : ${formatBytes(r.bytes)}, ${r.frames} img — ${r.reasons.join(' ; ')}`);
  }
  if (totalBytes > SIZE_BUDGET) {
    console.log(`ATTENTION : ${formatBytes(totalBytes)} de sprites, au-delà du budget de ${formatBytes(SIZE_BUDGET)}.`);
  }

  console.log('\n=== Sols ===');
  const floorBytes = extractFloors(project, selection.floorTilesets);
  console.log(`${selection.floorTilesets.length} textures de sol, ${formatBytes(floorBytes)}.`);

  console.log('\n=== Sons ===');
  const sounds = extractSounds(project, config.excludeSounds);
  console.log(`${sounds.count} sons, ${formatBytes(sounds.bytes)} ; exclus par excludeSounds : ${sounds.excluded.length}.`);

  let removed = 0;
  for (const dir of [SPRITES_DIR, FLOORS_DIR, SOUNDS_DIR]) removed += pruneDirectory(dir, keep);

  if (warnings.length > 0) {
    console.log('\n=== Avertissements ===');
    for (const warning of warnings) console.log(`  ! ${warning}`);
  }
  console.log(
    `\nTotal public/assets : ${formatBytes(totalBytes + floorBytes + sounds.bytes)} ` +
      `(${filesWritten} fichier(s) écrits ou modifiés, ${removed} obsolète(s) supprimé(s)).`,
  );
}

main();
