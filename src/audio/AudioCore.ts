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
  private installed = false;
  /** The player has clicked, tapped or pressed a key at least once. */
  private interacted = false;
  /** Audio has played at least once (so it is the browser, not the player, that stopped it). */
  private everRan = false;

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
        if (this.running) {
          this.everRan = true;
          this.notifyRunning();
        }
      });
    }
    if (this.ctx && this.ctx.state === 'suspended' && !document.hidden) this.ctx.resume().catch(() => {});
    return this.ctx;
  }

  /**
   * True when sound should be playing but the browser is holding it back
   * (it needs one more tap). Used by the "tap for sound" button.
   */
  get blocked(): boolean {
    return this.supported && this.interacted && !document.hidden && !this.running
      && GameState.getState().settings.audioEnabled;
  }

  /** Tries to start or restart audio. Call it from a click or tap whenever possible. */
  kick(): void {
    if (!this.supported || document.hidden) return;
    if (this.ctx?.state === 'closed') return;
    const wasRunning = this.running;
    this.context();
    if (!wasRunning && this.running) {
      this.everRan = true;
      this.notifyRunning();
    }
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
    this.runningListeners.forEach((fn) => fn());
  }

  /**
   * Starts audio as early as the browser allows, and keeps it running:
   * - tries straight away (browsers that allow autoplay start the music at once);
   * - otherwise starts on the first click, tap or key press. Every gesture is
   *   watched, not just the first one, because the context can be suspended again
   *   later (phone locked, call received, iOS "interrupted" state) and a swipe or
   *   a touch on the joystick does not always count as a gesture;
   * - pauses while the tab is hidden and comes back when it is shown.
   */
  install(): void {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;
    // iPhone/iPad: play through the speaker even with the ring/silent switch on silent,
    // like a video would (otherwise Web Audio is silently muted).
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) {
      try { session.type = 'playback'; } catch { /* older Safari */ }
    }

    const events = ['pointerdown', 'pointerup', 'mousedown', 'touchstart', 'touchend', 'click', 'keydown'] as const;
    const unlock = () => {
      this.interacted = true;
      if (!this.running) this.kick();
    };
    for (const ev of events) window.addEventListener(ev, unlock, { capture: true, passive: true });

    // Autoplay: allowed when the browser already trusts this site (returning players,
    // Firefox/desktop settings). If it is not allowed the context just waits, suspended.
    if (this.supported) this.context();

    // Pause while the page is hidden, play again when it is shown. Entering fullscreen
    // or rotating a phone can flip "hidden" off and on very quickly, so the visibility
    // is checked again once a suspend has finished (otherwise audio could stay off).
    const sync = () => {
      const ctx = this.ctx;
      if (!ctx || ctx.state === 'closed') return;
      if (document.hidden) {
        if (ctx.state === 'running') ctx.suspend().then(sync, () => {});
      } else if (ctx.state !== 'running') {
        ctx.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    window.addEventListener('pageshow', sync);
    window.addEventListener('focus', sync);
    window.addEventListener('orientationchange', sync);
    window.addEventListener('resize', sync);
    // Watchdog: phones can stop audio on their own (calls, other apps, audio route
    // changes, iOS "interrupted"). Once it has played, keep asking for it back.
    window.setInterval(() => {
      if (this.everRan && !document.hidden && this.ctx && this.ctx.state !== 'running') sync();
    }, 1000);
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
