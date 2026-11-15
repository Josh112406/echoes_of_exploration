import Phaser from 'phaser';
import { CONSTANTS } from '../core/Constants.ts';
import { GameState } from '../core/GameState.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { Soundscape } from '../audio/Soundscape.ts';
import { PALETTE } from '../ui/theme.ts';
import { NineSliceHUD } from '../ui/NineSliceHUD.ts';
import { ensureBackdropTextures } from '../systems/BackdropTextures.ts';
import { bayer, hash } from '../systems/SpriteArt.ts';
import { PostProcessing } from '../systems/PostProcessing.ts';
import {
  MG_W as W, MG_H as H, Particles, Banner, drawSegBar, drawPips, hudText, fitText, touchButton, exitButton,
  showBriefing, missionName, completeMinigame, failMinigame, smoothNoise,
} from '../systems/MinigameKit.ts';

/**
 * THIN-ATMOSPHERE ROTORCRAFT FLIGHT (Ingenuity on Mars) and a Titan variant
 * scouting the Huygens landing zone (the idea NASA's Dragonfly will fly).
 *
 * 2-D helicopter physics: collective drives rotor RPM (with spin-up inertia),
 * cyclic tilts the rotor disc to trade lift for forward thrust. Crosswind
 * gusts push, dust-devil updrafts lift. Thread four telemetry gates in order
 * and set down gently on the helipad before the battery runs out. 60 Hz.
 */

const COURSE = 2300;
const PAD_X0 = COURSE - 230;
const PAD_X1 = COURSE - 150;
const FOOT = 9; // UNIT-7's feet (row 21) below the sprite centre (row 12)

interface Gate { x: number; y: number; half: number; passed: boolean }
interface Devil { x: number; vx: number; strength: number; phase: number }
interface WorldTune { g: number; lift: number; drag: number; windBase: number; windAmp: number; spin: number }

export class RotorScene extends Phaser.Scene {
  private siteId = 'ingenuity';
  private assisted = false;
  private reduced = false;
  private tune!: WorldTune;

  private heights!: Float32Array;
  private gates: Gate[] = [];
  private devils: Devil[] = [];

  // Body
  private x = 90;
  private y = 260;
  private vx = 0;
  private vy = 0;
  private tilt = 0;
  private rpm = 0.2;
  private rotorPhase = 0;
  private grounded = true;
  private airT = 0;

  // Mission
  private battery = 100;
  private hull = 3;
  private maxHull = 3;
  private nextGate = 0;
  private wind = 0;
  private windT = 0;
  private gust = 0;
  private gustTimer = 7;
  private started = false;
  private ended = false;
  private timeScale = 1;
  private accum = 0;
  private hitCooldown = 0;
  private missNag = 0;

  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SPACE', Phaser.Input.Keyboard.Key>;
  private touchLift = false;
  private touchTilt: -1 | 0 | 1 = 0;

  private craft!: Phaser.GameObjects.Container;
  private robot!: Phaser.GameObjects.Image;
  private rotorGfx!: Phaser.GameObjects.Graphics;
  private worldGfx!: Phaser.GameObjects.Graphics;
  private dust!: Particles;
  private windMotes!: Particles;
  private hud!: Phaser.GameObjects.Graphics;
  private readout!: Phaser.GameObjects.Text;
  private banner!: Banner;

  constructor() {
    super('RotorScene');
  }

  init(data: { siteId: string; assisted?: boolean }): void {
    this.siteId = data.siteId;
    this.assisted = !!data.assisted;
  }

