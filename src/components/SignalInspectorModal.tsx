import { useEffect, useState } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';
import { CLAIM_LEDGER } from '../data/ledgers';
import { MISSION_DETAILS, STATUS_LABELS } from '../data/missionDetails';
import missionsData from '../data/missions.json';
import sourcesData from '../data/sources.json';

export type MissionRecord = (typeof missionsData.records)[number];

interface SignalInspectorModalProps {
  mission: MissionRecord;
  isBookmarked: boolean;
  isEncounterCompleted: boolean;
  onToggleBookmark: (missionId: string) => void;
  onSelectMission: (mission: MissionRecord) => void;
  onClose: () => void;
  onLaunchEncounter?: (missionId: string, encounterId: string) => void;
}

type DetailLayer = 1 | 2 | 3 | 4;

export function SignalInspectorModal({
  mission,
  isBookmarked,
  isEncounterCompleted,
  onToggleBookmark,
  onSelectMission,
  onClose,
  onLaunchEncounter,
}: SignalInspectorModalProps) {
  const [layer, setLayer] = useState<DetailLayer>(1);
  const detail = MISSION_DETAILS[mission.id];
  const statusInfo = STATUS_LABELS[mission.status] ?? {
    label: mission.status,
    tone: 'muted' as const,
  };
  const resolvedSources = sourcesData.sources.filter((s) =>
    mission.source_ids.includes(s.id)
  );
  const relatedClaims = CLAIM_LEDGER.filter((c) => c.missionId === mission.id);
  const relatedMissions = (detail?.relatedIds ?? [])
    .map((id) => missionsData.records.find((m) => m.id === id))
    .filter((m): m is MissionRecord => Boolean(m));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-mission-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel panel notch-corner">
        <div className="modal-header">
          <div className="modal-title-group">
            <img
              src={detail?.sprite ?? '/assets/generated/sprites/voyager.png'}
              alt={`${mission.name} spacecraft illustration`}
              className="modal-sprite pixel-art"
            />
            <div>
              <div className="modal-badges">
                <span className="pill-tag">{mission.chapter.toUpperCase()}</span>
                <span className={`status-pill status-${statusInfo.tone}`}>
                  {statusInfo.label}
                </span>
                {mission.featured && (
                  <span className="pill-tag pill-cyan">
                    {isEncounterCompleted ? '★ FEATURED · UNLOCKED' : '★ FEATURED ENCOUNTER'}
                  </span>
                )}
              </div>
              <h2 id="modal-mission-title">{mission.name}</h2>
              <p className="modal-meta">
                {mission.destination} · Launched {mission.launch_date} ·{' '}
                {mission.agencies.join(' / ')}
              </p>
            </div>
          </div>
          <div className="modal-header-actions">
            <button
              type="button"
              className={`btn ${isBookmarked ? 'btn-amber' : ''}`}
              aria-pressed={isBookmarked}
              onClick={() => {
                telemetryAudio.playChirp(
                  680,
                  0.05,
                  isBookmarked ? 'Bookmark removed' : 'Mission bookmarked'
                );
                onToggleBookmark(mission.id);
              }}
            >
              {isBookmarked ? '★ BOOKMARKED' : '☆ BOOKMARK'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={onClose}
              aria-label="Close mission dossier"
            >
              ✕ CLOSE
            </button>
          </div>
        </div>

        {/* 4-Layer Progressive Detail Tabs */}
        <div className="layer-tabs" role="tablist" aria-label="Mission detail depth layers">
          {(
            [
              { id: 1, label: '1. Memory Echo (Story)' },
              { id: 2, label: '2. Mission Console (Record)' },
              { id: 3, label: '3. Deep Dive & Links' },
              { id: 4, label: '4. Sources & Claims' },
            ] as Array<{ id: DetailLayer; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={layer === tab.id}
              className={`stage-chip ${layer === tab.id ? 'active' : ''}`}
              onClick={() => {
                telemetryAudio.playChirp(580, 0.04);
                setLayer(tab.id);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="modal-body">
          {layer === 1 && (
            <div className="voice-echo modal-section">
              <div className="voice-header">
                <span className="pill-tag pill-cyan">
                  MEMORY ECHO · DRAMATIZED PERSPECTIVE
                </span>
                <span className="pill-tag">SI-GENERATED ILLUSTRATION · CC0</span>
              </div>
              <blockquote className="echo-quote">“{mission.story_hook}”</blockquote>
              {detail?.memoryEcho && <p className="record-paragraph">{detail.memoryEcho}</p>}
              <p className="muted-caption">
                Attribution note: The voice above is a fictionalized memory echo inspired by the
                mission’s historical engineering role. Switch to Layers 2–4 for strictly verified
                NASA mission data and primary records.
              </p>
            </div>
          )}

          {layer === 2 && (
            <div className="voice-record modal-section">
              <span className="pill-tag pill-amber">
                VERIFIED ARCHIVE RECORD · {detail?.decade ?? mission.launch_date.slice(0, 4)}
              </span>
              <p className="record-paragraph">
                {detail?.archivistNote ?? mission.objective}
              </p>
              <div className="telemetry-kv">
                <div>
                  <span className="kv-label">DESTINATION / LOCATION</span>
                  <span className="kv-val">{mission.location_summary}</span>
                </div>
                <div>
                  <span className="kv-label">PRIMARY OBJECTIVE</span>
                  <span className="kv-val">{mission.objective}</span>
                </div>
                <div>
                  <span className="kv-label">TIMELINE (LAUNCH → ARRIVAL → END)</span>
                  <span className="kv-val">
                    {mission.launch_date} → {mission.arrival_date ?? 'N/A'} →{' '}
                    {mission.mission_end_date ?? 'Active / Ongoing'}
                  </span>
                </div>
                <div>
                  <span className="kv-label">HARDWARE / INSTRUMENTS</span>
                  <span className="kv-val">
                    {(detail?.instruments ?? mission.hardware_types).join(' · ')}
                  </span>
                </div>
                {detail?.constraint && (
                  <div>
                    <span className="kv-label">KEY ENGINEERING CONSTRAINT</span>
                    <span className="kv-val">{detail.constraint}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {layer === 3 && (
            <div className="modal-section">
              <span className="pill-tag pill-amber">
                SCIENCE MEASUREMENTS, UNCERTAINTY & CONNECTIONS
              </span>
              <div className="telemetry-kv">
                <div>
                  <span className="kv-label">SCIENCE SUMMARY</span>
                  <span className="kv-val">{mission.science_summary}</span>
                </div>
                {detail?.measurements && (
                  <div>
                    <span className="kv-label">NOTABLE MEASUREMENTS</span>
                    <span className="kv-val">{detail.measurements}</span>
                  </div>
                )}
                {detail?.uncertaintyNote && (
                  <div>
                    <span className="kv-label">SCIENTIFIC UNCERTAINTY / CONTEXT</span>
                    <span className="kv-val">{detail.uncertaintyNote}</span>
                  </div>
                )}
              </div>

              {relatedMissions.length > 0 && (
                <div className="related-missions-box">
                  <span className="kv-label">CONNECTED ARCHIVE MISSIONS</span>
                  <div className="related-pills">
                    {relatedMissions.map((rel) => (
                      <button
                        key={rel.id}
                        type="button"
                        className="btn"
                        onClick={() => onSelectMission(rel)}
                      >
                        OPEN: {rel.name.toUpperCase()} →
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {layer === 4 && (
            <div className="modal-section">
              <span className="pill-tag pill-amber">
                CITATIONS, NASA MEDIA & CLAIM PROVENANCE
              </span>
              <div className="telemetry-kv">
                <div>
                  <span className="kv-label">IMAGE & VISUAL DISCLOSURE</span>
                  <span className="kv-val">
                    {detail?.authenticLabel ??
                      'Official NASA mission record (Pixel illustration in-game)'}{' '}
                    —{' '}
                    <a
                      href={mission.media_page_url}
                      target="_blank"
                      rel="noreferrer"
                      className="citation-link"
                    >
                      Official {mission.name} NASA Media Gallery ↗
                    </a>
                  </span>
                </div>
              </div>

              <div className="sources-list">
                <h4>Primary Authoritative Sources</h4>
                {resolvedSources.map((src) => (
                  <div key={src.id} className="source-row">
                    <span className="pill-tag">{src.tier}</span>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="citation-link"
                    >
                      [{src.organization}] {src.title} ↗
                    </a>
                  </div>
                ))}
              </div>

              {relatedClaims.length > 0 && (
                <div className="claims-box">
                  <h4>In-Game Claim Ledger</h4>
                  {relatedClaims.map((cl) => (
                    <div key={cl.claimId} className="claim-item">
                      <strong>{cl.publishedWording}</strong>
                      <p>
                        {cl.confidenceNote} ({cl.reviewer})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <span className="muted-caption">
            Catalog ID: <code>{mission.id}</code>
          </span>
          <div className="modal-header-actions">
            {mission.featured_encounter_id && onLaunchEncounter && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const encId = mission.featured_encounter_id;
                  if (encId) onLaunchEncounter(mission.id, encId);
                }}
              >
                {isEncounterCompleted ? 'REPLAY ENCOUNTER →' : 'LAUNCH ENCOUNTER →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
