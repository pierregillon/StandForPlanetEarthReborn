// Affichage du monde : décor fixe créé une fois, puis synchronisation des entités avec la simulation.
// Profondeurs Phaser = opposé des profondeurs de couches GameMaker (plus grand = devant).
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import type { FloorManifest } from '../assets.ts';
import { CONFIG, STEPS_PER_SECOND, TRACERS } from '../../sim/config.ts';
import { BLOCK_BULLET, BLOCK_MOVE, BLOCK_SIGHT, angleDiff, localToWorld } from '../../sim/geom.ts';
import { visibilityPolygon } from '../../sim/visibility.ts';
import { batHand, petAnchors } from '../../sim/abilities.ts';
import { muzzlePosition } from '../../sim/hero.ts';
import { ULTI_ACTION, ULTI_CAST, ULTI_RECOVER, petSwarm, waveStripOffset, waveStrips } from '../../sim/ulti.ts';
import type { Bat, Bullet, Button, Chair, Door, Drill, Fog, Hero, Npc, SimEvent, SpriteInfo, Turret, UltiEffect, WindowPane } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';

const DEPTH = {
  background: -800, floor: -700, decal: -600, zone: -400, window: -300, outlet: -150,
  remains: -50, chair: -20, legs: -1, character: 0, laser: 4, bullet: 5, fog: 100, wallThin: 200, wallThick: 300, door: 500, fx: 600, worldText: 700, darkness: 5000,
};
/** Brouillard de guerre : gris foncé de l'original ($313131). */
const FOG_COLOR = 0x313131;
/** Éclairage simplifié. L'original assombrit à 60 % ; 50 % ici pour garder les combats lisibles (GD-028). */
const LIGHTING = {
  /** Noir posé sur tout l'écran dans les salles éclairées (0.6 dans l'original). */
  ambient: 0.5,
  /** Part du noir retirée au centre d'une lampe : son intensité d'origine multipliée par cette valeur. */
  strength: 2,
  /** Lueur que le héros porte sur lui, pour rester lisible loin des lampes. */
  heroRadius: 460,
  heroStrength: 0.75,
  /** La lueur du héros est recalculée dès qu'il s'est déplacé de cette distance. */
  heroRebakeDistance: 3,
  /** Part du brouillard de guerre retirée là où une lumière entre dans une pièce encore cachée. */
  fogReveal: 0.9,
  chargingDim: 0.22,
  /** Les lampes sont pré-dessinées à cette fraction de leur taille : assez pour un dégradé, léger pour la carte graphique. */
  bakeScale: 0.35,
  /** La lueur du héros, redessinée à chaque déplacement, l'est en plus petit encore. */
  heroBakeScale: 0.25,
  /** La lumière entre de quelques pixels dans le mur qu'elle touche, pour en éclairer la face. */
  wallReach: 26,
  /** Force de la teinte des lampes colorées, ajoutée par-dessus le décor. */
  colorStrength: 1.4,
  /** Au plus ce nombre de lampes recalculées par image quand des portes bougent. */
  maxBakesPerFrame: 2,
};

/** Source de lumière, avec sa zone éclairée pré-dessinée dans une texture (ombres portées comprises). */
interface Lamp {
  x: number;
  y: number;
  radius: number;
  /** Part du noir retirée au centre de la lampe. */
  strength: number;
  key: string;
  /** Fraction de la taille réelle à laquelle la texture est dessinée. */
  scale: number;
  stamp: Img;
  /** Portes qui peuvent couper ou laisser passer sa lumière. */
  doors: Door[];
  /** Ouverture de ces portes au dernier calcul : si elle change, la zone éclairée est recalculée. */
  doorState: number;
}

const CARD_COLORS: Record<string, number> = { green: 0x35d05a, purple: 0xb04cff };
const MAX_REMAINS = 2400;
/**
 * Mort d'un humain (GD-067). L'animation d'origine est agrandie (`burst`) et doublée d'un souffle rouge ; une
 * flaque s'étale sous le corps (`pool` : nombre de nappes, dispersion, taille finale, durée d'étalement en
 * millisecondes) ; des gouttes giclent tout autour (`drops` : nombre, portée de `near` à `far` pixels, durée
 * du vol en secondes, taille de la tache laissée) et s'écrasent sur le sol ou sur le premier mur ; les
 * personnages à moins de `splash.range` pixels sont éclaboussés (`marks` taches chacun, qui tiennent `life`
 * secondes et s'effacent sur les `fade` dernières).
 */
/** Animation de mort jouée pour tous les humains : celle du soldat au pistolet. */
const HUMAN_BURST = 'spr_npc1_mort';
const GORE = {
  burst: 1.45,
  pieces: [8, 14],
  pool: { count: [4, 6], spread: 46, scale: [1.7, 3.1], growMs: 520 },
  drops: { count: [40, 56], near: 70, far: 360, flight: [0.16, 0.34], stain: [0.12, 0.5] },
  splash: { range: 230, marks: [2, 4], life: 14, fade: 3 },
};
/**
 * Position de la tête de BadaBot sur chaque image, dans la toile de ses sprites (tables de obj_plasmaBawl,
 * projet de 2019) : ordonnée pendant la marche (22 images), abscisse bouclier levé (4 images).
 */
const ORB_WALK_Y = [137, 137, 137, 138, 138, 139, 139, 139, 139, 136, 136, 129, 129, 129, 128, 128, 127, 127, 127, 127, 129, 129];
const ORB_SHIELD_X = [141, 158, 158, 147];
/** Décalage de l'orbe par rapport au robot, dans son repère (x vers l'avant, y vers sa droite). */
function orbOffset(bodySprite: string, frame: number): { x: number; y: number } {
  const i = Math.max(0, Math.floor(frame));
  if (bodySprite === 'spr_BadaBot_move') return { x: 0, y: ORB_WALK_Y[i % ORB_WALK_Y.length] - 137 };
  if (bodySprite === 'spr_BadaBot_fire2') return { x: ORB_SHIELD_X[Math.min(i, ORB_SHIELD_X.length - 1)] - 141, y: 0 };
  return { x: 0, y: 0 };
}
/** Logement de la munition sur l'arme de chaque robot, dans le repère de son sprite. */
const RELOAD_SLOT: Record<string, { x: number; y: number }> = {
  PetBot: { x: 52, y: 23 },
  EngiBot: { x: 14, y: 57 },
  BadaBot: { x: 22, y: 0 },
};
/** Aspect des projectiles (GD-022) : traînée jaune pour le héros, orange pour les ennemis. */
const BULLET_STYLE = {
  heroScale: 1.2,
  enemyScale: 2,
  hero: { core: 0xfff27a, glow: 0xffc400, width: 5, length: 70 },
  enemy: { core: 0xffb347, glow: 0xff5a1f, width: 5, length: 90 },
};

/**
 * Prototype (GD-064) : les balles sont des étoiles filantes, un trait de lumière net qui s'effile derrière
 * elles. À la sortie du canon elles ont la lumière de la déflagration (blanc en tête, jaune derrière) ; en
 * refroidissant, leur traînée vire au gris et l'on ne voit plus que la balle.
 */
const TRACER_STYLE = {
  /** Longueur et largeur de la traînée en plein vol ; secondes pendant lesquelles elle s'efface après l'impact. */
  length: 900,
  width: 7.5,
  fade: 0.14,
  /**
   * Lumière d'un tir : cœur et halo de la flamme, et couleur de la traînée (`trail`) : un jaune clair, qui tire
   * sur le blanc, pour les héros ; orangée pour les ennemis, pour savoir qui tire.
   */
  hero: { core: 0xfff3a0, glow: 0xffc21a, trail: 0xffec78 },
  enemy: { core: 0xffd9a0, glow: 0xff7a1f, trail: 0xff8f24 },
  /**
   * Forme de la traînée, une aiguille pleine aux bords francs : `tail`, sa largeur à la queue (part de sa
   * largeur en tête) ; `fadeOver`, part arrière de sa longueur sur laquelle elle pâlit ; `white`, part avant
   * chauffée à blanc.
   */
  streak: { tail: 0.2, fadeOver: 0.3, white: 0.22, pieces: 16 },
  /** Gris d'une balle refroidie. */
  cold: 0x8f949c,
  /** La balle reste chaude sur `hotUntil` pixels de vol, puis refroidit jusqu'à `coldAt`. */
  hotUntil: 800,
  coldAt: 2000,
  /**
   * Déflagration à la bouche du canon : une flamme de lumière vers l'avant, longue comme deux fois l'arme,
   * tenue `hold` secondes à pleine force puis éteinte selon une exponentielle de constante `decay`. Elle
   * éclaire ce qui est devant le canon, sur `light` pixels : une zone étroite mais intense, et presque rien
   * vers l'arrière (un canon n'éclaire pas derrière lui). La flamme est une gerbe de `rays` rayons pointus
   * serrés dans un cône de `spread` radians de part et d'autre de l'axe du tir. `size` grossit ou réduit
   * toute la flamme d'un seul réglage, lueur comprise (1 : la taille de son premier dessin).
   */
  blast: {
    size: 0.75,
    length: 190, width: 36, hold: 0.015, decay: 0.028, light: 250, lightAlpha: 0.95, rays: 9, spread: 0.14,
    /** Pixels dont toute la flamme avance, loin du canon, pendant qu'elle s'estompe. */
    drift: 40,
  },
  /**
   * Fumée qui prend la place de la flamme : elle naît quand la force de la flamme passe sous `at`, là où la
   * flamme se trouve alors, puis reste dans l'air (elle ne suit plus le canon). `puffs` bouffées, étalées sur
   * `spread` pixels devant le canon, partent vers l'avant à `speed` px/s, freinées par `drag` ; chacune
   * gonfle de `radius` à `radius × grow` pixels et s'efface en `life` secondes. Chaude à sa naissance
   * (`hot`), elle vire au gris (`cold`) : c'est elle qui dit que le canon vient de chauffer. Chaque bouffée
   * est une nappe dessinée comme le brouillard du jeu (`spr_fog`) : des aplats gris sans contour, à demi
   * transparents, qui se recouvrent. Elles n'ont pas toutes la même opacité (de `thin` à `alpha`), restent
   * pleines pendant la part `hold` de leur vie puis s'effacent, et tournent à peine (`spin`, en radians par
   * seconde).
   */
  smoke: {
    at: 0.4, puffs: 6, spread: 78, speed: 250, drag: 6, radius: 20, grow: 2.5, life: 0.55,
    alpha: 1, thin: 0.6, hold: 0.35, spin: 0.5, hot: 0xffe9c4, cold: 0xdcdce0,
  },
};

/**
 * Bout du canon de chaque tireur, mesuré sur la première image de son sprite de tir : pixels depuis l'origine
 * du sprite, x vers l'avant, y vers sa droite. La flamme d'un tir naît là. Le point de tir de la simulation
 * (`muzzle`, repris du code de 2019) en est parfois loin : 19 px en arrière pour EngiBot, 7 pour PetBot, 6 pour
 * ShotBot. Un tireur sans mesure garde le point de tir de la simulation.
 */
const GUN_TIPS: Record<string, { x: number; y: number }> = {
  spr_PetBot_shot: { x: 97, y: 24.5 },
  spr_EngiBot_shot: { x: 62, y: 57 },
  spr_npc1_shot: { x: 84, y: 7.5 },
  spr_npc_lightBot_tir: { x: 76, y: 24.5 },
  spr_npc_shotBot_shot: { x: 85, y: -32 },
};
/**
 * Bout du canon de la tourelle d'EngiBot, qui s'allonge avec son niveau (une image de `spr_turet` par niveau).
 * La simulation tire de 60 px en avant quel que soit le niveau, soit 16 px devant le canon au niveau 1.
 */
const TURRET_TIPS = { x: [44, 47, 53, 59], y: 1 };

/** Où se trouve le bout d'un canon à cet instant, et vers où il pointe. */
type Gun = () => { x: number; y: number; angle: number } | null;

/** Trait de lumière d'une balle en vol : début de sa ligne droite en cours (départ ou dernier ricochet) et dernier tracé. */
interface Streak {
  fromX: number;
  fromY: number;
  angle: number;
  tailX: number;
  tailY: number;
  headX: number;
  headY: number;
  speed: number;
  /** Chaleur de la balle, de 1 (sortie du canon) à 0 (refroidie). */
  heat: number;
  enemy: boolean;
  done: boolean;
}

/** Trait qui s'efface après l'impact ou après un ricochet. */
interface Afterglow {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  heat: number;
  enemy: boolean;
  life: number;
}

/**
 * Déflagration à la bouche d'un canon : son âge en secondes, et la lueur qu'elle jette sur la pièce. Elle reste
 * accrochée au canon (`gun`) : si le tireur avance ou tourne pendant qu'elle brûle, elle le suit. `turn` :
 * écart entre la direction de la balle et celle du canon, c'est-à-dire la dispersion de ce tir.
 */
interface MuzzleFlash {
  x: number;
  y: number;
  angle: number;
  gun: Gun | null;
  turn: number;
  /** Vrai une fois que sa fumée est née. */
  smoked: boolean;
  enemy: boolean;
  age: number;
  light: Img;
  /** Rayons de la gerbe : écart à l'axe du tir, longueur et demi-largeur à la base. */
  rays: { offset: number; length: number; width: number }[];
  /** Étincelles projetées vers l'avant : direction, distance de départ et vitesse. */
  sparks: { offset: number; from: number; speed: number; size: number }[];
}

type Img = Phaser.GameObjects.Image;

/** Bouffée de fumée laissée par un tir : elle avance, gonfle et s'efface. `age` et `life` en secondes. */
interface Smoke {
  img: Img;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  radius: number;
  /** Opacité au plus fort, et vitesse à laquelle elle tourne sur elle-même. */
  peak: number;
  spin: number;
}

interface PlayingAnim {
  img: Img;
  sprite: string;
  frames: number;
  fps: number;
  elapsed: number;
  keepLast: boolean;
}

interface Debris {
  img: Img;
  vx: number;
  vy: number;
  spin: number;
  /** Emporté par la vague de BadaBot : distance qu'il parcourt encore sans ralentir. */
  glide?: number;
}

/**
 * Traces de pas (GD-069). Un personnage qui marche dans une flaque de sang ou d'huile en garde sous les pieds :
 * il laisse `prints` empreintes, de plus en plus pâles, de la couleur de la flaque. `maxPuddles` : nombre de
 * flaques dont on se souvient.
 */
const FOOTPRINTS = { prints: 14, alpha: 0.85, blood: 0xd4162c, oil: 0x8ca5e4, maxPuddles: 240 };
/** Nombre de dessins par forme d'empreinte, du plus plein (pieds trempés) au plus usé (pieds presque secs). */
const FOOTPRINT_WEARS = 4;

/**
 * Pieds d'un personnage, relevés sur ses sprites : forme de l'empreinte, sa longueur et sa largeur, `gap`
 * (distance de chaque pied à l'axe de la marche) et `stride` (chemin parcouru entre deux empreintes, une
 * d'un pied puis une de l'autre).
 */
interface Feet {
  shape: 'pad' | 'shoe' | 'claw';
  length: number;
  width: number;
  gap: number;
  stride: number;
}
/** Les héros : un patin de robot, talon rond et bout pointu (sprites `spr_*_jambes`). */
const HERO_FEET: Record<string, Feet> = {
  PetBot: { shape: 'pad', length: 46, width: 17, gap: 14, stride: 64 },
  BatBot: { shape: 'pad', length: 46, width: 17, gap: 14, stride: 64 },
  EngiBot: { shape: 'pad', length: 54, width: 20, gap: 16, stride: 70 },
  BadaBot: { shape: 'pad', length: 54, width: 20, gap: 16, stride: 70 },
};
/** Les humains, civils et soldats : une semelle et son talon. */
const HUMAN_FEET: Feet = { shape: 'shoe', length: 18, width: 8, gap: 9, stride: 30 };
/** Les robots ennemis marchent sur des pattes à griffes, de plus en plus grosses. */
const ROBOT_FEET: Record<string, Feet> = {
  obj_npc_robot_lightBot: { shape: 'claw', length: 22, width: 9, gap: 17, stride: 44 },
  obj_npc_robot_shotBot: { shape: 'claw', length: 28, width: 12, gap: 24, stride: 52 },
  obj_npc_robot_shield: { shape: 'claw', length: 34, width: 14, gap: 30, stride: 50 },
};
const BIG_ROBOT_FEET: Feet = { shape: 'claw', length: 44, width: 18, gap: 38, stride: 70 };

/** Flaque de sang ou d'huile dans laquelle on peut marcher. */
interface Puddle {
  img: Img;
  x: number;
  y: number;
  r: number;
  color: number;
}

/** Marche d'un personnage : où il était, ce qu'il lui reste sous les pieds (`ink`, de 1 à 0) et le pied à poser. */
interface Walk {
  x: number;
  y: number;
  ink: number;
  color: number;
  side: number;
  carry: number;
  seen: number;
}

/** Goutte de sang en vol, du corps jusqu'à l'endroit où elle s'écrase (sur un mur si `onWall`). */
interface BloodDrop {
  img: Img;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  age: number;
  flight: number;
  size: number;
  onWall: boolean;
}

/** Tache de sang sur un personnage : elle le suit, à (lx, ly) dans son repère, puis s'efface. */
interface BloodStain {
  img: Img;
  on: 'hero' | 'npc';
  id: number;
  lx: number;
  ly: number;
  turn: number;
  age: number;
}

/** BadaBot frappe ses boucliers sur les derniers steps de son lancement (GD-051). */
const SLAM_STEPS = 6;

function tintOf(hex: string): number {
  return parseInt(hex.replace('#', ''), 16);
}

/** Images et état d'affichage d'un héros : tous les robots de l'équipe sont dessinés de la même façon (GD-041). */
interface HeroParts {
  body: Img;
  legs: Img;
  legsTime: number;
  /** Orbe de BadaBot, et l'endroit où elle est dessinée. */
  orb: Img | null;
  orbX: number;
  orbY: number;
  auras: Img[];
  /** Nom du joueur, au-dessus des coéquipiers. */
  tag: Phaser.GameObjects.Text | null;
  /** Ulti : lueur qui enfle pendant le lancement, ombre au sol pendant le bond. */
  glow: Img | null;
  shadow: Phaser.GameObjects.Ellipse | null;
  airborne: boolean;
  /** Secondes pendant lesquelles le robot reste rouge après un coup reçu. */
  hurt: number;
  /** Énergie qui se concentre pendant le lancement : un calque sous le robot, un par-dessus. */
  chargeUnder: Img | null;
  chargeTop: Img | null;
  /** Mini-bots de PetBot (GD-045) : ils flottent à leur place autour de lui. */
  pets: Pet[] | null;
  /** Secondes écoulées depuis que les mini-bots sont revenus (0 tant qu'ils sont partis en salve). */
  petsHome: number;
  /** Ulti de PetBot (GD-047) : traînées des mini-bots en orbite, et horloge lissée de leur ronde. */
  petTrails: Phaser.GameObjects.Graphics | null;
  spinTime: number;
  /** Centre de leur ronde : il suit PetBot avec le même retard que les mini-bots à ses côtés (GD-050). */
  swarmX: number;
  swarmY: number;
}

interface Pet {
  img: Img;
  /** Son ombre : la même silhouette, en noir. */
  shadow: Img;
  x: number;
  y: number;
  angle: number;
  /** Ce qu'il fait : il suit PetBot, il se rassemble pendant le lancement de l'ulti, ou il tourne sur son cercle. */
  mode: 'follow' | 'gather' | 'ring';
  /** Secondes passées dans ce mode, et écart à PetBot au moment où il y est entré. */
  modeTime: number;
  fromX: number;
  fromY: number;
}

/** Mini-bots de PetBot (GD-045, GD-046). */
const PETS = {
  /** Taille par rapport au sprite d'origine : deux fois celle du drone de 2019. */
  scale: 1.84,
  /** Amplitude du flottement, en part de la taille. */
  bob: 0.04,
  /** Constante de temps du rattrapage : en pleine course, ils traînent de 85 px environ derrière PetBot. */
  followSeconds: 0.125,
  /** Trappe d'où ils sortent, dans le repère de PetBot : sur son coffre dorsal, entre la croix rouge et le crâne. */
  hatch: { x: -21, y: 0 },
  /** Ils sortent un par un : écart entre deux sorties, et durée du trajet de la trappe à leur place. */
  stagger: 0.28,
  emerge: 0.5,
  /** Ulti (GD-047) : chaque mini-bot tourne sur son cercle autour de PetBot. */
  orbit: {
    /**
     * Du plus proche au plus lointain : rayon en part du rayon de soin, durée d'un tour en secondes, et sens
     * (1 = sens des aiguilles d'une montre). Le cercle extérieur est le bord de la zone de soin.
     */
    rings: [{ radius: 0.34, period: 1.15, dir: 1 }, { radius: 0.67, period: 1.7, dir: -1 }, { radius: 1, period: 2.3, dir: 1 }],
    /** Secondes pour rejoindre son cercle. */
    join: 0.6,
    /** Pendant le lancement, ils se rassemblent sur un petit cercle autour de PetBot et prennent de la vitesse. */
    gather: 92,
    /** Longueur de la traînée lumineuse derrière chacun, en pixels. */
    tail: 460,
  },
};

/**
 * Couleur de l'énergie de chaque robot quand il lance son ulti (GD-049) : teinte principale et reflet. Violet
 * pour BatBot, vert pour PetBot, bleu pour BadaBot, orange pour EngiBot. L'impulsion de la grenade d'EngiBot
 * (`emp`) reste bleu électrique.
 */
const ULTI_COLORS: Record<string, { main: number; light: number }> = {
  BatBot: { main: 0xfe00d1, light: 0xff84e8 },
  PetBot: { main: 0x3dff7a, light: 0xc4ffd6 },
  BadaBot: { main: 0x5b78ff, light: 0xc9d4ff },
  EngiBot: { main: 0xff8a2b, light: 0xffd9b0 },
  emp: { main: 0x4fb8ff, light: 0xd4f0ff },
};

/** Bleu clair de l'énergie en surcharge (GD-031). */
const OVERCHARGE_COLOR = 0x4fb8ff;

/** Mélange deux couleurs 0xRRGGBB : `t` = 0 donne `from`, 1 donne `to`. */
function mixColor(from: number, to: number, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const channel = (shift: number): number => Math.round(((from >> shift) & 255) + (((to >> shift) & 255) - ((from >> shift) & 255)) * k) << shift;
  return channel(16) | channel(8) | channel(0);
}

/** Lancement d'un ulti, de 0 à 1 (0 en dehors). */
function castProgress(h: Hero): number {
  return h.ultiPhase === ULTI_CAST ? Math.min(1, h.ultiSteps / CONFIG.ulti.castSteps) : 0;
}

