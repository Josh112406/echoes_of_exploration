import { useState, type ChangeEvent } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';
import {
  exportSaveJson,
  validateImportJson,
  type AccessibilitySettings,
  type QualityOption,
  type SaveRecord,
  type TextSizeOption,
} from '../persistence/saveManager';

interface SettingsViewProps {
  saveStateData: SaveRecord;
  onUpdateSettings: (patch: Partial<AccessibilitySettings>) => void;
  onUpdateCallSign: (callSign: string) => void;
  onReplaceSave: (next: SaveRecord) => void;
  onResetSave: () => void;
}

export function SettingsView({
  saveStateData,
  onUpdateSettings,
  onUpdateCallSign,
  onReplaceSave,
  onResetSave,
}: SettingsViewProps) {
  const { settings } = saveStateData;
  const [callSignDraft, setCallSignDraft] = useState(saveStateData.callSign);
  const [importPreview, setImportPreview] = useState<{
    record: SaveRecord | null;
    error: string | null;
  } | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const handleDownloadExport = () => {
    telemetryAudio.playSignalLock();
    exportSaveJson(saveStateData);
  };

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = validateImportJson(text);
    setImportPreview({
      record: result.valid ? result.preview ?? null : null,
      error: result.error ?? null,
    });
    e.target.value = '';
  };

  return (
    <section className="section-stack" aria-label="Settings, Accessibility and Local Save">
      <div className="panel notch-corner section-header-panel">
        <div>
          <span className="pill-tag pill-cyan">OBSERVATORY PREFERENCES</span>
          <h2>Settings, Accessibility & Save Data</h2>
          <p className="muted-caption">
            All settings and expedition progress are saved privately in your browser’s{' '}
            <code>localStorage</code>. Zero cookies, zero tracking.
          </p>
        </div>
      </div>

      <div className="settings-grid">
        {/* Call Sign Card */}
        <div className="panel notch-corner settings-card">
          <h3>Archivist Profile</h3>
          <label className="field-label" htmlFor="settings-callsign">
            Call Sign
          </label>
          <div className="inline-input-row">
            <input
              id="settings-callsign"
              type="text"
              maxLength={24}
              value={callSignDraft}
              onChange={(e) => setCallSignDraft(e.target.value)}
              className="text-input"
            />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                telemetryAudio.playChirp(720, 0.05, 'Call sign saved');
                onUpdateCallSign(callSignDraft.trim() || 'Archivist-01');
              }}
            >
              SAVE
            </button>
          </div>
          <p className="muted-caption">
            Reconstructed echoes: {saveStateData.completedEncounters.length} / 9 · Badges:{' '}
            {saveStateData.unlockedPatches.length} · Bookmarks:{' '}
            {saveStateData.bookmarkedMissions.length}
          </p>
        </div>

        {/* Audio & Transcripts */}
        <div className="panel notch-corner settings-card">
          <h3>Audio & Visual Transcripts</h3>
          <div className="setting-toggle-row">
            <label htmlFor="toggle-mute">Master Mute</label>
            <button
              id="toggle-mute"
              type="button"
              role="switch"
              aria-checked={settings.masterMute}
              className={`btn ${settings.masterMute ? 'btn-rust' : 'btn-cyan'}`}
              onClick={() => onUpdateSettings({ masterMute: !settings.masterMute })}
            >
              {settings.masterMute ? 'MUTED' : 'ACTIVE'}
            </button>
          </div>

          <div className="slider-row">
            <label htmlFor="sfx-vol">
              SFX Volume ({Math.round(settings.sfxVolume * 100)}%)
            </label>
            <input
              id="sfx-vol"
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.sfxVolume * 100)}
              onChange={(e) =>
                onUpdateSettings({ sfxVolume: Number(e.target.value) / 100 })
              }
            />
          </div>

          <div className="slider-row">
            <label htmlFor="music-vol">
              Ambient Synth Volume ({Math.round(settings.musicVolume * 100)}%)
            </label>
            <input
              id="music-vol"
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.musicVolume * 100)}
              onChange={(e) =>
                onUpdateSettings({ musicVolume: Number(e.target.value) / 100 })
              }
            />
          </div>

          <div className="setting-toggle-row">
            <label htmlFor="toggle-transcripts">Live Visual Audio Transcripts</label>
            <button
              id="toggle-transcripts"
              type="button"
              role="switch"
              aria-checked={settings.showAudioTranscripts}
              className={`btn ${settings.showAudioTranscripts ? 'btn-cyan' : ''}`}
              onClick={() =>
                onUpdateSettings({ showAudioTranscripts: !settings.showAudioTranscripts })
              }
            >
              {settings.showAudioTranscripts ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Display & Accessibility */}
        <div className="panel notch-corner settings-card">
          <h3>Display & Accessibility</h3>
          <div className="setting-toggle-row">
            <label htmlFor="text-size-select">Text Size</label>
            <select
              id="text-size-select"
              className="select-input"
              value={settings.textSize}
              onChange={(e) =>
                onUpdateSettings({ textSize: e.target.value as TextSizeOption })
              }
            >
              <option value="normal">Standard (100%)</option>
              <option value="large">Large (115%)</option>
              <option value="xlarge">Extra Large (130%)</option>
            </select>
          </div>

          <div className="setting-toggle-row">
            <label htmlFor="toggle-contrast">High Contrast Mode</label>
            <button
              id="toggle-contrast"
              type="button"
              role="switch"
              aria-checked={settings.highContrast}
              className={`btn ${settings.highContrast ? 'btn-amber' : ''}`}
              onClick={() => onUpdateSettings({ highContrast: !settings.highContrast })}
            >
              {settings.highContrast ? 'HIGH CONTRAST ON' : 'STANDARD'}
            </button>
          </div>

          <div className="setting-toggle-row">
            <label htmlFor="toggle-motion">Reduced Motion</label>
            <button
              id="toggle-motion"
              type="button"
              role="switch"
              aria-checked={settings.reducedMotion}
              className={`btn ${settings.reducedMotion ? 'btn-cyan' : ''}`}
              onClick={() => onUpdateSettings({ reducedMotion: !settings.reducedMotion })}
            >
              {settings.reducedMotion ? 'REDUCED' : 'ANIMATED'}
            </button>
          </div>

          <div className="setting-toggle-row">
            <label htmlFor="toggle-scanlines">CRT Scanlines Overlay</label>
            <button
              id="toggle-scanlines"
              type="button"
              role="switch"
              aria-checked={settings.crtScanlines}
              className={`btn ${settings.crtScanlines ? 'btn-cyan' : ''}`}
              onClick={() => onUpdateSettings({ crtScanlines: !settings.crtScanlines })}
            >
              {settings.crtScanlines ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="setting-toggle-row">
            <label htmlFor="quality-select">Render Quality</label>
            <select
              id="quality-select"
              className="select-input"
              value={settings.quality}
              onChange={(e) =>
                onUpdateSettings({ quality: e.target.value as QualityOption })
              }
            >
              <option value="high">High (Full Starfield)</option>
              <option value="balanced">Balanced</option>
              <option value="reduced">Reduced (Low Power)</option>
            </select>
          </div>
        </div>

        {/* Gameplay Assist & Local Save Management */}
        <div className="panel notch-corner settings-card">
          <h3>Gameplay Assist & Save Backup</h3>

          <div className="setting-toggle-row">
            <label htmlFor="toggle-assist">Junior Guidance (Default Assist)</label>
            <button
              id="toggle-assist"
              type="button"
              role="switch"
              aria-checked={settings.juniorGuidance}
              className={`btn ${settings.juniorGuidance ? 'btn-cyan' : ''}`}
              onClick={() =>
                onUpdateSettings({ juniorGuidance: !settings.juniorGuidance })
              }
            >
              {settings.juniorGuidance ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="setting-toggle-row">
            <label htmlFor="toggle-noncanvas">
              Default to Non-Canvas Choice Mode
            </label>
            <button
              id="toggle-noncanvas"
              type="button"
              role="switch"
              aria-checked={settings.nonCanvasMode}
              className={`btn ${settings.nonCanvasMode ? 'btn-cyan' : ''}`}
              onClick={() => onUpdateSettings({ nonCanvasMode: !settings.nonCanvasMode })}
            >
              {settings.nonCanvasMode ? 'CHOICE MODE' : 'CANVAS SIM'}
            </button>
          </div>

          <div className="save-actions-box">
            <button type="button" className="btn btn-primary" onClick={handleDownloadExport}>
              EXPORT SAVE (.JSON)
            </button>

            <label className="btn file-upload-btn">
              IMPORT SAVE (.JSON)
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleImportFile}
                className="sr-only"
              />
            </label>
          </div>

          {importPreview && (
            <div
              className={`feedback-banner ${
                importPreview.error ? 'tone-rust' : 'tone-cyan'
              }`}
            >
              {importPreview.error ? (
                <div>
                  <strong>Import Validation Error:</strong> {importPreview.error}
                  <div className="sim-controls-row">
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setImportPreview(null)}
                    >
                      DISMISS
                    </button>
                  </div>
                </div>
              ) : importPreview.record ? (
                <div>
                  <strong>Validated Save Preview:</strong> Call Sign{' '}
                  <code>{importPreview.record.callSign}</code> ·{' '}
                  {importPreview.record.completedEncounters.length} completed echoes ·{' '}
                  {importPreview.record.unlockedPatches.length} patches.
                  <div className="sim-controls-row">
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={() => {
                        if (importPreview.record) {
                          onReplaceSave(importPreview.record);
                          setCallSignDraft(importPreview.record.callSign);
                          setImportPreview(null);
                          telemetryAudio.playSuccessFanfare();
                        }
                      }}
                    >
                      CONFIRM REPLACE SAVE
                    </button>
                    <button
                      type="button"
                      className="btn"
                      onClick={() => setImportPreview(null)}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          <div className="danger-zone">
            {!confirmReset ? (
              <button
                type="button"
                className="btn btn-rust"
                onClick={() => setConfirmReset(true)}
              >
                RESET ALL PROGRESS
              </button>
            ) : (
              <div className="sim-controls-row">
                <span>Erase all unlocked echoes and settings?</span>
                <button
                  type="button"
                  className="btn btn-rust"
                  onClick={() => {
                    onResetSave();
                    setCallSignDraft('Archivist-01');
                    setConfirmReset(false);
                  }}
                >
                  YES, RESET ARCHIVE
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => setConfirmReset(false)}
                >
                  CANCEL
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
