// SI-assisted game presentation; mission text comes from the reviewed local datasets.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';
import { getStatusBadgeInfo, type MissionRecord, type NarrativeEncounter } from '../data/types';
import {
  buildCraterCanvas,
  buildRockCanvas,
  drawNineSliceFrame,
  getMissionSpriteCanvas,
  getRobotDriveSheet,
  getSurfaceTerrainTile,
  SOT_PALETTE,
} from '../systems/stillOutThereArt';

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
}

const WAYPOINT_COORDS: Record<string, WaypointLayout> = {
  // Chapter I — Moon (spread across 3/4 top-down surface map)
  'gentle-touch': { x: 148, y: 162, siteLabel: 'Oceanus Procellarum' },
  'echo-never-sleeps': { x: 332, y: 122, siteLabel: 'Mare Tranquillitatis' },
  'farther-than-footsteps': { x: 506, y: 248, siteLabel: 'Taurus-Littrow' },
  // Chapter II — Mars
  'question-in-the-soil': { x: 146, y: 172, siteLabel: 'Chryse Planitia' },
  'clues-beneath-the-wheel': { x: 336, y: 256, siteLabel: 'Gusev / Home Plate' },
  'air-thin-as-a-whisper': { x: 508, y: 138, siteLabel: 'Jezero Crater' },
  // Chapter III — Elsewhere
  'landing-not-planned': { x: 142, y: 184, siteLabel: '433 Eros · Himeros' },
  'power-for-the-unknown': { x: 332, y: 126, siteLabel: 'Interstellar Space' },
  'one-chance-at-pluto': { x: 506, y: 246, siteLabel: 'Pluto Flyby Corridor' },
};

const PALETTE = {
  void: SOT_PALETTE.spaceBlack,
  indigo: SOT_PALETTE.deepIndigo,
  navy: SOT_PALETTE.shadowNavy,
  dusk: SOT_PALETTE.atmosphericDusk,
  basalt: SOT_PALETTE.lunarBasaltDark,
  regolithDeep: SOT_PALETTE.lunarRegolithDeep,
  regolithMid: SOT_PALETTE.lunarRegolithMid,
  dustLight: SOT_PALETTE.lunarDustLight,
  crustCream: SOT_PALETTE.lunarCrustCream,
  highlightRim: SOT_PALETTE.lunarHighlight,
  shadowUmber: SOT_PALETTE.marsShadowUmber,
  deepRust: SOT_PALETTE.marsDeepRust,
  ochre: SOT_PALETTE.marsOchreCore,
  terracotta: SOT_PALETTE.marsTerracotta,
  dustTan: SOT_PALETTE.marsDustTan,
  hazePeach: SOT_PALETTE.marsHazePeach,
  cyanVoid: SOT_PALETTE.cyanVoid,
  cyanShadow: SOT_PALETTE.cyanShadow,
  cyanDeep: SOT_PALETTE.cyanDeep,
  cyan: SOT_PALETTE.cyanGlow,
  laserCore: SOT_PALETTE.cyanLaser,
  emberShadow: SOT_PALETTE.emberShadow,
  thruster: SOT_PALETTE.thrusterOrange,
  amber: SOT_PALETTE.beaconGold,
};

