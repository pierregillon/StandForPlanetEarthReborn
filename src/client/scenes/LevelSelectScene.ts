// Choix du point de départ, après le choix du héros (GD-032). L'original proposait de choisir sa salle ;
// ici on choisit où commencer le niveau, ce qui permet d'aller directement au boss.
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { Bind, Keys } from '../keys.ts';
import { DRILL_AREA, GROUND_FLOOR, UPPER_FLOOR, createSessionAt } from '../../sim/session.ts';

const STARTS = [
  { room: GROUND_FLOOR, title: 'GROUND FLOOR', text: 'Start of the level. The full run.' },
  { room: UPPER_FLOOR, title: 'UPPER FLOOR', text: 'Start upstairs, with the green card. Find the purple key.' },
  { room: DRILL_AREA, title: 'DRILLING AREA - BOSS', text: 'Start at the checkpoint, fully restored, with both cards.' },
];

export class LevelSelectScene extends Phaser.Scene {
  private selected = 0;
  private rows: { title: Phaser.GameObjects.Text; text: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super('LevelSelect');
  }

  create(): void {
    const { width, height } = this.scale;
    if (this.textures.exists(frameKey('spr_fondMenu_1', 0))) {
      this.add.image(width / 2, height / 2, frameKey('spr_fondMenu_1', 0)).setDisplaySize(width, height).setTint(0x8088a0);
    }
    this.add.text(width / 2, 130, 'WHERE DO YOU START?', { fontFamily: 'Aldo', fontSize: '80px', color: '#ffffff', stroke: '#000000', strokeThickness: 8 }).setOrigin(0.5);
    this.selected = 0;
    this.rows = STARTS.map((start, i) => {
      const y = 360 + i * 190;
      const title = this.add.text(width / 2, y, start.title, { fontFamily: 'Aldo', fontSize: '64px', color: '#ffffff', stroke: '#000000', strokeThickness: 7 }).setOrigin(0.5);
      const text = this.add.text(width / 2, y + 58, start.text, { fontFamily: 'Aldo', fontSize: '30px', color: '#ffe36b', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5);
      const zone = this.add.zone(width / 2, y + 25, 1200, 160).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        this.selected = i;
      });
      zone.on('pointerdown', () => {
        this.selected = i;
        this.confirm();
      });
      return { title, text };
    });
    this.add.text(width / 2, height - 80, 'Up / Down to choose   -   E or Enter to play   -   Esc to go back', {
      fontFamily: 'Aldo', fontSize: '26px', color: '#cfd8ff',
    }).setOrigin(0.5).setAlpha(0.8);
    Keys.clearPressed();
  }

  private confirm(): void {
    const hero = (this.registry.get('hero') as string | undefined) ?? 'PetBot';
    this.registry.set('session', createSessionAt(hero, STARTS[this.selected].room));
    this.scene.start('Game');
  }

  update(): void {
    if (Keys.wasPressed(...Bind.up)) this.selected = (this.selected + STARTS.length - 1) % STARTS.length;
    if (Keys.wasPressed(...Bind.down)) this.selected = (this.selected + 1) % STARTS.length;
    this.rows.forEach((row, i) => {
      const on = i === this.selected;
      row.title.setAlpha(on ? 1 : 0.35).setColor(on ? '#e04348' : '#ffffff').setScale(on ? 1.08 : 1);
      row.text.setAlpha(on ? 1 : 0.25);
    });
    if (Keys.wasPressed(...Bind.confirm)) this.confirm();
    else if (Keys.wasPressed(...Bind.pause)) this.scene.start('HeroSelect');
  }
}
