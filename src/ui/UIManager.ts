import { TitleScreen } from './TitleScreen.ts';
import { HubMap } from './HubMap.ts';
import { ArchiveModal } from './ArchiveModal.ts';
import { EntryReaderModal } from './EntryReaderModal.ts';
import { FailureAssistModal } from './FailureAssistModal.ts';
import { SettingsModal } from './SettingsModal.ts';
import { AboutModal } from './AboutModal.ts';
import { FieldTaskModal } from './FieldTaskModal.ts';

export class UIManager {
  constructor() {
    new TitleScreen(document.getElementById('title-overlay')!);
    new HubMap(document.getElementById('hub-overlay')!);
    new ArchiveModal(document.getElementById('archive-overlay')!);
    new EntryReaderModal(document.getElementById('entry-overlay')!);
    new FailureAssistModal(document.getElementById('failure-overlay')!);
    new SettingsModal(document.getElementById('settings-overlay')!);
    new AboutModal(document.getElementById('about-overlay')!);
    new FieldTaskModal(document.getElementById('fieldtask-overlay')!);
  }
}
