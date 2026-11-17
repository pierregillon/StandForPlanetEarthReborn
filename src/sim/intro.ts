// Introduction du niveau (GD-077, GD-078) : déroulé du largage et répliques des robots.
// Tout se déduit de la durée totale de l'arrivée et de la composition de l'équipe : le serveur et les
// navigateurs retrouvent ainsi la même séquence sans rien échanger de plus.
import { CONFIG } from './config.ts';

/** Instants de l'arrivée, en steps depuis son début. Chaque valeur est la fin de la phase nommée. */
export interface ArrivalPhases {
  /** Le véhicule est entré et s'est arrêté au-dessus du parvis. */
  flyIn: number;
  /** Fin du vol stationnaire (les répliques radio) ; égal à `flyIn` quand l'introduction est déjà vue. */
  hover: number;
  /** Le véhicule est posé. */
  descend: number;
  /** Les pinces des robots joués s'ouvrent, au milieu de l'échange du largage. */
  release: number;
  /** Fin de l'échange : le véhicule redécolle. */
  hold: number;
  ascend: number;
  /** Le véhicule est sorti de l'écran : le déploiement commence. */
  total: number;
}

/** Durée de l'arrivée ; l'introduction complète ajoute le vol stationnaire. */
export function arrivalTotal(fullIntro: boolean): number {
  const a = CONFIG.arrival;
  return a.flyInSteps + (fullIntro ? a.hoverSteps : 0) + a.descendSteps + a.holdSteps + a.ascendSteps + a.flyOutSteps;
}

export function arrivalPhases(total: number): ArrivalPhases {
  const a = CONFIG.arrival;
  const hoverSteps = Math.max(0, total - arrivalTotal(false));
  const flyIn = a.flyInSteps;
  const hover = flyIn + hoverSteps;
  const descend = hover + a.descendSteps;
  const hold = descend + a.holdSteps;
  return { flyIn, hover, descend, release: descend + Math.round(a.holdSteps / 2), hold, ascend: hold + a.ascendSteps, total };
}

/** Pince d'un robot, par rapport à l'origine du véhicule : chaque robot a toujours la même. */
export function clawOf(heroName: string): { x: number; y: number } {
  const a = CONFIG.arrival;
  const i = a.crew.indexOf(heroName);
  return a.claws[(i < 0 ? 0 : i) % a.claws.length];
}

export interface IntroLine {
  /** Steps depuis le début de l'arrivée : la réplique est à l'écran de `from` (inclus) à `to` (exclu). */
  from: number;
  to: number;
  /** Nom du robot qui parle. */
  speaker: string;
  text: string;
}

/** La radio, pendant le vol stationnaire : durée relative et texte de chaque réplique (texte accepté, GD-077). */
const RADIO: [string, number, string][] = [
  ['BadaBot', 1.6, 'They are talking about us.'],
  ['EngiBot', 1.6, 'Good. Then they will listen.'],
  ['PetBot', 2.4, 'Objective: the control room. One message, on every screen.'],
  ['BatBot', 1.7, 'And if they don\'t open the door?'],
  ['BadaBot', 1.2, 'We knock.'],
];

/** Le robot qui reste à bord et passe la main : le premier de cette liste parmi ceux qui ne sont pas joués. */
const STAY_ORDER = ['EngiBot', 'PetBot', 'BatBot', 'BadaBot'];
const STAY: Record<string, string> = {
  EngiBot: 'This one is yours. We keep the engines warm.',
  PetBot: 'We stay on standby. Come back in one piece.',
  BatBot: 'I stay up here? Fine. Leave me some.',
  BadaBot: 'Your turn. We hold the sky.',
};

/** Le robot qui descend et répond : le premier de cette liste parmi ceux qui sont joués. */
const GO_ORDER = ['BadaBot', 'BatBot', 'PetBot', 'EngiBot'];
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
 * Toutes les répliques d'une arrivée, datées. `players` : les robots joués ; `total` : durée de l'arrivée
 * (celle des héros, `arrivalTotal`). Sans vol stationnaire, il ne reste que l'échange du largage.
 */
export function introLines(players: string[], total: number): IntroLine[] {
  const p = arrivalPhases(total);
  const lines: IntroLine[] = [];
  const hover = p.hover - p.flyIn;
  if (hover > 0) {
    const sum = RADIO.reduce((acc, r) => acc + r[1], 0);
    let at = 0;
    for (const [speaker, weight, text] of RADIO) {
      const from = p.flyIn + Math.round((at / sum) * hover);
      at += weight;
      lines.push({ from, to: p.flyIn + Math.round((at / sum) * hover), speaker, text });
    }
  }
  const exchange = dropExchange(players);
  exchange.forEach(([speaker, text], i) => {
    // la réponse commence quand les pinces s'ouvrent
    const from = i === 0 ? p.descend : p.release;
    lines.push({ from, to: i === exchange.length - 1 ? p.hold : p.release, speaker, text });
  });
  return lines;
}

export function introLineAt(lines: IntroLine[], t: number): IntroLine | null {
  return lines.find((l) => t >= l.from && t < l.to) ?? null;
}
