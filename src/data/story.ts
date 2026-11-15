import storyJson from '../../data/story/unit7.json';
import factsJson from '../../data/facts.json';
import { MotiveId, Story, StorySite, WorldId } from './schema.ts';
import { ALL_ENTRIES } from './entries.ts';
import { GameState } from '../core/GameState.ts';

/**
 * UNIT-7's story script. Content is validated by `tools/validate-data.ts`
 * (schema, no unsourced numbers, no invented feelings for real machines).
 */
export const STORY: Story = storyJson as Story;

export const MOTIVE_IDS: MotiveId[] = ['curiosity', 'legacy', 'challenge', 'together'];

/** A line UNIT-7 speaks: its own thought (game story) or a sourced fact (verified record). */
export interface VoiceLine {
  key: string;
  text: string;
  kind: 'thought' | 'record';
  title?: string;
  sourceUrl?: string;
}

export function getSiteStory(id: string): StorySite | null {
  return STORY.sites[id] ?? null;
}

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);
}

/** Answer the player gave for a site, if any. */
export function getAnswer(siteId: string): { index: number; text: string; motive: MotiveId } | null {
  const idx = GameState.getJournal()[siteId];
  const site = getSiteStory(siteId);
  if (idx === undefined || !site) return null;
  const choice = site.question.choices[idx];
  return choice ? { index: idx, text: choice.text, motive: choice.motive } : null;
}

/** Motive counts across all answers (most recent answer breaks ties). */
export function getMotiveTally(): { counts: Record<MotiveId, number>; leading: MotiveId | null; answered: number } {
  const counts: Record<MotiveId, number> = { curiosity: 0, legacy: 0, challenge: 0, together: 0 };
  let last: MotiveId | null = null;
  let answered = 0;
  for (const siteId of Object.keys(GameState.getJournal())) {
    const a = getAnswer(siteId);
    if (!a) continue;
    counts[a.motive]++;
    answered++;
    last = a.motive;
  }
  let leading: MotiveId | null = null;
  for (const m of MOTIVE_IDS) {
    if (counts[m] === 0) continue;
    if (!leading || counts[m] > counts[leading] || (counts[m] === counts[leading] && m === last)) leading = m;
  }
  return { counts, leading, answered };
}

/** UNIT-7's current theory of why humans explore, shaped by the player's answers. */
export function getTheory(): { motive: MotiveId; label: string; text: string } | null {
  const { leading } = getMotiveTally();
  if (!leading) return null;
  const m = STORY.motives[leading];
  return { motive: leading, label: m.label, text: m.theory };
}

/**
 * Resolves story tokens in cinematic captions:
 * `{player_theory|fallback}` → the player's theory, or the fallback text.
 */
export function resolveStoryTokens(text: string): string {
  return text.replace(/\{player_theory\|([^}]*)\}/g, (_m, fallback: string) => getTheory()?.text ?? fallback);
}

/** Sourced facts UNIT-7 may share in this world (verified record framing). */
export function getFactPool(world: WorldId): VoiceLine[] {
  const lines: VoiceLine[] = [];
  for (const entry of Object.values(ALL_ENTRIES)) {
    if (entry.world !== world) continue;
    // Only facts from machines whose echo UNIT-7 has already recovered or is tracking
    const known = GameState.isEntryRecovered(entry.id) || GameState.getNextTarget(world) === entry.id;
    if (!known) continue;
    entry.facts.forEach((f, i) => {
      lines.push({ key: `fact:${entry.id}:${i}`, text: f.text, kind: 'record', title: entry.name, sourceUrl: f.source_url });
    });
  }
  for (const f of factsJson.facts) {
    if (f.text.startsWith('TODO')) continue;
    if (world === 'elsewhere') {
      if (!/voyager|cassini|galileo|pluto|eros|interstellar|new horizons/i.test(f.text)) continue;
    } else {
      const isMars = /mars|martian|sojourner|curiosity|ingenuity|insight/i.test(f.text);
      if ((world === 'mars') !== isMars) continue;
    }
    lines.push({ key: `fact:${f.id}`, text: f.text, kind: 'record', title: 'NASA', sourceUrl: f.source_url });
  }
  return lines;
}

export function sourceHost(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
