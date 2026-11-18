// Ce que le remake change dans les salles d'origine (ADR-016). Les fichiers de `public/levels` sont la
// conversion fidèle des salles GameMaker : ce qu'on y ajoute, retire ou déplace est décrit ici et appliqué au
// chargement, au même endroit pour le serveur, le navigateur et les tests.
import type { LevelData, LevelDecal, LevelFloor, LevelInstance, LevelObjectInfo, LevelWall } from './types.ts';

type Rect = [number, number, number, number, number];

interface Change {
  objects?: Record<string, LevelObjectInfo>;
  instances?: LevelInstance[];
  walls?: LevelWall[];
  wallRects?: Rect[];
  floors?: LevelFloor[];
  decals?: LevelDecal[];
  /** Instance d'origine : rendue telle quelle, modifiée, ou retirée (null). */
  instance?: (inst: LevelInstance) => LevelInstance | null;
  /** Décalques, pièces de mur et rectangles de collision d'origine à retirer. */
  dropDecal?: (decal: LevelDecal) => boolean;
  dropWall?: (wall: LevelWall) => boolean;
  dropWallRect?: (rect: Rect) => boolean;
}

// ---------- Fabrique d'éléments ----------

let serial = 0;
function instance(object: string, layer: string, depth: number, x: number, y: number, angle = 0, props: Record<string, unknown> = {}, scale = 1): LevelInstance {
  return { id: `add_${++serial}`, object, layer, depth, x, y, angle, scaleX: scale, scaleY: scale, tint: '#ffffff', alpha: 1, props };
}
/** Meuble : il arrête les robots, pas les balles. */
const furniture = (object: string, x: number, y: number, angle = 0, scale = 1): LevelInstance =>
  instance(object, 'layer_deco', 200, x, y, angle, { bulletCrossed: true }, scale);
const decal = (sprite: string, x: number, y: number, angle = 0, scaleX = 1, scaleY = 1, tint = '#ffffff'): LevelDecal =>
  ({ sprite, x, y, angle, scaleX, scaleY, tint, alpha: 1, frame: 0, depth: 600 });
/** Lampe : rayon en pixels, intensité de 0 à 1, teinte et saturation sur 255 comme dans l'original. */
const lamp = (x: number, y: number, radius: number, intensity: number, hue = 0, sat = 0): LevelInstance =>
  instance('obj_lumiere', 'layer_lumiere', 500, x, y, 0, { radius, hue, sat, lightIntensity: intensity }, radius / 150);
/**
 * Projecteur de studio (GD-082) : le meuble et son faisceau, braqués dans la direction `angle` (degrés
 * GameMaker). `reach` : portée du faisceau en pixels.
 */
const spot = (x: number, y: number, angle: number, reach: number): LevelInstance[] => [
  furniture('obj_tv_spot', x, y, angle),
  instance('obj_lumiere', 'layer_lumiere', 500, x, y, 0, { radius: reach, hue: 32, sat: 60, lightIntensity: 0.6, coneAngle: angle, coneHalf: 25 }, reach / 150),
];
const decor = (sprite: string): LevelObjectInfo => ({ sprite, mask: null, parents: ['obj_mobilier_parent', 'obj_decor_base'], visible: true });
/** Civil ajouté : `stays` = il reste à son poste tant que rien ne l'effraie. */
const civil = (object: string, x: number, y: number, angle: number, stays: boolean): LevelInstance =>
  instance(object, 'layer_npc', 0, x, y, angle, {
    normalSpd: 3, maxHealth: 1, hearRange: 1000, viewRange: 800, genre: 'humain', patrolType: stays ? 'none' : 'random',
    patrolRange: 500, patrolPauseTime: 2, patrolSpeed: 5, fearDuration: 30, fearSpeed: '2*normalSpd',
  });
/** Zone de brouillard de guerre : `number` la nomme, `attached` la fait se lever avec la zone de ce nom. */
function fog(x: number, y: number, w: number, h: number, number: number | null, attached: number | null): LevelInstance {
  return {
    id: `add_${++serial}`, object: 'obj_warFog', layer: 'layer_warFog', depth: -100, x, y, angle: 0, scaleX: w / 64, scaleY: h / 64, tint: '#ffffff', alpha: 1,
    props: { warFogNumber: number, attachedWarFogNumber: attached, apparitionSpeed: 0.08 },
  };
}

