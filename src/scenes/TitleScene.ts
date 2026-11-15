import Phaser from 'phaser';
import { Soundscape } from '../audio/Soundscape.ts';
import { CONSTANTS } from '../core/Constants.ts';
import { GameState } from '../core/GameState.ts';
import { PALETTE } from '../ui/theme.ts';
import { PostProcessing } from '../systems/PostProcessing.ts';
import { getTitleLayers, TITLE_PAD, EARTH_FRAMES } from '../systems/TitleArt.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { TalkClock } from '../ui/Talk.ts';
import { NineSliceHUD, HUD_FONT } from '../ui/NineSliceHUD.ts';
import { TitleScreen } from '../ui/TitleScreen.ts';

interface Mote {
  rect: Phaser.GameObjects.Rectangle;
  vx: number;
  vy: number;
}

/** Robot sprite is 24×24; its wheels end on row 21. */
const ROBOT_FOOT_ROW = 21 / 24;
const ROBOT_SCALE = 2;

export class TitleScene extends Phaser.Scene {
  private logoText!: Phaser.GameObjects.Text;
  private cursorText!: Phaser.GameObjects.Text;
  private taglineText!: Phaser.GameObjects.Text;
  private typedChars: number = 0;
  private typingTimer: number = 0;
  private readonly fullLogo: string = 'ECHOES OF EXPLORATION';
  private postProcessing!: PostProcessing;

  // Pointer parallax
  private farLayer!: Phaser.GameObjects.Container;
  private midLayer!: Phaser.GameObjects.Container;
  private nearLayer!: Phaser.GameObjects.Container;
  private earthGroup!: Phaser.GameObjects.Container;
  private parallaxTarget = 0;
  private parallaxCurrent = 0;
  private reducedMotion = false;

  private motes: Mote[] = [];
  private shootingTimer = 0;

  // UNIT-7's speech bubble (comments on the highlighted menu option)
  private robotX = 92;
  private robotTop = 0;
  private antennaGlow: Phaser.GameObjects.Image | null = null;
  private bubble: Phaser.GameObjects.Container | null = null;
  private bubbleGfx!: Phaser.GameObjects.Graphics;
  private bubbleText!: Phaser.GameObjects.Text;
  private talk = new TalkClock();
  private talking = false;

  constructor() {
    super('TitleScene');
  }

  create(): void {
    document.body.classList.remove('in-game');
    // The main theme, over a faint deep-space bed
    Soundscape.set({ music: 'title', ambience: 'space', ambienceLevel: 0.45 });
    const W = CONSTANTS.CANVAS.WIDTH;
    const H = CONSTANTS.CANVAS.HEIGHT;

    this.typedChars = 0;
    this.typingTimer = 0;
    this.motes = [];
    this.parallaxTarget = 0;
    this.parallaxCurrent = 0;
    this.shootingTimer = 4000;
    this.reducedMotion = GameState.getState().settings.reducedMotion;
    this.postProcessing = new PostProcessing(this);

    const layers = getTitleLayers();

    // 0. Sky with galactic band and star dust
    this.add.image(0, 0, 'title_sky').setOrigin(0, 0).setDepth(0);
    this.createTwinkleStars(W);

    // 1. Rotating Earth with soft bloom (no hard disc)
    this.createEarth(W);

    // 2. Ridges (each in a container so the pointer parallax moves its props too)
    this.farLayer = this.add.container(0, 0).setDepth(3);
    this.farLayer.add(this.add.image(-TITLE_PAD, 0, 'title_far').setOrigin(0, 0));

    this.midLayer = this.add.container(0, 0).setDepth(4);
    this.midLayer.add(this.add.image(-TITLE_PAD, 0, 'title_mid').setOrigin(0, 0));
    this.placeDistantLander(layers.mid.heights, W);

    this.nearLayer = this.add.container(0, 0).setDepth(6);
    this.nearLayer.add(this.add.image(-TITLE_PAD, 0, 'title_near').setOrigin(0, 0));
    this.placeRobot(layers.near.heights);

    // 3. Floating regolith dust near the ground
    this.createDustMotes(W, H);

    // 4. Typed pixel logo + tagline with hard pixel drop shadows
    this.createLogo(W);

    // 5. Edge fade into the letterbox, then vignette
    const edge = this.add.graphics().setDepth(90);
    const fadeW = 36;
    edge.fillGradientStyle(PALETTE.spaceBlackHex, PALETTE.spaceBlackHex, PALETTE.spaceBlackHex, PALETTE.spaceBlackHex, 1, 0, 1, 0);
    edge.fillRect(0, 0, fadeW, H);
    edge.fillGradientStyle(PALETTE.spaceBlackHex, PALETTE.spaceBlackHex, PALETTE.spaceBlackHex, PALETTE.spaceBlackHex, 0, 1, 0, 1);
    edge.fillRect(W - fadeW, 0, fadeW, H);
    this.postProcessing.createVignette(W, H, 95);

    this.createBubble();
    const onHint = (text: string) => this.say(text);
    EventBus.on(EVENTS.TITLE_HINT, onHint);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => EventBus.off(EVENTS.TITLE_HINT, onHint));
    // The menu may already be showing (it renders before this scene starts)
    if (TitleScreen.currentHint) this.time.delayedCall(this.reducedMotion ? 0 : 700, () => this.say(TitleScreen.currentHint));

