import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { getMinigameMetaForSite } from '../data/minigames.ts';
import { fieldTaskForEntry } from '../data/fieldTasks.ts';
import { PALETTE } from './theme.ts';

export class FailureAssistModal {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    EventBus.on(EVENTS.LANDING_FAILED, (data: { siteId: string; attempts: number }) => {
      this.show(data);
    });
  }

  show(data: { siteId: string; attempts: number }): void {
    this.container.classList.remove('hidden');

    const offerAssist = data.attempts >= 3 || GameState.getState().settings.alwaysSkipChallenge;
    const mg = getMinigameMetaForSite(data.siteId);

    this.container.innerHTML = `
      <div style="max-width:440px; margin:auto; background:${PALETTE.deepIndigo}; border:1px solid ${PALETTE.thrusterOrange}; padding:24px; text-align:center; box-shadow:0 12px 36px rgba(5,7,15,0.95);">
        <h3 style="color:${PALETTE.thrusterOrange}; font-size:16px; font-weight:700; margin-bottom:8px; font-family:var(--font-mono); letter-spacing:0.04em;">${mg.code} ANOMALY DETECTED</h3>
        <p style="font-size:12px; font-family:var(--font-mono); color:${PALETTE.lunarCrustCream}; margin-bottom:12px;">${mg.title} exited outside safe parameters.</p>
        <p style="font-size:11px; font-family:var(--font-mono); color:${PALETTE.slateMuted}; margin-bottom:20px;">Attempt ${data.attempts} on this site</p>

        <div style="display:flex; flex-direction:column; gap:8px;">
          <button id="btn-try-again" class="btn btn--primary" style="justify-content:center;">TRY AGAIN</button>
          
          ${offerAssist ? `
            <button id="btn-try-assist" class="btn" style="justify-content:center; border-color:${PALETTE.beaconGold}; color:${PALETTE.beaconGold};">
              TRY ${mg.code} WITH ASSIST (+25% Margin)
            </button>
            <button id="btn-skip-challenge" class="btn" style="justify-content:center; color:${PALETTE.slateMuted};">
              SKIP ${mg.code} CHALLENGE (VISIT RECOVERY)
            </button>
          ` : ''}

          <button id="btn-back-to-site" class="btn" style="justify-content:center;">BACK TO SITE</button>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-try-again')?.addEventListener('click', () => {
      this.container.classList.add('hidden');
      EventBus.emit(EVENTS.START_LANDING, data.siteId);
    });

    this.container.querySelector('#btn-try-assist')?.addEventListener('click', () => {
      this.container.classList.add('hidden');
      EventBus.emit(EVENTS.START_LANDING, data.siteId, true);
    });

    this.container.querySelector('#btn-skip-challenge')?.addEventListener('click', () => {
      this.container.classList.add('hidden');
      GameState.unlockEntry(data.siteId, true);
      // Return to the exploration view; run the field task (if any) before opening the record.
      EventBus.emit(EVENTS.NAVIGATE_TO_SITE, data.siteId);
      const task = fieldTaskForEntry(data.siteId);
      if (task) EventBus.emit(EVENTS.OPEN_FIELD_TASK, task.id, () => EventBus.emit(EVENTS.OPEN_ENTRY, data.siteId));
      else EventBus.emit(EVENTS.OPEN_ENTRY, data.siteId);
    });

    this.container.querySelector('#btn-back-to-site')?.addEventListener('click', () => {
      this.container.classList.add('hidden');
      EventBus.emit(EVENTS.START_EXPLORATION);
    });
  }
}
