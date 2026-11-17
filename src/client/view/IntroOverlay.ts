// Habillage de l'introduction du niveau (GD-077, GD-078) : bandes de cinéma, boîte de dialogue où les
// répliques s'écrivent lettre par lettre avec le portrait de celui qui parle, et rappel de la touche qui
// passe la séquence. Référence : obj_cinematique et obj_textBox, écrits mais jamais activés dans l'original.
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { CONFIG, STEPS_PER_SECOND } from '../../sim/config.ts';
import { introLineAt, introLines } from '../../sim/intro.ts';
import type { IntroLine } from '../../sim/intro.ts';
import type { World } from '../../sim/world.ts';

/** Au-dessus de l'interface de jeu (10000), sous les panneaux de pause et de fin (20000). */
const DEPTH = 15000;
const STYLE = {
  /** Hauteur de chaque bande, et durée de leur fermeture en secondes. */
  band: 130,
  bandSeconds: 0.45,
  box: { width: 1040, height: 156, gap: 28, fill: 0x020a26, alpha: 0.93 },
  portrait: 124,
  /** Lettres écrites par seconde. */
  typing: 48,
};

export class IntroOverlay {
  private readonly scene: Phaser.Scene;
  private readonly world: World;
  private readonly top: Phaser.GameObjects.Rectangle;
  private readonly bottom: Phaser.GameObjects.Rectangle;
  /** La boîte de dialogue entière : fond, portrait, nom et texte. */
  private readonly panel: Phaser.GameObjects.Container;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly name: Phaser.GameObjects.Text;
  private readonly text: Phaser.GameObjects.Text;
  private readonly hint: Phaser.GameObjects.Text;
  /** 0 = bandes ouvertes, 1 = fermées. */
  private closed = 0;
  private lines: IntroLine[] = [];
  private linesKey = '';
  private shown: IntroLine | null = null;
  private wrapped = '';

  constructor(scene: Phaser.Scene, world: World) {
    this.scene = scene;
    this.world = world;
    const { width, height } = scene.scale;
    const s = STYLE;
    this.top = scene.add.rectangle(0, 0, width, s.band, 0x000000).setOrigin(0, 1).setScrollFactor(0).setDepth(DEPTH);
    this.bottom = scene.add.rectangle(0, height, width, s.band, 0x000000).setOrigin(0, 0).setScrollFactor(0).setDepth(DEPTH);
    // la boîte reprend le sprite d'origine spr_textBox : bleu nuit, liseré blanc ; ses éléments sont placés
    // par rapport à son coin haut-gauche, la boîte entière se déplace ensuite
    const box = scene.add.graphics();
    box.fillStyle(s.box.fill, s.box.alpha).fillRect(0, 0, s.box.width, s.box.height);
    box.lineStyle(4, 0xffffff, 1).strokeRect(0, 0, s.box.width, s.box.height);
    box.lineStyle(4, 0x3a4468, 1).lineBetween(60, 0, 150, 0).lineBetween(s.box.width - 190, s.box.height, s.box.width - 80, s.box.height);
    this.portrait = scene.add.image(22 + s.portrait / 2, s.box.height / 2, '__DEFAULT');
    const textX = 22 + s.portrait + 26;
    this.name = scene.add.text(textX, 16, '', { fontFamily: 'Aldo', fontSize: '30px', color: '#ffe36b', stroke: '#000000', strokeThickness: 4 });
    this.text = scene.add.text(textX, 58, '', {
      fontFamily: 'Aldo', fontSize: '32px', color: '#ffffff', wordWrap: { width: s.box.width - textX - 28 }, lineSpacing: 6,
    });
    this.panel = scene.add.container((width - s.box.width) / 2, 0, [box, this.portrait, this.name, this.text]).setScrollFactor(0).setDepth(DEPTH + 1);
    this.hint = scene.add.text(width - 44, height - s.band / 2, '', { fontFamily: 'Aldo', fontSize: '26px', color: '#aab4d8' })
      .setOrigin(1, 0.5).setScrollFactor(0).setDepth(DEPTH + 1);
    this.setBoxVisible(false);
  }

  /**
   * Hauteur d'image que chaque bande cache en ce moment. La caméra peut dépasser d'autant le bord du niveau :
   * le largage a lieu tout près du bord sud, et le véhicule doit rester entier à l'image.
   */
  get cover(): number {
    return STYLE.band * Phaser.Math.Easing.Cubic.Out(this.closed);
  }

  private setBoxVisible(on: boolean): void {
    this.panel.setVisible(on);
  }

  /** `canSkip` : ce joueur peut passer la séquence (l'hôte, ou le joueur seul). */
  update(canSkip: boolean, delta: number): void {
    const team = this.world.heroes.filter((h) => !h.gone && h.arrivalTotal > 0);
    const lead = team.find((h) => h.arrivalSteps > 0);
    const s = STYLE;
    const step = delta / 1000 / s.bandSeconds;
    this.closed = Phaser.Math.Clamp(this.closed + (lead ? step : -step), 0, 1);
    const k = Phaser.Math.Easing.Cubic.Out(this.closed);
    const { height } = this.scene.scale;
    this.top.setY(s.band * k).setVisible(k > 0);
    this.bottom.setY(height - s.band * k).setVisible(k > 0);
    this.hint.setVisible(lead !== undefined).setAlpha(k);
    if (!lead) {
      this.setBoxVisible(false);
      this.shown = null;
      return;
    }
    this.hint.setText(canSkip ? 'SPACE: skip' : 'Host can skip');
    const key = `${team.map((h) => h.def.name).join(',')}|${lead.arrivalTotal}`;
    if (key !== this.linesKey) {
      this.linesKey = key;
      this.lines = introLines(team.map((h) => h.def.name), lead.arrivalTotal);
    }
    // le véhicule occupe le bas ou le haut de l'image selon l'endroit du largage : la boîte prend l'autre côté
    const low = lead.y - this.scene.cameras.main.scrollY > height / 2;
    this.panel.setY(low ? s.band + s.box.gap : height - s.band - s.box.gap - s.box.height);
    const t = lead.arrivalTotal - lead.arrivalSteps;
    const line = introLineAt(this.lines, t);
    this.setBoxVisible(line !== null);
    if (!line) {
      this.shown = null;
      return;
    }
    if (line !== this.shown) {
      this.shown = line;
      this.name.setText(line.speaker.toUpperCase());
      // les retours à la ligne sont fixés d'avance : un mot ne saute pas à la ligne pendant qu'il s'écrit
      this.wrapped = this.text.getWrappedText(line.text).join('\n');
      const sprite = CONFIG.heroes[line.speaker]?.sprites.portrait;
      const texture = sprite ? frameKey(sprite, 0) : '';
      if (texture && this.scene.textures.exists(texture)) {
        this.portrait.setTexture(texture);
        this.portrait.setScale(s.portrait / Math.max(this.portrait.frame.width, this.portrait.frame.height));
      }
    }
    const letters = Math.floor(((t - line.from) / STEPS_PER_SECOND) * s.typing);
    this.text.setText(this.wrapped.slice(0, Math.max(0, letters)));
  }
}