/** Mur fin horizontal, une pièce par case de 32 px ; `capStart`/`capEnd` : il finit par un bout arrondi. */
function wallRow(x0: number, x1: number, y: number, capStart = false, capEnd = false): LevelWall[] {
  const walls: LevelWall[] = [];
  for (let x = x0; x < x1; x += 32) {
    const first = x === x0 && capStart, last = x + 32 >= x1 && capEnd;
    walls.push({ object: first || last ? 'obj_mur_fin_bout' : 'obj_mur_fin', thick: false, x: x + 16, y: y + 16, angle: last ? 180 : 0, scaleX: 1 });
  }
  return walls;
}
/** Mur fin vertical, fini par un bout à chaque extrémité. */
function wallColumn(x: number, y0: number, y1: number): LevelWall[] {
  const walls: LevelWall[] = [];
  for (let y = y0; y < y1; y += 32) {
    const first = y === y0, last = y + 32 >= y1;
    walls.push({ object: first || last ? 'obj_mur_fin_bout' : 'obj_mur_fin', thick: false, x: x + 16, y: y + 16, angle: first ? 270 : 90, scaleX: 1 });
  }
  return walls;
}

/** Mur fin vertical sans bouts : il rejoint un autre mur à chaque extrémité. */
function wallRun(x: number, y0: number, y1: number): LevelWall[] {
  const walls: LevelWall[] = [];
  for (let y = y0; y < y1; y += 32) walls.push({ object: 'obj_mur_fin', thick: false, x: x + 16, y: y + 16, angle: 90, scaleX: 1 });
  return walls;
}

/** Une instance d'origine se reconnaît à son objet et à sa position. */
const at = (inst: LevelInstance, object: string, x: number, y: number): boolean =>
  inst.object === object && Math.abs(inst.x - x) < 2 && Math.abs(inst.y - y) < 2;
const same = (rect: Rect, x: number, y: number, w: number, h: number): boolean => rect[0] === x && rect[1] === y && rect[2] === w && rect[3] === h;

// ---------- L'aile est de TvTv² (GD-081 à GD-083) ----------
//
// Du nord au sud, le trajet d'un invité de la chaîne : dépose-minute et salon d'attente, plateau, salon de
// sortie et parking. À l'ouest, la régie d'origine, inchangée ; l'aile commence à sa baie vitrée (x = 8256).

/** Le plateau : toute la hauteur de la régie, de sa baie vitrée au mur extérieur. */
const ROOM = { x0: 8256, x1: 10944, y0: 3072, y1: 4864 };
const MID = (ROOM.y0 + ROOM.y1) / 2;
/** Les deux portes automatiques du plateau, au nord et au sud, côté régie. */
const DOOR = { x: 8480, half: 128 };
/** Fond de décor : une cloison qui sépare le plateau des coulisses, avec un passage de chaque côté. */
const BACKDROP = { x: 9632, y0: MID - 400, y1: MID + 400 };
/**
 * Cloison entre les salons et les parkings, à x = 9568. Celle d'origine est percée d'une porte de chaque côté
 * du plateau ; elle est prolongée au nord pour fermer les toilettes, au sud pour fermer le local technique,
 * qui a une seconde porte en bas (`low`).
 */
const SIDE = { x: 9568, north: { y0: 2720, y1: 2976 }, south: { y0: 4960, y1: 5216 }, low: { y0: 5888, y1: 6144 } };
/** Les toilettes, au-dessus du maquillage : on y entre depuis le salon d'attente, par une porte à côté du distributeur. */
const WC = { x0: 8992, x1: 9568, y0: 1408, y1: 1920, door: { y0: 1600, y1: 1856 } };
/** Les parkings : la chaussée commence après le trottoir, et les places longent le mur extérieur. */
const KERB = 9792;
const BAYS = 10560;

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

const AUTO_DOOR = { bulletCrossed: false, automaticDoor: true, blockedOpen: false, detectionRange: 200, openTime: 0.5, closeTime: 0.5, stayOpenTime: 1 };
const autoDoor = (x: number, y: number, angle: number): LevelInstance => instance('obj_automaticDoor', 'layer_doors', -500, x, y, angle, AUTO_DOOR);

