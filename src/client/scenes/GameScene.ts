// Scène de jeu : fait avancer la simulation à pas fixe (60 par seconde) et la dessine.
import Phaser from 'phaser';
import { frameKey, heroSounds, heroSprites } from '../assets.ts';
import type { FloorManifest, SoundManifest } from '../assets.ts';
import { Bind, Keys } from '../keys.ts';
import { ButtonColumn } from '../view/ButtonColumn.ts';
import { Hud } from '../view/Hud.ts';
import { WorldView } from '../view/WorldView.ts';
import { CONFIG, STEPS_PER_SECOND } from '../../sim/config.ts';
import { clamp } from '../../sim/geom.ts';
import { NO_INPUT } from '../../sim/types.ts';
import type { Hero, Input, LevelData, SpriteManifest } from '../../sim/types.ts';
import { World } from '../../sim/world.ts';
import { createSession } from '../../sim/session.ts';
import type { Session } from '../../sim/session.ts';

const STEP_MS = 1000 / STEPS_PER_SECOND;
const PANEL_DEPTH = 20000;
type PanelKind = 'pause' | 'lose' | 'end';
/** Musique du niveau, partagée entre les salles. */
let music: Phaser.Sound.BaseSound | undefined;

export class GameScene extends Phaser.Scene {
  private world!: World;
  private view!: WorldView;
  private hud!: Hud;
  private acc = 0;
  private camX = 0;
  private camY = 0;
  /** Entrées forcées depuis la console (sfpeDebug.hold), pour tester sans clavier. */
  private debugHold: Partial<Input> = {};
  private panel: { objects: Phaser.GameObjects.GameObject[]; buttons: ButtonColumn; kind: PanelKind } | null = null;
  private session!: Session;
  private leaving = false;

  constructor() {
    super('Game');
  }

  /** Charge les sprites et les sons du héros choisi s'ils ne le sont pas déjà. */
  preload(): void {
    const hero = CONFIG.heroes[this.heroName()];
    const sprites = this.cache.json.get('sprites') as SpriteManifest;
    const sounds = (this.cache.json.get('sounds') ?? {}) as SoundManifest;
    for (const name of heroSprites(hero.kind, sprites)) {
      for (let i = 0; i < sprites[name].frames; i++) {
        if (!this.textures.exists(frameKey(name, i))) this.load.image(frameKey(name, i), `assets/sprites/${name}/${i}.png`);
      }
    }
    for (const name of heroSounds(hero.kind, sounds)) {
      if (!this.cache.audio.exists(name)) this.load.audio(name, `assets/${sounds[name].file}`);
    }
    const { width, height } = this.scale;
    const label = this.add.text(width / 2, height / 2, `Loading ${hero.name}...`, { fontFamily: 'Aldo', fontSize: '48px', color: '#cfd8ff' }).setOrigin(0.5).setScrollFactor(0);
    this.load.once('complete', () => label.destroy());
  }

  private heroName(): string {
    const name = this.registry.get('hero') as string | undefined;
    return name && CONFIG.heroes[name] ? name : 'PetBot';
  }

