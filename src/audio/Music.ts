import { AudioCore, VoiceOut } from './AudioCore.ts';
import { TRACKS, TrackDef, TrackId, MelodyVoice, chordAtBar, degreeToSemis, loopBars } from './MusicTracks.ts';
import * as S from './Synth.ts';

/** Seconds of audio scheduled ahead of the clock (smooth even if the main thread stutters). */
const LOOKAHEAD = 0.3;

/**
 * Register floors that keep the mix light: bass lines never drop below E2
 * (82 Hz), and chord or melody notes never below D3 (147 Hz). Anything lower
 * is lifted by octaves.
 */
const BASS_FLOOR = 40;
const CHORD_FLOOR = 50;
const lift = (midi: number, floor: number): number => {
  let m = midi;
  while (m < floor) m += 12;
  return m;
};
const TICK_MS = 60;

/** Small seeded PRNG so a piece varies, but the same session sounds coherent. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Plays one track generatively: chords, bass and drums follow the written loop;
 * the motif alternates with improvised answers and rests so it never repeats
 * exactly. Each player owns its own fader so two can crossfade.
 */
class TrackPlayer {
  readonly id: TrackId;
  private def: TrackDef;
  private ctx: AudioContext;
  private out: VoiceOut;
  private faders: GainNode[] = [];
  private step = 0;
  private nextTime = 0;
  private timer = 0;
  private rand: () => number;
  private melodyDeg = 4;
  private melodyBusyUntil = 0;
  private arpIdx = 0;
  private stopped = false;

