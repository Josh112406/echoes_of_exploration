import Phaser from 'phaser';
import { CONSTANTS } from '../core/Constants.ts';
import { GameState } from '../core/GameState.ts';
import { LevelConfig } from '../data/schema.ts';
import { LandingPhysicsEngine, LandingState } from '../systems/LandingPhysics.ts';
import { getLevelConfig, ALL_LEVELS } from '../data/levels.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { Soundscape } from '../audio/Soundscape.ts';
import { PALETTE } from '../ui/theme.ts';
import { NineSliceHUD, HUDGauges, HUD_FONT, hudPx, shrinkToFit } from '../ui/NineSliceHUD.ts';
import { CIN_MARGIN, buildLandingTerrain } from '../systems/TitleArt.ts';
import { ensureBackdropTextures } from '../systems/BackdropTextures.ts';
import { completeMinigame, failMinigame, fitHeaderText, fitText, leaveMinigame, minTouchTarget, missionName, showBriefing } from '../systems/MinigameKit.ts';
import { Practice } from '../systems/Practice.ts';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  drag: number;
  life: number;
  maxLife: number;
  color: number;
  cool?: number;
  size: number;
}

/** Camera framing: keeps robot + ground in view, eases in near touchdown. */
const CAM_ZOOM_MIN = 1.0;
const CAM_ZOOM_MAX = 1.32;
/** World is panned within the level plus this slack, so parallax always reads. */
const CAM_SLACK_X = 44;
const CAM_SLACK_TOP = 36;
const CAM_SLACK_BOTTOM = 24;
/** Parallax scroll factors for the backdrop layers (terrain = 1). */
const SF = { sky: 0.1, celestial: 0.15, far: 0.35, mid: 0.6 } as const;

/** Robot sprite geometry (24×24 canvas, see PixelArtGenerator.createRobotCanvas). */
const ROBOT_SCALE = 1.25;
const ROBOT_FEET_FROM_CENTER = 9; // wheels end on row 21, centre is row 12
const NOZZLES_LOCAL = [
  { x: -7.5, y: 4 },
  { x: 7.5, y: 4 },
];

/** Visual attitude limits (radians). Physics is untouched; this is presentation. */
const MAX_TILT = 0.34;
const VX_LEAN = 0.035;

/** Terrain canvas padding beyond the 640px level on each side (covers shake). */
const TERRAIN_PAD = 56;

export class LandingScene extends Phaser.Scene {
  private siteId: string = 'apollo-11-site';
  private config!: LevelConfig;
  private engine!: LandingPhysicsEngine;
  private state!: LandingState;
  private prevState!: LandingState;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keysWASD!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private keySpace!: Phaser.Input.Keyboard.Key;

  // Render layers: world (zoomed, followed) vs. UI (own fixed camera)
  private worldLayer!: Phaser.GameObjects.Layer;
  private uiLayer!: Phaser.GameObjects.Layer;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;

  private hudGauges!: HUDGauges;
  private robotSprite!: Phaser.GameObjects.Sprite;
  private robotShadow!: Phaser.GameObjects.Ellipse;
  private thrusterFlame!: Phaser.GameObjects.Graphics;
  private thrusterGlow!: Phaser.GameObjects.Image;
  private particleGraphics!: Phaser.GameObjects.Graphics;

  private accumulator: number = 0;
  private assisted: boolean = false;
  private particles: Particle[] = [];
  private lastSteer: number = 0;
  private reducedMotion: boolean = false;
  private outcomeHandled: boolean = false;

  // Smoothed presentation state
  private attitude: number = 0;
  private thrustLevel: number = 0;
  private steerLevel: number = 0;
  private exhaustBudget: number = 0;
  private rcsBudget: number = 0;
  private dustBudget: number = 0;

  // Touch control states
  private touchThrust: boolean = false;
  private touchSteer: -1 | 0 | 1 = 0;
  private controlStripTop: number = CONSTANTS.CANVAS.HEIGHT - 40;

  // Pre-flight tutorial overlay state
  private isTutorialActive: boolean = false;
  private tutorialContainer!: Phaser.GameObjects.Container;

  constructor() {
    super('LandingScene');
  }

  init(data: { siteId: string; assisted?: boolean }): void {
    this.siteId = data.siteId || 'apollo-11-site';
    this.assisted = !!data.assisted;
    this.touchThrust = false;
    this.touchSteer = 0;
    this.particles = [];
    this.accumulator = 0;
    this.attitude = 0;
    this.thrustLevel = 0;
    this.steerLevel = 0;
    this.lastSteer = 0;
    this.outcomeHandled = false;
  }