  create(): void {
    const sprites = this.cache.json.get('sprites') as SpriteManifest;
    const floors = (this.cache.json.get('floors') ?? {}) as FloorManifest;
    // la partie (cartes, consigne, salles visitées) survit aux changements de salle
    let session = this.registry.get('session') as Session | null | undefined;
    if (!session || session.heroName !== this.heroName()) {
      session = createSession(this.heroName());
      this.registry.set('session', session);
    }
    this.session = session;
    const arriving = (this.registry.get('arrivingHero') ?? null) as Hero | null;
    this.registry.set('arrivingHero', null);
    let world = session.rooms.get(session.room);
    if (!world) {
      const level = this.cache.json.get(`level:${session.room}`) as LevelData;
      world = new World(level, sprites, session.heroName, (Date.now() & 0xffff) + 1, session);
      session.rooms.set(session.room, world);
      if (arriving) world.enter(arriving, session.spawnNumber);
    } else if (arriving) {
      world.enter(arriving, session.spawnNumber);
    }
    world.drainEvents();
    this.world = world;
    this.leaving = false;
    if (arriving) this.cameras.main.fadeIn(200, 19, 19, 19);
    this.view = new WorldView(this, this.world, floors);
    this.hud = new Hud(this, this.world);
    this.acc = 0;
    this.panel = null;
    this.debugHold = {};

    const target = this.view.cameraTarget();
    this.camX = target.x;
    this.camY = target.y;
    this.placeCamera();
    Keys.clearPressed();

    // la musique continue d'une salle à l'autre ; elle s'arrête au retour au menu
    if (this.cache.audio.exists('snd_rm_world2')) {
      music ??= this.sound.add('snd_rm_world2', { loop: true, volume: 0.35 });
      if (!music.isPlaying) music.play();
    }
    // exposé pour le débogage et les tests automatiques dans le navigateur (console : sfpeDebug)
    (window as unknown as { sfpeWorld: World; sfpeDebug: unknown }).sfpeWorld = this.world;
    (window as unknown as { sfpeDebug: unknown }).sfpeDebug = {
      /** Avance la simulation de n steps avec les entrées données, puis recale la caméra. */
      advance: (n: number, input: Partial<Input> = {}) => {
        for (let i = 0; i < n; i++) this.world.step({ ...NO_INPUT, aimX: this.world.hero.x, aimY: this.world.hero.y - 300, ...input });
        this.snapCamera();
      },
      /** Maintient des entrées en continu, ex. hold({ use: true }) ; hold({}) pour relâcher. */
      hold: (input: Partial<Input>) => {
        this.debugHold = input;
      },
      teleport: (x: number, y: number) => {
        this.world.hero.x = x;
        this.world.hero.y = y;
        this.snapCamera();
      },
    };
  }

  private snapCamera(): void {
    const target = this.view.cameraTarget();
    this.camX = target.x;
    this.camY = target.y;
    this.placeCamera();
  }

  private placeCamera(): void {
    const cam = this.cameras.main;
    const hw = CONFIG.camera.viewWidth / 2;
    const hh = CONFIG.camera.viewHeight / 2;
    this.camX = clamp(this.camX, hw, Math.max(hw, this.world.width - hw));
    this.camY = clamp(this.camY, hh, Math.max(hh, this.world.height - hh));
    cam.setScroll(this.camX - hw, this.camY - hh);
  }

  private readInput(first: boolean): Input {
    const pointer = this.input.activePointer;
    const aim = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return {
      moveX: (Keys.isDown(...Bind.right) ? 1 : 0) - (Keys.isDown(...Bind.left) ? 1 : 0),
      moveY: (Keys.isDown(...Bind.down) ? 1 : 0) - (Keys.isDown(...Bind.up) ? 1 : 0),
      aimX: aim.x,
      aimY: aim.y,
      fire1: pointer.leftButtonDown(),
      fire2: pointer.rightButtonDown(),
      // les appuis ne comptent que pour le premier step de l'image
      dashPressed: first && Keys.wasPressed(...Bind.dash),
      use: Keys.isDown(...Bind.use),
      usePressed: first && Keys.wasPressed(...Bind.use),
      reloadPressed: first && Keys.wasPressed(...Bind.reload),
      ...this.debugHold,
    };
  }

  update(_time: number, delta: number): void {
    if (this.panel) {
      this.panel.buttons.update();
      if (this.panel.kind === 'pause' && Keys.wasPressed(...Bind.pause)) this.closePanel();
      this.hud.update();
      return;
    }
    if (Keys.wasPressed(...Bind.pause)) {
      this.openPanel('pause');
      return;
    }

    this.acc = Math.min(this.acc + delta, STEP_MS * 5);
    let first = true;
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      this.world.step(this.readInput(first));
      first = false;
      const target = this.view.cameraTarget();
      this.camX += (target.x - this.camX) / CONFIG.camera.smoothing;
      this.camY += (target.y - this.camY) / CONFIG.camera.smoothing;
    }
    this.placeCamera();

