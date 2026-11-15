import Phaser from 'phaser';
import { CONSTANTS } from '../core/Constants.ts';
import { ALL_ENTRIES } from '../data/entries.ts';
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
  showBriefing, missionName, completeMinigame, failMinigame,
} from '../systems/MinigameKit.ts';

/**
 * SURFACE TRAVERSE & CORE SAMPLE RECOVERY (Apollo 15 LRV, Sojourner,
 * Spirit / Opportunity, Curiosity).
 *
 * Side-view rigid-body buggy on a procedural heightmap: two sprung wheels,
 * real slope gravity, traction-limited drive, mid-air pitch control (with a
 * gentle auto-level when no key is held) and landing grades. Glowing cores sit
 * on rounded crater rims; park on the extraction pad with enough of them to
 * file the echo. 60 Hz fixed step.
 */

const COURSE = 3400;
const PAD_X0 = COURSE - 330;
const PAD_X1 = COURSE - 170;
const WHEEL_R = 6;
const AXLE_X = 14;
const AXLE_Y = 6;
const REST = 7;
const SPRING_K = 70;
const SPRING_C = 9;
const INERTIA = 150;
const DRIVE = 250;
const BRAKE = 260;
const VMAX = 250;

interface Core { x: number; y: number; taken: boolean; glow: Phaser.GameObjects.Image; gfx: Phaser.GameObjects.Graphics }
interface Wheel { lx: number; contact: boolean; pen: number; cx: number; cy: number; spin: number }

export class RoverScene extends Phaser.Scene {
  private siteId = 'apollo-15-lrv';
  private assisted = false;
  private world: 'moon' | 'mars' = 'moon';
  private reduced = false;

  // Terrain
  private heights!: Float32Array;
  private dustTraps: [number, number][] = [];
  private cores: Core[] = [];

  // Rigid body (centre of mass)
  private x = 120;
  private y = 200;
  private vx = 0;
  private vy = 0;
  private a = 0;
  private w = 0;
  private gravity = 170;
  private wheels: Wheel[] = [];
  private airTime = 0;
  private rolloverT = 0;

  // Mission
  private battery = 100;
  private hull = 3;
  private maxHull = 3;
  private required = 3;
  private get taken(): number { return this.cores.filter((core) => core.taken).length; }
  private hitCooldown = 0;
  private padNag = 0;
  private started = false;
  private ended = false;
  private timeScale = 1;
  private accum = 0;

  // Input
  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'LEFT' | 'RIGHT', Phaser.Input.Keyboard.Key>;
  private touch: -1 | 0 | 1 = 0;

  // View
  private roverGfx!: Phaser.GameObjects.Graphics;
  private robot!: Phaser.GameObjects.Image;
  private dust!: Particles;
  private sparks!: Particles;
  private hud!: Phaser.GameObjects.Graphics;
  private incl!: Phaser.GameObjects.Graphics;
  private readout!: Phaser.GameObjects.Text;
  private coreCount!: Phaser.GameObjects.Text;
  private banner!: Banner;
  private beacon!: Phaser.GameObjects.Graphics;

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
    this.world = entry?.world === 'mars' ? 'mars' : 'moon';
    this.reduced = GameState.getState().settings.reducedMotion;
    this.gravity = this.world === 'mars' ? 300 : 170;
    Soundscape.set({ music: 'landing', ambience: this.world, ambienceLevel: 0.55, fade: 1.4 });
    ensureBackdropTextures(this.textures, this.world);

    this.x = 120;
    this.vx = this.vy = this.a = this.w = 0;
    this.airTime = this.rolloverT = 0;
    this.battery = 100;
    this.maxHull = this.assisted ? 6 : 4;
    this.hull = this.maxHull;
    this.required = this.assisted ? 2 : 3;
    this.hitCooldown = this.padNag = 0;
    this.started = this.ended = false;
    this.timeScale = 1;
    this.accum = 0;
    this.touch = 0;
    this.cores = [];
    this.wheels = [-AXLE_X, AXLE_X].map((lx) => ({ lx, contact: false, pen: 0, cx: 0, cy: 0, spin: 0 }));

    this.buildHeights();
    this.y = this.groundAt(this.x) - 22;

    this.cameras.main.setBackgroundColor(PALETTE.spaceBlack);
    this.cameras.main.setBounds(0, 0, COURSE, H);
    this.add.image(-80, -80, `cin_${this.world}_sky`).setOrigin(0, 0).setScrollFactor(0).setDepth(0);
    this.drawParallax(0.12, 1, 64, 11);
    this.drawParallax(0.35, 2, 34, 29);
    this.drawTerrain();
    this.placeHazards();

