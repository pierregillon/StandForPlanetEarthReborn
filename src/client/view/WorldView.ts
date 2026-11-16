// Affichage du monde : décor fixe créé une fois, puis synchronisation des entités avec la simulation.
// Profondeurs Phaser = opposé des profondeurs de couches GameMaker (plus grand = devant).
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import type { FloorManifest } from '../assets.ts';
import { CONFIG, STEPS_PER_SECOND } from '../../sim/config.ts';
import { BLOCK_MOVE } from '../../sim/geom.ts';
import { muzzlePosition } from '../../sim/hero.ts';
import type { Bat, Door, Drill, Fog, Hero, Npc, SimEvent, SpriteInfo, Turret, WindowPane } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';

const DEPTH = {
  background: -800, floor: -700, decal: -600, zone: -400, window: -300, outlet: -150,
  remains: -50, legs: -1, character: 0, laser: 4, bullet: 5, fog: 100, wallThin: 200, wallThick: 300, door: 500, fx: 600, worldText: 700, darkness: 5000,
};
/** Brouillard de guerre : gris foncé de l'original ($313131). */
const FOG_COLOR = 0x313131;
/** Éclairage simplifié. L'original assombrit à 60 % ; 50 % ici pour garder les combats lisibles (GD-028). */
const LIGHTING = { ambient: 0.5, strength: 2, heroRadius: 420, heroStrength: 0.75, chargingDim: 0.22 };
const CARD_COLORS: Record<string, number> = { green: 0x35d05a, purple: 0xb04cff };
const MAX_REMAINS = 500;
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

