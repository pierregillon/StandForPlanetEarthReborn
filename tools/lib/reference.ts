// Accès en lecture seule au projet GameMaker de référence (GMS2 2.2, étiquette
// `remake-reference-2019`), extrait dans `.cache/reference/`.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const REPO_ROOT = path.resolve(import.meta.dirname, '..', '..');
export const REF_DIR = path.join(REPO_ROOT, '.cache', 'reference');
export const PUBLIC_DIR = path.join(REPO_ROOT, 'public');
export const CONFIG_PATH = path.join(REPO_ROOT, 'tools', 'assets.config.json');

const REFERENCE_TAG = 'remake-reference-2019';
const REFERENCE_SUBDIR = 'Stand-For-Planet-Earth';
const YYP_NAME = 'Stand-For-Planet-Earth.yyp';
const NULL_GUID = '00000000-0000-0000-0000-000000000000';

// ---------------------------------------------------------------------------
// Configuration des outils
// ---------------------------------------------------------------------------

export interface AssetsConfig {
  rooms: string[];
  excludeSprites: string[];
  includeSprites: string[];
  excludeSounds: string[];
}

export function loadConfig(): AssetsConfig {
  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as Partial<AssetsConfig>;
  return {
    rooms: raw.rooms ?? [],
    excludeSprites: raw.excludeSprites ?? [],
    includeSprites: raw.includeSprites ?? [],
    excludeSounds: raw.excludeSounds ?? [],
  };
}

/** Compile une liste d'expressions régulières (insensibles à la casse) en un test unique. */
export function makeMatcher(patterns: string[]): (name: string) => boolean {
  const regexps = patterns.map((p) => new RegExp(p, 'i'));
  return (name) => regexps.some((r) => r.test(name));
}

// ---------------------------------------------------------------------------
// Extraction du cache de référence
// ---------------------------------------------------------------------------

function run(command: string, args: string[], cwd: string): void {
  const result = spawnSync(command, args, { cwd, stdio: ['ignore', 'inherit', 'inherit'] });
  if (result.error) throw new Error(`Impossible de lancer ${command} : ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} a échoué (code ${result.status})`);
}

/**
 * Recrée `.cache/reference/` s'il est absent, à partir du dépôt d'origine
 * (`../Stand-For-Planet-Earth` ou variable d'environnement SFPE_REFERENCE_REPO).
 * Équivaut à `git archive remake-reference-2019 Stand-For-Planet-Earth | tar -x
 * -C .cache/reference --strip-components=1` ; l'archive passe par un fichier
 * temporaire et des chemins relatifs, pour que cela fonctionne aussi bien avec le
 * tar de Windows qu'avec celui de Git Bash (qui prend `C:` pour un hôte distant).
 * Le dépôt d'origine n'est que lu (`git archive`), jamais modifié.
 */
export function ensureReference(refDir: string = REF_DIR): void {
  if (fs.existsSync(path.join(refDir, YYP_NAME))) return;
  const sourceRepo = path.resolve(REPO_ROOT, process.env.SFPE_REFERENCE_REPO ?? path.join('..', 'Stand-For-Planet-Earth'));
  if (!fs.existsSync(sourceRepo)) {
    throw new Error(
      `Cache de référence absent (${refDir}) et dépôt d'origine introuvable (${sourceRepo}). ` +
        'Indiquer son chemin avec la variable SFPE_REFERENCE_REPO.',
    );
  }
  console.log(`Cache de référence absent : extraction de ${REFERENCE_TAG} depuis ${sourceRepo} (lecture seule)…`);
  fs.mkdirSync(refDir, { recursive: true });
  const tarName = `${path.basename(refDir)}.tmp.tar`;
  const tarPath = path.join(path.dirname(refDir), tarName);
  try {
    run('git', ['archive', '--format=tar', '-o', tarPath, REFERENCE_TAG, REFERENCE_SUBDIR], sourceRepo);
    run('tar', ['-xf', tarName, '-C', path.basename(refDir), '--strip-components=1'], path.dirname(refDir));
  } finally {
    fs.rmSync(tarPath, { force: true });
  }
  if (!fs.existsSync(path.join(refDir, YYP_NAME))) {
    throw new Error(`Extraction terminée mais ${YYP_NAME} est introuvable dans ${refDir}.`);
  }
}

// ---------------------------------------------------------------------------
// Modèle du projet
// ---------------------------------------------------------------------------

export interface GmProperty {
  id: string;
  varName: string;
  /** 0 réel, 1 entier, 2 chaîne, 3 booléen, 4 expression, 5 ressource, 6 liste, 7 couleur. */
  varType: number;
  value: string;
}

export interface GmOverride {
  objectId: string;
  propertyId: string;
  value: string;
}

export interface GmObject {
  name: string;
  id: string;
  sprite: string | null;
  mask: string | null;
  parent: string | null;
  visible: boolean;
  solid: boolean;
  properties: GmProperty[];
  overrides: GmOverride[];
}

