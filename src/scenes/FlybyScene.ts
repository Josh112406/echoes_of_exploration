import Phaser from 'phaser';
import { CONSTANTS } from '../core/Constants.ts';
import { GameState } from '../core/GameState.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { Soundscape } from '../audio/Soundscape.ts';
import { PALETTE } from '../ui/theme.ts';
import { NineSliceHUD } from '../ui/NineSliceHUD.ts';
import { bayer, hash } from '../systems/SpriteArt.ts';
import { PostProcessing } from '../systems/PostProcessing.ts';
import { MobileJoystick, bindHeldAction, bindPressAction } from '../ui/MobileJoystick.ts';
import { buildRingedPlanet } from '../systems/TitleArt.ts';
import { buildBandedGiant, buildSmallMoon, buildHazeMoon } from '../systems/SpaceArt.ts';
import {
  MG_W as W, MG_H as H, Particles, Banner, drawSegBar, hudText, fitText, touchButton, exitButton,
  showBriefing, missionName, completeMinigame, failMinigame,
} from '../systems/MinigameKit.ts';

/**
 * HIGH-VELOCITY DEEP-SPACE FLYBY IMAGING (Galileo at Europa, Deep Impact at
 * comet Tempel 1, New Horizons at Pluto, NEAR Shoemaker at Eros, Cassini at
 * Enceladus). Every Elsewhere echo is played as its flyby / orbital imaging work (NEAR's
 * year in orbit before its landing on Eros; Cassini's passes before Huygens' descent).
 *
 * The target body swings past on a curved flyby path, growing toward closest
 * approach and shrinking away, while it rotates three science targets through
 * sunlight. Slew the narrow-angle camera, hold it steady to focus, and fire the
 * shutter on lit targets. Debris crossing the frame kicks the gimbal; a dust
 * cover can block it at the cost of focus. 60 Hz fixed step.
 */

const R = 64; // rendered body radius (texture px); scaled by approach
const MAP_W = 128;
const MAP_H = 64;
const BOX_W = 48;
const BOX_H = 36;
const SUN = (() => { const v = [-0.72, -0.32, 0.62]; const l = Math.hypot(v[0], v[1], v[2]); return v.map((c) => c / l); })();

interface Target { name: string; lat: number; lon: number; captured: boolean; sx: number; sy: number; visible: boolean; lit: boolean }
interface Debris { x: number; y: number; vx: number; vy: number; size: number; hit: boolean }
interface Star { x: number; y: number; z: number }

interface BodyTheme {
  kind: 'europa' | 'comet' | 'pluto' | 'eros' | 'enceladus' | 'luna' | 'giant' | 'ceres';
  /** Target that is a separate moon orbiting in view rather than a surface feature. */
  moonTarget?: string;
  /** Index of the target that vents a plume while it faces the camera. */
  plumeTarget?: number;
  title: string;
  subtitle: string;
  ramp: number[];
  targets: [string, number, number][];
  debris: string;
  oblate: number;
  /** A line in the briefing for what the real mission did beyond this flyby. */
  realNote?: string;
  /** Storm spots on a banded giant: [lat°, lon°, radius (rad), map code]. */
  spots?: [number, number, number, number][];
  /** Band frequency for a banded giant. */
  bands?: number;
  /** Atmosphere glow tint behind the limb. */
  limb?: number;
}

const D = Math.PI / 180;

/** Approximate lunar maria for the Moon map: [lat°, lon°E, angular radius (rad)]. */
const LUNAR_MARIA: [number, number, number][] = [
  [33, 342, 0.28], [28, 17, 0.17], [8.5, 31, 0.2], [17, 59, 0.11], [-8, 51, 0.15],
  [-21, 343, 0.15], [-10, 337, 0.09], [18, 303, 0.35], [56, 1, 0.1],
];

export class FlybyScene extends Phaser.Scene {
  private siteId = 'new-horizons';
  private assisted = false;
  private reduced = false;
  private theme!: BodyTheme;

  private map!: Uint8Array;
  private bodyTex!: Phaser.Textures.CanvasTexture;
  private body!: Phaser.GameObjects.Image;
  private limb!: Phaser.GameObjects.Image;
  private rot = 0;
  private renderTick = 0;
  private bx = 0;
  private by = 0;
  private scaleNow = 1;

  private targets: Target[] = [];
  private debris: Debris[] = [];
  private stars: Star[] = [];
  private debrisTimer = 2;

  // Gimbal / camera
  private fx = W / 2;
  private fy = H / 2;
  private fvx = 0;
  private fvy = 0;
  private focus = 0;
  private shield = false;
  private pointerAim: { x: number; y: number } | null = null;

  private t = 0;
  private T = 42;
  private storage = 8;
  private storageMax = 8;
  private captured = 0;
  private flash = 0;
  private started = false;
  private armedAt = 0;
  private ended = false;
  private won = false;
  private timeScale = 1;
  private accum = 0;
  private warn = 0;
  private downlink = 0;

  private keys!: Record<'W' | 'A' | 'S' | 'D' | 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SHIFT' | 'E', Phaser.Input.Keyboard.Key>;
  private touchShield = false;
  private mobileJoystick: MobileJoystick | null = null;

  private starGfx!: Phaser.GameObjects.Graphics;
  private fxGfx!: Phaser.GameObjects.Graphics;
  private boxGfx!: Phaser.GameObjects.Graphics;
  private hud!: Phaser.GameObjects.Graphics;
  private readout!: Phaser.GameObjects.Text;
  private targetLabels: Phaser.GameObjects.Text[] = [];
  private sparks!: Particles;
  private plume!: Particles;
  private banner!: Banner;

  constructor() {
    super('FlybyScene');
  }

  init(data: { siteId: string; assisted?: boolean }): void {
    this.siteId = data.siteId;
    this.assisted = !!data.assisted;
  }

