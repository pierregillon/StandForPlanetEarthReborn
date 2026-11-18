// Choix du point de départ (GD-032, GD-091) : la carte, puis l'endroit où commencer. L'original proposait de
// choisir sa salle ; ici on peut aller directement au boss, ou reprendre juste après l'ultimatum.
// En solo, l'écran suit le choix du héros. À plusieurs, c'est l'hôte qui y passe, après le choix des robots
// dans le salon : les autres joueurs attendent dans le salon.
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { Bind, Keys } from '../keys.ts';
import { Connection } from '../net/Connection.ts';
import { MAPS, STARTS, createSessionAt } from '../../sim/session.ts';
import type { StartPoint } from '../../sim/session.ts';

const TEXT = { fontFamily: 'Aldo', color: '#ffffff', stroke: '#000000' };

export class LevelSelectScene extends Phaser.Scene {
  /** Rang de la carte choisie, et rang du point de départ dans cette carte. */
  private map = 0;
  private selected = 0;
  /** À plusieurs : la connexion de l'hôte ; null en solo. */
  private conn: Connection | null = null;
  /** L'hôte a lancé la partie : on attend que le serveur annonce la salle. */
  private launched = false;
  private tabs: Phaser.GameObjects.Text[] = [];
  private rows: { title: Phaser.GameObjects.Text; text: Phaser.GameObjects.Text; zone: Phaser.GameObjects.Zone }[] = [];
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super('LevelSelect');
  }

  /** Points de départ de la carte choisie. */
  private starts(): StartPoint[] {
    return STARTS.filter((s) => s.map === MAPS[this.map].id);
  }

  create(data: { host?: boolean }): void {
    const { width, height } = this.scale;
    this.conn = data.host ? Connection.current(this) : null;
    if (data.host && !this.conn) {
      // la connexion est tombée entre le salon et ici : le salon le dira
      this.scene.start('Lobby');
      return;
    }
    this.launched = false;
    this.map = 0;
    this.selected = 0;
    if (this.textures.exists(frameKey('spr_fondMenu_1', 0))) {
      this.add.image(width / 2, height / 2, frameKey('spr_fondMenu_1', 0)).setDisplaySize(width, height).setTint(0x8088a0);
    }
    this.add.text(width / 2, 110, 'WHERE DO YOU START?', { ...TEXT, fontSize: '80px', strokeThickness: 8 }).setOrigin(0.5);
    // les cartes, en onglets
    this.tabs = MAPS.map((map, i) => {
      const x = width / 2 + (i - (MAPS.length - 1) / 2) * 620;
      const tab = this.add.text(x, 250, map.title, { ...TEXT, fontSize: '52px', strokeThickness: 7 }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      tab.on('pointerdown', () => this.pickMap(i));
      return tab;
    });
    // les points de départ de la carte choisie : autant de lignes que la carte la mieux fournie
    const most = Math.max(...MAPS.map((map) => STARTS.filter((s) => s.map === map.id).length));
    this.rows = Array.from({ length: most }, (_, i) => {
      const y = 420 + i * 170;
      const title = this.add.text(width / 2, y, '', { ...TEXT, fontSize: '60px', strokeThickness: 7 }).setOrigin(0.5);
      const text = this.add.text(width / 2, y + 56, '', { ...TEXT, fontSize: '30px', color: '#ffe36b', strokeThickness: 5 }).setOrigin(0.5);
      const zone = this.add.zone(width / 2, y + 25, 1300, 150).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        if (i < this.starts().length) this.selected = i;
      });
      zone.on('pointerdown', () => {
        if (i >= this.starts().length) return;
        this.selected = i;
        this.confirm();
      });
      return { title, text, zone };
    });
    this.status = this.add.text(width / 2, height - 150, '', { ...TEXT, fontSize: '36px', color: '#ffe36b', strokeThickness: 6 }).setOrigin(0.5);
    this.add.text(width / 2, height - 80, 'Left / Right: map   -   Up / Down: starting point   -   E or Enter to play   -   Esc to go back', {
      fontFamily: 'Aldo', fontSize: '26px', color: '#cfd8ff',
    }).setOrigin(0.5).setAlpha(0.8);
    this.input.setDefaultCursor('default');
    Keys.clearPressed();
  }

  private pickMap(i: number): void {
    if (this.launched) return;
    this.map = (i + MAPS.length) % MAPS.length;
    this.selected = 0;
  }

  private confirm(): void {
    if (this.launched) return;
    const start = this.starts()[this.selected];
    if (!start) return;
    if (this.conn) {
      // à plusieurs, c'est le serveur qui crée la partie : la scène de jeu s'ouvre quand il annonce la salle
      this.launched = true;
      this.conn.error = '';
      this.conn.send({ t: 'start', at: start.id });
      return;
    }
    const hero = (this.registry.get('hero') as string | undefined) ?? 'PetBot';
    this.registry.set('session', createSessionAt(hero, start.id));
    this.scene.start('Game');
  }

  update(): void {
    const conn = this.conn;
    if (conn) {
      if (conn.room) {
        this.scene.start('Game');
        return;
      }
      // connexion perdue, refus du serveur, ou l'on n'est plus l'hôte : retour au salon, qui dit pourquoi
      if (conn.closed || !conn.isHost || (this.launched && conn.error)) {
        this.scene.start('Lobby');
        return;
      }
    }
    if (!this.launched) {
      if (Keys.wasPressed(...Bind.left)) this.pickMap(this.map - 1);
      if (Keys.wasPressed(...Bind.right)) this.pickMap(this.map + 1);
      const count = this.starts().length;
      if (Keys.wasPressed(...Bind.up)) this.selected = (this.selected + count - 1) % count;
      if (Keys.wasPressed(...Bind.down)) this.selected = (this.selected + 1) % count;
    }
    this.tabs.forEach((tab, i) => {
      const on = i === this.map;
      tab.setAlpha(on ? 1 : 0.4).setColor(on ? '#ffe36b' : '#ffffff').setScale(on ? 1.08 : 1);
    });
    const starts = this.starts();
    this.rows.forEach((row, i) => {
      const start = starts[i];
      const on = i === this.selected;
      row.title.setText(start?.title ?? '').setAlpha(on ? 1 : 0.35).setColor(on ? '#e04348' : '#ffffff').setScale(on ? 1.08 : 1);
      row.text.setText(start?.text ?? '').setAlpha(on ? 1 : 0.25);
    });
    this.status.setText(this.launched ? 'Starting the game...' : conn ? 'You are the host: the whole team starts where you choose' : '');
    if (this.launched) return;
    if (Keys.wasPressed(...Bind.confirm)) this.confirm();
    else if (Keys.wasPressed(...Bind.pause)) this.scene.start(conn ? 'Lobby' : 'HeroSelect');
  }
}
