import { useState, useEffect } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';

export interface EncounterProps {
  missionId: string;
  onComplete: (badgeId: string) => void;
  onExit: () => void;
}

export function SurveyorEncounterPreview({ missionId: _missionId, onComplete, onExit }: EncounterProps) {
  const [altitude, setAltitude] = useState<number>(1200);
  const [velocity, setVelocity] = useState<number>(28);
  const [fuel, setFuel] = useState<number>(100);
  const [gameState, setGameState] = useState<'descending' | 'success' | 'crashed'>('descending');
  const [radarPing, setRadarPing] = useState<string>('OCEANUS PROCELLARUM // RETURNING ECHO');

  // Physics descent loop
  useEffect(() => {
    if (gameState !== 'descending') return;

    const timer = setInterval(() => {
      setAltitude((prevAlt) => {
        const nextAlt = prevAlt - velocity * 0.15;
        if (nextAlt <= 0) {
          clearInterval(timer);
          // Check landing threshold
          if (velocity <= 6) {
            setGameState('success');
            telemetryAudio.playSignalLock();
            onComplete('surveyor-1-touchdown');
          } else {
            setGameState('crashed');
            telemetryAudio.playThruster();
          }
          return 0;
        }
        return Math.floor(nextAlt);
      });

      // Lunar gravity acceleration
      setVelocity((prevVel) => Math.min(65, prevVel + 0.3));
    }, 100);

    return () => clearInterval(timer);
  }, [gameState, velocity, onComplete]);

  // Pulse thrusters
  const handlePulse = () => {
    if (gameState !== 'descending' || fuel <= 0) return;
    telemetryAudio.playThruster();
    setFuel((f) => Math.max(0, f - 6));
    setVelocity((v) => Math.max(1, v - 5.5));
  };

  const handleRadar = () => {
    telemetryAudio.playSignalLock();
    setRadarPing(`RADAR LOCK // ALT: ${altitude}m // RETURN SIG: OPTIMAL`);
  };

  const handleRestart = () => {
    setAltitude(1200);
    setVelocity(28);
    setFuel(100);
    setGameState('descending');
    setRadarPing('OCEANUS PROCELLARUM // RETURNING ECHO');
  };

  return (
    <div
      style={{
        background: 'var(--panel)',
        border: '1px solid var(--line)',
        borderTop: '3px solid var(--cyan)',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        maxWidth: '800px',
        margin: '0 auto',
        width: '100%',
      }}
    >
      {/* Encounter Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '12px' }}>
        <div>
          <span className="tag-story">Encounter 01 // Surveyor 1</span>
          <h2 style={{ fontSize: '20px', color: 'var(--ink)', marginTop: '4px' }}>A Gentle Touch: Soft-Landing Telemetry</h2>
        </div>
        <button className="btn-secondary" onClick={onExit} style={{ fontSize: '11px', padding: '6px 12px' }}>
          [ EXIT ENCOUNTER ]
        </button>
      </div>

      {/* 640x360 feel Telemetry Canvas Stage */}
      <div
        style={{
          background: 'linear-gradient(to bottom, #05070f 0%, #131a2e 70%, #27293d 100%)',
          border: '1px solid var(--cyan-deep)',
          padding: '30px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '280px',
          position: 'relative',
        }}
      >
        {/* Telemetry Readout Bar */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: 'var(--f-mono)',
            fontSize: '12px',
            color: 'var(--cyan)',
            borderBottom: '1px solid rgba(14, 195, 220, 0.2)',
            paddingBottom: '8px',
          }}
        >
          <span>ALTITUDE: <b>{Math.max(0, altitude)} m</b></span>
          <span>VELOCITY: <b style={{ color: velocity > 6 ? 'var(--amber)' : 'var(--cyan)' }}>{velocity.toFixed(1)} m/s</b></span>
          <span>FUEL: <b style={{ color: fuel < 20 ? 'var(--rust)' : 'var(--cyan)' }}>{fuel}%</b></span>
        </div>

        {/* Lander Sprite Animation */}
        <div
          style={{
            transform: `translateY(${Math.min(130, Math.floor((1200 - altitude) / 9))}px)`,
            transition: 'transform 0.1s linear',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <img
            src="/assets/sprites/surveyor.png"
            alt="Surveyor 1"
            className="pixelated"
            style={{ width: '64px', height: 'auto' }}
          />
          {gameState === 'descending' && fuel > 0 && (
            <div
              style={{
                width: '6px',
                height: '14px',
                background: 'linear-gradient(to bottom, var(--thruster), transparent)',
                boxShadow: '0 0 8px var(--thruster)',
              }}
            />
          )}
        </div>

        {/* Lunar Surface Ground Line */}
        <div
          style={{
            width: '100%',
            height: '18px',
            background: 'var(--basalt)',
            borderTop: '2px solid var(--crust)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'var(--f-mono)',
            fontSize: '10px',
            color: 'var(--muted)',
          }}
        >
          ─── LUNAR SURFACE: OCEANUS PROCELLARUM ───
        </div>
      </div>

      {/* Radar Feedback Note */}
      <div style={{ fontFamily: 'var(--f-mono)', fontSize: '11px', color: 'var(--muted)', textAlign: 'center' }}>
        📡 {radarPing}
      </div>

      {/* Controls & End State */}
      {gameState === 'descending' ? (
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            className="btn-observatory"
            onClick={handlePulse}
            disabled={fuel <= 0}
            style={{ padding: '14px 28px', fontSize: '13px' }}
          >
            🔥 PULSE VERNIER ENGINES (-6% FUEL)
          </button>
          <button className="btn-secondary" onClick={handleRadar}>
            📡 PING RADAR ALTIMETER
          </button>
        </div>
      ) : gameState === 'success' ? (
        <div className="voice-story" style={{ padding: '16px', textAlign: 'center', display: 'grid', gap: '10px' }}>
          <h3 style={{ color: 'var(--cyan)' }}>🎉 TOUCHDOWN VERIFIED // SIGNAL RECONSTRUCTED!</h3>
          <p style={{ color: 'var(--ink)' }}>
            Surveyor 1 touched down softly on June 2, 1966. Its radar altimeter and vernier decelerations executed flawlessly.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <span className="status-badge active">AWARDED: SURVEYOR 1 TOUCHDOWN BADGE</span>
            <button className="btn-secondary" onClick={handleRestart}>
              RE-RUN SIMULATION ↺
            </button>
          </div>
        </div>
      ) : (
        <div className="voice-record" style={{ padding: '16px', textAlign: 'center', display: 'grid', gap: '10px' }}>
          <h3 style={{ color: 'var(--rust)' }}>⚠️ IMPACT VELOCITY EXCEEDED</h3>
          <p style={{ color: 'var(--ink)' }}>
            Touchdown velocity was {velocity.toFixed(1)} m/s (safe threshold: &lt; 6.0 m/s). Vernier burns must be sequenced earlier.
          </p>
          <div>
            <button className="btn-observatory" onClick={handleRestart}>
              RETRY DESCENT ↺
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
