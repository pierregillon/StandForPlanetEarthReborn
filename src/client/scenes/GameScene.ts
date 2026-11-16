// Scène de jeu : fait avancer la simulation à pas fixe (60 par seconde) et la dessine.
import Phaser from 'phaser';
import { frameKey, heroSounds, heroSprites, roomSprites } from '../assets.ts';
import type { FloorManifest, SoundManifest } from '../assets.ts';
import { Bind, Keys } from '../keys.ts';
import { ButtonColumn } from '../view/ButtonColumn.ts';
import { Hud } from '../view/Hud.ts';
import { WorldView } from '../view/WorldView.ts';
import { Synth } from '../sfx.ts';
import { Connection } from '../net/Connection.ts';
import { Mirror } from '../../net/mirror.ts';
import type { RoomStart } from '../../net/messages.ts';
import { CONFIG, STEPS_PER_SECOND } from '../../sim/config.ts';
import { clamp } from '../../sim/geom.ts';
import { NO_INPUT } from '../../sim/types.ts';
import type { Hero, Input, LevelData, SpriteManifest } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';
import { isFreshStart, openRoom } from '../../sim/match.ts';
import { createSession } from '../../sim/session.ts';
import type { Session } from '../../sim/session.ts';

const STEP_MS = 1000 / STEPS_PER_SECOND;
const PANEL_DEPTH = 20000;
type PanelKind = 'pause' | 'lose' | 'end';

