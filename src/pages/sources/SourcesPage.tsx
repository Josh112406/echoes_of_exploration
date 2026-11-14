import { useMemo, useRef, useState } from 'react';
import { telemetryAudio } from '../../audio/telemetryAudio';
import type { ArchiveSubView, RoutePath, SourcesSubView } from '../../components/SourcesArchiveDropdown';
import type { MissionRecord, NarrativeBundle, SourceRecord } from '../../data/types';

interface SourcesPageProps {
  sourcesList: SourceRecord[];
  missions: MissionRecord[];
  missionsReviewedOn: string;
  narrative: NarrativeBundle;
  sourcesSubView: SourcesSubView;
  completedCount: number;
  totalEncounters: number;
  saveMessage: string;
  onExportSave: () => void;
  onImportSave: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetProgress: () => void;
  onSelectMission: (mission: MissionRecord) => void;
  onNavigate: (
    target: RoutePath,
    options?: {
      archiveView?: ArchiveSubView;
      sourcesView?: SourcesSubView;
    }
  ) => void;
}

/** Dedicated /sources webpage: 33 NASA sources, 6 encounter references, Two-Voice rule & save manager. */
export function SourcesPage({
  sourcesList,
  missions,
  missionsReviewedOn,
  narrative,
  sourcesSubView,
  completedCount,
  totalEncounters,
  saveMessage,
  onExportSave,
  onImportSave,
  onResetProgress,
  onSelectMission,
  onNavigate,
}: SourcesPageProps) {
  const [sourceOrgFilter, setSourceOrgFilter] = useState('ALL');
  const [sourceSearch, setSourceSearch] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sourceOrganizations = useMemo(() => {
    const set = new Set<string>();
    for (const s of sourcesList) set.add(s.organization);
    return ['ALL', ...Array.from(set)];
  }, [sourcesList]);

  const filteredSources = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    return sourcesList.filter((s) => {
      if (sourceOrgFilter !== 'ALL' && s.organization !== sourceOrgFilter) return false;
      if (!q) return true;
      return (
        s.id.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.organization.toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q)
      );
    });
  }, [sourceOrgFilter, sourceSearch, sourcesList]);

  const missionsBySourceId = useMemo(() => {
    const map = new Map<string, MissionRecord[]>();
    for (const m of missions) {
      for (const sid of m.source_ids) {
        const list = map.get(sid);
        if (list) list.push(m);
        else map.set(sid, [m]);
      }
    }
    return map;
  }, [missions]);

  return (
    <main
      id="main-content"
      aria-label="Primary NASA Sources Registry Webpage"
      style={{ display: 'flex', flexDirection: 'column', gap: 'inherit' }}
    >
      <section
        className="archive-section hud-panel"
        style={{ padding: '22px' }}
        aria-label="Primary NASA Sources and Methodology"
      >
        <div className="section-head">
          <div>
            <h1>Primary NASA Sources &amp; Verification Registry</h1>
            <p className="muted" style={{ fontSize: '14px', marginTop: '4px' }}>
              {sourcesList.length} authoritative NASA, JPL, NSSDCA, ILRS &amp; PDS citations ·
              Cross-linked to {missions.length} mission records
            </p>
          </div>

          <a
            href="/archive/"
            className="btn-secondary btn-sm"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/archive', { archiveView: 'missions' });
            }}
          >
            ← MISSION ARCHIVES (/archive)
          </a>
        </div>

        <div className="sources-metrics-bar" aria-label="Source Verification Summary">
          <div className="readout-cell">
            <span className="k">PRIMARY SOURCES</span>
            <span className="v" style={{ color: 'var(--amber)' }}>
              {sourcesList.length} VERIFIED
            </span>
          </div>
          <div className="readout-cell">
            <span className="k">AGENCIES &amp; ARCHIVES</span>
            <span className="v">{sourceOrganizations.length - 1} AUTHORITIES</span>
          </div>
          <div className="readout-cell">
            <span className="k">ENCOUNTER REFERENCES</span>
            <span className="v">{narrative.references_consulted.length} SCIENCE BRIEFS</span>
          </div>
          <div className="readout-cell">
            <span className="k">LAST AUDIT DATE</span>
            <span className="v">{missionsReviewedOn}</span>
          </div>
        </div>

        <div className="filter-chips" role="navigation" aria-label="Sources Sections">
          <a
            href="/sources/"
            className={`filter-chip ${sourcesSubView === 'registry' ? 'active' : ''}`}
            aria-current={sourcesSubView === 'registry' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/sources', { sourcesView: 'registry' });
            }}
          >
            NASA SOURCES REGISTRY ({sourcesList.length})
          </a>
          <a
            href="/sources/?view=references"
            className={`filter-chip ${sourcesSubView === 'references' ? 'active' : ''}`}
            aria-current={sourcesSubView === 'references' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/sources', { sourcesView: 'references' });
            }}
          >
            ENCOUNTER REFERENCES ({narrative.references_consulted.length})
          </a>
          <a
            href="/sources/?view=methodology"
            className={`filter-chip ${sourcesSubView === 'methodology' ? 'active' : ''}`}
            aria-current={sourcesSubView === 'methodology' ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/sources', { sourcesView: 'methodology' });
            }}
          >
            TWO-VOICE RULE, GLOSSARY &amp; SAVE DATA
          </a>
        </div>

        {sourcesSubView === 'registry' && (
          <>
            <div className="filter-chips" role="group" aria-label="Filter sources by organization">
              {sourceOrganizations.map((org) => (
                <button
                  key={org}
                  type="button"
                  className={`filter-chip ${sourceOrgFilter === org ? 'active' : ''}`}
                  onClick={() => {
                    telemetryAudio.playChirp(820, 0.03);
                    setSourceOrgFilter(org);
                  }}
                >
                  {org}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="search-input"
              placeholder="Filter primary NASA sources by ID, title, agency, or URL..."
              aria-label="Filter primary NASA sources"
              value={sourceSearch}
              onChange={(e) => setSourceSearch(e.target.value)}
            />

            <div className="voice-card voice-record">
              <span className="tag-record">
                Authoritative Citation Ledger ({filteredSources.length} / {sourcesList.length})
              </span>

              <div className="sources-ledger" style={{ marginTop: '6px' }}>
                {filteredSources.map((src) => {
                  const citingMissions = missionsBySourceId.get(src.id) ?? [];
                  return (
                    <article key={src.id} className="source-ledger-row">
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '10px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <span className="mono" style={{ fontSize: '11px', color: 'var(--amber)' }}>
                          {src.id} · {src.organization} · {src.tier.toUpperCase()}
                        </span>
                        <span className="status-badge passive">
                          {src.local_snapshot ? 'LOCAL SNAPSHOT LINKED' : 'LIVE URL CITED'}
                        </span>
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div style={{ display: 'grid', gap: '4px' }}>
                          <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>{src.title}</strong>
                          <span
                            className="mono muted"
                            style={{ fontSize: '11px', overflowWrap: 'anywhere' }}
                          >
                            {src.url}
                          </span>
                        </div>

                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="btn-secondary btn-sm"
                        >
                          OPEN SOURCE ↗
                        </a>
                      </div>

                      {citingMissions.length > 0 && (
                        <div className="source-mission-links">
                          <span className="mono muted" style={{ fontSize: '10px' }}>
                            CITED BY ({citingMissions.length}):
                          </span>
                          {citingMissions.map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              className="filter-chip"
                              style={{ minHeight: '26px', padding: '2px 8px', fontSize: '9px' }}
                              onClick={() => {
                                telemetryAudio.playChirp(1040, 0.04);
                                onSelectMission(m);
                              }}
                            >
                              {m.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {sourcesSubView === 'references' && (
          <div className="voice-card voice-record">
            <span className="tag-record">
              Encounter Science References ({narrative.references_consulted.length})
            </span>
            <div className="missions-grid" style={{ marginTop: '6px' }}>
              {narrative.references_consulted.map((ref) => (
                <a
                  key={ref.url}
                  href={ref.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="evidence-card"
                  style={{ textDecoration: 'none', color: 'inherit' }}
                >
                  <span className="mono" style={{ fontSize: '10px', color: 'var(--amber)' }}>
                    {ref.used_for} · {ref.org}
                  </span>
                  <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>{ref.title} ↗</strong>
                  <span className="mono muted" style={{ fontSize: '11px', overflowWrap: 'anywhere' }}>
                    {ref.url}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {sourcesSubView === 'methodology' && (
          <div style={{ display: 'grid', gap: '18px' }}>
            {/* Two-Voice Standard (§3 of docs/ART_STYLE_GUIDE.md) */}
            <section className="voices-split" aria-label="Two voices, two colors standard">
              <article className="voice-card console">
                <div className="c-head">
                  <span className="tag-story">
                    <span className="signal-dot" aria-hidden="true" />
                    Memory echo · Game story
                  </span>
                  <span className="mono muted" style={{ fontSize: '11px' }}>
                    CYAN (#0EC3DC)
                  </span>
                </div>
                <p className="voice-quote">
                  &ldquo;I am a lander with no pilot. Everything I know comes from my sensors.&rdquo;
                </p>
                <div className="voice-meta">
                  {narrative.ui_copy.echo_frame} Separated visually in Cyan story frames.
                </div>
              </article>

              <article className="voice-card voice-record">
                <div className="c-head">
                  <span className="tag-record">Verified record · NASA Archive</span>
                  <span className="mono muted" style={{ fontSize: '11px' }}>
                    AMBER (#F59E0B)
                  </span>
                </div>
                <p className="voice-quote" style={{ fontStyle: 'normal', fontSize: '15px' }}>
                  Surveyor 1 launched May 30, 1966, and executed the first U.S. soft landing on the
                  Moon on June 2, 1966, in Oceanus Procellarum.
                </p>
                <div className="voice-meta">
                  Primary authority: NASA Science &amp; NSSDCA · Reviewed {missionsReviewedOn}
                </div>
              </article>
            </section>

            <div className="voice-card voice-record">
              <span className="tag-record">
                NASA Non-Endorsement &amp; Super Intelligence (SI) Disclosure
              </span>
              <ul style={{ paddingLeft: '20px', display: 'grid', gap: '8px', color: 'var(--ink)' }}>
                <li>
                  <b>Non-Endorsement &amp; Branding Compliance:</b> Independent educational submission for
                  NASA Space Apps Challenge 2026. No NASA &quot;meatball&quot; or worm insignia is
                  used or altered.
                </li>
                <li>
                  <b>Code, Data Normalization &amp; Narrative (SI-Assisted):</b> Scaffolding, TypeScript
                  integration, dataset normalization, and narrative copy drafts
                  (`src/text/narrative.json`) were accelerated with SI tools and verified against
                  primary NASA NSSDCA, JPL, ILRS, and PDS sources.
                </li>
                <li>
                  <b>Art &amp; Typography Standard:</b> Strict 24-color palette, Silkscreen headings,
                  IBM Plex Sans/Mono body and telemetry (`docs/ART_STYLE_GUIDE.md`), plus Web Audio
                  oscillator SFX (`src/audio/telemetryAudio.ts`).
                </li>
                <li>
                  <b>Privacy Boundary:</b> Zero telemetry, zero cookies, zero runtime APIs. Progress
                  saves only to browser <code>localStorage</code> with optional JSON export/import.
                </li>
              </ul>
            </div>

            <div className="voice-card voice-story">
              <span className="tag-story">Local Archive Save Manager</span>
              <div className="save-toolbar">
                <button type="button" className="btn-observatory btn-sm" onClick={onExportSave}>
                  EXPORT SAVE JSON
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  IMPORT SAVE JSON
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  style={{ display: 'none' }}
                  onChange={onImportSave}
                />
                <button type="button" className="btn-secondary btn-sm" onClick={onResetProgress}>
                  RESET PROGRESS ({completedCount}/{totalEncounters})
                </button>
              </div>
              {saveMessage && (
                <div className="mono" style={{ fontSize: '12px', color: 'var(--cyan-glow)' }}>
                  {saveMessage}
                </div>
              )}
            </div>

            <div>
              <h3 style={{ marginBottom: '10px', color: 'var(--amber)' }}>Field Glossary</h3>
              <div className="evidence-grid">
                {narrative.glossary.map((item) => (
                  <div key={item.term} className="evidence-card">
                    <strong style={{ color: 'var(--cyan)' }}>{item.term}</strong>
                    <span style={{ fontSize: '14px', color: 'var(--crust)' }}>{item.definition}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