  create(): void {
    document.body.classList.add('in-game');
    this.reduced = GameState.getState().settings.reducedMotion;
    // Mars: thin air, barely enough lift
    this.tune = { g: 150, lift: 1.55, drag: 0.5, windBase: 8, windAmp: 34, spin: 1.1 };
    Soundscape.set({ music: 'landing', ambience: 'mars', ambienceLevel: 0.6, fade: 1.4 });
    ensureBackdropTextures(this.textures, 'mars');

    this.x = 90; this.vx = this.vy = 0; this.tilt = 0; this.rpm = 0.2; this.rotorPhase = 0;
    this.grounded = true; this.airT = 0;
    this.battery = 100;
    this.maxHull = this.assisted ? 5 : 3;
    this.hull = this.maxHull;
    this.nextGate = 0;
    this.wind = 0; this.windT = 0; this.gust = 0; this.gustTimer = 7;
    this.started = this.ended = false;
    this.timeScale = 1; this.accum = 0; this.hitCooldown = this.missNag = 0;
    this.touchLift = false; this.touchTilt = 0;

    this.buildHeights();
    this.y = this.groundAt(this.x) - FOOT;
    const half = this.assisted ? 48 : 36;
    this.gates = [
      { x: 430, y: this.groundAt(430) - 90, half, passed: false },
      { x: 860, y: this.groundAt(860) - 170, half, passed: false },
      { x: 1320, y: this.groundAt(1320) - 70, half, passed: false },
      { x: 1760, y: this.groundAt(1760) - 150, half, passed: false },
    ];
    this.devils = [
      { x: 700, vx: 9, strength: 1, phase: 0 },
      { x: 1520, vx: -7, strength: 1.2, phase: 2 },
    ];

    this.cameras.main.setBackgroundColor(PALETTE.spaceBlack);
    this.cameras.main.setBounds(0, 0, COURSE, H);
    this.drawSky();
    this.drawParallax(0.15, 1, 70, 17);
    this.drawParallax(0.4, 2, 40, 41);
    this.drawGround();
    this.worldGfx = this.add.graphics().setDepth(8);
    this.windMotes = new Particles(this, 9, 260);
    this.dust = new Particles(this, 18, 300);

    this.robot = this.add.image(0, 0, 'robot_idle').setOrigin(0.5, 0.5);
    this.rotorGfx = this.add.graphics();
    this.craft = this.add.container(this.x, this.y, [this.rotorGfx, this.robot]).setDepth(20);

    new PostProcessing(this).createVignette(W, H, 95);
    this.createHUD(missionName(this.siteId));

    this.keys = this.input.keyboard!.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE') as RotorScene['keys'];

    showBriefing(this, {
      title: `MARS HELICOPTER FLIGHT // ${missionName(this.siteId).toUpperCase()}`,
      subtitle: 'AIR ABOUT 1% AS DENSE AS EARTH · BARELY ENOUGH LIFT',
      lines: [
        '• [W / ↑ / SPACE] COLLECTIVE: SPIN UP THE ROTORS. RPM TAKES TIME TO BUILD',
        '• [A / D / ← →] CYCLIC: TILT THE ROTOR DISC. TILT TRADES LIFT FOR SPEED',
        '• FLY THROUGH THE 4 CYAN GATES IN ORDER, THEN SET DOWN SOFTLY ON THE PAD',
        '• RIDE DUST-DEVIL UPDRAFTS AND TAILWINDS. FIGHTING GUSTS DRAINS THE BATTERY',
      ],
      cta: 'SPIN UP ROTORS ➔',
    }, () => { this.started = true; });
  }

  // ---------------------------------------------------------------------------
  // World
  // ---------------------------------------------------------------------------

  private buildHeights(): void {
    const h = new Float32Array(COURSE + 1);
    for (let x = 0; x <= COURSE; x++) {
      const env = Phaser.Math.Clamp((x - 140) / 120, 0, 1) * Phaser.Math.Clamp((PAD_X0 - 60 - x) / 120, 0, 1);
      h[x] = 304 - (18 * Math.sin(x / 260 + 1) + 9 * Math.sin(x / 83) + 22 * Math.sin(x / 610 + 2)) * env;
    }
    this.heights = h;
  }

  private groundAt(x: number): number {
    return this.heights[Phaser.Math.Clamp(Math.round(x), 0, COURSE)];
  }

  private ramp(): number[] {
    return [PALETTE.marsShadowUmberHex, PALETTE.marsDeepRustHex, PALETTE.marsOchreCoreHex, PALETTE.marsTerracottaHex, PALETTE.marsDustTanHex, PALETTE.marsHazePeachHex];
  }

  private drawSky(): void {
    this.add.image(-80, -80, 'cin_mars_sky').setOrigin(0, 0).setScrollFactor(0).setDepth(0);
  }

