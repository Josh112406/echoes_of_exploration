import { useEffect, useMemo, useRef, useState } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';
import { getStatusBadgeInfo, type MissionRecord, type NarrativeEncounter } from '../data/types';

export type SectorId = 'moon' | 'mars' | 'elsewhere';

interface SurfaceExplorerCanvasProps {
  sector: SectorId;
  encounters: NarrativeEncounter[];
  missions: MissionRecord[];
  activeEncounterId: string;
  completedIds: string[];
  onLaunchEncounter: (encounterId: string) => void;
  onInspectMission: (mission: MissionRecord) => void;
}

interface WaypointLayout {
  x: number;
  y: number;
  siteLabel: string;
  spriteKey: 'surveyor' | 'lm' | 'curiosity' | 'rocket';
}

const WAYPOINT_COORDS: Record<string, WaypointLayout> = {
  // Chapter I — Moon
  'gentle-touch': { x: 132, y: 238, siteLabel: 'Oceanus Procellarum', spriteKey: 'surveyor' },
  'echo-never-sleeps': { x: 320, y: 196, siteLabel: 'Mare Tranquillitatis', spriteKey: 'lm' },
  'farther-than-footsteps': { x: 506, y: 266, siteLabel: 'Taurus-Littrow', spriteKey: 'rocket' },
  // Chapter II — Mars
  'question-in-the-soil': { x: 136, y: 244, siteLabel: 'Chryse Planitia', spriteKey: 'surveyor' },
  'clues-beneath-the-wheel': { x: 322, y: 262, siteLabel: 'Gusev / Home Plate', spriteKey: 'curiosity' },
  'air-thin-as-a-whisper': { x: 502, y: 204, siteLabel: 'Jezero Crater', spriteKey: 'rocket' },
  // Chapter III — Elsewhere
  'landing-not-planned': { x: 136, y: 246, siteLabel: '433 Eros · Himeros', spriteKey: 'surveyor' },
  'power-for-the-unknown': { x: 324, y: 196, siteLabel: 'Interstellar Space', spriteKey: 'lm' },
  'one-chance-at-pluto': { x: 504, y: 256, siteLabel: 'Pluto Flyby Corridor', spriteKey: 'rocket' },
};

const CRATERS: Record<SectorId, Array<{ x: number; y: number; rx: number; ry: number }>> = {
  moon: [
    { x: 96, y: 294, rx: 32, ry: 12 },
    { x: 244, y: 224, rx: 22, ry: 9 },
    { x: 422, y: 296, rx: 38, ry: 14 },
    { x: 560, y: 214, rx: 20, ry: 8 },
  ],
  mars: [
    { x: 88, y: 288, rx: 28, ry: 10 },
    { x: 252, y: 214, rx: 26, ry: 9 },
    { x: 416, y: 292, rx: 34, ry: 12 },
    { x: 572, y: 274, rx: 18, ry: 7 },
  ],
  elsewhere: [
    { x: 104, y: 292, rx: 30, ry: 11 },
    { x: 240, y: 238, rx: 20, ry: 8 },
    { x: 432, y: 286, rx: 32, ry: 11 },
    { x: 556, y: 212, rx: 18, ry: 7 },
  ],
};

// Strict ART_STYLE_GUIDE.md 24-color palette ramps
const PALETTE = {
  void: '#05070f',
  indigo: '#0b0f1d',
  navy: '#131a2e',
  dusk: '#1d263f',
  basalt: '#27293d',
  regolithDeep: '#3b3e59',
  regolithMid: '#595e7d',
  dustLight: '#8389a8',
  crustCream: '#b2b8d4',
  highlightRim: '#e2e6fa',
  shadowUmber: '#2b140e',
  deepRust: '#522116',
  ochre: '#7d331c',
  terracotta: '#ab4f2c',
  dustTan: '#cf724a',
  hazePeach: '#e89e7d',
  cyanVoid: '#032630',
  cyanShadow: '#064b5c',
  cyanDeep: '#087d99',
  cyan: '#0ec3dc',
  laserCore: '#7ef1ff',
  emberShadow: '#4a1805',
  thruster: '#e65100',
  amber: '#f59e0b',
};

