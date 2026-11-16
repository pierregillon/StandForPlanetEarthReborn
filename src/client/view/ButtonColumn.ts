// Colonne de boutons de menu : navigation clavier ou souris, bouton non sélectionné à 20 % d'opacité
// (comme obj_btn_parent de l'original).
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { Bind, Keys } from '../keys.ts';

export interface ButtonSpec {
  label: string;
  sprite: string;
  action: () => void;
}

export class ButtonColumn {
  private readonly items: { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text; action: () => void }[] = [];
  private selected = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, specs: ButtonSpec[], depth = 0, spacing = 80) {
    specs.forEach((spec, i) => {
      const key = frameKey(spec.sprite, 0);
      const obj = scene.textures.exists(key)
        ? scene.add.image(x, y + i * spacing, key)
        : scene.add.text(x, y + i * spacing, spec.label, { fontFamily: 'Aldo', fontSize: '44px', color: '#ffffff' }).setOrigin(0.5);
      obj.setDepth(depth).setScrollFactor(0).setInteractive({ useHandCursor: true });
      obj.on('pointerover', () => {
        this.selected = i;
      });
      obj.on('pointerdown', () => spec.action());
      this.items.push({ obj, action: spec.action });
    });
  }

  update(): void {
    if (Keys.wasPressed(...Bind.up)) this.selected = (this.selected + this.items.length - 1) % this.items.length;
    if (Keys.wasPressed(...Bind.down)) this.selected = (this.selected + 1) % this.items.length;
    this.items.forEach((item, i) => item.obj.setAlpha(i === this.selected ? 1 : 0.2));
    if (Keys.wasPressed(...Bind.confirm)) this.items[this.selected].action();
  }

  destroy(): void {
    for (const item of this.items) item.obj.destroy();
    this.items.length = 0;
  }
}
