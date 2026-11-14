import Phaser from 'phaser';
import { resolveStoryTokens } from '../data/story.ts';
import { CONSTANTS } from '../core/Constants.ts';
import { GameState } from '../core/GameState.ts';
import { TalkClock } from '../ui/Talk.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { Soundscape } from '../audio/Soundscape.ts';
import { PALETTE } from '../ui/theme.ts';
import { NineSliceHUD, HUD_FONT } from '../ui/NineSliceHUD.ts';
import { CinematicTimeline, CinematicEvent, CinematicSpriteCue } from '../data/schema.ts';
import {
  BackdropKind,
  CIN_MARGIN,
  getCinematicBackdrop,
  buildPlanet,
  buildBoosterSprite,
  RidgeLayer,
} from './TitleArt.ts';
import { ensureBackdropTextures } from './BackdropTextures.ts';

interface ExhaustParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
}

interface BackdropInstance {
  kind: BackdropKind;
  objects: Phaser.GameObjects.GameObject[];
  near?: RidgeLayer;
}

type Fadeable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.AlphaSingle & Phaser.GameObjects.Components.Depth & Phaser.GameObjects.Components.Visible;

/** Parallax scroll factors per backdrop layer (1 = moves with the camera's world). */
const SF = { sky: 0.6, celestial: 0.8, far: 0.8, mid: 0.9, near: 1 } as const;

/** Where each sprite's "feet" are, so `ground` placement and thrusters line up. */
function originFor(texture: string): [number, number] {
  if (texture === 'robot_idle') return [0.5, 21 / 24];
  if (texture === 'cin_booster') return [0.5, 1];
  if (texture.startsWith('hw_')) return [0.5, 27 / 32];
  return [0.5, 0.5];
}

export class CinematicPlayer {
  private scene: Phaser.Scene;
  private timeline: CinematicTimeline;
  private onCompleteCallback: () => void;

  private elapsedTime: number = 0;
  private eventIndex: number = 0;
  private captionCount: number = 0;
  private captionTotal: number = 0;
  private isFinished: boolean = false;
  private reducedMotion: boolean = false;

  // World (zoomed/panned by the main camera) vs. UI (fixed, own camera)
  private worldLayer!: Phaser.GameObjects.Layer;
  private uiLayer!: Phaser.GameObjects.Layer;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;

  private backdrops: Map<BackdropKind, BackdropInstance> = new Map();
  private activeBackdrop: BackdropKind = 'moon';
  private backdropActivations: number = 0;

  private sprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private thrusterGlows: Map<string, Phaser.GameObjects.Image> = new Map();
  private activeThrusterIds: Set<string> = new Set();
  private thrusterFlameGraphics!: Phaser.GameObjects.Graphics;
  private particles: ExhaustParticle[] = [];
  private particleGraphics!: Phaser.GameObjects.Graphics;

  // Caption console
  private headerText!: Phaser.GameObjects.Text;
  private counterText!: Phaser.GameObjects.Text;
  private captionText!: Phaser.GameObjects.Text;
  private continueMark!: Phaser.GameObjects.Text;

  // Typewriter state
  private fullCaption: string = '';
  private isTyping: boolean = false;
  private talk = new TalkClock();
  /** Timeline time before which the next caption may not start (UNIT-7 is still talking, then a short read). */
  private captionReadyAt: number = 0;

  constructor(scene: Phaser.Scene, timeline: CinematicTimeline, onComplete: () => void) {
    this.scene = scene;
    this.timeline = timeline;
    this.onCompleteCallback = onComplete;
  }

