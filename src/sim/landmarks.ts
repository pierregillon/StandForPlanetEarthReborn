// Repères du scénario de TvTv² : les endroits que le code du jeu vise par leurs coordonnées (marque de
// l'ultimatum, barrage de police, zone d'extraction, plans des cinématiques).
// Les valeurs ci-dessous sont celles par défaut. Le fichier de la salle peut les remplacer (clé `landmarks`,
// ADR-020) : l'éditeur de niveaux les y écrit quand on les déplace, et le jeu les relit à chaque ouverture du
// rez-de-chaussée. `TV_STUDIO` est donc modifié sur place : le lire au moment de s'en servir, jamais au
// chargement d'un module.

/** Le plateau : toute la hauteur de la régie, de sa baie vitrée au mur extérieur. */
const ROOM = { x0: 8256, x1: 10944, y0: 3072, y1: 4864 };
const MID = (ROOM.y0 + ROOM.y1) / 2;
/** Les toilettes, au-dessus du maquillage : on y entre depuis le salon d'attente, par une porte à côté du distributeur. */
const WC = { x0: 8992, x1: 9568, y0: 1408, y1: 1920, door: { y0: 1600, y1: 1856 } };
export const TV_STUDIO = {
  room: ROOM,
  /** L'estrade au logo de la chaîne, et dessus le pupitre et le présentateur, tourné vers les caméras et la régie. */
  riser: { x: 9270, y: MID },
  desk: { x: 9320, y: MID },
  anchor: { x: 9450, y: MID },
  /** Trois caméras, entre la vitre de la régie et l'estrade. */
  cameras: [{ x: 8700, y: MID - 216, angle: -106 }, { x: 8640, y: MID, angle: -90 }, { x: 8700, y: MID + 216, angle: -74 }],
  /**
   * Plans de la cinématique d'introduction (GD-080), centre de l'image : la régie et le plateau à cheval sur
   * la baie vitrée, puis le comptoir du hall d'accueil et ses écrans.
   */
  shots: { studio: { x: 8700, y: MID }, hall: { x: 4660, y: 5380 }, desk: { x: 9240, y: MID } },
  /** Marque de l'ultimatum (GD-085) : la place du présentateur, derrière le pupitre. */
  mark: { x: 9470, y: MID },
  /** Point de sauvegarde posé à la fin de l'ultimatum : l'équipe y reprend, devant l'estrade. */
  regroup: { x: 8960, y: MID - 60 },
  /**
   * La riposte (GD-086 à GD-088) : le barrage en travers du parking sud. Deux fourgons de front et un troisième
   * en retrait (angle en degrés GameMaker, 0 = l'avant vers le nord) ; devant eux, la ligne des dix policiers,
   * à plus de 400 px des portes du local technique par où l'équipe arrive ; et l'extérieur des portails 4,
   * d'où viennent les groupes suivants. Le bas du parking reste libre : c'est leur passage.
   */
  wave: {
    line: [
      { x: 10056, y: 5012 }, { x: 10030, y: 5128 }, { x: 10048, y: 5248 }, { x: 10074, y: 5376 }, { x: 10044, y: 5496 },
      { x: 10030, y: 5612 }, { x: 10052, y: 5736 }, { x: 10080, y: 5860 }, { x: 10058, y: 5980 }, { x: 10040, y: 6104 },
    ],
    outside: { x0: 9960, x1: 10650, y0: 6460, y1: 7120 },
    /** Les deux portes du local technique qui donnent sur le parking : c'est en s'en approchant qu'on déclenche le face-à-face. */
    doors: [{ x: 9584, y: 5088 }, { x: 9584, y: 6016 }],
    /** Au-delà de dix, les suivants se rangent derrière la ligne et les fourgons, au plus près d'abord. */
    rear: { x0: 10000, x1: 10900, y0: 4990, y1: 6060 },
    vans: [{ x: 10226, y: 5150, angle: 10 }, { x: 10256, y: 5650, angle: -12 }, { x: 10560, y: 5400, angle: 4 }],
  },
  /**
   * La sortie (GD-089, GD-092) : la zone d'extraction, dehors, au nord du bâtiment, à quelques secondes de
   * marche des portails 3 (qui sont en y = 1376, de x = 9920 à 10688). Le véhicule s'y pose, en son centre.
   */
  exit: { zone: { x: 10304, y: 470, radius: 300 }, landing: { x: 10304, y: 470 } },
  /** Salon d'attente et maquillage au nord, salon de sortie et vestiaire au sud. */
  lounges: { north: { x0: 8256, x1: 9568, y0: 1408, y1: 3040 }, south: { x0: 8256, x1: 9568, y0: 4896, y1: 6272 } },
  /** Toilettes au nord, au-dessus du maquillage ; local technique au sud, du plateau au mur extérieur. */
  toilets: WC,
  techRoom: { x0: 8992, x1: 9568, y0: 4896, y1: 6272 },
  /** Dépose-minute au nord (portails 3), parking de départ au sud (portails 4). */
  parkings: { north: { x0: 9600, x1: 10944, y0: 1408, y1: 3040 }, south: { x0: 9600, x1: 10944, y0: 4896, y1: 6272 } },
};

