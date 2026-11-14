import Phaser from 'phaser';
import { PixelArtGenerator } from '../systems/PixelArtGenerator.ts';
import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { ALL_ENTRIES } from '../data/entries.ts';
import { buildRobotDriveSheet } from '../systems/SpriteArt.ts';
import { getTitleLayers, buildEarthSheet, EARTH_FRAMES, EARTH_SIZE } from '../systems/TitleArt.ts';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    // Generate and register runtime textures
    const robotCanvas = PixelArtGenerator.createRobotCanvas();
    this.textures.addCanvas('robot_idle', robotCanvas);
    const driveTex = this.textures.addCanvas('robot_drive', buildRobotDriveSheet());
    if (driveTex) {
      driveTex.add(0, 0, 0, 0, 24, 24);
      driveTex.add(1, 0, 24, 0, 24, 24);
    }

    const moonTile = PixelArtGenerator.createTerrainTile('moon');
    this.textures.addCanvas('tile_moon', moonTile);

    const marsTile = PixelArtGenerator.createTerrainTile('mars');
    this.textures.addCanvas('tile_mars', marsTile);

    const elsewhereTile = PixelArtGenerator.createTerrainTile('elsewhere');
    this.textures.addCanvas('tile_elsewhere', elsewhereTile);

    const panelCanvas = PixelArtGenerator.createNineSlicePanelCanvas();
    this.textures.addCanvas('panel_9slice', panelCanvas);

    const vignetteCanvas = PixelArtGenerator.createVignetteCanvas(640, 360);
    this.textures.addCanvas('vignette_overlay', vignetteCanvas);

    const glowCanvas = PixelArtGenerator.createGlowCanvas();
    this.textures.addCanvas('glow_disk', glowCanvas);

    const thrusterGlowCanvas = PixelArtGenerator.createThrusterGlowCanvas();
    this.textures.addCanvas('glow_thruster', thrusterGlowCanvas);

    const earthMoonCanvas = PixelArtGenerator.createEarthCanvas(false);
    this.textures.addCanvas('earth_moon', earthMoonCanvas);

    const earthMarsCanvas = PixelArtGenerator.createEarthCanvas(true);
    this.textures.addCanvas('earth_mars', earthMarsCanvas);

    const radarArrowCanvas = PixelArtGenerator.createRadarArrowCanvas();
    this.textures.addCanvas('radar_arrow', radarArrowCanvas);

    // Title-screen layers and rotating Earth sheet
    const layers = getTitleLayers();
    this.textures.addCanvas('title_sky', layers.sky);
    this.textures.addCanvas('title_far', layers.far.canvas);
    this.textures.addCanvas('title_mid', layers.mid.canvas);
    this.textures.addCanvas('title_near', layers.near.canvas);
    const earthTex = this.textures.addCanvas('earth_spin', buildEarthSheet());
    if (earthTex) {
      for (let i = 0; i < EARTH_FRAMES; i++) {
        earthTex.add(i, 0, i * EARTH_SIZE, 0, EARTH_SIZE, EARTH_SIZE);
      }
    }

    // Register all hardware sprites
    for (const [id, entry] of Object.entries(ALL_ENTRIES)) {
      const hwCanvas = PixelArtGenerator.createHardwareSprite(id, entry.world);
      this.textures.addCanvas(`hw_${id}`, hwCanvas);
    }

    // Register retro pixel bitmap font
    PixelArtGenerator.generateBitmapFont(this);
  }

  create(): void {
    if (!this.anims.exists('robot_drive_anim')) {
      this.anims.create({
        key: 'robot_drive_anim',
        frames: [{ key: 'robot_drive', frame: 0 }, { key: 'robot_drive', frame: 1 }],
        frameRate: 10,
        repeat: -1,
      });
    }
    if (!this.anims.exists('earth_rotate')) {
      this.anims.create({
        key: 'earth_rotate',
        frames: Array.from({ length: EARTH_FRAMES }, (_, i) => ({ key: 'earth_spin', frame: i })),
        frameRate: 3,
        repeat: -1,
      });
    }

    const hasSeenPrologue = GameState.getState().prologueSeen;

    if (!hasSeenPrologue) {
      // First time playing: start with Intro Cutscene
      this.scene.start('IntroScene');
    } else {
      // Subsequent visits: launch Title Scene & Title Screen
      this.scene.start('TitleScene');
      EventBus.emit(EVENTS.SHOW_TITLE);
    }
  }
}