  create(): void {
    const W = CONSTANTS.CANVAS.WIDTH;
    const H = CONSTANTS.CANVAS.HEIGHT;

    this.elapsedTime = 0;
    this.eventIndex = 0;
    this.captionCount = 0;
    this.captionTotal = this.timeline.events.filter(e => e.caption).length;
    this.isFinished = false;
    this.sprites.clear();
    this.thrusterGlows.clear();
    this.activeThrusterIds.clear();
    this.backdrops.clear();
    this.backdropActivations = 0;
    this.particles = [];
    this.reducedMotion = GameState.getState().settings.reducedMotion;

    this.ensureTextures();

    // 1. Two render layers: the main camera only sees the world, a second
    //    fixed camera only sees the UI, so zoom/pan/shake never move the HUD.
    this.worldLayer = this.scene.add.layer().setDepth(0);
    this.uiLayer = this.scene.add.layer().setDepth(1000);

    const main = this.scene.cameras.main;
    main.setBackgroundColor(PALETTE.spaceBlack);
    this.uiCamera = this.scene.cameras.add(0, 0, W, H, false, 'cinematic-ui');
    main.ignore(this.uiLayer);
    this.uiCamera.ignore(this.worldLayer);

    // 2. Backdrops (initial world + any the timeline cross-fades to)
    const initialBackdrop: BackdropKind =
      this.timeline.world === 'elsewhere' ? 'space' : this.timeline.world;
    const kinds = new Set<BackdropKind>([initialBackdrop]);
    for (const evt of this.timeline.events) {
      if (evt.backdrop) kinds.add(evt.backdrop.kind);
    }
    for (const kind of kinds) {
      this.backdrops.set(kind, this.buildBackdrop(kind));
    }
    this.activeBackdrop = initialBackdrop;
    this.showBackdrop(initialBackdrop, 0);

    // 3. Thruster flames and exhaust particles (world space)
    this.thrusterFlameGraphics = this.world(this.scene.add.graphics().setDepth(23));
    this.particleGraphics = this.world(this.scene.add.graphics().setDepth(24));

    // 4. Fixed UI: edge fade, vignette, caption console, skip button
    this.createScreenFx(W, H);
    this.createCaptionConsole(W, H);
    this.createSkipButton(W);

    this.setupInputListeners();

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.scene.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());
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
    // Keep the main camera from hit-testing UI zones with its zoomed transform
    this.scene.cameras.main.ignore(obj);
    return obj;
  }

  private ensureTextures(): void {
    const tex = this.scene.textures;
    const kinds: BackdropKind[] = ['moon', 'mars', 'space'];
    for (const kind of kinds) {
      const used = kind === this.timeline.world || this.timeline.events.some(e => e.backdrop?.kind === kind);
      if (used) ensureBackdropTextures(tex, kind);
    }
    if (!tex.exists('cin_planet_moon')) {
      tex.addCanvas('cin_planet_moon', buildPlanet(22, [PALETTE.deepIndigo, PALETTE.lunarRegolithDeep, PALETTE.lunarDustLight, PALETTE.lunarCrustCream], 5, false));
    }
    if (!tex.exists('cin_planet_mars')) {
      tex.addCanvas('cin_planet_mars', buildPlanet(44, [PALETTE.marsShadowUmber, PALETTE.marsDeepRust, PALETTE.marsTerracotta, PALETTE.marsDustTan], 9, true));
    }
    if (!tex.exists('cin_booster')) {
      tex.addCanvas('cin_booster', buildBoosterSprite());
    }
  }

  // ---------------------------------------------------------------------------
  // Backdrops
  // ---------------------------------------------------------------------------

  private buildBackdrop(kind: BackdropKind): BackdropInstance {
    const M = CIN_MARGIN;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const add = <T extends Fadeable>(obj: T, sf: number, layerOrder: number): T => {
      (obj as unknown as Phaser.GameObjects.Components.ScrollFactor).setScrollFactor(sf);
      obj.setData('baseAlpha', obj.alpha);
      obj.setData('layerOrder', layerOrder);
      objects.push(obj);
      return this.world(obj);
    };

    const data = getCinematicBackdrop(kind);
    add(this.scene.add.image(-M, -M, `cin_${kind}_sky`).setOrigin(0, 0), SF.sky, 0);

    // Twinkling stars
    for (let i = 0; i < 14; i++) {
      const x = ((i * 151) % (640 + M)) - M / 2;
      const y = ((i * 67) % 210) - M / 2;
      const color = i % 5 === 0 ? PALETTE.cyanLaserHex : PALETTE.lunarHighlightHex;
      const g = this.scene.add.graphics();
      g.fillStyle(color, 1);
      g.fillRect(x, y, 1, 1);
      if (i % 3 === 0) {
        g.fillStyle(color, 0.45);
        g.fillRect(x - 1, y, 1, 1);
        g.fillRect(x + 1, y, 1, 1);
        g.fillRect(x, y - 1, 1, 1);
        g.fillRect(x, y + 1, 1, 1);
      }
      add(g, SF.sky, 1);
      if (!this.reducedMotion) {
        this.scene.tweens.add({
          targets: g,
          alpha: 0.15,
          duration: 900 + (i % 6) * 280,
          delay: (i * 310) % 2200,
          yoyo: true,
          repeat: -1,
          ease: 'Stepped',
          easeParams: [3],
        });
      }
    }

    this.addCelestials(kind, (o, order) => add(o as Fadeable, SF.celestial, order));

    if (data.far) add(this.scene.add.image(-M, -M, `cin_${kind}_far`).setOrigin(0, 0), SF.far, 3);
    if (data.mid) {
      add(this.scene.add.image(-M, -M, `cin_${kind}_mid`).setOrigin(0, 0), SF.mid, 4);
      this.addDistantMachine(kind, data.mid, (o) => add(o as Fadeable, SF.mid, 5));
    }
    if (data.near) add(this.scene.add.image(-M, -M, `cin_${kind}_near`).setOrigin(0, 0), SF.near, 6);

    // Start hidden; showBackdrop fades it in
    for (const o of objects) (o as Fadeable).setAlpha(0);

    return { kind, objects, near: data.near };
  }

  private addCelestials(kind: BackdropKind, add: (o: Phaser.GameObjects.GameObject, order: number) => void): void {
    if (kind === 'moon') {
      // Positioned so the "look up at Earth" camera shots frame it nicely
      const glow = this.scene.add.image(428, 108, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setScale(3.2).setAlpha(0.2);
      const earth = this.scene.add.sprite(428, 108, 'earth_spin', 0);
      if (!this.reducedMotion && this.scene.anims.exists('earth_rotate')) earth.play('earth_rotate');
      add(glow, 2);
      add(earth, 2);
    } else if (kind === 'mars') {
      // The pale blue dot, seen from Mars
      const glow = this.scene.add.image(448, 92, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.35);
      const dot = this.scene.add.image(448, 92, 'earth_mars');
      add(glow, 2);
      add(dot, 2);
    } else {
      // Interplanetary cruise: Earth and Moon receding left, Mars ahead right
      const earth = this.scene.add.sprite(118, 128, 'earth_spin', 0).setScale(0.5);
      if (!this.reducedMotion && this.scene.anims.exists('earth_rotate')) earth.play('earth_rotate');
      const earthGlow = this.scene.add.image(118, 128, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setScale(1.5).setAlpha(0.15);
      const moon = this.scene.add.image(160, 112, 'cin_planet_moon');
      const mars = this.scene.add.image(540, 230, 'cin_planet_mars');
      add(earthGlow, 2);
      add(earth, 2);
      add(moon, 2);
      add(mars, 2);
    }
  }

  /** A real machine left on the far ridge, beacon still blinking. */
  private addDistantMachine(kind: BackdropKind, mid: RidgeLayer, add: (o: Phaser.GameObjects.GameObject) => void): void {
    const key = kind === 'moon' ? 'hw_surveyor-3' : 'hw_viking-1-2';
    if (!this.scene.textures.exists(key)) return;
    const x = kind === 'moon' ? 96 : 560;
    const surface = mid.heights[x + CIN_MARGIN] - CIN_MARGIN;
    const machine = this.scene.add.image(x, surface + 2, key)
      .setOrigin(0.5, 27 / 32)
      .setScale(0.75)
      .setTint(kind === 'moon' ? PALETTE.lunarDustLightHex : PALETTE.marsDustTanHex);
    const beaconY = surface + 2 - 22 * 0.75;
    const beacon = this.scene.add.image(x, beaconY, 'glow_thruster').setBlendMode(Phaser.BlendModes.ADD).setScale(0.22).setAlpha(0.9);
    add(machine);
    add(beacon);
    if (!this.reducedMotion) {
      this.scene.tweens.add({ targets: beacon, alpha: 0.05, duration: 140, hold: 220, repeatDelay: 2300, yoyo: true, repeat: -1 });
    }
  }

  private showBackdrop(kind: BackdropKind, fadeSeconds: number): void {
    const next = this.backdrops.get(kind);
    if (!next) return;
    Soundscape.set({ ambience: kind, ambienceLevel: 0.7, fade: Math.max(1.5, fadeSeconds * 1.5) });
    const prev = this.backdrops.get(this.activeBackdrop);
    this.activeBackdrop = kind;

    // Newest backdrop draws on top of the previous one while it fades in
    const base = -80 + this.backdropActivations * 8;
    this.backdropActivations++;
    for (const o of next.objects) {
      const f = o as Fadeable;
      f.setDepth(base + (o.getData('layerOrder') as number));
      f.setVisible(true);
    }

    const duration = this.reducedMotion ? 0 : fadeSeconds * 1000;
    const finish = () => {
      if (prev && prev !== next) {
        for (const o of prev.objects) (o as Fadeable).setVisible(false);
      }
    };

    if (duration <= 0) {
      for (const o of next.objects) (o as Fadeable).setAlpha(o.getData('baseAlpha') as number);
      finish();
      return;
    }

    const fader = { t: 0 };
    this.scene.tweens.add({
      targets: fader,
      t: 1,
      duration,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        for (const o of next.objects) (o as Fadeable).setAlpha((o.getData('baseAlpha') as number) * fader.t);
      },
      onComplete: finish,
    });
  }

  /** World-space ground height of the active backdrop at x (undefined in space). */
  private groundAt(x: number): number | undefined {
    const near = this.backdrops.get(this.activeBackdrop)?.near;
    if (!near) return undefined;
    const i = Phaser.Math.Clamp(Math.round(x) + CIN_MARGIN, 0, near.heights.length - 1);
    return near.heights[i] - CIN_MARGIN + 1;
  }

  // ---------------------------------------------------------------------------
  // Fixed UI
  // ---------------------------------------------------------------------------

  private createScreenFx(W: number, H: number): void {
    const edge = this.ui(this.scene.add.graphics().setDepth(90));
    const fadeW = 36;
    const k = PALETTE.spaceBlackHex;
    edge.fillGradientStyle(k, k, k, k, 1, 0, 1, 0);
    edge.fillRect(0, 0, fadeW, H);
    edge.fillGradientStyle(k, k, k, k, 0, 1, 0, 1);
    edge.fillRect(W - fadeW, 0, fadeW, H);
    // Gentle top fade so the sky meets the letterbox softly
    edge.fillGradientStyle(k, k, k, k, 0.6, 0.6, 0, 0);
    edge.fillRect(0, 0, W, 28);

    if (this.scene.textures.exists('vignette_overlay')) {
      this.ui(this.scene.add.image(W / 2, H / 2, 'vignette_overlay').setDepth(95).setAlpha(0.8));
    }
  }

  private createCaptionConsole(W: number, H: number): void {
    const boxW = W - 48;
    const boxH = 58;
    const boxX = 24;
    const boxY = H - boxH - 14;

    const box = this.ui(this.scene.add.graphics().setDepth(100));
    NineSliceHUD.drawFrame(box, boxX, boxY, boxW, boxH, 'panel');

    // Bright HUD corner brackets (same as the title menu)
    box.fillStyle(PALETTE.cyanLaserHex, 1);
    const bx0 = boxX - 2;
    const by0 = boxY - 2;
    const bx1 = boxX + boxW + 2;
    const by1 = boxY + boxH + 2;
    const arm = 5;
    box.fillRect(bx0, by0, arm, 1);
    box.fillRect(bx0, by0, 1, arm);
    box.fillRect(bx1 - arm, by0, arm, 1);
    box.fillRect(bx1 - 1, by0, 1, arm);
    box.fillRect(bx0, by1 - 1, arm, 1);
    box.fillRect(bx0, by1 - arm, 1, arm);
    box.fillRect(bx1 - arm, by1 - 1, arm, 1);
    box.fillRect(bx1 - 1, by1 - arm, 1, arm);

    NineSliceHUD.drawStatusDot(box, boxX + 10, boxY + 9);
    box.fillStyle(PALETTE.atmosphericDuskHex, 1);
    box.fillRect(boxX + 8, boxY + 18, boxW - 16, 1);

    this.headerText = this.ui(this.scene.add.text(boxX + 17, boxY + 6, '', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.cyanLaser,
      letterSpacing: 2,
    }).setDepth(101));

    this.counterText = this.ui(this.scene.add.text(boxX + boxW - 10, boxY + 6, '', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.slateMuted,
      letterSpacing: 2,
    }).setOrigin(1, 0).setDepth(101));

    this.captionText = this.ui(this.scene.add.text(boxX + 10, boxY + 25, '', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarHighlight,
      letterSpacing: 1,
      wordWrap: { width: boxW - 34, useAdvancedWrap: true },
      lineSpacing: 4,
    }).setDepth(101));

    this.continueMark = this.ui(this.scene.add.text(boxX + boxW - 10, boxY + boxH - 7, '▶', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.cyanGlow,
    }).setOrigin(1, 1).setDepth(101).setVisible(false));

    if (!this.reducedMotion) {
      this.scene.tweens.add({ targets: this.continueMark, alpha: 0, duration: 450, yoyo: true, repeat: -1, ease: 'Stepped' });
    }
  }

  private createSkipButton(W: number): void {
    const btnW = 92;
    const btnH = 20;
    const btnX = W - btnW - 14;
    const btnY = 12;

    const bg = this.ui(this.scene.add.graphics().setDepth(100));
    NineSliceHUD.drawFrame(bg, btnX, btnY, btnW, btnH, 'secondary');

    const txt = this.ui(this.scene.add.text(btnX + btnW / 2, btnY + btnH / 2, 'SKIP [ESC] ➔', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarCrustCream,
      letterSpacing: 2,
    }).setOrigin(0.5).setDepth(101));

    const zone = this.ui(this.scene.add.zone(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH)
      .setDepth(102).setInteractive({ cursor: 'pointer' }));

    zone.on('pointerdown', () => this.skipCinematic());
    zone.on('pointerover', () => txt.setColor(PALETTE.cyanLaser));
    zone.on('pointerout', () => txt.setColor(PALETTE.lunarCrustCream));
  }

  private setupInputListeners(): void {
    const handleAdvance = () => {
      if (this.isTyping) {
        this.talk.finish();
        this.captionText.setText(this.talk.visible);
        this.isTyping = false;
        this.captionReadyAt = this.elapsedTime + 0.35;
        this.continueMark.setVisible(this.fullCaption.length > 0);
        SoundFX.playClick();
        return;
      }
      this.captionReadyAt = 0;
      if (this.eventIndex < this.timeline.events.length) {
        const nextEvt = this.timeline.events[this.eventIndex];
        this.elapsedTime = Math.max(this.elapsedTime, nextEvt.time);
        SoundFX.playClick();
      } else {
        this.skipCinematic();
      }
    };

    this.scene.input.keyboard?.on('keydown-SPACE', handleAdvance);
    this.scene.input.keyboard?.on('keydown-ENTER', handleAdvance);
    this.scene.input.keyboard?.on('keydown-ESC', () => this.skipCinematic());

    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.y > 40) handleAdvance();
    });
  }

  // ---------------------------------------------------------------------------
  // Playback
  // ---------------------------------------------------------------------------

  update(_time: number, delta: number): void {
    if (this.isFinished) return;

    const dt = delta / 1000;
    this.elapsedTime += dt;
    // Hold the timeline before the next caption until UNIT-7 has finished the current one.
    const nextCaption = this.timeline.events.slice(this.eventIndex).find((e) => e.caption);
    const gate = Math.min(nextCaption ? nextCaption.time : Infinity, this.timeline.totalDuration);
    if (this.elapsedTime < this.captionReadyAt || this.isTyping) {
      this.elapsedTime = Math.min(this.elapsedTime, gate - 0.001);
    }

    while (this.eventIndex < this.timeline.events.length && this.elapsedTime >= this.timeline.events[this.eventIndex].time) {
      this.executeEvent(this.timeline.events[this.eventIndex]);
      this.eventIndex++;
    }

    if (this.isTyping) {
      if (this.talk.tick(dt)) this.captionText.setText(this.talk.visible);
      if (this.talk.done) {
        this.isTyping = false;
        this.captionReadyAt = this.elapsedTime + 1.2;
      }
    }
    this.continueMark.setVisible(!this.isTyping && this.fullCaption.length > 0);

    this.updateThrusters(dt);

    if (this.elapsedTime >= this.timeline.totalDuration) {
      this.finishCinematic();
    }
  }

  /**
   * Keeps every camera framing inside the padded backdrop: zoom never drops
   * below 1 and the view rectangle never crosses CIN_MARGIN (minus shake slack).
   */
  private clampView(cx: number, cy: number, zoom: number): { cx: number; cy: number; zoom: number } {
    const W = CONSTANTS.CANVAS.WIDTH;
    const H = CONSTANTS.CANVAS.HEIGHT;
    const z = Math.max(1, zoom);
    const m = CIN_MARGIN - 12;
    const hw = W / (2 * z);
    const hh = H / (2 * z);
    return {
      cx: Phaser.Math.Clamp(cx, hw - m, W + m - hw),
      cy: Phaser.Math.Clamp(cy, hh - m, H + m - hh),
      zoom: z,
    };
  }

  private executeEvent(evt: CinematicEvent): void {
    const W = CONSTANTS.CANVAS.WIDTH;
    const H = CONSTANTS.CANVAS.HEIGHT;

    if (evt.backdrop) {
      this.showBackdrop(evt.backdrop.kind, evt.backdrop.fade ?? 1.5);
    }

    if (evt.camera) {
      const cam = this.scene.cameras.main;
      const durationMs = (evt.camera.duration ?? 2.5) * 1000;
      const curCx = cam.scrollX + W / 2;
      const curCy = cam.scrollY + H / 2;
      const view = this.clampView(evt.camera.x ?? curCx, evt.camera.y ?? curCy, evt.camera.zoom ?? cam.zoom);

      if (this.reducedMotion || durationMs <= 0) {
        cam.setScroll(view.cx - W / 2, view.cy - H / 2).setZoom(view.zoom);
      } else {
        this.scene.tweens.add({
          targets: cam,
          scrollX: view.cx - W / 2,
          scrollY: view.cy - H / 2,
          zoom: view.zoom,
          duration: durationMs,
          ease: 'Sine.easeInOut',
        });
      }

      if (evt.camera.shake && !this.reducedMotion) {
        cam.shake(evt.camera.shake.duration, evt.camera.shake.intensity);
      }
    }

    if (evt.sprites) {
      for (const cue of evt.sprites) this.applySpriteCue(cue);
    }

    if (evt.sound) {
      this.applySoundCue(evt.sound.cue, evt.sound.state ?? true);
    }

    if (evt.caption) {
      this.captionCount++;
      this.applyCaptionCue(evt.caption.tag, resolveStoryTokens(evt.caption.text));
    }
  }

  private applySpriteCue(cue: CinematicSpriteCue): void {
    let sprite = this.sprites.get(cue.id);
    const y = cue.ground ? (this.groundAt(cue.x) ?? cue.y) : cue.y;

    if (!sprite) {
      const tex = this.scene.textures.exists(cue.texture) ? cue.texture : 'robot_idle';
      const [ox, oy] = originFor(tex);
      sprite = this.world(this.scene.add.sprite(cue.x, y, tex)
        .setOrigin(ox, oy)
        .setScale(cue.scale ?? 1)
        .setAlpha(cue.alpha ?? 1)
        .setDepth(cue.depth ?? 20));
      this.sprites.set(cue.id, sprite);
    } else {
      // A new cue replaces any motion still running from the previous one
      this.scene.tweens.killTweensOf(sprite);
      sprite.setPosition(cue.x, y);
      if (cue.scale !== undefined) sprite.setScale(cue.scale);
      if (cue.alpha !== undefined) sprite.setAlpha(cue.alpha);
      if (cue.depth !== undefined) sprite.setDepth(cue.depth);
    }
    if (cue.visible !== undefined) sprite.setVisible(cue.visible);
    if (cue.rotation !== undefined) sprite.setAngle(cue.rotation);

    if (cue.thruster) {
      this.activeThrusterIds.add(cue.id);
    } else {
      this.activeThrusterIds.delete(cue.id);
    }

    let targetY = cue.targetY;
    if (cue.targetGround) {
      targetY = this.groundAt(cue.targetX ?? cue.x) ?? targetY;
    }

    const hasTween =
      cue.targetX !== undefined || targetY !== undefined || cue.targetAlpha !== undefined ||
      cue.targetScale !== undefined || cue.targetRotation !== undefined;

    if (hasTween) {
      const props: Record<string, number> = {};
      if (cue.targetX !== undefined) props.x = cue.targetX;
      if (targetY !== undefined) props.y = targetY;
      if (cue.targetAlpha !== undefined) props.alpha = cue.targetAlpha;
      if (cue.targetScale !== undefined) {
        props.scaleX = cue.targetScale;
        props.scaleY = cue.targetScale;
      }
      if (cue.targetRotation !== undefined) props.angle = cue.targetRotation;
      this.scene.tweens.add({
        targets: sprite,
        ...props,
        duration: (cue.duration ?? 3) * 1000,
        ease: 'Sine.easeInOut',
      });
    }
  }

  private applySoundCue(cue: string, state: boolean): void {
    switch (cue) {
      case 'thruster':
        SoundFX.setThruster(state);
        break;
      case 'click':
        SoundFX.playClick();
        break;
      case 'ping':
        SoundFX.playRadarPing(0.4);
        break;
      case 'touchdown':
        SoundFX.playTouchdown();
        break;
      case 'crash':
        SoundFX.playCrash();
        break;
      case 'rcs':
        SoundFX.playRCS();
        break;
    }
  }

  private applyCaptionCue(tag: string, text: string): void {
    const captionsEnabled = GameState.getState().settings.captionsEnabled;
    this.headerText.setText(tag.toUpperCase().replace(/_/g, ' '));
    this.counterText.setText(
      `${String(this.captionCount).padStart(2, '0')} / ${String(this.captionTotal).padStart(2, '0')}`
    );

    if (!captionsEnabled) {
      this.captionText.setText('');
      this.fullCaption = '';
      this.isTyping = false;
      return;
    }

    this.fullCaption = text;
    this.talk.start(text, { instant: this.reducedMotion });
    this.isTyping = !this.talk.done;
    this.captionReadyAt = this.isTyping ? Infinity : this.elapsedTime + 1.2;
    this.captionText.setText(this.talk.visible);
  }

  private updateThrusters(dt: number): void {
    this.thrusterFlameGraphics.clear();

    for (const [id, glow] of this.thrusterGlows) {
      if (!this.activeThrusterIds.has(id)) glow.setVisible(false);
    }

    for (const id of this.activeThrusterIds) {
      const sprite = this.sprites.get(id);
      if (!sprite || !sprite.visible) continue;

      // Exhaust leaves the sprite's base, along its local "down" axis
      const r = sprite.rotation;
      const dx = -Math.sin(r);
      const dy = Math.cos(r);
      const px = Math.cos(r);
      const py = Math.sin(r);
      const sx = sprite.x + dx * 1;
      const sy = sprite.y + dy * 1;
      const s = sprite.scaleX;
      const len = (14 + Math.random() * 7) * s;
      const core = (8 + Math.random() * 3) * s;
      const half = 3.5 * s;

      this.thrusterFlameGraphics.fillStyle(PALETTE.thrusterOrangeHex, 0.95);
      this.thrusterFlameGraphics.fillTriangle(
        sx - px * half, sy - py * half,
        sx + px * half, sy + py * half,
        sx + dx * len, sy + dy * len
      );
      this.thrusterFlameGraphics.fillStyle(PALETTE.beaconGoldHex, 0.9);
      this.thrusterFlameGraphics.fillTriangle(
        sx - px * half * 0.5, sy - py * half * 0.5,
        sx + px * half * 0.5, sy + py * half * 0.5,
        sx + dx * core, sy + dy * core
      );

      let glow = this.thrusterGlows.get(id);
      if (!glow) {
        glow = this.world(this.scene.add.image(sx, sy, 'glow_thruster').setBlendMode(Phaser.BlendModes.ADD).setDepth(22));
        this.thrusterGlows.set(id, glow);
      }
      glow.setVisible(true)
        .setPosition(sx + dx * 6 * s, sy + dy * 6 * s)
        .setScale(0.9 * s)
        .setAlpha(0.55 + Math.random() * 0.15);

      if (!this.reducedMotion) {
        for (let i = 0; i < 2; i++) {
          const spread = (Math.random() * 2 - 1) * 14;
          const speed = 45 + Math.random() * 45;
          this.particles.push({
            x: sx + px * (Math.random() * 6 - 3),
            y: sy + py * (Math.random() * 6 - 3),
            vx: dx * speed + px * spread,
            vy: dy * speed + py * spread,
            life: 0.4,
            maxLife: 0.4,
            color: Math.random() > 0.5 ? PALETTE.thrusterOrangeHex : PALETTE.beaconGoldHex,
            size: Math.random() > 0.6 ? 2 : 1,
          });
        }
      }
    }

    this.particleGraphics.clear();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      const t = p.life / p.maxLife;
      // Embers cool to dark as they fade
      this.particleGraphics.fillStyle(t > 0.45 ? p.color : PALETTE.emberShadowHex, t);
      this.particleGraphics.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
  }

  private finishCinematic(): void {
    if (this.isFinished) return;
    this.isFinished = true;
    this.cleanup();
    this.onCompleteCallback();
  }

  private skipCinematic(): void {
    SoundFX.playClick();
    this.finishCinematic();
  }

  private cleanup(): void {
    SoundFX.setThruster(false);
    this.activeThrusterIds.clear();
    this.particles = [];
    if (this.uiCamera) {
      this.scene.cameras.remove(this.uiCamera);
    }
  }
}
