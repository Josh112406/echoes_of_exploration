import Phaser from 'phaser';
import { CONSTANTS } from '../core/Constants.ts';
import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { PixelArtGenerator } from '../systems/PixelArtGenerator.ts';
import { buildCraterCanvas, buildRockCanvas, hash } from '../systems/SpriteArt.ts';
import {
  MOON_WORLD_COORDS,
  MARS_WORLD_COORDS,
  ELSEWHERE_WORLD_COORDS,
  WorldArtifactCoord,
} from '../data/entries.ts';
import { getMinigameMetaForSite } from '../data/minigames.ts';
import { WorldId } from '../data/schema.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { Soundscape } from '../audio/Soundscape.ts';
import { PostProcessing } from '../systems/PostProcessing.ts';
import { PALETTE } from '../ui/theme.ts';
import { NineSliceHUD, HUD_FONT, FrameVariant } from '../ui/NineSliceHUD.ts';
import { Unit7Voice } from '../ui/Unit7Voice.ts';
import { StoryDirector } from '../systems/StoryDirector.ts';

interface ArtifactMarker {
  id: string;
  coord: WorldArtifactCoord;
  sprite: Phaser.GameObjects.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Container;
  labelPlate: Phaser.GameObjects.Graphics;
  labelText: Phaser.GameObjects.Text;
  glowDisk: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Graphics;
  beacon: Phaser.GameObjects.Rectangle;
  beaconGlow: Phaser.GameObjects.Image;
  labelAlpha: number;
}

interface Mote {
  x: number;
  y: number;
  depth: number;
  phase: number;
}

interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

/** Robot sprite: ground line sits on row 21 of the 24px frame. */
const ROBOT_ORIGIN_Y = 21 / 24;
/** Machine sprites: ground line sits on row 27 of the 32px frame. */
const MACHINE_ORIGIN_Y = 27 / 32;
/** World camera zoom (HUD stays at native res on its own camera). */
const WORLD_ZOOM = 1.5;
/** World-space text/plates are drawn at half scale so they stay 1:1 on screen. */
const WORLD_TEXT_SCALE = 1 / WORLD_ZOOM;

export class SiteScene extends Phaser.Scene {
  private readonly worldWidth: number = 2400;
  private readonly worldHeight: number = 1600;

  private robot!: Phaser.GameObjects.Sprite;
  private robotShadow!: Phaser.GameObjects.Ellipse;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keysWASD!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private keyE!: Phaser.Input.Keyboard.Key;

  private markers: ArtifactMarker[] = [];
  private activeTargetId: string | null = null;
  private nearestMarker: ArtifactMarker | null = null;
  private nearestDist: number = Infinity;
  private returnedFromSiteId: string | null = null;

  private promptText!: Phaser.GameObjects.Text;
  private promptBg!: Phaser.GameObjects.Graphics;
  private tutorialContainer!: Phaser.GameObjects.Container;

  private vx: number = 0;
  private vy: number = 0;
  private pingTimer: number = 0;
  private tutorialTimer: number = 0;

  // Robot tracks
  private tracks: { x: number; y: number; angle: number; alpha: number }[] = [];
  private trackGraphics!: Phaser.GameObjects.Graphics;
  private lastTrackX: number = 0;
  private lastTrackY: number = 0;

  // Radar Pulse Graphics near sites
  private radarPulseRadius: number = 0;
  private radarPulseGraphics!: Phaser.GameObjects.Graphics;

  // 90-Second Exploration Trivia Toast
  // UNIT-7 voice & story pacing
  private voice!: Unit7Voice;
  private story!: StoryDirector;
  private keyQ!: Phaser.Input.Keyboard.Key;

  // HUD
  private hudCompassArrow!: Phaser.GameObjects.Sprite;
  private hudTargetText!: Phaser.GameObjects.Text;
  private hudCompassBox!: Phaser.GameObjects.Graphics;
  private hudCompassLast: string = '';

  // Ambience
  private motes: Mote[] = [];
  private moteGraphics!: Phaser.GameObjects.Graphics;
  private puffs: Puff[] = [];
  private puffGraphics!: Phaser.GameObjects.Graphics;
  private puffBudget: number = 0;
  private visorGlow!: Phaser.GameObjects.Image;
  private ringPhase: number = 0;
  private facing: 1 | -1 = 1;
  private hudProgressText!: Phaser.GameObjects.Text;

  constructor() {
    super('SiteScene');
  }

  init(data?: { siteId?: string }): void {
    this.returnedFromSiteId = data?.siteId ?? null;
  }

  create(): void {
    document.body.classList.add('in-game');
    const world = GameState.getWorld();
    // Each world has its own exploration music and its own air (or lack of it)
    const music = world === 'moon' ? 'explore_moon' : world === 'mars' ? 'explore_mars' : 'transition';
    const ambience = world === 'elsewhere' ? 'space' : world;
    Soundscape.set({ music, ambience, ambienceLevel: 1 });
    this.markers = [];
    this.vx = 0;
    this.vy = 0;

    // World bounds for physics
    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);

    // Tilemap pattern (hardware-accelerated seamless tileSprite)
    const tileKey = world === 'moon' ? 'tile_moon' : world === 'mars' ? 'tile_mars' : 'tile_elsewhere';
    this.add.tileSprite(0, 0, this.worldWidth, this.worldHeight, tileKey)
      .setOrigin(0, 0)
      .setDepth(0);

    // Scatter craters, geologic rocks, or deep-space debris across the sector
    this.createGeologicFeatures(world);

    // Place all artifacts for current world
    const coords =
      world === 'moon'
        ? MOON_WORLD_COORDS
        : world === 'mars'
          ? MARS_WORLD_COORDS
          : ELSEWHERE_WORLD_COORDS;
    for (const item of coords) {
      this.createArtifactMarker(item, world);
    }

