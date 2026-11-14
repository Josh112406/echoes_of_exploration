import { ArtifactEntry } from './schema.ts';
import artifactsJson from './artifacts.json';

export const ALL_ENTRIES: Record<string, ArtifactEntry> = artifactsJson as unknown as Record<string, ArtifactEntry>;

// Strict chronological ordering for progression
export const MOON_CHRONOLOGY: string[] = [
  'surveyor-3',
  'apollo-11-site',
  'apollo-12-site',
  'apollo-retroreflectors',
  'apollo-15-lrv',
  'apollo-17-site',
  'blue-ghost-1',
  'im-1-odysseus',
];

export const MARS_CHRONOLOGY: string[] = [
  'viking-1-2',
  'sojourner-pathfinder',
  'mars-polar-lander',
  'spirit-opportunity',
  'phoenix',
  'curiosity',
  'insight',
  'perseverance-landing-hardware',
  'ingenuity',
];

export const ELSEWHERE_CHRONOLOGY: string[] = [
  'voyager-1',
  'galileo',
  'near-shoemaker',
  'cassini-huygens',
  'deep-impact',
  'new-horizons',
];

// Open world layout coordinates (2400 x 1600 toroidal surface)
export interface WorldArtifactCoord {
  id: string;
  x: number;
  y: number;
  name: string;
  year: string;
}

export const MOON_WORLD_COORDS: WorldArtifactCoord[] = [
  { id: 'surveyor-3', x: 420, y: 380, name: 'Surveyor 3', year: '1967' },
  { id: 'apollo-11-site', x: 880, y: 440, name: 'Apollo 11 Base', year: '1969' },
  { id: 'apollo-12-site', x: 520, y: 350, name: 'Apollo 12 / Surveyor Crater', year: '1969' },
  { id: 'apollo-retroreflectors', x: 1200, y: 720, name: 'Laser Retroreflectors', year: '1969' },
  { id: 'apollo-15-lrv', x: 1550, y: 520, name: 'Apollo 15 LRV', year: '1971' },
  { id: 'apollo-17-site', x: 1850, y: 880, name: 'Apollo 17 Site', year: '1972' },
  { id: 'blue-ghost-1', x: 920, y: 1240, name: 'Blue Ghost 1', year: '2024' },
  { id: 'im-1-odysseus', x: 1720, y: 1350, name: 'IM-1 Odysseus', year: '2024' },
];

export const MARS_WORLD_COORDS: WorldArtifactCoord[] = [
  { id: 'viking-1-2', x: 400, y: 420, name: 'Viking 1 & 2', year: '1976' },
  { id: 'sojourner-pathfinder', x: 780, y: 360, name: 'Pathfinder & Sojourner', year: '1997' },
  { id: 'mars-polar-lander', x: 1250, y: 280, name: 'Mars Polar Lander', year: '1999' },
  { id: 'spirit-opportunity', x: 1720, y: 560, name: 'Spirit & Opportunity', year: '2004' },
  { id: 'phoenix', x: 520, y: 920, name: 'Phoenix Lander', year: '2008' },
  { id: 'curiosity', x: 1040, y: 820, name: 'Curiosity Rover', year: '2012' },
  { id: 'insight', x: 1540, y: 1050, name: 'InSight Lander', year: '2018' },
  { id: 'perseverance-landing-hardware', x: 860, y: 1350, name: 'Perseverance & Sky Crane', year: '2021' },
  { id: 'ingenuity', x: 1400, y: 1420, name: 'Ingenuity Helicopter', year: '2021' },
];

export const ELSEWHERE_WORLD_COORDS: WorldArtifactCoord[] = [
  { id: 'voyager-1', x: 420, y: 380, name: 'Voyager 1', year: '1977' },
  { id: 'galileo', x: 880, y: 500, name: 'Galileo Orbiter', year: '1989' },
  { id: 'near-shoemaker', x: 1420, y: 360, name: 'NEAR Shoemaker', year: '1996' },
  { id: 'cassini-huygens', x: 1780, y: 860, name: 'Cassini-Huygens', year: '1997' },
  { id: 'deep-impact', x: 960, y: 1180, name: 'Deep Impact', year: '2005' },
  { id: 'new-horizons', x: 1560, y: 1320, name: 'New Horizons', year: '2006' },
];