/** Un coin canapé : tapis, canapé adossé au mur ouest, table basse, fauteuil en face. */
const seating = (y: number): { instances: LevelInstance[]; decals: LevelDecal[] } => ({
  decals: [decal('spr_tapis', 8520, y)],
  instances: [furniture('obj_canape', 8338, y, 90), furniture('obj_table_attente', 8520, y, 90), furniture('obj_fauteuil', 8710, y, 270)],
});
/** Les canapés ne sont qu'au nord, là où l'on attend d'entrer en plateau (GD-084). */
const loungeNorth = [seating(2100), seating(2560)];

/**
 * Marquages d'un parking. `gateY` : ordonnée du portail ; `dir` : +1 si le parking s'étend vers le sud depuis
 * son portail (parking nord), -1 s'il s'étend vers le nord (parking sud). `doorY` : la porte du salon.
 */
function parkingMarks(gateY: number, dir: 1 | -1, doorY: number, bays: number[]): LevelDecal[] {
  const away = dir === 1 ? 270 : 90; // « en s'éloignant du portail », en degrés GameMaker
  return [
    // l'entrée : une voie dans chaque sens, séparées par une ligne. On roule à droite : vers le sud du côté
    // ouest, vers le nord du côté est, dans les deux parkings
    decal('spr_pk_line', 10304, gateY + dir * 40, away, 1.15),
    decal('spr_pk_arrow', 10140, gateY + dir * 300, 180),
    decal('spr_pk_arrow', 10470, gateY + dir * 300, 0),
    // les places, toutes le long du mur extérieur : on s'y gare en marche avant depuis la voie (GD-084)
    ...bays.map((y) => decal('spr_pk_line', BAYS, y, 0, 0.94)),
    // la dépose devant le trottoir, et le passage piéton vers la porte du salon
    decal('spr_pk_hatch', 10030, doorY - dir * 420, 90),
    decal('spr_pk_zebra', 10010, doorY),
  ];
}

