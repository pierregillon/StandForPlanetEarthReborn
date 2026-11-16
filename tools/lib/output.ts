// Écriture des sorties : JSON compact mais lisible, synchronisation de dossiers.
import fs from 'node:fs';
import path from 'node:path';

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

/** Écrit le fichier seulement si son contenu change. Renvoie vrai s'il a été écrit. */
export function writeIfChanged(file: string, content: Buffer | string): boolean {
  const data = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  if (fs.existsSync(file)) {
    const stat = fs.statSync(file);
    if (stat.isFile() && stat.size === data.length && fs.readFileSync(file).equals(data)) return false;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  return true;
}

/**
 * Supprime, sous `dir`, tout fichier absent de `keep` (chemins absolus), puis les
 * dossiers devenus vides. Renvoie le nombre de fichiers supprimés.
 */
export function pruneDirectory(dir: string, keep: Set<string>): number {
  if (!fs.existsSync(dir)) return 0;
  const wanted = new Set([...keep].map((p) => path.resolve(p).toLowerCase()));
  let removed = 0;
  const walk = (current: string): boolean => {
    let empty = true;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (walk(full)) fs.rmdirSync(full);
        else empty = false;
      } else if (wanted.has(path.resolve(full).toLowerCase())) {
        empty = false;
      } else {
        fs.rmSync(full);
        removed++;
      }
    }
    return empty;
  };
  walk(dir);
  return removed;
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${bytes} o`;
}
