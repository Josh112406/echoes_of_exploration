import Phaser from 'phaser';
import { Soundscape } from '../audio/Soundscape.ts';
import { GameState } from '../core/GameState.ts';
import { CinematicPlayer } from '../systems/CinematicPlayer.ts';
import { CinematicTimelineSchema } from '../data/schema.ts';
import transitionData from '../../data/cinematics/transition.json';
import transitionElsewhereData from '../../data/cinematics/transition-elsewhere.json';

type TargetWorld = 'mars' | 'elsewhere';

export class TransitionScene extends Phaser.Scene {
  private player!: CinematicPlayer;
  private targetWorld: TargetWorld = 'mars';

  constructor() {
    super('TransitionScene');
  }

  init(data?: { targetWorld?: TargetWorld }): void {
    this.targetWorld = data?.targetWorld === 'elsewhere' ? 'elsewhere' : 'mars';
  }

  create(): void {
    document.body.classList.remove('in-game');
    // The journey: the ambience follows the backdrop (Moon, deep space, Mars)
    const target = this.targetWorld;
    Soundscape.set({ music: 'transition', ambience: target === 'elsewhere' ? 'mars' : 'moon', ambienceLevel: 0.7, fade: 2 });
    const timeline = CinematicTimelineSchema.parse(target === 'elsewhere' ? transitionElsewhereData : transitionData);

    this.player = new CinematicPlayer(this, timeline, () => {
      GameState.setWorld(target);
      this.scene.start('SiteScene');
    });

    this.player.create();
  }

  update(time: number, delta: number): void {
    this.player?.update(time, delta);
  }
}
