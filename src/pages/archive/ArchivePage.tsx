import { useMemo, useState } from 'react';
import { telemetryAudio } from '../../audio/telemetryAudio';
import { PixelSpriteThumb } from '../../components/PixelSpriteThumb';
import type { ArchiveSubView, RoutePath, SourcesSubView } from '../../components/SourcesArchiveDropdown';
import type { SectorId } from '../../components/SurfaceExplorerCanvas';
import { CHAPTER_CARDS } from '../../data/chapters';
import {
  getChapterAccentColor,
  getChapterSceneClass,
  getStatusBadgeInfo,
  type CatalogEncounterRecord,
  type MissionRecord,
  type NarrativeBundle,
  type SourceRecord,
} from '../../data/types';

type ChapterFilter = 'all' | 'moon' | 'mars' | 'elsewhere' | 'featured';
type StatusGroupFilter = 'all' | 'active' | 'passive' | 'dormant' | 'ended';

interface ArchivePageProps {
  missions: MissionRecord[];
  missionsReviewedOn: string;
  encountersCatalog: CatalogEncounterRecord[];
  sourcesMap: Map<string, SourceRecord>;
  encounterByMissionId: Map<string, NarrativeBundle['encounters'][number]>;
  archiveSubView: ArchiveSubView;
  chapterCompletedCounts: Record<SectorId, number>;
  isEncounterCompleted: (encounterId: string) => boolean;
  onSelectMission: (mission: MissionRecord) => void;
  onNavigate: (
    target: RoutePath,
    options?: {
      archiveView?: ArchiveSubView;
      sourcesView?: SourcesSubView;
      sector?: SectorId;
    }
  ) => void;
}