export class WorldView {
  private readonly scene: Phaser.Scene;
  private readonly world: World;
  private readonly npcImgs = new Map<number, Img>();
  private readonly bulletImgs = new Map<number, Img>();
  private readonly droneImgs = new Map<number, Img>();
  private readonly explosionImgs = new Map<number, Img>();
  private readonly batImgs = new Map<number, Img>();
  private turretImg: Img | null = null;
  private readonly fogRects = new Map<number, Phaser.GameObjects.Rectangle>();
  private readonly drillParts = new Map<number, { contours: Img | null; beam: Img | null }>();
  private drillBars!: Phaser.GameObjects.Graphics;
  private darkness: Phaser.GameObjects.RenderTexture | null = null;
  private lightStamp: Img | null = null;
  private lights: { x: number; y: number; radius: number; intensity: number }[] = [];
  private plasmaBall: Img | null = null;
  private readonly doorImgs = new Map<number, Img>();
  private readonly windowImgs = new Map<number, Img>();
  private readonly outletImgs = new Map<number, Img>();
  private readonly cardImgs = new Map<number, Img>();
  private readonly zoneImgs: Img[] = [];
  private readonly anims: PlayingAnim[] = [];
  private readonly debris: Debris[] = [];
  private readonly remains: Img[] = [];
  private heroBody!: Img;
  private heroLegs!: Img;
  private laser!: Phaser.GameObjects.Graphics;
  private heroFx!: Phaser.GameObjects.Graphics;
  private npcFx!: Phaser.GameObjects.Graphics;
  private readonly cardGlows = new Map<number, Img>();
  private hasLamps = false;
  private cable!: Phaser.GameObjects.Graphics;
  private tracers!: Phaser.GameObjects.Graphics;
  private legsTime = 0;

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
    const def = world.hero.def;
    this.heroLegs = this.image(def.sprites.legs, 0, world.hero.x, world.hero.y, DEPTH.legs);
    this.heroBody = this.image(def.sprites.stand, 0, world.hero.x, world.hero.y, DEPTH.character);
    this.laser = scene.add.graphics().setDepth(DEPTH.laser);
    this.heroFx = scene.add.graphics().setDepth(DEPTH.bullet + 2);
    this.npcFx = scene.add.graphics().setDepth(DEPTH.bullet + 2);
    this.cable = scene.add.graphics().setDepth(DEPTH.laser);
    this.tracers = scene.add.graphics().setDepth(DEPTH.bullet + 1);
    this.drillBars = scene.add.graphics().setDepth(DEPTH.worldText);
    for (const fog of world.fogs) {
      this.fogRects.set(fog.id, scene.add.rectangle(fog.x, fog.y, fog.w, fog.h, FOG_COLOR).setOrigin(0, 0).setDepth(DEPTH.fog).setAlpha(fog.alpha));
    }
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
    g.fillStyle(0x4dff88, 1).fillCircle(72, 22, 5);
    g.generateTexture('outlet', 96, 96);
    g.destroy();
  }

  /** Met l'affichage à jour d'après l'état du monde. `dt` en secondes. */
  sync(dt: number): void {
    this.syncHero(dt);
    this.syncNpcs();
    this.syncBullets();
    this.syncAbilityObjects();
    this.syncFogs();
    this.syncDrills();
    this.syncLights();
    for (const door of this.world.doors) this.syncDoor(door);
    for (const outlet of this.world.outlets) {
      const img = this.outletImgs.get(outlet.id);
      if (!img) continue;
      const empty = outlet.energyLeft === 0 && outlet.repairLeft === 0;
      img.setScale(outlet.inUse ? 1.08 + Math.sin(this.scene.time.now / 80) * 0.04 : 1);
      // borne vidée : éteinte
      if (empty) img.setTint(0x555555).setAlpha(0.7);
    }
    this.syncNpcFx();
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

  private syncHero(dt: number): void {
    const h = this.world.hero;
    const def = h.def;
    const body = this.heroBody;
    const legs = this.heroLegs;
    body.setPosition(h.x, h.y).setRotation(h.angle);
    legs.setPosition(h.x, h.y).setRotation(h.moveAngle);
    this.laser.clear();
    this.cable.clear();
    this.heroFx.clear();

    if (h.state === 'dead') {
      const dead = def.kind === 'BatBot' ? `spr_BatBot_mort_${h.bats}` : def.sprites.dead;
      this.setFrame(body, dead, (h.deadSteps / STEPS_PER_SECOND) * spriteFps(this.info(dead)));
      body.setAlpha(1).clearTint();
      legs.setVisible(false);
      this.plasmaBall?.setVisible(false);
      return;
    }
    legs.setVisible(true);
    if (h.moving) {
      this.legsTime += dt;
      this.setFrame(legs, def.sprites.legs, (this.legsTime * 20) % this.info(def.sprites.legs).frames);
    } else {
      this.setFrame(legs, def.sprites.legs, 0);
    }

    const pose = this.heroPose(h);
    this.setFrame(body, pose.sprite, pose.frame);
    this.syncPlasmaBall(h, pose.sprite);

    // invulnérabilité après un dégât : le héros clignote (effet « glitch » de l'original, simplifié)
    if (h.invuln > 0) body.setAlpha(Math.floor(h.invuln / 2) % 2 === 0 ? 0.35 : 1).setTint(0xff8080);
    else body.setAlpha(1).clearTint();

    // viseur laser : 200 px depuis le canon, raccourci au premier obstacle
    const m = muzzlePosition(h);
    const ex = m.x + Math.cos(h.angle) * 200;
    const ey = m.y + Math.sin(h.angle) * 200;
    const hit = this.world.collision.raycast(m.x, m.y, ex, ey, BLOCK_MOVE);
    const t = hit ? hit.t : 1;
    if (def.laserColor !== null) {
      this.laser.lineStyle(2, def.laserColor, h.state === 'firing1' ? 0.7 : 0.4);
      this.laser.lineBetween(m.x, m.y, m.x + (ex - m.x) * t, m.y + (ey - m.y) * t);
    }
    this.drawHeroFx(h);

    // bornes de recharge : zone d'action visible à l'approche, arc électrique pendant la recharge (GD-022)
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
        this.cable.arc(outlet.x, outlet.y, 52, -Math.PI / 2, -Math.PI / 2 + TAU * (outlet.energyLeft / CONFIG.outlet.energyCapacity));
        this.cable.strokePath();
        this.cable.lineStyle(5, 0x5dff7a, 0.9).beginPath();
        this.cable.arc(outlet.x, outlet.y, 60, -Math.PI / 2, -Math.PI / 2 + TAU * (outlet.repairLeft / CONFIG.outlet.repairCapacity));
        this.cable.strokePath();
      }
      if (outlet.inUse) {
        this.drawEnergyLink(outlet.x, outlet.y, h.x, h.y);
        this.cable.lineStyle(3, 0x7fd9ff, 0.35 + 0.25 * pulse).strokeCircle(outlet.x, outlet.y, range);
      } else if (d < range * 2.5) {
        const inside = d <= range;
        this.cable.lineStyle(inside ? 3 : 2, inside ? 0xffe36b : 0x7fd9ff, (inside ? 0.35 : 0.12) + 0.15 * pulse).strokeCircle(outlet.x, outlet.y, range);
      }
    }
  }

  /** Arc électrique entre deux points : plusieurs brins en zigzag, redessinés à chaque image. */
  private drawEnergyLink(x1: number, y1: number, x2: number, y2: number): void {
    const g = this.cable;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const segments = Math.max(4, Math.round(len / 28));
    const strands = [
      { width: 12, color: 0x2f8dff, alpha: 0.22, jitter: 10 },
      { width: 6, color: 0x7fd9ff, alpha: 0.55, jitter: 16 },
      { width: 2.5, color: 0xffffff, alpha: 0.95, jitter: 16 },
      { width: 2, color: 0xffe36b, alpha: 0.8, jitter: 30 },
    ];
    for (const s of strands) {
      g.lineStyle(s.width, s.color, s.alpha);
      g.beginPath();
      g.moveTo(x1, y1);
      for (let i = 1; i < segments; i++) {
        const t = i / segments;
        // amplitude nulle aux extrémités, maximale au milieu
        const off = (Math.random() - 0.5) * 2 * s.jitter * Math.sin(Math.PI * t);
        g.lineTo(x1 + dx * t + nx * off, y1 + dy * t + ny * off);
      }
      g.lineTo(x2, y2);
      g.strokePath();
    }
    const glow = 14 + Math.random() * 8;
    g.fillStyle(0x7fd9ff, 0.35).fillCircle(x1, y1, glow + 8).fillCircle(x2, y2, glow + 14);
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
    if (def.kind === 'EngiBot' && h.fire2Anim >= 0 && def.sprites.fire2) {
      return { sprite: def.sprites.fire2, frame: (h.fire2Anim / CONFIG.abilities.engiBot.placeAnimSteps) * this.info(def.sprites.fire2).frames };
    }
    if (h.state === 'firing1' && h.sinceShot < period) {
      return { sprite: def.sprites.shot, frame: (h.sinceShot / period) * this.info(def.sprites.shot).frames };
    }
    return h.moving ? walkCycle(def.sprites.move) : { sprite: def.sprites.stand, frame: 0 };
  }

  /** Boule de plasma de BadaBot : au repos, en charge, chargée, ou juste tirée. */
  private syncPlasmaBall(h: Hero, bodySprite: string): void {
    if (h.def.kind !== 'BadaBot') return;
    if (!this.plasmaBall) this.plasmaBall = this.image('spr_plasmaBawl_idle', 0, h.x, h.y, DEPTH.character + 1);
    const ball = this.plasmaBall;
    const now = this.scene.time.now / 1000;
    const full = CONFIG.abilities.badaBot.fullChargeSteps;
    ball.setVisible(true).setPosition(h.x, h.y).setRotation(h.angle);
    if (h.charge >= full) this.setFrame(ball, 'spr_plasmaBawl_loaded', (now * 10) % this.info('spr_plasmaBawl_loaded').frames);
    else if (h.charge > 0) this.setFrame(ball, 'spr_plasmaBawl_loading', (h.charge / full) * this.info('spr_plasmaBawl_loading').frames);
    else if (h.sinceShot < 15) this.setFrame(ball, 'spr_plasmaBawl_shot', h.sinceShot / 3);
    else this.setFrame(ball, 'spr_plasmaBawl_idle', (now * 20) % this.info('spr_plasmaBawl_idle').frames);
    // l'orbe et le corps sont dessinés sur la même toile : on cale l'orbe sur l'origine du sprite du corps,
    // qui change selon la posture, pour qu'elle ne se décale plus en marchant ou bouclier levé (GD-029)
    const bodyInfo = this.info(bodySprite);
    ball.setOrigin(bodyInfo.ox / bodyInfo.w, bodyInfo.oy / bodyInfo.h);
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
    this.syncPool(this.droneImgs, world.drones,
      (d) => this.image('spr_PetDrone', d.level - 1, d.x, d.y, DEPTH.bullet),
      (img, d) => img.setPosition(d.x, d.y).setRotation(d.angle));
    this.syncPool(this.explosionImgs, world.explosions,
      (e) => this.image(e.sprite, 0, e.x, e.y, DEPTH.fx).setRotation(e.angle).setScale(e.scale),
      (img, e) => this.setFrame(img, e.sprite, (e.step / e.totalSteps) * this.info(e.sprite).frames));
    this.syncPool(this.batImgs, world.bats,
      (b) => this.image(`spr_batte_BatBot_${b.side}`, 0, b.x, b.y, DEPTH.bullet),
      (img, b) => this.syncBat(img, b));
    this.syncTurret(world.turret);
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

  private syncFogs(): void {
    const alive = new Map<number, Fog>();
    for (const fog of this.world.fogs) alive.set(fog.id, fog);
    for (const [id, rect] of this.fogRects) {
      const fog = alive.get(id);
      if (fog) rect.setAlpha(Math.max(0, fog.alpha));
      else {
        rect.destroy();
        this.fogRects.delete(id);
      }
    }
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
  private drawHeroFx(h: Hero): void {
    const g = this.heroFx;
    const def = h.def;
    const c = Math.cos(h.angle);
    const s = Math.sin(h.angle);
    const at = (lx: number, ly: number): Phaser.Geom.Point => new Phaser.Geom.Point(h.x + lx * c - ly * s, h.y + lx * s + ly * c);
    const reloading = h.reloadTimer > 0;
    const progress = reloading ? 1 - h.reloadTimer / Math.max(1, def.reloadSteps) : 0;

    if (reloading) {
      g.lineStyle(8, 0x000000, 0.45).strokeCircle(h.x, h.y, 68);
      g.lineStyle(6, 0xffe36b, 1).beginPath();
      g.arc(h.x, h.y, 68, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress);
      g.strokePath();
    }

    if (def.magazine > 0) {
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

    // surcharge d'énergie : des étincelles courent autour du robot, de plus en plus nombreuses ; halo à 12
    if (h.energy > CONFIG.hero.naturalEnergy) {
      const stage = Math.floor(h.energy / 3); // 1 à 4
      const sparks = (stage - 1) * 2 + (h.energy >= CONFIG.hero.maxEnergy ? 3 : 0) + 1;
      for (let k = 0; k < sparks; k++) {
        let a = Math.random() * Math.PI * 2;
        let r = def.radius + 4 + Math.random() * 14;
        g.lineStyle(Math.random() < 0.3 ? 3 : 2, Math.random() < 0.5 ? 0xffffff : 0x8fdcff, 0.95).beginPath();
        g.moveTo(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r);
        for (let j = 0; j < 4; j++) {
          a += 0.12 + Math.random() * 0.18;
          r = def.radius + Math.random() * 20;
          g.lineTo(h.x + Math.cos(a) * r, h.y + Math.sin(a) * r);
        }
        g.strokePath();
      }
      if (h.energy >= CONFIG.hero.maxEnergy) {
        const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now / 110);
        g.lineStyle(10, 0x4fb8ff, 0.12 + 0.14 * pulse).strokeCircle(h.x, h.y, def.radius + 16);
        g.lineStyle(3, 0xbfeaff, 0.35 + 0.35 * pulse).strokeCircle(h.x, h.y, def.radius + 16);
      }
    }
  }

  /** Bouclier des robots à bouclier : un arc devant eux, un segment par coup encore encaissable (GD-029). */
  private syncNpcFx(): void {
    const g = this.npcFx;
    g.clear();
    const total = CONFIG.npc.shieldHits;
    for (const npc of this.world.npcs) {
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
    const placed = this.world.level.instances.filter((i) => i.object === 'obj_lumiere');
    this.hasLamps = placed.length > 0;
    this.lights = placed.map((i) => ({
      x: i.x, y: i.y,
      radius: Number(i.props.radius ?? 256 * Math.abs(i.scaleX)),
      intensity: Number(i.props.lightIntensity ?? 0.5),
    }));
    this.ensureHalo();
    this.lightStamp = scene.make.image({ key: 'lightHalo', add: false });
    this.darkness = scene.add.renderTexture(0, 0, VIEW.width, VIEW.height).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH.darkness);
  }

  private syncLights(): void {
    const rt = this.darkness;
    const stamp = this.lightStamp;
    if (!rt || !stamp) return;
    const cam = this.scene.cameras.main;
    const h = this.world.hero;
    // pendant une recharge, la lumière baisse et tremble autour du robot (idée de l'utilisateur, GD-029)
    const flicker = h.charging ? 0.45 + Math.random() * 0.4 : 1;
    const ambient = (this.hasLamps ? LIGHTING.ambient : 0) + (h.charging ? LIGHTING.chargingDim * (0.6 + Math.random() * 0.6) : 0);
    rt.setVisible(ambient > 0);
    if (ambient <= 0) return;
    rt.clear();
    rt.fill(0x000000, Math.min(0.85, ambient));
    const halo = (x: number, y: number, radius: number, strength: number): void => {
      const sx = x - cam.scrollX;
      const sy = y - cam.scrollY;
      if (sx < -radius || sy < -radius || sx > VIEW.width + radius || sy > VIEW.height + radius) return;
      stamp.setScale((radius * 2) / 256).setAlpha(Math.min(1, strength));
      rt.erase(stamp, sx, sy);
    };
    for (const light of this.lights) halo(light.x, light.y, light.radius, light.intensity * LIGHTING.strength * flicker);
    // le héros porte sa propre lueur, pour rester lisible loin des lampes
    halo(h.x, h.y, LIGHTING.heroRadius * (h.charging ? 0.8 + Math.random() * 0.25 : 1), LIGHTING.heroStrength);
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
      if (pane) this.breakWindow(pane, e.x, e.y);
    } else if (e.type === 'heroDead') {
      scene.cameras.main.shake(300, 0.01);
    } else if (e.type === 'heroHit') {
      scene.cameras.main.shake(90, 0.004);
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

  private breakWindow(pane: WindowPane, x: number, y: number): void {
    const img = this.windowImgs.get(pane.id);
    if (img) this.setFrame(img, pane.sprite, 1);
    if (!this.scene.textures.exists(frameKey('spr_fenetre_eclats', 0))) return;
    const variants = this.info('spr_fenetre_eclats').frames;
    for (let i = 0; i < 12; i++) {
      const shard = this.image('spr_fenetre_eclats', Math.floor(Math.random() * variants), x + (Math.random() - 0.5) * 200 * Math.abs(Math.sin(pane.angle)) , y + (Math.random() - 0.5) * 200 * Math.abs(Math.cos(pane.angle)), DEPTH.remains);
      const a = Math.random() * Math.PI * 2;
      const speed = 300 + Math.random() * 500;
      this.debris.push({ img: shard, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, spin: (Math.random() - 0.5) * 10 });
      this.keepRemains(shard);
    }
  }

  private spawnDeath(x: number, y: number, angle: number, sprite: string, genre: 'humain' | 'robot'): void {
    const scene = this.scene;
    if (scene.textures.exists(frameKey(sprite, 0))) {
      const sp = this.info(sprite);
      const img = this.image(sprite, 0, x, y, DEPTH.character).setRotation(angle);
      this.anims.push({ img, sprite, frames: sp.frames, fps: spriteFps(sp), elapsed: 0, keepLast: false });
    }
    const puddle = genre === 'humain' ? 'spr_membreMortHumain_sang' : 'spr_membreMortRobot_huile';
    if (scene.textures.exists(frameKey(puddle, 0))) {
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        const img = this.image(puddle, Math.floor(Math.random() * this.info(puddle).frames), x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 30, DEPTH.remains - 1)
          .setRotation(Math.random() * Math.PI * 2);
        this.keepRemains(img);
      }
    }
    const prefix = genre === 'humain' ? 'spr_membreMortHumain_' : 'spr_membreMortRobot_';
    const pieces = 4 + Math.floor(Math.random() * 8);
    for (let i = 0; i < pieces; i++) {
      const name = `${prefix}${1 + Math.floor(Math.random() * 11)}`;
      if (!scene.textures.exists(frameKey(name, 0))) continue;
      const img = this.image(name, 0, x + (Math.random() - 0.5) * 10, y + (Math.random() - 0.5) * 10, DEPTH.remains).setRotation(Math.random() * Math.PI * 2);
      const a = Math.random() * Math.PI * 2;
      const speed = (20 + Math.random() * 20) * STEPS_PER_SECOND * 0.35;
      this.debris.push({ img, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, spin: 1 });
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
