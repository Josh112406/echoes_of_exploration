import { SaveStateV1, SaveStateV1Schema } from '../data/schema.ts';

const STORAGE_KEY = 'still_out_there_save_v1';

export const DEFAULT_SAVE_STATE: SaveStateV1 = {
  version: 1,
  currentWorld: 'moon',
  currentSiteId: null,
  marsUnlocked: true,
  elsewhereUnlocked: true,
  prologueSeen: false,
  epilogueSeen: false,
  entries: {},
  achievements: [],
  journal: {},
  robotPositions: {},
  settings: {
    textSize: 'normal',
    highContrast: false,
    reducedMotion: false,
    reducedEffects: false,
    audioEnabled: true,
    musicVolume: 0.9,
    ambienceVolume: 0.4,
    sfxVolume: 1,
    captionsEnabled: true,
    alwaysSkipChallenge: false,
  },
};

export class SaveManager {
  private static memoryStore: SaveStateV1 | null = null;
  private static hasStorageWarning: boolean = false;

  static load(): SaveStateV1 {
    if (this.memoryStore) {
      return this.memoryStore;
    }

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const json: unknown = JSON.parse(raw);
          const parsed = SaveStateV1Schema.safeParse(json);
          if (parsed.success) {
            // Saves from before the soundtrack had sound off by default (it was only UI blips).
            // Turn it on once; the player's own choice is kept from then on.
            // Persist the upgrade so it happens only once.
            parsed.data.marsUnlocked = true;
            parsed.data.elsewhereUnlocked = true;
            if (SaveManager.isPreSoundtrackSave(json)) {
              parsed.data.settings.audioEnabled = true;
              this.save(parsed.data);
            }
            this.memoryStore = parsed.data;
            return parsed.data;
          }
        }
      }
    } catch {
      this.hasStorageWarning = true;
    }

    this.memoryStore = JSON.parse(JSON.stringify(DEFAULT_SAVE_STATE));
    return this.memoryStore!;
  }

  static save(state: SaveStateV1): void {
    this.memoryStore = state;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      }
    } catch {
      this.hasStorageWarning = true;
    }
  }

  static resetProgress(): SaveStateV1 {
    const current = this.load();
    // Preserve accessibility & audio settings on reset
    const preservedSettings = { ...current.settings };
    const resetState: SaveStateV1 = {
      ...JSON.parse(JSON.stringify(DEFAULT_SAVE_STATE)),
      settings: preservedSettings,
    };
    this.save(resetState);
    return resetState;
  }

  /** True for a save written before the volume settings existed. */
  static isPreSoundtrackSave(json: unknown): boolean {
    const settings = (json as { settings?: Record<string, unknown> } | null)?.settings;
    return !!settings && !('musicVolume' in settings);
  }

  static isStorageBlocked(): boolean {
    return this.hasStorageWarning;
  }
}

