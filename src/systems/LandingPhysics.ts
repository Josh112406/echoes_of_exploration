import { LevelConfig, TerrainSegment } from '../data/schema.ts';
import { getScaledPhysics } from '../data/physicsConfig.ts';
import { CONSTANTS } from '../core/Constants.ts';

export interface LandingState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fuel: number;
  thrusting: boolean;
  steering: -1 | 0 | 1;
  landed: boolean;
  crashed: boolean;
  statusMessage: string;
}

export class Terrain {
  readonly segments: TerrainSegment[];
  readonly platform: { x: number; y: number; width: number };

  constructor(segments: TerrainSegment[], platform: { x: number; y: number; width: number }) {
    this.segments = segments;
    this.platform = platform;
  }

  heightAt(x: number): number {
    const halfWidth = this.platform.width / 2;
    if (x >= this.platform.x - halfWidth && x <= this.platform.x + halfWidth) {
      return this.platform.y;
    }

    let minElevationY: number | null = null;
    for (const seg of this.segments) {
      const minX = Math.min(seg.x1, seg.x2);
      const maxX = Math.max(seg.x1, seg.x2);
      if (minX !== maxX && x >= minX && x <= maxX) {
        const t = (x - seg.x1) / (seg.x2 - seg.x1);
        const y = seg.y1 + t * (seg.y2 - seg.y1);
        if (minElevationY === null || y < minElevationY) {
          minElevationY = y;
        }
      }
    }
    return minElevationY !== null ? minElevationY : 20.0;
  }
}

export class LandingPhysicsEngine {
  readonly config: LevelConfig;
  readonly physics: ReturnType<typeof getScaledPhysics>;
  readonly dt: number = CONSTANTS.PHYSICS.TIMESTEP;
  readonly terrain: Terrain;

  constructor(config: LevelConfig, assisted: boolean = false) {
    this.config = config;
    this.physics = getScaledPhysics(config.world, config.difficulty, assisted);
    this.terrain = new Terrain(config.terrain, {
      x: config.platform.x,
      y: config.platform.y,
      width: this.physics.platformWidth,
    });
  }

  createInitialState(): LandingState {
    return {
      x: this.config.start.x,
      y: this.config.start.y,
      vx: this.config.start.vx,
      vy: this.config.start.vy,
      fuel: this.config.fuel,
      thrusting: false,
      steering: 0,
      landed: false,
      crashed: false,
      statusMessage: 'Approaching surface',
    };
  }

  step(state: LandingState, thrust: boolean, steer: -1 | 0 | 1): LandingState {
    if (state.landed || state.crashed) {
      return state;
    }

    let actualThrust = thrust && state.fuel > 0;
    let actualSteer: -1 | 0 | 1 = steer !== 0 && state.fuel > 0 ? steer : 0;

    // Fuel usage
    let fuelBurn = 0;
    if (actualThrust) fuelBurn += this.dt;
    if (actualSteer !== 0) fuelBurn += 0.5 * this.dt;

    const nextFuel = Math.max(0, state.fuel - fuelBurn);
    if (nextFuel <= 0) {
      actualThrust = false;
      actualSteer = 0;
    }

    // Accelerations: y points down, thrust points up (-y)
    const ay = this.physics.gravity - (actualThrust ? this.physics.thrustAccel : 0);
    const ax = actualSteer * this.physics.horizontalAccel;

    let nextVy = state.vy + ay * this.dt;
    let nextVx = state.vx + ax * this.dt;

    let nextX = state.x + nextVx * this.dt;
    let nextY = state.y + nextVy * this.dt;

    // Clamp robot to left/right/top edges
    if (nextX < 0) {
      nextX = 0;
      nextVx = 0;
    } else if (nextX > 40) {
      nextX = 40;
      nextVx = 0;
    }

    if (nextY < 0) {
      nextY = 0;
      nextVy = 0;
    }

    const groundY = this.terrain.heightAt(nextX);

    const nextState: LandingState = {
      x: nextX,
      y: nextY,
      vx: nextVx,
      vy: nextVy,
      fuel: nextFuel,
      thrusting: actualThrust,
      steering: actualSteer,
      landed: false,
      crashed: false,
      statusMessage: 'In descent',
    };

    // Check floor collision against terrain surface at nextX
    if (nextY >= groundY) {
      nextState.y = groundY;
      const pad = this.config.platform;
      const halfWidth = this.physics.platformWidth / 2;
      const padLeft = pad.x - halfWidth;
      const padRight = pad.x + halfWidth;

      if (nextX >= padLeft && nextX <= padRight) {
        const vySafe = Math.abs(nextVy) <= this.physics.safeVerticalSpeed;
        const vxSafe = Math.abs(nextVx) <= this.physics.safeHorizontalSpeed;

        if (vySafe && vxSafe) {
          nextState.vx = 0;
          nextState.vy = 0;
          nextState.landed = true;
          nextState.statusMessage = 'Touchdown successful!';
          return nextState;
        } else {
          nextState.crashed = true;
          nextState.statusMessage = !vySafe
            ? `Hard vertical impact (${nextVy.toFixed(2)} m/s > ${this.physics.safeVerticalSpeed.toFixed(2)} m/s)`
            : `Excessive horizontal speed (${Math.abs(nextVx).toFixed(2)} m/s > ${this.physics.safeHorizontalSpeed.toFixed(2)} m/s)`;
          return nextState;
        }
      } else {
        nextState.crashed = true;
        nextState.statusMessage = 'Crashed outside designated landing zone';
        return nextState;
      }
    }

    return nextState;
  }
}