    for (const e of this.world.drainEvents()) {
      if (e.type === 'sound') this.playSound(e.name, e.x, e.y);
      else if (e.type === 'notify') this.hud.notify(e.text);
      else if (e.type === 'changeRoom') this.changeRoom(e.room, e.spawn);
      else if (e.type === 'levelEnd') this.openPanel('end');
      else this.view.handleEvent(e);
    }
    this.view.sync(delta / 1000);
    this.hud.update();
    if (this.world.gameOver) this.openPanel('lose');
  }

  /** Passage par un escalier : fondu, puis la scène redémarre sur l'autre salle avec le même héros. */
  private changeRoom(room: string, spawn: number): void {
    if (this.leaving) return;
    if (!this.cache.json.exists(`level:${room}`)) {
      this.hud.notify('This area is not open yet.');
      return;
    }
    this.leaving = true;
    this.cameras.main.fadeOut(200, 19, 19, 19);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.session.room = room;
      this.session.spawnNumber = spawn;
      this.registry.set('arrivingHero', this.world.hero);
      this.scene.restart();
    });
  }

  private exitToMenu(): void {
    music?.stop();
    this.registry.set('session', null);
    this.scene.start('Menu');
  }

  /** Retry : la salle en cours repart de zéro, le héros aussi ; les cartes et la consigne sont gardées (GD-007). */
  private retry(): void {
    this.world.forget();
    this.scene.restart();
  }

  /** Son positionné : volume atténué linéairement avec la distance à la caméra. */
  private playSound(name: string, x: number, y: number): void {
    if (!this.cache.audio.exists(name)) return;
    const dist = Math.hypot(x - this.camX, y - this.camY);
    const volume = clamp(1 - dist / 2200, 0, 1) * 0.5;
    if (volume > 0.02) this.sound.play(name, { volume });
  }

  private openPanel(kind: PanelKind): void {
    if (this.panel) return;
    const { width, height } = this.scale;
    const bg = this.add.rectangle(width / 2, height / 2, width / 2, height / 2, 0x040c29, 0.9).setScrollFactor(0).setDepth(PANEL_DEPTH);
    const titles: Record<PanelKind, string> = { pause: 'PAUSE', lose: 'YOU LOSE', end: 'TO BE CONTINUED' };
    const title = this.add.text(width / 2, height / 2 - 180, titles[kind], {
      fontFamily: 'Aldo', fontSize: kind === 'end' ? '70px' : '90px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(PANEL_DEPTH + 1);
    const objects: Phaser.GameObjects.GameObject[] = [bg, title];
    const exit = { label: 'Exit', sprite: 'spr_btn_exit', action: () => this.exitToMenu() };
    let specs = [{ label: 'Resume', sprite: 'spr_btn_resume', action: () => this.closePanel() }, exit];
    let buttonsY = height / 2;
    if (kind === 'lose') specs = [{ label: 'Retry', sprite: 'spr_btn_retry', action: () => this.retry() }, exit];
    if (kind === 'end') {
      // fin provisoire : la zone de forage et le boss arrivent à l'étape 4 ; statistiques de l'écran de score d'origine
      const s = this.session.stats;
      const pct = (n: number, total: number): number => (total > 0 ? Math.round((100 * n) / total) : 0);
      const lines = [
        'The drilling area is coming next.',
        '',
        `Percent of civil killed : ${pct(s.civilKilled, s.totalCivil)}%`,
        `Percent of soldier killed : ${pct(s.soldierKilled, s.totalSoldier)}%`,
        `Total damage taken : ${s.damageTaken}     Total heal point : ${s.healed}`,
        `Total ammo used : ${s.ammoUsed}     Total energy used : ${s.energyUsed}`,
      ];
      objects.push(this.add.text(width / 2, height / 2 - 20, lines.join('\n'), {
        fontFamily: 'Aldo', fontSize: '30px', color: '#cfd8ff', align: 'center', lineSpacing: 6,
      }).setOrigin(0.5).setScrollFactor(0).setDepth(PANEL_DEPTH + 1));
      specs = [exit];
      buttonsY = height / 2 + 190;
    }
    const buttons = new ButtonColumn(this, width / 2, buttonsY, specs, PANEL_DEPTH + 1);
    this.panel = { objects, buttons, kind };
    Keys.clearPressed();
  }

  private closePanel(): void {
    if (!this.panel) return;
    for (const o of this.panel.objects) o.destroy();
    this.panel.buttons.destroy();
    this.panel = null;
    Keys.clearPressed();
    this.acc = 0;
  }
}
