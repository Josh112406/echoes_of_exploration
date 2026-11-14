import Phaser from 'phaser';
import { CONSTANTS } from '../core/Constants.ts';
import { ALL_ENTRIES } from '../data/entries.ts';
import { GameState } from '../core/GameState.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { Soundscape } from '../audio/Soundscape.ts';
import { PALETTE } from '../ui/theme.ts';
import { NineSliceHUD } from '../ui/NineSliceHUD.ts';
import { PostProcessing } from '../systems/PostProcessing.ts';
import {
  MG_W as W, MG_H as H, Particles, Banner, drawSegBar, hudText, fitText, touchButton, exitButton,
  showBriefing, missionName, completeMinigame, failMinigame, smoothNoise,
} from '../systems/MinigameKit.ts';

/**
 * RETROREFLECTOR PHOTON RANGING (Apollo retroreflector arrays) and, in deep
 * space, a Deep Space Network carrier lock on Voyager 1.
 *
 * A magnified optics viewport drifts with orbital jitter while atmospheric
 * turbulence shoves the reticle off-axis. Counter-steer, and pulse the
 * Q-switched laser only inside the target's sweet spot: clean consecutive hits
 * build a harmonic combo, off-target pulses overheat the capacitor. Lock three
 * targets to reach 100% telemetry lock. 60 Hz fixed step.
 */

const VX = 228;
const VY = 194;
const VR = 132;
const FIRE_COOLDOWN = 0.2;

interface Photon { x: number; y: number; tx: number; ty: number; t: number; speed: number; back: boolean }

interface Theme {
  title: string;
  subtitle: string;
  targets: string[];
  tile: string;
  space: boolean;
  intro: string[];
}

export class LaserScene extends Phaser.Scene {
  private siteId = 'apollo-retroreflectors';
  private assisted = false;
  private reduced = false;
  private theme!: Theme;

  // Reticle (relative to viewport centre) and drifting target
  private rx = 0;
  private ry = 0;
  private rvx = 0;
  private rvy = 0;
  private tx = 0;
  private ty = 0;
  private phase = 0;
  private turbT = 0;
  private gust = 0;
  private gustTimer = 6;
  private pointerAim: { x: number; y: number } | null = null;

  // Mission state
  private stage = 0;
  private locks = [0, 0, 0];
  private heat = 0;
  private overheat = 0;
  private combo = 0;
  private bestCombo = 0;
  private cooldown = 0;
  private photonsBack = 0;
  private timeLeft = 70;
  private timeMax = 70;
  private started = false;
  private ended = false;
  private timeScale = 1;
  private accum = 0;
  private flash = 0;
  private sweet = 7;

  // Input
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;
  private touchFire = false;

  // View
  private surface!: Phaser.GameObjects.TileSprite;
  private viewGfx!: Phaser.GameObjects.Graphics;
  private beamGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private errText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private photonText!: Phaser.GameObjects.Text;
  private lockLabels: Phaser.GameObjects.Text[] = [];
  private bloom!: Phaser.GameObjects.Image;
  private sparks!: Particles;
  private photons: Photon[] = [];
  private banner!: Banner;

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
    const space = entry?.world === 'elsewhere';
    this.reduced = GameState.getState().settings.reducedMotion;
    this.theme = space
      ? {
        title: 'DEEP SPACE NETWORK UPLINK',
        subtitle: 'CARRIER LOCK ON A WHISPER FROM INTERSTELLAR SPACE',
        targets: ['CARRIER', 'TELEMETRY', 'COMMAND'],
        tile: 'tile_elsewhere',
        space: true,
        intro: [
          '• THE SIGNAL IS FAINT: ONLY A NARROW BEAM CENTRED ON ITS SOURCE LOCKS IT',
          '• SOLAR-WIND SCINTILLATION SHOVES THE BEAM OFF-AXIS: COUNTER-STEER',
        ],
      }
      : {
        title: 'LUNAR LASER RANGING',
        subtitle: 'APOLLO RETROREFLECTOR ARRAYS · PHOTONS THERE AND BACK',
        targets: ['APOLLO 11', 'APOLLO 14', 'APOLLO 15'],
        tile: 'tile_moon',
        space: false,
        intro: [
          '• FROM EARTH, ATMOSPHERIC TURBULENCE SHOVES THE BEAM OFF-AXIS: COUNTER-STEER',
          '• ONLY A FEW PHOTONS OF EACH PULSE MAKE IT BACK. KEEP FIRING ON TARGET',
        ],
      };
    Soundscape.set({ music: 'landing', ambience: space ? 'space' : 'moon', ambienceLevel: 0.45, fade: 1.4 });

