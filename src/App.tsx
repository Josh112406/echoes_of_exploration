// SI-assisted route coordinator; playable game components mount strictly on /game.
import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { telemetryAudio } from './audio/telemetryAudio';
import { SignalInspectorModal } from './components/SignalInspectorModal';
import {
  SourcesArchiveDropdown,
  type ArchiveSubView,
  type RoutePath,
  type SourcesSubView,
} from './components/SourcesArchiveDropdown';
import { StarfieldCanvas } from './components/StarfieldCanvas';
import type { SectorId } from './components/SurfaceExplorerCanvas';
import {
  getArchiveSubViewFromUrl,
  getQueryEncounterId,
  getSourcesSubViewFromUrl,
  normalizeRoutePath,
} from './data/chapters';
import encountersJson from './data/encounters.json';
import missionsJson from './data/missions.json';
import sourcesJson from './data/sources.json';
import type {
  CatalogEncounterRecord,
  MissionRecord,
  NarrativeBundle,
  SaveStatePayload,
  SourceRecord,
} from './data/types';
import { ArchivePage } from './pages/archive/ArchivePage';
import { GamePage, type GameMode } from './pages/game/GamePage';
import { HomePage } from './pages/home/HomePage';
import { SourcesPage } from './pages/sources/SourcesPage';
import narrativeJson from './text/narrative.json';

const BADGE_STORAGE_KEY = 'echoes_unlocked_badges_v1';
const CALLSIGN_STORAGE_KEY = 'echoes_call_sign_v1';
const MAX_IMPORT_BYTES = 64 * 1024;

const MISSIONS: MissionRecord[] = (missionsJson as { records: MissionRecord[] }).records || [];
const MISSIONS_REVIEWED_ON: string =
  (missionsJson as { reviewed_on?: string }).reviewed_on || '2026-11-09';
const SOURCES_LIST: SourceRecord[] = (sourcesJson as { sources: SourceRecord[] }).sources || [];
const ENCOUNTERS_CATALOG: CatalogEncounterRecord[] =
  (encountersJson as { encounters: CatalogEncounterRecord[] }).encounters || [];
const NARRATIVE = narrativeJson as unknown as NarrativeBundle;

