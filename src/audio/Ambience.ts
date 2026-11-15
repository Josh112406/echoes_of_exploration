import { AudioCore, VoiceOut } from './AudioCore.ts';
import { bell } from './Synth.ts';

export type AmbienceId = 'moon' | 'mars' | 'space';

/**
 * Environmental beds, all synthesized:
 *  - moon : no air, so no wind. What UNIT-7 hears is itself: a low systems hum,
 *           a faint electrical whine, and now and then radio static, telemetry
 *           chirps, a servo, or a thermal tick as metal cools.
 *  - mars : thin, restless wind with slow gusts that carry dust hiss.
 *  - space: a deep, slowly breathing drone with distant shimmer.
 */
class Bed {
  readonly id: AmbienceId;
  private ctx: AudioContext;
  private fader: GainNode;
  private out: VoiceOut;
  private stops: (() => void)[] = [];
  private timers: number[] = [];
  private alive = true;
  private sendFaders: GainNode[];

  constructor(ctx: AudioContext, bus: VoiceOut, id: AmbienceId) {
    this.id = id;
    this.ctx = ctx;
    this.fader = ctx.createGain();
    this.fader.gain.value = 0;
    this.fader.connect(bus.dry);
    const rev = ctx.createGain();
    rev.gain.value = 0;
    rev.connect(bus.rev);
    const del = ctx.createGain();
    del.gain.value = 0;
    del.connect(bus.del);
    this.sendFaders = [rev, del];
    this.out = { dry: this.fader, rev, del };
    if (id === 'moon') this.buildMoon();
    else if (id === 'mars') this.buildMars();
    else this.buildSpace();
  }

  level(v: number, fade: number): void {
    const t = this.ctx.currentTime;
    for (const g of [this.fader, ...this.sendFaders]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(v, t + Math.max(0.05, fade));
    }
  }

  stop(fade: number): void {
    if (!this.alive) return;
    this.alive = false;
    this.level(0, fade);
    this.timers.forEach((id) => window.clearTimeout(id));
    window.setTimeout(() => {
      this.stops.forEach((fn) => fn());
      this.fader.disconnect();
      this.sendFaders.forEach((g) => g.disconnect());
    }, fade * 1000 + 200);
  }

  // ---------------------------------------------------------------------------
  // Building blocks

