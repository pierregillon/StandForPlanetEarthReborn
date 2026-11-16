// Réglages d'équilibrage du jeu, regroupés ici (voir GD-013).
// Unités : pixels, « steps » (1 step = 1/60 s, comme le jeu d'origine), px/step, degrés.
// Sauf mention « remake », les valeurs viennent du code GameMaker de 2019
// (voir docs/reference/jeu-original/). Les écarts sont tracés dans docs/decisions/game-design.md.

export const STEPS_PER_SECOND = 60;
const s = (seconds: number): number => Math.round(seconds * STEPS_PER_SECOND);

export type HeroKind = 'PetBot' | 'EngiBot' | 'BatBot' | 'BadaBot';

export interface HeroDef {
  /** Choisit la logique des tirs (src/sim/abilities.ts). */
  kind: HeroKind;
  name: string;
  walkSpeed: number;
  /** Rayon de collision (masque elliptique du sprite d'origine). */
  radius: number;
  maxHealth: number;
  rotateSpeedDeg: number;
  shotsPerSecond: number;
  precisionDeg: number;
  muzzle: { x: number; y: number };
  bullet: BulletDef;
  /** Remake (GD-005) : munitions illimitées, chargeur à recharger avec R. 0 = pas de munitions (BatBot). */
  magazine: number;
  reloadSteps: number;
  /** Délai minimal entre deux tirs secondaires (alarm[7] d'origine). */
  fire2CooldownSteps: number;
  sprites: { stand: string; move: string; shot: string; fire2: string | null; legs: string; dead: string; portrait: string; select: string };
  sounds: { fire1: string[]; fire2: string[] };
  /** Couleur du viseur laser, ou null s'il n'y en a pas. */
  laserColor: number | null;
  /** Résumé affiché à l'écran de choix du héros. */
  blurb: string;
}

export interface BulletDef {
  sprite: string;
  speed: number;
  maxDistance: number;
  damage: number;
  /** Rayon de contact contre les personnages. */
  radius: number;
  /** « bounce » : rebondit et ralentit (EngiBot) ; « plasma » : explose à l'impact (BadaBot). */
  kind?: 'bounce' | 'plasma';
  /** Échelle d'affichage du sprite. */
  scale?: number;
}

export interface SoldierDef {
  kind: 'soldier';
  genre: 'humain' | 'robot';
  maxHealth: number;
  normalSpeed: number;
  radius: number;
  attackRangeMin: number;
  attackRangeMax: number;
  shotsPerSecond: number;
  bulletsPerShot: number;
  precisionDeg: number;
  magazine: number;
  canReload: boolean;
  reloadSteps: number;
  muzzle: { x: number; y: number };
  bullet: BulletDef | null;
  /** Coup de bouclier au corps à corps (robot bouclier). */
  melee: boolean;
  /** Ne subit des dégâts que si l'impact vient de l'arrière. */
  frontShield: boolean;
  fireSound: string | null;
  sprites: { stand: string; move: string; shot: string; reload: string | null; dead: string };
}

export interface CivilDef {
  kind: 'civil';
  genre: 'humain';
  maxHealth: number;
  normalSpeed: number;
  radius: number;
  sprites: { stand: string; move: string; run: string; dead: string };
  runAnimFactor: number;
}

export type NpcDef = SoldierDef | CivilDef;

const enemyBullet = (sprite: string): BulletDef => ({ sprite, speed: 40, maxDistance: 1500, damage: 1, radius: 4 });

const civil = (move: string, run: string, dead: string, radius: number, runAnimFactor: number): CivilDef => ({
  kind: 'civil',
  genre: 'humain',
  maxHealth: 1,
  normalSpeed: 3,
  radius,
  sprites: { stand: move, move, run, dead },
  runAnimFactor,
});

