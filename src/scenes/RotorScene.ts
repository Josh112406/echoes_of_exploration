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

interface AirGate {
  x: number;
  gapY: number;
  gapH: number;
  cleared: boolean;
}

const W = CONSTANTS.CANVAS.WIDTH;
const H = CONSTANTS.CANVAS.HEIGHT;
const GOAL_DIST = 1500;

export class RotorScene extends Phaser.Scene {
  private siteId = 'ingenuity';
  private assisted = false;

  private craftY = 180;
  private craftVy = 0;
  private dist = 0;
  private energy = 100;
  private hull = 3;
  private maxHull = 3;
  private gatesCleared = 0;
  private invuln = 0;
  private accum = 0;
  private ended = false;
  private rotorPhase = 0;

  private gates: AirGate[] = [];
  private worldGfx!: Phaser.GameObjects.Graphics;
  private craftSprite?: Phaser.GameObjects.Image;
  private hudLeft!: Phaser.GameObjects.Text;
  private hudRight!: Phaser.GameObjects.Text;
  private statusBanner!: Phaser.GameObjects.Text;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private touchLift = false;

  constructor() {
    super('RotorScene');
  }

  init(data: { siteId: string; assisted?: boolean }): void {
    this.siteId = data.siteId;
    this.assisted = !!data.assisted;
  }

