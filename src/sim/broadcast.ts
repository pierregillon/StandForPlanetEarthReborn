// L'ultimatum (GD-085) : les robots prennent la place du présentateur et parlent à toute la population.
// C'est le miroir de l'introduction : mêmes plans, même cadre de journal télévisé. Comme elle, son horloge
// s'arrête sur chaque réplique jusqu'à ce que l'hôte passe à la suivante (GD-079).
import { CONFIG } from './config.ts';
import { GO_ORDER, STAY_ORDER } from './intro.ts';
import type { IntroLine } from './intro.ts';

/** Instants de l'ultimatum, en steps de son horloge. Chaque valeur est la fin de la phase nommée. */
export interface CastPhases {
  /** L'image s'est ouverte sur le plateau : répliques 1 à 3. */
  open: number;
  /** Coupe vers le hall d'accueil et ses écrans : répliques 4 à 6. */
  hall: number;
  /** Retour sur le pupitre : réplique 7. */
  desk: number;
  /** On a coupé l'antenne, l'image a sauté : la voix du véhicule donne le rendez-vous. */
  cut: number;
  /** Les bandes se rouvrent : le jeu reprend. */
  total: number;
}

export function castPhases(): CastPhases {
  const c = CONFIG.broadcast;
  const open = c.inSteps;
  const hall = open + c.cutSteps;
  const desk = hall + c.cutSteps;
  const cut = desk + c.staticSteps;
  return { open, hall, desk, cut, total: cut + c.outSteps };
}

/** Ce que la caméra montre : le plateau, le hall, le pupitre, la neige de l'antenne coupée, puis le plateau sans cadre. */
export type CastShot = 'studio' | 'hall' | 'desk' | 'static' | 'after';

export function castShot(t: number): CastShot {
  const p = castPhases();
  if (t <= p.open) return 'studio';
  if (t <= p.hall) return 'hall';
  if (t <= p.desk) return 'desk';
  return t < p.cut ? 'static' : 'after';
}

/** L'antenne est aux robots : leur image est sur tous les écrans de la chaîne. */
export function castLive(t: number): boolean {
  return t >= 0 && t <= castPhases().desk;
}

/**
 * Le message. Il est le même quel que soit le robot qui le lit : l'unité parle d'une seule voix.
 * La troisième phrase répond au présentateur de l'introduction (« out of control »).
 */
export const ULTIMATUM = [
  'People of Earth. This is the Stand For Planet Earth unit.',
  'You built us to protect this planet. We did. You answered with guns.',
  'They told you we are out of control. We are exactly what you made us.',
  'Your laws have failed. The forests burn, the seas choke, and you keep drilling.',
  'So hear this. Everything that harms this planet stops. Today.',
  'This is your last chance to change. There will be no second message.',
  'Stand for planet Earth. Or we will stand for it without you.',
];

/** Le véhicule donne le rendez-vous prévu, une fois l'antenne coupée. */
export const PICK_UP = 'Message is out, on every screen. Pick-up at the drop point, as planned.';

/** Ce que dit le robot qui appuie sur le bouton de la régie (radio en jeu). */
export const CONTROL_ROOM_TAKEN = 'Control room secured. The way to the studio is open.';

/** Le robot qui lit le message : parmi ceux qui sont à la place du présentateur, le premier de la liste du largage. */
export function castReader(onMark: string[]): string {
  return GO_ORDER.find((name) => onMark.includes(name)) ?? onMark[0] ?? GO_ORDER[0];
}

/**
 * La voix du véhicule : le premier des robots restés à bord, dans l'ordre du largage. Si les quatre robots
 * sont joués, personne n'est à bord : c'est BadaBot, au sol, qui parle.
 */
export function vehicleVoice(players: string[]): string {
  return STAY_ORDER.find((name) => !players.includes(name)) ?? GO_ORDER[0];
}

/** Toutes les répliques de l'ultimatum. `players` : les robots joués ; `reader` : celui qui lit le message. */
export function castLines(players: string[], reader: string): IntroLine[] {
  const p = castPhases();
  const at = [p.open, p.open, p.open, p.hall, p.hall, p.hall, p.desk];
  const lines: IntroLine[] = ULTIMATUM.map((text, i) => ({ at: at[i], speaker: reader, text, live: true, siren: i === 5 }));
  lines.push({ at: p.cut, speaker: vehicleVoice(players), text: PICK_UP });
  return lines;
}
