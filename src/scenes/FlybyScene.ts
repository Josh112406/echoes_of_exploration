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
import { hash } from '../systems/SpriteArt.ts';
import { PostProcessing } from '../systems/PostProcessing.ts';

interface ScanTarget {
  x: number;
  y: number;
  speed: number;
  captured: boolean;
  flash: number;
}

const W = CONSTANTS.CANVAS.WIDTH;
const H = CONSTANTS.CANVAS.HEIGHT;

export class FlybyScene extends Phaser.Scene {
  private siteId = 'new-horizons';
  private assisted = false;

  private camX = W / 2;
  private camY = 180;
  private targets: ScanTarget[] = [];
  private framesCaptured = 0;
  private framesNeeded = 5;
  private timeLeft = 36;
  private accum = 0;
  private spawnTimer = 1.0;
  private shutterCooldown = 0;
  private flashAlpha = 0;
  private ended = false;

  private gfx!: Phaser.GameObjects.Graphics;
  private probeImg?: Phaser.GameObjects.Image;
  private hudLeft!: Phaser.GameObjects.Text;
  private hudRight!: Phaser.GameObjects.Text;
  private statusBanner!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keysWASD!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private keySpace!: Phaser.Input.Keyboard.Key;

  constructor() {
    super('FlybyScene');
  }

  init(data: { siteId: string; assisted?: boolean }): void {
    this.siteId = data.siteId;
    this.assisted = !!data.assisted;
  }

