import { telemetryAudio } from '../../audio/telemetryAudio';
import { BehindTheMemoryPanel } from '../../components/BehindTheMemoryPanel';
import { NarrativeEncounterConsole } from '../../components/NarrativeEncounterConsole';
import { SurfaceExplorerCanvas, type SectorId } from '../../components/SurfaceExplorerCanvas';
import { CHAPTER_CARDS } from '../../data/chapters';
import {
  getChapterAccentColor,
  type CatalogEncounterRecord,
  type MissionRecord,
  type NarrativeBundle,
  type NarrativeEncounter,
  type SourceRecord,
} from '../../data/types';
import { SurveyorEncounterPreview } from '../../game/SurveyorEncounterPreview';

export type GameMode = 'map' | 'console';

interface GamePageProps {
  callSign: string;
  narrative: NarrativeBundle;
  missions: MissionRecord[];
  sourcesMap: Map<string, SourceRecord>;
  selectedEncounter: NarrativeEncounter;
  selectedDatasetEncounter?: CatalogEncounterRecord;
  unlockedBadges: string[];
  completedCount: number;
  chapterCompletedCounts: Record<SectorId, number>;
  activeSector: SectorId;
  gameMode: GameMode;
  isEncounterCompleted: (encounterId: string) => boolean;
  onSetGameMode: (mode: GameMode) => void;
  onSelectSector: (sector: SectorId) => void;
  onSelectEncounter: (enc: NarrativeEncounter) => void;
  onLaunchEncounter: (encounterId: string) => void;
  onCompleteEncounter: (badgeId: string) => void;
  onInspectMission: (mission: MissionRecord) => void;
  onNavigateHome: () => void;
}

