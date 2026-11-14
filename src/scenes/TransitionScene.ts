import Phaser from 'phaser';
import { Soundscape } from '../audio/Soundscape.ts';
import { GameState } from '../core/GameState.ts';
import { CinematicPlayer } from '../systems/CinematicPlayer.ts';
import { CinematicTimelineSchema } from '../data/schema.ts';
import transitionData from '../../data/cinematics/transition.json';

export class TransitionScene extends Phaser.Scene {
  private player!: CinematicPlayer;

  constructor() {
    super('TransitionScene');
  }

  create(): void {
    document.body.classList.remove('in-game');
    // The journey: the ambience follows the backdrop (Moon, deep space, Mars)
    Soundscape.set({ music: 'transition', ambience: 'moon', ambienceLevel: 0.7, fade: 2 });
    const timeline = CinematicTimelineSchema.parse(transitionData);

    this.player = new CinematicPlayer(this, timeline, () => {
      GameState.setWorld('mars');
      this.scene.start('SiteScene');
    });

    this.player.create();
  }

  update(time: number, delta: number): void {
    this.player?.update(time, delta);
  }
}
