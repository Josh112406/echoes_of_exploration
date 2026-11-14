/**
 * The soundtrack, as data. Every piece is original: a key, a tempo, a chord loop,
 * an instrumentation and (for most) a short motif. `Music.ts` plays them
 * generatively, so a piece keeps evolving instead of looping one fixed clip.
 *
 * Offsets are semitones from `root` (a MIDI note). Steps are sixteenth notes,
 * 16 to a 4/4 bar. Motif degrees index into `scale` (7 = an octave up).
 */

export type TrackId =
  | 'title'
  | 'intro'
  | 'explore_moon'
  | 'explore_mars'
  | 'landing'
  | 'transition'
  | 'ending_record'
  | 'ending_far'
  | 'ending_resolve';

export type MelodyVoice = 'bell' | 'keys' | 'pluck';

export interface Chord {
  notes: number[];
  bass: number;
  bars: number;
}

/** [step from phrase start, scale degree, length in steps] */
export type MotifNote = [number, number, number];

export interface TrackDef {
  id: TrackId;
  /** What the piece is for, in a few words. */
  mood: string;
  bpm: number;
  root: number;
  scale: number[];
  /** 0..0.33: delays every off-beat sixteenth for a laid-back feel. */
  swing: number;
  chords: Chord[];
  /** Echo time in beats (0.75 = dotted eighth). */
  echoBeats: number;
  pad?: { vel: number; octave: number; bright: number };
  keys?: { vel: number; steps: number[]; octave: number };
  arp?: { voice: MelodyVoice; vel: number; every: number; octave: number; pattern: 'up' | 'updown' | 'random'; prob: number };
  bass?: { vel: number; steps: number[]; octave: number; len: number };
  pulse?: { vel: number; every: number; octave: number };
  drums?: { kick: number[]; kickVel: number; snare: number[]; snareVel: number; hat: number[]; hatVel: number; shaker?: number[]; shakerVel?: number };
  drone?: { vel: number; octave: number };
  melody?: { voice: MelodyVoice; vel: number; octave: number; motif: MotifNote[]; phraseBars: number; answerDensity: number };
}

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];

/** The main theme ("Still Out There"): heard on the title screen and again at the very end. */
const THEME: MotifNote[] = [
  [0, 4, 6], [6, 2, 2], [8, 1, 4], [12, 2, 4],
  [16, 4, 8], [24, 7, 4], [28, 6, 4],
  [32, 5, 6], [38, 4, 2], [40, 2, 8],
  [48, 1, 8], [56, 0, 8],
];