export interface GmSprite {
  name: string;
  width: number;
  height: number;
  xorig: number;
  yorig: number;
  /** Boîte englobante en pixels de l'image, bornes incluses. */
  bboxLeft: number;
  bboxTop: number;
  bboxRight: number;
  bboxBottom: number;
  /** 0 automatique, 1 image entière, 2 manuelle. */
  bboxmode: number;
  /** 0 précis, 1 rectangle, 2 ellipse, 3 losange. */
  colkind: number;
  /** Masque précis distinct pour chaque image. */
  sepmasks: boolean;
  playbackSpeed: number;
  /** 0 images par seconde, 1 images par image de jeu. */
  playbackSpeedType: number;
  /** Chemins absolus des images, dans l'ordre de l'animation. */
  framePaths: string[];
}

export interface GmTileset {
  name: string;
  sprite: string | null;
  tileWidth: number;
  tileHeight: number;
  tileXOff: number;
  tileYOff: number;
  tileHSep: number;
  tileVSep: number;
  tileCount: number;
}

export interface Project {
  refDir: string;
  /** GUID → nom, pour toutes les ressources déclarées dans le .yyp. */
  nameOf: (guid: string | null | undefined) => string | null;
  objects: Map<string, GmObject>;
  /** Noms des sprites, des sons, des tilesets et des salles déclarés dans le .yyp, triés. */
  spriteNames: string[];
  soundNames: string[];
  tilesetNames: string[];
  roomNames: string[];
  sprite: (name: string) => GmSprite | null;
  tileset: (name: string) => GmTileset | null;
  /** propertyId → définition de la variable d'objet. */
  propertyById: Map<string, GmProperty>;
}

function readJson(file: string): any {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function loadProject(refDir: string = REF_DIR): Project {
  ensureReference(refDir);
  const yyp = readJson(path.join(refDir, YYP_NAME));
  const guidToName = new Map<string, string>();
  const byType = new Map<string, string[]>();
  for (const res of yyp.resources as any[]) {
    const resourcePath = String(res.Value.resourcePath).replace(/\\/g, '/');
    const name = path.posix.basename(resourcePath).replace(/\.yy$/, '');
    guidToName.set(res.Key, name);
    const type = String(res.Value.resourceType);
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type)!.push(name);
  }
  const namesOf = (type: string) => [...(byType.get(type) ?? [])].sort();
  const nameOf = (guid: string | null | undefined) =>
    guid && guid !== NULL_GUID ? (guidToName.get(guid) ?? null) : null;

  const objects = new Map<string, GmObject>();
  const propertyById = new Map<string, GmProperty>();
  for (const name of namesOf('GMObject')) {
    const file = path.join(refDir, 'objects', name, `${name}.yy`);
    if (!fs.existsSync(file)) continue;
    const yy = readJson(file);
    const properties: GmProperty[] = ((yy.properties ?? []) as any[]).map((p) => ({
      id: p.id,
      varName: String(p.varName).trim(),
      varType: Number(p.varType),
      value: String(p.value),
    }));
    for (const p of properties) propertyById.set(p.id, p);
    objects.set(name, {
      name,
      id: yy.id,
      sprite: nameOf(yy.spriteId),
      mask: nameOf(yy.maskSpriteId),
      parent: nameOf(yy.parentObjectId),
      visible: Boolean(yy.visible),
      solid: Boolean(yy.solid),
      properties,
      overrides: ((yy.overriddenProperties ?? []) as any[]).map((o) => ({
        objectId: o.objectId,
        propertyId: o.propertyId,
        value: String(o.value),
      })),
    });
  }

  const spriteCache = new Map<string, GmSprite | null>();
  const sprite = (name: string): GmSprite | null => {
    if (spriteCache.has(name)) return spriteCache.get(name)!;
    const dir = path.join(refDir, 'sprites', name);
    const file = path.join(dir, `${name}.yy`);
    let result: GmSprite | null = null;
    if (fs.existsSync(file)) {
      const yy = readJson(file);
      result = {
        name,
        width: yy.width,
        height: yy.height,
        xorig: yy.xorig,
        yorig: yy.yorig,
        bboxLeft: yy.bbox_left,
        bboxTop: yy.bbox_top,
        bboxRight: yy.bbox_right,
        bboxBottom: yy.bbox_bottom,
        bboxmode: yy.bboxmode,
        colkind: yy.colkind,
        sepmasks: Boolean(yy.sepmasks),
        playbackSpeed: yy.playbackSpeed,
        playbackSpeedType: yy.playbackSpeedType,
        framePaths: ((yy.frames ?? []) as any[]).map((f) => path.join(dir, `${f.id}.png`)),
      };
    }
    spriteCache.set(name, result);
    return result;
  };

  const tilesetCache = new Map<string, GmTileset | null>();
  const tileset = (name: string): GmTileset | null => {
    if (tilesetCache.has(name)) return tilesetCache.get(name)!;
    const file = path.join(refDir, 'tilesets', name, `${name}.yy`);
    let result: GmTileset | null = null;
    if (fs.existsSync(file)) {
      const yy = readJson(file);
      result = {
        name,
        sprite: nameOf(yy.spriteId),
        tileWidth: yy.tilewidth,
        tileHeight: yy.tileheight,
        tileXOff: yy.tilexoff,
        tileYOff: yy.tileyoff,
        tileHSep: yy.tilehsep,
        tileVSep: yy.tilevsep,
        tileCount: yy.tile_count,
      };
    }
    tilesetCache.set(name, result);
    return result;
  };

  return {
    refDir,
    nameOf,
    objects,
    spriteNames: namesOf('GMSprite'),
    soundNames: namesOf('GMSound'),
    tilesetNames: namesOf('GMTileSet'),
    roomNames: namesOf('GMRoom'),
    sprite,
    tileset,
    propertyById,
  };
}