function drawScoutFallback(ctx: CanvasRenderingContext2D, x: number, y: number, facing: number) {
  ctx.fillStyle = PALETTE.indigo;
  ctx.fillRect(Math.round(x - 7), Math.round(y + 1), 14, 4);
  ctx.fillStyle = PALETTE.basalt;
  ctx.fillRect(Math.round(x - 6), Math.round(y - 14), 12, 13);
  ctx.fillStyle = PALETTE.crustCream;
  ctx.fillRect(Math.round(x - 5), Math.round(y - 14), 10, 1);
  ctx.fillRect(Math.round(x - 5), Math.round(y - 13), 8, 5);
  // Cyan visor
  ctx.fillStyle = PALETTE.cyan;
  ctx.fillRect(Math.round(x + (facing > 0 ? 0 : -4)), Math.round(y - 12), 5, 3);
  ctx.fillStyle = PALETTE.laserCore;
  ctx.fillRect(Math.round(x + (facing > 0 ? 1 : -3)), Math.round(y - 12), 2, 1);
  // Wheels / treads
  ctx.fillStyle = PALETTE.dusk;
  ctx.fillRect(Math.round(x - 6), Math.round(y - 2), 4, 3);
  ctx.fillRect(Math.round(x + 2), Math.round(y - 2), 4, 3);
  ctx.fillStyle = PALETTE.amber;
  ctx.fillRect(Math.round(x - 1), Math.round(y - 17), 2, 3);
}