export const CONFIG = {
  hero: {
    maxEnergy: 12,
    naturalEnergy: 3,
    /** +1 énergie toutes les 2 s sous le maximum naturel, −1 toutes les 2 s au-dessus. */
    energyTickSteps: s(2),
    energyPauseSteps: s(2),
    dashCharges: 2,
    dashDistance: 500,
    dashSpeedFactor: 3,
    dashRechargeSteps: s(2),
    /** Invulnérabilité après un dégât (durée de l'effet « glitch » d'origine). */
    // Original : 10 à 40 steps, avec la mort désactivée. Allongé pour un joueur seul qui peut mourir (GD-018).
    invulnMinSteps: 30,
    invulnMaxSteps: 60,
    bumpDistance: 350,
    bumpSpeed: 15,
    useRange: 120,
    cardDoorRange: 100,
    /** Marge par rapport aux bords de la salle. */
    roomMargin: 70,
    deathMenuDelaySteps: s(2.5),
    /** Temps à rester dans la zone de sortie pour quitter le niveau (« Leaving area »). */
    exitCountdownSteps: s(10),
  },

  heroes: {
    PetBot: {
      kind: 'PetBot',
      name: 'PetBot',
      walkSpeed: 10,
      radius: 40,
      maxHealth: 12,
      rotateSpeedDeg: 15,
      shotsPerSecond: 3,
      precisionDeg: 3,
      muzzle: { x: 90, y: 23 },
      bullet: { sprite: 'spr_bullet_PetBot', speed: 20, maxDistance: 1500, damage: 1, radius: 6 },
      magazine: 24, // remake : un quart de l'ancien stock de 99
      reloadSteps: s(1.2), // remake
      fire2CooldownSteps: 0,
      sprites: {
        stand: 'spr_PetBot_move', move: 'spr_PetBot_move', shot: 'spr_PetBot_shot', fire2: null,
        legs: 'spr_PetBot_jambes2', dead: 'spr_PetBot_mort', portrait: 'spr_cadre_PetBot', select: 'spr_selectionPetBot',
      },
      sounds: { fire1: ['snd_petBot_fire1'], fire2: [] },
      laserColor: 0x00ff00,
      blurb: 'Healer. Right click: 3 drones that explode, hurt enemies and heal you.',
    },
    EngiBot: {
      kind: 'EngiBot',
      name: 'EngiBot',
      walkSpeed: 13,
      radius: 40,
      maxHealth: 12,
      rotateSpeedDeg: 15,
      shotsPerSecond: 5,
      precisionDeg: 10,
      muzzle: { x: 43, y: 57 },
      bullet: { sprite: 'spr_EngiBot_bullet', speed: 40, maxDistance: 1500, damage: 1, radius: 6, kind: 'bounce' },
      magazine: 25, // remake : un quart de l'ancien stock de 100
      reloadSteps: s(1.4), // remake
      fire2CooldownSteps: s(0.5),
      sprites: {
        stand: 'spr_EngiBot_shot', move: 'spr_EngiBot_move', shot: 'spr_EngiBot_shot', fire2: 'spr_EngiBot_shotTuret',
        legs: 'spr_EngiBot_jambes', dead: 'spr_EngiBot_mort', portrait: 'spr_cadre_EngiBot', select: 'spr_selectionEngiBot',
      },
      sounds: { fire1: ['snd_engiBot_tourelleFire_3'], fire2: ['snd_engiBot_fire2'] },
      laserColor: 0xff0000,
      blurb: 'Fast gunner, bouncing bullets. Right click: drops a turret (3 energy).',
    },
    BatBot: {
      kind: 'BatBot',
      name: 'BatBot',
      walkSpeed: 10,
      radius: 40,
      maxHealth: 12,
      rotateSpeedDeg: 15,
      shotsPerSecond: 3,
      precisionDeg: 2,
      muzzle: { x: 65, y: 0 },
      bullet: { sprite: 'spr_batte_BatBot_d', speed: 25, maxDistance: 1500, damage: 3, radius: 20 },
      magazine: 0,
      reloadSteps: 0,
      fire2CooldownSteps: s(0.5),
      sprites: {
        stand: 'spr_BatBot_move_2', move: 'spr_BatBot_move_2', shot: 'spr_BatBot_fire1_d', fire2: 'spr_BatBot_fire2_d',
        legs: 'spr_BatBot_jambes2', dead: 'spr_BatBot_mort_2', portrait: 'spr_cadre_BatBot', select: 'spr_selectionBatBot',
      },
      sounds: { fire1: ['snd_batBot_fire1_1'], fire2: ['snd_batBot_fire2_1'] },
      laserColor: null,
      blurb: 'Melee with two bats. Right click: throw a bat. Hold: call the bats back.',
    },
    BadaBot: {
      kind: 'BadaBot',
      name: 'BadaBot',
      walkSpeed: 10,
      radius: 44,
      maxHealth: 12,
      rotateSpeedDeg: 15,
      shotsPerSecond: 10,
      precisionDeg: 3,
      muzzle: { x: 28, y: 0 },
      bullet: { sprite: 'spr_BadaBot_bullet', speed: 40, maxDistance: 1500, damage: 0, radius: 8, kind: 'plasma', scale: 0.25 },
      magazine: 25, // remake : un quart de l'ancien stock de 100
      reloadSteps: s(1.5), // remake
      fire2CooldownSteps: s(0.25),
      sprites: {
        stand: 'spr_BadaBot_stand', move: 'spr_BadaBot_move', shot: 'spr_BadaBot_stand', fire2: 'spr_BadaBot_fire2',
        legs: 'spr_BadaBot_jambes', dead: 'spr_BadaBot_mort', portrait: 'spr_cadre_BadaBot', select: 'spr_selectionBadaBot',
      },
      sounds: { fire1: ['snd_badaBot_fire1_1', 'snd_badaBot_fire1_2', 'snd_badaBot_fire1_3'], fire2: ['snd_badaBot_fire2_1', 'snd_badaBot_fire2_2', 'snd_badaBot_fire2_3'] },
      laserColor: 0xa000ff,
      blurb: 'Tank. Hold left click to charge up to 3 plasma balls. Right click: shield.',
    },
  } as Record<string, HeroDef>,

  /** Tirs secondaires et particularités de chaque héros (valeurs du code de 2019 sauf mention « remake »). */
  abilities: {
    petBot: {
      energyCost: 3,
      droneRanges: [550, 700, 850],
      droneMaxSpeed: 15,
      droneAcceleration: 0.5,
      droneSpreadDeg: 10,
      droneRadius: 16,
      explosionDamage: 3,
      /** Rayon de l'explosion par niveau (demi-largeur du masque de spr_PetDrone_explosion1..4). */
      explosionRadius: [98, 113, 150, 185],
      /** Soin de zone : 4 PV par seconde d'exposition, à partir de l'image 7 de l'explosion. */
      healPerStep: 4 / STEPS_PER_SECOND,
      healFromFrame: 7,
    },
    engiBot: {
      turretCost: 3,
      foldDistance: 20,
      turretThrowSpeed: 40,
      turretThrowDeceleration: 2,
      turretRange: 1000,
      turretRotateDeg: 6,
      turretPrecisionDeg: 5,
      turretRadius: 40,
      turretMuzzle: 60,
      turretBullet: { sprite: 'spr_bullet_pistol', speed: 40, maxDistance: 1500, damage: 1, radius: 4 } as BulletDef,
      placeAnimSteps: s(0.5),
      bulletDeceleration: 0.2,
      bulletMinSpeed: 1,
    },
    batBot: {
      swingSteps: 10,
      swingDamage: 1,
      /** Zone du coup de batte dans le repère du héros (masque de spr_bullet_BatBot_d). */
      swingBox: { x0: 32, y0: -98, x1: 126, y1: 95 },
      holdStepsForRecall: 15,
      recallCost: 1,
      throwAnimSteps: s(0.5),
      /** Par niveau de batte (1 à 4) : explosion éventuelle et batte perçante. */
      levels: [
        { explosionRadius: 0, explosionDamage: 0, pierce: false },
        { explosionRadius: 250, explosionDamage: 4, pierce: false },
        { explosionRadius: 500, explosionDamage: 7, pierce: false },
        { explosionRadius: 500, explosionDamage: 7, pierce: true },
      ],
      pickupDistance: 30,
    },
    badaBot: {
      fullChargeSteps: 60,
      chargePerBall: 20,
      precisionPerBallDeg: 3,
      explosionRadius: 50,
      explosionDamage: 20,
      /** Zone protégée par le bouclier dans le repère du héros (masque de spr_BadaBot_shield). */
      shieldBox: { x0: 18, y0: -79, x1: 104, y1: 78 },
      shieldRaiseSteps: 12,
      shieldSpeedFactor: 0.5,
      bulletsPerEnergy: 3,
    },
  },

  /** Remake (GD-006) : prises de courant. */
  outlet: {
    range: 280, // 110 à l'étape 1 : jugé trop court par l'utilisateur (GD-022)
    stepsPerEnergy: s(1),
    /** Les prises remplacent ces objets du niveau d'origine. */
    replacesObject: 'obj_bonus_ammo',
  },

  npc: {
    hearRange: 1000,
    viewRange: 800,
    viewRangeAlerted: 1600,
    patrolRange: 1500,
    patrolSpeed: 5,
    patrolPauseSteps: s(2),
    patrolPauseExtraSteps: [0, s(0.5), s(1), s(1.5), s(2)],
    activationRange: 4000,
    reactionSteps: s(0.8),
    chaseRepathSteps: s(0.5),
    waypointTimeoutSteps: s(1),
    maxWaypointFailures: 2,
    rotateSpeedDeg: 5,
    fearSteps: s(30),
    fearSpeedFactor: 2,
    chaseSpeedFactor: 2,
    /** Zone du coup de bouclier, relative au robot (boîte du sprite spr_npc2_bullet). */
    meleeBox: { x0: 26, y0: -62, x1: 75, y1: 59 },
  },

  npcs: {
    obj_npc_human_pistol: {
      kind: 'soldier', genre: 'humain', maxHealth: 1, normalSpeed: 5, radius: 36,
      attackRangeMin: 600, attackRangeMax: 950, shotsPerSecond: 3, bulletsPerShot: 1, precisionDeg: 3,
      magazine: 16, canReload: true, reloadSteps: s(0.7), muzzle: { x: 82, y: 7 },
      bullet: enemyBullet('spr_bullet_pistol'), melee: false, frontShield: false, fireSound: 'snd_pistolBot_fire1',
      sprites: { stand: 'spr_npc1_stand', move: 'spr_npc1_move', shot: 'spr_npc1_shot', reload: 'spr_npc1_reload', dead: 'spr_npc1_mort' },
    },
    obj_npc_robot_shield: {
      kind: 'soldier', genre: 'robot', maxHealth: 3, normalSpeed: 3, radius: 50,
      attackRangeMin: 150, attackRangeMax: 150, shotsPerSecond: 1, bulletsPerShot: 1, precisionDeg: 3,
      magazine: 25, canReload: false, reloadSteps: 0, muzzle: { x: 73, y: 0 },
      bullet: null, melee: true, frontShield: true, fireSound: null,
      sprites: { stand: 'spr_npc2_stand', move: 'spr_npc2_move', shot: 'spr_npc2_shot', reload: null, dead: 'spr_npc2_mort' },
    },
    obj_npc_robot_lightBot: {
      kind: 'soldier', genre: 'robot', maxHealth: 2, normalSpeed: 7, radius: 38,
      attackRangeMin: 800, attackRangeMax: 950, shotsPerSecond: 10, bulletsPerShot: 1, precisionDeg: 10,
      magazine: 13, canReload: false, reloadSteps: 0, muzzle: { x: 79, y: 24 },
      bullet: enemyBullet('spr_bullet_lightBot'), melee: false, frontShield: false, fireSound: 'snd_pistolBot_fire1',
      sprites: { stand: 'spr_npc_lightBot_marche', move: 'spr_npc_lightBot_marche', shot: 'spr_npc_lightBot_tir', reload: null, dead: 'spr_npc1_mort' },
    },
    obj_npc_robot_shotBot: {
      kind: 'soldier', genre: 'robot', maxHealth: 2, normalSpeed: 3, radius: 48,
      attackRangeMin: 600, attackRangeMax: 950, shotsPerSecond: 1, bulletsPerShot: 10, precisionDeg: 10,
      magazine: 10, canReload: false, reloadSteps: 0, muzzle: { x: 79, y: -35 },
      bullet: enemyBullet('spr_bullet_shotgun'), melee: false, frontShield: false, fireSound: 'snd_pistolBot_fire1',
      sprites: { stand: 'spr_npc_shotBot_marche', move: 'spr_npc_shotBot_marche', shot: 'spr_npc_shotBot_shot', reload: null, dead: 'spr_npc_shotBot_mort' },
    },
    obj_npc_civil_femme: civil('spr_npc_femme_move', 'spr_npc_femme_move', 'spr_npc_femme_mort', 30, 2),
    obj_npc_civil_handi: civil('spr_npc_handi_move', 'spr_npc_handi_move', 'spr_npc_handi_mort', 38, 2),
    obj_npc_civil_malette: civil('spr_npc_valise', 'spr_npc_valise_course', 'spr_npc_valise_mort', 25, 1),
    obj_npc_civil_ouvrier: civil('spr_npc_ouvrier_marche', 'spr_npc_ouvrier_cours', 'spr_npc_ouvier_mort', 33, 1),
    obj_npc_civil_scientifique: civil('spr_npc_scientifique_marche', 'spr_npc_scientifique_cours', 'spr_npc_scientifique_mort', 28, 1),
    obj_npc_civil_technicien: civil('spr_npc_techni_move', 'spr_npc_techni_course', 'spr_npc_techni_mort', 38, 1),
  } as Record<string, NpcDef>,

  door: {
    /**
     * Longueur du battant (px) à chaque image de l'animation d'ouverture, mesurée sur les masques des sprites :
     * la porte se rétracte d'un bloc vers le bord gauche du sprite.
     */
    panelLength: {
      spr_automaticDoor: [256, 256, 256, 256, 252, 243, 225, 148, 41, 23, 19, 16],
      spr_door: [256, 256, 256, 256, 256, 256, 256, 256, 256, 252, 243, 225, 143, 40, 22, 18, 16],
    } as Record<string, number[]>,
  },

  nav: {
    cellSize: 32,
    /** Marge gardée entre les chemins des PNJ et les obstacles. */
    clearance: 30,
    maxExpansions: 40000,
  },

  camera: {
    viewWidth: 1920,
    viewHeight: 1080,
    smoothing: 20,
  },
};