const CHANGES: Record<string, Change> = {
  rm_world2: {
    objects: {
      obj_tv_camera: decor('spr_camera'),
      obj_tv_desk: decor('spr_tv_desk'),
      obj_tv_spot: decor('spr_tv_spot'),
      obj_tv_ledwall: decor('spr_tv_ledwall'),
      obj_tv_onair: decor('spr_tv_onair'),
      obj_pk_police_van: decor('spr_pk_police_van'),
      obj_tv_crate: decor('spr_crate'),
      obj_tv_makeup: decor('spr_tv_makeup'),
      obj_tv_rack: decor('spr_tv_rack'),
      obj_serveur: decor('spr_serveur'),
    },

    // ---- les murs. Le plateau prend la hauteur de la régie : ses murs nord et sud prolongent les siens.
    walls: [
      ...wallRow(ROOM.x0, DOOR.x - DOOR.half, ROOM.y0 - 32, false, true), ...wallRow(DOOR.x + DOOR.half, ROOM.x1, ROOM.y0 - 32, true),
      ...wallRow(ROOM.x0, DOOR.x - DOOR.half, ROOM.y1, false, true), ...wallRow(DOOR.x + DOOR.half, ROOM.x1, ROOM.y1, true),
      ...wallColumn(BACKDROP.x, BACKDROP.y0, BACKDROP.y1),
      // les toilettes : la cloison monte jusqu'au mur extérieur, et deux séparations entre les cabines
      ...wallRun(SIDE.x, WC.y0, WC.y1), ...wallRun(9184, WC.y0, WC.y0 + 160), ...wallRun(9376, WC.y0, WC.y0 + 160),
      // le local technique : la cloison descend jusqu'au mur extérieur, autour de sa porte du bas
      ...wallRun(SIDE.x, 5632, SIDE.low.y0), ...wallRun(SIDE.x, SIDE.low.y1, 6272),
      { object: 'obj_mur_fin', thick: false, x: 8976, y: 5648, angle: 90, scaleX: 1 },
    ],
    wallRects: [
      [ROOM.x0, ROOM.y0 - 32, DOOR.x - DOOR.half - ROOM.x0, 32, 0], [DOOR.x + DOOR.half, ROOM.y0 - 32, ROOM.x1 - DOOR.x - DOOR.half, 32, 0],
      [ROOM.x0, ROOM.y1, DOOR.x - DOOR.half - ROOM.x0, 32, 0], [DOOR.x + DOOR.half, ROOM.y1, ROOM.x1 - DOOR.x - DOOR.half, 32, 0],
      [BACKDROP.x, BACKDROP.y0, 32, BACKDROP.y1 - BACKDROP.y0, 0],
      // la cloison entre salons et parkings, refaite autour de ses deux nouvelles portes
      [SIDE.x, 1952, 32, SIDE.north.y0 - 1952, 0], [SIDE.x, SIDE.north.y1, 32, ROOM.y0 - 32 - SIDE.north.y1, 0],
      [SIDE.x, ROOM.y1 + 32, 32, SIDE.south.y0 - ROOM.y1 - 32, 0], [SIDE.x, SIDE.south.y1, 32, SIDE.low.y0 - SIDE.south.y1, 0],
      [SIDE.x, SIDE.low.y1, 32, 6272 - SIDE.low.y1, 0],
      // le coin du mur qui sépare le salon de sortie du local technique reste en place
      [8960, 5632, 32, 32, 0],
      // les toilettes : cloison côté parking, séparations des cabines, et le mur du salon percé d'une porte
      [SIDE.x, WC.y0, 32, WC.y1 - WC.y0, 0], [9184, WC.y0, 32, 160, 0], [9376, WC.y0, 32, 160, 0],
      [8960, 1376, 32, WC.door.y0 - 1376, 0], [8960, WC.door.y1, 32, 1920 - WC.door.y1, 0],
    ],
    // les deux murs de l'ancienne alcôve disparaissent dans le plateau, ainsi que le bout de cloison qui y
    // descendait ; la cloison entre salons et parkings est remplacée par ses morceaux ci-dessus
    dropWallRect: (r) => same(r, 9568, 3360, 1376, 32) || same(r, 9568, 4320, 1376, 32) || same(r, 9568, 4672, 32, 960) || same(r, 9568, 1952, 32, 1088)
      // le mur entre le vestiaire d'origine et le bas du parking : le local technique va jusqu'en bas
      || same(r, 8960, 5632, 640, 32)
      // le mur du salon d'attente, refait autour de la porte des toilettes
      || same(r, 8960, 1376, 32, 544),
    dropWall: (w) => !w.thick && (
      (w.x >= 9568 && w.x < ROOM.x1 && (w.y === 3376 || w.y === 4336))
      || (w.x === SIDE.x + 16 && w.y > 4672 && w.y < ROOM.y1 + 32)
      || (w.x === SIDE.x + 16 && w.y > SIDE.north.y0 && w.y < SIDE.north.y1)
      || (w.x === SIDE.x + 16 && w.y > SIDE.south.y0 && w.y < SIDE.south.y1)
      || (w.y === 5648 && w.x >= 8976 && w.x <= SIDE.x + 16)
      || (w.x === 8976 && w.y > WC.door.y0 && w.y < WC.door.y1)
    ),

    // ---- les sols : résine de studio, parquet des salons, carrelage du maquillage, bitume et trottoir des parkings
    floors: [
      { object: 'obj_textureGenerator_studio', tileset: 'til_sol_studio', x: ROOM.x0, y: ROOM.y0, w: ROOM.x1 - ROOM.x0, h: ROOM.y1 - ROOM.y0, phaseX: 0, phaseY: 0 },
      { object: 'obj_textureGenerator_parquet', tileset: 'til_sol_parquet', x: 8256, y: 1408, w: 720, h: 1632, phaseX: 0, phaseY: 0 },
      { object: 'obj_textureGenerator_carrelage', tileset: 'til_sol_carrelage', x: 8976, y: 1952, w: 592, h: 1088, phaseX: 0, phaseY: 0 },
      { object: 'obj_textureGenerator_parquet', tileset: 'til_sol_parquet', x: 8256, y: 4896, w: 720, h: 1376, phaseX: 0, phaseY: 0 },
      { object: 'obj_textureGenerator_carrelage', tileset: 'til_sol_carrelage', x: 8976, y: WC.y0, w: 592, h: WC.y1 - WC.y0, phaseX: 0, phaseY: 0 },
      // le local technique : un caillebotis métallique, du plateau jusqu'au mur extérieur
      { object: 'obj_textureGenerator_grille', tileset: 'til_sol_grille', x: 8976, y: 4896, w: 592, h: 1376, phaseX: 0, phaseY: 0 },
      { object: 'obj_textureGenerator_asphalte', tileset: 'til_sol_asphalte', x: 9600, y: 1408, w: 1344, h: 1632, phaseX: 0, phaseY: 0 },
      { object: 'obj_textureGenerator_pave', tileset: 'til_sol_pave', x: 9600, y: 1952, w: KERB - 9600, h: 1088, phaseX: 0, phaseY: 0 },
      { object: 'obj_textureGenerator_asphalte', tileset: 'til_sol_asphalte', x: 9600, y: 4896, w: 1344, h: 1376, phaseX: 0, phaseY: 0 },
      { object: 'obj_textureGenerator_pave', tileset: 'til_sol_pave', x: 9600, y: 4896, w: KERB - 9600, h: 1376, phaseX: 0, phaseY: 0 },
    ],
    // la route et la grille de ventilation d'origine, hors d'échelle, disparaissent
    dropDecal: (d) => d.sprite === 'spr_ventilation' || /^spr_(route|coin)/.test(d.sprite),
    decals: [
      decal('spr_tv_riser', TV_STUDIO.riser.x, MID),
      decal('spr_tv_cables', 8520, MID - 156), decal('spr_tv_cables', 8530, MID + 154, 0, 1, -1),
      decal('spr_tv_cables', 10000, MID + 300, 20),
      decal('spr_tapis', 9440, 4690, 0, 0.8, 0.8),
      ...loungeNorth.flatMap((s) => s.decals),
      ...parkingMarks(1408, 1, (SIDE.north.y0 + SIDE.north.y1) / 2, [2000, 2190, 2380, 2570, 2760, 2950]),
      ...parkingMarks(6272, -1, (SIDE.south.y0 + SIDE.south.y1) / 2, [4950, 5140, 5330, 5520]),
      // les potelets jaunes du bord du trottoir ne sont plus que des plots peints au sol : en obstacles, ils
      // accrochaient les robots en plein combat (GD-092)
      ...[2000, 2170, 2340, 2510, 2680, 3010, 4940, 5290, 5450, 5610, 5770, 6200].map((y) => decal('spr_pk_bollard', KERB + 16, y)),
    ],

    instance: (inst) => {
      const east = inst.x >= ROOM.x0 && inst.x < 11000;
      // ce qui encombrait les quais : fourgons géants, conteneurs, étagères de livraison, poubelles, boîtes bonus
      if (east && (inst.object === 'obj_car_van' || inst.object === 'obj_container' || inst.object === 'obj_bonus_box'
        || inst.object === 'obj_poubelle' || /^obj_etager\d$/.test(inst.object))) return null;
      // le brouillard de guerre de l'aile ne se lève plus d'un bloc : la régie et le plateau ensemble, puis
      // chaque salon et chaque parking quand on y entre
      if (at(inst, 'obj_warFog', 6800, 3056)) return { ...inst, props: { ...inst.props, attachedWarFogNumber: null } };
      if (at(inst, 'obj_warFog', 8240, 1392)) return { ...inst, scaleX: 736 / 64, props: { ...inst.props, attachedWarFogNumber: null } };
      if (at(inst, 'obj_warFog', 8240, 4880)) return { ...inst, scaleX: 736 / 64, props: { ...inst.props, attachedWarFogNumber: null } };
      // aucun garde sur le plateau ni dans les salons au départ (GD-082, GD-083), sauf un policier devant
      // chaque porte du plateau, côté salon ; les autres tiennent les deux parkings. Rien ne les empêche
      // d'entrer ensuite, pendant la partie.
      const move = (object: string, x: number, y: number, toX: number, toY: number, angle = inst.angle): LevelInstance | null =>
        at(inst, object, x, y) ? { ...inst, x: toX, y: toY, angle } : null;
      const moved = move('obj_npc_human_pistol', 10272, 3616, 8480, 2910, 90) ?? move('obj_npc_human_pistol', 10016, 4128, 8480, 5030, 270)
        ?? move('obj_npc_human_pistol', 9312, 3008, 9700, 2300) ?? move('obj_npc_human_pistol', 10816, 3104, 10780, 2930)
        ?? move('obj_npc_human_pistol', 9952, 4608, 9700, 5420) ?? move('obj_npc_human_pistol', 9344, 6080, 9900, 6060)
        ?? move('obj_npc_human_pistol', 9536, 1664, 9900, 1740)
        // les boutons des portails étaient sur un mur désormais intérieur : ils passent sur la cloison, côté parking
        ?? move('obj_button', 9008, 1632, SIDE.x + 48, 1632) ?? move('obj_button', 9008, 5952, SIDE.x + 48, 5760)
        ?? move('obj_npc_robot_shield', 9120, 3712, 10400, 2300) ?? move('obj_npc_robot_shield', 8896, 2560, 10400, 5380)
        ?? move('obj_npc_robot_lightBot', 8832, 3328, 9950, 2640)
        ?? move('obj_npc_robot_shotBot', 8544, 3040, 10250, 1700) ?? move('obj_npc_robot_shotBot', 8704, 4544, 10250, 5960)
        ?? move('obj_npc_civil_technicien', 8352, 2080, 8780, 1700) ?? move('obj_npc_civil_technicien', 8480, 2496, 8800, 2340);
      if (moved) return moved;
      // deux techniciens tiennent une caméra ; en régie, les autres restent assis devant leurs écrans
      const posted = (x: number, y: number, angle: number): LevelInstance => ({ ...inst, x, y, angle, props: { ...inst.props, patrolType: 'none' } });
      if (at(inst, 'obj_npc_civil_technicien', 10368, 4128)) return posted(8615, MID - 238, 0);
      if (at(inst, 'obj_npc_civil_technicien', 9856, 3680)) return posted(8615, MID + 238, 0);
      if (inst.object === 'obj_npc_civil_technicien' && inst.x > 7800 && inst.x < 7950 && inst.y > 3300 && inst.y < 4500) return posted(inst.x, inst.y, inst.angle);
      return inst;
    },

    instances: [
      // ---- portes : les deux du plateau, et une de chaque salon vers son parking
      autoDoor(DOOR.x, ROOM.y0 - 16, 180), autoDoor(DOOR.x, ROOM.y1 + 16, 0),
      autoDoor(SIDE.x + 16, (SIDE.north.y0 + SIDE.north.y1) / 2, 90), autoDoor(SIDE.x + 16, (SIDE.south.y0 + SIDE.south.y1) / 2, 90),
      // le local technique a une seconde porte sur le parking, en bas : la police entrera par les deux (GD-084)
      autoDoor(SIDE.x + 16, (SIDE.low.y0 + SIDE.low.y1) / 2, 90),
      autoDoor(8976, (WC.door.y0 + WC.door.y1) / 2, 90),
      instance('obj_tv_onair', 'layer_deco', -250, 8690, ROOM.y0 - 16), instance('obj_tv_onair', 'layer_deco', -250, 8690, ROOM.y1 + 16),
      // ---- brouillard : le décrochement de chaque salon se lève avec lui, chaque parking à part
      fog(8976, 1936, 608, 1120, null, 18), fog(8976, 1392, 608, 544, null, 18), fog(9584, 1392, 1392, 544, 118, null), fog(9584, 1936, 1392, 1120, null, 118),
      fog(8976, 4880, 608, 1424, null, 17), fog(9584, 4880, 1392, 768, 117, null), fog(9584, 5648, 1392, 656, null, 117),

      // ======== LE PLATEAU ========
      // `shadow` : hauteur du meuble, pour l'ombre qu'il porte sous les projecteurs
      instance('obj_tv_desk', 'layer_deco', 200, TV_STUDIO.desk.x, TV_STUDIO.desk.y, 0, { bulletCrossed: true, shadow: 40 }),
      civil('obj_npc_civil_malette', TV_STUDIO.anchor.x, TV_STUDIO.anchor.y, 180, true),
      ...TV_STUDIO.cameras.map((c) => instance('obj_tv_camera', 'layer_deco', 200, c.x, c.y, c.angle, { bulletCrossed: true, shadow: 70 }, 1.5)),
      furniture('obj_ecran', 8790, MID - 96, 200), furniture('obj_ecran', 8790, MID + 96, 160),
      // deux projecteurs de face et deux contre-jours, tous braqués sur le présentateur ; les contre-jours sont
      // écartés du pupitre pour qu'un robot passe derrière et prenne sa place (GD-083)
      ...spot(8960, MID - 400, -39, 950), ...spot(8960, MID + 400, 39, 950),
      ...spot(9575, MID - 340, -110, 620), ...spot(9575, MID + 340, 110, 620),
      furniture('obj_tv_ledwall', BACKDROP.x - 20, MID, 90),
      // peu de lumière d'ambiance : ce sont les projecteurs qui éclairent le décor ; le mur d'écrans y ajoute son bleu
      lamp(9280, MID, 520, 0.22), lamp(8700, MID, 460, 0.3), lamp(9560, MID, 420, 0.5, 160, 190),
      // côté nord : le coin où l'invité attend son entrée, et le matériel rangé
      furniture('obj_canape', 8830, 3146), furniture('obj_fauteuil', 9060, 3152), furniture('obj_table_attente', 8830, 3296), furniture('obj_plante', 8650, 3140),
      furniture('obj_tv_crate', 9300, 3150), furniture('obj_tv_crate', 9392, 3158, 10), furniture('obj_tv_crate', 9344, 3240, -7), furniture('obj_tv_crate', 9490, 3152, 4),
      furniture('obj_tv_spot', 9210, 3340, 200),
      lamp(8900, 3260, 440, 0.3),
      // côté sud : le gradin du public et le coin d'interview
      ...[0, 1, 2, 3, 4, 5].flatMap((i) => [furniture('obj_chaise_bleu', 8780 + i * 95, 4610, 180), furniture('obj_chaise_bleu', 8780 + i * 95, 4730, 180)]),
      instance('obj_fauteuilRond1', 'layer_deco', 200, 9375, 4690, 20), instance('obj_fauteuilRond2', 'layer_deco', 200, 9510, 4690, 160),
      furniture('obj_plante', 9570, 4800),
      lamp(9050, 4670, 480, 0.32),
      // les coulisses, derrière la cloison : baies techniques, caisses, poste de contrôle, vestiaires, coin repos
      furniture('obj_serveur', 9900, 3154, 90), furniture('obj_serveur', 10120, 3154, 90), furniture('obj_serveur', 10340, 3154, 90),
      furniture('obj_canape', 10700, 3146), furniture('obj_fauteuil', 10860, 3340, 270), furniture('obj_table_attente', 10690, 3306), furniture('obj_plante', 10890, 3560),
      furniture('obj_tv_crate', 9760, 3700), furniture('obj_tv_crate', 9846, 3712, 12), furniture('obj_tv_crate', 9800, 3790, -8),
      furniture('obj_table0', 10300, MID, 90), furniture('obj_ecran', 10262, MID - 60), furniture('obj_ecran', 10262, MID + 60), furniture('obj_siege_accueil', 10400, MID),
      furniture('obj_tv_rack', 10880, 4060, 90),
      furniture('obj_casierModulable', 9900, 4812), furniture('obj_casierModulable', 10090, 4812), furniture('obj_casierModulable', 10280, 4812),
      furniture('obj_distributeur', 10480, 4776, 180),
      furniture('obj_table1', 10760, 4768), furniture('obj_lampeBureau', 10660, 4768), furniture('obj_lampeBureau', 10860, 4768),
      furniture('obj_tv_spot', 9800, 4640, 200), furniture('obj_tv_spot', 9900, 4700, 120),
      lamp(10300, MID, 640, 0.4), lamp(10300, 3320, 420, 0.3), lamp(10300, 4620, 420, 0.3),

      // ======== AU NORD : SALON D'ATTENTE, MAQUILLAGE, DÉPOSE-MINUTE ========
      ...loungeNorth.flatMap((s) => s.instances),
      // (les deux chaises à droite du premier coin canapé barraient le passage vers le plateau : retirées, GD-092)
      furniture('obj_chaise_marron', 8425, 1466), furniture('obj_chaise_marron', 8520, 1466),
      furniture('obj_distributeur', 8700, 1492),
      // les toilettes : trois cabines contre le mur extérieur, les lavabos en face
      furniture('obj_wc', 9090, 1474), furniture('obj_wc', 9296, 1474), furniture('obj_wc', 9478, 1474),
      furniture('obj_lavabo', 9110, 1872, 180), furniture('obj_lavabo', 9290, 1872, 180), furniture('obj_lavabo', 9470, 1872, 180),
      lamp(9280, 1660, 440, 0.5), furniture('obj_plante', 8300, 1870), furniture('obj_plante', 8300, 2330), furniture('obj_plante', 8300, 2980),
      civil('obj_npc_civil_malette', 8580, 2300, 200, false), civil('obj_npc_civil_femme', 8620, 2760, 30, false),
      lamp(8600, 2050, 700, 0.45), lamp(8600, 2700, 620, 0.4),
      // le maquillage, dans le décrochement : deux coiffeuses contre le mur nord, une contre la cloison, les portants en face
      furniture('obj_tv_makeup', 9150, 2036), furniture('obj_tv_makeup', 9420, 2036), furniture('obj_tv_makeup', 9516, 2360, 270),
      // un siège devant chaque coiffeuse, tourné vers son miroir
      furniture('obj_siege_accueil', 9150, 2128, 180), furniture('obj_siege_accueil', 9420, 2128, 180), furniture('obj_siege_accueil', 9424, 2360, 90),
      furniture('obj_tv_rack', 9150, 2994), furniture('obj_tv_rack', 9410, 2994),
      furniture('obj_plante', 9040, 2640),
      civil('obj_npc_civil_femme', 9285, 2240, 135, true), civil('obj_npc_civil_malette', 9060, 2300, 20, true),
      lamp(9280, 2450, 580, 0.5),
      // le dépose-minute : trottoir devant la porte, la chaussée, les places
      furniture('obj_plante', 9690, 2020), furniture('obj_poubelle', 9690, 2600),
      lamp(10250, 2450, 780, 0.45), lamp(9900, 1660, 660, 0.4), lamp(10700, 1660, 520, 0.35),

      // ======== AU SUD : SALON DE SORTIE, VESTIAIRE, PARKING ========
      // le salon de sortie : pas de canapés, on n'y attend pas (GD-084). Des casiers de consigne, un poste de
      // sécurité et son employée, quelques chaises ; le milieu reste dégagé
      furniture('obj_casierModulable', 8306, 5200, 90), furniture('obj_casierModulable', 8306, 5400, 90), furniture('obj_casierModulable', 8306, 5600, 90),
      furniture('obj_table0', 8700, 5600, 90), furniture('obj_lampeBureau', 8700, 5490), furniture('obj_ecran', 8690, 5640),
      civil('obj_npc_civil_femme', 8830, 5600, 180, true),
      ...[0, 1, 2, 3].map((i) => furniture('obj_chaise_marron', 8905, 5760 + i * 105, 270)),
      furniture('obj_distributeur', 8700, 6188, 180), furniture('obj_plante', 8300, 4960), furniture('obj_plante', 8300, 5800),
      lamp(8600, 5300, 700, 0.45), lamp(8600, 5900, 620, 0.4),
      // le local technique, du plateau jusqu'au mur extérieur : étagères de matériel, baies, établi, le long des
      // murs. Rien devant ses deux portes, et rien au milieu : c'est le passage de l'équipe, à l'aller comme au
      // repli sous le feu (les caméras de réserve et les câbles au sol gênaient, GD-092).
      furniture('obj_etager1', 9130, 4946), furniture('obj_etager2', 9400, 4946),
      furniture('obj_table1', 9200, 5240), furniture('obj_lampeBureau', 9090, 5240), furniture('obj_ecran', 9300, 5230, 90),
      furniture('obj_tv_crate', 9460, 5360), furniture('obj_tv_crate', 9470, 5450, 9), furniture('obj_tv_spot', 9380, 5600, 200),
      furniture('obj_serveur', 9076, 5790), furniture('obj_serveur', 9076, 6020),
      furniture('obj_etager3', 9210, 6222), furniture('obj_etager4', 9470, 6222),
      lamp(9280, 5260, 540, 0.45), lamp(9280, 5950, 520, 0.45),
      // le parking de départ
      furniture('obj_plante', 9690, 5580), furniture('obj_poubelle', 9690, 5320),
      lamp(10250, 5300, 780, 0.45), lamp(9900, 5990, 660, 0.4), lamp(10700, 5990, 520, 0.35),
    ],
  },
};

const done = new WeakMap<LevelData, LevelData>();

/** La salle telle que le jeu la charge. Le fichier d'origine n'est pas modifié ; le résultat est le même à chaque appel. */
export function withAdditions(level: LevelData): LevelData {
  const change = CHANGES[level.name];
  if (!change) return level;
  let merged = done.get(level);
  if (!merged) {
    const kept: LevelInstance[] = [];
    for (const inst of level.instances) {
      const result = change.instance ? change.instance(inst) : inst;
      if (result) kept.push(result);
    }
    merged = {
      ...level,
      objects: { ...level.objects, ...change.objects },
      instances: [...kept, ...(change.instances ?? [])],
      walls: [...level.walls.filter((w) => !change.dropWall?.(w)), ...(change.walls ?? [])],
      wallRects: [...level.wallRects.filter((r) => !change.dropWallRect?.(r)), ...(change.wallRects ?? [])],
      floors: [...level.floors, ...(change.floors ?? [])],
      decals: [...level.decals.filter((d) => !change.dropDecal?.(d)), ...(change.decals ?? [])],
    };
    done.set(level, merged);
    done.set(merged, merged);
  }
  return merged;
}
