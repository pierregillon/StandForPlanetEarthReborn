// Sons de synthèse pour ce que le jeu d'origine n'avait pas : bouton de porte, recharge sur une borne,
// point de sauvegarde (GD-031). Produits par WebAudio, sans fichier.
import Phaser from 'phaser';

export class Synth {
  private readonly ctx: AudioContext | null;
  private chargeOsc: OscillatorNode | null = null;
  private chargeGain: GainNode | null = null;

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
    gain.gain.setValueAtTime(volume, t0);
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