    // Determine robot spawn point: restore saved x/y per world, or keep at recovered site
    this.activeTargetId = GameState.getNextTarget(world);
    const savedPos = GameState.getRobotPosition(world);
    let spawnX: number;
    let spawnY: number;

    if (savedPos && typeof savedPos.x === 'number' && typeof savedPos.y === 'number') {
      spawnX = Phaser.Math.Clamp(savedPos.x, 40, this.worldWidth - 40);
      spawnY = Phaser.Math.Clamp(savedPos.y, 40, this.worldHeight - 40);
    } else if (this.returnedFromSiteId) {
      const recoveredCoord = coords.find(c => c.id === this.returnedFromSiteId);
      if (recoveredCoord) {
        spawnX = Phaser.Math.Clamp(recoveredCoord.x - 30, 40, this.worldWidth - 40);
        spawnY = Phaser.Math.Clamp(recoveredCoord.y + 20, 40, this.worldHeight - 40);
        GameState.setRobotPosition(world, { x: spawnX, y: spawnY });
      } else {
        const targetCoord = coords.find(c => c.id === this.activeTargetId) || coords[0];
        spawnX = Phaser.Math.Clamp(targetCoord.x - 60, 40, this.worldWidth - 40);
        spawnY = Phaser.Math.Clamp(targetCoord.y + 40, 40, this.worldHeight - 40);
        GameState.setRobotPosition(world, { x: spawnX, y: spawnY });
      }
    } else {
      const targetCoord = coords.find(c => c.id === this.activeTargetId) || coords[0];
      spawnX = Phaser.Math.Clamp(targetCoord.x - 60, 40, this.worldWidth - 40);
      spawnY = Phaser.Math.Clamp(targetCoord.y + 40, 40, this.worldHeight - 40);
      GameState.setRobotPosition(world, { x: spawnX, y: spawnY });
    }

    // Graphics for robot tracks and expanding site radar pulse
    this.trackGraphics = this.add.graphics().setDepth(2);
    this.radarPulseGraphics = this.add.graphics().setDepth(5);
    this.tracks = [];
    this.lastTrackX = spawnX;
    this.lastTrackY = spawnY;

    // Robot Contact Shadow (depth 3 on ground)
    const shadowColor = world === 'mars' ? PALETTE.marsShadowUmberHex : PALETTE.deepIndigoHex;
    this.robotShadow = this.add.ellipse(spawnX + 1, spawnY, 20, 6, shadowColor, 0.6).setDepth(3);
    this.puffGraphics = this.add.graphics().setDepth(4);
    this.puffs = [];
    this.hudCompassLast = '';

