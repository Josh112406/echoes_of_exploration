// SI-assisted route integration; game components mount only on /game.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { telemetryAudio } from './audio/telemetryAudio';
import { BehindTheMemoryPanel } from './components/BehindTheMemoryPanel';
import { NarrativeEncounterConsole } from './components/NarrativeEncounterConsole';
import { SignalInspectorModal } from './components/SignalInspectorModal';
import { StarfieldCanvas } from './components/StarfieldCanvas';
import { SurfaceExplorerCanvas, type SectorId } from './components/SurfaceExplorerCanvas';
import encountersJson from './data/encounters.json';
import missionsJson from './data/missions.json';
import sourcesJson from './data/sources.json';
import {
  getChapterAccentColor,
  getChapterSceneClass,
  getMissionSprite,
  getStatusBadgeInfo,
  type CatalogEncounterRecord,
  type MissionRecord,
  type NarrativeBundle,
  type SaveStatePayload,
  type SourceRecord,
} from './data/types';
import { SurveyorEncounterPreview } from './game/SurveyorEncounterPreview';
import narrativeJson from './text/narrative.json';

type RoutePath = '/' | '/archive' | '/sources' | '/game';
type ArchiveSubView = 'missions' | 'evidence';
type SourcesSubView = 'registry' | 'references' | 'methodology';
type ChapterFilter = 'all' | 'moon' | 'mars' | 'elsewhere' | 'featured';
type StatusGroupFilter = 'all' | 'active' | 'passive' | 'dormant' | 'ended';
type GameMode = 'map' | 'console';

const BADGE_STORAGE_KEY = 'echoes_unlocked_badges_v1';
const CALLSIGN_STORAGE_KEY = 'echoes_call_sign_v1';
const MAX_IMPORT_BYTES = 64 * 1024;

const MISSIONS: MissionRecord[] = (missionsJson as { records: MissionRecord[] }).records || [];
const MISSIONS_REVIEWED_ON: string =
  (missionsJson as { reviewed_on?: string }).reviewed_on || '2026-11-09';
const SOURCES_LIST: SourceRecord[] = (sourcesJson as { sources: SourceRecord[] }).sources || [];
const ENCOUNTERS_CATALOG: CatalogEncounterRecord[] =
  (encountersJson as { encounters: CatalogEncounterRecord[] }).encounters || [];
const NARRATIVE = narrativeJson as unknown as NarrativeBundle;

const ARCHIVE_MENU_OPTIONS: Array<{
  id: ArchiveSubView | SourcesSubView;
  route: '/archive' | '/sources';
  group: string;
  href: string;
  label: string;
  desc: string;
}> = [
  {
    id: 'missions',
    route: '/archive',
    group: 'MISSION ARCHIVES WEBPAGE (/archive)',
    href: '/archive',
    label: 'Mission Archives Catalog (31)',
    desc: 'Filterable museum catalog of NASA spacecraft across Moon, Mars & Deep Space',
  },
  {
    id: 'evidence',
    route: '/archive',
    group: 'MISSION ARCHIVES WEBPAGE (/archive)',
    href: '/archive?view=evidence',
    label: 'Encounter Evidence Chains (9)',
    desc: 'Learning intents, observation chains & simplification disclosures',
  },
  {
    id: 'registry',
    route: '/sources',
    group: 'NASA SOURCES WEBPAGE (/sources)',
    href: '/sources',
    label: 'Primary NASA Sources Registry (33)',
    desc: 'Verified NASA, JPL, NSSDCA, ILRS & PDS authority citations',
  },
  {
    id: 'references',
    route: '/sources',
    group: 'NASA SOURCES WEBPAGE (/sources)',
    href: '/sources?view=references',
    label: 'Encounter Science References (6)',
    desc: 'Key NASA instrument & telemetry parameter bibliographies',
  },
  {
    id: 'methodology',
    route: '/sources',
    group: 'NASA SOURCES WEBPAGE (/sources)',
    href: '/sources?view=methodology',
    label: 'Methodology, Glossary & Save Data',
    desc: 'SI disclosure, Space Apps compliance, field glossary & save export',
  },
];

const CHAPTER_CARDS: Array<{
  id: SectorId;
  index: string;
  title: string;
  accent: string;
  subtitle: string;
  bridgeTitle: string;
  bridgeNote: string;
  sprite: string | null;
  spriteAlt: string;
}> = [
  {
    id: 'moon',
    index: '01',
    title: 'The Moon',
    accent: 'var(--crust)',
    subtitle: 'Surveyor landers, Apollo surface packages, laser retroreflectors, and lunar rovers.',
    bridgeTitle: 'Discovery Bridge I: Touchdown -> Precision -> Mobility',
    bridgeNote:
      'Surveyor 1 proved controlled soft landings; Apollo 11 left passive reflectors still measured today; Apollo 17 drove 35.9 km across Taurus-Littrow.',
    sprite: '/assets/sprites/lm.png',
    spriteAlt: 'Lunar module team illustration',
  },
  {
    id: 'mars',
    index: '02',
    title: 'Mars',
    accent: 'var(--rust)',
    subtitle: 'Viking soil labs, Spirit & Opportunity rovers, InSight lander, and Ingenuity rotorcraft.',
    bridgeTitle: 'Discovery Bridge II: Soil Tests -> Wheel Clues -> Powered Flight',
    bridgeNote:
      'Viking tested Martian chemistry carefully; Spirit scraped bright silica with a stalled wheel; Ingenuity proved aerodynamic lift in 1% Earth-density air.',
    sprite: '/assets/sprites/curiosity.png',
    spriteAlt: 'Mars rover team illustration',
  },
  {
    id: 'elsewhere',
    index: '03',
    title: 'Elsewhere',
    accent: 'var(--amber)',
    subtitle: 'NEAR Shoemaker on Eros, Voyager 1 in interstellar space, New Horizons at Pluto, Kepler, Cassini.',
    bridgeTitle: 'Discovery Bridge III: Adaptation -> Power Budget -> One-Shot Flyby',
    bridgeNote:
      'NEAR landed without landing legs; Voyager 1 trades instrument watts across 160+ AU; New Horizons stored years of work into a hours-long Pluto encounter.',
    sprite: null,
    spriteAlt: 'Deep-space target marker',
  },
];

function normalizeRoutePath(pathname: string): RoutePath {
  if (pathname === '/game') return '/game';
  if (pathname === '/sources') return '/sources';
  if (pathname === '/archive' || pathname === '/archives') return '/archive';
  return '/';
}

function getArchiveSubViewFromUrl(search: string): ArchiveSubView {
  try {
    const view = new URLSearchParams(search).get('view');
    if (view === 'evidence') return 'evidence';
  } catch {
    // Ignore malformed query string
  }
  return 'missions';
}

function getSourcesSubViewFromUrl(search: string): SourcesSubView {
  try {
    const view = new URLSearchParams(search).get('view');
    if (view === 'references' || view === 'methodology') return view;
  } catch {
    // Ignore malformed query string
  }
  return 'registry';
}

function getQueryEncounterId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('encounter');
  } catch {
    return null;
  }
}

