// SI-assisted game presentation; mission text comes from the reviewed local datasets.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  // Chapter I — Moon (spread across 3/4 top-down surface map)
  'gentle-touch': { x: 148, y: 162, siteLabel: 'Oceanus Procellarum', spriteKey: 'surveyor' },
  'echo-never-sleeps': { x: 332, y: 122, siteLabel: 'Mare Tranquillitatis', spriteKey: 'lm' },
  'farther-than-footsteps': { x: 506, y: 248, siteLabel: 'Taurus-Littrow', spriteKey: 'rocket' },
  // Chapter II — Mars
  'question-in-the-soil': { x: 146, y: 172, siteLabel: 'Chryse Planitia', spriteKey: 'surveyor' },
  'clues-beneath-the-wheel': { x: 336, y: 256, siteLabel: 'Gusev / Home Plate', spriteKey: 'curiosity' },
  'air-thin-as-a-whisper': { x: 508, y: 138, siteLabel: 'Jezero Crater', spriteKey: 'rocket' },
  // Chapter III — Elsewhere
  'landing-not-planned': { x: 142, y: 184, siteLabel: '433 Eros · Himeros', spriteKey: 'surveyor' },
  'power-for-the-unknown': { x: 332, y: 126, siteLabel: 'Interstellar Space', spriteKey: 'lm' },
  'one-chance-at-pluto': { x: 506, y: 246, siteLabel: 'Pluto Flyby Corridor', spriteKey: 'rocket' },
};

const CRATERS: Record<SectorId, Array<{ x: number; y: number; rx: number; ry: number }>> = {
  moon: [
    { x: 112, y: 288, rx: 46, ry: 22 },
    { x: 254, y: 118, rx: 22, ry: 11 },
    { x: 432, y: 232, rx: 30, ry: 15 },
    { x: 562, y: 274, rx: 38, ry: 18 },
    { x: 538, y: 92, rx: 16, ry: 8 },
  ],
  mars: [
    { x: 102, y: 286, rx: 40, ry: 18 },
    { x: 258, y: 116, rx: 24, ry: 12 },
    { x: 426, y: 228, rx: 28, ry: 14 },
    { x: 566, y: 268, rx: 34, ry: 16 },
    { x: 528, y: 86, rx: 16, ry: 8 },
  ],
  elsewhere: [
    { x: 108, y: 284, rx: 32, ry: 15 },
    { x: 248, y: 112, rx: 20, ry: 10 },
    { x: 432, y: 234, rx: 26, ry: 13 },
    { x: 558, y: 270, rx: 28, ry: 14 },
  ],
};

// Strict ART_STYLE_GUIDE.md 24-color palette
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

const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