  create(): void {
    document.body.classList.add('in-game');
    this.reduced = GameState.getState().settings.reducedMotion;
    this.theme = this.pickTheme();
    Soundscape.set({ music: 'landing', ambience: 'space', ambienceLevel: 0.55, fade: 1.4 });

    this.rot = 0; this.renderTick = 0; this.t = 0;
    this.T = this.assisted ? 58 : 44;
    this.storageMax = this.assisted ? 12 : 8;
    this.storage = this.storageMax;
    this.captured = 0; this.flash = 0; this.focus = 0; this.warn = 0; this.downlink = 0;
    this.started = this.ended = this.won = false;
    this.timeScale = 1; this.accum = 0; this.debrisTimer = 2;
    this.fx = W * 0.46; this.fy = H * 0.52; this.fvx = this.fvy = 0;
    this.debris = [];
    this.pointerAim = null;
    this.shield = this.touchShield = false;
    this.mobileJoystick = MobileJoystick.fromPage();
    const shieldButton = document.getElementById('mobile-flyby-shield');
    const shutterButton = document.getElementById('mobile-flyby-shutter');
    const unbindShield = shieldButton
      ? bindHeldAction(shieldButton, () => { this.touchShield = true; }, () => { this.touchShield = false; })
      : () => {};
    const unbindShutter = shutterButton ? bindPressAction(shutterButton, () => this.shutter()) : () => {};
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.body.classList.remove('flyby-scene');
      unbindShield();
      unbindShutter();
      this.mobileJoystick?.destroy();
      this.mobileJoystick = null;
    });
    this.targets = this.theme.targets.map(([name, lat, lon]) => ({ name, lat: lat * D, lon: lon * D, captured: false, sx: 0, sy: 0, visible: false, lit: false }));

    this.cameras.main.setBackgroundColor(PALETTE.spaceBlack);
    this.stars = Array.from({ length: 140 }, (_v, i) => ({ x: hash(i, 1, 4) * W, y: hash(i, 2, 4) * H, z: 0.2 + hash(i, 3, 4) * 0.8 }));
    this.starGfx = this.add.graphics().setDepth(0);
    this.buildBackdropBody();
    this.buildMap();
    const key = 'flyby_body';
    if (this.textures.exists(key)) this.textures.remove(key);
    this.bodyTex = this.textures.createCanvas(key, R * 2 + 2, R * 2 + 2)!;
    this.limb = this.add.image(0, 0, 'glow_disk').setBlendMode(Phaser.BlendModes.ADD).setDepth(2).setAlpha(0.18)
      .setTint(this.theme.limb ?? (this.theme.kind === 'pluto' ? PALETTE.marsHazePeachHex : this.theme.kind === 'comet' || this.theme.kind === 'enceladus' ? PALETTE.cyanGlowHex : PALETTE.lunarCrustCreamHex));
    this.body = this.add.image(0, 0, key).setDepth(3);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (this.textures.exists(key)) this.textures.remove(key); });
    this.plume = new Particles(this, 4, 320);
    this.fxGfx = this.add.graphics().setDepth(5);
    this.sparks = new Particles(this, 7, 160);
    this.boxGfx = this.add.graphics().setDepth(8);
    this.renderBody();
    this.placeBody();

    new PostProcessing(this).createVignette(W, H, 95);
    this.createHUD(missionName(this.siteId));

    const kb = this.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT,E') as FlybyScene['keys'];
    kb.on('keydown-SPACE', () => this.shutter());
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      this.pointerAim = p.y > 40 && p.y < H - 40 ? { x: p.x, y: p.y } : null;
    });
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (p.y > 40 && p.y < H - 40) this.shutter();
    });

    showBriefing(this, {
      title: `${this.theme.title} // ${missionName(this.siteId).toUpperCase()}`,
      subtitle: this.theme.subtitle,
      lines: [
        '• [WASD / ARROWS / POINTER] SLEW THE CAMERA   [SPACE / CLICK] SHUTTER',
        '• HOLD THE FRAME STEADY ON A TARGET UNTIL THE FOCUS RING CLOSES',
        '• TARGETS ONLY COUNT IN SUNLIGHT. THE BODY ROTATES THEM INTO VIEW',
        `• ${this.theme.debris} KICKS THE GIMBAL. HOLD [SHIFT / E] FOR THE DUST COVER`,
        `• ONE PASS, NO BRAKES: 3 TARGETS, ${this.storageMax} FRAMES OF STORAGE`,
        ...(this.theme.realNote ? [`• TRUE STORY: ${this.theme.realNote}`] : []),
      ],
      cta: 'ARM THE CAMERA ➔',
    }, () => { this.started = true; this.armedAt = this.time.now; document.body.classList.add('flyby-scene'); });
  }

  private pickTheme(): BodyTheme {
    if (this.siteId === 'galileo') {
      return {
        kind: 'europa', title: 'JUPITER SYSTEM FLYBY', subtitle: 'EUROPA · AN ICE SHELL OVER A HIDDEN OCEAN', oblate: 1,
        ramp: [PALETTE.deepIndigoHex, PALETTE.lunarRegolithDeepHex, PALETTE.lunarDustLightHex, PALETTE.lunarCrustCreamHex, PALETTE.lunarHighlightHex],
        targets: [['CONAMARA CHAOS', 10, 270], ['DOUBLE RIDGE LINEA', -5, 30], ['PWYLL CRATER', -25, 150]],
        debris: 'RING DUST',
      };
    }
    if (this.siteId === 'deep-impact') {
      return {
        kind: 'comet', title: 'COMET ENCOUNTER', subtitle: 'TEMPEL 1 · WATCH THE IMPACT PLUME', oblate: 0.62,
        ramp: [PALETTE.deepIndigoHex, PALETTE.lunarBasaltDarkHex, PALETTE.lunarRegolithDeepHex, PALETTE.lunarRegolithMidHex, PALETTE.lunarDustLightHex],
        targets: [['IMPACT PLUME', 5, 300], ['SMOOTH TERRAIN', -10, 60], ['SURFACE ICE PATCH', -20, 180]],
        debris: 'COMA DUST', plumeTarget: 0,
      };
    }
    if (this.siteId === 'near-shoemaker') {
      return {
        kind: 'eros', title: 'ASTEROID RENDEZVOUS', subtitle: 'EROS · THE FIRST ASTEROID EVER ORBITED', oblate: 0.5,
        ramp: [PALETTE.deepIndigoHex, PALETTE.lunarBasaltDarkHex, PALETTE.lunarRegolithDeepHex, PALETTE.lunarRegolithMidHex, PALETTE.lunarDustLightHex],
        targets: [['PSYCHE CRATER', 15, 90], ['HIMEROS SADDLE', -5, 270], ['BOULDER FIELD', -20, 180]],
        debris: 'REGOLITH DUST',
        realNote: 'NEAR MAPPED EROS FROM ORBIT FOR A YEAR, THEN LANDED ON IT IN 2001',
      };
    }
    if (this.siteId === 'cassini-huygens') {
      return {
        kind: 'enceladus', title: 'SATURN SYSTEM FLYBY', subtitle: 'ENCELADUS · ICE GEYSERS FROM A HIDDEN OCEAN', oblate: 1,
        ramp: [PALETTE.deepIndigoHex, PALETTE.lunarRegolithMidHex, PALETTE.lunarDustLightHex, PALETTE.lunarCrustCreamHex, PALETTE.lunarHighlightHex],
        targets: [['TIGER STRIPES', -50, 120], ['SOUTH POLAR PLUMES', -58, 250], ['TITAN', 0, 0]],
        debris: 'E-RING ICE', plumeTarget: 1, moonTarget: 'TITAN',
        realNote: "CASSINI'S HUYGENS PROBE PARACHUTED TO TITAN'S SURFACE IN 2005",
      };
    }
    const grey = [PALETTE.deepIndigoHex, PALETTE.lunarBasaltDarkHex, PALETTE.lunarRegolithDeepHex, PALETTE.lunarRegolithMidHex, PALETTE.lunarDustLightHex];
    const jupiter = [PALETTE.deepIndigoHex, PALETTE.marsShadowUmberHex, PALETTE.marsDustTanHex, PALETTE.marsHazePeachHex, PALETTE.lunarCrustCreamHex];
    if (this.siteId === 'ranger-7-9') {
      return {
        kind: 'luna', title: 'LUNAR IMPACT APPROACH', subtitle: 'RANGER · PICTURES ALL THE WAY DOWN', oblate: 1, ramp: grey,
        // Impact sites of Rangers 7, 8 and 9
        targets: [['MARE COGNITUM', -10.35, 339.42], ['MARE TRANQUILLITATIS', 2.64, 24.79], ['ALPHONSUS CRATER', -12.83, 357.61]],
        debris: 'MICROMETEOROID DUST',
      };
    }
    if (this.siteId === 'lunar-orbiter-program') {
      return {
        kind: 'luna', title: 'LUNAR ORBITAL MAPPING', subtitle: 'LUNAR ORBITER · SCOUTING APOLLO LANDING SITES', oblate: 1, ramp: grey,
        targets: [['TRANQUILLITY LANDING SITE', 0.67, 23.47], ['COPERNICUS CRATER', 9.62, 339.92], ['ORIENTALE BASIN', -19.4, 267.2]],
        debris: 'MICROMETEOROID DUST',
      };
    }
    if (this.siteId === 'pioneer-10') {
      return {
        kind: 'giant', title: 'JUPITER FLYBY', subtitle: 'PIONEER 10 · FIRST SPACECRAFT TO PASS JUPITER', oblate: 0.93, ramp: jupiter, bands: 9,
        spots: [[-22, 60, 0.17, 11]],
        targets: [['GREAT RED SPOT', -22, 60], ['NORTH EQUATORIAL BELT', 12, 200], ['SOUTH TEMPERATE ZONE', -35, 300]],
        debris: 'RADIATION GLITCHES',
      };
    }
    if (this.siteId === 'pioneer-11') {
      return {
        kind: 'giant', title: 'JUPITER POLAR PASS', subtitle: "PIONEER 11 · JUPITER'S NORTH POLAR REGION", oblate: 0.93, ramp: jupiter, bands: 9,
        spots: [[-22, 60, 0.17, 11]],
        targets: [['NORTH POLAR REGION', 62, 120], ['GREAT RED SPOT', -22, 60], ['NORTH TEMPERATE BELT', 24, 250]],
        debris: 'RADIATION GLITCHES',
      };
    }
    if (this.siteId === 'voyager-2') {
      return {
        kind: 'giant', title: 'NEPTUNE FLYBY', subtitle: 'VOYAGER 2 · THE ONLY VISIT TO NEPTUNE', oblate: 0.98, bands: 5,
        ramp: [PALETTE.deepIndigoHex, PALETTE.cyanShadowHex, PALETTE.cyanDeepHex, PALETTE.cyanGlowHex, PALETTE.cyanLaserHex],
        spots: [[-20, 120, 0.15, 0], [-42, 240, 0.05, 12]],
        targets: [['GREAT DARK SPOT', -20, 120], ['SCOOTER CLOUD', -42, 240], ['TRITON', 0, 0]],
        debris: 'RING DUST', moonTarget: 'TRITON', limb: PALETTE.cyanGlowHex,
      };
    }
    if (this.siteId === 'dawn') {
      return {
        kind: 'ceres', title: 'DWARF PLANET ORBIT', subtitle: 'DAWN · THE BRIGHT SPOTS OF CERES', oblate: 0.93, ramp: grey,
        targets: [['OCCATOR BRIGHT SPOTS', 19.8, 239.3], ['AHUNA MONS', -10.5, 316.2], ['KERWAN BASIN', -10.8, 124]],
        debris: 'REGOLITH DUST',
      };
    }
    return {
      kind: 'pluto', title: 'PLUTO FLYBY', subtitle: 'ONE PASS AT FULL SPEED · NO WAY TO SLOW DOWN', oblate: 1,
      ramp: [PALETTE.deepIndigoHex, PALETTE.marsDeepRustHex, PALETTE.marsTerracottaHex, PALETTE.marsDustTanHex, PALETTE.marsHazePeachHex],
      targets: [['SPUTNIK PLANITIA', 20, 180], ['WRIGHT MONS', -22, 150], ['CHARON', 0, 0]],
      debris: 'KUIPER DEBRIS', moonTarget: 'CHARON',
    };
  }

  // ---------------------------------------------------------------------------
  // Body art
  // ---------------------------------------------------------------------------

  /** Equirectangular surface map of ramp indices (plus special codes ≥ 10). */
  private buildMap(): void {
    const m = new Uint8Array(MAP_W * MAP_H);
    const kind = this.theme.kind;
    const near = (lat: number, lon: number, lat0: number, lon0: number) => {
      const dl = Math.atan2(Math.sin(lon - lon0), Math.cos(lon - lon0));
      return Math.hypot(dl * Math.cos(lat), lat - lat0);
    };
    for (let j = 0; j < MAP_H; j++) {
      const lat = (0.5 - (j + 0.5) / MAP_H) * Math.PI;
      for (let i = 0; i < MAP_W; i++) {
        const lon = ((i + 0.5) / MAP_W) * Math.PI * 2;
        const n = hash(i >> 1, j >> 1, 7) * 0.5 + hash(i >> 3, j >> 3, 8) * 0.5;
        let v = 0;
        if (kind === 'europa') {
          v = 3;
          if (n < 0.3) v = 2;
          for (let k = 0; k < 3; k++) {
            // Long cycloid-ish ridges: lat follows a slow sine of longitude
            const ridge = 0.5 * Math.sin(lon * (k + 1) + k * 2.1) - 0.35 + k * 0.35;
            if (Math.abs(lat - ridge) < 0.035 + (k === 1 ? 0.015 : 0)) v = 10; // linea
          }
          if (near(lat, lon, 10 * D, 270 * D) < 0.28 && n > 0.45) v = 11; // chaos
          const p = near(lat, lon, -25 * D, 150 * D);
          if (p < 0.07) v = 1; else if (p < 0.22 && hash(i, j, 3) > 0.6) v = 4;
        } else if (kind === 'comet') {
          v = n < 0.35 ? 1 : n < 0.7 ? 2 : 3;
          if (near(lat, lon, -10 * D, 60 * D) < 0.35) v = 3; // smooth terrain
          if (near(lat, lon, -20 * D, 180 * D) < 0.13) v = 12; // ice
          if (near(lat, lon, 5 * D, 300 * D) < 0.1) v = 1; // impact crater
        } else if (kind === 'eros') {
          v = n < 0.4 ? 1 : n < 0.75 ? 2 : 3;
          const psyche = near(lat, lon, 15 * D, 90 * D);
          if (psyche < 0.3) v = 1; else if (psyche < 0.36) v = 4; // big crater, bright rim
          if (near(lat, lon, -5 * D, 270 * D) < 0.45 && n > 0.3) v = 1; // saddle depression
          if (near(lat, lon, -20 * D, 180 * D) < 0.35 && hash(i, j, 5) > 0.82) v = 4; // boulders
        } else if (kind === 'enceladus') {
          v = n < 0.3 ? 2 : 3;
          if (lat > 0.2 && hash(i, j, 9) > 0.94) v = 1; // old cratered north
          if (lat < -45 * D && Math.abs(Math.sin(lon * 2 + lat * 10)) < 0.09) v = 15; // tiger stripes
        } else if (kind === 'luna') {
          v = n < 0.45 ? 2 : 3;
          if (hash(i, j, 13) > 0.965) v = 4; // small bright crater rims
          // Dark maria (lat°, lon°E, radius)
          for (const [mla, mlo, mr] of LUNAR_MARIA) if (near(lat, lon, mla * D, mlo * D) < mr + (n - 0.5) * 0.12) v = 1;
          const cop = near(lat, lon, 9.62 * D, 339.92 * D);
          if (cop < 0.05) v = 2; else if (cop < 0.075) v = 4; // Copernicus
          const ori = near(lat, lon, -19.4 * D, 267.2 * D);
          if (ori < 0.1) v = 1; else if (Math.abs(ori - 0.22) < 0.025) v = 4; // Orientale rings
        } else if (kind === 'giant') {
          const k = this.theme.bands ?? 8;
          const band = Math.sin(lat * k + Math.sin(lon * 2 + lat * 6) * 0.18 + (n - 0.5) * 0.5);
          v = band > 0.55 ? 4 : band > 0.1 ? 3 : band > -0.4 ? 2 : 1;
          for (const [sla, slo, sr, code] of this.theme.spots ?? []) {
            const d = near(lat, lon, sla * D, slo * D);
            if (d < sr) v = code;
            else if (d < sr * 1.35 && code >= 10) v = 4; // pale collar
          }
        } else if (kind === 'ceres') {
          v = n < 0.4 ? 1 : n < 0.75 ? 2 : 3;
          if (hash(i, j, 17) > 0.955) v = hash(i, j, 18) > 0.5 ? 4 : 1; // small craters
          const ker = near(lat, lon, -10.8 * D, 124 * D);
          if (ker < 0.28) v = 2; else if (ker < 0.32) v = 4; // Kerwan basin
          const occ = near(lat, lon, 19.8 * D, 239.3 * D);
          if (occ < 0.025) v = 12; else if (occ < 0.1) v = 1; else if (occ < 0.12) v = 4; // Occator + bright faculae
          if (near(lat, lon, -10.5 * D, 316.2 * D) < 0.04) v = 4; // Ahuna Mons
        } else {
          v = n < 0.4 ? 2 : 3;
          if (Math.abs(lat) > 1.1) v = 4;
          const dl = Math.atan2(Math.sin(lon - 100 * D), Math.cos(lon - 100 * D));
          const fine = hash(i, j, 11) - 0.5;
          if (Math.abs(lat + 8 * D) < 0.13 + fine * 0.08 + 0.05 * Math.cos(dl * 3) && Math.abs(dl) < 0.7 + fine * 0.2) v = 13; // dark red equatorial belt
          // Heart: implicit curve in local coordinates around the plain
          const hx = Math.atan2(Math.sin(lon - 180 * D), Math.cos(lon - 180 * D)) / 0.55;
          const hy = (lat - 12 * D) / 0.55;
          if ((hx * hx + hy * hy - 0.5) ** 3 - 1.2 * hx * hx * hy ** 3 < 0) v = 14;
          if (near(lat, lon, -22 * D, 150 * D) < 0.1) v = 1;
        }
        m[j * MAP_W + i] = v;
      }
    }
    this.map = m;
  }

  /** Software-lit sphere (or squashed comet) rendered into the canvas texture. */
  private renderBody(): void {
    const ctx = this.bodyTex.getContext();
    const size = R * 2 + 2;
    const img = ctx.createImageData(size, size);
    const ramp = this.theme.ramp.map((c) => [(c >> 16) & 255, (c >> 8) & 255, c & 255]);
    const special: Record<number, number> = {
      10: PALETTE.marsOchreCoreHex, 11: PALETTE.marsTerracottaHex, 12: PALETTE.lunarHighlightHex,
      13: PALETTE.marsDeepRustHex, 14: PALETTE.lunarCrustCreamHex, 15: PALETTE.cyanDeepHex,
    };
    const ob = this.theme.oblate;
    const comet = this.theme.kind === 'comet' || this.theme.kind === 'eros';
    for (let py = 0; py < size; py++) {
      for (let px = 0; px < size; px++) {
        let x = (px + 0.5 - size / 2) / R;
        let y = (py + 0.5 - size / 2) / (R * ob);
        if (comet) {
          // Lumpy silhouette
          const a = Math.atan2(y, x);
          const bump = 1 - 0.08 * Math.sin(a * 3 + 1) - 0.05 * Math.sin(a * 7);
          x /= bump;
          y /= bump;
        }
        const r2 = x * x + y * y;
        if (r2 > 1) continue;
        const z = Math.sqrt(1 - r2);
        const ny = y * ob;
        const lat = Math.asin(Phaser.Math.Clamp(-y, -1, 1));
        const lon = Math.atan2(x, z) + this.rot;
        const mi = Math.floor((((lon / (Math.PI * 2)) % 1) + 1) % 1 * MAP_W);
        const mj = Math.floor((0.5 - lat / Math.PI) * MAP_H);
        const code = this.map[Phaser.Math.Clamp(mj, 0, MAP_H - 1) * MAP_W + mi];
        const lam = Math.max(0, x * SUN[0] + ny * SUN[1] + z * SUN[2]);
        const o = (py * size + px) * 4;
        let rgb: number[];
        if (code >= 10) {
          const c = special[code];
          rgb = lam < 0.08 + bayer(px, py) * 0.12 ? ramp[0] : [(c >> 16) & 255, (c >> 8) & 255, c & 255];
          if (lam < 0.35 && lam >= 0.08) rgb = rgb.map((ch) => ch * 0.6);
        } else {
          const v = (code / 4) * 0.55 + lam * 0.75 - 0.25 + bayer(px, py) * 0.18;
          const idx = lam < 0.06 ? 0 : Phaser.Math.Clamp(Math.floor(v * ramp.length), 0, ramp.length - 1);
          rgb = ramp[idx];
        }
        img.data[o] = rgb[0];
        img.data[o + 1] = rgb[1];
        img.data[o + 2] = rgb[2];
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    this.bodyTex.refresh();
  }

  /** Static giant planet behind the pass (Jupiter, Saturn). */
  private farObj: Phaser.GameObjects.Image | null = null;
  /** Moon orbiting in view that can itself be imaged (Charon, Titan). */
  private moonObj: Phaser.GameObjects.Image | null = null;

  private buildBackdropBody(): void {
    this.farObj = null;
    this.moonObj = null;
    const tex = (key: string, make: () => HTMLCanvasElement) => {
      if (!this.textures.exists(key)) this.textures.addCanvas(key, make());
      return key;
    };
    // SpaceArt lights from the upper right; flip to match this scene's Sun on the left
    const kind = this.theme.kind;
    if (kind === 'europa') {
      this.farObj = this.add.image(0, 0, tex('flyby_jupiter', () => buildBandedGiant(220, 5))).setFlipX(true).setDepth(1).setAlpha(0.9);
    } else if (kind === 'enceladus') {
      this.farObj = this.add.image(0, 0, tex('flyby_saturn', () => buildRingedPlanet(200, 17))).setFlipX(true).setDepth(1).setAlpha(0.9);
      this.moonObj = this.add.image(0, 0, tex('flyby_titan', () => buildHazeMoon(30, 19))).setFlipX(true).setDepth(3);
    } else if (kind === 'pluto') {
      this.moonObj = this.add.image(0, 0, tex('flyby_charon', () => buildSmallMoon(40, 31, false))).setFlipX(true).setDepth(3);
    } else if (this.theme.moonTarget === 'TRITON') {
      this.moonObj = this.add.image(0, 0, tex('flyby_triton', () => buildSmallMoon(30, 41, true))).setFlipX(true).setDepth(3);
    }
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private createHUD(name: string): void {
    const f = this.add.graphics().setDepth(100);
    NineSliceHUD.drawFrame(f, 12, 8, 330, 24, 'panel');
    NineSliceHUD.drawFrame(f, 12, 252, 230, 72, 'panel');
    NineSliceHUD.drawStatusDot(f, 20, 19);
    fitText(hudText(this, 28, 16, `${this.theme.title} // ${name.toUpperCase()}`, PALETTE.cyanLaser), 306);
    this.targetLabels = this.targets.map((tg, i) => hudText(this, 46, 260 + i * 14, tg.name, PALETTE.lunarCrustCream));
    this.readout = hudText(this, 20, 304, '', PALETTE.lunarDustLight);
    this.hud = this.add.graphics().setDepth(101);
    this.banner = new Banner(this, 54, this.reduced);
    exitButton(this, 'SURFACE MAP', () => this.scene.start('SiteScene'));
    if (!window.matchMedia('(pointer: coarse)').matches) {
      touchButton(this, W - 230, H - 32, 100, 24, 'DUST COVER', 'ghost', () => { this.touchShield = true; }, () => { this.touchShield = false; });
      touchButton(this, W - 122, H - 32, 108, 24, 'SHUTTER [SPACE]', 'primary', () => this.shutter());
    }
  }

  private renderHUD(): void {
    const g = this.hud;
    g.clear();
    this.targets.forEach((tg, i) => {
      const y = 260 + i * 14;
      // Thumbnail pip: filled once captured
      g.fillStyle(tg.captured ? PALETTE.beaconGoldHex : PALETTE.shadowNavyHex, 1).fillRect(22, y, 16, 9);
      g.fillStyle(PALETTE.atmosphericDuskHex, 1).fillRect(22, y, 16, 1);
      if (tg.captured) g.fillStyle(PALETTE.lunarHighlightHex, 1).fillRect(28, y + 3, 4, 3);
      const state = tg.captured ? 'IMAGED' : !tg.visible ? 'FAR SIDE' : !tg.lit ? 'IN SHADOW' : 'IN SUNLIGHT';
      this.targetLabels[i].setText(`${tg.name} · ${state}`)
        .setColor(tg.captured ? PALETTE.beaconGold : tg.visible && tg.lit ? PALETTE.cyanLaser : PALETTE.lunarDustLight);
    });
    drawSegBar(g, 140, 302, 96, 9, this.storage / this.storageMax, PALETTE.lunarCrustCreamHex, { segments: this.storageMax, warnBelow: 0.3 });
    const ca = Math.round((this.T / 2 - this.t));
    this.readout.setText(`C/A ${ca >= 0 ? 'T−' : 'T+'}${Math.abs(ca)}S  STORAGE`);
    // Flyby window
    drawSegBar(g, 352, 12, 176, 16, 1 - this.t / this.T, PALETTE.cyanGlowHex, { segments: 22, warnBelow: 0.2 });
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
    this.sparks.update(real * this.timeScale);
    this.plume.update(real * this.timeScale);
    this.render(real);
  }

  private placeBody(): void {
    const u = this.t / this.T;
    // Curved hyperbolic-looking pass: sweeps right → left, closest at mid-window
    this.bx = W * 0.56 - (u - 0.5) * 300;
    this.by = 176 + (u - 0.5) * (u - 0.5) * 160 - 10;
    this.scaleNow = 0.6 + 0.85 * Math.exp(-(((u - 0.5) / 0.24) ** 2));
    this.body.setPosition(Math.round(this.bx), Math.round(this.by)).setScale(this.scaleNow);
    this.limb.setPosition(this.bx, this.by).setScale(this.scaleNow * 2.2);
    if (this.moonObj) {
      const a = 2.2 + this.t * 0.05;
      this.moonObj.setPosition(this.bx + Math.cos(a) * 120 * this.scaleNow, this.by + Math.sin(a) * 40 * this.scaleNow).setScale(this.scaleNow);
    }
    if (this.farObj) this.farObj.setPosition(W - 60 - (u - 0.5) * 60, 52);
  }

  private step(dt: number): void {
    const active = this.started && !this.ended;
    if (this.started && !this.won) this.t = Math.min(this.T, this.t + dt);
    this.rot += dt * (Math.PI * 2) / (this.assisted ? 30 : 26);
    this.placeBody();
    this.updateTargets();

    if (!active) return;

    // Gimbal slew: inertia + damping, pointer spring
    const k = this.keys;
    const ix = (k.D.isDown || k.RIGHT.isDown ? 1 : 0) - (k.A.isDown || k.LEFT.isDown ? 1 : 0);
    const iy = (k.S.isDown || k.DOWN.isDown ? 1 : 0) - (k.W.isDown || k.UP.isDown ? 1 : 0);
    let ax = (this.mobileJoystick?.active ? this.mobileJoystick.x : ix) * 900;
    let ay = (this.mobileJoystick?.active ? this.mobileJoystick.y : iy) * 900;
    if (this.pointerAim && ix === 0 && iy === 0 && !this.mobileJoystick?.active) {
      ax += (this.pointerAim.x - this.fx) * 26;
      ay += (this.pointerAim.y - this.fy) * 26;
    }
    this.fvx = (this.fvx + ax * dt) * Math.exp(-5 * dt);
    this.fvy = (this.fvy + ay * dt) * Math.exp(-5 * dt);
    this.fx = Phaser.Math.Clamp(this.fx + this.fvx * dt, BOX_W / 2 + 4, W - BOX_W / 2 - 4);
    this.fy = Phaser.Math.Clamp(this.fy + this.fvy * dt, 44 + BOX_H / 2, H - 40 - BOX_H / 2);

    this.shield = k.SHIFT.isDown || k.E.isDown || this.touchShield;
    const tg = this.framedTarget();
    const steady = Math.hypot(this.fvx, this.fvy) < 45;
    if (!this.shield && tg && tg.visible && tg.lit && steady) this.focus = Math.min(1, this.focus + dt * (this.assisted ? 2.2 : 1.6));
    else this.focus = Math.max(0, this.focus - dt * (this.shield ? 3 : 1.6));

    // Debris streams across the field of view
    this.debrisTimer -= dt;
    const closeness = this.scaleNow;
    if (this.debrisTimer <= 0) {
      this.debrisTimer = (this.assisted ? 1.6 : 1.1) / closeness + Math.random() * 0.6;
      const fromLeft = Math.random() > 0.5;
      const y = 60 + Math.random() * (H - 140);
      const speed = 220 + Math.random() * 140;
      this.debris.push({ x: fromLeft ? -10 : W + 10, y, vx: fromLeft ? speed : -speed, vy: (Math.random() - 0.5) * 80, size: Math.random() > 0.7 ? 2 : 1, hit: false });
    }
    this.warn = Math.max(0, this.warn - dt);
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.x < -20 || d.x > W + 20) {
        this.debris.splice(i, 1);
        continue;
      }
      const inBox = Math.abs(d.x - this.fx) < BOX_W / 2 + 2 && Math.abs(d.y - this.fy) < BOX_H / 2 + 2;
      if (!d.hit && !inBox && Math.abs(d.y - this.fy) < BOX_H && Math.sign(this.fx - d.x) === Math.sign(d.vx) && Math.abs(d.x - this.fx) < 90) this.warn = 0.3;
      if (!d.hit && inBox) {
        d.hit = true;
        if (this.shield) {
          SoundFX.playThud(0.3);
          this.sparks.burst(6, { x: d.x, y: d.y, color: PALETTE.lunarDustLightHex, life: 0.3, drag: 4 }, 60);
        } else {
          SoundFX.playImpact();
          this.fvx += (Math.random() - 0.5) * 520;
          this.fvy += (Math.random() - 0.5) * 520;
          this.focus = 0;
          this.banner.show('DEBRIS STRIKE — GIMBAL KICKED', PALETTE.thrusterOrange, 700);
          if (!this.reduced) this.cameras.main.shake(180, 0.008);
          this.sparks.burst(12, { x: d.x, y: d.y, color: PALETTE.beaconGoldHex, life: 0.4, drag: 3 }, 120);
        }
      }
    }

    if (this.t >= this.T && this.captured < 3) this.fail('FLYBY OVER — THE TARGET IS BEHIND US');
  }

  private updateTargets(): void {
    const s = this.scaleNow;
    for (const tg of this.targets) {
      if (tg.name === this.theme.moonTarget && this.moonObj) {
        tg.sx = this.moonObj.x;
        tg.sy = this.moonObj.y;
        tg.visible = true;
        tg.lit = true;
        continue;
      }
      const lon = tg.lon - this.rot;
      const x = Math.cos(tg.lat) * Math.sin(lon);
      const y = -Math.sin(tg.lat);
      const z = Math.cos(tg.lat) * Math.cos(lon);
      tg.sx = this.bx + x * R * s;
      tg.sy = this.by + y * R * this.theme.oblate * s;
      tg.visible = z > 0.2;
      tg.lit = tg.visible && x * SUN[0] + y * SUN[1] + z * SUN[2] > 0.18;
    }
  }

  private framedTarget(): Target | null {
    let best: Target | null = null;
    let bestD = Infinity;
    for (const tg of this.targets) {
      if (tg.captured || !tg.visible) continue;
      const inBox = Math.abs(tg.sx - this.fx) < BOX_W / 2 - 4 && Math.abs(tg.sy - this.fy) < BOX_H / 2 - 4;
      const d = Math.hypot(tg.sx - this.fx, tg.sy - this.fy);
      if (inBox && d < bestD) {
        best = tg;
        bestD = d;
      }
    }
    return best;
  }

  private shutter(): void {
    if (!this.started || this.ended || this.shield || this.time.now - this.armedAt < 250) return;
    if (this.storage <= 0) return;
    SoundFX.playShutter();
    this.flash = 1;
    this.storage--;
    const tg = this.framedTarget();
    if (tg && tg.lit && this.focus >= 0.7) {
      tg.captured = true;
      this.captured++;
      this.focus = 0;
      SoundFX.playChime(this.captured * 3);
      this.banner.show(`${tg.name} IMAGED · ${this.captured}/3`, PALETTE.beaconGold);
      this.sparks.burst(14, { x: tg.sx, y: tg.sy, color: PALETTE.cyanLaserHex, life: 0.5, drag: 3, glow: true }, 70);
      if (this.captured >= 3) {
        this.win();
        return;
      }
    } else {
      const why = !tg ? 'EMPTY FRAME' : !tg.lit ? 'TARGET IN SHADOW' : 'BLURRED — HOLD STEADY';
      this.banner.show(`${why} · FRAME WASTED`, PALETTE.lunarDustLight, 700);
    }
    if (this.storage <= 0 && this.captured < 3) this.fail('STORAGE FULL — NO FRAMES LEFT');
  }

  private win(): void {
    this.ended = true;
    this.won = true;
    this.downlink = 1;
    SoundFX.playDownlink();
    this.banner.show('ALL TARGETS IMAGED — DOWNLINKING', PALETTE.beaconGold, 2200);
    if (!this.reduced) this.timeScale = 0.4;
    completeMinigame(this, this.siteId, this.assisted, this.storage, Math.round(this.T - this.t), 2200);
  }

  private fail(reason: string): void {
    if (this.ended) return;
    this.ended = true;
    SoundFX.playCrash();
    this.banner.show(reason, PALETTE.thrusterOrange, 3000);
    failMinigame(this, this.siteId, 1500);
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  private render(dt: number): void {
    // Parallax stars stream opposite to the flyby motion
    const sg = this.starGfx;
    sg.clear();
    const speed = this.reduced ? 0 : (40 + this.scaleNow * 90) * this.timeScale;
    for (const st of this.stars) {
      st.x += speed * st.z * dt;
      if (st.x > W) st.x -= W;
      const len = this.reduced ? 1 : Math.max(1, Math.round(st.z * this.scaleNow * 3));
      sg.fillStyle(st.z > 0.85 ? PALETTE.cyanLaserHex : PALETTE.lunarHighlightHex, 0.25 + st.z * 0.6).fillRect(Math.round(st.x) - len + 1, Math.round(st.y), len, 1);
    }

    // Re-light the rotating body at 30 Hz
    this.renderTick++;
    if (this.renderTick % 2 === 0) this.renderBody();

    // Deep Impact: the plume vents from the impact site while it faces us
    if (this.theme.plumeTarget !== undefined && !this.reduced) {
      const icy = this.theme.kind === 'enceladus';
      const site = this.targets[this.theme.plumeTarget];
      if (site.visible) {
        for (let i = 0; i < 3; i++) {
          const a = Math.atan2(site.sy - this.by, site.sx - this.bx) + (Math.random() - 0.5) * 0.7;
          const sp = 20 + Math.random() * 40;
          this.plume.emit({ x: site.sx, y: site.sy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, drag: 0.3, life: 1.6, color: icy ? (site.lit ? PALETTE.cyanLaserHex : PALETTE.cyanDeepHex) : site.lit ? PALETTE.lunarHighlightHex : PALETTE.lunarDustLightHex, glow: site.lit });
        }
      }
    }
    this.plume.draw();

    // Target brackets
    const g = this.fxGfx;
    g.clear();
    const now = this.time.now / 1000;
    for (const tg of this.targets) {
      if (!tg.visible || tg.captured) {
        if (tg.captured && tg.visible) {
          g.fillStyle(PALETTE.beaconGoldHex, 0.8).fillRect(Math.round(tg.sx) - 1, Math.round(tg.sy) - 1, 3, 3);
        }
        continue;
      }
      const c = tg.lit ? PALETTE.cyanLaserHex : PALETTE.lunarRegolithMidHex;
      const r = 6 + (tg.lit ? Math.sin(now * 6) : 0);
      const X = Math.round(tg.sx), Y = Math.round(tg.sy);
      g.fillStyle(c, 1);
      g.fillRect(X - r, Y - r, 3, 1).fillRect(X - r, Y - r, 1, 3);
      g.fillRect(X + r - 2, Y - r, 3, 1).fillRect(X + r, Y - r, 1, 3);
      g.fillRect(X - r, Y + r, 3, 1).fillRect(X - r, Y + r - 2, 1, 3);
      g.fillRect(X + r - 2, Y + r, 3, 1).fillRect(X + r, Y + r - 2, 1, 3);
    }
    // Debris streaks
    for (const d of this.debris) {
      const tail = 8;
      const dir = Math.sign(d.vx);
      g.fillStyle(PALETTE.lunarDustLightHex, 0.35).fillRect(Math.round(d.x - dir * tail), Math.round(d.y), tail, 1);
      g.fillStyle(PALETTE.lunarHighlightHex, 1).fillRect(Math.round(d.x), Math.round(d.y), d.size + 1, d.size);
    }

    // Camera framing box, focus ring, shutter flash
    const b = this.boxGfx;
    b.clear();
    const x0 = Math.round(this.fx - BOX_W / 2), y0 = Math.round(this.fy - BOX_H / 2);
    const tg = this.framedTarget();
    const col = this.shield ? PALETTE.lunarRegolithMidHex : this.warn > 0 && Math.floor(now * 12) % 2 === 0 ? PALETTE.thrusterOrangeHex
      : tg && tg.lit ? PALETTE.cyanLaserHex : PALETTE.lunarHighlightHex;
    if (this.shield) b.fillStyle(PALETTE.deepIndigoHex, 0.85).fillRect(x0, y0, BOX_W, BOX_H);
    b.fillStyle(col, 1);
    for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x0 + BOX_W, y0, -1, 1], [x0, y0 + BOX_H, 1, -1], [x0 + BOX_W, y0 + BOX_H, -1, -1]] as const) {
      b.fillRect(sx > 0 ? cx : cx - 7, cy, 8, 1);
      b.fillRect(cx, sy > 0 ? cy : cy - 7, 1, 8);
    }
    b.fillRect(Math.round(this.fx) - 2, Math.round(this.fy), 5, 1).fillRect(Math.round(this.fx), Math.round(this.fy) - 2, 1, 5);
    // Focus ring closes as the image sharpens
    const fr = 16 - this.focus * 10;
    const segs = 16;
    for (let i = 0; i < segs; i++) {
      if (i / segs > this.focus + 0.02 && this.focus < 1) continue;
      const a = (i / segs) * Math.PI * 2 - Math.PI / 2;
      b.fillStyle(this.focus >= 0.7 ? PALETTE.cyanLaserHex : PALETTE.beaconGoldHex, 1).fillRect(Math.round(this.fx + Math.cos(a) * fr), Math.round(this.fy + Math.sin(a) * fr), 1, 1);
    }
    this.flash = Math.max(0, this.flash - dt * 6);
    if (this.flash > 0) b.fillStyle(PALETTE.lunarHighlightHex, this.flash * 0.6).fillRect(x0, y0, BOX_W, BOX_H);

    // Radio downlink burst toward Earth (top-left)
    if (this.downlink > 0) {
      this.downlink += dt;
      const ex = 34, ey = 52;
      b.fillStyle(PALETTE.cyanDeepHex, 1).fillCircle(ex, ey, 4);
      b.fillStyle(PALETTE.cyanLaserHex, 1).fillRect(ex - 1, ey - 1, 2, 2);
      for (let i = 0; i < 10; i++) {
        const u = ((this.downlink * 1.4 + i / 10) % 1);
        const px = this.fx + (ex - this.fx) * u, py = this.fy + (ey - this.fy) * u;
        b.fillStyle(i % 2 ? PALETTE.cyanLaserHex : PALETTE.lunarHighlightHex, 1 - u * 0.6).fillRect(Math.round(px), Math.round(py), 3, 1);
      }
    }

    this.sparks.draw();
    this.renderHUD();
  }
}
