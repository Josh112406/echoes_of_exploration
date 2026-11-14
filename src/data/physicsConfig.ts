import { DifficultyId, WorldId } from './schema.ts';
import { CONSTANTS } from '../core/Constants.ts';

export interface DifficultyTierSettings {
  thrustToGravityRatio: number; // r
  sidewaysAccelRatio: number;   // a_h / a_t
  fuelMultiplier: number;
  safeVerticalSpeed: number;    // m/s
  safeHorizontalSpeed: number;  // m/s
  platformWidth: number;        // metres
}

export const DIFFICULTY_SETTINGS: Record<DifficultyId, DifficultyTierSettings> = {
  easy: {
    thrustToGravityRatio: 2.6,
    sidewaysAccelRatio: 0.50,
    fuelMultiplier: 1.50,
    safeVerticalSpeed: 2.50,
    safeHorizontalSpeed: 2.00,
    platformWidth: 8.0,
  },
  normal: {
    thrustToGravityRatio: 2.2,
    sidewaysAccelRatio: 0.45,
    fuelMultiplier: 1.35,
    safeVerticalSpeed: 2.00,
    safeHorizontalSpeed: 1.50,
    platformWidth: 6.0,
  },
  hard: {
    thrustToGravityRatio: 1.9,
    sidewaysAccelRatio: 0.40,
    fuelMultiplier: 1.20,
    safeVerticalSpeed: 1.50,
    safeHorizontalSpeed: 1.00,
    platformWidth: 4.0,
  },
};

export function getScaledPhysics(world: WorldId, difficulty: DifficultyId, assisted: boolean = false) {
  const base = DIFFICULTY_SETTINGS[difficulty];
  const g =
    world === 'mars'
      ? CONSTANTS.PHYSICS.MARS_GRAVITY
      : world === 'elsewhere'
        ? CONSTANTS.PHYSICS.ELSEWHERE_GRAVITY
        : CONSTANTS.PHYSICS.MOON_GRAVITY;
  const speedScale =
    world === 'mars'
      ? CONSTANTS.PHYSICS.MARS_SPEED_SCALE
      : world === 'elsewhere'
        ? CONSTANTS.PHYSICS.ELSEWHERE_SPEED_SCALE
        : 1.0;

  const thrustAccel = base.thrustToGravityRatio * g;
  const horizontalAccel = base.sidewaysAccelRatio * thrustAccel;

  let safeVy = base.safeVerticalSpeed * speedScale;
  let safeVx = base.safeHorizontalSpeed * speedScale;
  let platformW = base.platformWidth;

  if (assisted) {
    platformW *= 1.25;
  }

  return {
    gravity: g,
    thrustAccel,
    horizontalAccel,
    safeVerticalSpeed: safeVy,
    safeHorizontalSpeed: safeVx,
    platformWidth: platformW,
    fuelMultiplier: assisted ? base.fuelMultiplier * 1.25 : base.fuelMultiplier,
  };
}

