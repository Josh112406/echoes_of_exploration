export type TextSizeOption = 'normal' | 'large' | 'xlarge';
export type QualityOption = 'high' | 'balanced' | 'reduced';

export interface AccessibilitySettings {
  masterMute: boolean;
  sfxVolume: number;
  musicVolume: number;
  showAudioTranscripts: boolean;
  textSize: TextSizeOption;
  highContrast: boolean;
  reducedMotion: boolean;
  quality: QualityOption;
  juniorGuidance: boolean;
  nonCanvasMode: boolean;
  crtScanlines: boolean;
}

export interface SaveRecord {
  schemaVersion: string;
  campaignVersion: string;
  callSign: string;
  onboardingCompleted: boolean;
  completedEncounters: string[];
  unlockedPatches: string[];
  bookmarkedMissions: string[];
  lastRoute: string;
  lastEncounterId: string | null;
  settings: AccessibilitySettings;
}

export const SAVE_STORAGE_KEY = 'echoes_save_v1';
export const CORRUPT_BACKUP_KEY = 'echoes_corrupt_backup';
export const MAX_IMPORT_BYTES = 65536;

export const DEFAULT_SETTINGS: AccessibilitySettings = {
  masterMute: false,
  sfxVolume: 0.7,
  musicVolume: 0.35,
  showAudioTranscripts: true,
  textSize: 'normal',
  highContrast: false,
  reducedMotion: false,
  quality: 'high',
  juniorGuidance: false,
  nonCanvasMode: false,
  crtScanlines: true,
};

export function createDefaultSave(): SaveRecord {
  const prefersReduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  return {
    schemaVersion: '1.0.0',
    campaignVersion: '1.0.0',
    callSign: 'ARCHIVIST-01',
    onboardingCompleted: false,
    completedEncounters: [],
    unlockedPatches: [],
    bookmarkedMissions: [],
    lastRoute: 'title',
    lastEncounterId: null,
    settings: {
      ...DEFAULT_SETTINGS,
      reducedMotion: Boolean(prefersReduced),
    },
  };
}

function sanitizeStringArray(val: unknown, maxItems = 64): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .filter((item): item is string => typeof item === 'string' && item.length <= 64 && /^[a-zA-Z0-9_-]+$/.test(item))
    .slice(0, maxItems);
}

function sanitizeCallSign(val: unknown): string {
  if (typeof val !== 'string') return 'ARCHIVIST-01';
  const cleaned = val.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 24);
  return cleaned || 'ARCHIVIST-01';
}

function sanitizeSettings(raw: unknown): AccessibilitySettings {
  const def = createDefaultSave().settings;
  if (!raw || typeof raw !== 'object') return def;
  const s = raw as Record<string, unknown>;
  return {
    masterMute: typeof s.masterMute === 'boolean' ? s.masterMute : def.masterMute,
    sfxVolume: typeof s.sfxVolume === 'number' && s.sfxVolume >= 0 && s.sfxVolume <= 1 ? s.sfxVolume : def.sfxVolume,
    musicVolume: typeof s.musicVolume === 'number' && s.musicVolume >= 0 && s.musicVolume <= 1 ? s.musicVolume : def.musicVolume,
    showAudioTranscripts: typeof s.showAudioTranscripts === 'boolean' ? s.showAudioTranscripts : def.showAudioTranscripts,
    textSize: s.textSize === 'normal' || s.textSize === 'large' || s.textSize === 'xlarge' ? s.textSize : def.textSize,
    highContrast: typeof s.highContrast === 'boolean' ? s.highContrast : def.highContrast,
    reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : def.reducedMotion,
    quality: s.quality === 'high' || s.quality === 'balanced' || s.quality === 'reduced' ? s.quality : def.quality,
    juniorGuidance: typeof s.juniorGuidance === 'boolean' ? s.juniorGuidance : def.juniorGuidance,
    nonCanvasMode: typeof s.nonCanvasMode === 'boolean' ? s.nonCanvasMode : def.nonCanvasMode,
    crtScanlines: typeof s.crtScanlines === 'boolean' ? s.crtScanlines : def.crtScanlines,
  };
}

export function validateAndMigrateSave(rawObj: unknown): SaveRecord | null {
  if (!rawObj || typeof rawObj !== 'object' || Array.isArray(rawObj)) return null;
  const r = rawObj as Record<string, unknown>;
  if (typeof r.schemaVersion !== 'string') return null;

  // Reject unexpected script-like strings
  const serialized = JSON.stringify(r);
  if (serialized.includes('<script') || serialized.includes('javascript:')) return null;

  // Allow v0.9 migration or v1.0.0 exact match
  if (r.schemaVersion !== '1.0.0' && r.schemaVersion !== '0.9.0') {
    return null;
  }

  return {
    schemaVersion: '1.0.0',
    campaignVersion: typeof r.campaignVersion === 'string' ? r.campaignVersion.slice(0, 16) : '1.0.0',
    callSign: sanitizeCallSign(r.callSign),
    onboardingCompleted: typeof r.onboardingCompleted === 'boolean' ? r.onboardingCompleted : false,
    completedEncounters: sanitizeStringArray(r.completedEncounters, 20),
    unlockedPatches: sanitizeStringArray(r.unlockedPatches, 20),
    bookmarkedMissions: sanitizeStringArray(r.bookmarkedMissions, 50),
    lastRoute: typeof r.lastRoute === 'string' && /^[a-z-]+$/.test(r.lastRoute) ? r.lastRoute : 'title',
    lastEncounterId:
      typeof r.lastEncounterId === 'string' && /^[a-z0-9-]+$/.test(r.lastEncounterId) ? r.lastEncounterId : null,
    settings: sanitizeSettings(r.settings),
  };
}

export function loadSave(): { state: SaveRecord; corruptDetected: boolean } {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) {
      return { state: createDefaultSave(), corruptDetected: false };
    }
    const parsed = JSON.parse(raw);
    const validated = validateAndMigrateSave(parsed);
    if (!validated) {
      localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
      return { state: createDefaultSave(), corruptDetected: true };
    }
    return { state: validated, corruptDetected: false };
  } catch {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (raw) {
      localStorage.setItem(CORRUPT_BACKUP_KEY, raw);
    }
    return { state: createDefaultSave(), corruptDetected: true };
  }
}

export function saveState(state: SaveRecord): void {
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota exceptions cleanly
  }
}

export function exportSaveJson(state: SaveRecord): void {
  const payload = {
    exportedAt: new Date().toISOString(),
    product: 'Echoes of Exploration: The NASA Signal Archive',
    ...state,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `echoes-archive-${state.callSign.toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function validateImportJson(rawText: string): {
  valid: boolean;
  error?: string;
  preview?: SaveRecord;
} {
  if (rawText.length > MAX_IMPORT_BYTES) {
    return { valid: false, error: 'File exceeds maximum 64 KB safety limit.' };
  }
  try {
    const parsed = JSON.parse(rawText);
    const validated = validateAndMigrateSave(parsed);
    if (!validated) {
      return {
        valid: false,
        error: 'Unsupported save schema version, invalid shape, or unsafe values detected.',
      };
    }
    return { valid: true, preview: validated };
  } catch {
    return { valid: false, error: 'Malformed JSON file. Could not parse save archive.' };
  }
}

export function resetAllProgress(): SaveRecord {
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
    localStorage.removeItem(CORRUPT_BACKUP_KEY);
  } catch {
    // Ignore
  }
  return createDefaultSave();
}
