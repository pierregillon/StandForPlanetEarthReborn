// Ajouts aux salles d'origine (GD-080). Les fichiers de `public/levels` sont la conversion fidèle des salles
// GameMaker : ce qu'on y ajoute pour le remake est décrit ici et greffé au chargement, au même endroit pour
// le serveur, le navigateur et les tests.
import type { LevelData, LevelInstance, LevelObjectInfo } from './types.ts';

interface Addition {
  objects?: Record<string, LevelObjectInfo>;
  instances: LevelInstance[];
}

let serial = 0;
function instance(object: string, layer: string, depth: number, x: number, y: number, angle: number, props: Record<string, unknown> = {}): LevelInstance {
  return { id: `add_${++serial}`, object, layer, depth, x, y, angle, scaleX: 1, scaleY: 1, tint: '#ffffff', alpha: 1, props };
}

/** Plateau de TvTv², dans le hall de béton du rez-de-chaussée, face à la baie vitrée de la régie. */
export const TV_STUDIO = {
  /** Le pupitre, devant l'alcôve qui sert de fond de décor. */
  desk: { x: 9440, y: 3850 },
  /** Le présentateur, derrière son pupitre, tourné vers les caméras et la régie. */
  anchor: { x: 9535, y: 3850 },
  /** Trois caméras, entre la grille de ventilation du hall et le pupitre. */
  cameras: [{ x: 9200, y: 3650, angle: -112 }, { x: 9140, y: 3850, angle: -90 }, { x: 9200, y: 4050, angle: -68 }],
  /**
   * Plans de la cinématique d'introduction (GD-080), centre de l'image : la régie et le plateau à cheval sur
   * la baie vitrée, puis le comptoir du hall d'accueil et ses écrans.
   */
  shots: { studio: { x: 8660, y: 3850 }, hall: { x: 4660, y: 5380 } },
};

const ADDITIONS: Record<string, Addition> = {
  rm_world2: {
    objects: {
      // la caméra de plateau : le sprite existe dans le projet d'origine (spr_camera), aucun objet ne l'utilisait
      obj_camera_tv: { sprite: 'spr_camera', mask: null, parents: ['obj_mobilier_parent', 'obj_decor_base'], visible: true },
    },
    instances: [
      instance('obj_table_attente', 'layer_deco', 200, TV_STUDIO.desk.x, TV_STUDIO.desk.y, 90, { bulletCrossed: true }),
      // un civil comme les autres, mais qui reste à son poste tant que rien ne l'effraie
      instance('obj_npc_civil_malette', 'layer_npc', 0, TV_STUDIO.anchor.x, TV_STUDIO.anchor.y, 180, {
        normalSpd: 3, maxHealth: 1, hearRange: 1000, viewRange: 800, genre: 'humain', patrolType: 'none', fearDuration: 30, fearSpeed: '2*normalSpd',
      }),
      ...TV_STUDIO.cameras.map((c) => instance('obj_camera_tv', 'layer_deco', 200, c.x, c.y, c.angle, { bulletCrossed: true })),
    ],
  },
};

const done = new WeakMap<LevelData, LevelData>();

/** La salle avec ses ajouts. Le fichier d'origine n'est pas modifié ; le résultat est le même à chaque appel. */
export function withAdditions(level: LevelData): LevelData {
  const add = ADDITIONS[level.name];
  if (!add) return level;
  let merged = done.get(level);
  if (!merged) {
    merged = { ...level, objects: { ...level.objects, ...add.objects }, instances: [...level.instances, ...add.instances] };
    done.set(level, merged);
    done.set(merged, merged);
  }
  return merged;
}
