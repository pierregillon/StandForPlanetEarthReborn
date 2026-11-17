// Sons de synthèse pour ce que le jeu d'origine n'avait pas : bouton de porte, recharge sur une borne,
// point de sauvegarde (GD-031). Produits par WebAudio, sans fichier.
import Phaser from 'phaser';

/** Les bruitages de rechargement étaient à peine audibles : ils sont amplifiés (GD-033). */
const RELOAD_BOOST = 2.6;

export class Synth {
  private readonly ctx: AudioContext | null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;
  /** Multiplicateur de volume appliqué aux sons en cours de création. */
  private boost = 1;
  /** Rotors du véhicule de largage en train de tourner, pour pouvoir les couper net. */
  private rotors: { osc: OscillatorNode; gain: GainNode }[] = [];

  constructor(scene: Phaser.Scene) {
    const manager = scene.sound as unknown as { context?: AudioContext };
    this.ctx = manager.context ?? null;
  }

  private tone(type: OscillatorType, from: number, to: number, duration: number, volume: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + duration);
    gain.gain.setValueAtTime(Math.min(0.6, volume * this.boost), t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  /**
   * Souffle : du bruit blanc passé dans un filtre passe-bas qui se referme de `from` à `to` hertz. C'est ce
   * qui donne son claquement à une détonation, qu'un oscillateur seul ne sait pas faire.
   */
  private noise(from: number, to: number, duration: number, volume: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.9, volume * this.boost), t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(t0);
    source.stop(t0 + duration + 0.02);
  }

  /** Bouton de porte qui s'enfonce : un clac sourd puis un déclic. */
  buttonPress(): void {
    this.tone('square', 150, 55, 0.09, 0.16);
    this.tone('triangle', 900, 500, 0.05, 0.08, 0.07);
  }

  /** Début de rechargement, propre à chaque robot (GD-032). `seconds` = durée du rechargement. */
  reloadStart(kind: string, seconds: number): void {
    this.boost = RELOAD_BOOST;
    if (kind === 'PetBot') {
      // la fiole usée est éjectée : déclic puis chuintement
      this.tone('square', 340, 170, 0.06, 0.12);
      this.tone('sawtooth', 1100, 260, 0.2, 0.045, 0.07);
    } else if (kind === 'EngiBot') {
      // le chargeur tambour se dégage : trois crans
      for (let i = 0; i < 3; i++) this.tone('square', 230, 110, 0.045, 0.13, i * 0.1);
    } else if (kind === 'BadaBot') {
      // l'orbe se reforme : montée continue pendant toute la recharge
      this.tone('sine', 110, 640, seconds, 0.09);
      this.tone('triangle', 220, 1280, seconds, 0.03);
    }
    this.boost = 1;
  }

  /** Fin de rechargement : l'arme est verrouillée. */
  reloadEnd(kind: string): void {
    this.boost = RELOAD_BOOST;
    if (kind === 'PetBot') {
      this.tone('triangle', 620, 1150, 0.08, 0.13);
      this.tone('square', 200, 120, 0.04, 0.1, 0.07);
    } else if (kind === 'EngiBot') {
      this.tone('square', 170, 80, 0.09, 0.18);
      this.tone('triangle', 800, 420, 0.05, 0.08, 0.08);
    } else if (kind === 'BadaBot') {
      this.tone('sine', 700, 330, 0.28, 0.15);
    }
    this.boost = 1;
  }

