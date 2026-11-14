export type MinigameSceneKey =
  | 'LandingScene'
  | 'RoverScene'
  | 'LaserScene'
  | 'RotorScene'
  | 'FlybyScene';

export interface MinigameMeta {
  scene: MinigameSceneKey;
  code: string;
  title: string;
  promptVerb: string;
  description: string;
}

export const MINIGAME_META: Record<MinigameSceneKey, MinigameMeta> = {
  LandingScene: {
    scene: 'LandingScene',
    code: 'DESCENT',
    title: 'Precision Powered Descent',
    promptVerb: 'INITIATE DESCENT',
    description: 'Pilot the thruster descent engine and set down softly inside the beacon zone.',
  },
  RoverScene: {
    scene: 'RoverScene',
    code: 'ROVER',
    title: 'Surface Rover Traverse',
    promptVerb: 'START ROVER TRAVERSE',
    description: 'Drive over craters and dust, collect 3 science cores, and park on the extraction pad before the battery runs dry.',
  },
  LaserScene: {
    scene: 'LaserScene',
    code: 'LINK',
    title: 'Signal & Laser Alignment',
    promptVerb: 'ALIGN LASER / DISH',
    description: 'Track drifting target oscillations with precision azimuth/elevation control to achieve 5 clean photon locks.',
  },
  RotorScene: {
    scene: 'RotorScene',
    code: 'FLIGHT',
    title: 'Atmospheric Flight Control',
    promptVerb: 'LAUNCH ROTOR FLIGHT',
    description: 'Balance thin-air collective lift against downdrafts and dust plumes to cross the target airway.',
  },
  FlybyScene: {
    scene: 'FlybyScene',
    code: 'FLYBY',
    title: 'High-Speed Flyby Capture',
    promptVerb: 'START FLYBY CAPTURE',
    description: 'Hold attitude stabilization and trigger science camera shutters on orbital targets as they streak past.',
  },
};

export const SITE_MINIGAMES: Record<string, MinigameSceneKey> = {
  // Moon (8)
  'surveyor-3': 'LandingScene',
  'apollo-11-site': 'LandingScene',
  'apollo-12-site': 'LandingScene',
  'apollo-retroreflectors': 'LaserScene',
  'apollo-15-lrv': 'RoverScene',
  'apollo-17-site': 'RoverScene',
  'blue-ghost-1': 'LandingScene',
  'im-1-odysseus': 'LandingScene',

  // Mars (9)
  'viking-1-2': 'LandingScene',
  'sojourner-pathfinder': 'RoverScene',
  'mars-polar-lander': 'LandingScene',
  'spirit-opportunity': 'RoverScene',
  phoenix: 'LandingScene',
  curiosity: 'RoverScene',
  insight: 'LandingScene',
  'perseverance-landing-hardware': 'LandingScene',
  ingenuity: 'RotorScene',

  // Elsewhere // Deep Space (6): the robot can't follow these machines down, so each echo is
  // played as the flyby / orbital science that made up most of its mission. (NEAR Shoemaker
  // did land on Eros and Huygens on Titan: their record pages say so.)
  'near-shoemaker': 'FlybyScene',
  galileo: 'FlybyScene',
  'cassini-huygens': 'FlybyScene',
  'deep-impact': 'FlybyScene',
  'voyager-1': 'LaserScene',
  'new-horizons': 'FlybyScene',
};

/**
 * Practice runs for catalog missions that are not playable echoes. Each borrows
 * the minigame that best matches what the real mission did; `siteId` picks the
 * scene's terrain / theme. A practice run never recovers an echo.
 */
export interface CatalogPractice {
  scene: MinigameSceneKey;
  siteId: string;
  /** What the real mission did, and how the minigame simplifies it. */
  note: string;
}

export const CATALOG_PRACTICE: Record<string, CatalogPractice> = {
  'ranger-7-9': {
    scene: 'FlybyScene', siteId: 'ranger-7-9',
    note: 'Rangers 7, 8 and 9 sent back TV pictures right up until they hit the Moon on purpose. Here you only frame the targets on the way in.',
  },
  'lunar-orbiter-program': {
    scene: 'FlybyScene', siteId: 'lunar-orbiter-program',
    note: 'Five Lunar Orbiters photographed nearly all of the Moon from orbit to scout Apollo landing sites. Here one pass stands in for months of mapping.',
  },
  'surveyor-1': {
    scene: 'LandingScene', siteId: 'surveyor-3',
    note: 'Surveyor 1 landed itself automatically. Here you fly the descent by hand on the Surveyor 3 course; both landed in Oceanus Procellarum.',
  },
  'apollo-16-surface': {
    scene: 'RoverScene', siteId: 'apollo-17-site',
    note: 'Apollo 16 astronauts drove a Lunar Roving Vehicle across the Descartes Highlands. The course here is simplified game terrain.',
  },
  'pioneer-10': {
    scene: 'FlybyScene', siteId: 'pioneer-10',
    note: 'Pioneer 10 made the first close pass of Jupiter in 1973. Its real camera scanned the planet line by line as the spacecraft spun.',
  },
  'pioneer-11': {
    scene: 'FlybyScene', siteId: 'pioneer-11',
    note: "Pioneer 11 swung past Jupiter on a polar path in 1974 and sent back the first images of its north polar region, then became the first spacecraft to fly past Saturn in 1979.",
  },
  'voyager-2': {
    scene: 'FlybyScene', siteId: 'voyager-2',
    note: 'Voyager 2 is still the only spacecraft to have flown past Uranus (1986) and Neptune (1989).',
  },
  dawn: {
    scene: 'FlybyScene', siteId: 'dawn',
    note: 'Dawn orbited the asteroid Vesta and then the dwarf planet Ceres. Its mission ended in 2018, but it was left in a stable orbit and still circles Ceres. One pass stands in for years of orbits.',
  },
  kepler: {
    scene: 'LaserScene', siteId: 'voyager-1',
    note: "Kepler watched about 150,000 stars for the tiny dips of passing planets, and sent its data home over NASA's Deep Space Network. Here you hold that radio link.",
  },
};

export function getMinigameKeyForSite(siteId: string): MinigameSceneKey {
  return SITE_MINIGAMES[siteId] ?? 'LandingScene';
}

export function getMinigameMetaForSite(siteId: string): MinigameMeta {
  return MINIGAME_META[getMinigameKeyForSite(siteId)];
}

