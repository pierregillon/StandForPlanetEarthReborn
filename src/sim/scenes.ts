// Les séquences jouées en cours de niveau, après l'introduction : l'ultimatum (GD-085), le face-à-face avec le
// barrage de police sur le parking sud (GD-088) et l'extraction qui finit le niveau (GD-089). Elles partagent une horloge (`World.cast`) et les règles de
// l'introduction (GD-079) : le monde est figé, l'hôte passe d'une réplique à l'autre ou passe tout.
import { CONFIG } from './config.ts';
import { TV_STUDIO } from './additions.ts';
import { castLines, castPhases } from './broadcast.ts';
import { GO_ORDER } from './intro.ts';
import type { IntroLine } from './intro.ts';
import type { World } from './world.ts';

/** Valeurs de `World.castScene`. */
export const SCENE = { ultimatum: 0, standoff: 1, pickup: 2 };

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

// ---------- L'extraction (GD-089) ----------

/** Ce que dit la voix du véhicule quand un robot ouvre le portail nord (radio en jeu). */
export const HOLD_ON = 'Gate is opening. We are coming for you. Hold on.';

/** Nom de celui qui lit le communiqué d'urgence : la chaîne elle-même, sans visage. */
export const EMERGENCY = 'Emergency';

/**
 * Le communiqué. Sa seconde phrase répond mot pour mot à la première du jeu : « is now considered out of
 * control » devient « is now considered a major threat to mankind ». C'est le changement de statut de l'acte II.
 */
export const ALERT = [
  'This is an emergency broadcast.',
  'The \'Stand For Planet Earth\' unit is now considered a major threat to mankind. All forces are authorized to destroy it on sight.',
];

/** La radio des robots, une fois à bord. « They heard » n'est pas « they listened » : la porte de l'acte III. */
export const AFTERMATH: [string, string][] = [
  ['BatBot', 'Did they listen?'],
  ['EngiBot', 'They heard.'],
  ['BadaBot', 'Now we wait and see what they do with it.'],
];

/** Instants de l'extraction, en steps de son horloge. Chaque valeur est la fin de la phase nommée. */
export interface PickupPhases {
  /** Les bandes sont fermées, la caméra est au point de pose. */
  open: number;
  flyIn: number;
  descend: number;
  /** Les pinces ont saisi les robots. */
  grab: number;
  ascend: number;
  flyOut: number;
  /** L'image est restée sur le portail vide. */
  watch: number;
  /** Coupe vers le hall : l'horloge s'arrête ici pour le communiqué. */
  hall: number;
  /** Coupe vers le noir : l'horloge s'arrête ici pour la radio des robots. */
  black: number;
  total: number;
}

export function pickupPhases(): PickupPhases {
  const c = CONFIG.exit;
  const open = c.inSteps;
  const flyIn = open + c.flyInSteps;
  const descend = flyIn + c.descendSteps;
  const grab = descend + c.grabSteps;
  const ascend = grab + c.ascendSteps;
  const flyOut = ascend + c.flyOutSteps;
  const watch = flyOut + c.watchSteps;
  const hall = watch + c.cutSteps;
  const black = hall + c.cutSteps;
  return { open, flyIn, descend, grab, ascend, flyOut, watch, hall, black, total: black + c.outSteps };
}

/** Ce que la caméra montre : le point de pose, le hall et ses écrans, puis le noir. */
export function pickupShot(t: number): 'landing' | 'hall' | 'black' {
  const p = pickupPhases();
  return t < p.watch ? 'landing' : t < p.hall + 1 ? 'hall' : 'black';
}

/**
 * Où en est le véhicule à l'instant `t` : présent ou non, décalage vers le nord par rapport au point de pose,
 * hauteur (1 = en vol, 0 = posé), et `grab`, de 0 (les robots sont où ils étaient) à 1 (repliés dans leur pince).
 */
export function pickupPose(t: number): { present: boolean; north: number; height: number; grab: number } {
  const p = pickupPhases();
  const c = CONFIG.exit;
  const travel = CONFIG.arrival.travel;
  if (t < p.open) return { present: false, north: travel, height: 1, grab: 0 };
  if (t < p.flyIn) {
    const k = 1 - (t - p.open) / c.flyInSteps;
    return { present: true, north: travel * k * k, height: 1, grab: 0 }; // il ralentit en arrivant
  }
  if (t < p.descend) return { present: true, north: 0, height: 1 - (t - p.flyIn) / c.descendSteps, grab: 0 };
  if (t < p.grab) return { present: true, north: 0, height: 0, grab: (t - p.descend) / c.grabSteps };
  if (t < p.ascend) return { present: true, north: 0, height: (t - p.grab) / c.ascendSteps, grab: 1 };
  if (t < p.flyOut) {
    const k = (t - p.ascend) / c.flyOutSteps;
    return { present: true, north: travel * k * k, height: 1, grab: 1 }; // il accélère en repartant
  }
  return { present: false, north: travel, height: 1, grab: 1 };
}

export function pickupLines(): IntroLine[] {
  const p = pickupPhases();
  return [
    ...ALERT.map((text) => ({ at: p.hall, speaker: EMERGENCY, text, alert: true })),
    ...AFTERMATH.map(([speaker, text]) => ({ at: p.black, speaker, text })),
  ];
}

// ---------- Commun ----------

/** Répliques de la séquence en cours. */
export function sceneLines(world: World): IntroLine[] {
  const reader = (world.heroes[world.castReader] ?? world.hero).def.name;
  if (world.castScene === SCENE.standoff) return standoffLines(reader);
  if (world.castScene === SCENE.pickup) return pickupLines();
  return castLines(world.session.heroNames, reader);
}

/** Durée de la séquence en cours, en steps de son horloge (qui s'arrête sur chaque réplique). */
export function sceneTotal(world: World): number {
  if (world.castScene === SCENE.pickup) return pickupPhases().total;
  return world.castScene === SCENE.standoff ? standoffPhases().total : castPhases().total;
}

/** Le robot au sol qui parle au nom de l'équipe quand personne n'est désigné : le premier de la liste du largage. */
export function groundVoice(world: World, except = ''): string | undefined {
  const ground = world.living().map((h) => h.def.name);
  return GO_ORDER.find((name) => ground.includes(name) && name !== except);
}
