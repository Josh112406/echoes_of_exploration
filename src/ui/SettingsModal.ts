import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { PALETTE } from './theme.ts';
import { SoundFX } from '../audio/SoundEffects.ts';

export class SettingsModal {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    EventBus.on(EVENTS.OPEN_SETTINGS, () => {
      this.container.classList.remove('hidden');
      this.render();
    });
  }

  render(): void {
    const s = GameState.getState().settings;

    this.container.innerHTML = `
      <div style="width:100%; max-width:500px; box-sizing:border-box; margin:auto; background:${PALETTE.deepIndigo}; border:1px solid ${PALETTE.cyanGlow}; padding:20px; box-shadow:0 12px 36px rgba(5,7,15,0.95);">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:20px; border-bottom:1px solid ${PALETTE.shadowNavy}; padding-bottom:12px;">
          <h2 style="font-size:15px; font-weight:700; letter-spacing:0.04em; color:${PALETTE.lunarHighlight}; font-family:var(--font-mono);">SYSTEM & ACCESSIBILITY SETTINGS</h2>
          <button id="btn-close-settings" class="btn">CLOSE [X]</button>
        </div>

        <div style="display:flex; flex-direction:column; gap:16px; font-size:12px; font-family:var(--font-mono); color:${PALETTE.lunarCrustCream};">
          <div style="font-size:11px; letter-spacing:0.12em; color:${PALETTE.cyanGlow};">SOUND</div>
          <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
            <span>Sound (music, ambience &amp; effects):</span>
            <input type="checkbox" id="chk-audio" ${s.audioEnabled ? 'checked' : ''} style="accent-color:${PALETTE.cyanGlow}; cursor:pointer;" />
          </label>
          ${this.slider('vol-music', 'Music', s.musicVolume)}
          ${this.slider('vol-ambience', 'Ambience (Moon, Mars, space)', s.ambienceVolume)}
          ${this.slider('vol-sfx', 'Effects &amp; UNIT-7 voice', s.sfxVolume)}

          <hr style="border:none; border-top:1px solid ${PALETTE.shadowNavy}; margin:4px 0;" />
          <div style="font-size:11px; letter-spacing:0.12em; color:${PALETTE.cyanGlow};">ACCESSIBILITY</div>
          <label style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px 12px; cursor:pointer;">
            <span>Text Size:</span>
            <select id="sel-text-size" style="max-width:100%; min-width:0; background:${PALETTE.shadowNavy}; color:${PALETTE.lunarHighlight}; border:1px solid ${PALETTE.cyanGlow}; padding:4px 8px; font-family:var(--font-mono); font-size:12px; cursor:pointer;">
              <option value="normal"${s.textSize === 'normal' ? ' selected' : ''}>Normal</option>
              <option value="large"${s.textSize === 'large' ? ' selected' : ''}>Large</option>
              <option value="xlarge"${s.textSize === 'xlarge' ? ' selected' : ''}>Extra Large</option>
            </select>
          </label>
          <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
            <span>High Contrast Mode:</span>
            <input type="checkbox" id="chk-contrast" ${s.highContrast ? 'checked' : ''} style="accent-color:${PALETTE.cyanGlow}; cursor:pointer;" />
          </label>

          <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
            <span>Reduced Motion (Disable camera easing):</span>
            <input type="checkbox" id="chk-motion" ${s.reducedMotion ? 'checked' : ''} style="accent-color:${PALETTE.cyanGlow}; cursor:pointer;" />
          </label>

          <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
            <span>Captions & Audio Telemetry:</span>
            <input type="checkbox" id="chk-captions" ${s.captionsEnabled ? 'checked' : ''} style="accent-color:${PALETTE.cyanGlow}; cursor:pointer;" />
          </label>

          <label style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;">
            <span>Always Allow Challenge Skip:</span>
            <input type="checkbox" id="chk-skip" ${s.alwaysSkipChallenge ? 'checked' : ''} style="accent-color:${PALETTE.cyanGlow}; cursor:pointer;" />
          </label>

          <hr style="border:none; border-top:1px solid ${PALETTE.shadowNavy}; margin:8px 0;" />

          <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
            <span style="color:${PALETTE.thrusterOrange};">Reset Mission Progress:</span>
            <button id="btn-reset-progress" class="btn" style="border-color:${PALETTE.thrusterOrange}; color:${PALETTE.thrusterOrange};">RESET PROGRESS</button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private slider(id: string, label: string, value: number): string {
    const pct = Math.round(value * 100);
    return `
          <label style="display:flex; flex-direction:column; gap:6px;">
            <span style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
              <span>${label}:</span>
              <output for="${id}" style="text-align:right; color:${PALETTE.lunarHighlight};">${pct}%</output>
            </span>
            <input type="range" id="${id}" min="0" max="100" step="5" value="${pct}" aria-valuetext="${pct}%" style="accent-color:${PALETTE.cyanGlow}; cursor:pointer; width:100%; min-width:0;" />
          </label>`;
  }

  private bindEvents(): void {
    this.container.querySelector('#chk-audio')?.addEventListener('change', (e) => {
      const on = (e.target as HTMLInputElement).checked;
      GameState.updateSettings({ audioEnabled: on });
      if (on) SoundFX.playClick();
    });
    const vol = (id: string, key: 'musicVolume' | 'ambienceVolume' | 'sfxVolume') => {
      const input = this.container.querySelector<HTMLInputElement>(`#${id}`);
      const out = this.container.querySelector<HTMLOutputElement>(`output[for="${id}"]`);
      input?.addEventListener('input', () => {
        const pct = Number(input.value);
        if (out) out.textContent = `${pct}%`;
        input.setAttribute('aria-valuetext', `${pct}%`);
        GameState.updateSettings({ [key]: pct / 100 });
      });
      // A sample tick so the effects level can be heard while adjusting it
      if (key === 'sfxVolume') input?.addEventListener('change', () => SoundFX.playClick());
    };
    vol('vol-music', 'musicVolume');
    vol('vol-ambience', 'ambienceVolume');
    vol('vol-sfx', 'sfxVolume');

    this.container.querySelector('#btn-close-settings')?.addEventListener('click', () => {
      this.container.classList.add('hidden');
    });

    this.container.querySelector('#sel-text-size')?.addEventListener('change', (e) => {
      const value = (e.target as HTMLSelectElement).value as 'normal' | 'large' | 'xlarge';
      GameState.updateSettings({ textSize: value });
    });

    this.container.querySelector('#chk-contrast')?.addEventListener('change', (e) => {
      GameState.updateSettings({ highContrast: (e.target as HTMLInputElement).checked });
    });

    this.container.querySelector('#chk-motion')?.addEventListener('change', (e) => {
      GameState.updateSettings({ reducedMotion: (e.target as HTMLInputElement).checked });
    });

    this.container.querySelector('#chk-captions')?.addEventListener('change', (e) => {
      GameState.updateSettings({ captionsEnabled: (e.target as HTMLInputElement).checked });
    });

    this.container.querySelector('#chk-skip')?.addEventListener('change', (e) => {
      GameState.updateSettings({ alwaysSkipChallenge: (e.target as HTMLInputElement).checked });
    });

    this.container.querySelector('#btn-reset-progress')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to wipe mission history and restart from scratch?')) {
        GameState.reset();
        this.container.classList.add('hidden');
        EventBus.emit(EVENTS.SHOW_TITLE);
      }
    });
  }
}
