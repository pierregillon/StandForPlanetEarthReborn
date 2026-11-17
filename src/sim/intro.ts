// Introduction du niveau (GD-077 à GD-080) : le journal télévisé, la radio des robots, le largage.
// L'horloge de la séquence est celle de l'arrivée des héros. Elle s'arrête sur chaque réplique, jusqu'à ce
// que l'hôte passe à la suivante : le joueur lit à son rythme.
import { CONFIG } from './config.ts';

/** Instants de l'arrivée, en steps de son horloge. Chaque valeur est la fin de la phase nommée. */
export interface ArrivalPhases {
  /** Introduction complète (le journal et la radio sont joués) ou simple largage. */
  full: boolean;
  /** L'image s'est ouverte sur le plateau : l'horloge s'arrête ici pour la première phrase du présentateur. */
  news: number;
  /** Coupe vers le hall d'accueil : l'horloge s'arrête ici pour sa deuxième phrase. */
  cut: number;
  /** La caméra est sortie du bâtiment : le véhicule entre. Vaut 0 sans introduction complète. */
  exit: number;
  /** Le véhicule est entré et s'est arrêté au-dessus du parvis. */
  flyIn: number;
  /** Il s'est stabilisé en vol : l'horloge s'arrête ici pour les répliques radio. */
  hover: number;
  /** Il est posé : l'horloge s'arrête ici pour l'échange du largage. */
  descend: number;
  /** Il redécolle. */
  hold: number;
  ascend: number;
  /** Il est sorti de l'écran : le déploiement commence. */
  total: number;
}

/** Durée de l'arrivée, répliques non comprises ; l'introduction complète ajoute le journal et le vol stationnaire. */
export function arrivalTotal(fullIntro: boolean): number {
  const a = CONFIG.arrival;
  const intro = fullIntro ? a.news.inSteps + a.news.cutSteps + a.news.exitSteps + a.hoverSteps : 0;
  return intro + a.flyInSteps + a.descendSteps + a.holdSteps + a.ascendSteps + a.flyOutSteps;
}

export function arrivalPhases(total: number): ArrivalPhases {
  const a = CONFIG.arrival;
  const full = total > arrivalTotal(false);
  const news = full ? a.news.inSteps : 0;
  const cut = news + (full ? a.news.cutSteps : 0);
  const exit = cut + (full ? a.news.exitSteps : 0);
  const flyIn = exit + a.flyInSteps;
  const hover = flyIn + (full ? a.hoverSteps : 0);
  const descend = hover + a.descendSteps;
  const hold = descend + a.holdSteps;
  return { full, news, cut, exit, flyIn, hover, descend, hold, ascend: hold + a.ascendSteps, total };
}

/** Pince d'un robot, par rapport à l'origine du véhicule : chaque robot a toujours la même. */
export function clawOf(heroName: string): { x: number; y: number } {
  const a = CONFIG.arrival;
  const i = a.crew.indexOf(heroName);
  return a.claws[(i < 0 ? 0 : i) % a.claws.length];
}

export interface IntroLine {
  /** Instant de l'horloge où elle s'arrête pour cette réplique. */
  at: number;
  /** Nom de celui qui parle. */
  speaker: string;
  text: string;
  /** L'échange du largage : les pinces des robots joués s'ouvrent quand cette réplique commence. */
  release?: boolean;
  /** Les rotors du véhicule se font entendre quand cette réplique est écrite : c'est eux qui la coupent. */
  rumble?: boolean;
  /** Dite en direct sur TvTv² : elle s'affiche dans le cadre du journal, avec le portrait de celui qui parle. */
  live?: boolean;
  /** Les sirènes de la police se font entendre quand cette réplique est écrite. */
  siren?: boolean;
}

/** Nom du présentateur du journal dans les répliques. */
export const ANCHOR = 'Anchor';

/** Le journal de TvTv², sur le plateau puis sur les écrans du hall (texte accepté, GD-077). */
const NEWS = [
  '...a third drilling site destroyed this month. The \'Stand For Planet Earth\' unit is now considered out of control.',
  'Authorities say there is no reason to panic. Stay with us on TvTv², right after th—',
];

/** Ce que la caméra montre : le plateau, le hall, le trajet vers le parvis (`k` de 0 à 1), puis le véhicule. */
export type IntroShot = { kind: 'studio' | 'hall' | 'vehicle' } | { kind: 'exit'; k: number };

