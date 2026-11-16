// Affichage du monde : décor fixe créé une fois, puis synchronisation des entités avec la simulation.
// Profondeurs Phaser = opposé des profondeurs de couches GameMaker (plus grand = devant).
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import type { FloorManifest } from '../assets.ts';
import { CONFIG, STEPS_PER_SECOND } from '../../sim/config.ts';
import { BLOCK_MOVE, BLOCK_SIGHT, angleDiff } from '../../sim/geom.ts';
import { visibilityPolygon } from '../../sim/visibility.ts';
import { batHand, petAnchors } from '../../sim/abilities.ts';
import { muzzlePosition } from '../../sim/hero.ts';
import { ULTI_ACTION, ULTI_CAST, ULTI_RECOVER } from '../../sim/ulti.ts';
import type { Bat, Button, Chair, Door, Drill, Fog, Hero, Npc, SimEvent, SpriteInfo, Turret, WindowPane } from '../../sim/types.ts';
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
const MAX_REMAINS = 900;
/** Nombre d'images de la fin du déploiement de PetBot utilisées pour son rechargement. */
const PETBOT_RELOAD_FRAMES = 29;
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
  if (bodySprite === 'spr_BadaBot_fire2' || bodySprite === 'spr_BadaBot_ulti_cast') return { x: ORB_SHIELD_X[Math.min(i, ORB_SHIELD_X.length - 1)] - 141, y: 0 };
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

type Img = Phaser.GameObjects.Image;

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
}

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
  /** Énergie qui se concentre pendant le lancement : un calque sous le robot, un par-dessus. */
  chargeUnder: Img | null;
  chargeTop: Img | null;
  /** Mini-bots de PetBot (GD-045) : ils flottent à leur place autour de lui. */
  pets: Pet[] | null;
  /** Secondes écoulées depuis que les mini-bots sont revenus (0 tant qu'ils sont partis en salve). */
  petsHome: number;
}

interface Pet {
  img: Img;
  /** Son ombre : la même silhouette, en noir. */
  shadow: Img;
  x: number;
  y: number;
  angle: number;
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
};