/**
 * Un repère mis à plat, pour l'éditeur de niveaux : son chemin dans `TV_STUDIO` (« wave.line.3 ») et sa forme.
 * Un point n'a que x et y, parfois un angle ou un rayon ; un rectangle a une largeur et une hauteur.
 */
export interface Mark {
  path: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  radius?: number;
  angle?: number;
}

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const DEFAULTS = copy(TV_STUDIO);

/** Recopie dans `target` les nombres de `source` qui s'y trouvent au même endroit : la forme de `target` ne change pas. */
function assign(target: Record<string, unknown>, source: unknown): void {
  if (!isObject(source)) return;
  for (const key of Object.keys(target)) {
    const mine = target[key];
    const theirs = source[key];
    if (isNumber(mine) && isNumber(theirs)) target[key] = theirs;
    else if (isObject(mine)) assign(mine, theirs);
  }
}

/** Repères par défaut, complétés par ceux d'une salle. */
export function mergedLandmarks(saved: unknown): typeof TV_STUDIO {
  const merged = copy(DEFAULTS);
  assign(merged as unknown as Record<string, unknown>, saved);
  return merged;
}

/** Le jeu prend les repères de cette salle (ou ceux par défaut si elle n'en a pas). */
export function useLandmarks(saved: unknown): void {
  assign(TV_STUDIO as unknown as Record<string, unknown>, mergedLandmarks(saved));
}

/** Tous les repères, à plat. */
export function marksOf(landmarks: unknown): Mark[] {
  const marks: Mark[] = [];
  const walk = (value: unknown, path: string): void => {
    if (!isObject(value)) return;
    if (isNumber(value.x) && isNumber(value.y)) {
      const mark: Mark = { path, x: value.x, y: value.y };
      if (isNumber(value.radius)) mark.radius = value.radius;
      if (isNumber(value.angle)) mark.angle = value.angle;
      marks.push(mark);
    } else if (isNumber(value.x0) && isNumber(value.x1) && isNumber(value.y0) && isNumber(value.y1)) {
      marks.push({ path, x: value.x0, y: value.y0, w: value.x1 - value.x0, h: value.y1 - value.y0 });
    } else {
      for (const [key, child] of Object.entries(value)) walk(child, path ? `${path}.${key}` : key);
    }
  };
  walk(landmarks, '');
  return marks;
}

/** Les repères par défaut, avec ces repères-là remis à leur place. */
export function landmarksFrom(marks: Mark[]): typeof TV_STUDIO {
  const result = copy(DEFAULTS) as unknown as Record<string, unknown>;
  for (const mark of marks) {
    let node: unknown = result;
    for (const key of mark.path.split('.')) node = isObject(node) ? node[key] : undefined;
    if (!isObject(node)) continue;
    if (mark.w !== undefined && mark.h !== undefined) Object.assign(node, { x0: mark.x, x1: mark.x + mark.w, y0: mark.y, y1: mark.y + mark.h });
    else Object.assign(node, { x: mark.x, y: mark.y }, mark.radius !== undefined ? { radius: mark.radius } : {}, mark.angle !== undefined ? { angle: mark.angle } : {});
  }
  return result as unknown as typeof TV_STUDIO;
}