function hash2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash2D(ix, iy, seed);
  const b = hash2D(ix + 1, iy, seed);
  const c = hash2D(ix, iy + 1, seed);
  const d = hash2D(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function buildTopDownTerrainCanvas(sector: SectorId): HTMLCanvasElement {
  // Pre-render at 320x180 and scale 2x nearest-neighbor for authentic crisp Bayer pixel dithering (img/05.jpg).
  const w = 320;
  const h = 180;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  if (!ctx) return off;

  const moonRamp = [PALETTE.indigo, PALETTE.basalt, PALETTE.regolithDeep, PALETTE.regolithMid, PALETTE.dustLight];
  const marsRamp = [PALETTE.shadowUmber, PALETTE.deepRust, PALETTE.ochre, PALETTE.terracotta, PALETTE.dustTan];
  const spaceRamp = [PALETTE.void, PALETTE.indigo, PALETTE.navy, PALETTE.dusk, PALETTE.basalt];
  const ramp = sector === 'mars' ? marsRamp : sector === 'elsewhere' ? spaceRamp : moonRamp;
  const seed = sector === 'mars' ? 19 : sector === 'elsewhere' ? 43 : 7;

  // Ordered Bayer-dithered surface value-noise heightfield
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      // Vignette framing toward edges & top horizon strip matches Still Out There img/05.jpg
      const ex = (x - w * 0.5) / (w * 0.5);
      const ey = (y - h * 0.52) / (h * 0.5);
      const edgeFade = Math.max(0, Math.min(1, 1 - (ex * ex * 0.42 + ey * ey * 0.36)));

      const n1 = valueNoise(x * 0.045, y * 0.055, seed);
      const n2 = valueNoise(x * 0.14, y * 0.16, seed + 11) * 0.35;
      const heightVal = sector === 'elsewhere'
        ? (n1 * 0.5 + n2 * 0.4) * (0.35 + edgeFade * 0.5)
        : (n1 * 0.68 + n2 * 0.32) * (0.45 + edgeFade * 0.72);

      const scaled = Math.max(0, Math.min(ramp.length - 1.001, heightVal * (ramp.length - 0.85)));
      const idx = Math.floor(scaled);
      const frac = scaled - idx;
      const threshold = (BAYER_4X4[y & 3][x & 3] + 0.5) / 16;
      const shadeIdx = frac > threshold && idx + 1 < ramp.length ? idx + 1 : idx;

      ctx.fillStyle = y < 14 && sector !== 'elsewhere' ? PALETTE.void : ramp[shadeIdx];
      ctx.fillRect(x, y, 1, 1);
    }
  }

  // Deep-space trajectory arcs & faint star speckle in Elsewhere, or crater bowls on Moon/Mars
  if (sector === 'elsewhere') {
    for (let i = 0; i < 48; i += 1) {
      const sx = Math.floor(hash2D(i, 3, 91) * w);
      const sy = Math.floor(hash2D(i, 7, 91) * h);
      ctx.fillStyle = i % 6 === 0 ? PALETTE.laserCore : i % 3 === 0 ? PALETTE.crustCream : PALETTE.dustLight;
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.strokeStyle = PALETTE.cyanShadow;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.55, 130, 64, -0.1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Top-down / 3/4 craters: light top-left rim, Bayer inner wall, deep shadow bowl (img/05.jpg)
  const rimLit = sector === 'mars' ? PALETTE.hazePeach : PALETTE.crustCream;
  const bowlShadow = sector === 'mars' ? PALETTE.shadowUmber : PALETTE.void;
  const wallMid = sector === 'mars' ? PALETTE.deepRust : PALETTE.basalt;
  for (const cr of CRATERS[sector]) {
    const cx = cr.x * 0.5;
    const cy = cr.y * 0.5;
    const rx = cr.rx * 0.5;
    const ry = cr.ry * 0.5;

    ctx.fillStyle = wallMid;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bowlShadow;
    ctx.beginPath();
    ctx.ellipse(cx - rx * 0.08, cy - ry * 0.05, Math.max(3, rx * 0.78), Math.max(2, ry * 0.72), 0, 0, Math.PI * 2);
    ctx.fill();

    // Bright outer rim top-left + subtle inner bottom-right catchlight
    ctx.strokeStyle = rimLit;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, Math.PI * 0.9, Math.PI * 1.72);
    ctx.stroke();
  }

  // Surface boulders (1px highlight top-left + 1px shadow bottom-right, img/05.jpg)
  const rockLit = sector === 'mars' ? PALETTE.dustTan : PALETTE.crustCream;
  const rockBody = sector === 'mars' ? PALETTE.ochre : PALETTE.regolithMid;
  const rockShad = sector === 'mars' ? PALETTE.shadowUmber : PALETTE.indigo;
  for (let i = 0; i < 34; i += 1) {
    const rx = Math.round(14 + hash2D(i, 1, seed + 5) * (w - 28));
    const ry = Math.round(24 + hash2D(i, 2, seed + 5) * (h - 34));
    const rw = i % 7 === 0 ? 4 : 2;
    const rh = i % 7 === 0 ? 3 : 2;
    ctx.fillStyle = rockShad;
    ctx.fillRect(rx + 1, ry + 1, rw, rh);
    ctx.fillStyle = rockBody;
    ctx.fillRect(rx, ry, rw, rh);
    ctx.fillStyle = rockLit;
    ctx.fillRect(rx, ry, rw - 1, 1);
  }

  // Subtle dark outer edge vignette on the 320x180 map
  const vTop = ctx.createLinearGradient(0, 0, 0, 26);
  vTop.addColorStop(0, 'rgba(5, 7, 15, 0.85)');
  vTop.addColorStop(1, 'rgba(5, 7, 15, 0)');
  ctx.fillStyle = vTop;
  ctx.fillRect(0, 0, w, 26);

  return off;
}

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
    sprites: {} as Record<string, HTMLImageElement>,
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

  // Load 16-bit sprites from /assets/sprites/ once
  useEffect(() => {
    const names = ['robot', 'surveyor', 'lm', 'curiosity', 'rocket'];
    for (const name of names) {
      if (stateRef.current.sprites[name]) continue;
      const img = new Image();
      img.src = `/assets/sprites/${name}.png`;
      stateRef.current.sprites[name] = img;
    }
  }, []);

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

    const terrainBg = buildTopDownTerrainCanvas(sector);
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let rafId = 0;
    let frame = 0;
    let lastTime = 0;

    const tick = (time: number) => {
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
      lastTime = time;
      const reducedMotion = motionQuery.matches;
      frame += 1;
      const s = stateRef.current;
      if (document.hidden || !document.hasFocus()) {
        if (!paused) rafId = window.requestAnimationFrame(tick);
        return;
      }
      s.pulse = reducedMotion || paused ? 0 : (s.pulse + dt * 2.7) % (Math.PI * 2);
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
        setNearestEncounterId(closestId);
        setCoordsReadout({ x: Math.round(s.roverX), y: Math.round(s.roverY) });
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

        // Hardware sprite on surface
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
        ctx.fillStyle = PALETTE.indigo;
        ctx.fillRect(bx, by, boxW, 16);
        ctx.strokeStyle = isNear ? ringColor : PALETTE.cyanDeep;
        ctx.strokeRect(bx + 0.5, by + 0.5, boxW - 1, 15);
        ctx.fillStyle = done ? PALETTE.amber : isNear ? PALETTE.laserCore : PALETTE.highlightRim;
        ctx.fillText(label, bx + 7, by + 11);
      }

      // Click target waypoint crosshair
      if (s.targetX !== null && s.targetY !== null) {
        ctx.strokeStyle = PALETTE.cyan;
        ctx.strokeRect(Math.round(s.targetX - 4), Math.round(s.targetY - 4), 8, 8);
      }

      // Player Field Scout / Robot
      const robotImg = s.sprites.robot;
      if (robotImg && robotImg.complete && robotImg.naturalWidth > 0) {
        ctx.fillStyle = PALETTE.void;
        ctx.beginPath();
        ctx.ellipse(Math.round(s.roverX), Math.round(s.roverY + 3), 11, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        if (s.facing < 0) {
          ctx.translate(Math.round(s.roverX + 12), Math.round(s.roverY - 21 + bounce));
          ctx.scale(-1, 1);
          ctx.drawImage(robotImg, 0, 0, 24, 24);
        } else {
          ctx.drawImage(robotImg, Math.round(s.roverX - 12), Math.round(s.roverY - 21 + bounce), 24, 24);
        }
        ctx.restore();
      } else {
        drawScoutFallback(ctx, s.roverX, s.roverY + bounce, s.facing);
      }

      // Top-left HUD Plate (img/05.jpg: ECHO: SITE · DISTM)
      const activeNear = sectorEncounters.find((e) => e.id === closestId);
      const leftText = activeNear
        ? closestDist < 62
          ? `ECHO: ${activeNear.title.toUpperCase()} · [E] TUNE`
          : `ECHO: ${activeNear.title.toUpperCase()} · ${Math.round(closestDist)}M`
        : `SECTOR: ${sector.toUpperCase()} · DRIVE WITH WASD`;
      ctx.fillStyle = PALETTE.indigo;
      ctx.fillRect(10, 10, 296, 26);
      ctx.strokeStyle = PALETTE.cyan;
      ctx.strokeRect(10.5, 10.5, 295, 25);
      ctx.font = 'bold 10px "IBM Plex Mono", monospace';
      ctx.fillStyle = closestDist < 62 ? PALETTE.laserCore : PALETTE.cyan;
      ctx.fillText(leftText, 18, 27);

      // Top-right HUD Plate (img/05.jpg: • MOON // 0/3 FOUND)
      const rightText = `• ${sector.toUpperCase()} // ${doneInSector}/${sectorEncounters.length} FOUND`;
      ctx.fillStyle = PALETTE.indigo;
      ctx.fillRect(434, 10, 196, 26);
      ctx.strokeStyle = PALETTE.cyan;
      ctx.strokeRect(434.5, 10.5, 195, 25);
      ctx.fillStyle = doneInSector === sectorEncounters.length ? PALETTE.amber : PALETTE.highlightRim;
      ctx.fillText(rightText, 444, 27);

      // Compass bar pointing to next unfinished site
      const nextWaypoint = WAYPOINT_COORDS[nextId];
      ctx.fillStyle = PALETTE.indigo;
      ctx.fillRect(10, 328, 264, 22);
      ctx.strokeStyle = PALETTE.dusk;
      ctx.strokeRect(10.5, 328.5, 263, 21);
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