/** Couleur de l'énergie de chaque robot quand il lance son ulti : teinte principale et reflet. */
const ULTI_COLORS: Record<string, { main: number; light: number }> = {
  BatBot: { main: 0xfe00d1, light: 0xff84e8 },
  PetBot: { main: 0x3dff7a, light: 0xc4ffd6 },
  BadaBot: { main: 0x8a6cff, light: 0xd9c8ff },
  EngiBot: { main: 0x4fb8ff, light: 0xd4f0ff },
};

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
  private readonly droneImgs = new Map<number, Img>();
  private readonly droneShadowImgs = new Map<number, Img>();
  private readonly explosionImgs = new Map<number, Img>();
  private readonly batImgs = new Map<number, Img>();
  /** Effets d'ultis en cours : image principale et, selon l'effet, une seconde (zone de soin, impulsion). */
  private readonly effectImgs = new Map<number, { main: Img; extra: Img | Phaser.GameObjects.Arc | null }>();
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
  private readonly remains: Img[] = [];
  private readonly parts = new Map<number, HeroParts>();
  /** Noms des joueurs, par rang de héros (partie en réseau). */
  playerNames: string[] = [];
  private laser!: Phaser.GameObjects.Graphics;
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
    this.laser = scene.add.graphics().setDepth(DEPTH.laser);
    this.heroFx = scene.add.graphics().setDepth(DEPTH.bullet + 2);
    this.npcFx = scene.add.graphics().setDepth(DEPTH.bullet + 2);
    this.cable = scene.add.graphics().setDepth(DEPTH.laser);
    this.tracers = scene.add.graphics().setDepth(DEPTH.bullet + 1);
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
  }

  /** Tous les robots de l'équipe, avec toutes leurs animations, chez tous les joueurs (GD-041). */
  private syncHeroes(dt: number): void {
    this.laser.clear();
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
        legsTime: 0, orb: null, orbX: h.x, orbY: h.y, auras: [], tag: null, glow: null, shadow: null, airborne: false, chargeUnder: null, chargeTop: null, pets: null, petsHome: 0,
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
    // le véhicule de largage ne montre dans sa pince que le robot du joueur ; les coéquipiers apparaissent une fois posés
    const a = CONFIG.arrival;
    const carried = !local && h.arrivalSteps > 0 && h.arrivalTotal - h.arrivalSteps < a.flyInSteps + a.descendSteps + a.holdSteps;
    const shown = !h.gone && !carried;
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

    // invulnérabilité après un dégât : le héros clignote (effet « glitch » de l'original, simplifié)
    if (h.invuln > 0) body.setAlpha(Math.floor(h.invuln / 2) % 2 === 0 ? 0.35 : 1).setTint(0xff8080);
    else body.setAlpha(1).clearTint();

    // viseur laser : 200 px depuis le canon, raccourci au premier obstacle
    const m = muzzlePosition(h);
    const ex = m.x + Math.cos(h.angle) * 200;
    const ey = m.y + Math.sin(h.angle) * 200;
    const hit = this.world.collision.raycast(m.x, m.y, ex, ey, BLOCK_MOVE);
    const t = hit ? hit.t : 1;
    if (def.laserColor !== null && h.deploySteps === 0 && h.ultiPhase === 0) {
      this.laser.lineStyle(2, def.laserColor, h.state === 'firing1' ? 0.7 : 0.4);
      this.laser.lineBetween(m.x, m.y, m.x + (ex - m.x) * t, m.y + (ey - m.y) * t);
    }
    this.drawHeroFx(h, p, local);
  }

  /**
   * Ulti (GD-043). Lancement : une lueur magenta enfle sous le robot. Bond de BatBot : le robot grossit et
   * s'élève, son ombre reste au sol.
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
      p.chargeUnder.setVisible(true).setPosition(h.x, h.y).setScale(scale);
      p.chargeTop.setVisible(true).setPosition(h.x, h.y).setScale(scale);
      p.glow.setVisible(true).setPosition(h.x, h.y).setScale(0.9 + 2.6 * k + 0.14 * Math.sin(scene.time.now / 45)).setAlpha(0.25 + 0.55 * k);
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

  /**
   * Mini-bots de PetBot (GD-045, GD-046) : trois drones flottent près de lui, épaule gauche, épaule droite et
   * tête. Ils sortent un par un de la trappe de son coffre dorsal, le suivent avec un léger retard, et montent
   * et descendent doucement à l'arrêt. Ils volent au-dessus de lui : leur ombre se dessine sur PetBot quand
   * ils le survolent. Quand il lance sa salve, ce sont eux qui partent ; d'autres ressortent ensuite du coffre.
   */
  private syncPets(h: Hero, p: HeroParts, dt: number, present: boolean): void {
    const anchors = petAnchors(h);
    if (!p.pets) {
      p.pets = anchors.map((a) => ({
        // l'ombre est au-dessus du corps des robots et sous les mini-bots
        shadow: this.image('spr_PetDrone', 0, a.x, a.y, DEPTH.character + 2.5).setTintFill(0x000000),
        img: this.image('spr_PetDrone', 0, a.x, a.y, DEPTH.character + 3),
        x: a.x, y: a.y, angle: h.angle,
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
    p.pets.forEach((pet, i) => {
      // sortie de la trappe, l'un après l'autre : 0 = encore dans le coffre, 1 = arrivé à sa place
      const out = Math.max(0, Math.min(1, (p.petsHome - i * PETS.stagger) / PETS.emerge));
      const visible = home && out > 0;
      pet.img.setVisible(visible);
      pet.shadow.setVisible(visible);
      if (!visible) return;
      let size = 1;
      if (out < 1) {
        // il jaillit de la trappe en passant au-dessus du crâne, puis rejoint sa place en grandissant
        const e = 1 - (1 - out) ** 2;
        const skull = local(8, 0);
        pet.x = (1 - e) ** 2 * hatch.x + 2 * e * (1 - e) * skull.x + e * e * anchors[i].x;
        pet.y = (1 - e) ** 2 * hatch.y + 2 * e * (1 - e) * skull.y + e * e * anchors[i].y;
        pet.angle = h.angle;
        size = 0.25 + 0.75 * e;
      } else {
        pet.x += (anchors[i].x - pet.x) * pull;
        pet.y += (anchors[i].y - pet.y) * pull;
        pet.angle += angleDiff(pet.angle, h.angle) * pull;
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
    for (const b of this.world.bullets) {
      alive.add(b.id);
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
      const len = Math.min(style.length, travelled);
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
  }

  /** Sprite et image du corps du héros selon son état. */
  private heroPose(h: Hero): { sprite: string; frame: number } {
    const def = h.def;
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
    // rechargement de PetBot (GD-034) : les 30 dernières images de son déploiement montrent l'arme qui se
    // rebranche et se réarme ; on les joue à l'envers (l'arme se replie) puis à l'endroit (elle se réarme)
    if (def.kind === 'PetBot' && h.reloadTimer > 0 && this.scene.textures.exists(frameKey('spr_PetBot_deploy', 0))) {
      const last = this.info('spr_PetBot_deploy').frames - 1;
      const first = Math.max(0, last - PETBOT_RELOAD_FRAMES);
      const p = 1 - h.reloadTimer / Math.max(1, def.reloadSteps);
      const fold = 0.25;
      const frame = p < fold ? last - (p / fold) * (last - first) : first + ((p - fold) / (1 - fold)) * (last - first);
      return { sprite: 'spr_PetBot_deploy', frame };
    }
    // rechargement d'EngiBot : son canon tourne à vide (animation « preShot » d'origine)
    if (def.kind === 'EngiBot' && h.reloadTimer > 0 && this.scene.textures.exists(frameKey('spr_EngiBot_preShot', 0))) {
      return { sprite: 'spr_EngiBot_preShot', frame: Math.floor(h.reloadTimer / 3) % this.info('spr_EngiBot_preShot').frames };
    }
    if (def.kind === 'EngiBot' && h.fire2Anim >= 0 && def.sprites.fire2) {
      return { sprite: def.sprites.fire2, frame: (h.fire2Anim / CONFIG.abilities.engiBot.placeAnimSteps) * this.info(def.sprites.fire2).frames };
    }
    if (h.state === 'firing1' && h.sinceShot < period) {
      return { sprite: def.sprites.shot, frame: (h.sinceShot / period) * this.info(def.sprites.shot).frames };
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

  /** Effets laissés par les ultis (GD-044) : essaim de PetBot, mur de BadaBot, grenade d'EngiBot. */
  private syncEffects(): void {
    const scene = this.scene;
    const now = scene.time.now / 1000;
    const alive = new Set<number>();
    for (const e of this.world.effects) {
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
        // la couronne dessinée va jusqu'à 246 px du centre : on l'ajuste au rayon de soin
        parts.main.setPosition(e.x, e.y).setScale(e.radius / 246).setAlpha(fade);
        parts.extra?.setPosition(e.x, e.y).setAlpha(0.07 * fade + 0.02 * Math.sin(now * 5));
      } else if (e.kind === 'wall') {
        parts ??= { main: this.image('spr_BadaBot_ulti_wall', 0, e.x, e.y, DEPTH.door + 1).setRotation(e.angle), extra: null };
        const info = this.info('spr_BadaBot_ulti_wall');
        this.setFrame(parts.main, 'spr_BadaBot_ulti_wall', (now * info.speed) % info.frames);
        // il se dresse en un instant, d'un bout à l'autre ; les plots dessinés dépassent de 30 px
        const rise = Math.min(1, e.steps / 8);
        parts.main.setScale(1, ((e.length * 2 + 60) / info.h) * rise).setAlpha(0.55 + 0.45 * fade);
      } else {
        const fly = CONFIG.ulti.engiBot.flySteps;
        parts ??= {
          main: this.image('spr_EngiBot_ulti_grenade', 0, e.x, e.y, DEPTH.fx + 4),
          extra: this.image('spr_EngiBot_ulti_pulse', 0, e.x, e.y, DEPTH.fx + 3).setTint(ULTI_COLORS.EngiBot.main).setBlendMode(Phaser.BlendModes.ADD).setVisible(false),
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

    if (reloading) this.drawReload(h, progress, at);

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
   */
  private syncAura(h: Hero, p: HeroParts): void {
    const body = p.body;
    const level = h.state === 'dead' || h.deploySteps > 0 ? 0 : Math.max(0, Math.min(3, Math.ceil((h.energy - CONFIG.hero.naturalEnergy) / 3)));
    while (p.auras.length < 2) {
      p.auras.push(this.scene.add.image(h.x, h.y, body.texture.key).setBlendMode(Phaser.BlendModes.ADD).setTintFill(0x4fb8ff).setDepth(DEPTH.character - 0.5));
    }
    const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now / 160);
    p.auras.forEach((aura, i) => {
      aura.setVisible(level > 0);
      if (level === 0) return;
      if (aura.texture.key !== body.texture.key) aura.setTexture(body.texture.key);
      aura.setOrigin(body.originX, body.originY).setPosition(h.x, h.y).setRotation(h.angle)
        .setScale(1.06 + i * 0.07 + 0.015 * pulse)
        .setAlpha((0.1 + 0.07 * level) * (i === 0 ? 1 : 0.55) * (0.8 + 0.2 * pulse));
    });
    // étincelles : une par niveau, sur le contour du corps
    const g = this.heroFx;
    for (let k = 0; k < level; k++) {
      if (Math.random() < 0.45) continue;
      let a = Math.random() * Math.PI * 2;
      let r = h.def.radius * (0.7 + Math.random() * 0.35);
      g.lineStyle(2, Math.random() < 0.5 ? 0xffffff : 0x8fdcff, 0.85).beginPath();
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
   * Véhicule de largage (GD-035) : il entre par la gauche avec le robot replié dans sa pince, descend, le pose,
   * remonte et sort par la droite. Sprites et position des pinces repris de obj_spawnVehicle.
   */
  private syncVehicle(): void {
    const h = this.world.hero;
    if (h.arrivalTotal === 0 || !this.scene.textures.exists(frameKey('spr_spawnVehicle', 0))) return;
    if (h.arrivalSteps === 0) {
      if (this.vehicle) {
        this.vehicle.body.destroy();
        this.vehicle.shadow?.destroy();
        this.vehicle = null;
        this.partsOf(h).body.setScale(1);
      }
      return;
    }
    const a = CONFIG.arrival;
    if (!this.vehicle) {
      const shadow = this.scene.textures.exists(frameKey('spr_spawnVehicleShadow', 0))
        ? this.image('spr_spawnVehicleShadow', 0, h.x, h.y, DEPTH.fx + 40).setAlpha(0.5) : null;
      this.vehicle = { body: this.image('spr_spawnVehicle', 0, h.x, h.y, DEPTH.fx + 42), shadow };
    }
    const t = h.arrivalTotal - h.arrivalSteps;
    const landed = { x: h.x - a.claw.x, y: h.y - a.claw.y };
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
    // le robot reste dans la pince jusqu'à ce que le véhicule soit posé
    const carried = t < t3;
    const carriedBody = this.partsOf(h).body;
    if (carried) carriedBody.setPosition(x + a.claw.x * scale, landed.y + a.claw.y * scale).setScale(scale).setRotation(h.angle).setDepth(DEPTH.fx + 41);
    else carriedBody.setPosition(h.x, h.y).setScale(1).setDepth(DEPTH.character);
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
    this.debris.push({ img, vx: Math.cos(side) * 320, vy: Math.sin(side) * 320, spin: 9 });
    this.keepRemains(img);
  }

  /**
   * Rechargement dessiné sur le robot, propre à chacun (GD-032) : PetBot engage une fiole neuve, EngiBot un
   * tambour ; l'orbe de BadaBot se reforme en aspirant de l'énergie.
   */
  private drawReload(h: Hero, progress: number, at: (lx: number, ly: number) => Phaser.Geom.Point): void {
    const g = this.heroFx;
    const kind = h.def.kind;
    const slot = RELOAD_SLOT[kind] ?? { x: 30, y: 0 };
    if (kind === 'BadaBot') {
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
    if (kind === 'PetBot') return; // son rechargement est joué par ses sprites (voir heroPose)
    // EngiBot : le tambour neuf part du corps du robot et vient s'engager sur le canon
    const travel = Math.min(1, Math.max(0, (progress - 0.25) / 0.6));
    const from = { x: slot.x - 46, y: slot.y - 26 };
    const lx = from.x + (slot.x - from.x) * travel;
    const ly = from.y + (slot.y - from.y) * travel;
    if (progress < 0.25) return;
    const c = at(lx, ly);
    const spin = progress * 14;
    g.fillStyle(0x1c1c1c, 1).fillCircle(c.x, c.y, 12);
    g.lineStyle(2, 0xff5a5a, 1).strokeCircle(c.x, c.y, 12);
    for (let k = 0; k < 6; k++) g.fillStyle(0xffd23c, 1).fillCircle(c.x + Math.cos(spin + k * 1.047) * 7, c.y + Math.sin(spin + k * 1.047) * 7, 2.4);
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
    } else if (e.type === 'reloadEnd') {
      const h = this.world.heroes[e.hero] ?? this.world.hero;
      const slot = this.weaponSlot(h);
      const flash = scene.add.circle(slot.x, slot.y, 10, h.def.kind === 'BadaBot' ? 0xd9a0ff : 0xffffff).setDepth(DEPTH.fx).setBlendMode(Phaser.BlendModes.ADD);
      scene.tweens.add({ targets: flash, scale: h.def.kind === 'BadaBot' ? 5 : 3, alpha: 0, duration: 220, onComplete: () => flash.destroy() });
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
      const flash = scene.add.circle(e.x, e.y, big ? 220 : 90, color).setDepth(DEPTH.fx + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.75);
      scene.tweens.add({ targets: flash, alpha: 0, scale: big ? 2.6 : 2, duration: big ? 380 : 260, onComplete: () => flash.destroy() });
      if (big && this.nearView(e.x, e.y)) scene.cameras.main.shake(260, 0.009);
    } else if (e.type === 'heroDead') {
      // l'écran ne tremble que pour ce qui arrive près de soi
      if (this.nearView(e.x, e.y)) scene.cameras.main.shake(300, 0.01);
    } else if (e.type === 'heroHit') {
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
      this.debris.push({ img: shard, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, spin: (Math.random() - 0.5) * 12 });
      this.keepRemains(shard);
    }
  }

  private spawnDeath(x: number, y: number, angle: number, sprite: string, genre: 'humain' | 'robot'): void {
    const scene = this.scene;
    const robot = genre === 'robot';
    if (scene.textures.exists(frameKey(sprite, 0))) {
      const sp = this.info(sprite);
      const img = this.image(sprite, 0, x, y, DEPTH.character).setRotation(angle);
      this.anims.push({ img, sprite, frames: sp.frames, fps: spriteFps(sp), elapsed: 0, keepLast: false });
    }
    if (robot) {
      // un robot détruit explose et laisse une vraie carcasse (GD-031)
      if (sprite !== 'spr_explosion_robot' && scene.textures.exists(frameKey('spr_explosion_robot', 0))) {
        const sp = this.info('spr_explosion_robot');
        const boom = this.image('spr_explosion_robot', 0, x, y, DEPTH.fx).setRotation(Math.random() * Math.PI * 2).setScale(0.9);
        this.anims.push({ img: boom, sprite: 'spr_explosion_robot', frames: sp.frames, fps: spriteFps(sp), elapsed: 0, keepLast: false });
      }
    }
    const puddle = robot ? 'spr_membreMortRobot_huile' : 'spr_membreMortHumain_sang';
    if (scene.textures.exists(frameKey(puddle, 0))) {
      const count = robot ? 4 + Math.floor(Math.random() * 3) : 2 + Math.floor(Math.random() * 3);
      const spread = robot ? 90 : 30;
      for (let i = 0; i < count; i++) {
        const img = this.image(puddle, Math.floor(Math.random() * this.info(puddle).frames), x + (Math.random() - 0.5) * spread, y + (Math.random() - 0.5) * spread, DEPTH.remains - 1)
          .setRotation(Math.random() * Math.PI * 2).setScale(robot ? 1.3 + Math.random() * 0.7 : 1);
        this.keepRemains(img);
      }
    }
    const prefix = robot ? 'spr_membreMortRobot_' : 'spr_membreMortHumain_';
    const pieces = robot ? 14 + Math.floor(Math.random() * 9) : 4 + Math.floor(Math.random() * 8);
    for (let i = 0; i < pieces; i++) {
      const name = `${prefix}${1 + Math.floor(Math.random() * 11)}`;
      if (!scene.textures.exists(frameKey(name, 0))) continue;
      const img = this.image(name, 0, x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, DEPTH.remains)
        .setRotation(Math.random() * Math.PI * 2).setScale(robot ? 1.3 + Math.random() * 0.9 : 1);
      const a = Math.random() * Math.PI * 2;
      const speed = (20 + Math.random() * 20) * STEPS_PER_SECOND * (robot ? 0.5 : 0.35);
      this.debris.push({ img, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, spin: 1 + Math.random() * 3 });
      this.keepRemains(img);
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

  private stepDebris(dt: number): void {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
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
