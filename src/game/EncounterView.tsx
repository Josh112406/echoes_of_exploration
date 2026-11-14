import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';
import campaignData from '../data/campaign.json';
import encountersData from '../data/encounters.json';
import { ENCOUNTER_CONFIGS, MISSION_DETAILS, STATUS_LABELS } from '../data/missionDetails';
import missionsData from '../data/missions.json';
import sourcesData from '../data/sources.json';

export interface EncounterProps {
  missionId: string;
  onComplete: (badgeId: string) => void;
  onExit: () => void;
}

export interface ExtendedEncounterProps extends EncounterProps {
  encounterId?: string;
  assistMode?: boolean;
  nonCanvasMode?: boolean;
  reducedMotion?: boolean;
  alreadyCompleted?: boolean;
  onLaunchNext?: (missionId: string, encounterId: string) => void;
  onOpenArchive?: (missionId: string) => void;
}

type EncounterStage = 'hook' | 'console' | 'task' | 'evidence' | 'behind';

interface InteractiveTelemetryState {
  // gentle-touch
  altitude: number;
  velocity: number;
  throttling: boolean;
  simDone: boolean;
  // echo-never-sleeps
  laserAngle: number;
  photonsLocked: number;
  // farther-than-footsteps
  waypoints: string[];
  // question-in-the-soil
  testedLr: boolean;
  testedGcms: boolean;
  // clues-beneath-the-wheel
  roverX: number;
  silicaFound: boolean;
  // air-thin-as-a-whisper
  rotorRpm: number;
  batteryHeated: boolean;
  heloAltitude: number;
  // landing-not-planned
  burnsDone: number;
  erosVelocity: number;
  // power-for-the-unknown
  camerasOff: boolean;
  heatersOn: boolean;
  scienceOn: boolean;
  dsnOn: boolean;
  // one-chance-at-pluto
  scheduledCapture: boolean;
  scheduledStore: boolean;
  scheduledDownlink: boolean;
}

const DEFAULT_SIM_STATE: InteractiveTelemetryState = {
  altitude: 100,
  velocity: 18,
  throttling: false,
  simDone: false,
  laserAngle: -16,
  photonsLocked: 0,
  waypoints: [],
  testedLr: false,
  testedGcms: false,
  roverX: 120,
  silicaFound: false,
  rotorRpm: 1200,
  batteryHeated: false,
  heloAltitude: 0,
  burnsDone: 0,
  erosVelocity: 10.2,
  camerasOff: false,
  heatersOn: true,
  scienceOn: true,
  dsnOn: true,
  scheduledCapture: false,
  scheduledStore: false,
  scheduledDownlink: false,
};