export function SurfaceExplorerCanvas({
  sector,
  encounters,
  missions,
  activeEncounterId,
  completedIds,
  onLaunchEncounter,
  onInspectMission,
}: SurfaceExplorerCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sectorEncounters = useMemo(
    () => encounters.filter((e) => e.chapter === sector),
    [encounters, sector]
  );

  const [nearestEncounterId, setNearestEncounterId] = useState<string>(
    () => sectorEncounters[0]?.id ?? activeEncounterId
  );
  const [coordsReadout, setCoordsReadout] = useState<{ x: number; y: number }>({ x: 64, y: 268 });

  const stateRef = useRef({
    roverX: 64,
    roverY: 268,
    targetX: null as number | null,
    targetY: null as number | null,
    pendingLaunchId: null as string | null,
    facing: 1,
    tracks: [] as Array<{ x: number; y: number }>,
    lastTrackX: 64,
    lastTrackY: 268,
    keys: new Set<string>(),
    pulse: 0,
    sprites: {} as Record<string, HTMLImageElement>,
  });

  // Load 16-bit sprites from /assets/sprites/ once
  useEffect(() => {
    const names = ['robot', 'surveyor', 'lm', 'curiosity', 'rocket', 'earth'];
    for (const name of names) {
      if (stateRef.current.sprites[name]) continue;
      const img = new Image();
      img.src = `/assets/sprites/${name}.png`;
      stateRef.current.sprites[name] = img;
    }
  }, []);

  // Reset rover ref coordinates cleanly when sector switches (RAF loop syncs HUD state)
  useEffect(() => {
    const s = stateRef.current;
    s.roverX = 64;
    s.roverY = 268;
    s.targetX = null;
    s.targetY = null;
    s.pendingLaunchId = null;
    s.tracks = [];
    s.lastTrackX = 64;
    s.lastTrackY = 268;
  }, [sector, sectorEncounters]);

  // Keyboard listener for WASD / Arrows + E/Enter interact
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        stateRef.current.keys.add(k);
        stateRef.current.targetX = null;
        stateRef.current.targetY = null;
        stateRef.current.pendingLaunchId = null;
      } else if ((k === 'e' || k === ' ') && nearestEncounterId) {
        const st = stateRef.current;
        const wp = WAYPOINT_COORDS[nearestEncounterId];
        if (wp && Math.hypot(wp.x - st.roverX, wp.y - st.roverY) < 62) {
          e.preventDefault();
          telemetryAudio.playSignalLock();
          onLaunchEncounter(nearestEncounterId);
        }
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [nearestEncounterId, onLaunchEncounter]);

  // 640x360 pixel-art render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let rafId = 0;
    let frame = 0;

    const tick = () => {
      frame += 1;
      const s = stateRef.current;
      s.pulse = reducedMotion ? 0 : (s.pulse + 0.045) % (Math.PI * 2);

      // Update rover kinematics (keyboard or pointer autopilot)
      let dx = 0;
      let dy = 0;
      if (s.keys.has('arrowleft') || s.keys.has('a')) dx -= 1;
      if (s.keys.has('arrowright') || s.keys.has('d')) dx += 1;
      if (s.keys.has('arrowup') || s.keys.has('w')) dy -= 1;
      if (s.keys.has('arrowdown') || s.keys.has('s')) dy += 1;

      const speed = reducedMotion ? 3.2 : 2.3;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        s.roverX = Math.max(24, Math.min(616, s.roverX + (dx / len) * speed));
        s.roverY = Math.max(158, Math.min(338, s.roverY + (dy / len) * speed));
        if (dx !== 0) s.facing = dx > 0 ? 1 : -1;
      } else if (s.targetX !== null && s.targetY !== null) {
        const tx = s.targetX - s.roverX;
        const ty = s.targetY - s.roverY;
        const dist = Math.hypot(tx, ty);
        if (dist <= 6) {
          s.targetX = null;
          s.targetY = null;
          if (s.pendingLaunchId) {
            const launchId = s.pendingLaunchId;
            s.pendingLaunchId = null;
            telemetryAudio.playSignalLock();
            onLaunchEncounter(launchId);
          }
        } else {
          s.roverX += (tx / dist) * speed;
          s.roverY += (ty / dist) * speed;
          if (Math.abs(tx) > 0.2) s.facing = tx > 0 ? 1 : -1;
        }
      }

      // Drop regolith tire tracks
      if (Math.hypot(s.roverX - s.lastTrackX, s.roverY - s.lastTrackY) >= 8) {
        s.tracks.push({ x: Math.round(s.roverX), y: Math.round(s.roverY) });
        if (s.tracks.length > 72) s.tracks.shift();
        s.lastTrackX = s.roverX;
        s.lastTrackY = s.roverY;
      }

      // Determine nearest encounter
      let closestId = sectorEncounters[0]?.id ?? activeEncounterId;
      let closestDist = Infinity;
      for (const enc of sectorEncounters) {
        const wp = WAYPOINT_COORDS[enc.id];
        if (!wp) continue;
        const d = Math.hypot(wp.x - s.roverX, wp.y - s.roverY);
        if (d < closestDist) {
          closestDist = d;
          closestId = enc.id;
        }
      }
      if (frame % 8 === 0) {
        setNearestEncounterId(closestId);
        setCoordsReadout({ x: Math.round(s.roverX), y: Math.round(s.roverY) });
      }

      // --- DRAW 640x360 FRAME ---
      ctx.imageSmoothingEnabled = false;

      // Layer 1: Sky
      const skyGrad = ctx.createLinearGradient(0, 0, 0, 152);
      skyGrad.addColorStop(0, PALETTE.void);
      skyGrad.addColorStop(0.68, PALETTE.indigo);
      if (sector === 'mars') {
        skyGrad.addColorStop(1, PALETTE.deepRust);
      } else {
        skyGrad.addColorStop(1, PALETTE.navy);
      }
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, 640, 152);

      // Stars (deterministic positions)
      for (let i = 0; i < 64; i += 1) {
        const sx = (i * 137 + 29) % 640;
        const sy = (i * 73 + 11) % 124;
        const bright = i % 9 === 0;
        if (bright && !reducedMotion && Math.sin(s.pulse + i) > 0.55) {
          ctx.fillStyle = PALETTE.laserCore;
          ctx.fillRect(sx, sy, 2, 2);
        } else {
          ctx.fillStyle = bright ? PALETTE.highlightRim : i % 3 === 0 ? PALETTE.crustCream : PALETTE.dustLight;
          ctx.fillRect(sx, sy, 1, 1);
        }
      }

      // Hero Light: Earth on Moon, pale cyan dot on Mars / Elsewhere
      if (sector === 'moon') {
        const earthImg = s.sprites.earth;
        if (earthImg && earthImg.complete && earthImg.naturalWidth > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(earthImg, 514, 18, 86, 86);
          ctx.restore();
        } else {
          ctx.fillStyle = PALETTE.cyanDeep;
          ctx.beginPath();
          ctx.arc(556, 58, 30, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = PALETTE.laserCore;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      } else {
        // Earth as pale cyan dot
        ctx.fillStyle = PALETTE.cyan;
        ctx.fillRect(560, 42, 3, 3);
        ctx.fillStyle = PALETTE.laserCore;
        ctx.fillRect(561, 43, 1, 1);
        if (sector === 'mars') {
          ctx.fillStyle = 'rgba(232, 158, 125, 0.14)';
          ctx.fillRect(0, 126, 640, 26);
        } else {
          ctx.strokeStyle = PALETTE.cyanShadow;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(320, 40, 190, 0.25 * Math.PI, 0.75 * Math.PI);
          ctx.stroke();
        }
      }

      // Layer 2 & 3: Far & Mid Ridges
      const ridgeColors =
        sector === 'mars'
          ? { far: PALETTE.shadowUmber, mid: PALETTE.deepRust, base: PALETTE.ochre, top: PALETTE.terracotta, lit: PALETTE.dustTan, shadow: PALETTE.shadowUmber }
          : sector === 'elsewhere'
          ? { far: PALETTE.navy, mid: PALETTE.dusk, base: PALETTE.basalt, top: PALETTE.regolithDeep, lit: PALETTE.dustLight, shadow: PALETTE.indigo }
          : { far: PALETTE.navy, mid: PALETTE.basalt, base: PALETTE.regolithDeep, top: PALETTE.regolithMid, lit: PALETTE.crustCream, shadow: PALETTE.indigo };

      ctx.fillStyle = ridgeColors.far;
      ctx.beginPath();
      ctx.moveTo(0, 152);
      for (let x = 0; x <= 640; x += 24) {
        const y = 124 + Math.sin(x * 0.018 + (sector === 'mars' ? 1 : 0)) * 12;
        ctx.lineTo(x, Math.round(y));
      }
      ctx.lineTo(640, 152);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = ridgeColors.mid;
      ctx.beginPath();
      ctx.moveTo(0, 158);
      for (let x = 0; x <= 640; x += 16) {
        const y = 138 + Math.cos(x * 0.025 + 2) * 8;
        ctx.lineTo(x, Math.round(y));
      }
      ctx.lineTo(640, 158);
      ctx.closePath();
      ctx.fill();

      // Layer 4: Foreground Regolith Floor (ordered pixel texture + craters)
      ctx.fillStyle = ridgeColors.base;
      ctx.fillRect(0, 150, 640, 210);
      ctx.fillStyle = ridgeColors.top;
      for (let py = 152; py < 360; py += 6) {
        for (let px = (py % 12 === 0 ? 0 : 3); px < 640; px += 12) {
          ctx.fillRect(px, py, 4, 2);
        }
      }
      ctx.fillStyle = ridgeColors.lit;
      ctx.fillRect(0, 150, 640, 1);

      // Craters with top-left highlight rim and deep indigo/umber shadow bowl
      for (const cr of CRATERS[sector]) {
        ctx.fillStyle = ridgeColors.mid;
        ctx.beginPath();
        ctx.ellipse(cr.x, cr.y, cr.rx, cr.ry, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = ridgeColors.shadow;
        ctx.beginPath();
        ctx.ellipse(cr.x + 3, cr.y + 2, cr.rx - 4, Math.max(3, cr.ry - 3), 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = ridgeColors.lit;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(cr.x, cr.y, cr.rx, cr.ry, 0, Math.PI, Math.PI * 1.65);
        ctx.stroke();
      }

      // Rover regolith tracks
      ctx.fillStyle = ridgeColors.shadow;
      for (const t of s.tracks) {
        ctx.fillRect(t.x - 3, t.y + 1, 2, 2);
        ctx.fillRect(t.x + 2, t.y + 2, 2, 2);
      }

      // Sector Encounter Waypoints
      for (const enc of sectorEncounters) {
        const wp = WAYPOINT_COORDS[enc.id];
        if (!wp) continue;
        const done = completedIds.includes(enc.id) || (enc.id === 'gentle-touch' && completedIds.includes('surveyor-1-touchdown'));
        const isNear = Math.hypot(wp.x - s.roverX, wp.y - s.roverY) < 62;
        const ringColor = done ? PALETTE.amber : isNear ? PALETTE.laserCore : PALETTE.cyan;

        // Soft pulsing radar ring when near
        if (isNear && !reducedMotion) {
          const rad = 22 + Math.sin(s.pulse) * 6;
          ctx.strokeStyle = 'rgba(14, 195, 220, 0.35)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(wp.x, wp.y, rad, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Dashed ring on ground
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(wp.x, wp.y + 2, 24, 10, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Hardware sprite on site
        const hwImg = s.sprites[wp.spriteKey];
        if (hwImg && hwImg.complete && hwImg.naturalWidth > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'screen';
          ctx.drawImage(hwImg, Math.round(wp.x - 16), Math.round(wp.y - 24), 32, 24);
          ctx.restore();
        } else {
          ctx.fillStyle = PALETTE.crustCream;
          ctx.fillRect(Math.round(wp.x - 8), Math.round(wp.y - 16), 16, 14);
        }

        // Notched Plate Label
        const label = `${done ? '✓ ' : ''}${enc.title.toUpperCase()}`;
        ctx.font = 'bold 9px "IBM Plex Mono", monospace';
        const tw = ctx.measureText(label).width;
        const boxW = Math.ceil(tw + 14);
        const bx = Math.round(Math.max(8, Math.min(632 - boxW, wp.x - boxW / 2)));
        const by = Math.round(wp.y - 44);
        ctx.fillStyle = 'rgba(11, 15, 29, 0.9)';
        ctx.fillRect(bx, by, boxW, 16);
        ctx.strokeStyle = isNear ? ringColor : PALETTE.dusk;
        ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, 15);
        ctx.fillStyle = done ? PALETTE.amber : isNear ? PALETTE.laserCore : PALETTE.highlightRim;
        ctx.fillText(label, bx + 7, by + 11);
      }

      // Draw Target Marker if driving by click
      if (s.targetX !== null && s.targetY !== null) {
        ctx.strokeStyle = PALETTE.cyan;
        ctx.strokeRect(Math.round(s.targetX - 4), Math.round(s.targetY - 4), 8, 8);
      }

      // Player Field Scout / Robot
      const robotImg = s.sprites.robot;
      if (robotImg && robotImg.complete && robotImg.naturalWidth > 0) {
        ctx.fillStyle = 'rgba(11, 15, 29, 0.72)';
        ctx.beginPath();
        ctx.ellipse(Math.round(s.roverX), Math.round(s.roverY + 2), 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        if (s.facing < 0) {
          ctx.translate(Math.round(s.roverX + 12), Math.round(s.roverY - 22));
          ctx.scale(-1, 1);
          ctx.drawImage(robotImg, 0, 0, 24, 24);
        } else {
          ctx.drawImage(robotImg, Math.round(s.roverX - 12), Math.round(s.roverY - 22), 24, 24);
        }
        ctx.restore();
      } else {
        drawScoutFallback(ctx, s.roverX, s.roverY, s.facing);
      }

      // Top-left Canvas HUD Overlay
      ctx.fillStyle = 'rgba(11, 15, 29, 0.85)';
      ctx.fillRect(10, 10, 268, 34);
      ctx.strokeStyle = PALETTE.cyanDeep;
      ctx.strokeRect(10.5, 10.5, 267, 33);
      ctx.font = 'bold 10px "IBM Plex Mono", monospace';
      ctx.fillStyle = PALETTE.cyan;
      ctx.fillText(`SECTOR: ${sector.toUpperCase()} // POS ${Math.round(s.roverX)},${Math.round(s.roverY)}`, 18, 24);
      const activeNear = sectorEncounters.find((e) => e.id === closestId);
      ctx.fillStyle = closestDist < 62 ? PALETTE.laserCore : PALETTE.dustLight;
      ctx.fillText(
        closestDist < 62 && activeNear
          ? `LOCKED: ${activeNear.title.toUpperCase()} [E]`
          : 'WASD / CLICK TO DRIVE TO SITE',
        18,
        37
      );

      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [sector, sectorEncounters, activeEncounterId, completedIds, onLaunchEncounter]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 640 / rect.width;
    const scaleY = 360 / rect.height;
    const cx = Math.max(24, Math.min(616, (e.clientX - rect.left) * scaleX));
    const cy = Math.max(158, Math.min(338, (e.clientY - rect.top) * scaleY));

    const s = stateRef.current;
    // Check if user clicked an encounter marker directly
    for (const enc of sectorEncounters) {
      const wp = WAYPOINT_COORDS[enc.id];
      if (!wp) continue;
      if (Math.hypot(wp.x - cx, wp.y - cy) <= 34) {
        telemetryAudio.playChirp(860, 0.04);
        if (Math.hypot(wp.x - s.roverX, wp.y - s.roverY) < 62) {
          telemetryAudio.playSignalLock();
          onLaunchEncounter(enc.id);
        } else {
          s.targetX = wp.x;
          s.targetY = wp.y;
          s.pendingLaunchId = enc.id;
        }
        return;
      }
    }

    telemetryAudio.playChirp(620, 0.02);
    s.targetX = cx;
    s.targetY = cy;
    s.pendingLaunchId = null;
  };

  return (
    <div className="surface-stage-wrap" role="region" aria-label="Surface Signal Explorer">
      <div className="surface-hud-bar">
        <span>
          <strong style={{ color: 'var(--cyan)' }}>SCOUT TELEMETRY (640×360):</strong> Drive with{' '}
          <code>WASD</code> / <code>Arrows</code> or click terrain; press <code>E</code> near a signal ring to tune.
        </span>
        <span className="mono" style={{ color: 'var(--muted)' }}>
          POS ({coordsReadout.x}, {coordsReadout.y})
        </span>
      </div>

      <canvas
        ref={canvasRef}
        width={640}
        height={360}
        onClick={handleCanvasClick}
        className="surface-canvas pixelated"
        aria-label={`Interactive ${sector} sector surface explorer map showing ${sectorEncounters.length} signal encounters`}
      />

      {/* Keyboard / Screen-reader Equal Accessible Sector Cards (never canvas-only!) */}
      <div className="evidence-grid" aria-label="Sector signal destinations">
        {sectorEncounters.map((enc) => {
          const wp = WAYPOINT_COORDS[enc.id];
          const mission = missions.find((m) => m.id === enc.mission_id);
          const done =
            completedIds.includes(enc.id) ||
            (enc.id === 'gentle-touch' && completedIds.includes('surveyor-1-touchdown'));
          const isNearest = enc.id === nearestEncounterId;
          const badge = getStatusBadgeInfo(enc.status_badge.dataset_status);

          return (
            <div
              key={enc.id}
              className="evidence-card"
              style={{
                borderColor: isNearest ? 'var(--cyan)' : done ? 'var(--amber)' : 'var(--line)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span className="mono" style={{ fontSize: '10px', color: 'var(--amber)' }}>
                  #{String(enc.order).padStart(2, '0')} · {wp?.siteLabel ?? enc.chapter}
                </span>
                {done ? (
                  <span className="status-badge active">DONE ✓</span>
                ) : (
                  <span className={badge.className}>{badge.label}</span>
                )}
              </div>
              <strong style={{ color: 'var(--ink)', fontSize: '14px' }}>{enc.title}</strong>
              <span style={{ fontSize: '12px', color: 'var(--crust)' }}>{enc.player_task}</span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: 'auto', paddingTop: '4px' }}>
                <button
                  type="button"
                  className="btn-observatory btn-sm"
                  onClick={() => {
                    telemetryAudio.playSignalLock();
                    onLaunchEncounter(enc.id);
                  }}
                >
                  ▶ {done ? 'REPLAY' : 'TUNE SIGNAL'}
                </button>
                {mission && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm"
                    onClick={() => onInspectMission(mission)}
                  >
                    RECORD
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
