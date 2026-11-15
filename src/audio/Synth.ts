import type { VoiceOut } from './AudioCore.ts';

/**
 * Original synthesized instruments for the soundtrack. Each function schedules
 * one note at audio time `t` and cleans its own nodes up when it ends.
 */

export const mtof = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export interface Sends {
  /** 0..1 amount into the hall reverb. */
  rev?: number;
  /** 0..1 amount into the echo. */
  del?: number;
}

/** Routes an envelope gain to the voice outputs with the given send levels. */
function route(ctx: BaseAudioContext, g: AudioNode, out: VoiceOut, sends: Sends, stopAt: number): void {
  g.connect(out.dry);
  const extra: AudioNode[] = [];
  if (sends.rev) {
    const r = ctx.createGain();
    r.gain.value = sends.rev;
    g.connect(r);
    r.connect(out.rev);
    extra.push(r);
  }
  if (sends.del) {
    const d = ctx.createGain();
    d.gain.value = sends.del;
    g.connect(d);
    d.connect(out.del);
    extra.push(d);
  }
  if (extra.length) {
    // Disconnect send gains after the tail so long sessions do not accumulate nodes
    const ms = Math.max(0, (stopAt - ctx.currentTime) * 1000 + 200);
    window.setTimeout(() => extra.forEach((n) => n.disconnect()), ms);
  }
}

function osc(ctx: BaseAudioContext, type: OscillatorType, freq: number, t: number, detune = 0): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (detune) o.detune.setValueAtTime(detune, t);
  return o;
}

/** Warm, slow string-like pad: detuned saws through a soft lowpass. */
export function pad(ctx: BaseAudioContext, out: VoiceOut, t: number, midi: number, dur: number, vel: number, bright = 0.4, sends: Sends = { rev: 0.7 }): void {
  const f = mtof(midi);
  const attack = Math.min(1.6, dur * 0.35);
  const release = 2.2;
  const end = t + dur + release;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + attack);
  g.gain.setValueAtTime(vel, t + dur);
  g.gain.setTargetAtTime(0.0001, t + dur, release / 4);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.5;
  lp.frequency.setValueAtTime(500 + bright * 1500, t);
  lp.frequency.linearRampToValueAtTime(700 + bright * 2200, t + attack + dur * 0.4);
  lp.connect(g);
  const saws = [osc(ctx, 'sawtooth', f, t, -9), osc(ctx, 'sawtooth', f, t, 8)];
  const sub = osc(ctx, 'triangle', f / 2, t);
  const mix = ctx.createGain();
  mix.gain.value = 0.36;
  mix.connect(lp);
  // The octave below only adds warmth; kept low so pads do not get bassy
  const subG = ctx.createGain();
  subG.gain.value = 0.25;
  subG.connect(mix);
  saws.forEach((o) => o.connect(mix));
  sub.connect(subG);
  [...saws, sub].forEach((o) => { o.start(t); o.stop(end); });
  route(ctx, g, out, sends, end);
}

/** Electric piano: a soft FM tine with a bell-like attack. */
export function keys(ctx: BaseAudioContext, out: VoiceOut, t: number, midi: number, dur: number, vel: number, sends: Sends = { rev: 0.35 }): void {
  const f = mtof(midi);
  const decay = Math.max(1.2, dur * 1.2);
  const end = t + decay + 0.6;
  const car = osc(ctx, 'sine', f, t);
  const mod = osc(ctx, 'sine', f, t);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(f * 1.4, t);
  modGain.gain.exponentialRampToValueAtTime(f * 0.08, t + 0.5);
  mod.connect(modGain);
  modGain.connect(car.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.4);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  car.connect(g);
  car.start(t); mod.start(t);
  car.stop(end); mod.stop(end);
  route(ctx, g, out, sends, end);
}

/** Glassy bell: inharmonic FM with a long ring, made for echo and reverb. */
export function bell(ctx: BaseAudioContext, out: VoiceOut, t: number, midi: number, vel: number, sends: Sends = { rev: 0.6, del: 0.45 }, ring = 2.6): void {
  const f = mtof(midi);
  const end = t + ring + 0.2;
  const car = osc(ctx, 'sine', f, t);
  const mod = osc(ctx, 'sine', f * 3.5, t);
  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(f * 1.8, t);
  modGain.gain.exponentialRampToValueAtTime(f * 0.05, t + ring * 0.6);
  mod.connect(modGain);
  modGain.connect(car.frequency);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ring);
  car.connect(g);
  car.start(t); mod.start(t);
  car.stop(end); mod.stop(end);
  route(ctx, g, out, sends, end);
}