export function App() {
  const [routePath, setRoutePath] = useState<RoutePath>(() =>
    normalizeRoutePath(window.location.pathname)
  );
  const [crtActive, setCrtActive] = useState(false);
  const [audioMuted, setAudioMuted] = useState(false);
  const [utcTime, setUtcTime] = useState('');

  const [archiveSubView, setArchiveSubView] = useState<ArchiveSubView>(() =>
    getArchiveSubViewFromUrl(window.location.search)
  );
  const [sourcesSubView, setSourcesSubView] = useState<SourcesSubView>(() =>
    getSourcesSubViewFromUrl(window.location.search)
  );
  const [selectedMission, setSelectedMission] = useState<MissionRecord | null>(null);
  const [saveMessage, setSaveMessage] = useState('');

  const [selectedEncounterId, setSelectedEncounterId] = useState<string>(() => {
    const q = getQueryEncounterId();
    return q && NARRATIVE.encounters.some((e) => e.id === q) ? q : 'gentle-touch';
  });
  const [gameMode, setGameMode] = useState<GameMode>(() =>
    getQueryEncounterId() ? 'console' : 'map'
  );
  const [activeSector, setActiveSector] = useState<SectorId>(() => {
    const q = getQueryEncounterId();
    const enc = NARRATIVE.encounters.find((e) => e.id === q);
    if (enc && (enc.chapter === 'moon' || enc.chapter === 'mars' || enc.chapter === 'elsewhere')) {
      return enc.chapter;
    }
    return 'moon';
  });

  const [callSign, setCallSign] = useState<string>(() => {
    try {
      return localStorage.getItem(CALLSIGN_STORAGE_KEY) || 'UNIT-7';
    } catch {
      return 'UNIT-7';
    }
  });

  const [unlockedBadges, setUnlockedBadges] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(BADGE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // Ignore storage read failures
    }
    return [];
  });

  const sourcesMap = useMemo(() => {
    const map = new Map<string, SourceRecord>();
    for (const s of SOURCES_LIST) map.set(s.id, s);
    return map;
  }, []);

  const encounterByMissionId = useMemo(() => {
    const map = new Map<string, NarrativeBundle['encounters'][number]>();
    for (const enc of NARRATIVE.encounters) map.set(enc.mission_id, enc);
    return map;
  }, []);

  const datasetEncounterMap = useMemo(() => {
    const map = new Map<string, CatalogEncounterRecord>();
    for (const enc of ENCOUNTERS_CATALOG) map.set(enc.id, enc);
    return map;
  }, []);

  const selectedEncounter = useMemo(
    () =>
      NARRATIVE.encounters.find((e) => e.id === selectedEncounterId) ?? NARRATIVE.encounters[0],
    [selectedEncounterId]
  );

  const selectedDatasetEncounter = datasetEncounterMap.get(selectedEncounter.id);

  useEffect(() => {
    const onPopState = () => {
      const nextRoute = normalizeRoutePath(window.location.pathname);
      setRoutePath(nextRoute);
      setSelectedMission(null);
      if (nextRoute === '/archive') {
        setArchiveSubView(getArchiveSubViewFromUrl(window.location.search));
      } else if (nextRoute === '/sources') {
        setSourcesSubView(getSourcesSubViewFromUrl(window.location.search));
      } else if (nextRoute === '/game') {
        const q = getQueryEncounterId();
        const found = q ? NARRATIVE.encounters.find((e) => e.id === q) : undefined;
        if (found) {
          setSelectedEncounterId(found.id);
          setActiveSector(found.chapter as SectorId);
          setGameMode('console');
        } else {
          setGameMode('map');
        }
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify(unlockedBadges));
    } catch {
      // Ignore storage write failures
    }
  }, [unlockedBadges]);

  useEffect(() => {
    try {
      localStorage.setItem(CALLSIGN_STORAGE_KEY, callSign);
    } catch {
      // Ignore storage write failures
    }
  }, [callSign]);

  useEffect(() => {
    const updateTime = () => setUtcTime(new Date().toUTCString().replace('GMT', 'UTC'));
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navigateTo = useCallback(
    (
      target: RoutePath,
      options?: {
        encounterId?: string;
        mode?: GameMode;
        sector?: SectorId;
        archiveView?: ArchiveSubView;
        sourcesView?: SourcesSubView;
      }
    ) => {
      telemetryAudio.playChirp(target === '/game' ? 980 : 820, 0.04);
      let url = target === '/' ? '/' : `${target}/`;
      if (target === '/game' && options?.encounterId) {
        url = `/game/?encounter=${encodeURIComponent(options.encounterId)}`;
      } else if (target === '/archive' && options?.archiveView && options.archiveView !== 'missions') {
        url = `/archive/?view=${encodeURIComponent(options.archiveView)}`;
      } else if (target === '/sources' && options?.sourcesView && options.sourcesView !== 'registry') {
        url = `/sources/?view=${encodeURIComponent(options.sourcesView)}`;
      }

      if (window.location.pathname + window.location.search !== url) {
        window.history.pushState({}, '', url);
      }
      setRoutePath(target);

      if (target === '/archive') {
        setArchiveSubView(options?.archiveView ?? 'missions');
      } else if (target === '/sources') {
        setSourcesSubView(options?.sourcesView ?? 'registry');
      } else if (target === '/game') {
        if (options?.encounterId) {
          const found = NARRATIVE.encounters.find((e) => e.id === options.encounterId);
          if (found) {
            setSelectedEncounterId(found.id);
            setActiveSector(found.chapter as SectorId);
          }
        } else if (options?.sector) {
          setActiveSector(options.sector);
          const first = NARRATIVE.encounters.find((e) => e.chapter === options.sector);
          if (first) setSelectedEncounterId(first.id);
        }
        setGameMode(options?.mode ?? (options?.encounterId ? 'console' : 'map'));
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    []
  );

  const handleEncounterComplete = useCallback((badgeId: string) => {
    setUnlockedBadges((prev) => (prev.includes(badgeId) ? prev : [...prev, badgeId]));
  }, []);

  const isEncounterCompleted = useCallback(
    (encounterId: string): boolean => {
      if (encounterId === 'gentle-touch') {
        return (
          unlockedBadges.includes('surveyor-1-touchdown') ||
          unlockedBadges.includes('gentle-touch')
        );
      }
      return unlockedBadges.includes(encounterId);
    },
    [unlockedBadges]
  );

  const completedCount = NARRATIVE.encounters.filter((e) => isEncounterCompleted(e.id)).length;

  const chapterCompletedCounts = useMemo(() => {
    const countFor = (ch: SectorId) =>
      NARRATIVE.encounters.filter((e) => e.chapter === ch && isEncounterCompleted(e.id)).length;
    return {
      moon: countFor('moon'),
      mars: countFor('mars'),
      elsewhere: countFor('elsewhere'),
    };
  }, [isEncounterCompleted]);

  const handleLaunchFromMap = useCallback((encounterId: string) => {
    const enc = NARRATIVE.encounters.find((e) => e.id === encounterId);
    if (enc) {
      setSelectedEncounterId(enc.id);
      setActiveSector(enc.chapter as SectorId);
      const nextUrl = `/game/?encounter=${encodeURIComponent(enc.id)}`;
      if (window.location.pathname + window.location.search !== nextUrl) {
        window.history.pushState({}, '', nextUrl);
      }
    }
    setGameMode('console');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const handleExportSave = () => {
    const payload: SaveStatePayload = {
      schema_version: '1.0.0',
      call_sign: callSign.trim() || 'UNIT-7',
      unlocked_badges: unlockedBadges,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `echoes-save-${callSign.replace(/[^a-z0-9_-]/gi, '_') || 'archive'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    telemetryAudio.playSignalLock();
    setSaveMessage('Exported local archive save JSON.');
  };

  const handleImportSave = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setSaveMessage('Import rejected: file exceeds 64 KB cap.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        if (
          !raw ||
          typeof raw !== 'object' ||
          raw.schema_version !== '1.0.0' ||
          !Array.isArray(raw.unlocked_badges) ||
          !raw.unlocked_badges.every((x: unknown) => typeof x === 'string')
        ) {
          setSaveMessage('Import rejected: invalid schema.');
          return;
        }
        const safeCallSign =
          typeof raw.call_sign === 'string' ? raw.call_sign.slice(0, 24) : callSign;
        setCallSign(safeCallSign);
        setUnlockedBadges(Array.from(new Set(raw.unlocked_badges)));
        telemetryAudio.playSignalLock();
        setSaveMessage(`Imported ${raw.unlocked_badges.length} badge records for ${safeCallSign}.`);
      } catch {
        setSaveMessage('Import failed: malformed JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetProgress = () => {
    telemetryAudio.playChirp(520, 0.06);
    setUnlockedBadges([]);
    setSaveMessage('Signal archive progress reset to 0/9.');
  };

  const handleToggleAudio = () => setAudioMuted(telemetryAudio.toggleMute());
  const handleToggleCrt = () => {
    telemetryAudio.playChirp(620, 0.03);
    setCrtActive((v) => !v);
  };

  return (
    <div className={`app-root ${crtActive ? 'crt-overlay' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* ROUTE 1: / -> Clean Full-Viewport Still Out There Title Screen */}
      {routePath === '/' && (
        <HomePage
          totalEncounters={NARRATIVE.encounters.length}
          completedCount={completedCount}
          chapterCompletedCounts={chapterCompletedCounts}
          missionsCount={MISSIONS.length}
          callSign={callSign}
          onCallSignChange={setCallSign}
          audioMuted={audioMuted}
          onToggleAudio={handleToggleAudio}
          crtActive={crtActive}
          onToggleCrt={handleToggleCrt}
          onNavigate={(target, opts) => navigateTo(target, opts)}
        />
      )}

      {/* ROUTES 2, 3, 4 (/archive, /sources, /game): Separate Subdirectory Webpages */}
      {routePath !== '/' && (
        <>
          <StarfieldCanvas />

          <header className="telemetry-bar">
            <div className="telemetry-signal">
              <span className="signal-dot" aria-hidden="true" />
              <span>
                DSN-GOLDSTONE // ROUTE: <code>{routePath}</code> // ARCHIVE: OFFLINE-VERIFIED
              </span>
            </div>

            <div className="mono">{utcTime || 'SYNCHRONIZING UTC...'}</div>

            <div className="telemetry-controls">
              <button type="button" className="crt-toggle-btn" onClick={handleToggleAudio}>
                AUDIO: {audioMuted ? 'MUTED' : 'ON'}
              </button>
              <button
                type="button"
                className={`crt-toggle-btn ${crtActive ? 'active' : ''}`}
                onClick={handleToggleCrt}
              >
                CRT: {crtActive ? 'ON' : 'OFF'}
              </button>
            </div>
          </header>

          <div className="app-container">
            {routePath !== '/game' && (
              <nav className="top-nav" aria-label="Primary navigation">
                <div className="nav-links">
                  <a
                    href="/"
                    className="btn-secondary btn-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo('/');
                    }}
                  >
                    ← MAIN (/)
                  </a>

                  <SourcesArchiveDropdown
                    routePath={routePath}
                    archiveSubView={archiveSubView}
                    sourcesSubView={sourcesSubView}
                    onSelectArchive={(view) => navigateTo('/archive', { archiveView: view })}
                    onSelectSources={(view) => navigateTo('/sources', { sourcesView: view })}
                  />

                  <a
                    href="/archive/"
                    className={`btn-secondary btn-sm ${routePath === '/archive' ? 'active' : ''}`}
                    aria-current={routePath === '/archive' ? 'page' : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo('/archive', { archiveView: 'missions' });
                    }}
                  >
                    MISSION ARCHIVES (/archive)
                  </a>

                  <a
                    href="/sources/"
                    className={`btn-secondary btn-sm ${routePath === '/sources' ? 'active' : ''}`}
                    aria-current={routePath === '/sources' ? 'page' : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo('/sources', { sourcesView: 'registry' });
                    }}
                  >
                    NASA SOURCES (/sources)
                  </a>

                  <a
                    href="/game/"
                    className="btn-observatory btn-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo('/game', { mode: 'map' });
                    }}
                  >
                    ▶ START GAME
                  </a>
                </div>

                <div className="nav-progress" title="Reconstructed mission encounters">
                  <span className="label">
                    {callSign} · Signals: {completedCount}/{NARRATIVE.encounters.length}
                  </span>
                  <div
                    className="gauge"
                    aria-label={`${completedCount} of ${NARRATIVE.encounters.length} signals reconstructed`}
                  >
                    {NARRATIVE.encounters.map((enc) => (
                      <i key={enc.id} className={isEncounterCompleted(enc.id) ? 'on' : ''} />
                    ))}
                  </div>
                </div>
              </nav>
            )}

            {routePath === '/archive' && (
              <ArchivePage
                missions={MISSIONS}
                missionsReviewedOn={MISSIONS_REVIEWED_ON}
                encountersCatalog={ENCOUNTERS_CATALOG}
                sourcesMap={sourcesMap}
                encounterByMissionId={encounterByMissionId}
                archiveSubView={archiveSubView}
                chapterCompletedCounts={chapterCompletedCounts}
                isEncounterCompleted={isEncounterCompleted}
                onSelectMission={(m) => setSelectedMission(m)}
                onNavigate={(target, opts) => navigateTo(target, opts)}
              />
            )}

            {routePath === '/sources' && (
              <SourcesPage
                sourcesList={SOURCES_LIST}
                missions={MISSIONS}
                missionsReviewedOn={MISSIONS_REVIEWED_ON}
                narrative={NARRATIVE}
                sourcesSubView={sourcesSubView}
                completedCount={completedCount}
                totalEncounters={NARRATIVE.encounters.length}
                saveMessage={saveMessage}
                onExportSave={handleExportSave}
                onImportSave={handleImportSave}
                onResetProgress={handleResetProgress}
                onSelectMission={(m) => setSelectedMission(m)}
                onNavigate={(target, opts) => navigateTo(target, opts)}
              />
            )}

            {routePath === '/game' && (
              <GamePage
                callSign={callSign}
                narrative={NARRATIVE}
                missions={MISSIONS}
                sourcesMap={sourcesMap}
                selectedEncounter={selectedEncounter}
                selectedDatasetEncounter={selectedDatasetEncounter}
                unlockedBadges={unlockedBadges}
                completedCount={completedCount}
                chapterCompletedCounts={chapterCompletedCounts}
                activeSector={activeSector}
                gameMode={gameMode}
                isEncounterCompleted={isEncounterCompleted}
                onSetGameMode={(nextMode) => {
                  setGameMode(nextMode);
                  const nextUrl =
                    nextMode === 'console'
                      ? `/game/?encounter=${encodeURIComponent(selectedEncounter.id)}`
                      : '/game/';
                  if (window.location.pathname + window.location.search !== nextUrl) {
                    window.history.replaceState({}, '', nextUrl);
                  }
                }}
                onSelectSector={(ch) => {
                  setActiveSector(ch);
                  const first = NARRATIVE.encounters.find((e) => e.chapter === ch);
                  if (first && selectedEncounter.chapter !== ch) {
                    setSelectedEncounterId(first.id);
                    if (gameMode === 'console') {
                      window.history.replaceState({}, '', `/game/?encounter=${encodeURIComponent(first.id)}`);
                    }
                  }
                }}
                onSelectEncounter={(enc) => {
                  setSelectedEncounterId(enc.id);
                  setActiveSector(enc.chapter as SectorId);
                  if (gameMode === 'console') {
                    window.history.replaceState({}, '', `/game/?encounter=${encodeURIComponent(enc.id)}`);
                  }
                }}
                onLaunchEncounter={handleLaunchFromMap}
                onCompleteEncounter={handleEncounterComplete}
                onInspectMission={(m) => setSelectedMission(m)}
                onNavigateHome={() => navigateTo('/')}
              />
            )}

            <footer className="observatory-footer">
              <div>
                Echoes of Exploration: The NASA Signal Archive · Independent educational archive
                using NASA, JPL, NSSDCA, ILRS, and PDS public documentation. Not endorsed or
                sponsored by NASA.
              </div>
              <div>
                Procedural pixel art &amp; SI-assisted presentation; narrative accelerated with
                Super Intelligence (SI) assistance; verified telemetry cited per mission.
              </div>
            </footer>
          </div>
        </>
      )}

      <SignalInspectorModal
        mission={selectedMission}
        encounter={selectedMission ? encounterByMissionId.get(selectedMission.id) ?? null : null}
        sourcesMap={sourcesMap}
        reviewedOn={MISSIONS_REVIEWED_ON}
        echoFrameText={NARRATIVE.ui_copy.echo_frame}
        needsReviewText={NARRATIVE.ui_copy.needs_review_badge}
        sectionLabels={NARRATIVE.ui_copy.section_labels}
        onClose={() => setSelectedMission(null)}
        onTuneEncounter={
          routePath === '/game'
            ? (encId) => {
                setSelectedMission(null);
                navigateTo('/game', { encounterId: encId, mode: 'console' });
              }
            : undefined
        }
      />
    </div>
  );
}

export default App;