  create(): void {
    document.body.classList.add('in-game');
    const entry = ALL_ENTRIES[this.siteId];
    const world = entry?.world ?? 'mars';
    const bdKind = world === 'mars' ? 'mars' : 'space';

    Soundscape.set({ music: 'landing', ambience: bdKind, ambienceLevel: 0.55, fade: 1.4 });
    ensureBackdropTextures(this.textures, bdKind);

    this.craftY = 175;
    this.craftVy = 0;
    this.dist = 0;
    this.energy = 100;
    this.maxHull = this.assisted ? 5 : 3;
    this.hull = this.maxHull;
    this.gatesCleared = 0;
    this.invuln = 0;
    this.accum = 0;
    this.ended = false;
    this.rotorPhase = 0;
    this.touchLift = false;
    this.gates = [];

    this.cameras.main.setBackgroundColor(PALETTE.spaceBlack);
    this.add.image(-32, -16, `cin_${bdKind}_sky`).setOrigin(0, 0).setDepth(0);
    if (this.textures.exists(`cin_${bdKind}_far`)) {
      this.add.image(-32, -16, `cin_${bdKind}_far`).setOrigin(0, 0).setDepth(1);
    }

    for (let x = 310; x < GOAL_DIST - 120; x += 185) {
      const gapY = 120 + hash(x, 4, 31) * 130;
      this.gates.push({
        x,
        gapY,
        gapH: this.assisted ? 116 : 92,
        cleared: false,
      });
    }

    this.worldGfx = this.add.graphics().setDepth(15);
    const hwKey = `hw_${this.siteId}`;
    if (this.textures.exists(hwKey)) {
      this.craftSprite = this.add.image(118, this.craftY, hwKey).setDepth(20);
    }

    new PostProcessing(this).createVignette(W, H, 95);
    this.createHUD(entry?.name ?? this.siteId);
    this.createTouchControls();

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.keyW = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keySpace = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    const stopAudio = () => SoundFX.setThruster(false);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopAudio);
    this.events.once(Phaser.Scenes.Events.DESTROY, stopAudio);
  }

  private createHUD(siteName: string): void {
    const g = this.add.graphics().setDepth(100);
    NineSliceHUD.drawFrame(g, 12, 8, 410, 32, 'panel');
    NineSliceHUD.drawStatusDot(g, 20, 15, PALETTE.cyanGlowHex);

    this.add.text(28, 12, `FLIGHT TELEMETRY // ${siteName.toUpperCase()}`, {
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

    this.statusBanner = this.add.text(W / 2, 54, 'HOLD [SPACE / W] FOR COLLECTIVE LIFT · FLY THROUGH AIR GATES', {
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
      SoundFX.setThruster(false);
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
    z.on('pointerdown', () => { this.touchLift = true; });
    z.on('pointerup', () => { this.touchLift = false; });
    z.on('pointerout', () => { this.touchLift = false; });
    this.add.text(W / 2, H - 21, 'CLIMB [SPACE]', {
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
    const liftHeld = this.cursors.up.isDown || this.keyW.isDown || this.keySpace.isDown || this.touchLift;
    const gravity = 250;
    const liftAccel = liftHeld ? 520 : 0;

    SoundFX.setThruster(liftHeld && this.energy > 0);
    if (liftHeld && this.energy > 0) {
      this.energy = Math.max(0, this.energy - (this.assisted ? 4.5 : 6.2) * dt);
    }

    this.craftVy = Phaser.Math.Clamp(this.craftVy + (gravity - (this.energy > 0 ? liftAccel : 0)) * dt, -175, 195);
    this.craftY += this.craftVy * dt;
    this.dist += 120 * dt;
    this.rotorPhase += (liftHeld ? 26 : 12) * dt;
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);

    // Ceiling / terrain floor bounce/damage
    if (this.craftY < 62) {
      this.craftY = 62;
      this.craftVy = 15;
    }
    if (this.craftY > H - 46) {
      if (this.invuln <= 0) {
        this.hull--;
        this.invuln = 1.0;
        SoundFX.playCrash();
      }
      this.craftY = H - 52;
      this.craftVy = -90;
    }

    // Air gate columns
    const craftX = 118;
    for (const gate of this.gates) {
      const gx = craftX + (gate.x - this.dist);
      if (Math.abs(gx - craftX) < 12) {
        const half = gate.gapH / 2;
        if (this.craftY < gate.gapY - half || this.craftY > gate.gapY + half) {
          if (this.invuln <= 0) {
            this.hull--;
            this.invuln = 1.1;
            SoundFX.playCrash();
          }
        } else if (!gate.cleared) {
          gate.cleared = true;
          this.gatesCleared++;
          this.energy = Math.min(100, this.energy + 6);
          SoundFX.playRadarPing(0.2);
        }
      }
    }

    if (this.hull <= 0) {
      this.handleFailure('AIRFRAME COLLISION DURING FLIGHT');
      return;
    }
    if (this.dist >= GOAL_DIST) {
      this.handleWin();
    }
  }

  private renderFrame(): void {
    this.worldGfx.clear();

    // Ground floor horizon line
    this.worldGfx.fillStyle(PALETTE.marsShadowUmberHex, 0.9).fillRect(0, H - 42, W, 42);
    this.worldGfx.fillStyle(PALETTE.marsTerracottaHex, 0.85).fillRect(0, H - 42, W, 2);

    const craftX = 118;
    for (const gate of this.gates) {
      const gx = Math.round(craftX + (gate.x - this.dist));
      if (gx < -30 || gx > W + 30) continue;
      const topH = Math.max(0, gate.gapY - gate.gapH / 2 - 46);
      const botY = gate.gapY + gate.gapH / 2;
      const botH = Math.max(0, H - 42 - botY);

      this.worldGfx.fillStyle(PALETTE.shadowNavyHex, 0.92);
      this.worldGfx.fillRect(gx - 8, 46, 16, topH);
      this.worldGfx.fillRect(gx - 8, botY, 16, botH);
      this.worldGfx.lineStyle(1, gate.cleared ? PALETTE.beaconGoldHex : PALETTE.cyanGlowHex, 0.8);
      this.worldGfx.strokeRect(gx - 8, 46, 16, topH);
      this.worldGfx.strokeRect(gx - 8, botY, 16, botH);
    }

    // Finish landing zone beacon
    const goalX = Math.round(craftX + (GOAL_DIST - this.dist));
    if (goalX < W + 40) {
      this.worldGfx.fillStyle(PALETTE.cyanLaserHex, 0.9).fillRect(goalX - 18, H - 44, 36, 4);
      this.worldGfx.lineStyle(1, PALETTE.cyanLaserHex, 0.7).lineBetween(goalX, 58, goalX, H - 44);
    }

    // Rotor blur bar
    const rotorW = Math.round(14 + Math.abs(Math.sin(this.rotorPhase)) * 10);
    this.worldGfx.fillStyle(PALETTE.lunarHighlightHex, 0.9).fillRect(craftX - rotorW, Math.round(this.craftY) - 16, rotorW * 2, 2);

    this.craftSprite
      ?.setPosition(craftX, Math.round(this.craftY))
      .setAlpha(this.invuln > 0 && Math.floor(this.invuln * 14) % 2 === 0 ? 0.4 : 1);

    const pct = Math.min(100, Math.round((this.dist / GOAL_DIST) * 100));
    this.hudLeft.setText(`DIST ${pct}%   HULL ${this.hull}/${this.maxHull}   ENERGY ${Math.round(this.energy)}%`);
    this.hudRight.setText(`GATES ${this.gatesCleared}/${this.gates.length}`);
  }

  private handleWin(): void {
    this.ended = true;
    SoundFX.setThruster(false);
    SoundFX.playTouchdown();
    this.statusBanner.setText('AIRWAY TRAVERSE & FLIGHT RECORDED').setColor(PALETTE.cyanLaser);
    GameState.unlockEntry(this.siteId, this.assisted, this.energy, this.gatesCleared);
    EventBus.emit(EVENTS.LANDING_COMPLETE, this.siteId);

    this.time.delayedCall(900, () => {
      this.scene.start('SiteScene', { siteId: this.siteId });
      EventBus.emit(EVENTS.OPEN_ENTRY, this.siteId);
    });
  }

  private handleFailure(reason: string): void {
    this.ended = true;
    SoundFX.setThruster(false);
    SoundFX.playCrash();
    this.statusBanner.setText(reason).setColor(PALETTE.thrusterOrange);
    const fails = GameState.recordFailure(this.siteId);
    this.time.delayedCall(900, () => {
      EventBus.emit(EVENTS.LANDING_FAILED, { siteId: this.siteId, attempts: fails });
    });
  }
}
