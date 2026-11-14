import { TitleScreen } from './TitleScreen.ts';
import { HubMap } from './HubMap.ts';
import { ArchiveModal } from './ArchiveModal.ts';
import { EntryReaderModal } from './EntryReaderModal.ts';
import { FailureAssistModal } from './FailureAssistModal.ts';
import { SettingsModal } from './SettingsModal.ts';
import { AboutModal } from './AboutModal.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { GameState } from '../core/GameState.ts';
import { SoundFX } from '../audio/SoundEffects.ts';

export class UIManager {
  constructor() {
    new TitleScreen(document.getElementById('title-overlay')!);
    new HubMap(document.getElementById('hub-overlay')!);
    new ArchiveModal(document.getElementById('archive-overlay')!);
    new EntryReaderModal(document.getElementById('entry-overlay')!);
    new FailureAssistModal(document.getElementById('failure-overlay')!);
    new SettingsModal(document.getElementById('settings-overlay')!);
    new AboutModal(document.getElementById('about-overlay')!);

    this.bindHeaderNav();
  }

  private bindHeaderNav(): void {
    const audioBtn = document.getElementById('nav-audio');
    const updateAudioLabel = () => {
      const isEnabled = GameState.getState().settings.audioEnabled;
      if (audioBtn) {
        audioBtn.textContent = isEnabled ? 'AUDIO: LIVE' : 'AUDIO: MUTED';
        audioBtn.classList.toggle('active', isEnabled);
      }
    };
    updateAudioLabel();
    EventBus.on(EVENTS.SETTINGS_CHANGED, updateAudioLabel);

    audioBtn?.addEventListener('click', () => {
      const isEnabled = !GameState.getState().settings.audioEnabled;
      GameState.updateSettings({ audioEnabled: isEnabled });
      updateAudioLabel();
      if (isEnabled) {
        SoundFX.playTouchdown();
      }
    });

    document.getElementById('nav-hub')?.addEventListener('click', () => {
      SoundFX.playClick();
      EventBus.emit(EVENTS.SHOW_TITLE);
    });

    document.getElementById('nav-archive')?.addEventListener('click', () => {
      SoundFX.playWhoosh();
      EventBus.emit(EVENTS.OPEN_ARCHIVE);
    });

    document.getElementById('nav-settings')?.addEventListener('click', () => {
      SoundFX.playClick();
      EventBus.emit(EVENTS.OPEN_SETTINGS);
    });

    document.getElementById('nav-about')?.addEventListener('click', () => {
      SoundFX.playClick();
      EventBus.emit(EVENTS.OPEN_ABOUT);
    });
  }
}