  private loopNoise(type: BiquadFilterType, freq: number, q: number, gain: number): { filter: BiquadFilterNode; gain: GainNode } {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = AudioCore.noiseBuffer();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.out.dry);
    src.start(ctx.currentTime, Math.random() * 3);
    this.stops.push(() => { try { src.stop(); } catch { /* already stopped */ } });
    return { filter: f, gain: g };
  }

  private tone(type: OscillatorType, freq: number, gain: number, dest: AudioNode = this.out.dry): { osc: OscillatorNode; gain: GainNode } {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    o.connect(g); g.connect(dest);
    o.start();
    this.stops.push(() => { try { o.stop(); } catch { /* already stopped */ } });
    return { osc: o, gain: g };
  }

  /** Slow sine LFO on a parameter. */
  private lfo(param: AudioParam, rate: number, depth: number): void {
    const { osc, gain } = this.tone('sine', rate, depth, this.ctx.createGain());
    gain.disconnect();
    gain.connect(param);
    void osc;
  }

  /** Calls `fn` at random intervals between min and max seconds. */
  private every(min: number, max: number, fn: () => void): void {
    const loop = () => {
      if (!this.alive) return;
      const id = window.setTimeout(() => {
        if (!this.alive) return;
        if (AudioCore.running) fn();
        loop();
      }, (min + Math.random() * (max - min)) * 1000);
      this.timers.push(id);
    };
    loop();
  }

  private envGain(t: number, peak: number, attack: number, hold: number, release: number, dest: AudioNode = this.out.dry): GainNode {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setValueAtTime(peak, t + attack + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + hold + release);
    g.connect(dest);
    window.setTimeout(() => g.disconnect(), (attack + hold + release + 0.5) * 1000);
    return g;
  }

  private noiseBurst(t: number, dur: number, type: BiquadFilterType, freq: number, q: number, dest: AudioNode): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = AudioCore.noiseBuffer();
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f); f.connect(dest);
    src.start(t, Math.random() * 3);
    src.stop(t + dur + 0.05);
  }

  // ---------------------------------------------------------------------------
  // The Moon: the robot's own systems in the silence

  private buildMoon(): void {
    const hum = this.tone('sine', 52, 0.03);
    const hum2 = this.tone('sine', 104, 0.028);
    this.lfo(hum2.gain.gain, 0.09, 0.01);
    const buzz = this.tone('sawtooth', 156, 0.016);
    const buzzLp = this.ctx.createBiquadFilter();
    buzzLp.type = 'lowpass';
    buzzLp.frequency.value = 420;
    buzz.gain.disconnect();
    buzz.gain.connect(buzzLp);
    buzzLp.connect(this.out.dry);
    this.lfo(hum.gain.gain, 0.07, 0.015);
    const whine = this.tone('sine', 3150, 0.0025);
    this.lfo(whine.osc.frequency, 0.11, 18);
    // Faint radio floor
    const floor = this.loopNoise('bandpass', 2400, 1.4, 0.006);
    this.lfo(floor.gain.gain, 0.05, 0.002);

    this.every(5, 13, () => {
      const t = this.ctx.currentTime + 0.05;
      const r = Math.random();
      if (r < 0.34) this.radioStatic(t);
      else if (r < 0.62) this.telemetry(t);
      else if (r < 0.82) this.servo(t);
      else this.thermalTick(t);
    });
  }

  private radioStatic(t: number): void {
    const dur = 0.5 + Math.random() * 1.1;
    const g = this.envGain(t, 0.035, 0.04, dur, 0.25);
    // Crackle: chop the gain in random steps
    for (let k = 0.05; k < dur; k += 0.03 + Math.random() * 0.06) g.gain.setValueAtTime(0.008 + Math.random() * 0.04, t + k);
    this.noiseBurst(t, dur + 0.4, 'bandpass', 1500 + Math.random() * 1500, 2.5, g);
    const s = this.ctx.createGain();
    s.gain.value = 0.4;
    g.connect(s); s.connect(this.out.rev);
  }

  private telemetry(t: number): void {
    const n = 2 + Math.floor(Math.random() * 3);
    const base = [1318, 1568, 1760, 2093][Math.floor(Math.random() * 4)];
    for (let i = 0; i < n; i++) {
      const tt = t + i * 0.13;
      const g = this.envGain(tt, 0.012, 0.004, 0.05, 0.05);
      const s = this.ctx.createGain();
      s.gain.value = 0.6;
      g.connect(s); s.connect(this.out.del);
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = base * (i % 2 ? 1.25 : 1);
      o.connect(g);
      o.start(tt); o.stop(tt + 0.15);
    }
  }

  private servo(t: number): void {
    const dur = 0.35 + Math.random() * 0.4;
    const g = this.envGain(t, 0.012, 0.05, dur, 0.12);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'bandpass';
    lp.frequency.value = 700;
    lp.Q.value = 1.5;
    lp.connect(g);
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    const up = Math.random() < 0.5;
    o.frequency.setValueAtTime(up ? 150 : 260, t);
    o.frequency.linearRampToValueAtTime(up ? 260 : 150, t + dur);
    o.connect(lp);
    o.start(t); o.stop(t + dur + 0.2);
  }

  private thermalTick(t: number): void {
    const g = this.envGain(t, 0.016, 0.002, 0.01, 0.3);
    const s = this.ctx.createGain();
    s.gain.value = 0.8;
    g.connect(s); s.connect(this.out.rev);
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900 + Math.random() * 500, t);
    o.frequency.exponentialRampToValueAtTime(500, t + 0.25);
    o.connect(g);
    o.start(t); o.stop(t + 0.4);
  }

  // ---------------------------------------------------------------------------
  // Mars: thin wind and dust. The Martian air is very thin, so this is a soft,
  // high breeze with slow swells, not a storm.

  private buildMars(): void {
    const ctx = this.ctx;
    const wind = this.loopNoise('bandpass', 480, 1.1, 0.06);
    const whistle = this.loopNoise('bandpass', 1000, 8, 0.006);
    const rumble = this.loopNoise('bandpass', 220, 0.8, 0.012);
    const dust = this.loopNoise('highpass', 5200, 0.6, 0.0025);

    // Wind wanders: a new target for pitch and strength every couple of seconds
    this.every(1.6, 3.2, () => {
      const t = ctx.currentTime;
      wind.filter.frequency.setTargetAtTime(340 + Math.random() * 300, t, 1.6);
      wind.gain.gain.setTargetAtTime(0.04 + Math.random() * 0.035, t, 1.8);
      whistle.filter.frequency.setTargetAtTime(850 + Math.random() * 500, t, 2);
      rumble.gain.gain.setTargetAtTime(0.008 + Math.random() * 0.008, t, 2.4);
    });
    // Gusts: everything swells, then settles; dust hiss rides on top
    this.every(7, 16, () => {
      const t = ctx.currentTime;
      // A gentle swell to about twice the resting level, rising and falling slowly
      const peak = 0.1 + Math.random() * 0.04;
      wind.gain.gain.cancelScheduledValues(t);
      wind.gain.gain.setTargetAtTime(peak, t, 1.6);
      wind.gain.gain.setTargetAtTime(0.055, t + 3.5, 2.4);
      wind.filter.frequency.setTargetAtTime(620 + Math.random() * 160, t, 1.6);
      wind.filter.frequency.setTargetAtTime(480, t + 3.5, 2.4);
      whistle.gain.gain.setTargetAtTime(0.012, t, 1.6);
      whistle.gain.gain.setTargetAtTime(0.006, t + 3.5, 2.4);
      dust.gain.gain.setTargetAtTime(0.008, t + 0.8, 1.4);
      dust.gain.gain.setTargetAtTime(0.0025, t + 3.8, 2);
    });
  }

  // ---------------------------------------------------------------------------
  // Deep space: a breathing drone

  private buildSpace(): void {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    lp.Q.value = 0.8;
    lp.connect(this.out.dry);
    const toRev = this.ctx.createGain();
    toRev.gain.value = 0.5;
    lp.connect(toRev); toRev.connect(this.out.rev);
    [55, 55.35, 82.4, 110.2, 164.8].forEach((f, i) => this.tone(i < 2 ? 'sine' : 'triangle', f, i < 2 ? 0.035 : 0.012, lp));
    this.lfo(lp.frequency, 0.04, 260);
    const air = this.loopNoise('lowpass', 380, 0.5, 0.01);
    this.lfo(air.gain.gain, 0.06, 0.006);

    this.every(6, 14, () => {
      const t = this.ctx.currentTime + 0.05;
      const notes = [86, 88, 90, 93, 95, 98];
      bell(this.ctx, this.out, t, notes[Math.floor(Math.random() * notes.length)], 0.01, { rev: 1, del: 0.6 }, 4);
    });
  }
}

/** One bed at a time, crossfading between worlds. */
class AmbienceDirector {
  private current: Bed | null = null;
  private levelValue = 1;

  get playing(): AmbienceId | null {
    return this.current?.id ?? null;
  }

  play(id: AmbienceId | null, level = 1, fade = 2): void {
    this.levelValue = level;
    if (this.current?.id === id) {
      this.current.level(level, fade);
      return;
    }
    const ctx = AudioCore.context();
    const bus = AudioCore.bus('ambience');
    this.current?.stop(fade);
    this.current = null;
    if (!id || !ctx || !bus || !AudioCore.running || !AudioCore.noiseBuffer()) return;
    const bed = new Bed(ctx, bus, id);
    bed.level(level, fade);
    this.current = bed;
  }

  get level(): number {
    return this.levelValue;
  }

  stopAll(fade = 1.5): void {
    this.current?.stop(fade);
    this.current = null;
  }
}

export const Ambience = new AmbienceDirector();