  create(): void {
    document.body.classList.add('in-game');
    const entry = ALL_ENTRIES[this.siteId];

    Soundscape.set({ music: 'landing', ambience: 'space', ambienceLevel: 0.55, fade: 1.4 });
    ensureBackdropTextures(this.textures, 'space');

    this.camX = W / 2;
    this.camY = 180;
    this.targets = [];
    this.framesCaptured = 0;
    this.framesNeeded = this.assisted ? 4 : 5;
    this.timeLeft = this.assisted ? 45 : 36;
    this.accum = 0;
    this.spawnTimer = 0.6;
    this.shutterCooldown = 0;
    this.flashAlpha = 0;
    this.ended = false;

    this.cameras.main.setBackgroundColor(PALETTE.spaceBlack);
    this.add.image(-32, -16, 'cin_space_sky').setOrigin(0, 0).setDepth(0);

    // Distant planetary limb along lower screen
    const limb = this.add.graphics().setDepth(2);
    const col = this.siteId === 'galileo' ? PALETTE.marsDustTanHex : this.siteId === 'deep-impact' ? PALETTE.lunarRegolithMidHex : PALETTE.lunarCrustCreamHex;
    limb.fillStyle(PALETTE.deepIndigoHex, 0.95).fillCircle(W / 2, H + 150, 260);
    limb.lineStyle(2, col, 0.7).strokeCircle(W / 2, H + 150, 260);

    const hwKey = `hw_${this.siteId}`;
    if (this.textures.exists(hwKey)) {
      this.probeImg = this.add.image(62, 290, hwKey).setScale(1.3).setDepth(12);
    }

    this.gfx = this.add.graphics().setDepth(25);
    new PostProcessing(this).createVignette(W, H, 95);
    this.createHUD(entry?.name ?? this.siteId);
    this.createTouchControls();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keysWASD = this.input.keyboard!.addKeys('W,A,S,D') as FlybyScene['keysWASD'];
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > 46 && p.y < H - 40) {
        this.camX = Phaser.Math.Clamp(p.x, 48, W - 48);
        this.camY = Phaser.Math.Clamp(p.y, 70, H - 56);
        this.triggerShutter();
      }
    });
  }

  private createHUD(siteName: string): void {
    const g = this.add.graphics().setDepth(100);
    NineSliceHUD.drawFrame(g, 12, 8, 410, 32, 'panel');
    NineSliceHUD.drawStatusDot(g, 20, 15, PALETTE.cyanGlowHex);

    this.add.text(28, 12, `FLYBY SLEW // ${siteName.toUpperCase()}`, {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.cyanLaser,
      letterSpacing: 1,
    }).setDepth(101);

    this.hudLeft = this.add.text(20, 26, '', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarHighlight,
      letterSpacing: 1,
    }).setDepth(101);

    this.hudRight = this.add.text(412, 26, '', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.beaconGold,
      letterSpacing: 1,
    }).setOrigin(1, 0).setDepth(101);

    this.statusBanner = this.add.text(W / 2, 54, 'SLEW GIMBAL OVER TARGETS · PRESS [SPACE / TAP] TO CAPTURE', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarCrustCream,
      letterSpacing: 1,
    }).setOrigin(0.5).setDepth(101);

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
      SoundFX.playClick();
      this.scene.start('SiteScene');
    });
    exitZone.on('pointerover', () => exitTxt.setColor(PALETTE.cyanLaser));
    exitZone.on('pointerout', () => exitTxt.setColor(PALETTE.lunarHighlight));
  }

  private createTouchControls(): void {
    const bg = this.add.graphics().setDepth(100);
    NineSliceHUD.drawFrame(bg, W / 2 - 80, H - 32, 160, 22, 'primary');
    const z = this.add.zone(W / 2, H - 21, 160, 22).setDepth(101).setInteractive({ cursor: 'pointer' });
    z.on('pointerdown', () => this.triggerShutter());
    this.add.text(W / 2, H - 21, 'SHUTTER [SPACE]', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.spaceBlack,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(102);
  }

  private triggerShutter(): void {
    if (this.ended || this.shutterCooldown > 0) return;
    this.shutterCooldown = 0.25;
    this.flashAlpha = 0.55;
    const hitR = this.assisted ? 38 : 28;
    let scored = false;

    for (const t of this.targets) {
      if (t.captured) continue;
      if (Math.hypot(t.x - this.camX, t.y - this.camY) <= hitR) {
        t.captured = true;
        t.flash = 1;
        this.framesCaptured++;
        scored = true;
        break;
      }
    }

    if (scored) {
      SoundFX.playTouchdown();
      if (this.framesCaptured >= this.framesNeeded) {
        this.handleWin();
      }
    } else {
      SoundFX.playRCS();
    }
  }

  update(_time: number, delta: number): void {
    if (this.ended) return;

    if (Phaser.Input.Keyboard.JustDown(this.keySpace)) {
      this.triggerShutter();
    }

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
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.shutterCooldown > 0) this.shutterCooldown = Math.max(0, this.shutterCooldown - dt);
    if (this.flashAlpha > 0) this.flashAlpha = Math.max(0, this.flashAlpha - dt * 2.5);

    const kx =
      (this.cursors.right.isDown || this.keysWASD.D.isDown ? 1 : 0) -
      (this.cursors.left.isDown || this.keysWASD.A.isDown ? 1 : 0);
    const ky =
      (this.cursors.down.isDown || this.keysWASD.S.isDown ? 1 : 0) -
      (this.cursors.up.isDown || this.keysWASD.W.isDown ? 1 : 0);

    this.camX = Phaser.Math.Clamp(this.camX + kx * 260 * dt, 48, W - 48);
    this.camY = Phaser.Math.Clamp(this.camY + ky * 260 * dt, 70, H - 56);
    this.probeImg?.setRotation((this.camY - 180) * 0.002);

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = this.assisted ? 2.1 : 1.75;
      const idx = this.targets.length + Math.round(this.timeLeft * 10);
      this.targets.push({
        x: W + 24,
        y: 120 + hash(idx, 5, 73) * 145,
        speed: this.assisted ? 115 : 145 + hash(idx, 9, 73) * 45,
        captured: false,
        flash: 0,
      });
    }

    for (let i = this.targets.length - 1; i >= 0; i--) {
      const t = this.targets[i];
      t.x -= t.speed * dt;
      if (t.flash > 0) t.flash = Math.max(0, t.flash - dt * 2);
      if (t.x < -40) this.targets.splice(i, 1);
    }

    if (this.timeLeft <= 0) {
      this.handleFailure('CLOSEST APPROACH WINDOW PASSED');
    }
  }

  private renderFrame(): void {
    this.gfx.clear();
    const boxR = this.assisted ? 38 : 28;

    // Targets drifting past camera
    for (const t of this.targets) {
      const col = t.captured ? PALETTE.beaconGoldHex : PALETTE.cyanLaserHex;
      const a = t.captured ? Math.max(0.2, t.flash) : 0.9;
      this.gfx.lineStyle(1, col, a).strokeCircle(Math.round(t.x), Math.round(t.y), 14);
      this.gfx.fillStyle(col, a).fillRect(Math.round(t.x) - 3, Math.round(t.y) - 3, 6, 6);
    }

    // Viewfinder gimbal box
    const inTarget = this.targets.some((t) => !t.captured && Math.hypot(t.x - this.camX, t.y - this.camY) <= boxR);
    this.gfx.lineStyle(2, inTarget ? PALETTE.cyanLaserHex : PALETTE.lunarHighlightHex, 0.9);
    this.gfx.strokeRect(Math.round(this.camX - boxR), Math.round(this.camY - 22), boxR * 2, 44);
    this.gfx.lineStyle(1, PALETTE.cyanGlowHex, 0.45).lineBetween(82, 276, this.camX, this.camY);

    if (this.flashAlpha > 0) {
      this.gfx.fillStyle(PALETTE.lunarHighlightHex, this.flashAlpha * 0.35).fillRect(0, 0, W, H);
    }

    this.hudLeft.setText(`CLOSURE ${this.timeLeft.toFixed(1)}S   TARGET ${inTarget ? 'IN FRAME' : 'SLEWING'}`);
    this.hudRight.setText(`FRAMES ${this.framesCaptured}/${this.framesNeeded}`);
  }

  private handleWin(): void {
    this.ended = true;
    SoundFX.playTouchdown();
    this.statusBanner.setText('FLYBY IMAGING SEQUENCE STORED').setColor(PALETTE.cyanLaser);
    GameState.unlockEntry(this.siteId, this.assisted, this.timeLeft, 0);
    EventBus.emit(EVENTS.LANDING_COMPLETE, this.siteId);

    this.time.delayedCall(900, () => {
      this.scene.start('SiteScene', { siteId: this.siteId });
      EventBus.emit(EVENTS.OPEN_ENTRY, this.siteId);
    });
  }

  private handleFailure(reason: string): void {
    this.ended = true;
    SoundFX.playCrash();
    this.statusBanner.setText(reason).setColor(PALETTE.thrusterOrange);
    const fails = GameState.recordFailure(this.siteId);
    this.time.delayedCall(900, () => {
      EventBus.emit(EVENTS.LANDING_FAILED, { siteId: this.siteId, attempts: fails });
    });
  }
}