    // Robot Explorer (Y-sorted standing sprite: depth 10 + y, feet at its position)
    const driveKey = this.textures.exists('robot_drive') ? 'robot_drive' : 'robot_idle';
    this.robot = this.add.sprite(spawnX, spawnY, driveKey, 0)
      .setOrigin(0.5, ROBOT_ORIGIN_Y)
      .setDepth(10 + Math.floor(spawnY));
    this.visorGlow = this.add.image(spawnX, spawnY - 12, 'glow_disk')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.32)
      .setAlpha(0.35);

    // Camera follow with lerp
    const reducedMotion = GameState.getState().settings.reducedMotion;
    const lerp = reducedMotion ? 1.0 : 0.12;
    this.cameras.main.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.cameras.main.setZoom(WORLD_ZOOM);
    this.cameras.main.startFollow(this.robot, true, lerp, lerp);

    // Proximity prompt graphics & text (world space)
    this.promptBg = this.add.graphics().setDepth(30).setVisible(false).setScale(WORLD_TEXT_SCALE);
    this.promptText = this.add.text(0, 0, '', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarHighlight,
      letterSpacing: 1,
      align: 'center',
    }).setOrigin(0.5).setDepth(31).setVisible(false).setScale(WORLD_TEXT_SCALE);

    // Screen HUD (scrollFactor: 0)
    this.createHUD(world);

    // Full-screen Vignette Pass + soft edges that melt into the letterbox
    new PostProcessing(this).createVignette(CONSTANTS.CANVAS.WIDTH, CONSTANTS.CANVAS.HEIGHT, 95);
    this.createEdgeFade();
    this.createMotes();

    // First-time tutorial toast
    this.createTutorialToast();


    // UNIT-7's voice: thoughts, echo calls, sourced facts, journal callbacks
    this.voice = new Unit7Voice(this);
    this.story = new StoryDirector(this.voice);

    this.splitCameras();

    // Inputs: Cursors + WASD + E + Space
    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keysWASD = this.input.keyboard!.addKeys('W,A,S,D') as any;
    this.keyE = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.keyQ = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.input.keyboard?.on('keydown-SPACE', () => {
      if (!this.isUiBlocked()) this.voice.advance();
    });
    this.keyQ.on('down', () => {
      if (this.isUiBlocked()) return;
      this.tutorialContainer.setVisible(false);
      if (!this.voice.advance()) this.story.requestThought(world);
    });

    // After closing the entry reader for a site just recovered, UNIT-7 reflects on it
    const onEntryClosed = (id: string) => {
      if (id && id === this.returnedFromSiteId) this.story.queueAfterthought(id);
    };
    EventBus.on(EVENTS.ENTRY_CLOSED, onEntryClosed);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off(EVENTS.ENTRY_CLOSED, onEntryClosed));

    // Pointer steer & touch interact
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Ignore HUD touches
      if (pointer.y <= 36) return;

      if (this.nearestMarker && this.nearestDist <= 56) {
        this.interact(this.nearestMarker.id);
      }
    });

    // Refresh markers on entry unlock (cleaned up on scene shutdown)
    const onEntryUnlocked = () => {
      this.refreshMarkerStates();
    };
    EventBus.on(EVENTS.ENTRY_UNLOCKED, onEntryUnlocked);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      SoundFX.setRover(0);
      EventBus.off(EVENTS.ENTRY_UNLOCKED, onEntryUnlocked);
      if (this.robot) {
        GameState.setRobotPosition(world, { x: this.robot.x, y: this.robot.y });
      }
    });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => {
      EventBus.off(EVENTS.ENTRY_UNLOCKED, onEntryUnlocked);
      if (this.robot) {
        GameState.setRobotPosition(world, { x: this.robot.x, y: this.robot.y });
      }
    });
  }

  private createGeologicFeatures(world: WorldId): void {
    const coords =
      world === 'moon'
        ? MOON_WORLD_COORDS
        : world === 'mars'
          ? MARS_WORLD_COORDS
          : ELSEWHERE_WORLD_COORDS;
    const clearOf = (x: number, y: number, r: number) =>
      coords.every((c) => Math.hypot(c.x - x, c.y - y) > r + 46);
    const seed = world === 'moon' ? 11 : world === 'mars' ? 29 : 47;

    if (world === 'elsewhere') {
      // Deep space sector: distant orbital waypoints, solar-wind streaks, and tumbling minor boulders
      const deco = this.add.graphics().setDepth(1);
      for (let i = 0; i < 65; i++) {
        const cx = Math.floor(hash(i, 1, seed) * this.worldWidth);
        const cy = Math.floor(hash(i, 2, seed) * this.worldHeight);
        if (!clearOf(cx, cy, 32)) continue;
        const r = 6 + (i % 5) * 4;
        deco.lineStyle(1, i % 3 === 0 ? PALETTE.cyanDeepHex : PALETTE.shadowNavyHex, 0.35);
        deco.strokeCircle(cx, cy, r);
        deco.fillStyle(PALETTE.cyanLaserHex, 0.5).fillRect(cx + r, cy, 1, 1);
      }
      const rockKeys: string[] = [];
      for (let v = 0; v < 8; v++) {
        const size = 5 + Math.floor(hash(v, 7, seed) * 10);
        const key = `rock_${world}_${v}`;
        if (!this.textures.exists(key)) this.textures.addCanvas(key, buildRockCanvas(size, world, seed * 31 + v));
        rockKeys.push(key);
      }
      for (let i = 0; i < 110; i++) {
        const x = Math.floor(hash(i, 8, seed) * this.worldWidth);
        const y = Math.floor(hash(i, 9, seed) * this.worldHeight);
        if (!clearOf(x, y, 22)) continue;
        const key = rockKeys[Math.floor(hash(i, 10, seed) * rockKeys.length)];
        this.add.image(x, y, key).setDepth(10 + y).setAlpha(0.8);
      }
      return;
    }

    // 1. Impact craters: pre-painted dithered bowls in a handful of sizes
    const craterSizes = world === 'moon' ? [9, 12, 16, 22, 30, 44, 64] : [8, 11, 15, 20, 28, 40];
    const craterKeys = craterSizes.map((r, i) => {
      const key = `crater_${world}_${r}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, buildCraterCanvas(r, world, seed + i));
      return key;
    });
    const craterCount = world === 'moon' ? 260 : 150;
    for (let i = 0; i < craterCount; i++) {
      const x = Math.floor(hash(i, 1, seed) * this.worldWidth);
      const y = Math.floor(hash(i, 2, seed) * this.worldHeight);
      // Mostly small craters, few large ones
      const pick = Math.min(craterKeys.length - 1, Math.floor(Math.pow(hash(i, 3, seed), 2.4) * craterKeys.length));
      if (!clearOf(x, y, craterSizes[pick])) continue;
      this.add.image(x, y, craterKeys[pick]).setDepth(1).setFlipX(hash(i, 4, seed) > 0.5);
    }

    // 2. Mars: wind-swept ripple fields
    if (world === 'mars') {
      const ripples = this.add.graphics().setDepth(1);
      for (let f = 0; f < 22; f++) {
        const fx = hash(f, 5, seed) * this.worldWidth;
        const fy = hash(f, 6, seed) * this.worldHeight;
        if (!clearOf(fx, fy, 50)) continue;
        for (let k = 0; k < 7; k++) {
          const len = 26 + hash(f, k, seed) * 40;
          const x0 = fx + (hash(k, f, seed) - 0.5) * 30;
          const y0 = fy + k * 6;
          for (let t = 0; t < len; t += 1) {
            const xx = Math.round(x0 + t);
            const yy = Math.round(y0 - Math.sin((t / len) * Math.PI) * 3);
            ripples.fillStyle(PALETTE.marsDeepRustHex, 0.55).fillRect(xx, yy + 1, 1, 1);
            ripples.fillStyle(PALETTE.marsTerracottaHex, 0.5).fillRect(xx, yy, 1, 1);
          }
        }
      }
    }

    // 3. Boulders: shaded, outlined, Y-sorted with baked contact shadows
    const rockKeys: string[] = [];
    for (let v = 0; v < 10; v++) {
      const size = 4 + Math.floor(hash(v, 7, seed) * (v < 6 ? 5 : 12));
      const key = `rock_${world}_${v}`;
      if (!this.textures.exists(key)) this.textures.addCanvas(key, buildRockCanvas(size, world, seed * 31 + v));
      rockKeys.push(key);
    }
    const rockCount = world === 'moon' ? 420 : 640;
    for (let i = 0; i < rockCount; i++) {
      const x = Math.floor(hash(i, 8, seed) * this.worldWidth);
      const y = Math.floor(hash(i, 9, seed) * this.worldHeight);
      if (!clearOf(x, y, 4)) continue;
      const key = rockKeys[Math.floor(hash(i, 10, seed) * rockKeys.length)];
      const tex = this.textures.get(key).getSourceImage() as HTMLCanvasElement;
      this.add.image(x, y, key)
        .setOrigin(0.5, (tex.height - 3) / tex.height)
        .setFlipX(hash(i, 11, seed) > 0.5)
        .setDepth(10 + y);
    }
  }

  /**
   * HUD on its own camera: never zoomed, and always drawn above the Y-sorted world
   * (world depths grow with y and would otherwise cover the HUD).
   */
  private splitCameras(): void {
    const W = CONSTANTS.CANVAS.WIDTH;
    const H = CONSTANTS.CANVAS.HEIGHT;
    const uiCam = this.cameras.add(0, 0, W, H, false, 'site-ui');
    const ui: Phaser.GameObjects.GameObject[] = [];
    const world: Phaser.GameObjects.GameObject[] = [];
    for (const obj of this.children.list) {
      const sf = (obj as Phaser.GameObjects.GameObject & Partial<Phaser.GameObjects.Components.ScrollFactor>).scrollFactorX;
      (sf === 0 ? ui : world).push(obj);
    }
    this.cameras.main.ignore(ui);
    uiCam.ignore(world);
  }

  private createEdgeFade(): void {
    const W = CONSTANTS.CANVAS.WIDTH;
    const H = CONSTANTS.CANVAS.HEIGHT;
    const k = PALETTE.spaceBlackHex;
    const g = this.add.graphics().setScrollFactor(0).setDepth(96);
    const side = 28;
    const tb = 18;
    g.fillGradientStyle(k, k, k, k, 1, 0, 1, 0).fillRect(0, 0, side, H);
    g.fillGradientStyle(k, k, k, k, 0, 1, 0, 1).fillRect(W - side, 0, side, H);
    g.fillGradientStyle(k, k, k, k, 0.9, 0.9, 0, 0).fillRect(0, 0, W, tb);
    g.fillGradientStyle(k, k, k, k, 0, 0, 0.9, 0.9).fillRect(0, H - tb, W, tb);
  }

  private createMotes(): void {
    this.motes = [];
    for (let i = 0; i < 26; i++) {
      this.motes.push({
        x: hash(i, 1, 77) * CONSTANTS.CANVAS.WIDTH,
        y: hash(i, 2, 77) * CONSTANTS.CANVAS.HEIGHT,
        depth: 0.25 + hash(i, 3, 77) * 0.5,
        phase: hash(i, 4, 77) * Math.PI * 2,
      });
    }
    this.moteGraphics = this.add.graphics().setScrollFactor(0).setDepth(94);
  }

  private updateAmbience(dt: number, time: number): void {
    const W = CONSTANTS.CANVAS.WIDTH;
    const H = CONSTANTS.CANVAS.HEIGHT;
    const cam = this.cameras.main;
    const reduced = GameState.getState().settings.reducedMotion;
    const world = GameState.getWorld();
    const isMoon = world === 'moon';
    const col = isMoon
      ? PALETTE.lunarCrustCreamHex
      : world === 'mars'
        ? PALETTE.marsHazePeachHex
        : PALETTE.cyanLaserHex;

    // Floating dust motes drifting slightly faster than the ground (sells depth)
    this.moteGraphics.clear();
    for (const m of this.motes) {
      if (!reduced) {
        m.x += (world === 'mars' ? 6 : 1.5) * m.depth * dt;
        m.y += Math.sin(time / 1400 + m.phase) * 2 * dt;
      }
      const sx = (((m.x - cam.scrollX * (1 + m.depth)) % W) + W) % W;
      const sy = (((m.y - cam.scrollY * (1 + m.depth)) % H) + H) % H;
      const a = 0.2 + 0.25 * (0.5 + 0.5 * Math.sin(time / 900 + m.phase));
      this.moteGraphics.fillStyle(col, a).fillRect(Math.round(sx), Math.round(sy), 1, 1);
    }

    // Dust kicked up by the treads / ion exhaust
    this.puffGraphics.clear();
    const dustCol = isMoon
      ? PALETTE.lunarDustLightHex
      : world === 'mars'
        ? PALETTE.marsDustTanHex
        : PALETTE.cyanGlowHex;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.puffs.splice(i, 1);
        continue;
      }
      p.vx *= Math.exp(-3 * dt);
      p.vy *= Math.exp(-3 * dt);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = p.life / p.maxLife;
      this.puffGraphics.fillStyle(dustCol, t * 0.55).fillRect(Math.round(p.x), Math.round(p.y), t > 0.5 ? 2 : 1, 1);
    }
  }

  private createArtifactMarker(coord: WorldArtifactCoord, world: WorldId): void {
    const hwKey = `hw_${coord.id}`;
    if (!this.textures.exists(hwKey)) {
      this.textures.addCanvas(hwKey, PixelArtGenerator.createHardwareSprite(coord.id, world));
    }

    // Ground ring (beacon footprint) + contact shadow
    const ring = this.add.graphics().setDepth(2);
    const shadowColor = world === 'mars' ? PALETTE.marsShadowUmberHex : PALETTE.deepIndigoHex;
    const shadow = this.add.ellipse(coord.x + 2, coord.y, 34, 8, shadowColor, 0.6).setDepth(3);

    // Soft cyan bloom (only lit for the active echo)
    const glowDisk = this.add.image(coord.x, coord.y - 6, 'glow_disk')
      .setDepth(4)
      .setScale(1.2, 0.8)
      .setBlendMode(Phaser.BlendModes.ADD);

    // Machine (Y-sorted, feet on the ground point)
    const sprite = this.add.sprite(coord.x, coord.y, hwKey)
      .setOrigin(0.5, MACHINE_ORIGIN_Y)
      .setDepth(10 + Math.floor(coord.y));

    // Blinking echo beacon above the machine
    const beacon = this.add.rectangle(coord.x, coord.y - 31, 1, 1, PALETTE.cyanLaserHex).setDepth(2999);
    const beaconGlow = this.add.image(coord.x, coord.y - 31, 'glow_disk')
      .setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setDepth(2998);
    this.tweens.add({ targets: [beacon, beaconGlow], alpha: 0.15, duration: 600, yoyo: true, repeat: -1, ease: 'Stepped' });

    // Name plate (shown when nearby)
    const label = this.add.container(coord.x, coord.y + 11).setDepth(3000).setAlpha(0).setVisible(false).setScale(WORLD_TEXT_SCALE);
    const labelPlate = this.add.graphics();
    const labelText = this.add.text(0, 0, coord.name.toUpperCase(), {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarHighlight,
      letterSpacing: 1,
    }).setOrigin(0.5);
    label.add([labelPlate, labelText]);

    const marker: ArtifactMarker = {
      id: coord.id, coord, sprite, shadow, label, labelPlate, labelText, glowDisk, ring, beacon, beaconGlow, labelAlpha: 0,
    };
    this.markers.push(marker);
    this.updateMarkerVisual(marker);
  }

  private updateMarkerVisual(m: ArtifactMarker): void {
    const isRecovered = GameState.isEntryRecovered(m.id);
    const isActiveTarget = GameState.getNextTarget(GameState.getWorld()) === m.id;
    const mg = getMinigameMetaForSite(m.id);
    const dot = isRecovered ? PALETTE.amberVerifiedHex : isActiveTarget ? PALETTE.cyanGlowHex : PALETTE.cyanDeepHex;
    const variant: FrameVariant = isRecovered || isActiveTarget ? 'panel' : 'secondary';

    m.labelText.setColor(isRecovered ? PALETTE.beaconGold : isActiveTarget ? PALETTE.cyanLaser : PALETTE.lunarHighlight);
    const status = isRecovered ? 'RECOVERED' : isActiveTarget ? `ECHO · ${mg.code}` : mg.code;
    m.labelText.setText(`${m.coord.name.toUpperCase()} · ${status}`);
    const w = Math.ceil(m.labelText.width) + 20;
    m.labelText.setX(4);
    m.labelPlate.clear();
    NineSliceHUD.drawFrame(m.labelPlate, -w / 2, -7, w, 14, variant);
    NineSliceHUD.drawStatusDot(m.labelPlate, -w / 2 + 5, -1, dot);

    m.glowDisk.setVisible(isActiveTarget).setTint(PALETTE.cyanGlowHex).setAlpha(0.55);
    m.beacon.setVisible(true).setFillStyle(isActiveTarget ? PALETTE.cyanLaserHex : isRecovered ? PALETTE.beaconGoldHex : PALETTE.cyanDeepHex);
    m.beaconGlow.setVisible(isActiveTarget || isRecovered).setTint(isActiveTarget ? PALETTE.cyanGlowHex : PALETTE.beaconGoldHex);
    m.beaconGlow.setScale(isRecovered ? 0.22 : 0.35);

    m.sprite.clearTint().setAlpha(1);

    // Static ground ring for recovered relics (dashed amber); the active ring is animated
    m.ring.clear();
    if (isRecovered) {
      for (let k = 0; k < 24; k += 2) {
        const a = (k / 24) * Math.PI * 2;
        m.ring.fillStyle(PALETTE.beaconGoldHex, 0.55)
          .fillRect(Math.round(m.coord.x + Math.cos(a) * 26), Math.round(m.coord.y - 2 + Math.sin(a) * 10), 2, 1);
      }
    }
  }

  private refreshMarkerStates(): void {
    const world = GameState.getWorld();
    this.activeTargetId = GameState.getNextTarget(world);
    for (const m of this.markers) {
      this.updateMarkerVisual(m);
    }
    this.updateHUDProgress(world);
  }

  private createHUD(world: WorldId): void {
    const W = CONSTANTS.CANVAS.WIDTH;

    // 1. Top-Left Compass Deck (9-slice styled)
    this.hudCompassBox = this.add.graphics().setScrollFactor(0).setDepth(100);
    NineSliceHUD.drawFrame(this.hudCompassBox, 12, 10, 230, 24, 'panel');

    this.hudCompassArrow = this.add.sprite(26, 22, 'radar_arrow')
      .setOrigin(0.5, 0.5)
      .setScale(0.75)
      .setScrollFactor(0).setDepth(101);

    this.hudTargetText = this.add.text(38, 22, 'RADAR: SEARCHING...', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.cyanLaser,
      letterSpacing: 2,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);

    // 2. Top-Right Progress panel + separate MENU button
    const rightBox = this.add.graphics().setScrollFactor(0).setDepth(100);
    NineSliceHUD.drawFrame(rightBox, W - 222, 10, 154, 24, 'panel');
    NineSliceHUD.drawStatusDot(rightBox, W - 213, 21);
    NineSliceHUD.drawFrame(rightBox, W - 62, 10, 50, 24, 'secondary');

    this.hudProgressText = this.add.text(W - 206, 22, '', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarHighlight,
      letterSpacing: 2,
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(101);

    this.updateHUDProgress(world);

    // Menu button
    const menuBtn = this.add.zone(W - 37, 22, 50, 24)
      .setScrollFactor(0).setDepth(102).setInteractive({ cursor: 'pointer' });
    menuBtn.on('pointerdown', () => {
      if (this.robot) {
        GameState.setRobotPosition(world, { x: this.robot.x, y: this.robot.y });
      }
      SoundFX.playClick();
      EventBus.emit(EVENTS.SHOW_TITLE);
    });

    const menuText = this.add.text(W - 37, 22, 'MENU', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarHighlight,
      letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(101);
    menuBtn.on('pointerover', () => menuText.setColor(PALETTE.cyanLaser));
    menuBtn.on('pointerout', () => menuText.setColor(PALETTE.lunarHighlight));
  }

  private setRadarText(text: string): void {
    if (text === this.hudCompassLast) return;
    this.hudCompassLast = text;
    this.hudTargetText.setText(text);
    const w = Math.max(150, Math.ceil(this.hudTargetText.width) + 40);
    this.hudCompassBox.clear();
    NineSliceHUD.drawFrame(this.hudCompassBox, 12, 10, w, 24, 'panel');
  }

  private updateHUDProgress(world: WorldId): void {
    const recovered = GameState.getRecoveredCount(world);
    const total = GameState.getChronoList(world).length;
    const worldName = world === 'moon' ? 'MOON' : world === 'mars' ? 'MARS' : 'DEEP SPACE';
    this.hudProgressText.setText(`${worldName} // ${recovered}/${total} FOUND`);
  }

  private createTutorialToast(): void {
    this.tutorialContainer = this.add.container(CONSTANTS.CANVAS.WIDTH / 2, CONSTANTS.CANVAS.HEIGHT - 24)
      .setScrollFactor(0).setDepth(110);

    const bg = this.add.graphics();
    NineSliceHUD.drawFrame(bg, -160, -10, 320, 20, 'muted');
    this.tutorialContainer.add(bg);

    const t = this.add.text(0, 0, 'WASD / DRAG TO DRIVE · [Q] TALK TO UNIT-7 · FOLLOW THE CYAN ARROW', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarCrustCream,
    }).setOrigin(0.5);
    this.tutorialContainer.add(t);
  }

  // Toroidal delta for seamless spherical wrap distance & angle
  private toroidalDelta(target: number, current: number, max: number): number {
    let delta = target - current;
    if (delta > max / 2) delta -= max;
    if (delta < -max / 2) delta += max;
    return delta;
  }

  update(time: number, delta: number): void {
    const dt = Math.min(delta / 1000, 0.1);
    const cfg = CONSTANTS.ROBOT.TOP_DOWN;

    // Fade tutorial after 7 seconds or on keydown
    if (this.tutorialContainer.visible) {
      this.tutorialTimer += dt;
      if (this.tutorialTimer > 7) {
        this.tutorialContainer.setVisible(false);
      }
    }

    let ix = 0;
    let iy = 0;

    // Keyboard controls: Arrow Keys + WASD
    if (this.cursors.left.isDown || this.keysWASD?.A?.isDown) ix -= 1;
    if (this.cursors.right.isDown || this.keysWASD?.D?.isDown) ix += 1;
    if (this.cursors.up.isDown || this.keysWASD?.W?.isDown) iy -= 1;
    if (this.cursors.down.isDown || this.keysWASD?.S?.isDown) iy += 1;

    // Pointer steering
    if (this.input.activePointer.isDown && this.input.activePointer.y > 36) {
      const worldPoint = this.cameras.main.getWorldPoint(this.input.activePointer.x, this.input.activePointer.y);
      const dx = this.toroidalDelta(worldPoint.x, this.robot.x, this.worldWidth);
      const dy = this.toroidalDelta(worldPoint.y, this.robot.y, this.worldHeight);
      const distToPointer = Math.hypot(dx, dy);

      if (distToPointer > 14) {
        const angle = Math.atan2(dy, dx);
        ix = Math.cos(angle);
        iy = Math.sin(angle);
      }
    }

    if (ix !== 0 || iy !== 0) {
      this.tutorialContainer.setVisible(false);
    }

    // Normalize diagonal
    if (ix !== 0 && iy !== 0) {
      const len = Math.hypot(ix, iy);
      ix /= len;
      iy /= len;
    }

    // Velocity ramp
    if (ix !== 0) {
      this.vx = Phaser.Math.Clamp(this.vx + ix * cfg.ACCEL * dt, -cfg.MAX_SPEED, cfg.MAX_SPEED);
    } else {
      this.vx = Phaser.Math.Linear(this.vx, 0, (cfg.DECEL * dt) / cfg.MAX_SPEED);
    }

    if (iy !== 0) {
      this.vy = Phaser.Math.Clamp(this.vy + iy * cfg.ACCEL * dt, -cfg.MAX_SPEED, cfg.MAX_SPEED);
    } else {
      this.vy = Phaser.Math.Linear(this.vy, 0, (cfg.DECEL * dt) / cfg.MAX_SPEED);
    }

    // Toroidal position update: wrap seamlessly across boundaries
    this.robot.x += this.vx * dt;
    this.robot.y += this.vy * dt;

    if (this.robot.x < 0) this.robot.x = this.worldWidth;
    else if (this.robot.x > this.worldWidth) this.robot.x = 0;

    if (this.robot.y < 0) this.robot.y = this.worldHeight;
    else if (this.robot.y > this.worldHeight) this.robot.y = 0;

    // Update soft contact shadow, Y-sorted depth, facing and drive animation
    this.robotShadow.setPosition(this.robot.x + 1, this.robot.y);
    this.robot.setDepth(10 + Math.floor(this.robot.y));
    const moving = Math.hypot(this.vx, this.vy) > 12;
    SoundFX.setRover(moving ? Phaser.Math.Clamp(Math.hypot(this.vx, this.vy) / cfg.MAX_SPEED, 0.3, 1) : 0);
    if (Math.abs(this.vx) > 8) this.facing = this.vx < 0 ? -1 : 1;
    this.robot.setFlipX(this.facing < 0);
    if (moving && this.anims.exists('robot_drive_anim')) {
      if (!this.robot.anims.isPlaying) this.robot.play('robot_drive_anim');
      this.robot.anims.timeScale = Phaser.Math.Clamp(Math.hypot(this.vx, this.vy) / cfg.MAX_SPEED, 0.4, 1.2);
    } else if (this.robot.anims.isPlaying) {
      this.robot.anims.stop();
      this.robot.setFrame(0);
    }
    this.visorGlow.setPosition(this.robot.x, this.robot.y - 12).setDepth(this.robot.depth + 1);
    if (moving && !GameState.getState().settings.reducedMotion) {
      this.puffBudget += dt * 18;
      while (this.puffBudget >= 1) {
        this.puffBudget -= 1;
        const side = Math.random() > 0.5 ? 1 : -1;
        this.puffs.push({
          x: this.robot.x + side * 5 - Math.sign(this.vx) * 6,
          y: this.robot.y - 1,
          vx: -this.vx * 0.15 + (Math.random() - 0.5) * 8,
          vy: -this.vy * 0.15 - Math.random() * 4,
          life: 0.6,
          maxLife: 0.6,
        });
      }
    }
    this.updateAmbience(dt, time);

    // 1. Robot tracks behind rover (dual tread ruts with displaced dust)
    const speed = Math.hypot(this.vx, this.vy);
    if (speed > 10) {
      const distFromLast = Math.hypot(this.robot.x - this.lastTrackX, this.robot.y - this.lastTrackY);
      if (distFromLast >= 3) {
        this.lastTrackX = this.robot.x;
        this.lastTrackY = this.robot.y;
        const angle = Math.atan2(this.vy, this.vx);
        this.tracks.push({
          x: this.robot.x,
          y: this.robot.y,
          angle,
          alpha: 0.75,
        });
        GameState.setRobotPosition(GameState.getWorld(), { x: this.robot.x, y: this.robot.y });
      }
    }

    // Render & fade tracks (depth 2)
    this.trackGraphics.clear();
    const curWorld = GameState.getWorld();
    const trackColor =
      curWorld === 'moon'
        ? PALETTE.deepIndigoHex
        : curWorld === 'mars'
          ? PALETTE.marsShadowUmberHex
          : PALETTE.cyanDeepHex;
    const rimDustColor =
      curWorld === 'moon'
        ? PALETTE.lunarCrustCreamHex
        : curWorld === 'mars'
          ? PALETTE.marsHazePeachHex
          : PALETTE.cyanLaserHex;
    for (let i = this.tracks.length - 1; i >= 0; i--) {
      const trk = this.tracks[i];
      trk.alpha -= dt * 0.08; // Fades over ~12 seconds
      if (trk.alpha <= 0) {
        this.tracks.splice(i, 1);
        continue;
      }
      this.trackGraphics.fillStyle(trackColor, trk.alpha);
      const cos = Math.cos(trk.angle);
      const sin = Math.sin(trk.angle);
      const nx = -sin * 4.5;
      const ny = cos * 3;
      // Left & right tread ruts
      this.trackGraphics.fillRect(Math.round(trk.x + nx), Math.round(trk.y + ny - 1), 2, 1);
      this.trackGraphics.fillRect(Math.round(trk.x - nx), Math.round(trk.y - ny - 1), 2, 1);
      // Subtle rim dust ridge catching light
      this.trackGraphics.fillStyle(rimDustColor, trk.alpha * 0.35);
      this.trackGraphics.fillRect(Math.round(trk.x + nx), Math.round(trk.y + ny), 1, 1);
      this.trackGraphics.fillRect(Math.round(trk.x - nx), Math.round(trk.y - ny), 1, 1);
    }


    // Radar Tracking to active chronological target
    this.activeTargetId = GameState.getNextTarget(GameState.getWorld());
    const activeMarker = this.markers.find(m => m.id === this.activeTargetId);

    // 3. Radar pulse near sites & Arrow rotation about its exact center
    this.radarPulseGraphics.clear();
    if (activeMarker) {
      const tdx = this.toroidalDelta(activeMarker.coord.x, this.robot.x, this.worldWidth);
      const tdy = this.toroidalDelta(activeMarker.coord.y, this.robot.y, this.worldHeight);
      const targetDist = Math.hypot(tdx, tdy);
      const targetAngle = Math.atan2(tdy, tdx);

      // Radar arrow rotates about its centre towards target
      this.hudCompassArrow.setRotation(targetAngle);
      this.setRadarText(`ECHO: ${activeMarker.coord.name.toUpperCase()} · ${Math.round(targetDist)}M`);

      // Radar pulse wave animation centered on active site
      if (targetDist < 300) {
        this.radarPulseRadius = (this.radarPulseRadius + dt * 48) % 70;
        const waveAlpha = Math.max(0, 1 - (this.radarPulseRadius / 70));
        this.drawGroundRing(activeMarker.coord.x, activeMarker.coord.y - 2, this.radarPulseRadius + 8, waveAlpha * 0.8);
        this.drawGroundRing(activeMarker.coord.x, activeMarker.coord.y - 2, (this.radarPulseRadius + 8) * 0.6, waveAlpha * 0.4);
      }

      // Radar audio ping
      this.pingTimer += dt;
      if (targetDist < 400) {
        const pingInterval = Math.max(0.35, (targetDist / 400) * 1.6);
        if (this.pingTimer >= pingInterval) {
          this.pingTimer = 0;
          SoundFX.playRadarPing(targetDist / 400);
        }
      }
    } else {
      // All recovered in this world
      this.hudCompassArrow.setRotation(0);
      this.setRadarText('ALL ECHOES RECOVERED');
    }

    // Steady footprint ring around the active echo
    if (activeMarker) {
      this.ringPhase += dt;
      this.drawGroundRing(activeMarker.coord.x, activeMarker.coord.y - 2, 26, 0.45 + 0.15 * Math.sin(this.ringPhase * 3), true);
    }

    // Check proximity to any marker
    this.nearestMarker = null;
    this.nearestDist = Infinity;

    for (const m of this.markers) {
      const mdx = this.toroidalDelta(m.coord.x, this.robot.x, this.worldWidth);
      const mdy = this.toroidalDelta(m.coord.y, this.robot.y, this.worldHeight);
      const dist = Math.hypot(mdx, mdy);
      if (dist < this.nearestDist) {
        this.nearestDist = dist;
        this.nearestMarker = m;
      }
    }

    // Name plates fade in when the robot is close (hidden while the prompt shows)
    for (const m of this.markers) {
      const d = Math.hypot(
        this.toroidalDelta(m.coord.x, this.robot.x, this.worldWidth),
        this.toroidalDelta(m.coord.y, this.robot.y, this.worldHeight),
      );
      const showsPrompt = m === this.nearestMarker && d <= 56;
      const target = !showsPrompt && d < 190 && (m === this.nearestMarker || d < 120) ? 1 : 0;
      m.labelAlpha += (target - m.labelAlpha) * (1 - Math.exp(-8 * dt));
      m.label.setAlpha(m.labelAlpha).setVisible(m.labelAlpha > 0.02);
    }

    // UNIT-7 narration
    const distances = new Map<string, number>();
    let activeDist = Infinity;
    for (const m of this.markers) {
      const d = Math.hypot(
        this.toroidalDelta(m.coord.x, this.robot.x, this.worldWidth),
        this.toroidalDelta(m.coord.y, this.robot.y, this.worldHeight),
      );
      distances.set(m.id, d);
      if (m.id === this.activeTargetId) activeDist = d;
    }
    this.story.update(dt, {
      world: GameState.getWorld(),
      moving: Math.hypot(this.vx, this.vy) > 12,
      blocked: this.isUiBlocked(),
      activeId: this.activeTargetId,
      activeDist,
      distances,
    });
    this.voice.update(dt);
    if (this.voice.busy && this.tutorialContainer.visible) this.tutorialContainer.setVisible(false);

    // Display interaction prompt when in range
    if (this.nearestMarker && this.nearestDist <= 56) {
      const isRecovered = GameState.isEntryRecovered(this.nearestMarker.id);
      const mg = getMinigameMetaForSite(this.nearestMarker.id);

      this.promptBg.clear();
      this.promptBg.setVisible(true);
      this.promptText.setVisible(true);

      const px = this.nearestMarker.coord.x;
      const py = this.nearestMarker.coord.y + 12;

      let msg = '';
      let variant: FrameVariant = 'panel';
      const textColor: string = PALETTE.lunarHighlight;

      if (isRecovered) {
        msg = `[E / TAP] REVIEW ARCHIVE LOG // ${this.nearestMarker.coord.name.toUpperCase()}`;
        variant = 'amber';
      } else {
        msg = `[E / TAP] ${mg.promptVerb} // ${this.nearestMarker.coord.name.toUpperCase()}`;
      }

      this.promptText.setDepth(3101);
      this.promptText.setPosition(px, py + 0.5);
      this.promptText.setText(msg);
      this.promptText.setColor(textColor);

      const boxW = Math.max(120, Math.ceil(this.promptText.width) + 16);
      this.promptBg.setDepth(3100);
      this.promptBg.setPosition(px, py);
      NineSliceHUD.drawFrame(this.promptBg, -boxW / 2, -7, boxW, 16, variant);

      if (Phaser.Input.Keyboard.JustDown(this.keyE)) {
        this.interact(this.nearestMarker.id);
      }
    } else {
      this.promptBg.setVisible(false);
      this.promptText.setVisible(false);
    }
  }

  /** Pixel-stepped ellipse ring lying flat on the ground (3/4 view). */
  private drawGroundRing(cx: number, cy: number, r: number, alpha: number, dashed = false): void {
    const g = this.radarPulseGraphics;
    const steps = Math.max(24, Math.round(r * 1.6));
    for (let k = 0; k < steps; k++) {
      if (dashed && k % 4 >= 2) continue;
      const a = (k / steps) * Math.PI * 2;
      const front = Math.sin(a) > 0;
      g.fillStyle(front ? PALETTE.cyanLaserHex : PALETTE.cyanGlowHex, alpha * (front ? 1 : 0.6));
      g.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.42), 2, 1);
    }
  }

  /** A DOM overlay (entry reader, archive, settings…) is covering the game. */
  private isUiBlocked(): boolean {
    return !!document.querySelector(
      '#entry-overlay:not(.hidden), #archive-overlay:not(.hidden), #failure-overlay:not(.hidden), ' +
      '#settings-overlay:not(.hidden), #about-overlay:not(.hidden), #title-overlay:not(.hidden), #hub-overlay:not(.hidden)'
    );
  }

  private interact(siteId: string): void {
    if (this.robot) {
      GameState.setRobotPosition(GameState.getWorld(), { x: this.robot.x, y: this.robot.y });
    }
    SoundFX.playClick();
    const isRecovered = GameState.isEntryRecovered(siteId);

    if (!isRecovered) {
      // Start assigned 60Hz mission minigame (dispatched cleanly by main.ts)
      EventBus.emit(EVENTS.START_LANDING, siteId);
    } else {
      // Direct open Archive reader
      EventBus.emit(EVENTS.OPEN_ENTRY, siteId);
    }
  }
}