// ---------------------------------------------------------------------------
// Héritage d'objets et valeurs de propriétés
// ---------------------------------------------------------------------------

export type PropValue = number | boolean | string | null | PropValue[];

/** L'objet puis ses parents, du plus proche au plus lointain. */
export function objectChain(project: Project, name: string): GmObject[] {
  const chain: GmObject[] = [];
  const seen = new Set<string>();
  let current = project.objects.get(name) ?? null;
  while (current && !seen.has(current.name)) {
    chain.push(current);
    seen.add(current.name);
    current = current.parent ? (project.objects.get(current.parent) ?? null) : null;
  }
  return chain;
}

const NUMBER_RE = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/**
 * Convertit la valeur textuelle d'une variable d'objet : nombres en nombres,
 * `True`/`False` en booléens, `noone` en `null`, le reste (noms de ressources,
 * expressions GML) en chaîne. Les variables de type chaîne restent des chaînes.
 */
export function convertPropertyValue(raw: string, varType: number | undefined): PropValue {
  const text = raw.trim();
  if (varType === 2) {
    const quoted = /^"(.*)"$/s.exec(raw) ?? /^'(.*)'$/s.exec(raw);
    return quoted ? quoted[1] : raw;
  }
  if (/^noone$/i.test(text)) return null;
  if (/^true$/i.test(text)) return true;
  if (/^false$/i.test(text)) return false;
  if (NUMBER_RE.test(text)) {
    const n = Number(text);
    return varType === 3 ? n !== 0 : n;
  }
  const quoted = /^"([^"]*)"$/.exec(text) ?? /^'([^']*)'$/.exec(text);
  if (quoted) return quoted[1];
  return text;
}

/**
 * Valeurs par défaut des variables d'un objet : défauts déclarés par l'objet et
 * ses parents, puis `overriddenProperties` des enfants (l'enfant le plus proche
 * de l'objet gagne).
 */
export function objectDefaultProps(project: Project, name: string): Record<string, PropValue> {
  const props: Record<string, PropValue> = {};
  const chain = objectChain(project, name).reverse();
  for (const object of chain) {
    for (const override of object.overrides) {
      const definition = project.propertyById.get(override.propertyId);
      if (definition) props[definition.varName] = convertPropertyValue(override.value, definition.varType);
    }
    for (const property of object.properties) {
      props[property.varName] = convertPropertyValue(property.value, property.varType);
    }
  }
  return props;
}

/** Couleur GameMaker `0xAABBGGRR` → teinte `#rrggbb` et alpha 0..1. */
export function splitColour(value: number): { tint: string; alpha: number } {
  const v = value >>> 0;
  const r = v & 0xff;
  const g = (v >>> 8) & 0xff;
  const b = (v >>> 16) & 0xff;
  const a = (v >>> 24) & 0xff;
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return { tint: `#${hex(r)}${hex(g)}${hex(b)}`, alpha: Math.round((a / 255) * 1000) / 1000 };
}

/** Retire les commentaires `//` et `/* *\/` d'un code GML, sans toucher aux chaînes. */
export function stripGmlComments(code: string): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i];
    const next = code[i + 1];
    if (c === '"' || c === "'") {
      const end = code.indexOf(c, i + 1);
      const stop = end === -1 ? code.length : end + 1;
      out += code.slice(i, stop);
      i = stop;
    } else if (c === '/' && next === '/') {
      const end = code.indexOf('\n', i);
      i = end === -1 ? code.length : end;
    } else if (c === '/' && next === '*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 2;
      out += ' ';
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Tous les fichiers .gml d'un dossier (récursif), triés. */
export function listGmlFiles(dir: string): string[] {
  const out: string[] = [];
  if (!fs.existsSync(dir)) return out;
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.toLowerCase().endsWith('.gml')) out.push(full);
    }
  };
  walk(dir);
  return out;
}
