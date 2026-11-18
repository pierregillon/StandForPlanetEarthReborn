// Repères du scénario de TvTv² : les endroits que le code du jeu vise par leurs coordonnées (marque de
// l'ultimatum, barrage de police, zone d'extraction, plans des cinématiques).
// Le décor, lui, est dans `public/levels` et se retouche avec l'éditeur de niveaux (ADR-018) : si l'on y
// déplace le pupitre ou les portes du local technique, ces repères ne suivent pas tout seuls.

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
