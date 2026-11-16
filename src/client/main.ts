import Phaser from 'phaser';
import { CONFIG } from '../sim/config.ts';
import { BootScene } from './scenes/BootScene.ts';
import { MenuScene } from './scenes/MenuScene.ts';
import { HeroSelectScene } from './scenes/HeroSelectScene.ts';
import { LevelSelectScene } from './scenes/LevelSelectScene.ts';
import { GameScene } from './scenes/GameScene.ts';
import { LobbyScene } from './scenes/LobbyScene.ts';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: CONFIG.camera.viewWidth,
  height: CONFIG.camera.viewHeight,
  backgroundColor: '#04060c',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  render: { antialias: true, roundPixels: false, powerPreference: 'high-performance' },
  disableContextMenu: true,
  scene: [BootScene, MenuScene, HeroSelectScene, LevelSelectScene, LobbyScene, GameScene],
});

// accès depuis la console du navigateur, pour le débogage
(window as unknown as { sfpe: Phaser.Game }).sfpe = game;