/** Dusty pluck: triangle and saw with a closing filter (Mars). */
export function pluck(ctx: BaseAudioContext, out: VoiceOut, t: number, midi: number, vel: number, sends: Sends = { rev: 0.4, del: 0.35 }): void {
  const f = mtof(midi);
  const end = t + 1.1;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2;
  lp.frequency.setValueAtTime(3400, t);
  lp.frequency.exponentialRampToValueAtTime(380, t + 0.3);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
  lp.connect(g);
  const a = osc(ctx, 'triangle', f, t);
  const b = osc(ctx, 'sawtooth', f, t, 6);
  const bg = ctx.createGain();
  bg.gain.value = 0.35;
  a.connect(lp); b.connect(bg); bg.connect(lp);
  a.start(t); b.start(t); a.stop(end); b.stop(end);
  route(ctx, g, out, sends, end);
}

/** Round sub bass. */
export function bass(ctx: BaseAudioContext, out: VoiceOut, t: number, midi: number, dur: number, vel: number): void {
  const f = mtof(midi);
  const end = t + dur + 0.3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  // Kept light: a gentle line under the chords, not a rumble
  const v = vel * 0.4;
  g.gain.linearRampToValueAtTime(v, t + 0.025);
  g.gain.setValueAtTime(v * 0.85, t + dur);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.25);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 700;
  lp.connect(g);
  const a = osc(ctx, 'sine', f, t);
  const b = osc(ctx, 'triangle', f, t);
  const bg = ctx.createGain();
  bg.gain.value = 0.3;
  a.connect(lp); b.connect(bg); bg.connect(lp);
  a.start(t); b.start(t); a.stop(end); b.stop(end);
  route(ctx, g, out, {}, end);
}

/** Short resonant pulse for tense ostinatos (landing). */
export function pulse(ctx: BaseAudioContext, out: VoiceOut, t: number, midi: number, vel: number, open = 0.5): void {
  const f = mtof(midi);
  const end = t + 0.3;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 7;
  lp.frequency.setValueAtTime(300 + open * 1400, t);
  lp.frequency.exponentialRampToValueAtTime(160, t + 0.18);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  lp.connect(g);
  const a = osc(ctx, 'sawtooth', f, t);
  a.connect(lp);
  a.start(t); a.stop(end);
  route(ctx, g, out, { rev: 0.15, del: 0.12 }, end);
}

/** Soft, rounded kick. */
export function kick(ctx: BaseAudioContext, out: VoiceOut, t: number, vel: number): void {
  // A soft lo-fi thump: short, and pitched up so it taps rather than booms
  const end = t + 0.3;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(150, t);
  o.frequency.exponentialRampToValueAtTime(72, t + 0.07);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel * 0.35, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
  o.connect(g);
  o.start(t); o.stop(end);
  route(ctx, g, out, {}, end);
}

function noiseHit(ctx: BaseAudioContext, out: VoiceOut, noise: AudioBuffer, t: number, vel: number, type: BiquadFilterType, freq: number, q: number, decay: number, sends: Sends): void {
  const end = t + decay + 0.05;
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
  src.connect(f); f.connect(g);
  src.start(t, Math.random() * (noise.duration - 0.5));
  src.stop(end);
  route(ctx, g, out, sends, end);
}

/** Closed hi-hat (lo-fi, dark). */
export function hat(ctx: BaseAudioContext, out: VoiceOut, noise: AudioBuffer, t: number, vel: number, open = false): void {
  noiseHit(ctx, out, noise, t, vel, 'highpass', 6500, 0.7, open ? 0.22 : 0.045, {});
}

/** Brushed rim / soft snare. */
export function snare(ctx: BaseAudioContext, out: VoiceOut, noise: AudioBuffer, t: number, vel: number): void {
  noiseHit(ctx, out, noise, t, vel, 'bandpass', 1900, 0.9, 0.16, { rev: 0.25 });
}

/** Shaker grain. */
export function shaker(ctx: BaseAudioContext, out: VoiceOut, noise: AudioBuffer, t: number, vel: number): void {
  noiseHit(ctx, out, noise, t, vel, 'bandpass', 5200, 1.2, 0.07, {});
}
