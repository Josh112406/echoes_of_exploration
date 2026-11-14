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
import { PostProcessing } from '../systems/PostProcessing.ts';

const W = CONSTANTS.CANVAS.WIDTH;
const H = CONSTANTS.CANVAS.HEIGHT;

export class LaserScene extends Phaser.Scene {
  private siteId = 'apollo-retroreflectors';
  private assisted = false;

  private reticleX = W / 2;
  private reticleY = H / 2;
  private targetX = W / 2;
  private targetY = 160;
  private targetSprite?: Phaser.GameObjects.Image;

  private gfx!: Phaser.GameObjects.Graphics;
  private hudLeft!: Phaser.GameObjects.Text;
  private hudRight!: Phaser.GameObjects.Text;
  private statusBanner!: Phaser.GameObjects.Text;

  private phaseTime = 0;
  private timeLeft = 45;
  private locksDone = 0;
  private locksRequired = 5;
  private lockProgress = 0;
  private accum = 0;
  private ended = false;
  private pingCooldown = 0;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keysWASD!: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private keySpace!: Phaser.Input.Keyboard.Key;
  private touchLock = false;
  private pointerActive = false;

  constructor() {
    super('LaserScene');
  }

  init(data: { siteId: string; assisted?: boolean }): void {
    this.siteId = data.siteId;
    this.assisted = !!data.assisted;
  }

