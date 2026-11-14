import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { telemetryAudio } from '../../audio/telemetryAudio';
import {
  SourcesArchiveDropdown,
  type ArchiveSubView,
  type RoutePath,
  type SourcesSubView,
} from '../../components/SourcesArchiveDropdown';
import {
  buildEarthSheet,
  drawNineSliceFrame,
  EARTH_FRAMES,
  EARTH_SIZE,
  getMissionSpriteCanvas,
  getRobotIdleCanvas,
  getTitleLayers,
  SOT_PALETTE,
  TITLE_H,
  TITLE_PAD,
  TITLE_W,
} from '../../systems/stillOutThereArt';

interface HomePageProps {
  totalEncounters: number;
  completedCount: number;
  chapterCompletedCounts: {
    moon: number;
    mars: number;
    elsewhere: number;
  };
  missionsCount: number;
  callSign: string;
  onCallSignChange: (next: string) => void;
  audioMuted: boolean;
  onToggleAudio: () => void;
  crtActive: boolean;
  onToggleCrt: () => void;
  onNavigate: (
    target: RoutePath,
    options?: {
      archiveView?: ArchiveSubView;
      sourcesView?: SourcesSubView;
    }
  ) => void;
}

interface MenuOption {
  id: string;
  label: string;
  href: string;
  small?: boolean;
  hint: string;
  action: () => void;
}

const TWINKLE_STARS = Array.from({ length: 16 }, (_, i) => ({
  x: Math.floor(((i * 137) % (TITLE_W - 20)) + 10),
  y: Math.floor(((i * 71) % 190) + 8),
  big: i % 4 === 0,
  color: i % 5 === 0 ? SOT_PALETTE.cyanLaser : SOT_PALETTE.lunarHighlight,
  period: 0.9 + (i % 7) * 0.26,
  phase: ((i * 340) % 2400) / 1000,
}));

const MOTES_INIT = Array.from({ length: 20 }, (_, i) => ({
  x: (i * 89 + 17) % TITLE_W,
  y: TITLE_H - 115 + ((i * 41) % 105),
  vx: 2.5 + (i % 5),
  vy: -(0.6 + (i % 4) * 0.45),
  color: i % 4 === 0 ? SOT_PALETTE.cyanLaser : SOT_PALETTE.lunarCrustCream,
  alpha: 0.2 + (i % 4) * 0.08,
}));

function wrapWords(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const cand = line ? `${line} ${w}` : w;
    if (ctx.measureText(cand).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = cand;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 4);
}

/**
 * Full-viewport Still Out There reference Title/Observatory landing page (`/`).
 * Draws the procedural lunar horizon, rotating Earth, UNIT-7 sprite & live bubble,
 * and floats the cursor-driven START GAME CTA + SOURCES & ARCHIVES dropdown over the scene.
 */
