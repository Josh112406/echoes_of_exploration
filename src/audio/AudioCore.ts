import { GameState } from '../core/GameState.ts';

/**
 * Shared Web Audio graph for the whole game. Everything is synthesized in the
 * browser (no audio files, no network requests):
 *
 *   music voices    ─┐                       ┌─ duck filter ─ duck gain ─┐
 *   ambience voices ─┼─ bus (dry/reverb/echo) ┤                           ├─ master ─ limiter ─ speakers
 *   sound effects   ─┘                       └───────────────────────────┘
 *
 * Each bus has its own fader driven by the player's volume settings; the music
 * bus can be "ducked" (muffled and lowered) while the player reads an entry.
 */

export type BusId = 'music' | 'ambience' | 'sfx';

/** Where a voice sends its signal: dry, into the hall reverb, into the echo. */
export interface VoiceOut {
  dry: AudioNode;
  rev: AudioNode;
  del: AudioNode;
}

interface Bus extends VoiceOut {
  fader: GainNode;
  delay: DelayNode;
}

/** How loud each bus sits in the mix at 100% volume. */
const BUS_TRIM: Record<BusId, number> = { music: 1.25, ambience: 1.5, sfx: 1.5 };

class AudioCoreSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Partial<Record<BusId, Bus>> = {};
  private duckFilter: BiquadFilterNode | null = null;
  private duckGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private runningListeners: (() => void)[] = [];
  private unlockCleanup: (() => void) | null = null;
  private installed = false;

  /** True when this browser can make sound at all. */
  get supported(): boolean {
    return typeof window !== 'undefined' && !!(window.AudioContext || (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext);
  }

  /** True once the browser lets the context play (after the first click or key). */
  get running(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }

  /**
   * The context, created on demand. Browsers only let it start after a user
   * gesture, so callers outside a gesture should check `running` first.
   */
  context(): AudioContext | null {
    if (!this.ctx && this.supported) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor({ latencyHint: 'playback' });
      this.build(this.ctx);
      this.ctx.addEventListener('statechange', () => {
        if (this.running) this.notifyRunning();
      });
    }
    if (this.ctx && this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /** Runs `fn` every time audio (re)starts, e.g. after the first click. */
  onRunning(fn: () => void): void {
    this.runningListeners.push(fn);
  }

  bus(id: BusId): VoiceOut | null {
    if (!this.ctx) return null;
    return this.buses[id] ?? null;
  }

  /** A 4-second loop of white noise, shared by wind, static, hats and thrusters. */
  noiseBuffer(): AudioBuffer | null {
    return this.noise;
  }

  /** Applies the sound toggle and the three volume sliders. */
  applySettings(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const s = GameState.getState().settings;
    const t = ctx.currentTime;
    this.master.gain.setTargetAtTime(s.audioEnabled ? 1 : 0, t, 0.08);
    const vol: Record<BusId, number> = { music: s.musicVolume, ambience: s.ambienceVolume, sfx: s.sfxVolume };
    (Object.keys(vol) as BusId[]).forEach((id) => {
      // Perceptual curve: sliders feel even from quiet to loud
      const v = Math.max(0, Math.min(1, vol[id]));
      this.buses[id]?.fader.gain.setTargetAtTime(v * v * BUS_TRIM[id], t, 0.08);
    });
  }

  /** Muffles and lowers the music (reading an entry), or restores it. */
  duck(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.duckFilter || !this.duckGain) return;
    const t = ctx.currentTime;
    this.duckFilter.frequency.setTargetAtTime(on ? 1100 : 18000, t, on ? 0.35 : 0.6);
    this.duckGain.gain.setTargetAtTime(on ? 0.55 : 1, t, on ? 0.35 : 0.6);
  }

  /** Sets the echo time of the music and ambience buses (one dotted-eighth of the current tempo). */
  setEchoTime(seconds: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const id of ['music', 'ambience'] as BusId[]) {
      this.buses[id]?.delay.delayTime.setTargetAtTime(Math.min(1.5, seconds), ctx.currentTime, 0.2);
    }
  }

  private notifyRunning(): void {
    this.unlockCleanup?.();
    this.unlockCleanup = null;
    this.runningListeners.forEach((fn) => fn());
  }

  /**
   * Starts audio on the first click, tap or key press (browsers require a gesture),
   * and pauses it while the tab is hidden.
   */
  install(): void {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;
    const events = ['pointerdown', 'keydown', 'touchend'] as const;
    const unlock = () => {
      if (!this.supported) return;
      const wasRunning = this.running;
      this.context();
      // If construction/resume succeeded synchronously (not transitioning later via statechange),
      // stop listening and notify runningListeners once.
      if (!wasRunning && this.running) {
        this.notifyRunning();
      }
    };
    this.unlockCleanup = () => {
      for (const ev of events) window.removeEventListener(ev, unlock, { capture: true });
    };
    for (const ev of events) window.addEventListener(ev, unlock, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend().catch(() => {});
      else this.ctx.resume().catch(() => {});
    });
  }

  // ---------------------------------------------------------------------------

  private build(ctx: AudioContext): void {
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 8;
    limiter.ratio.value = 6;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(limiter);

    this.duckFilter = ctx.createBiquadFilter();
    this.duckFilter.type = 'lowpass';
    this.duckFilter.frequency.value = 18000;
    this.duckFilter.Q.value = 0.5;
    this.duckGain = ctx.createGain();
    this.duckFilter.connect(this.duckGain);
    this.duckGain.connect(this.master);

    this.noise = this.makeNoise(ctx, 4);
    const hall = this.makeImpulse(ctx, 3.6, 2.4);
    const room = this.makeImpulse(ctx, 1.4, 3);

    this.buses.music = this.makeBus(ctx, this.duckFilter, hall, 0.32, true);
    this.buses.ambience = this.makeBus(ctx, this.master, hall, 0.28);
    this.buses.sfx = this.makeBus(ctx, this.master, room, 0.2);
    this.applySettings();
  }

  private makeBus(ctx: AudioContext, dest: AudioNode, impulse: AudioBuffer, feedback: number, tameLows = false): Bus {
    const fader = ctx.createGain();
    fader.gain.value = 0;
    if (tameLows) {
      // Music: clear out sub rumble and shelve the low end down so it never gets boomy
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 70;
      hp.Q.value = 0.6;
      const shelf = ctx.createBiquadFilter();
      shelf.type = 'lowshelf';
      shelf.frequency.value = 240;
      shelf.gain.value = -9;
      const mud = ctx.createBiquadFilter();
      mud.type = 'peaking';
      mud.frequency.value = 320;
      mud.Q.value = 0.9;
      mud.gain.value = -3;
      fader.connect(hp);
      hp.connect(shelf);
      shelf.connect(mud);
      mud.connect(dest);
    } else {
      fader.connect(dest);
    }

    const dry = ctx.createGain();
    dry.connect(fader);

    const rev = ctx.createGain();
    const conv = ctx.createConvolver();
    conv.buffer = impulse;
    // Lows in a long reverb turn into boom: only mids and highs reach the hall
    const revLowCut = ctx.createBiquadFilter();
    revLowCut.type = 'highpass';
    revLowCut.frequency.value = 300;
    revLowCut.Q.value = 0.5;
    rev.connect(revLowCut);
    revLowCut.connect(conv);
    conv.connect(fader);

    // Echo: feedback delay, darkened each repeat, also feeding the reverb
    const del = ctx.createGain();
    const delay = ctx.createDelay(2);
    delay.delayTime.value = 0.42;
    const fb = ctx.createGain();
    fb.gain.value = feedback;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 2600;
    del.connect(delay);
    delay.connect(tone);
    tone.connect(fb);
    fb.connect(delay);
    tone.connect(fader);
    const echoToHall = ctx.createGain();
    echoToHall.gain.value = 0.35;
    tone.connect(echoToHall);
    echoToHall.connect(rev);

    return { dry, rev, del, fader, delay };
  }

  private makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /** A synthetic stereo hall: decaying noise, darker as it fades. */
  private makeImpulse(ctx: AudioContext, seconds: number, curve: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        // One-pole lowpass whose cutoff falls over the tail
        const a = 0.85 - k * 0.6;
        lp = lp * (1 - a) + (Math.random() * 2 - 1) * a;
        d[i] = lp * Math.pow(1 - k, curve) * (i < ctx.sampleRate * 0.01 ? i / (ctx.sampleRate * 0.01) : 1);
      }
    }
    return buf;
  }
}

export const AudioCore = new AudioCoreSystem();
