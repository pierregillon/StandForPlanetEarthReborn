// Interface en jeu : barre d'énergie, portrait (la vie se lit dessus), chargeur, consigne, notifications.
// Référence : obj_healthBar, obj_healthBar_vignette, obj_compteurMunition, obj_consigne_world2.
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { CONFIG } from '../../sim/config.ts';
import type { World } from '../../sim/world.ts';

const DEPTH = 10000;
const OUTLINE = { stroke: '#000000', strokeThickness: 6 };

interface MateCard {
  bar: Phaser.GameObjects.Image | null;
  portrait: Phaser.GameObjects.Image | null;
  damage: Phaser.GameObjects.Image | null;
  label: Phaser.GameObjects.Text;
}
/** Vignettes des coéquipiers : taille par rapport à la sienne, position de la première, écart entre deux. */
const MATE_SCALE = 0.55;
const MATE_X = 640;
const MATE_SPACING = 200;

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
  /** Vignettes des coéquipiers, par rang de héros. */
  private readonly mateCards = new Map<number, MateCard>();
  /** Noms des joueurs, par rang de héros (partie en réseau). */
  playerNames: string[] = [];
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

  /**
   * Vignettes des coéquipiers (GD-041), à droite de la sienne : le même cadre en plus petit, avec le portrait
   * qui rougit à mesure que la vie baisse, l'énergie sur le cadre, et le nom du joueur dessous.
   */
  private updateMates(): void {
    const world = this.world;
    const scene = this.scene;
    const y = scene.scale.height - 96;
    let rank = 0;
    for (const o of world.heroes) {
      if (o === world.hero) continue;
      let card = this.mateCards.get(o.id);
      if (!card && !o.gone) {
        const image = (sprite: string, depth: number): Phaser.GameObjects.Image | null => {
          if (!scene.textures.exists(frameKey(sprite, 0))) return null;
          const sp = world.sprite(sprite);
          return scene.add.image(0, y, frameKey(sprite, 0)).setOrigin(sp.ox / sp.w, sp.oy / sp.h).setScale(MATE_SCALE).setScrollFactor(0).setDepth(depth);
        };
        card = {
          bar: image('spr_healthBar', DEPTH),
          portrait: image(o.def.sprites.portrait, DEPTH + 1),
          damage: image(o.def.sprites.portrait, DEPTH + 2)?.setTint(0xff0000).setAlpha(0.8) ?? null,
          label: scene.add.text(0, y + 44, '', { fontFamily: 'Aldo', fontSize: '20px', color: '#ffffff', align: 'center', ...OUTLINE, strokeThickness: 4 })
            .setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH + 3),
        };
        this.mateCards.set(o.id, card);
      }
      if (!card) continue;
      const shown = !o.gone;
      for (const part of [card.bar, card.portrait, card.damage, card.label]) part?.setVisible(shown);
      if (!shown) continue;
      const x = MATE_X + rank * MATE_SPACING;
      rank++;
      const dead = o.state === 'dead';
      card.bar?.setX(x).setTexture(frameKey('spr_healthBar', Math.max(0, Math.min(12, o.energy))));
      card.portrait?.setX(x).setTint(dead ? 0x555555 : 0xffffff);
      if (card.portrait && card.damage) {
        const missing = dead ? 0 : 1 - o.hp / o.def.maxHealth;
        const fh = card.portrait.height;
        card.damage.setX(x).setVisible(missing > 0).setCrop(0, fh * (1 - missing), card.portrait.width, fh * missing);
      }
      const name = (this.playerNames[o.id] ?? o.def.name).toUpperCase();
      card.label.setX(x - 3).setText(`${name}\n${dead ? 'DOWN' : `HP ${o.hp}/${o.def.maxHealth}   EN ${o.energy}`}`).setColor(dead ? '#ff6b6b' : '#ffffff');
    }
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
      const fallen = world.heroes.find((o) => o !== h && !o.gone && o.state === 'dead'
        && Math.hypot(o.x - h.x, o.y - h.y) <= CONFIG.revive.range + h.def.radius + o.def.radius);
      if (h.reviving >= 0) hint = `Reviving... ${Math.ceil((CONFIG.revive.steps - h.reviveSteps) / 60)}`;
      else if (fallen) hint = h.energy >= CONFIG.revive.energyCost ? 'Hold E to revive your teammate' : `${CONFIG.revive.energyCost} energy needed to revive`;
      else if (h.charging) hint = 'Linked to the charging station - E to unplug';
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
    const leavingIn = Math.max(world.exitCountdown, world.zoneCountdown);
    this.countdown.setText(leavingIn > 0 ? `Leaving area :\n${Math.ceil(leavingIn / 60)}` : '');

    this.updateMates();
  }
}