let cursorCss: string | null = null;
/** Curseur de visée : un réticule dessiné une fois, utilisé comme curseur de la souris en jeu (GD-029). */
function crosshairCursor(): string {
  if (cursorCss) return cursorCss;
  const size = 40;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return 'crosshair';
  const mid = size / 2;
  for (const [width, color] of [[5, 'rgba(0,0,0,0.75)'], [2, '#ffe36b']] as const) {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.arc(mid, mid, 11, 0, Math.PI * 2);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.moveTo(mid + dx * 6, mid + dy * 6);
      ctx.lineTo(mid + dx * 18, mid + dy * 18);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#ff4040';
  ctx.beginPath();
  ctx.arc(mid, mid, 2, 0, Math.PI * 2);
  ctx.fill();
  cursorCss = `url(${canvas.toDataURL()}) ${mid} ${mid}, crosshair`;
  return cursorCss;
}
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
  private synth!: Synth;
  private leaving = false;
  /** Partie en réseau : la connexion au serveur et le monde miroir qu'il tient à jour (null en solo). */
  private conn: Connection | null = null;
  private mirror: Mirror | null = null;
  private waitShade!: Phaser.GameObjects.Rectangle;
  private waitText!: Phaser.GameObjects.Text;

  constructor() {
    super('Game');
  }

  /** Partie en réseau en cours, s'il y en a une : la connexion et la salle annoncée par le serveur. */
  private netStart(): { conn: Connection; start: RoomStart } | null {
    const conn = Connection.current(this);
    return conn?.room ? { conn, start: conn.room } : null;
  }

  /** Charge les sprites et les sons des héros de la partie et de la salle s'ils ne le sont pas déjà. */
  preload(): void {
    const net = this.netStart();
    const heroes = (net ? net.start.heroNames : [this.heroName()]).map((name) => CONFIG.heroes[name]);
    const sprites = this.cache.json.get('sprites') as SpriteManifest;
    const sounds = (this.cache.json.get('sounds') ?? {}) as SoundManifest;
    const session = this.registry.get('session') as Session | null | undefined;
    const room = net ? net.start.room : session?.room ?? 'rm_world2';
    const names = roomSprites(room, sprites);
    for (const hero of heroes) names.push(...heroSprites(hero.kind, sprites));
    for (const name of names) {
      for (let i = 0; i < sprites[name].frames; i++) {
        if (!this.textures.exists(frameKey(name, i))) this.load.image(frameKey(name, i), `assets/sprites/${name}/${i}.png`);
      }
    }
    for (const hero of heroes) {
      for (const name of heroSounds(hero.kind, sounds)) {
        if (!this.cache.audio.exists(name)) this.load.audio(name, `assets/${sounds[name].file}`);
      }
    }
    const { width, height } = this.scale;
    const title = `Loading ${heroes.map((h) => h.name).join(', ')}...`;
    const label = this.add.text(width / 2, height / 2, title, { fontFamily: 'Aldo', fontSize: '48px', color: '#cfd8ff', align: 'center', lineSpacing: 10 }).setOrigin(0.5).setScrollFactor(0);
    let told = -1;
    const onProgress = (p: number): void => {
      // en réseau, les autres joueurs voient où en est ce chargement, et on voit le leur
      if (net && p - told >= 0.05) {
        told = p;
        net.conn.send({ t: 'loading', epoch: net.start.epoch, p });
      }
      label.setText(`${title}  ${Math.round(p * 100)}%${net ? this.waitingLines(net.conn, net.start.playerNames[net.start.you]) : ''}`);
    };
    this.load.on('progress', onProgress);
    this.load.once('complete', () => {
      this.load.off('progress', onProgress);
      label.destroy();
    });
  }

  /** Lignes « qui charge encore », pour l'écran de chargement et l'écran d'attente. */
  private waitingLines(conn: Connection, except = ''): string {
    const others = conn.waiting.filter((p) => p.name !== except);
    return others.length === 0 ? '' : `\n\n${others.map((p) => `${p.name}   loading ${Math.round(p.progress * 100)}%`).join('\n')}`;
  }

  private heroName(): string {
    const name = this.registry.get('hero') as string | undefined;
    return name && CONFIG.heroes[name] ? name : 'PetBot';
  }

  create(): void {
    const sprites = this.cache.json.get('sprites') as SpriteManifest;
    const floors = (this.cache.json.get('floors') ?? {}) as FloorManifest;
    const net = this.netStart();
    let world: World;
    let arriving: Hero[] | null = null;
    if (net) {
      // partie en réseau : le serveur fait tourner le jeu, on n'en tient qu'un miroir (ADR-014)
      const level = this.cache.json.get(`level:${net.start.room}`) as LevelData;
      this.mirror = new Mirror(level, sprites, net.start);
      this.conn = net.conn;
      world = this.mirror.world;
      this.session = world.session;
      net.conn.send({ t: 'ready', epoch: net.start.epoch });
      this.cameras.main.fadeIn(200, 19, 19, 19);
    } else {
      this.mirror = null;
      this.conn = null;
      // la partie (cartes, consigne, salles visitées) survit aux changements de salle
      let session = this.registry.get('session') as Session | null | undefined;
      if (!session || session.heroNames[0] !== this.heroName()) {
        session = createSession(this.heroName());
        this.registry.set('session', session);
      }
      this.session = session;
      arriving = (this.registry.get('arrivingHero') ?? null) as Hero[] | null;
      this.registry.set('arrivingHero', null);
      // début d'une partie : le robot se déploie (GD-031)
      const fresh = isFreshStart(session, arriving);
      const level = this.cache.json.get(`level:${session.room}`) as LevelData;
      world = openRoom(session, level, sprites, arriving, (Date.now() & 0xffff) + 1);
      // au rez-de-chaussée, le véhicule de largage amène le robot (GD-035)
      if (fresh) world.deployHero(session.room === 'rm_world2');
    }
    this.world = world;
    this.synth = new Synth(this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.synth.stop());
    this.leaving = false;
    if (arriving) this.cameras.main.fadeIn(200, 19, 19, 19);
    this.view = new WorldView(this, this.world, floors);
    this.hud = new Hud(this, this.world);
    this.view.playerNames = this.mirror?.playerNames ?? [];
    this.hud.playerNames = this.view.playerNames;
    this.acc = 0;
    this.panel = null;
    this.debugHold = {};
    // écran d'attente : tant qu'un joueur charge la salle, le jeu est à l'arrêt pour tout le monde (GD-041)
    const { width, height } = this.scale;
    this.waitShade = this.add.rectangle(width / 2, height / 2, width, height, 0x040c29, 0.82).setScrollFactor(0).setDepth(PANEL_DEPTH + 10).setVisible(false);
    this.waitText = this.add.text(width / 2, height / 2, '', {
      fontFamily: 'Aldo', fontSize: '44px', color: '#ffffff', align: 'center', lineSpacing: 12, stroke: '#000000', strokeThickness: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(PANEL_DEPTH + 11).setVisible(false);

    const target = this.cameraGoal();
    this.camX = target.x;
    this.camY = target.y;
    this.placeCamera();
    Keys.clearPressed();
    this.input.setDefaultCursor(crosshairCursor());

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
        // en réseau, c'est le serveur qui déplace le robot (s'il a été lancé avec SFPE_DEBUG=1)
        this.conn?.send({ t: 'teleport', x, y });
        this.world.hero.x = x;
        this.world.hero.y = y;
        this.snapCamera();
      },
    };
  }

  /** Point visé par la caméra : le robot, décalé d'un tiers vers le curseur (GD-029). */
  private cameraGoal(): { x: number; y: number } {
    const h = this.world.hero;
    if (h.state === 'dead') return { x: h.x, y: h.y };
    const pointer = this.input.activePointer;
    const { lookAhead, maxLookAhead, viewWidth, viewHeight } = CONFIG.camera;
    return {
      x: h.x + clamp((pointer.x - viewWidth / 2) * lookAhead, -maxLookAhead, maxLookAhead),
      y: h.y + clamp((pointer.y - viewHeight / 2) * lookAhead, -maxLookAhead, maxLookAhead),
    };
  }

  private snapCamera(): void {
    const target = this.cameraGoal();
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

  /** Entrée neutre : le robot s'arrête et garde sa visée (panneau ouvert pendant une partie en réseau). */
  private idleInput(): Input {
    const h = this.world.hero;
    return { ...NO_INPUT, aimX: h.x + Math.cos(h.angle) * 300, aimY: h.y + Math.sin(h.angle) * 300 };
  }

  /** Partie en réseau : applique ce que le serveur a envoyé. */
  private netUpdate(conn: Connection, mirror: Mirror): void {
    if (conn.closed) {
      this.exitToMenu();
      return;
    }
    if (conn.room && conn.room.epoch !== mirror.epoch) {
      // le serveur a ouvert une autre salle (escalier, Retry) : fondu, puis la scène redémarre dessus.
      // Les messages déjà reçus sont ceux de la nouvelle salle : on n'y touche pas.
      if (!this.leaving) {
        this.leaving = true;
        this.cameras.main.fadeOut(200, 19, 19, 19);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart());
      }
      return;
    }
    for (const msg of conn.take()) {
      if (msg.t === 's') {
        if (msg.epoch === mirror.epoch) mirror.receive(msg.snap, msg.ack, msg.ev);
      } else if (msg.t === 'won') {
        this.closePanel();
        Object.assign(this.session.stats, msg.stats);
        this.openPanel('end');
      }
    }
  }

  update(_time: number, delta: number): void {
    const mirror = this.mirror;
    const conn = this.conn;
    if (mirror && conn) {
      this.netUpdate(conn, mirror);
      if (conn.closed) return;
    }
    if (this.panel) {
      this.synth.charge(false, 0);
      this.panel.buttons.update();
      if (this.panel.kind === 'pause' && Keys.wasPressed(...Bind.pause)) this.closePanel();
    } else if (Keys.wasPressed(...Bind.pause)) {
      this.openPanel('pause');
    }
    // en solo, un panneau met le jeu en pause ; en réseau, la partie continue derrière lui
    if (this.panel && !mirror) {
      this.hud.update();
      return;
    }

    // un joueur charge encore la salle : rien ne bouge, on affiche qui l'on attend
    const waiting = conn !== null && conn.waiting.length > 0;
    this.waitShade.setVisible(waiting);
    this.waitText.setVisible(waiting);
    if (waiting && conn) this.waitText.setText(`Waiting for all players...${this.waitingLines(conn)}`);
    this.acc = waiting ? 0 : Math.min(this.acc + delta, STEP_MS * 5);
    let first = true;
    while (this.acc >= STEP_MS) {
      this.acc -= STEP_MS;
      const input = this.panel ? this.idleInput() : this.readInput(first);
      if (mirror && conn) {
        const sent = mirror.tick(input);
        if (!this.leaving) conn.send({ t: 'i', e: mirror.epoch, ...sent });
      } else {
        this.world.step(input);
      }
      first = false;
      const target = this.cameraGoal();
      this.camX += (target.x - this.camX) / CONFIG.camera.smoothing;
      this.camY += (target.y - this.camY) / CONFIG.camera.smoothing;
    }
    mirror?.frame(delta);
    this.placeCamera();

    const world = this.world;
    const mine = (e: { hero: number }): boolean => e.hero === world.viewHero;
    for (const e of world.drainEvents()) {
      if (e.type === 'sound') this.playSound(e.name, e.x, e.y);
      else if (e.type === 'notify') this.hud.notify(e.text);
      else if (e.type === 'changeRoom') this.changeRoom(e.room, e.spawn);
      else if (e.type === 'levelEnd') this.openPanel('end');
      else if (e.type === 'deploy') {
        const h = world.heroes[e.hero] ?? world.hero;
        this.playSound(e.sound, h.x, h.y);
      } else if (e.type === 'vehicleArrives') this.synth.vehicle(e.seconds);
      else if (e.type === 'buttonPressed') this.synth.buttonPress();
      else if (e.type === 'checkpoint') {
        this.synth.checkpoint();
        this.view.handleEvent(e);
      } else if (e.type === 'revived') {
        this.synth.checkpoint();
        this.hud.notify('Robot back online');
      } else if (e.type === 'reloadStart') {
        // le chargeur éjecté se voit chez tout le monde ; le bruitage ne joue que pour son propre robot
        if (mine(e)) this.synth.reloadStart(world.hero.def.kind, world.hero.def.reloadSteps / STEPS_PER_SECOND);
        this.view.handleEvent(e);
      } else if (e.type === 'reloadEnd') {
        if (mine(e)) this.synth.reloadEnd(world.hero.def.kind);
        this.view.handleEvent(e);
      } else if (e.type === 'emptyClick') {
        if (mine(e)) this.view.handleEvent(e);
      } else this.view.handleEvent(e);
    }
    this.view.sync(delta / 1000);
    this.hud.update();
    this.synth.charge(world.hero.charging, world.hero.energy);
    if (world.gameOver && this.panel?.kind !== 'lose' && this.panel?.kind !== 'end') {
      this.closePanel();
      this.openPanel('lose');
    }
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
      this.registry.set('arrivingHero', this.world.heroes);
      this.scene.restart();
    });
  }

  private exitToMenu(): void {
    this.input.setDefaultCursor('default');
    music?.stop();
    Connection.leave(this);
    this.registry.set('session', null);
    this.scene.start('Menu');
  }

  /** Retry : toute la partie recommence. */
  private retry(): void {
    if (this.conn) {
      // en réseau, c'est le serveur qui relance la partie pour tout le monde
      this.conn.send({ t: 'retry' });
      return;
    }
    const cp = this.session.checkpoint;
    if (cp) {
      // GD-031 : point de sauvegarde activé, on y reprend ; sa salle est remise à neuf, le reste est gardé
      this.session.rooms.get(cp.room)?.forget();
      this.session.room = cp.room;
      this.session.objective = Math.min(this.session.objective, 3);
      this.scene.restart();
      return;
    }
    // GD-029 : sinon on repart du début du niveau, sans carte, avec le même héros
    this.registry.set('session', null);
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
    const titles: Record<PanelKind, string> = { pause: this.conn ? 'MENU' : 'PAUSE', lose: 'YOU LOSE', end: 'SCORE' };
    const title = this.add.text(width / 2, height / 2 - 180, titles[kind], {
      fontFamily: 'Aldo', fontSize: kind === 'end' ? '70px' : '90px', color: '#ffffff',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(PANEL_DEPTH + 1);
    const objects: Phaser.GameObjects.GameObject[] = [bg, title];
    const exit = { label: 'Exit', sprite: 'spr_btn_exit', action: () => this.exitToMenu() };
    let specs = [{ label: 'Resume', sprite: 'spr_btn_resume', action: () => this.closePanel() }, exit];
    let buttonsY = height / 2;
    if (kind === 'lose') specs = [{ label: 'Retry', sprite: 'spr_btn_retry', action: () => this.retry() }, exit];
    if (kind === 'lose' && this.conn && !this.conn.isHost) {
      // seul l'hôte relance la partie
      specs = [exit];
      objects.push(this.add.text(width / 2, height / 2 - 70, 'Waiting for the host to retry...', {
        fontFamily: 'Aldo', fontSize: '34px', color: '#ffe36b',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(PANEL_DEPTH + 1));
    }
    if (kind === 'end') {
      // écran de score de l'original (rm_score), sans la « Global note : 42 » codée en dur (GD-028)
      const s = this.session.stats;
      const pct = (n: number, total: number): number => (total > 0 ? Math.round((100 * n) / total) : 0);
      const lines = [
        'SallyBot is destroyed. Planet Earth says thanks.',
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