  create(): void {
    document.body.classList.add('in-game');
    const entry = ALL_ENTRIES[this.siteId];
    const world = entry?.world ?? 'moon';
    const bdKind = world === 'moon' ? 'moon' : 'space';

    Soundscape.set({ music: 'landing', ambience: bdKind, ambienceLevel: 0.5, fade: 1.4 });
    ensureBackdropTextures(this.textures, bdKind);

    this.reticleX = W / 2;
    this.reticleY = 180;
    this.phaseTime = 0;
    this.timeLeft = this.assisted ? 60 : 45;
    this.locksRequired = this.assisted ? 4 : 5;
    this.locksDone = 0;
    this.lockProgress = 0;
    this.accum = 0;
    this.ended = false;
    this.pingCooldown = 0;
    this.touchLock = false;
    this.pointerActive = false;

    this.cameras.main.setBackgroundColor(PALETTE.spaceBlack);
    this.add.image(-32, -16, `cin_${bdKind}_sky`).setOrigin(0, 0).setDepth(0);

    const hwKey = `hw_${this.siteId}`;
    if (this.textures.exists(hwKey)) {
      this.targetSprite = this.add.image(W / 2, 160, hwKey).setScale(1.25).setDepth(12);
    }

    this.gfx = this.add.graphics().setDepth(20);
    new PostProcessing(this).createVignette(W, H, 95);
    this.createHUD(entry?.name ?? this.siteId);
    this.createTouchControls();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keysWASD = this.input.keyboard!.addKeys('W,A,S,D') as LaserScene['keysWASD'];
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown && p.y > 46 && p.y < H - 40) {
        this.pointerActive = true;
        this.reticleX = Phaser.Math.Clamp(p.x, 40, W - 40);
        this.reticleY = Phaser.Math.Clamp(p.y, 64, H - 56);
      }
    });
  }

  private createHUD(siteName: string): void {
    const g = this.add.graphics().setDepth(100);
    NineSliceHUD.drawFrame(g, 12, 8, 410, 32, 'panel');
    NineSliceHUD.drawStatusDot(g, 20, 15, PALETTE.cyanGlowHex);

    this.add.text(28, 12, `SIGNAL LOCK // ${siteName.toUpperCase()}`, {
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

    this.statusBanner = this.add.text(W / 2, 54, 'ALIGN RETICLE ON BEACON · HOLD [SPACE / LOCK] TO PING', {
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
    z.on('pointerdown', () => { this.touchLock = true; });
    z.on('pointerup', () => { this.touchLock = false; });
    z.on('pointerout', () => { this.touchLock = false; });
    this.add.text(W / 2, H - 21, 'HOLD BEAM [SPACE]', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.spaceBlack,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(102);
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
    this.phaseTime += dt;
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.pingCooldown > 0) this.pingCooldown = Math.max(0, this.pingCooldown - dt);

    const driftSpeed = this.assisted ? 0.78 : 1.15;
    this.targetX = W / 2 + Math.sin(this.phaseTime * 1.15 * driftSpeed) * 165 + Math.cos(this.phaseTime * 2.1 * driftSpeed) * 45;
    this.targetY = 185 + Math.sin(this.phaseTime * 1.65 * driftSpeed) * 68;
    this.targetSprite?.setPosition(this.targetX, this.targetY);

    const kx =
      (this.cursors.right.isDown || this.keysWASD.D.isDown ? 1 : 0) -
      (this.cursors.left.isDown || this.keysWASD.A.isDown ? 1 : 0);
    const ky =
      (this.cursors.down.isDown || this.keysWASD.S.isDown ? 1 : 0) -
      (this.cursors.up.isDown || this.keysWASD.W.isDown ? 1 : 0);

    if (kx !== 0 || ky !== 0) {
      this.pointerActive = false;
      this.reticleX = Phaser.Math.Clamp(this.reticleX + kx * 215 * dt, 40, W - 40);
      this.reticleY = Phaser.Math.Clamp(this.reticleY + ky * 215 * dt, 64, H - 56);
    } else if (this.pointerActive && this.input.activePointer.isDown) {
      const p = this.input.activePointer;
      if (p.y < H - 40) {
        this.reticleX = Phaser.Math.Clamp(p.x, 40, W - 40);
        this.reticleY = Phaser.Math.Clamp(p.y, 64, H - 56);
      }
    }

    const firing = this.keySpace.isDown || this.touchLock;
    const dist = Math.hypot(this.targetX - this.reticleX, this.targetY - this.reticleY);
    const radius = this.assisted ? 34 : 26;
    const aligned = dist <= radius;

    if (firing && aligned) {
      this.lockProgress += dt / (this.assisted ? 0.75 : 0.95);
      if (this.pingCooldown <= 0) {
        this.pingCooldown = 0.2;
        SoundFX.playRadarPing(0.1);
      }
      if (this.lockProgress >= 1) {
        this.lockProgress = 0;
        this.locksDone++;
        SoundFX.playTouchdown();
        if (this.locksDone >= this.locksRequired) {
          this.handleWin();
          return;
        }
      }
    } else {
      this.lockProgress = Math.max(0, this.lockProgress - dt * 0.55);
    }

    if (this.timeLeft <= 0) {
      this.handleFailure('CARRIER WINDOW CLOSED BEFORE SIGNAL LOCK');
    }
  }

  private renderFrame(): void {
    this.gfx.clear();
    const radius = this.assisted ? 34 : 26;
    const dist = Math.hypot(this.targetX - this.reticleX, this.targetY - this.reticleY);
    const aligned = dist <= radius;
    const firing = this.keySpace.isDown || this.touchLock;

    // Target orbit halo
    this.gfx.lineStyle(1, aligned ? PALETTE.cyanLaserHex : PALETTE.beaconGoldHex, 0.75);
    this.gfx.strokeCircle(this.targetX, this.targetY, radius);

    // Beam emission from base dish
    if (firing) {
      this.gfx.lineStyle(aligned ? 2 : 1, aligned ? PALETTE.cyanLaserHex : PALETTE.thrusterOrangeHex, 0.85);
      this.gfx.lineBetween(W / 2, H - 36, this.reticleX, this.reticleY);
    }

    // Precision crosshair reticle
    const rx = Math.round(this.reticleX);
    const ry = Math.round(this.reticleY);
    const col = aligned ? PALETTE.cyanLaserHex : PALETTE.lunarHighlightHex;
    this.gfx.lineStyle(1, col, 0.95);
    this.gfx.strokeRect(rx - 12, ry - 12, 24, 24);
    this.gfx.fillStyle(col, 1);
    this.gfx.fillRect(rx - 18, ry, 6, 1);
    this.gfx.fillRect(rx + 12, ry, 6, 1);
    this.gfx.fillRect(rx, ry - 18, 1, 6);
    this.gfx.fillRect(rx, ry + 12, 1, 6);

    // Lock progress bar under reticle
    if (this.lockProgress > 0) {
      this.gfx.fillStyle(PALETTE.deepIndigoHex, 0.9).fillRect(rx - 16, ry + 16, 32, 4);
      this.gfx.fillStyle(PALETTE.cyanLaserHex, 1).fillRect(rx - 16, ry + 16, Math.round(32 * this.lockProgress), 4);
    }

    this.hudLeft.setText(`WINDOW ${this.timeLeft.toFixed(1)}S   SIGNAL ${aligned ? 'ACQUIRED' : 'DRIFTING'}`);
    this.hudRight.setText(`LOCKS ${this.locksDone}/${this.locksRequired}`);
  }

  private handleWin(): void {
    this.ended = true;
    SoundFX.playTouchdown();
    this.statusBanner.setText('CARRIER TELEMETRY SYNCHRONIZED').setColor(PALETTE.cyanLaser);
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
