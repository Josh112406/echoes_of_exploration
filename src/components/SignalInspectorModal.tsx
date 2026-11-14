import { useEffect, useRef } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';
import {
  getChapterAccentColor,
  getChapterSceneClass,
  getMissionSprite,
  getStatusBadgeInfo,
  type MissionRecord,
  type NarrativeEncounter,
  type SourceRecord,
} from '../data/types';

interface SignalInspectorModalProps {
  mission: MissionRecord | null;
  encounter: NarrativeEncounter | null;
  sourcesMap: Map<string, SourceRecord>;
  reviewedOn: string;
  echoFrameText: string;
  needsReviewText: string;
  sectionLabels: Record<string, string>;
  onClose: () => void;
  onTuneEncounter?: (encounterId: string) => void;
}

export function SignalInspectorModal({
  mission,
  encounter,
  sourcesMap,
  reviewedOn,
  echoFrameText,
  needsReviewText,
  sectionLabels,
  onClose,
  onTuneEncounter,
}: SignalInspectorModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!mission) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        telemetryAudio.playChirp(700, 0.03);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      prevFocus?.focus?.();
    };
  }, [mission, onClose]);

  if (!mission) return null;

  const badge = getStatusBadgeInfo(mission.status);
  const sprite = getMissionSprite(mission.id);
  const accentColor = getChapterAccentColor(mission.chapter);

  const sourceIds = Array.from(
    new Set([
      ...mission.source_ids,
      ...(encounter?.behind_the_memory.source_ids ?? []),
    ])
  );
  const resolvedSources = sourceIds
    .map((id) => sourcesMap.get(id))
    .filter((s): s is SourceRecord => Boolean(s));

  const arrivalEnd = `${mission.arrival_date ?? 'N/A'} → ${mission.mission_end_date ?? 'Ongoing / Open'}`;

  return (
    <div
      className="modal-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby="record-reader-title"
      onClick={() => {
        telemetryAudio.playChirp(700, 0.03);
        onClose();
      }}
    >
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Top Archive Bar (§7.7) */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '10px',
            borderBottom: '1px solid var(--line)',
            paddingBottom: '12px',
          }}
        >
          <span className="mono" style={{ fontSize: '12px', color: 'var(--crust)' }}>
            Verified archive record · reviewed {reviewedOn}
          </span>
          <button
            ref={closeBtnRef}
            className="btn-secondary btn-sm"
            onClick={() => {
              telemetryAudio.playChirp(700, 0.03);
              onClose();
            }}
          >
            [ ESC // CLOSE ✕ ]
          </button>
        </div>

        {/* 1. AMBER VERIFIED RECORD CARD FIRST (§3, §7.7) */}
        <article className="voice-card voice-record">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                <span className="tag-record">Verified record</span>
                <span className={badge.className}>{badge.label}</span>
                {mission.status_review_required_before_release && (
                  <span className="status-badge review-flag">{needsReviewText}</span>
                )}
              </div>
              <div className="label" style={{ color: accentColor }}>
                {mission.chapter.toUpperCase()} CHAPTER · AGENCIES: {mission.agencies.join(' / ')}
              </div>
              <h2 id="record-reader-title" style={{ marginTop: '4px', color: 'var(--ink)' }}>
                {mission.name}
              </h2>
            </div>
          </div>

          {/* 16:9 Scene Frame + Credit Strip */}
          <div>
            <div className="scene-thumb scene-thumb--16x9">
              <div className={getChapterSceneClass(mission.chapter)} />
              <div className="signal-ring" aria-hidden="true" />
              {sprite && (
                <div className="scene-sprite-overlay" style={{ margin: 'auto' }}>
                  <img
                    src={sprite.src}
                    alt={sprite.alt}
                    className="pixelated"
                    style={{ width: '92px', height: '92px' }}
                  />
                </div>
              )}
              <span className={badge.className} style={{ position: 'relative', zIndex: 1 }}>
                {mission.destination}
              </span>
            </div>
            <div
              className="mono"
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px',
                padding: '8px 12px',
                background: 'var(--void)',
                border: '1px solid var(--line)',
                borderTop: 0,
                fontSize: '11px',
                color: 'var(--muted)',
              }}
            >
              <span>Team illustration, not a mission photograph · ID: {mission.id}</span>
              <a href={mission.media_page_url} target="_blank" rel="noopener noreferrer">
                NASA Media Page ↗
              </a>
            </div>
          </div>

          {/* 4-up Tabular Readouts */}
          <div className="readout-grid">
            <div className="readout-cell">
              <span className="k">Destination</span>
              <span className="v">{mission.destination}</span>
            </div>
            <div className="readout-cell">
              <span className="k">Launch Date</span>
              <span className="v">{mission.launch_date}</span>
            </div>
            <div className="readout-cell">
              <span className="k">Arrival / End</span>
              <span className="v">{arrivalEnd}</span>
            </div>
            <div className="readout-cell">
              <span className="k">Hardware Types</span>
              <span className="v">{mission.hardware_types.join(', ')}</span>
            </div>
          </div>

          {/* Location & Mission Science Summary */}
          <div style={{ display: 'grid', gap: '10px', fontSize: '14px', color: 'var(--crust)' }}>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Location: </strong>
              {mission.location_summary}
            </div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Objective: </strong>
              {mission.objective}
            </div>
            <div>
              <strong style={{ color: 'var(--ink)' }}>Science Summary: </strong>
              {mission.science_summary}
            </div>
          </div>

          {/* Linked Encounter Behind-the-Memory Facts */}
          {encounter && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px', display: 'grid', gap: '12px' }}>
              <div className="eyebrow">Behind the Memory · {encounter.behind_the_memory.headline}</div>
              <p style={{ fontSize: '14px', color: 'var(--ink)' }}>{encounter.behind_the_memory.summary}</p>

              {encounter.behind_the_memory.key_numbers.length > 0 && (
                <div className="readout-grid">
                  {encounter.behind_the_memory.key_numbers.map((kn) => (
                    <div key={kn.label} className="readout-cell">
                      <span className="k">{kn.label}</span>
                      <span className="v">{kn.value}</span>
                      <span className="mono muted" style={{ fontSize: '10px' }}>
                        {kn.source_id}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <div className="label" style={{ color: 'var(--amber)', marginBottom: '6px' }}>
                  {sectionLabels.what_happened || 'What happened'}
                </div>
                <ul style={{ paddingLeft: '18px', display: 'grid', gap: '4px', fontSize: '14px', color: 'var(--crust)' }}>
                  {encounter.behind_the_memory.what_happened.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="evidence-grid">
                <div className="evidence-card">
                  <div className="label" style={{ color: 'var(--amber)' }}>
                    {sectionLabels.why_it_matters || 'Why it matters'}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--crust)' }}>
                    {encounter.behind_the_memory.why_it_matters}
                  </p>
                </div>
                <div className="evidence-card">
                  <div className="label" style={{ color: 'var(--amber)' }}>
                    {sectionLabels.simplifies || 'How the game simplifies this'}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--crust)' }}>
                    {encounter.behind_the_memory.how_the_game_simplifies}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Primary NASA Sources */}
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px', display: 'grid', gap: '8px' }}>
            <div className="label" style={{ color: 'var(--amber)' }}>
              {sectionLabels.sources || 'Sources'} ({resolvedSources.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {resolvedSources.map((src) => (
                <a
                  key={src.id}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary btn-sm"
                >
                  {src.title} ({src.organization}) ↗
                </a>
              ))}
            </div>
          </div>
        </article>

        {/* 2. CYAN MEMORY ECHO CONSOLE SECOND (Never mixed with Verified Record) */}
        <section className="console" style={{ padding: '18px', display: 'grid', gap: '12px' }}>
          <div className="c-head">
            <span className="tag-story">
              <span className="signal-dot" aria-hidden="true" />
              Memory echo · Game story
            </span>
            <span className="mono muted" style={{ fontSize: '11px' }}>
              {encounter ? `Encounter #${String(encounter.order).padStart(2, '0')}` : 'Archive Hook'}
            </span>
          </div>

          <div className="mono" style={{ fontSize: '12px', color: 'var(--muted)' }}>
            {echoFrameText}
          </div>

          <blockquote style={{ fontSize: '16px', fontStyle: 'italic', color: 'var(--cyan-glow)' }}>
            "{mission.story_hook}"
          </blockquote>

          {encounter && (
            <div style={{ display: 'grid', gap: '8px', color: 'var(--ink)', fontSize: '15px' }}>
              {encounter.memory_echo.intro.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          )}

          {encounter && onTuneEncounter && (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '4px' }}>
              <button
                className="btn-observatory btn-sm"
                onClick={() => {
                  telemetryAudio.playSignalLock();
                  onTuneEncounter(encounter.id);
                }}
              >
                ▶ TUNE TO ENCOUNTER: {encounter.title}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