  constructor(ctx: AudioContext, bus: VoiceOut, id: TrackId) {
    this.id = id;
    this.def = TRACKS[id];
    this.ctx = ctx;
    this.rand = rng(Math.floor(Math.random() * 1e9));
    // One fader per send, automated together, so the whole track fades as one
    const mk = (dest: AudioNode) => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(dest);
      this.faders.push(g);
      return g;
    };
    this.out = { dry: mk(bus.dry), rev: mk(bus.rev), del: mk(bus.del) };
  }

  private get stepDur(): number {
    return 60 / this.def.bpm / 4;
  }

  start(fadeIn: number): void {
    const t = this.ctx.currentTime;
    this.faders.forEach((g) => {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(1, t + Math.max(0.05, fadeIn));
    });
    this.nextTime = t + 0.08;
    AudioCore.setEchoTime((60 / this.def.bpm) * this.def.echoBeats);
    this.timer = window.setInterval(() => this.schedule(), TICK_MS);
    this.schedule();
  }

  stop(fadeOut: number): void {
    if (this.stopped) return;
    this.stopped = true;
    const t = this.ctx.currentTime;
    this.faders.forEach((g) => {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0, t + Math.max(0.05, fadeOut));
    });
    // Keep scheduling through the fade so the music does not cut mid-phrase
    window.setTimeout(() => {
      window.clearInterval(this.timer);
      window.setTimeout(() => this.faders.forEach((g) => g.disconnect()), 4000);
    }, fadeOut * 1000 + 100);
  }

  private schedule(): void {
    const ctx = this.ctx;
    // After a long pause (hidden tab), jump forward instead of bursting notes
    if (this.nextTime < ctx.currentTime - 0.5) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + LOOKAHEAD) {
      const swing = this.step % 2 === 1 ? this.def.swing * this.stepDur : 0;
      this.playStep(this.step, this.nextTime + swing);
      this.nextTime += this.stepDur;
      this.step++;
    }
  }

  private playStep(step: number, t: number): void {
    const d = this.def;
    const ctx = this.ctx;
    const out = this.out;
    const noise = AudioCore.noiseBuffer();
    const inBar = step % 16;
    const bar = Math.floor(step / 16);
    const chord = chordAtBar(d, bar);
    const chordStart = this.isChordStart(bar) && inBar === 0;
    const human = () => (this.rand() - 0.5) * 0.012;
    const vary = (v: number) => v * (0.85 + this.rand() * 0.3);

    // Pad and drone: held for the whole chord
    if (chordStart) {
      const dur = chord.bars * 16 * this.stepDur;
      if (d.pad) chord.notes.forEach((n) => S.pad(ctx, out, t, lift(d.root + n + 12 * d.pad!.octave, CHORD_FLOOR), dur, d.pad!.vel / Math.sqrt(chord.notes.length) * 1.6, d.pad!.bright));
      if (d.drone) S.pad(ctx, out, t, lift(d.root + chord.bass + 12 * d.drone.octave, BASS_FLOOR), dur, d.drone.vel, 0.05, { rev: 0.4 });
    }

    if (d.keys && d.keys.steps.includes(inBar)) {
      const len = inBar === 0 ? 6 : 4;
      chord.notes.forEach((n, i) => S.keys(ctx, out, t + human() + i * 0.012, lift(d.root + n + 12 * d.keys!.octave, CHORD_FLOOR), len * this.stepDur, vary(d.keys!.vel) / Math.sqrt(chord.notes.length) * 1.5));
    }

    if (d.bass && d.bass.steps.includes(inBar)) {
      S.bass(ctx, out, t, lift(d.root + chord.bass + 12 * d.bass.octave, BASS_FLOOR), d.bass.len * this.stepDur, vary(d.bass.vel));
    }

    if (d.pulse && inBar % d.pulse.every === 0) {
      const accent = inBar % 8 === 0 ? 1 : inBar % 4 === 0 ? 0.8 : 0.6;
      const octaveUp = inBar === 6 || inBar === 14 ? 12 : 0;
      S.pulse(ctx, out, t, lift(d.root + chord.bass + 12 * d.pulse.octave, BASS_FLOOR) + octaveUp, d.pulse.vel * accent, 0.3 + 0.4 * ((bar % 4) / 3));
    }

    if (d.drums && noise) {
      const dr = d.drums;
      if (dr.kick.includes(inBar)) S.kick(ctx, out, t, vary(dr.kickVel));
      if (dr.snare.includes(inBar)) S.snare(ctx, out, noise, t + human(), vary(dr.snareVel));
      if (dr.hat.includes(inBar)) S.hat(ctx, out, noise, t + human(), vary(dr.hatVel) * (inBar % 4 === 2 ? 1 : 0.6));
      if (dr.shaker?.includes(inBar)) S.shaker(ctx, out, noise, t + human(), vary(dr.shakerVel ?? 0.02));
      // A ghost note now and then keeps the groove alive
      if (dr.hatVel > 0 && inBar % 2 === 1 && this.rand() < 0.12) S.hat(ctx, out, noise, t, dr.hatVel * 0.4);
    }

    if (d.arp && inBar % d.arp.every === 0 && this.rand() < d.arp.prob) {
      const notes = [...chord.notes].sort((a, b) => a - b);
      let n: number;
      if (d.arp.pattern === 'random') n = notes[Math.floor(this.rand() * notes.length)];
      else if (d.arp.pattern === 'up') n = notes[this.arpIdx % notes.length];
      else {
        const cycle = notes.length * 2 - 2 || 1;
        const k = this.arpIdx % cycle;
        n = notes[k < notes.length ? k : cycle - k];
      }
      this.arpIdx++;
      this.voice(d.arp.voice, t + human(), lift(d.root + n + 12 * d.arp.octave, CHORD_FLOOR), d.arp.every * this.stepDur, vary(d.arp.vel));
    }

    if (d.melody) this.melodyStep(step, t, chord.notes);
  }

  private isChordStart(bar: number): boolean {
    const total = loopBars(this.def);
    let b = bar % total;
    for (const c of this.def.chords) {
      if (b === 0) return true;
      if (b < c.bars) return false;
      b -= c.bars;
    }
    return false;
  }

  /**
   * Phrase plan, repeating every four phrases: theme, improvised answer,
   * theme with a few notes bent to neighbours, then a breath (or another answer).
   */
  private melodyStep(step: number, t: number, chordNotes: number[]): void {
    const m = this.def.melody!;
    const phraseSteps = m.phraseBars * 16;
    const phrase = Math.floor(step / phraseSteps);
    const inPhrase = step % phraseSteps;
    const plan = phrase % 4;
    const base = this.def.root + 12 * m.octave;

    if (plan === 0 || plan === 2) {
      for (const [s, deg, len] of m.motif) {
        if (s !== inPhrase) continue;
        let dg = deg;
        if (plan === 2 && this.rand() < 0.25) dg += this.rand() < 0.5 ? -1 : 1;
        this.melodyDeg = dg;
        this.voice(m.voice, t, base + degreeToSemis(this.def.scale, dg), len * this.stepDur, m.vel * (0.9 + this.rand() * 0.2));
      }
      return;
    }
    if (plan === 3 && m.answerDensity < 0.3) return;

    // Improvised answer: a gentle random walk, landing on chord tones on the beat
    if (inPhrase % 2 !== 0 || step < this.melodyBusyUntil) return;
    if (inPhrase >= phraseSteps - 4) return; // leave room before the next phrase
    if (this.rand() > m.answerDensity * (inPhrase % 4 === 0 ? 1.4 : 0.8)) return;
    const moves = [-2, -1, -1, 1, 1, 2, 0];
    let dg = this.melodyDeg + moves[Math.floor(this.rand() * moves.length)];
    dg = Math.max(-1, Math.min(9, dg));
    if (inPhrase % 4 === 0) dg = this.nearestChordTone(dg, chordNotes);
    const len = [2, 4, 4, 6, 8][Math.floor(this.rand() * 5)];
    this.melodyDeg = dg;
    this.melodyBusyUntil = step + len;
    this.voice(m.voice, t, base + degreeToSemis(this.def.scale, dg), len * this.stepDur, m.vel * 0.85);
  }

  private nearestChordTone(deg: number, chordNotes: number[]): number {
    const pcs = new Set(chordNotes.map((n) => ((n % 12) + 12) % 12));
    for (const off of [0, 1, -1, 2, -2]) {
      const semis = degreeToSemis(this.def.scale, deg + off);
      if (pcs.has(((semis % 12) + 12) % 12)) return deg + off;
    }
    return deg;
  }

  private voice(v: MelodyVoice, t: number, midi: number, dur: number, vel: number): void {
    if (v === 'bell') S.bell(this.ctx, this.out, t, midi, vel, { rev: 0.6, del: 0.4 }, Math.max(1.6, dur * 1.6));
    else if (v === 'pluck') S.pluck(this.ctx, this.out, t, midi, vel);
    else S.keys(this.ctx, this.out, t, midi, dur, vel, { rev: 0.4, del: 0.2 });
  }
}

/** One piece at a time, crossfading when the scene asks for another. */
class MusicDirector {
  private current: TrackPlayer | null = null;

  get playing(): TrackId | null {
    return this.current?.id ?? null;
  }

  play(id: TrackId | null, fade = 2.5): void {
    if (this.current?.id === id) return;
    const ctx = AudioCore.context();
    const bus = AudioCore.bus('music');
    this.current?.stop(fade);
    this.current = null;
    if (!id || !ctx || !bus || !AudioCore.running) return;
    const p = new TrackPlayer(ctx, bus, id);
    p.start(fade);
    this.current = p;
  }

  stopAll(fade = 1.5): void {
    this.current?.stop(fade);
    this.current = null;
  }
}

export const Music = new MusicDirector();
