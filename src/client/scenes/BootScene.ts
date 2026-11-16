// Chargement : manifestes et niveau d'abord, puis seulement les images et sons utiles.
import Phaser from 'phaser';
import { commonSounds, frameKey, spritesNeeded } from '../assets.ts';
import type { FloorManifest, SoundManifest } from '../assets.ts';
import type { LevelData, SpriteManifest } from '../../sim/types.ts';

export const FIRST_LEVEL = 'rm_world2';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.load.json('sprites', 'assets/sprites.json');
    this.load.json('floors', 'assets/floors.json');
    this.load.json('sounds', 'assets/sounds.json');
    this.load.json(`level:${FIRST_LEVEL}`, `levels/${FIRST_LEVEL}.json`);
  }

  create(): void {
    const { width, height } = this.scale;
    const sprites = this.cache.json.get('sprites') as SpriteManifest | undefined;
    const level = this.cache.json.get(`level:${FIRST_LEVEL}`) as LevelData | undefined;
    if (!sprites || !level) {
      this.add.text(width / 2, height / 2, 'Assets are missing.\nRun: npm run extract-assets && npm run convert-rooms', {
        fontFamily: 'monospace', fontSize: '28px', color: '#ff6666', align: 'center',
      }).setOrigin(0.5);
      return;
    }
    const floors = (this.cache.json.get('floors') ?? {}) as FloorManifest;
    const sounds = (this.cache.json.get('sounds') ?? {}) as SoundManifest;

    const label = this.add.text(width / 2, height / 2 - 40, 'Loading...', { fontFamily: 'monospace', fontSize: '28px', color: '#cfd8ff' }).setOrigin(0.5);
    const bar = this.add.rectangle(width / 2 - 300, height / 2 + 10, 0, 16, 0xe04348).setOrigin(0, 0.5);
    this.add.rectangle(width / 2, height / 2 + 10, 604, 20).setStrokeStyle(2, 0xcfd8ff);
    this.load.on('progress', (p: number) => {
      bar.width = 600 * p;
    });

    for (const name of spritesNeeded(level, sprites)) {
      for (let i = 0; i < sprites[name].frames; i++) this.load.image(frameKey(name, i), `assets/sprites/${name}/${i}.png`);
    }
    const tilesets = new Set(level.floors.map((f) => f.tileset));
    for (const t of tilesets) if (floors[t]) this.load.image(`floorsrc:${t}`, `assets/${floors[t].image}`);
    for (const name of commonSounds(sounds)) this.load.audio(name, `assets/${sounds[name].file}`);

    this.load.once('complete', () => {
      label.setText('Loading fonts...');
      const fonts = Promise.all([document.fonts.load('30px Aldo'), document.fonts.load('bold 28px Blank')]);
      // même si une police manque, on lance le jeu
      fonts.catch(() => undefined).then(() => this.scene.start('Menu'));
    });
    this.load.start();
  }
}
