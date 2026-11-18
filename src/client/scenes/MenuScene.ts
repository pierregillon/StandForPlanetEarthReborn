// Menu principal minimal : Play / Exit, comme rm_mainMenu de l'original (sans les options).
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { Bind, Keys } from '../keys.ts';
import { CONFIG } from '../../sim/config.ts';
import { STARTS, createSessionAt } from '../../sim/session.ts';
import { ButtonColumn } from '../view/ButtonColumn.ts';

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]'];

export class MenuScene extends Phaser.Scene {
  private static shortcutUsed = false;
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
      { label: 'Play', sprite: 'spr_btn_play', action: () => this.scene.start('HeroSelect') },
      // multijoueur (GD-040) : pas de sprite d'origine pour ces deux boutons, ils sont en texte
      { label: 'Create game', sprite: 'none', action: () => this.scene.start('Lobby', { mode: 'create' }) },
      { label: 'Join game', sprite: 'none', action: () => this.scene.start('Lobby', { mode: 'join' }) },
      // éditeur de niveaux (ADR-018), à la place de « Explore the level » : il écrit sur le disque, donc
      // seulement sur la machine qui fait tourner le serveur. La caméra libre reste en jeu (touche V, pause).
      ...(LOCAL_HOSTS.includes(window.location.hostname) ? [{ label: 'Level editor', sprite: 'none', action: () => this.scene.start('EditorSelect') }] : []),
    ]);
    // retour de l'éditeur : ce que la sauvegarde a donné
    const note = this.registry.get('editorNote') as string | undefined;
    if (note) {
      this.registry.set('editorNote', '');
      this.add.text(width / 2, height - 110, note, { fontFamily: 'Aldo', fontSize: '30px', color: '#8ce99a', stroke: '#000000', strokeThickness: 5 }).setOrigin(0.5);
    }
    this.add.text(width / 2, height - 60,
      'Move: WASD / ZQSD   Aim: mouse   Fire: left click   Special: right click   Reload: R   Dash: Space   Use / recharge: E   Pause: Esc',
      { fontFamily: 'Aldo', fontSize: '26px', color: '#cfd8ff' }).setOrigin(0.5).setAlpha(0.8);
    Keys.clearPressed();
    this.input.setDefaultCursor('default');
    // raccourci de développement : http://localhost:3000/?play lance directement la partie
    // (?play=EngiBot choisit le héros)
    // Le raccourci ne joue qu'une fois : ensuite, Exit ramène bien au menu.
    // ?view ouvre la partie en caméra libre, sans avoir à passer par ?play
    const params = new URLSearchParams(window.location.search);
    // ?edit=rm_world2 ouvre l'éditeur sur une salle
    const edit = params.get('edit');
    if (edit !== null && !MenuScene.shortcutUsed && LOCAL_HOSTS.includes(window.location.hostname)) {
      MenuScene.shortcutUsed = true;
      this.scene.start('Editor', { room: edit });
      return;
    }
    const play = params.get('play') ?? (params.has('view') ? '' : null);
    if (play !== null && !MenuScene.shortcutUsed) {
      MenuScene.shortcutUsed = true;
      if (CONFIG.heroes[play]) this.registry.set('hero', play);
      // ?play=PetBot&room=rm_world2_2 démarre directement dans une salle, consigne correspondante active ;
      // ?play=PetBot&start=studio à un point de départ (drop, upstairs, studio, boss : GD-091)
      const start = params.get('start');
      const room = start && STARTS.some((s) => s.id === start) ? start : params.get('room');
      if (room && (room === start || ['rm_world2', 'rm_world2_1', 'rm_world2_2'].includes(room))) {
        this.registry.set('session', createSessionAt((this.registry.get('hero') as string | undefined) ?? 'PetBot', room));
      } else {
        this.registry.set('session', null);
      }
      this.scene.start('Game');
    }
  }

  update(): void {
    this.buttons.update();
    if (Keys.wasPressed(...Bind.pause)) Keys.clearPressed();
  }
}
