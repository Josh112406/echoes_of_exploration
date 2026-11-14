import Phaser from 'phaser';
import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { TalkClock } from '../ui/Talk.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { Soundscape, TrackId } from '../audio/Soundscape.ts';
import { CONSTANTS } from '../core/Constants.ts';
import { PALETTE } from '../ui/theme.ts';
import { NineSliceHUD, HUD_FONT, FrameVariant } from '../ui/NineSliceHUD.ts';
import { BackdropKind, CIN_MARGIN, getCinematicBackdrop, buildPlanet, buildRingedPlanet, buildBoosterSprite } from '../systems/TitleArt.ts';
import { buildNebulaTile, buildStarTile, buildSunFlare, buildPeanutAsteroid } from '../systems/SpaceArt.ts';
import { ensureBackdropTextures } from '../systems/BackdropTextures.ts';
import { FINALE, getReel, getReelStats, getFinaleTheory, ReelSlide } from '../data/finale.ts';
import { sourceHost } from '../data/story.ts';
import type { MachineStatus } from '../data/schema.ts';

/** How a caption is framed: UNIT-7's thought, a sourced NASA record, or a machine's own record line. */
type CaptionKind = 'story' | 'record' | 'machine';

interface Caption {
  tag: string;
  text: string;
  kind: CaptionKind;
}

interface Beat {
  /** Runs once when the beat starts (scene changes, slides, animations). */
  enter?: () => void;
  caption?: Caption;
  /** Label for the top-right counter. */
  part?: string;
}

const W = CONSTANTS.CANVAS.WIDTH;
const H = CONSTANTS.CANVAS.HEIGHT;
const M = CIN_MARGIN;

/** After a beat starts, input is ignored this long so its entrance animation is seen. */
const BEAT_LOCK = 0.35;

/** Earth in the Mars sky (Mars record slides). */
const EARTH_IN_MARS_SKY = { x: 448, y: 92 };

/** The Elsewhere vista: where UNIT-7 hovers, the Sun, and Earth as one pale pixel beside it. */
const ROBOT_POS = { x: 458, y: 200 };
const SUN_POS = { x: 118, y: 76 };
const EARTH_POS = { x: 149, y: 98 };
/** Parallax of the Sun and Earth: effectively at infinity. */
const SKY_F = 0.06;
/** Letterbox bar height while a shot is "on film". */
const BAR_H = 24;

const STATUS_COLOR: Record<MachineStatus, number> = {
  active: PALETTE.cyanGlowHex,
  dormant: PALETTE.beaconGoldHex,
  ended: PALETTE.lunarDustLightHex,
  lost: PALETTE.marsDustTanHex,
  drifting: PALETTE.cyanDeepHex,
};

const CAPTION_COLOR: Record<CaptionKind, string> = {
  story: PALETTE.cyanLaser,
  record: PALETTE.beaconGold,
  machine: PALETTE.cyanLaser,
};

/**
 * The finale. It opens and closes in deep space (Elsewhere): UNIT-7 hovering in
 * the dark, the Sun a bright star and Earth one pale pixel beside it. Letterbox
 * bars frame those shots; a slow crane move and parallax drift keep them alive.
 * Four acts, all skippable and replayable:
 *  I.   THE RECORD : every recovered machine, in launch order, with its real NASA photo.
 *  II.  HOW FAR    : the worlds pull back; machines, worlds and years counted up.
 *  III. FARTHER    : NASA's next steps (sourced): Artemis, Europa Clipper, Dragonfly, Voyager.
 *  IV.  NOT DONE   : UNIT-7's resolution. It locks onto Earth, uplinks every echo
 *                    home, then drifts off until it is just another star; then the
 *                    end card with REPLAY ENDING.
 *
 * Nothing advances on a timer: each beat waits for a click, Space/Enter/→ or the
 * NEXT button, so the player sets the pace. Every change between beats is animated
 * (slides glide, the date ruler travels, years roll, titles track in), and all of it
 * collapses to instant cuts under reduced motion.
 */
export class EndingScene extends Phaser.Scene {
  private reducedMotion = false;
  private beats: Beat[] = [];
  private beatIdx = -1;
  private lockT = 0;
  private finished = false;

  // Caption console
  private capLayer!: Phaser.GameObjects.Container;
  private capTag!: Phaser.GameObjects.Text;
  private capPart!: Phaser.GameObjects.Text;
  private capText!: Phaser.GameObjects.Text;
  private capBox!: Phaser.GameObjects.Graphics;
  private capShown = false;
  private capVariant: FrameVariant | null = null;
  private capTyping = false;
  private talk = new TalkClock();
  private live: HTMLElement | null = null;

  // NEXT button
  private nextBg!: Phaser.GameObjects.Graphics;
  private nextTxt!: Phaser.GameObjects.Text;
  private nextZone!: Phaser.GameObjects.Zone;
  private nextReady: boolean | null = null;
  private nextHover = false;

  // Scenery
  private backdrops = new Map<BackdropKind, Phaser.GameObjects.Container>();
  private activeBackdrop: BackdropKind | null = null;
  private dim!: Phaser.GameObjects.Rectangle;
  private robot: Phaser.GameObjects.Sprite | null = null;
  private ion: Phaser.GameObjects.Image | null = null;
  private visor: Phaser.GameObjects.Image | null = null;

  // Elsewhere vista (opening and closing shots)
  private vista: Phaser.GameObjects.Container | null = null;
  private vistaFront: Phaser.GameObjects.Container | null = null;
  private vistaTiles: { obj: Phaser.GameObjects.TileSprite; f: number }[] = [];
  private vistaBodies: { obj: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle; x0: number; y0: number; f: number }[] = [];
  private rocks: { img: Phaser.GameObjects.Image; y0: number; vx: number; spin: number }[] = [];
  /** Virtual camera over the vista, in px; tweened for crane moves. */
  private vistaCam = { x: 0, y: 0 };
  private vistaT = 0;
  private vistaOffset = { x: 0, y: 0 };
  private earthGlow: Phaser.GameObjects.Image | null = null;
  private earthMark: Phaser.GameObjects.Container | null = null;
  private bars: Phaser.GameObjects.Rectangle[] = [];
  private uplink: Phaser.GameObjects.Text | null = null;
  private cardPending = false;

  // Act I
  private reel: ReelSlide[] = [];
  private slide: Phaser.GameObjects.Container | null = null;
  private slideMask: Phaser.GameObjects.Graphics | null = null;
  private photoItems: {
    el: HTMLDivElement;
    img: HTMLImageElement;
    slide: Phaser.GameObjects.Container;
    fx: number;
    fy: number;
    fw: number;
    fh: number;
    reveal: { h: number };
    kb: { scale: number; dx: number };
  }[] = [];
  private lastSlideYear: number | null = null;
  private rulerLayer!: Phaser.GameObjects.Container;
  private ruler!: Phaser.GameObjects.Graphics;
  private rulerFirst!: Phaser.GameObjects.Text;
  private rulerLast!: Phaser.GameObjects.Text;
  private rulerCur!: Phaser.GameObjects.Text;
  private rulerPing!: Phaser.GameObjects.Image;
  /** Animated marker state: x in px (-1 = not placed yet) and the year it reads. */
  private rulerAnim = { x: -1, year: 0 };

  // Act II
  private planets: Phaser.GameObjects.Container | null = null;
  /** Nebula + ringed giant behind the deep-space (Elsewhere) slides of Act I. */
  private deepStage: Phaser.GameObjects.Container | null = null;
  private stats: Phaser.GameObjects.Container | null = null;

  // Act III
  private track: Phaser.GameObjects.Container | null = null;
  private trackGfx: Phaser.GameObjects.Graphics | null = null;
  private trackLabels: Phaser.GameObjects.Text[] = [];
  private trackNodes: string[] = [];
  private trackLevel = 0;
  private trackAnim = { v: 0 };
  private booster: Phaser.GameObjects.Image | null = null;
  private flame!: Phaser.GameObjects.Graphics;
  private stars: { x: number; y: number; z: number }[] = [];
  private starGfx!: Phaser.GameObjects.Graphics;
  private warp = 0;
  private warpTarget = 0;

  // Section titles
  private section: Phaser.GameObjects.Container | null = null;

  // End card
  private card: HTMLElement | null = null;

  constructor() {
    super('EndingScene');
  }

  preload(): void {
    for (const { entry } of getReel()) {
      const key = `photo_${entry.id}`;
      if (!this.textures.exists(key)) this.load.image(key, entry.image.file);
    }
  }