/** Brins d'un arc d'énergie, du plus large (halo) au plus fin (cœur). */
interface BeamStrand {
  width: number;
  color: number;
  alpha: number;
  jitter: number;
}
/** Arc d'une borne de recharge : bleu électrique. */
const OUTLET_BEAM: BeamStrand[] = [
  { width: 12, color: 0x2f8dff, alpha: 0.22, jitter: 10 },
  { width: 6, color: 0x7fd9ff, alpha: 0.55, jitter: 16 },
  { width: 2.5, color: 0xffffff, alpha: 0.95, jitter: 16 },
  { width: 2, color: 0xffe36b, alpha: 0.8, jitter: 30 },
];
/** Lien entre héros : turquoise à cœur blanc, avec un filet rouge (couleurs du link d'origine : rouge dedans, aqua dehors). */
const LINK_BEAM: BeamStrand[] = [
  { width: 14, color: 0x12b9c9, alpha: 0.22, jitter: 8 },
  { width: 7, color: 0x6ff7ee, alpha: 0.6, jitter: 13 },
  { width: 3, color: 0xffffff, alpha: 0.95, jitter: 13 },
  { width: 2, color: 0xff4a5e, alpha: 0.85, jitter: 26 },
];

export class WorldView {
  private readonly scene: Phaser.Scene;
  private readonly world: World;
  private readonly npcImgs = new Map<number, Img>();
  private readonly bulletImgs = new Map<number, Img>();
  /** Prototype (GD-064) : traits de lumière des balles en vol, traits qui s'effacent, éclairs des canons. */
  private readonly streaks = new Map<number, Streak>();
  private readonly afterglows: Afterglow[] = [];
  private readonly flashes: MuzzleFlash[] = [];
  private readonly smokes: Smoke[] = [];
  private readonly droneImgs = new Map<number, Img>();
  private readonly droneShadowImgs = new Map<number, Img>();
  private readonly explosionImgs = new Map<number, Img>();
  private readonly batImgs = new Map<number, Img>();
  /** Effets d'ultis en cours : image principale et, selon l'effet, une seconde (zone de soin, impulsion). */
  private readonly effectImgs = new Map<number, { main: Img; extra: Img | Phaser.GameObjects.Shape | null }>();
  private turretImg: Img | null = null;
  private fogLayer!: Phaser.GameObjects.RenderTexture;
  private readonly drillParts = new Map<number, { contours: Img | null; beam: Img | null }>();
  private drillBars!: Phaser.GameObjects.Graphics;
  private darkness: Phaser.GameObjects.RenderTexture | null = null;
  /** Lueur de chaque héros, par rang. */
  private readonly heroLamps = new Map<number, Lamp>();
  private lights: Lamp[] = [];
  private readonly doorImgs = new Map<number, Img>();
  private readonly windowImgs = new Map<number, Img>();
  private readonly outletImgs = new Map<number, Img>();
  private readonly cardImgs = new Map<number, Img>();
  private readonly zoneImgs: Img[] = [];
  private readonly anims: PlayingAnim[] = [];
  private readonly debris: Debris[] = [];
  private readonly drops: BloodDrop[] = [];
  private readonly stains: BloodStain[] = [];
  private readonly puddles: Puddle[] = [];
  private readonly walks = new Map<string, Walk>();
  private walkStamp = 0;
  /** Restes qui ont volé (membres, éclats de verre) : la vague de BadaBot peut les emporter. Et par quelle vague ils l'ont déjà été. */
  private readonly loose = new WeakSet<Img>();
  private readonly sweptBy = new WeakMap<Img, number>();
  private readonly remains: Img[] = [];
  private readonly parts = new Map<number, HeroParts>();
  /** Noms des joueurs, par rang de héros (partie en réseau). */
  playerNames: string[] = [];
  /** Arcs d'énergie autour d'un robot qui lance son ulti (GD-048). */
  private ultiArcs!: Phaser.GameObjects.Graphics;
  /** Onde de l'ulti de BadaBot (GD-052), redessinée à chaque image. */
  private waveFx!: Phaser.GameObjects.Graphics;
  private heroFx!: Phaser.GameObjects.Graphics;
  private npcFx!: Phaser.GameObjects.Graphics;
  private readonly cardGlows = new Map<number, Img>();
  private readonly chairImgs = new Map<number, Img>();
  private readonly buttonImgs = new Map<number, Img>();
  private readonly alerts = new Map<number, { text: Phaser.GameObjects.Text; frames: number }>();
  private checkpointImg: Img | null = null;
  private vehicle: { body: Img; shadow: Img | null } | null = null;
  private hasLamps = false;
  private cable!: Phaser.GameObjects.Graphics;
  private tracers!: Phaser.GameObjects.Graphics;
  /** Lumières des tirs (prototype GD-064) : flammes des canons et halo des balles chaudes, en lumière ajoutée. */
  private shotLights!: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, world: World, floors: FloorManifest) {
    this.scene = scene;
    this.world = world;
    this.buildStatic(floors);
    this.buildDynamic();
  }

  private info(sprite: string): SpriteInfo {
    return this.world.sprite(sprite);
  }

  /** Crée une image de sprite avec son origine GameMaker. */
  private image(sprite: string, frame: number, x: number, y: number, depth: number): Img {
    const sp = this.info(sprite);
    const f = Math.max(0, Math.min(frame, sp.frames - 1));
    return this.scene.add.image(x, y, frameKey(sprite, f)).setOrigin(sp.ox / sp.w, sp.oy / sp.h).setDepth(depth);
  }

  private setFrame(img: Img, sprite: string, frame: number): void {
    const sp = this.info(sprite);
    const key = frameKey(sprite, Math.max(0, Math.min(Math.floor(frame), sp.frames - 1)));
    if (img.texture.key !== key) {
      img.setTexture(key);
      img.setOrigin(sp.ox / sp.w, sp.oy / sp.h);
    }
  }

  // ---------- Décor fixe ----------

  private buildStatic(floors: FloorManifest): void {
    const { scene, world } = this;
    const level = world.level;
    scene.cameras.main.setBackgroundColor(level.background.color);
    const bg = level.background.sprite;
    if (bg && scene.textures.exists(frameKey(bg, 0))) {
      scene.add.tileSprite(0, 0, level.width, level.height, frameKey(bg, 0)).setOrigin(0, 0).setDepth(DEPTH.background);
    }

    // sols : une texture répétée par type, découpée dans l'image du tileset
    for (const floor of level.floors) {
      const info = floors[floor.tileset];
      const srcKey = `floorsrc:${floor.tileset}`;
      if (!info || !scene.textures.exists(srcKey)) continue;
      const key = `floor:${floor.tileset}`;
      if (!scene.textures.exists(key)) {
        const canvas = scene.textures.createCanvas(key, info.periodW, info.periodH);
        if (!canvas) continue;
        const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement;
        canvas.context.drawImage(src, info.srcX, info.srcY, info.periodW, info.periodH, 0, 0, info.periodW, info.periodH);
        canvas.refresh();
      }
      const ts = scene.add.tileSprite(floor.x, floor.y, floor.w, floor.h, key).setOrigin(0, 0).setDepth(DEPTH.floor);
      ts.tilePositionX = floor.phaseX ?? 0;
      ts.tilePositionY = floor.phaseY ?? 0;
    }

    for (const d of level.decals) {
      if (!scene.textures.exists(frameKey(d.sprite, 0))) continue;
      this.image(d.sprite, d.frame, d.x, d.y, DEPTH.decal)
        .setAngle(-d.angle).setScale(d.scaleX, d.scaleY).setTint(tintOf(d.tint)).setAlpha(d.alpha);
    }

    for (const d of world.decor) {
      if (!scene.textures.exists(frameKey(d.sprite, 0))) continue;
      this.image(d.sprite, d.frame, d.x, d.y, -d.depth)
        .setRotation(d.angle).setScale(d.scaleX, d.scaleY).setTint(tintOf(d.tint)).setAlpha(d.alpha);
    }

    for (const w of level.walls) {
      const sprite = level.objects[w.object]?.sprite;
      if (!sprite || !scene.textures.exists(frameKey(sprite, 0))) continue;
      this.image(sprite, 0, w.x, w.y, w.thick ? DEPTH.wallThick : DEPTH.wallThin).setAngle(-w.angle).setScale(w.scaleX, 1);
    }
  }

  // ---------- Entités ----------

  private buildDynamic(): void {
    const { scene, world } = this;
    for (const door of world.doors) {
      this.doorImgs.set(door.id, this.image(door.sprite, 0, door.x, door.y, DEPTH.door).setRotation(door.angle).setScale(door.scaleX, door.scaleY));
    }
    for (const pane of world.windows) {
      this.windowImgs.set(pane.id, this.image(pane.sprite, 0, pane.x, pane.y, DEPTH.window).setRotation(pane.angle).setScale(pane.scaleX, pane.scaleY));
    }
    this.makeOutletTexture();
    for (const outlet of world.outlets) {
      this.outletImgs.set(outlet.id, scene.add.image(outlet.x, outlet.y, 'outlet').setDepth(DEPTH.outlet));
    }
    for (const card of world.cards) {
      // carte redessinée (GD-029) : une vraie carte d'accès, avec un halo de sa couleur
      this.ensureHalo();
      this.cardGlows.set(card.id, scene.add.image(card.x, card.y, 'lightHalo').setTint(CARD_COLORS[card.color]).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.outlet));
      this.cardImgs.set(card.id, scene.add.image(card.x, card.y, this.cardTexture(card.color)).setDepth(DEPTH.outlet + 1));
    }
    for (const zone of world.zones) {
      this.zoneImgs.push(this.image(zone.sprite, 0, zone.x, zone.y, DEPTH.zone));
    }
    for (const h of world.heroes) this.partsOf(h);
    this.ultiArcs = scene.add.graphics().setDepth(DEPTH.character + 2.2).setBlendMode(Phaser.BlendModes.ADD);
    this.waveFx = scene.add.graphics().setDepth(DEPTH.fx + 3).setBlendMode(Phaser.BlendModes.ADD);
    this.heroFx = scene.add.graphics().setDepth(DEPTH.bullet + 2);
    this.npcFx = scene.add.graphics().setDepth(DEPTH.bullet + 2);
    this.cable = scene.add.graphics().setDepth(DEPTH.laser);
    this.tracers = scene.add.graphics().setDepth(DEPTH.bullet + 1);
    this.shotLights = scene.add.graphics().setDepth(DEPTH.bullet + 2).setBlendMode(Phaser.BlendModes.ADD);
    this.drillBars = scene.add.graphics().setDepth(DEPTH.worldText);
    // brouillard de guerre : un calque de la taille de l'écran, que la lumière peut percer (GD-041)
    this.fogLayer = scene.add.renderTexture(0, 0, VIEW.width, VIEW.height).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.fog);
    for (const drill of world.drills) {
      const part = (sprite: string): Img | null => (scene.textures.exists(frameKey(sprite, 0)) ? this.image(sprite, 0, drill.x, drill.y, DEPTH.character - 2) : null);
      this.drillParts.set(drill.id, { contours: part('spr_foreuse_contours'), beam: part('spr_foreuse_faisceau') });
    }
    this.buildLights();
  }

  /** Remake (GD-006) : borne de recharge dessinée par le code, faute de sprite d'origine. */
  private makeOutletTexture(): void {
    if (this.scene.textures.exists('outlet')) return;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x10141c, 0.55).fillCircle(48, 50, 44);
    g.fillStyle(0x2a3140, 1).fillRoundedRect(14, 14, 68, 68, 12);
    g.lineStyle(4, 0x8b96ad, 1).strokeRoundedRect(14, 14, 68, 68, 12);
    g.fillStyle(0x151a24, 1).fillRoundedRect(24, 24, 48, 48, 8);
    g.fillStyle(0xffd23c, 1);
    g.fillPoints([
      new Phaser.Geom.Point(52, 28), new Phaser.Geom.Point(36, 52), new Phaser.Geom.Point(47, 52),
      new Phaser.Geom.Point(43, 70), new Phaser.Geom.Point(61, 44), new Phaser.Geom.Point(50, 44),
    ], true);
    // voyant : vert tant que la borne a de la réserve, rouge une fois vidée (GD-031)
    for (const [key, led, halo] of [['outlet', 0x4dff88, 0x1f8a45], ['outlet_empty', 0xff3030, 0x7a1010]] as const) {
      g.fillStyle(halo, 1).fillCircle(72, 22, 10);
      g.fillStyle(led, 1).fillCircle(72, 22, 7);
      g.fillStyle(0xffffff, 0.7).fillCircle(70, 20, 2.5);
      g.generateTexture(key, 96, 96);
    }
    g.destroy();
  }

  /** Met l'affichage à jour d'après l'état du monde. `dt` en secondes. */
  sync(dt: number): void {
    this.syncHeroes(dt);
    this.syncNpcs();
    this.syncBullets();
    this.syncAbilityObjects();
    this.syncDrills();
    this.syncLights();
    this.syncFogs();
    for (const door of this.world.doors) this.syncDoor(door);
    for (const outlet of this.world.outlets) {
      const img = this.outletImgs.get(outlet.id);
      if (!img) continue;
      const empty = outlet.energyLeft === 0 && outlet.repairLeft === 0;
      img.setScale(outlet.inUse ? 1.08 + Math.sin(this.scene.time.now / 80) * 0.04 : 1);
      // borne vidée : seul son voyant change, il passe au rouge
      if (empty && img.texture.key !== 'outlet_empty') img.setTexture('outlet_empty');
    }
    this.syncNpcFx();
    this.syncVehicle();
    this.syncFurniture();
    this.syncCheckpoint();
    this.world.zones.forEach((zone, i) => {
      const sprite = zone.active ? 'spr_teleporteur_active' : zone.sprite;
      if (this.scene.textures.exists(frameKey(sprite, 0))) this.setFrame(this.zoneImgs[i], sprite, 0);
    });
    for (const card of this.world.cards) {
      // une carte au sol oscille pour attirer l'œil ; ramassée, elle n'est plus dessinée dans la salle
      const t = this.scene.time.now / 1000 + card.id;
      // la carte flotte, se balance et pulse : on voit que c'est un objet à prendre (GD-029)
      this.cardImgs.get(card.id)?.setVisible(!card.carried)
        .setPosition(card.x, card.y - 10 + Math.sin(t * 3) * 8).setRotation(Math.sin(t * 2) * 0.3).setScale(1.1 + 0.12 * Math.sin(t * 4));
      this.cardGlows.get(card.id)?.setVisible(!card.carried).setScale(0.9 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4))).setAlpha(0.55 + 0.25 * Math.sin(t * 4));
    }
    this.stepAnims(dt);
    this.stepDebris(dt);
    this.stepBlood(dt);
    this.stepFootprints();
  }

  /** Tous les robots de l'équipe, avec toutes leurs animations, chez tous les joueurs (GD-041). */
  private syncHeroes(dt: number): void {
    this.ultiArcs.clear();
    this.cable.clear();
    this.heroFx.clear();
    for (const h of this.world.heroes) this.syncHero(h, this.partsOf(h), dt);
    this.drawOutlets();
    // liens entre héros (GD-043) : le faisceau s'effiloche quand ils s'éloignent
    for (const h of this.world.heroes) {
      const to = h.gone || h.linkTo < 0 ? null : this.world.heroes[h.linkTo];
      if (to) this.drawEnergyLink(h.x, h.y, to.x, to.y, LINK_BEAM, h.linkStrength);
    }
  }

  private partsOf(h: Hero): HeroParts {
    let p = this.parts.get(h.id);
    if (!p) {
      p = {
        legs: this.image(h.def.sprites.legs, 0, h.x, h.y, DEPTH.legs),
        body: this.image(h.def.sprites.stand, 0, h.x, h.y, DEPTH.character),
        legsTime: 0, orb: null, orbX: h.x, orbY: h.y, auras: [], tag: null, glow: null, shadow: null, airborne: false, hurt: 0, chargeUnder: null, chargeTop: null, pets: null, petsHome: 0, petTrails: null, spinTime: 0, swarmX: h.x, swarmY: h.y,
      };
      this.parts.set(h.id, p);
    }
    return p;
  }

  private syncHero(h: Hero, p: HeroParts, dt: number): void {
    const def = h.def;
    const { body, legs } = p;
    const local = h === this.world.hero;
    const dead = h.state === 'dead';
    // pendant le largage, chaque robot est dessiné dans sa pince du véhicule (voir syncVehicle)
    const shown = !h.gone;
    body.setVisible(shown);
    legs.setVisible(shown && !dead && h.deploySteps === 0);
    if (!shown || dead) {
      p.orb?.setVisible(false);
      for (const aura of p.auras) aura.setVisible(false);
      p.glow?.setVisible(false);
      p.shadow?.setVisible(false);
      p.chargeUnder?.setVisible(false);
      p.chargeTop?.setVisible(false);
    }
    this.syncTag(h, p, shown && !local);
    if (def.kind === 'PetBot') this.syncPets(h, p, dt, shown && !dead && h.deploySteps === 0);
    if (!shown) return;
    body.setPosition(h.x, h.y).setRotation(h.angle);
    legs.setPosition(h.x, h.y).setRotation(h.moveAngle);

    if (dead) {
      const sprite = def.kind === 'BatBot' ? `spr_BatBot_mort_${h.bats}` : def.sprites.dead;
      this.setFrame(body, sprite, (h.deadSteps / STEPS_PER_SECOND) * spriteFps(this.info(sprite)));
      body.setAlpha(1).clearTint();
      return;
    }
    if (h.dashing) this.dashTrail(h, body);
    if (h.moving) {
      p.legsTime += dt;
      this.setFrame(legs, def.sprites.legs, (p.legsTime * 20) % this.info(def.sprites.legs).frames);
    } else {
      this.setFrame(legs, def.sprites.legs, 0);
    }

    const pose = this.heroPose(h);
    this.setFrame(body, pose.sprite, pose.frame);
    this.syncPlasmaBall(h, p, pose.sprite, pose.frame);
    this.syncUlti(h, p);

    // invulnérable au réveil après une résurrection : le héros clignote. Un coup reçu : il rougit un instant,
    // sans plus aucune invulnérabilité (GD-070)
    p.hurt = Math.max(0, p.hurt - dt);
    if (h.invuln > 0) body.setAlpha(Math.floor(h.invuln / 2) % 2 === 0 ? 0.35 : 1).setTint(0xff8080);
    else if (p.hurt > 0) body.setAlpha(1).setTint(0xff6a6a);
    else body.setAlpha(1).clearTint();

    // pas de viseur laser : retiré à la demande de l'utilisateur (GD-068)
    this.drawHeroFx(h, p, local);
  }

  /**
   * Ulti (GD-043). Lancement : le robot est immobile (GD-048), c'est l'énergie qui s'anime autour de lui, en
   * trois temps (GD-049) : son énergie de surcharge prend la couleur du robot (`syncAura`), un léger halo de
   * cette couleur la souligne, puis ce halo s'étend un peu. Des croissants se resserrent et des arcs électriques
   * courent autour de lui. Bond de BatBot : le robot grossit et s'élève, son ombre reste au sol.
   */
  private syncUlti(h: Hero, p: HeroParts): void {
    const scene = this.scene;
    const casting = h.ultiPhase === ULTI_CAST;
    if (casting && scene.textures.exists(frameKey('spr_ulti_charge', 0))) {
      const colors = ULTI_COLORS[h.def.kind] ?? ULTI_COLORS.BatBot;
      this.ensureHalo();
      p.glow ??= scene.add.image(h.x, h.y, 'lightHalo').setBlendMode(Phaser.BlendModes.ADD).setTint(colors.main).setDepth(DEPTH.legs - 1);
      // l'énergie est un sprite à part, blanc, teinté à la couleur du robot : un calque dessous, un dessus
      p.chargeUnder ??= this.image('spr_ulti_charge', 0, h.x, h.y, DEPTH.legs - 0.5).setTint(colors.main);
      p.chargeTop ??= this.image('spr_ulti_charge_top', 0, h.x, h.y, DEPTH.character + 2).setTint(colors.light);
      const k = Math.min(1, h.ultiSteps / CONFIG.ulti.castSteps);
      const frame = k * (this.info('spr_ulti_charge').frames - 1);
      // les robots n'ont pas tous la même taille : l'énergie s'ajuste à leur rayon
      const scale = Math.max(0.8, h.def.radius / 62);
      this.setFrame(p.chargeUnder, 'spr_ulti_charge', frame);
      this.setFrame(p.chargeTop, 'spr_ulti_charge_top', frame);
      // comme l'enveloppe de surcharge, toute l'énergie part du bleu clair et prend la couleur du robot
      const tint = { main: mixColor(OVERCHARGE_COLOR, colors.main, k * 3), light: mixColor(ULTI_COLORS.emp.light, colors.light, k * 3) };
      // BadaBot ne concentre pas l'énergie sur lui mais dans ses deux boucliers (GD-051)
      const shields = h.def.kind === 'BadaBot';
      p.chargeUnder.setVisible(!shields).setPosition(h.x, h.y).setScale(scale).setTint(tint.main);
      p.chargeTop.setVisible(!shields).setPosition(h.x, h.y).setScale(scale).setTint(tint.light);
      // le halo reste près du robot : une charge d'énergie, pas une lampe. Il apparaît au deuxième tiers du
      // lancement et s'étend un peu au troisième.
      const appear = Math.max(0, Math.min(1, k * 3 - 1));
      const spread = Math.max(0, Math.min(1, k * 3 - 2));
      p.glow.setVisible(appear > 0).setPosition(h.x, h.y)
        .setScale((0.6 + 0.28 * spread * spread * (3 - 2 * spread)) * (1 + 0.03 * Math.sin(scene.time.now / 45)))
        .setAlpha(0.3 * appear + 0.2 * spread);
      if (shields) this.drawShieldCharge(h, k, tint);
      else this.drawChargeArcs(h, k, tint);
    } else {
      p.glow?.setVisible(false);
      p.chargeUnder?.setVisible(false);
      p.chargeTop?.setVisible(false);
    }
    const leaping = h.ultiPhase === ULTI_ACTION && h.def.kind === 'BatBot';
    if (leaping) {
      const height = Math.sin(Math.PI * Math.min(1, h.ultiSteps / CONFIG.ulti.batBot.leapSteps));
      p.shadow ??= scene.add.ellipse(h.x, h.y, 170, 130, 0x000000).setDepth(DEPTH.legs - 1);
      p.shadow.setVisible(true).setPosition(h.x, h.y).setScale(1 - 0.45 * height).setAlpha(0.5 - 0.22 * height);
      p.body.setPosition(h.x, h.y - 150 * height).setScale(1 + 0.5 * height).setDepth(DEPTH.fx + 30);
      p.legs.setVisible(false);
      p.airborne = true;
    } else if (p.airborne) {
      p.airborne = false;
      p.shadow?.setVisible(false);
      p.body.setScale(1).setDepth(DEPTH.character);
    }
  }

  /** Hasard qui ne change que vingt fois par seconde : assez pour crépiter, sans scintiller à chaque image. */
  private flicker(h: Hero): () => number {
    let seed = (Math.floor(this.scene.time.now / 50) * 7919 + h.id * 104729) | 0;
    return (): number => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /**
   * Lancement de l'ulti de BadaBot (GD-051) : l'énergie monte de son corps vers ses deux boucliers au repos,
   * qui se mettent à luire et à crépiter. Sur les derniers steps, il les frappe l'un contre l'autre : les deux
   * lueurs se rejoignent devant lui, là où la vague va naître.
   */
  private drawShieldCharge(h: Hero, k: number, colors: { main: number; light: number }): void {
    const g = this.ultiArcs;
    const rand = this.flicker(h);
    const c = Math.cos(h.angle);
    const s = Math.sin(h.angle);
    const at = (lx: number, ly: number): { x: number; y: number } => ({ x: h.x + lx * c - ly * s, y: h.y + lx * s + ly * c });
    const slam = Math.max(0, Math.min(1, 1 - (CONFIG.ulti.castSteps - h.ultiSteps) / SLAM_STEPS));
    for (const side of [-1, 1]) {
      // le bouclier au repos est une lame courbe sur le flanc du robot ; à la frappe, il passe devant
      const core = at(-34 + 100 * slam, side * (72 - 50 * slam));
      // l'énergie monte du corps vers le bouclier, en zigzag
      const mid = at(-17 + 50 * slam + (rand() - 0.5) * 18, side * (36 - 25 * slam) + (rand() - 0.5) * 18);
      for (const pass of [0, 1]) {
        g.lineStyle(pass === 0 ? 3 + 4 * k : 1.5, pass === 0 ? colors.main : 0xffffff, (pass === 0 ? 0.3 : 0.6) * (0.4 + 0.6 * k));
        g.beginPath().moveTo(h.x, h.y).lineTo(mid.x, mid.y).lineTo(core.x, core.y).strokePath();
      }
      // la lueur du bouclier, de plus en plus grosse
      g.fillStyle(colors.main, 0.16 + 0.26 * k).fillCircle(core.x, core.y, 22 + 30 * k);
      g.fillStyle(colors.light, 0.25 + 0.45 * k).fillCircle(core.x, core.y, 9 + 13 * k);
      g.fillStyle(0xffffff, 0.2 + 0.6 * k).fillCircle(core.x, core.y, 3 + 6 * k);
      if (slam > 0) continue;
      // des arcs courent le long de la lame, de sa pointe arrière à sa pointe avant
      const count = 1 + Math.floor(k * 2.99);
      for (let n = 0; n < count; n++) {
        const blade = [at(-66, side * 30), at(-58, side * 56), at(-38, side * 78), at(-10, side * 90), at(14, side * 94)];
        for (const pass of [0, 1]) {
          g.lineStyle(pass === 0 ? 5 : 1.5, pass === 0 ? colors.main : 0xffffff, (pass === 0 ? 0.4 : 0.85) * (0.5 + 0.5 * k));
          g.beginPath();
          blade.forEach((p, j) => {
            const x = p.x + (rand() - 0.5) * 22;
            const y = p.y + (rand() - 0.5) * 22;
            if (j === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          });
          g.strokePath();
        }
      }
    }
  }

  /**
   * Lancement d'un ulti : des arcs électriques courent autour du robot, de plus en plus nombreux et de plus
   * en plus vifs à mesure que l'énergie monte (`k` de 0 à 1).
   */
  private drawChargeArcs(h: Hero, k: number, colors: { main: number; light: number }): void {
    const g = this.ultiArcs;
    const rand = this.flicker(h);
    const body = Math.max(62, h.def.radius * 1.15);
    const count = 1 + Math.floor(k * 2.99);
    for (let n = 0; n < count; n++) {
      // chaque arc part d'un point du contour et longe le robot en zigzag
      let angle = rand() * Math.PI * 2;
      const dir = rand() < 0.5 ? 1 : -1;
      const points: number[] = [];
      const bends = 4 + Math.floor(rand() * 3);
      for (let j = 0; j <= bends; j++) {
        // autour du robot, pas sur lui : il doit rester lisible
        const reach = body * (1.1 + rand() * (0.35 + 0.3 * k));
        points.push(h.x + Math.cos(angle) * reach, h.y + Math.sin(angle) * reach);
        angle += dir * (0.2 + rand() * 0.32);
      }
      // un halo à la couleur du robot, puis un cœur blanc
      for (const pass of [0, 1]) {
        g.lineStyle(pass === 0 ? 5 : 1.5, pass === 0 ? colors.main : 0xffffff, (pass === 0 ? 0.4 : 0.85) * (0.5 + 0.5 * k));
        g.beginPath();
        g.moveTo(points[0], points[1]);
        for (let j = 2; j < points.length; j += 2) g.lineTo(points[j], points[j + 1]);
        g.strokePath();
      }
    }
  }

  /**
   * Mini-bots de PetBot (GD-045, GD-046) : trois drones flottent près de lui, épaule gauche, épaule droite et
   * tête. Ils sortent un par un de la trappe de son coffre dorsal, le suivent avec un léger retard, et montent
   * et descendent doucement à l'arrêt. Ils volent au-dessus de lui : leur ombre se dessine sur PetBot quand
   * ils le survolent. Quand il lance sa salve, ce sont eux qui partent ; d'autres ressortent ensuite du coffre.
   *
   * Ulti (GD-047) : pendant le lancement ils se rassemblent en une ronde serrée autour de lui, puis chacun
   * part tourner sur son cercle tant que l'essaim soigne ; le cercle extérieur est le bord de la zone de soin.
   */
  private syncPets(h: Hero, p: HeroParts, dt: number, present: boolean): void {
    const anchors = petAnchors(h);
    if (!p.pets) {
      p.pets = anchors.map((a) => ({
        // l'ombre est au-dessus du corps des robots et sous les mini-bots
        shadow: this.image('spr_PetDrone', 0, a.x, a.y, DEPTH.character + 2.5).setTintFill(0x000000),
        img: this.image('spr_PetDrone', 0, a.x, a.y, DEPTH.character + 3),
        x: a.x, y: a.y, angle: h.angle, mode: 'follow' as const, modeTime: 0, fromX: 0, fromY: 0,
      }));
    }
    // partis en salve : la simulation les fait voler comme des drones, on ne les dessine plus ici
    const home = present && this.world.drones.length === 0;
    p.petsHome = home ? p.petsHome + dt : 0;
    const now = this.scene.time.now / 1000;
    const pull = 1 - Math.exp(-dt / PETS.followSeconds);
    const c = Math.cos(h.angle);
    const s = Math.sin(h.angle);
    const local = (lx: number, ly: number): { x: number; y: number } => ({ x: h.x + lx * c - ly * s, y: h.y + lx * s + ly * c });
    const hatch = local(PETS.hatch.x, PETS.hatch.y);

    const swarm = home ? petSwarm(this.world, h) : undefined;
    const mode: Pet['mode'] = swarm ? 'ring' : home && h.ultiPhase === ULTI_CAST ? 'gather' : 'follow';
    // l'horloge de la ronde est celle du jeu : tous les joueurs voient les mini-bots au même endroit. Elle est
    // lissée, pour que des mini-bots aussi rapides ne saccadent pas entre deux pas de simulation.
    const clock = (swarm ? swarm.steps : h.ultiSteps) / STEPS_PER_SECOND;
    p.spinTime += dt;
    if (Math.abs(clock - p.spinTime) > 0.2) p.spinTime = clock;
    else p.spinTime += (clock - p.spinTime) * 0.1;
    const spin = p.spinTime;
    // la ronde ne colle pas à PetBot : son centre le rattrape avec le même retard que les mini-bots à ses
    // côtés, pour qu'elle traîne un peu derrière lui quand il bouge (GD-050)
    if (mode === 'follow') {
      p.swarmX = h.x;
      p.swarmY = h.y;
    } else {
      p.swarmX += (h.x - p.swarmX) * pull;
      p.swarmY += (h.y - p.swarmY) * pull;
    }
    const cx = p.swarmX;
    const cy = p.swarmY;
    const orbit = PETS.orbit;
    const colors = ULTI_COLORS.PetBot;
    p.petTrails?.clear();
    if (mode !== 'follow') p.petTrails ??= this.scene.add.graphics().setDepth(DEPTH.fx + 2).setBlendMode(Phaser.BlendModes.ADD);
    // l'essaim s'efface dans sa dernière demi-seconde ; la ronde du lancement s'allume en prenant de la vitesse
    const left = swarm ? Math.max(0, swarm.total / STEPS_PER_SECOND - spin) : 0;
    const glow = swarm ? Math.min(1, left / 0.5) : Math.min(1, spin / 1.2);
    // à la fin, les mini-bots resserrent leur ronde en spirale avant de regagner leur place
    const closing = swarm ? 1 - Math.min(1, left / orbit.join) : 0;
    const closed = closing * closing * (3 - 2 * closing);

    p.pets.forEach((pet, i) => {
      // sortie de la trappe, l'un après l'autre : 0 = encore dans le coffre, 1 = arrivé à sa place
      const out = Math.max(0, Math.min(1, (p.petsHome - i * PETS.stagger) / PETS.emerge));
      const visible = home && out > 0;
      pet.img.setVisible(visible);
      pet.shadow.setVisible(visible);
      if (!visible) {
        pet.mode = 'follow';
        return;
      }
      let size = 1;
      if (out < 1) {
        // il jaillit de la trappe en passant au-dessus du crâne, puis rejoint sa place en grandissant
        const e = 1 - (1 - out) ** 2;
        const skull = local(8, 0);
        pet.x = (1 - e) ** 2 * hatch.x + 2 * e * (1 - e) * skull.x + e * e * anchors[i].x;
        pet.y = (1 - e) ** 2 * hatch.y + 2 * e * (1 - e) * skull.y + e * e * anchors[i].y;
        pet.angle = h.angle;
        pet.mode = 'follow';
        size = 0.25 + 0.75 * e;
      } else {
        if (pet.mode !== mode) {
          pet.mode = mode;
          pet.modeTime = 0;
          pet.fromX = pet.x - cx;
          pet.fromY = pet.y - cy;
        }
        pet.modeTime += dt;
        if (mode === 'follow') {
          pet.x += (anchors[i].x - pet.x) * pull;
          pet.y += (anchors[i].y - pet.y) * pull;
          pet.angle += angleDiff(pet.angle, h.angle) * pull;
        } else {
          const ring = orbit.rings[i];
          // lancement : tous dans le même sens, de plus en plus vite ; ensuite chacun son cercle et son sens
          const dir = swarm ? ring.dir : 1;
          const circle = swarm ? swarm.radius * ring.radius : orbit.gather;
          const radius = circle + (orbit.gather - circle) * closed;
          const turn = (i * Math.PI * 2) / 3 + (swarm ? (dir * Math.PI * 2 * spin) / ring.period : 2.4 * spin * spin);
          // il quitte en spirale l'endroit où il se trouvait pour rejoindre son cercle
          const t = Math.min(1, pet.modeTime / orbit.join);
          const k = t * t * (3 - 2 * t);
          pet.x = cx + pet.fromX + (Math.cos(turn) * radius - pet.fromX) * k;
          pet.y = cy + pet.fromY + (Math.sin(turn) * radius - pet.fromY) * k;
          // le nez dans le sens de la marche
          pet.angle += angleDiff(pet.angle, turn + (dir * Math.PI) / 2) * (k < 1 ? pull : 1);
          const strength = k * k * glow;
          if (swarm) {
            // son cercle entier, discret ; le plus grand, plus marqué, est le bord de la zone de soin
            p.petTrails!.lineStyle(i === 2 ? 3 : 2, colors.main, (i === 2 ? 0.42 : 0.22) * strength);
            p.petTrails!.strokeCircle(cx, cy, circle);
          }
          this.drawPetTrail(p.petTrails!, cx, cy, radius, turn, dir, strength, colors);
        }
      }
      // flottement : chacun à son rythme, pour qu'ils ne paraissent jamais figés
      const lift = Math.sin(now * 2.4 + i * 2.1);
      const scale = PETS.scale * size * (1 + PETS.bob * lift);
      pet.img.setPosition(pet.x, pet.y - 4 * lift).setRotation(pet.angle).setScale(scale);
      // l'ombre a la taille du mini-bot ; elle s'en écarte un peu plus quand il monte
      pet.shadow.setPosition(pet.x + (9 + 3 * lift) * size, pet.y + (13 + 4 * lift) * size).setRotation(pet.angle)
        .setScale(PETS.scale * size).setAlpha(0.3 - 0.05 * lift);
    });
  }

  /** Sillage d'un mini-bot en orbite : une traînée lumineuse derrière lui, qui s'amincit et s'éteint. */
  private drawPetTrail(
    g: Phaser.GameObjects.Graphics, cx: number, cy: number, radius: number, turn: number, dir: number, strength: number,
    colors: { main: number; light: number },
  ): void {
    if (strength <= 0.01) return;
    const span = Math.min(2.6, PETS.orbit.tail / radius);
    const pieces = 14;
    for (let j = 0; j < pieces; j++) {
      const a0 = turn - dir * span * (j / pieces);
      const a1 = turn - dir * span * ((j + 1) / pieces);
      const q = 1 - j / pieces;
      g.lineStyle(1.5 + 6 * q, j < 3 ? colors.light : colors.main, 0.7 * q * q * strength);
      g.beginPath();
      g.arc(cx, cy, radius, Math.min(a0, a1), Math.max(a0, a1));
      g.strokePath();
    }
  }

  /** Nom du joueur au-dessus d'un coéquipier. */
  private syncTag(h: Hero, p: HeroParts, show: boolean): void {
    if (!show) {
      p.tag?.setVisible(false);
      return;
    }
    p.tag ??= this.scene.add.text(h.x, h.y, '', { fontFamily: 'Aldo', fontSize: '26px', color: '#9fe8ff', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5, 1).setDepth(DEPTH.worldText);
    const name = this.playerNames[h.id] ?? h.def.name;
    const dead = h.state === 'dead';
    p.tag.setVisible(true).setPosition(h.x, h.y - h.def.radius - 40).setText(dead ? `${name} - DOWN` : name).setColor(dead ? '#ff6b6b' : '#9fe8ff');
  }

  /** Bornes de recharge : zone d'action visible à l'approche, arc électrique pendant la recharge (GD-022). */
  private drawOutlets(): void {
    const h = this.world.hero;
    const range = CONFIG.outlet.range;
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now / 300);
    for (const outlet of this.world.outlets) {
      const d = Math.hypot(outlet.x - h.x, outlet.y - h.y);
      const empty = outlet.energyLeft === 0 && outlet.repairLeft === 0;
      if (empty) continue;
      // réserve de la borne : arc bleu pour l'énergie, arc vert pour les réparations
      if (d < range * 2.5) {
        const TAU = Math.PI * 2;
        this.cable.lineStyle(5, 0x7fd9ff, 0.9).beginPath();
        this.cable.arc(outlet.x, outlet.y, 52, -Math.PI / 2, -Math.PI / 2 + TAU * (outlet.energyLeft / this.world.outletCapacity));
        this.cable.strokePath();
        this.cable.lineStyle(5, 0x5dff7a, 0.9).beginPath();
        this.cable.arc(outlet.x, outlet.y, 60, -Math.PI / 2, -Math.PI / 2 + TAU * (outlet.repairLeft / CONFIG.outlet.repairCapacity));
        this.cable.strokePath();
      }
      if (outlet.inUse) {
        // un arc vers chaque robot relié à cette borne
        for (const other of this.world.heroes) {
          if (!other.gone && other.charging && other.linkedOutlet === outlet.id) this.drawEnergyLink(outlet.x, outlet.y, other.x, other.y, OUTLET_BEAM, 1);
        }
        this.cable.lineStyle(3, 0x7fd9ff, 0.35 + 0.25 * pulse).strokeCircle(outlet.x, outlet.y, range);
      } else if (d < range * 2.5) {
        const inside = d <= range;
        this.cable.lineStyle(inside ? 3 : 2, inside ? 0xffe36b : 0x7fd9ff, (inside ? 0.35 : 0.12) + 0.15 * pulse).strokeCircle(outlet.x, outlet.y, range);
      }
    }
  }

  /** Arc électrique entre deux points : plusieurs brins en zigzag, redessinés à chaque image. */
  /**
   * Arc d'énergie entre deux points, redessiné à chaque image. `strength` (0 à 1) : à 1 l'arc est dense et
   * tendu ; plus bas il s'amincit, ondule davantage et se troue, comme un lien qui se distend.
   */
  private drawEnergyLink(x1: number, y1: number, x2: number, y2: number, strands: BeamStrand[], strength: number): void {
    const g = this.cable;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const segments = Math.max(4, Math.round(len / 28));
    const slack = Math.max(0, Math.min(1, (1 - strength) / 0.4));
    for (const s of strands) {
      g.lineStyle(s.width * (1 - 0.55 * slack), s.color, s.alpha * (1 - 0.45 * slack));
      g.beginPath();
      g.moveTo(x1, y1);
      for (let i = 1; i <= segments; i++) {
        const t = i / segments;
        // amplitude nulle aux extrémités, maximale au milieu
        const off = i === segments ? 0 : (Math.random() - 0.5) * 2 * s.jitter * (1 + 2.2 * slack) * Math.sin(Math.PI * t);
        const px = x1 + dx * t + nx * off;
        const py = y1 + dy * t + ny * off;
        // lien distendu : des tronçons manquent
        if (Math.random() < 0.3 * slack) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
    const tint = strands[1].color;
    const glow = (14 + Math.random() * 8) * (1 - 0.4 * slack);
    g.fillStyle(tint, 0.35).fillCircle(x1, y1, glow + 8).fillCircle(x2, y2, glow + 14);
    g.fillStyle(0xffffff, 0.8).fillCircle(x1, y1, glow * 0.4).fillCircle(x2, y2, glow * 0.5);
  }

  private npcFrame(npc: Npc): { sprite: string; frame: number } {
    const def = npc.def;
    if (def.kind === 'boss') {
      const boss = this.world.boss;
      if (!boss) return { sprite: def.sprites.stand, frame: 0 };
      const frames = this.info(boss.sprite).frames;
      if (boss.action === 'walking') return { sprite: boss.sprite, frame: ((npc.walkDist / 256) * frames) % frames };
      if (boss.action === 'idle') return { sprite: boss.sprite, frame: 0 };
      return { sprite: boss.sprite, frame: Math.min(frames - 1, (boss.anim / boss.animSteps) * frames) };
    }
    if (def.kind === 'civil') {
      if (npc.state === 'running') {
        const frames = this.info(def.sprites.run).frames;
        return { sprite: def.sprites.run, frame: ((npc.walkDist / 96) * frames) % frames };
      }
      if (npc.state === 'walking') {
        const frames = this.info(def.sprites.move).frames;
        return { sprite: def.sprites.move, frame: ((npc.walkDist / 128) * frames) % frames };
      }
      return { sprite: def.sprites.stand, frame: 0 };
    }
    if (npc.state === 'firing' || npc.state === 'delay_firing') {
      const frames = this.info(def.sprites.shot).frames;
      const period = STEPS_PER_SECOND / def.shotsPerSecond;
      return { sprite: def.sprites.shot, frame: Math.min(frames - 1, (npc.stateSteps / period) * frames) };
    }
    if (npc.state === 'reloading' && def.sprites.reload) {
      const frames = this.info(def.sprites.reload).frames;
      const done = 1 - npc.reloadTimer / Math.max(1, def.reloadSteps);
      return { sprite: def.sprites.reload, frame: Math.min(frames - 1, done * frames) };
    }
    if (npc.state === 'walking' || npc.state === 'chasing') {
      const frames = this.info(def.sprites.move).frames;
      return { sprite: def.sprites.move, frame: ((npc.walkDist / 128) * frames) % frames };
    }
    return { sprite: def.sprites.stand, frame: 0 };
  }

  private syncNpcs(): void {
    const alive = new Set<number>();
    for (const npc of this.world.npcs) {
      alive.add(npc.id);
      const { sprite, frame } = this.npcFrame(npc);
      let img = this.npcImgs.get(npc.id);
      if (!img) {
        img = this.image(sprite, frame, npc.x, npc.y, DEPTH.character);
        this.npcImgs.set(npc.id, img);
      }
      this.setFrame(img, sprite, frame);
      img.setPosition(npc.x, npc.y).setRotation(npc.angle);
    }
    for (const [id, img] of this.npcImgs) {
      if (!alive.has(id)) {
        img.destroy();
        this.npcImgs.delete(id);
      }
    }
  }

  private syncBullets(): void {
    const alive = new Set<number>();
    const g = this.tracers;
    g.clear();
    this.shotLights.clear();
    const dt = Math.min(0.05, this.scene.game.loop.delta / 1000);
    for (const b of this.world.bullets) {
      alive.add(b.id);
      // prototype (GD-064) : un trait de lumière, sauf pour la boule de plasma de BadaBot
      if (TRACERS.enabled && b.def.kind !== 'plasma') {
        this.syncStreak(b);
        continue;
      }
      let img = this.bulletImgs.get(b.id);
      if (!img) {
        img = this.image(b.def.sprite, 0, b.x, b.y, DEPTH.bullet).setScale(b.def.scale ?? (b.owner === 'enemy' ? BULLET_STYLE.enemyScale : BULLET_STYLE.heroScale));
        this.bulletImgs.set(b.id, img);
      }
      img.setPosition(b.x, b.y).setRotation(b.angle);
      if (b.def.kind === 'bounce') this.setFrame(img, b.def.sprite, (b.steps / 7) % this.info(b.def.sprite).frames);
      // traînée lumineuse : les balles d'origine, petites et grises, se perdaient sur le sol (GD-022)
      const style = b.owner === 'enemy' ? BULLET_STYLE.enemy : BULLET_STYLE.hero;
      const travelled = Math.hypot(b.x - b.startX, b.y - b.startY);
      // sa longueur suit la vitesse de la balle : celle d'EngiBot, qui ralentit, voit sa traînée raccourcir (GD-062)
      const len = Math.min(style.length * Math.min(1, b.speed / b.def.speed), travelled);
      const tx = b.x - Math.cos(b.angle) * len;
      const ty = b.y - Math.sin(b.angle) * len;
      g.lineStyle(style.width * 2.4, style.glow, 0.3).lineBetween(tx, ty, b.x, b.y);
      g.lineStyle(style.width, style.core, 0.95).lineBetween(b.x - Math.cos(b.angle) * len * 0.6, b.y - Math.sin(b.angle) * len * 0.6, b.x, b.y);
      g.fillStyle(style.core, 1).fillCircle(b.x, b.y, style.width * 0.9);
    }
    for (const [id, img] of this.bulletImgs) {
      if (!alive.has(id)) {
        img.destroy();
        this.bulletImgs.delete(id);
      }
    }
    // la balle a disparu : son trait file jusqu'à l'obstacle, puis s'efface
    for (const [id, streak] of this.streaks) {
      if (alive.has(id)) continue;
      this.endStreak(streak);
      this.streaks.delete(id);
    }
    for (let i = this.afterglows.length - 1; i >= 0; i--) {
      const a = this.afterglows[i];
      a.life -= dt / TRACER_STYLE.fade;
      if (a.life <= 0) this.afterglows.splice(i, 1);
      else this.drawStreak(a.x0, a.y0, a.x1, a.y1, a.enemy, a.life * a.life, false, a.heat);
    }
    const blast = TRACER_STYLE.blast;
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.age += dt;
      // pleine force un instant, puis extinction exponentielle : vive au début, de plus en plus lente
      const k = f.age < blast.hold ? 1 : Math.exp(-(f.age - blast.hold) / blast.decay);
      if (k >= 0.03) this.drawMuzzleFlash(f, k);
      // la flamme faiblit : la fumée prend sa place
      if (!f.smoked && k < TRACER_STYLE.smoke.at) {
        f.smoked = true;
        this.addSmoke(f, k);
      }
      if (k < 0.03) {
        f.light.destroy();
        this.flashes.splice(i, 1);
      }
    }
    this.syncSmoke(dt);
  }

  /** La fumée d'un tir : quelques bouffées étalées là où brûlait la flamme, lancées vers l'avant. */
  private addSmoke(f: MuzzleFlash, k: number): void {
    const smoke = TRACER_STYLE.smoke;
    const size = TRACER_STYLE.blast.size;
    const { keys } = this.smokeTextures();
    // la base de la flamme à cet instant : elle a déjà un peu avancé
    const lift = TRACER_STYLE.blast.drift * size * (1 - k);
    for (let i = 0; i < smoke.puffs; i++) {
      // les bouffées s'échelonnent du canon vers l'avant ; les plus lointaines sont les plus rapides
      const t = (i + Math.random() * 0.6) / smoke.puffs;
      const angle = f.angle + (Math.random() - 0.5) * 0.3;
      const along = lift + 6 + t * smoke.spread * size;
      const across = (Math.random() - 0.5) * 12;
      const x = f.x + Math.cos(f.angle) * along - Math.sin(f.angle) * across;
      const y = f.y + Math.sin(f.angle) * along + Math.cos(f.angle) * across;
      const speed = smoke.speed * size * (0.6 + 0.7 * t) * (0.85 + Math.random() * 0.3);
      const img = this.scene.add.image(x, y, keys[Math.floor(Math.random() * keys.length)])
        .setDepth(DEPTH.bullet + 0.5).setAlpha(0).setRotation(f.angle + (Math.random() - 0.5) * 1.2 + (Math.random() < 0.5 ? Math.PI : 0));
      this.smokes.push({
        img, x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, age: 0,
        life: smoke.life * (0.8 + Math.random() * 0.4), radius: smoke.radius * size * (0.75 + Math.random() * 0.5),
        peak: smoke.thin + Math.random() * (smoke.alpha - smoke.thin), spin: (Math.random() < 0.5 ? -1 : 1) * smoke.spin * (0.4 + Math.random() * 0.6),
      });
    }
  }

  /** Fait vivre la fumée des tirs : elle avance en ralentissant, gonfle, tourne, refroidit et s'efface. */
  private syncSmoke(dt: number): void {
    const smoke = TRACER_STYLE.smoke;
    const { reach } = this.smokeTextures();
    const slow = Math.exp(-smoke.drag * dt);
    for (let i = this.smokes.length - 1; i >= 0; i--) {
      const p = this.smokes[i];
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) {
        p.img.destroy();
        this.smokes.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= slow;
      p.vy *= slow;
      // elle gonfle vite puis de moins en moins ; elle apparaît d'un coup, reste pleine un moment, puis s'efface
      const swell = 1 + (smoke.grow - 1) * (1 - (1 - t) * (1 - t));
      const fade = t < smoke.hold ? 1 : Math.pow(1 - (t - smoke.hold) / (1 - smoke.hold), 1.3);
      p.img.setPosition(p.x, p.y).setScale((p.radius * swell) / reach).setRotation(p.img.rotation + p.spin * dt)
        .setAlpha(p.peak * Math.min(1, p.age / 0.03) * fade)
        .setTint(mixColor(smoke.cold, smoke.hot, Math.max(0, 1 - t * 3)));
    }
  }

  /**
   * Bouffées de fumée, dessinées comme le brouillard du jeu (`spr_fog`) : des nappes en aplats, sans contour,
   * aux bords bosselés, faites de ronds qui se touchent, plus longues que hautes. Chacune superpose trois
   * nappes à demi transparentes : là où elles se recouvrent la fumée est plus dense, ce qui donne plusieurs
   * tons francs. Elles sont blanches, à teinter. `reach` : demi-longueur d'une bouffée dans son image.
   */
  private smokeTextures(): { keys: string[]; reach: number } {
    const reach = 58;
    const keys = [0, 1, 2, 3].map((i) => `shotSmoke${i}`);
    if (this.scene.textures.exists(keys[0])) return { keys, reach };
    // un tirage fixe : les mêmes nappes à chaque partie
    let seed = 20261117;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const centre = 64;
    for (const key of keys) {
      const canvas = this.scene.textures.createCanvas(key, 128, 128);
      if (!canvas) continue;
      const ctx = canvas.context;
      /** Une nappe : un ou deux gros ronds et un chapelet de petits, étirés sur `half` pixels de part et d'autre. */
      const sheet = (half: number, thick: number, dx: number, dy: number): void => {
        ctx.beginPath();
        const round = (x: number, y: number, r: number): void => {
          // rien ne sort de l'image
          const cx = Math.max(r + 2, Math.min(126 - r, centre + dx + x));
          const cy = Math.max(r + 2, Math.min(126 - r, centre + dy + y));
          ctx.moveTo(cx + r, cy);
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
        };
        const big = 1 + Math.floor(random() * 2);
        for (let i = 0; i < big; i++) round((random() - 0.5) * half, (random() - 0.5) * thick * 0.4, thick * (0.75 + random() * 0.35));
        const small = 7 + Math.floor(random() * 4);
        for (let i = 0; i < small; i++) {
          const u = (i + random() * 0.8) / small;
          const r = thick * (0.35 + random() * 0.4);
          round((u * 2 - 1) * (half - r), (random() - 0.5) * thick * 0.9, r);
        }
        ctx.fill();
      };
      ctx.fillStyle = 'rgba(255,255,255,0.66)';
      sheet(reach - 4, 22, 0, 0);
      sheet(reach * 0.72, 17, (random() - 0.5) * 22, (random() - 0.5) * 18);
      sheet(reach * 0.5, 13, (random() - 0.5) * 34, (random() - 0.5) * 22);
      canvas.refresh();
    }
    return { keys, reach };
  }

  /**
   * Prototype (GD-064) : la balle est un projectile entouré de lumière. Sa traînée part de la balle et remonte
   * sa ligne droite, sans jamais dépasser son point de départ ni son dernier ricochet : après un rebond,
   * l'ancien trait s'efface sur place et un nouveau repart du mur. En refroidissant, la traînée vire au gris et
   * la balle elle-même apparaît.
   */
  private syncStreak(b: Bullet): void {
    let streak = this.streaks.get(b.id);
    const enemy = b.owner === 'enemy';
    if (!streak) {
      streak = { fromX: b.startX, fromY: b.startY, angle: b.angle, tailX: b.startX, tailY: b.startY, headX: b.x, headY: b.y, speed: b.speed, heat: 1, enemy, done: false };
      this.streaks.set(b.id, streak);
      // une balle qui vient de partir : déflagration à la bouche du canon (pas pour celles qu'on découvre déjà en vol)
      if (b.steps <= 8) this.addMuzzleFlash(b, enemy);
    }
    let img = this.bulletImgs.get(b.id);
    if (!img) {
      // la balle a l'épaisseur de sa traînée en tête : elle en est le bout, pas un objet plus gros posé dessus
      const box = this.info(b.def.sprite).bbox;
      img = this.image(b.def.sprite, 0, b.x, b.y, DEPTH.bullet).setScale(TRACER_STYLE.width / Math.max(1, box[3] - box[1] + 1));
      this.bulletImgs.set(b.id, img);
    }
    if (streak.done || b.spent) {
      // côté client d'une partie réseau : elle a atteint un mur et attend que le serveur la retire
      img.setVisible(false);
      if (!streak.done) this.endStreak(streak);
      streak.done = true;
      return;
    }
    if (Math.abs(angleDiff(streak.angle, b.angle)) > 0.02) {
      // ricochet (ou balle renvoyée) : l'ancien trait va jusqu'au point de rebond et s'efface
      this.afterglows.push({ x0: streak.tailX, y0: streak.tailY, x1: b.x, y1: b.y, heat: streak.heat, enemy: streak.enemy, life: 1 });
      streak.fromX = b.x;
      streak.fromY = b.y;
      streak.angle = b.angle;
      streak.enemy = enemy;
    }
    // la chaleur baisse avec le chemin parcouru : la balle sort du canon chauffée à blanc, puis s'éteint
    const flown = b.steps * b.def.speed;
    streak.heat = Math.max(0, Math.min(1, 1 - (flown - TRACER_STYLE.hotUntil) / (TRACER_STYLE.coldAt - TRACER_STYLE.hotUntil)));
    // une balle ralentie traîne un trait plus court (GD-062)
    const len = Math.min(TRACER_STYLE.length * Math.min(1, b.speed / b.def.speed), Math.hypot(b.x - streak.fromX, b.y - streak.fromY));
    streak.headX = b.x;
    streak.headY = b.y;
    streak.tailX = b.x - Math.cos(b.angle) * len;
    streak.tailY = b.y - Math.sin(b.angle) * len;
    streak.speed = b.speed;
    this.drawStreak(streak.tailX, streak.tailY, b.x, b.y, streak.enemy, 1, true, streak.heat);
    // refroidie, on voit la balle elle-même
    img.setVisible(streak.heat < 0.98).setAlpha(1 - streak.heat).setPosition(b.x, b.y).setRotation(b.angle);
    if (b.def.kind === 'bounce') this.setFrame(img, b.def.sprite, (b.steps / 7) % this.info(b.def.sprite).frames);
  }

  /** La balle vient de disparaître : son trait est prolongé jusqu'au mur qu'elle a touché, puis laissé à s'effacer. */
  private endStreak(streak: Streak): void {
    if (streak.done) return;
    const c = Math.cos(streak.angle);
    const s = Math.sin(streak.angle);
    // entre deux images, elle a encore avancé : jusqu'au premier obstacle, d'un step au plus
    const hit = this.world.collision.raycast(streak.headX, streak.headY, streak.headX + c * streak.speed, streak.headY + s * streak.speed, BLOCK_BULLET);
    const reach = streak.speed * (hit ? hit.t : 0.5);
    this.afterglows.push({ x0: streak.tailX, y0: streak.tailY, x1: streak.headX + c * reach, y1: streak.headY + s * reach, heat: streak.heat, enemy: streak.enemy, life: 1 });
  }

  /**
   * La traînée d'une balle, de sa queue à sa tête : une étoile filante. C'est une aiguille pleine, d'une seule
   * couleur, aux bords francs : large en tête, elle s'effile jusqu'à la queue, où elle pâlit. Aucun halo, ni le
   * long du trait ni autour de la balle : c'est ce qui la rend nette. Chaude (`heat` à 1) elle est d'un jaune
   * franc, avec une pointe chauffée à blanc en tête ; en refroidissant elle s'amincit, pâlit et vire au gris.
   */
  private drawStreak(x0: number, y0: number, x1: number, y1: number, enemy: boolean, alpha: number, head: boolean, heat: number): void {
    const length = Math.hypot(x1 - x0, y1 - y0);
    if (length < 1) return;
    const g = this.tracers;
    const shape = TRACER_STYLE.streak;
    const body = mixColor(TRACER_STYLE.cold, (enemy ? TRACER_STYLE.enemy : TRACER_STYLE.hero).trail, heat);
    const tip = mixColor(0xc4c8ce, 0xffffff, heat);
    const half = (TRACER_STYLE.width * (0.4 + 0.6 * heat)) / 2;
    const strength = alpha * (0.5 + 0.5 * heat);
    const ux = (x1 - x0) / length;
    const uy = (y1 - y0) / length;
    /** Point à la fraction `t` du trait (0 : la queue, 1 : la tête), écarté de `across` pixels de son axe. */
    const at = (t: number, across: number): Phaser.Geom.Point =>
      new Phaser.Geom.Point(x0 + ux * length * t - uy * across, y0 + uy * length * t + ux * across);
    /** Demi-largeur du trait : elle croît de la queue à la tête, sans jamais passer sous le pixel. */
    const girth = (t: number): number => Math.max(0.75, half * (shape.tail + (1 - shape.tail) * t));
    for (let k = 0; k < shape.pieces; k++) {
      const t0 = k / shape.pieces;
      const t1 = (k + 1) / shape.pieces;
      // pleine couleur sur tout l'avant ; seul le bout de la queue pâlit
      g.fillStyle(body, Math.min(1, t1 / shape.fadeOver) * strength);
      g.fillPoints([at(t0, girth(t0)), at(t1, girth(t1)), at(t1, -girth(t1)), at(t0, -girth(t0))], true);
    }
    // la tête, chauffée à blanc : une pointe claire tournée vers l'arrière
    const white = girth(1) * 0.5;
    g.fillStyle(tip, strength).fillPoints([at(1 - shape.white, 0), at(1, white), at(1, -white)], true);
    if (head) {
      // le bout arrondi : la balle
      g.fillStyle(body, strength).fillCircle(x1, y1, girth(1));
      g.fillStyle(tip, strength).fillCircle(x1, y1, white);
    }
  }

  /**
   * Le canon d'où sort une balle qui vient d'être tirée : une fonction qui redonne, à chaque image, la place
   * du bout de ce canon et sa direction (`null` une fois le tireur disparu). `null` si l'on ne retrouve pas le
   * tireur : la flamme reste alors au point de départ de la balle.
   */
  private gunOf(b: Bullet): Gun | null {
    const near = (x: number, y: number): number => Math.hypot(x - b.startX, y - b.startY);
    if (b.owner === 'hero') {
      const id = b.ownerId;
      const hero = this.world.heroes.find((h) => h.id === id);
      if (hero && near(hero.x, hero.y) < 250) {
        const tip = GUN_TIPS[hero.def.sprites.shot] ?? hero.def.muzzle;
        return () => {
          const h = this.world.heroes.find((o) => o.id === id);
          return h && h.state !== 'dead' ? { ...localToWorld(h.x, h.y, h.angle, tip.x, tip.y), angle: h.angle } : null;
        };
      }
      // une balle de héros sans tireur : la tourelle d'EngiBot
      const turret = this.world.turret;
      if (!turret || near(turret.x, turret.y) > 150) return null;
      return () => {
        const t = this.world.turret;
        if (!t) return null;
        const reach = TURRET_TIPS.x[t.level - 1] ?? CONFIG.abilities.engiBot.turretMuzzle;
        return { ...localToWorld(t.x, t.y, t.angle, reach, TURRET_TIPS.y), angle: t.angle };
      };
    }
    // une balle ennemie ne dit pas qui l'a tirée : c'est le soldat dont le canon est le plus près de son départ
    let shooter: Npc | null = null;
    let closest = 120;
    for (const npc of this.world.npcs) {
      const def = npc.def;
      if (def.kind !== 'soldier' || !def.bullet) continue;
      const m = localToWorld(npc.x, npc.y, npc.angle, def.muzzle.x, def.muzzle.y);
      const d = near(m.x, m.y);
      if (d < closest) {
        shooter = npc;
        closest = d;
      }
    }
    if (!shooter || shooter.def.kind !== 'soldier') return null;
    const id = shooter.id;
    const tip = GUN_TIPS[shooter.def.sprites.shot] ?? shooter.def.muzzle;
    return () => {
      const npc = this.world.npcs.find((o) => o.id === id);
      return npc ? { ...localToWorld(npc.x, npc.y, npc.angle, tip.x, tip.y), angle: npc.angle } : null;
    };
  }

  /**
   * Déflagration à la bouche du canon qui vient de tirer la balle `b`. Elle naît au bout du canon tel qu'il
   * est dessiné, pas au point de départ de la balle. Une salve de plusieurs plombs (ShotBot) n'en fait qu'une.
   */
  private addMuzzleFlash(b: Bullet, enemy: boolean): void {
    const gun = this.gunOf(b);
    const now = gun?.() ?? null;
    const x = now ? now.x : b.startX;
    const y = now ? now.y : b.startY;
    const angle = b.angle;
    const turn = now ? angleDiff(now.angle, b.angle) : 0;
    if (this.flashes.some((f) => f.age < 0.03 && Math.abs(f.x - x) < 6 && Math.abs(f.y - y) < 6)) return;
    const blast = TRACER_STYLE.blast;
    const cone = this.muzzleLightTexture();
    // la lueur est posée au-dessus de l'ombre de la salle : elle éclaire aussi un lieu sombre. Elle part de la
    // bouche du canon et porte vers l'avant.
    const light = this.scene.add.image(x, y, cone.key).setOrigin(cone.focusX, 0.5).setRotation(angle)
      .setBlendMode(Phaser.BlendModes.ADD).setTint((enemy ? TRACER_STYLE.enemy : TRACER_STYLE.hero).glow)
      .setScale((blast.light * blast.size) / cone.reach).setDepth(DEPTH.darkness + 1);
    // la gerbe est tirée au sort une fois : elle garde sa forme pendant qu'elle s'éteint
    const rays = Array.from({ length: blast.rays }, (_, i) => {
      // un grand rayon dans l'axe, les autres plus courts à mesure qu'ils s'en écartent
      const offset = i === 0 ? (Math.random() - 0.5) * 0.06 : (Math.random() * 2 - 1) * blast.spread;
      const side = 1 - Math.abs(offset) / blast.spread;
      return { offset, length: i === 0 ? 1.45 + Math.random() * 0.25 : 0.4 + 0.75 * side * (0.6 + Math.random() * 0.6), width: (i === 0 ? 7 : 3 + Math.random() * 3.5) * blast.size };
    });
    const sparks = Array.from({ length: 7 }, () => ({
      offset: (Math.random() * 2 - 1) * blast.spread * 1.5,
      from: (30 + Math.random() * 110) * blast.size, speed: (500 + Math.random() * 900) * blast.size, size: (6 + Math.random() * 10) * blast.size,
    }));
    this.flashes.push({ x, y, angle, gun, turn, smoked: false, enemy, age: 0, light, rays, sparks });
  }

  /**
   * Lueur d'un tir : un cône de lumière dessiné vers la droite, très vif à la bouche du canon, qui s'éteint
   * vers l'avant et sur les côtés, et ne déborde presque pas vers l'arrière. `focusX` : place de la bouche du
   * canon dans l'image ; `reach` : pixels de l'image entre la bouche et le bout de la lueur.
   */
  private muzzleLightTexture(): { key: string; focusX: number; reach: number } {
    const key = 'muzzleLight';
    const width = 256;
    const height = 128;
    const focus = 22;
    const centre = 132;
    const radius = 122;
    if (!this.scene.textures.exists(key)) {
      const canvas = this.scene.textures.createCanvas(key, width, height);
      if (canvas) {
        const ctx = canvas.context;
        ctx.save();
        // un dégradé rond dont le foyer est décalé vers l'arrière : il rayonne surtout vers l'avant ; on l'aplatit
        ctx.translate(0, height / 2);
        ctx.scale(1, 0.5);
        const gradient = ctx.createRadialGradient(focus, 0, 0, centre, 0, radius);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.18, 'rgba(255,255,255,0.85)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.35)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, -height, width, height * 2);
        ctx.restore();
        canvas.refresh();
      }
    }
    // l'image est accrochée par son bord arrière : rien ne dépasse derrière la bouche du canon
    return { key, focusX: (centre - radius) / width, reach: radius * 2 };
  }

  /**
   * La déflagration à la force `k` (1 à l'instant du tir, puis vers 0) : une flamme. Son corps est une langue
   * de feu effilée ; des pointes plus fines en jaillissent, une grande dans l'axe et de plus courtes autour ; un
   * cœur chauffé à blanc, quelques étincelles projetées vers l'avant, et la lueur jetée sur le décor.
   * Elle naît exactement à la bouche du canon, sans jamais le recouvrir. Elle doit se lire comme sortant du
   * canon : pendant qu'elle s'estompe, toute la flamme avance, de sa base à ses pointes, sans changer de
   * longueur, et tout pâlit en même temps. Immobile, elle paraissait rentrer dans le canon : ses pointes, fines
   * et pâles, disparaissent à l'œil avant sa base, épaisse et vive.
   */
  private drawMuzzleFlash(f: MuzzleFlash, k: number): void {
    const g = this.shotLights;
    const blast = TRACER_STYLE.blast;
    const hot = f.enemy ? TRACER_STYLE.enemy : TRACER_STYLE.hero;
    // elle frémit d'une image à l'autre
    const reach = blast.length * blast.size * (0.97 + Math.random() * 0.06);
    const girth = blast.width * blast.size;
    // distance entre le canon et la base de la flamme : nulle au tir, elle grandit à mesure qu'elle s'estompe
    const lift = blast.drift * blast.size * (1 - k);
    // elle suit le canon : un tireur qui court ou qui tourne l'emmène avec lui
    const gun = f.gun?.();
    if (gun) {
      f.x = gun.x;
      f.y = gun.y;
      f.angle = gun.angle + f.turn;
    }
    const ax = Math.cos(f.angle);
    const ay = Math.sin(f.angle);
    f.light.setAlpha(blast.lightAlpha * k).setPosition(f.x + ax * lift, f.y + ay * lift).setRotation(f.angle);
    /** Langue de feu de `from` à `to` pixels du canon : pointue à sa base, ventrue ensuite, effilée vers l'avant. */
    const tongue = (from: number, to: number, width: number): Phaser.Geom.Point[] => {
      const side: { along: number; across: number }[] = [];
      const steps = 9;
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        side.push({ along: from + (to - from) * t, across: width * Math.sin(Math.PI * Math.pow(t, 0.42)) * (1 - 0.35 * t) });
      }
      const points = [...side, ...side.slice().reverse().map((p) => ({ along: p.along, across: -p.across }))];
      return points.map((p) => new Phaser.Geom.Point(f.x + ax * p.along - ay * p.across, f.y + ay * p.along + ax * p.across));
    };
    g.fillStyle(hot.glow, 0.45 * k).fillPoints(tongue(lift, lift + reach * 0.95, girth * 0.62), true);
    g.fillStyle(hot.core, 0.75 * k).fillPoints(tongue(lift, lift + reach * 0.75, girth * 0.4), true);
    g.fillStyle(0xffffff, k).fillPoints(tongue(lift, lift + reach * 0.5, girth * 0.2), true);
    /** Pointe : un losange très allongé, pointu à sa base (à `from` pixels du canon) comme à son sommet. */
    const spike = (angle: number, from: number, to: number, width: number): Phaser.Geom.Point[] => {
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const belly = from + (to - from) * 0.22;
      return [
        new Phaser.Geom.Point(f.x + c * from, f.y + s * from),
        new Phaser.Geom.Point(f.x + c * belly + s * width, f.y + s * belly - c * width),
        new Phaser.Geom.Point(f.x + c * to, f.y + s * to),
        new Phaser.Geom.Point(f.x + c * belly - s * width, f.y + s * belly + c * width),
      ];
    };
    for (const r of f.rays) {
      const angle = f.angle + r.offset;
      const run = reach * r.length;
      // trois épaisseurs : halo orangé, corps jaune, fil blanc
      g.fillStyle(hot.glow, 0.5 * k).fillPoints(spike(angle, lift, lift + run, r.width * 2.2), true);
      g.fillStyle(hot.core, 0.8 * k).fillPoints(spike(angle, lift, lift + run * 0.86, r.width * 1.2), true);
      g.fillStyle(0xffffff, k).fillPoints(spike(angle, lift, lift + run * 0.6, r.width * 0.55), true);
    }
    // étincelles : de courts traits qui s'éloignent du canon
    for (const p of f.sparks) {
      const angle = f.angle + p.offset;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const d = p.from + p.speed * f.age;
      g.lineStyle(2, hot.core, 0.9 * k).lineBetween(f.x + c * d, f.y + s * d, f.x + c * (d + p.size), f.y + s * (d + p.size));
    }
    // le cœur, chauffé à blanc, juste devant la base de la flamme : il ne recouvre jamais le canon
    const heart = 13 * blast.size;
    const cx = f.x + ax * (lift + heart);
    const cy = f.y + ay * (lift + heart);
    g.fillStyle(hot.core, 0.7 * k).fillCircle(cx, cy, heart);
    g.fillStyle(0xffffff, k).fillCircle(cx, cy, heart * 0.54);
  }

  /** Sprite et image du corps du héros selon son état. */
  private heroPose(h: Hero): { sprite: string; frame: number } {
    const def = h.def;
    // BadaBot (GD-051) : il canalise immobile, boucliers au repos, puis les frappe l'un contre l'autre d'un
    // coup, avec les images de son bouclier jouées bien plus vite ; il les tient un instant et les rouvre
    if (def.kind === 'BadaBot' && h.ultiPhase === ULTI_CAST) {
      const left = CONFIG.ulti.castSteps - h.ultiSteps;
      return { sprite: 'spr_BadaBot_fire2', frame: left >= SLAM_STEPS ? 0 : Math.min(2, Math.floor((1 - left / SLAM_STEPS) * 3)) };
    }
    if (def.kind === 'BadaBot' && h.ultiPhase === ULTI_RECOVER) {
      const k = h.ultiSteps / CONFIG.ulti.recoverSteps;
      return { sprite: 'spr_BadaBot_fire2', frame: k < 0.25 ? 2 : k < 0.8 ? 3 : 0 };
    }
    // lancement d'un ulti : la posture de concentration propre au robot (sprites fabriqués, GD-044)
    const cast = `spr_${def.name}_ulti_cast`;
    if (h.ultiPhase === ULTI_CAST && this.scene.textures.exists(frameKey(cast, 0))) {
      return { sprite: cast, frame: (h.ultiSteps / CONFIG.ulti.castSteps) * this.info(cast).frames };
    }
    // BatBot : bond en tournoyant, puis coup d'atterrissage
    if (h.ultiPhase > 0 && def.kind === 'BatBot' && this.scene.textures.exists(frameKey('spr_BatBot_ulti_leap', 0))) {
      if (h.ultiPhase === ULTI_ACTION) {
        const leap = this.info('spr_BatBot_ulti_leap');
        return { sprite: 'spr_BatBot_ulti_leap', frame: ((this.scene.time.now / 1000) * leap.speed) % leap.frames };
      }
      if (h.ultiPhase === ULTI_RECOVER) {
        return { sprite: 'spr_BatBot_fire1_d', frame: (h.ultiSteps / CONFIG.ulti.recoverSteps) * this.info('spr_BatBot_fire1_d').frames };
      }
    }
    if (h.deploySteps > 0) {
      const sprite = `spr_${def.name}_deploy`;
      if (this.scene.textures.exists(frameKey(sprite, 0))) {
        return { sprite, frame: (1 - h.deploySteps / Math.max(1, h.deployTotal)) * this.info(sprite).frames };
      }
    }
    const walkCycle = (sprite: string): { sprite: string; frame: number } => {
      // un cycle d'animation tous les 256 px parcourus
      const frames = this.info(sprite).frames;
      return { sprite, frame: h.moving ? ((h.walkDist / 256) * frames) % frames : 0 };
    };
    const period = STEPS_PER_SECOND / def.shotsPerSecond;
    if (def.kind === 'BatBot') {
      if (h.fire2Anim >= 0) {
        const sprite = h.swing === 'd' ? 'spr_BatBot_fire2_d' : 'spr_BatBot_fire2_g';
        return { sprite, frame: (h.fire2Anim / CONFIG.abilities.batBot.throwAnimSteps) * this.info(sprite).frames };
      }
      if (h.state === 'firing1' && h.sinceShot < 20) {
        const sprite = `spr_BatBot_fire1_${h.swing}`;
        return { sprite, frame: (h.sinceShot / 20) * this.info(sprite).frames };
      }
      return walkCycle(`spr_BatBot_move_${h.bats}`);
    }
    if (def.kind === 'BadaBot') {
      // bouclier : l'animation se fige sur l'image 2
      if (h.fire2Anim >= 0 && def.sprites.fire2) return { sprite: def.sprites.fire2, frame: Math.min(2, h.fire2Anim / 6) };
      return h.moving ? walkCycle(def.sprites.move) : { sprite: def.sprites.stand, frame: 0 };
    }
    // rechargement de PetBot (GD-072) : une transfusion. Il pompe trois doses de sérum de son dos vers son arme,
    // par son tuyau ; l'animation, fabriquée (ADR-015), est jouée une fois sur toute la durée du rechargement
    if (def.kind === 'PetBot' && h.reloadTimer > 0 && this.scene.textures.exists(frameKey('spr_PetBot_reload', 0))) {
      const frames = this.info('spr_PetBot_reload').frames;
      const done = 1 - h.reloadTimer / Math.max(1, def.reloadSteps);
      return { sprite: 'spr_PetBot_reload', frame: Math.min(frames - 1, done * frames) };
    }
    // rechargement d'EngiBot (GD-071) : son fusil en accordéon se comprime, chauffe, puis se détend ; l'animation,
    // fabriquée (ADR-015), est jouée une fois sur toute la durée du rechargement
    if (def.kind === 'EngiBot' && h.reloadTimer > 0 && this.scene.textures.exists(frameKey('spr_EngiBot_reload', 0))) {
      const frames = this.info('spr_EngiBot_reload').frames;
      const done = 1 - h.reloadTimer / Math.max(1, def.reloadSteps);
      return { sprite: 'spr_EngiBot_reload', frame: Math.min(frames - 1, done * frames) };
    }
    if (def.kind === 'EngiBot' && h.fire2Anim >= 0 && def.sprites.fire2) {
      return { sprite: def.sprites.fire2, frame: (h.fire2Anim / CONFIG.abilities.engiBot.placeAnimSteps) * this.info(def.sprites.fire2).frames };
    }
    // Tant qu'il tire, il garde la posture de tir, même en courant : entre deux coups, l'animation reste sur sa
    // dernière image au lieu de repasser à celle de la marche. Sinon, dès que le compteur du dernier tir dépassait
    // la cadence (cela arrive en réseau, où il n'est recalé que par les instantanés), les deux postures
    // alternaient : l'arme balancée de la marche, puis l'arme droite du tir.
    if (h.state === 'firing1') {
      const frames = this.info(def.sprites.shot).frames;
      return { sprite: def.sprites.shot, frame: Math.min(frames - 1, (h.sinceShot / period) * frames) };
    }
    return h.moving ? walkCycle(def.sprites.move) : { sprite: def.sprites.stand, frame: 0 };
  }

  /** Boule de plasma de BadaBot : au repos, en charge, chargée, ou juste tirée. */
  private syncPlasmaBall(h: Hero, p: HeroParts, bodySprite: string, bodyFrame: number): void {
    if (h.def.kind !== 'BadaBot') return;
    p.orb ??= this.image('spr_plasmaBawl_idle', 0, h.x, h.y, DEPTH.character + 1);
    const ball = p.orb;
    const now = this.scene.time.now / 1000;
    const full = CONFIG.abilities.badaBot.fullChargeSteps;
    // la tête de BadaBot bouge d'une image à l'autre : l'orbe la suit (GD-033)
    const local = orbOffset(bodySprite, bodyFrame);
    const c = Math.cos(h.angle);
    const s = Math.sin(h.angle);
    p.orbX = h.x + local.x * c - local.y * s;
    p.orbY = h.y + local.x * s + local.y * c;
    ball.setVisible(true).setPosition(p.orbX, p.orbY).setRotation(h.angle);
    // rechargement de BadaBot : l'orbe se vide puis se reforme (GD-032)
    const reload = h.reloadTimer > 0 ? 1 - h.reloadTimer / Math.max(1, h.def.reloadSteps) : 1;
    ball.setScale(0.3 + 0.7 * reload).setAlpha(0.45 + 0.55 * reload);
    if (h.reloadTimer > 0) this.setFrame(ball, 'spr_plasmaBawl_loading', reload * this.info('spr_plasmaBawl_loading').frames);
    else if (h.charge >= full) this.setFrame(ball, 'spr_plasmaBawl_loaded', (now * 10) % this.info('spr_plasmaBawl_loaded').frames);
    else if (h.charge > 0) this.setFrame(ball, 'spr_plasmaBawl_loading', (h.charge / full) * this.info('spr_plasmaBawl_loading').frames);
    else if (h.sinceShot < 15) this.setFrame(ball, 'spr_plasmaBawl_shot', h.sinceShot / 3);
    else this.setFrame(ball, 'spr_plasmaBawl_idle', (now * 20) % this.info('spr_plasmaBawl_idle').frames);
    // l'orbe tourne et grossit autour de son propre centre
    const own = this.info(ball.texture.key.split('/')[0]);
    ball.setOrigin(own.ox / own.w, own.oy / own.h);
  }

  /** Synchronise un ensemble d'images avec une liste d'entités identifiées. */
  private syncPool<T extends { id: number }>(pool: Map<number, Img>, items: T[], create: (item: T) => Img, update: (img: Img, item: T) => void): void {
    const alive = new Set<number>();
    for (const item of items) {
      alive.add(item.id);
      let img = pool.get(item.id);
      if (!img) {
        img = create(item);
        pool.set(item.id, img);
      }
      update(img, item);
    }
    for (const [id, img] of pool) {
      if (!alive.has(id)) {
        img.destroy();
        pool.delete(id);
      }
    }
  }

  private syncAbilityObjects(): void {
    const world = this.world;
    // en salve, les mini-bots gardent leur ombre jusqu'à l'explosion (GD-046)
    this.syncPool(this.droneShadowImgs, world.drones,
      (d) => this.image('spr_PetDrone', d.level - 1, d.x, d.y, DEPTH.character + 2.5).setTintFill(0x000000).setAlpha(0.3),
      (img, d) => img.setPosition(d.x + 9, d.y + 13).setRotation(d.angle).setScale(PETS.scale));
    this.syncPool(this.droneImgs, world.drones,
      (d) => this.image('spr_PetDrone', d.level - 1, d.x, d.y, DEPTH.bullet),
      // en salve, ils gardent la taille qu'ils ont autour de PetBot
      (img, d) => img.setPosition(d.x, d.y).setRotation(d.angle).setScale(PETS.scale));
    this.syncPool(this.explosionImgs, world.explosions,
      (e) => {
        if (e.sprite === 'spr_bullet2_explosion') this.blastFx(e.x, e.y, e.radius);
        return this.image(e.sprite, 0, e.x, e.y, DEPTH.fx).setRotation(e.angle).setScale(e.scale);
      },
      (img, e) => this.setFrame(img, e.sprite, (e.step / e.totalSteps) * this.info(e.sprite).frames));
    this.syncPool(this.batImgs, world.bats,
      (b) => this.image(`spr_batte_BatBot_${b.side}`, 0, b.x, b.y, DEPTH.bullet),
      (img, b) => this.syncBat(img, b));
    this.syncTurret(world.turret);
    this.syncEffects();
  }

  /**
   * L'onde de l'ulti de BadaBot (GD-052). Ce n'est pas un objet qui traverse la salle mais une onde d'énergie :
   * un front lumineux légèrement bombé, suivi de plusieurs échos de plus en plus pâles, au-dessus d'un sillage.
   * Elle est dessinée bande par bande : la partie qui heurte un mur s'y écrase dans un éclat et s'arrête,
   * le reste continue tout droit. En bout de course, sans obstacle, elle s'estompe.
   */
  private drawWave(e: UltiEffect): void {
    const cfg = CONFIG.ulti.badaBot;
    const g = this.waveFx;
    const colors = ULTI_COLORS.BadaBot;
    const strips = waveStrips(this.world, e);
    const half = e.radius / strips.length;
    const c = Math.cos(e.angle);
    const s = Math.sin(e.angle);
    const reach = cfg.speed * e.steps;
    const at = (across: number, along: number): Phaser.Geom.Point => new Phaser.Geom.Point(e.fromX + c * along - s * across, e.fromY + s * along + c * across);
    /** Retard du front sur ses bords : il est bombé vers l'avant. */
    const bow = (across: number): number => 26 * (across / e.radius) ** 2;
    // le front (trois traits superposés : halo, corps clair, fil blanc), puis ses échos derrière lui
    const layers = [
      { back: 0, width: 18, color: colors.main, alpha: 0.32 },
      { back: 0, width: 9, color: colors.light, alpha: 0.7 },
      { back: 0, width: 3, color: 0xffffff, alpha: 0.95 },
      { back: 36, width: 7, color: colors.light, alpha: 0.4 },
      { back: 36, width: 2, color: 0xffffff, alpha: 0.5 },
      { back: 68, width: 5, color: colors.main, alpha: 0.4 },
      { back: 98, width: 4, color: colors.main, alpha: 0.26 },
      { back: 126, width: 3, color: colors.main, alpha: 0.15 },
    ];
    strips.forEach((limit, i) => {
      const mid = waveStripOffset(e, i);
      const blocked = limit < cfg.range - 1;
      // sillage au sol de cette bande, jusqu'à son front ou jusqu'à son obstacle
      const wake = Math.min(limit, reach);
      const dying = Math.max(0, Math.min(1, (e.total - e.steps) / (cfg.fadeSteps * 2)));
      if (wake > 0) g.fillStyle(colors.main, 0.07 * dying).fillPoints([at(mid - half, 0), at(mid + half, 0), at(mid + half, wake), at(mid - half, wake)], true);
      for (const layer of layers) {
        const a0 = reach - layer.back - bow(mid - half);
        const a1 = reach - layer.back - bow(mid + half);
        const along = (a0 + a1) / 2;
        // pas encore sortie des boucliers, ou déjà écrasée contre son obstacle
        if (along <= 0 || along > limit) continue;
        // sans obstacle, elle s'estompe sur la fin de sa course ; elle naît en s'allumant
        const fade = (blocked ? 1 : Math.min(1, (limit - along) / 300)) * Math.min(1, along / 50);
        g.lineStyle(layer.width, layer.color, layer.alpha * fade);
        const from = at(mid - half, Math.min(limit, a0));
        const to = at(mid + half, Math.min(limit, a1));
        g.lineBetween(from.x, from.y, to.x, to.y);
      }
      // la bande s'écrase contre un mur : un éclat qui s'étale le long du mur et s'éteint
      const since = (reach - limit) / cfg.speed;
      if (blocked && limit > 0 && since >= 0 && since < 9) {
        const k = since / 9;
        const hit = at(mid, limit - 4);
        g.fillStyle(colors.light, 0.55 * (1 - k)).fillCircle(hit.x, hit.y, half * (1.6 + 2.2 * k));
        g.fillStyle(0xffffff, 0.85 * (1 - k)).fillCircle(hit.x, hit.y, half * (0.8 + 0.6 * k));
      }
    });
    this.sweepRemains(e, strips, reach);
  }

  /**
   * L'onde de BadaBot emporte les débris qu'elle rencontre (membres, éclats de verre) : ils filent avec elle
   * en tournoyant, jusqu'au premier mur. Affichage seulement : chaque joueur voit voler ses propres débris.
   */
  private sweepRemains(e: UltiEffect, strips: number[], reach: number): void {
    const cfg = CONFIG.ulti.badaBot;
    const c = Math.cos(e.angle);
    const s = Math.sin(e.angle);
    const width = (2 * e.radius) / strips.length;
    for (const img of this.remains) {
      if (!this.loose.has(img) || this.sweptBy.get(img) === e.id) continue;
      const along = (img.x - e.fromX) * c + (img.y - e.fromY) * s;
      if (along > reach || along < reach - cfg.speed * 3) continue;
      // la bande qui passe sur lui doit être arrivée jusque-là
      const strip = Math.floor((-(img.x - e.fromX) * s + (img.y - e.fromY) * c + e.radius) / width);
      if (strip < 0 || strip >= strips.length || strips[strip] < along) continue;
      this.sweptBy.set(img, e.id);
      let entry = this.debris.find((d) => d.img === img);
      if (!entry) this.debris.push((entry = { img, vx: 0, vy: 0, spin: 0 }));
      const speed = cfg.speed * STEPS_PER_SECOND * (0.75 + Math.random() * 0.25);
      entry.vx = c * speed;
      entry.vy = s * speed;
      entry.spin = (Math.random() - 0.5) * 26;
      entry.glide = cfg.throwDistance * (0.4 + Math.random() * 0.6);
    }
  }

  /** Effets laissés par les ultis (GD-044) : nuage de nanomachines de PetBot, vague de BadaBot, grenade d'EngiBot. */
  private syncEffects(): void {
    const scene = this.scene;
    const now = scene.time.now / 1000;
    const alive = new Set<number>();
    this.waveFx.clear();
    for (const e of this.world.effects) {
      if (e.kind === 'wave') {
        this.drawWave(e);
        continue;
      }
      alive.add(e.id);
      let parts = this.effectImgs.get(e.id);
      // les dernières images : l'effet s'efface au lieu de disparaître d'un coup
      const fade = Math.min(1, (e.total - e.steps) / 30, e.steps / 10);
      if (e.kind === 'nanos') {
        const colors = ULTI_COLORS.PetBot;
        parts ??= {
          main: this.image('spr_PetBot_ulti_nanos', 0, e.x, e.y, DEPTH.fx + 3).setTint(colors.light),
          extra: scene.add.circle(e.x, e.y, e.radius, colors.main).setDepth(DEPTH.remains + 1),
        };
        const info = this.info('spr_PetBot_ulti_nanos');
        this.setFrame(parts.main, 'spr_PetBot_ulti_nanos', (now * info.speed) % info.frames);
        // le nuage dessiné va jusqu'à 246 px du centre : on l'ajuste au rayon de soin. Il reste en retrait :
        // ce sont les mini-bots en orbite qui dessinent la zone (GD-047).
        // tout le nuage suit le centre de la ronde des mini-bots, qui traîne un peu derrière PetBot (GD-050)
        const swarm = this.parts.get(e.owner);
        const cx = swarm ? swarm.swarmX : e.x;
        const cy = swarm ? swarm.swarmY : e.y;
        parts.main.setPosition(cx, cy).setScale(e.radius / 246).setAlpha(0.6 * fade);
        parts.extra?.setPosition(cx, cy).setAlpha(0.07 * fade + 0.02 * Math.sin(now * 5));
      } else {
        const fly = CONFIG.ulti.engiBot.flySteps;
        parts ??= {
          main: this.image('spr_EngiBot_ulti_grenade', 0, e.x, e.y, DEPTH.fx + 4),
          extra: this.image('spr_EngiBot_ulti_pulse', 0, e.x, e.y, DEPTH.fx + 3).setTint(ULTI_COLORS.emp.main).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
        };
        const flying = e.steps < fly;
        const grenade = this.info('spr_EngiBot_ulti_grenade');
        this.setFrame(parts.main, 'spr_EngiBot_ulti_grenade', (now * grenade.speed) % grenade.frames);
        // en vol, la grenade monte puis retombe : elle grossit au sommet de sa course
        const arc = Math.sin(Math.PI * Math.min(1, e.steps / fly));
        parts.main.setVisible(flying).setPosition(e.x, e.y - 70 * arc).setScale(1.2 + 0.7 * arc);
        if (parts.extra && !flying) {
          const pulse = this.info('spr_EngiBot_ulti_pulse');
          const frame = ((e.steps - fly) / STEPS_PER_SECOND) * pulse.speed;
          this.setFrame(parts.extra as Img, 'spr_EngiBot_ulti_pulse', frame);
          // l'anneau dessiné va jusqu'à 240 px du centre : on l'étire jusqu'au rayon de la grenade
          (parts.extra as Img).setVisible(frame < pulse.frames).setPosition(e.x, e.y).setScale(e.radius / 240);
        }
      }
      this.effectImgs.set(e.id, parts);
    }
    for (const [id, parts] of this.effectImgs) {
      if (alive.has(id)) continue;
      parts.main.destroy();
      parts.extra?.destroy();
      this.effectImgs.delete(id);
    }
  }

  private syncBat(img: Img, b: Bat): void {
    img.setPosition(b.x, b.y);
    if (b.state === 'stopped') {
      this.setFrame(img, `spr_batte_BatBot_hit_${b.side}_stopped`, 0);
      img.setDepth(DEPTH.remains + 1);
    } else {
      const sprite = `spr_batte_BatBot_${b.side}`;
      this.setFrame(img, sprite, (b.steps * 40 / STEPS_PER_SECOND) % this.info(sprite).frames);
      img.setRotation(b.angle).setDepth(DEPTH.bullet);
    }
  }

  private syncTurret(t: Turret | null): void {
    if (!t) {
      this.turretImg?.destroy();
      this.turretImg = null;
      return;
    }
    if (!this.turretImg) this.turretImg = this.image('spr_turet_deploy', 0, t.x, t.y, DEPTH.character);
    const img = this.turretImg;
    img.setPosition(t.x, t.y).setRotation(t.angle);
    if (t.state === 'deployed') {
      this.setFrame(img, 'spr_turet', t.level - 1);
    } else if (t.state === 'deploying') {
      const info = this.info('spr_turet_deploy');
      const total = Math.round((info.frames / spriteFps(info)) * STEPS_PER_SECOND);
      this.setFrame(img, 'spr_turet_deploy', (1 - t.timer / total) * info.frames);
    } else {
      this.setFrame(img, 'spr_turet_deploy', 0);
    }
  }

  // ---------- Brouillard, foreuses, lumières ----------

  /**
   * Brouillard de guerre. La lumière qui entre dans une pièce encore cachée (porte qui s'ouvre, vitre) perce
   * le brouillard là où elle éclaire : on entrevoit la pièce sans la découvrir entièrement (GD-041).
   */
  private syncFogs(): void {
    const rt = this.fogLayer;
    const cam = this.scene.cameras.main;
    let any = false;
    rt.clear();
    for (const fog of this.world.fogs) {
      const x = fog.x - cam.scrollX;
      const y = fog.y - cam.scrollY;
      if (fog.alpha <= 0 || x > VIEW.width || y > VIEW.height || x + fog.w < 0 || y + fog.h < 0) continue;
      rt.fill(FOG_COLOR, Math.min(1, fog.alpha), x, y, fog.w, fog.h);
      any = true;
    }
    rt.setVisible(any);
    if (!any) return;
    const pierce = (lamp: Lamp): void => {
      const sx = lamp.x - cam.scrollX;
      const sy = lamp.y - cam.scrollY;
      const r = lamp.radius;
      if (sx < -r || sy < -r || sx > VIEW.width + r || sy > VIEW.height + r) return;
      // une lampe encore sous le brouillard ne révèle pas sa propre pièce
      if (this.underFog(lamp.x, lamp.y)) return;
      lamp.stamp.setAlpha(LIGHTING.fogReveal);
      rt.erase(lamp.stamp, sx, sy);
    };
    for (const lamp of this.lights) pierce(lamp);
    for (const [id, lamp] of this.heroLamps) if (!this.world.heroes[id]?.gone) pierce(lamp);
  }

  private syncDrills(): void {
    const g = this.drillBars;
    g.clear();
    const now = this.scene.time.now / 1000;
    for (const drill of this.world.drills) {
      const parts = this.drillParts.get(drill.id);
      if (parts?.contours) this.setFrame(parts.contours, 'spr_foreuse_contours', drill.destroyed ? 0 : (now * 15) % this.info('spr_foreuse_contours').frames);
      if (parts?.beam) {
        parts.beam.setVisible(!drill.destroyed);
        this.setFrame(parts.beam, 'spr_foreuse_faisceau', (now * 15) % this.info('spr_foreuse_faisceau').frames);
      }
      this.drawDrillBar(g, drill);
    }
    // le boss est « vu » dès qu'il entre dans la vue : sa barre de vie s'affiche alors
    const boss = this.world.boss;
    if (boss && !boss.seen && this.scene.cameras.main.worldView.contains(boss.npc.x, boss.npc.y)) boss.seen = true;
  }

  private drawDrillBar(g: Phaser.GameObjects.Graphics, drill: Drill): void {
    if (drill.destroyed || drill.hp >= drill.maxHp) return;
    const w = 300;
    g.fillStyle(0x000000, 0.8).fillRect(drill.x - w / 2, drill.y - 20, w, 22);
    g.fillStyle(0xffb347, 1).fillRect(drill.x - w / 2, drill.y - 20, (w * drill.hp) / drill.maxHp, 22);
    g.lineStyle(2, 0xffffff, 0.8).strokeRect(drill.x - w / 2, drill.y - 20, w, 22);
  }

  private ensureHalo(): void {
    const scene = this.scene;
    if (scene.textures.exists('lightHalo')) return;
    const canvas = scene.textures.createCanvas('lightHalo', 256, 256);
    if (!canvas) return;
    const gradient = canvas.context.createRadialGradient(128, 128, 0, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,0.7)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    canvas.context.fillStyle = gradient;
    canvas.context.fillRect(0, 0, 256, 256);
    canvas.refresh();
  }

  /** Texture d'une carte d'accès, dessinée par le code (GD-029). */
  private cardTexture(color: string): string {
    const key = `card:${color}`;
    if (this.scene.textures.exists(key)) return key;
    const base = CARD_COLORS[color] ?? 0xffffff;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0x000000, 0.35).fillRoundedRect(6, 8, 88, 58, 10);
    g.fillStyle(base, 1).fillRoundedRect(2, 2, 88, 58, 10);
    g.fillStyle(0xffffff, 0.28).fillRoundedRect(2, 2, 88, 22, { tl: 10, tr: 10, bl: 0, br: 0 });
    g.fillStyle(0x10141c, 0.85).fillRect(2, 30, 88, 10);
    g.fillStyle(0xffd23c, 1).fillRoundedRect(12, 10, 22, 16, 4);
    g.lineStyle(2, 0x8a6a00, 1).strokeRoundedRect(12, 10, 22, 16, 4).lineBetween(23, 10, 23, 26).lineBetween(12, 18, 34, 18);
    g.fillStyle(0xffffff, 0.9).fillCircle(60, 50, 4).fillCircle(72, 50, 4).fillCircle(48, 50, 4);
    g.lineStyle(4, 0xffffff, 0.95).strokeRoundedRect(2, 2, 88, 58, 10);
    g.generateTexture(key, 96, 68);
    g.destroy();
    return key;
  }

  /** Effets dessinés sur le héros (GD-029) : anneau de rechargement, jauge de munitions, énergie en surcharge. */
  private drawHeroFx(h: Hero, p: HeroParts, local: boolean): void {
    if (h.deploySteps > 0) {
      this.syncAura(h, p);
      return;
    }
    const g = this.heroFx;
    const def = h.def;
    const c = Math.cos(h.angle);
    const s = Math.sin(h.angle);
    const at = (lx: number, ly: number): Phaser.Geom.Point => new Phaser.Geom.Point(h.x + lx * c - ly * s, h.y + lx * s + ly * c);
    const reloading = h.reloadTimer > 0;
    const progress = reloading ? 1 - h.reloadTimer / Math.max(1, def.reloadSteps) : 0;

    if (reloading) this.drawReload(h, progress);

    // jauge masquée quand le chargeur est plein : moins de choses à l'écran (GD-032)
    // (seulement sur son propre robot : celle des coéquipiers ne ferait qu'encombrer l'écran)
    if (local && def.magazine > 0 && (reloading || h.ammo < def.magazine)) {
      // trois segments le long de l'arme : vert, jaune, rouge ; ils clignotent à vide et se remplissent au rechargement
      const level = reloading ? Math.floor(progress * 3) : Math.ceil((h.ammo / def.magazine) * 3);
      const color = reloading ? 0xffe36b : level >= 3 ? 0x5dff7a : level === 2 ? 0xffd23c : 0xff4040;
      const blink = h.ammo === 0 && !reloading && Math.floor(this.world.tick / 12) % 2 === 0;
      const x0 = Math.max(4, def.muzzle.x - 62);
      const y0 = def.muzzle.y + 16;
      for (let i = 0; i < 3; i++) {
        const lx = x0 + i * 16;
        const quad = [at(lx, y0), at(lx + 12, y0), at(lx + 12, y0 + 9), at(lx, y0 + 9)];
        g.fillStyle(0x000000, 0.6).fillPoints([at(lx - 2, y0 - 2), at(lx + 14, y0 - 2), at(lx + 14, y0 + 11), at(lx - 2, y0 + 11)], true);
        if (i < level) g.fillStyle(color, 1).fillPoints(quad, true);
        else if (blink) g.fillStyle(0xff4040, 0.9).fillPoints(quad, true);
      }
    }

    // BatBot rappelle ses battes : une lueur magenta pulse sur la main qui attend chaque batte,
    // comme les particules de scr_createReturningBatteParticules dans l'original
    for (const bat of def.kind === 'BatBot' ? this.world.bats : []) {
      if (bat.state !== 'returning') continue;
      const hand = batHand(h, bat.side);
      const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now / 70);
      g.fillStyle(0xfe00d1, 0.25 + 0.2 * pulse).fillCircle(hand.x, hand.y, 16 + 8 * pulse);
      g.fillStyle(0xfe00d1, 0.95).fillCircle(hand.x, hand.y, 7 + 3 * pulse);
      g.lineStyle(2, 0xfe00d1, 0.25).lineBetween(hand.x, hand.y, bat.x, bat.y);
    }

    this.syncAura(h, p);
  }

  /**
   * Surcharge d'énergie (GD-031) : une enveloppe lumineuse à la forme du robot, en 3 niveaux (4 à 6, 7 à 9,
   * 10 à 12), avec quelques étincelles. Plus discrète que le cercle d'avant.
   *
   * Lancement d'un ulti (GD-049) : le robot était en pleine surcharge, son enveloppe reste donc au plus fort
   * (alors que l'énergie est déjà dépensée) et passe, dans le premier tiers du lancement, du bleu clair à la
   * couleur du robot.
   */
  private syncAura(h: Hero, p: HeroParts): void {
    const body = p.body;
    const casting = h.ultiPhase === ULTI_CAST;
    const level = h.state === 'dead' || h.deploySteps > 0 ? 0 : casting ? 3 : Math.max(0, Math.min(3, Math.ceil((h.energy - CONFIG.hero.naturalEnergy) / 3)));
    const colors = ULTI_COLORS[h.def.kind] ?? ULTI_COLORS.BatBot;
    const shift = casting ? castProgress(h) * 3 : 0;
    const color = mixColor(OVERCHARGE_COLOR, colors.main, shift);
    while (p.auras.length < 2) {
      p.auras.push(this.scene.add.image(h.x, h.y, body.texture.key).setBlendMode(Phaser.BlendModes.ADD).setDepth(DEPTH.character - 0.5));
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now / 160);
    p.auras.forEach((aura, i) => {
      aura.setVisible(level > 0);
      if (level === 0) return;
      if (aura.texture.key !== body.texture.key) aura.setTexture(body.texture.key);
      aura.setTintFill(color).setOrigin(body.originX, body.originY).setPosition(h.x, h.y).setRotation(h.angle)
        .setScale(1.06 + i * 0.07 + 0.015 * pulse)
        .setAlpha((0.1 + 0.07 * level) * (i === 0 ? 1 : 0.55) * (0.8 + 0.2 * pulse));
    });
    // étincelles : une par niveau, sur le contour du corps
    const g = this.heroFx;
    for (let k = 0; k < level; k++) {
      if (Math.random() < 0.45) continue;
      let a = Math.random() * Math.PI * 2;
      let r = h.def.radius * (0.7 + Math.random() * 0.35);
      g.lineStyle(2, Math.random() < 0.5 ? 0xffffff : mixColor(0x8fdcff, colors.light, shift), 0.85).beginPath();
      g.moveTo(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r);
      for (let j = 0; j < 3; j++) {
        a += 0.1 + Math.random() * 0.16;
        r = h.def.radius * (0.7 + Math.random() * 0.4);
        g.lineTo(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r);
      }
      g.strokePath();
    }
  }

  /** Dash : le robot est propulsé ; il laisse des images rémanentes qui s'effacent (flou cinétique). */
  private dashTrail(h: Hero, body: Img): void {
    const scene = this.scene;
    const ghost = scene.add.image(h.x, h.y, body.texture.key).setOrigin(body.originX, body.originY).setRotation(h.angle)
      .setTintFill(0x9fd9ff).setAlpha(0.45).setDepth(DEPTH.character - 0.6).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: ghost, alpha: 0, scaleX: 0.92, scaleY: 0.92, duration: 220, onComplete: () => ghost.destroy() });
    // flammèche du propulseur, à l'arrière
    const back = h.moveAngle + Math.PI + (Math.random() - 0.5) * 0.5;
    const flame = scene.add.circle(h.x + Math.cos(back) * 30, h.y + Math.sin(back) * 30, 7 + Math.random() * 6, Math.random() < 0.5 ? 0xffe36b : 0xff8a2a).setDepth(DEPTH.character - 0.7);
    scene.tweens.add({ targets: flame, x: flame.x + Math.cos(back) * 70, y: flame.y + Math.sin(back) * 70, alpha: 0, scale: 0.3, duration: 200, onComplete: () => flame.destroy() });
  }

  /** Explosion d'une batte (GD-031) : éclair, onde de choc, braises et fumée, pour qu'on la lise comme telle. */
  private blastFx(x: number, y: number, radius: number): void {
    const scene = this.scene;
    scene.cameras.main.shake(220, 0.007);
    const flash = scene.add.circle(x, y, radius * 0.55, 0xfff3c4).setDepth(DEPTH.fx + 1).setBlendMode(Phaser.BlendModes.ADD);
    scene.tweens.add({ targets: flash, alpha: 0, scale: 1.5, duration: 320, onComplete: () => flash.destroy() });
    const core = scene.add.circle(x, y, radius * 0.35, 0xff7a1a).setDepth(DEPTH.fx).setAlpha(0.9);
    scene.tweens.add({ targets: core, alpha: 0, scale: 2.2, duration: 550, onComplete: () => core.destroy() });
    for (const [width, delay] of [[10, 0], [5, 90]] as const) {
      const ring = scene.add.circle(x, y, radius * 0.2).setStrokeStyle(width, 0xffd9a0).setDepth(DEPTH.fx + 1);
      scene.tweens.add({ targets: ring, scale: 5, alpha: 0, duration: 520, delay, onComplete: () => ring.destroy() });
    }
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2;
      const dist = radius * (0.5 + Math.random() * 0.7);
      const ember = scene.add.circle(x, y, 3 + Math.random() * 4, Math.random() < 0.5 ? 0xffc04a : 0xff5a1f).setDepth(DEPTH.fx + 1);
      scene.tweens.add({ targets: ember, x: x + Math.cos(a) * dist, y: y + Math.sin(a) * dist, alpha: 0, duration: 450 + Math.random() * 300, onComplete: () => ember.destroy() });
    }
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * Math.PI * 2;
      const smoke = scene.add.circle(x + Math.cos(a) * radius * 0.25, y + Math.sin(a) * radius * 0.25, radius * (0.18 + Math.random() * 0.14), 0x2a2a2a).setDepth(DEPTH.fx - 1).setAlpha(0.55);
      scene.tweens.add({ targets: smoke, alpha: 0, scale: 1.9, x: smoke.x + Math.cos(a) * 40, y: smoke.y + Math.sin(a) * 40, duration: 900 + Math.random() * 400, onComplete: () => smoke.destroy() });
    }
    // trace de brûlure laissée au sol
    this.keepRemains(scene.add.circle(x, y, radius * 0.4, 0x000000).setAlpha(0.28).setDepth(DEPTH.remains - 2) as unknown as Img);
  }

  /** Chaises à roulettes et boutons de porte : dessinés ici car ils bougent (GD-031). */
  private syncFurniture(): void {
    this.syncPool<Chair>(this.chairImgs, this.world.chairs,
      (c) => this.image(c.sprite, 0, c.x, c.y, DEPTH.chair).setScale(c.scaleX, c.scaleY).setTint(tintOf(c.tint)),
      (img, c) => img.setPosition(c.x, c.y).setRotation(c.angle));
    this.syncPool<Button>(this.buttonImgs, this.world.buttons,
      (b) => this.image(b.sprite, 0, b.x, b.y, DEPTH.chair).setRotation(b.angle).setScale(b.scaleX, b.scaleY),
      (img, b) => {
        // pressé, le bouton s'enfonce dans le mur (vers l'arrière) et reste enfoncé
        const depth = b.pressedSteps < 0 ? 0 : Math.min(1, b.pressedSteps / 6);
        img.setPosition(b.x - Math.cos(b.angle) * 9 * depth, b.y - Math.sin(b.angle) * 9 * depth)
          .setScale(b.scaleX * (1 - 0.12 * depth), b.scaleY).setTint(depth > 0 ? 0x9a9a9a : 0xffffff);
      });
    // marqueur « ! » au-dessus d'un ennemi qui vient de repérer le héros
    for (const npc of this.world.npcs) {
      // pas de marqueur pour un ennemi caché par le brouillard d'une pièce fermée (GD-036)
      if (npc.behaviour !== 'surprised' || this.underFog(npc.x, npc.y)) continue;
      let alert = this.alerts.get(npc.id);
      if (!alert) {
        const text = this.scene.add.text(npc.x, npc.y, '!', { fontFamily: 'Aldo', fontSize: '64px', color: '#ffdd33', stroke: '#b00000', strokeThickness: 8 })
          .setOrigin(0.5, 1).setDepth(DEPTH.worldText).setScale(0.2);
        this.scene.tweens.add({ targets: text, scale: 1, duration: 140, ease: 'Back.easeOut' });
        alert = { text, frames: 0 };
        this.alerts.set(npc.id, alert);
      }
      alert.frames = 50;
    }
    for (const [id, alert] of this.alerts) {
      const npc = this.world.npcs.find((n) => n.id === id);
      if (!npc || --alert.frames <= 0 || this.underFog(npc.x, npc.y)) {
        alert.text.destroy();
        this.alerts.delete(id);
        continue;
      }
      alert.text.setPosition(npc.x, npc.y - npc.def.radius - 18).setAlpha(Math.min(1, alert.frames / 15));
    }
  }

  /**
   * Véhicule de largage (GD-035, GD-059) : il entre par la gauche avec toute l'équipe, chaque robot replié dans
   * sa pince (deux en haut, deux en bas), descend, les pose, remonte et sort par la droite. Sprites et position
   * des pinces repris de obj_spawnVehicle.
   */
  private syncVehicle(): void {
    const a = CONFIG.arrival;
    const team = this.world.heroes.filter((h) => !h.gone && h.arrivalTotal > 0);
    const lead = team.find((h) => h.arrivalSteps > 0);
    if (!lead || !this.scene.textures.exists(frameKey('spr_spawnVehicle', 0))) {
      if (this.vehicle) {
        this.vehicle.body.destroy();
        this.vehicle.shadow?.destroy();
        this.vehicle = null;
        for (const h of team) {
          const p = this.partsOf(h);
          p.body.setScale(1).setDepth(DEPTH.character);
          p.orb?.setDepth(DEPTH.character + 1);
        }
      }
      return;
    }
    const clawOf = (h: Hero): { x: number; y: number } => a.claws[h.id % a.claws.length];
    if (!this.vehicle) {
      const shadow = this.scene.textures.exists(frameKey('spr_spawnVehicleShadow', 0))
        ? this.image('spr_spawnVehicleShadow', 0, lead.x, lead.y, DEPTH.fx + 40).setAlpha(0.5) : null;
      this.vehicle = { body: this.image('spr_spawnVehicle', 0, lead.x, lead.y, DEPTH.fx + 42), shadow };
    }
    const t = lead.arrivalTotal - lead.arrivalSteps;
    // le véhicule se pose de façon que chaque pince soit au-dessus du point de départ de son robot
    const landed = { x: lead.x - clawOf(lead).x, y: lead.y - clawOf(lead).y };
    const t1 = a.flyInSteps;
    const t2 = t1 + a.descendSteps;
    const t3 = t2 + a.holdSteps;
    const t4 = t3 + a.ascendSteps;
    let x = landed.x;
    let height = 0; // 1 = en vol, 0 = posé
    if (t < t1) {
      const p = t / t1;
      x = landed.x - a.travel * (1 - p) * (1 - p); // il ralentit en arrivant
      height = 1;
    } else if (t < t2) {
      height = 1 - (t - t1) / a.descendSteps;
    } else if (t < t3) {
      height = 0;
    } else if (t < t4) {
      height = (t - t3) / a.ascendSteps;
    } else {
      const p = (t - t4) / a.flyOutSteps;
      x = landed.x + a.travel * p * p; // il accélère en repartant
      height = 1;
    }
    const scale = 1 + (a.flightScale - 1) * height;
    const { body, shadow } = this.vehicle;
    this.setFrame(body, 'spr_spawnVehicle', (this.scene.time.now / 60) % this.info('spr_spawnVehicle').frames);
    body.setPosition(x, landed.y).setScale(scale);
    // l'ombre s'écarte et s'agrandit avec l'altitude, comme dans l'original
    shadow?.setPosition(x + (70 * height + 10) * 0.94, landed.y + (70 * height + 10) * 0.34).setScale(scale * (1 + height / 6));
    // les robots restent dans leur pince jusqu'à ce que le véhicule soit posé
    const carried = t < t3;
    for (const h of team) {
      const p = this.partsOf(h);
      if (!carried) {
        p.body.setPosition(h.x, h.y).setScale(1).setDepth(DEPTH.character);
        p.orb?.setDepth(DEPTH.character + 1);
        continue;
      }
      const claw = clawOf(h);
      const bx = x + claw.x * scale;
      const by = landed.y + claw.y * scale;
      p.body.setPosition(bx, by).setScale(scale).setRotation(h.angle).setDepth(DEPTH.fx + 41);
      // l'orbe de BadaBot est un calque à part : elle voyage avec lui au lieu de l'attendre au sol
      if (p.orb) {
        p.orb.setPosition(bx + (p.orbX - h.x) * scale, by + (p.orbY - h.y) * scale).setScale(p.orb.scaleX * scale).setDepth(DEPTH.fx + 41.5);
      }
    }
  }

  private nearView(x: number, y: number): boolean {
    const cam = this.scene.cameras.main;
    return x > cam.scrollX - 200 && x < cam.scrollX + VIEW.width + 200 && y > cam.scrollY - 200 && y < cam.scrollY + VIEW.height + 200;
  }

  /** Ce point est-il masqué par un brouillard de guerre encore opaque ? */
  private underFog(x: number, y: number): boolean {
    return this.world.fogs.some((f) => f.alpha > 0.35 && x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
  }

  /** Point de sauvegarde devant le boss : une balise, ambre tant qu'elle attend, bleue une fois activée. */
  private syncCheckpoint(): void {
    const cp = this.world.checkpoint;
    if (!cp) return;
    const scene = this.scene;
    if (!this.checkpointImg) {
      if (!scene.textures.exists('checkpoint')) {
        const g = scene.make.graphics({ x: 0, y: 0 }, false);
        g.fillStyle(0x000000, 0.4).fillCircle(64, 68, 56);
        g.fillStyle(0x2a3140, 1).fillCircle(64, 64, 52);
        g.lineStyle(5, 0x8b96ad, 1).strokeCircle(64, 64, 52);
        g.fillStyle(0x151a24, 1).fillCircle(64, 64, 38);
        g.lineStyle(4, 0x8b96ad, 1).strokeCircle(64, 64, 22);
        for (let k = 0; k < 4; k++) {
          const a = (k * Math.PI) / 2 + Math.PI / 4;
          g.fillStyle(0x8b96ad, 1).fillCircle(64 + Math.cos(a) * 45, 64 + Math.sin(a) * 45, 5);
        }
        g.fillStyle(0xffffff, 1).fillCircle(64, 64, 12);
        g.generateTexture('checkpoint', 128, 128);
        g.destroy();
      }
      this.ensureHalo();
      this.checkpointImg = scene.add.image(cp.x, cp.y, 'checkpoint').setDepth(DEPTH.outlet);
      scene.add.text(cp.x, cp.y + 78, 'CHECKPOINT', { fontFamily: 'Aldo', fontSize: '26px', color: '#ffffff', stroke: '#000000', strokeThickness: 5 })
        .setOrigin(0.5, 0).setDepth(DEPTH.outlet);
    }
    const g = this.cable;
    const t = this.scene.time.now / 1000;
    const color = cp.active ? 0x7fd9ff : 0xffb347;
    this.checkpointImg.setTint(cp.active ? 0xbfeaff : 0xffd9a0);
    const pulse = 0.5 + 0.5 * Math.sin(t * (cp.active ? 2 : 4));
    g.fillStyle(color, 0.12 + 0.1 * pulse).fillCircle(cp.x, cp.y, 80 + 20 * pulse);
    g.lineStyle(4, color, 0.5 + 0.4 * pulse).strokeCircle(cp.x, cp.y, 66 + 10 * pulse);
    if (!cp.active) g.lineStyle(2, color, 0.25).strokeCircle(cp.x, cp.y, CONFIG.hero.checkpointRadius);
    // faisceau tournant
    for (let k = 0; k < 2; k++) {
      const a = t * 1.5 + k * Math.PI;
      g.lineStyle(6, color, 0.3).lineBetween(cp.x, cp.y, cp.x + Math.cos(a) * 110, cp.y + Math.sin(a) * 110);
    }
  }

  /** Endroit de l'arme où se loge la munition, dans le monde : la fiole de PetBot, le tambour d'EngiBot, l'orbe de BadaBot. */
  private weaponSlot(h: Hero): { x: number; y: number } {
    // l'orbe de BadaBot : là où elle est réellement dessinée
    const p = this.parts.get(h.id);
    if (h.def.kind === 'BadaBot' && p?.orb) return { x: p.orbX, y: p.orbY };
    const local = RELOAD_SLOT[h.def.kind] ?? { x: 30, y: 0 };
    const c = Math.cos(h.angle);
    const s = Math.sin(h.angle);
    return { x: h.x + local.x * c - local.y * s, y: h.y + local.x * s + local.y * c };
  }

  private clipTexture(kind: string): string {
    const key = `clip:${kind}`;
    if (this.scene.textures.exists(key)) return key;
    const g = this.scene.make.graphics({ x: 0, y: 0 }, false);
    if (kind === 'EngiBot') {
      // chargeur tambour : disque sombre garni de cartouches
      g.fillStyle(0x1c1c1c, 1).fillCircle(14, 14, 13);
      g.lineStyle(2, 0xb04040, 1).strokeCircle(14, 14, 13);
      for (let k = 0; k < 6; k++) g.fillStyle(0xffd23c, 1).fillCircle(14 + Math.cos(k * 1.047) * 8, 14 + Math.sin(k * 1.047) * 8, 2.5);
      g.fillStyle(0x666666, 1).fillCircle(14, 14, 3);
    } else {
      // fiole : tube vert à embout blanc
      g.fillStyle(0x1f4d2a, 1).fillRoundedRect(0, 8, 28, 12, 4);
      g.fillStyle(0x7dff9a, 1).fillRoundedRect(2, 10, 18, 8, 3);
      g.fillStyle(0xffffff, 1).fillRect(21, 9, 6, 10);
    }
    g.generateTexture(key, 28, 28);
    g.destroy();
    return key;
  }

  /** Début du rechargement : la munition usée est éjectée sur le côté et reste au sol ; l'orbe de BadaBot se disperse. */
  private ejectClip(h: Hero): void {
    const scene = this.scene;
    const slot = this.weaponSlot(h);
    if (h.def.kind === 'BadaBot') {
      for (let i = 0; i < 12; i++) {
        const a = Math.random() * Math.PI * 2;
        const dot = scene.add.circle(slot.x, slot.y, 3 + Math.random() * 4, 0xc060ff).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: dot, x: slot.x + Math.cos(a) * 70, y: slot.y + Math.sin(a) * 70, alpha: 0, duration: 300, onComplete: () => dot.destroy() });
      }
      return;
    }
    if (h.def.magazine === 0) return;
    const img = scene.add.image(slot.x, slot.y, this.clipTexture(h.def.kind)).setDepth(DEPTH.remains).setRotation(h.angle).setTint(0x9a9a9a);
    const side = h.angle + Math.PI / 2 + (Math.random() - 0.5) * 0.6;
    this.toss({ img, vx: Math.cos(side) * 320, vy: Math.sin(side) * 320, spin: 9 });
    this.keepRemains(img);
  }

  /**
   * Rechargement dessiné sur le robot (GD-032) : l'orbe de BadaBot se reforme en aspirant de l'énergie. Ceux de
   * PetBot (GD-072) et d'EngiBot (GD-071) sont des animations de sprites.
   */
  private drawReload(h: Hero, progress: number): void {
    const g = this.heroFx;
    if (h.def.kind === 'BadaBot') {
      // filaments d'énergie aspirés vers l'orbe
      const p = this.weaponSlot(h);
      for (let k = 0; k < 6; k++) {
        const a = k * 1.047 + this.scene.time.now / 260;
        const r = 26 + 46 * (1 - ((progress * 3 + k / 6) % 1));
        g.fillStyle(k % 2 ? 0xd9a0ff : 0x9b5cff, 0.85).fillCircle(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 4);
      }
      g.lineStyle(3, 0xc060ff, 0.5).strokeCircle(p.x, p.y, 10 + 22 * progress);
      return;
    }
    // PetBot et EngiBot : leur rechargement est joué par leurs sprites (voir heroPose)
  }

  /** Bouclier des robots à bouclier : un arc devant eux, un segment par coup encore encaissable (GD-029). */
  private syncNpcFx(): void {
    const g = this.npcFx;
    g.clear();
    const total = CONFIG.npc.shieldHits;
    for (const npc of this.world.npcs) {
      if (npc.stun > 0 && !this.underFog(npc.x, npc.y)) {
        // robot désactivé par la grenade d'EngiBot : des arcs électriques courent sur lui
        for (let k = 0; k < 3; k++) {
          let a = Math.random() * Math.PI * 2;
          let r = npc.def.radius * (0.4 + Math.random() * 0.7);
          g.lineStyle(k === 0 ? 3 : 2, k === 0 ? 0xffffff : 0x4fb8ff, 0.9).beginPath();
          g.moveTo(npc.x + Math.cos(a) * r, npc.y + Math.sin(a) * r);
          for (let j = 0; j < 4; j++) {
            a += (Math.random() - 0.5) * 1.6;
            r = npc.def.radius * (0.3 + Math.random() * 0.9);
            g.lineTo(npc.x + Math.cos(a) * r, npc.y + Math.sin(a) * r);
          }
          g.strokePath();
        }
        continue;
      }
      if (npc.shieldHp <= 0) continue;
      const r = npc.def.radius + 16;
      const span = (100 * Math.PI) / 180;
      const seg = span / total;
      for (let i = 0; i < npc.shieldHp; i++) {
        const a0 = npc.angle - span / 2 + i * seg + 0.02;
        g.lineStyle(6, 0x7fd9ff, 0.85).beginPath();
        g.arc(npc.x, npc.y, r, a0, a0 + seg - 0.04);
        g.strokePath();
      }
    }
  }

  /** Lumières simples (GD-011) : un voile sombre sur la vue, percé d'un halo par lumière, sans ombres portées. */
  private buildLights(): void {
    const scene = this.scene;
    const world = this.world;
    const placed = world.level.instances.filter((i) => i.object === 'obj_lumiere');
    this.hasLamps = placed.length > 0;
    this.darkness = scene.add.renderTexture(0, 0, VIEW.width, VIEW.height).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.darkness);
    this.lights = [];
    placed.forEach((inst, index) => {
      const radius = Number(inst.props.radius ?? 256 * Math.abs(inst.scaleX));
      const intensity = Number(inst.props.lightIntensity ?? 0.5);
      const doors = world.doors.filter((d) => Math.hypot(d.x - inst.x, d.y - inst.y) <= radius + d.halfLength);
      const lamp = this.makeLamp(`lamp:${index}`, inst.x, inst.y, radius, intensity * LIGHTING.strength, LIGHTING.bakeScale, doors);
      if (!lamp) return;
      this.lights.push(lamp);
      // lampe colorée (teinte et saturation de l'original, sur 255) : sa couleur s'ajoute au décor, dans la
      // même zone éclairée que sa lumière, et sous le brouillard pour ne pas trahir une salle encore cachée
      const sat = Number(inst.props.sat ?? 0) / 255;
      if (sat <= 0.05) return;
      const color = Phaser.Display.Color.HSVToRGB(Number(inst.props.hue ?? 0) / 255, 1, 1) as Phaser.Types.Display.ColorObject;
      scene.add.image(lamp.x, lamp.y, lamp.key).setScale(1 / LIGHTING.bakeScale).setBlendMode(Phaser.BlendModes.ADD)
        .setTint(color.color).setAlpha(Math.min(1, intensity * sat * LIGHTING.colorStrength)).setDepth(DEPTH.fog - 1);
    });
    // chaque robot porte sa lueur : on voit celle des coéquipiers et ce qu'elle éclaire (GD-041)
    for (const h of world.heroes) {
      const lamp = this.makeLamp(`lamp:hero:${h.id}`, h.x, h.y, LIGHTING.heroRadius, LIGHTING.heroStrength, LIGHTING.heroBakeScale, world.doors);
      if (lamp) this.heroLamps.set(h.id, lamp);
    }
  }

  private makeLamp(key: string, x: number, y: number, radius: number, strength: number, scale: number, doors: Door[]): Lamp | null {
    const scene = this.scene;
    const size = Math.ceil(radius * 2 * scale) + 2;
    if (scene.textures.exists(key)) scene.textures.remove(key);
    if (!scene.textures.createCanvas(key, size, size)) return null;
    const stamp = scene.make.image({ key, add: false }).setScale(1 / scale);
    const lamp: Lamp = { x, y, radius, strength, key, scale, stamp, doors, doorState: -1 };
    this.bakeLamp(lamp);
    return lamp;
  }

  /**
   * Dessine la zone éclairée d'une lampe dans sa texture : un dégradé du centre vers le bord, découpé par le
   * polygone de ce que la lampe « voit ». Murs et portes font donc de l'ombre (GD-038).
   */
  private bakeLamp(lamp: Lamp): void {
    const texture = this.scene.textures.get(lamp.key) as Phaser.Textures.CanvasTexture;
    const ctx = texture.context;
    const s = lamp.scale;
    const size = texture.width;
    const mid = size / 2;
    const polygon = visibilityPolygon(this.world.collision, lamp.x, lamp.y, lamp.radius, BLOCK_SIGHT, LIGHTING.wallReach);
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    polygon.forEach((p, i) => {
      const px = mid + (p.x - lamp.x) * s;
      const py = mid + (p.y - lamp.y) * s;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.clip();
    // dégradé linéaire du centre au bord, comme le shader sha_light de l'original
    const gradient = ctx.createRadialGradient(mid, mid, 0, mid, mid, lamp.radius * s);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();
    texture.refresh();
    lamp.doorState = this.doorState(lamp.doors);
  }

  /** Résume l'ouverture d'un groupe de portes en un nombre : s'il change, la lumière qui passe a changé. */
  private doorState(doors: Door[]): number {
    let state = 0;
    for (let i = 0; i < doors.length; i++) state += doors[i].progress * (i + 1);
    return state;
  }

  private syncLights(): void {
    const rt = this.darkness;
    if (!rt) return;
    const world = this.world;
    const cam = this.scene.cameras.main;
    const h = world.hero;
    // pendant une recharge, la lumière baisse et tremble autour du robot (idée de l'utilisateur, GD-029)
    const flicker = h.charging ? 0.45 + Math.random() * 0.4 : 1;
    const ambient = (this.hasLamps ? LIGHTING.ambient : 0) + (h.charging ? LIGHTING.chargingDim * (0.6 + Math.random() * 0.6) : 0);
    const dark = ambient > 0;
    rt.setVisible(dark);
    // sans pénombre ni brouillard à percer, les zones éclairées ne servent à rien : on ne les calcule pas
    if (!dark && world.fogs.length === 0) return;

    // une porte qui bouge près d'une lampe change ce qu'elle éclaire : on ne recalcule que ces lampes-là
    let bakes = 0;
    for (const lamp of this.lights) {
      if (bakes >= LIGHTING.maxBakesPerFrame) break;
      if (this.doorState(lamp.doors) === lamp.doorState) continue;
      this.bakeLamp(lamp);
      bakes++;
    }
    // la lueur d'un héros le suit : elle est recalculée quand il se déplace ou qu'une porte bouge.
    // Celle des coéquipiers l'est un peu moins souvent : ils sont vus de plus loin.
    for (const [id, lamp] of this.heroLamps) {
      const o = world.heroes[id];
      if (!o || o.gone) continue;
      const slack = LIGHTING.heroRebakeDistance * (o === h ? 1 : 3);
      if (Math.hypot(o.x - lamp.x, o.y - lamp.y) <= slack && this.doorState(lamp.doors) === lamp.doorState) continue;
      lamp.x = o.x;
      lamp.y = o.y;
      this.bakeLamp(lamp);
    }
    if (!dark) return;

    rt.clear();
    rt.fill(0x000000, Math.min(0.85, ambient));
    const erase = (lamp: Lamp, alpha: number): void => {
      const sx = lamp.x - cam.scrollX;
      const sy = lamp.y - cam.scrollY;
      const r = lamp.radius;
      if (sx < -r || sy < -r || sx > VIEW.width + r || sy > VIEW.height + r) return;
      lamp.stamp.setAlpha(Math.min(1, alpha));
      rt.erase(lamp.stamp, sx, sy);
    };
    for (const lamp of this.lights) erase(lamp, lamp.strength * flicker);
    for (const [id, lamp] of this.heroLamps) {
      const o = world.heroes[id];
      if (!o || o.gone || o.arrivalSteps > 0) continue;
      erase(lamp, lamp.strength * (o.charging ? 0.7 + Math.random() * 0.3 : 1) * (o.state === 'dead' ? 0.45 : 1));
    }
  }

  private syncDoor(door: Door): void {
    const img = this.doorImgs.get(door.id);
    if (img) this.setFrame(img, door.sprite, Math.round(door.progress * (this.info(door.sprite).frames - 1)));
  }

  // ---------- Effets ----------

  handleEvent(e: SimEvent): void {
    const scene = this.scene;
    if (e.type === 'impact') {
      const color = e.surface === 'npc' ? 0xff3b3b : e.surface === 'shield' ? 0x9fd0ff : 0xffe9a8;
      for (let i = 0; i < 4; i++) {
        const a = e.angle + Math.PI + (Math.random() - 0.5) * 1.6;
        const dot = scene.add.circle(e.x, e.y, 2 + Math.random() * 2, color).setDepth(DEPTH.fx);
        scene.tweens.add({
          targets: dot, x: e.x + Math.cos(a) * (20 + Math.random() * 30), y: e.y + Math.sin(a) * (20 + Math.random() * 30),
          alpha: 0, duration: 220, onComplete: () => dot.destroy(),
        });
      }
    } else if (e.type === 'npcDeath') {
      this.spawnDeath(e.x, e.y, e.angle, e.sprite, e.genre);
    } else if (e.type === 'windowBroken') {
      const pane = this.world.windows.find((w) => w.id === e.id);
      if (pane) this.breakWindow(pane, e.x, e.y, e.angle);
    } else if (e.type === 'reloadStart') {
      const h = this.world.heroes[e.hero];
      if (h && !h.gone) this.ejectClip(h);
    } else if (e.type === 'ultiCast') {
      // début du lancement : des anneaux se referment sur le robot
      const h = this.world.heroes[e.hero];
      if (h) {
        for (let i = 0; i < 3; i++) {
          const ring = scene.add.circle(h.x, h.y, 150).setStrokeStyle(5, (ULTI_COLORS[h.def.kind] ?? ULTI_COLORS.BatBot).main).setDepth(DEPTH.fx).setAlpha(0);
          scene.tweens.add({ targets: ring, scale: 0.2, alpha: { from: 0.9, to: 0 }, duration: 520, delay: i * 170, onComplete: () => ring.destroy() });
        }
      }
    } else if (e.type === 'ultiLeap') {
      // il quitte le sol : un souffle de poussière
      const h = this.world.heroes[e.hero];
      if (h) {
        const dust = scene.add.circle(h.ultiFromX, h.ultiFromY, 50).setStrokeStyle(10, 0xd8d8de).setDepth(DEPTH.remains).setAlpha(0.7);
        scene.tweens.add({ targets: dust, scale: 2.6, alpha: 0, duration: 380, onComplete: () => dust.destroy() });
      }
    } else if (e.type === 'ultiImpact') {
      if (scene.textures.exists(frameKey('spr_BatBot_ulti_blast', 0))) {
        const info = this.info('spr_BatBot_ulti_blast');
        // l'anneau de choc dessiné va jusqu'à 238 px du centre : on l'ajuste au rayon réel de l'explosion
        const blast = this.image('spr_BatBot_ulti_blast', 0, e.x, e.y, DEPTH.fx + 2).setScale(e.radius / 238);
        this.anims.push({ img: blast, sprite: 'spr_BatBot_ulti_blast', frames: info.frames, fps: info.speed, elapsed: 0, keepLast: false });
        this.keepRemains(this.image('spr_BatBot_ulti_crater', 0, e.x, e.y, DEPTH.remains - 2).setRotation(Math.random() * Math.PI * 2).setScale(e.radius / 400).setAlpha(0.75));
      }
      // l'explosion des battes d'avant (GD-031), puis un nuage de poussière qui cache BatBot et se dissipe vite
      if (this.nearView(e.x, e.y)) this.blastFx(e.x, e.y, e.radius * 0.6);
      if (scene.textures.exists(frameKey('spr_ulti_dust', 0))) {
        const info = this.info('spr_ulti_dust');
        const dust = this.image('spr_ulti_dust', 0, e.x, e.y, DEPTH.fx + 40).setScale(1.25).setRotation(Math.random() * Math.PI * 2);
        this.anims.push({ img: dust, sprite: 'spr_ulti_dust', frames: info.frames, fps: info.speed, elapsed: 0, keepLast: false });
      }
      if (this.nearView(e.x, e.y)) scene.cameras.main.shake(420, 0.016);
    } else if (e.type === 'ultiFx') {
      // un ulti part : un éclat à la couleur du robot (ou l'onde de la grenade quand elle éclate)
      const color = (ULTI_COLORS[e.kind] ?? ULTI_COLORS.EngiBot).main;
      const big = e.kind === 'emp';
      // BadaBot : l'éclat naît là où ses boucliers se heurtent, devant lui, et le choc secoue l'écran
      const bada = e.kind === 'BadaBot' ? this.world.heroOf('BadaBot') : null;
      const reach = bada ? CONFIG.ulti.badaBot.start : 0;
      const fx = e.x + (bada ? Math.cos(bada.angle) * reach : 0);
      const fy = e.y + (bada ? Math.sin(bada.angle) * reach : 0);
      const flash = scene.add.circle(fx, fy, big ? 220 : 90, color).setDepth(DEPTH.fx + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.75);
      scene.tweens.add({ targets: flash, alpha: 0, scale: big ? 2.6 : 2, duration: big ? 380 : 260, onComplete: () => flash.destroy() });
      if (bada) {
        const spark = scene.add.circle(fx, fy, 34, 0xffffff).setDepth(DEPTH.fx + 2).setBlendMode(Phaser.BlendModes.ADD);
        scene.tweens.add({ targets: spark, alpha: 0, scale: 2.4, duration: 140, onComplete: () => spark.destroy() });
      }
      if ((big || bada) && this.nearView(e.x, e.y)) scene.cameras.main.shake(big ? 260 : 220, big ? 0.009 : 0.013);
    } else if (e.type === 'heroDead') {
      // l'écran ne tremble que pour ce qui arrive près de soi
      if (this.nearView(e.x, e.y)) scene.cameras.main.shake(300, 0.01);
    } else if (e.type === 'heroHit') {
      for (const h of this.world.heroes) if (Math.hypot(e.x - h.x, e.y - h.y) < 4) this.partsOf(h).hurt = 0.14;
      const mine = this.world.hero;
      if (Math.hypot(e.x - mine.x, e.y - mine.y) < 4) scene.cameras.main.shake(90, 0.004);
    } else if (e.type === 'drillDestroyed') {
      scene.cameras.main.shake(400, 0.012);
      if (scene.textures.exists(frameKey('spr_explosion_robot', 0))) {
        const sp = this.info('spr_explosion_robot');
        for (let i = 0; i < 5; i++) {
          const img = this.image('spr_explosion_robot', 0, e.x + (Math.random() - 0.5) * 900, e.y + (Math.random() - 0.5) * 900, DEPTH.fx).setScale(2 + Math.random() * 2);
          this.anims.push({ img, sprite: 'spr_explosion_robot', frames: sp.frames, fps: spriteFps(sp), elapsed: -i * 0.12, keepLast: false });
        }
      }
    } else if (e.type === 'shieldBroken') {
      for (let i = 0; i < 14; i++) {
        const a = Math.random() * Math.PI * 2;
        const dot = scene.add.rectangle(e.x, e.y, 10, 5, 0x9fd9ff).setRotation(a).setDepth(DEPTH.fx);
        scene.tweens.add({ targets: dot, x: e.x + Math.cos(a) * (80 + Math.random() * 90), y: e.y + Math.sin(a) * (80 + Math.random() * 90), alpha: 0, duration: 450, onComplete: () => dot.destroy() });
      }
      const ring = scene.add.circle(e.x, e.y, 40).setStrokeStyle(5, 0xffffff).setDepth(DEPTH.fx);
      scene.tweens.add({ targets: ring, scale: 2.4, alpha: 0, duration: 350, onComplete: () => ring.destroy() });
    } else if (e.type === 'checkpoint') {
      for (let i = 0; i < 3; i++) {
        const ring = scene.add.circle(e.x, e.y, 40).setStrokeStyle(6, 0x7fd9ff).setDepth(DEPTH.fx);
        scene.tweens.add({ targets: ring, scale: 7, alpha: 0, duration: 900, delay: i * 200, onComplete: () => ring.destroy() });
      }
    } else if (e.type === 'heal') {
      const plus = scene.add.text(e.x, e.y - 50, '+1', { fontFamily: 'Aldo', fontSize: '36px', color: '#6dff8a', stroke: '#000000', strokeThickness: 5 })
        .setOrigin(0.5).setDepth(DEPTH.worldText);
      scene.tweens.add({ targets: plus, y: e.y - 120, alpha: 0, duration: 700, onComplete: () => plus.destroy() });
    } else if (e.type === 'turretFolded') {
      const ring = scene.add.circle(e.x, e.y, 30).setStrokeStyle(3, 0xff6b6b).setDepth(DEPTH.fx);
      scene.tweens.add({ targets: ring, scale: 0.1, alpha: 0, duration: 250, onComplete: () => ring.destroy() });
    } else if (e.type === 'outletTick') {
      const ring = scene.add.circle(e.x, e.y, 20).setStrokeStyle(3, 0xffe36b).setDepth(DEPTH.fx);
      scene.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 400, onComplete: () => ring.destroy() });
    }
  }

  private breakWindow(pane: WindowPane, x: number, y: number, angle: number): void {
    const img = this.windowImgs.get(pane.id);
    if (img) this.setFrame(img, pane.sprite, 1);
    if (!this.scene.textures.exists(frameKey('spr_fenetre_eclats', 0))) return;
    const variants = this.info('spr_fenetre_eclats').frames;
    const o = pane.obstacle;
    // la vitre s'étend sur le grand côté de sa boîte
    const along = o.hw >= o.hh ? { x: o.cos, y: o.sin, half: o.hw } : { x: -o.sin, y: o.cos, half: o.hh };
    for (let i = 0; i < 22; i++) {
      const s = (Math.random() - 0.5) * 2 * along.half * 0.9;
      const shard = this.image('spr_fenetre_eclats', Math.floor(Math.random() * variants), x + along.x * s, y + along.y * s, DEPTH.remains)
        .setRotation(Math.random() * Math.PI * 2).setScale(1 + Math.random() * 0.8);
      // projetés du côté opposé au tireur, en éventail (comme dans l'original)
      const a = angle + (Math.random() - 0.5) * 1.1;
      const speed = 250 + Math.random() * 650;
      this.toss({ img: shard, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, spin: (Math.random() - 0.5) * 12 });
      this.keepRemains(shard);
    }
  }

  private spawnDeath(x: number, y: number, angle: number, sprite: string, genre: 'humain' | 'robot'): void {
    const scene = this.scene;
    const robot = genre === 'robot';
    // tous les humains explosent comme le soldat au pistolet, civils compris (GD-067)
    const burst = !robot && scene.textures.exists(frameKey(HUMAN_BURST, 0)) ? HUMAN_BURST : sprite;
    if (scene.textures.exists(frameKey(burst, 0))) {
      const sp = this.info(burst);
      const img = this.image(burst, 0, x, y, DEPTH.character).setRotation(angle).setScale(robot ? 1 : GORE.burst);
      this.anims.push({ img, sprite: burst, frames: sp.frames, fps: spriteFps(sp), elapsed: 0, keepLast: false });
    }
    if (!robot) this.spillBlood(x, y);
    if (robot) {
      // un robot détruit explose et laisse une vraie carcasse (GD-031)
      if (sprite !== 'spr_explosion_robot' && scene.textures.exists(frameKey('spr_explosion_robot', 0))) {
        const sp = this.info('spr_explosion_robot');
        const boom = this.image('spr_explosion_robot', 0, x, y, DEPTH.fx).setRotation(Math.random() * Math.PI * 2).setScale(0.9);
        this.anims.push({ img: boom, sprite: 'spr_explosion_robot', frames: sp.frames, fps: spriteFps(sp), elapsed: 0, keepLast: false });
      }
    }
    // l'huile d'un robot ; le sang d'un humain est versé par spillBlood
    const puddle = 'spr_membreMortRobot_huile';
    if (robot && scene.textures.exists(frameKey(puddle, 0))) {
      const count = 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const scale = 1.3 + Math.random() * 0.7;
        const img = this.image(puddle, Math.floor(Math.random() * this.info(puddle).frames), x + (Math.random() - 0.5) * 90, y + (Math.random() - 0.5) * 90, DEPTH.remains - 1)
          .setRotation(Math.random() * Math.PI * 2).setScale(scale);
        this.keepRemains(img);
        this.addPuddle(img, scale, FOOTPRINTS.oil);
      }
    }
    const prefix = robot ? 'spr_membreMortRobot_' : 'spr_membreMortHumain_';
    const pieces = robot ? 14 + Math.floor(Math.random() * 9) : GORE.pieces[0] + Math.floor(Math.random() * (GORE.pieces[1] - GORE.pieces[0] + 1));
    for (let i = 0; i < pieces; i++) {
      const name = `${prefix}${1 + Math.floor(Math.random() * 11)}`;
      if (!scene.textures.exists(frameKey(name, 0))) continue;
      const img = this.image(name, 0, x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, DEPTH.remains)
        .setRotation(Math.random() * Math.PI * 2).setScale(robot ? 1.3 + Math.random() * 0.9 : 1);
      const a = Math.random() * Math.PI * 2;
      const speed = (20 + Math.random() * 20) * STEPS_PER_SECOND * 0.5;
      this.toss({ img, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, spin: 1 + Math.random() * 3 });
      this.keepRemains(img);
    }
  }

  /**
   * Le sang d'un humain qui meurt (GD-067) : un souffle rouge, une flaque qui s'étale sous lui, des gouttes qui
   * giclent tout autour et vont s'écraser sur le sol ou sur les murs, et des éclaboussures sur les personnages
   * qui se tenaient près de lui.
   */
  private spillBlood(x: number, y: number): void {
    const scene = this.scene;
    const sang = 'spr_membreMortHumain_sang';
    if (!scene.textures.exists(frameKey(sang, 0))) return;
    const frames = this.info(sang).frames;
    const within = (range: number[]): number => range[0] + Math.random() * (range[1] - range[0]);
    const frame = (): number => Math.floor(Math.random() * frames);
    // le souffle : un disque rouge qui s'ouvre d'un coup et se dissipe
    const mist = scene.add.circle(x, y, 60, 0xb5161c).setAlpha(0.4).setDepth(DEPTH.remains + 2);
    scene.tweens.add({ targets: mist, scale: 2.6, alpha: 0, duration: 260, ease: 'Cubic.easeOut', onComplete: () => mist.destroy() });
    // la flaque : des nappes qui s'étalent
    const pools = Math.round(within(GORE.pool.count));
    for (let i = 0; i < pools; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = i === 0 ? 0 : Math.random() * GORE.pool.spread;
      const scale = within(GORE.pool.scale);
      const img = this.image(sang, frame(), x + Math.cos(a) * d, y + Math.sin(a) * d, DEPTH.remains - 1).setRotation(Math.random() * Math.PI * 2).setScale(scale * 0.25);
      scene.tweens.add({ targets: img, scale, duration: GORE.pool.growMs * (0.7 + Math.random() * 0.6), ease: 'Cubic.easeOut' });
      this.keepRemains(img);
      this.addPuddle(img, scale, FOOTPRINTS.blood);
    }
    // les gouttes : beaucoup retombent près, quelques-unes partent loin ; un mur les arrête
    const count = Math.round(within(GORE.drops.count));
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const reach = GORE.drops.near + (GORE.drops.far - GORE.drops.near) * Math.pow(Math.random(), 1.8);
      const hit = this.world.collision.raycast(x, y, x + Math.cos(a) * reach, y + Math.sin(a) * reach, BLOCK_MOVE);
      // sur un mur, la tache se pose juste au-delà de son bord
      const dist = hit ? reach * hit.t + 5 + Math.random() * 9 : reach;
      const img = this.image(sang, frame(), x, y, DEPTH.fx).setRotation(a).setScale(0.2, 0.1);
      this.drops.push({
        img, x0: x, y0: y, x1: x + Math.cos(a) * dist, y1: y + Math.sin(a) * dist, age: 0,
        flight: within(GORE.drops.flight) * (0.55 + 0.45 * (dist / GORE.drops.far)), size: within(GORE.drops.stain), onWall: hit !== null,
      });
    }
    // les personnages tout près sont éclaboussés, du côté tourné vers le corps
    const splash = (on: 'hero' | 'npc', id: number, tx: number, ty: number, angle: number, radius: number): void => {
      const d = Math.hypot(tx - x, ty - y);
      if (d < 1 || d > GORE.splash.range || this.world.collision.raycast(x, y, tx, ty, BLOCK_MOVE)) return;
      const marks = Math.max(1, Math.round(within(GORE.splash.marks) * (1 - (0.5 * d) / GORE.splash.range)));
      const toward = Math.atan2(y - ty, x - tx) - angle;
      for (let i = 0; i < marks; i++) {
        const a = toward + (Math.random() - 0.5) * 1.8;
        const r = radius * (0.25 + Math.random() * 0.55);
        const img = this.image(sang, frame(), tx, ty, DEPTH.character + 0.4).setScale(0.2 + Math.random() * 0.3).setAlpha(0);
        // la tache apparaît quand les gouttes arrivent
        this.stains.push({ img, on, id, lx: Math.cos(a) * r, ly: Math.sin(a) * r, turn: Math.random() * Math.PI * 2, age: -(0.08 + d / 900) });
      }
    };
    for (const h of this.world.heroes) if (!h.gone && h.state !== 'dead') splash('hero', h.id, h.x, h.y, h.angle, h.def.radius);
    for (const npc of this.world.npcs) splash('npc', npc.id, npc.x, npc.y, npc.angle, npc.def.radius);
  }

  /** Retient une flaque dans laquelle on peut marcher : une nappe de sang ou d'huile, à l'échelle `scale`. */
  private addPuddle(img: Img, scale: number, color: number): void {
    // les sprites de flaque font une cinquantaine de pixels ; leur tache en couvre les quatre cinquièmes
    this.puddles.push({ img, x: img.x, y: img.y, r: 20 * scale, color });
    if (this.puddles.length > FOOTPRINTS.maxPuddles) this.puddles.shift();
  }

  /** Traces de pas (GD-069) : chaque personnage qui a marché dans une flaque laisse ses empreintes derrière lui. */
  private stepFootprints(): void {
    this.walkStamp++;
    for (const h of this.world.heroes) {
      // ni en dash, ni en l'air, ni pendant l'arrivée : ses pieds ne touchent pas le sol
      const grounded = !h.gone && h.state !== 'dead' && h.deploySteps === 0 && h.arrivalSteps === 0 && !h.dashing && h.ultiPhase !== ULTI_ACTION;
      this.walk(`h${h.id}`, h.x, h.y, HERO_FEET[h.def.kind] ?? HERO_FEET.PetBot, grounded);
    }
    for (const npc of this.world.npcs) {
      this.walk(`n${npc.id}`, npc.x, npc.y, npc.def.genre === 'humain' ? HUMAN_FEET : ROBOT_FEET[npc.object] ?? BIG_ROBOT_FEET, true);
    }
    // on oublie de temps en temps ceux qui ont disparu
    if (this.walkStamp % 300 === 0) {
      for (const [key, t] of this.walks) if (t.seen !== this.walkStamp) this.walks.delete(key);
    }
  }

  /** Un personnage a bougé : il se salit les pieds dans une flaque, puis pose une empreinte à chaque foulée. */
  private walk(key: string, x: number, y: number, feet: Feet, grounded: boolean): void {
    let t = this.walks.get(key);
    if (!t) {
      t = { x, y, ink: 0, color: 0, side: 1, carry: 0, seen: 0 };
      this.walks.set(key, t);
    }
    t.seen = this.walkStamp;
    const dx = x - t.x;
    const dy = y - t.y;
    const d = Math.hypot(dx, dy);
    t.x = x;
    t.y = y;
    if (d < 0.05) return;
    // un saut (bond, projection, changement de salle) n'est pas un pas
    if (!grounded || d > 120) {
      t.carry = 0;
      return;
    }
    for (const p of this.puddles) {
      if (Math.abs(x - p.x) < p.r && Math.abs(y - p.y) < p.r && p.img.active && Math.hypot(x - p.x, y - p.y) < p.r) {
        t.ink = 1;
        t.color = p.color;
        break;
      }
    }
    if (t.ink <= 0) return;
    t.carry += d;
    if (t.carry < feet.stride) return;
    t.carry = 0;
    // l'empreinte : dans le sens de la marche, un pied puis l'autre, de part et d'autre de l'axe
    const a = Math.atan2(dy, dx);
    // de moins en moins nette à mesure que les pieds sèchent ; et jamais deux fois tout à fait la même :
    // un pied ne se pose pas au millimètre
    const wear = Math.min(FOOTPRINT_WEARS - 1, Math.floor((1 - t.ink) * FOOTPRINT_WEARS + Math.random() * 1.3));
    const print = this.footprintTexture(feet.shape, wear);
    const size = 0.93 + Math.random() * 0.14;
    const img = this.scene.add.image(
      x - Math.sin(a) * feet.gap * t.side + (Math.random() - 0.5) * 4, y + Math.cos(a) * feet.gap * t.side + (Math.random() - 0.5) * 4, print.key)
      .setRotation(a + (Math.random() - 0.5) * 0.22).setScale((feet.length / print.w) * size, (feet.width / print.h) * size)
      .setTint(t.color).setAlpha(FOOTPRINTS.alpha * t.ink * (0.8 + Math.random() * 0.2)).setDepth(DEPTH.remains - 1.5);
    this.keepRemains(img);
    t.side = -t.side;
    t.ink -= 1 / FOOTPRINTS.prints;
  }

  /**
   * Dessin d'une empreinte, pointe vers la droite, en blanc à teinter : le patin d'un héros (talon rond, semelle,
   * bout pointu), la chaussure d'un humain (semelle et talon séparés) ou la griffe d'un robot ennemi.
   * Une empreinte réelle n'est jamais nette : le dessin est légèrement flou, ses bords sont grignotés, il a des
   * manques là où le pied n'a pas porté, des traînées sèches dans le sens de la marche et quelques
   * éclaboussures autour. `wear`, de 0 à FOOTPRINT_WEARS - 1 : plus il est grand, plus l'empreinte est
   * incomplète. `w` et `h` : taille de la forme dans l'image, qui garde une marge autour d'elle.
   */
  private footprintTexture(shape: Feet['shape'], wear: number): { key: string; w: number; h: number } {
    const key = `footprint_${shape}_${wear}`;
    const w = 64;
    const h = 24;
    if (this.scene.textures.exists(key)) return { key, w, h };
    const margin = 6;
    const canvas = this.scene.textures.createCanvas(key, w + margin * 2, h + margin * 2);
    if (!canvas) return { key, w, h };
    const ctx = canvas.context;
    // un tirage fixe par dessin : les mêmes empreintes à chaque partie
    let seed = 7919 * (wear + 1) + shape.length * 104729;
    const random = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const mid = margin + h / 2;
    const at = (x: number): number => margin + x;
    ctx.fillStyle = '#ffffff';
    // un léger flou, là où le navigateur le permet : le liquide bave un peu
    if ('filter' in ctx) ctx.filter = 'blur(0.9px)';
    if (shape === 'pad') {
      // le talon, rond comme l'articulation du pied
      ctx.beginPath();
      ctx.arc(at(12), mid, 11, 0, Math.PI * 2);
      ctx.fill();
      // la semelle, séparée du talon par une rainure, et le bout pointu
      ctx.beginPath();
      ctx.moveTo(at(27), mid - 9);
      ctx.lineTo(at(46), mid - 8);
      ctx.lineTo(at(63), mid);
      ctx.lineTo(at(46), mid + 8);
      ctx.lineTo(at(27), mid + 9);
      ctx.closePath();
      ctx.fill();
    } else if (shape === 'shoe') {
      // le talon, court, puis la semelle, plus large à l'avant
      ctx.beginPath();
      ctx.ellipse(at(10), mid, 9, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(at(42), mid, 21, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // la griffe du milieu, longue, et deux plus courtes qui s'écartent
      const claw = (angle: number, length: number, girth: number): void => {
        const c = Math.cos(angle);
        const s = Math.sin(angle);
        ctx.beginPath();
        ctx.moveTo(at(10) + s * girth, mid - c * girth);
        ctx.lineTo(at(10) + c * length, mid + s * length);
        ctx.lineTo(at(10) - s * girth, mid + c * girth);
        ctx.closePath();
        ctx.fill();
      };
      ctx.beginPath();
      ctx.arc(at(10), mid, 7, 0, Math.PI * 2);
      ctx.fill();
      claw(0, 53, 5.5);
      claw(-0.34, 30, 4);
      claw(0.34, 30, 4);
    }
    if ('filter' in ctx) ctx.filter = 'none';
    // quelques éclaboussures autour, avant l'usure : elles s'effacent avec le reste
    for (let i = 0; i < 5; i++) {
      ctx.globalAlpha = 0.5 + random() * 0.4;
      ctx.beginPath();
      ctx.arc(at(random() * w), mid + (random() < 0.5 ? -1 : 1) * (h / 2 - 2 + random() * 5), 0.7 + random() * 1.3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // l'usure : on retire de la matière
    ctx.globalCompositeOperation = 'destination-out';
    // des manques ronds, partout : au bord ils grignotent le contour, au milieu ils font des trous
    const holes = 26 + wear * 20;
    for (let i = 0; i < holes; i++) {
      ctx.globalAlpha = 0.35 + random() * 0.65;
      ctx.beginPath();
      ctx.arc(at(random() * w), margin + random() * h, 0.8 + random() * (2 + wear * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
    // des traînées sèches dans le sens de la marche
    for (let i = 0; i < 2 + wear; i++) {
      ctx.globalAlpha = 0.45 + random() * 0.4;
      const from = random() * w * 0.7;
      ctx.fillRect(at(from), margin + random() * h, 10 + random() * 26, 0.8 + random() * 1.6);
    }
    // un pied qui sèche ne marque plus partout : l'arrière ou l'avant s'efface en fondu
    if (wear >= 1) {
      const back = random() < 0.5;
      const reach = w * (0.18 + 0.12 * wear);
      const fade = ctx.createLinearGradient(back ? margin : margin + w, 0, back ? margin + reach : margin + w - reach, 0);
      fade.addColorStop(0, `rgba(0,0,0,${Math.min(1, 0.35 + 0.22 * wear)})`);
      fade.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, w + margin * 2, h + margin * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    canvas.refresh();
    return { key, w, h };
  }

  /** Fait voler les gouttes de sang jusqu'à leur tache, et suivre aux éclaboussures le personnage qui les porte. */
  private stepBlood(dt: number): void {
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.age += dt;
      const t = Math.min(1, d.age / d.flight);
      // partie vite, elle ralentit en arrivant
      const e = 1 - (1 - t) * (1 - t);
      d.img.setPosition(d.x0 + (d.x1 - d.x0) * e, d.y0 + (d.y1 - d.y0) * e);
      if (t < 1) continue;
      // elle s'écrase : une tache étirée dans le sens du vol, qui reste
      d.img.setScale(d.size * (1.3 + Math.random() * 0.9), d.size * (0.7 + Math.random() * 0.4)).setAlpha(0.92)
        .setDepth(d.onWall ? DEPTH.wallThick + 1 : DEPTH.remains - 1);
      this.keepRemains(d.img);
      this.drops.splice(i, 1);
    }
    const { life, fade } = GORE.splash;
    for (let i = this.stains.length - 1; i >= 0; i--) {
      const s = this.stains[i];
      s.age += dt;
      const who = s.on === 'hero' ? this.world.heroes.find((h) => h.id === s.id && !h.gone && h.state !== 'dead') : this.world.npcs.find((n) => n.id === s.id);
      if (!who || s.age >= life) {
        s.img.destroy();
        this.stains.splice(i, 1);
        continue;
      }
      if (s.age < 0) continue;
      const at = localToWorld(who.x, who.y, who.angle, s.lx, s.ly);
      s.img.setPosition(at.x, at.y).setRotation(who.angle + s.turn)
        .setAlpha(0.9 * Math.min(1, s.age / 0.05) * Math.min(1, (life - s.age) / fade));
    }
  }

  /** Les restes (flaques, débris, éclats) restent au sol ; les plus anciens sont retirés au-delà d'une limite. */
  private keepRemains(img: Img): void {
    this.remains.push(img);
    while (this.remains.length > MAX_REMAINS) {
      const old = this.remains.shift() as Img;
      const i = this.debris.findIndex((d) => d.img === old);
      if (i >= 0) this.debris.splice(i, 1);
      old.destroy();
    }
  }

  private stepAnims(dt: number): void {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.elapsed += dt;
      const frame = Math.floor(Math.max(0, a.elapsed) * a.fps);
      if (frame >= a.frames) {
        if (!a.keepLast) a.img.destroy();
        this.anims.splice(i, 1);
      } else {
        this.setFrame(a.img, a.sprite, frame);
      }
    }
  }

  /** Lance un débris : il vole, puis reste au sol. */
  private toss(d: Debris): void {
    this.loose.add(d.img);
    this.debris.push(d);
  }

  private stepDebris(dt: number): void {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      if (d.glide && d.glide > 0) {
        // emporté par la vague de BadaBot : tout droit et sans ralentir, par petits pas, jusqu'au premier mur
        const dist = Math.hypot(d.vx, d.vy) * dt;
        const hops = Math.max(1, Math.ceil(dist / 16));
        let x = d.img.x;
        let y = d.img.y;
        let free = true;
        for (let j = 0; j < hops && free; j++) {
          const nx = x + (d.vx * dt) / hops;
          const ny = y + (d.vy * dt) / hops;
          free = this.world.collision.circleFree(nx, ny, 4, BLOCK_MOVE);
          if (free) {
            x = nx;
            y = ny;
          }
        }
        d.img.setPosition(x, y);
        d.img.rotation += d.spin * dt;
        d.glide = free ? d.glide - dist : 0;
        if (!free) {
          d.vx *= -0.12;
          d.vy *= -0.12;
        }
        continue;
      }
      const nx = d.img.x + d.vx * dt;
      const ny = d.img.y + d.vy * dt;
      if (this.world.collision.circleFree(nx, ny, 4, BLOCK_MOVE)) {
        d.img.setPosition(nx, ny);
      } else {
        d.vx *= -0.5;
        d.vy *= -0.5;
      }
      d.img.rotation += d.spin * dt;
      const decay = Math.max(0, 1 - 6 * dt);
      d.vx *= decay;
      d.vy *= decay;
      if (Math.abs(d.vx) + Math.abs(d.vy) < 8) this.debris.splice(i, 1);
    }
  }

  /** Point suivi par la caméra : le bout du canon du héros. */
  cameraTarget(): { x: number; y: number } {
    const h = this.world.hero;
    return h.state === 'dead' ? { x: h.x, y: h.y } : muzzlePosition(h);
  }
}

/** Vitesse d'animation d'un sprite GameMaker en images par seconde. */
export function spriteFps(sp: SpriteInfo): number {
  return sp.speedType === 0 ? sp.speed : sp.speed * STEPS_PER_SECOND;
}

export const VIEW = { width: CONFIG.camera.viewWidth, height: CONFIG.camera.viewHeight };