export const TRACKS: Record<TrackId, TrackDef> = {
  // Title: wistful and warm. Slow pad, soft electric piano, the main theme on bells.
  title: {
    id: 'title', mood: 'wistful main theme', bpm: 72, root: 50, scale: MAJOR, swing: 0, echoBeats: 0.75,
    chords: [
      { notes: [0, 4, 7, 11, 14], bass: 0, bars: 2 },
      { notes: [-3, 0, 4, 7, 14], bass: -3, bars: 2 },
      { notes: [-7, -3, 0, 4, 7], bass: -7, bars: 2 },
      { notes: [-5, 0, 2, 4, 7], bass: -5, bars: 2 },
    ],
    pad: { vel: 0.04, octave: 1, bright: 0.3 },
    keys: { vel: 0.035, steps: [0, 10], octave: 0 },
    bass: { vel: 0.08, steps: [0], octave: -1, len: 14 },
    arp: { voice: 'bell', vel: 0.018, every: 4, octave: 2, pattern: 'random', prob: 0.3 },
    melody: { voice: 'bell', vel: 0.05, octave: 1, motif: THEME, phraseBars: 4, answerDensity: 0.2 },
  },

  // Prologue: alone on the Moon as the crew leaves. Sparse, minor, a low drone.
  intro: {
    id: 'intro', mood: 'lonely prologue', bpm: 60, root: 54, scale: MINOR, swing: 0, echoBeats: 1,
    chords: [
      { notes: [0, 3, 7, 14], bass: 0, bars: 2 },
      { notes: [-4, 0, 3, 7], bass: -4, bars: 2 },
      { notes: [3, 7, 10, 14], bass: 3, bars: 2 },
      { notes: [-2, 3, 5, 10], bass: -2, bars: 2 },
    ],
    pad: { vel: 0.045, octave: 0, bright: 0.2 },
    keys: { vel: 0.03, steps: [0], octave: 0 },
    drone: { vel: 0.035, octave: -1 },
    melody: {
      voice: 'keys', vel: 0.045, octave: 1, phraseBars: 4, answerDensity: 0.12,
      motif: [[0, 4, 8], [8, 3, 4], [12, 2, 4], [16, 1, 12], [32, 2, 6], [38, 4, 2], [40, 3, 8], [48, 1, 8], [56, 0, 8]],
    },
  },

  // Exploring the Moon: cool, unhurried lo-fi. Electric piano, brushed beat, glassy bells.
  explore_moon: {
    id: 'explore_moon', mood: 'cool lunar lo-fi', bpm: 78, root: 52, scale: DORIAN, swing: 0.18, echoBeats: 0.75,
    chords: [
      { notes: [0, 3, 7, 10, 14], bass: 0, bars: 2 },
      { notes: [5, 9, 14, 15], bass: 5, bars: 2 },
      { notes: [-4, 0, 3, 7, 10], bass: -4, bars: 2 },
      { notes: [-5, -2, 2, 5], bass: 7, bars: 2 },
    ],
    pad: { vel: 0.022, octave: 1, bright: 0.2 },
    keys: { vel: 0.045, steps: [0, 7, 10], octave: 0 },
    bass: { vel: 0.1, steps: [0, 10], octave: -1, len: 6 },
    drums: { kick: [0, 10], kickVel: 0.3, snare: [4, 12], snareVel: 0.05, hat: [2, 6, 10, 14], hatVel: 0.018 },
    melody: {
      voice: 'bell', vel: 0.04, octave: 1, phraseBars: 4, answerDensity: 0.22,
      motif: [[2, 4, 2], [4, 6, 4], [10, 4, 4], [20, 3, 4], [24, 2, 8], [34, 1, 2], [36, 2, 4], [42, 4, 6], [52, 3, 4], [56, 1, 8]],
    },
  },

  // Exploring Mars: warmer and more mysterious. Dusty plucked arpeggios, a half-time pulse.
  explore_mars: {
    id: 'explore_mars', mood: 'dusty martian drift', bpm: 74, root: 50, scale: MINOR, swing: 0.12, echoBeats: 0.75,
    chords: [
      { notes: [0, 3, 7, 10, 14], bass: 0, bars: 2 },
      { notes: [-4, 0, 3, 7, 14], bass: -4, bars: 2 },
      { notes: [3, 7, 10, 14], bass: 3, bars: 2 },
      { notes: [-2, 0, 5, 7], bass: -2, bars: 2 },
    ],
    pad: { vel: 0.03, octave: 1, bright: 0.35 },
    arp: { voice: 'pluck', vel: 0.04, every: 2, octave: 1, pattern: 'updown', prob: 0.75 },
    bass: { vel: 0.065, steps: [0, 11], octave: -1, len: 5 },
    drums: { kick: [0, 11], kickVel: 0.2, snare: [8], snareVel: 0.055, hat: [], hatVel: 0, shaker: [2, 6, 10, 14], shakerVel: 0.028 },
    melody: {
      voice: 'keys', vel: 0.04, octave: 1, phraseBars: 4, answerDensity: 0.18,
      motif: [[4, 4, 4], [8, 5, 2], [10, 4, 6], [20, 2, 4], [24, 3, 8], [36, 6, 4], [40, 5, 2], [42, 4, 6], [52, 1, 4], [56, 0, 8]],
    },
  },

  // Landing: focused tension. A resonant eighth-note pulse, ticking hats, sonar glints.
  landing: {
    id: 'landing', mood: 'tense descent', bpm: 96, root: 48, scale: MINOR, swing: 0, echoBeats: 0.75,
    chords: [
      { notes: [0, 3, 7, 14], bass: 0, bars: 2 },
      { notes: [-4, 0, 3, 7], bass: -4, bars: 2 },
      { notes: [-7, -4, 0, 3, 7], bass: 5, bars: 2 },
      { notes: [-5, 0, 2, 5], bass: 7, bars: 2 },
    ],
    pad: { vel: 0.035, octave: 1, bright: 0.2 },
    pulse: { vel: 0.11, every: 2, octave: -1 },
    drums: { kick: [0, 8], kickVel: 0.22, snare: [], snareVel: 0, hat: [0, 2, 4, 6, 8, 10, 12, 14, 3, 11], hatVel: 0.012 },
    arp: { voice: 'bell', vel: 0.022, every: 8, octave: 2, pattern: 'random', prob: 0.35 },
  },

  // Moon to Mars: the journey. Rising bell arpeggios, a steady heartbeat, hopeful melody.
  transition: {
    id: 'transition', mood: 'hopeful journey', bpm: 84, root: 55, scale: MAJOR, swing: 0, echoBeats: 0.75,
    chords: [
      { notes: [0, 4, 7, 14], bass: 0, bars: 2 },
      { notes: [-3, 0, 4, 7], bass: -3, bars: 2 },
      { notes: [-7, -3, 0, 4, 7], bass: 5, bars: 2 },
      { notes: [-5, 0, 2, 4], bass: 7, bars: 2 },
    ],
    pad: { vel: 0.04, octave: 1, bright: 0.5 },
    arp: { voice: 'bell', vel: 0.03, every: 2, octave: 1, pattern: 'up', prob: 0.9 },
    bass: { vel: 0.1, steps: [0, 8], octave: -1, len: 6 },
    drums: { kick: [0, 10], kickVel: 0.26, snare: [4, 12], snareVel: 0.045, hat: [2, 6, 10, 14], hatVel: 0.018 },
    melody: {
      voice: 'keys', vel: 0.045, octave: 1, phraseBars: 4, answerDensity: 0.25,
      motif: [[0, 4, 4], [4, 5, 4], [8, 4, 4], [12, 2, 4], [16, 1, 8], [24, 2, 8], [32, 4, 4], [36, 6, 4], [40, 7, 8], [48, 5, 8], [56, 4, 8]],
    },
  },

  // Finale, Part I: the record of every machine. Nostalgic piano arpeggios.
  ending_record: {
    id: 'ending_record', mood: 'nostalgic remembrance', bpm: 66, root: 53, scale: MAJOR, swing: 0, echoBeats: 0.75,
    chords: [
      { notes: [0, 4, 7, 11, 14], bass: 0, bars: 2 },
      { notes: [4, 7, 11, 14], bass: 4, bars: 2 },
      { notes: [-3, 0, 4, 7, 11], bass: -3, bars: 2 },
      { notes: [-7, -3, 0, 4], bass: 5, bars: 2 },
    ],
    pad: { vel: 0.035, octave: 1, bright: 0.3 },
    arp: { voice: 'keys', vel: 0.035, every: 2, octave: 0, pattern: 'updown', prob: 0.85 },
    bass: { vel: 0.08, steps: [0], octave: -1, len: 16 },
    melody: {
      voice: 'bell', vel: 0.04, octave: 1, phraseBars: 4, answerDensity: 0.15,
      motif: [[8, 4, 4], [12, 2, 4], [16, 1, 8], [24, 2, 8], [40, 0, 4], [44, 1, 4], [48, 2, 12]],
    },
  },

  // Finale, Parts II and III: how far, and farther. Vast, lydian, slow.
  ending_far: {
    id: 'ending_far', mood: 'vast and awed', bpm: 64, root: 46, scale: LYDIAN, swing: 0, echoBeats: 1.5,
    chords: [
      { notes: [0, 4, 7, 14], bass: 0, bars: 4 },
      { notes: [2, 6, 9, 14], bass: 0, bars: 4 },
      { notes: [-3, 0, 4, 7, 11], bass: -3, bars: 4 },
      { notes: [-7, -3, 0, 4, 11], bass: 5, bars: 4 },
    ],
    pad: { vel: 0.045, octave: 1, bright: 0.45 },
    drone: { vel: 0.03, octave: -1 },
    arp: { voice: 'bell', vel: 0.028, every: 4, octave: 2, pattern: 'random', prob: 0.5 },
    bass: { vel: 0.07, steps: [0], octave: -1, len: 16 },
  },

  // Finale, Part IV and the end card: the main theme returns, resolved.
  ending_resolve: {
    id: 'ending_resolve', mood: 'hopeful resolution', bpm: 70, root: 50, scale: MAJOR, swing: 0, echoBeats: 0.75,
    chords: [
      { notes: [0, 4, 7, 14], bass: 0, bars: 2 },
      { notes: [-1, 2, 7, 14], bass: -1, bars: 2 },
      { notes: [-3, 0, 4, 7], bass: -3, bars: 2 },
      { notes: [-7, -3, 0, 4, 9], bass: -7, bars: 2 },
    ],
    pad: { vel: 0.04, octave: 1, bright: 0.4 },
    keys: { vel: 0.035, steps: [0, 8], octave: 0 },
    bass: { vel: 0.08, steps: [0], octave: -1, len: 14 },
    drums: { kick: [0], kickVel: 0.16, snare: [], snareVel: 0, hat: [], hatVel: 0, shaker: [4, 12], shakerVel: 0.02 },
    melody: { voice: 'bell', vel: 0.05, octave: 1, motif: THEME, phraseBars: 4, answerDensity: 0.2 },
  },
};

/** Total bars in one pass of a track's chord loop. */
export function loopBars(def: TrackDef): number {
  return def.chords.reduce((n, c) => n + c.bars, 0);
}

/** The chord sounding at a given bar (wraps around the loop). */
export function chordAtBar(def: TrackDef, bar: number): Chord {
  let b = ((bar % loopBars(def)) + loopBars(def)) % loopBars(def);
  for (const c of def.chords) {
    if (b < c.bars) return c;
    b -= c.bars;
  }
  return def.chords[0];
}

/** Scale degree to semitones above the root (degrees beyond the scale wrap into octaves). */
export function degreeToSemis(scale: number[], deg: number): number {
  const n = scale.length;
  const oct = Math.floor(deg / n);
  return scale[((deg % n) + n) % n] + 12 * oct;
}
