import type { ArtifactEntry, Finale } from './schema.ts';
import { ALL_ENTRIES, MOON_CHRONOLOGY, MARS_CHRONOLOGY, ELSEWHERE_CHRONOLOGY } from './entries.ts';
import { STORY, getTheory } from './story.ts';

export const FINALE: Finale = STORY.finale;

/** One slide of the closing reel: a real machine, in launch order across both worlds. */
export interface ReelSlide {
  entry: ArtifactEntry;
  year: number;
}

const ORDER = [...MOON_CHRONOLOGY, ...MARS_CHRONOLOGY, ...ELSEWHERE_CHRONOLOGY];

/** Every entry sorted by launch date (ties keep the in-game chronology). */
export function getReel(): ReelSlide[] {
  return ORDER
    .map((id) => ALL_ENTRIES[id])
    .filter((e): e is ArtifactEntry => !!e)
    .map((entry) => ({ entry, year: parseInt(entry.launch_date.slice(0, 4), 10) }))
    .sort((a, b) => a.entry.launch_date.localeCompare(b.entry.launch_date) || ORDER.indexOf(a.entry.id) - ORDER.indexOf(b.entry.id));
}

/** Totals for the "how far" beat, all derived from the sourced entries. */
export function getReelStats(): { machines: number; worlds: number; firstYear: number; lastYear: number; span: number } {
  const reel = getReel();
  const years = reel.map((r) => r.year);
  const firstYear = Math.min(...years);
  const lastYear = Math.max(...years);
  return {
    machines: reel.length,
    worlds: new Set(reel.map((r) => r.entry.world)).size,
    firstYear,
    lastYear,
    span: lastYear - firstYear,
  };
}

/** The player's theory from the Journal, or UNIT-7's own fallback. */
export function getFinaleTheory(): { text: string; fromPlayer: boolean } {
  const t = getTheory();
  return t ? { text: t.text, fromPlayer: true } : { text: FINALE.theory_fallback, fromPlayer: false };
}
