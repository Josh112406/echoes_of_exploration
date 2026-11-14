import { getMission } from '../data/catalog.ts';
import { CATALOG_PRACTICE, MinigameSceneKey } from '../data/minigames.ts';

/** A practice run of a catalog mission that is not one of the 23 playable echoes. */
export interface PracticeRun {
  missionId: string;
  name: string;
  scene: MinigameSceneKey;
  siteId: string;
  note: string;
}

let current: PracticeRun | null = null;

/**
 * Tracks the active practice run so the shared minigame hand-off (MinigameKit)
 * can skip echo recovery and return the player to the Mission Catalog. Any real
 * minigame start clears it.
 */
export const Practice = {
  get run(): PracticeRun | null {
    return current;
  },

  /** Builds the run for a catalog mission, or null if it has no practice minigame. */
  prepare(missionId: string): PracticeRun | null {
    const spec = CATALOG_PRACTICE[missionId];
    const mission = getMission(missionId);
    if (!spec || !mission) return null;
    return { missionId, name: mission.name, scene: spec.scene, siteId: spec.siteId, note: spec.note };
  },

  begin(run: PracticeRun): void {
    current = run;
  },

  end(): void {
    current = null;
  },
};
