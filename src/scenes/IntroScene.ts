import Phaser from 'phaser';
import { Soundscape } from '../audio/Soundscape.ts';
import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { CinematicPlayer } from '../systems/CinematicPlayer.ts';
import { CinematicTimelineSchema } from '../data/schema.ts';
import introData from '../../data/cinematics/intro.json';

export class IntroScene extends Phaser.Scene {
  private player!: CinematicPlayer;

  constructor() {
    super('IntroScene');
  }

  create(): void {
    document.body.classList.remove('in-game');
    // Prologue: alone on the Moon as the crew leaves
    Soundscape.set({ music: 'intro', ambience: 'moon', ambienceLevel: 0.8, fade: 2 });
    const timeline = CinematicTimelineSchema.parse(introData);

    this.player = new CinematicPlayer(this, timeline, () => {
      GameState.setPrologueSeen(true);
      this.scene.start('TitleScene');
      EventBus.emit(EVENTS.SHOW_TITLE);
    });

    this.player.create();
  }

  update(time: number, delta: number): void {
    this.player?.update(time, delta);
  }
}