export function HomePage({
  totalEncounters,
  completedCount,
  chapterCompletedCounts,
  missionsCount,
  callSign,
  onCallSignChange,
  audioMuted,
  onToggleAudio,
  crtActive,
  onToggleCrt,
  onNavigate,
}: HomePageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const callSignRef = useRef(callSign);
  const hintRef = useRef<string>(
    `Optics online. ${missionsCount} NASA artifacts cataloged, ${totalEncounters} signals out there.`
  );
  const parallaxTargetRef = useRef(0);
  const parallaxCurrentRef = useRef(0);

  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    callSignRef.current = callSign;
  }, [callSign]);

  const menuOptions = useMemo<MenuOption[]>(
    () => [
      {
        id: 'btn-start-game',
        label: 'START GAME',
        href: '/game/',
        hint:
          completedCount > 0
            ? `${completedCount} of ${totalEncounters} signals recovered. Ready on /game whenever you are.`
            : `Optics online. ${totalEncounters} signals are still waiting on the Moon, Mars, and deep space.`,
        action: () => onNavigate('/game'),
      },
      {
        id: 'btn-open-archive',
        label: `MISSION ARCHIVES (${missionsCount})`,
        href: '/archive/',
        hint: `Every one of the ${missionsCount} NASA spacecraft records across Moon, Mars, and Elsewhere.`,
        action: () => onNavigate('/archive', { archiveView: 'missions' }),
      },
      {
        id: 'btn-open-sources',
        label: 'NASA SOURCES (33)',
        href: '/sources/',
        hint: 'Primary citations from NSSDCA, NASA Science, JPL, ILRS, and PDS.',
        action: () => onNavigate('/sources', { sourcesView: 'registry' }),
      },
      {
        id: 'btn-open-realms',
        label: 'THREE REALMS',
        href: '/archive/?view=realms',
        small: true,
        hint: 'Read the Three Realms & Discovery Bridges moved to /archive.',
        action: () => onNavigate('/archive', { archiveView: 'realms' }),
      },
      {
        id: 'btn-open-evidence',
        label: 'EVIDENCE CHAINS',
        href: '/archive/?view=evidence',
        small: true,
        hint: 'Inspect learning intents and science observation chains.',
        action: () => onNavigate('/archive', { archiveView: 'evidence' }),
      },
      {
        id: 'btn-open-methodology',
        label: 'TWO-VOICE & SAVE',
        href: '/sources/?view=methodology',
        small: true,
        hint: 'Review the Two-Voice Standard, glossary, SI disclosure, and JSON save data.',
        action: () => onNavigate('/sources', { sourcesView: 'methodology' }),
      },
    ],
    [completedCount, missionsCount, onNavigate, totalEncounters]
  );

  const selectMenuIndex = useCallback((nextIdx: number, moveFocus = false) => {
    setSelectedIndex(nextIdx);
    if (moveFocus) itemRefs.current[nextIdx]?.focus();
  }, []);

  useEffect(() => {
    hintRef.current = menuOptions[selectedIndex]?.hint ?? '';
  }, [menuOptions, selectedIndex]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const targetTag = target?.tagName;
      if (targetTag === 'INPUT' || targetTag === 'TEXTAREA') return;
      if (document.querySelector('[role="menu"], [role="dialog"]')) return;
      const key = e.key.toLowerCase();
      if (key === 'arrowup' || key === 'arrowleft' || key === 'w' || key === 'a') {
        e.preventDefault();
        telemetryAudio.playChirp(740, 0.02);
        const nextIdx = (selectedIndex - 1 + menuOptions.length) % menuOptions.length;
        selectMenuIndex(nextIdx, true);
      } else if (key === 'arrowdown' || key === 'arrowright' || key === 's' || key === 'd') {
        e.preventDefault();
        telemetryAudio.playChirp(780, 0.02);
        const nextIdx = (selectedIndex + 1) % menuOptions.length;
        selectMenuIndex(nextIdx, true);
      } else if (key === 'enter' && targetTag !== 'BUTTON' && targetTag !== 'A') {
        e.preventDefault();
        menuOptions[selectedIndex]?.action();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOptions, selectedIndex, selectMenuIndex]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const layers = getTitleLayers();
    const earthSheet = buildEarthSheet();
    const robot = getRobotIdleCanvas();
    const distantLander = getMissionSpriteCanvas('apollo-11-surface');
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motes = MOTES_INIT.map((m) => ({ ...m }));

    let rafId = 0;
    let lastTime = 0;

    const draw = (time: number) => {
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
      lastTime = time;
      const reduced = motionQuery.matches;
      const elapsed = reduced ? 0 : time / 1000;

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(layers.sky, 0, 0, TITLE_W, TITLE_H);

      // Twinkling stars
      for (const st of TWINKLE_STARS) {
        const pulse = reduced ? 1 : 0.35 + 0.65 * Math.abs(Math.sin((elapsed + st.phase) / st.period));
        ctx.globalAlpha = pulse;
        ctx.fillStyle = st.color;
        ctx.fillRect(st.x, st.y, 1, 1);
        if (st.big) {
          ctx.globalAlpha = pulse * 0.45;
          ctx.fillRect(st.x - 1, st.y, 1, 1);
          ctx.fillRect(st.x + 1, st.y, 1, 1);
          ctx.fillRect(st.x, st.y - 1, 1, 1);
          ctx.fillRect(st.x, st.y + 1, 1, 1);
        }
      }
      ctx.globalAlpha = 1;

      if (!reduced) {
        parallaxCurrentRef.current +=
          (parallaxTargetRef.current - parallaxCurrentRef.current) * Math.min(1, dt * 3);
      }
      const p = parallaxCurrentRef.current;

      // Rotating Pixel Earth upper-right (TitleScene.ts: ex = 77% W, ey = 92)
      const earthX = Math.round(TITLE_W * 0.77 - p * 4 - EARTH_SIZE / 2);
      const earthY = Math.round(92 + (reduced ? 0 : Math.sin(elapsed * 0.5) * 2.5) - EARTH_SIZE / 2);
      const earthFrame = reduced ? 0 : Math.floor(elapsed * 3) % EARTH_FRAMES;
      ctx.drawImage(
        earthSheet,
        earthFrame * EARTH_SIZE,
        0,
        EARTH_SIZE,
        EARTH_SIZE,
        earthX,
        earthY,
        EARTH_SIZE,
        EARTH_SIZE
      );

      // Far ridge
      ctx.drawImage(layers.far.canvas, Math.round(-TITLE_PAD - p * 6), 0);

      // Mid ridge + distant Apollo LM with blinking amber beacon (TitleScene.ts x = 86% W)
      const midOffsetX = Math.round(-TITLE_PAD - p * 12);
      ctx.drawImage(layers.mid.canvas, midOffsetX, 0);
      const landerX = Math.round(TITLE_W * 0.86);
      const landerSurface = layers.mid.heights[landerX + TITLE_PAD] ?? 262;
      const landerDrawX = Math.round(landerX - p * 12);
      ctx.drawImage(distantLander, landerDrawX - 16, landerSurface - 25, 32, 32);
      const beaconOn = reduced || Math.floor(elapsed * 1.4) % 3 !== 0;
      if (beaconOn) {
        ctx.fillStyle = SOT_PALETTE.beaconGold;
        ctx.fillRect(landerDrawX - 1, landerSurface - 24, 2, 2);
      }

      // Near ridge + UNIT-7 tracks + shadow + robot + NineSlice speech bubble
      const nearOffsetX = Math.round(-TITLE_PAD - p * 22);
      ctx.drawImage(layers.near.canvas, nearOffsetX, 0);
      const robotX = 92;
      const robotSurface = layers.near.heights[robotX + TITLE_PAD] ?? 298;
      const robotDrawX = Math.round(robotX - p * 22);

      for (let tx = robotX - 16, i = 0; tx > 8; tx -= 5, i += 1) {
        const ty = (layers.near.heights[tx + TITLE_PAD] ?? robotSurface) + 2;
        ctx.fillStyle = SOT_PALETTE.lunarBasaltDark;
        ctx.globalAlpha = Math.max(0.15, 0.78 - i * 0.05);
        ctx.fillRect(Math.round(tx - p * 22), ty, 2, 1);
        ctx.fillRect(Math.round(tx - p * 22), ty + 3, 2, 1);
      }
      ctx.globalAlpha = 1;

      ctx.fillStyle = 'rgba(11, 15, 29, 0.72)';
      ctx.beginPath();
      ctx.ellipse(robotDrawX, robotSurface + 1, 17, 3, 0, 0, Math.PI * 2);
      ctx.fill();

      const bob = !reduced && Math.sin(elapsed * 2.2) > 0.4 ? -1 : 0;
      const robotTop = robotSurface + 1 - 42 + bob;
      ctx.drawImage(robot, robotDrawX - 24, robotTop - 6, 48, 48);

      // Antenna glint
      if (reduced || Math.floor(elapsed * 2) % 3 !== 0) {
        ctx.fillStyle = SOT_PALETTE.thrusterOrange;
        ctx.fillRect(robotDrawX + 6, robotTop - 5, 3, 3);
      }

      // UNIT-7 Speech Bubble (completely unobstructed on left ridge)
      ctx.font = 'bold 8px "IBM Plex Mono", monospace';
      const lines = wrapWords(ctx, hintRef.current, 146);
      const bw = 164;
      const bh = Math.max(36, 20 + lines.length * 11);
      const bx = Math.max(14, robotDrawX - 64);
      const by = Math.max(54, Math.round(robotTop - 16 - bh));
      drawNineSliceFrame(ctx, bx, by, bw, bh, SOT_PALETTE.cyanGlow, 'rgba(11, 15, 29, 0.92)');
      // Pixel tail pointing to UNIT-7 head
      ctx.fillStyle = SOT_PALETTE.cyanGlow;
      ctx.fillRect(robotDrawX - 3, by + bh, 6, 2);
      ctx.fillRect(robotDrawX - 1, by + bh + 2, 3, 3);
      ctx.fillStyle = SOT_PALETTE.cyanLaser;
      ctx.fillText(callSignRef.current || 'UNIT-7', bx + 8, by + 12);
      ctx.fillStyle = SOT_PALETTE.lunarHighlight;
      lines.forEach((ln, idx) => {
        ctx.fillText(ln, bx + 8, by + 24 + idx * 11);
      });

      // Floating regolith dust motes
      if (!reduced) {
        for (const m of motes) {
          m.x += m.vx * dt;
          m.y += m.vy * dt;
          if (m.x > TITLE_W + 2 || m.y < TITLE_H - 130) {
            m.x = -4;
            m.y = TITLE_H - 55 + (Math.random() * 48);
          }
          ctx.globalAlpha = m.alpha;
          ctx.fillStyle = m.color;
          ctx.fillRect(Math.round(m.x), Math.round(m.y), 1, 1);
        }
        ctx.globalAlpha = 1;
      }

      // Left & right letterbox fade matching TitleScene.ts
      const leftFade = ctx.createLinearGradient(0, 0, 32, 0);
      leftFade.addColorStop(0, SOT_PALETTE.spaceBlack);
      leftFade.addColorStop(1, 'rgba(5, 7, 15, 0)');
      ctx.fillStyle = leftFade;
      ctx.fillRect(0, 0, 32, TITLE_H);

      const rightFade = ctx.createLinearGradient(TITLE_W - 32, 0, TITLE_W, 0);
      rightFade.addColorStop(0, 'rgba(5, 7, 15, 0)');
      rightFade.addColorStop(1, SOT_PALETTE.spaceBlack);
      ctx.fillStyle = rightFade;
      ctx.fillRect(TITLE_W - 32, 0, 32, TITLE_H);

      if (!reduced && !document.hidden) rafId = requestAnimationFrame(draw);
    };

    const redraw = () => {
      cancelAnimationFrame(rafId);
      draw(performance.now());
    };
    redraw();
    motionQuery.addEventListener('change', redraw);
    document.addEventListener('visibilitychange', redraw);
    return () => {
      cancelAnimationFrame(rafId);
      motionQuery.removeEventListener('change', redraw);
      document.removeEventListener('visibilitychange', redraw);
    };
  }, []);

  const moonCount = Math.min(3, chapterCompletedCounts.moon);
  const marsCount = Math.min(3, chapterCompletedCounts.mars);
  const deepCount = Math.min(3, chapterCompletedCounts.elsewhere);

  return (
    <main
      id="main-content"
      className="title-viewport"
      aria-label="Echoes of Exploration Main Screen"
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        if (rect.width > 0) {
          parallaxTargetRef.current = Math.max(-0.5, Math.min(0.5, (e.clientX - rect.left) / rect.width - 0.5));
        }
      }}
    >
      <div className="title-stage-16x9">
        <canvas
          ref={canvasRef}
          width={TITLE_W}
          height={TITLE_H}
          className="title-bg-canvas pixelated"
          aria-hidden="true"
        />

        {/* Top-left Echo Pip Gauge (still-out-there .tmenu-hud) */}
        <div
          className="tmenu-hud"
          role="status"
          aria-label={`${completedCount} of ${totalEncounters} echoes recovered`}
        >
          <span className="tmenu-hud__label">ECHOES</span>
          <span className="pips pips--moon" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <i key={`m-${i}`} className={i < moonCount ? 'on' : ''} />
            ))}
          </span>
          <span className="pips pips--mars" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <i key={`r-${i}`} className={i < marsCount ? 'on' : ''} />
            ))}
          </span>
          <span className="pips pips--elsewhere" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <i key={`e-${i}`} className={i < deepCount ? 'on' : ''} />
            ))}
          </span>
          <span className="tmenu-hud__count">
            {String(completedCount).padStart(2, '0')}
            <small>/{totalEncounters}</small>
          </span>
        </div>

        {/* Top-right Controls + Required Sources & Archives Dropdown */}
        <div className="tmenu-topbar-right">
          <label className="sr-only" htmlFor="title-callsign-input">
            Archivist Call Sign
          </label>
          <input
            id="title-callsign-input"
            type="text"
            maxLength={18}
            value={callSign}
            onChange={(e) => onCallSignChange(e.target.value.toUpperCase())}
            className="tmenu-callsign-input"
            title="Archivist Call Sign"
          />

          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={onToggleAudio}
            aria-label={audioMuted ? 'Unmute telemetry audio' : 'Mute telemetry audio'}
          >
            {audioMuted ? 'AUDIO: OFF' : 'AUDIO: ON'}
          </button>

          <button
            type="button"
            className={`btn-secondary btn-sm ${crtActive ? 'active' : ''}`}
            onClick={onToggleCrt}
          >
            CRT
          </button>

          <SourcesArchiveDropdown
            routePath="/"
            archiveSubView="missions"
            sourcesSubView="registry"
            alignRight
            onSelectArchive={(view) => onNavigate('/archive', { archiveView: view })}
            onSelectSources={(view) => onNavigate('/sources', { sourcesView: view })}
          />
        </div>

        {/* Floating Pixel Wordmark + Amber Tagline drawn directly over the sky */}
        <header className="tmenu-header">
          <h1 className="tmenu-logo">
            ECHOES OF EXPLORATION<span className="tmenu-cursor" aria-hidden="true">_</span>
          </h1>
          <p className="tmenu-tagline">ABANDONED, BUT NOT FORGOTTEN</p>
        </header>

        {/* Transparent Floating Game Start Menu (no opaque box covering the art!) */}
        <nav className="tmenu" aria-label="Main menu">
          <ul className="tmenu__list">
            {menuOptions
              .filter((m) => !m.small)
              .map((opt, idx) => (
                <li key={opt.id}>
                  <a
                    id={opt.id}
                    ref={(el) => {
                      itemRefs.current[idx] = el;
                    }}
                    href={opt.href}
                    className={`tmenu__item ${idx === 0 ? 'tmenu__item--first' : ''} ${
                      selectedIndex === idx ? 'is-selected' : ''
                    }`}
                    onMouseEnter={() => {
                      if (selectedIndex !== idx) telemetryAudio.playChirp(740, 0.02);
                      setSelectedIndex(idx);
                    }}
                    onFocus={() => setSelectedIndex(idx)}
                    onClick={(e) => {
                      e.preventDefault();
                      opt.action();
                    }}
                  >
                    <span className="tmenu__label">{opt.label}</span>
                  </a>
                </li>
              ))}
          </ul>

          <ul className="tmenu__row" aria-label="Archive & Source Subdirectories">
            {menuOptions
              .filter((m) => m.small)
              .map((opt, smallIdx) => {
                const fullIdx = 3 + smallIdx;
                return (
                  <li key={opt.id}>
                    <a
                      id={opt.id}
                      ref={(el) => {
                        itemRefs.current[fullIdx] = el;
                      }}
                      href={opt.href}
                      className={`tmenu__item tmenu__item--small ${
                        selectedIndex === fullIdx ? 'is-selected' : ''
                      }`}
                      onMouseEnter={() => {
                        if (selectedIndex !== fullIdx) telemetryAudio.playChirp(740, 0.02);
                        setSelectedIndex(fullIdx);
                      }}
                      onFocus={() => setSelectedIndex(fullIdx)}
                      onClick={(e) => {
                        e.preventDefault();
                        opt.action();
                      }}
                    >
                      <span className="tmenu__label">{opt.label}</span>
                    </a>
                  </li>
                );
              })}
          </ul>
        </nav>

        {/* Mobile Fallback Dialogue Bar */}
        <p className="tmenu-say" aria-live="polite">
          <span className="tmenu-say__who">{callSign || 'UNIT-7'}</span>
          {menuOptions[selectedIndex]?.hint}
        </p>

        {/* Bottom HUD Controls & Attribution */}
        <div className="tmenu-keys" aria-hidden="true">
          <kbd>↑</kbd> <kbd>↓</kbd> SELECT · <kbd>ENTER</kbd> CONFIRM
        </div>
        <div className="tmenu-credit">
          DATA: NASA NSSDCA / PDS · EST. 1966 – 2026 · SI-Generated Illustration
        </div>
      </div>
    </main>
  );
}
