// Ce que le remake change dans les salles d'origine (ADR-016). Les fichiers de `public/levels` sont la
// conversion fidèle des salles GameMaker : ce qu'on y ajoute, retire ou déplace est décrit ici et appliqué au
// chargement, au même endroit pour le serveur, le navigateur et les tests.
import type { LevelData, LevelDecal, LevelFloor, LevelInstance, LevelObjectInfo, LevelWall } from './types.ts';

interface Change {
  objects?: Record<string, LevelObjectInfo>;
  instances?: LevelInstance[];
  walls?: LevelWall[];
  wallRects?: [number, number, number, number, number][];
  floors?: LevelFloor[];
  decals?: LevelDecal[];
  /** Instance d'origine : rendue telle quelle, modifiée, ou retirée (null). */
  instance?: (inst: LevelInstance) => LevelInstance | null;
  /** Décalques et pièces de mur d'origine à retirer. */
  dropDecal?: (decal: LevelDecal) => boolean;
  dropWall?: (wall: LevelWall) => boolean;
}

let serial = 0;
function instance(object: string, layer: string, depth: number, x: number, y: number, angle = 0, props: Record<string, unknown> = {}, scale = 1): LevelInstance {
  return { id: `add_${++serial}`, object, layer, depth, x, y, angle, scaleX: scale, scaleY: scale, tint: '#ffffff', alpha: 1, props };
}
/** Meuble : il arrête les robots, pas les balles. */
const furniture = (object: string, x: number, y: number, angle = 0, scale = 1): LevelInstance =>
  instance(object, 'layer_deco', 200, x, y, angle, { bulletCrossed: true }, scale);
const decal = (sprite: string, x: number, y: number, angle = 0, scaleX = 1, scaleY = 1): LevelDecal =>
  ({ sprite, x, y, angle, scaleX, scaleY, tint: '#ffffff', alpha: 1, frame: 0, depth: 600 });
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

/** Une instance d'origine se reconnaît à son objet et à sa position arrondie. */
const at = (inst: LevelInstance, object: string, x: number, y: number): boolean =>
  inst.object === object && Math.abs(inst.x - x) < 2 && Math.abs(inst.y - y) < 2;

/**
 * Plateau de TvTv² (GD-081) : une pièce fermée de 2688 × 928 px au rez-de-chaussée, entre la baie vitrée de
 * la régie (à l'ouest) et le mur extérieur (à l'est). Elle prolonge jusqu'à la vitre les deux murs de
 * l'ancienne alcôve du hall de béton.
 */
const ROOM = { x0: 8256, x1: 10944, y0: 3392, y1: 4320 };
const MID = (ROOM.y0 + ROOM.y1) / 2;
/** Les deux portes automatiques du plateau, au nord et au sud, côté régie. */
const DOOR = { x: 8480, half: 128 };
/** Fond de décor : une cloison qui sépare le plateau des coulisses, avec un passage de chaque côté. */
const BACKDROP = { x: 9632, y0: 3552, y1: 4160 };

export const TV_STUDIO = {
  room: ROOM,
  /** L'estrade au logo de la chaîne, et dessus le pupitre et le présentateur, tourné vers les caméras et la régie. */
  riser: { x: 9270, y: MID },
  desk: { x: 9400, y: MID },
  anchor: { x: 9510, y: MID },
  /** Trois caméras, entre la vitre de la régie et l'estrade. */
  cameras: [{ x: 8700, y: 3640, angle: -109 }, { x: 8640, y: MID, angle: -90 }, { x: 8700, y: 4072, angle: -71 }],
  /**
   * Plans de la cinématique d'introduction (GD-080), centre de l'image : la régie et le plateau à cheval sur
   * la baie vitrée, puis le comptoir du hall d'accueil et ses écrans.
   */
  shots: { studio: { x: 8700, y: MID }, hall: { x: 4660, y: 5380 } },
};

const AUTO_DOOR = { bulletCrossed: false, automaticDoor: true, blockedOpen: false, detectionRange: 200, openTime: 0.5, closeTime: 0.5, stayOpenTime: 1 };

