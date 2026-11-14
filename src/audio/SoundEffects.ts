import { GameState } from '../core/GameState.ts';
import { AudioCore } from './AudioCore.ts';

class SoundEffectsSystem {
  private ctx: AudioContext | null = null;
  private thrusterGain: GainNode | null = null;
  private thrusterFilter: BiquadFilterNode | null = null;
  private isThrusterActive: boolean = false;
  private roverGain: GainNode | null = null;
  private roverOsc: OscillatorNode | null = null;
  private roverLevel = 0;

  /** The shared context; effects play through the Effects bus of the mixer. */
  private initContext(): AudioContext | null {
    const ctx = AudioCore.context();
    if (ctx && ctx !== this.ctx) {
      this.ctx = ctx;
      this.setupThrusterNode();
      this.setupRoverNode();
    }
    return this.ctx;
  }

  /** Where every effect connects: the Effects bus (falls back to the speakers). */
  private out(ctx: AudioContext): AudioNode {
    return AudioCore.bus('sfx')?.dry ?? ctx.destination;
  }

  private isAudioAllowed(): boolean {
    return GameState.getState().settings.audioEnabled;
  }

  private setupThrusterNode(): void {
    if (!this.ctx) return;
    const noise = AudioCore.noiseBuffer();
    if (!noise) return;

    const whiteNoise = this.ctx.createBufferSource();
    whiteNoise.buffer = noise;
    whiteNoise.loop = true;

    this.thrusterFilter = this.ctx.createBiquadFilter();
    this.thrusterFilter.type = 'lowpass';
    this.thrusterFilter.frequency.value = 160;

    this.thrusterGain = this.ctx.createGain();
    this.thrusterGain.gain.setValueAtTime(0, this.ctx.currentTime);

    whiteNoise.connect(this.thrusterFilter);
    this.thrusterFilter.connect(this.thrusterGain);
    this.thrusterGain.connect(this.out(this.ctx));

    whiteNoise.start();
  }

  /** UNIT-7's drive motor: a soft electric whir with a little track rattle. */
  private setupRoverNode(): void {
    const ctx = this.ctx;
    const noise = AudioCore.noiseBuffer();
    if (!ctx || !noise) return;
    this.roverGain = ctx.createGain();
    this.roverGain.gain.value = 0;
    this.roverGain.connect(this.out(ctx));

    const motorLp = ctx.createBiquadFilter();
    motorLp.type = 'lowpass';
    motorLp.frequency.value = 420;
    motorLp.Q.value = 3;
    motorLp.connect(this.roverGain);
    this.roverOsc = ctx.createOscillator();
    this.roverOsc.type = 'sawtooth';
    this.roverOsc.frequency.value = 70;
    const motorG = ctx.createGain();
    motorG.gain.value = 0.5;
    this.roverOsc.connect(motorG);
    motorG.connect(motorLp);
    this.roverOsc.start();

    const rattle = ctx.createBufferSource();
    rattle.buffer = noise;
    rattle.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1300;
    bp.Q.value = 1.2;
    const rg = ctx.createGain();
    rg.gain.value = 0.25;
    rattle.connect(bp);
    bp.connect(rg);
    rg.connect(this.roverGain);
    rattle.start();
  }

  /** Drive motor level, 0 (stopped) to 1 (full speed). Safe to call every frame. */
  public setRover(level: number): void {
    const v = this.isAudioAllowed() ? Math.max(0, Math.min(1, level)) : 0;
    if (Math.abs(v - this.roverLevel) < 0.04 && v !== 0) return;
    if (v === 0 && this.roverLevel === 0) return;
    this.roverLevel = v;
    const ctx = AudioCore.running ? this.initContext() : this.ctx;
    if (!ctx || !this.roverGain || !this.roverOsc) return;
    const t = ctx.currentTime;
    this.roverGain.gain.setTargetAtTime(v * 0.05, t, v > 0 ? 0.08 : 0.15);
    this.roverOsc.frequency.setTargetAtTime(60 + v * 55, t, 0.15);
  }

