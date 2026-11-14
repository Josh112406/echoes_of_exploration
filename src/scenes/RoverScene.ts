import Phaser from 'phaser';
import { CONSTANTS } from '../core/Constants.ts';
import { ALL_ENTRIES } from '../data/entries.ts';
import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { Soundscape } from '../audio/Soundscape.ts';
import { PALETTE } from '../ui/theme.ts';
import { NineSliceHUD, HUD_FONT } from '../ui/NineSliceHUD.ts';
import { ensureBackdropTextures } from '../systems/BackdropTextures.ts';
import { buildRockCanvas, hash } from '../systems/SpriteArt.ts';
import { PostProcessing } from '../systems/PostProcessing.ts';

interface HazardRock {
  sprite: Phaser.GameObjects.Image;
  x: number;
  laneY: number;
  radius: number;
  hit: boolean;
}

interface CoreSample {
  gfx: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Image;
  x: number;
  laneY: number;
  collected: boolean;
}

const W = CONSTANTS.CANVAS.WIDTH;
const H = CONSTANTS.CANVAS.HEIGHT;
const TRACK_TOP = 166;
const TRACK_BOTTOM = 304;
const TARGET_DIST = 1600;
const REQUIRED_CORES = 3;

export class RoverScene extends Phaser.Scene {
  private siteId = 'apollo-15-lrv';
  private assisted = false;

  private rover!: Phaser.GameObjects.Sprite;
  private roverShadow!: Phaser.GameObjects.Ellipse;
  private groundGfx!: Phaser.GameObjects.Graphics;
  private hudTextLeft!: Phaser.GameObjects.Text;
  private hudTextRight!: Phaser.GameObjects.Text;
  private statusBanner!: Phaser.GameObjects.Text;
  private skyImg!: Phaser.GameObjects.Image;
  private farImg?: Phaser.GameObjects.Image;

  private rocks: HazardRock[] = [];
  private cores: CoreSample[] = [];
  private dustParticles: { x: number; y: number; vx: number; vy: number; life: number }[] = [];
  private dustGfx!: Phaser.GameObjects.Graphics;

  private dist = 0;
  private roverX = 112;
  private roverY = 235;
  private speed = 135;
  private battery = 100;
  private hull = 3;
  private maxHull = 3;
  private coresCollected = 0;
  private invulnTimer = 0;
  private accum = 0;
  private ended = false;
  private jumpOffset = 0;
  private jumpVel = 0;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keysWASD!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private keySpace!: Phaser.Input.Keyboard.Key;
  private touchDir: -1 | 0 | 1 = 0;
  private touchJump = false;
  private reducedMotion = false;

  constructor() {
    super('RoverScene');
  }

  init(data: { siteId: string; assisted?: boolean }): void {
    this.siteId = data.siteId;
    this.assisted = !!data.assisted;
  }

