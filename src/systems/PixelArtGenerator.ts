import Phaser from 'phaser';
import { PALETTE } from '../ui/theme.ts';
import { bayer, buildRobotCanvas, buildMachineCanvas, hash } from './SpriteArt.ts';

const TILE_SIZE = 256;

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Tileable value noise: lattice wraps at `cells` so the tile repeats seamlessly. */
function valueNoise(px: number, py: number, cells: number, seed: number): number {
  const fx = (px / TILE_SIZE) * cells;
  const fy = (py / TILE_SIZE) * cells;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const tx = fx - x0;
  const ty = fy - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const wrap = (v: number) => ((v % cells) + cells) % cells;
  const a = hash(wrap(x0), wrap(y0), seed);
  const b = hash(wrap(x0 + 1), wrap(y0), seed);
  const c = hash(wrap(x0), wrap(y0 + 1), seed);
  const d = hash(wrap(x0 + 1), wrap(y0 + 1), seed);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function fillDitheredTile(
  ctx: CanvasRenderingContext2D,
  shades: readonly string[],
  sample: (x: number, y: number) => number,
  softBand: boolean,
): void {
  const shadeRgb = shades.map(hexToRgb);
  const img = ctx.createImageData(TILE_SIZE, TILE_SIZE);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const f = sample(x, y) * (shadeRgb.length - 1);
      const i0 = Math.floor(f);
      const fr = f - i0;
      const mix = softBand ? (fr < 0.32 ? 0 : fr > 0.68 ? 1 : (fr - 0.32) / 0.36) : fr;
      const idx = Math.min(shadeRgb.length - 1, mix > bayer(x, y) ? i0 + 1 : i0);
      const [r, g, b] = shadeRgb[idx];
      const o = (y * TILE_SIZE + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

export class PixelArtGenerator {
  /**
   * 24x24 Detailed Retro Robot Explorer Sprite
   */
  static createRobotCanvas(): HTMLCanvasElement {
    return buildRobotCanvas();
  }

  /**
   * 32x32 Textured Planetary Ground / Deep Space Tile
   */
  static createTerrainTile(world: 'moon' | 'mars' | 'elsewhere'): HTMLCanvasElement {
    const SIZE = TILE_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;

    if (world === 'elsewhere') {
      const shades = [PALETTE.spaceBlack, PALETTE.deepIndigo, PALETTE.shadowNavy];
      const seed = 7919;
      fillDitheredTile(
        ctx,
        shades,
        (x, y) => {
          const n = valueNoise(x, y, 2, seed) * 0.65 + valueNoise(x, y, 6, seed + 1) * 0.35;
          return Math.max(0, Math.min(1, (n - 0.38) * 1.4));
        },
        false,
      );

      for (let i = 0; i < 240; i++) {
        const sx = Math.floor(hash(i, 1, seed) * SIZE);
        const sy = Math.floor(hash(i, 2, seed) * SIZE);
        const roll = hash(i, 3, seed);
        ctx.fillStyle = roll > 0.92 ? PALETTE.cyanLaser : roll > 0.8 ? PALETTE.beaconGold : roll > 0.45 ? PALETTE.lunarHighlight : PALETTE.lunarDustLight;
        ctx.fillRect(sx, sy, 1, 1);
        if (roll > 0.95) {
          ctx.fillStyle = PALETTE.cyanDeep;
          ctx.fillRect(sx + 1, sy, 1, 1);
          ctx.fillRect(sx, sy + 1, 1, 1);
        }
      }
      return canvas;
    }

    // Soft, low-contrast regolith: seamless value-noise mottling quantised to a
    // few palette shades with ordered dithering (same calm, smooth-gradient feel
    // as the title-screen ridges), plus sparse grains and pebbles.
    const isMoon = world === 'moon';
    const shades = isMoon
      ? [PALETTE.lunarBasaltDark, PALETTE.lunarRegolithDeep, PALETTE.lunarRegolithMid]
      : [PALETTE.marsDeepRust, PALETTE.marsOchreCore, PALETTE.marsTerracotta];
    const grainLight = isMoon ? PALETTE.lunarDustLight : PALETTE.marsDustTan;
    const grainDark = isMoon ? PALETTE.deepIndigo : PALETTE.marsShadowUmber;
    const pebbleBody = isMoon ? PALETTE.lunarRegolithMid : PALETTE.marsTerracotta;
    const pebbleLit = isMoon ? PALETTE.lunarCrustCream : PALETTE.marsHazePeach;
    const seed = isMoon ? 1337 : 4242;

    fillDitheredTile(
      ctx,
      shades,
      (x, y) => {
        const n =
          valueNoise(x, y, 3, seed) * 0.55 +
          valueNoise(x, y, 8, seed + 1) * 0.3 +
          valueNoise(x, y, 24, seed + 2) * 0.15;
        return Math.max(0, Math.min(1, (n - 0.5) * 1.7 + 0.45));
      },
      true,
    );

    // Sparse single-pixel grains (light catches + tiny pits)
    for (let i = 0; i < 320; i++) {
      const gx = Math.floor(hash(i, 1, seed) * SIZE);
      const gy = Math.floor(hash(i, 2, seed) * SIZE);
      ctx.fillStyle = i % 3 === 0 ? grainLight : grainDark;
      ctx.globalAlpha = i % 3 === 0 ? 0.55 : 0.7;
      ctx.fillRect(gx, gy, 1, 1);
    }
    ctx.globalAlpha = 1;

    // A handful of small pebbles: shadow below-right, lit pixel top-left
    for (let i = 0; i < 22; i++) {
      const px = 2 + Math.floor(hash(i, 7, seed) * (SIZE - 6));
      const py = 2 + Math.floor(hash(i, 9, seed) * (SIZE - 6));
      const big = hash(i, 11, seed) > 0.6;
      const w = big ? 3 : 2;
      ctx.fillStyle = grainDark;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(px + 1, py + w - 1, w, 1);
      ctx.globalAlpha = 1;
      ctx.fillStyle = pebbleBody;
      ctx.fillRect(px, py, w, w - 1);
      ctx.fillStyle = pebbleLit;
      ctx.fillRect(px, py, 1, 1);
    }

    return canvas;
  }

  /**
   * 32x32 Detailed Sourced NASA Hardware Relic
   */
  static createHardwareSprite(id: string, world: 'moon' | 'mars' | 'elsewhere'): HTMLCanvasElement {
    return buildMachineCanvas(id, world);
  }

  /**
   * 24x24 9-Slice HUD Panel Texture with Corner Notches
   */
  static createNineSlicePanelCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 24;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 24, 24);

    // Dark translucent indigo base (Interior)
    ctx.fillStyle = 'rgba(11, 15, 29, 0.90)';
    ctx.fillRect(2, 2, 20, 20);

    // Thin cyan glowing border
    ctx.strokeStyle = PALETTE.cyanGlow;
    ctx.lineWidth = 1;

    // Corner notches: draw 8-sided polygon omitting 2x2 corner pixels
    ctx.beginPath();
    ctx.moveTo(3, 0);
    ctx.lineTo(21, 0);
    ctx.lineTo(24, 3);
    ctx.lineTo(24, 21);
    ctx.lineTo(21, 24);
    ctx.lineTo(3, 24);
    ctx.lineTo(0, 21);
    ctx.lineTo(0, 3);
    ctx.closePath();
    ctx.stroke();

    // Subtle cyan corner notch dots
    ctx.fillStyle = PALETTE.cyanLaser;
    ctx.fillRect(3, 3, 1, 1);
    ctx.fillRect(20, 3, 1, 1);
    ctx.fillRect(3, 20, 1, 1);
    ctx.fillRect(20, 20, 1, 1);

    return canvas;
  }

  /**
   * 640x360 Vignette Gradient Texture
   */
  static createVignetteCanvas(width: number = 640, height: number = 360): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const cx = width / 2;
    const cy = height / 2;
    const maxRadius = Math.hypot(cx, cy);

    const grad = ctx.createRadialGradient(cx, cy, maxRadius * 0.45, cx, cy, maxRadius);
    grad.addColorStop(0, 'rgba(5, 7, 15, 0)');
    grad.addColorStop(0.65, 'rgba(5, 7, 15, 0.35)');
    grad.addColorStop(1, 'rgba(5, 7, 15, 0.92)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    return canvas;
  }

  /**
   * 48x48 Soft Radial Glow Disk for Additive Bloom Pass
   */
  static createGlowCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;

    const cx = 24;
    const cy = 24;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
    grad.addColorStop(0, 'rgba(14, 195, 220, 1.0)');
    grad.addColorStop(0.3, 'rgba(14, 195, 220, 0.55)');
    grad.addColorStop(0.7, 'rgba(14, 195, 220, 0.18)');
    grad.addColorStop(1, 'rgba(14, 195, 220, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 48, 48);

    return canvas;
  }

  /**
   * 16x16 Pixel-Perfect Radar Arrow Canvas (Centered at 8,8)
   */
  static createRadarArrowCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, 16, 16);

    // Chevron pointing +X (0 radians) symmetrically centered around (8, 8)
    ctx.fillStyle = PALETTE.cyanGlow;
    ctx.beginPath();
    ctx.moveTo(14, 8);
    ctx.lineTo(3, 3);
    ctx.lineTo(6, 8);
    ctx.lineTo(3, 13);
    ctx.closePath();
    ctx.fill();

    // Bright core spine
    ctx.fillStyle = PALETTE.cyanLaser;
    ctx.beginPath();
    ctx.moveTo(13, 8);
    ctx.lineTo(5, 5);
    ctx.lineTo(7, 8);
    ctx.lineTo(5, 11);
    ctx.closePath();
    ctx.fill();

    return canvas;
  }

  /**
   * 48x48 Soft Radial Thruster Glow Disk (Warm Orange bloom)
   */
  static createThrusterGlowCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 48;
    canvas.height = 48;
    const ctx = canvas.getContext('2d')!;

    const cx = 24;
    const cy = 24;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
    grad.addColorStop(0, 'rgba(235, 94, 40, 0.95)');
    grad.addColorStop(0.35, 'rgba(235, 94, 40, 0.45)');
    grad.addColorStop(0.7, 'rgba(240, 165, 0, 0.15)');
    grad.addColorStop(1, 'rgba(235, 94, 40, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 48, 48);

    return canvas;
  }

  /**
   * 48x48 Pixel Earth Texture with Continents, Atmospheric Rim & Shadow
   */
  static createEarthCanvas(isMarsDot: boolean = false): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const size = isMarsDot ? 8 : 56;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, size, size);

    if (isMarsDot) {
      // Tiny pale blue dot as seen from Mars
      ctx.fillStyle = PALETTE.cyanGlow;
      ctx.fillRect(3, 3, 2, 2);
      ctx.fillStyle = PALETTE.cyanLaser;
      ctx.fillRect(3, 3, 1, 1);
      return canvas;
    }

    const radius = 24;
    const cx = size / 2;
    const cy = size / 2;

    // Outer atmospheric glow rim
    const atmGrad = ctx.createRadialGradient(cx, cy, radius - 2, cx, cy, radius + 4);
    atmGrad.addColorStop(0, 'rgba(14, 195, 220, 0.65)');
    atmGrad.addColorStop(1, 'rgba(14, 195, 220, 0)');
    ctx.fillStyle = atmGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
    ctx.fill();

    // Ocean sphere
    ctx.fillStyle = '#084b8a';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Continents (layered pixel clusters)
    ctx.fillStyle = '#1e7b4e';
    ctx.fillRect(cx - 10, cy - 8, 8, 7);
    ctx.fillRect(cx - 6, cy - 2, 10, 8);
    ctx.fillRect(cx + 4, cy + 4, 7, 6);
    ctx.fillRect(cx - 14, cy + 2, 6, 6);

    // Cloud swirls
    ctx.fillStyle = 'rgba(226, 230, 250, 0.75)';
    ctx.fillRect(cx - 8, cy - 14, 14, 3);
    ctx.fillRect(cx - 12, cy, 16, 2);
    ctx.fillRect(cx + 2, cy - 4, 12, 3);
    ctx.fillRect(cx - 4, cy + 10, 14, 2);

    // Terminator shadow crescent
    ctx.fillStyle = 'rgba(5, 7, 15, 0.65)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, Math.PI / 2, true);
    ctx.closePath();
    ctx.fill();

    return canvas;
  }

  /**
   * Generates and registers an 8x8 crisp retro bitmap font in the Phaser cache
   */
  static generateBitmapFont(scene: Phaser.Scene): void {
    const fontKey = 'pixel_font';
    const textureKey = 'pixel_font_texture';

    if (scene.cache.bitmapFont.has(fontKey)) {
      return;
    }

    const charList = ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~';
    const charW = 8;
    const charH = 10;
    const charsPerRow = 16;
    const rows = Math.ceil(charList.length / charsPerRow);

    const canvas = document.createElement('canvas');
    canvas.width = charsPerRow * charW;
    canvas.height = rows * charH;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = PALETTE.lunarHighlight;
    ctx.font = '8px monospace';
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = false;

    for (let i = 0; i < charList.length; i++) {
      const ch = charList[i];
      const col = i % charsPerRow;
      const row = Math.floor(i / charsPerRow);
      ctx.fillText(ch, col * charW + 1, row * charH + 1);
    }

    if (!scene.textures.exists(textureKey)) {
      scene.textures.addCanvas(textureKey, canvas);
    }

    try {
      const RetroFont = (Phaser.GameObjects as any).RetroFont;
      if (RetroFont && typeof RetroFont.Parse === 'function') {
        const fontData = RetroFont.Parse(scene, {
          image: textureKey,
          width: charW,
          height: charH,
          chars: charList,
          charsPerRow: charsPerRow,
          spacing: { x: 0, y: 0 },
        });

        scene.cache.bitmapFont.add(fontKey, {
          data: fontData,
          texture: textureKey,
          frame: null,
        });
      }
    } catch (e) {
      // Graceful fallback to canvas texture registration
    }
  }
}
