import { z } from 'zod';
import missionsJson from './missions.json';
import sourcesJson from './sources.json';
import encountersJson from './encounters.json';

/**
 * The team's NASA mission catalog (Member 6's dataset): 31 mission groups whose
 * hardware is still on the Moon, on Mars or out in deep space, the official
 * sources behind them, and the 9 designed encounters. Validated on load so a
 * bad edit fails loudly in development instead of rendering half a record.
 */

const ChapterSchema = z.enum(['moon', 'mars', 'elsewhere']);

export const MissionStatusSchema = z.enum([
  'intentionally-impacted',
  'silent-location-known',
  'silent-location-approximate',
  'passive-science',
  'completed-surface',
  'completed-orbit',
  'active-extended',
  'active-primary',
]);

const MissionSchema = z.object({
  id: z.string(),
  name: z.string(),
  chapter: ChapterSchema,
  featured: z.boolean(),
  agencies: z.array(z.string()),
  hardware_types: z.array(z.string()),
  destination: z.string(),
  launch_date: z.string(),
  arrival_date: z.string().nullable().optional(),
  mission_end_date: z.string().nullable().optional(),
  status: MissionStatusSchema,
  location_summary: z.string(),
  objective: z.string(),
  science_summary: z.string(),
  story_hook: z.string(),
  source_ids: z.array(z.string()).min(1),
  media_page_url: z.string().url(),
  status_review_required_before_release: z.boolean(),
});

const SourceSchema = z.object({
  id: z.string(),
  title: z.string(),
  organization: z.string(),
  url: z.string().url(),
  tier: z.string(),
  local_snapshot: z.string().nullable().optional(),
});

const EncounterSchema = z.object({
  id: z.string(),
  mission_id: z.string(),
  chapter: ChapterSchema,
  order: z.number(),
  title: z.string(),
  mechanic_family: z.string(),
  player_task: z.string(),
  learning_intent: z.string(),
  evidence_chain: z.array(z.string()),
  simplification_note: z.string(),
  primary_source_id: z.string(),
});

export type Mission = z.infer<typeof MissionSchema>;
export type MissionStatus = z.infer<typeof MissionStatusSchema>;
export type Source = z.infer<typeof SourceSchema>;
export type Encounter = z.infer<typeof EncounterSchema>;

export const MISSION_CATALOG = z
  .object({ schema_version: z.string(), reviewed_on: z.string(), scope: z.string(), records: z.array(MissionSchema) })
  .parse(missionsJson);
export const MISSIONS: Mission[] = MISSION_CATALOG.records;

export const SOURCES: Source[] = z.object({ sources: z.array(SourceSchema) }).parse(sourcesJson).sources;
export const ENCOUNTERS: Encounter[] = z.object({ encounters: z.array(EncounterSchema) }).parse(encountersJson).encounters;

const SOURCE_BY_ID = new Map(SOURCES.map((s) => [s.id, s]));

/**
 * Which catalog missions each playable echo belongs to. Echoes not in the
 * catalog (Mars Polar Lander, and the commercial IM-1 and Blue Ghost 1 landers
 * that carried NASA payloads) map to nothing and keep their own sources.
 */
export const ENTRY_MISSIONS: Record<string, string[]> = {
  'surveyor-3': ['surveyor-3'],
  'apollo-11-site': ['apollo-11-surface'],
  'apollo-retroreflectors': ['apollo-11-surface', 'apollo-14-surface', 'apollo-15-surface'],
  'apollo-12-site': ['apollo-12-surface'],
  'apollo-15-lrv': ['apollo-15-surface'],
  'apollo-17-site': ['apollo-17-surface'],
  'im-1-odysseus': [],
  'blue-ghost-1': [],
  'viking-1-2': ['viking-1', 'viking-2'],
  'sojourner-pathfinder': ['mars-pathfinder'],
  'mars-polar-lander': [],
  'spirit-opportunity': ['spirit', 'opportunity'],
  phoenix: ['phoenix'],
  curiosity: ['curiosity'],
  insight: ['insight'],
  'perseverance-landing-hardware': ['perseverance'],
  ingenuity: ['ingenuity'],
  'voyager-1': ['voyager-1'],
  galileo: ['galileo'],
  'near-shoemaker': ['near-shoemaker'],
  'cassini-huygens': ['cassini-huygens'],
  'deep-impact': ['deep-impact-epoxi'],
  'new-horizons': ['new-horizons'],
};

export function getMission(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}

export function getSource(id: string): Source | undefined {
  return SOURCE_BY_ID.get(id);
}

export function missionsForEntry(entryId: string): Mission[] {
  return (ENTRY_MISSIONS[entryId] ?? []).map(getMission).filter((m): m is Mission => !!m);
}

/** The playable echo (if any) that covers a catalog mission. */
export function entryForMission(missionId: string): string | undefined {
  return Object.keys(ENTRY_MISSIONS).find((e) => ENTRY_MISSIONS[e].includes(missionId));
}

export function sourcesForMission(m: Mission): Source[] {
  return m.source_ids.map(getSource).filter((s): s is Source => !!s);
}

export function encounterForMission(missionId: string): Encounter | undefined {
  return ENCOUNTERS.find((e) => e.mission_id === missionId);
}

/** Encounters designed for an echo's missions, in campaign order. */
export function encountersForEntry(entryId: string): Encounter[] {
  const ids = ENTRY_MISSIONS[entryId] ?? [];
  return ENCOUNTERS.filter((e) => ids.includes(e.mission_id)).sort((a, b) => a.order - b.order);
}

/** Plain-language status labels for young readers. */
export const MISSION_STATUS_LABEL: Record<MissionStatus, string> = {
  'intentionally-impacted': 'Crashed on purpose',
  'silent-location-known': 'Silent · location known',
  'silent-location-approximate': 'Silent · location approximate',
  'passive-science': 'Still useful, no power needed',
  'completed-surface': 'Mission complete · on the surface',
  'completed-orbit': 'Mission complete · in orbit',
  'active-extended': 'Still working (extended mission)',
  'active-primary': 'Still working',
};
