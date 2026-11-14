export interface MissionRecord {
  id: string;
  name: string;
  chapter: 'moon' | 'mars' | 'elsewhere' | string;
  featured: boolean;
  featured_encounter_id?: string;
  agencies: string[];
  hardware_types: string[];
  destination: string;
  launch_date: string;
  arrival_date?: string;
  mission_end_date?: string | null;
  status: string;
  location_summary: string;
  objective: string;
  science_summary: string;
  story_hook: string;
  source_ids: string[];
  media_page_url: string;
  status_review_required_before_release?: boolean;
}

export interface SourceRecord {
  id: string;
  title: string;
  organization: string;
  url: string;
  tier: string;
  local_snapshot: string | null;
}

export interface NarrativeBeat {
  id: string;
  trigger: string;
  stage?: number;
  speaker: string;
  text: string;
}

export interface QuickTaskStep {
  id: string;
  verb: string;
  prompt: string;
  win_condition: string;
  success_text: string;
  retry_text: string;
}

export interface QuickTaskOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface QuickTaskCard {
  label: string;
  value: string;
}

export interface NarrativeKeyNumber {
  label: string;
  value: string;
  source_id: string;
}

export interface NarrativeEvidenceStep {
  step: string;
  caption: string;
}

export interface NarrativeEncounter {
  id: string;
  mission_id: string;
  chapter: string;
  order: number;
  title: string;
  echo_speaker: string;
  handoff_priority: boolean;
  memory_echo: {
    intro: string[];
    beats: NarrativeBeat[];
    outcomes: {
      success: string;
      partial: string;
      fail: string;
    };
  };
  game_support: Record<string, unknown>;
  behind_the_memory: {
    headline: string;
    summary: string;
    what_happened: string[];
    why_it_matters: string;
    key_numbers: NarrativeKeyNumber[];
    how_the_game_simplifies: string;
    evidence_chain: NarrativeEvidenceStep[];
    source_ids: string[];
  };
  verify?: string[];
  learning_intent: string;
  player_task: string;
  mechanic_family: string;
  quick_task: {
    task_name: string;
    interaction_style: string;
    control: string;
    seconds: string;
    steps: QuickTaskStep[];
    options?: QuickTaskOption[];
    cards?: QuickTaskCard[];
    teaches: string;
    difficulty: { easy: string; normal: string };
    data_note?: string;
  };
  status_badge: {
    label: string;
    dataset_status: string;
  };
}

export interface CatalogEncounterRecord {
  id: string;
  mission_id: string;
  chapter: 'moon' | 'mars' | 'elsewhere' | string;
  order: number;
  title: string;
  mechanic_family: string;
  player_task: string;
  learning_intent: string;
  evidence_chain: string[];
  simplification_note: string;
  primary_source_id: string;
}

export interface SaveStatePayload {
  schema_version: '1.0.0';
  call_sign: string;
  unlocked_badges: string[];
  exported_at: string;
}

export interface NarrativeBundle {
  schema_version: string;
  campaign_id: string;
  ui_copy: {
    honesty_label: string;
    buttons: Record<string, string>;
    section_labels: Record<string, string>;
    needs_review_badge: string;
    echo_frame: string;
    frame_rule: string;
  };
  glossary: { term: string; definition: string }[];
  encounters: NarrativeEncounter[];
  references_consulted: { title: string; org: string; url: string; used_for: string }[];
}

export function getStatusBadgeInfo(status: string): { label: string; className: string } {
  switch (status) {
    case 'active-primary':
      return { label: 'Active', className: 'status-badge active' };
    case 'active-extended':
      return { label: 'Active · Extended', className: 'status-badge active' };
    case 'passive-science':
      return { label: 'Passive · In use', className: 'status-badge passive' };
    case 'silent-location-known':
      return { label: 'Silent · Located', className: 'status-badge dormant' };
    case 'silent-location-approximate':
      return { label: 'Silent · Drifting', className: 'status-badge dormant' };
    case 'completed-surface':
    case 'completed-orbit':
      return { label: 'Mission complete', className: 'status-badge completed' };
    case 'intentionally-impacted':
      return { label: 'Impacted', className: 'status-badge impacted' };
    default:
      return { label: status.replace(/-/g, ' '), className: 'status-badge dormant' };
  }
}

export function getChapterSceneClass(chapter: string): string {
  if (chapter === 'mars') return 'scene-horizon scene-mars';
  if (chapter === 'elsewhere') return 'scene-horizon scene-elsewhere';
  return 'scene-horizon scene-moon';
}

export function getMissionSprite(missionId: string): { src: string; alt: string } | null {
  if (missionId.startsWith('surveyor')) {
    return { src: '/assets/sprites/surveyor.png', alt: 'Surveyor lander team illustration' };
  }
  if (missionId.startsWith('apollo-') && missionId.includes('surface')) {
    return { src: '/assets/sprites/lm.png', alt: 'Apollo lunar module team illustration' };
  }
  if (missionId === 'curiosity' || missionId === 'perseverance') {
    return { src: '/assets/sprites/curiosity.png', alt: 'Six-wheeled Mars rover team illustration' };
  }
  return null;
}

export function getChapterAccentColor(chapter: string): string {
  if (chapter === 'mars') return 'var(--rust)';
  if (chapter === 'elsewhere') return 'var(--amber)';
  return 'var(--crust)';
}
