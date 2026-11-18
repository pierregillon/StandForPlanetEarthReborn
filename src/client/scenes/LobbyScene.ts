// Salon multijoueur (GD-040) : on y crée ou rejoint la partie, chacun choisit son robot (un robot ne peut
// être pris qu'une fois), puis l'hôte choisit le point de départ (GD-091) et lance le jeu.
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { Bind, Keys } from '../keys.ts';
import { Connection, playerName } from '../net/Connection.ts';
import { CONFIG } from '../../sim/config.ts';
import { MAX_PLAYERS } from '../../net/messages.ts';

const ORDER = ['BatBot', 'PetBot', 'BadaBot', 'EngiBot'];
const TEXT = { fontFamily: 'Aldo', color: '#ffffff', stroke: '#000000', strokeThickness: 6 };

export class LobbyScene extends Phaser.Scene {
  private conn!: Connection;
  private cards: { frame: Phaser.GameObjects.Image | null; name: Phaser.GameObjects.Text; owner: Phaser.GameObjects.Text }[] = [];
  private roster!: Phaser.GameObjects.Text;
  private status!: Phaser.GameObjects.Text;
  private startButton!: Phaser.GameObjects.Text;
  private hovered = -1;

  constructor() {
    super('Lobby');
  }

  create(data: { mode?: 'create' | 'join' }): void {
    const { width, height } = this.scale;
    if (this.textures.exists(frameKey('spr_fondMenu_1', 0))) {
      this.add.image(width / 2, height / 2, frameKey('spr_fondMenu_1', 0)).setDisplaySize(width, height).setTint(0x8088a0);
    }
    this.add.text(width / 2, 90, 'MULTIPLAYER LOBBY', { ...TEXT, fontSize: '80px', strokeThickness: 8 }).setOrigin(0.5);

    // on arrive ici du menu (créer ou rejoindre) ou d'une partie terminée (la connexion existe déjà)
    const existing = Connection.current(this);
    this.conn = existing?.lobby?.joined ? existing : Connection.open(this, playerName());
    this.conn.error = '';
    this.conn.room = null;
    if (data.mode) this.conn.send({ t: data.mode });

    this.hovered = -1;
    this.cards = ORDER.map((name, i) => {
      const def = CONFIG.heroes[name];
      const x = width / 2 + (i - 1.5) * 400;
      const y = height / 2 - 70;
      const key = frameKey(def.sprites.select, 0);
      const frame = this.textures.exists(key) ? this.add.image(x, y, key).setScale(0.8) : null;
      const label = this.add.text(x, y + 215, def.name, { ...TEXT, fontSize: '48px' }).setOrigin(0.5);
      const owner = this.add.text(x, y + 268, '', { ...TEXT, fontSize: '32px', color: '#ffe36b' }).setOrigin(0.5);
      const zone = this.add.zone(x, y + 20, 380, 560).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        this.hovered = i;
      });
      zone.on('pointerout', () => {
        if (this.hovered === i) this.hovered = -1;
      });
      zone.on('pointerdown', () => this.pick(name));
      return { frame, name: label, owner };
    });

    this.roster = this.add.text(90, height - 250, '', { ...TEXT, fontSize: '30px', lineSpacing: 8 });
    this.status = this.add.text(width / 2, height - 215, '', { ...TEXT, fontSize: '36px', color: '#ffe36b', align: 'center' }).setOrigin(0.5);
    this.startButton = this.add.text(width / 2, height - 130, 'START GAME', { ...TEXT, fontSize: '64px' }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.startButton.on('pointerdown', () => this.chooseStart());
    const leave = this.add.text(width - 90, height - 130, 'Leave', { ...TEXT, fontSize: '44px' }).setOrigin(1, 0.5).setInteractive({ useHandCursor: true });
    leave.on('pointerdown', () => this.leave());
    this.add.text(width / 2, height - 50, 'Click a robot to pick it   -   each robot can be taken only once   -   Esc to leave', {
      fontFamily: 'Aldo', fontSize: '26px', color: '#cfd8ff',
    }).setOrigin(0.5).setAlpha(0.8);
    this.input.setDefaultCursor('default');
    Keys.clearPressed();
  }

  private pick(hero: string): void {
    const lobby = this.conn.lobby;
    if (!lobby?.joined) return;
    const mine = lobby.players.find((p) => p.id === lobby.you)?.hero;
    // un clic sur son propre robot le libère
    this.conn.send({ t: 'pick', hero: mine === hero ? null : hero });
  }

  /** L'hôte passe au choix de la carte et du point de départ, une fois que chacun a son robot (GD-091). */
  private chooseStart(): void {
    const lobby = this.conn.lobby;
    if (!lobby?.joined || !this.conn.isHost || lobby.players.some((p) => p.hero === null)) return;
    this.scene.start('LevelSelect', { host: true });
  }

  private leave(): void {
    Connection.leave(this);
    this.scene.start('Menu');
  }

  update(): void {
    if (Keys.wasPressed(...Bind.pause)) return this.leave();
    const conn = this.conn;
    if (conn.room) {
      // l'hôte a lancé la partie
      this.scene.start('Game');
      return;
    }
    const lobby = conn.lobby;
    const joined = lobby?.joined === true;
    const players = joined && lobby ? lobby.players : [];
    const me = players.find((p) => p.id === lobby?.you);

    this.cards.forEach((card, i) => {
      const owner = players.find((p) => p.hero === ORDER[i]);
      const mine = owner !== undefined && owner === me;
      const free = !owner;
      const lit = mine || (free && this.hovered === i);
      card.frame?.setAlpha(mine ? 1 : free ? (lit ? 0.9 : 0.55) : 0.25).setScale(mine ? 0.88 : 0.8);
      card.name.setColor(mine ? '#e04348' : '#ffffff').setAlpha(free || mine ? 1 : 0.4);
      card.owner.setText(owner ? (mine ? `${owner.name} (you)` : owner.name) : '');
    });

    const lines = players.map((p, i) => `P${i + 1}  ${p.name}${p.id === lobby?.host ? '  (host)' : ''}  -  ${p.hero ?? 'choosing...'}`);
    this.roster.setText(joined ? [`Players ${players.length}/${MAX_PLAYERS}`, ...lines].join('\n') : '');

    const everyonePicked = players.length > 0 && players.every((p) => p.hero !== null);
    const canStart = joined && conn.isHost && everyonePicked;
    this.startButton.setVisible(joined && conn.isHost).setAlpha(canStart ? 1 : 0.3);
    let status = '';
    if (conn.closed) status = 'Connection lost. Press Esc to go back.';
    else if (conn.error) status = conn.error;
    else if (!lobby) status = 'Connecting...';
    else if (!joined) status = 'Joining...';
    else if (!me?.hero) status = 'Pick your robot';
    else if (!everyonePicked) status = 'Waiting for the other players to pick a robot';
    else if (!conn.isHost) status = 'Waiting for the host to choose where to start';
    else if (players.length === 1) status = 'You can start alone, or wait for other players to join';
    this.status.setText(status);
  }
}