export function introShot(p: ArrivalPhases, t: number): IntroShot {
  if (!p.full || t >= p.exit) return { kind: 'vehicle' };
  if (t <= p.news) return { kind: 'studio' };
  if (t <= p.cut) return { kind: 'hall' };
  return { kind: 'exit', k: (t - p.cut) / (p.exit - p.cut) };
}

/** La radio, pendant le vol stationnaire (texte accepté, GD-077). */
const RADIO: [string, string][] = [
  ['BadaBot', 'They are talking about us.'],
  ['EngiBot', 'Good. Then they will listen.'],
  ['PetBot', 'Objective: the control room. One message, on every screen.'],
  ['BatBot', 'And if they don\'t open the door?'],
  ['BadaBot', 'We knock.'],
];

/** Le robot qui reste à bord et passe la main : le premier de cette liste parmi ceux qui ne sont pas joués. */
export const STAY_ORDER = ['EngiBot', 'PetBot', 'BatBot', 'BadaBot'];
const STAY: Record<string, string> = {
  EngiBot: 'This one is yours. We keep the engines warm.',
  PetBot: 'We stay on standby. Come back in one piece.',
  BatBot: 'I stay up here? Fine. Leave me some.',
  BadaBot: 'Your turn. We hold the sky.',
};

/** Le robot qui descend et répond : le premier de cette liste parmi ceux qui sont joués. */
export const GO_ORDER = ['BadaBot', 'BatBot', 'PetBot', 'EngiBot'];
/** Sa réponse selon qu'ils descendent à un, à deux (`{Mate}` = son coéquipier) ou à trois. */
const GO: Record<string, [string, string, string]> = {
  BadaBot: ['One is enough.', '{Mate} and I. That will do.', 'Three of us. More than enough.'],
  BatBot: ['Alone? Perfect. More for me.', 'Me and {Mate}? Poor them.', 'Three of us? This will be quick.'],
  PetBot: ['Alone, then. I will be careful.', '{Mate} and I will manage.', 'Three of us. We will manage.'],
  EngiBot: ['One unit. Sufficient.', '{Mate} and I. The numbers hold.', 'Three units. Comfortable margin.'],
};
const ALL_FOUR: [string, string][] = [['BadaBot', 'All four. Let\'s make it short.'], ['BatBot', 'Finally.']];

/**
 * L'échange du largage : un robot qui reste passe la main, un robot qui descend répond. Quand les quatre
 * sont joués, personne ne reste et deux d'entre eux se répondent.
 */
export function dropExchange(players: string[]): [string, string][] {
  const crew = CONFIG.arrival.crew;
  const going = crew.filter((name) => players.includes(name));
  const staying = crew.filter((name) => !players.includes(name));
  if (going.length === 0) return [];
  if (staying.length === 0) return ALL_FOUR;
  const giver = STAY_ORDER.find((name) => staying.includes(name)) ?? staying[0];
  const taker = GO_ORDER.find((name) => going.includes(name)) ?? going[0];
  const mate = going.find((name) => name !== taker) ?? '';
  const answer = GO[taker][Math.min(going.length, 3) - 1].replace('{Mate}', mate);
  return [[giver, STAY[giver]], [taker, answer]];
}

/**
 * Toutes les répliques d'une arrivée, dans l'ordre. `players` : les robots joués ; `total` : durée de
 * l'arrivée (celle des héros, `arrivalTotal`). Sans introduction complète, il ne reste que l'échange du largage.
 */
export function introLines(players: string[], total: number): IntroLine[] {
  const p = arrivalPhases(total);
  const lines: IntroLine[] = [];
  if (p.full) {
    lines.push({ at: p.news, speaker: ANCHOR, text: NEWS[0] }, { at: p.cut, speaker: ANCHOR, text: NEWS[1], rumble: true });
    for (const [speaker, text] of RADIO) lines.push({ at: p.hover, speaker, text });
  }
  const exchange = dropExchange(players);
  exchange.forEach(([speaker, text], i) => {
    lines.push({ at: p.descend, speaker, text, release: i === exchange.length - 1 });
  });
  return lines;
}

/** Steps qu'il faut à une réplique pour s'écrire en entier. */
export function typingSteps(text: string): number {
  return Math.ceil(text.length / CONFIG.arrival.lettersPerStep);
}

/** Les robots joués ont-ils quitté leur pince ? `line` : rang de la réplique en cours (World.introLine). */
export function crewReleased(lines: IntroLine[], phases: ArrivalPhases, t: number, line: number): boolean {
  if (t > phases.descend) return true;
  const release = lines.findIndex((l) => l.release);
  return t === phases.descend && (release < 0 || line >= release);
}
