// Écriture des sorties : JSON compact mais lisible, synchronisation de dossiers.
import fs from 'node:fs';
import path from 'node:path';

// la mise en forme du JSON est partagée avec la sauvegarde de l'éditeur de niveaux
export { inlineJson, linesArray, linesObject } from '../../src/sim/levelFile.ts';

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
