// Choix du héros. L'original proposait quatre cadres pour quatre joueurs ; en solo, un seul choix (GD-023).
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { Bind, Keys } from '../keys.ts';
import { CONFIG } from '../../sim/config.ts';

const ORDER = ['BatBot', 'PetBot', 'BadaBot', 'EngiBot'];

export class HeroSelectScene extends Phaser.Scene {
  private selected = 1;
  private cards: { frame: Phaser.GameObjects.Image | null; name: Phaser.GameObjects.Text }[] = [];
  private blurb!: Phaser.GameObjects.Text;

  constructor() {
    super('HeroSelect');
  }

  create(): void {
    const { width, height } = this.scale;
    if (this.textures.exists(frameKey('spr_fondMenu_1', 0))) {
      this.add.image(width / 2, height / 2, frameKey('spr_fondMenu_1', 0)).setDisplaySize(width, height).setTint(0x8088a0);
    }
    this.add.text(width / 2, 110, 'CHOOSE YOUR HERO', { fontFamily: 'Aldo', fontSize: '80px', color: '#ffffff', stroke: '#000000', strokeThickness: 8 }).setOrigin(0.5);

    const previous = this.registry.get('hero') as string | undefined;
    if (previous && ORDER.includes(previous)) this.selected = ORDER.indexOf(previous);
    this.cards = ORDER.map((name, i) => {
      const def = CONFIG.heroes[name];
      const x = width / 2 + (i - 1.5) * 440;
      const y = height / 2 - 20;
      const key = frameKey(def.sprites.select, 0);
      const frame = this.textures.exists(key) ? this.add.image(x, y, key).setScale(0.9) : null;
      const label = this.add.text(x, y + 240, def.name, { fontFamily: 'Aldo', fontSize: '54px', color: '#ffffff', stroke: '#000000', strokeThickness: 6 }).setOrigin(0.5);
      const zone = this.add.zone(x, y, 420, 560).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => {
        this.selected = i;
      });
      zone.on('pointerdown', () => {
        this.selected = i;
        this.confirm();
      });
      return { frame, name: label };
    });
    this.blurb = this.add.text(width / 2, height - 190, '', {
      fontFamily: 'Aldo', fontSize: '34px', color: '#ffe36b', stroke: '#000000', strokeThickness: 5, align: 'center', wordWrap: { width: 1500 },
    }).setOrigin(0.5);
    this.add.text(width / 2, height - 80, 'Left / Right to choose   -   E or Enter to play   -   Esc to go back', {
      fontFamily: 'Aldo', fontSize: '26px', color: '#cfd8ff',
    }).setOrigin(0.5).setAlpha(0.8);
    Keys.clearPressed();
  }

  private confirm(): void {
    this.registry.set('hero', ORDER[this.selected]);
    this.scene.start('LevelSelect');
  }

  update(): void {
    if (Keys.wasPressed(...Bind.left)) this.selected = (this.selected + ORDER.length - 1) % ORDER.length;
    if (Keys.wasPressed(...Bind.right)) this.selected = (this.selected + 1) % ORDER.length;
    this.cards.forEach((card, i) => {
      const on = i === this.selected;
      card.frame?.setAlpha(on ? 1 : 0.35).setScale(on ? 1 : 0.85);
      card.name.setAlpha(on ? 1 : 0.4).setColor(on ? '#e04348' : '#ffffff');
    });
    this.blurb.setText(CONFIG.heroes[ORDER[this.selected]].blurb);
    if (Keys.wasPressed(...Bind.confirm)) this.confirm();
    else if (Keys.wasPressed(...Bind.pause)) this.scene.start('Menu');
  }
}
