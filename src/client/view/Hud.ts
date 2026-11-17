// Interface en jeu : barre d'énergie, portrait (la vie se lit dessus), chargeur, consigne, notifications.
// Référence : obj_healthBar, obj_healthBar_vignette, obj_compteurMunition, obj_consigne_world2.
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { CONFIG } from '../../sim/config.ts';
import { donorsOf } from '../../sim/link.ts';
import { ultiReady } from '../../sim/ulti.ts';
import type { Hero } from '../../sim/types.ts';
import type { World } from '../../sim/world.ts';

const DEPTH = 10000;
const OUTLINE = { stroke: '#000000', strokeThickness: 6 };

interface MateCard {
  bar: Phaser.GameObjects.Image | null;
  portrait: Phaser.GameObjects.Image | null;
  damage: Phaser.GameObjects.Image | null;
  label: Phaser.GameObjects.Text;
}
/** Avatars en bas à gauche : position du sien, puis écart avec celui de chaque coéquipier, collé à sa droite. */
const AVATAR_X = 131;
const AVATAR_SPACING = 205;

export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly world: World;
  private readonly bar?: Phaser.GameObjects.Image;
  private readonly portrait?: Phaser.GameObjects.Image;
  private readonly damage?: Phaser.GameObjects.Image;
  private readonly nameLabel: Phaser.GameObjects.Text;
  private readonly objective: Phaser.GameObjects.Text;
  private readonly notice: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  private readonly countdown: Phaser.GameObjects.Text;
  /** Vignettes des coéquipiers, par rang de héros. */
  private readonly mateCards = new Map<number, MateCard>();
  /** Noms des joueurs, par rang de héros (partie en réseau). */
  playerNames: string[] = [];
  private readonly bossBar: Phaser.GameObjects.Graphics;
  /** Arcs électriques autour de l'avatar d'un robot dont l'ulti est prêt. */
  private readonly ready: Phaser.GameObjects.Graphics;
  private readonly cardIcons = new Map<string, Phaser.GameObjects.Image>();
  private noticeUntil = 0;
  /** L'introduction est en cours : l'interface est masquée. */
  private intro = false;
  /** Masque l'interface (caméra libre). */
  hidden = false;

  constructor(scene: Phaser.Scene, world: World) {
    this.scene = scene;
    this.world = world;
    const { width, height } = scene.scale;
    const def = world.hero.def;
    const x = AVATAR_X;
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
    // nom du robot sous son portrait. Pas de chiffres (GD-042) : le cadre montre l'énergie, le portrait qui
    // rougit montre la vie, la jauge sur l'arme montre les munitions.
    this.nameLabel = scene.add.text(x - 6, y + 78, def.name.toUpperCase(), { fontFamily: 'Aldo', fontSize: '28px', color: '#ffffff', ...OUTLINE }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH + 3);
    for (const color of ['green', 'purple']) {
      const key = `card:${color}`;
      if (scene.textures.exists(key)) {
        this.cardIcons.set(color, scene.add.image(0, y + 56, key).setScale(0.6).setScrollFactor(0).setDepth(DEPTH + 3).setVisible(false));
      }
    }
    this.objective = scene.add.text(10, (height * 2) / 3, '', {
      fontFamily: 'Aldo', fontSize: '26px', color: '#ffffff', wordWrap: { width: 260 }, ...OUTLINE, strokeThickness: 4,
    }).setScrollFactor(0).setDepth(DEPTH);
    this.notice = scene.add.text(10, (height * 4) / 5 - 40, '', {
      fontFamily: 'Aldo', fontSize: '24px', color: '#ffe36b', wordWrap: { width: 500 }, ...OUTLINE, strokeThickness: 4,
    }).setScrollFactor(0).setDepth(DEPTH);
    this.bossBar = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH);
    this.ready = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 4);
    // compte à rebours de sortie du niveau, en haut de l'écran comme obj_countdown_GUI
    this.countdown = scene.add.text(width / 2, height / 8, '', {
      fontFamily: 'Aldo', fontSize: '60px', color: '#e04348', align: 'center', ...OUTLINE,
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH);
    this.hint = scene.add.text(width / 2, height - 190, '', {
      fontFamily: 'Blank', fontStyle: 'bold', fontSize: '30px', color: '#ffe400', ...OUTLINE,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(DEPTH);
  }

  /**
   * Avatars des coéquipiers (GD-041, GD-042) : exactement le même que le sien, collé à sa droite. Le cadre
   * montre l'énergie, le portrait rougit avec les dégâts, le nom du joueur est dessous.
   * Retourne le nombre d'avatars affichés.
   */
  private updateMates(): number {
    const world = this.world;
    const scene = this.scene;
    const y = scene.scale.height - 116;
    let rank = 0;
    for (const o of world.heroes) {
      if (o === world.hero) continue;
      let card = this.mateCards.get(o.id);
      if (!card && !o.gone) {
        const image = (sprite: string, depth: number): Phaser.GameObjects.Image | null => {
          if (!scene.textures.exists(frameKey(sprite, 0))) return null;
          const sp = world.sprite(sprite);
          return scene.add.image(0, y, frameKey(sprite, 0)).setOrigin(sp.ox / sp.w, sp.oy / sp.h).setScrollFactor(0).setDepth(depth);
        };
        card = {
          bar: image('spr_healthBar', DEPTH),
          portrait: image(o.def.sprites.portrait, DEPTH + 1),
          damage: image(o.def.sprites.portrait, DEPTH + 2)?.setTint(0xff0000).setAlpha(0.8) ?? null,
          label: scene.add.text(0, y + 78, '', { fontFamily: 'Aldo', fontSize: '28px', color: '#ffffff', ...OUTLINE }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(DEPTH + 3),
        };
        this.mateCards.set(o.id, card);
      }
      if (!card) continue;
      const shown = !o.gone && !this.intro;
      for (const part of [card.bar, card.portrait, card.damage, card.label]) part?.setVisible(shown);
      if (!shown) continue;
      rank++;
      const x = AVATAR_X + rank * AVATAR_SPACING;
      const dead = o.state === 'dead';
      card.bar?.setX(x).setTexture(frameKey('spr_healthBar', Math.max(0, Math.min(12, o.energy))));
      card.portrait?.setX(x).setTint(dead ? 0x555555 : this.shine(o, x));
      if (card.portrait && card.damage) {
        const missing = dead ? 0 : 1 - o.hp / o.def.maxHealth;
        const fh = card.portrait.height;
        card.damage.setX(x).setVisible(missing > 0).setCrop(0, fh * (1 - missing), card.portrait.width, fh * missing);
      }
      card.label.setX(x - 6).setText((this.playerNames[o.id] ?? o.def.name).toUpperCase()).setColor(dead ? '#ff6b6b' : '#ffffff');
    }
    return rank;
  }

  /**
   * Ulti prêt (GD-044) : le cadre d'énergie de l'avatar « flambe » d'arcs électriques bleus et le portrait
   * brille. Retourne la teinte à donner au portrait (blanc quand l'ulti n'est pas prêt).
   */
  private shine(h: Hero, x: number): number {
    if (!ultiReady(h)) return 0xffffff;
    const g = this.ready;
    const y = this.scene.scale.height - 116;
    const cx = x - 6;
    const cy = y - 8;
    const now = this.scene.time.now;
    // halo qui bat sous les arcs
    g.fillStyle(0x4fb8ff, 0.1 + 0.08 * Math.sin(now / 120)).fillCircle(cx, cy, 104);
    for (let k = 0; k < 7; k++) {
      // chaque arc court le long du cadre et se tord : il est redessiné à chaque image
      let a = (now / 260 + k * 0.9) % (Math.PI * 2);
      const white = k % 3 === 0;
      g.lineStyle(white ? 2.5 : 4, white ? 0xffffff : 0x4fb8ff, white ? 0.95 : 0.8).beginPath();
      g.moveTo(cx + Math.cos(a) * 88, cy + Math.sin(a) * 88);
      for (let j = 0; j < 5; j++) {
        a += 0.13 + Math.random() * 0.1;
        const r = 84 + Math.random() * 22;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.strokePath();
    }
    // le portrait brille : il oscille entre sa couleur et un bleu très clair
    return Math.sin(now / 90) > 0 ? 0xffffff : 0xbfe9ff;
  }

  notify(text: string): void {
    this.notice.setText(text).setAlpha(1);
    this.noticeUntil = this.scene.time.now + 5000;
  }

  update(): void {
    const world = this.world;
    const h = world.hero;
    const now = this.scene.time.now;
    // pendant l'introduction, l'interface s'efface : la consigne n'apparaît qu'une fois les robots au sol,
    // comme le prévoyait obj_consigne_world2
    const intro = h.arrivalSteps > 0 || this.hidden || world.cast >= 0;
    this.intro = intro;

    if (this.bar) this.bar.setTexture(frameKey('spr_healthBar', Math.max(0, Math.min(12, h.energy)))).setVisible(!intro);
    this.portrait?.setVisible(!intro);
    this.nameLabel.setVisible(!intro);
    if (this.portrait && this.damage) {
      const missing = 1 - h.hp / h.def.maxHealth;
      const fh = this.portrait.height;
      this.damage.setVisible(missing > 0 && !intro).setCrop(0, fh * (1 - missing), this.portrait.width, fh * missing);
    }
    // les cartes d'accès trouvées s'affichent à droite du dernier avatar
    this.ready.clear();
    this.portrait?.setTint(h.state === 'dead' ? 0x555555 : this.shine(h, AVATAR_X));
    const avatars = 1 + this.updateMates();
    let cardX = AVATAR_X + (avatars - 1) * AVATAR_SPACING + 150;
    for (const [color, icon] of this.cardIcons) {
      const held = world.hasCard(color);
      icon.setVisible(held && !intro).setX(cardX);
      if (held) cardX += 62;
    }
    this.objective.setText(intro ? '' : world.objective);

    if (now > this.noticeUntil) this.notice.setAlpha(Math.max(0, this.notice.alpha - 0.02));

    // barre de vie du boss : rouge sur noir, en haut de l'écran, dès qu'il est apparu à l'écran (obj_sallyBot/Draw_64)
    this.bossBar.clear();
    const boss = world.boss;
    if (boss && boss.seen && world.npcs.includes(boss.npc)) {
      const w = this.scene.scale.width - 400;
      this.bossBar.fillStyle(0x000000, 0.85).fillRect(200, 100, w, 30);
      this.bossBar.fillStyle(boss.invulnerable ? 0x7a2a2a : 0xe01f1f, 1).fillRect(200, 100, w * Math.max(0, boss.npc.hp / boss.maxHp), 30);
      this.bossBar.lineStyle(3, 0xffffff, 0.8).strokeRect(200, 100, w, 30);
    }

    let hint = '';
    let hintColor = '#ffe400';
    if (h.state !== 'dead') {
      const fallen = world.heroes.find((o) => o !== h && !o.gone && o.state === 'dead'
        && Math.hypot(o.x - h.x, o.y - h.y) <= CONFIG.revive.range + h.def.radius + o.def.radius);
      const linkedTo = h.linkTo >= 0 ? world.heroes[h.linkTo] : null;
      const donors = donorsOf(world, h);
      const nameOf = (o: { id: number; def: { name: string } }): string => this.playerNames[o.id] ?? o.def.name;
      if (h.ultiPhase > 0) hint = '';
      else if (ultiReady(h)) hint = 'ULTIMATE READY - press F';
      else if (h.reviving >= 0) hint = `Reviving... ${Math.ceil((h.def.reviveSteps - h.reviveSteps) / 60)}`;
      else if (fallen) hint = h.energy >= CONFIG.revive.energyCost ? 'Hold E to revive your teammate' : `${CONFIG.revive.energyCost} energy needed to revive`;
      else if (linkedTo) hint = `Giving your energy to ${nameOf(linkedTo)} - A to unlink`;
      else if (donors.length > 0) hint = `Receiving energy from ${donors.map(nameOf).join(', ')}`;
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
    if (world.markCountdown > 0) this.countdown.setText(`ON AIR IN\n${Math.ceil(world.markCountdown / 60)}`);
    else this.countdown.setText(leavingIn > 0 ? `Leaving area :\n${Math.ceil(leavingIn / 60)}` : '');

  }
}