const CHANGES: Record<string, Change> = {
  rm_world2: {
    objects: {
      obj_tv_camera: decor('spr_camera'),
      obj_tv_desk: decor('spr_tv_desk'),
      obj_tv_spot: decor('spr_tv_spot'),
      obj_tv_ledwall: decor('spr_tv_ledwall'),
      obj_tv_onair: decor('spr_tv_onair'),
      obj_tv_crate: decor('spr_crate'),
      obj_serveur: decor('spr_serveur'),
    },
    // ---- la pièce : deux murs prolongés jusqu'à la vitre, percés chacun d'une porte, et la cloison du décor
    walls: [
      ...wallRow(ROOM.x0, DOOR.x - DOOR.half, ROOM.y0 - 32, false, true), ...wallRow(DOOR.x + DOOR.half, 9600, ROOM.y0 - 32, true),
      ...wallRow(ROOM.x0, DOOR.x - DOOR.half, ROOM.y1, false, true), ...wallRow(DOOR.x + DOOR.half, 9600, ROOM.y1, true),
      ...wallColumn(BACKDROP.x, BACKDROP.y0, BACKDROP.y1),
    ],
    wallRects: [
      [ROOM.x0, ROOM.y0 - 32, DOOR.x - DOOR.half - ROOM.x0, 32, 0], [DOOR.x + DOOR.half, ROOM.y0 - 32, 9568 - DOOR.x - DOOR.half, 32, 0],
      [ROOM.x0, ROOM.y1, DOOR.x - DOOR.half - ROOM.x0, 32, 0], [DOOR.x + DOOR.half, ROOM.y1, 9568 - DOOR.x - DOOR.half, 32, 0],
      [BACKDROP.x, BACKDROP.y0, 32, BACKDROP.y1 - BACKDROP.y0, 0],
    ],
    // les deux murs de l'alcôve finissaient par un bout arrondi : ils continuent désormais
    dropWall: (w) => w.object === 'obj_mur_fin_bout' && w.x === 9584 && (w.y === ROOM.y0 - 16 || w.y === ROOM.y1 + 16),
    // ---- le sol : une résine sombre de studio à la place du béton fissuré
    floors: [{ object: 'obj_textureGenerator_studio', tileset: 'til_sol_studio', x: ROOM.x0, y: ROOM.y0, w: ROOM.x1 - ROOM.x0, h: ROOM.y1 - ROOM.y0, phaseX: 0, phaseY: 0 }],
    // la grille de ventilation n'a rien à faire au milieu d'un plateau
    dropDecal: (d) => d.sprite === 'spr_ventilation',
    decals: [
      decal('spr_tv_riser', 9270, MID),
      decal('spr_tv_cables', 8520, 3700), decal('spr_tv_cables', 8530, 4010, 0, 1, -1),
    ],
    instance: (inst) => {
      // les conteneurs de livraison et la boîte bonus qui occupaient l'alcôve sortent du plateau
      const inRoom = inst.x >= ROOM.x0 && inst.x < ROOM.x1 && inst.y >= ROOM.y0 && inst.y < ROOM.y1;
      if (inRoom && (inst.object === 'obj_container' || inst.object === 'obj_bonus_box')) return null;
      // aucun garde sur le plateau au départ (demande de l'utilisateur, GD-082) : les deux policiers de
      // l'alcôve gardent les portes de l'extérieur. Rien ne les empêche d'entrer ensuite, pendant la partie.
      if (at(inst, 'obj_npc_human_pistol', 10272, 3616)) return { ...inst, x: 8480, y: 3230, angle: 90 };
      if (at(inst, 'obj_npc_human_pistol', 10016, 4128)) return { ...inst, x: 8480, y: 4480, angle: 270 };
      // deux techniciens tiennent une caméra : ils ne quittent pas leur poste
      if (at(inst, 'obj_npc_civil_technicien', 10368, 4128)) return { ...inst, x: 8615, y: 3618, angle: 0, props: { ...inst.props, patrolType: 'none' } };
      if (at(inst, 'obj_npc_civil_technicien', 9856, 3680)) return { ...inst, x: 8615, y: 4094, angle: 0, props: { ...inst.props, patrolType: 'none' } };
      // le robot bouclier sort lui aussi, sur l'aire de livraison nord ; le LightBot ne reste pas dans le nouveau mur
      if (at(inst, 'obj_npc_robot_shield', 9120, 3712)) return { ...inst, x: 9300, y: 3200 };
      if (at(inst, 'obj_npc_robot_lightBot', 8832, 3328)) return { ...inst, y: 3180 };
      // en régie, les techniciens restent assis devant leurs écrans
      if (inst.object === 'obj_npc_civil_technicien' && inst.x > 7800 && inst.x < 7950 && inst.y > 3300 && inst.y < 4500) {
        return { ...inst, props: { ...inst.props, patrolType: 'none' } };
      }
      return inst;
    },
    instances: [
      instance('obj_automaticDoor', 'layer_doors', -500, DOOR.x, ROOM.y0 - 16, 180, AUTO_DOOR),
      instance('obj_automaticDoor', 'layer_doors', -500, DOOR.x, ROOM.y1 + 16, 0, AUTO_DOOR),
      instance('obj_tv_onair', 'layer_deco', -250, 8690, ROOM.y0 - 16),
      instance('obj_tv_onair', 'layer_deco', -250, 8690, ROOM.y1 + 16),
      // ---- le plateau : pupitre et présentateur sur l'estrade, caméras, projecteurs
      // `shadow` : hauteur du meuble, pour l'ombre qu'il porte sous les projecteurs
      instance('obj_tv_desk', 'layer_deco', 200, TV_STUDIO.desk.x, TV_STUDIO.desk.y, 0, { bulletCrossed: true, shadow: 40 }),
      // un civil comme les autres, mais qui reste à son poste tant que rien ne l'effraie
      instance('obj_npc_civil_malette', 'layer_npc', 0, TV_STUDIO.anchor.x, TV_STUDIO.anchor.y, 180, {
        normalSpd: 3, maxHealth: 1, hearRange: 1000, viewRange: 800, genre: 'humain', patrolType: 'none', fearDuration: 30, fearSpeed: '2*normalSpd',
      }),
      ...TV_STUDIO.cameras.map((c) => instance('obj_tv_camera', 'layer_deco', 200, c.x, c.y, c.angle, { bulletCrossed: true, shadow: 70 }, 1.5)),
      furniture('obj_ecran', 8790, 3760, 200), furniture('obj_ecran', 8790, 3952, 160),
      // deux projecteurs de face et deux contre-jours, tous braqués sur le présentateur
      ...spot(8960, 3470, -35, 980), ...spot(8960, 4242, 35, 980),
      ...spot(9556, 3606, -100, 520), ...spot(9556, 4106, 100, 520),
      furniture('obj_tv_ledwall', BACKDROP.x - 20, MID, 90),
      // peu de lumière d'ambiance : ce sont les projecteurs qui éclairent le décor ; le mur d'écrans y ajoute son bleu
      lamp(9280, MID, 520, 0.22), lamp(8700, MID, 420, 0.3), lamp(9560, MID, 420, 0.5, 160, 190),
      // ---- les coulisses, derrière la cloison : baies techniques, caisses, vestiaires, coin repos
      furniture('obj_serveur', 10010, 3474, 90), furniture('obj_serveur', 10230, 3474, 90), furniture('obj_serveur', 10450, 3474, 90),
      furniture('obj_tv_crate', 9760, 3680), furniture('obj_tv_crate', 9846, 3690, 12), furniture('obj_tv_crate', 9800, 3764, -8),
      furniture('obj_casierModulable', 9990, 4270), furniture('obj_casierModulable', 10180, 4270), furniture('obj_casierModulable', 10370, 4270),
      furniture('obj_distributeur', 10560, 4236, 180),
      furniture('obj_canape', 10700, 3462), furniture('obj_fauteuil', 10850, 3690, 270), furniture('obj_table_attente', 10690, 3640),
      furniture('obj_plante', 10890, 3450),
      furniture('obj_table1', 10760, 4226), furniture('obj_lampeBureau', 10660, 4226), furniture('obj_lampeBureau', 10860, 4226),
      lamp(10300, MID, 520, 0.4),
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
      wallRects: [...level.wallRects, ...(change.wallRects ?? [])],
      floors: [...level.floors, ...(change.floors ?? [])],
      decals: [...level.decals.filter((d) => !change.dropDecal?.(d)), ...(change.decals ?? [])],
    };
    done.set(level, merged);
    done.set(merged, merged);
  }
  return merged;
}