  create(): void {
    document.body.classList.add('in-game');
    this.config = getLevelConfig(this.siteId) || ALL_LEVELS['apollo-11-site'];
    this.engine = new LandingPhysicsEngine(this.config, this.assisted);
    this.state = this.engine.createInitialState();
    this.prevState = { ...this.state };
    this.reducedMotion = GameState.getState().settings.reducedMotion;
    // Tense descent music; the world's ambience stays underneath, quieter
    const ambience = this.config.world === 'elsewhere' ? 'space' : this.config.world;
    Soundscape.set({ music: 'landing', ambience, ambienceLevel: 0.5, fade: 1.5 });

    const ppm = CONSTANTS.CANVAS.PIXELS_PER_METER;
    const W = CONSTANTS.CANVAS.WIDTH;
    const H = CONSTANTS.CANVAS.HEIGHT;

    // Layers + cameras: the HUD never zooms, pans or shakes with the world
    this.worldLayer = this.add.layer().setDepth(0);
    this.uiLayer = this.add.layer().setDepth(1000);
    const cam = this.cameras.main;
    cam.setBackgroundColor(PALETTE.spaceBlack);
    cam.setBounds(-CAM_SLACK_X, -CAM_SLACK_TOP, W + CAM_SLACK_X * 2, H + CAM_SLACK_TOP + CAM_SLACK_BOTTOM);
    cam.setZoom(CAM_ZOOM_MIN);
    this.uiCamera = this.cameras.add(0, 0, W, H, false, 'landing-ui');
    cam.ignore(this.uiLayer);
    this.uiCamera.ignore(this.worldLayer);

    // 1. Parallax backdrop (same art as the title & cinematics, padded)
    this.createBackdrop(W);

    // 2. Level terrain painted in the dithered title style
    this.createTerrainView(ppm, W, H);

    // 3. Landing pad + the relic waiting beside it
    this.createLandingPad(ppm);

    // 4. Robot, contact shadow, twin jet flames, glow, particles
    this.robotShadow = this.world(this.add.ellipse(0, 0, 26, 4, PALETTE.spaceBlackHex, 0.5).setDepth(15));
    this.thrusterGlow = this.world(this.add.image(0, 0, 'glow_thruster')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(18)
      .setVisible(false));
    this.thrusterFlame = this.world(this.add.graphics().setDepth(19));
    this.robotSprite = this.world(this.add.sprite(0, 0, 'robot_idle').setDepth(20).setScale(ROBOT_SCALE));
    this.particleGraphics = this.world(this.add.graphics().setDepth(21));
    this.renderRobot(this.state.x * ppm, this.state.y * ppm);
    this.updateCamera(this.state.x * ppm, this.state.y * ppm, 1, true);

    // 5. Fixed UI: HUD gauges, edge fade, vignette, controls
    this.hudGauges = NineSliceHUD.createLandingHUD(this, this.siteId, this.config.world, this.config.fuel);
    this.ui(this.hudGauges.container);
    this.hudGauges.updateVelocity(this.state.vx, this.state.vy, this.engine.physics.safeHorizontalSpeed, this.engine.physics.safeVerticalSpeed);
    this.hudGauges.updateAltitude(this.engine.terrain.heightAt(this.state.x) - this.state.y);
    this.createScreenFx(W, H);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keysWASD = this.input.keyboard!.addKeys('W,A,S,D') as LandingScene['keysWASD'];
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.createTouchControls();

    const stopAudio = () => SoundFX.setThruster(false);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopAudio);
    this.events.once(Phaser.Scenes.Events.DESTROY, stopAudio);

