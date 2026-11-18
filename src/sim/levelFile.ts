// Écriture d'un fichier de niveau (`public/levels/<salle>.json`, format : docs/formats-donnees.md).
// Un élément par ligne : une retouche de l'éditeur de niveaux ne change que les lignes concernées, et se lit
// dans un `git diff`. Sert au convertisseur des salles d'origine comme à la sauvegarde de l'éditeur (ADR-018).
import type { LevelData } from './types.ts';

/** JSON sur une seule ligne, avec des espaces après `:` et `,`. */
export function inlineJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(inlineJson).join(', ')}]`;
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined);
    if (entries.length === 0) return '{}';
    return `{ ${entries.map(([k, v]) => `${JSON.stringify(k)}: ${inlineJson(v)}`).join(', ')} }`;
  }
  return JSON.stringify(value);
}

/** Tableau avec un élément par ligne. */
export function linesArray(items: unknown[], indent: string): string {
  if (items.length === 0) return '[]';
  return `[\n${items.map((item) => `${indent}  ${inlineJson(item)}`).join(',\n')}\n${indent}]`;
}

/** Objet avec une entrée par ligne (clés dans l'ordre fourni). */
export function linesObject(record: Record<string, unknown>, indent: string): string {
  const entries = Object.entries(record);
  if (entries.length === 0) return '{}';
  return `{\n${entries.map(([k, v]) => `${indent}  ${JSON.stringify(k)}: ${inlineJson(v)}`).join(',\n')}\n${indent}}`;
}

export function serializeLevel(level: LevelData): string {
  return [
    '{',
    `  "name": ${JSON.stringify(level.name)}, "width": ${level.width}, "height": ${level.height},`,
    `  "background": ${inlineJson(level.background)},`,
    `  "layers": ${linesArray(level.layers ?? [], '  ')},`,
    `  "objects": ${linesObject(level.objects as Record<string, unknown>, '  ')},`,
    `  "instances": ${linesArray(level.instances, '  ')},`,
    `  "walls": ${linesArray(level.walls, '  ')},`,
    `  "wallRects": ${linesArray(level.wallRects, '  ')},`,
    `  "floors": ${linesArray(level.floors, '  ')},`,
    `  "decals": ${linesArray(level.decals, '  ')}`,
    '}',
    '',
  ].join('\n');
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Contrôle d'un niveau reçu de l'éditeur avant de l'écrire : la forme attendue par le jeu, rien de plus.
 * Renvoie la première anomalie trouvée, ou null.
 */
export function levelProblem(value: unknown): string | null {
  if (!isRecord(value)) return 'not an object';
  const level = value as Partial<LevelData>;
  if (typeof level.name !== 'string' || !/^[\w-]+$/.test(level.name)) return 'bad name';
  if (!isNumber(level.width) || !isNumber(level.height) || level.width <= 0 || level.height <= 0) return 'bad size';
  if (!isRecord(level.background)) return 'bad background';
  if (!isRecord(level.objects)) return 'bad objects';
  for (const key of ['instances', 'walls', 'wallRects', 'floors', 'decals'] as const) {
    if (!Array.isArray(level[key])) return `bad ${key}`;
  }
  for (const [name, info] of Object.entries(level.objects)) {
    if (!isRecord(info) || !Array.isArray(info.parents)) return `bad object ${name}`;
  }
  const ids = new Set<string>();
  for (const inst of level.instances!) {
    if (!isRecord(inst) || typeof inst.id !== 'string' || typeof inst.object !== 'string') return 'bad instance';
    if (!level.objects[inst.object]) return `instance ${inst.id}: unknown object ${inst.object}`;
    if (![inst.x, inst.y, inst.angle, inst.scaleX, inst.scaleY, inst.depth, inst.alpha].every(isNumber)) return `instance ${inst.id}: bad number`;
    if (typeof inst.tint !== 'string' || !isRecord(inst.props)) return `instance ${inst.id}: bad tint or props`;
    if (ids.has(inst.id)) return `instance ${inst.id}: duplicate id`;
    ids.add(inst.id);
  }
  for (const wall of level.walls!) {
    if (!isRecord(wall) || typeof wall.object !== 'string' || ![wall.x, wall.y, wall.angle, wall.scaleX].every(isNumber)) return 'bad wall';
  }
  for (const rect of level.wallRects!) {
    if (!Array.isArray(rect) || rect.length !== 5 || !rect.every(isNumber)) return 'bad wall rectangle';
  }
  for (const floor of level.floors!) {
    if (!isRecord(floor) || typeof floor.tileset !== 'string' || ![floor.x, floor.y, floor.w, floor.h].every(isNumber)) return 'bad floor';
  }
  for (const decal of level.decals!) {
    if (!isRecord(decal) || typeof decal.sprite !== 'string') return 'bad decal';
    if (![decal.x, decal.y, decal.angle, decal.scaleX, decal.scaleY, decal.alpha, decal.frame, decal.depth].every(isNumber)) return `decal ${decal.sprite}: bad number`;
  }
  return null;
}
