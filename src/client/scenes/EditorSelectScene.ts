// Éditeur de niveaux (ADR-018) : choix de la salle à retoucher, carte par carte.
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { Bind, Keys } from '../keys.ts';
import { MAPS } from '../../sim/session.ts';
import { ButtonColumn } from '../view/ButtonColumn.ts';

export class EditorSelectScene extends Phaser.Scene {
  private buttons!: ButtonColumn;

  constructor() {
    super('EditorSelect');
  }

  create(): void {
    const { width, height } = this.scale;
    if (this.textures.exists(frameKey('spr_fondMenu_1', 0))) {
      this.add.image(width / 2, height / 2, frameKey('spr_fondMenu_1', 0)).setDisplaySize(width, height).setTint(0x8088a0);
    }
    this.add.text(width / 2, 130, 'LEVEL EDITOR', { fontFamily: 'Aldo', fontSize: '80px', color: '#ffffff', stroke: '#000000', strokeThickness: 8 }).setOrigin(0.5);
    this.add.text(width / 2, 215, 'Pick the room to edit. Saving rewrites its file in public/levels; committing it stays your call.', {
      fontFamily: 'Aldo', fontSize: '28px', color: '#cfd8ff', stroke: '#000000', strokeThickness: 5,
    }).setOrigin(0.5);
    const rooms = MAPS.flatMap((map) => map.rooms.map((r) => ({ label: `${map.title}  ·  ${r.title}`, room: r.room })));
    this.buttons = new ButtonColumn(this, width / 2, 360, [
      ...rooms.map((r) => ({ label: r.label, sprite: 'none', action: () => this.scene.start('Editor', { room: r.room }) })),
      { label: 'Back', sprite: 'none', action: () => this.scene.start('Menu') },
    ], 0, 90);
    Keys.clearPressed();
    this.input.setDefaultCursor('default');
  }

  update(): void {
    this.buttons.update();
    if (Keys.wasPressed(...Bind.pause)) this.scene.start('Menu');
  }
}