  create(): void {
    document.body.classList.remove('in-game');
    GameState.setEpilogueSeen(true);
    // Same rule as the other scenes: the in-game Reduced Motion setting decides.
    this.reducedMotion = GameState.getState().settings.reducedMotion;
    this.finished = false;
    this.beatIdx = -1;
    this.lockT = 0;
    this.capShown = false;
    this.capVariant = null;
    this.nextReady = null;
    this.nextHover = false;
    this.lastSlideYear = null;
    this.rulerAnim = { x: -1, year: 0 };
    this.trackAnim = { v: 0 };
    this.vistaCam = { x: 0, y: 0 };
    this.vistaT = 0;
    this.cardPending = false;
    this.reel = getReel();

    // Real photos render smoothly; everything else stays pixel-crisp.
    for (const { entry } of this.reel) {
      const tex = this.textures.get(`photo_${entry.id}`);
      if (tex && tex.key !== '__MISSING') tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
    this.ensureTextures();
    this.cameras.main.setBackgroundColor(PALETTE.spaceBlack);
    if (!this.reducedMotion) this.cameras.main.fadeIn(900, 5, 7, 15);

    for (const kind of ['moon', 'mars', 'space'] as BackdropKind[]) this.backdrops.set(kind, this.buildBackdrop(kind));
    this.deepStage = this.buildDeepStage();
    this.buildVista();
    this.dim = this.add.rectangle(W / 2, H / 2, W, H, PALETTE.spaceBlackHex, 0).setDepth(5);
    this.bars = [
      this.add.rectangle(0, -BAR_H, W, BAR_H, PALETTE.spaceBlackHex, 1).setOrigin(0, 0).setDepth(85),
      this.add.rectangle(0, H, W, BAR_H, PALETTE.spaceBlackHex, 1).setOrigin(0, 0).setDepth(85),
    ];

    this.starGfx = this.add.graphics().setDepth(4);
    this.stars = Array.from({ length: 90 }, (_v, i) => ({ x: (i * 137) % W, y: (i * 71) % (H - 80), z: 0.3 + ((i * 53) % 70) / 100 }));
    this.flame = this.add.graphics().setDepth(31);
    this.createRuler();

    this.createScreenFx();
    this.createCaptionConsole();
    this.createNextButton();
    this.createSkipButton();
    this.createLiveRegion();
    this.bindInput();

    // Opening and Part I: the record, remembered
    Soundscape.set({ music: 'ending_record', ambience: 'space', ambienceLevel: 0.7, fade: 2.5 });
    this.beats = this.buildBeats();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.nextBeat();
  }

  /** Animation length, collapsed to an instant cut under reduced motion. */
  private ms(n: number): number {
    return this.reducedMotion ? 0 : n;
  }

  // ---------------------------------------------------------------------------
  // Script
  // ---------------------------------------------------------------------------

  private buildBeats(): Beat[] {
    const beats: Beat[] = [];
    const story = (text: string, tag = 'UNIT-7 // FINAL LOG'): Caption => ({ tag, text, kind: 'story' });
    const stats = getReelStats();

    // Opening: deep space, the robot flies in, the pale blue dot beside the Sun
    FINALE.opening.forEach((text, i) => beats.push({
      part: 'TRANSMISSION COMPLETE',
      enter: i === 0 ? () => this.setupVista(false, true) : undefined,
      caption: story(text),
    }));

    // I. THE RECORD
    beats.push({ part: 'I · THE RECORD', enter: () => this.showSection('PART I', 'THE RECORD', `${stats.firstYear} – ${stats.lastYear}`) });
    this.reel.forEach((r, i) => beats.push({
      part: `I · THE RECORD · ${String(i + 1).padStart(2, '0')} / ${String(this.reel.length).padStart(2, '0')}`,
      enter: () => this.showSlide(i),
      caption: { tag: `${r.entry.name.toUpperCase()} · ${r.year} · DRAMATIZED VOICE`, text: `"${r.entry.hook}"`, kind: 'machine' },
    }));

    // II. HOW FAR
    beats.push({ part: 'II · HOW FAR', enter: () => this.showSection('PART II', 'HOW FAR', 'THREE SECTORS, ONE RECORD', 'ending_far') });
    beats.push({ part: 'II · HOW FAR', enter: () => this.setupHowFar() });
    FINALE.reflection.forEach((text) => beats.push({ part: 'II · HOW FAR', caption: story(text, 'UNIT-7 // REFLECTION') }));
    const theory = getFinaleTheory();
    beats.push({ part: 'II · HOW FAR', caption: story(FINALE.theory_intro, 'UNIT-7 // REFLECTION') });
    beats.push({
      part: 'II · HOW FAR',
      caption: story(theory.text, theory.fromPlayer ? 'UNIT-7 THEORY // BUILT FROM YOUR JOURNAL' : 'UNIT-7 THEORY'),
    });

    // III. FARTHER
    beats.push({ part: 'III · FARTHER', enter: () => this.showSection('PART III', 'FARTHER', 'WHAT COMES NEXT', 'transition') });
    beats.push({ part: 'III · FARTHER', enter: () => this.setupFarther(), caption: story(FINALE.horizon_intro, 'UNIT-7 // REFLECTION') });
    FINALE.horizon.forEach((h, i) => {
      beats.push({
        part: `III · FARTHER · ${h.destination}`,
        enter: () => this.advanceTrack(i),
        caption: { tag: `VERIFIED RECORD · ${sourceHost(h.source_url).toUpperCase()}`, text: h.text, kind: 'record' },
      });
      if (h.thought) beats.push({ part: `III · FARTHER · ${h.destination}`, caption: story(h.thought, 'UNIT-7 // REFLECTION') });
    });

    // IV. NOT DONE: back out in the dark; UNIT-7 turns its antenna toward Earth
    beats.push({ part: 'IV · NOT DONE', enter: () => this.showSection('PART IV', 'NOT DONE', '', 'ending_resolve') });
    FINALE.resolution.forEach((text, i) => beats.push({
      part: 'IV · NOT DONE',
      enter: () => {
        if (i === 0) this.setupVista(true);
        else this.setDim(Math.min(0.3, 0.1 + i * 0.06), 2400);
        if (/earth/i.test(text)) this.markEarth();
      },
      caption: story(text),
    }));
    beats.push({ part: 'END OF TRANSMISSION', enter: () => this.showEndCard() });
    return beats;
  }

  private nextBeat(): void {
    if (this.finished) return;
    this.beatIdx++;
    const beat = this.beats[this.beatIdx];
    if (!beat) return;
    this.lockT = this.reducedMotion ? 0 : BEAT_LOCK;
    this.hideSection();
    beat.enter?.();
    if (this.finished) return;
    if (beat.caption) {
      this.setCaption(beat.caption, beat.part ?? '');
    } else {
      this.clearCaption();
      if (this.live && beat.part) this.live.textContent = `${beat.part}. Press Next to continue.`;
    }
  }

  update(_time: number, delta: number): void {
    const dt = Math.min(delta, 50) / 1000;
    this.updateStars(dt);
    this.updateBooster();
    this.updateVista(dt);
    this.syncPhotos();
    if (this.finished) return;

    if (this.lockT > 0) this.lockT -= dt;
    if (this.capTyping) {
      if (this.talk.tick(dt)) this.capText.setText(this.talk.visible);
      if (this.talk.done) {
        this.capTyping = false;
        this.nextReady = null;
      }
    }
    this.refreshNextButton();
  }

  /** True while not finished and beats remain (typing can be skipped immediately). */
  private canAdvance(): boolean {
    return !this.finished && this.beatIdx < this.beats.length - 1;
  }

  private advance(): void {
    if (this.finished) {
      // During the final shot, any input jumps straight to the end card
      if (this.cardPending) this.mountEndCard();
      return;
    }
    if (this.capTyping) {
      this.talk.finish();
      this.capText.setText(this.talk.visible);
      this.capTyping = false;
      this.lockT = 0;
      this.nextReady = null;
      SoundFX.playClick();
      this.refreshNextButton();
      return;
    }
    if (this.beatIdx >= this.beats.length - 1) return;
    this.lockT = 0;
    SoundFX.playClick();
    this.nextBeat();
  }

  private skipToEnd(): void {
    if (this.finished) return;
    SoundFX.playClick();
    this.hideSection();
    this.clearSlide();
    this.clearRuler();
    Soundscape.set({ music: 'ending_resolve', fade: 2 });
    this.beatIdx = this.beats.length - 2;
    this.setupVista(true);
    this.markEarth();
    this.nextBeat();
  }

  // ---------------------------------------------------------------------------
  // Captions
  // ---------------------------------------------------------------------------

  private setCaption(c: Caption, part: string): void {
    const variant: FrameVariant = c.kind === 'story' ? 'panel' : 'amber';
    this.tweens.killTweensOf(this.capLayer);
    this.tweens.killTweensOf(this.capTag);
    if (variant !== this.capVariant || !this.capShown) {
      this.capBox.clear();
      this.drawCaptionBox(variant);
      this.capVariant = variant;
    }
    this.capTag.setText(c.tag).setColor(CAPTION_COLOR[c.kind]);
    this.capPart.setText(part).setVisible(true);
    if (this.live) this.live.textContent = `${c.tag}: ${c.text}`;

    if (!this.capShown) {
      // The console rises in when it was hidden
      this.capLayer.setAlpha(0).setY(this.reducedMotion ? 0 : 8);
      this.tweens.add({ targets: this.capLayer, alpha: 1, y: 0, duration: this.ms(320), ease: 'Cubic.easeOut' });
    } else {
      this.capLayer.setAlpha(1).setY(0);
      this.capTag.setAlpha(0);
      this.tweens.add({ targets: this.capTag, alpha: 1, duration: this.ms(220) });
    }
    this.capShown = true;

    if (!GameState.getState().settings.captionsEnabled) {
      this.capText.setText('');
      this.capTyping = false;
      return;
    }
    this.talk.start(c.text, { instant: this.reducedMotion, record: c.kind !== 'story' });
    this.capTyping = !this.talk.done;
    this.nextReady = null;
    this.capText.setText(this.talk.visible);
  }

  private clearCaption(): void {
    this.capTyping = false;
    this.nextReady = null;
    if (!this.capShown) return;
    this.capShown = false;
    this.tweens.killTweensOf(this.capLayer);
    this.tweens.add({
      targets: this.capLayer, alpha: 0, y: this.reducedMotion ? 0 : 6, duration: this.ms(260), ease: 'Cubic.easeIn',
      onComplete: () => {
        if (this.capShown) return;
        this.capBox.clear();
        this.capVariant = null;
        this.capText.setText('');
        this.capTag.setText('');
        this.capPart.setText('');
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Scenery
  // ---------------------------------------------------------------------------

  private ensureTextures(): void {
    for (const kind of ['moon', 'mars', 'space'] as BackdropKind[]) ensureBackdropTextures(this.textures, kind);
    if (!this.textures.exists('cin_planet_moon')) {
      this.textures.addCanvas('cin_planet_moon', buildPlanet(22, [PALETTE.deepIndigo, PALETTE.lunarRegolithDeep, PALETTE.lunarDustLight, PALETTE.lunarCrustCream], 5, false));
    }
    if (!this.textures.exists('cin_planet_mars')) {
      this.textures.addCanvas('cin_planet_mars', buildPlanet(44, [PALETTE.marsShadowUmber, PALETTE.marsDeepRust, PALETTE.marsTerracotta, PALETTE.marsDustTan], 9, true));
    }
    if (!this.textures.exists('cin_booster')) this.textures.addCanvas('cin_booster', buildBoosterSprite());
    if (!this.textures.exists('cin_ringed_giant')) this.textures.addCanvas('cin_ringed_giant', buildRingedPlanet(96, 7));
    // Same art as the Elsewhere sector, so the finale is set where the journey ended
    const tex = (key: string, make: () => HTMLCanvasElement) => { if (!this.textures.exists(key)) this.textures.addCanvas(key, make()); };
    tex('space_nebula', () => buildNebulaTile(384, 61));
    tex('space_stars_far', () => buildStarTile(256, 520, 71, 0.55, false));
    tex('space_stars_mid', () => buildStarTile(320, 170, 83, 0.9, true));
    tex('space_stars_near', () => buildStarTile(384, 60, 97, 1.15, true));
    tex('space_sun_flare', () => buildSunFlare(48));
    tex('space_saturn', () => buildRingedPlanet(96, 17));
    tex('end_rock_a', () => buildPeanutAsteroid(22, 13, 41));
    tex('end_rock_b', () => buildPeanutAsteroid(14, 10, 43));
  }

  private buildBackdrop(kind: BackdropKind): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(0).setAlpha(0).setVisible(false);
    const data = getCinematicBackdrop(kind);
    c.add(this.add.image(-M, -M, `cin_${kind}_sky`).setOrigin(0, 0));
    if (kind === 'mars') {
      c.add(this.add.image(EARTH_IN_MARS_SKY.x, EARTH_IN_MARS_SKY.y, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setScale(0.35).setAlpha(0.35).setName('earthGlow'));
      c.add(this.add.image(EARTH_IN_MARS_SKY.x, EARTH_IN_MARS_SKY.y, 'earth_mars'));
    }
    if (data.far) c.add(this.add.image(-M, -M, `cin_${kind}_far`).setOrigin(0, 0));
    if (data.mid) c.add(this.add.image(-M, -M, `cin_${kind}_mid`).setOrigin(0, 0));
    if (data.near) c.add(this.add.image(-M, -M, `cin_${kind}_near`).setOrigin(0, 0));
    if (!this.reducedMotion) {
      this.tweens.add({ targets: c, x: -28, duration: 26000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    return c;
  }

  /** Deep-space stage for Elsewhere slides: soft nebula clouds and a distant ringed giant. */
  private buildDeepStage(): Phaser.GameObjects.Container {
    const c = this.add.container(0, 0).setDepth(2).setAlpha(0).setVisible(false);
    const clouds: [number, number, number, number, number][] = [
      [120, 90, 4.2, PALETTE.cyanShadowHex, 0.16], [250, 60, 3.0, PALETTE.atmosphericDuskHex, 0.22],
      [470, 120, 4.8, PALETTE.cyanVoidHex, 0.3], [560, 250, 3.4, PALETTE.cyanShadowHex, 0.12],
      [330, 230, 5.2, PALETTE.atmosphericDuskHex, 0.16],
    ];
    for (const [x, y, s, tint, a] of clouds) {
      c.add(this.add.image(x, y, 'glow_disk').setScale(s).setTint(tint).setAlpha(a).setBlendMode(Phaser.BlendModes.ADD));
    }
    const giant = this.add.image(560, 300, 'cin_ringed_giant').setAlpha(0.85);
    c.add(giant);
    if (!this.reducedMotion) {
      this.tweens.add({ targets: giant, x: 548, duration: 22000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    return c;
  }

  private setDeepStage(on: boolean): void {
    const c = this.deepStage;
    if (!c) return;
    this.tweens.killTweensOf(c);
    if (on) c.setVisible(true);
    this.tweens.add({
      targets: c, alpha: on ? 1 : 0, duration: this.ms(900), ease: 'Sine.easeInOut',
      onComplete: () => { if (!on) c.setVisible(false); },
    });
  }

  private showBackdrop(kind: BackdropKind, fade = 1.2): void {
    if (this.activeBackdrop === kind) return;
    const prev = this.activeBackdrop ? this.backdrops.get(this.activeBackdrop) : null;
    const next = this.backdrops.get(kind)!;
    this.activeBackdrop = kind;
    next.setVisible(true).setDepth(1);
    prev?.setDepth(0);
    const ms = this.ms(fade * 1000);
    this.tweens.add({ targets: next, alpha: 1, duration: ms, ease: 'Sine.easeInOut' });
    if (prev) this.tweens.add({ targets: prev, alpha: 0, duration: ms, ease: 'Sine.easeInOut', onComplete: () => prev.setVisible(false) });
  }

  private setDim(alpha: number, duration = 900): void {
    this.tweens.killTweensOf(this.dim);
    this.tweens.add({ targets: this.dim, fillAlpha: alpha, duration: this.ms(duration), ease: 'Sine.easeInOut' });
  }

  // ---------------------------------------------------------------------------
  // Elsewhere vista
  // ---------------------------------------------------------------------------

  /** Deep space as the Elsewhere sector paints it: nebula, three star depths, the Sun, Earth, a ringed giant. */
  private buildVista(): void {
    this.vistaTiles = [];
    this.vistaBodies = [];
    this.rocks = [];
    const c = this.add.container(0, 0).setDepth(1.5).setAlpha(0).setVisible(false);
    const pad = 90;
    c.add(this.add.rectangle(0, 0, W, H, PALETTE.spaceBlackHex, 1).setOrigin(0, 0));
    const tile = (key: string, f: number, alpha = 1) => {
      const t = this.add.tileSprite(-pad, -pad, W + pad * 2, H + pad * 2, key).setOrigin(0, 0).setAlpha(alpha);
      c.add(t);
      this.vistaTiles.push({ obj: t, f });
    };
    const body = <T extends Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle>(obj: T, f: number): T => {
      c.add(obj);
      this.vistaBodies.push({ obj, x0: obj.x, y0: obj.y, f });
      return obj;
    };
    const glow = (x: number, y: number, tint: number, sx: number, sy: number, alpha: number) =>
      body(this.add.image(x, y, 'glow_disk').setTint(tint).setScale(sx, sy).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD), SKY_F);

    tile('space_nebula', 0.04);
    tile('space_stars_far', 0.1);
    tile('space_stars_mid', 0.22);
    tile('space_stars_near', 0.4, 0.8);

    // The Sun: from this far out, just the brightest star, with an anamorphic streak
    glow(SUN_POS.x, SUN_POS.y, PALETTE.beaconGoldHex, 3.6, 3.6, 0.18);
    glow(SUN_POS.x, SUN_POS.y, PALETTE.lunarHighlightHex, 1.1, 1.1, 0.5);
    glow(SUN_POS.x, SUN_POS.y, PALETTE.cyanLaserHex, 9, 0.05, 0.4);
    glow(SUN_POS.x, SUN_POS.y, PALETTE.beaconGoldHex, 0.05, 2.2, 0.22);
    body(this.add.image(SUN_POS.x, SUN_POS.y, 'space_sun_flare').setBlendMode(Phaser.BlendModes.ADD), SKY_F);
    // Earth: one pale blue pixel
    this.earthGlow = glow(EARTH_POS.x, EARTH_POS.y, PALETTE.cyanLaserHex, 0.12, 0.12, 0.45);
    body(this.add.rectangle(EARTH_POS.x, EARTH_POS.y, 1, 1, PALETTE.cyanLaserHex), SKY_F);

    // A ringed giant close enough to fill a corner
    body(this.add.image(46, 262, 'space_saturn').setScale(2).setAlpha(0.9), 0.35);
    this.vista = c;

    // Foreground debris tumbling past, in front of the robot
    const front = this.add.container(0, 0).setDepth(22).setAlpha(0).setVisible(false);
    const rock = (key: string, x: number, y: number, vx: number, spin: number, scale: number) => {
      const img = this.add.image(x, y, key).setScale(scale).setTint(0x8a90b0);
      front.add(img);
      this.rocks.push({ img, y0: y, vx, spin });
    };
    rock('end_rock_a', 170, 300, -7, 9, 3);
    rock('end_rock_b', 600, 64, -11, -14, 2);
    rock('end_rock_b', 330, 226, -5, 6, 1);
    this.vistaFront = front;

    // The odd meteor streaking far off
    if (!this.reducedMotion) {
      this.time.addEvent({
        delay: 3800, loop: true, callback: () => {
          if (!c.visible || Math.random() < 0.35) return;
          const x = 200 + Math.random() * 380, y = 40 + Math.random() * 90;
          const m = this.add.rectangle(x, y, 16, 1, PALETTE.lunarHighlightHex, 0.9).setAngle(160).setBlendMode(Phaser.BlendModes.ADD);
          c.add(m);
          this.tweens.add({ targets: m, x: x - 70, y: y + 25, alpha: 0, duration: 700, ease: 'Sine.easeIn', onComplete: () => m.destroy() });
        },
      });
    }
  }

  private setVista(on: boolean, fade = 1600): void {
    for (const c of [this.vista, this.vistaFront]) {
      if (!c) continue;
      this.tweens.killTweensOf(c);
      if (on) c.setVisible(true);
      this.tweens.add({
        targets: c, alpha: on ? 1 : 0, duration: this.ms(fade), ease: 'Sine.easeInOut',
        onComplete: () => { if (!on) c.setVisible(false); },
      });
    }
    if (!on) {
      this.fadeOutAndDestroy(this.earthMark, 400);
      this.earthMark = null;
    }
  }

  /** Cinematic bars slide in for the deep-space shots and out for the record. */
  private setLetterbox(on: boolean): void {
    const [top, bot] = this.bars;
    if (!top || !bot) return;
    this.tweens.killTweensOf(this.bars);
    this.tweens.add({ targets: top, y: on ? 0 : -BAR_H, duration: this.ms(1200), ease: 'Cubic.easeInOut' });
    this.tweens.add({ targets: bot, y: on ? H - BAR_H : H, duration: this.ms(1200), ease: 'Cubic.easeInOut' });
  }

  /** Where Earth currently sits on screen (it drifts with the slow parallax). */
  private earthScreen(): { x: number; y: number } {
    return { x: Math.round(EARTH_POS.x - this.vistaOffset.x * SKY_F), y: Math.round(EARTH_POS.y - this.vistaOffset.y * SKY_F) };
  }

  private updateVista(dt: number): void {
    if (!this.vista?.visible) return;
    this.vistaT += dt;
    // A slow dolly back and forth so the shot never sits still
    const drift = this.reducedMotion ? 0 : Math.sin(this.vistaT * 0.035) * 46;
    const ox = this.vistaCam.x + drift, oy = this.vistaCam.y;
    this.vistaOffset = { x: ox, y: oy };
    for (const t of this.vistaTiles) {
      t.obj.tilePositionX = Math.round(ox * t.f);
      t.obj.tilePositionY = Math.round(oy * t.f);
    }
    for (const b of this.vistaBodies) b.obj.setPosition(Math.round(b.x0 - ox * b.f), Math.round(b.y0 - oy * b.f));
    if (!this.reducedMotion) {
      for (const r of this.rocks) {
        r.img.x += r.vx * dt;
        if (r.img.x < -40) r.img.x += W + 80;
        r.img.y = Math.round(r.y0 - oy * 1.4);
        r.img.angle += r.spin * dt;
      }
    }
    const rb = this.robot;
    if (rb?.active) {
      this.ion?.setPosition(rb.x, rb.y + 2).setAlpha(rb.alpha * 0.5);
      this.visor?.setPosition(rb.x, rb.y - 13 * rb.scaleY).setAlpha(rb.alpha * 0.35).setScale(0.12 * rb.scaleY);
    }
    if (this.earthMark?.active) {
      const p = this.earthScreen();
      this.earthMark.setPosition(p.x, p.y);
    }
  }

  /** UNIT-7, flight pack deployed, hovering in the dark. On the opening it flies in from off-screen. */
  private showFlyingRobot(flyIn: boolean): void {
    if (!this.robot) {
      const key = this.textures.exists('robot_fly_sheet') ? 'robot_fly_sheet' : 'robot_fly_idle';
      this.ion = this.add.image(ROBOT_POS.x, ROBOT_POS.y, 'glow_thruster').setBlendMode(Phaser.BlendModes.ADD).setTint(PALETTE.cyanLaserHex).setScale(0.9).setAlpha(0).setDepth(19);
      this.robot = this.add.sprite(ROBOT_POS.x, ROBOT_POS.y, key, 0).setOrigin(0.5, 21 / 24).setScale(3).setDepth(20).setAlpha(0);
      this.visor = this.add.image(ROBOT_POS.x, ROBOT_POS.y, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setDepth(21).setAlpha(0);
      if (!this.reducedMotion && this.anims.exists('robot_fly_anim')) this.robot.play('robot_fly_anim');
    }
    const r = this.robot;
    this.tweens.killTweensOf(r);
    r.setVisible(true).setScale(3);
    const bob = () => {
      if (!this.reducedMotion && r.active) this.tweens.add({ targets: r, y: ROBOT_POS.y - 4, duration: 1700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    };
    if (this.reducedMotion) {
      r.setPosition(ROBOT_POS.x, ROBOT_POS.y).setAlpha(1);
      return;
    }
    if (flyIn) {
      // Enters from the right, banking in, and eases to a hover
      r.setPosition(W + 50, ROBOT_POS.y - 46).setAlpha(1).setAngle(-14);
      this.tweens.add({ targets: r, x: ROBOT_POS.x, y: ROBOT_POS.y, angle: 0, duration: 3600, delay: 1600, ease: 'Cubic.easeOut', onComplete: bob });
      this.time.delayedCall(1700, () => SoundFX.playIonPulse(0.6));
    } else {
      r.setPosition(ROBOT_POS.x, ROBOT_POS.y + 8).setAngle(0);
      this.tweens.add({ targets: r, alpha: 1, y: ROBOT_POS.y, duration: 1000, delay: 300, ease: 'Cubic.easeOut', onComplete: bob });
    }
  }

  private hideRobot(): void {
    const r = this.robot;
    if (!r || !r.visible) return;
    this.tweens.killTweensOf(r);
    this.tweens.add({ targets: r, alpha: 0, duration: this.ms(350), onComplete: () => r.setVisible(false) });
  }

  /** The opening and closing shot: UNIT-7 in deep space, Earth a pale dot beside the Sun. */
  private setupVista(dusk = false, intro = false): void {
    this.clearSlide();
    this.clearRuler();
    this.fadeOutAndDestroy(this.planets);
    this.planets = null;
    this.fadeOutAndDestroy(this.stats);
    this.stats = null;
    this.fadeOutAndDestroy(this.track);
    this.track = null;
    this.trackGfx = null;
    this.trackLabels = [];
    this.fadeOutAndDestroy(this.booster);
    this.booster = null;
    this.warpTarget = 0;
    this.setDeepStage(false);
    this.showBackdrop('space', 1.6);
    this.setVista(true, intro ? 2600 : 1600);
    this.setLetterbox(true);
    Soundscape.set({ ambience: 'space', ambienceLevel: dusk ? 0.85 : 0.7, fade: 2.5 });
    this.setDim(dusk ? 0.1 : 0, 1400);
    this.tweens.killTweensOf(this.vistaCam);
    if (intro && !this.reducedMotion) {
      // Crane down from the stars to find the Sun, then the robot arriving
      this.vistaCam.x = 70;
      this.vistaCam.y = -150;
      this.tweens.add({ targets: this.vistaCam, x: 0, y: 0, duration: 7000, ease: 'Sine.easeInOut' });
    } else {
      this.tweens.add({ targets: this.vistaCam, x: 0, y: 0, duration: this.ms(2400), ease: 'Sine.easeInOut' });
    }
    this.showFlyingRobot(intro);
  }

  /** Targeting brackets lock onto the pale blue dot. */
  private markEarth(): void {
    if (this.earthMark || !this.vista) return;
    const p = this.earthScreen();
    const c = this.add.container(p.x, p.y).setDepth(21).setAlpha(0);
    const g = this.add.graphics();
    g.fillStyle(PALETTE.cyanLaserHex, 1);
    const s = 7, l = 3;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        g.fillRect(sx < 0 ? -s : s - l + 1, sy < 0 ? -s : s, l, 1);
        g.fillRect(sx < 0 ? -s : s, sy < 0 ? -s : s - l + 1, 1, l);
      }
    }
    const label = this.add.text(0, 11, 'EARTH', { fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.cyanLaser, letterSpacing: 3 }).setOrigin(0.5, 0);
    c.add([g, label]);
    this.earthMark = c;
    SoundFX.playRadarPing(0.2);
    this.tweens.add({ targets: c, alpha: 1, duration: this.ms(500) });
    if (this.reducedMotion) return;
    g.setScale(2.4);
    this.tweens.add({ targets: g, scale: 1, duration: 650, ease: 'Back.easeOut' });
    this.tweens.add({ targets: g, alpha: 0.4, duration: 700, delay: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Destroys an object and its children, stopping their looping tweens first. */
  private destroyDeep(obj: Phaser.GameObjects.GameObject): void {
    const all: Phaser.GameObjects.GameObject[] = [];
    const walk = (o: Phaser.GameObjects.GameObject) => {
      all.push(o);
      if (o instanceof Phaser.GameObjects.Container) o.list.forEach(walk);
    };
    walk(obj);
    this.tweens.killTweensOf(all);
    obj.destroy();
  }

  private fadeOutAndDestroy(obj: Phaser.GameObjects.Container | Phaser.GameObjects.Image | null, duration = 500): void {
    if (!obj) return;
    this.tweens.killTweensOf(obj);
    this.tweens.add({ targets: obj, alpha: 0, duration: this.ms(duration), onComplete: () => this.destroyDeep(obj) });
  }

  // ---------------------------------------------------------------------------
  // Section titles
  // ---------------------------------------------------------------------------

  /** A title card that tracks in, and stays until the player moves on. */
  private showSection(kicker: string, title: string, sub: string, music?: TrackId): void {
    // Each act turns the page in the music too
    if (music) Soundscape.set({ music, fade: 3 });
    this.hideSection();
    this.clearSlide();
    this.clearRuler();
    this.hideRobot();
    const c = this.add.container(W / 2, H / 2 - 30).setDepth(60);
    const barTop = this.add.rectangle(0, -26, 80, 1, PALETTE.cyanGlowHex).setScale(this.reducedMotion ? 1 : 0, 1);
    const barBot = this.add.rectangle(0, 30, 80, 1, PALETTE.cyanGlowHex).setScale(this.reducedMotion ? 1 : 0, 1);
    const k = this.add.text(0, -20, kicker, { fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.cyanGlow, letterSpacing: 4 }).setOrigin(0.5, 0);
    const t = this.add.text(0, -6, title, { fontFamily: HUD_FONT, fontSize: '21px', color: PALETTE.lunarHighlight, letterSpacing: 6 }).setOrigin(0.5, 0);
    c.add([barTop, barBot, k, t]);
    let s: Phaser.GameObjects.Text | null = null;
    if (sub) {
      s = this.add.text(0, 36, sub, { fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.lunarDustLight, letterSpacing: 3 }).setOrigin(0.5, 0);
      c.add(s);
    }
    this.section = c;
    this.setDim(0.6, 700);
    SoundFX.playWhoosh();
    if (this.reducedMotion) return;

    this.tweens.add({ targets: [barTop, barBot], scaleX: 1, duration: 700, ease: 'Cubic.easeOut' });
    k.setAlpha(0).setY(-26);
    this.tweens.add({ targets: k, alpha: 1, y: -20, duration: 600, delay: 150, ease: 'Cubic.easeOut' });
    // The title "tracks in": wide letter spacing closing to its resting width
    t.setAlpha(0).setLetterSpacing(22);
    const spacing = { v: 22 };
    this.tweens.add({ targets: t, alpha: 1, duration: 700, delay: 250, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: spacing, v: 6, duration: 1100, delay: 250, ease: 'Cubic.easeOut',
      onUpdate: () => { if (t.active) t.setLetterSpacing(Math.round(spacing.v)); },
    });
    if (s) {
      s.setAlpha(0).setY(42);
      this.tweens.add({ targets: s, alpha: 1, y: 36, duration: 600, delay: 750, ease: 'Cubic.easeOut' });
    }
    // A slow breath while the card waits for the player
    this.tweens.add({ targets: [barTop, barBot], alpha: 0.45, duration: 1600, delay: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  private hideSection(): void {
    const c = this.section;
    if (!c) return;
    this.section = null;
    this.tweens.killTweensOf(c);
    this.tweens.add({ targets: c, alpha: 0, y: c.y - 10, duration: this.ms(380), ease: 'Cubic.easeIn', onComplete: () => this.destroyDeep(c) });
  }

  // ---------------------------------------------------------------------------
  // Act I: the reel
  // ---------------------------------------------------------------------------

  /** Syncs native-resolution DOM photographs with their Phaser slide container & scanline reveal. */
  private syncPhotos(): void {
    if (this.photoItems.length === 0) return;
    const canvas = this.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const sx = rect.width / W;
    const sy = rect.height / H;

    for (let k = this.photoItems.length - 1; k >= 0; k--) {
      const item = this.photoItems[k];
      if (!item.slide.active) {
        item.el.remove();
        this.photoItems.splice(k, 1);
        continue;
      }
      const st = item.el.style;
      st.left = `${rect.left + (item.fx + item.slide.x) * sx}px`;
      st.top = `${rect.top + (item.fy + item.slide.y) * sy}px`;
      st.width = `${item.fw * sx}px`;
      st.height = `${item.fh * sy}px`;
      st.opacity = String(item.slide.alpha);
      const clipBottom = Math.max(0, Math.min(100, ((item.fh - item.reveal.h) / item.fh) * 100));
      st.clipPath = `inset(0 0 ${clipBottom.toFixed(2)}% 0)`;
      item.img.style.transform = `scale(${item.kb.scale.toFixed(4)}) translateX(${((item.kb.dx / item.fw) * 100).toFixed(3)}%)`;
    }
  }

  /** The current slide glides out to the left as the next one arrives. */
  private clearSlide(): void {
    if (!this.slide) return;
    const old = this.slide;
    const mask = this.slideMask;
    this.slide = null;
    this.slideMask = null;
    this.tweens.killTweensOf(old);
    this.tweens.add({
      targets: old, alpha: 0, x: old.x - (this.reducedMotion ? 0 : 40), duration: this.ms(380), ease: 'Cubic.easeIn',
      onUpdate: () => {
        if (mask) mask.x = old.x;
        this.syncPhotos();
      },
      onComplete: () => {
        this.destroyDeep(old);
        mask?.destroy();
        this.syncPhotos();
      },
    });
  }

  private showSlide(i: number): void {
    const { entry, year } = this.reel[i];
    const fromYear = this.lastSlideYear ?? year;
    const following = this.slide !== null;
    this.lastSlideYear = year;
    this.hideRobot();
    this.setVista(false, 1100);
    this.setLetterbox(false);
    this.showBackdrop(entry.world === 'elsewhere' ? 'space' : entry.world, 1.1);
    this.setDeepStage(entry.world === 'elsewhere');
    this.setDim(entry.world === 'elsewhere' ? 0.3 : 0.5);
    this.clearSlide();
    this.moveRuler(i);
    SoundFX.playRadarPing(0.4);

    const enter = this.ms(following ? 260 : 150);
    const c = this.add.container(this.reducedMotion ? 0 : 44, 0).setDepth(30).setAlpha(0);
    this.slide = c;

    // Photo, framed and masked: rendered via native-resolution DOM <img> so NASA archival
    // photographs are crisp at 1080p/4K instead of quantized to the 640×360 pixel canvas.
    const fx = 30, fy = 56, fw = 304, fh = 196;
    const frame = this.add.graphics();
    frame.fillStyle(PALETTE.spaceBlackHex, 0.9).fillRect(fx - 4, fy - 4, fw + 8, fh + 8);
    frame.lineStyle(1, PALETTE.beaconGoldHex, 0.7).strokeRect(fx - 4.5, fy - 4.5, fw + 9, fh + 9);
    c.add(frame);
    const key = `photo_${entry.id}`;
    const texImg = this.textures.exists(key)
      ? (this.textures.get(key).getSourceImage() as HTMLImageElement | undefined)
      : undefined;
    const ratio = texImg && texImg.height ? (texImg.width / texImg.height) / (fw / fh) : 1;
    const objectFit = ratio > 1.6 || ratio < 0.6 ? 'contain' : 'cover';

    const stage = document.getElementById('game-stage') ?? document.body;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;overflow:hidden;pointer-events:none;z-index:6;background:#05070f;opacity:0;will-change:left,top,opacity,clip-path;';
    const img = document.createElement('img');
    img.src = entry.image.file;
    img.alt = entry.image.alt;
    img.style.cssText = `width:100%;height:100%;object-fit:${objectFit};image-rendering:auto;transform-origin:center center;display:block;will-change:transform;`;
    el.appendChild(img);
    stage.appendChild(el);

    const reveal = { h: this.reducedMotion ? fh : 0 };
    const kb = { scale: this.reducedMotion ? 1 : 1.12, dx: 0 };
    this.photoItems.push({ el, img, slide: c, fx, fy, fw, fh, reveal, kb });
    this.syncPhotos();

    if (!this.reducedMotion) {
      const scan = this.add.rectangle(fx + fw / 2, fy, fw, 2, PALETTE.cyanLaserHex, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(32);
      c.add(scan);
      this.tweens.add({
        targets: reveal, h: fh, duration: 900, delay: enter + 120, ease: 'Sine.easeInOut',
        onUpdate: () => { if (scan.active) scan.y = fy + reveal.h; },
        onComplete: () => { if (scan.active) this.tweens.add({ targets: scan, alpha: 0, duration: 260, onComplete: () => scan.destroy() }); },
      });
      const drift = i % 2 ? 8 : -8;
      this.tweens.add({
        targets: kb, scale: 1.02, duration: 1400, delay: enter, ease: 'Cubic.easeOut',
        onComplete: () => {
          if (c.active) this.tweens.add({ targets: kb, scale: 1.08, dx: drift, duration: 12000, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
        },
      });
    }
    const creditLine = entry.image.nasa_id === 'SI-ILLUSTRATION'
      ? 'SI-GENERATED ILLUSTRATION · NOT A NASA PHOTOGRAPH'
      : `NASA ${entry.image.nasa_id} · ${entry.image.credit}`.toUpperCase();
    const credit = this.add.text(fx, fy + fh + 8, creditLine, {
      fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.lunarDustLight, letterSpacing: 1,
      wordWrap: { width: fw, useAdvancedWrap: true },
    });
    c.add(credit);

    // Right panel: year, machine, status, sourced summary (each line staggers in)
    const panel: Phaser.GameObjects.GameObject[] = [];
    const px = 356, pw = 252;
    const accent = entry.world === 'moon' ? PALETTE.lunarCrustCream : entry.world === 'mars' ? PALETTE.marsHazePeach : PALETTE.cyanLaser;
    const worldName = entry.world === 'moon' ? 'THE MOON' : entry.world === 'mars' ? 'MARS' : 'DEEP SPACE // ELSEWHERE';
    const yearText = this.add.text(px, 52, String(fromYear), { fontFamily: HUD_FONT, fontSize: '28px', color: PALETTE.beaconGold, letterSpacing: 2 });
    const worldText = this.add.text(px, 84, worldName, { fontFamily: HUD_FONT, fontSize: '7px', color: accent, letterSpacing: 4 });
    panel.push(yearText, worldText);

    const hwKey = `hw_${entry.id}`;
    if (this.textures.exists(hwKey)) {
      const gx = px + pw - 30, gy = 88;
      const hw = this.add.container(0, 0);
      hw.add(this.add.image(gx, gy - 14, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setScale(0.9).setAlpha(0.18));
      const sprite = this.add.image(gx, gy, hwKey).setOrigin(0.5, 27 / 32).setScale(2);
      hw.add(sprite);
      const beacon = this.add.image(gx, gy - 46, 'glow_thruster').setBlendMode(Phaser.BlendModes.ADD).setScale(0.25).setAlpha(0.9);
      hw.add(beacon);
      if (!this.reducedMotion) {
        this.tweens.add({ targets: beacon, alpha: 0.1, duration: 160, hold: 260, repeatDelay: 1400, yoyo: true, repeat: -1 });
        this.tweens.add({ targets: sprite, y: gy - 2, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: enter + 600 });
      }
      panel.push(hw);
    }

    const name = this.add.text(px, 102, entry.name.toUpperCase(), {
      fontFamily: HUD_FONT, fontSize: '14px', color: PALETTE.lunarHighlight, letterSpacing: 1,
      wordWrap: { width: pw, useAdvancedWrap: true }, lineSpacing: 2,
    });
    panel.push(name);
    let y = 102 + name.height + 8;

    const status = this.add.container(0, 0);
    const statusText = this.add.text(px + 6, y + 3, entry.status.toUpperCase(), { fontFamily: HUD_FONT, fontSize: '7px', color: '#' + STATUS_COLOR[entry.status].toString(16).padStart(6, '0'), letterSpacing: 2 });
    const badge = this.add.graphics();
    badge.lineStyle(1, STATUS_COLOR[entry.status], 1).strokeRect(px + 0.5, y + 0.5, statusText.width + 12, 13);
    status.add([badge, statusText]);
    status.add(this.add.text(px + statusText.width + 20, y + 3, `LAUNCHED ${entry.launch_date}`, { fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.lunarDustLight, letterSpacing: 1 }));
    panel.push(status);
    y += 22;

    panel.push(this.add.text(px, y, entry.summary, {
      fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.lunarCrustCream, letterSpacing: 1,
      wordWrap: { width: pw, useAdvancedWrap: true }, lineSpacing: 4,
    }));
    c.add(panel);

    // The slide glides in from the right; its mask rides along
    this.tweens.add({
      targets: c, alpha: 1, x: 0, duration: this.ms(560), delay: enter, ease: 'Cubic.easeOut',
      onUpdate: () => { if (this.slideMask && this.slide === c) this.slideMask.x = c.x; },
    });
    if (this.reducedMotion) {
      yearText.setText(String(year));
      return;
    }
    panel.forEach((obj, k) => {
      const o = obj as Phaser.GameObjects.Text | Phaser.GameObjects.Container;
      const y0 = o.y;
      o.setAlpha(0).setY(y0 + 8);
      this.tweens.add({ targets: o, alpha: 1, y: y0, duration: 480, delay: enter + 200 + k * 90, ease: 'Cubic.easeOut' });
    });
    // The year rolls from the previous launch to this one
    const roll = { v: fromYear };
    this.tweens.add({
      targets: roll, v: year, duration: fromYear === year ? 0 : 800, delay: enter + 150, ease: 'Cubic.easeOut',
      onUpdate: () => { if (yearText.active) yearText.setText(String(Math.round(roll.v))); },
      onComplete: () => { if (yearText.active) yearText.setText(String(year)); },
    });
  }

  private createRuler(): void {
    this.rulerLayer = this.add.container(0, 0).setDepth(40).setAlpha(0);
    this.ruler = this.add.graphics();
    const style = { fontFamily: HUD_FONT, fontSize: '7px', letterSpacing: 1 };
    this.rulerFirst = this.add.text(0, 0, '', { ...style, color: PALETTE.lunarDustLight }).setOrigin(0, 0);
    this.rulerLast = this.add.text(0, 0, '', { ...style, color: PALETTE.lunarDustLight }).setOrigin(1, 0);
    this.rulerCur = this.add.text(0, 0, '', { ...style, color: PALETTE.beaconGold }).setOrigin(0.5, 0);
    this.rulerPing = this.add.image(0, 0, 'glow_thruster').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setTint(PALETTE.beaconGoldHex);
    this.rulerLayer.add([this.ruler, this.rulerPing, this.rulerFirst, this.rulerLast, this.rulerCur]);
  }

  private readonly rulerGeom = { x0: 46, x1: W - 46, y: 30 };

  private rulerXOf(i: number): number {
    const { x0, x1 } = this.rulerGeom;
    const t = (d: string) => Date.parse(d);
    const first = t(this.reel[0].entry.launch_date);
    const last = t(this.reel[this.reel.length - 1].entry.launch_date);
    return x0 + ((t(this.reel[i].entry.launch_date) - first) / Math.max(1, last - first)) * (x1 - x0);
  }

  /** The marker travels along the timeline to the next launch, the year counting with it. */
  private moveRuler(i: number): void {
    const target = this.rulerXOf(i);
    const year = this.reel[i].year;
    this.tweens.killTweensOf(this.rulerLayer);
    this.tweens.add({ targets: this.rulerLayer, alpha: 1, duration: this.ms(400) });
    this.tweens.killTweensOf(this.rulerAnim);
    if (this.rulerAnim.x < 0) this.rulerAnim = { x: this.rulerGeom.x0, year: this.reel[0].year };
    const arrive = () => {
      this.renderRuler();
      if (this.reducedMotion) return;
      this.rulerPing.setPosition(Math.round(target), this.rulerGeom.y).setScale(0.08).setAlpha(1);
      this.tweens.add({ targets: this.rulerPing, scale: 0.4, alpha: 0, duration: 520, ease: 'Cubic.easeOut' });
    };
    if (this.reducedMotion) {
      this.rulerAnim.x = target;
      this.rulerAnim.year = year;
      arrive();
      return;
    }
    this.tweens.add({
      targets: this.rulerAnim, x: target, year, duration: 850, ease: 'Cubic.easeInOut',
      onUpdate: () => this.renderRuler(),
      onComplete: arrive,
    });
    this.renderRuler();
  }

  /** A timeline across the top: every launch from the first year to the last. */
  private renderRuler(): void {
    const { x0, x1, y } = this.rulerGeom;
    const mx = this.rulerAnim.x;
    const g = this.ruler;
    g.clear();
    g.fillStyle(PALETTE.atmosphericDuskHex, 1).fillRect(x0, y, x1 - x0, 1);
    g.fillStyle(PALETTE.beaconGoldHex, 0.85).fillRect(x0, y, Math.max(0, mx - x0), 1);
    this.reel.forEach((r, i) => {
      const x = Math.round(this.rulerXOf(i));
      const color =
        r.entry.world === 'moon'
          ? PALETTE.lunarCrustCreamHex
          : r.entry.world === 'mars'
            ? PALETTE.marsDustTanHex
            : PALETTE.cyanLaserHex;
      if (x <= mx + 0.5) {
        g.fillStyle(color, 1).fillRect(x - 1, y - 1, 3, 3);
      } else {
        g.fillStyle(PALETTE.lunarRegolithDeepHex, 1).fillRect(x, y - 1, 1, 3);
      }
    });
    const cx = Math.round(mx);
    g.lineStyle(1, PALETTE.beaconGoldHex, 1).strokeRect(cx - 3.5, y - 3.5, 7, 7);

    const lx = Phaser.Math.Clamp(cx, x0 + 12, x1 - 12);
    this.rulerFirst.setText(String(this.reel[0].year)).setPosition(x0, y + 6);
    this.rulerLast.setText(String(this.reel[this.reel.length - 1].year)).setPosition(x1, y + 6);
    // End labels fade as the moving marker label comes near them
    this.rulerFirst.setAlpha(Phaser.Math.Clamp((lx - x0 - 30) / 20, 0, 1));
    this.rulerLast.setAlpha(Phaser.Math.Clamp((x1 - lx - 30) / 20, 0, 1));
    this.rulerCur.setText(String(Math.round(this.rulerAnim.year))).setPosition(lx, y + 6);
  }

  private clearRuler(): void {
    if (this.rulerAnim.x < 0) return;
    this.tweens.killTweensOf(this.rulerAnim);
    this.tweens.killTweensOf(this.rulerLayer);
    this.tweens.add({
      targets: this.rulerLayer, alpha: 0, duration: this.ms(400),
      onComplete: () => { this.ruler.clear(); this.rulerAnim = { x: -1, year: 0 }; },
    });
    this.lastSlideYear = null;
  }

  // ---------------------------------------------------------------------------
  // Act II: how far
  // ---------------------------------------------------------------------------

  private setupHowFar(): void {
    this.clearSlide();
    this.clearRuler();
    this.hideRobot();
    this.setVista(false, 1200);
    this.setLetterbox(false);
    this.setDeepStage(false);
    this.showBackdrop('space', 1.6);
    Soundscape.set({ ambience: 'space', ambienceLevel: 0.8, fade: 3 });
    this.setDim(0, 1200);

    const c = this.add.container(0, 0).setDepth(10);
    const earth = { x: 84, y: 196 }, moon = { x: 162, y: 160 }, mars = { x: 356, y: 188 }, deepSpace = { x: 540, y: 148 };
    const rm = this.reducedMotion;

    // The route humans and their machines took, dotted, drawn out from Earth
    const route = this.add.graphics();
    const progress = { u: rm ? 1 : 0 };
    const dots = (a: { x: number; y: number }, b: { x: number; y: number }, color: number, upTo: number) => {
      const n = Math.floor(Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y) / 7);
      for (let k = 1; k < n; k++) {
        const u = k / n;
        if (u > upTo) break;
        const arc = Math.sin(u * Math.PI) * -26;
        route.fillStyle(color, 0.5).fillRect(Math.round(a.x + (b.x - a.x) * u), Math.round(a.y + (b.y - a.y) * u + arc), 1, 1);
      }
    };
    // One multi-stage trajectory: Earth → Moon → Mars → deep space, each leg after the last
    const leg = (start: number) => Phaser.Math.Clamp((progress.u - start) * 3, 0, 1);
    const drawRoute = () => {
      route.clear();
      dots(earth, moon, PALETTE.lunarCrustCreamHex, leg(0));
      dots(moon, mars, PALETTE.marsDustTanHex, leg(1 / 3));
      dots(mars, deepSpace, PALETTE.cyanLaserHex, leg(2 / 3));
    };
    drawRoute();
    c.add(route);

    const world = (items: Phaser.GameObjects.GameObject[], delay: number) => {
      const g = this.add.container(0, 0, items);
      c.add(g);
      if (rm) return g;
      g.setAlpha(0).setY(10);
      this.tweens.add({ targets: g, alpha: 1, y: 0, duration: 900, delay, ease: 'Cubic.easeOut' });
      return g;
    };
    const label = (x: number, y: number, text: string, color: string) =>
      this.add.text(x, y, text, { fontFamily: HUD_FONT, fontSize: '7px', color, letterSpacing: 3 }).setOrigin(0.5, 0);

    const earthGlow = this.add.image(earth.x, earth.y, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setScale(1.8).setAlpha(0.16);
    const earthSprite = this.add.sprite(earth.x, earth.y, 'earth_spin', 0).setScale(0.6);
    if (!rm && this.anims.exists('earth_rotate')) earthSprite.play('earth_rotate');
    world([earthGlow, earthSprite, label(earth.x, earth.y + 28, 'EARTH', PALETTE.cyanLaser)], 200);
    const moonImg = this.add.image(moon.x, moon.y, 'cin_planet_moon');
    world([moonImg, label(moon.x, moon.y + moonImg.height / 2 + 6, 'THE MOON', PALETTE.lunarCrustCream)], 650);
    const marsImg = this.add.image(mars.x, mars.y, 'cin_planet_mars');
    world([marsImg, label(mars.x, mars.y + marsImg.height / 2 + 6, 'MARS', PALETTE.marsHazePeach)], 1050);
    const deepGlow = this.add.image(deepSpace.x, deepSpace.y, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setScale(1.2).setAlpha(0.24);
    const giant = this.add.image(deepSpace.x, deepSpace.y, 'cin_ringed_giant').setScale(0.42);
    world([deepGlow, giant, label(deepSpace.x, deepSpace.y + 24, 'ELSEWHERE', PALETTE.cyanLaser)], 1450);
    // Beacon counts per sector, taken from the reel itself
    const count = (w: 'moon' | 'mars' | 'elsewhere') => this.reel.filter((r) => r.entry.world === w).length;
    world([
      label(moon.x, moon.y - moonImg.height / 2 - 14, `${count('moon')} MACHINES`, PALETTE.lunarDustLight),
      label(mars.x, mars.y - marsImg.height / 2 - 14, `${count('mars')} MACHINES`, PALETTE.lunarDustLight),
      label(deepSpace.x, deepSpace.y - 34, `${count('elsewhere')} MACHINES`, PALETTE.lunarDustLight),
    ], 2700);
    if (!rm) {
      this.tweens.add({ targets: progress, u: 1, duration: 1800, delay: 400, ease: 'Sine.easeInOut', onUpdate: () => { if (route.active) drawRoute(); } });
      this.tweens.add({ targets: [moonImg, marsImg], y: '-=2', duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 1800 });
    }

    // One marker per machine, still out there on its world. Only the ones still working
    // (cyan) pulse; dormant hardware stays a steady gold point: it does not transmit.
    const beacons = (w: 'moon' | 'mars' | 'elsewhere', cx: number, cy: number, r: number, start: number) => {
      this.reel.filter((s) => s.entry.world === w).forEach((s, k) => {
        const a = k * 2.399; // golden angle spread
        const d = r * Math.sqrt((k + 0.5) / 10);
        const b = this.add.image(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 'glow_thruster')
          .setBlendMode(Phaser.BlendModes.ADD).setScale(rm ? 0.12 : 0).setTint(s.entry.status === 'active' ? PALETTE.cyanLaserHex : PALETTE.beaconGoldHex);
        c.add(b);
        if (rm) return;
        this.tweens.add({ targets: b, scale: 0.12, duration: 380, delay: start + k * 110, ease: 'Back.easeOut' });
        if (s.entry.status === 'active') {
          this.tweens.add({ targets: b, alpha: 0.15, duration: 300, hold: 200, repeatDelay: 900 + k * 170, yoyo: true, repeat: -1, delay: start + 600 + k * 120 });
        }
      });
    };
    beacons('moon', moon.x, moon.y, moonImg.width * 0.36, 1300);
    beacons('mars', mars.x, mars.y, marsImg.width * 0.38, 1950);
    beacons('elsewhere', deepSpace.x, deepSpace.y, 26, 2500);
    this.planets = c;

    // Counters, all derived from the sourced entries
    const s = getReelStats();
    const st = this.add.container(W / 2, rm ? 46 : 38).setDepth(50).setAlpha(0);
    const cols: [number, string][] = [[s.machines, 'MACHINES'], [s.worlds, 'SECTORS'], [s.span, 'YEARS']];
    cols.forEach(([value, unit], k) => {
      const x = (k - 1) * 150;
      const num = this.add.text(x, 0, rm ? String(value) : '0', { fontFamily: HUD_FONT, fontSize: '28px', color: PALETTE.lunarHighlight, letterSpacing: 2 }).setOrigin(0.5, 0);
      st.add(num);
      st.add(this.add.text(x, 34, unit, { fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.cyanGlow, letterSpacing: 4 }).setOrigin(0.5, 0));
      if (rm) return;
      const counter = { v: 0 };
      this.tweens.add({
        targets: counter, v: value, duration: 1600, delay: 600 + k * 300, ease: 'Cubic.easeOut',
        onUpdate: () => { if (num.active) num.setText(String(Math.round(counter.v))); },
        onComplete: () => {
          if (!num.active) return;
          num.setText(String(value));
          SoundFX.playClick();
          this.tweens.add({ targets: num, scale: 1.15, duration: 120, yoyo: true, ease: 'Sine.easeOut' });
        },
      });
    });
    st.add(this.add.text(0, 50, `${s.machines} MACHINES · ${s.worlds} SECTORS · ${s.firstYear} – ${s.lastYear}`, { fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.lunarDustLight, letterSpacing: 3 }).setOrigin(0.5, 0));
    this.stats = st;
    this.tweens.add({ targets: st, alpha: 1, y: 46, duration: this.ms(800), delay: this.ms(300), ease: 'Cubic.easeOut' });
  }

  // ---------------------------------------------------------------------------
  // Act III: farther
  // ---------------------------------------------------------------------------

  private setupFarther(): void {
    this.fadeOutAndDestroy(this.stats, 400);
    this.stats = null;
    this.showBackdrop('space', 0);
    this.trackNodes = ['EARTH', ...FINALE.horizon.map((h) => h.destination).filter((d, i, a) => a.indexOf(d) === i)];
    this.trackLevel = 0;
    this.trackAnim = { v: 0 };

    const c = this.add.container(0, this.reducedMotion ? 0 : -8).setDepth(50).setAlpha(0);
    this.track = c;
    this.trackGfx = this.add.graphics();
    c.add(this.trackGfx);
    c.add(this.add.text(W / 2, 16, 'HOW FAR NEXT', { fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.lunarDustLight, letterSpacing: 4 }).setOrigin(0.5, 0));
    this.trackLabels = this.trackNodes.map((name, i) => {
      const t = this.add.text(Math.round(this.trackX(i)), 43, name, { fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.lunarRegolithMid, letterSpacing: 2 }).setOrigin(0.5, 0);
      c.add(t);
      return t;
    });
    this.drawTrack();
    this.tweens.add({ targets: c, alpha: 1, y: 0, duration: this.ms(700), ease: 'Cubic.easeOut' });

    // Something leaves Earth
    if (!this.booster) {
      this.booster = this.add.image(108, this.reducedMotion ? 186 : 200, 'cin_booster').setOrigin(0.5, 1).setScale(0.7).setDepth(30).setAngle(70).setAlpha(0);
      this.tweens.add({ targets: this.booster, alpha: 1, y: 186, duration: this.ms(900), ease: 'Cubic.easeOut' });
    }
    SoundFX.playBoosterRocket();
    this.warpTarget = 0.4;
  }

  private trackX(i: number): number {
    const x0 = 56, x1 = W - 56;
    return x0 + (i / Math.max(1, this.trackNodes.length - 1)) * (x1 - x0);
  }

  /** Draws the route; the lit line follows the animated `trackAnim.v` between nodes. */
  private drawTrack(): void {
    const g = this.trackGfx;
    if (!g || !g.active) return;
    const y = 34;
    const v = this.trackAnim.v;
    const fillX = this.trackX(0) + (v / Math.max(1, this.trackNodes.length - 1)) * (this.trackX(this.trackNodes.length - 1) - this.trackX(0));
    g.clear();
    g.fillStyle(PALETTE.atmosphericDuskHex, 1).fillRect(this.trackX(0), y, this.trackX(this.trackNodes.length - 1) - this.trackX(0), 1);
    g.fillStyle(PALETTE.cyanGlowHex, 1).fillRect(this.trackX(0), y, fillX - this.trackX(0), 1);
    const arrived = Math.abs(v - this.trackLevel) < 0.01;
    this.trackNodes.forEach((_name, i) => {
      const x = Math.round(this.trackX(i));
      const lit = i <= v + 0.01;
      const current = arrived && i === this.trackLevel;
      g.fillStyle(lit ? PALETTE.cyanLaserHex : PALETTE.lunarRegolithDeepHex, 1).fillRect(x - 2, y - 2, 5, 5);
      if (current) g.lineStyle(1, PALETTE.cyanLaserHex, 1).strokeRect(x - 4.5, y - 4.5, 10, 10);
      this.trackLabels[i]?.setColor(current ? PALETTE.cyanLaser : lit ? PALETTE.lunarCrustCream : PALETTE.lunarRegolithMid);
    });
    // A travelling spark leads the lit line while it moves
    if (!arrived) g.fillStyle(PALETTE.lunarHighlightHex, 1).fillRect(Math.round(fillX) - 1, y - 1, 3, 3);
  }

  private advanceTrack(horizonIndex: number): void {
    const dest = FINALE.horizon[horizonIndex].destination;
    this.trackLevel = Math.max(this.trackLevel, this.trackNodes.indexOf(dest));
    this.tweens.killTweensOf(this.trackAnim);
    this.tweens.add({
      targets: this.trackAnim, v: this.trackLevel, duration: this.ms(1100), ease: 'Cubic.easeInOut',
      onUpdate: () => this.drawTrack(),
      onComplete: () => this.drawTrack(),
    });
    this.drawTrack();
    this.warpTarget = 0.4 + this.trackLevel * 0.5;
    SoundFX.playRadarPing(0.25);

    // The booster heads out; the worlds fall behind
    if (this.booster) {
      const k = this.trackLevel / Math.max(1, this.trackNodes.length - 1);
      this.tweens.add({
        targets: this.booster,
        x: 108 + k * (W + 60 - 108),
        y: 186 - k * 70,
        duration: this.ms(3200),
        ease: 'Sine.easeInOut',
      });
    }
    if (this.planets && !this.reducedMotion) {
      this.tweens.add({ targets: this.planets, x: -this.trackLevel * 34, alpha: Math.max(0.25, 1 - this.trackLevel * 0.16), duration: 3200, ease: 'Sine.easeInOut' });
    }
  }

  private updateStars(dt: number): void {
    this.warp += (this.warpTarget - this.warp) * Math.min(1, dt * 1.5);
    const g = this.starGfx;
    g.clear();
    if (this.warp < 0.02 || this.activeBackdrop !== 'space') return;
    const speed = this.reducedMotion ? 0 : this.warp * 160;
    for (const s of this.stars) {
      s.x -= speed * s.z * dt;
      if (s.x < -20) s.x += W + 40;
      const len = Math.max(1, Math.round(speed * s.z * 0.06));
      g.fillStyle(s.z > 0.75 ? PALETTE.cyanLaserHex : PALETTE.lunarHighlightHex, 0.25 + s.z * 0.5);
      g.fillRect(Math.round(s.x), Math.round(s.y), len, 1);
    }
  }

  private updateBooster(): void {
    this.flame.clear();
    const b = this.booster;
    if (!b || !b.active || !b.visible || b.alpha < 0.05) return;
    const r = Phaser.Math.DegToRad(b.angle);
    const dx = -Math.sin(r), dy = Math.cos(r); // sprite's local "down"
    const px = Math.cos(r), py = Math.sin(r);
    const len = 10 + Math.random() * 6;
    const half = 2.5;
    this.flame.fillStyle(PALETTE.thrusterOrangeHex, 0.95 * b.alpha).fillTriangle(
      b.x - px * half, b.y - py * half, b.x + px * half, b.y + py * half, b.x + dx * len, b.y + dy * len);
    this.flame.fillStyle(PALETTE.beaconGoldHex, 0.9 * b.alpha).fillTriangle(
      b.x - px * half * 0.5, b.y - py * half * 0.5, b.x + px * half * 0.5, b.y + py * half * 0.5, b.x + dx * len * 0.55, b.y + dy * len * 0.55);
  }

  // ---------------------------------------------------------------------------
  // Ending: the robot signals home, then the end card (DOM, keyboard and screen-reader friendly)
  // ---------------------------------------------------------------------------

  private showEndCard(): void {
    this.finished = true;
    this.events.emit('finale-ended');
    this.clearCaption();
    this.hideNextButton();
    this.setDim(0, 1800);
    if (this.reducedMotion || !this.robot?.active) {
      this.mountEndCard();
      return;
    }
    // The final shot plays out; any input skips straight to the card
    this.cardPending = true;
    this.markEarth();
    this.time.delayedCall(900, () => this.playUplink());
  }

  /** One pulse leaves the antenna and arcs to Earth; Earth glints when it lands. */
  private sendPulse(fromX: number, fromY: number, scale: number, duration: number, onArrive?: () => void): void {
    const p = this.add.image(fromX, fromY, 'glow_thruster').setBlendMode(Phaser.BlendModes.ADD).setTint(PALETTE.cyanLaserHex).setScale(scale).setDepth(21);
    const path = { u: 0 };
    this.tweens.add({
      targets: path, u: 1, duration, ease: 'Sine.easeIn',
      onUpdate: () => {
        if (!p.active) return;
        const e = this.earthScreen();
        const u = path.u;
        p.setPosition(fromX + (e.x - fromX) * u, fromY + (e.y - fromY) * u - Math.sin(u * Math.PI) * 46);
        p.setAlpha(1 - u * 0.6).setScale(scale * (1 - u * 0.7));
      },
      onComplete: () => {
        p.destroy();
        const g = this.earthGlow;
        if (g?.active) {
          this.tweens.killTweensOf(g);
          g.setScale(0.12).setAlpha(0.45);
          this.tweens.add({ targets: g, alpha: 0.95, scale: 0.42, duration: 220, yoyo: true, ease: 'Sine.easeOut' });
        }
        onArrive?.();
      },
    });
  }

  /** Every echo, uplinked home one by one, with a live counter over the robot. */
  private playUplink(): void {
    const r = this.robot;
    if (!r?.active) return;
    const total = this.reel.length;
    const ax = r.x, ay = r.y - 62;
    const label = (n: number) => `UPLINK · ECHO ${String(n).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
    this.uplink = this.add.text(ax, ay - 22, label(0), { fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.cyanLaser, letterSpacing: 2 }).setOrigin(0.5, 1).setDepth(23).setAlpha(0);
    this.tweens.add({ targets: this.uplink, alpha: 1, duration: 400 });
    const antenna = this.add.image(ax, ay, 'glow_thruster').setBlendMode(Phaser.BlendModes.ADD).setTint(PALETTE.cyanLaserHex).setScale(0.16).setDepth(21).setAlpha(0);
    this.tweens.add({ targets: antenna, alpha: 0.95, duration: 140, yoyo: true, repeat: -1, repeatDelay: 120 });
    let arrived = 0;
    for (let k = 0; k < total; k++) {
      this.time.delayedCall(k * 230, () => {
        if (!r.active) return;
        this.uplink?.setText(label(k + 1));
        if (k % 3 === 0) SoundFX.playChime(k % 5);
        this.sendPulse(r.x, r.y - 62, 0.3, 1500, () => {
          arrived++;
          if (arrived === total) this.uplinkComplete(antenna);
        });
      });
    }
  }

  private uplinkComplete(antenna: Phaser.GameObjects.Image): void {
    SoundFX.playDownlink();
    this.tweens.killTweensOf(antenna);
    this.tweens.add({ targets: antenna, alpha: 0, duration: 600, onComplete: () => antenna.destroy() });
    const t = this.uplink;
    if (t?.active) {
      t.setText(`TRANSMISSION COMPLETE · ${this.reel.length} ECHOES HOME`).setColor(PALETTE.beaconGold);
      t.setX(Math.min(t.x, W - 16 - t.width / 2));
      this.tweens.add({ targets: t, alpha: 0, duration: 900, delay: 2200 });
    }
    // Earth answers with one bright glint
    const g = this.earthGlow;
    if (g?.active) {
      this.tweens.killTweensOf(g);
      this.tweens.add({ targets: g, alpha: 1, scale: 0.9, duration: 500, yoyo: true, hold: 300, ease: 'Sine.easeOut' });
    }
    this.time.delayedCall(2600, () => this.becomeAStar());
  }

  /** UNIT-7 drifts away into the dark until it is one more blinking star, still keeping the record. */
  private becomeAStar(): void {
    const r = this.robot;
    if (!r?.active) return;
    this.tweens.killTweensOf(r);
    // The camera cranes up and away as the robot recedes
    this.tweens.killTweensOf(this.vistaCam);
    this.tweens.add({ targets: this.vistaCam, y: -40, x: 30, duration: 6000, ease: 'Sine.easeInOut' });
    const tx = ROBOT_POS.x + 70, ty = ROBOT_POS.y - 96;
    this.tweens.add({
      targets: r, x: tx, y: ty, scale: 0.35, duration: 4200, ease: 'Sine.easeIn',
      onComplete: () => {
        r.setVisible(false);
        this.ion?.setVisible(false);
        this.visor?.setVisible(false);
        const star = this.add.image(tx, ty - 3, 'glow_thruster').setBlendMode(Phaser.BlendModes.ADD).setTint(PALETTE.cyanLaserHex).setScale(0.07).setDepth(20);
        this.tweens.add({ targets: star, alpha: 0.25, duration: 600, hold: 300, yoyo: true, repeat: -1, repeatDelay: 1600, ease: 'Sine.easeInOut' });
        // A faint pulse home every few seconds, forever
        this.time.addEvent({ delay: 3200, loop: true, callback: () => { if (star.active) this.sendPulse(star.x, star.y, 0.12, 2600); } });
        this.time.delayedCall(1400, () => { if (this.cardPending) this.mountEndCard(); });
      },
    });
  }

  private mountEndCard(): void {
    this.cardPending = false;
    if (this.card) return;
    const s = getReelStats();
    const stage = document.getElementById('game-stage') ?? document.body;
    const card = document.createElement('section');
    card.className = this.reducedMotion ? 'finale-card finale-card--still' : 'finale-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-labelledby', 'finale-title');
    card.innerHTML = `
      <p class="finale-card__kicker">END OF TRANSMISSION</p>
      <h2 id="finale-title" class="finale-card__title">ECHOES OF EXPLORATION</h2>
      <p class="finale-card__line">${FINALE.card_line}</p>
      <p class="finale-card__stats">${s.machines} MACHINES · ${s.worlds} SECTORS · ${s.firstYear} – ${s.lastYear} · AND COUNTING</p>
      <p class="finale-card__tag">Abandoned, but not forgotten.</p>
      <div class="finale-card__actions">
        <button id="btn-finale-replay" class="menu-btn">↺ REPLAY ENDING</button>
        <button id="btn-finale-title" class="menu-btn menu-btn--primary">RETURN TO TITLE ➔</button>
      </div>`;
    stage.appendChild(card);
    this.card = card;
    card.querySelector('#btn-finale-replay')?.addEventListener('click', () => {
      SoundFX.playClick();
      card.classList.remove('is-in');
      if (this.reducedMotion) {
        this.scene.restart();
        return;
      }
      this.cameras.main.fadeOut(600, 5, 7, 15);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart());
    });
    card.querySelector('#btn-finale-title')?.addEventListener('click', () => {
      SoundFX.playClick();
      EventBus.emit(EVENTS.SHOW_TITLE);
    });
    // Force a style flush so the entrance transition always runs
    void card.offsetWidth;
    card.classList.add('is-in');
    card.querySelector<HTMLButtonElement>('#btn-finale-title')?.focus({ preventScroll: true });
    if (this.live) this.live.textContent = `End of transmission. Echoes of Exploration. ${FINALE.card_line}`;
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private createScreenFx(): void {
    const edge = this.add.graphics().setDepth(90);
    const k = PALETTE.spaceBlackHex;
    edge.fillGradientStyle(k, k, k, k, 1, 0, 1, 0).fillRect(0, 0, 36, H);
    edge.fillGradientStyle(k, k, k, k, 0, 1, 0, 1).fillRect(W - 36, 0, 36, H);
    edge.fillGradientStyle(k, k, k, k, 0.6, 0.6, 0, 0).fillRect(0, 0, W, 24);
    if (this.textures.exists('vignette_overlay')) this.add.image(W / 2, H / 2, 'vignette_overlay').setDepth(95).setAlpha(0.7);
  }

  private readonly box = { x: 24, y: H - 72, w: W - 48, h: 58 };
  private readonly nextBox = { w: 62, h: 16 };

  private drawCaptionBox(variant: FrameVariant): void {
    const { x, y, w, h } = this.box;
    const g = this.capBox;
    NineSliceHUD.drawFrame(g, x, y, w, h, variant);
    NineSliceHUD.drawStatusDot(g, x + 10, y + 9, variant === 'amber' ? PALETTE.beaconGoldHex : PALETTE.cyanGlowHex);
    g.fillStyle(PALETTE.atmosphericDuskHex, 1).fillRect(x + 8, y + 18, w - 16, 1);
  }

  private createCaptionConsole(): void {
    const { x, y, w } = this.box;
    this.capLayer = this.add.container(0, 0).setDepth(100).setAlpha(0);
    this.capBox = this.add.graphics();
    this.capTag = this.add.text(x + 17, y + 6, '', { fontSize: '7px', fontFamily: HUD_FONT, color: PALETTE.cyanLaser, letterSpacing: 2 });
    this.capPart = this.add.text(x + w - 10, y + 6, '', { fontSize: '7px', fontFamily: HUD_FONT, color: PALETTE.slateMuted, letterSpacing: 2 }).setOrigin(1, 0);
    // Text wraps short of the NEXT button in the bottom-right corner
    this.capText = this.add.text(x + 10, y + 25, '', {
      fontSize: '7px', fontFamily: HUD_FONT, color: PALETTE.lunarHighlight, letterSpacing: 1,
      wordWrap: { width: w - this.nextBox.w - 32, useAdvancedWrap: true }, lineSpacing: 4,
    });
    this.capLayer.add([this.capBox, this.capTag, this.capPart, this.capText]);
  }

  /** NEXT ▶ in the caption console's corner; dim while UNIT-7 is still talking. */
  private createNextButton(): void {
    const { x, y, w, h } = this.box;
    const { w: bw, h: bh } = this.nextBox;
    const bx = x + w - bw - 8, by = y + h - bh - 7;
    this.nextBg = this.add.graphics().setDepth(102);
    this.nextTxt = this.add.text(bx + bw / 2, by + bh / 2, 'NEXT ▶', { fontSize: '7px', fontFamily: HUD_FONT, color: PALETTE.cyanLaser, letterSpacing: 2 }).setOrigin(0.5).setDepth(103);
    this.nextZone = this.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setDepth(104).setInteractive({ cursor: 'pointer' });
    this.nextZone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.advance();
    });
    this.nextZone.on('pointerover', () => { this.nextHover = true; this.nextReady = null; });
    this.nextZone.on('pointerout', () => { this.nextHover = false; this.nextReady = null; });
    this.refreshNextButton();
    if (!this.reducedMotion) {
      // A gentle nudge on the arrow while the button is ready
      this.tweens.add({ targets: this.nextTxt, x: this.nextTxt.x + 1.5, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  private refreshNextButton(): void {
    const ready = this.canAdvance();
    if (ready === this.nextReady) return;
    this.nextReady = ready;
    const { x, y, w, h } = this.box;
    const { w: bw, h: bh } = this.nextBox;
    const bx = x + w - bw - 8, by = y + h - bh - 7;
    this.nextBg.clear();
    NineSliceHUD.drawFrame(this.nextBg, bx, by, bw, bh, ready ? (this.nextHover ? 'primary' : 'secondary') : 'muted');
    this.nextTxt.setText(this.capTyping ? 'SKIP ▶' : 'NEXT ▶');
    this.nextTxt.setColor(ready ? (this.nextHover ? PALETTE.lunarHighlight : PALETTE.cyanLaser) : PALETTE.slateMuted);
    this.tweens.killTweensOf(this.nextBg);
    this.nextBg.setAlpha(ready ? 1 : 0.55);
    this.nextTxt.setAlpha(ready ? 1 : 0.55);
  }

  private hideNextButton(): void {
    this.nextZone.disableInteractive();
    this.tweens.killTweensOf(this.nextTxt);
    this.tweens.add({ targets: [this.nextBg, this.nextTxt], alpha: 0, duration: this.ms(300) });
  }

  private createSkipButton(): void {
    const bw = 104, bh = 20, bx = W - bw - 14, by = 8;
    const bg = this.add.graphics().setDepth(100);
    NineSliceHUD.drawFrame(bg, bx, by, bw, bh, 'secondary');
    const txt = this.add.text(bx + bw / 2, by + bh / 2, 'SKIP TO END ▶▶', { fontSize: '7px', fontFamily: HUD_FONT, color: PALETTE.lunarCrustCream, letterSpacing: 2 }).setOrigin(0.5).setDepth(101);
    const zone = this.add.zone(bx + bw / 2, by + bh / 2, bw, bh).setDepth(102).setInteractive({ cursor: 'pointer' });
    const hide = () => {
      zone.disableInteractive();
      this.tweens.add({ targets: [bg, txt], alpha: 0, duration: this.ms(300) });
    };
    zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      hide();
      this.skipToEnd();
    });
    zone.on('pointerover', () => txt.setColor(PALETTE.cyanLaser));
    zone.on('pointerout', () => txt.setColor(PALETTE.lunarCrustCream));
    this.events.on('finale-ended', hide);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off('finale-ended', hide));
  }

  private createLiveRegion(): void {
    this.live = document.getElementById('finale-live');
    if (!this.live) {
      this.live = document.createElement('div');
      this.live.id = 'finale-live';
      this.live.setAttribute('aria-live', 'polite');
      this.live.setAttribute('role', 'status');
      this.live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
      document.body.appendChild(this.live);
    }
  }

  private bindInput(): void {
    this.input.keyboard?.on('keydown-SPACE', () => this.advance());
    this.input.keyboard?.on('keydown-ENTER', () => this.advance());
    this.input.keyboard?.on('keydown-RIGHT', () => this.advance());
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > 34) this.advance();
    });
  }

  private cleanup(): void {
    this.card?.remove();
    this.card = null;
    for (const p of this.photoItems) p.el.remove();
    this.photoItems = [];
    if (this.live) this.live.textContent = '';
    this.slideMask?.destroy();
    this.slideMask = null;
    this.backdrops.clear();
    this.activeBackdrop = null;
    this.robot = null;
    this.ion = null;
    this.visor = null;
    this.vista = null;
    this.vistaFront = null;
    this.vistaTiles = [];
    this.vistaBodies = [];
    this.rocks = [];
    this.earthGlow = null;
    this.earthMark = null;
    this.bars = [];
    this.uplink = null;
    this.cardPending = false;
    this.slide = null;
    this.deepStage = null;
    this.planets = null;
    this.stats = null;
    this.track = null;
    this.trackGfx = null;
    this.trackLabels = [];
    this.booster = null;
    this.section = null;
    this.warp = 0;
    this.warpTarget = 0;
  }
}