    this.rx = -40; this.ry = 30; this.rvx = this.rvy = 0;
    this.phase = 0; this.turbT = 0; this.gust = 0; this.gustTimer = 6;
    this.stage = 0; this.locks = [0, 0, 0];
    this.heat = this.overheat = this.combo = this.bestCombo = this.cooldown = 0;
    this.photonsBack = 0;
    this.timeMax = this.assisted ? 105 : 75;
    this.timeLeft = this.timeMax;
    this.started = this.ended = false;
    this.timeScale = 1; this.accum = 0; this.flash = 0;
    this.sweet = this.assisted ? 10 : 7;
    this.photons = [];
    this.pointerAim = null;
    this.touchFire = false;

    this.cameras.main.setBackgroundColor(PALETTE.spaceBlack);
    this.buildViewport();
    new PostProcessing(this).createVignette(W, H, 95);
    this.createHUD(missionName(this.siteId));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as LaserScene['keys'];
    kb.on('keydown-SPACE', () => this.fire());
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      const dx = p.x - VX, dy = p.y - VY;
      this.pointerAim = Math.hypot(dx, dy) < VR ? { x: dx, y: dy } : null;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (Math.hypot(p.x - VX, p.y - VY) < VR) this.fire();
    });

    showBriefing(this, {
      title: `${this.theme.title} // ${missionName(this.siteId).toUpperCase()}`,
      subtitle: this.theme.subtitle,
      lines: [
        '• [WASD / ARROWS / POINTER] STEER THE RETICLE   [SPACE / CLICK] PULSE',
        ...this.theme.intro,
        '• OFF-TARGET PULSES HEAT THE CAPACITOR. AT 100% IT LOCKS OUT',
        `• CONSECUTIVE HITS BUILD A HARMONIC COMBO. LOCK ALL 3 TARGETS IN ${this.timeMax}S`,
      ],
      cta: 'OPEN THE SHUTTER ➔',
    }, () => { this.started = true; });
  }

  // ---------------------------------------------------------------------------
  // Viewport
  // ---------------------------------------------------------------------------

  private buildViewport(): void {
    const g = this.add.graphics().setDepth(1);
    // Telescope barrel / dome silhouette framing the optics
    g.fillStyle(PALETTE.deepIndigoHex, 1).fillCircle(VX, VY, VR + 12);
    g.fillStyle(PALETTE.shadowNavyHex, 1).fillCircle(VX, VY, VR + 6);
    for (let k = 0; k < 36; k++) {
      const a = (k / 36) * Math.PI * 2;
      g.fillStyle(k % 9 === 0 ? PALETTE.cyanDeepHex : PALETTE.atmosphericDuskHex, 1)
        .fillRect(Math.round(VX + Math.cos(a) * (VR + 9)), Math.round(VY + Math.sin(a) * (VR + 9)), 2, 2);
    }
    const tileKey = this.textures.exists(this.theme.tile) ? this.theme.tile : '__WHITE';
    this.surface = this.add.tileSprite(VX, VY, VR * 2, VR * 2, tileKey).setDepth(2).setTileScale(2, 2);
    if (this.theme.space) this.surface.setAlpha(0.7);
    const shape = this.make.graphics({}, false);
    shape.fillStyle(0xffffff).fillCircle(VX, VY, VR);
    const mask = shape.createGeometryMask();
    this.surface.setMask(mask);
    this.viewGfx = this.add.graphics().setDepth(3);
    this.viewGfx.setMask(mask);
    this.beamGfx = this.add.graphics().setDepth(4).setBlendMode(Phaser.BlendModes.ADD);
    this.bloom = this.add.image(VX, VY, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setDepth(5).setAlpha(0).setTint(PALETTE.cyanLaserHex);
    this.sparks = new Particles(this, 6, 160);
    // Edge darkening inside the optics
    const rim = this.add.graphics().setDepth(7);
    for (let i = 0; i < 10; i++) rim.lineStyle(2, PALETTE.spaceBlackHex, 0.08 * (10 - i)).strokeCircle(VX, VY, VR - i * 2);
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private createHUD(name: string): void {
    const f = this.add.graphics().setDepth(100);
    NineSliceHUD.drawFrame(f, 12, 8, 330, 24, 'panel');
    NineSliceHUD.drawFrame(f, 404, 40, 224, 254, 'panel');
    NineSliceHUD.drawStatusDot(f, 20, 19);
    fitText(hudText(this, 28, 16, `${this.theme.title} // ${name.toUpperCase()}`, PALETTE.cyanLaser), 306);
    hudText(this, 416, 50, 'POINTING ERROR', PALETTE.lunarDustLight);
    this.errText = hudText(this, 416, 62, '', PALETTE.lunarHighlight, 14);
    hudText(this, 416, 92, 'CAPACITOR HEAT', PALETTE.lunarDustLight);
    hudText(this, 416, 126, 'TARGET LOCKS', PALETTE.lunarDustLight);
    this.lockLabels = this.theme.targets.map((t, i) => hudText(this, 416, 140 + i * 24, t, PALETTE.lunarCrustCream));
    this.comboText = hudText(this, 416, 222, '', PALETTE.cyanLaser, 9);
    this.photonText = hudText(this, 416, 246, '', PALETTE.lunarCrustCream);
    hudText(this, 416, 270, 'OBSERVING WINDOW', PALETTE.lunarDustLight);
    this.hud = this.add.graphics().setDepth(101);
    this.banner = new Banner(this, 54, this.reduced);
    exitButton(this, 'SURFACE MAP', () => this.scene.start('SiteScene'));
    touchButton(this, VX - 60, H - 30, 120, 24, 'PULSE [SPACE]', 'primary', () => { this.touchFire = true; this.fire(); }, () => { this.touchFire = false; });
  }

  private renderHUD(): void {
    const g = this.hud;
    g.clear();
    const d = Math.hypot(this.rx - this.tx, this.ry - this.ty);
    const arcsec = d * 0.06;
    this.errText.setText(`${arcsec.toFixed(2)}″`).setColor(d < this.sweet ? PALETTE.cyanLaser : arcsec > 2 ? PALETTE.thrusterOrange : PALETTE.lunarHighlight);
    drawSegBar(g, 416, 104, 200, 12, this.heat / 100, this.overheat > 0 ? PALETTE.thrusterOrangeHex : this.heat > 70 ? PALETTE.beaconGoldHex : PALETTE.cyanGlowHex, { segments: 16 });
    this.locks.forEach((v, i) => {
      const active = i === this.stage && !this.ended;
      drawSegBar(g, 416, 150 + i * 24, 200, 8, v / 100, v >= 100 ? PALETTE.beaconGoldHex : PALETTE.cyanLaserHex, { segments: 10 });
      this.lockLabels[i].setColor(v >= 100 ? PALETTE.beaconGold : active ? PALETTE.cyanLaser : PALETTE.lunarDustLight)
        .setText(`${active ? '▶ ' : ''}${this.theme.targets[i]} ${Math.min(100, Math.round(v))}%`);
    });
    this.comboText.setText(this.combo >= 2 ? `HARMONIC LOCK ×${this.combo}` : this.overheat > 0 ? 'CAPACITOR OVERHEAT' : '')
      .setColor(this.overheat > 0 ? PALETTE.thrusterOrange : PALETTE.cyanLaser);
    this.photonText.setText(`PHOTONS RETURNED ${this.photonsBack}`);
    drawSegBar(g, 416, 282, 200, 8, this.timeLeft / this.timeMax, PALETTE.lunarCrustCreamHex, { segments: 20, warnBelow: 0.2 });
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  update(_t: number, delta: number): void {
    const real = Math.min(delta / 1000, CONSTANTS.PHYSICS.MAX_ACCUMULATOR);
    if (this.started) {
      this.accum += real * this.timeScale;
      const step = CONSTANTS.PHYSICS.TIMESTEP;
      while (this.accum >= step) {
        this.step(step);
        this.accum -= step;
      }
    }
    this.sparks.update(real);
    this.render(real);
  }

  private step(dt: number): void {
    this.phase += dt * (0.35 + this.stage * 0.12) * (this.assisted ? 0.75 : 1);
    this.turbT += dt;

    // Target drifts with orbital jitter (a Lissajous path inside the optics)
    const reach = 70 + this.stage * 8;
    this.tx = Math.sin(this.phase * 1.3 + this.stage) * reach * 0.8 + smoothNoise(this.turbT * 0.5, 3) * 6;
    this.ty = Math.sin(this.phase * 0.9 + 1.1 + this.stage * 2) * reach * 0.55 + smoothNoise(this.turbT * 0.5, 4) * 6;

    if (this.ended) return;

    // Turbulence cells roll through every few seconds
    this.gustTimer -= dt;
    if (this.gustTimer <= 0) {
      this.gust = 1;
      this.gustTimer = 5 + Math.random() * 4;
      this.banner.show(this.theme.space ? 'SCINTILLATION BURST' : 'TURBULENCE CELL', PALETTE.beaconGold, 700);
    }
    this.gust = Math.max(0, this.gust - dt * 0.7);
    const turb = (this.assisted ? 90 : 140) * (1 + this.stage * 0.25 + this.gust * 1.6);
    let ax = smoothNoise(this.turbT * 1.7, 11) * turb;
    let ay = smoothNoise(this.turbT * 1.9, 17) * turb;

    // Player counter-steer
    const k = this.keys;
    const ix = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const iy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    ax += ix * 420;
    ay += iy * 420;
    if (this.pointerAim && ix === 0 && iy === 0) {
      ax += (this.pointerAim.x - this.rx) * 22;
      ay += (this.pointerAim.y - this.ry) * 22;
    }
    this.rvx = (this.rvx + ax * dt) * Math.exp(-4 * dt);
    this.rvy = (this.rvy + ay * dt) * Math.exp(-4 * dt);
    this.rx += this.rvx * dt;
    this.ry += this.rvy * dt;
    const r = Math.hypot(this.rx, this.ry);
    if (r > VR - 8) {
      this.rx *= (VR - 8) / r;
      this.ry *= (VR - 8) / r;
    }

    // Capacitor
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.heat = Math.max(0, this.heat - (this.overheat > 0 ? 34 : 16) * dt);
    if (this.overheat > 0) this.overheat = Math.max(0, this.overheat - dt);
    if (this.touchFire && this.cooldown <= 0) this.fire();

    // Photons out and back
    for (let i = this.photons.length - 1; i >= 0; i--) {
      const p = this.photons[i];
      p.t += dt * p.speed;
      if (p.t >= 1) {
        if (!p.back) {
          p.back = true;
          p.t = 0;
          const fromX = p.tx, fromY = p.ty;
          p.tx = W - 120; p.ty = 248;
          p.x = fromX; p.y = fromY;
        } else {
          this.photons.splice(i, 1);
          this.photonsBack++;
        }
      }
    }

    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft <= 0) this.fail();
  }

  private fire(): void {
    if (!this.started || this.ended || this.cooldown > 0) return;
    if (this.overheat > 0) {
      SoundFX.playBuzz();
      this.cooldown = 0.35;
      return;
    }
    this.cooldown = FIRE_COOLDOWN;
    const d = Math.hypot(this.rx - this.tx, this.ry - this.ty);
    const hit = d < this.sweet;
    SoundFX.playLaserPulse(hit);
    this.flash = 1;
    const sx = VX + this.rx, sy = VY + this.ry;
    if (hit) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const precision = 1 - d / this.sweet;
      this.locks[this.stage] = Math.min(100, this.locks[this.stage] + 12 + precision * 8 + Math.min(this.combo, 6) * 3);
      this.heat += 8;
      SoundFX.playChime(this.combo + Math.floor(this.locks[this.stage] / 25));
      this.bloom.setPosition(sx, sy).setAlpha(0.9).setScale(0.6);
      if (!this.reduced) this.tweens.add({ targets: this.bloom, alpha: 0, scale: 1.4, duration: 260 });
      this.sparks.burst(8, { x: VX + this.tx, y: VY + this.ty, color: PALETTE.cyanLaserHex, life: 0.35, drag: 4, glow: true }, 60);
      const n = 1 + Math.floor(Math.random() * 3) + (this.combo >= 4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        this.photons.push({ x: VX, y: VY + VR + 12, tx: VX + this.tx, ty: VY + this.ty, t: -i * 0.08, speed: 2.4, back: false });
      }
      if (this.combo === 3 || this.combo === 6) this.banner.show(`HARMONIC LOCK ×${this.combo}`);
      if (this.locks[this.stage] >= 100) this.lockStage();
    } else {
      if (this.combo >= 3) this.banner.show('COMBO BROKEN', PALETTE.lunarDustLight, 500);
      this.combo = 0;
      this.heat += 24;
      if (this.heat >= 100) {
        this.heat = 100;
        this.overheat = 2.2;
        this.banner.show('CAPACITOR OVERHEAT — COOLING', PALETTE.thrusterOrange, 1400);
        SoundFX.playBuzz();
        if (!this.reduced) this.cameras.main.shake(160, 0.004);
      }
    }
  }

  private lockStage(): void {
    this.banner.show(`${this.theme.targets[this.stage]} LOCKED`, PALETTE.beaconGold, 1100);
    SoundFX.playPickup();
    this.stage++;
    this.combo = 0;
    if (this.stage >= 3) this.win();
  }

  private win(): void {
    this.ended = true;
    this.stage = 2;
    SoundFX.playDownlink();
    this.banner.show('100% TELEMETRY LOCK', PALETTE.beaconGold, 2200);
    if (!this.reduced) {
      this.timeScale = 0.35;
      this.cameras.main.zoomTo(1.25, 900, 'Sine.easeInOut');
      this.cameras.main.pan(VX, VY, 900, 'Sine.easeInOut');
    }
    completeMinigame(this, this.siteId, this.assisted, Math.round(this.timeLeft), this.bestCombo, 1800);
  }

  private fail(): void {
    if (this.ended) return;
    this.ended = true;
    SoundFX.playCrash();
    this.banner.show(this.theme.space ? 'SIGNAL LOST — STATION HANDOVER' : 'TARGET SET — OBSERVING WINDOW CLOSED', PALETTE.thrusterOrange, 2500);
    failMinigame(this, this.siteId, 1500);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  private render(dt: number): void {
    const now = this.time.now / 1000;
    const shimmer = this.reduced ? 0 : (0.6 + this.gust * 2);
    this.surface.tilePositionX = this.phase * 18 + smoothNoise(now * 6, 1) * shimmer;
    this.surface.tilePositionY = this.phase * 7 + smoothNoise(now * 6, 2) * shimmer;

    const g = this.viewGfx;
    g.clear();
    const tx = VX + this.tx, ty = VY + this.ty;
    if (!this.ended || this.stage < 3) this.drawTarget(g, tx, ty);

    // Sweet spot ring (amber dashes) and reticle
    const steps = 20;
    for (let i = 0; i < steps; i += 2) {
      const a = (i / steps) * Math.PI * 2 + now;
      g.fillStyle(PALETTE.beaconGoldHex, 0.8).fillRect(Math.round(tx + Math.cos(a) * this.sweet), Math.round(ty + Math.sin(a) * this.sweet), 1, 1);
    }
    const rx = VX + this.rx, ry = VY + this.ry;
    const on = Math.hypot(this.rx - this.tx, this.ry - this.ty) < this.sweet;
    const col = this.overheat > 0 ? PALETTE.thrusterOrangeHex : on ? PALETTE.cyanLaserHex : PALETTE.lunarHighlightHex;
    g.fillStyle(col, 1);
    g.fillRect(Math.round(rx) - 12, Math.round(ry), 8, 1).fillRect(Math.round(rx) + 5, Math.round(ry), 8, 1);
    g.fillRect(Math.round(rx), Math.round(ry) - 12, 1, 8).fillRect(Math.round(rx), Math.round(ry) + 5, 1, 8);
    g.lineStyle(1, col, 0.8).strokeCircle(Math.round(rx) + 0.5, Math.round(ry) + 0.5, 3);

    // Beam + photons (additive)
    const b = this.beamGfx;
    b.clear();
    this.flash = Math.max(0, this.flash - dt * 7);
    if (this.flash > 0) {
      b.lineStyle(3, PALETTE.cyanGlowHex, this.flash * 0.35).lineBetween(VX, VY + VR + 12, rx, ry);
      b.lineStyle(1, PALETTE.cyanLaserHex, this.flash).lineBetween(VX, VY + VR + 12, rx, ry);
    }
    if (this.ended && this.stage >= 2 && !this.reduced) {
      b.lineStyle(2, PALETTE.cyanLaserHex, 0.4 + 0.3 * Math.sin(now * 20)).lineBetween(VX, VY + VR + 12, tx, ty);
    }
    for (const p of this.photons) {
      if (p.t < 0) continue;
      const x = p.x + (p.tx - p.x) * p.t;
      const y = p.y + (p.ty - p.y) * p.t;
      b.fillStyle(p.back ? PALETTE.beaconGoldHex : PALETTE.cyanLaserHex, 0.35).fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
      b.fillStyle(PALETTE.lunarHighlightHex, 1).fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    this.sparks.draw();
    this.renderHUD();
  }

  /** Retroreflector panel (grid of corner cubes) or a faint spacecraft carrier. */
  private drawTarget(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
    const X = Math.round(x), Y = Math.round(y);
    if (this.theme.space) {
      const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 140);
      g.fillStyle(PALETTE.cyanGlowHex, 0.15 + pulse * 0.15).fillCircle(X, Y, 8);
      g.fillStyle(PALETTE.lunarCrustCreamHex, 1).fillRect(X - 3, Y - 1, 7, 3);
      g.fillStyle(PALETTE.lunarHighlightHex, 1).fillRect(X - 2, Y - 3, 5, 1).fillRect(X - 4, Y, 1, 1).fillRect(X + 4, Y, 1, 1);
      g.fillStyle(PALETTE.lunarDustLightHex, 1).fillRect(X + 4, Y + 1, 6, 1).fillRect(X - 9, Y - 2, 5, 1);
      return;
    }
    g.fillStyle(PALETTE.deepIndigoHex, 0.7).fillRect(X - 9, Y - 6, 20, 14);
    g.fillStyle(PALETTE.lunarDustLightHex, 1).fillRect(X - 10, Y - 7, 20, 14);
    g.fillStyle(PALETTE.shadowNavyHex, 1).fillRect(X - 9, Y - 6, 18, 12);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 6; c++) {
        const lit = (r + c + Math.floor(this.time.now / 300)) % 5 === 0;
        g.fillStyle(lit ? PALETTE.cyanLaserHex : PALETTE.cyanDeepHex, 1).fillRect(X - 8 + c * 3, Y - 5 + r * 3, 2, 2);
      }
    }
    g.fillStyle(PALETTE.lunarHighlightHex, 1).fillRect(X - 10, Y - 7, 20, 1);
    g.fillStyle(PALETTE.lunarRegolithMidHex, 1).fillRect(X - 8, Y + 7, 1, 4).fillRect(X + 7, Y + 7, 1, 4);
  }
}