  /** Note tenue : elle monte en `attack` secondes, tient, puis s'éteint en `release` secondes. */
  private hum(type: OscillatorType, from: number, to: number, duration: number, volume: number, delay: number, attack: number, release: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.linearRampToValueAtTime(to, t0 + duration);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + attack);
    gain.gain.setValueAtTime(volume, t0 + Math.max(attack, duration - release));
    gain.gain.linearRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
    this.rotors.push({ osc, gain });
    osc.onended = () => {
      this.rotors = this.rotors.filter((r) => r.osc !== osc);
    };
  }

  /**
   * Véhicule de largage : un grondement de rotors qui dure tant qu'il est là. Sa présence n'a pas de durée
   * connue d'avance, puisque le joueur lit les répliques à son rythme (GD-079) : `vehicleLeaves` y met fin.
   */
  vehicle(): void {
    this.vehicleStop();
    // dix minutes : bien plus qu'aucune introduction ; le départ ou le passage de la séquence l'arrête avant
    this.hum('sawtooth', 62, 56, 600, 0.1, 0, 0.5, 0.4);
    this.hum('triangle', 124, 112, 600, 0.06, 0, 0.5, 0.4);
  }

  /** Il redécolle : le grondement s'éteint sous une montée plus aiguë, pendant qu'il sort de l'écran. */
  vehicleLeaves(seconds: number): void {
    this.vehicleStop(0.35);
    this.hum('sawtooth', 50, 95, seconds, 0.12, 0, 0.25, seconds * 0.7);
    this.hum('triangle', 100, 190, seconds, 0.07, 0, 0.25, seconds * 0.7);
  }

  /** Une réplique commence : deux notes brèves, comme un poste radio qui s'ouvre. */
  radioBlip(): void {
    this.tone('square', 880, 880, 0.035, 0.05);
    this.tone('square', 1320, 1320, 0.045, 0.04, 0.05);
  }

  /** Les rotors se taisent, en `fade` secondes (tout de suite quand l'introduction est passée). */
  vehicleStop(fade = 0.04): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const { osc, gain } of this.rotors) {
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(0.0001, ctx.currentTime, fade);
      osc.stop(ctx.currentTime + fade * 6 + 0.1);
    }
    this.rotors = [];
  }

  /** Lien entre héros (GD-043) : une note qui monte quand il se pose, qui retombe quand il casse. */
  link(on: boolean): void {
    if (on) {
      this.tone('sine', 420, 880, 0.18, 0.12);
      this.tone('triangle', 840, 1760, 0.18, 0.05, 0.03);
    } else {
      this.tone('sine', 700, 240, 0.22, 0.1);
    }
  }

  /** Lancement d'un ulti : une montée grondante pendant tout le lancement. */
  ultiCast(seconds: number): void {
    this.boost = 1.8;
    this.tone('sawtooth', 60, 430, seconds, 0.09);
    this.tone('sine', 120, 1300, seconds, 0.07);
    this.tone('square', 34, 96, seconds, 0.05);
    this.boost = 1;
  }

  /** Atterrissage de BatBot : un coup sourd et son claquement. */
  ultiImpact(): void {
    this.boost = 2.4;
    this.tone('sine', 170, 26, 0.75, 0.24);
    this.tone('sawtooth', 95, 30, 0.45, 0.14);
    this.tone('square', 950, 110, 0.13, 0.08);
    this.boost = 1;
  }

  /** Un ulti produit son effet (GD-044) : essaim, choc des boucliers et vague, lancer de grenade, puis son impulsion. */
  ultiFx(kind: string): void {
    this.boost = 2;
    if (kind === 'PetBot') {
      // l'essaim se déploie : un bourdonnement aigu qui s'ouvre
      this.tone('triangle', 500, 1500, 0.5, 0.1);
      this.tone('sine', 750, 2200, 0.5, 0.06, 0.05);
    } else if (kind === 'BadaBot') {
      // la détonation d'un canon magnétique (GD-052) : un claquement sec, le coup sourd qui pousse l'air, la
      // décharge électrique qui s'effondre de l'aigu au grave, puis le grondement de l'onde qui s'éloigne
      this.noise(9000, 500, 0.09, 0.55);
      this.tone('sine', 150, 30, 0.6, 0.3);
      this.tone('square', 90, 28, 0.35, 0.16);
      this.tone('sawtooth', 3600, 110, 0.32, 0.13);
      this.tone('sine', 5200, 900, 0.18, 0.06);
      this.noise(1400, 90, 1.1, 0.22, 0.04);
    } else if (kind === 'EngiBot') {
      this.tone('square', 300, 140, 0.12, 0.12);
    } else {
      // l'impulsion électromagnétique : un claquement puis un sifflement qui s'effondre
      this.tone('square', 1800, 90, 0.5, 0.14);
      this.tone('sawtooth', 240, 40, 0.7, 0.16);
    }
    this.boost = 1;
  }

  /** Point de sauvegarde : trois notes montantes. */
  checkpoint(): void {
    this.tone('sine', 523, 523, 0.25, 0.14);
    this.tone('sine', 659, 659, 0.25, 0.14, 0.12);
    this.tone('sine', 784, 784, 0.5, 0.16, 0.24);
  }

  /** Recharge sur une borne : un bourdonnement dont la hauteur monte avec l'énergie (0 à 12). */
  charge(on: boolean, energy: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (!on) {
      if (this.chargeOsc && this.chargeGain) {
        this.chargeGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
        this.chargeOsc.stop(ctx.currentTime + 0.2);
      }
      this.chargeOsc = null;
      this.chargeGain = null;
      return;
    }
    if (!this.chargeOsc) {
      this.chargeOsc = ctx.createOscillator();
      this.chargeGain = ctx.createGain();
      this.chargeOsc.type = 'sawtooth';
      this.chargeGain.gain.value = 0.035;
      this.chargeOsc.connect(this.chargeGain).connect(ctx.destination);
      this.chargeOsc.start();
    }
    this.chargeOsc.frequency.setTargetAtTime(140 + energy * 55, ctx.currentTime, 0.08);
  }

  stop(): void {
    this.charge(false, 0);
    this.vehicleStop();
  }
}