const DIORAMA_BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Non-playable Observatory Hero Canvas inspired by docs/art-reference/img/02.jpg (Still Out There)
function ObservatoryHeroDiorama({ missionsCount, encountersCount }: { missionsCount: number; encountersCount: number }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const robotImg = new Image();
    const lmImg = new Image();
    robotImg.src = '/assets/sprites/robot.png';
    lmImg.src = '/assets/sprites/lm.png';

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let rafId = 0;

    const draw = (time: number) => {
      const pulse = motionQuery.matches ? 0 : time / 1000;
      ctx.imageSmoothingEnabled = false;

      // Sky background
      ctx.fillStyle = '#05070f';
      ctx.fillRect(0, 0, 640, 360);
      ctx.fillStyle = '#0b0f1d';
      ctx.fillRect(0, 110, 640, 150);

      // Deterministic starfield
      for (let i = 0; i < 72; i += 1) {
        const sx = (i * 139 + 23) % 640;
        const sy = (i * 61 + 13) % 210;
        const bright = i % 8 === 0;
        ctx.fillStyle =
          bright && !motionQuery.matches && Math.sin(pulse * 2 + i) > 0.5
            ? '#7ef1ff'
            : bright
              ? '#e2e6fa'
              : i % 3 === 0
                ? '#b2b8d4'
                : '#8389a8';
        ctx.fillRect(sx, sy, bright ? 2 : 1, bright ? 2 : 1);
      }

      // Hero Light: Pixel Earth upper-right with cyan rim & Bayer terminator (img/02.jpg)
      const ex = 516;
      const ey = 92;
      const er = 36;
      for (let y = -er; y <= er; y += 2) {
        for (let x = -er; x <= er; x += 2) {
          if (x * x + y * y > er * er) continue;
          const tx = (x - 5) / er;
          const n = Math.sin(x * 0.13 + y * 0.11) + Math.cos(y * 0.22 - x * 0.08);
          const th = (DIORAMA_BAYER_4X4[(y + er) & 3][(x + er) & 3] - 7.5) / 36;
          if (tx + th > 0.24) {
            ctx.fillStyle = '#05070f';
          } else if (n > 0.72) {
            ctx.fillStyle = '#0ec3dc';
          } else if (y < -20 && (x + y) % 8 < 3) {
            ctx.fillStyle = '#e2e6fa';
          } else {
            ctx.fillStyle = n > 0.15 ? '#087d99' : '#064b5c';
          }
          ctx.fillRect(ex + x, ey + y, 2, 2);
        }
      }
      ctx.strokeStyle = '#7ef1ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(ex, ey, er + 1, Math.PI * 0.58, Math.PI * 1.65);
      ctx.stroke();
      ctx.strokeStyle = '#0ec3dc';
      ctx.beginPath();
      ctx.arc(ex, ey, er + 3, 0, Math.PI * 2);
      ctx.stroke();

      // 3 Layered Bayer-Dithered Lunar Ridges (img/02.jpg)
      const ridges = [
        { baseY: 224, amp: 14, freq: 0.015, phase: 0.3, fill: '#131a2e', rim: '#27293d' },
        { baseY: 256, amp: 12, freq: 0.022, phase: 1.7, fill: '#27293d', rim: '#595e7d' },
        { baseY: 292, amp: 9, freq: 0.014, phase: 2.9, fill: '#3b3e59', rim: '#8389a8' },
      ];
      for (const r of ridges) {
        ctx.fillStyle = r.fill;
        ctx.beginPath();
        ctx.moveTo(0, 360);
        for (let x = 0; x <= 640; x += 8) {
          ctx.lineTo(x, r.baseY + Math.round(Math.sin(x * r.freq + r.phase) * r.amp));
        }
        ctx.lineTo(640, 360);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = r.rim;
        ctx.beginPath();
        for (let x = 0; x <= 640; x += 8) {
          const y = r.baseY + Math.round(Math.sin(x * r.freq + r.phase) * r.amp);
          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Bayer dither speckles across foreground lunar ridge
      for (let y = 304; y < 360; y += 3) {
        const t = (y - 304) / 56;
        for (let x = 0; x < 640; x += 3) {
          const th = (DIORAMA_BAYER_4X4[(y >> 1) & 3][(x >> 1) & 3] + 0.5) / 16;
          if (t * 0.78 > th) {
            ctx.fillStyle = '#27293d';
            ctx.fillRect(x, y, 2, 2);
          } else if ((x + y) % 17 === 0) {
            ctx.fillStyle = '#595e7d';
            ctx.fillRect(x, y, 2, 1);
          }
        }
      }

      // Left foreground scout sprite + cyan speech box (img/02.jpg)
      const rx = 86;
      const ry = 286;
      ctx.fillStyle = '#05070f';
      ctx.beginPath();
      ctx.ellipse(rx, ry + 16, 15, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (robotImg.complete && robotImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(robotImg, rx - 16, ry - 16, 32, 32);
        ctx.restore();
      } else {
        ctx.fillStyle = '#b2b8d4';
        ctx.fillRect(rx - 10, ry - 10, 20, 18);
        ctx.fillStyle = '#0ec3dc';
        ctx.fillRect(rx - 5, ry - 6, 10, 4);
      }

      // Speech bubble pointer & Cyan terminal callout box
      ctx.fillStyle = '#05070f';
      ctx.fillRect(28, 174, 174, 64);
      ctx.strokeStyle = '#0ec3dc';
      ctx.strokeRect(28.5, 174.5, 173, 63);
      ctx.beginPath();
      ctx.moveTo(82, 238);
      ctx.lineTo(86, 250);
      ctx.lineTo(92, 238);
      ctx.stroke();
      ctx.font = 'bold 9px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#0ec3dc';
      ctx.fillText('ARCHIVIST-01', 38, 190);
      ctx.fillStyle = '#e2e6fa';
      ctx.fillText(`OPTICS ONLINE. ${missionsCount} RELICS`, 38, 206);
      ctx.fillText(`LOGGED · ${encountersCount} SIGNALS OUT THERE.`, 38, 220);

      // Right distant lunar lander silhouette + amber beacon (img/02.jpg)
      const lx = 548;
      const ly = 248;
      if (lmImg.complete && lmImg.naturalWidth > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.drawImage(lmImg, lx - 16, ly - 16, 32, 26);
        ctx.restore();
      } else {
        ctx.fillStyle = '#cf724a';
        ctx.fillRect(lx - 10, ly - 8, 20, 12);
      }
      ctx.fillStyle = !motionQuery.matches && Math.sin(pulse * 3) < -0.2 ? '#e65100' : '#f59e0b';
      ctx.fillRect(lx - 1, ly - 20, 3, 3);

      // Corner archive attribution & SI watermark
      ctx.font = '9px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#8389a8';
      ctx.fillText('DATA: NASA NSSDCA / PDS / JPL · EST. 1966-2026', 14, 348);
      ctx.fillText('SI-Generated Illustration', 488, 348);

      if (!motionQuery.matches && !document.hidden) rafId = requestAnimationFrame(draw);
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
  }, [missionsCount, encountersCount]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={360}
      className="hero-diorama-canvas pixelated"
      aria-hidden="true"
    />
  );
}

export function App() {
  const [routePath, setRoutePath] = useState<RoutePath>(() =>
    normalizeRoutePath(window.location.pathname)
  );
  const [crtActive, setCrtActive] = useState<boolean>(false);
  const [audioMuted, setAudioMuted] = useState<boolean>(false);
  const [utcTime, setUtcTime] = useState<string>('');

  // Separate Archive (/archive) & Sources (/sources) page state
  const [dropdownOpen, setDropdownOpen] = useState<boolean>(false);
  const [archiveSubView, setArchiveSubView] = useState<ArchiveSubView>(() =>
    getArchiveSubViewFromUrl(window.location.search)
  );
  const [sourcesSubView, setSourcesSubView] = useState<SourcesSubView>(() =>
    getSourcesSubViewFromUrl(window.location.search)
  );
  const [filterChapter, setFilterChapter] = useState<ChapterFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusGroupFilter>('all');
  const [sourceOrgFilter, setSourceOrgFilter] = useState<string>('ALL');
  const [sourceSearch, setSourceSearch] = useState<string>('');
  const [search, setSearch] = useState<string>('');
  const [selectedMission, setSelectedMission] = useState<MissionRecord | null>(null);
  const [saveMessage, setSaveMessage] = useState<string>('');

  // Game Page (/game) state
  const [selectedEncounterId, setSelectedEncounterId] = useState<string>(() => {
    const q = getQueryEncounterId();
    return q && NARRATIVE.encounters.some((e) => e.id === q) ? q : 'gentle-touch';
  });
  const [gameMode, setGameMode] = useState<GameMode>(() =>
    getQueryEncounterId() ? 'console' : 'map'
  );
  const [activeSector, setActiveSector] = useState<SectorId>(() => {
    const q = getQueryEncounterId();
    const enc = NARRATIVE.encounters.find((e) => e.id === q);
    if (enc && (enc.chapter === 'moon' || enc.chapter === 'mars' || enc.chapter === 'elsewhere')) {
      return enc.chapter;
    }
    return 'moon';
  });

  // Persistent local state
  const [callSign, setCallSign] = useState<string>(() => {
    try {
      return localStorage.getItem(CALLSIGN_STORAGE_KEY) || 'ARCHIVIST-01';
    } catch {
      return 'ARCHIVIST-01';
    }
  });

  const [unlockedBadges, setUnlockedBadges] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(BADGE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      // Ignore storage read failures
    }
    return [];
  });

  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const dropdownTriggerRef = useRef<HTMLButtonElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const missions = MISSIONS;
  const missionsReviewedOn = MISSIONS_REVIEWED_ON;
  const sourcesList = SOURCES_LIST;
  const encountersCatalog = ENCOUNTERS_CATALOG;
  const narrative = NARRATIVE;

  const sourcesMap = useMemo(() => {
    const map = new Map<string, SourceRecord>();
    for (const s of SOURCES_LIST) map.set(s.id, s);
    return map;
  }, []);

  const encounterByMissionId = useMemo(() => {
    const map = new Map<string, NarrativeBundle['encounters'][number]>();
    for (const enc of NARRATIVE.encounters) map.set(enc.mission_id, enc);
    return map;
  }, []);

  const datasetEncounterMap = useMemo(() => {
    const map = new Map<string, CatalogEncounterRecord>();
    for (const enc of ENCOUNTERS_CATALOG) map.set(enc.id, enc);
    return map;
  }, []);

  const selectedEncounter = useMemo(() => {
    return (
      NARRATIVE.encounters.find((e) => e.id === selectedEncounterId) ??
      NARRATIVE.encounters[0]
    );
  }, [selectedEncounterId]);

  const selectedDatasetEncounter = datasetEncounterMap.get(selectedEncounter.id);

  // Sync browser history & URL (?encounter=..., ?view=...)
  useEffect(() => {
    const onPopState = () => {
      const nextRoute = normalizeRoutePath(window.location.pathname);
      setRoutePath(nextRoute);
      setDropdownOpen(false);
      if (nextRoute === '/archive') {
        setArchiveSubView(getArchiveSubViewFromUrl(window.location.search));
      } else if (nextRoute === '/sources') {
        setSourcesSubView(getSourcesSubViewFromUrl(window.location.search));
      }
      const q = getQueryEncounterId();
      if (nextRoute === '/game' && q) {
        const found = NARRATIVE.encounters.find((e) => e.id === q);
        if (found) {
          setSelectedEncounterId(found.id);
          setActiveSector(found.chapter as SectorId);
          setGameMode('console');
        }
      }
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Close Sources & Archives dropdown on outside click or Escape
  useEffect(() => {
    if (!dropdownOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false);
        dropdownTriggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      window.removeEventListener('keydown', onKey);
    };
  }, [dropdownOpen]);

  // Persist save state
  useEffect(() => {
    try {
      localStorage.setItem(BADGE_STORAGE_KEY, JSON.stringify(unlockedBadges));
    } catch {
      // Ignore storage write failures
    }
  }, [unlockedBadges]);

  useEffect(() => {
    try {
      localStorage.setItem(CALLSIGN_STORAGE_KEY, callSign);
    } catch {
      // Ignore storage write failures
    }
  }, [callSign]);

  // UTC Telemetry clock
  useEffect(() => {
    const updateTime = () => {
      setUtcTime(new Date().toUTCString().replace('GMT', 'UTC'));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const navigateTo = useCallback(
    (
      target: RoutePath,
      options?: {
        encounterId?: string;
        mode?: GameMode;
        archiveView?: ArchiveSubView;
        sourcesView?: SourcesSubView;
      }
    ) => {
      telemetryAudio.playChirp(target === '/game' ? 980 : 820, 0.04);
      setDropdownOpen(false);
      let url: string = target;
      if (target === '/game' && options?.encounterId) {
        url = `/game?encounter=${encodeURIComponent(options.encounterId)}`;
      } else if (target === '/archive' && options?.archiveView && options.archiveView !== 'missions') {
        url = `/archive?view=${encodeURIComponent(options.archiveView)}`;
      } else if (target === '/sources' && options?.sourcesView && options.sourcesView !== 'registry') {
        url = `/sources?view=${encodeURIComponent(options.sourcesView)}`;
      }
      if (window.location.pathname + window.location.search !== url) {
        window.history.pushState({}, '', url);
      }
      setRoutePath(target);

      if (target === '/archive') {
        setArchiveSubView(options?.archiveView ?? 'missions');
      } else if (target === '/sources') {
        setSourcesSubView(options?.sourcesView ?? 'registry');
      } else if (target === '/game') {
        if (options?.encounterId) {
          const found = narrative.encounters.find((e) => e.id === options.encounterId);
          if (found) {
            setSelectedEncounterId(found.id);
            setActiveSector(found.chapter as SectorId);
          }
        }
        setGameMode(options?.mode ?? (options?.encounterId ? 'console' : 'map'));
      }
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [narrative.encounters]
  );

  const handleSelectMenuItem = (item: (typeof ARCHIVE_MENU_OPTIONS)[number]) => {
    telemetryAudio.playChirp(860, 0.03);
    setDropdownOpen(false);
    if (item.route === '/archive') {
      navigateTo('/archive', { archiveView: item.id as ArchiveSubView });
    } else {
      navigateTo('/sources', { sourcesView: item.id as SourcesSubView });
    }
  };

  const handleEncounterComplete = useCallback((badgeId: string) => {
    setUnlockedBadges((prev) => (prev.includes(badgeId) ? prev : [...prev, badgeId]));
  }, []);

  const isEncounterCompleted = useCallback(
    (encounterId: string): boolean => {
      if (encounterId === 'gentle-touch') {
        return (
          unlockedBadges.includes('surveyor-1-touchdown') ||
          unlockedBadges.includes('gentle-touch')
        );
      }
      return unlockedBadges.includes(encounterId);
    },
    [unlockedBadges]
  );

  const completedCount = narrative.encounters.filter((e) => isEncounterCompleted(e.id)).length;

  const chapterCompletedCounts = useMemo(() => {
    const countFor = (ch: SectorId) =>
      narrative.encounters.filter((e) => e.chapter === ch && isEncounterCompleted(e.id)).length;
    return {
      moon: countFor('moon'),
      mars: countFor('mars'),
      elsewhere: countFor('elsewhere'),
    };
  }, [narrative.encounters, isEncounterCompleted]);

  const chapterCounts = useMemo(() => {
    return {
      moon: MISSIONS.filter((m) => m.chapter === 'moon').length,
      mars: MISSIONS.filter((m) => m.chapter === 'mars').length,
      elsewhere: MISSIONS.filter((m) => m.chapter === 'elsewhere').length,
      featured: MISSIONS.filter((m) => m.featured).length,
    };
  }, []);

  const filteredMissions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MISSIONS.filter((m) => {
      const matchesChapter =
        filterChapter === 'all'
          ? true
          : filterChapter === 'featured'
          ? m.featured
          : m.chapter === filterChapter;
      if (!matchesChapter) return false;

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? m.status.startsWith('active')
          : statusFilter === 'passive'
          ? m.status === 'passive-science'
          : statusFilter === 'dormant'
          ? m.status.startsWith('silent')
          : m.status.startsWith('completed') || m.status.includes('impacted');
      if (!matchesStatus) return false;

      if (!q) return true;
      return (
        m.name.toLowerCase().includes(q) ||
        m.story_hook.toLowerCase().includes(q) ||
        m.destination.toLowerCase().includes(q) ||
        m.location_summary.toLowerCase().includes(q) ||
        m.hardware_types.some((h) => h.toLowerCase().includes(q))
      );
    });
  }, [filterChapter, statusFilter, search]);

  const sourceOrganizations = useMemo(() => {
    const set = new Set<string>();
    for (const s of SOURCES_LIST) set.add(s.organization);
    return ['ALL', ...Array.from(set)];
  }, []);

  const filteredSources = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();
    return SOURCES_LIST.filter((s) => {
      if (sourceOrgFilter !== 'ALL' && s.organization !== sourceOrgFilter) return false;
      if (!q) return true;
      return (
        s.id.toLowerCase().includes(q) ||
        s.title.toLowerCase().includes(q) ||
        s.organization.toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q)
      );
    });
  }, [sourceOrgFilter, sourceSearch]);

  const missionsBySourceId = useMemo(() => {
    const map = new Map<string, MissionRecord[]>();
    for (const m of MISSIONS) {
      for (const sid of m.source_ids) {
        const list = map.get(sid);
        if (list) list.push(m);
        else map.set(sid, [m]);
      }
    }
    return map;
  }, []);

  const handleLaunchFromMapOrList = useCallback(
    (encounterId: string) => {
      const enc = narrative.encounters.find((e) => e.id === encounterId);
      if (enc) {
        setSelectedEncounterId(enc.id);
        setActiveSector(enc.chapter as SectorId);
      }
      setGameMode('console');
      window.scrollTo({ top: 0, behavior: 'auto' });
    },
    [narrative.encounters]
  );

  // Versioned JSON Save Export / Import / Reset (technical-architecture.md)
  const handleExportSave = () => {
    const payload: SaveStatePayload = {
      schema_version: '1.0.0',
      call_sign: callSign.trim() || 'ARCHIVIST-01',
      unlocked_badges: unlockedBadges,
      exported_at: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `echoes-save-${callSign.replace(/[^a-z0-9_-]/gi, '_') || 'archive'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    telemetryAudio.playSignalLock();
    setSaveMessage('Exported local archive save JSON.');
  };

  const handleImportSave = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setSaveMessage('Import rejected: file exceeds 64 KB cap.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = JSON.parse(String(reader.result));
        if (
          !raw ||
          typeof raw !== 'object' ||
          raw.schema_version !== '1.0.0' ||
          !Array.isArray(raw.unlocked_badges) ||
          !raw.unlocked_badges.every((x: unknown) => typeof x === 'string')
        ) {
          setSaveMessage('Import rejected: invalid schema.');
          return;
        }
        const safeCallSign =
          typeof raw.call_sign === 'string' ? raw.call_sign.slice(0, 24) : callSign;
        setCallSign(safeCallSign);
        setUnlockedBadges(Array.from(new Set(raw.unlocked_badges)));
        telemetryAudio.playSignalLock();
        setSaveMessage(`Imported ${raw.unlocked_badges.length} badge records for ${safeCallSign}.`);
      } catch {
        setSaveMessage('Import failed: malformed JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetProgress = () => {
    telemetryAudio.playChirp(520, 0.06);
    setUnlockedBadges([]);
    setSaveMessage('Signal archive progress reset to 0/9.');
  };

  return (
    <div className={`app-root ${crtActive ? 'crt-overlay' : ''}`}>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <StarfieldCanvas />

      {/* Top Sticky Telemetry Bar */}
      <header className="telemetry-bar">
        <div className="telemetry-signal">
          <span className="signal-dot" aria-hidden="true" />
          <span>
            DSN-GOLDSTONE // ROUTE: <code>{routePath}</code> // ARCHIVE: OFFLINE-VERIFIED
          </span>
        </div>

        <div className="mono">{utcTime || 'SYNCHRONIZING UTC...'}</div>

        <div className="telemetry-controls">
          <button
            type="button"
            className="crt-toggle-btn"
            onClick={() => setAudioMuted(telemetryAudio.toggleMute())}
          >
            AUDIO: {audioMuted ? 'MUTED' : 'ON'}
          </button>
          <button
            type="button"
            className={`crt-toggle-btn ${crtActive ? 'active' : ''}`}
            onClick={() => {
              telemetryAudio.playChirp(620, 0.03);
              setCrtActive((v) => !v);
            }}
          >
            CRT: {crtActive ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      <div className="app-container">
        {/* TOP NAVIGATION BAR (Main Page /, Archive /archive, Sources /sources) */}
        {routePath !== '/game' && (
          <nav className="top-nav" aria-label="Primary navigation">
            <div className="nav-links">
              <a
                href="/"
                className={`btn-secondary btn-sm ${routePath === '/' ? 'active' : ''}`}
                aria-current={routePath === '/' ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/');
                }}
              >
                [ OBSERVATORY (/) ]
              </a>

              {/* Required Dropdown linking directly to Separate /archive & /sources Webpages */}
              <div className="archive-dropdown" ref={dropdownRef}>
                <button
                  ref={dropdownTriggerRef}
                  type="button"
                  className="btn-secondary btn-sm dropdown-trigger"
                  aria-haspopup="menu"
                  aria-expanded={dropdownOpen}
                  onClick={() => {
                    telemetryAudio.playChirp(840, 0.03);
                    setDropdownOpen((o) => !o);
                  }}
                >
                  <span>[ SOURCES &amp; ARCHIVES ]</span>
                  <span aria-hidden="true">{dropdownOpen ? '▲' : '▾'}</span>
                </button>

                {dropdownOpen && (
                  <div
                    className="dropdown-menu"
                    role="menu"
                    aria-label="Sources and Archives Menu"
                  >
                    <div className="dropdown-group-label">MISSION ARCHIVES (/archive)</div>
                    {ARCHIVE_MENU_OPTIONS.filter((i) => i.route === '/archive').map((item) => (
                      <a
                        key={item.id}
                        href={item.href}
                        role="menuitem"
                        className={`dropdown-item ${routePath === '/archive' && archiveSubView === item.id ? 'active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleSelectMenuItem(item);
                        }}
                      >
                        <div>
                          <span className="dropdown-item-title">{item.label}</span>
                          <span className="dropdown-item-sub">{item.desc}</span>
                        </div>
                        <span className="mono" style={{ color: 'var(--cyan)', fontSize: '12px' }}>
                          →
                        </span>
                      </a>
                    ))}

                    <div className="dropdown-group-label">PRIMARY NASA SOURCES (/sources)</div>
                    {ARCHIVE_MENU_OPTIONS.filter((i) => i.route === '/sources').map((item) => (
                      <a
                        key={item.id}
                        href={item.href}
                        role="menuitem"
                        className={`dropdown-item ${routePath === '/sources' && sourcesSubView === item.id ? 'active' : ''}`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleSelectMenuItem(item);
                        }}
                      >
                        <div>
                          <span className="dropdown-item-title">{item.label}</span>
                          <span className="dropdown-item-sub">{item.desc}</span>
                        </div>
                        <span className="mono" style={{ color: 'var(--amber)', fontSize: '12px' }}>
                          →
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <a
                href="/archive"
                className="btn-secondary btn-sm"
                aria-current={routePath === '/archive' ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/archive', { archiveView: 'missions' });
                }}
              >
                MISSION ARCHIVES (/archive)
              </a>

              <a
                href="/sources"
                className="btn-secondary btn-sm"
                aria-current={routePath === '/sources' ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/sources', { sourcesView: 'registry' });
                }}
              >
                NASA SOURCES (/sources)
              </a>

              <a
                href="/game"
                className="btn-observatory btn-sm"
                onClick={(e) => {
                  e.preventDefault();
                  navigateTo('/game', { mode: 'map' });
                }}
              >
                ▶ START GAME
              </a>
            </div>

            <div className="nav-progress" title="Reconstructed mission encounters">
              <span className="label">
                {callSign} · Signals: {completedCount}/{narrative.encounters.length}
              </span>
              <div
                className="gauge"
                aria-label={`${completedCount} of ${narrative.encounters.length} signals reconstructed`}
              >
                {narrative.encounters.map((enc) => (
                  <i key={enc.id} className={isEncounterCompleted(enc.id) ? 'on' : ''} />
                ))}
              </div>
            </div>
          </nav>
        )}

        {/* MAIN PAGE ROUTE: / */}
        {routePath === '/' && (
          <main
            id="main-content"
            aria-label="Observatory Main Page"
            style={{ display: 'flex', flexDirection: 'column', gap: 'inherit' }}
          >
            {/* STILL OUT THERE INSPIRED OBSERVATORY HERO STAGE (img/02.jpg) */}
            <section className="hero-observatory">
              <div className="hero-diorama-stage">
                <ObservatoryHeroDiorama
                  missionsCount={missions.length}
                  encountersCount={narrative.encounters.length}
                />

                <div className="hero-diorama-overlay">
                  <h1 className="hero-wordmark">Echoes of Exploration</h1>
                  <p className="hero-tagline-amber">Abandoned, but not forgotten</p>
                  <p className="hero-subtitle">
                    Explore {missions.length} NASA artifacts across Moon, Mars, and deep space,
                    trace verified primary sources, and tune {narrative.encounters.length} live
                    signal encounters on <code>/game</code>.
                  </p>

                  <div className="hero-actions">
                    <a
                      href="/game"
                      className="btn-observatory"
                      onClick={(e) => {
                        e.preventDefault();
                        navigateTo('/game', { mode: 'map' });
                      }}
                    >
                      ▶ Start game
                    </a>
                    <a
                      href="/archive"
                      className="btn-secondary"
                      onClick={(e) => {
                        e.preventDefault();
                        navigateTo('/archive', { archiveView: 'missions' });
                      }}
                    >
                      MISSION ARCHIVES ({missions.length})
                    </a>
                    <a
                      href="/sources"
                      className="btn-secondary"
                      onClick={(e) => {
                        e.preventDefault();
                        navigateTo('/sources', { sourcesView: 'registry' });
                      }}
                    >
                      NASA SOURCES ({sourcesList.length})
                    </a>
                  </div>
                </div>
              </div>

              <div className="hero-meta-strip">
                <div className="honesty-banner">
                  <strong style={{ color: 'var(--amber)' }}>Two-Voice Rule:</strong>{' '}
                  {narrative.ui_copy.honesty_label}
                </div>

                <div className="callsign-row">
                  <label htmlFor="archivist-callsign" className="label" style={{ color: 'var(--crust)' }}>
                    CALL SIGN:
                  </label>
                  <input
                    id="archivist-callsign"
                    type="text"
                    maxLength={24}
                    className="callsign-input"
                    value={callSign}
                    onChange={(e) => setCallSign(e.target.value)}
                    placeholder="ARCHIVIST-01"
                  />
                  {completedCount === narrative.encounters.length && (
                    <span className="status-badge active">SIGNAL ARCHIVIST PATCH UNLOCKED ✓</span>
                  )}
                </div>
              </div>
            </section>

            {/* TWO VOICES STANDARD (§3 of docs/ART_STYLE_GUIDE.md) */}
            <section className="voices-split" aria-label="Two voices, two colors standard">
              <article className="voice-card console">
                <div className="c-head">
                  <span className="tag-story">
                    <span className="signal-dot" aria-hidden="true" />
                    Memory echo · Game story
                  </span>
                  <span className="mono muted" style={{ fontSize: '11px' }}>CYAN (#0EC3DC)</span>
                </div>
                <p className="voice-quote">
                  "I am a lander with no pilot. Everything I know comes from my sensors."
                </p>
                <div className="voice-meta">
                  {narrative.ui_copy.echo_frame} Separated visually in Cyan story frames.
                </div>
              </article>

              <article className="voice-card voice-record">
                <div className="c-head">
                  <span className="tag-record">Verified record · NASA Archive</span>
                  <span className="mono muted" style={{ fontSize: '11px' }}>AMBER (#F59E0B)</span>
                </div>
                <p className="voice-quote" style={{ fontStyle: 'normal', fontSize: '15px' }}>
                  Surveyor 1 launched May 30, 1966, and executed the first U.S. soft landing on the Moon on June 2, 1966, in Oceanus Procellarum.
                </p>
                <div className="voice-meta">
                  Primary authority: NASA Science &amp; NSSDCA · Reviewed {missionsReviewedOn}
                </div>
              </article>
            </section>

            {/* THREE CHAPTERS / DISCOVERY BRIDGES OVERVIEW */}
            <section className="archive-section" aria-label="Observatory Chapters">
              <div className="section-head">
                <div>
                  <h2>Three Realms of Robotic Scouts</h2>
                </div>
              </div>

              <div className="chapters-grid">
                {CHAPTER_CARDS.map((ch) => {
                  const doneInChapter = chapterCompletedCounts[ch.id];
                  const bridgeUnlocked = doneInChapter >= 3;
                  return (
                    <article key={ch.id} className="chapter-card">
                      <div className="scene-thumb">
                        <div className={getChapterSceneClass(ch.id)} />
                        <div className="signal-ring" aria-hidden="true" />
                        <span
                          className={`status-badge ${bridgeUnlocked ? 'active' : 'dormant'}`}
                          style={{ position: 'relative', zIndex: 1 }}
                        >
                          {chapterCounts[ch.id]} MISSIONS · {doneInChapter}/3 DONE
                        </span>
                        {ch.sprite && (
                          <div className="scene-sprite-overlay">
                            <img src={ch.sprite} alt={ch.spriteAlt} className="pixelated" />
                          </div>
                        )}
                      </div>

                      <div className="chapter-body">
                        <h3>{ch.title}</h3>
                        <p style={{ fontSize: '14px', color: 'var(--crust)' }}>{ch.subtitle}</p>
                        <div
                          style={{
                            borderTop: '1px solid var(--line)',
                            paddingTop: '8px',
                            fontSize: '12px',
                            color: bridgeUnlocked ? 'var(--amber)' : 'var(--muted)',
                          }}
                        >
                          {ch.bridgeTitle}:{' '}
                          {bridgeUnlocked
                            ? ch.bridgeNote
                            : `Complete all 3 ${ch.title} encounters to unlock this Discovery Bridge.`}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            marginTop: 'auto',
                            paddingTop: '8px',
                          }}
                        >
                          <a
                            href="/archive"
                            className="btn-secondary btn-sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setFilterChapter(ch.id);
                              navigateTo('/archive', { archiveView: 'missions' });
                            }}
                          >
                            ARCHIVE ({chapterCounts[ch.id]})
                          </a>
                          <a
                            href="/game"
                            className="btn-observatory btn-sm"
                            onClick={(e) => {
                              e.preventDefault();
                              setActiveSector(ch.id);
                              navigateTo('/game', { mode: 'map' });
                            }}
                          >
                            ▶ PLAY SECTOR
                          </a>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </main>
        )}

        {/* DEDICATED WEBPAGE #2: /archive (Mission Archives & Evidence Catalog — img/10.jpg) */}
        {routePath === '/archive' && (
          <main
            id="main-content"
            aria-label="Historical Mission Archive Webpage"
            style={{ display: 'flex', flexDirection: 'column', gap: 'inherit' }}
          >
            <section
              className="archive-section hud-panel"
              style={{ padding: '22px' }}
              aria-label="Historical Mission Archive Catalog"
            >
              <div className="section-head">
                <div>
                  <h1>Historical Mission Archive</h1>
                  <p className="muted" style={{ fontSize: '14px', marginTop: '4px' }}>
                    {missions.length} NASA hardware artifacts across Moon, Mars &amp; Deep Space · Reviewed{' '}
                    {missionsReviewedOn}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <label htmlFor="archive-sector-select" className="label">
                    SECTOR:
                  </label>
                  <select
                    id="archive-sector-select"
                    className="dropdown-select-inline"
                    value={filterChapter}
                    onChange={(e) => {
                      telemetryAudio.playChirp(820, 0.03);
                      setFilterChapter(e.target.value as ChapterFilter);
                    }}
                  >
                    <option value="all">ALL SECTORS ({missions.length})</option>
                    <option value="moon">MOON ({chapterCounts.moon})</option>
                    <option value="mars">MARS ({chapterCounts.mars})</option>
                    <option value="elsewhere">DEEP SPACE ({chapterCounts.elsewhere})</option>
                    <option value="featured">PLAYABLE ({chapterCounts.featured})</option>
                  </select>

                  <a
                    href="/sources"
                    className="btn-secondary btn-sm"
                    onClick={(e) => {
                      e.preventDefault();
                      navigateTo('/sources', { sourcesView: 'registry' });
                    }}
                  >
                    NASA SOURCES (/sources) →
                  </a>
                </div>
              </div>

              <div className="filter-chips" role="navigation" aria-label="Archive Views">
                <a
                  href="/archive"
                  className={`filter-chip ${archiveSubView === 'missions' ? 'active' : ''}`}
                  aria-current={archiveSubView === 'missions' ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('/archive', { archiveView: 'missions' });
                  }}
                >
                  RECORDS ({missions.length})
                </a>
                <a
                  href="/archive?view=evidence"
                  className={`filter-chip ${archiveSubView === 'evidence' ? 'active' : ''}`}
                  aria-current={archiveSubView === 'evidence' ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('/archive', { archiveView: 'evidence' });
                  }}
                >
                  EVIDENCE CHAINS ({encountersCatalog.length})
                </a>
              </div>

              {/* SUBVIEW A: 31-MISSION MUSEUM CATALOG (img/10.jpg) */}
              {archiveSubView === 'missions' && (
                <>
                  <div className="filter-row">
                    <div className="filter-chips" role="group" aria-label="Chapter filter">
                      {(
                        [
                          { id: 'all', label: `ALL (${missions.length})` },
                          { id: 'moon', label: `MOON (${chapterCounts.moon})` },
                          { id: 'mars', label: `MARS (${chapterCounts.mars})` },
                          { id: 'elsewhere', label: `ELSEWHERE (${chapterCounts.elsewhere})` },
                          { id: 'featured', label: `PLAYABLE (${chapterCounts.featured})` },
                        ] as const
                      ).map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          className={`filter-chip ${filterChapter === chip.id ? 'active' : ''}`}
                          onClick={() => {
                            telemetryAudio.playChirp(820, 0.03);
                            setFilterChapter(chip.id);
                          }}
                        >
                          {chip.label}
                        </button>
                      ))}
                    </div>

                    <div className="filter-chips" role="group" aria-label="Status filter">
                      {(
                        [
                          { id: 'all', label: 'ALL STATES' },
                          { id: 'active', label: 'ACTIVE' },
                          { id: 'passive', label: 'PASSIVE' },
                          { id: 'dormant', label: 'SILENT / DORMANT' },
                          { id: 'ended', label: 'ENDED / IMPACTED' },
                        ] as const
                      ).map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          className={`filter-chip ${statusFilter === st.id ? 'active' : ''}`}
                          onClick={() => {
                            telemetryAudio.playChirp(760, 0.03);
                            setStatusFilter(st.id);
                          }}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search 31 NASA missions by spacecraft, destination, location, or instrument..."
                    aria-label="Search missions"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />

                  <div className="archive-catalog-grid">
                    {filteredMissions.map((mission, idx) => {
                      const badge = getStatusBadgeInfo(mission.status);
                      const sprite = getMissionSprite(mission.id);
                      const linkedEncounter = encounterByMissionId.get(mission.id);
                      const recovered = linkedEncounter ? isEncounterCompleted(linkedEncounter.id) : false;

                      return (
                        <button
                          key={mission.id}
                          type="button"
                          className="mission-card"
                          onClick={() => {
                            telemetryAudio.playChirp(1040, 0.04);
                            setSelectedMission(mission);
                          }}
                        >
                          <div className="scene-thumb">
                            <div className={getChapterSceneClass(mission.chapter)} />
                            <div className="signal-ring" aria-hidden="true" />
                            <span
                              className={badge.className}
                              style={{ position: 'relative', zIndex: 1 }}
                            >
                              {badge.label}
                            </span>
                            {sprite && (
                              <div className="scene-sprite-overlay">
                                <img src={sprite.src} alt={sprite.alt} className="pixelated" />
                              </div>
                            )}
                          </div>

                          <div className="mission-card-body">
                            <div className="mission-card-head">
                              <span
                                className="label"
                                style={{ color: getChapterAccentColor(mission.chapter) }}
                              >
                                #{String(idx + 1).padStart(2, '0')} · SECTOR // {mission.chapter.toUpperCase()}
                              </span>
                              {linkedEncounter && (
                                <span className={`status-badge ${recovered ? 'active' : 'passive'}`}>
                                  {recovered ? 'ECHO RECOVERED ✓' : 'PLAYABLE'}
                                </span>
                              )}
                            </div>

                            <h3 className="mission-name">{mission.name}</h3>
                            <div className="mission-hook">"{mission.story_hook}"</div>
                            <p className="mission-desc">
                              {mission.science_summary || mission.objective}
                            </p>

                            <div className="mission-meta">
                              <span>{mission.destination.toUpperCase()}</span>
                              <span>{mission.launch_date.slice(0, 4)}</span>
                              <span className="mission-link">INSPECT RECORD →</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {/* SUBVIEW B: ENCOUNTER EVIDENCE CHAINS (9) */}
              {archiveSubView === 'evidence' && (
                <div className="missions-grid">
                  {encountersCatalog.map((enc) => {
                    const primarySrc = sourcesMap.get(enc.primary_source_id);
                    const done = isEncounterCompleted(enc.id);
                    return (
                      <article key={enc.id} className="voice-card voice-record">
                        <div className="c-head">
                          <span className="label" style={{ color: getChapterAccentColor(enc.chapter) }}>
                            #{String(enc.order).padStart(2, '0')} · {enc.chapter.toUpperCase()}
                          </span>
                          <span className={`status-badge ${done ? 'active' : 'dormant'}`}>
                            {done ? 'RECONSTRUCTED ✓' : enc.mechanic_family}
                          </span>
                        </div>
                        <h3>{enc.title}</h3>
                        <p style={{ fontSize: '13px', color: 'var(--ink)' }}>
                          <strong>Task:</strong> {enc.player_task}
                        </p>
                        <p style={{ fontSize: '13px', color: 'var(--crust)' }}>
                          <strong>Learning intent:</strong> {enc.learning_intent}
                        </p>
                        <div className="mono" style={{ fontSize: '11px', color: 'var(--amber)' }}>
                          EVIDENCE CHAIN: {enc.evidence_chain.join(' -> ')}
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          <strong>Simplification note:</strong> {enc.simplification_note}
                        </p>
                        <div
                          style={{
                            display: 'flex',
                            gap: '8px',
                            flexWrap: 'wrap',
                            marginTop: 'auto',
                            paddingTop: '8px',
                          }}
                        >
                          {primarySrc && (
                            <a
                              href={primarySrc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-secondary btn-sm"
                            >
                              {primarySrc.organization} ↗
                            </a>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </main>
        )}

        {/* DEDICATED WEBPAGE #3: /sources (Primary NASA Sources & Verification Registry) */}
        {routePath === '/sources' && (
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
                  href="/archive"
                  className="btn-secondary btn-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('/archive', { archiveView: 'missions' });
                  }}
                >
                  ← MISSION ARCHIVES (/archive)
                </a>
              </div>

              {/* Distinct Telemetry Verification Strip */}
              <div className="sources-metrics-bar" aria-label="Source Verification Summary">
                <div className="readout-cell">
                  <span className="k">PRIMARY SOURCES</span>
                  <span className="v" style={{ color: 'var(--amber)' }}>{sourcesList.length} VERIFIED</span>
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
                  href="/sources"
                  className={`filter-chip ${sourcesSubView === 'registry' ? 'active' : ''}`}
                  aria-current={sourcesSubView === 'registry' ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('/sources', { sourcesView: 'registry' });
                  }}
                >
                  NASA SOURCES REGISTRY ({sourcesList.length})
                </a>
                <a
                  href="/sources?view=references"
                  className={`filter-chip ${sourcesSubView === 'references' ? 'active' : ''}`}
                  aria-current={sourcesSubView === 'references' ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('/sources', { sourcesView: 'references' });
                  }}
                >
                  ENCOUNTER REFERENCES ({narrative.references_consulted.length})
                </a>
                <a
                  href="/sources?view=methodology"
                  className={`filter-chip ${sourcesSubView === 'methodology' ? 'active' : ''}`}
                  aria-current={sourcesSubView === 'methodology' ? 'page' : undefined}
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('/sources', { sourcesView: 'methodology' });
                  }}
                >
                  METHODOLOGY, GLOSSARY &amp; SAVE DATA
                </a>
              </div>

              {/* SUBVIEW A: 33 PRIMARY NASA SOURCES REGISTRY */}
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
                                <strong style={{ fontSize: '15px', color: 'var(--ink)' }}>
                                  {src.title}
                                </strong>
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
                                      setSelectedMission(m);
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

              {/* SUBVIEW B: ENCOUNTER SCIENCE REFERENCES (6) */}
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
                        <strong style={{ fontSize: '14px', color: 'var(--ink)' }}>
                          {ref.title} ↗
                        </strong>
                        <span
                          className="mono muted"
                          style={{ fontSize: '11px', overflowWrap: 'anywhere' }}
                        >
                          {ref.url}
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* SUBVIEW C: METHODOLOGY, GLOSSARY, SI DISCLOSURE & SAVE DATA */}
              {sourcesSubView === 'methodology' && (
                <div style={{ display: 'grid', gap: '18px' }}>
                  <div className="voice-card voice-record">
                    <span className="tag-record">NASA Non-Endorsement &amp; Super Intelligence (SI) Disclosure</span>
                    <ul style={{ paddingLeft: '20px', display: 'grid', gap: '8px', color: 'var(--ink)' }}>
                      <li>
                        <b>Non-Endorsement &amp; Branding Compliance:</b> Independent educational submission for
                        NASA Space Apps Challenge 2026. No NASA &quot;meatball&quot; or worm insignia is used or altered.
                      </li>
                      <li>
                        <b>Code, Data Normalization &amp; Narrative (SI-Assisted):</b> Scaffolding, TypeScript integration,
                        dataset normalization, and narrative copy drafts (`src/text/narrative.json`) were accelerated with
                        SI tools and verified against primary NASA NSSDCA, JPL, ILRS, and PDS sources.
                      </li>
                      <li>
                        <b>Art &amp; Typography Standard:</b> Strict 24-color palette, Silkscreen headings, IBM Plex
                        Sans/Mono body and telemetry (`docs/ART_STYLE_GUIDE.md`), plus Web Audio oscillator SFX (`src/audio/telemetryAudio.ts`).
                      </li>
                      <li>
                        <b>Privacy Boundary:</b> Zero telemetry, zero cookies, zero runtime APIs. Progress saves only
                        to browser <code>localStorage</code> with optional JSON export/import.
                      </li>
                    </ul>
                  </div>

                  {/* Save Export / Import / Reset */}
                  <div className="voice-card voice-story">
                    <span className="tag-story">Local Archive Save Manager</span>
                    <div className="save-toolbar">
                      <button type="button" className="btn-observatory btn-sm" onClick={handleExportSave}>
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
                        onChange={handleImportSave}
                      />
                      <button type="button" className="btn-secondary btn-sm" onClick={handleResetProgress}>
                        RESET PROGRESS ({completedCount}/{encountersCatalog.length})
                      </button>
                    </div>
                    {saveMessage && (
                      <div className="mono" style={{ fontSize: '12px', color: 'var(--cyan-glow)' }}>
                        {saveMessage}
                      </div>
                    )}
                  </div>

                  {/* Glossary */}
                  <div>
                    <h3 style={{ marginBottom: '10px', color: 'var(--amber)' }}>
                      Field Glossary
                    </h3>
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
        )}

        {/* GAME ROUTE: /game (STRICTLY gated so the game is ONLY playable on /game) */}
        {routePath === '/game' && (
          <main
            id="main-content"
            className="encounter-layout game-route-shell"
            aria-label="Echoes of Exploration Game Stage"
          >
            <div className="game-topbar">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <a
                  href="/"
                  className="btn-secondary btn-sm"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateTo('/');
                  }}
                >
                  ← MAIN PAGE (/)
                </a>
                <div>
                  <h1 style={{ fontSize: 'clamp(16px, 2.2vw, 22px)' }}>
                    Signal Expedition &amp; Encounters
                  </h1>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div className="nav-progress">
                  <span className="label">
                    {callSign} · {completedCount}/{narrative.encounters.length}
                  </span>
                  <div className="gauge">
                    {narrative.encounters.map((enc) => (
                      <i key={enc.id} className={isEncounterCompleted(enc.id) ? 'on' : ''} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Game Mode + Sector Switcher */}
            <div className="filter-row">
              <div className="filter-chips" role="tablist" aria-label="Game View Mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={gameMode === 'map'}
                  className={`filter-chip ${gameMode === 'map' ? 'active' : ''}`}
                  onClick={() => {
                    telemetryAudio.playChirp(860, 0.03);
                    setGameMode('map');
                  }}
                >
                  [ SURFACE EXPLORER MAP ]
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={gameMode === 'console'}
                  className={`filter-chip ${gameMode === 'console' ? 'active' : ''}`}
                  onClick={() => {
                    telemetryAudio.playChirp(920, 0.03);
                    setGameMode('console');
                  }}
                >
                  [ ACTIVE ENCOUNTER (#{String(selectedEncounter.order).padStart(2, '0')}) ]
                </button>
              </div>

              <div className="filter-chips" role="group" aria-label="Destination Sectors">
                {CHAPTER_CARDS.map((ch) => (
                  <button
                    key={ch.id}
                    type="button"
                    className={`filter-chip ${activeSector === ch.id ? 'active' : ''}`}
                    onClick={() => {
                      telemetryAudio.playChirp(820, 0.03);
                      setActiveSector(ch.id);
                      const first = narrative.encounters.find((e) => e.chapter === ch.id);
                      if (first && selectedEncounter.chapter !== ch.id) {
                        setSelectedEncounterId(first.id);
                      }
                    }}
                  >
                    {ch.index}. {ch.title.toUpperCase()} ({chapterCompletedCounts[ch.id]}/3)
                  </button>
                ))}
              </div>
            </div>

            {/* Mode A: 640x360 Interactive Surface Explorer (Still Out There inspired) */}
            {gameMode === 'map' && (
              <SurfaceExplorerCanvas
                key={activeSector}
                sector={activeSector}
                encounters={narrative.encounters}
                missions={missions}
                activeEncounterId={selectedEncounterId}
                completedIds={unlockedBadges}
                onLaunchEncounter={handleLaunchFromMapOrList}
                onInspectMission={(m) => {
                  telemetryAudio.playChirp(1040, 0.04);
                  setSelectedMission(m);
                }}
              />
            )}

            {/* Mode B: Playable Encounter Shell (#1 Unmodified Surveyor Game + #2-#9 Encounters) */}
            {gameMode === 'console' && (
              <>
                <div className="encounter-tabs" role="tablist" aria-label="Choose a signal encounter">
                  {narrative.encounters.map((enc) => {
                    const active = enc.id === selectedEncounter.id;
                    const done = isEncounterCompleted(enc.id);
                    return (
                      <button
                        key={enc.id}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        className={`encounter-tab ${active ? 'active' : ''}`}
                        onClick={() => {
                          telemetryAudio.playChirp(900, 0.03);
                          setSelectedEncounterId(enc.id);
                          setActiveSector(enc.chapter as SectorId);
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            width: '100%',
                          }}
                        >
                          <span
                            className="label"
                            style={{ color: getChapterAccentColor(enc.chapter) }}
                          >
                            #{String(enc.order).padStart(2, '0')} · {enc.chapter.toUpperCase()}
                          </span>
                          <span
                            className="mono"
                            style={{
                              fontSize: '11px',
                              color: done ? 'var(--amber)' : 'var(--muted)',
                            }}
                          >
                            {done ? '✓' : '○'}
                          </span>
                        </div>
                        <strong style={{ fontSize: '14px' }}>{enc.title}</strong>
                        <span className="mono muted" style={{ fontSize: '11px' }}>
                          {enc.quick_task.task_name}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Unmodified Surveyor Game vs Narrative Encounter Console */}
                {selectedEncounter.id === 'gentle-touch' ? (
                  <div style={{ display: 'grid', gap: '20px' }}>
                    <div className="encounter-frame-bar">
                      <span>
                        <strong style={{ color: 'var(--cyan)' }}>ARCHIVE REPLAY:</strong>{' '}
                        {narrative.ui_copy.echo_frame}
                      </span>
                      <span className="status-badge dormant">
                        {selectedEncounter.status_badge.label}
                      </span>
                    </div>

                    <SurveyorEncounterPreview
                      missionId="surveyor-1"
                      onComplete={handleEncounterComplete}
                      onExit={() => setGameMode('map')}
                    />

                    <BehindTheMemoryPanel
                      encounter={selectedEncounter}
                      sourcesMap={sourcesMap}
                      sectionLabels={narrative.ui_copy.section_labels}
                    />
                  </div>
                ) : (
                  <NarrativeEncounterConsole
                    key={selectedEncounter.id}
                    encounter={selectedEncounter}
                    datasetEncounter={selectedDatasetEncounter}
                    sourcesMap={sourcesMap}
                    echoFrameText={narrative.ui_copy.echo_frame}
                    sectionLabels={narrative.ui_copy.section_labels}
                    unlockedBadges={unlockedBadges}
                    onComplete={handleEncounterComplete}
                    onExit={() => setGameMode('map')}
                  />
                )}
              </>
            )}

            {/* Observatory Restoration & Discovery Bridges Progress */}
            <section className="voice-card hud-panel" aria-label="Observatory Restoration Status">
              <div className="c-head">
                <span className="tag-record">
                  Observatory Restoration · {completedCount}/{narrative.encounters.length} Signals
                </span>
                {completedCount >= narrative.encounters.length && (
                  <span className="status-badge active">SIGNAL ARCHIVIST PATCH AWARDED ✓</span>
                )}
              </div>

              <div className="bridge-grid">
                {CHAPTER_CARDS.map((ch) => {
                  const done = chapterCompletedCounts[ch.id];
                  const unlocked = done >= 3;
                  return (
                    <div
                      key={ch.id}
                      className={`bridge-card ${unlocked ? 'unlocked' : ''}`}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span className="label" style={{ color: ch.accent }}>
                          CHAPTER {ch.index} · {ch.title}
                        </span>
                        <span className={`status-badge ${unlocked ? 'active' : 'dormant'}`}>
                          {unlocked ? 'BRIDGE OPEN ✓' : `${done}/3`}
                        </span>
                      </div>
                      <strong style={{ fontSize: '13px', color: 'var(--ink)' }}>
                        {ch.bridgeTitle}
                      </strong>
                      <p style={{ fontSize: '12px', color: unlocked ? 'var(--crust)' : 'var(--muted)' }}>
                        {unlocked
                          ? ch.bridgeNote
                          : `Complete all 3 encounters in ${ch.title} to restore this observatory wing bridge.`}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>
          </main>
        )}

        {/* Footer */}
        <footer className="observatory-footer">
          <div>
            Echoes of Exploration: The NASA Signal Archive · Independent educational archive using
            NASA, JPL, NSSDCA, ILRS, and PDS public documentation. Not endorsed or sponsored by NASA.
          </div>
          <div>
            Team-drawn &amp; SI-assisted pixel illustrations (not NASA photographs); narrative writing
            accelerated with Super Intelligence (SI) assistance; 24-color palette &amp; Silkscreen/IBM Plex
            standard per <code>docs/ART_STYLE_GUIDE.md</code>.
          </div>
        </footer>
      </div>

      {/* Signal Inspector Modal */}
      <SignalInspectorModal
        mission={selectedMission}
        encounter={selectedMission ? encounterByMissionId.get(selectedMission.id) ?? null : null}
        sourcesMap={sourcesMap}
        reviewedOn={missionsReviewedOn}
        echoFrameText={narrative.ui_copy.echo_frame}
        needsReviewText={narrative.ui_copy.needs_review_badge}
        sectionLabels={narrative.ui_copy.section_labels}
        onClose={() => setSelectedMission(null)}
        onTuneEncounter={routePath === '/game' ? (encId) => {
          setSelectedMission(null);
          navigateTo('/game', { encounterId: encId, mode: 'console' });
        } : undefined}
      />
    </div>
  );
}

export default App;