    const totalRecovered =
      GameState.getRecoveredCount('moon') +
      GameState.getRecoveredCount('mars') +
      GameState.getRecoveredCount('elsewhere');
    if (totalRecovered === 0 || GameState.getFailureCount(this.siteId) === 0 && !GameState.isEntryRecovered(this.siteId)) {
      this.showPreFlightTutorial();
    } else {
      this.isTutorialActive = false;
    }
  }

  // ---------------------------------------------------------------------------
  // Layers
  // ---------------------------------------------------------------------------

  private world<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.worldLayer.add(obj);
    return obj;
  }

  private ui<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.uiLayer.add(obj);
    this.cameras.main.ignore(obj);
    return obj;
  }

  // ---------------------------------------------------------------------------
  // Scenery
  // ---------------------------------------------------------------------------

  private createBackdrop(W: number): void {
    const kind = this.config.world === 'elsewhere' ? 'space' : this.config.world;
    ensureBackdropTextures(this.textures, kind);
    const M = CIN_MARGIN;

    this.world(this.add.image(-M, -M, `cin_${kind}_sky`).setOrigin(0, 0).setScrollFactor(SF.sky).setDepth(-50));

    // A few twinkles
    for (let i = 0; i < 10; i++) {
      const g = this.add.graphics().setScrollFactor(SF.sky).setDepth(-49);
      const x = (i * 149) % W;
      const y = 12 + ((i * 53) % 150);
      const c = i % 4 === 0 ? PALETTE.cyanLaserHex : PALETTE.lunarHighlightHex;
      g.fillStyle(c, 1).fillRect(x, y, 1, 1);
      g.fillStyle(c, 0.45).fillRect(x - 1, y, 1, 1).fillRect(x + 1, y, 1, 1).fillRect(x, y - 1, 1, 1).fillRect(x, y + 1, 1, 1);
      this.world(g);
      if (!this.reducedMotion) {
        this.tweens.add({ targets: g, alpha: 0.15, duration: 900 + i * 230, delay: i * 300, yoyo: true, repeat: -1, ease: 'Stepped', easeParams: [3] });
      }
    }

    if (kind === 'moon') {
      const glow = this.add.image(486, 72, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setScale(3).setAlpha(0.18);
      const earth = this.add.sprite(486, 72, 'earth_spin', 0);
      if (!this.reducedMotion && this.anims.exists('earth_rotate')) earth.play('earth_rotate');
      for (const o of [glow, earth]) this.world(o.setScrollFactor(SF.celestial).setDepth(-48));
    } else {
      const glow = this.add.image(500, 60, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.35);
      const dot = this.add.image(500, 60, 'earth_mars');
      for (const o of [glow, dot]) this.world(o.setScrollFactor(SF.celestial).setDepth(-48));
    }

    if (this.textures.exists(`cin_${kind}_far`)) {
      this.world(this.add.image(-M, -M, `cin_${kind}_far`).setOrigin(0, 0).setScrollFactor(SF.far).setDepth(-40));
    }
    if (this.textures.exists(`cin_${kind}_mid`)) {
      this.world(this.add.image(-M, -M, `cin_${kind}_mid`).setOrigin(0, 0).setScrollFactor(SF.mid).setDepth(-30));
    }
  }

  private createTerrainView(ppm: number, W: number, H: number): void {
    const width = this.engine.physics.platformWidth;
    const key = `land_${this.siteId}_${width.toFixed(2)}`;
    if (!this.textures.exists(key)) {
      const heights: number[] = [];
      const maxX = W / ppm;
      for (let px = -TERRAIN_PAD; px < W + TERRAIN_PAD; px++) {
        const xm = Phaser.Math.Clamp((px + 0.5) / ppm, 0, maxX);
        heights.push(this.engine.terrain.heightAt(xm) * ppm);
      }
      const layer = buildLandingTerrain(heights, H + TERRAIN_PAD, this.config.world);
      this.textures.addCanvas(key, layer.canvas);
    }
    this.world(this.add.image(-TERRAIN_PAD, 0, key).setOrigin(0, 0).setDepth(5));
  }

  private createLandingPad(ppm: number): void {
    const pad = this.config.platform;
    const halfW = this.engine.physics.platformWidth / 2;
    const x0 = Math.round((pad.x - halfW) * ppm);
    const x1 = Math.round((pad.x + halfW) * ppm);
    const y = Math.round(pad.y * ppm);

    const g = this.world(this.add.graphics().setDepth(6));
    // Support struts
    g.fillStyle(PALETTE.deepIndigoHex, 1);
    for (let sx = x0 + 3; sx < x1 - 2; sx += 12) g.fillRect(sx, y + 3, 2, 4);
    // Deck: shadow, body, lit edge
    g.fillStyle(PALETTE.spaceBlackHex, 0.6).fillRect(x0, y + 3, x1 - x0, 1);
    g.fillStyle(PALETTE.lunarRegolithDeepHex, 1).fillRect(x0, y, x1 - x0, 3);
    g.fillStyle(PALETTE.lunarDustLightHex, 1).fillRect(x0, y, x1 - x0, 1);
    // Deck markings
    g.fillStyle(PALETTE.cyanDeepHex, 1);
    for (let mx = x0 + 6; mx < x1 - 6; mx += 8) g.fillRect(mx, y + 1, 4, 1);
    // Cyan guide strip on top
    g.fillStyle(PALETTE.cyanGlowHex, 1).fillRect(x0 + 1, y - 1, x1 - x0 - 2, 1);

    // Pulsing guide glow along the deck
    const padGlow = this.world(this.add.image((x0 + x1) / 2, y - 2, 'glow_disk')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(((x1 - x0) * 1.3) / 48, 0.6)
      .setAlpha(0.5)
      .setDepth(6));

    // Edge beacons, blinking alternately
    const beacons = [x0, x1 - 2].map((bx, i) => {
      const light = this.world(this.add.rectangle(bx + 1, y - 2, 2, 2, PALETTE.cyanLaserHex).setDepth(7));
      const halo = this.world(this.add.image(bx + 1, y - 2, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setScale(0.3).setAlpha(0.8).setDepth(7));
      if (!this.reducedMotion) {
        this.tweens.add({ targets: [light, halo], alpha: 0.15, duration: 500, delay: i * 500, yoyo: true, repeat: -1, ease: 'Stepped' });
      }
      return light;
    });
    void beacons;

    if (!this.reducedMotion) {
      this.tweens.add({ targets: padGlow, alpha: 0.22, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // The relic this landing recovers, resting at the edge of the zone
    const hwKey = `hw_${this.siteId}`;
    if (this.textures.exists(hwKey)) {
      this.world(this.add.ellipse(x1 - 14, y + 1, 28, 4, PALETTE.spaceBlackHex, 0.5).setDepth(6));
      this.world(this.add.sprite(x1 - 14, y + 1, hwKey).setOrigin(0.5, 27 / 32).setDepth(7));
    }
  }

  private createScreenFx(W: number, H: number): void {
    const k = PALETTE.spaceBlackHex;
    const edge = this.ui(this.add.graphics().setDepth(90));
    const fadeW = 30;
    edge.fillGradientStyle(k, k, k, k, 1, 0, 1, 0);
    edge.fillRect(0, 0, fadeW, H);
    edge.fillGradientStyle(k, k, k, k, 0, 1, 0, 1);
    edge.fillRect(W - fadeW, 0, fadeW, H);
    if (this.textures.exists('vignette_overlay')) {
      this.ui(this.add.image(W / 2, H / 2, 'vignette_overlay').setDepth(95).setAlpha(0.75));
    }
  }

  // ---------------------------------------------------------------------------
  // Briefing + controls (fixed UI)
  // ---------------------------------------------------------------------------

  private showPreFlightTutorial(): void {
    this.isTutorialActive = true;
    const W = CONSTANTS.CANVAS.WIDTH;
    const H = CONSTANTS.CANVAS.HEIGHT;
    const phys = this.engine.physics;

    if (window.matchMedia('(pointer: coarse)').matches) {
      showBriefing(this, {
        title: `PRE-FLIGHT AVIONICS // ${missionName(this.siteId).toUpperCase()}`,
        subtitle: `DIFFICULTY: ${this.config.difficulty.toUpperCase()} · GRAVITY: ${this.config.world === 'moon' ? '1.62 m/s² (MOON)' : '3.71 m/s² (MARS)'}`,
        lines: [
          '• HOLD THRUST: FIRE MAIN RETRO-THRUSTERS',
          '• HOLD THE STEER BUTTONS: TILT AND DRIFT SIDEWAYS',
          `• SAFE TOUCHDOWN: VY ≤ ${phys.safeVerticalSpeed.toFixed(1)} m/s & VX ≤ ${phys.safeHorizontalSpeed.toFixed(1)} m/s`,
          '• WATCH FUEL: CONTINUOUS FIRING USES IT QUICKLY',
        ],
        cta: 'ENGAGE DESCENT ➔',
      }, () => this.closeTutorial());
      return;
    }

    this.tutorialContainer = this.ui(this.add.container(W / 2, H / 2).setDepth(150));

    const title = fitHeaderText(this.add.text(0, 0, `${Practice.run ? 'PRACTICE RUN' : 'PRE-FLIGHT AVIONICS'} // ${missionName(this.siteId).toUpperCase()}`, {
      fontSize: '9px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarHighlight,
      letterSpacing: 3,
      align: 'center',
    }).setOrigin(0.5, 0), 316);

    const diff = fitHeaderText(this.add.text(0, 0, `DIFFICULTY: ${this.config.difficulty.toUpperCase()} · GRAVITY: ${this.config.world === 'moon' ? '1.62 m/s² (MOON)' : '3.71 m/s² (MARS)'}`, {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.beaconGold,
      letterSpacing: 2,
      align: 'center',
    }).setOrigin(0.5, 0), 316);

    const lines = [
      '• [SPACE / W / UP / TAP SCREEN]: FIRE MAIN RETRO-THRUSTERS',
      '• [A / D / ARROWS / STEER BTNS]: RCS JETS, TILT & DRIFT SIDEWAYS',
      `• SAFE VELOCITY: TOUCH DOWN AT VY ≤ ${phys.safeVerticalSpeed.toFixed(1)} m/s & VX ≤ ${phys.safeHorizontalSpeed.toFixed(1)} m/s`,
      '• WATCH FUEL: RESERVE BURNS RAPIDLY UNDER CONTINUOUS FIRING',
      ...(Practice.run ? ['• PRACTICE RUN: NO ECHO IS RECOVERED. ' + Practice.run.note.toUpperCase()] : []),
    ];
    const lineTexts = lines.map((line) => this.add.text(-150, 0, line, {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: line.startsWith('• PRACTICE') ? PALETTE.cyanLaser : PALETTE.lunarCrustCream,
      wordWrap: { width: 300, useAdvancedWrap: true },
    }));

    const titleY = 12;
    const diffY = titleY + title.height + 5;
    const topDivY = diffY + diff.height + 7;
    let ly = topDivY + 10;
    const lineYs = lineTexts.map((t) => {
      const y = ly;
      ly += Math.max(17, t.height + 6);
      return y;
    });
    const botDivY = ly + 3;
    const btnY = botDivY + 10;
    const totalH = Math.max(170, btnY + 22 + 12);
    const top = Math.round(-totalH / 2);

    const bg = this.add.graphics();
    NineSliceHUD.drawFrame(bg, -170, top, 340, totalH, 'panel');
    bg.fillStyle(PALETTE.atmosphericDuskHex, 1);
    bg.fillRect(-158, top + topDivY, 316, 1);
    bg.fillRect(-158, top + botDivY, 316, 1);
    this.tutorialContainer.add(bg);

    title.setY(top + titleY);
    diff.setY(top + diffY);
    this.tutorialContainer.add([title, diff]);
    lineTexts.forEach((t, i) => {
      t.setY(top + lineYs[i]);
      this.tutorialContainer.add(t);
    });

    const btnBg = this.add.graphics();
    NineSliceHUD.drawFrame(btnBg, -110, top + btnY, 220, 22, 'primary');
    this.tutorialContainer.add(btnBg);
    this.tutorialContainer.add(fitText(this.add.text(0, top + btnY + 11, 'ENGAGE DESCENT ➔', {
      fontSize: '8px',
      fontFamily: HUD_FONT,
      color: PALETTE.spaceBlack,
      letterSpacing: 3,
    }).setOrigin(0.5), 204));

    const zone = this.add.zone(0, top + btnY + 11, 220, Math.max(22, minTouchTarget(this))).setInteractive({ cursor: 'pointer' });
    zone.on('pointerdown', () => {
      SoundFX.playClick();
      this.closeTutorial();
    });
    this.tutorialContainer.add(zone);

    const keyEnter = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    keyEnter?.once('down', () => this.closeTutorial());
    this.keySpace.once('down', () => this.closeTutorial());
  }

  private closeTutorial(): void {
    if (!this.isTutorialActive) return;
    this.isTutorialActive = false;
    this.tutorialContainer?.destroy();
  }

  private createTouchControls(): void {
    const W = CONSTANTS.CANVAS.WIDTH;
    const H = CONSTANTS.CANVAS.HEIGHT;
    const hit = minTouchTarget(this);

    // Top-right exit
    const exitBg = this.ui(this.add.graphics().setDepth(100));
    NineSliceHUD.drawFrame(exitBg, W - 96, 10, 86, 22, 'secondary');
    const exitZone = this.ui(this.add.zone(W - 53, Math.max(21, hit / 2), Math.max(86, hit), Math.max(22, hit)).setDepth(101).setInteractive({ cursor: 'pointer' }));
    exitZone.on('pointerdown', () => {
      SoundFX.setThruster(false);
      SoundFX.playClick();
      if (Practice.run) leaveMinigame(this, 'exited');
      else this.scene.start('SiteScene');
    });
    const exitText = this.ui(shrinkToFit(this.add.text(W - 53, 21, 'SURFACE MAP', {
      fontSize: hudPx(7),
      fontFamily: HUD_FONT,
      color: PALETTE.lunarHighlight,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(102), 80));
    exitZone.on('pointerover', () => exitText.setColor(PALETTE.cyanLaser));
    exitZone.on('pointerout', () => exitText.setColor(PALETTE.lunarHighlight));

    const mobile = window.matchMedia('(pointer: coarse)').matches;
    const buttonH = mobile ? Math.max(32, hit * 1.2) : 24;
    const steerW = mobile ? Math.max(84, hit * 1.2) : 68;
    const thrustW = mobile ? 180 : 150;
    const inset = mobile ? 24 : 12;
    const btnY = H - buttonH - (mobile ? 16 : 8);
    const hitH = Math.max(buttonH, hit);
    const hitY = Phaser.Math.Clamp(btnY + buttonH / 2, hitH / 2, H - hitH / 2);
    this.controlStripTop = Math.min(H - 40, hitY - hitH / 2);

    const makeSteer = (x: number, dir: -1 | 1, label: string) => {
      const bg = this.ui(this.add.graphics().setDepth(100));
      NineSliceHUD.drawFrame(bg, x, btnY, steerW, buttonH, 'ghost');
      const zone = this.ui(this.add.zone(x + steerW / 2, hitY, Math.max(steerW, hit), hitH).setDepth(101).setInteractive({ cursor: 'pointer' }));
      zone.on('pointerdown', () => { this.touchSteer = dir; });
      zone.on('pointerup', () => { this.touchSteer = 0; });
      zone.on('pointerout', () => { this.touchSteer = 0; });
      zone.on('pointercancel', () => { this.touchSteer = 0; });
      this.ui(this.add.text(x + steerW / 2, btnY + buttonH / 2, label, {
        fontSize: mobile ? '12px' : '7px',
        fontFamily: HUD_FONT,
        color: mobile ? PALETTE.lunarHighlight : PALETTE.slateMuted,
        letterSpacing: 2,
      }).setOrigin(0.5).setDepth(102));
    };
    makeSteer(inset, -1, '◀ STEER');
    makeSteer(W - inset - steerW, 1, 'STEER ▶');

    const thrustBg = this.ui(this.add.graphics().setDepth(100));
    NineSliceHUD.drawFrame(thrustBg, W / 2 - thrustW / 2, btnY, thrustW, buttonH, 'primary');
    const thrustZone = this.ui(this.add.zone(W / 2, hitY, Math.max(thrustW, hit), hitH).setDepth(101).setInteractive({ cursor: 'pointer' }));
    thrustZone.on('pointerdown', () => { this.touchThrust = true; });
    thrustZone.on('pointerup', () => { this.touchThrust = false; });
    thrustZone.on('pointerout', () => { this.touchThrust = false; });
    thrustZone.on('pointercancel', () => { this.touchThrust = false; });
    this.ui(this.add.text(W / 2, btnY + buttonH / 2, mobile ? 'THRUST' : 'THRUST [SPACE / W]', {
      fontSize: mobile ? '12px' : '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.spaceBlack,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(102));
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  update(_time: number, delta: number): void {
    const dtSeconds = Math.min(delta / 1000, 0.1);
    const ppm = CONSTANTS.CANVAS.PIXELS_PER_METER;

    if (this.isTutorialActive) {
      this.renderRobot(this.state.x * ppm, this.state.y * ppm);
      return;
    }

    const active = !this.state.landed && !this.state.crashed;
    let thrust = false;
    let steer: -1 | 0 | 1 = 0;
    let rx = this.state.x * ppm;
    let ry = this.state.y * ppm;

    if (active) {
      const groundY = this.engine.terrain.heightAt(this.state.x);
      const altitude = Math.max(0, groundY - this.state.y);

      // Slow-motion beat before a safe touchdown
      const nearSafeTouchdown = altitude < 2.0 && altitude > 0.05 &&
        this.state.vy > 0 &&
        Math.abs(this.state.vy) <= this.engine.physics.safeVerticalSpeed * 1.15;
      const timeScale = nearSafeTouchdown && !this.reducedMotion ? 0.45 : 1.0;
      this.accumulator += Math.min(dtSeconds * timeScale, CONSTANTS.PHYSICS.MAX_ACCUMULATOR);
      const dt = CONSTANTS.PHYSICS.TIMESTEP;

      thrust = this.cursors.up.isDown ||
        this.keySpace.isDown ||
        this.keysWASD?.W?.isDown ||
        this.touchThrust ||
        (this.input.activePointer.isDown && this.input.activePointer.y < this.controlStripTop);

      if (this.cursors.left.isDown || this.keysWASD?.A?.isDown || this.touchSteer === -1) steer = -1;
      if (this.cursors.right.isDown || this.keysWASD?.D?.isDown || this.touchSteer === 1) steer = 1;
      if (steer !== 0 && steer !== this.lastSteer && this.state.fuel > 0) SoundFX.playRCS();
      this.lastSteer = steer;

      // Fixed 60 Hz physics, untouched (solver + tests rely on it)
      while (this.accumulator >= dt) {
        this.prevState = { ...this.state };
        this.state = this.engine.step(this.state, thrust, steer);
        this.accumulator -= dt;
        if (this.state.landed || this.state.crashed) break;
      }

      SoundFX.setThruster(this.state.thrusting);

      // Interpolate between the last two physics steps for smooth motion at any refresh rate
      const alpha = this.state.landed || this.state.crashed ? 1 : this.accumulator / dt;
      rx = Phaser.Math.Linear(this.prevState.x, this.state.x, alpha) * ppm;
      ry = Phaser.Math.Linear(this.prevState.y, this.state.y, alpha) * ppm;

      this.hudGauges.updateFuel(this.state.fuel, this.config.fuel);
      this.hudGauges.updateVelocity(this.state.vx, this.state.vy, this.engine.physics.safeHorizontalSpeed, this.engine.physics.safeVerticalSpeed);
      this.hudGauges.updateAltitude(altitude);

      if (this.state.landed) this.onLandingSuccess();
      else if (this.state.crashed) this.onLandingCrash();
    }

    const firing = active && this.state.thrusting;
    const steering = active ? this.state.steering : 0;

    // Smoothed presentation: attitude eases toward the steer direction (+ a little lean
    // from drift); the engine plume spools up fast and tails off when released.
    const targetTilt = this.state.landed || this.state.crashed
      ? 0
      : Phaser.Math.Clamp(steering * MAX_TILT + this.state.vx * VX_LEAN, -MAX_TILT, MAX_TILT);
    const tiltRate = this.reducedMotion ? 30 : 7;
    this.attitude += (targetTilt - this.attitude) * (1 - Math.exp(-tiltRate * dtSeconds));
    const thrustRate = firing ? 22 : 8;
    this.thrustLevel += ((firing ? 1 : 0) - this.thrustLevel) * (1 - Math.exp(-thrustRate * dtSeconds));
    this.steerLevel += (steering - this.steerLevel) * (1 - Math.exp(-14 * dtSeconds));

    this.emitParticles(rx, ry, dtSeconds, steering);
    this.updateParticles(dtSeconds);
    if (!this.state.crashed) this.renderRobot(rx, ry);
    this.updateCamera(rx, ry, dtSeconds);
  }

  private updateCamera(rx: number, ry: number, dt: number, snap: boolean = false): void {
    const cam = this.cameras.main;
    const ppm = CONSTANTS.CANVAS.PIXELS_PER_METER;
    const groundPx = this.engine.terrain.heightAt(Phaser.Math.Clamp(rx / ppm, 0, 40)) * ppm;
    const padY = this.config.platform.y * ppm;
    const floor = Math.max(groundPx, padY);
    // Frame the robot and the surface beneath it; zoom in as the gap closes
    const span = Math.max(0, floor - ry) + 120;
    const targetZoom = Phaser.Math.Clamp(CONSTANTS.CANVAS.HEIGHT / span, CAM_ZOOM_MIN, CAM_ZOOM_MAX);
    const lookX = rx + Phaser.Math.Clamp(this.state.vx * 8, -36, 36);
    const lookY = (ry + floor) / 2 + 10;

    const k = snap || this.reducedMotion ? 1 : 1 - Math.exp(-2.6 * dt);
    const kz = snap || this.reducedMotion ? 1 : 1 - Math.exp(-1.4 * dt);
    cam.setZoom(cam.zoom + (targetZoom - cam.zoom) * kz);
    const cx = cam.midPoint.x;
    const cy = cam.midPoint.y;
    cam.centerOn(snap ? lookX : cx + (lookX - cx) * k, snap ? lookY : cy + (lookY - cy) * k);
  }

  /** World position of a point given in the robot sprite's local (unscaled) pixels. */
  private robotLocal(cx: number, cy: number, lx: number, ly: number): { x: number; y: number } {
    const c = Math.cos(this.attitude);
    const s = Math.sin(this.attitude);
    const x = lx * ROBOT_SCALE;
    const y = ly * ROBOT_SCALE;
    return { x: cx + x * c - y * s, y: cy + x * s + y * c };
  }

  private robotCenter(fx: number, fy: number): { x: number; y: number } {
    // Physics point = wheels; rotate about the body centre so tilting looks natural
    const d = ROBOT_FEET_FROM_CENTER * ROBOT_SCALE;
    return { x: fx + Math.sin(this.attitude) * d, y: fy - Math.cos(this.attitude) * d };
  }

  private renderRobot(fx: number, fy: number): void {
    const ppm = CONSTANTS.CANVAS.PIXELS_PER_METER;
    const center = this.robotCenter(fx, fy);
    this.robotSprite.setPosition(center.x, center.y).setRotation(this.attitude);

    // Contact shadow: tighter and darker as the robot nears the ground
    const groundPx = this.engine.terrain.heightAt(Phaser.Math.Clamp(fx / ppm, 0, 40)) * ppm;
    const alt = Math.max(0, groundPx - fy);
    const near = Phaser.Math.Clamp(1 - alt / 140, 0, 1);
    this.robotShadow.setPosition(fx, groundPx + 1).setSize(10 + 18 * near, 3 + near).setAlpha(0.15 + 0.45 * near);

    // Twin jet plumes along the robot's tilted "down" axis
    this.thrusterFlame.clear();
    const lvl = this.thrustLevel;
    if (lvl < 0.04 || this.state.crashed) {
      this.thrusterGlow.setVisible(false);
      return;
    }
    const dirX = -Math.sin(this.attitude);
    const dirY = Math.cos(this.attitude);
    const perpX = Math.cos(this.attitude);
    const perpY = Math.sin(this.attitude);
    const flicker = this.reducedMotion ? 0.5 : Math.random();

    for (const n of NOZZLES_LOCAL) {
      const p = this.robotLocal(center.x, center.y, n.x, n.y);
      const len = lvl * (9 + flicker * 5) * ROBOT_SCALE;
      const half = (1.2 + lvl * 1.1) * ROBOT_SCALE;
      this.thrusterFlame.fillStyle(PALETTE.thrusterOrangeHex, 0.9 * lvl);
      this.thrusterFlame.fillTriangle(p.x - perpX * half, p.y - perpY * half, p.x + perpX * half, p.y + perpY * half, p.x + dirX * len, p.y + dirY * len);
      this.thrusterFlame.fillStyle(PALETTE.beaconGoldHex, 0.95 * lvl);
      this.thrusterFlame.fillTriangle(p.x - perpX * half * 0.55, p.y - perpY * half * 0.55, p.x + perpX * half * 0.55, p.y + perpY * half * 0.55, p.x + dirX * len * 0.55, p.y + dirY * len * 0.55);
      this.thrusterFlame.fillStyle(PALETTE.lunarHighlightHex, lvl);
      this.thrusterFlame.fillRect(Math.round(p.x - 0.5), Math.round(p.y), 1, 1);
    }

    const mid = this.robotLocal(center.x, center.y, 0, 10);
    this.thrusterGlow.setVisible(true)
      .setPosition(mid.x + dirX * 4, mid.y + dirY * 4)
      .setScale(0.6 + lvl * 0.45)
      .setAlpha(lvl * (0.55 + flicker * 0.15));
  }

  private emitParticles(rx: number, ry: number, dt: number, steering: number): void {
    if (this.reducedMotion || this.state.crashed) return;
    const ppm = CONSTANTS.CANVAS.PIXELS_PER_METER;
    const center = this.robotCenter(rx, ry);
    const dirX = -Math.sin(this.attitude);
    const dirY = Math.cos(this.attitude);
    const perpX = Math.cos(this.attitude);
    const perpY = Math.sin(this.attitude);
    // Exhaust inherits the robot's own velocity, so the plume trails naturally
    const baseVx = this.state.landed ? 0 : this.state.vx * ppm;
    const baseVy = this.state.landed ? 0 : this.state.vy * ppm;

    // Main engine exhaust (rate follows the smoothed throttle, so it tails off)
    this.exhaustBudget += dt * 110 * this.thrustLevel;
    while (this.exhaustBudget >= 1) {
      this.exhaustBudget -= 1;
      const n = NOZZLES_LOCAL[Math.random() < 0.5 ? 0 : 1];
      const p = this.robotLocal(center.x, center.y, n.x, n.y);
      const speed = 70 + Math.random() * 60;
      const spread = (Math.random() * 2 - 1) * 16;
      const r = Math.random();
      this.particles.push({
        x: p.x + dirX * 3,
        y: p.y + dirY * 3,
        vx: baseVx + dirX * speed + perpX * spread,
        vy: baseVy + dirY * speed + perpY * spread,
        drag: 2.2,
        life: 0.32,
        maxLife: 0.32,
        color: r > 0.55 ? PALETTE.thrusterOrangeHex : r > 0.2 ? PALETTE.beaconGoldHex : PALETTE.lunarHighlightHex,
        cool: PALETTE.emberShadowHex,
        size: Math.random() > 0.6 ? 2 : 1,
      });
    }

    // RCS side puffs from the opposite flank while steering
    if (steering !== 0) {
      this.rcsBudget += dt * 45;
      while (this.rcsBudget >= 1) {
        this.rcsBudget -= 1;
        const p = this.robotLocal(center.x, center.y, -steering * 10, -2);
        const sp = 40 + Math.random() * 30;
        this.particles.push({
          x: p.x,
          y: p.y,
          vx: baseVx - steering * perpX * sp + (Math.random() - 0.5) * 10,
          vy: baseVy - steering * perpY * sp + (Math.random() - 0.5) * 10,
          drag: 5,
          life: 0.2,
          maxLife: 0.2,
          color: PALETTE.lunarHighlightHex,
          size: 1,
        });
      }
    } else {
      this.rcsBudget = 0;
    }

    // Regolith kicked up where the plume hits the ground
    const groundPx = this.engine.terrain.heightAt(Phaser.Math.Clamp(rx / ppm, 0, 40)) * ppm;
    const alt = groundPx - ry;
    if (this.thrustLevel > 0.2 && alt < 64 && alt >= 0) {
      const strength = this.thrustLevel * (1 - alt / 64);
      this.dustBudget += dt * 90 * strength;
      const dustColor = this.config.world === 'moon' ? PALETTE.lunarRegolithMidHex : PALETTE.marsDustTanHex;
      const impactX = rx + dirX * alt;
      while (this.dustBudget >= 1) {
        this.dustBudget -= 1;
        const side = Math.random() > 0.5 ? 1 : -1;
        const px = impactX + side * Math.random() * 6;
        const gy = this.engine.terrain.heightAt(Phaser.Math.Clamp(px / ppm, 0, 40)) * ppm;
        this.particles.push({
          x: px,
          y: gy - 1,
          vx: side * (35 + Math.random() * 55),
          vy: -(4 + Math.random() * 16),
          drag: 1.6,
          life: 0.55,
          maxLife: 0.55,
          color: dustColor,
          size: Math.random() > 0.5 ? 2 : 1,
        });
      }
    }
  }

  private updateParticles(dt: number): void {
    this.particleGraphics.clear();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      const damp = Math.exp(-p.drag * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = p.life / p.maxLife;
      const color = p.cool !== undefined && t < 0.4 ? p.cool : p.color;
      this.particleGraphics.fillStyle(color, Math.min(1, t * 1.3));
      this.particleGraphics.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }

  // ---------------------------------------------------------------------------
  // Outcomes
  // ---------------------------------------------------------------------------

  private onLandingSuccess(): void {
    if (this.outcomeHandled) return;
    this.outcomeHandled = true;
    SoundFX.setThruster(false);
    SoundFX.playTouchdown();

    if (!this.reducedMotion) {
      this.cameras.main.shake(160, 0.004);
    }

    completeMinigame(this, this.siteId, this.assisted, this.state.fuel, this.state.vy, 900);
  }

  private onLandingCrash(): void {
    if (this.outcomeHandled) return;
    this.outcomeHandled = true;
    SoundFX.setThruster(false);
    SoundFX.playCrash();

    if (!this.reducedMotion) {
      this.cameras.main.shake(400, 0.018);
      const ppm = CONSTANTS.CANVAS.PIXELS_PER_METER;
      const rx = this.state.x * ppm;
      const ry = this.state.y * ppm - 8;
      for (let i = 0; i < 34; i++) {
        const angle = Math.PI + Math.random() * Math.PI; // upward hemisphere
        const speed = 35 + Math.random() * 75;
        const r = Math.random();
        this.particles.push({
          x: rx,
          y: ry,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          drag: 1.4,
          life: 0.8,
          maxLife: 0.8,
          color: r > 0.5 ? PALETTE.thrusterOrangeHex : r > 0.25 ? PALETTE.beaconGoldHex : PALETTE.lunarDustLightHex,
          cool: PALETTE.emberShadowHex,
          size: Math.random() > 0.4 ? 2 : 1,
        });
      }
    }

    this.robotSprite.setVisible(false);
    this.robotShadow.setVisible(false);
    this.thrusterFlame.clear();
    this.thrusterGlow.setVisible(false);

    failMinigame(this, this.siteId, 1000);
  }
}
