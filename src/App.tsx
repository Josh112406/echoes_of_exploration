import { useState, useEffect } from 'react';
import './App.css';
import missionsJson from './data/missions.json';
import { StarfieldCanvas } from './components/StarfieldCanvas';
import { SignalInspectorModal, type MissionRecord } from './components/SignalInspectorModal';
import { SurveyorEncounterPreview } from './game/SurveyorEncounterPreview';
import { telemetryAudio } from './audio/telemetryAudio';

export function App() {
  const [crtActive, setCrtActive] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'observatory' | 'archive' | 'game' | 'about'>('observatory');
  const [filterChapter, setFilterChapter] = useState<'all' | 'moon' | 'mars' | 'featured'>('all');
  const [search, setSearch] = useState<string>('');
  const [utcTime, setUtcTime] = useState<string>('');
  const [selectedMission, setSelectedMission] = useState<MissionRecord | null>(null);
  const [awardedBadges, setAwardedBadges] = useState<string[]>([]);

  const missions: MissionRecord[] = (missionsJson as any).records || [];

  // Live UTC Clock
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(now.toUTCString().replace('GMT', 'UTC'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (tab: 'observatory' | 'archive' | 'game' | 'about') => {
    telemetryAudio.playChirp(880, 0.04);
    setActiveTab(tab);
  };

  const handleToggleMute = () => {
    const muted = telemetryAudio.toggleMute();
    setIsMuted(muted);
  };

  const handleOpenInspector = (mission: MissionRecord) => {
    telemetryAudio.playSignalLock();
    setSelectedMission(mission);
  };

  const handleEncounterComplete = (badgeId: string) => {
    telemetryAudio.playSignalLock();
    if (!awardedBadges.includes(badgeId)) {
      setAwardedBadges((b) => [...b, badgeId]);
    }
  };

  const filteredMissions = missions.filter((m) => {
    const matchesChapter =
      filterChapter === 'all'
        ? true
        : filterChapter === 'featured'
        ? m.featured
        : m.chapter === filterChapter;
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.story_hook.toLowerCase().includes(search.toLowerCase()) ||
      m.destination.toLowerCase().includes(search.toLowerCase());
    return matchesChapter && matchesSearch;
  });

  return (
    <div className={`app-root ${crtActive ? 'crt-overlay' : ''}`}>
      {/* 16-bit Parallax Starfield Canvas */}
      <StarfieldCanvas />

      {/* Top Telemetry Ticker */}
      <header className="telemetry-bar" style={{ position: 'relative', zIndex: 10 }}>
        <div className="telemetry-signal">
          <span className="signal-dot"></span>
          <span>DSN-GOLDSTONE // 8.4 GHz // STATUS: ONLINE</span>
        </div>
        <div style={{ fontFamily: 'var(--f-mono)' }}>TIME: {utcTime || 'SYNCHRONIZING...'}</div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            className="crt-toggle-btn"
            onClick={handleToggleMute}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? '🔇 AUDIO: OFF' : '🔊 AUDIO: ON'}
          </button>
          <button
            className={`crt-toggle-btn ${crtActive ? 'active' : ''}`}
            onClick={() => {
              telemetryAudio.playChirp(950, 0.03);
              setCrtActive(!crtActive);
            }}
          >
            CRT: {crtActive ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      <div className="app-container" style={{ position: 'relative', zIndex: 10 }}>
        {/* Navigation Bar */}
        <nav style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button
            className={activeTab === 'observatory' ? 'btn-observatory' : 'btn-secondary'}
            onClick={() => handleTabChange('observatory')}
          >
            [ 01 // OBSERVATORY ]
          </button>
          <button
            className={activeTab === 'archive' ? 'btn-observatory' : 'btn-secondary'}
            onClick={() => handleTabChange('archive')}
          >
            [ 02 // ARCHIVE ({missions.length}) ]
          </button>
          <button
            className={activeTab === 'game' ? 'btn-observatory' : 'btn-secondary'}
            onClick={() => handleTabChange('game')}
          >
            [ 03 // MINIGAME ENCOUNTER ]
          </button>
          <button
            className={activeTab === 'about' ? 'btn-observatory' : 'btn-secondary'}
            onClick={() => handleTabChange('about')}
          >
            [ 04 // ABOUT & SOURCES ]
          </button>
        </nav>

        {/* VIEW 1: OBSERVATORY HOME */}
        {activeTab === 'observatory' && (
          <>
            <section className="hero-observatory">
              <div className="hero-text">
                <div className="eyebrow">NASA Signal Archive · Deep Space Listening Post</div>
                <h1 className="hero-title">Echoes of Exploration</h1>
                <p className="hero-subtitle">
                  Listening to the quiet legacy of silent explorers resting across the Moon and Mars.
                  Connecting human curiosity, historical telemetry, and the robotic scouts we left behind.
                </p>
                <div className="hero-actions">
                  <button className="btn-observatory" onClick={() => handleTabChange('game')}>
                    ▶ TUNE TO ENCOUNTERS
                  </button>
                  <button className="btn-secondary" onClick={() => handleTabChange('archive')}>
                    EXPLORE 31 MISSIONS
                  </button>
                </div>
              </div>
              <div className="hero-earth">
                <img
                  src="/assets/sprites/earth.png"
                  alt="Pixel Earth"
                  className="pixelated"
                />
              </div>
            </section>

            {/* Two Voices Standard */}
            <section className="voices-split">
              <div className="voice-card voice-story">
                <span className="tag-story">Memory Echo (Game Story)</span>
                <p className="voice-quote">
                  "They learned by looking all the way down. Before anyone chose a path, we drew the map."
                </p>
                <div className="voice-meta">
                  First-person dramatized memory of Surveyor 1 · Moon Chapter
                </div>
              </div>
              <div className="voice-card voice-record">
                <span className="tag-record">Verified Record (NASA PDS / NSSDCA)</span>
                <p className="voice-quote">
                  Surveyor 1 executed the first true soft landing on another celestial body on June 2, 1966, transmitting 11,237 images.
                </p>
                <div className="voice-meta">
                  Primary Source: NASA Space Science Data Coordinated Archive
                </div>
              </div>
            </section>

            {/* Featured Hardware Highlights */}
            <section className="archive-section">
              <div className="section-head">
                <div>
                  <div className="eyebrow">Curated Telemetry</div>
                  <h2>Key Exploration Beacons</h2>
                </div>
                <button className="btn-secondary" onClick={() => handleTabChange('archive')}>
                  View all {missions.length} records →
                </button>
              </div>

              <div className="missions-grid">
                {missions.slice(0, 3).map((mission) => (
                  <div
                    key={mission.id}
                    className="mission-card"
                    onClick={() => handleOpenInspector(mission)}
                    style={{ cursor: 'pointer' }}
                  >
                    <div className="mission-card-head">
                      <h3 className="mission-name">{mission.name}</h3>
                      <span className={`status-badge ${mission.status === 'operational' ? 'active' : mission.status.includes('impact') ? 'impacted' : 'dormant'}`}>
                        {mission.status.replace('-', ' ')}
                      </span>
                    </div>
                    <div className="mission-hook">"{mission.story_hook}"</div>
                    <p className="mission-desc">{mission.objective}</p>
                    <div className="mission-meta">
                      <span>DEST: {mission.destination.toUpperCase()}</span>
                      <span className="mission-link">Inspect Telemetry 🔍</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        {/* VIEW 2: ARCHIVE CATALOG */}
        {activeTab === 'archive' && (
          <section className="archive-section">
            <div className="section-head">
              <div>
                <div className="eyebrow">Verified Hardware Archive</div>
                <h2>31 Silent Explorers</h2>
                <p className="muted">
                  Official catalog of NASA surface hardware, impact probes, and orbiters across the solar system. Click any record to inspect telemetry.
                </p>
              </div>

              <div className="filter-chips">
                <button
                  className={`filter-chip ${filterChapter === 'all' ? 'active' : ''}`}
                  onClick={() => {
                    telemetryAudio.playChirp(750, 0.03);
                    setFilterChapter('all');
                  }}
                >
                  ALL ({missions.length})
                </button>
                <button
                  className={`filter-chip ${filterChapter === 'moon' ? 'active' : ''}`}
                  onClick={() => {
                    telemetryAudio.playChirp(850, 0.03);
                    setFilterChapter('moon');
                  }}
                >
                  MOON
                </button>
                <button
                  className={`filter-chip ${filterChapter === 'mars' ? 'active' : ''}`}
                  onClick={() => {
                    telemetryAudio.playChirp(850, 0.03);
                    setFilterChapter('mars');
                  }}
                >
                  MARS
                </button>
                <button
                  className={`filter-chip ${filterChapter === 'featured' ? 'active' : ''}`}
                  onClick={() => {
                    telemetryAudio.playChirp(950, 0.03);
                    setFilterChapter('featured');
                  }}
                >
                  FEATURED
                </button>
              </div>
            </div>

            <div style={{ margin: '8px 0' }}>
              <input
                type="text"
                placeholder="Search missions by name, location, or hook..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--panel)',
                  border: '1px solid var(--line)',
                  color: 'var(--ink)',
                  fontFamily: 'var(--f-mono)',
                  fontSize: '14px',
                  borderRadius: '2px',
                }}
              />
            </div>

            <div className="missions-grid">
              {filteredMissions.map((mission) => (
                <div
                  key={mission.id}
                  className="mission-card"
                  onClick={() => handleOpenInspector(mission)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="mission-card-head">
                    <h3 className="mission-name">{mission.name}</h3>
                    <span className={`status-badge ${mission.status === 'operational' ? 'active' : mission.status.includes('impact') ? 'impacted' : 'dormant'}`}>
                      {mission.status.replace('-', ' ')}
                    </span>
                  </div>
                  <div className="mission-hook">"{mission.story_hook}"</div>
                  <p className="mission-desc">{mission.science_summary || mission.objective}</p>
                  <div className="mission-meta">
                    <span>{mission.destination.toUpperCase()}</span>
                    <span>{mission.launch_date.slice(0, 4)}</span>
                    <span className="mission-link">Inspect 🔍</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* VIEW 3: MINIGAME ENCOUNTER */}
        {activeTab === 'game' && (
          <SurveyorEncounterPreview
            missionId="surveyor-1"
            onComplete={handleEncounterComplete}
            onExit={() => handleTabChange('observatory')}
          />
        )}

        {/* VIEW 4: ABOUT & METHODOLOGY */}
        {activeTab === 'about' && (
          <section className="archive-section">
            <div className="section-head">
              <div>
                <div className="eyebrow">Methodology & Compliance</div>
                <h2>Project Credentials & Citations</h2>
              </div>
            </div>

            <div className="voice-card voice-record">
              <span className="tag-record">Competition & Scientific Standards</span>
              <ul style={{ paddingLeft: '20px', display: 'grid', gap: '8px', color: 'var(--ink)' }}>
                <li><b>Zero Runtime APIs:</b> All 31 missions stored offline in local JSON to prevent network failure during judging.</li>
                <li><b>Separation of Science & Fiction:</b> Fictional dramatizations are strictly framed in Cyan; verified NASA facts in Amber.</li>
                <li><b>Public Domain Compliance:</b> Official NASA JPL, NSSDCA, and Planetary Data System sources only. Zero copyright commercial music or imagery.</li>
                <li><b>Reference Art Style:</b> 16-bit 640×360 design standard documented in <code>docs/ART_STYLE_GUIDE.md</code>.</li>
              </ul>
            </div>
          </section>
        )}

        {/* Signal Inspector Modal */}
        <SignalInspectorModal
          mission={selectedMission}
          onClose={() => setSelectedMission(null)}
        />

        {/* Footer */}
        <footer className="observatory-footer">
          <div>Echoes of Exploration · NASA Space Apps Challenge 2026</div>
          <div className="muted">
            Designed under NASA Media Guidelines. Data sourced from NASA NSSDCA & JPL.
          </div>
        </footer>
      </div>
    </div>
  );
}

export default App;