/** Dedicated /game webpage: strictly the only route where the playable game mounts. */
export function GamePage({
  callSign,
  narrative,
  missions,
  sourcesMap,
  selectedEncounter,
  selectedDatasetEncounter,
  unlockedBadges,
  completedCount,
  chapterCompletedCounts,
  activeSector,
  gameMode,
  isEncounterCompleted,
  onSetGameMode,
  onSelectSector,
  onSelectEncounter,
  onLaunchEncounter,
  onCompleteEncounter,
  onInspectMission,
  onNavigateHome,
}: GamePageProps) {
  return (
    <main
      id="main-content"
      className="encounter-layout game-route-shell"
      aria-label="Echoes of Exploration Game Stage"
    >
      <div className="game-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <a
            href="/"
            className="btn-secondary btn-sm"
            onClick={(e) => {
              e.preventDefault();
              onNavigateHome();
            }}
          >
            ← MAIN PAGE (/)
          </a>
          <div>
            <h1 style={{ fontSize: 'clamp(16px, 2.2vw, 22px)' }}>
              Signal Expedition &amp; Encounters
            </h1>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div className="nav-progress">
            <span className="label">
              {callSign} · {completedCount}/{narrative.encounters.length}
            </span>
            <div className="gauge">
              {narrative.encounters.map((enc) => (
                <i key={enc.id} className={isEncounterCompleted(enc.id) ? 'on' : ''} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="filter-row">
        <div className="filter-chips" role="tablist" aria-label="Game View Mode">
          <button
            type="button"
            role="tab"
            aria-selected={gameMode === 'map'}
            className={`filter-chip ${gameMode === 'map' ? 'active' : ''}`}
            onClick={() => {
              telemetryAudio.playChirp(860, 0.03);
              onSetGameMode('map');
            }}
          >
            [ SURFACE EXPLORER MAP ]
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={gameMode === 'console'}
            className={`filter-chip ${gameMode === 'console' ? 'active' : ''}`}
            onClick={() => {
              telemetryAudio.playChirp(920, 0.03);
              onSetGameMode('console');
            }}
          >
            [ ACTIVE ENCOUNTER (#{String(selectedEncounter.order).padStart(2, '0')}) ]
          </button>
        </div>

        <div className="filter-chips" role="group" aria-label="Destination Sectors">
          {CHAPTER_CARDS.map((ch) => (
            <button
              key={ch.id}
              type="button"
              className={`filter-chip ${activeSector === ch.id ? 'active' : ''}`}
              onClick={() => {
                telemetryAudio.playChirp(820, 0.03);
                onSelectSector(ch.id);
              }}
            >
              {ch.index}. {ch.title.toUpperCase()} ({chapterCompletedCounts[ch.id]}/3)
            </button>
          ))}
        </div>
      </div>

      {gameMode === 'map' && (
        <SurfaceExplorerCanvas
          key={activeSector}
          sector={activeSector}
          encounters={narrative.encounters}
          missions={missions}
          activeEncounterId={selectedEncounter.id}
          completedIds={unlockedBadges}
          onLaunchEncounter={onLaunchEncounter}
          onInspectMission={(m) => {
            telemetryAudio.playChirp(1040, 0.04);
            onInspectMission(m);
          }}
        />
      )}

      {gameMode === 'console' && (
        <>
          <div className="encounter-tabs" role="tablist" aria-label="Choose a signal encounter">
            {narrative.encounters.map((enc) => {
              const active = enc.id === selectedEncounter.id;
              const done = isEncounterCompleted(enc.id);
              return (
                <button
                  key={enc.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`encounter-tab ${active ? 'active' : ''}`}
                  onClick={() => {
                    telemetryAudio.playChirp(900, 0.03);
                    onSelectEncounter(enc);
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                    }}
                  >
                    <span className="label" style={{ color: getChapterAccentColor(enc.chapter) }}>
                      #{String(enc.order).padStart(2, '0')} · {enc.chapter.toUpperCase()}
                    </span>
                    <span
                      className="mono"
                      style={{
                        fontSize: '11px',
                        color: done ? 'var(--amber)' : 'var(--muted)',
                      }}
                    >
                      {done ? '✓' : '○'}
                    </span>
                  </div>
                  <strong style={{ fontSize: '14px' }}>{enc.title}</strong>
                  <span className="mono muted" style={{ fontSize: '11px' }}>
                    {enc.quick_task.task_name}
                  </span>
                </button>
              );
            })}
          </div>

          {selectedEncounter.id === 'gentle-touch' ? (
            <div style={{ display: 'grid', gap: '20px' }}>
              <div className="encounter-frame-bar">
                <span>
                  <strong style={{ color: 'var(--cyan)' }}>ARCHIVE REPLAY:</strong>{' '}
                  {narrative.ui_copy.echo_frame}
                </span>
                <span className="status-badge dormant">{selectedEncounter.status_badge.label}</span>
              </div>

              <SurveyorEncounterPreview
                missionId="surveyor-1"
                onComplete={onCompleteEncounter}
                onExit={() => onSetGameMode('map')}
              />

              <BehindTheMemoryPanel
                encounter={selectedEncounter}
                sourcesMap={sourcesMap}
                sectionLabels={narrative.ui_copy.section_labels}
              />
            </div>
          ) : (
            <NarrativeEncounterConsole
              key={selectedEncounter.id}
              encounter={selectedEncounter}
              datasetEncounter={selectedDatasetEncounter}
              sourcesMap={sourcesMap}
              echoFrameText={narrative.ui_copy.echo_frame}
              sectionLabels={narrative.ui_copy.section_labels}
              unlockedBadges={unlockedBadges}
              onComplete={onCompleteEncounter}
              onExit={() => onSetGameMode('map')}
            />
          )}
        </>
      )}

      <section className="voice-card hud-panel" aria-label="Observatory Restoration Status">
        <div className="c-head">
          <span className="tag-record">
            Observatory Restoration · {completedCount}/{narrative.encounters.length} Signals
          </span>
          {completedCount >= narrative.encounters.length && (
            <span className="status-badge active">SIGNAL ARCHIVIST PATCH AWARDED ✓</span>
          )}
        </div>

        <div className="bridge-grid">
          {CHAPTER_CARDS.map((ch) => {
            const done = chapterCompletedCounts[ch.id];
            const unlocked = done >= 3;
            return (
              <div key={ch.id} className={`bridge-card ${unlocked ? 'unlocked' : ''}`}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <span className="label" style={{ color: ch.accent }}>
                    CHAPTER {ch.index} · {ch.title}
                  </span>
                  <span className={`status-badge ${unlocked ? 'active' : 'dormant'}`}>
                    {unlocked ? 'BRIDGE OPEN ✓' : `${done}/3`}
                  </span>
                </div>
                <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>{ch.bridgeTitle}</strong>
                <p style={{ fontSize: '12px', color: unlocked ? 'var(--crust)' : 'var(--muted)' }}>
                  {unlocked
                    ? ch.bridgeNote
                    : `Complete all 3 encounters in ${ch.title} to restore this observatory wing bridge.`}
                </p>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
