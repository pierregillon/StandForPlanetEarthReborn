// Les séquences jouées en cours de niveau, après l'introduction : l'ultimatum (GD-085) et le face-à-face avec
// le barrage de police sur le parking sud (GD-088). Elles partagent une horloge (`World.cast`) et les règles de
// l'introduction (GD-079) : le monde est figé, l'hôte passe d'une réplique à l'autre ou passe tout.
import { CONFIG } from './config.ts';
import { TV_STUDIO } from './additions.ts';
import { castLines, castPhases } from './broadcast.ts';
import { GO_ORDER } from './intro.ts';
import type { IntroLine } from './intro.ts';
import type { World } from './world.ts';

/** Valeurs de `World.castScene`. */
export const SCENE = { ultimatum: 0, standoff: 1 };

// ---------- Le barrage (GD-088) ----------

/** Nom affiché de celui qui somme les robots de se rendre. Ce n'est pas un robot : il a son propre portrait. */
export const POLICE = 'Police';

/** La sommation, la blague à l'équipe, puis le plan B. Les deux dernières sont dites par le même robot. */
export const SURRENDER = 'Stand For Planet Earth unit! You are surrounded. Drop your weapons and surrender!';
export const LATE_FOR_DINNER = 'Team... I think we are going to be late for dinner.';
export const PLAN_B = 'No way out through here. We go back and leave by the north garage. Plan B.';

/** Instants du face-à-face, en steps de son horloge : la caméra a rejoint le barrage, puis les bandes se rouvrent. */
export function standoffPhases(): { open: number; total: number } {
  const c = CONFIG.standoff;
  return { open: c.inSteps, total: c.inSteps + c.outSteps };
}

/** Le robot qui répond : celui qui est arrivé devant le barrage, c'est-à-dire le plus proche des fourgons. */
export function standoffSpeaker(world: World): number {
  const line = TV_STUDIO.wave.line;
  const at = { x: line[0].x, y: (line[0].y + line[line.length - 1].y) / 2 };
  let best = -1;
  let bestD = Infinity;
  for (const h of world.living()) {
    const d = Math.hypot(h.x - at.x, h.y - at.y);
    if (d < bestD) {
      bestD = d;
      best = h.id;
    }
  }
  return best >= 0 ? best : world.hero.id;
}

export function standoffLines(speaker: string): IntroLine[] {
  const at = standoffPhases().open;
  return [
    { at, speaker: POLICE, text: SURRENDER },
    { at, speaker, text: LATE_FOR_DINNER },
    { at, speaker, text: PLAN_B },
  ];
}

/**
 * Cadre du face-à-face : les portes du local technique à gauche, le barrage à droite, à la hauteur du robot
 * qui vient d'arriver (le parking est plus haut que l'écran).
 */
export function standoffShot(world: World): { x: number; y: number } {
  const p = TV_STUDIO.parkings.south;
  const half = CONFIG.camera.viewHeight / 2;
  const h = world.heroes[world.castReader] ?? world.hero;
  const x = (p.x0 + TV_STUDIO.wave.line[0].x) / 2 + CONFIG.standoff.shotShift;
  return { x, y: Math.min(Math.max(h.y, p.y0 + half - CONFIG.standoff.shotMargin), p.y1 - half + CONFIG.standoff.shotMargin) };
}

// ---------- Commun ----------

/** Répliques de la séquence en cours. */
export function sceneLines(world: World): IntroLine[] {
  const reader = (world.heroes[world.castReader] ?? world.hero).def.name;
  if (world.castScene === SCENE.standoff) return standoffLines(reader);
  return castLines(world.session.heroNames, reader);
}

/** Durée de la séquence en cours, en steps de son horloge (qui s'arrête sur chaque réplique). */
export function sceneTotal(world: World): number {
  return world.castScene === SCENE.standoff ? standoffPhases().total : castPhases().total;
}

/** Le robot au sol qui parle au nom de l'équipe quand personne n'est désigné : le premier de la liste du largage. */
export function groundVoice(world: World, except = ''): string | undefined {
  const ground = world.living().map((h) => h.def.name);
  return GO_ORDER.find((name) => ground.includes(name) && name !== except);
}