  private drawParallax(sf: number, layer: number, amp: number, seed: number): void {
    const g = this.add.graphics().setScrollFactor(sf, 0).setDepth(layer);
    const width = Math.ceil(W + COURSE * sf + 40);
    const ramp = this.ramp();
    const base = layer === 1 ? 236 : 258;
    const pts: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: H }];
    for (let x = 0; x <= width; x += 4) {
      pts.push({ x, y: Math.round(base - amp * (0.5 + 0.5 * Math.sin(x / (110 + layer * 50) + seed)) * (0.7 + 0.3 * Math.sin(x / 37 + seed))) });
    }
    pts.push({ x: width, y: H });
    g.fillStyle(ramp[layer], 0.95).fillPoints(pts, true);
  }

  private drawGround(): void {
    const key = 'rotor_ground_mars';
    if (this.textures.exists(key)) this.textures.remove(key);
    const canvas = document.createElement('canvas');
    canvas.width = COURSE;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(COURSE, H);
    const ramp = this.ramp().map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
    for (let x = 0; x < COURSE; x++) {
      const top = Math.round(this.heights[x]);
      for (let y = top; y < H; y++) {
        const d = y - top;
        let v = 0.78 - d / 90 + (hash(x >> 2, y >> 1, 3) - 0.5) * 0.2;
        if (d === 0) v = 1;
        const f = Phaser.Math.Clamp(v, 0, 0.999) * (ramp.length - 1);
        const i = Math.min(ramp.length - 1, Math.floor(f) + (f - Math.floor(f) > bayer(x, y) ? 1 : 0));
        const o = (y * COURSE + x) * 4;
        img.data[o] = ramp[i][0];
        img.data[o + 1] = ramp[i][1];
        img.data[o + 2] = ramp[i][2];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.textures.addCanvas(key, canvas);
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.textures.remove(key));
    // Rocks
    const rocks = this.add.graphics().setDepth(6);
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(hash(i, 1, 9) * COURSE);
      if (x > PAD_X0 - 20 && x < PAD_X1 + 20) continue;
      const r = 1 + Math.floor(hash(i, 2, 9) * 3);
      const y = this.groundAt(x);
      rocks.fillStyle(this.ramp()[1], 1).fillEllipse(x, y, r * 3, r * 2);
      rocks.fillStyle(this.ramp()[5], 0.8).fillRect(x - r, y - r, Math.max(1, r), 1);
    }
    // Helipad
    const py = this.groundAt(PAD_X0);
    rocks.fillStyle(PALETTE.shadowNavyHex, 1).fillRect(PAD_X0, py - 2, PAD_X1 - PAD_X0, 3);
    for (let x = PAD_X0; x < PAD_X1; x += 8) rocks.fillStyle(PALETTE.beaconGoldHex, 1).fillRect(x, py - 2, 4, 1);
    rocks.lineStyle(1, PALETTE.beaconGoldHex, 0.7).strokeEllipse((PAD_X0 + PAD_X1) / 2, py - 1, 40, 8);
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private createHUD(name: string): void {
    const f = this.add.graphics().setDepth(100).setScrollFactor(0);
    NineSliceHUD.drawFrame(f, 12, 8, 312, 46, 'panel');
    NineSliceHUD.drawFrame(f, W - 128, 36, 116, 120, 'panel');
    NineSliceHUD.drawStatusDot(f, 20, 15);
    fitText(hudText(this, 28, 12, `MARS ROTOR FLIGHT // ${name.toUpperCase()}`, PALETTE.cyanLaser), 288);
    hudText(this, 20, 26, 'BAT', PALETTE.lunarDustLight);
    hudText(this, 20, 40, 'RPM', PALETTE.lunarDustLight);
    hudText(this, 176, 40, 'GATES', PALETTE.lunarDustLight);
    hudText(this, W - 120, 42, 'VSI', PALETTE.lunarDustLight);
    hudText(this, W - 80, 42, 'WIND', PALETTE.lunarDustLight);
    this.readout = hudText(this, W - 120, 118, '', PALETTE.lunarHighlight);
    this.readout.setLineSpacing(4);
    this.hud = this.add.graphics().setDepth(101).setScrollFactor(0);
    this.banner = new Banner(this, 82, this.reduced);
    exitButton(this, 'SURFACE MAP', () => this.scene.start('SiteScene'));
    touchButton(this, 14, H - 32, 68, 24, '◀ TILT', 'ghost', () => { this.touchTilt = -1; }, () => { if (this.touchTilt === -1) this.touchTilt = 0; });
    touchButton(this, 126, H - 32, 68, 24, 'TILT ▶', 'ghost', () => { this.touchTilt = 1; }, () => { if (this.touchTilt === 1) this.touchTilt = 0; });
    touchButton(this, W - 154, H - 32, 140, 24, 'COLLECTIVE [W]', 'primary', () => { this.touchLift = true; }, () => { this.touchLift = false; });
  }

  private renderHUD(): void {
    const g = this.hud;
    g.clear();
    drawSegBar(g, 46, 25, 270, 9, this.battery / 100, PALETTE.cyanGlowHex, { segments: 20, warnBelow: 0.25 });
    drawSegBar(g, 46, 39, 120, 9, this.rpm, this.rpm > 0.92 ? PALETTE.beaconGoldHex : PALETTE.lunarCrustCreamHex, { segments: 10 });
    drawPips(g, 214, 40, this.gates.length, this.nextGate, PALETTE.cyanLaserHex);
    drawPips(g, 264, 40, this.maxHull, this.hull, this.hull <= 1 ? PALETTE.thrusterOrangeHex : PALETTE.lunarCrustCreamHex, 5, 2);

    // Vertical speed indicator: needle on a tall scale, safe band highlighted
    const vx0 = W - 118, vy0 = 54, vh = 58;
    g.fillStyle(PALETTE.spaceBlackHex, 0.8).fillRect(vx0, vy0, 14, vh);
    const scale = (v: number) => vy0 + vh / 2 + Phaser.Math.Clamp(v / 140, -1, 1) * (vh / 2 - 2);
    g.fillStyle(PALETTE.cyanDeepHex, 0.6).fillRect(vx0, scale(-45), 14, scale(45) - scale(-45));
    g.fillStyle(PALETTE.atmosphericDuskHex, 1).fillRect(vx0, vy0 + vh / 2, 14, 1);
    const safe = Math.abs(this.vy) < 45;
    g.fillStyle(safe ? PALETTE.cyanLaserHex : PALETTE.thrusterOrangeHex, 1).fillRect(vx0 - 2, Math.round(scale(this.vy)), 18, 2);

    // Wind vector
    const cx = W - 52, cy = 80;
    g.lineStyle(1, PALETTE.atmosphericDuskHex, 1).strokeCircle(cx, cy, 20);
    const len = Phaser.Math.Clamp(Math.abs(this.wind) / 2.2, 3, 19) * Math.sign(this.wind || 1);
    const wc = Math.abs(this.wind) > 40 ? PALETTE.beaconGoldHex : PALETTE.lunarCrustCreamHex;
    g.lineStyle(2, wc, 1).lineBetween(cx - len, cy, cx + len, cy);
    g.fillStyle(wc, 1).fillTriangle(cx + len, cy - 4, cx + len, cy + 4, cx + len + Math.sign(len) * 5, cy);

    const alt = (this.groundAt(this.x) - (this.y + FOOT)) / CONSTANTS.CANVAS.PIXELS_PER_METER;
    this.readout.setText(`ALT ${Math.max(0, alt).toFixed(1)} M\nVS ${(-this.vy / 16).toFixed(1)} M/S\nWIND ${(this.wind / 16).toFixed(1)}`);
    this.readout.setColor(safe ? PALETTE.lunarHighlight : PALETTE.beaconGold);

    // Course strip
    const sx = 180, sw = W - 360, sy = H - 14;
    const at = (x: number) => sx + (x / COURSE) * sw;
    g.fillStyle(PALETTE.atmosphericDuskHex, 1).fillRect(sx, sy, sw, 1);
    for (const gt of this.gates) g.fillStyle(gt.passed ? PALETTE.beaconGoldHex : PALETTE.cyanLaserHex, 1).fillRect(at(gt.x), sy - 2, 1, 4);
    g.fillStyle(PALETTE.beaconGoldHex, 1).fillRect(at(PAD_X0), sy - 2, Math.max(2, at(PAD_X1) - at(PAD_X0)), 4);
    g.fillStyle(PALETTE.lunarHighlightHex, 1).fillRect(at(this.x) - 1, sy - 3, 3, 6);
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  update(_t: number, delta: number): void {
    const real = Math.min(delta / 1000, CONSTANTS.PHYSICS.MAX_ACCUMULATOR);
    this.accum += real * this.timeScale;
    const step = CONSTANTS.PHYSICS.TIMESTEP;
    while (this.accum >= step) {
      this.step(step);
      this.accum -= step;
    }
    this.dust.update(real * this.timeScale);
    this.windMotes.update(real * this.timeScale);
    this.render(real);
  }

  private step(dt: number): void {
    const T = this.tune;
    const k = this.keys;
    const active = this.started && !this.ended;
    const lift = active && (k.W.isDown || k.UP.isDown || k.SPACE.isDown || this.touchLift);
    const tiltIn = active ? (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0) + this.touchTilt : 0;

    // Wind: slow drift + gust events; dust devils wander
    this.windT += dt;
    this.gustTimer -= dt;
    if (active && this.gustTimer <= 0) {
      this.gust = (Math.random() > 0.5 ? 1 : -1) * (40 + Math.random() * 30);
      this.gustTimer = 6 + Math.random() * 5;
      this.banner.show(this.gust > 0 ? 'TAILWIND GUST ▶' : '◀ HEADWIND GUST', PALETTE.beaconGold, 800);
      SoundFX.playGust(0.7);
    }
    this.gust *= Math.exp(-0.45 * dt);
    this.wind = T.windBase + smoothNoise(this.windT * 0.35, 5) * T.windAmp + this.gust;
    for (const d of this.devils) {
      d.x += d.vx * dt;
      d.phase += dt * 4;
      if (d.x < 300 || d.x > COURSE - 400) d.vx *= -1;
    }

    // Rotor: RPM inertia toward collective setting
    const target = lift ? 1 : this.grounded ? 0.2 : 0.62;
    this.rpm += (target - this.rpm) * (1 - Math.exp(-dt / (lift ? 0.55 : 0.35)));
    this.rotorPhase += dt * (8 + this.rpm * 40);
    this.tilt += Phaser.Math.Clamp(Phaser.Math.Clamp(tiltIn, -1, 1) * 0.42 - this.tilt, -3.2 * dt, 3.2 * dt);

    // Idle on the ground before the flight starts and after it ends
    if (!active && this.grounded) return;

    const alt = this.groundAt(this.x) - (this.y + FOOT);
    const groundEffect = alt < 18 ? 1.12 : 1;
    const thrust = this.rpm * this.rpm * T.lift * T.g * groundEffect;
    let ax = Math.sin(this.tilt) * thrust + (this.wind - this.vx) * T.drag;
    let ay = T.g - Math.cos(this.tilt) * thrust - this.vy * 0.25 * T.drag;
    for (const d of this.devils) {
      const dx = this.x - d.x;
      if (Math.abs(dx) < 34) {
        const f = (1 - Math.abs(dx) / 34) * d.strength;
        ay -= T.g * 0.95 * f;
        ax += Math.sin(d.phase) * 30 * f;
      }
    }
    this.vx += ax * dt;
    this.vy += ay * dt;
    const px = this.x;
    this.x = Phaser.Math.Clamp(this.x + this.vx * dt, 30, COURSE - 40);
    if (this.x === 30 || this.x === COURSE - 40) this.vx = 0;
    this.y += this.vy * dt;
    if (this.y < 40) { this.y = 40; this.vy = Math.max(0, this.vy); }

    // Battery
    this.battery = Math.max(0, this.battery - (0.3 + this.rpm * this.rpm * 1.9) * dt * (this.assisted ? 0.65 : 1));

    // Gates (in order, either direction)
    const gt = this.gates[this.nextGate];
    if (gt && (px - gt.x) * (this.x - gt.x) <= 0 && px !== this.x) {
      if (Math.abs(this.y - gt.y) < gt.half) {
        gt.passed = true;
        this.nextGate++;
        SoundFX.playChime(this.nextGate * 2);
        this.banner.show(this.nextGate >= this.gates.length ? 'ALL GATES · HEAD FOR THE PAD' : `GATE ${this.nextGate}/${this.gates.length}`);
        this.windMotes.burst(14, { x: gt.x, y: gt.y, color: PALETTE.cyanLaserHex, life: 0.5, drag: 3, glow: true }, 80);
      } else if (this.missNag <= 0) {
        this.missNag = 1.5;
        this.banner.show('GATE MISSED — CIRCLE BACK', PALETTE.thrusterOrange, 900);
        SoundFX.playBuzz();
      }
    }
    this.missNag = Math.max(0, this.missNag - dt);
    this.hitCooldown = Math.max(0, this.hitCooldown - dt);

    // Ground contact
    const gy = this.groundAt(this.x) - FOOT;
    if (this.y >= gy) {
      const impact = this.vy;
      this.y = gy;
      if (!this.grounded && this.airT > 0.3) this.touchdown(impact);
      this.grounded = true;
      this.vy = Math.min(0, this.vy);
      this.vx *= Math.exp(-6 * dt);
      this.tilt *= Math.exp(-4 * dt);
      this.airT = 0;
    } else {
      this.grounded = false;
      this.airT += dt;
    }

    // Downwash kicks dust when low
    if (!this.reduced && alt < 46 && this.rpm > 0.4) {
      const n = Math.round(this.rpm * 3 * (1 - alt / 46));
      for (let i = 0; i < n; i++) {
        const side = Math.random() > 0.5 ? 1 : -1;
        this.dust.emit({
          x: this.x + side * (4 + Math.random() * 6), y: this.groundAt(this.x) - 1,
          vx: side * (60 + Math.random() * 70) + this.wind * 0.5, vy: -10 - Math.random() * 25,
          gravity: T.g * 0.3, drag: 1.4, life: 0.8, color: this.ramp()[4],
        });
      }
    }
    // Wind motes stream with the air
    if (!this.reduced && Math.random() < 0.6) {
      const cam = this.cameras.main;
      this.windMotes.emit({
        x: this.wind > 0 ? cam.scrollX - 4 : cam.scrollX + W + 4, y: 60 + Math.random() * 220,
        vx: this.wind * 2.4, vy: (Math.random() - 0.5) * 6, drag: 0, life: 4, color: this.ramp()[5],
      });
    }
    for (const d of this.devils) {
      if (this.reduced || Math.random() > 0.7) continue;
      const a = d.phase + Math.random() * 6;
      const h = Math.random();
      this.dust.emit({
        x: d.x + Math.cos(a) * (6 + h * 20), y: this.groundAt(d.x) - h * 150,
        vx: -Math.sin(a) * 30, vy: -40, drag: 0.5, life: 0.9, color: this.ramp()[4],
      });
    }

    if (this.battery <= 0) this.fail('BATTERY DEPLETED — FORCED LANDING');
  }

  private touchdown(impact: number): void {
    const onPad = this.x > PAD_X0 && this.x < PAD_X1;
    const gentle = impact < 45 && Math.abs(this.vx) < 35 && Math.abs(this.tilt) < 0.22;
    SoundFX.playThud(Phaser.Math.Clamp(impact / 120, 0.15, 1));
    if (!this.reduced) {
      this.dust.burst(16, { x: this.x, y: this.groundAt(this.x) - 1, color: this.ramp()[4], gravity: this.tune.g * 0.3, life: 0.9, drag: 1.2 }, 90, Math.PI * 0.8, -Math.PI / 2);
    }
    if (this.ended) return;
    if (impact > 95) {
      this.hull = 0;
      this.fail('ROTOR STRIKE — HARD IMPACT');
      return;
    }
    if (!gentle && this.hitCooldown <= 0) {
      this.hitCooldown = 0.8;
      this.hull--;
      this.banner.show('HARD SET-DOWN — LANDING LEG STRAIN', PALETTE.thrusterOrange, 1000);
      if (!this.reduced) this.cameras.main.shake(160, 0.008);
      if (this.hull <= 0) {
        this.fail('LANDING GEAR COLLAPSED');
        return;
      }
    }
    if (onPad && gentle && this.nextGate >= this.gates.length) this.win();
    else if (onPad && this.nextGate < this.gates.length) this.banner.show(`GATES ${this.nextGate}/${this.gates.length} — FINISH THE ROUTE`, PALETTE.beaconGold, 1200);
  }

  private win(): void {
    this.ended = true;
    SoundFX.playTouchdown();
    SoundFX.playChime(9);
    this.banner.show('FLIGHT LOGGED — TOUCHDOWN CONFIRMED', PALETTE.beaconGold, 2200);
    if (!this.reduced) {
      this.timeScale = 0.35;
      this.cameras.main.zoomTo(1.5, 900, 'Sine.easeInOut');
      this.cameras.main.pan(this.x, this.y, 900, 'Sine.easeInOut');
    }
    completeMinigame(this, this.siteId, this.assisted, Math.round(this.battery), this.hull, 1800);
  }

  private fail(reason: string): void {
    if (this.ended) return;
    this.ended = true;
    SoundFX.playCrash();
    this.banner.show(reason, PALETTE.thrusterOrange, 3000);
    if (!this.reduced) {
      this.cameras.main.shake(300, 0.014);
      this.timeScale = 0.4;
    }
    failMinigame(this, this.siteId, 1400);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  private render(dt: number): void {
    const cam = this.cameras.main;
    if (!this.ended || this.reduced) {
      const target = Phaser.Math.Clamp(this.x - 260 + this.vx * 0.8, 0, COURSE - W);
      cam.scrollX += (target - cam.scrollX) * (this.reduced ? 1 : 1 - Math.exp(-4 * dt));
    }

    const g = this.worldGfx;
    g.clear();
    const now = this.time.now / 1000;
    // Gates: two beacon posts and a dashed window
    this.gates.forEach((gt, i) => {
      const next = i === this.nextGate;
      const col = gt.passed ? PALETTE.beaconGoldHex : next ? PALETTE.cyanLaserHex : PALETTE.cyanDeepHex;
      const top = gt.y - gt.half, bot = gt.y + gt.half;
      g.fillStyle(PALETTE.lunarRegolithMidHex, 1).fillRect(gt.x - 1, bot, 2, this.groundAt(gt.x) - bot);
      g.fillStyle(col, 1).fillRect(gt.x - 2, top - 3, 5, 3).fillRect(gt.x - 2, bot, 5, 3);
      for (let y = top; y < bot; y += 6) g.fillStyle(col, next ? 0.55 + 0.35 * Math.sin(now * 6) : 0.3).fillRect(gt.x, y, 1, 3);
      if (next) g.fillStyle(PALETTE.cyanGlowHex, 0.06).fillRect(gt.x - 10, top, 20, bot - top);
    });
    // Pad beacon
    const py = this.groundAt(PAD_X0);
    g.fillStyle(this.nextGate >= this.gates.length ? PALETTE.cyanLaserHex : PALETTE.beaconGoldHex, 0.5 + 0.5 * Math.sin(now * 5))
      .fillRect(PAD_X0 - 1, py - 8, 2, 2).fillRect(PAD_X1 - 1, py - 8, 2, 2);

    // Craft: UNIT-7 with a coaxial rotor mast, counter-rotating blades
    this.craft.setPosition(this.x, this.y).setRotation(this.tilt);
    const r = this.rotorGfx;
    r.clear();
    r.fillStyle(PALETTE.lunarRegolithMidHex, 1).fillRect(-1, -22, 2, 11);
    r.fillStyle(PALETTE.lunarDustLightHex, 1).fillRect(-2, -18, 4, 2);
    const blade = 20;
    for (const [yy, dir] of [[-22, 1], [-18, -1]] as const) {
      const a = this.rotorPhase * dir;
      const half = Math.abs(Math.cos(a)) * blade + 2;
      if (this.rpm > 0.5 && !this.reduced) {
        r.fillStyle(PALETTE.lunarCrustCreamHex, 0.12 + this.rpm * 0.1).fillRect(-blade - 1, yy, blade * 2 + 2, 1);
      }
      r.fillStyle(PALETTE.lunarHighlightHex, 1).fillRect(Math.round(-half), yy, Math.round(half * 2), 1);
      r.fillStyle(PALETTE.lunarRegolithDeepHex, 1).fillRect(Math.round(-half), yy + 1, Math.round(half * 2), 1);
    }
    r.fillStyle(PALETTE.cyanDeepHex, 1).fillRect(-4, -25, 8, 2);
    r.fillStyle(PALETTE.cyanGlowHex, 1).fillRect(-3, -25, 2, 1);
    const flash = this.hitCooldown > 0 && Math.floor(this.hitCooldown * 16) % 2 === 0;
    this.craft.setAlpha(flash ? 0.5 : 1);

    this.windMotes.draw();
    this.dust.draw();
    this.renderHUD();
  }
}
