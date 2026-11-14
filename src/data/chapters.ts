import type { SectorId } from '../components/SurfaceExplorerCanvas';
import type {
  ArchiveSubView,
  RoutePath,
  SourcesSubView,
} from '../components/SourcesArchiveDropdown';

export interface ChapterCardInfo {
  id: SectorId;
  index: string;
  title: string;
  accent: string;
  subtitle: string;
  bridgeTitle: string;
  bridgeNote: string;
  representativeMissionId: string;
  spriteAlt: string;
}

export const CHAPTER_CARDS: ChapterCardInfo[] = [
  {
    id: 'moon',
    index: '01',
    title: 'The Moon',
    accent: 'var(--crust)',
    subtitle: 'Surveyor landers, Apollo surface packages, laser retroreflectors, and lunar rovers.',
    bridgeTitle: 'Discovery Bridge I: Touchdown -> Precision -> Mobility',
    bridgeNote:
      'Surveyor 1 proved controlled soft landings; Apollo 11 left passive reflectors still measured today; Apollo 17 drove 35.9 km across Taurus-Littrow.',
    representativeMissionId: 'apollo-11-surface',
    spriteAlt: 'Apollo lunar module pixel sprite',
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
    representativeMissionId: 'curiosity',
    spriteAlt: 'Mars rover pixel sprite',
  },
  {
    id: 'elsewhere',
    index: '03',
    title: 'Elsewhere',
    accent: 'var(--amber)',
    subtitle: 'NEAR Shoemaker on Eros, Voyager 1 in interstellar space, New Horizons at Pluto, Kepler, Cassini.',
    bridgeTitle: 'Discovery Bridge III: Adaptation -> Power Budget -> One-Shot Flyby',
    bridgeNote:
      'NEAR landed without landing legs; Voyager 1 trades instrument watts across 160+ AU; New Horizons stored years of work into an hours-long Pluto encounter.',
    representativeMissionId: 'voyager-1',
    spriteAlt: 'Voyager deep-space probe pixel sprite',
  },
];

export function normalizeRoutePath(pathname: string): RoutePath {
  const clean = pathname.replace(/\/index\.html$/i, '').replace(/\/+$/, '') || '/';
  if (clean === '/game') return '/game';
  if (clean === '/sources') return '/sources';
  if (clean === '/archive' || clean === '/archives') return '/archive';
  return '/';
}

export function getArchiveSubViewFromUrl(search: string): ArchiveSubView {
  try {
    const view = new URLSearchParams(search).get('view');
    if (view === 'realms' || view === 'evidence') return view;
  } catch {
    // Ignore malformed query string
  }
  return 'missions';
}

export function getSourcesSubViewFromUrl(search: string): SourcesSubView {
  try {
    const view = new URLSearchParams(search).get('view');
    if (view === 'references' || view === 'methodology') return view;
  } catch {
    // Ignore malformed query string
  }
  return 'registry';
}

export function getQueryEncounterId(): string | null {
  try {
    return new URLSearchParams(window.location.search).get('encounter');
  } catch {
    return null;
  }
}
