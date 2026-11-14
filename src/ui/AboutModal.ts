import { EventBus, EVENTS } from '../core/EventBus.ts';
import { PALETTE } from './theme.ts';

export class AboutModal {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    EventBus.on(EVENTS.OPEN_ABOUT, () => {
      this.container.classList.remove('hidden');
      this.render();
    });
  }

  render(): void {
    this.container.innerHTML = `
      <div style="max-width:600px; margin:auto; background:${PALETTE.deepIndigo}; border:1px solid ${PALETTE.cyanGlow}; padding:24px; box-shadow:0 12px 36px rgba(5,7,15,0.95);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid ${PALETTE.shadowNavy}; padding-bottom:12px;">
          <h2 style="font-size:15px; font-weight:700; letter-spacing:0.04em; color:${PALETTE.lunarHighlight}; font-family:var(--font-mono);">ABOUT ECHOES OF EXPLORATION</h2>
          <button id="btn-close-about" class="btn">CLOSE [X]</button>
        </div>

        <div style="font-size:12px; font-family:var(--font-mono); line-height:1.6; color:${PALETTE.lunarCrustCream}; display:flex; flex-direction:column; gap:12px;">
          <p>
            <strong style="color:${PALETTE.cyanLaser};">"THE NASA SIGNAL ARCHIVE."</strong><br />
            <em>Echoes of Exploration</em> is an educational exploration game and verifiable archive documenting 23 real NASA spacecraft, rovers, landers and deep-space probes across three sectors: the Moon, Mars, and Elsewhere.
          </p>

          <p>
            <strong style="color:${PALETTE.beaconGold};">Truth First:</strong> Every mission date, coordinate, status, and factual claim in the archive is strictly tied to primary NASA, JPL, and Planetary Data System records. Fictional storytelling cues (the robot explorer and echoes) are visibly distinct from the verified historical archive entries.
          </p>

          <p>
            <strong style="color:${PALETTE.cyanLaser};">Zero Runtime Telemetry:</strong> This application collects no personal data, runs zero third-party tracking scripts, sets no cookies, and performs zero external network calls while running.
          </p>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-close-about')?.addEventListener('click', () => {
      this.container.classList.add('hidden');
    });
  }
}