export function EncounterView({
  missionId,
  encounterId,
  onComplete,
  onExit,
  assistMode = false,
  nonCanvasMode = false,
  reducedMotion = false,
  alreadyCompleted = false,
  onLaunchNext,
  onOpenArchive,
}: ExtendedEncounterProps) {
  const encounter = useMemo(() => {
    return (
      encountersData.encounters.find((e) => e.id === encounterId) ??
      encountersData.encounters.find((e) => e.mission_id === missionId) ??
      encountersData.encounters[0]
    );
  }, [encounterId, missionId]);

  const campaignEntry = useMemo(() => {
    return (
      campaignData.encounters.find((e) => e.id === encounter.id) ??
      campaignData.encounters[0]
    );
  }, [encounter.id]);

  const mission = useMemo(() => {
    return (
      missionsData.records.find((m) => m.id === encounter.mission_id) ??
      missionsData.records[0]
    );
  }, [encounter.mission_id]);

  const detail = MISSION_DETAILS[mission.id];
  const config = ENCOUNTER_CONFIGS[encounter.id];
  const primarySource = sourcesData.sources.find((s) => s.id === encounter.primary_source_id);
  const statusInfo = STATUS_LABELS[mission.status] ?? {
    label: mission.status,
    tone: 'muted' as const,
  };

  const [stage, setStage] = useState<EncounterStage>('hook');
  const [accessibleMode, setAccessibleMode] = useState<boolean>(nonCanvasMode);
  const [paused, setPaused] = useState<boolean>(false);
  const [softFailures, setSoftFailures] = useState<number>(0);
  const [juniorGuidanceOpen, setJuniorGuidanceOpen] = useState<boolean>(assistMode);
  const [feedbackBanner, setFeedbackBanner] = useState<{
    tone: 'cyan' | 'amber' | 'rust';
    text: string;
  } | null>(null);
  const [selectedChoiceId, setSelectedChoiceId] = useState<string | null>(null);
  const [patchAwarded, setPatchAwarded] = useState<boolean>(alreadyCompleted);
  const [sim, setSim] = useState<InteractiveTelemetryState>(DEFAULT_SIM_STATE);
  const simRef = useRef<InteractiveTelemetryState>(DEFAULT_SIM_STATE);

  const updateSim = useCallback(
    (updater: (prev: InteractiveTelemetryState) => InteractiveTelemetryState) => {
      const next = updater(simRef.current);
      simRef.current = next;
      setSim(next);
      return next;
    },
    []
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneImgRef = useRef<HTMLImageElement | null>(null);
  const spriteImgRef = useRef<HTMLImageElement | null>(null);

  // Preload crisp raster images for the 640x360 canvas
  useEffect(() => {
    const bg = new Image();
    bg.src = campaignEntry.scene_image;
    bg.onload = () => {
      sceneImgRef.current = bg;
    };

    const sp = new Image();
    sp.src = campaignEntry.sprite;
    sp.onload = () => {
      spriteImgRef.current = sp;
    };
  }, [campaignEntry.scene_image, campaignEntry.sprite]);

  // Auto-pause active simulation on window focus loss
  useEffect(() => {
    const handleBlur = () => {
      if (stage === 'task' && !accessibleMode) {
        setPaused(true);
      }
    };
    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [stage, accessibleMode]);

  const registerSoftFailure = useCallback((message: string) => {
    telemetryAudio.playSoftFail();
    setFeedbackBanner({ tone: 'rust', text: message });
    setSoftFailures((prev) => {
      const next = prev + 1;
      if (next >= 2) {
        setJuniorGuidanceOpen(true);
      }
      return next;
    });
  }, []);

  const completeTaskSignalLock = useCallback(
    (successMessage: string) => {
      telemetryAudio.playSignalLock();
      setFeedbackBanner({ tone: 'cyan', text: successMessage });
      setStage('evidence');
    },
    []
  );

  const handleUnlockPatchAndAdvance = useCallback(() => {
    if (!patchAwarded) {
      telemetryAudio.playSuccessFanfare();
      onComplete(campaignEntry.patch_id);
      setPatchAwarded(true);
    } else {
      telemetryAudio.playChirp(740, 0.06, 'Archive dossier opened');
    }
    setStage('behind');
  }, [patchAwarded, onComplete, campaignEntry.patch_id]);

  // Keyboard shortcuts for pause ('p') and choices ('1','2','3')
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && paused) {
        setPaused(false);
        return;
      }
      if ((e.key === 'p' || e.key === 'P') && stage === 'task') {
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [stage, paused]);

  // Physics / animation tick for live canvas missions
  useEffect(() => {
    if (stage !== 'task' || accessibleMode || paused) return;

    const timer = window.setInterval(() => {
      const curr = simRef.current;
      if (encounter.id === 'gentle-touch' && !curr.simDone) {
        const gravity = 0.55;
        const thrust = curr.throttling ? 1.35 : 0;
        const nextVel = Math.max(1.2, Math.min(24, curr.velocity + gravity - thrust));
        const nextAlt = Math.max(0, curr.altitude - nextVel * 0.19);
        if (nextAlt <= 0) {
          const roundedVel = Number(nextVel.toFixed(1));
          if (roundedVel <= 4.2) {
            updateSim((p) => ({ ...p, altitude: 0, velocity: roundedVel, simDone: true }));
            completeTaskSignalLock(
              config.choices.find((c) => c.isOptimal)?.feedback ??
                'Signal Lock! Soft touchdown achieved within safe leg tolerances.'
            );
          } else {
            registerSoftFailure(
              `Touchdown rate ${roundedVel.toFixed(1)} m/s exceeded the 4.0 m/s Surveyor shock limit. Pulse vernier braking earlier to slow below 4.0 m/s.`
            );
            updateSim(() => ({ ...DEFAULT_SIM_STATE }));
          }
        } else {
          updateSim((p) => ({
            ...p,
            altitude: Number(nextAlt.toFixed(1)),
            velocity: Number(nextVel.toFixed(1)),
          }));
        }
      }
    }, 100);

    return () => window.clearInterval(timer);
  }, [
    stage,
    accessibleMode,
    paused,
    encounter.id,
    updateSim,
    completeTaskSignalLock,
    registerSoftFailure,
    config.choices,
  ]);

  // Render the 640x360 Telemetry Simulation Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b1020';
    ctx.fillRect(0, 0, 640, 360);

    if (sceneImgRef.current) {
      ctx.drawImage(sceneImgRef.current, 0, 0, 640, 360);
    }

    // Subtle dark gradient at top/bottom for telemetry readability
    const topGrad = ctx.createLinearGradient(0, 0, 0, 74);
    topGrad.addColorStop(0, 'rgba(7, 10, 20, 0.84)');
    topGrad.addColorStop(1, 'rgba(7, 10, 20, 0)');
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, 640, 74);

    // Draw mission-specific telemetry overlay & sprite placement
    const sp = spriteImgRef.current;
    if (encounter.id === 'gentle-touch') {
      const yPos = 68 + ((100 - sim.altitude) / 100) * 165;
      if (sim.throttling && !reducedMotion) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(306, yPos + 74, 8, 20);
        ctx.fillRect(328, yPos + 74, 8, 20);
      }
      if (sp) ctx.drawImage(sp, 272, yPos, 96, 96);
      // HUD gauges
      ctx.fillStyle = '#0ec3dc';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`ALT: ${sim.altitude.toFixed(1)} m`, 20, 28);
      ctx.fillStyle = sim.velocity <= 4.0 ? '#27c485' : '#f59e0b';
      ctx.fillText(`RATE: ${sim.velocity.toFixed(1)} m/s (TARGET <= 4.0)`, 20, 48);
    } else if (encounter.id === 'echo-never-sleeps') {
      // Laser beam from observatory corner to retroreflector
      if (sp) ctx.drawImage(sp, 276, 194, 88, 88);
      const targetX = 320;
      const beamX = targetX + sim.laserAngle * 7;
      ctx.strokeStyle = Math.abs(sim.laserAngle) <= 2 ? '#27c485' : '#0ec3dc';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(96, 326);
      ctx.lineTo(beamX, 238);
      ctx.stroke();

      ctx.strokeStyle = '#f59e0b';
      ctx.strokeRect(298, 216, 44, 44);
      ctx.fillStyle = '#eef2ff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`LASER OFFSET: ${sim.laserAngle > 0 ? '+' : ''}${sim.laserAngle} deg`, 20, 28);
      ctx.fillStyle = '#0ec3dc';
      ctx.fillText(`RETURN PHOTONS LOCKED: ${sim.photonsLocked}/3`, 20, 48);
    } else if (encounter.id === 'farther-than-footsteps') {
      const nodes = [
        { id: 'LM Base', x: 110, y: 264 },
        { id: 'Shorty Crater (Orange Soil)', x: 260, y: 222 },
        { id: 'Tracy Boulder', x: 430, y: 248 },
        { id: 'Station 6 Escarpment', x: 535, y: 205 },
      ];
      ctx.strokeStyle = '#0ec3dc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nodes[0].x, nodes[0].y);
      nodes.forEach((n) => {
        if (sim.waypoints.includes(n.id)) ctx.lineTo(n.x, n.y);
      });
      ctx.stroke();

      nodes.forEach((n) => {
        const visited = n.id === 'LM Base' || sim.waypoints.includes(n.id);
        ctx.fillStyle = visited ? '#f59e0b' : '#4a5d8a';
        ctx.fillRect(n.x - 8, n.y - 8, 16, 16);
        ctx.fillStyle = '#eef2ff';
        ctx.font = '12px monospace';
        ctx.fillText(n.id, n.x - 28, n.y + 24);
      });
      if (sp) ctx.drawImage(sp, 64, 210, 88, 88);
    } else if (encounter.id === 'question-in-the-soil') {
      if (sp) ctx.drawImage(sp, 250, 175, 112, 112);
      ctx.fillStyle = '#0ec3dc';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(
        `LABELED RELEASE ASSAY: ${sim.testedLr ? 'GAS DETECTED (+)' : 'PENDING'}`,
        20,
        28
      );
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(
        `GC-MS ORGANICS ASSAY: ${sim.testedGcms ? 'NONE DETECTED (-)' : 'PENDING'}`,
        20,
        48
      );
    } else if (encounter.id === 'clues-beneath-the-wheel') {
      // Bright silica vein at x=460
      ctx.fillStyle = sim.silicaFound ? '#eef2ff' : '#9c5a44';
      ctx.fillRect(445, 272, 64, 18);
      if (sim.silicaFound) {
        ctx.fillStyle = '#0ec3dc';
        ctx.font = 'bold 13px monospace';
        ctx.fillText('90% OPALINE SILICA EXPOSED', 392, 260);
      }
      if (sp) ctx.drawImage(sp, sim.roverX, 198, 96, 96);
      ctx.fillStyle = '#eef2ff';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`SOL 1148 · ROVER X: ${sim.roverX} mm`, 20, 28);
    } else if (encounter.id === 'air-thin-as-a-whisper') {
      const y = 215 - sim.heloAltitude * 28;
      if (sp) ctx.drawImage(sp, 276, y, 88, 88);
      ctx.fillStyle = '#0ec3dc';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`ROTOR RPM: ${sim.rotorRpm} RPM (NEED ~2537)`, 20, 28);
      ctx.fillStyle = sim.batteryHeated ? '#27c485' : '#f59e0b';
      ctx.fillText(
        `OVERNIGHT HEATER: ${sim.batteryHeated ? 'NOMINAL (-15 C)' : 'COLD LOCK'} · ALT: ${sim.heloAltitude} m`,
        20,
        48
      );
    } else if (encounter.id === 'landing-not-planned') {
      const altY = 82 + sim.burnsDone * 34;
      if (sp) ctx.drawImage(sp, 268, altY, 96, 96);
      ctx.fillStyle = '#0ec3dc';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`EROS EDB BURNS COMPLETED: ${sim.burnsDone}/4`, 20, 28);
      ctx.fillStyle = sim.erosVelocity <= 1.8 ? '#27c485' : '#f59e0b';
      ctx.fillText(`DESCENT VELOCITY: ${sim.erosVelocity.toFixed(1)} m/s`, 20, 48);
    } else if (encounter.id === 'power-for-the-unknown') {
      if (sp) ctx.drawImage(sp, 256, 118, 128, 128);
      const busLoad =
        (sim.camerasOff ? 0 : 95) +
        (sim.heatersOn ? 85 : 0) +
        (sim.scienceOn ? 65 : 0) +
        (sim.dsnOn ? 65 : 0);
      ctx.fillStyle = busLoad <= 220 ? '#27c485' : '#e05347';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(`RTG OUTPUT: 220 W · CURRENT LOAD: ${busLoad} W`, 20, 28);
      ctx.fillStyle = '#0ec3dc';
      ctx.fillText(
        `CAMERAS: ${sim.camerasOff ? 'OFF' : 'ON (+95W)'} · HEATERS: ${sim.heatersOn ? 'ON' : 'OFF'} · DSN: ${sim.dsnOn ? 'ON' : 'OFF'}`,
        20,
        48
      );
    } else {
      // one-chance-at-pluto
      const xFly = sim.scheduledDownlink ? 470 : sim.scheduledStore ? 330 : 140;
      if (sp) ctx.drawImage(sp, xFly, 130, 104, 104);
      ctx.fillStyle = '#0ec3dc';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('CLOSEST APPROACH: 13.78 km/s · PLUTO 12,500 km', 20, 28);
      ctx.fillStyle = '#f59e0b';
      ctx.fillText(
        `1:OBSERVE[${sim.scheduledCapture ? 'OK' : '--'}] 2:SSR STORE[${sim.scheduledStore ? 'OK' : '--'}] 3:DSN PLAYBACK[${sim.scheduledDownlink ? 'OK' : '--'}]`,
        20,
        48
      );
    }

    // Bottom SI-GENERATED watermark inside canvas
    ctx.fillStyle = 'rgba(11, 16, 32, 0.78)';
    ctx.fillRect(10, 326, 260, 24);
    ctx.fillStyle = '#9aa6c9';
    ctx.font = '11px monospace';
    ctx.fillText('SI-GENERATED ILLUSTRATION · CC0', 18, 342);
  }, [encounter.id, sim, stage, accessibleMode, reducedMotion]);

  const submitChoice = (choiceId: string) => {
    setSelectedChoiceId(choiceId);
    const found = config.choices.find((c) => c.id === choiceId);
    if (!found) return;
    if (found.isOptimal) {
      completeTaskSignalLock(found.feedback);
    } else {
      registerSoftFailure(found.feedback);
    }
  };

  // Interactive Canvas Action Controls per encounter
  const renderCanvasControls = () => {
    switch (encounter.id) {
      case 'gentle-touch':
        return (
          <div className="sim-controls-row">
            <button
              type="button"
              aria-pressed={sim.throttling}
              className={`btn ${sim.throttling ? 'btn-amber' : 'btn-primary'}`}
              onClick={() => {
                telemetryAudio.playThruster();
                updateSim((s) => ({ ...s, throttling: !s.throttling }));
              }}
            >
              {sim.throttling ? '🔥 VERNIERS FIRING (CLICK TO CUT)' : 'IGNITE VERNIER THRUSTERS'}
            </button>
            <button
              type="button"
              className="btn"
              onClick={() =>
                updateSim(() => ({
                  ...DEFAULT_SIM_STATE,
                }))
              }
            >
              RESET DROP
            </button>
          </div>
        );

      case 'echo-never-sleeps':
        return (
          <div className="sim-controls-row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                telemetryAudio.playChirp(520, 0.04, 'Mirrors slewed left');
                setSim((s) => ({ ...s, laserAngle: s.laserAngle - 4 }));
              }}
            >
              ◀ SLEW -4°
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                telemetryAudio.playChirp(560, 0.04, 'Mirrors slewed right');
                setSim((s) => ({ ...s, laserAngle: s.laserAngle + 4 }));
              }}
            >
              SLEW +4° ▶
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (Math.abs(sim.laserAngle) <= 2) {
                  telemetryAudio.playChirp(920, 0.08, 'Laser photon return detected');
                  const nextPhotons = sim.photonsLocked + 1;
                  setSim((s) => ({ ...s, photonsLocked: nextPhotons }));
                  if (nextPhotons >= 3) {
                    completeTaskSignalLock(config.choices[1].feedback);
                  } else {
                    setFeedbackBanner({
                      tone: 'cyan',
                      text: `Photon Burst ${nextPhotons}/3 locked! Fire again to confirm distance over 2.5s light travel.`,
                    });
                  }
                } else {
                  registerSoftFailure(
                    `Beam missed the 46 cm Apollo 11 corner-cube array (offset ${sim.laserAngle}°). Align offset to 0° first.`
                  );
                }
              }}
            >
              FIRE GREEN LASER PULSE ({sim.photonsLocked}/3)
            </button>
          </div>
        );

      case 'farther-than-footsteps': {
        const toggleWaypoint = (wp: string) => {
          telemetryAudio.playChirp(620, 0.04, `Waypoint toggled: ${wp}`);
          setSim((s) => {
            const exists = s.waypoints.includes(wp);
            const nextWps = exists ? s.waypoints.filter((x) => x !== wp) : [...s.waypoints, wp];
            return { ...s, waypoints: nextWps };
          });
        };
        return (
          <div className="sim-controls-row">
            {['Shorty Crater (Orange Soil)', 'Tracy Boulder', 'Station 6 Escarpment'].map((wp) => (
              <button
                key={wp}
                type="button"
                className={`btn ${sim.waypoints.includes(wp) ? 'btn-amber' : ''}`}
                onClick={() => toggleWaypoint(wp)}
              >
                {sim.waypoints.includes(wp) ? `✓ ${wp}` : `+ ${wp}`}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (sim.waypoints.length >= 2 && sim.waypoints.length <= 3) {
                  completeTaskSignalLock(config.choices[1].feedback);
                } else {
                  registerSoftFailure(
                    'Select 2–3 high-priority geologic stations within Rover walk-back safety distance before returning to the LM.'
                  );
                }
              }}
            >
              EXECUTE TRAVERSE & RETURN TO LM
            </button>
          </div>
        );
      }

      case 'question-in-the-soil':
        return (
          <div className="sim-controls-row">
            <button
              type="button"
              className={`btn ${sim.testedLr ? 'btn-cyan' : ''}`}
              onClick={() => {
                telemetryAudio.playChirp(680, 0.05, 'Labeled Release assay complete');
                setSim((s) => ({ ...s, testedLr: true }));
              }}
            >
              1. RUN LABELED RELEASE (LR)
            </button>
            <button
              type="button"
              className={`btn ${sim.testedGcms ? 'btn-amber' : ''}`}
              onClick={() => {
                telemetryAudio.playChirp(540, 0.05, 'GC-MS assay complete');
                setSim((s) => ({ ...s, testedGcms: true }));
              }}
            >
              2. RUN GC-MS ORGANICS CHECK
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (sim.testedLr && sim.testedGcms) {
                  completeTaskSignalLock(config.choices[1].feedback);
                } else {
                  registerSoftFailure(
                    'Run BOTH the Labeled Release biology assay and the GC-MS organic test before filing a scientific interpretation.'
                  );
                }
              }}
            >
              3. LOG QUALIFIED CONCLUSION
            </button>
          </div>
        );

      case 'clues-beneath-the-wheel':
        return (
          <div className="sim-controls-row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                telemetryAudio.playChirp(320, 0.05, 'Rover drive backward');
                setSim((s) => {
                  const nx = Math.max(40, s.roverX - 60);
                  return { ...s, roverX: nx, silicaFound: nx >= 390 && nx <= 490 };
                });
              }}
            >
              ◀ BACKWARD
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                telemetryAudio.playChirp(340, 0.05, 'Rover drag-wheel forward');
                setSim((s) => {
                  const nx = Math.min(500, s.roverX + 60);
                  return { ...s, roverX: nx, silicaFound: nx >= 390 && nx <= 490 };
                });
              }}
            >
              DRAG WHEEL FORWARD ▶
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (sim.silicaFound) {
                  completeTaskSignalLock(config.choices[1].feedback);
                } else {
                  registerSoftFailure(
                    'Drive Spirit’s dragged front-right wheel onto the pale soil vein (X >= 400 mm) to expose the opaline silica before scanning.'
                  );
                }
              }}
            >
              SCAN WITH MINI-TES & APXS
            </button>
          </div>
        );

      case 'air-thin-as-a-whisper':
        return (
          <div className="sim-controls-row">
            <button
              type="button"
              className={`btn ${sim.batteryHeated ? 'btn-amber' : ''}`}
              onClick={() => {
                telemetryAudio.playChirp(600, 0.05, 'Overnight heater activated');
                setSim((s) => ({ ...s, batteryHeated: true }));
              }}
            >
              {sim.batteryHeated ? '✓ HEATER ACTIVE' : '1. ENABLE OVERNIGHT HEATER'}
            </button>
            <button
              type="button"
              className={`btn ${sim.rotorRpm >= 2500 ? 'btn-cyan' : ''}`}
              onClick={() => {
                telemetryAudio.playChirp(880, 0.07, 'Rotors spun up to 2537 RPM');
                setSim((s) => ({ ...s, rotorRpm: 2537 }));
              }}
            >
              2. SPIN UP ROTORS (2,537 RPM)
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!sim.batteryHeated || sim.rotorRpm < 2500) {
                  registerSoftFailure(
                    'Preheat batteries and spin twin carbon rotors to ~2,537 RPM to generate lift in Mars’s 1% atmosphere.'
                  );
                  return;
                }
                telemetryAudio.playThruster(0.2);
                setSim((s) => ({ ...s, heloAltitude: 3 }));
                completeTaskSignalLock(config.choices[1].feedback);
              }}
            >
              3. LAUNCH AUTONOMOUS 3M HOVER
            </button>
          </div>
        );

      case 'landing-not-planned':
        return (
          <div className="sim-controls-row">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                telemetryAudio.playThruster(0.15);
                const nextBurns = sim.burnsDone + 1;
                const nextVel = Math.max(1.5, Number((sim.erosVelocity - 2.2).toFixed(1)));
                setSim((s) => ({ ...s, burnsDone: nextBurns, erosVelocity: nextVel }));
                if (nextBurns >= 4 && nextVel <= 1.8) {
                  completeTaskSignalLock(config.choices[1].feedback);
                }
              }}
            >
              FIRE EDB DESCENT BURN ({sim.burnsDone}/4)
            </button>
          </div>
        );

      case 'power-for-the-unknown':
        return (
          <div className="sim-controls-row">
            <button
              type="button"
              className={`btn ${sim.camerasOff ? 'btn-cyan' : 'btn-rust'}`}
              onClick={() => {
                telemetryAudio.playChirp(520, 0.05, 'Camera bus toggled');
                setSim((s) => ({ ...s, camerasOff: !s.camerasOff }));
              }}
            >
              OPTICAL CAMERAS: {sim.camerasOff ? 'SHED (0 W)' : 'ON (95 W)'}
            </button>
            <button
              type="button"
              className={`btn ${sim.heatersOn ? 'btn-amber' : ''}`}
              onClick={() => setSim((s) => ({ ...s, heatersOn: !s.heatersOn }))}
            >
              THRUSTER HEATERS: {sim.heatersOn ? 'ON (85 W)' : 'OFF'}
            </button>
            <button
              type="button"
              className={`btn ${sim.scienceOn ? 'btn-amber' : ''}`}
              onClick={() => setSim((s) => ({ ...s, scienceOn: !s.scienceOn }))}
            >
              CRS/MAG/PWS: {sim.scienceOn ? 'ON (65 W)' : 'OFF'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (sim.camerasOff && sim.heatersOn && sim.scienceOn && sim.dsnOn) {
                  completeTaskSignalLock(config.choices[1].feedback);
                } else {
                  registerSoftFailure(
                    'Power load must stay <= 220 W (shed optical cameras!) while keeping heaters, CRS/MAG/PWS particle sensors, and DSN downlink active.'
                  );
                }
              }}
            >
              COMMIT INTERSTELLAR POWER BUDGET
            </button>
          </div>
        );

      default:
        // one-chance-at-pluto
        return (
          <div className="sim-controls-row">
            <button
              type="button"
              className={`btn ${sim.scheduledCapture ? 'btn-cyan' : ''}`}
              onClick={() => {
                telemetryAudio.playChirp(700, 0.05, 'Observation pointing locked');
                setSim((s) => ({ ...s, scheduledCapture: true }));
              }}
            >
              1. LOCK LORRI/RALPH BURST
            </button>
            <button
              type="button"
              className={`btn ${sim.scheduledStore ? 'btn-amber' : ''}`}
              onClick={() => {
                if (!sim.scheduledCapture) {
                  registerSoftFailure('Schedule LORRI/Ralph capture pointing before Solid-State recording.');
                  return;
                }
                telemetryAudio.playChirp(760, 0.05, 'Solid state recorder armed');
                setSim((s) => ({ ...s, scheduledStore: true }));
              }}
            >
              2. WRITE TO SOLID-STATE RECORDER
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                if (!sim.scheduledCapture || !sim.scheduledStore) {
                  registerSoftFailure(
                    'Closest approach leaves zero bandwidth for live playback—capture and store on the SSR first, then point home.'
                  );
                  return;
                }
                setSim((s) => ({ ...s, scheduledDownlink: true }));
                completeTaskSignalLock(config.choices[1].feedback);
              }}
            >
              3. TURN DISH TO EARTH (15-MO PLAYBACK)
            </button>
          </div>
        );
    }
  };

  return (
    <section className="encounter-shell panel notch-corner" aria-label={`Encounter: ${encounter.title}`}>
      {/* Encounter Header Bar */}
      <div className="encounter-topbar">
        <div>
          <span className="pill-tag pill-cyan">
            CHAPTER: {encounter.chapter.toUpperCase()} · SIGNAL #{encounter.order} OF 9
          </span>
          <h2 className="encounter-title">{encounter.title}</h2>
          <p className="encounter-subtitle">
            {mission.name} · {mission.destination} ·{' '}
            <span className={`status-pill status-${statusInfo.tone}`}>{statusInfo.label}</span>
          </p>
        </div>
        <div className="encounter-topbar-actions">
          {stage === 'task' && (
            <button
              type="button"
              className="btn"
              onClick={() => setAccessibleMode((m) => !m)}
            >
              {accessibleMode ? 'VISUAL CONSOLE VIEW' : 'ACCESSIBLE CHOICE VIEW'}
            </button>
          )}
          {stage === 'task' && !accessibleMode && (
            <button type="button" className="btn" onClick={() => setPaused((p) => !p)}>
              {paused ? 'RESUME (P)' : 'PAUSE (P)'}
            </button>
          )}
          <button
            type="button"
            className="btn"
            onClick={() => {
              telemetryAudio.playChirp(420, 0.05, 'Returning to Observatory');
              onExit();
            }}
          >
            EXIT TO OBSERVATORY
          </button>
        </div>
      </div>

      {/* 5-Stage Loop Stepper */}
      <nav className="stage-stepper" aria-label="Encounter stages">
        {(
          [
            { id: 'hook', label: '1. Memory Echo' },
            { id: 'console', label: '2. Console Brief' },
            { id: 'task', label: '3. Interactive Signal' },
            { id: 'evidence', label: '4. Evidence Chain' },
            { id: 'behind', label: '5. Patch & Archive' },
          ] as Array<{ id: EncounterStage; label: string }>
        ).map((s) => {
          const isActive = stage === s.id;
          return (
            <button
              key={s.id}
              type="button"
              className={`stage-chip ${isActive ? 'active' : ''}`}
              onClick={() => setStage(s.id)}
              disabled={
                (s.id === 'evidence' || s.id === 'behind') && !patchAwarded && stage !== s.id && stage !== 'evidence' && stage !== 'behind'
              }
            >
              {s.label}
            </button>
          );
        })}
      </nav>

      {/* STAGE 1: HOOK (Memory Echo - Cyan) */}
      {stage === 'hook' && (
        <div className="encounter-stage-card voice-echo notch-corner">
          <div className="story-dialogue-row">
            <img
              src="/assets/generated/sprites/robot-talk.png"
              alt="Archivist companion robot illustration"
              className="robot-portrait pixel-art"
            />
            <div>
              <div className="voice-header">
                <span className="pill-tag pill-cyan">MEMORY ECHO · DRAMATIZED PERSPECTIVE</span>
                <span className="pill-tag">SI-GENERATED ILLUSTRATION · CC0</span>
              </div>
              <blockquote className="echo-quote">“{mission.story_hook}”</blockquote>
              <p className="hook-question">{config.hookQuestion}</p>
            </div>
          </div>
          <div className="stage-footer-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                telemetryAudio.playChirp(680, 0.06, 'Opening verified mission console');
                setStage('console');
              }}
            >
              OPEN VERIFIED CONSOLE BRIEF →
            </button>
          </div>
        </div>
      )}

      {/* STAGE 2: CONSOLE & CONTEXT (Verified Record - Amber) */}
      {stage === 'console' && (
        <div className="encounter-stage-card voice-record notch-corner">
          <div className="console-grid">
            <div>
              <span className="pill-tag pill-amber">ARCHIVIST CONSOLE · VERIFIED NASA FACTS</span>
              <h3>Engineering Constraint & Task</h3>
              <p className="record-paragraph">{config.constraintSummary}</p>
              <div className="telemetry-kv">
                <div>
                  <span className="kv-label">PRIMARY HARDWARE</span>
                  <span className="kv-val">{config.instrumentName}</span>
                </div>
                <div>
                  <span className="kv-label">PLAYER TASK</span>
                  <span className="kv-val">{encounter.player_task}</span>
                </div>
                <div>
                  <span className="kv-label">SIMPLIFICATION DISCLOSURE</span>
                  <span className="kv-val">{encounter.simplification_note}</span>
                </div>
              </div>
            </div>
            <div className="console-preview-box">
              <img
                src={campaignEntry.scene_image}
                alt={`Generated pixel-art scene for ${mission.destination}`}
                className="scene-preview-img pixel-art"
              />
              <div className="preview-caption">
                <span>SI-GENERATED SCENE · {mission.name.toUpperCase()}</span>
                <img
                  src={campaignEntry.sprite}
                  alt={`${mission.name} spacecraft illustration`}
                  className="mini-sprite pixel-art"
                />
              </div>
            </div>
          </div>
          <div className="stage-footer-actions">
            <button type="button" className="btn" onClick={() => setStage('hook')}>
              ← MEMORY ECHO
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                telemetryAudio.playChirp(740, 0.06, 'Starting telemetry calibration task');
                setStage('task');
              }}
            >
              CALIBRATE TELEMETRY TASK →
            </button>
          </div>
        </div>
      )}

      {/* STAGE 3: INTERACTIVE MISSION TASK (Canvas Sim + Discrete Choice Fallback) */}
      {stage === 'task' && (
        <div className="encounter-stage-card notch-corner">
          <div className="task-header-bar">
            <div>
              <span className="pill-tag pill-amber">{config.mechanicLabel}</span>
              <h3>{config.prompt}</h3>
            </div>
            <button
              type="button"
              className="btn"
              onClick={() => setJuniorGuidanceOpen((v) => !v)}
            >
              {juniorGuidanceOpen ? 'HIDE JUNIOR GUIDANCE' : 'JUNIOR GUIDANCE HINT'}
            </button>
          </div>

          {juniorGuidanceOpen && (
            <div className="assist-banner voice-echo" role="note">
              <strong>Archivist Assist:</strong> {config.assistHint}
            </div>
          )}

          {feedbackBanner && (
            <div
              className={`feedback-banner tone-${feedbackBanner.tone}`}
              role="status"
              aria-live="polite"
            >
              {feedbackBanner.text}
            </div>
          )}

          {!accessibleMode ? (
            <div className="sim-wrapper">
              <div className="canvas-frame">
                <canvas
                  ref={canvasRef}
                  width={640}
                  height={360}
                  className="encounter-canvas pixel-art"
                  aria-label={`Interactive telemetry canvas for ${mission.name}`}
                />
                {paused && (
                  <div className="pause-overlay" role="dialog" aria-label="Encounter paused">
                    <div className="pause-card panel">
                      <h3>TELEMETRY PAUSED</h3>
                      <p>Simulation frozen safely while unattended or paused.</p>
                      <div className="sim-controls-row">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => setPaused(false)}
                        >
                          RESUME TELEMETRY
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => {
                            setPaused(false);
                            setAccessibleMode(true);
                          }}
                        >
                          SWITCH TO ACCESSIBLE CHOICE MODE
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              {renderCanvasControls()}
            </div>
          ) : (
            <div className="choices-list" role="radiogroup" aria-label={config.prompt}>
              {config.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={`choice-card ${selectedChoiceId === choice.id ? 'selected' : ''}`}
                  onClick={() => submitChoice(choice.id)}
                >
                  <span className="choice-title">{choice.label}</span>
                  <span className="choice-detail">{choice.detail}</span>
                </button>
              ))}
            </div>
          )}

          {softFailures > 0 && (
            <p className="soft-fail-counter">
              Recalibrations logged: {softFailures} (No penalties—use hints or switch modes anytime).
            </p>
          )}
        </div>
      )}

      {/* STAGE 4: EVIDENCE CHAIN & VERIFICATION */}
      {stage === 'evidence' && (
        <div className="encounter-stage-card voice-record notch-corner">
          <div className="story-dialogue-row">
            <img
              src="/assets/generated/sprites/robot-happy.png"
              alt="Happy Archivist companion robot illustration"
              className="robot-portrait pixel-art"
            />
            <div>
              <span className="pill-tag pill-cyan">SIGNAL LOCK CONFIRMED · EVIDENCE CHAIN</span>
              <h3>Verified Causal Chain</h3>
              {feedbackBanner && <p className="record-paragraph">{feedbackBanner.text}</p>}
            </div>
          </div>

          <ol className="evidence-chain-list">
            {encounter.evidence_chain.map((step, index) => (
              <li key={step} className="evidence-node">
                <span className="node-index">0{index + 1}</span>
                <span className="node-label">{step}</span>
              </li>
            ))}
          </ol>

          <div className="telemetry-kv">
            <div>
              <span className="kv-label">OBSERVED SCIENTIFIC RESULT</span>
              <span className="kv-val">{config.evidenceResult}</span>
            </div>
            <div>
              <span className="kv-label">LEARNING OUTCOME</span>
              <span className="kv-val">{encounter.learning_intent}</span>
            </div>
          </div>

          <div className="stage-footer-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleUnlockPatchAndAdvance}
            >
              INSPECT BEHIND THE MEMORY & UNLOCK PATCH →
            </button>
          </div>
        </div>
      )}

      {/* STAGE 5: BEHIND THE MEMORY & ARCHIVE */}
      {stage === 'behind' && (
        <div className="encounter-stage-card notch-corner">
          <div className="patch-unlock-banner">
            <img
              src={campaignEntry.patch_image}
              alt={campaignEntry.patch_name}
              className="patch-large pixel-art"
            />
            <div>
              <span className="pill-tag pill-amber">OBSERVATORY PATCH UNLOCKED</span>
              <h3>{campaignEntry.patch_name}</h3>
              <p className="record-paragraph">{config.discoveryEnabled}</p>
            </div>
          </div>

          <div className="telemetry-kv">
            <div>
              <span className="kv-label">WHAT THE SIMULATION SIMPLIFIED</span>
              <span className="kv-val">{encounter.simplification_note}</span>
            </div>
            <div>
              <span className="kv-label">SCIENTIFIC UNCERTAINTY & CONTEXT</span>
              <span className="kv-val">{detail?.uncertaintyNote ?? mission.science_summary}</span>
            </div>
            {primarySource && (
              <div>
                <span className="kv-label">PRIMARY NASA / AUTHORITATIVE RECORD</span>
                <a
                  href={primarySource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="citation-link"
                >
                  [{primarySource.organization}] {primarySource.title} ↗
                </a>
              </div>
            )}
          </div>

          <div className="stage-footer-actions">
            {onOpenArchive && (
              <button
                type="button"
                className="btn"
                onClick={() => onOpenArchive(mission.id)}
              >
                INSPECT IN 31-MISSION CATALOG
              </button>
            )}
            {onLaunchNext && config.nextMissionId && (
              <button
                type="button"
                className="btn btn-cyan"
                onClick={() => {
                  const nextEnc = campaignData.encounters.find(
                    (e) => e.mission_id === config.nextMissionId
                  );
                  if (nextEnc) onLaunchNext(nextEnc.mission_id, nextEnc.id);
                }}
              >
                NEXT ECHO: {config.nextMissionName.toUpperCase()} →
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={onExit}>
              RETURN TO OBSERVATORY
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
