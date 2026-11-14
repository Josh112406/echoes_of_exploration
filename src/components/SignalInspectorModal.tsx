import { useEffect } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';

export interface MissionRecord {
  id: string;
  name: string;
  chapter: string;
  featured: boolean;
  agencies: string[];
  hardware_types: string[];
  destination: string;
  launch_date: string;
  arrival_date?: string;
  mission_end_date?: string | null;
  status: string;
  location_summary: string;
  objective: string;
  science_summary: string;
  story_hook: string;
  source_ids: string[];
  media_page_url: string;
}

interface SignalInspectorModalProps {
  mission: MissionRecord | null;
  onClose: () => void;
}

export function SignalInspectorModal({ mission, onClose }: SignalInspectorModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        telemetryAudio.playChirp(700, 0.03);
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!mission) return null;

  // Determine sprite based on hardware or destination
  let spriteSrc = '/assets/sprites/rocket.png';
  if (mission.id.includes('surveyor')) spriteSrc = '/assets/sprites/surveyor.png';
  else if (mission.id.includes('apollo') || mission.hardware_types.includes('descent stage')) spriteSrc = '/assets/sprites/lm.png';
  else if (mission.chapter === 'mars' && (mission.hardware_types.includes('rover') || mission.id.includes('curiosity') || mission.id.includes('opportunity'))) spriteSrc = '/assets/sprites/curiosity.png';
  else if (mission.chapter === 'moon') spriteSrc = '/assets/sprites/surveyor.png';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(5, 7, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={() => {
        telemetryAudio.playChirp(700, 0.03);
        onClose();
      }}
    >
      <div
        className="hud-panel voice-story"
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: 'var(--panel)',
          padding: '28px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--line)', paddingBottom: '14px' }}>
          <div>
            <div className="eyebrow" style={{ color: mission.chapter === 'mars' ? 'var(--rust)' : 'var(--cyan)' }}>
              {mission.chapter.toUpperCase()} CHAPTER // BEACON ID: {mission.id}
            </div>
            <h2 style={{ fontSize: '24px', color: 'var(--ink)', marginTop: '4px' }}>{mission.name}</h2>
          </div>
          <button
            className="btn-secondary"
            onClick={() => {
              telemetryAudio.playChirp(700, 0.03);
              onClose();
            }}
            style={{ padding: '4px 10px', fontSize: '11px' }}
          >
            [ ESC // CLOSE ✕ ]
          </button>
        </div>

        {/* Visual Sprite & Telemetry Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '24px', alignItems: 'center' }}>
          <div
            style={{
              width: '100px',
              height: '100px',
              border: '1px solid var(--line)',
              background: 'var(--void)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px',
            }}
          >
            <img src={spriteSrc} alt={mission.name} className="pixelated" style={{ maxWidth: '100%', maxHeight: '100%' }} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', fontFamily: 'var(--f-mono)', fontSize: '12px' }}>
            <div style={{ background: 'var(--void)', padding: '8px', border: '1px solid var(--line)' }}>
              <span className="muted" style={{ display: 'block', fontSize: '10px' }}>DESTINATION</span>
              <b>{mission.destination}</b>
            </div>
            <div style={{ background: 'var(--void)', padding: '8px', border: '1px solid var(--line)' }}>
              <span className="muted" style={{ display: 'block', fontSize: '10px' }}>LAUNCH DATE</span>
              <b>{mission.launch_date}</b>
            </div>
            <div style={{ background: 'var(--void)', padding: '8px', border: '1px solid var(--line)' }}>
              <span className="muted" style={{ display: 'block', fontSize: '10px' }}>CURRENT STATUS</span>
              <span className={`status-badge ${mission.status.includes('impact') ? 'impacted' : mission.status === 'operational' ? 'active' : 'dormant'}`} style={{ display: 'inline-block', marginTop: '2px' }}>
                {mission.status}
              </span>
            </div>
          </div>
        </div>

        {/* Story Voice (Cyan) */}
        <div className="voice-story" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="tag-story">Memory Echo (Narrative Voice)</span>
          <p style={{ fontStyle: 'italic', color: 'var(--ink)', fontSize: '15px' }}>
            "{mission.story_hook}"
          </p>
          <div className="muted" style={{ fontSize: '12px' }}>
            Dramatized memory hook representing the silent explorer's vantage point.
          </div>
        </div>

        {/* Science Voice (Amber) */}
        <div className="voice-record" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <span className="tag-record">Verified Record (NASA Primary Data)</span>
          <p style={{ color: 'var(--ink)', fontSize: '14px', lineHeight: '1.5' }}>
            {mission.science_summary || mission.objective}
          </p>
          <div style={{ fontFamily: 'var(--f-mono)', fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            📍 <b>Resting Coordinates:</b> {mission.location_summary}
          </div>
        </div>

        {/* Footer Links */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', paddingTop: '10px', borderTop: '1px solid var(--line)' }}>
          <div className="muted" style={{ fontFamily: 'var(--f-mono)', fontSize: '11px' }}>
            AGENCIES: {mission.agencies.join(', ')} // TYPE: {mission.hardware_types.join(', ')}
          </div>
          <a
            href={mission.media_page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-observatory"
            style={{ fontSize: '11px', padding: '6px 12px' }}
          >
            VIEW ON NASA SCIENCE ↗
          </a>
        </div>
      </div>
    </div>
  );
}
