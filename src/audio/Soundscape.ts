import { AudioCore } from './AudioCore.ts';
import { Music } from './Music.ts';
import { Ambience, AmbienceId } from './Ambience.ts';
import { TRACKS, TrackId } from './MusicTracks.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { GameState } from '../core/GameState.ts';
import { keys, bell } from './Synth.ts';
import { SoundFX } from './SoundEffects.ts';

export type { TrackId } from './MusicTracks.ts';
export type { AmbienceId } from './Ambience.ts';

export interface Mood {
  /** Music to play (null = silence). Omit to keep the current piece. */
  music?: TrackId | null;
  /** World ambience (null = none). Omit to keep the current bed. */
  ambience?: AmbienceId | null;
  /** 0..1 ambience level for this moment (e.g. quieter under landing music). */
  ambienceLevel?: number;
  /** Crossfade time in seconds. */
  fade?: number;
}

/**
 * The game's sound director. Scenes and overlays say what mood they want
 * (`Soundscape.set({ music: 'explore_moon', ambience: 'moon' })`); the director
 * crossfades to it. Browsers keep audio locked until the first click or key,
 * so the wanted mood is remembered and started the moment audio unlocks.
 */
class SoundscapeSystem {
  private wantMusic: TrackId | null = null;
  private wantAmbience: AmbienceId | null = null;
  private wantLevel = 1;
  private ducked = 0;
  private installed = false;

  install(): void {
    if (this.installed) return;
    this.installed = true;
    AudioCore.install();
    AudioCore.onRunning(() => {
      AudioCore.applySettings();
      this.apply(1.8);
    });
    EventBus.on(EVENTS.SETTINGS_CHANGED, () => AudioCore.applySettings());
    // Reading an entry: the music steps back so UNIT-7 and the record come forward
    EventBus.on(EVENTS.OPEN_ENTRY, () => {
      this.duck(true);
      SoundFX.setRover(0);
    });
    EventBus.on(EVENTS.ENTRY_CLOSED, () => this.duck(false));
    EventBus.on(EVENTS.ENTRY_UNLOCKED, () => this.sting('recovered'));
  }

  set(mood: Mood): void {
    if (mood.music !== undefined) this.wantMusic = mood.music;
    if (mood.ambience !== undefined) this.wantAmbience = mood.ambience;
    if (mood.ambienceLevel !== undefined) this.wantLevel = mood.ambienceLevel;
    else if (mood.ambience !== undefined) this.wantLevel = 1;
    if (AudioCore.running) this.apply(mood.fade ?? 2.5);
  }

  /** Muffle the music while a panel is open (nested calls are counted). */
  duck(on: boolean): void {
    this.ducked = Math.max(0, this.ducked + (on ? 1 : -1));
    AudioCore.duck(this.ducked > 0);
  }

  /** Clears any duck left over (e.g. when a scene changes under an open panel). */
  resetDuck(): void {
    this.ducked = 0;
    AudioCore.duck(false);
  }

  /** A short musical cue on top of whatever is playing, in the current key. */
  sting(kind: 'recovered' | 'discovery'): void {
    if (!AudioCore.running || !GameState.getState().settings.audioEnabled) return;
    const ctx = AudioCore.context();
    const out = AudioCore.bus('music');
    if (!ctx || !out) return;
    const def = this.wantMusic ? TRACKS[this.wantMusic] : TRACKS.title;
    const root = def.root + 12;
    const t = ctx.currentTime + 0.05;
    if (kind === 'recovered') {
      // A rising, resolved arpeggio: root, 3rd, 5th, octave, 9th
      const third = def.scale[2];
      [0, third, 7, 12, 14].forEach((n, i) => {
        bell(ctx, out, t + i * 0.11, root + n, 0.06, { rev: 0.7, del: 0.35 }, 2.8);
        if (i === 0) [0, third, 7].forEach((m) => keys(ctx, out, t, root - 12 + m, 2, 0.035));
      });
    } else {
      bell(ctx, out, t, root + 7, 0.04, { rev: 0.8, del: 0.5 }, 2.4);
      bell(ctx, out, t + 0.16, root + 12, 0.035, { rev: 0.8, del: 0.5 }, 2.4);
    }
  }

  private apply(fade: number): void {
    Music.play(this.wantMusic, fade);
    Ambience.play(this.wantAmbience, this.wantLevel, fade);
    AudioCore.duck(this.ducked > 0);
  }
}

export const Soundscape = new SoundscapeSystem();