    if (!this.reducedMotion) {
      this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
        this.parallaxTarget = Phaser.Math.Clamp(p.x / W - 0.5, -0.5, 0.5);
      });
    }
  }

  private createTwinkleStars(W: number): void {
    for (let i = 0; i < 16; i++) {
      const x = Math.floor(((i * 137) % (W - 20)) + 10);
      const y = Math.floor(((i * 71) % 190) + 8);
      const big = i % 4 === 0;
      const color = i % 5 === 0 ? PALETTE.cyanLaserHex : PALETTE.lunarHighlightHex;
      const g = this.add.graphics().setDepth(1);
      g.fillStyle(color, 1);
      g.fillRect(x, y, 1, 1);
      if (big) {
        g.fillStyle(color, 0.45);
        g.fillRect(x - 1, y, 1, 1);
        g.fillRect(x + 1, y, 1, 1);
        g.fillRect(x, y - 1, 1, 1);
        g.fillRect(x, y + 1, 1, 1);
      }
      if (!this.reducedMotion) {
        this.tweens.add({
          targets: g,
          alpha: 0.15,
          duration: 900 + (i % 7) * 260,
          delay: (i * 340) % 2400,
          yoyo: true,
          repeat: -1,
          ease: 'Stepped',
          easeParams: [3],
        });
      }
    }
  }

  private createEarth(W: number): void {
    const ex = Math.round(W * 0.77);
    const ey = 92;
    this.earthGroup = this.add.container(ex, ey).setDepth(2);

    const bloom = this.add.image(0, 0, 'glow_disk')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(3.2)
      .setAlpha(0.2);
    const earth = this.add.sprite(0, 0, 'earth_spin', 0);
    this.earthGroup.add([bloom, earth]);

    if (!this.anims.exists('earth_rotate')) {
      this.anims.create({
        key: 'earth_rotate',
        frames: Array.from({ length: EARTH_FRAMES }, (_, i) => ({ key: 'earth_spin', frame: i })),
        frameRate: 3,
        repeat: -1,
      });
    }

    if (!this.reducedMotion) {
      earth.play('earth_rotate');
      this.tweens.add({ targets: bloom, alpha: 0.12, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: this.earthGroup, y: ey - 5, duration: 12000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  /** A real machine left behind, small on the far ridge, beacon still blinking. */
  private placeDistantLander(heights: number[], W: number): void {
    const key = this.textures.exists('hw_apollo-11-site') ? 'hw_apollo-11-site' : 'hw_surveyor-3';
    if (!this.textures.exists(key)) return;

    const x = Math.round(W * 0.86);
    const surface = heights[x + TITLE_PAD];
    const lander = this.add.image(x, surface + 2, key)
      .setOrigin(0.5, 27 / 32)
      .setTint(PALETTE.lunarDustLightHex);
    const beacon = this.add.rectangle(x, surface - 23, 2, 1, PALETTE.beaconGoldHex);
    const beaconGlow = this.add.image(x, surface - 23, 'glow_thruster')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.25)
      .setAlpha(0.8);
    this.midLayer.add([lander, beacon, beaconGlow]);

    if (!this.reducedMotion) {
      this.tweens.add({
        targets: [beacon, beaconGlow],
        alpha: 0,
        duration: 120,
        hold: 200,
        repeatDelay: 2400,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  private placeRobot(heights: number[]): void {
    const x = this.robotX;
    const surface = heights[x + TITLE_PAD];
    this.robotTop = surface + 1 - 21 * ROBOT_SCALE;

    // Tracks leading in from the left, fading with distance
    const tracks = this.add.graphics();
    for (let tx = x - 16, i = 0; tx > 6; tx -= 5, i++) {
      const ty = heights[tx + TITLE_PAD] + 2;
      tracks.fillStyle(PALETTE.lunarBasaltDarkHex, Math.max(0.1, 0.75 - i * 0.05));
      tracks.fillRect(tx, ty, 2, 1);
      tracks.fillRect(tx, ty + 3, 2, 1);
    }

    const shadow = this.add.ellipse(x, surface + 1, 34, 5, PALETTE.deepIndigoHex, 0.7);
    const robot = this.add.sprite(x, surface + 1, 'robot_idle')
      .setOrigin(0.5, ROBOT_FOOT_ROW)
      .setScale(ROBOT_SCALE);

    // Visor glow + antenna beacon
    const visorY = surface + 1 - (21 - 9.5) * ROBOT_SCALE;
    const visorGlow = this.add.image(x, visorY, 'glow_disk')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.55, 0.3)
      .setAlpha(0.7);
    const antennaY = surface + 1 - (21 - 2) * ROBOT_SCALE;
    const antennaGlow = this.add.image(x, antennaY, 'glow_thruster')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(0.35)
      .setAlpha(0.9);

    this.nearLayer.add([tracks, shadow, robot, visorGlow, antennaGlow]);
    this.antennaGlow = antennaGlow;

    if (!this.reducedMotion) {
      // 1px idle bob (stepped so it stays on the pixel grid)
      this.tweens.add({
        targets: [robot, visorGlow, antennaGlow],
        y: '-=1',
        duration: 1400,
        yoyo: true,
        repeat: -1,
        ease: 'Stepped',
      });
      this.tweens.add({ targets: visorGlow, alpha: 0.3, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({
        targets: antennaGlow,
        alpha: 0.1,
        duration: 140,
        hold: 160,
        repeatDelay: 1700,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // UNIT-7's speech bubble
  // ---------------------------------------------------------------------------

  private readonly bubbleW = 148;

  private createBubble(): void {
    const c = this.add.container(0, 0).setAlpha(0).setVisible(false);
    this.bubbleGfx = this.add.graphics();
    const name = this.add.text(10, 6, 'UNIT-7', { fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.cyanLaser, letterSpacing: 2 });
    this.bubbleText = this.add.text(10, 19, '', {
      fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.lunarHighlight, letterSpacing: 1,
      wordWrap: { width: this.bubbleW - 20, useAdvancedWrap: true }, lineSpacing: 3,
    });
    c.add([this.bubbleGfx, name, this.bubbleText]);
    // Inside the near layer, so it moves with the robot's parallax
    this.nearLayer.add(c);
    this.bubble = c;
  }

  /** UNIT-7 says a line in its bubble, typed at the shared talking pace with its voice. */
  private say(text: string): void {
    const c = this.bubble;
    if (!c || !c.active) return;
    this.tweens.killTweensOf(c);
    if (!text) {
      this.talking = false;
      this.tweens.add({ targets: c, alpha: 0, duration: this.reducedMotion ? 0 : 160, onComplete: () => c.setVisible(false) });
      return;
    }

    // Size the frame to the full line, then type it out
    this.bubbleText.setText(text);
    const h = Math.max(36, Math.ceil(this.bubbleText.height) + 28);
    const w = this.bubbleW;
    const x = Math.max(28, this.robotX - 52);
    const touchLandscape = window.matchMedia('(pointer: coarse) and (orientation: landscape)').matches;
    const y = touchLandscape
      ? Math.min(Math.round(this.robotTop - 10 - h), Math.round(CONSTANTS.CANVAS.HEIGHT * 0.41 - h - 10))
      : Math.round(this.robotTop - 10 - h);
    const g = this.bubbleGfx;
    g.clear();
    NineSliceHUD.drawFrame(g, 0, 0, w, h, 'panel');
    if (!touchLandscape) {
      // Pixel tail pointing down at the robot's head
      const tx = this.robotX - x;
      g.fillStyle(PALETTE.deepIndigoHex, 1).fillRect(tx - 4, h - 1, 8, 2).fillRect(tx - 3, h + 1, 6, 2).fillRect(tx - 2, h + 3, 4, 2).fillRect(tx - 1, h + 5, 2, 2);
      g.fillStyle(PALETTE.cyanGlowHex, 1).fillRect(tx - 5, h + 1, 1, 2).fillRect(tx + 4, h + 1, 1, 2).fillRect(tx - 4, h + 3, 1, 2).fillRect(tx + 3, h + 3, 1, 2).fillRect(tx - 3, h + 5, 1, 2).fillRect(tx + 2, h + 5, 1, 2).fillRect(tx - 2, h + 7, 4, 1);
    }
    c.setPosition(x, y).setVisible(true);

    this.talk.start(text, { instant: this.reducedMotion });
    this.bubbleText.setText(this.talk.visible);
    this.talking = !this.talk.done;

    if (this.reducedMotion) {
      c.setAlpha(1).setScale(1);
      return;
    }
    // Pop in from the robot's head, on the pixel grid
    const fresh = c.alpha < 0.5;
    if (fresh) {
      c.setAlpha(0).setScale(0.92).setY(y + 4);
      this.tweens.add({ targets: c, alpha: 1, scale: 1, y, duration: 220, ease: 'Stepped', easeParams: [4] });
    } else {
      c.setAlpha(1).setScale(1);
    }
    // The antenna flashes as it speaks
    if (this.antennaGlow) {
      this.tweens.add({ targets: this.antennaGlow, alpha: 1, scale: 0.55, duration: 90, yoyo: true });
    }
  }

  private createDustMotes(W: number, H: number): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < 22; i++) {
      const rect = this.add.rectangle(
        Phaser.Math.Between(0, W),
        Phaser.Math.Between(H - 120, H - 10),
        1,
        1,
        i % 4 === 0 ? PALETTE.cyanLaserHex : PALETTE.lunarCrustCreamHex,
        Phaser.Math.FloatBetween(0.15, 0.45)
      ).setDepth(7);
      this.motes.push({ rect, vx: Phaser.Math.FloatBetween(2, 6), vy: Phaser.Math.FloatBetween(-2.5, -0.5) });
    }
  }

  private createLogo(W: number): void {
    // 21 characters: a touch smaller than the old logo so it clears the 640px stage edges
    this.logoText = this.add.text(W / 2 - 6, 36, '', {
      fontSize: '15px',
      fontFamily: 'StillOutTherePixel, monospace',
      color: PALETTE.lunarHighlight,
      letterSpacing: 2,
    }).setOrigin(0.5, 0.5).setDepth(10)
      .setShadow(0, 2, PALETTE.cyanShadow, 0, false, true);

    this.cursorText = this.add.text(W / 2, 36, '_', {
      fontSize: '15px',
      fontFamily: 'StillOutTherePixel, monospace',
      color: PALETTE.cyanGlow,
    }).setOrigin(0, 0.5).setDepth(10);

    this.tweens.add({
      targets: this.cursorText,
      alpha: 0,
      duration: 450,
      yoyo: true,
      repeat: -1,
      ease: 'Stepped',
    });

    const tagline = this.add.text(W / 2, 57, 'THE NASA SIGNAL ARCHIVE', {
      fontSize: '9px',
      fontFamily: 'StillOutTherePixel, monospace',
      color: PALETTE.beaconGold,
      letterSpacing: 2,
    }).setOrigin(0.5, 0.5).setDepth(10).setAlpha(0)
      .setShadow(0, 1, PALETTE.emberShadow, 0, false, true);

    this.taglineText = tagline;
    this.tweens.add({ targets: tagline, alpha: 1, duration: 1000, delay: 1400 });
  }

  private spawnShootingStar(W: number): void {
    const sx = Phaser.Math.Between(60, W - 200);
    const sy = Phaser.Math.Between(14, 90);
    const g = this.add.graphics().setDepth(1);
    g.fillStyle(PALETTE.lunarHighlightHex, 1);
    g.fillRect(0, 0, 2, 1);
    g.fillStyle(PALETTE.lunarHighlightHex, 0.5);
    g.fillRect(-4, -1, 4, 1);
    g.fillStyle(PALETTE.lunarHighlightHex, 0.25);
    g.fillRect(-9, -2, 5, 1);
    g.setPosition(sx, sy);
    this.tweens.add({
      targets: g,
      x: sx + 90,
      y: sy + 22,
      alpha: 0,
      duration: 700,
      ease: 'Quad.easeIn',
      onComplete: () => g.destroy(),
    });
  }

  update(_time: number, delta: number): void {
    const compactTitle = window.matchMedia('(pointer: coarse)').matches && document.getElementById('title-overlay')?.classList.contains('is-compact');
    this.logoText.setVisible(!compactTitle);
    this.cursorText.setVisible(!compactTitle);
    this.taglineText.setVisible(!compactTitle);
    const dt = delta / 1000;
    if (this.talking && this.bubbleText?.active) {
      if (this.talk.tick(dt)) this.bubbleText.setText(this.talk.visible);
      if (this.talk.done) this.talking = false;
    }
    const W = CONSTANTS.CANVAS.WIDTH;
    const H = CONSTANTS.CANVAS.HEIGHT;

    // Pointer parallax (rounded to whole pixels to keep the art crisp)
    if (!this.reducedMotion) {
      this.parallaxCurrent += (this.parallaxTarget - this.parallaxCurrent) * Math.min(1, dt * 3);
      const p = this.parallaxCurrent;
      this.earthGroup.x = Math.round(W * 0.77 - p * 4);
      this.farLayer.x = Math.round(-p * 6);
      this.midLayer.x = Math.round(-p * 12);
      this.nearLayer.x = Math.round(-p * 22);

      for (const m of this.motes) {
        m.rect.x += m.vx * dt;
        m.rect.y += m.vy * dt;
        if (m.rect.x > W + 2 || m.rect.y < H - 130) {
          m.rect.x = Phaser.Math.Between(-10, W * 0.6);
          m.rect.y = Phaser.Math.Between(H - 60, H - 8);
        }
      }

      this.shootingTimer -= delta;
      if (this.shootingTimer <= 0) {
        this.spawnShootingStar(W);
        this.shootingTimer = Phaser.Math.Between(7000, 13000);
      }
    }

    // Typewriter effect for pixel logo
    if (this.typedChars < this.fullLogo.length) {
      this.typingTimer += delta;
      if (this.typingTimer >= 75) {
        this.typingTimer = 0;
        this.typedChars++;
        this.logoText.setText(this.fullLogo.substring(0, this.typedChars));
        this.cursorText.setX(this.logoText.x + this.logoText.width / 2 + 3);
      }
    }
  }
}