    this.beacon = this.add.graphics().setDepth(8);
    this.dust = new Particles(this, 18);
    this.sparks = new Particles(this, 30, 120);
    this.roverGfx = this.add.graphics().setDepth(20);
    this.robot = this.add.image(0, 0, 'robot_idle').setOrigin(0.5, 21 / 24).setDepth(21);

    new PostProcessing(this).createVignette(W, H, 95);
    this.createHUD(missionName(this.siteId));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,LEFT,RIGHT') as RoverScene['keys'];
    this.cameras.main.scrollX = 0;

    const stop = () => SoundFX.setRover(0);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, stop);
    this.events.once(Phaser.Scenes.Events.DESTROY, stop);

    showBriefing(this, {
      title: `SURFACE TRAVERSE // ${missionName(this.siteId).toUpperCase()}`,
      subtitle: `GRAVITY ${this.world === 'mars' ? '3.71' : '1.62'} M/S² · ${this.required} CORES REQUIRED · ${this.maxHull} HULL`,
      lines: [
        '• [D / →] DRIVE   [A / ←] BRAKE & REVERSE',
        '• IN THE AIR: [A] TILT BACK  [D] TILT FORWARD. LET GO AND IT LEVELS ITSELF',
        '• LAND FLAT FOR A SPEED BOOST. HARD NOSE-FIRST LANDINGS DENT THE HULL',
        '• UPHILL DRAINS BATTERY. LOOSE DUST (DARK PATCHES) SLOWS YOU DOWN',
        `• GRAB ${this.required} GLOWING CORES ON THE CRATER RIMS, THEN PARK ON THE PAD`,
      ],
      cta: 'ENGAGE DRIVE ➔',
    }, () => { this.started = true; });
  }

  // ---------------------------------------------------------------------------
  // Terrain
  // ---------------------------------------------------------------------------

  private buildHeights(): void {
    const h = new Float32Array(COURSE + 1);
    const seed = this.world === 'mars' ? 37 : 11;
    // Gentle craters: cosine bowls (no kink at the edge) with broad, rounded rims
    const craters = [
      { c: 640, r: 90, d: 16, lip: 9 },
      { c: 1180, r: 110, d: 20, lip: 10 },
      { c: 1820, r: 90, d: 14, lip: 9 },
      { c: 2380, r: 115, d: 18, lip: 11 },
    ];
    for (let x = 0; x <= COURSE; x++) {
      const env = Phaser.Math.Clamp((x - 200) / 200, 0, 1) * Phaser.Math.Clamp((PAD_X0 - 40 - x) / 160, 0, 1);
      let y = 262
        - (18 * Math.sin(x / 260 + seed) + 9 * Math.sin(x / 113 + 1.3)) * env
        + (Math.sin(x / 520) * 14) * env;
      for (const k of craters) {
        const dx = Math.abs(x - k.c);
        if (dx < k.r) y += k.d * 0.5 * (1 + Math.cos((Math.PI * dx) / k.r));
        y -= k.lip * Math.exp(-(((dx - k.r) / 34) ** 2));
      }
      h[x] = Phaser.Math.Clamp(y, 150, 316);
    }
    // Light smoothing pass so no single column can form a spike
    for (let pass = 0; pass < 2; pass++) {
      for (let x = 2; x <= COURSE - 2; x++) h[x] = (h[x - 2] + h[x - 1] * 2 + h[x] * 2 + h[x + 1] * 2 + h[x + 2]) / 8;
    }
    // Flat apron leading onto the extraction pad
    const padY = h[PAD_X0 - 120];
    for (let x = PAD_X0 - 120; x <= COURSE; x++) h[x] = padY;
    this.heights = h;
    this.dustTraps = [[880, 1010], [1500, 1640], [2600, 2760]];
    this.craterRims = craters.map((k) => k.c + k.r);
  }

  private craterRims: number[] = [];

  private groundAt(x: number): number {
    const i = Phaser.Math.Clamp(x, 0, COURSE - 1);
    const i0 = Math.floor(i);
    const f = i - i0;
    return this.heights[i0] * (1 - f) + this.heights[i0 + 1] * f;
  }

  private slopeAt(x: number): number {
    return (this.groundAt(x + 2) - this.groundAt(x - 2)) / 4;
  }

  private inDust(x: number): boolean {
    return this.dustTraps.some(([a, b]) => x > a && x < b);
  }

  private ramp(): number[] {
    return this.world === 'mars'
      ? [PALETTE.marsShadowUmberHex, PALETTE.marsDeepRustHex, PALETTE.marsOchreCoreHex, PALETTE.marsTerracottaHex, PALETTE.marsDustTanHex, PALETTE.marsHazePeachHex]
      : [PALETTE.deepIndigoHex, PALETTE.lunarBasaltDarkHex, PALETTE.lunarRegolithDeepHex, PALETTE.lunarRegolithMidHex, PALETTE.lunarDustLightHex, PALETTE.lunarCrustCreamHex];
  }

  /** Distant ridges as polygons on slow scroll factors. */
  private drawParallax(sf: number, layer: number, amp: number, seed: number): void {
    const g = this.add.graphics().setScrollFactor(sf, 0).setDepth(layer);
    const width = Math.ceil(W + COURSE * sf + 40);
    const ramp = this.ramp();
    const base = layer === 1 ? 216 : 238;
    const pts: Phaser.Types.Math.Vector2Like[] = [{ x: 0, y: H }];
    for (let x = 0; x <= width; x += 4) {
      pts.push({ x, y: Math.round(base - amp * (0.5 + 0.5 * Math.sin(x / (90 + layer * 40) + seed)) * (0.6 + 0.4 * Math.sin(x / 33 + seed * 2))) });
    }
    pts.push({ x: width, y: H });
    g.fillStyle(ramp[layer], layer === 1 ? 0.9 : 1).fillPoints(pts, true);
    g.fillStyle(ramp[layer + 2], 0.35);
    for (let i = 1; i < pts.length - 1; i++) g.fillRect(pts[i].x, pts[i].y, 4, 1);
  }

  /** Pixel terrain canvas: dithered strata by depth, lit rim, dust-trap patches. */
  private drawTerrain(): void {
    const key = `rover_ground_${this.world}`;
    if (this.textures.exists(key)) this.textures.remove(key);
    const canvas = document.createElement('canvas');
    canvas.width = COURSE;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(COURSE, H);
    const ramp = this.ramp().map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
    for (let x = 0; x < COURSE; x++) {
      const top = Math.round(this.heights[x]);
      const slope = (this.heights[Math.min(COURSE, x + 1)] - this.heights[Math.max(0, x - 1)]) / 2;
      const dusty = this.inDust(x);
      for (let y = Math.max(0, top); y < H; y++) {
        const d = y - top;
        let v = 0.82 - d / 140 - slope * 0.35 + (hash(x >> 2, y >> 2, 5) - 0.5) * 0.18;
        if (d === 0) v = 1.05;
        else if (d === 1) v = 0.9;
        if (dusty && d < 10) v = 0.55 + (hash(x, y, 9) - 0.5) * 0.2;
        const f = Phaser.Math.Clamp(v, 0, 0.999) * (ramp.length - 1);
        const i = Math.min(ramp.length - 1, Math.floor(f) + (f - Math.floor(f) > bayer(x, y) ? 1 : 0));
        const o = (y * COURSE + x) * 4;
        img.data[o] = ramp[i][0];
        img.data[o + 1] = ramp[i][1];
        img.data[o + 2] = ramp[i][2];
        img.data[o + 3] = 255;
      }
      // Dust ripples
      if (dusty && x % 6 < 3) {
        const o = ((top + 3) * COURSE + x) * 4;
        if (top + 3 < H) {
          img.data[o] = ramp[4][0];
          img.data[o + 1] = ramp[4][1];
          img.data[o + 2] = ramp[4][2];
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    this.textures.addCanvas(key, canvas);
    this.add.image(0, 0, key).setOrigin(0, 0).setDepth(5);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.textures.remove(key));
  }

  private placeHazards(): void {
    // Cores on the crater rims (the high points). The art is drawn around the
    // Graphics' own origin so the pickup scale-up grows in place.
    for (const rim of this.craterRims.slice(0, 4)) {
      const x = rim - 6;
      const y = this.groundAt(x) - 14;
      const glow = this.add.image(x, y, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setScale(0.6).setAlpha(0.7).setDepth(10);
      const gfx = this.add.graphics({ x, y }).setDepth(11);
      gfx.fillStyle(PALETTE.cyanDeepHex, 1).fillRect(-3, -5, 6, 10);
      gfx.fillStyle(PALETTE.cyanLaserHex, 1).fillRect(-2, -4, 4, 8);
      gfx.fillStyle(PALETTE.lunarHighlightHex, 1).fillRect(-1, -3, 1, 3);
      if (!this.reduced) this.tweens.add({ targets: [glow, gfx], y: '-=3', duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.cores.push({ x, y, taken: false, glow, gfx });
    }
    // Extraction pad
    const pad = this.add.graphics().setDepth(7);
    const py = this.heights[PAD_X0];
    pad.fillStyle(PALETTE.shadowNavyHex, 1).fillRect(PAD_X0, py - 2, PAD_X1 - PAD_X0, 3);
    for (let x = PAD_X0; x < PAD_X1; x += 8) pad.fillStyle(PALETTE.beaconGoldHex, 1).fillRect(x, py - 2, 4, 1);
    pad.fillStyle(PALETTE.lunarDustLightHex, 1).fillRect(PAD_X0 - 2, py - 30, 2, 28).fillRect(PAD_X1, py - 30, 2, 28);
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private createHUD(name: string): void {
    const frame = this.add.graphics().setDepth(100).setScrollFactor(0);
    NineSliceHUD.drawFrame(frame, 12, 8, 300, 46, 'panel');
    NineSliceHUD.drawFrame(frame, W - 150, 36, 138, 52, 'panel');
    NineSliceHUD.drawStatusDot(frame, 20, 15);
    fitText(hudText(this, 28, 12, `SURFACE TRAVERSE // ${name.toUpperCase()}`, PALETTE.cyanLaser), 278);
    hudText(this, 20, 26, 'BAT', PALETTE.lunarDustLight);
    hudText(this, 20, 40, 'HULL', PALETTE.lunarDustLight);
    hudText(this, 160, 40, 'CORES', PALETTE.lunarDustLight);
    this.coreCount = hudText(this, 240, 40, `0/${this.cores.length}`, PALETTE.cyanLaser);
    this.hud = this.add.graphics().setDepth(101).setScrollFactor(0);
    this.incl = this.add.graphics().setDepth(101).setScrollFactor(0);
    this.readout = hudText(this, W - 108, 44, '', PALETTE.lunarHighlight);
    this.readout.setLineSpacing(4);
    this.banner = new Banner(this, 96, this.reduced);
    exitButton(this, 'SURFACE MAP', () => {
      SoundFX.setRover(0);
      this.scene.start('SiteScene');
    });
    touchButton(this, 14, H - 32, 104, 24, '◀ BRAKE / TILT', 'ghost', () => { this.touch = -1; }, () => { if (this.touch === -1) this.touch = 0; });
    touchButton(this, W - 118, H - 32, 104, 24, 'DRIVE / TILT ▶', 'primary', () => { this.touch = 1; }, () => { if (this.touch === 1) this.touch = 0; });
  }

  private renderHUD(): void {
    const g = this.hud;
    g.clear();
    drawSegBar(g, 46, 25, 250, 9, this.battery / 100, PALETTE.cyanGlowHex, { segments: 20, warnBelow: 0.25 });
    drawPips(g, 46, 40, this.maxHull, this.hull, this.hull <= 1 ? PALETTE.thrusterOrangeHex : PALETTE.lunarCrustCreamHex);
    drawPips(g, 196, 40, this.cores.length, this.taken, PALETTE.cyanLaserHex);
    this.coreCount.setText(`${this.taken}/${this.cores.length}`);
    // Course strip: rover, cores, pad
    const sx = 100, sw = W - 200, sy = H - 14;
    g.fillStyle(PALETTE.atmosphericDuskHex, 1).fillRect(sx, sy, sw, 1);
    const at = (x: number) => sx + (x / COURSE) * sw;
    g.fillStyle(PALETTE.beaconGoldHex, 1).fillRect(at(PAD_X0), sy - 2, Math.max(2, at(PAD_X1) - at(PAD_X0)), 4);
    for (const c of this.cores) if (!c.taken) g.fillStyle(PALETTE.cyanLaserHex, 1).fillRect(at(c.x) - 1, sy - 2, 2, 2);
    g.fillStyle(PALETTE.lunarHighlightHex, 1).fillRect(at(this.x) - 1, sy - 3, 3, 6);

    // Inclinometer: chassis pitch against the local slope
    const ig = this.incl;
    ig.clear();
    const cx = W - 128, cy = 62, r = 16;
    ig.fillStyle(PALETTE.spaceBlackHex, 0.8).fillCircle(cx, cy, r);
    ig.lineStyle(1, PALETTE.atmosphericDuskHex, 1).strokeCircle(cx, cy, r);
    const slope = Math.atan(this.slopeAt(this.x));
    const rel = this.a - slope;
    ig.lineStyle(1, PALETTE.lunarRegolithMidHex, 1).lineBetween(cx - Math.cos(slope) * r, cy - Math.sin(slope) * r, cx + Math.cos(slope) * r, cy + Math.sin(slope) * r);
    const danger = Math.abs(rel) > 0.6;
    ig.lineStyle(2, danger ? PALETTE.thrusterOrangeHex : PALETTE.cyanLaserHex, 1)
      .lineBetween(cx - Math.cos(this.a) * (r - 3), cy - Math.sin(this.a) * (r - 3), cx + Math.cos(this.a) * (r - 3), cy + Math.sin(this.a) * (r - 3));
    const speed = Math.hypot(this.vx, this.vy) / CONSTANTS.CANVAS.PIXELS_PER_METER;
    const pitch = Math.round(-this.a * 57.3);
    this.readout.setText(`PITCH ${pitch > 0 ? '+' : ''}${pitch}°\nSLOPE ${Math.round(-slope * 57.3)}°\nSPD ${speed.toFixed(1)} M/S`);
    this.readout.setColor(danger ? PALETTE.thrusterOrange : PALETTE.lunarHighlight);
  }

  // ---------------------------------------------------------------------------
  // Loop
  // ---------------------------------------------------------------------------

  update(_t: number, delta: number): void {
    const real = Math.min(delta / 1000, CONSTANTS.PHYSICS.MAX_ACCUMULATOR);
    if (this.started && !this.ended) {
      this.accum += real * this.timeScale;
      const step = CONSTANTS.PHYSICS.TIMESTEP;
      while (this.accum >= step) {
        this.step(step);
        this.accum -= step;
        if (this.ended) break;
      }
    } else if (this.ended) {
      // Extraction slow-mo keeps the world drifting
      this.accum += real * this.timeScale;
      while (this.accum >= CONSTANTS.PHYSICS.TIMESTEP) {
        this.integrate(CONSTANTS.PHYSICS.TIMESTEP, 0);
        this.accum -= CONSTANTS.PHYSICS.TIMESTEP;
      }
    }
    this.dust.update(real * this.timeScale);
    this.sparks.update(real * this.timeScale);
    this.render(real);
  }

  private readThrottle(): number {
    const k = this.keys;
    let v = this.touch as number;
    if (k.D.isDown || k.RIGHT.isDown || k.W.isDown) v = 1;
    if (k.A.isDown || k.LEFT.isDown || k.S.isDown) v = v === 1 ? 0 : -1;
    return v;
  }

  private step(dt: number): void {
    const throttle = this.readThrottle();
    const wasAir = this.wheels.every((wh) => !wh.contact);
    const impactVy = this.vy;
    this.integrate(dt, throttle);
    const grounded = this.wheels.some((wh) => wh.contact);
    const slope = this.slopeAt(this.x);

    // Landing grade after real airtime
    if (wasAir && grounded && this.airTime > 0.35) {
      const rel = this.a - Math.atan(slope);
      const hard = impactVy > 400;
      if (rel > 0.8 && impactVy > 160) {
        this.damage('NOSE-FIRST LANDING — HULL −1');
      } else if (hard) {
        this.damage('CHASSIS BOTTOMED OUT — HULL −1');
      } else if (Math.abs(rel) < 0.35) {
        const t = this.tangent(this.x);
        this.vx += t.x * 55;
        this.vy += t.y * 55;
        this.banner.show('CLEAN LANDING · SPEED BOOST');
        SoundFX.playChime(3);
      }
      SoundFX.playThud(Phaser.Math.Clamp(impactVy / 300, 0.2, 1));
      this.landingDust(Phaser.Math.Clamp(impactVy / 40, 4, 18));
      if (!this.reduced) this.cameras.main.shake(120, Phaser.Math.Clamp(impactVy / 40000, 0.002, 0.008));
    }
    this.airTime = grounded ? 0 : this.airTime + dt;

    // Battery: drive power, harder uphill
    const uphill = Math.max(0, -slope * Math.sign(this.vx || 1));
    const drain = 0.3 + Math.abs(throttle) * 1.0 * (1 + uphill * 1.5);
    this.battery = Math.max(0, this.battery - drain * dt * (this.assisted ? 0.6 : 1));

    // Rollover: chassis roof touching ground
    const roof = this.local(0, -12);
    const upsideDown = grounded && Math.abs(Phaser.Math.Angle.Wrap(this.a - Math.atan(slope))) > 1.9;
    if (roof.y > this.groundAt(roof.x) - 1 || upsideDown) {
      this.rolloverT += dt;
      if (this.rolloverT > 0.4) this.rollover();
    } else {
      this.rolloverT = 0;
    }

    // Cores
    for (const c of this.cores) {
      if (c.taken || this.taken >= this.cores.length) continue;
      if (Math.hypot(c.x - this.x, c.y - (this.y - 8)) < 32) {
        c.taken = true;
        this.tweens.add({ targets: [c.glow, c.gfx], alpha: 0, scale: 2, duration: this.reduced ? 0 : 300, onComplete: () => { c.gfx.setVisible(false); c.glow.setVisible(false); } });
        this.sparks.burst(16, { x: c.x, y: c.y, color: PALETTE.cyanLaserHex, life: 0.5, drag: 3, glow: true }, 90);
        SoundFX.playPickup();
        this.battery = Math.min(100, this.battery + 12);
        this.banner.show(`CORE SAMPLE ${this.taken}/${this.cores.length} SECURED`);
      }
    }

    // Extraction pad
    this.padNag = Math.max(0, this.padNag - dt);
    const onPad = this.x > PAD_X0 && this.x < PAD_X1 && this.wheels.every((wh) => wh.contact);
    if (onPad && this.taken >= this.required) {
      if (Math.abs(this.vx) > 80 && this.padNag <= 0) {
        this.padNag = 2;
        this.banner.show('DOCKING CLAMPS ENGAGED', PALETTE.cyanLaser, 900);
      }
      this.vx *= Math.exp(-7 * dt);
    }
    if (onPad && Math.hypot(this.vx, this.vy) < 80) {
      if (this.taken >= this.required) {
        this.win();
        return;
      } else if (this.padNag <= 0) {
        this.padNag = 3;
        this.banner.show(`NEED ${this.required} CORES — DRIVE BACK [A]`, PALETTE.beaconGold, 1500);
        SoundFX.playBuzz();
      }
    }

    if (this.hull <= 0) this.fail('HULL BREACHED — TOO MANY HARD LANDINGS');
    else if (this.battery <= 0) this.fail('BATTERY DEPLETED — ROVER STALLED');

    // Rooster tail from the rear wheel under power
    const rear = this.wheels[0];
    if (rear.contact && throttle !== 0 && !this.reduced) {
      const n = Math.min(4, Math.abs(this.vx) / 50 + 1);
      for (let i = 0; i < n; i++) {
        this.dust.emit({
          x: rear.cx - Math.sign(this.vx || 1) * 4, y: rear.cy + WHEEL_R - 1,
          vx: -this.vx * 0.5 + (Math.random() - 0.5) * 30, vy: -40 - Math.random() * 60,
          gravity: this.gravity * 0.6, drag: 0.6, life: 0.9, color: this.ramp()[this.inDust(rear.cx) ? 3 : 4], size: Math.random() > 0.6 ? 2 : 1,
        });
      }
    }
  }

  private tangent(x: number): { x: number; y: number } {
    const s = this.slopeAt(x);
    const l = Math.hypot(1, s);
    return { x: 1 / l, y: s / l };
  }

  /** World position of a chassis-local point. */
  private local(lx: number, ly: number): { x: number; y: number } {
    const c = Math.cos(this.a), s = Math.sin(this.a);
    return { x: this.x + lx * c - ly * s, y: this.y + lx * s + ly * c };
  }

  /** Semi-implicit Euler rigid body with sprung wheels and traction. */
  private integrate(dt: number, throttle: number): void {
    let fx = 0;
    let fy = this.gravity;
    let torque = 0;
    const c = Math.cos(this.a), s = Math.sin(this.a);
    const grounded = this.wheels.some((wh) => wh.contact);
    // Chassis pitch relative to the ground under it (negative = nose up)
    const relPitch = Phaser.Math.Angle.Wrap(this.a - Math.atan(this.slopeAt(this.x)));
    // Traction control: ease off the drive as the nose lifts, so climbs never flip it backwards
    const driveScale = Phaser.Math.Clamp(1 + (relPitch + 0.35) * 2.5, 0.25, 1);

    for (const wh of this.wheels) {
      const anchor = this.local(wh.lx, AXLE_Y);
      // Wheel rests REST px below its anchor along the chassis "down" axis
      let cx = anchor.x - s * REST;
      let cy = anchor.y + c * REST;
      const gy = this.groundAt(cx);
      const pen = cy + WHEEL_R - gy;
      wh.contact = pen > 0;
      wh.pen = Math.max(0, pen);
      if (wh.contact) cy = gy - WHEEL_R;
      wh.cx = cx;
      wh.cy = cy;
      if (!wh.contact) continue;

      const sl = this.slopeAt(cx);
      const ln = Math.hypot(1, sl);
      const nx = sl / ln, ny = -1 / ln; // upward normal
      const tx = 1 / ln, ty = sl / ln; // forward tangent
      const rx = cx - this.x, ry = (cy + WHEEL_R) - this.y;
      const pvx = this.vx - this.w * ry;
      const pvy = this.vy + this.w * rx;
      const vn = pvx * nx + pvy * ny;
      const vt = pvx * tx + pvy * ty;
      let fn = SPRING_K * wh.pen - SPRING_C * vn;
      if (fn < 0) fn = 0;

      // Hard stop: suspension fully compressed
      if (wh.pen > 9) {
        this.x += nx * (wh.pen - 9) * 0.5;
        this.y += ny * (wh.pen - 9) * 0.5;
        if (vn < 0) {
          this.vx -= nx * vn * 0.5;
          this.vy -= ny * vn * 0.5;
        }
      }

      const traction = this.inDust(cx) ? 0.65 : 1;
      let ft = -vt * (this.inDust(cx) ? 0.8 : 0.3); // rolling resistance
      if (throttle > 0 && vt < VMAX) ft += DRIVE * 0.5 * traction * driveScale;
      else if (throttle < 0) ft += vt > 20 ? -BRAKE * 0.5 : -DRIVE * 0.35 * traction;
      // Friction circle: low gravity means low grip, loose dust even less
      const grip = 1.6 * fn * traction + 10;
      ft = Phaser.Math.Clamp(ft, -grip, grip);

      const Fx = nx * fn + tx * ft;
      const Fy = ny * fn + ty * ft;
      fx += Fx;
      fy += Fy;
      torque += rx * Fy - ry * Fx;
      wh.spin += (vt / WHEEL_R) * dt;
    }

    if (!grounded) {
      // Mid-air attitude control: A tilts back (nose up), D tilts forward.
      // With no key held the chassis eases back toward the ground's angle.
      if (throttle !== 0) {
        torque += throttle * 6 * INERTIA;
        this.w *= Math.exp(-1.2 * dt);
      } else {
        const rel = Phaser.Math.Angle.Wrap(this.a - Math.atan(this.slopeAt(this.x + this.vx * 0.15)));
        torque += (-rel * 7 - this.w * 2.5) * INERTIA;
      }
      for (const wh of this.wheels) wh.spin += (this.vx / WHEEL_R) * dt * 0.2;
    } else {
      this.w *= Math.exp(-2.2 * dt);
      // Low centre of gravity: past ~17° off the ground's angle the chassis pulls itself back down
      const over = Math.sign(relPitch) * Math.max(0, Math.abs(relPitch) - 0.3);
      torque += (-over * 14 - this.w * 1.5 * Math.min(1, Math.abs(over) * 4)) * INERTIA;
    }

    this.vx += fx * dt;
    this.vy += fy * dt;
    this.w += (torque / INERTIA) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.a = Phaser.Math.Angle.Wrap(this.a + this.w * dt);

    if (this.x < 40) { this.x = 40; this.vx = Math.max(0, this.vx); }
    if (this.x > COURSE - 60) { this.x = COURSE - 60; this.vx = Math.min(0, this.vx); }
    if (this.y < 20) { this.y = 20; this.vy = Math.max(0, this.vy); }
  }

  private damage(msg: string): void {
    if (this.hitCooldown > 0) return;
    this.hitCooldown = 0.8;
    this.hull = Math.max(0, this.hull - 1);
    this.banner.show(msg, PALETTE.thrusterOrange, 1200);
    SoundFX.playCrash();
    if (!this.reduced) this.cameras.main.shake(220, 0.01);
    this.sparks.burst(12, { x: this.x, y: this.y + 6, color: PALETTE.thrusterOrangeHex, life: 0.45, drag: 2.5, gravity: this.gravity }, 120, Math.PI, -Math.PI / 2);
  }

  private rollover(): void {
    this.rolloverT = 0;
    this.banner.show('ROLLOVER — RIGHTING CHASSIS · BATTERY −5', PALETTE.beaconGold, 1200);
    SoundFX.playThud(0.6);
    this.battery = Math.max(0, this.battery - 5);
    this.x = Math.max(60, this.x - 40);
    this.y = this.groundAt(this.x) - 24;
    this.vx = this.vy = this.w = 0;
    this.a = Math.atan(this.slopeAt(this.x));
    this.airTime = 0; // the reset drop must not be graded as a landing
    for (const wh of this.wheels) wh.contact = true;
  }

  private landingDust(n: number): void {
    if (this.reduced) return;
    for (const wh of this.wheels) {
      this.dust.burst(Math.round(n), { x: wh.cx, y: wh.cy + WHEEL_R, color: this.ramp()[4], gravity: this.gravity * 0.5, drag: 1, life: 0.8 }, 70, Math.PI * 0.9, -Math.PI / 2);
    }
  }

  private win(): void {
    this.ended = true;
    SoundFX.setRover(0);
    SoundFX.playTouchdown();
    SoundFX.playChime(7);
    this.banner.show('EXTRACTION CONFIRMED — CORES LOGGED', PALETTE.beaconGold, 2000);
    if (!this.reduced) {
      this.timeScale = 0.35;
      this.cameras.main.zoomTo(1.6, 900, 'Sine.easeInOut');
      this.cameras.main.pan(this.x, this.y - 10, 900, 'Sine.easeInOut');
    }
    completeMinigame(this, this.siteId, this.assisted, Math.round(this.battery), this.hull, 1700);
  }

  private fail(reason: string): void {
    this.ended = true;
    SoundFX.setRover(0);
    this.banner.show(reason, PALETTE.thrusterOrange, 3000);
    SoundFX.playCrash();
    if (!this.reduced) this.timeScale = 0.4;
    failMinigame(this, this.siteId, 1300);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  private render(dt: number): void {
    const cam = this.cameras.main;
    if (!this.ended || this.reduced) {
      const look = Phaser.Math.Clamp(this.vx * 0.5, -80, 120);
      const target = Phaser.Math.Clamp(this.x - 230 + look, 0, COURSE - W);
      cam.scrollX += (target - cam.scrollX) * (this.reduced ? 1 : 1 - Math.exp(-5 * dt));
    }

    // Beacon at the pad
    const b = this.beacon;
    b.clear();
    const py = this.heights[PAD_X0];
    const pulse = 0.5 + 0.5 * Math.sin(this.time.now / 200);
    b.fillStyle(this.taken >= this.required ? PALETTE.cyanLaserHex : PALETTE.beaconGoldHex, 0.25 + pulse * 0.5).fillRect(PAD_X0 - 2, py - 34, 3, 3).fillRect(PAD_X1, py - 34, 3, 3);
    if (this.ended && this.taken >= this.required) {
      b.fillStyle(PALETTE.cyanLaserHex, 0.18).fillRect((PAD_X0 + PAD_X1) / 2 - 10, 0, 20, py);
    }

    // Rover: chassis, foil, mast + dish, struts, wheels
    const g = this.roverGfx;
    g.clear();
    const P = (lx: number, ly: number) => this.local(lx, ly);
    const poly = (pts: [number, number][], color: number, alpha = 1) => {
      g.fillStyle(color, alpha).fillPoints(pts.map(([lx, ly]) => P(lx, ly)), true);
    };
    for (const wh of this.wheels) {
      const an = P(wh.lx, AXLE_Y);
      g.lineStyle(2, PALETTE.lunarRegolithMidHex, 1).lineBetween(an.x, an.y, wh.cx, wh.cy);
    }
    poly([[-19, -4], [19, -4], [21, 2], [-21, 2]], PALETTE.deepIndigoHex);
    poly([[-18, -3], [18, -3], [20, 1], [-20, 1]], PALETTE.lunarDustLightHex);
    poly([[-18, -3], [18, -3], [18, -2], [-18, -2]], PALETTE.lunarHighlightHex);
    poly([[-12, 1], [6, 1], [6, 5], [-12, 5]], PALETTE.beaconGoldHex);
    poly([[-12, 4], [6, 4], [6, 5], [-12, 5]], PALETTE.emberShadowHex);
    const m0 = P(15, -3), m1 = P(15, -16);
    g.lineStyle(1, PALETTE.lunarCrustCreamHex, 1).lineBetween(m0.x, m0.y, m1.x, m1.y);
    poly([[10, -18], [20, -18], [17, -15], [13, -15]], PALETTE.lunarCrustCreamHex);
    const lamp = P(15, -19);
    g.fillStyle(PALETTE.cyanLaserHex, 0.5 + 0.5 * Math.sin(this.time.now / 160)).fillRect(Math.round(lamp.x), Math.round(lamp.y), 1, 1);
    for (const wh of this.wheels) {
      g.fillStyle(PALETTE.deepIndigoHex, 1).fillCircle(wh.cx, wh.cy, WHEEL_R + 1);
      g.fillStyle(PALETTE.lunarBasaltDarkHex, 1).fillCircle(wh.cx, wh.cy, WHEEL_R);
      g.fillStyle(PALETTE.lunarRegolithMidHex, 1).fillCircle(wh.cx, wh.cy, WHEEL_R - 2);
      for (let k = 0; k < 3; k++) {
        const sa = wh.spin + (k * Math.PI) / 3;
        g.lineStyle(1, PALETTE.lunarDustLightHex, 1).lineBetween(wh.cx - Math.cos(sa) * 4, wh.cy - Math.sin(sa) * 4, wh.cx + Math.cos(sa) * 4, wh.cy + Math.sin(sa) * 4);
      }
      g.fillStyle(PALETTE.lunarCrustCreamHex, 1).fillRect(Math.round(wh.cx), Math.round(wh.cy), 1, 1);
    }
    // UNIT-7 rides on the deck
    const seat = P(-5, -3);
    this.robot.setPosition(seat.x, seat.y).setRotation(this.a);
    const flash = this.hitCooldown > 0 && Math.floor(this.hitCooldown * 16) % 2 === 0;
    this.robot.setAlpha(flash ? 0.4 : 1);
    g.setAlpha(flash ? 0.6 : 1);

    this.dust.draw();
    this.sparks.draw();
    this.renderHUD();
    SoundFX.setRover(this.ended || !this.started ? 0 : this.wheels.some((wh) => wh.contact) ? Phaser.Math.Clamp(Math.abs(this.vx) / VMAX, 0.2, 1) : 0.1);
  }
}
