import { LevelConfig } from '../data/schema.ts';
import { LandingPhysicsEngine, LandingState } from './LandingPhysics.ts';

export interface SolverResult {
  success: boolean;
  steps: number;
  fuelUsed: number;
  finalState: LandingState;
}

export class LevelSolver {
  static solve(config: LevelConfig, maxSteps: number = 3600): SolverResult {
    const engine = new LandingPhysicsEngine(config, false);
    let state = engine.createInitialState();
    const initialFuel = state.fuel;

    const pad = config.platform;
    const safeVy = engine.physics.safeVerticalSpeed;
    const safeVx = engine.physics.safeHorizontalSpeed;
    const ah = engine.physics.horizontalAccel;

    for (let step = 0; step < maxSteps; step++) {
      if (state.landed || state.crashed) {
        break;
      }

      const dx = pad.x - state.x;
      const dy = pad.y - state.y;

      // 1. Horizontal guidance
      let steer: -1 | 0 | 1 = 0;
      const stoppingDistX = (state.vx * state.vx) / (2 * ah);

      if (Math.abs(dx) <= engine.physics.platformWidth * 0.35) {
        // Above platform: cancel horizontal motion
        if (state.vx > 0.05) steer = -1;
        else if (state.vx < -0.05) steer = 1;
        else steer = 0;
      } else if (dx > 0) {
        if (state.vx > 0 && stoppingDistX >= dx) {
          steer = -1;
        } else if (state.vx < safeVx * 0.8) {
          steer = 1;
        }
      } else {
        if (state.vx < 0 && stoppingDistX >= Math.abs(dx)) {
          steer = 1;
        } else if (state.vx > -safeVx * 0.8) {
          steer = -1;
        }
      }

      // 2. Vertical guidance
      let thrust = false;
      const netBrakeAy = engine.physics.thrustAccel - engine.physics.gravity;
      const stoppingDistY = (state.vy * state.vy) / (2 * netBrakeAy);

      const isOverPad = Math.abs(dx) <= engine.physics.platformWidth * 0.45;

      if (!isOverPad) {
        // En route: cruise altitude
        if (state.vy > 0.8 || state.y > pad.y - 4.5) {
          thrust = true;
        }
      } else {
        // Over pad: descent and touchdown
        // In the final 0.5 metres, NEVER thrust if vy is safely within limits!
        if (dy <= 0.5) {
          if (state.vy > safeVy * 0.85) {
            thrust = true;
          }
        } else if (state.vy > 0) {
          if (dy <= stoppingDistY + 0.1 || state.vy > safeVy * 0.75) {
            thrust = true;
          }
        }
      }

      state = engine.step(state, thrust, steer);
    }

    return {
      success: state.landed,
      steps: 0,
      fuelUsed: initialFuel - state.fuel,
      finalState: state,
    };
  }
}
