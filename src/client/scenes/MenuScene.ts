// Menu principal minimal : Play / Exit, comme rm_mainMenu de l'original (sans les options).
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { Bind, Keys } from '../keys.ts';
import { ButtonColumn } from '../view/ButtonColumn.ts';

export class MenuScene extends Phaser.Scene {
  private buttons!: ButtonColumn;

  constructor() {
    super('Menu');
  }

  create(): void {
    const { width, height } = this.scale;
    if (this.textures.exists(frameKey('spr_fondMenu_1', 0))) {
      this.add.image(width / 2, height / 2, frameKey('spr_fondMenu_1', 0)).setDisplaySize(width, height);
    }
    if (this.textures.exists(frameKey('spr_title', 0))) {
      this.add.image(width * 0.62, height * 0.28, frameKey('spr_title', 0)).setOrigin(0, 0);
    } else {
      this.add.text(width / 2, height * 0.3, 'STAND FOR PLANET EARTH', { fontFamily: 'Aldo', fontSize: '90px', color: '#ffffff' }).setOrigin(0.5);
    }
    this.buttons = new ButtonColumn(this, width * 0.2, height * 0.45, [
      { label: 'Play', sprite: 'spr_btn_play', action: () => this.scene.start('Game') },
    ]);
    this.add.text(width / 2, height - 60,
      'Move: WASD / ZQSD   Aim: mouse   Fire: left click   Reload: R   Dash: Space   Use / recharge: E   Pause: Esc',
      { fontFamily: 'Aldo', fontSize: '26px', color: '#cfd8ff' }).setOrigin(0.5).setAlpha(0.8);
    Keys.clearPressed();
    // raccourci de développement : http://localhost:3000/?play lance directement la partie
    if (new URLSearchParams(window.location.search).has('play')) this.scene.start('Game');
  }

  update(): void {
    this.buttons.update();
    if (Keys.wasPressed(...Bind.pause)) Keys.clearPressed();
  }
}
