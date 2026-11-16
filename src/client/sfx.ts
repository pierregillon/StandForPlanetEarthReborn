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

  /** Véhicule de largage : grondement de rotors pendant son passage, plus aigu au décollage. */
  vehicle(seconds: number): void {
    this.boost = 1.6;
    this.tone('sawtooth', 62, 48, seconds * 0.55, 0.11);
    this.tone('triangle', 124, 96, seconds * 0.55, 0.07);
    this.tone('sawtooth', 50, 95, seconds * 0.45, 0.11, seconds * 0.55);
    this.tone('triangle', 100, 190, seconds * 0.45, 0.06, seconds * 0.55);
    this.boost = 1;
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
  }
}