/** Dedicated /archive webpage: 31 NASA mission records, Three Realms, and 9 Evidence Chains. */
export function ArchivePage({
  missions,
  missionsReviewedOn,
  encountersCatalog,
  sourcesMap,
  encounterByMissionId,
  archiveSubView,
  chapterCompletedCounts,
  isEncounterCompleted,
  onSelectMission,
  onNavigate,
}: ArchivePageProps) {
  const [filterChapter, setFilterChapter] = useState<ChapterFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusGroupFilter>('all');
  const [search, setSearch] = useState('');

  const chapterCounts = useMemo(
    () => ({
      moon: missions.filter((m) => m.chapter === 'moon').length,
      mars: missions.filter((m) => m.chapter === 'mars').length,
      elsewhere: missions.filter((m) => m.chapter === 'elsewhere').length,
      featured: missions.filter((m) => m.featured).length,
    }),
    [missions]
  );

  const filteredMissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return missions.filter((m) => {
      const matchesChapter =
        filterChapter === 'all'
          ? true
          : filterChapter === 'featured'
            ? m.featured
            : m.chapter === filterChapter;
      if (!matchesChapter) return false;

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
            ? m.status.startsWith('active')
            : statusFilter === 'passive'
              ? m.status === 'passive-science'
              : statusFilter === 'dormant'
                ? m.status.startsWith('silent')
                : m.status.startsWith('completed') || m.status.includes('impacted');
      if (!matchesStatus) return false;

      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.story_hook.toLowerCase().includes(q) ||
        m.destination.toLowerCase().includes(q) ||
        m.location_summary.toLowerCase().includes(q) ||
        m.hardware_types.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [filterChapter, missions, search, statusFilter]);

  return (
    <main
      id="main-content"
      aria-label="Historical Mission Archive Webpage"
      style={{ display: 'flex', flexDirection: 'column', gap: 'inherit' }}
    >
      <section
        className="archive-section hud-panel"
        style={{ padding: '22px' }}
        aria-label="Historical Mission Archive Catalog"
      >
        <div className="section-head">
          <div>
            <h1>Historical Mission Archive</h1>
            <p className="muted" style={{ fontSize: '14px', marginTop: '4px' }}>
              {missions.length} NASA hardware artifacts across Moon, Mars &amp; Deep Space · Reviewed{' '}
              {missionsReviewedOn}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {archiveSubView === 'missions' && (
              <>
                <label htmlFor="archive-sector-select" className="label">
                  SECTOR:
                </label>
                <select
                  id="archive-sector-select"
                  className="dropdown-select-inline"
                  value={filterChapter}
                  onChange={(e) => {
                    telemetryAudio.playChirp(820, 0.03);
                    setFilterChapter(e.target.value as ChapterFilter);
                  }}
                >
                  <option value="all">ALL SECTORS ({missions.length})</option>
                  <option value="moon">MOON ({chapterCounts.moon})</option>
                  <option value="mars">MARS ({chapterCounts.mars})</option>
                  <option value="elsewhere">DEEP SPACE ({chapterCounts.elsewhere})</option>
                  <option value="featured">PLAYABLE ({chapterCounts.featured})</option>
                </select>
              </>
            )}

            <a
              href="/sources/"
              className="btn-secondary btn-sm"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/sources', { sourcesView: 'registry' });
              }}
            >
              NASA SOURCES (/sources) →
            </a>
          </div>
        </div>

        <div className="filter-chips" role="navigation" aria-label="Archive Views">
          <a
            href="/archive/"
            className={`filter-chip ${archiveSubView === 'missions' ? 'active' : ''}`}
            aria-current={archiveSubView === 'missions' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/archive', { archiveView: 'missions' });
            }}
          >
            RECORDS ({missions.length})
          </a>
          <a
            href="/archive/?view=realms"
            className={`filter-chip ${archiveSubView === 'realms' ? 'active' : ''}`}
            aria-current={archiveSubView === 'realms' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/archive', { archiveView: 'realms' });
            }}
          >
            THREE REALMS &amp; BRIDGES ({CHAPTER_CARDS.length})
          </a>
          <a
            href="/archive/?view=evidence"
            className={`filter-chip ${archiveSubView === 'evidence' ? 'active' : ''}`}
            aria-current={archiveSubView === 'evidence' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/archive', { archiveView: 'evidence' });
            }}
          >
            EVIDENCE CHAINS ({encountersCatalog.length})
          </a>
        </div>

        {archiveSubView === 'missions' && (
          <>
            <div className="filter-row">
              <div className="filter-chips" role="group" aria-label="Chapter filter">
                {(
                  [
                    { id: 'all', label: `ALL (${missions.length})` },
                    { id: 'moon', label: `MOON (${chapterCounts.moon})` },
                    { id: 'mars', label: `MARS (${chapterCounts.mars})` },
                    { id: 'elsewhere', label: `ELSEWHERE (${chapterCounts.elsewhere})` },
                    { id: 'featured', label: `PLAYABLE (${chapterCounts.featured})` },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    className={`filter-chip ${filterChapter === chip.id ? 'active' : ''}`}
                    onClick={() => {
                      telemetryAudio.playChirp(820, 0.03);
                      setFilterChapter(chip.id);
                    }}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="filter-chips" role="group" aria-label="Status filter">
                {(
                  [
                    { id: 'all', label: 'ALL STATES' },
                    { id: 'active', label: 'ACTIVE' },
                    { id: 'passive', label: 'PASSIVE' },
                    { id: 'dormant', label: 'SILENT / DORMANT' },
                    { id: 'ended', label: 'ENDED / IMPACTED' },
                  ] as const
                ).map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className={`filter-chip ${statusFilter === st.id ? 'active' : ''}`}
                    onClick={() => {
                      telemetryAudio.playChirp(760, 0.03);
                      setStatusFilter(st.id);
                    }}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>

            <input
              type="text"
              className="search-input"
              placeholder="Search 31 NASA missions by spacecraft, destination, location, or instrument..."
              aria-label="Search missions"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className="archive-catalog-grid">
              {filteredMissions.map((mission, idx) => {
                const badge = getStatusBadgeInfo(mission.status);
                const linkedEncounter = encounterByMissionId.get(mission.id);
                const recovered = linkedEncounter ? isEncounterCompleted(linkedEncounter.id) : false;

                return (
                  <button
                    key={mission.id}
                    type="button"
                    className="mission-card"
                    onClick={() => {
                      telemetryAudio.playChirp(1040, 0.04);
                      onSelectMission(mission);
                    }}
                  >
                    <div className="scene-thumb">
                      <div className={getChapterSceneClass(mission.chapter)} />
                      <div className="signal-ring" aria-hidden="true" />
                      <span
                        className={badge.className}
                        style={{ position: 'relative', zIndex: 1 }}
                      >
                        {badge.label}
                      </span>
                      <div className="scene-sprite-overlay">
                        <PixelSpriteThumb
                          missionId={mission.id}
                          alt={`${mission.name} pixel illustration`}
                        />
                      </div>
                    </div>

                    <div className="mission-card-body">
                      <div className="mission-card-head">
                        <span
                          className="label"
                          style={{ color: getChapterAccentColor(mission.chapter) }}
                        >
                          #{String(idx + 1).padStart(2, '0')} · SECTOR // {mission.chapter.toUpperCase()}
                        </span>
                        {linkedEncounter && (
                          <span className={`status-badge ${recovered ? 'active' : 'passive'}`}>
                            {recovered ? 'ECHO RECOVERED ✓' : 'PLAYABLE'}
                          </span>
                        )}
                      </div>

                      <h3 className="mission-name">{mission.name}</h3>
                      <div className="mission-hook">&ldquo;{mission.story_hook}&rdquo;</div>
                      <p className="mission-desc">
                        {mission.science_summary || mission.objective}
                      </p>

                      <div className="mission-meta">
                        <span>{mission.destination.toUpperCase()}</span>
                        <span>{mission.launch_date.slice(0, 4)}</span>
                        <span className="mission-link">INSPECT RECORD →</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {archiveSubView === 'realms' && (
          <div className="chapters-grid">
            {CHAPTER_CARDS.map((ch) => {
              const doneInChapter = chapterCompletedCounts[ch.id];
              const bridgeUnlocked = doneInChapter >= 3;
              return (
                <article key={ch.id} className="chapter-card">
                  <div className="scene-thumb">
                    <div className={getChapterSceneClass(ch.id)} />
                    <div className="signal-ring" aria-hidden="true" />
                    <span
                      className={`status-badge ${bridgeUnlocked ? 'active' : 'dormant'}`}
                      style={{ position: 'relative', zIndex: 1 }}
                    >
                      {chapterCounts[ch.id]} MISSIONS · {doneInChapter}/3 DONE
                    </span>
                    <div className="scene-sprite-overlay">
                      <PixelSpriteThumb missionId={ch.representativeMissionId} alt={ch.spriteAlt} />
                    </div>
                  </div>

                  <div className="chapter-body">
                    <h3>{ch.title}</h3>
                    <p style={{ fontSize: '14px', color: 'var(--crust)' }}>{ch.subtitle}</p>
                    <div
                      style={{
                        borderTop: '1px solid var(--line)',
                        paddingTop: '8px',
                        fontSize: '12px',
                        color: bridgeUnlocked ? 'var(--amber)' : 'var(--muted)',
                      }}
                    >
                      {ch.bridgeTitle}:{' '}
                      {bridgeUnlocked
                        ? ch.bridgeNote
                        : `Complete all 3 ${ch.title} encounters to unlock this Discovery Bridge.`}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                        marginTop: 'auto',
                        paddingTop: '8px',
                      }}
                    >
                      <button
                        type="button"
                        className="btn-secondary btn-sm"
                        onClick={() => {
                          setFilterChapter(ch.id);
                          onNavigate('/archive', { archiveView: 'missions' });
                        }}
                      >
                        FILTER {ch.title.toUpperCase()} ({chapterCounts[ch.id]})
                      </button>
                      <a
                        href="/game/"
                        className="btn-observatory btn-sm"
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate('/game', { sector: ch.id });
                        }}
                      >
                        ▶ PLAY SECTOR
                      </a>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {archiveSubView === 'evidence' && (
          <div className="missions-grid">
            {encountersCatalog.map((enc) => {
              const primarySrc = sourcesMap.get(enc.primary_source_id);
              const done = isEncounterCompleted(enc.id);
              return (
                <article key={enc.id} className="voice-card voice-record">
                  <div className="c-head">
                    <span className="label" style={{ color: getChapterAccentColor(enc.chapter) }}>
                      #{String(enc.order).padStart(2, '0')} · {enc.chapter.toUpperCase()}
                    </span>
                    <span className={`status-badge ${done ? 'active' : 'dormant'}`}>
                      {done ? 'RECONSTRUCTED ✓' : enc.mechanic_family}
                    </span>
                  </div>
                  <h3>{enc.title}</h3>
                  <p style={{ fontSize: '13px', color: 'var(--ink)' }}>
                    <strong>Task:</strong> {enc.player_task}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--crust)' }}>
                    <strong>Learning intent:</strong> {enc.learning_intent}
                  </p>
                  <div className="mono" style={{ fontSize: '11px', color: 'var(--amber)' }}>
                    EVIDENCE CHAIN: {enc.evidence_chain.join(' -> ')}
                  </div>
                  <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                    <strong>Simplification note:</strong> {enc.simplification_note}
                  </p>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap',
                      marginTop: 'auto',
                      paddingTop: '8px',
                    }}
                  >
                    {primarySrc && (
                      <a
                        href={primarySrc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-secondary btn-sm"
                      >
                        {primarySrc.organization} ↗
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
