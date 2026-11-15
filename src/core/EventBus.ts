type EventCallback = (...args: any[]) => void;

class EventBusEmitter {
  private events: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    const listeners = this.events.get(event);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.events.delete(event);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const listeners = this.events.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch (err) {
          console.error(`Error in EventBus listener for event "${event}":`, err);
        }
      }
    }
  }

  removeAllListeners(): void {
    this.events.clear();
  }
}

export const EventBus = new EventBusEmitter();

export const EVENTS = {
  // Navigation & Scenes
  START_INTRO: 'intro:start',
  SHOW_TITLE: 'title:show',
  START_EXPLORATION: 'explore:start',
  START_TRANSITION: 'transition:moon-to-mars',
  SHOW_FINALE: 'finale:show',
  NAVIGATE_TO_HUB: 'nav:hub',
  NAVIGATE_TO_SITE: 'nav:site',
  START_LANDING: 'landing:start',
  /** Practice run of a catalog-only mission (no echo is recovered). Arg: missionId. */
  START_PRACTICE: 'practice:start',
  /** Interactive field task (Viking soil evidence, Voyager power budget). Args: taskId, onDone?. */
  OPEN_FIELD_TASK: 'ui:fieldtask:open',
  LANDING_COMPLETE: 'landing:complete',
  LANDING_FAILED: 'landing:failed',
  
  // Modals & UI
  OPEN_WORLD_SELECT: 'ui:world_select:open',
  OPEN_ARCHIVE: 'ui:archive:open',
  OPEN_ENTRY: 'ui:entry:open',
  ENTRY_CLOSED: 'ui:entry:closed',
  OPEN_SETTINGS: 'ui:settings:open',
  SETTINGS_CHANGED: 'state:settings:changed',
  /** Title menu: UNIT-7's comment on the highlighted option (text, or '' to fall silent). */
  TITLE_HINT: 'ui:title:hint',
  OPEN_ABOUT: 'ui:about:open',
  SHOW_ASSIST: 'ui:assist:show',
  
  // Game state
  ENTRY_UNLOCKED: 'state:entry:unlocked',
  MARS_UNLOCKED: 'state:mars:unlocked',
  ELSEWHERE_UNLOCKED: 'state:elsewhere:unlocked',
  PROGRESS_RESET: 'state:reset',
  JOURNAL_UPDATED: 'state:journal:updated',
} as const;