function buildSectorBackdrop(sector: SectorId): HTMLCanvasElement {
  const w = 640;
  const h = 360;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  if (!ctx) return off;

  ctx.imageSmoothingEnabled = false;
  const tile = getSurfaceTerrainTile(sector);
  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w, h);
  }

  if (sector === 'elsewhere') {
    for (let i = 0; i < 64; i += 1) {
      const sx = (i * 157 + 19) % w;
      const sy = (i * 83 + 11) % h;
      ctx.fillStyle = i % 6 === 0 ? PALETTE.laserCore : i % 3 === 0 ? PALETTE.crustCream : PALETTE.dustLight;
      ctx.fillRect(sx, sy, i % 9 === 0 ? 2 : 1, i % 9 === 0 ? 2 : 1);
    }
    ctx.strokeStyle = PALETTE.cyanShadow;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.55, 250, 120, -0.08, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    const world = sector;
    const craters =
      world === 'mars'
        ? [
            { x: 102, y: 286, r: 22, seed: 31 },
            { x: 258, y: 116, r: 14, seed: 37 },
            { x: 426, y: 228, r: 18, seed: 41 },
            { x: 566, y: 268, r: 20, seed: 43 },
          ]
        : [
            { x: 112, y: 288, r: 24, seed: 11 },
            { x: 254, y: 118, r: 14, seed: 17 },
            { x: 432, y: 232, r: 19, seed: 23 },
            { x: 562, y: 274, r: 22, seed: 29 },
          ];
    for (const c of craters) {
      const crater = buildCraterCanvas(c.r, world, c.seed);
      ctx.drawImage(
        crater,
        Math.round(c.x - crater.width),
        Math.round(c.y - crater.height),
        crater.width * 2,
        crater.height * 2
      );
    }
    for (let i = 0; i < 16; i += 1) {
      const rock = buildRockCanvas(5 + (i % 4), world, i + 7);
      const rx = 28 + ((i * 173 + 29) % (w - 56));
      const ry = 54 + ((i * 97 + 41) % (h - 90));
      ctx.drawImage(rock, rx, ry, rock.width * 2, rock.height * 2);
    }
  }

  return off;
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
  const [coordsReadout, setCoordsReadout] = useState<{ x: number; y: number }>({ x: 84, y: 248 });
  const [paused, setPaused] = useState(false);
  const isCompleted = useCallback(
    (id: string) =>
      completedIds.includes(id) ||
      (id === 'gentle-touch' && completedIds.includes('surveyor-1-touchdown')),
    [completedIds]
  );
  const nearestEncounter = sectorEncounters.find((enc) => enc.id === nearestEncounterId);
  const nearestWaypoint = WAYPOINT_COORDS[nearestEncounterId];
  const nearestDistance = nearestWaypoint
    ? Math.round(Math.hypot(nearestWaypoint.x - coordsReadout.x, nearestWaypoint.y - coordsReadout.y))
    : 0;
  const nextEncounter = sectorEncounters.filter((enc) => !isCompleted(enc.id)).reduce<NarrativeEncounter | undefined>((nearest, enc) => {
    const distance = (id: string) => {
      const waypoint = WAYPOINT_COORDS[id];
      return waypoint ? Math.hypot(waypoint.x - coordsReadout.x, waypoint.y - coordsReadout.y) : Infinity;
    };
    return !nearest || distance(enc.id) < distance(nearest.id) ? enc : nearest;
  }, undefined);
  const storyHook = missions.find((mission) => mission.id === nearestEncounter?.mission_id)?.story_hook
    || nearestEncounter?.memory_echo.intro[0];

  const stateRef = useRef({
    roverX: 84,
    roverY: 248,
    targetX: null as number | null,
    targetY: null as number | null,
    pendingLaunchId: null as string | null,
    facing: 1,
    tracks: [] as Array<{ x: number; y: number }>,
    dust: [] as Array<{ x: number; y: number; age: number }>,
    lastTrackX: 84,
    lastTrackY: 248,
    keys: new Set<string>(),
    pulse: 0,
  });

  // Reset rover trail cleanly when changing chapter
  useEffect(() => {
    stateRef.current.roverX = 84;
    stateRef.current.roverY = 248;
    stateRef.current.lastTrackX = 84;
    stateRef.current.lastTrackY = 248;
    stateRef.current.tracks = [];
    stateRef.current.dust = [];
    stateRef.current.targetX = null;
    stateRef.current.targetY = null;
  }, [sector]);

  // Only the focused canvas owns drive keys; native controls keep their keyboard behavior.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (paused || e.target !== canvasRef.current) return;
      const k = e.key.toLowerCase();
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(k)) {
        e.preventDefault();
        stateRef.current.keys.add(k);
        stateRef.current.targetX = null;
        stateRef.current.targetY = null;
        stateRef.current.pendingLaunchId = null;
      } else if ((k === 'e' || k === 'enter' || k === ' ') && nearestEncounterId && !e.repeat) {
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
    const stopDriving = () => {
      stateRef.current.keys.clear();
      stateRef.current.targetX = null;
      stateRef.current.targetY = null;
      stateRef.current.pendingLaunchId = null;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', stopDriving);
    document.addEventListener('visibilitychange', stopDriving);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', stopDriving);
      document.removeEventListener('visibilitychange', stopDriving);
    };
  }, [nearestEncounterId, onLaunchEncounter, paused]);

  // 640x360 top-down pixel-art render loop (docs/art-reference/img/05.jpg)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const terrainBg = buildSectorBackdrop(sector);
    const robotSheet = getRobotDriveSheet();
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let rafId = 0;
    let frame = 0;
    let lastTime = 0;
    let hasPaintedIdle = false;
    let lastNearest = '';
    let lastCoordsKey = '';

    const tick = (time: number) => {
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
      lastTime = time;
      const reducedMotion = motionQuery.matches;
      const s = stateRef.current;
      const unfocused = document.hidden || !document.hasFocus();
      if (unfocused && hasPaintedIdle) {
        if (!paused) rafId = window.requestAnimationFrame(tick);
        return;
      }
      hasPaintedIdle = true;
      frame += 1;
      s.pulse = reducedMotion || paused || unfocused ? 0 : (s.pulse + dt * 2.7) % (Math.PI * 2);
      const oldX = s.roverX;
      const oldY = s.roverY;

      // Update rover kinematics across full 2D top-down terrain (y = 54..332)
      let dx = 0;
      let dy = 0;
      if (s.keys.has('arrowleft') || s.keys.has('a')) dx -= 1;
      if (s.keys.has('arrowright') || s.keys.has('d')) dx += 1;
      if (s.keys.has('arrowup') || s.keys.has('w')) dy -= 1;
      if (s.keys.has('arrowdown') || s.keys.has('s')) dy += 1;

      const speed = paused ? 0 : 142 * dt;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        s.roverX = Math.max(28, Math.min(612, s.roverX + (dx / len) * speed));
        s.roverY = Math.max(58, Math.min(334, s.roverY + (dy / len) * speed));
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
      const moving = Math.hypot(s.roverX - oldX, s.roverY - oldY) > 0.01;
      const bounce = moving && !reducedMotion ? Math.round(Math.sin(s.pulse * 6)) : 0;

      // Drop crisp parallel tread tracks behind rover (img/05.jpg)
      if (Math.hypot(s.roverX - s.lastTrackX, s.roverY - s.lastTrackY) >= 6) {
        s.tracks.push({ x: Math.round(s.roverX), y: Math.round(s.roverY) });
        if (s.tracks.length > 90) s.tracks.shift();
        s.lastTrackX = s.roverX;
        s.lastTrackY = s.roverY;
        if (!reducedMotion) s.dust.push({ x: s.roverX - s.facing * 8, y: s.roverY, age: 0 });
      }
      s.dust = reducedMotion ? [] : s.dust.filter((puff) => (puff.age += dt) < 0.6);

      // Nearest + next unfinished encounter calculation
      let closestId = sectorEncounters[0]?.id ?? activeEncounterId;
      let closestDist = Infinity;
      let nextId = '';
      let nextDist = Infinity;
      for (const enc of sectorEncounters) {
        const wp = WAYPOINT_COORDS[enc.id];
        if (!wp) continue;
        const d = Math.hypot(wp.x - s.roverX, wp.y - s.roverY);
        const done = isCompleted(enc.id);
        if (!done && d < nextDist) {
          nextId = enc.id;
          nextDist = d;
        }
        if (d < closestDist) {
          closestDist = d;
          closestId = enc.id;
        }
      }
      if (frame % 8 === 0) {
        if (closestId !== lastNearest) {
          lastNearest = closestId;
          setNearestEncounterId(closestId);
        }
        const rx = Math.round(s.roverX);
        const ry = Math.round(s.roverY);
        const key = `${rx},${ry}`;
        if (key !== lastCoordsKey) {
          lastCoordsKey = key;
          setCoordsReadout({ x: rx, y: ry });
        }
      }

      // --- DRAW 640x360 FRAME ---
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(terrainBg, 0, 0, 640, 360);

      // Parallel rover tire tracks matching img/05.jpg
      ctx.fillStyle =
        sector === 'mars'
          ? PALETTE.shadowUmber
          : sector === 'elsewhere'
          ? PALETTE.cyanShadow
          : PALETTE.indigo;
      for (const t of s.tracks) {
        ctx.fillRect(t.x - 4, t.y - 2, 2, 1);
        ctx.fillRect(t.x - 4, t.y + 2, 2, 1);
      }

      // Dust kick-up
      const dustLit = sector === 'mars' ? PALETTE.dustTan : PALETTE.crustCream;
      const dustMid = sector === 'mars' ? PALETTE.terracotta : PALETTE.regolithMid;
      for (const puff of s.dust) {
        ctx.fillStyle = puff.age < 0.3 ? dustLit : dustMid;
        const drift = Math.round(puff.age * 10);
        ctx.fillRect(Math.round(puff.x) - drift, Math.round(puff.y) - Math.round(drift / 2), 2, 2);
      }

      // Encounter waypoints with concentric dashed rings & notched label plates (img/05.jpg)
      const doneInSector = sectorEncounters.filter((e) => isCompleted(e.id)).length;
      for (const enc of sectorEncounters) {
        const wp = WAYPOINT_COORDS[enc.id];
        if (!wp) continue;
        const done = isCompleted(enc.id);
        const isNear = Math.hypot(wp.x - s.roverX, wp.y - s.roverY) < 62;
        const ringColor = done ? PALETTE.amber : isNear ? PALETTE.laserCore : PALETTE.cyan;

        // Outer subtle glow ring when near
        if (isNear && !reducedMotion) {
          const rad = 28 + Math.sin(s.pulse) * 5;
          ctx.strokeStyle = PALETTE.cyanDeep;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.ellipse(wp.x, wp.y + 4, rad, Math.round(rad * 0.48), 0, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Dashed primary ellipse ring around site hardware
        ctx.save();
        ctx.setLineDash([4, 3]);
        ctx.strokeStyle = ringColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(wp.x, wp.y + 3, 26, 12, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Procedural 32x32 NASA hardware sprite from stillOutThereArt
        const hwSprite = getMissionSpriteCanvas(enc.mission_id);
        ctx.fillStyle = 'rgba(5, 7, 15, 0.55)';
        ctx.beginPath();
        ctx.ellipse(wp.x, wp.y + 3, 14, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.drawImage(hwSprite, Math.round(wp.x - 16), Math.round(wp.y - 24), 32, 32);

        // Subtle status beacon pixel above hardware
        ctx.fillStyle = done ? PALETTE.amber : PALETTE.cyan;
        ctx.fillRect(wp.x - 1, wp.y - 28, 3, 3);

        // Notched Pixel Label below ring (matching img/05.jpg)
        const label = `${done ? '✓ ' : '• '}${enc.title.toUpperCase()} · ECHO`;
        ctx.font = 'bold 9px "IBM Plex Mono", monospace';
        const tw = ctx.measureText(label).width;
        const boxW = Math.ceil(tw + 14);
        const bx = Math.round(Math.max(8, Math.min(632 - boxW, wp.x - boxW / 2)));
        const by = Math.round(wp.y + 18);
        drawNineSliceFrame(ctx, bx, by, boxW, 16, isNear ? ringColor : PALETTE.cyanDeep, PALETTE.indigo);
        ctx.fillStyle = done ? PALETTE.amber : isNear ? PALETTE.laserCore : PALETTE.highlightRim;
        ctx.fillText(label, bx + 7, by + 11);
      }

      // Click target waypoint crosshair
      if (s.targetX !== null && s.targetY !== null) {
        ctx.strokeStyle = PALETTE.cyan;
        ctx.strokeRect(Math.round(s.targetX - 4), Math.round(s.targetY - 4), 8, 8);
      }

      // Player Field Scout / UNIT-7 (2-frame tread animation from stillOutThereArt)
      const driveFrame = moving && !reducedMotion && Math.floor(frame / 6) % 2 === 1 ? 24 : 0;
      ctx.fillStyle = 'rgba(5, 7, 15, 0.65)';
      ctx.beginPath();
      ctx.ellipse(Math.round(s.roverX), Math.round(s.roverY + 3), 12, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      if (s.facing < 0) {
        ctx.translate(Math.round(s.roverX + 14), Math.round(s.roverY - 22 + bounce));
        ctx.scale(-1, 1);
        ctx.drawImage(robotSheet, driveFrame, 0, 24, 24, 0, 0, 28, 28);
      } else {
        ctx.drawImage(
          robotSheet,
          driveFrame,
          0,
          24,
          24,
          Math.round(s.roverX - 14),
          Math.round(s.roverY - 22 + bounce),
          28,
          28
        );
      }
      ctx.restore();

      // Top-left HUD Plate (img/05.jpg: ECHO: SITE · DISTM)
      const activeNear = sectorEncounters.find((e) => e.id === closestId);
      const rawLeftText = activeNear
        ? closestDist < 62
          ? `ECHO: ${activeNear.title.toUpperCase()} · [E] TUNE`
          : `ECHO: ${activeNear.title.toUpperCase()} · ${Math.round(closestDist)}M`
        : `SECTOR: ${sector.toUpperCase()} · DRIVE WITH WASD`;
      const leftText = rawLeftText.length > 44 ? `${rawLeftText.slice(0, 41)}...` : rawLeftText;
      drawNineSliceFrame(ctx, 10, 10, 336, 26, PALETTE.cyan, 'rgba(11, 15, 29, 0.90)');
      ctx.font = 'bold 10px "IBM Plex Mono", monospace';
      ctx.fillStyle = closestDist < 62 ? PALETTE.laserCore : PALETTE.cyan;
      ctx.fillText(leftText, 18, 27);

      // Top-right HUD Plate (img/05.jpg: • MOON // 0/3 FOUND)
      const rightText = `• ${sector.toUpperCase()} // ${doneInSector}/${sectorEncounters.length} FOUND`;
      drawNineSliceFrame(ctx, 434, 10, 196, 26, PALETTE.cyan, 'rgba(11, 15, 29, 0.90)');
      ctx.fillStyle = doneInSector === sectorEncounters.length ? PALETTE.amber : PALETTE.highlightRim;
      ctx.fillText(rightText, 444, 27);

      // Compass bar pointing to next unfinished site
      const nextWaypoint = WAYPOINT_COORDS[nextId];
      drawNineSliceFrame(ctx, 10, 328, 264, 22, PALETTE.dusk, 'rgba(11, 15, 29, 0.90)');
      ctx.fillStyle = nextWaypoint ? PALETTE.cyan : PALETTE.amber;
      ctx.fillText(
        nextWaypoint ? `COMPASS // ${Math.round(nextDist)}M TO UNARCHIVED SIGNAL` : 'SECTOR ARCHIVED // ALL SIGNALS LINKED',
        34,
        343
      );
      if (nextWaypoint) {
        ctx.save();
        ctx.translate(21, 339);
        ctx.rotate(Math.atan2(nextWaypoint.y - s.roverY, nextWaypoint.x - s.roverX));
        ctx.strokeStyle = PALETTE.cyan;
        ctx.beginPath();
        ctx.moveTo(-4, -4);
        ctx.lineTo(4, 0);
        ctx.lineTo(-4, 4);
        ctx.stroke();
        ctx.restore();
      }

      // Mandatory SI-Generated Illustration disclosure label
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillStyle = PALETTE.indigo;
      ctx.fillRect(462, 338, 168, 16);
      ctx.fillStyle = PALETTE.dustLight;
      ctx.fillText('SI-Generated Illustration', 468, 349);

      if (!paused) rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [sector, sectorEncounters, activeEncounterId, isCompleted, onLaunchEncounter, paused]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (paused) return;
    canvas.focus();
    const rect = canvas.getBoundingClientRect();
    const scaleX = 640 / rect.width;
    const scaleY = 360 / rect.height;
    const cx = Math.max(28, Math.min(612, (e.clientX - rect.left) * scaleX));
    const cy = Math.max(58, Math.min(334, (e.clientY - rect.top) * scaleY));

    const s = stateRef.current;
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
          <strong style={{ color: 'var(--cyan)' }}>SCOUT TELEMETRY (640×360 SURFACE MAP):</strong> Focus the map, drive with{' '}
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
        tabIndex={0}
        onBlur={() => {
          stateRef.current.keys.clear();
          stateRef.current.targetX = null;
          stateRef.current.targetY = null;
          stateRef.current.pendingLaunchId = null;
        }}
        className="surface-canvas pixelated"
        aria-label={`Interactive ${sector} sector 3/4 top-down surface explorer map showing ${sectorEncounters.length} signal encounters`}
      />
      <p className="mono" aria-live="polite">{nextEncounter ? `NEXT SIGNAL // ${nextEncounter.title}` : 'SECTOR ARCHIVED // Replay any signal'}</p>
      <button type="button" className="btn-secondary btn-sm" aria-pressed={paused}
        onClick={() => { stateRef.current.keys.clear(); setPaused(!paused); }}>
        {paused ? 'RESUME SCOUT' : 'PAUSE SCOUT'}
      </button>
      {nearestEncounter && (
        <div className="voice-card voice-story scout-log">
          <span className="tag-story">[ MEMORY ECHO ]</span>
          <p aria-live="polite">SCOUT LOG // {nearestEncounter.title}: “{storyHook}”</p>
          <span className="mono">{nearestDistance} px · {nearestDistance < 62 ? 'IN SIGNAL RANGE' : 'DRIVE TO SIGNAL'} · {isCompleted(nearestEncounter.id) ? 'ARCHIVED' : 'UNRECOVERED'}</span>
          <button type="button" className="btn-observatory btn-sm" onClick={() => onLaunchEncounter(nearestEncounter.id)}>
            {isCompleted(nearestEncounter.id) ? 'REPLAY' : 'TUNE'} {nearestEncounter.title}
          </button>
        </div>
      )}

      {/* Keyboard / Screen-reader Equal Accessible Sector Cards (never canvas-only!) */}
      <div className="evidence-grid" aria-label="Sector signal destinations">
        {sectorEncounters.map((enc) => {
          const wp = WAYPOINT_COORDS[enc.id];
          const mission = missions.find((m) => m.id === enc.mission_id);
          const done = isCompleted(enc.id);
          const isNearest = enc.id === nearestEncounterId;
          const badge = getStatusBadgeInfo(enc.status_badge.dataset_status);

          return (
            <div
              key={enc.id}
              className="evidence-card"
              aria-current={isNearest ? 'location' : undefined}
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
                  aria-label={`${done ? 'Replay' : 'Tune signal'}: ${enc.title}`}
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