  create(): void {
    document.body.classList.add('in-game');
    const entry = ALL_ENTRIES[this.siteId];
    const world = entry?.world ?? 'moon';
    const bdKind = world === 'elsewhere' ? 'space' : world;
    this.reducedMotion = GameState.getState().settings.reducedMotion;

    Soundscape.set({ music: 'landing', ambience: bdKind, ambienceLevel: 0.55, fade: 1.4 });
    ensureBackdropTextures(this.textures, bdKind);

    this.dist = 0;
    this.roverY = 235;
    this.speed = 135;
    this.battery = 100;
    this.maxHull = this.assisted ? 5 : 3;
    this.hull = this.maxHull;
    this.coresCollected = 0;
    this.invulnTimer = 0;
    this.accum = 0;
    this.ended = false;
    this.jumpOffset = 0;
    this.jumpVel = 0;
    this.rocks = [];
    this.cores = [];
    this.dustParticles = [];
    this.touchDir = 0;
    this.touchJump = false;

    this.cameras.main.setBackgroundColor(PALETTE.spaceBlack);
    this.skyImg = this.add.image(-32, -16, `cin_${bdKind}_sky`).setOrigin(0, 0).setDepth(0);
    if (this.textures.exists(`cin_${bdKind}_far`)) {
      this.farImg = this.add.image(-32, -16, `cin_${bdKind}_far`).setOrigin(0, 0).setDepth(1);
    }

    // Regolith lane surface
    const laneGfx = this.add.graphics().setDepth(2);
    const groundCol = world === 'mars' ? PALETTE.marsDeepRustHex : PALETTE.lunarBasaltDarkHex;
    const rimCol = world === 'mars' ? PALETTE.marsDustTanHex : PALETTE.lunarCrustCreamHex;
    const midCol = world === 'mars' ? PALETTE.marsOchreCoreHex : PALETTE.lunarRegolithDeepHex;
    laneGfx.fillStyle(groundCol, 1).fillRect(0, TRACK_TOP - 16, W, H - (TRACK_TOP - 16));
    laneGfx.fillStyle(midCol, 0.55).fillRect(0, TRACK_TOP - 16, W, 38);
    laneGfx.fillStyle(rimCol, 0.85).fillRect(0, TRACK_TOP - 16, W, 1);

    this.groundGfx = this.add.graphics().setDepth(3);
    this.dustGfx = this.add.graphics().setDepth(14);

    // Ensure rock textures
    const rockWorld = world === 'mars' ? 'mars' : 'moon';
    for (let i = 0; i < 4; i++) {
      const k = `rover_rock_${rockWorld}_${i}`;
      if (!this.textures.exists(k)) {
        this.textures.addCanvas(k, buildRockCanvas(10 + i * 3, rockWorld, 510 + i));
      }
    }

    // Spawn obstacles along traverse
    for (let x = 320; x < TARGET_DIST - 100; x += this.assisted ? 115 : 88) {
      const y = TRACK_TOP + 6 + hash(x, 3, 19) * (TRACK_BOTTOM - TRACK_TOP - 18);
      const texKey = `rover_rock_${rockWorld}_${Math.floor(hash(x, 7, 19) * 4)}`;
      const spr = this.add.image(W + x, y, texKey).setDepth(10 + Math.floor(y));
      this.rocks.push({ sprite: spr, x, laneY: y, radius: 11, hit: false });
    }

    // Spawn science core pickups (6 available, collect 3+)
    const coreSpacing = (TARGET_DIST - 300) / 6;
    for (let i = 0; i < 6; i++) {
      const cx = 260 + i * coreSpacing;
      const cy = TRACK_TOP + 10 + hash(i, 12, 99) * (TRACK_BOTTOM - TRACK_TOP - 22);
      const glow = this.add.image(W + cx, cy - 4, 'glow_disk')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(0.55)
        .setAlpha(0.75)
        .setDepth(11 + Math.floor(cy));
      const gfx = this.add.graphics().setDepth(12 + Math.floor(cy));
      gfx.fillStyle(PALETTE.cyanLaserHex, 1).fillRect(-3, -6, 6, 6);
      gfx.fillStyle(PALETTE.cyanGlowHex, 1).fillRect(-4, -5, 8, 4);
      gfx.fillStyle(PALETTE.lunarHighlightHex, 1).fillRect(-1, -5, 2, 2);
      this.cores.push({ gfx, glow, x: cx, laneY: cy, collected: false });
    }

    // Rover sprite
    this.roverShadow = this.add.ellipse(this.roverX, this.roverY, 22, 6, PALETTE.spaceBlackHex, 0.55).setDepth(9);
    const driveKey = this.textures.exists('robot_drive') ? 'robot_drive' : 'robot_idle';
    this.rover = this.add.sprite(this.roverX, this.roverY, driveKey, 0)
      .setOrigin(0.5, 21 / 24)
      .setDepth(10 + Math.floor(this.roverY));
    if (this.anims.exists('robot_drive_anim')) {
      this.rover.play('robot_drive_anim');
    }

    new PostProcessing(this).createVignette(W, H, 95);
    this.createHUD(entry?.name ?? this.siteId);
    this.createControls();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keysWASD = this.input.keyboard!.addKeys('W,A,S,D') as RoverScene['keysWASD'];
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    const stopAudio = () => SoundFX.setRover(0);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopAudio);
    this.events.once(Phaser.Scenes.Events.DESTROY, stopAudio);
  }

  private createHUD(siteName: string): void {
    const hudGfx = this.add.graphics().setDepth(100);
    NineSliceHUD.drawFrame(hudGfx, 12, 8, 420, 32, 'panel');
    NineSliceHUD.drawStatusDot(hudGfx, 20, 15, PALETTE.cyanGlowHex);

    this.add.text(28, 12, `ROVER TRAVERSE // ${siteName.toUpperCase()}`, {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.cyanLaser,
      letterSpacing: 1,
    }).setDepth(101);

    this.hudTextLeft = this.add.text(20, 26, '', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarHighlight,
      letterSpacing: 1,
    }).setDepth(101);

    this.hudTextRight = this.add.text(422, 26, '', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.beaconGold,
      letterSpacing: 1,
    }).setOrigin(1, 0).setDepth(101);

    this.statusBanner = this.add.text(W / 2, 54, 'DODGE ROCKS · COLLECT 3 CYAN CORES · [SPACE] HOP', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarCrustCream,
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(101);

    // Top-right SURFACE MAP exit
    const exitBg = this.add.graphics().setDepth(100);
    NineSliceHUD.drawFrame(exitBg, W - 98, 8, 86, 22, 'secondary');
    const exitZone = this.add.zone(W - 55, 19, 86, 22).setDepth(101).setInteractive({ cursor: 'pointer' });
    const exitTxt = this.add.text(W - 55, 19, 'SURFACE MAP', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarHighlight,
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(102);
    exitZone.on('pointerdown', () => {
      SoundFX.setRover(0);
      SoundFX.playClick();
      this.scene.start('SiteScene');
    });
    exitZone.on('pointerover', () => exitTxt.setColor(PALETTE.cyanLaser));
    exitZone.on('pointerout', () => exitTxt.setColor(PALETTE.lunarHighlight));
  }

  private createControls(): void {
    const btnY = H - 30;
    const mkBtn = (x: number, w: number, label: string, variant: 'ghost' | 'primary', down: () => void, up: () => void) => {
      const bg = this.add.graphics().setDepth(100);
      NineSliceHUD.drawFrame(bg, x, btnY, w, 22, variant);
      const zone = this.add.zone(x + w / 2, btnY + 11, w, 22).setDepth(101).setInteractive({ cursor: 'pointer' });
      zone.on('pointerdown', down);
      zone.on('pointerup', up);
      zone.on('pointerout', up);
      this.add.text(x + w / 2, btnY + 11, label, {
        fontSize: '7px',
        fontFamily: HUD_FONT,
        color: variant === 'primary' ? PALETTE.spaceBlack : PALETTE.lunarCrustCream,
        letterSpacing: 1,
      }).setOrigin(0.5).setDepth(102);
    };

    mkBtn(14, 72, '▲ UP', 'ghost', () => { this.touchDir = -1; }, () => { this.touchDir = 0; });
    mkBtn(92, 72, '▼ DOWN', 'ghost', () => { this.touchDir = 1; }, () => { this.touchDir = 0; });
    mkBtn(W - 140, 126, 'HOP [SPACE]', 'primary', () => { this.touchJump = true; }, () => { this.touchJump = false; });
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;

    const dtRaw = Math.min(delta / 1000, CONSTANTS.PHYSICS.MAX_ACCUMULATOR);
    this.accum += dtRaw;
    const step = CONSTANTS.PHYSICS.TIMESTEP;

    while (this.accum >= step) {
      this.stepPhysics(step);
      this.accum -= step;
      if (this.ended) break;
    }

    this.renderFrame();
  }

  private stepPhysics(dt: number): void {
    const steerY =
      (this.cursors.up.isDown || this.keysWASD.W.isDown ? -1 : 0) +
      (this.cursors.down.isDown || this.keysWASD.S.isDown ? 1 : 0) +
      this.touchDir;

    const speedMod =
      this.cursors.right.isDown || this.keysWASD.D.isDown
        ? 180
        : this.cursors.left.isDown || this.keysWASD.A.isDown
          ? 85
          : 135;
    this.speed = Phaser.Math.Linear(this.speed, speedMod, 6 * dt);

    const clampedDir = Phaser.Math.Clamp(steerY, -1, 1);
    this.roverY = Phaser.Math.Clamp(this.roverY + clampedDir * 145 * dt, TRACK_TOP, TRACK_BOTTOM);

    // Hop over boulders cleanly
    const wantsJump = Phaser.Input.Keyboard.JustDown(this.keySpace) || this.touchJump;
    if (wantsJump && this.jumpOffset === 0) {
      this.jumpVel = -195;
      this.touchJump = false;
      SoundFX.playRCS();
    }
    if (this.jumpOffset < 0 || this.jumpVel < 0) {
      this.jumpOffset += this.jumpVel * dt;
      this.jumpVel += 520 * dt;
      if (this.jumpOffset >= 0) {
        this.jumpOffset = 0;
        this.jumpVel = 0;
      }
    }

    this.dist += this.speed * dt;
    this.battery = Math.max(0, this.battery - (this.assisted ? 2.4 : 3.4) * dt);
    if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);

    SoundFX.setRover(this.jumpOffset < -2 ? 0 : Phaser.Math.Clamp(this.speed / 180, 0.3, 1));

    // Parallax & ground dust puffs
    if (this.farImg && !this.reducedMotion) {
      this.farImg.x = -32 - ((this.dist * 0.08) % 64);
    }
    this.skyImg.x = -32 - ((this.dist * 0.02) % 64);

    if (this.jumpOffset === 0 && !this.reducedMotion && Math.random() < 0.4) {
      this.dustParticles.push({
        x: this.roverX - 8,
        y: this.roverY - 2,
        vx: -this.speed * 0.65,
        vy: -12 - Math.random() * 14,
        life: 0.4,
      });
    }
    for (let i = this.dustParticles.length - 1; i >= 0; i--) {
      const p = this.dustParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.dustParticles.splice(i, 1);
    }

    // Check pickups
    for (const c of this.cores) {
      if (c.collected) continue;
      const sx = this.roverX + (c.x - this.dist);
      if (Math.hypot(sx - this.roverX, c.laneY - this.roverY) < 18) {
        c.collected = true;
        c.gfx.setVisible(false);
        c.glow.setVisible(false);
        this.coresCollected++;
        this.battery = Math.min(100, this.battery + 8);
        SoundFX.playRadarPing(0.15);
      }
    }

    // Check rocks (skip collision if mid-hop above 8px!)
    for (const r of this.rocks) {
      if (r.hit) continue;
      const sx = this.roverX + (r.x - this.dist);
      if (Math.abs(sx - this.roverX) < r.radius + 6 && Math.abs(r.laneY - this.roverY) < 11 && this.jumpOffset > -8) {
        r.hit = true;
        if (this.invulnTimer <= 0) {
          this.hull--;
          this.invulnTimer = 1.1;
          SoundFX.playCrash();
          if (!this.reducedMotion) this.cameras.main.shake(180, 0.008);
        }
      }
    }

    // Check win / lose
    if (this.hull <= 0 || this.battery <= 0) {
      this.handleFailure(this.hull <= 0 ? 'SUSPENSION DAMAGED IN BOULDER FIELD' : 'ROVER BATTERY DEPLETED');
      return;
    }

    if (this.dist >= TARGET_DIST) {
      if (this.coresCollected >= REQUIRED_CORES || this.assisted) {
        this.handleWin();
      } else {
        this.handleFailure(`NEEDED ${REQUIRED_CORES} SCIENCE CORES (COLLECTED ${this.coresCollected})`);
      }
    }
  }

  private renderFrame(): void {
    // Scroll track ticks & end beacon
    this.groundGfx.clear();
    const tickOffset = Math.floor(this.dist) % 40;
    for (let x = -tickOffset; x < W; x += 40) {
      this.groundGfx.fillStyle(PALETTE.lunarRegolithDeepHex, 0.45).fillRect(x, TRACK_TOP + 24, 14, 1);
      this.groundGfx.fillStyle(PALETTE.lunarRegolithDeepHex, 0.35).fillRect(x + 20, TRACK_TOP + 86, 10, 1);
    }
    const beaconX = this.roverX + (TARGET_DIST - this.dist);
    if (beaconX < W + 40) {
      this.groundGfx.lineStyle(1, PALETTE.beaconGoldHex, 0.85).strokeRect(beaconX - 8, TRACK_TOP - 8, 16, TRACK_BOTTOM - TRACK_TOP + 16);
      this.groundGfx.fillStyle(PALETTE.cyanLaserHex, 0.9).fillRect(beaconX - 1, TRACK_TOP - 28, 2, 22);
    }

    // Rocks & cores
    for (const r of this.rocks) {
      const sx = this.roverX + (r.x - this.dist);
      r.sprite.setPosition(sx, r.laneY).setVisible(sx > -30 && sx < W + 30);
    }
    for (const c of this.cores) {
      if (c.collected) continue;
      const sx = this.roverX + (c.x - this.dist);
      c.gfx.setPosition(sx, c.laneY).setVisible(sx > -30 && sx < W + 30);
      c.glow.setPosition(sx, c.laneY - 4).setVisible(sx > -30 && sx < W + 30);
    }

    this.dustGfx.clear();
    for (const p of this.dustParticles) {
      this.dustGfx.fillStyle(PALETTE.lunarCrustCreamHex, p.life * 1.4).fillRect(Math.round(p.x), Math.round(p.y), 2, 2);
    }

    this.roverShadow.setPosition(this.roverX, this.roverY);
    this.rover
      .setPosition(this.roverX, this.roverY + this.jumpOffset)
      .setDepth(10 + Math.floor(this.roverY))
      .setAlpha(this.invulnTimer > 0 && Math.floor(this.invulnTimer * 14) % 2 === 0 ? 0.35 : 1);

    const pct = Math.min(100, Math.round((this.dist / TARGET_DIST) * 100));
    this.hudTextLeft.setText(`DIST ${pct}%   HULL ${this.hull}/${this.maxHull}   BAT ${Math.round(this.battery)}%`);
    this.hudTextRight.setText(`CORES ${this.coresCollected}/${REQUIRED_CORES}`);
    this.hudTextRight.setColor(this.coresCollected >= REQUIRED_CORES ? PALETTE.cyanLaser : PALETTE.beaconGold);
  }

  private handleWin(): void {
    this.ended = true;
    SoundFX.setRover(0);
    SoundFX.playTouchdown();
    this.statusBanner.setText('TRAVERSE COMPLETE — SAMPLES LOGGED').setColor(PALETTE.cyanLaser);
    GameState.unlockEntry(this.siteId, this.assisted, this.battery, this.hull);
    EventBus.emit(EVENTS.LANDING_COMPLETE, this.siteId);

    this.time.delayedCall(900, () => {
      this.scene.start('SiteScene', { siteId: this.siteId });
      EventBus.emit(EVENTS.OPEN_ENTRY, this.siteId);
    });
  }

  private handleFailure(reason: string): void {
    this.ended = true;
    SoundFX.setRover(0);
    SoundFX.playCrash();
    this.statusBanner.setText(reason).setColor(PALETTE.thrusterOrange);
    const fails = GameState.recordFailure(this.siteId);
    this.time.delayedCall(900, () => {
      EventBus.emit(EVENTS.LANDING_FAILED, { siteId: this.siteId, attempts: fails });
    });
  }
}
