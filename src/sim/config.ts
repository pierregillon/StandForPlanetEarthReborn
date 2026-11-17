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

export interface BossDef {
  kind: 'boss';
  genre: 'robot';
  maxHealth: number;
  normalSpeed: number;
  radius: number;
  sprites: { stand: string; move: string; dead: string };
}

export type NpcDef = SoldierDef | CivilDef | BossDef;

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
    // GD-029 : le surplus (au-dessus de 3) tient 15 s après le débranchement, puis perd 1 point toutes les 5 s.
    // Dans l'original : -1 toutes les 2 s, sans délai.
    overchargeHoldSteps: s(15),
    overchargeDecaySteps: s(5),
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
    // GD-031 : +4 % de vitesse par point d'énergie au-dessus de 3 (jusqu'à +36 % à 12)
    overchargeSpeedBonus: 0.04,
    /** Durée maximale de l'animation de déploiement au début d'une partie. */
    maxDeploySteps: s(2.2),
    /** Rayon d'activation du point de sauvegarde devant le boss. */
    checkpointRadius: 170,
    /** Temps à rester dans la zone de sortie pour quitter le niveau (« Leaving area »). */
    exitCountdownSteps: s(5),
    /**
     * Collision légère entre héros (GD-041) : deux robots plus proches que cette part de la somme de leurs
     * rayons s'écartent, d'au plus `teamPushSpeed` px par step. On peut donc se croiser, pas rester superposés.
     */
    teamSpacing: 0.9,
    teamPushSpeed: 4,
  },

  heroes: {
    PetBot: {
      kind: 'PetBot',
      name: 'PetBot',
      walkSpeed: 11.5, // 10 dans l'original ; +15 % (GD-031)
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
      walkSpeed: 15, // 13 dans l'original ; +15 % (GD-031)
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
      walkSpeed: 11.5, // 10 dans l'original ; +15 % (GD-031)
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
      walkSpeed: 11.5, // 10 dans l'original ; +15 % (GD-031)
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
      /** Coût de la salve de drones. Depuis GD-043, elle est toujours de niveau 1 : la surcharge sert à l'ulti. */
      energyCost: 3,
      droneRanges: [550, 700, 850],
      /**
       * Place des trois mini-bots qui accompagnent PetBot (GD-045), dans son repère (x vers l'avant) :
       * épaule gauche, épaule droite, tête. Ce sont eux qui partent quand il lance sa salve.
       */
      petOffsets: [{ x: -8, y: -68 }, { x: -8, y: 68 }, { x: -62, y: 0 }],
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
      /** Position des mains dans le repère du héros (relativeBras* d'origine) : les battes y reviennent. */
      hand: { x: 17, y: 50 },
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
      shieldSpeedFactor: 0.75, // 0,5 dans l'original ; la mobilité prime (GD-031)
      bulletsPerEnergy: 3,
    },
  },

  /** Remake (GD-006) : prises de courant. */
  /** Link entre héros (GD-043). */
  link: {
    /** En deçà de cette distance, le lien débite à plein ; au-delà il faiblit, jusqu'à `minFactor` à `maxRange`, où il casse. */
    fullRange: 350,
    maxRange: 1000,
    minFactor: 0.6,
    /** Écart toléré entre la ligne de visée et le coéquipier qu'on veut lier. */
    aimWidth: 170,
    /**
     * Steps par point d'énergie reçu quand toute l'équipe est liée de près au même robot : 0,75 s (doublé par
     * GD-044), contre 2 s pour la régénération naturelle d'un seul. Chaque lien porte sa part (ce délai multiplié par le nombre de
     * coéquipiers), si bien qu'à deux joueurs un lien débite autant que trois liens à quatre.
     */
    teamStepsPerEnergy: s(0.75),
  },
  /** Attaque ultime (GD-043) : à pleine surcharge, 2 s de lancement immobile, puis le coup. */
  ulti: {
    castSteps: s(2),
    /** Après le coup, le robot met un instant à reprendre la main. */
    recoverSteps: 24,
    /** BatBot : bond vers le point visé, explosion à l'atterrissage. */
    batBot: { range: 760, leapSteps: 26, radius: 360, damage: 14 },
    /** PetBot : l'essaim de nanomachines le suit et soigne tous les alliés dans son rayon. */
    petBot: { steps: s(8), radius: 420, healPerStep: 1.5 / STEPS_PER_SECOND },
    /**
     * BadaBot (GD-051) : il frappe ses deux boucliers, une vague d'énergie en jaillit et file droit devant lui.
     * Elle fait la largeur des deux boucliers, parcourt un écran et projette tout ce qu'elle rencontre à deux
     * écrans de là. `start` : distance entre BadaBot et le point où la vague naît.
     * C'est une onde, pas un objet (GD-052) : elle est découpée en `strips` bandes côte à côte, et chacune
     * s'arrête à son propre obstacle pendant que les autres continuent. `damage` : dégâts au contact.
     */
    badaBot: { start: 70, halfWidth: 100, strips: 16, speed: 40, range: 1920, damage: 14, throwDistance: 3840, dazeSteps: s(1.5), fadeSteps: 10 },
    /** EngiBot : la grenade vole puis éclate ; les robots ennemis du rayon sont désactivés. */
    engiBot: { range: 760, flySteps: 34, pulseSteps: 45, radius: 750, stunSteps: s(6) },
  },
  /** Résurrection d'un coéquipier à terre (scr_resurectAllie de l'original ; l'invulnérabilité au réveil est ajoutée). */
  revive: { range: 100, steps: s(3), energyCost: 3, hp: 3, invulnSteps: s(1.5) },
  outlet: {
    range: 280, // 110 à l'étape 1 : jugé trop court par l'utilisateur (GD-022)
    // GD-029 : une recharge complète (0 à 12) prend 3 secondes
    stepsPerEnergy: s(3) / 12,
    /** Réserve d'une borne : une fois vidée, elle est éteinte pour le reste de la partie. */
    energyCapacity: 12,
    repairCapacity: 5,
    stepsPerRepair: s(3) / 5,
    /** Nombre de bornes gardées par salle, choisies les plus éloignées les unes des autres. */
    keepPerRoom: { rm_world2: 4, rm_world2_1: 2 } as Record<string, number>,
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
    // GD-036 : un soldat qui entend le héros, ou le perd de vue, va voir à l'endroit du bruit
    investigateMemorySteps: s(12),
    investigateSpeedFactor: 1.6,
    investigateArriveDistance: 140,
    chaseRepathSteps: s(0.5),
    waypointTimeoutSteps: s(1),
    maxWaypointFailures: 2,
    rotateSpeedDeg: 10, // 5 dans l'original, jugé mou (GD-031)
    // GD-029 : le robot bouclier se tourne lentement (on peut le contourner d'un dash) et son bouclier
    // se brise après 6 coups encaissés de face. Dans l'original : invulnérable de face, rotation normale.
    shieldRotateSpeedDeg: 1.5,
    shieldHits: 6,
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
    // Boss. 100 PV dans l'original, prévus pour quatre héros ; 60 pour un joueur seul (GD-028), et 40 de plus
    // par joueur supplémentaire (GD-054, `boss.healthPerExtraPlayer`).
    obj_sallyBot: {
      kind: 'boss', genre: 'robot', maxHealth: 60, normalSpeed: 10, radius: 110,
      sprites: { stand: 'spr_sallyBot_1_standing', move: 'spr_sallyBot_1_marche', dead: 'spr_explosion_robot' },
    },
  } as Record<string, NpcDef>,

  /** Boss SallyBot (valeurs du code de 2019 sauf mention « remake »). */
  boss: {
    // 1600 dans l'original : le boss fonçait sur le héros dès son arrivée. Il attend maintenant qu'on
    // s'approche, qu'on le touche ou qu'on entame une foreuse (GD-031).
    aggroRange: 650,
    // 10 dans le code, la vitesse des heros ; 7 ici pour qu un joueur seul puisse prendre de la distance (GD-028)
    speed: 7,
    /**
     * À plusieurs (GD-054) : par joueur en plus du premier, le boss gagne des points de vie et un peu de
     * vitesse. À quatre : 180 PV et la vitesse de marche de l'original (10), toujours sous celle des héros.
     */
    healthPerExtraPlayer: 40,
    speedPerExtraPlayer: 1,
    chargeSpeed: 20,
    chargeDamage: 4,
    /** Une chance sur cinq de charger à chaque recalcul de chemin (toutes les 0,5 s). */
    chargeChance: 0.2,
    chargeMoveFromFrame: 7,
    repathSteps: s(0.5),
    attackRange: 20,
    keepAttackingRange: 170,
    /** Phase 2 : après 3 s cumulées d'attaque ou de charge, le boss s'arrête pour respirer et devient vulnérable. */
    breatheAfterSteps: s(3),
    /** Remake : il se tourne vers le héros à vitesse limitée, ce qui laisse le temps d'esquiver. */
    rotateDeg: 4,
    /** Remake : part de l'animation d'un coup pendant laquelle il touche (les masques image par image ne sont pas portés). */
    hitWindow: [0.35, 0.85],
    /** Combo de la phase 1 ; zones de frappe = boîtes des masques spr_sallyBot_1_HitBox*, dans le repère du boss. */
    combo: [
      { sprite: 'spr_sallyBot_1_AttackD1', damage: 2, box: { x0: -48, y0: -72, x1: 263, y1: 330 } },
      { sprite: 'spr_sallyBot_1_AttackG1', damage: 2, box: { x0: -48, y0: -331, x1: 263, y1: 71 } },
      { sprite: 'spr_sallyBot_1_AttackD2', damage: 3, box: { x0: -282, y0: -72, x1: 263, y1: 330 } },
      { sprite: 'spr_sallyBot_1_AttackG2', damage: 4, box: { x0: -282, y0: -331, x1: 247, y1: 71 } },
    ],
    attack2: { sprite: 'spr_sallyBot_2_attack', damage: 3, box: { x0: -45, y0: -238, x1: 188, y1: 238 } },
    sprites: {
      stand1: 'spr_sallyBot_1_standing', walk1: 'spr_sallyBot_1_marche', charge1: 'spr_sallyBot_1_fire2',
      transform: 'spr_sallyBot_transformation',
      stand2: 'spr_sallyBot_2_standing', walk2: 'spr_sallyBot_2_marche', charge2: 'spr_sallyBot_2_fire2', breathe: 'spr_sallyBot_2_respire',
    },
    /** Délai entre la mort du boss et l'écran de score. */
    endDelaySteps: s(2.5),
  },

  /** Remake (GD-028) : foreuses destructibles, sans équivalent dans le code d'origine. */
  drill: {
    maxHealth: 20,
  },

  /**
   * Arrivée par le véhicule de largage au début du niveau (GD-035), en steps : il entre par la gauche,
   * descend, lâche le robot, remonte et repart par la droite ; le robot se déploie ensuite.
   */
  arrival: {
    flyInSteps: s(1.4),
    descendSteps: s(0.8),
    holdSteps: s(0.45),
    ascendSteps: s(0.6),
    flyOutSteps: s(1.2),
    /** Pince du joueur 1, par rapport à l'origine du sprite du véhicule (scr_arrayOfSpawnPositionRelativeToSprite). */
    claw: { x: 72, y: -95 },
    /** Échelle du véhicule en vol (1,1 dans l'original ; accentuée pour qu'on lise la descente). */
    flightScale: 1.3,
    travel: 1900,
  },

  /** Chaises à roulettes : le héros les pousse en les touchant (GD-031). */
  chair: {
    objects: ['obj_siege_accueil'],
    radius: 30,
    push: 0.9,
    friction: 0.88,
  },

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
    // GD-029 : la vue se décale vers le curseur et suit le robot de plus près (20 dans l'original)
    smoothing: 7,
    lookAhead: 0.33,
    maxLookAhead: 380,
  },
};
