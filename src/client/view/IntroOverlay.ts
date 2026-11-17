// Habillage de l'introduction du niveau (GD-077 à GD-080) : bandes de cinéma, boîte de dialogue où les
// répliques s'écrivent lettre par lettre avec le portrait de celui qui parle, invite à passer à la suite et
// jauge de la touche tenue qui passe toute la séquence.
// Référence : obj_cinematique et obj_textBox, écrits mais jamais activés dans l'original.
import Phaser from 'phaser';
import { frameKey } from '../assets.ts';
import { CONFIG } from '../../sim/config.ts';
import { ANCHOR, arrivalPhases, introLines, introShot, typingSteps } from '../../sim/intro.ts';
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
  /** Jauge de la touche tenue, dans la bande du bas. */
  skipBar: { width: 300, height: 8 },
  /** Durée des parasites quand l'image du journal saute, en millisecondes. */
  glitch: 420,
};

/** Portrait du présentateur de TvTv², au même format que ceux des robots (fabriqué par `npm run make-studio`). */
const ANCHOR_PORTRAIT = 'spr_cadre_anchor';

export class IntroOverlay {
  private readonly scene: Phaser.Scene;
  private readonly world: World;
  private readonly top: Phaser.GameObjects.Rectangle;
  private readonly bottom: Phaser.GameObjects.Rectangle;
  /** La boîte de dialogue entière : fond, portrait, nom, texte et invite. */
  private readonly panel: Phaser.GameObjects.Container;
  private readonly portrait: Phaser.GameObjects.Image;
  private readonly name: Phaser.GameObjects.Text;
  private readonly text: Phaser.GameObjects.Text;
  /** « SPACE » qui clignote quand la réplique est écrite en entier. */
  private readonly prompt: Phaser.GameObjects.Text;
  /** Pastille « LIVE » du journal de TvTv². */
  private readonly live: Phaser.GameObjects.Text;
  /** Parasites quand l'image du journal saute. */
  private readonly glitch: Phaser.GameObjects.Graphics;
  private glitchUntil = 0;
  private lastShot = '';
  private readonly hint: Phaser.GameObjects.Text;
  private readonly skipBar: Phaser.GameObjects.Graphics;
  /** 0 = bandes ouvertes, 1 = fermées. */
  private closed = 0;
  private lines: IntroLine[] = [];
  private linesKey = '';
  private shown: IntroLine | null = null;
  private wrapped = '';
  /** Appelé quand une nouvelle réplique commence (bruitage). */
  onLine: (() => void) | null = null;
  /** Appelé quand l'image du journal saute. */
  onGlitch: (() => void) | null = null;

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
    this.prompt = scene.add.text(s.box.width - 22, s.box.height - 14, '', { fontFamily: 'Aldo', fontSize: '22px', color: '#ffe36b' }).setOrigin(1, 1);
    this.live = scene.add.text(s.box.width - 22, 16, '●  LIVE', { fontFamily: 'Aldo', fontSize: '26px', color: '#ff4b4b', stroke: '#000000', strokeThickness: 4 }).setOrigin(1, 0);
    this.panel = scene.add.container((width - s.box.width) / 2, 0, [box, this.portrait, this.name, this.text, this.prompt, this.live]).setScrollFactor(0).setDepth(DEPTH + 1);
    this.glitch = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH - 1);
    this.hint = scene.add.text(width - 44, height - s.band / 2 - 8, '', { fontFamily: 'Aldo', fontSize: '26px', color: '#aab4d8' })
      .setOrigin(1, 0.5).setScrollFactor(0).setDepth(DEPTH + 1);
    this.skipBar = scene.add.graphics().setScrollFactor(0).setDepth(DEPTH + 1);
    this.panel.setVisible(false);
  }

  /**
   * Hauteur d'image que chaque bande cache en ce moment. La caméra peut dépasser d'autant le bord du niveau :
   * le largage a lieu tout près du bord sud, et le véhicule doit rester entier à l'image.
   */
  get cover(): number {
    return STYLE.band * Phaser.Math.Easing.Cubic.Out(this.closed);
  }

  /** `host` : ce joueur mène la séquence (l'hôte de la partie, ou le joueur seul). */
  update(host: boolean, delta: number): void {
    const world = this.world;
    const team = world.heroes.filter((h) => !h.gone && h.arrivalTotal > 0);
    const lead = team.find((h) => h.arrivalSteps > 0);
    const s = STYLE;
    const step = delta / 1000 / s.bandSeconds;
    this.closed = Phaser.Math.Clamp(this.closed + (lead ? step : -step), 0, 1);
    const k = Phaser.Math.Easing.Cubic.Out(this.closed);
    const { width, height } = this.scene.scale;
    this.top.setY(s.band * k).setVisible(k > 0);
    this.bottom.setY(height - s.band * k).setVisible(k > 0);
    this.hint.setVisible(lead !== undefined).setAlpha(k);
    this.skipBar.clear();
    this.glitch.clear();
    if (!lead) {
      this.panel.setVisible(false);
      this.shown = null;
      this.lastShot = '';
      return;
    }
    // le journal est coupé : l'image saute, des parasites la couvrent un instant
    const now = this.scene.time.now;
    const shot = introShot(arrivalPhases(lead.arrivalTotal), lead.arrivalTotal - lead.arrivalSteps).kind;
    if (shot === 'exit' && this.lastShot === 'hall') {
      this.glitchUntil = now + s.glitch;
      this.onGlitch?.();
    }
    this.lastShot = shot;
    if (now < this.glitchUntil) {
      const left = (this.glitchUntil - now) / s.glitch;
      this.glitch.fillStyle(0xffffff, 0.16 * left).fillRect(0, 0, width, height);
      for (let i = 0; i < 26; i++) {
        const y = Math.random() * height;
        const grey = Math.floor(120 + Math.random() * 135);
        this.glitch.fillStyle((grey << 16) | (grey << 8) | grey, (0.25 + Math.random() * 0.55) * left)
          .fillRect(Math.random() * width * 0.3 - 40, y, width * (0.4 + Math.random() * 0.8), 2 + Math.random() * 14);
      }
    }
    this.hint.setText(host ? 'SPACE: next      hold SPACE: skip' : 'The host leads the briefing');
    // jauge de la touche tenue : pleine, la séquence est passée
    const held = Phaser.Math.Clamp(world.introHold / CONFIG.arrival.skipHoldSteps, 0, 1);
    if (held > 0) {
      const x = width - 44 - s.skipBar.width;
      const y = height - s.band / 2 + 18;
      this.skipBar.fillStyle(0x3a4468, 1).fillRect(x, y, s.skipBar.width, s.skipBar.height);
      this.skipBar.fillStyle(0xffe36b, 1).fillRect(x, y, s.skipBar.width * held, s.skipBar.height);
    }
    const key = `${team.map((h) => h.def.name).join(',')}|${lead.arrivalTotal}`;
    if (key !== this.linesKey) {
      this.linesKey = key;
      this.lines = introLines(team.map((h) => h.def.name), lead.arrivalTotal);
    }
    const t = lead.arrivalTotal - lead.arrivalSteps;
    const next = this.lines[world.introLine];
    const line = next && next.at <= t ? next : null;
    const news = line?.speaker === ANCHOR;
    // le journal s'affiche en bas, comme un bandeau de télévision ; pour les robots, le véhicule occupe le bas
    // ou le haut de l'image selon l'endroit du largage, et la boîte prend l'autre côté
    const low = !news && lead.y - this.scene.cameras.main.scrollY > height / 2;
    this.panel.setY(low ? s.band + s.box.gap : height - s.band - s.box.gap - s.box.height);
    this.panel.setVisible(line !== null);
    if (!line) {
      this.shown = null;
      return;
    }
    if (line !== this.shown) {
      this.shown = line;
      this.name.setText(news ? 'TvTv²  NEWS' : line.speaker.toUpperCase());
      this.live.setVisible(news);
      // les retours à la ligne sont fixés d'avance : un mot ne saute pas à la ligne pendant qu'il s'écrit
      this.wrapped = this.text.getWrappedText(line.text).join('\n');
      const sprite = CONFIG.heroes[line.speaker]?.sprites.portrait;
      const texture = frameKey(news ? ANCHOR_PORTRAIT : sprite ?? '', 0);
      if (texture && this.scene.textures.exists(texture)) {
        this.portrait.setTexture(texture);
        this.portrait.setScale(s.portrait / Math.max(this.portrait.frame.width, this.portrait.frame.height));
      }
      this.onLine?.();
    }
    const written = world.introLineSteps >= typingSteps(line.text);
    const letters = written ? this.wrapped.length : Math.floor(world.introLineSteps * CONFIG.arrival.lettersPerStep);
    this.text.setText(this.wrapped.slice(0, Math.max(0, letters)));
    // la réplique est écrite : l'invite clignote chez celui qui peut passer à la suite
    const blink = Math.floor(now / 380) % 2 === 0;
    // la pastille LIVE bat comme un voyant d'antenne
    if (news) this.live.setAlpha(Math.floor(now / 600) % 2 === 0 ? 1 : 0.45);
    this.prompt.setText(host ? 'SPACE  >' : '...').setVisible(written && (blink || !host));
  }
}