  public setThruster(active: boolean): void {
    if (!this.isAudioAllowed()) {
      if (this.thrusterGain && this.ctx) {
        this.thrusterGain.gain.setValueAtTime(0, this.ctx.currentTime);
      }
      this.isThrusterActive = false;
      return;
    }

    const ctx = this.initContext();
    if (!ctx || !this.thrusterGain) return;

    if (active && !this.isThrusterActive) {
      this.isThrusterActive = true;
      this.thrusterGain.gain.cancelScheduledValues(ctx.currentTime);
      this.thrusterGain.gain.setTargetAtTime(0.18, ctx.currentTime, 0.04);
    } else if (!active && this.isThrusterActive) {
      this.isThrusterActive = false;
      this.thrusterGain.gain.cancelScheduledValues(ctx.currentTime);
      this.thrusterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.06);
    }
  }

  public playRCS(): void {
    if (!this.isAudioAllowed()) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(80, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.05);

    filter.type = 'lowpass';
    filter.frequency.value = 350;

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.out(ctx));

    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  public playRadarPing(distanceFactor: number): void {
    if (!this.isAudioAllowed()) return;
    const ctx = this.initContext();
    if (!ctx) return;

    // Pitch rises as distanceFactor decreases (closer)
    const baseFreq = 480 + (1 - Math.min(1, Math.max(0, distanceFactor))) * 400;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.95, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(this.out(ctx));

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  public playTouchdown(): void {
    if (!this.isAudioAllowed()) return;
    const ctx = this.initContext();
    if (!ctx) return;

    // Major triad victory chime: C5, E5, G5, C6
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);

      const startTime = ctx.currentTime + idx * 0.09;
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(this.out(ctx));

      osc.start(startTime);
      osc.stop(startTime + 0.45);
    });
  }

  public playCrash(): void {
    if (!this.isAudioAllowed()) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.35);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(80, ctx.currentTime + 0.35);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.out(ctx));

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  }

  /** Very soft low tick when the menu cursor moves between items. */
  public playHover(): void {
    if (!this.isAudioAllowed()) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(520, ctx.currentTime);

    gain.gain.setValueAtTime(0.012, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.018);

    osc.connect(gain);
    gain.connect(this.out(ctx));

    osc.start();
    osc.stop(ctx.currentTime + 0.02);
  }

  public playClick(): void {
    if (!this.isAudioAllowed()) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, ctx.currentTime);

    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.02);

    osc.connect(gain);
    gain.connect(this.out(ctx));

    osc.start();
    osc.stop(ctx.currentTime + 0.025);
  }

  public playWhoosh(): void {
    if (!this.isAudioAllowed()) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(260, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(540, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.05, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(this.out(ctx));

    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  }

  public playTypewriter(): void {
    if (!this.isAudioAllowed()) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(800 + Math.random() * 200, ctx.currentTime);

    gain.gain.setValueAtTime(0.015, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0005, ctx.currentTime + 0.018);

    osc.connect(gain);
    gain.connect(this.out(ctx));

    osc.start();
    osc.stop(ctx.currentTime + 0.02);
  }

  /**
   * UNIT-7's talking voice: a short robotic chirp per syllable. The pitch is
   * derived from the character so the same word sounds the same each time,
   * with a little wobble, a square-wave body and a quick downward glide.
   * `record` lines (verified facts) use a lower, steadier register.
   */
  public playVoiceBlip(ch: string, record = false): void {
    if (!this.isAudioAllowed()) return;
    const ctx = this.initContext();
    if (!ctx) return;
    const t = ctx.currentTime;

    const code = ch.toLowerCase().charCodeAt(0) || 97;
    const step = (code * 7) % 9; // 0..8, deterministic per letter
    const base = record ? 210 : 330;
    const f = base * Math.pow(2, step / 24) * (1 + (Math.random() - 0.5) * 0.04);
    const vowel = /[aeiouy]/i.test(ch);
    const dur = vowel ? 0.075 : 0.055;

    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(f * 1.06, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + dur * 0.6);
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(f / 2, t);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(vowel ? 1900 : 1400, t);
    filter.Q.setValueAtTime(4, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(0.03, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0005, t + dur);

    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(this.out(ctx));

    osc.start(t);
    sub.start(t);
    osc.stop(t + dur + 0.01);
    sub.stop(t + dur + 0.01);
  }

  public playBoosterRocket(): void {
    if (!this.isAudioAllowed()) return;
    const ctx = this.initContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(140, ctx.currentTime + 2.0);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, ctx.currentTime);
    filter.frequency.linearRampToValueAtTime(600, ctx.currentTime + 2.0);

    gain.gain.setValueAtTime(0.01, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.5);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.out(ctx));

    osc.start();
    osc.stop(ctx.currentTime + 2.5);
  }
}

export const SoundFX = new SoundEffectsSystem();

