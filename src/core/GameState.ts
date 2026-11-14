import { SaveManager } from '../save/SaveManager.ts';
import { SaveStateV1, WorldId } from '../data/schema.ts';
import { EventBus, EVENTS } from './EventBus.ts';
import { ALL_ENTRIES, MOON_CHRONOLOGY, MARS_CHRONOLOGY, ELSEWHERE_CHRONOLOGY } from '../data/entries.ts';

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
    if (!this.isWorldUnlocked(world)) return;
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

  /**
   * Chronological progression: a site can be played only when its sector is
   * open and it is the next unrecovered echo by launch date. Recovered echoes
   * stay open for review and replays.
   */
  static isSiteActive(siteId: string): boolean {
    const world = ALL_ENTRIES[siteId]?.world;
    if (!world) return false;
    if (this.isEntryRecovered(siteId)) return true;
    return this.isWorldUnlocked(world) && this.getNextTarget(world) === siteId;
  }

  /** True once every echo in all three sectors (Moon, Mars, Elsewhere) is recovered. */
  static isCampaignComplete(): boolean {
    return (['moon', 'mars', 'elsewhere'] as const).every((w) => this.isWorldComplete(w));
  }

  /** Sectors open strictly in order: Mars after every Moon echo, Elsewhere after every Mars echo. */
  static isWorldUnlocked(world: WorldId): boolean {
    if (world === 'moon') return true;
    if (world === 'mars') return this.isWorldComplete('moon');
    return this.isWorldComplete('moon') && this.isWorldComplete('mars');
  }

  static isWorldComplete(world: WorldId): boolean {
    const list = this.getChronoList(world);
    return list.every(id => this.isEntryRecovered(id));
  }

  static unlockEntry(id: string, assisted: boolean = false, fuelLeft: number | null = null, landingSpeed: number | null = null): void {
    if (!this.isSiteActive(id)) return; // out of chronological order
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

    // Sector progression: Moon → Mars → Elsewhere (deep space) → Grand Finale
    if (!this.state.marsUnlocked && this.isWorldUnlocked('mars')) {
      this.state.marsUnlocked = true;
      EventBus.emit(EVENTS.MARS_UNLOCKED);
    }
    if (!this.state.elsewhereUnlocked && this.isWorldUnlocked('elsewhere')) {
      this.state.elsewhereUnlocked = true;
      EventBus.emit(EVENTS.ELSEWHERE_UNLOCKED);
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
