import { SoundFX } from '../audio/SoundEffects.ts';

/**
 * Shared pacing for everything UNIT-7 says, so the robot "talks" at one
 * readable speed everywhere (exploration HUD, briefing, cinematics, finale,
 * journal). Characters reveal at a medium rate with short pauses after
 * punctuation, and a voice blip sounds every couple of letters.
 *
 * While a line is still talking, callers must ignore advance input: the
 * player reads along with the robot instead of skipping it.
 */

/** Base reveal rate, in characters per second (medium: easy to read along). */
export const TALK_CPS = 26;

const BLIP_EVERY = 2;

/** Seconds spent on one character before the next one appears. */
export function charDelay(ch: string, next: string | undefined): number {
  const base = 1 / TALK_CPS;
  // Only pause when the punctuation ends a phrase (followed by space or end),
  // so "4.5" or "U.S." do not stutter.
  const ends = next === undefined || next === ' ' || next === '\n';
  if (!ends) return base;
  if (ch === '.' || ch === '!' || ch === '?') return base + 0.34;
  if (ch === ',' || ch === ';' || ch === ':') return base + 0.15;
  if (ch === '—' || ch === '…') return base + 0.2;
  return base;
}

/** Total time a line takes to talk out, in seconds. */
export function talkDuration(text: string): number {
  let t = 0;
  for (let i = 0; i < text.length; i++) t += charDelay(text[i], text[i + 1]);
  return t;
}

/**
 * Frame-driven typewriter. Call `tick(dt)` every frame; it returns how many
 * characters are visible and plays the voice blips itself.
 */
export class TalkClock {
  private text = '';
  private shownCount = 0;
  private wait = 0;
  private sinceBlip = 0;
  private record = false;

  start(text: string, opts: { instant?: boolean; record?: boolean } = {}): void {
    this.text = text;
    this.record = !!opts.record;
    this.shownCount = opts.instant ? text.length : 0;
    this.wait = 0;
    this.sinceBlip = BLIP_EVERY; // blip on the first letter
  }

  get shown(): number {
    return this.shownCount;
  }

  get done(): boolean {
    return this.shownCount >= this.text.length;
  }

  get visible(): string {
    return this.text.slice(0, this.shownCount);
  }

  /** Advance by dt seconds; returns true when the visible text changed. */
  tick(dt: number): boolean {
    if (this.done) return false;
    // Clamp so a background tab returning does not dump the whole line at once.
    this.wait -= Math.min(dt, 0.1);
    let changed = false;
    while (this.wait <= 0 && !this.done) {
      const ch = this.text[this.shownCount];
      this.shownCount++;
      this.wait += charDelay(ch, this.text[this.shownCount]);
      changed = true;
      if (/[A-Za-z0-9]/.test(ch)) {
        this.sinceBlip++;
        if (this.sinceBlip >= BLIP_EVERY) {
          this.sinceBlip = 0;
          SoundFX.playVoiceBlip(ch, this.record);
        }
      } else {
        // A gap between words resets the syllable so each word starts on a blip.
        this.sinceBlip = BLIP_EVERY - 1;
      }
    }
    return changed;
  }
}

/**
 * DOM helper: types `text` into `el` with the shared pacing, using rAF.
 * Returns a cancel function. `onDone` fires once the line is fully shown.
 */
export function typeInto(
  el: HTMLElement,
  text: string,
  opts: { instant?: boolean; record?: boolean; onDone?: () => void } = {},
): () => void {
  const clock = new TalkClock();
  clock.start(text, opts);
  el.textContent = clock.visible;
  if (clock.done) {
    opts.onDone?.();
    return () => {};
  }
  let last = performance.now();
  let raf = 0;
  let cancelled = false;
  const frame = (now: number) => {
    if (cancelled) return;
    const dt = (now - last) / 1000;
    last = now;
    if (clock.tick(dt)) el.textContent = clock.visible;
    if (clock.done) {
      opts.onDone?.();
      return;
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}
