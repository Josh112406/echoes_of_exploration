import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import './App.css';
import { telemetryAudio } from './audio/telemetryAudio';
import { PoliciesView } from './components/PoliciesView';
import { SettingsView } from './components/SettingsView';
import {
  SignalInspectorModal,
  type MissionRecord,
} from './components/SignalInspectorModal';
import { SolarMapView } from './components/SolarMapView';
import { StarfieldCanvas } from './components/StarfieldCanvas';
import campaignData from './data/campaign.json';
import { MISSION_DETAILS, STATUS_LABELS } from './data/missionDetails';
import missionsData from './data/missions.json';
import { EncounterView } from './game/EncounterView';
import {
  loadSave,
  resetAllProgress,
  saveState,
  type AccessibilitySettings,
  type SaveRecord,
} from './persistence/saveManager';

type RouteId =
  | 'title'
  | 'hub'
  | 'map'
  | 'game'
  | 'archive'
  | 'patches'
  | 'settings'
  | 'about';

const PATH_TO_ROUTE: Record<string, RouteId> = {
  '/': 'hub',
  '/game': 'game',
  '/archive': 'archive',
  '/about': 'about',
  '/map': 'map',
  '/patches': 'patches',
  '/settings': 'settings',
};

const ROUTE_TO_PATH: Record<RouteId, string> = {
  title: '/',
  hub: '/',
  map: '/map',
  game: '/game',
  archive: '/archive',
  patches: '/patches',
  settings: '/settings',
  about: '/about',
};

function matchesDecadeFilter(decade: string, filter: string): boolean {
  if (filter === 'all') return true;
  if (filter === '1960s') return decade === '1960s';
  if (filter === '1970s') return decade === '1970s';
  if (filter === '1980s-90s') return decade === '1980s' || decade === '1990s';
  if (filter === '2000s') return decade === '2000s';
  if (filter === '2010s-2020s') return decade === '2010s' || decade === '2020s';
  return true;
}

