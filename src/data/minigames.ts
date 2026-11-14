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
    description: 'Drive through boulder fields, collect 3 science cores, and reach the sample beacon before battery runs dry.',
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

  // Elsewhere // Deep Space (6)
  'near-shoemaker': 'LandingScene',
  galileo: 'FlybyScene',
  'cassini-huygens': 'RotorScene',
  'deep-impact': 'FlybyScene',
  'voyager-1': 'LaserScene',
  'new-horizons': 'FlybyScene',
};

export function getMinigameKeyForSite(siteId: string): MinigameSceneKey {
  return SITE_MINIGAMES[siteId] ?? 'LandingScene';
}

export function getMinigameMetaForSite(siteId: string): MinigameMeta {
  return MINIGAME_META[getMinigameKeyForSite(siteId)];
}
