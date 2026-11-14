import { SaveManager } from '../save/SaveManager.ts';
import { SaveStateV1, WorldId } from '../data/schema.ts';
import { EventBus, EVENTS } from './EventBus.ts';
import { MOON_CHRONOLOGY, MARS_CHRONOLOGY, ELSEWHERE_CHRONOLOGY } from '../data/entries.ts';

export class GameState {
  private static state: SaveStateV1 = SaveManager.load();
  private static failCounters: Map<string, number> = new Map();

  static getState(): SaveStateV1 {
    return this.state;
  }

  static getWorld(): WorldId {
    return this.state.currentWorld;
  }

  static setWorld(world: WorldId): void {
    this.state.currentWorld = world;
    SaveManager.save(this.state);
  }

  static getCurrentSiteId(): string | null {
    return this.state.currentSiteId;
  }

  static setCurrentSiteId(siteId: string | null): void {
    this.state.currentSiteId = siteId;
    SaveManager.save(this.state);
  }

  static getRobotPosition(world: WorldId = this.state.currentWorld): { x: number; y: number } | null {
    return this.state.robotPositions?.[world] ?? null;
  }

  static setRobotPosition(world: WorldId, pos: { x: number; y: number }): void {
    if (!this.state.robotPositions) {
      this.state.robotPositions = {};
    }
    this.state.robotPositions[world] = { x: pos.x, y: pos.y };
    SaveManager.save(this.state);
  }

  static isEntryRecovered(id: string): boolean {
    return !!this.state.entries[id]?.recovered;
  }

  static getChronoList(world: WorldId): string[] {
    if (world === 'moon') return MOON_CHRONOLOGY;
    if (world === 'mars') return MARS_CHRONOLOGY;
    return ELSEWHERE_CHRONOLOGY;
  }

  static getNextTarget(world: WorldId = this.state.currentWorld): string | null {
    const list = this.getChronoList(world);
    for (const id of list) {
      if (!this.isEntryRecovered(id)) {
        return id;
      }
    }
    return null; // All recovered in this world
  }

  static getRecoveredCount(world: WorldId = this.state.currentWorld): number {
    const list = this.getChronoList(world);
    return list.filter(id => this.isEntryRecovered(id)).length;
  }

  static isSiteActive(_siteId: string): boolean {
    // Open-world exploration: any site in the sector can be played immediately,
    // while radar continues guiding toward the next chronological target.
    return true;
  }

  static isWorldComplete(world: WorldId): boolean {
    const list = this.getChronoList(world);
    return list.every(id => this.isEntryRecovered(id));
  }

  static unlockEntry(id: string, assisted: boolean = false, fuelLeft: number | null = null, landingSpeed: number | null = null): void {
    if (!this.state.entries[id]) {
      this.state.entries[id] = {
        recovered: true,
        read: false,
        assisted,
        attempts: (this.failCounters.get(id) || 0) + 1,
        bestFuelRemaining: fuelLeft,
        bestLandingSpeed: landingSpeed,
      };
    } else {
      this.state.entries[id].recovered = true;
      if (assisted) this.state.entries[id].assisted = true;
    }

    // Reset failure counter for this level
    this.failCounters.delete(id);

    // Check Mars Unlock condition: all 8 Moon relics completed chronologically
    if (!this.state.marsUnlocked) {
      const moonComplete = this.isWorldComplete('moon');

      if (moonComplete) {
        this.state.marsUnlocked = true;
        EventBus.emit(EVENTS.MARS_UNLOCKED);
      }
    }

    SaveManager.save(this.state);
    EventBus.emit(EVENTS.ENTRY_UNLOCKED, id);
  }

  /** Record the player's answer to UNIT-7's question for a recovered site. */
  static setJournalAnswer(siteId: string, choiceIndex: number): void {
    if (!this.state.journal) this.state.journal = {};
    this.state.journal[siteId] = choiceIndex;
    SaveManager.save(this.state);
    EventBus.emit(EVENTS.JOURNAL_UPDATED, siteId);
  }

  static getJournal(): Record<string, number> {
    return this.state.journal ?? {};
  }

  static setPrologueSeen(seen: boolean = true): void {
    this.state.prologueSeen = seen;
    SaveManager.save(this.state);
  }

  static setEpilogueSeen(seen: boolean = true): void {
    this.state.epilogueSeen = seen;
    SaveManager.save(this.state);
  }

  static recordFailure(id: string): number {
    const count = (this.failCounters.get(id) || 0) + 1;
    this.failCounters.set(id, count);
    return count;
  }

  static getFailureCount(id: string): number {
    return this.failCounters.get(id) || 0;
  }

  /** True once the player has finished the entry's briefing (passed its question). */
  static isEntryRead(id: string): boolean {
    return !!this.state.entries[id]?.read;
  }

  static markEntryRead(id: string): void {
    if (this.state.entries[id]) {
      this.state.entries[id].read = true;
      SaveManager.save(this.state);
    }
  }

  static updateSettings(settings: Partial<SaveStateV1['settings']>): void {
    this.state.settings = { ...this.state.settings, ...settings };
    SaveManager.save(this.state);
    EventBus.emit(EVENTS.SETTINGS_CHANGED);
  }

  static reset(): void {
    this.state = SaveManager.resetProgress();
    this.failCounters.clear();
    EventBus.emit(EVENTS.PROGRESS_RESET);
  }
}
