// Interface en jeu : barre d'énergie, portrait (la vie se lit dessus), chargeur, consigne, notifications.
// Référence : obj_healthBar, obj_healthBar_vignette, obj_compteurMunition, obj_consigne_world2.
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { CONFIG } from '../../sim/config.ts';
import type { World } from '../../sim/world.ts';

const DEPTH = 10000;
const OUTLINE = { stroke: '#000000', strokeThickness: 6 };

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly world: World;
  private readonly bar?: Phaser.GameObjects.Image;
  private readonly portrait?: Phaser.GameObjects.Image;
  private readonly damage?: Phaser.GameObjects.Image;
  private readonly ammo: Phaser.GameObjects.Text;
  private readonly hp: Phaser.GameObjects.Text;
  private readonly energy: Phaser.GameObjects.Text;
  private readonly objective: Phaser.GameObjects.Text;
  private readonly notice: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly countdown: Phaser.GameObjects.Text;
  private readonly bossBar: Phaser.GameObjects.Graphics;
  private readonly dashPips: Phaser.GameObjects.Arc[] = [];
  private readonly cardIcons = new Map<string, Phaser.GameObjects.Image>();
  private noticeUntil = 0;

  constructor(scene: Phaser.Scene, world: World) {
    this.scene = scene;
    this.world = world;
    const { width, height } = scene.scale;
    const def = world.hero.def;
    const x = 131;
    const y = height - 116;

    if (scene.textures.exists(frameKey('spr_healthBar', 0))) {
      const sp = world.sprite('spr_healthBar');
      this.bar = scene.add.image(x, y, frameKey('spr_healthBar', 0)).setOrigin(sp.ox / sp.w, sp.oy / sp.h).setScrollFactor(0).setDepth(DEPTH);
    }
    if (scene.textures.exists(frameKey(def.sprites.portrait, 0))) {
      const sp = world.sprite(def.sprites.portrait);
      const key = frameKey(def.sprites.portrait, 0);
      this.portrait = scene.add.image(x, y, key).setOrigin(sp.ox / sp.w, sp.oy / sp.h).setScrollFactor(0).setDepth(DEPTH + 1);
      this.damage = scene.add.image(x, y, key).setOrigin(sp.ox / sp.w, sp.oy / sp.h).setScrollFactor(0).setDepth(DEPTH + 2).setTint(0xff0000).setAlpha(0.8);
    }
    // nom du robot sous son portrait, vie et énergie en chiffres à côté (GD-029)
    scene.add.text(x - 6, y + 78, def.name.toUpperCase(), { fontFamily: 'Aldo', fontSize: '28px', color: '#ffffff', ...OUTLINE }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH + 3);
    this.hp = scene.add.text(x + 44, y - 22, '', { fontFamily: 'Aldo', fontSize: '26px', color: '#ffffff', ...OUTLINE }).setScrollFactor(0).setDepth(DEPTH + 3);
    this.energy = scene.add.text(x + 44, y + 8, '', { fontFamily: 'Aldo', fontSize: '26px', color: '#8fdcff', ...OUTLINE }).setScrollFactor(0).setDepth(DEPTH + 3);
    this.ammo = scene.add.text(x + 44, y + 40, '', { fontFamily: 'Aldo', fontSize: '30px', color: '#ffffff', ...OUTLINE }).setScrollFactor(0).setDepth(DEPTH + 3);
    for (let i = 0; i < CONFIG.hero.dashCharges; i++) {
      this.dashPips.push(scene.add.circle(x + 200 + i * 26, y + 58, 9, 0x7fd3ff).setStrokeStyle(2, 0x000000).setScrollFactor(0).setDepth(DEPTH + 3));
    }
    for (const [i, color] of ['green', 'purple'].entries()) {
      const key = `card:${color}`;
      if (scene.textures.exists(key)) {
        this.cardIcons.set(color, scene.add.image(x + 280 + i * 62, y + 56, key).setScale(0.6).setScrollFactor(0).setDepth(DEPTH + 3).setVisible(false));
      }
    }
    this.objective = scene.add.text(10, (height * 2) / 3, '', {
      fontFamily: 'Aldo', fontSize: '26px', color: '#ffffff', wordWrap: { width: 260 }, ...OUTLINE, strokeThickness: 4,
    }).setScrollFactor(0).setDepth(DEPTH);
    this.notice = scene.add.text(10, (height * 4) / 5 - 40, '', {
      fontFamily: 'Aldo', fontSize: '24px', color: '#ffe36b', wordWrap: { width: 500 }, ...OUTLINE, strokeThickness: 4,
    }).setScrollFactor(0).setDepth(DEPTH);
    this.bossBar = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    // compte à rebours de sortie du niveau, en haut de l'écran comme obj_countdown_GUI
    this.countdown = scene.add.text(width / 2, height / 8, '', {
      fontFamily: 'Aldo', fontSize: '60px', color: '#e04348', align: 'center', ...OUTLINE,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH);
    this.hint = scene.add.text(width / 2, height - 190, '', {
      fontFamily: 'Blank', fontStyle: 'bold', fontSize: '30px', color: '#ffe400', ...OUTLINE,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH);
  }

  notify(text: string): void {
    this.notice.setText(text).setAlpha(1);
    this.noticeUntil = this.scene.time.now + 5000;
  }

  update(): void {
    const world = this.world;
    const h = world.hero;
    const now = this.scene.time.now;

    if (this.bar) this.bar.setTexture(frameKey('spr_healthBar', Math.max(0, Math.min(12, h.energy))));
    if (this.portrait && this.damage) {
      const missing = 1 - h.hp / h.def.maxHealth;
      const fh = this.portrait.height;
      this.damage.setVisible(missing > 0).setCrop(0, fh * (1 - missing), this.portrait.width, fh * missing);
      if (h.state === 'dead') this.portrait.setTint(0x555555);
    }
    this.hp.setText(h.state === 'dead' ? 'Dead' : `HP ${h.hp}/${h.def.maxHealth}`);
    this.energy.setText(`EN ${h.energy}/${CONFIG.hero.maxEnergy}`);

    for (const [color, icon] of this.cardIcons) icon.setVisible(world.hasCard(color));
    if (h.def.magazine === 0) {
      this.ammo.setText(`BATS ${h.bats}/2`).setColor(h.bats === 0 ? '#ff3030' : '#ffffff');
    } else if (h.reloadTimer > 0) {
      this.ammo.setText('RELOADING').setColor('#ffe36b');
    } else {
      // chargeur vide : clignote rouge / blanc toutes les 15 steps, comme le compteur d'origine
      const blink = h.ammo === 0 && Math.floor(world.tick / 15) % 2 === 0;
      this.ammo.setText(`${h.ammo}/${h.def.magazine}`).setColor(blink ? '#ff3030' : '#ffffff');
    }
    this.dashPips.forEach((pip, i) => pip.setFillStyle(0x7fd3ff, i < h.dashCharges ? 1 : 0.15));
    this.objective.setText(world.objective);

    if (now > this.noticeUntil) this.notice.setAlpha(Math.max(0, this.notice.alpha - 0.02));

    // barre de vie du boss : rouge sur noir, en haut de l'écran, dès qu'il est apparu à l'écran (obj_sallyBot/Draw_64)
    this.bossBar.clear();
    const boss = world.boss;
    if (boss && boss.seen && world.npcs.includes(boss.npc)) {
      const w = this.scene.scale.width - 400;
      this.bossBar.fillStyle(0x000000, 0.85).fillRect(200, 100, w, 30);
      this.bossBar.fillStyle(boss.invulnerable ? 0x7a2a2a : 0xe01f1f, 1).fillRect(200, 100, w * Math.max(0, boss.npc.hp / boss.npc.def.maxHealth), 30);
      this.bossBar.lineStyle(3, 0xffffff, 0.8).strokeRect(200, 100, w, 30);
    }

    let hint = '';
    let hintColor = '#ffe400';
    if (h.state !== 'dead') {
      if (h.charging) hint = 'Linked to the charging station - E to unplug';
      else if (h.def.magazine > 0 && h.reloadTimer === 0 && h.ammo === 0) hint = 'Press R to reload';
      else if (h.def.kind === 'BatBot' && h.bats === 0 && world.bats.some((b) => b.state !== 'returning')) hint = 'Press R to call your bats back';
      else if (world.nearCardDoor()) {
        // messages des portes à carte de l'original
        const door = world.nearCardDoor();
        const name = door?.card === 'green' ? 'Green' : 'Purple';
        hint = door && world.hasCard(door.card) ? 'Press Use (E)' : `${name} card needed`;
        hintColor = door && world.hasCard(door.card) ? '#ffe400' : door?.card === 'green' ? '#55ff66' : '#c060ff';
      }
      else if (world.usableButton()) hint = 'Press E';
      else {
        const outlet = world.nearestOutlet(CONFIG.outlet.range);
        const canGive = outlet && ((outlet.energyLeft > 0 && h.energy < CONFIG.hero.maxEnergy) || (outlet.repairLeft > 0 && h.hp < h.def.maxHealth));
        if (canGive) hint = 'Press E to plug in';
        else if (outlet && outlet.energyLeft === 0 && outlet.repairLeft === 0) hint = 'This charging station is empty';
      }
    }
    this.hint.setText(hint).setColor(hintColor);
    this.countdown.setText(world.exitCountdown > 0 ? `Leaving area :\n${Math.ceil(world.exitCountdown / 60)}` : '');
  }
}