export function App() {
  const [{ state: initialSave, corruptDetected }] = useState(() => loadSave());
  const [save, setSave] = useState<SaveRecord>(initialSave);
  const [corruptBannerOpen, setCorruptBannerOpen] = useState<boolean>(corruptDetected);

  const [route, setRoute] = useState<RouteId>(() => {
    const pathname =
      typeof window !== 'undefined' ? window.location.pathname : '/';
    if (pathname === '/game' || pathname === '/archive' || pathname === '/about') {
      return PATH_TO_ROUTE[pathname];
    }
    return initialSave.onboardingCompleted ? 'hub' : 'title';
  });

  const [callSignInput, setCallSignInput] = useState(initialSave.callSign);

  const [activeEncounterMissionId, setActiveEncounterMissionId] = useState<string>(
    () => {
      const savedEnc = campaignData.encounters.find(
        (e) => e.id === initialSave.lastEncounterId
      );
      return savedEnc?.mission_id ?? campaignData.encounters[0].mission_id;
    }
  );
  const [activeEncounterId, setActiveEncounterId] = useState<string>(
    () => initialSave.lastEncounterId ?? campaignData.encounters[0].id
  );

  // Archive filters
  const [searchQuery, setSearchQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState('all');
  const [decadeFilter, setDecadeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [hardwareFilter, setHardwareFilter] = useState('all');
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [bookmarkedOnly, setBookmarkedOnly] = useState(false);

  const [inspectedMission, setInspectedMission] = useState<MissionRecord | null>(null);
  const [transcriptCaption, setTranscriptCaption] = useState<string | null>(null);

  // Persist save changes & sync audio + root HTML accessibility attributes
  useEffect(() => {
    saveState(save);

    const html = document.documentElement;
    html.setAttribute('data-text-size', save.settings.textSize);
    html.setAttribute('data-contrast', save.settings.highContrast ? 'high' : 'normal');
    html.setAttribute('data-reduced-motion', String(save.settings.reducedMotion));

    telemetryAudio.configure({
      masterMute: save.settings.masterMute,
      sfxVolume: save.settings.sfxVolume,
      musicVolume: save.settings.musicVolume,
      showAudioTranscripts: save.settings.showAudioTranscripts,
    });
  }, [save]);

  // Subscribe to visual audio transcripts
  useEffect(() => {
    let timer = 0;
    const unsub = telemetryAudio.subscribeTranscript((caption) => {
      setTranscriptCaption(caption);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setTranscriptCaption(null), 3200);
    });
    return () => {
      window.clearTimeout(timer);
      unsub();
    };
  }, []);

  // Browser back/forward handling
  useEffect(() => {
    const onPopState = () => {
      const path = window.location.pathname;
      const mapped = PATH_TO_ROUTE[path];
      if (mapped) {
        setRoute(mapped === 'hub' && !save.onboardingCompleted ? 'title' : mapped);
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [save.onboardingCompleted]);

  const navigate = useCallback((nextRoute: RouteId) => {
    telemetryAudio.playChirp(640, 0.04);
    setRoute(nextRoute);
    setSave((prev) => ({ ...prev, lastRoute: nextRoute }));
    if (typeof window !== 'undefined') {
      const targetPath = ROUTE_TO_PATH[nextRoute] ?? '/';
      if (window.location.pathname !== targetPath) {
        window.history.pushState({}, '', targetPath);
      }
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, []);

  const updateSettings = useCallback((patch: Partial<AccessibilitySettings>) => {
    setSave((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
    }));
  }, []);

  const launchEncounter = useCallback(
    (missionId: string, encounterId: string) => {
      telemetryAudio.playSignalLock();
      setActiveEncounterMissionId(missionId);
      setActiveEncounterId(encounterId);
      setSave((prev) => ({
        ...prev,
        onboardingCompleted: true,
        lastEncounterId: encounterId,
      }));
      setInspectedMission(null);
      navigate('game');
    },
    [navigate]
  );

  const handleCompleteEncounter = useCallback((badgeId: string) => {
    setSave((prev) => {
      const encEntry = campaignData.encounters.find((e) => e.patch_id === badgeId);
      const nextCompleted = encEntry
        ? Array.from(new Set([...prev.completedEncounters, encEntry.id]))
        : prev.completedEncounters;

      const patchesSet = new Set([...prev.unlockedPatches, badgeId]);
      if (nextCompleted.length >= campaignData.encounters.length) {
        patchesSet.add(campaignData.ending.master_patch_id);
      }

      return {
        ...prev,
        completedEncounters: nextCompleted,
        unlockedPatches: Array.from(patchesSet),
      };
    });
  }, []);

  const toggleBookmark = useCallback((missionId: string) => {
    setSave((prev) => {
      const exists = prev.bookmarkedMissions.includes(missionId);
      const next = exists
        ? prev.bookmarkedMissions.filter((id) => id !== missionId)
        : [...prev.bookmarkedMissions, missionId];
      return { ...prev, bookmarkedMissions: next };
    });
  }, []);

  const handleOnboardingSubmit = (e: FormEvent) => {
    e.preventDefault();
    telemetryAudio.playSignalLock();
    telemetryAudio.setAmbientEnabled(save.settings.musicVolume > 0 && !save.settings.masterMute);
    const sanitized = callSignInput.trim().slice(0, 24) || 'ARCHIVIST-01';
    setSave((prev) => ({
      ...prev,
      callSign: sanitized,
      onboardingCompleted: true,
    }));
    navigate('hub');
  };

  // Recommended next unfinished encounter
  const nextPendingEncounter = useMemo(() => {
    return (
      campaignData.encounters.find(
        (e) => !save.completedEncounters.includes(e.id)
      ) ?? campaignData.encounters[0]
    );
  }, [save.completedEncounters]);

  const allCompleted = save.completedEncounters.length >= campaignData.encounters.length;

  // Dynamic lists for filters
  const hardwareOptions = useMemo(() => {
    const allTypes = new Set<string>();
    for (const m of missionsData.records) {
      for (const h of m.hardware_types) allTypes.add(h);
    }
    return Array.from(allTypes).sort();
  }, []);

  const filteredMissions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return missionsData.records.filter((m) => {
      const detail = MISSION_DETAILS[m.id];
      if (chapterFilter !== 'all' && m.chapter !== chapterFilter) return false;
      if (!matchesDecadeFilter(detail?.decade ?? '', decadeFilter)) return false;
      if (statusFilter !== 'all' && m.status !== statusFilter) return false;
      if (hardwareFilter !== 'all' && !m.hardware_types.includes(hardwareFilter)) {
        return false;
      }
      if (featuredOnly && !m.featured) return false;
      if (bookmarkedOnly && !save.bookmarkedMissions.includes(m.id)) return false;

      if (q) {
        const haystack = [
          m.name,
          m.destination,
          m.objective,
          m.science_summary,
          m.hardware_types.join(' '),
          m.agencies.join(' '),
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    searchQuery,
    chapterFilter,
    decadeFilter,
    statusFilter,
    hardwareFilter,
    featuredOnly,
    bookmarkedOnly,
    save.bookmarkedMissions,
  ]);

  return (
    <div
      className={`observatory-root ${save.settings.crtScanlines ? 'crt-overlay' : ''}`}
    >
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      <StarfieldCanvas
        reducedMotion={save.settings.reducedMotion}
        quality={save.settings.quality}
      />

      <div className="app-frame">
        {/* Global Sticky Observatory Navigation */}
        <header className="topbar panel notch-corner">
          <div className="brand-group">
            <img
              src="/assets/generated/sprites/robot-idle.png"
              alt="Observatory Archivist emblem illustration"
              className="brand-mark pixel-art"
            />
            <div>
              <div className="brand-title">ECHOES OF EXPLORATION</div>
              <div className="brand-subtitle">
                THE NASA SIGNAL ARCHIVE · {save.callSign}
              </div>
            </div>
          </div>

          <nav className="nav-pills" aria-label="Primary observatory navigation">
            <button
              type="button"
              className={`nav-btn ${route === 'hub' || route === 'title' ? 'active' : ''}`}
              onClick={() => navigate(save.onboardingCompleted ? 'hub' : 'title')}
            >
              OBSERVATORY
            </button>
            <button
              type="button"
              className={`nav-btn ${route === 'map' ? 'active' : ''}`}
              onClick={() => navigate('map')}
            >
              FLIGHT MAP
            </button>
            <button
              type="button"
              className={`nav-btn ${route === 'game' ? 'active' : ''}`}
              onClick={() => navigate('game')}
            >
              PLAY SIGNAL ({save.completedEncounters.length}/9)
            </button>
            <button
              type="button"
              className={`nav-btn ${route === 'archive' ? 'active' : ''}`}
              onClick={() => navigate('archive')}
            >
              ARCHIVE (31)
            </button>
            <button
              type="button"
              className={`nav-btn ${route === 'patches' ? 'active' : ''}`}
              onClick={() => navigate('patches')}
            >
              PATCHES ({save.unlockedPatches.length})
            </button>
            <button
              type="button"
              className={`nav-btn ${route === 'settings' ? 'active' : ''}`}
              onClick={() => navigate('settings')}
            >
              SETTINGS
            </button>
            <button
              type="button"
              className={`nav-btn ${route === 'about' ? 'active' : ''}`}
              onClick={() => navigate('about')}
            >
              SOURCES
            </button>
          </nav>

          <div className="topbar-meta">
            <button
              type="button"
              className={`btn ${save.settings.masterMute ? 'btn-rust' : 'btn-cyan'}`}
              aria-label={save.settings.masterMute ? 'Unmute audio' : 'Mute audio'}
              onClick={() => updateSettings({ masterMute: !save.settings.masterMute })}
            >
              {save.settings.masterMute ? 'AUDIO OFF' : 'AUDIO ON'}
            </button>
          </div>
        </header>

        {/* Corrupt Save Backup Notice */}
        {corruptBannerOpen && (
          <div className="feedback-banner tone-amber" role="alert" style={{ marginBottom: 16 }}>
            <strong>Save Recovery Notice:</strong> Existing save data could not be validated and
            was backed up safely to <code>echoes_corrupt_backup</code>. A fresh archive profile was
            loaded.
            <button
              type="button"
              className="btn"
              style={{ marginLeft: 12 }}
              onClick={() => setCorruptBannerOpen(false)}
            >
              DISMISS
            </button>
          </div>
        )}

        <main id="main-content" tabIndex={-1}>
          {/* VIEW 1: TITLE & CALL-SIGN ONBOARDING */}
          {route === 'title' && (
            <section className="panel notch-corner title-hero" aria-label="Observatory arrival">
              <div>
                <div className="hero-badge-row">
                  <span className="pill-tag pill-cyan">INTERACTIVE SPACE SCIENCE ARCHIVE</span>
                  <span className="pill-tag pill-amber">31 MISSIONS · 9 PLAYABLE SIGNALS</span>
                </div>
                <h1 className="hero-title">{campaignData.opening.title}</h1>
                <p className="record-paragraph">{campaignData.opening.intro_copy}</p>

                <div className="curator-rules-box">
                  <h3>THE TWO VOICES OF THIS ARCHIVE</h3>
                  <ul>
                    {campaignData.opening.curator_rules.map((rule) => (
                      <li key={rule}>{rule}</li>
                    ))}
                  </ul>
                </div>

                <form className="callsign-form" onSubmit={handleOnboardingSubmit}>
                  <label htmlFor="callsign-input" className="sr-only">
                    Archivist Call Sign
                  </label>
                  <input
                    id="callsign-input"
                    type="text"
                    maxLength={24}
                    value={callSignInput}
                    onChange={(e) => setCallSignInput(e.target.value)}
                    placeholder="ARCHIVIST-01"
                    className="text-input"
                  />
                  <button type="submit" className="btn btn-primary">
                    ENTER OBSERVATORY →
                  </button>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setSave((prev) => ({ ...prev, onboardingCompleted: true }));
                      navigate('archive');
                    }}
                  >
                    BROWSE 31-MISSION ARCHIVE
                  </button>
                </form>
              </div>

              <div className="hero-showcase">
                <img
                  src="/assets/generated/scenes/scene-moon.png"
                  alt="16-bit lunar observatory vista illustration"
                  className="hero-scene-art pixel-art"
                />
                <div className="preview-caption" style={{ width: '100%' }}>
                  <span>SI-GENERATED ILLUSTRATION · CC0</span>
                  <img
                    src="/assets/generated/sprites/robot-talk.png"
                    alt="Observatory companion robot"
                    className="mini-sprite pixel-art"
                  />
                </div>
              </div>
            </section>
          )}

          {/* VIEW 2: OBSERVATORY HUB & ENDING */}
          {route === 'hub' && (
            <section className="section-stack" aria-label="Observatory Hub">
              <div className="panel notch-corner section-header-panel">
                <div>
                  <span className="pill-tag pill-cyan">
                    CALL SIGN: {save.callSign} · ARCHIVE ONLINE
                  </span>
                  <h1>Observatory Signal Console</h1>
                  <p className="muted-caption">
                    Notice the two voices: <strong style={{ color: 'var(--cyan)' }}>Cyan</strong>{' '}
                    frames dramatized Memory Echoes;{' '}
                    <strong style={{ color: 'var(--amber)' }}>Amber</strong> presents verified NASA
                    instruments, records, and primary links.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    launchEncounter(nextPendingEncounter.mission_id, nextPendingEncounter.id)
                  }
                >
                  {allCompleted
                    ? 'REPLAY FEATURED ECHOES →'
                    : `RESUME NEXT SIGNAL (#${nextPendingEncounter.order}) →`}
                </button>
              </div>

              {allCompleted && (
                <article className="panel notch-corner ending-master-panel">
                  <div className="ending-flex">
                    <img
                      src="/assets/generated/patches/patch-signal-archivist.png"
                      alt={campaignData.ending.master_patch_name}
                      className="patch-large pixel-art"
                    />
                    <div style={{ flex: 1, minWidth: 240 }}>
                      <span className="pill-tag pill-amber">
                        ALL 9 SIGNALS RECONSTRUCTED · MASTER PATCH AWARDED
                      </span>
                      <h2>{campaignData.ending.title}</h2>
                      <p className="record-paragraph">{campaignData.ending.summary}</p>
                      <p className="echo-quote">“{campaignData.ending.closing_line}”</p>
                    </div>
                  </div>
                </article>
              )}

              <div className="hub-stats-grid">
                <div className="panel notch-corner stat-card">
                  <span className="kv-label">RECONSTRUCTED ECHOES</span>
                  <div className="stat-value">{save.completedEncounters.length} / 9</div>
                  <span className="muted-caption">Playable launch encounters across 3 chapters</span>
                </div>
                <div className="panel notch-corner stat-card">
                  <span className="kv-label">MISSION PATCHES</span>
                  <div className="stat-value">{save.unlockedPatches.length} / 10</div>
                  <span className="muted-caption">9 encounter patches + 1 Master Archivist crest</span>
                </div>
                <div className="panel notch-corner stat-card">
                  <span className="kv-label">CATALOGED MISSIONS</span>
                  <div className="stat-value">{missionsData.records.length}</div>
                  <span className="muted-caption">10 Moon · 10 Mars · 11 Elsewhere records</span>
                </div>
                <div className="panel notch-corner stat-card">
                  <span className="kv-label">BOOKMARKS</span>
                  <div className="stat-value">{save.bookmarkedMissions.length}</div>
                  <span className="muted-caption">Saved locally in your browser profile</span>
                </div>
              </div>

              <div className="hub-actions-grid">
                <article className="panel notch-corner settings-card">
                  <span className="pill-tag pill-cyan">START HERE · INTERACTIVE TELEMETRY</span>
                  <h3>Expedition Flight Map</h3>
                  <p className="record-paragraph">
                    Inspect Moon, Mars, and Deep Space destinations, view chapter Discovery
                    Bridges, or launch any of the 9 encounters in interactive or accessible choice
                    mode.
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => navigate('map')}
                  >
                    OPEN FLIGHT MAP →
                  </button>
                </article>

                <article className="panel notch-corner settings-card">
                  <span className="pill-tag pill-amber">CURATED CATALOG · 4-LAYER DOSSIERS</span>
                  <h3>31-Mission Museum Archive</h3>
                  <p className="record-paragraph">
                    Filter missions by destination, decade, hardware, and accurate lifecycle
                    status—including active relays, completed landers, and silent probes.
                  </p>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => navigate('archive')}
                  >
                    EXPLORE ALL 31 MISSIONS →
                  </button>
                </article>
              </div>
            </section>
          )}

          {/* VIEW 3: SOLAR SYSTEM & CHAPTER MAP */}
          {route === 'map' && (
            <SolarMapView
              completedEncounters={save.completedEncounters}
              onLaunchEncounter={launchEncounter}
              onInspectMission={(mId) => {
                const found = missionsData.records.find((m) => m.id === mId);
                if (found) setInspectedMission(found);
              }}
            />
          )}

          {/* VIEW 4: PLAYABLE 9-ENCOUNTER ENGINE */}
          {route === 'game' && (
            <EncounterView
              key={activeEncounterId}
              missionId={activeEncounterMissionId}
              encounterId={activeEncounterId}
              assistMode={save.settings.juniorGuidance}
              nonCanvasMode={save.settings.nonCanvasMode}
              reducedMotion={save.settings.reducedMotion}
              alreadyCompleted={save.completedEncounters.includes(activeEncounterId)}
              onComplete={handleCompleteEncounter}
              onExit={() => navigate('hub')}
              onLaunchNext={launchEncounter}
              onOpenArchive={(mId) => {
                navigate('archive');
                const found = missionsData.records.find((m) => m.id === mId);
                if (found) setInspectedMission(found);
              }}
            />
          )}

          {/* VIEW 5: 31-MISSION MUSEUM CATALOG */}
          {route === 'archive' && (
            <section className="section-stack" aria-label="31-Mission Museum Archive">
              <div className="panel notch-corner section-header-panel">
                <div>
                  <span className="pill-tag pill-amber">SIGNAL ARCHIVE CATALOG</span>
                  <h2>All 31 Historical NASA Missions</h2>
                  <p className="muted-caption">
                    Showing {filteredMissions.length} of {missionsData.records.length} records. Click
                    any card to open its 4-layer dossier and authoritative citations.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setSearchQuery('');
                    setChapterFilter('all');
                    setDecadeFilter('all');
                    setStatusFilter('all');
                    setHardwareFilter('all');
                    setFeaturedOnly(false);
                    setBookmarkedOnly(false);
                  }}
                >
                  CLEAR FILTERS
                </button>
              </div>

              <div className="panel notch-corner filters-panel">
                <div className="filter-field">
                  <label className="field-label" htmlFor="filter-search">
                    Search Keyword
                  </label>
                  <input
                    id="filter-search"
                    type="search"
                    className="text-input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Surveyor, laser, silica, Voyager..."
                  />
                </div>

                <div className="filter-field">
                  <label className="field-label" htmlFor="filter-chapter">
                    Destination Wing
                  </label>
                  <select
                    id="filter-chapter"
                    className="select-input"
                    value={chapterFilter}
                    onChange={(e) => setChapterFilter(e.target.value)}
                  >
                    <option value="all">All Wings (31)</option>
                    <option value="moon">Moon (10)</option>
                    <option value="mars">Mars (10)</option>
                    <option value="elsewhere">Elsewhere (11)</option>
                  </select>
                </div>

                <div className="filter-field">
                  <label className="field-label" htmlFor="filter-decade">
                    Launch Era
                  </label>
                  <select
                    id="filter-decade"
                    className="select-input"
                    value={decadeFilter}
                    onChange={(e) => setDecadeFilter(e.target.value)}
                  >
                    <option value="all">All Eras</option>
                    <option value="1960s">1960s</option>
                    <option value="1970s">1970s</option>
                    <option value="1980s-90s">1980s–1990s</option>
                    <option value="2000s">2000s</option>
                    <option value="2010s-2020s">2010s–2020s</option>
                  </select>
                </div>

                <div className="filter-field">
                  <label className="field-label" htmlFor="filter-status">
                    Lifecycle Status
                  </label>
                  <select
                    id="filter-status"
                    className="select-input"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    {Object.entries(STATUS_LABELS).map(([key, info]) => (
                      <option key={key} value={key}>
                        {info.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-field">
                  <label className="field-label" htmlFor="filter-hardware">
                    Hardware Class
                  </label>
                  <select
                    id="filter-hardware"
                    className="select-input"
                    value={hardwareFilter}
                    onChange={(e) => setHardwareFilter(e.target.value)}
                  >
                    <option value="all">All Hardware</option>
                    {hardwareOptions.map((hw) => (
                      <option key={hw} value={hw}>
                        {hw}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="filter-field" style={{ flexDirection: 'row', gap: 6 }}>
                  <button
                    type="button"
                    aria-pressed={featuredOnly}
                    className={`btn ${featuredOnly ? 'btn-cyan' : ''}`}
                    onClick={() => setFeaturedOnly((v) => !v)}
                  >
                    FEATURED 9
                  </button>
                  <button
                    type="button"
                    aria-pressed={bookmarkedOnly}
                    className={`btn ${bookmarkedOnly ? 'btn-amber' : ''}`}
                    onClick={() => setBookmarkedOnly((v) => !v)}
                  >
                    ★ SAVED
                  </button>
                </div>
              </div>

              <div className="mission-grid">
                {filteredMissions.map((mission) => {
                  const detail = MISSION_DETAILS[mission.id];
                  const statusInfo = STATUS_LABELS[mission.status] ?? {
                    label: mission.status,
                    tone: 'muted' as const,
                  };
                  const isSaved = save.bookmarkedMissions.includes(mission.id);

                  return (
                    <article key={mission.id} className="panel notch-corner mission-card">
                      <div className="mission-card-top">
                        <img
                          src={detail?.sprite ?? '/assets/generated/sprites/voyager.png'}
                          alt={`${mission.name} spacecraft illustration`}
                          className="mission-card-sprite pixel-art"
                        />
                        <div style={{ flex: 1 }}>
                          <div className="modal-badges">
                            <span className="pill-tag">{mission.chapter.toUpperCase()}</span>
                            <span className={`status-pill status-${statusInfo.tone}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                          <h3 className="mission-card-title">{mission.name}</h3>
                          <span className="muted-caption">
                            {mission.destination} · {mission.launch_date.slice(0, 4)}
                          </span>
                        </div>
                      </div>

                      <p className="muted-caption">{mission.objective}</p>

                      <div className="mission-card-actions">
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            telemetryAudio.playChirp(620, 0.04, `Opened dossier: ${mission.name}`);
                            setInspectedMission(mission);
                          }}
                        >
                          OPEN 4-LAYER DOSSIER
                        </button>
                        {mission.featured_encounter_id && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => {
                              const encId = mission.featured_encounter_id;
                              if (encId) launchEncounter(mission.id, encId);
                            }}
                          >
                            PLAY ECHO
                          </button>
                        )}
                        <button
                          type="button"
                          className={`btn ${isSaved ? 'btn-amber' : ''}`}
                          aria-label={isSaved ? `Unbookmark ${mission.name}` : `Bookmark ${mission.name}`}
                          onClick={() => toggleBookmark(mission.id)}
                        >
                          {isSaved ? '★' : '☆'}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}

          {/* VIEW 6: PATCHES & DISCOVERY BRIDGES */}
          {route === 'patches' && (
            <section className="section-stack" aria-label="Mission Patches and Discovery Bridges">
              <div className="panel notch-corner section-header-panel">
                <div>
                  <span className="pill-tag pill-amber">OBSERVATORY CRESTS & DISCOVERY BRIDGES</span>
                  <h2>Reconstructed Signal Patches ({save.unlockedPatches.length}/10)</h2>
                  <p className="muted-caption">
                    Each encounter awards an archival patch representing the scientific capability
                    unlocked across chapters.
                  </p>
                </div>
              </div>

              <div className="patches-grid">
                {campaignData.encounters.map((enc) => {
                  const unlocked = save.unlockedPatches.includes(enc.patch_id);
                  return (
                    <article
                      key={enc.patch_id}
                      className={`panel notch-corner patch-card ${unlocked ? '' : 'locked'}`}
                    >
                      <img
                        src={enc.patch_image}
                        alt={enc.patch_name}
                        className="patch-artwork pixel-art"
                      />
                      <span className="pill-tag">SIGNAL #{enc.order}</span>
                      <h3>{enc.patch_name}</h3>
                      <span className="muted-caption">
                        {unlocked ? '✓ UNLOCKED' : 'LOCKED — RECONSTRUCT ECHO'}
                      </span>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => launchEncounter(enc.mission_id, enc.id)}
                      >
                        {unlocked ? 'REPLAY' : 'LAUNCH'}
                      </button>
                    </article>
                  );
                })}

                <article
                  className={`panel notch-corner patch-card ${
                    save.unlockedPatches.includes(campaignData.ending.master_patch_id)
                      ? ''
                      : 'locked'
                  }`}
                >
                  <img
                    src="/assets/generated/patches/patch-signal-archivist.png"
                    alt={campaignData.ending.master_patch_name}
                    className="patch-artwork pixel-art"
                  />
                  <span className="pill-tag pill-amber">MASTER CREST</span>
                  <h3>{campaignData.ending.master_patch_name}</h3>
                  <span className="muted-caption">
                    {allCompleted
                      ? '✓ UNLOCKED (9/9 SIGNALS)'
                      : `${save.completedEncounters.length} / 9 COMPLETE`}
                  </span>
                </article>
              </div>

              <div className="chapters-stack">
                {campaignData.chapters.map((ch) => (
                  <article
                    key={ch.id}
                    className="panel notch-corner policy-card voice-record"
                  >
                    <span className="pill-tag pill-amber">
                      {ch.discovery_bridge.title.toUpperCase()}
                    </span>
                    <p>{ch.discovery_bridge.summary}</p>
                    <div className="bridge-chain">
                      {ch.discovery_bridge.chain.map((step, i) => (
                        <span key={step} className="bridge-pill">
                          {i > 0 ? '→ ' : ''}
                          {step}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {/* VIEW 7: SETTINGS */}
          {route === 'settings' && (
            <SettingsView
              saveStateData={save}
              onUpdateSettings={updateSettings}
              onUpdateCallSign={(callSign) => setSave((prev) => ({ ...prev, callSign }))}
              onReplaceSave={(next) => setSave(next)}
              onResetSave={() => {
                const clean = resetAllProgress();
                setSave(clean);
                setCallSignInput(clean.callSign);
                navigate('title');
              }}
            />
          )}

          {/* VIEW 8: POLICIES & SOURCES */}
          {route === 'about' && <PoliciesView />}
        </main>
      </div>

      {/* Global 4-Layer Mission Inspector Modal */}
      {inspectedMission && (
        <SignalInspectorModal
          key={inspectedMission.id}
          mission={inspectedMission}
          isBookmarked={save.bookmarkedMissions.includes(inspectedMission.id)}
          isEncounterCompleted={
            Boolean(inspectedMission.featured_encounter_id) &&
            save.completedEncounters.includes(inspectedMission.featured_encounter_id ?? '')
          }
          onToggleBookmark={toggleBookmark}
          onSelectMission={(m) => setInspectedMission(m)}
          onClose={() => setInspectedMission(null)}
          onLaunchEncounter={launchEncounter}
        />
      )}

      {/* Accessible Live Visual Audio Transcript Toast */}
      {save.settings.showAudioTranscripts && transcriptCaption && (
        <div className="transcript-toast" role="status" aria-live="polite">
          {transcriptCaption}
        </div>
      )}
    </div>
  );
}

export default App;
