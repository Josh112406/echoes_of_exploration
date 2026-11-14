import Phaser from 'phaser';
import { CONSTANTS } from './core/Constants.ts';
import { BootScene } from './scenes/BootScene.ts';
import { IntroScene } from './scenes/IntroScene.ts';
import { TitleScene } from './scenes/TitleScene.ts';
import { SiteScene } from './scenes/SiteScene.ts';
import { LandingScene } from './scenes/LandingScene.ts';
import { RoverScene } from './scenes/RoverScene.ts';
import { LaserScene } from './scenes/LaserScene.ts';
import { RotorScene } from './scenes/RotorScene.ts';
import { FlybyScene } from './scenes/FlybyScene.ts';
import { TransitionScene } from './scenes/TransitionScene.ts';
import { EndingScene } from './scenes/EndingScene.ts';

export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CONSTANTS.CANVAS.WIDTH,
  height: CONSTANTS.CANVAS.HEIGHT,
  parent: 'game-container',
  pixelArt: true,
  roundPixels: true,
  render: {
    pixelArt: true,
    roundPixels: true,
    antialias: false,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  input: {
    activePointers: 3,
  },
  audio: {
    noAudio: true,
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  backgroundColor: '#05070f',
  scene: [
    BootScene,
    IntroScene,
    TitleScene,
    SiteScene,
    LandingScene,
    RoverScene,
    LaserScene,
    RotorScene,
    FlybyScene,
    TransitionScene,
    EndingScene,
  ],
};
