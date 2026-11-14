/**
 * Procedural 16-bit pixel art engine ported directly from Jeiel-Pasco/still-out-there
 * (src/systems/TitleArt.ts, src/systems/SpriteArt.ts, src/systems/PixelArtGenerator.ts, src/ui/NineSliceHUD.ts)
 * using the strict 24-color docs/ART_STYLE_GUIDE.md palette + Bayer 4x4 ordered dithering.
 */

export const SOT_PALETTE = {
  spaceBlack: '#05070f',
  deepIndigo: '#0b0f1d',
  shadowNavy: '#131a2e',
  atmosphericDusk: '#1d263f',
  lunarBasaltDark: '#27293d',
  lunarRegolithDeep: '#3b3e59',
  lunarRegolithMid: '#595e7d',
  lunarDustLight: '#8389a8',
  lunarCrustCream: '#b2b8d4',
  lunarHighlight: '#e2e6fa',
  marsShadowUmber: '#2b140e',
  marsDeepRust: '#522116',
  marsOchreCore: '#7d331c',
  marsTerracotta: '#ab4f2c',
  marsDustTan: '#cf724a',
  marsHazePeach: '#e89e7d',
  cyanVoid: '#032630',
  cyanShadow: '#064b5c',
  cyanDeep: '#087d99',
  cyanGlow: '#0ec3dc',
  cyanLaser: '#7ef1ff',
  emberShadow: '#4a1805',
  thrusterOrange: '#e65100',
  beaconGold: '#f59e0b',
} as const;

export const TITLE_W = 640;
export const TITLE_H = 360;
export const TITLE_PAD = 24;
export const EARTH_SIZE = 72;
export const EARTH_FRAMES = 64;

type RGB = [number, number, number];
export type PixelWorld = 'moon' | 'mars' | 'elsewhere';

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

function bayerSigned(x: number, y: number): number {
  return BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.47;
}

export function bayer01(x: number, y: number): number {
  return (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
}

function hexToRgb(hex: string): RGB {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

export function artHash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function noise1(x: number, s: number): number {
  const x0 = Math.floor(x);
  const t = x - x0;
  const k = t * t * (3 - 2 * t);
  const a = artHash(x0, 0, s);
  const b = artHash(x0 + 1, 0, s);
  return a + (b - a) * k;
}

function noise2(x: number, y: number, s: number, periodX = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const wx = (v: number) => (periodX > 0 ? ((v % periodX) + periodX) % periodX : v);
  const a = artHash(wx(x0), y0, s);
  const b = artHash(wx(x0 + 1), y0, s);
  const c = artHash(wx(x0), y0 + 1, s);
  const d = artHash(wx(x0 + 1), y0 + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function rampPick(ramp: RGB[], v: number, x: number, y: number, spread = 1): RGB {
  const scaled = v * (ramp.length - 1) + bayerSigned(x, y) * spread;
  const idx = Math.max(0, Math.min(ramp.length - 1, Math.round(scaled)));
  return ramp[idx];
}

function dq(ramp: readonly string[], v: number, x: number, y: number): string {
  const f = Math.max(0, Math.min(1, v)) * (ramp.length - 1);
  const i = Math.floor(f);
  return ramp[Math.min(ramp.length - 1, f - i > bayer01(x, y) ? i + 1 : i)];
}

const C = SOT_PALETTE;

const RAMPS = {
  silver: [C.lunarBasaltDark, C.lunarRegolithMid, C.lunarDustLight, C.lunarCrustCream, C.lunarHighlight],
  gold: [C.emberShadow, C.thrusterOrange, C.beaconGold],
  panel: [C.cyanVoid, C.cyanShadow, C.cyanDeep],
  dark: [C.deepIndigo, C.shadowNavy, C.atmosphericDusk, C.lunarBasaltDark],
  moonRock: [C.deepIndigo, C.lunarBasaltDark, C.lunarRegolithDeep, C.lunarRegolithMid, C.lunarDustLight, C.lunarCrustCream],
  marsRock: [C.marsShadowUmber, C.marsDeepRust, C.marsOchreCore, C.marsTerracotta, C.marsDustTan, C.marsHazePeach],
} as const;

class Painter {
  readonly w: number;
  readonly h: number;
  private px: (string | null)[];

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.px = new Array<string | null>(w * h).fill(null);
  }

  set(x: number, y: number, c: string): this {
    const ix = Math.round(x);
    const iy = Math.round(y);
    if (ix >= 0 && iy >= 0 && ix < this.w && iy < this.h) {
      this.px[iy * this.w + ix] = c;
    }
    return this;
  }

  clear(x: number, y: number): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) {
      this.px[y * this.w + x] = null;
    }
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        this.set(xx, yy, c);
      }
    }
    return this;
  }

  box(x: number, y: number, w: number, h: number, hi: string, mid: string, lo: string): this {
    this.rect(x, y, w, h, mid);
    this.rect(x, y, w, 1, hi).rect(x, y, 1, h, hi);
    this.rect(x, y + h - 1, w, 1, lo).rect(x + w - 1, y + 1, 1, h - 1, lo);
    return this;
  }

  shadeRect(x: number, y: number, w: number, h: number, ramp: readonly string[], bias = 0, grain = 0, seed = 1): this {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const u = w > 1 ? xx / (w - 1) : 0.5;
        const v = h > 1 ? yy / (h - 1) : 0.5;
        let val = 0.8 - u * 0.35 - v * 0.4 + bias;
        if (grain) val += (artHash(x + xx, y + yy, seed) - 0.5) * grain;
        this.set(x + xx, y + yy, dq(ramp, val, x + xx, y + yy));
      }
    }
    return this;
  }

  foil(x: number, y: number, w: number, h: number, seed = 3): this {
    this.shadeRect(x, y, w, h, RAMPS.gold, 0.05, 0.55, seed);
    for (let i = 0; i < Math.max(1, Math.floor((w * h) / 18)); i++) {
      const sx = x + Math.floor(artHash(i, 5, seed) * w);
      const sy = y + Math.floor(artHash(i, 6, seed) * h);
      this.set(sx, sy, artHash(i, 7, seed) > 0.5 ? C.lunarHighlight : C.emberShadow);
    }
    return this;
  }

  panel(x: number, y: number, w: number, h: number, cell = 2): this {
    this.shadeRect(x, y, w, h, RAMPS.panel, 0.05);
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if ((xx - x) % (cell + 1) === cell || (h > 2 && (yy - y) % (cell + 1) === cell)) {
          this.set(xx, yy, C.cyanVoid);
        }
      }
    }
    this.rect(x, y, w, 1, C.cyanDeep);
    this.set(x + 1, y, C.cyanGlow).set(x + 2, y, C.cyanLaser);
    return this;
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string): this {
    let x = Math.round(x0);
    let y = Math.round(y0);
    const ex = Math.round(x1);
    const ey = Math.round(y1);
    const dx = Math.abs(ex - x);
    const dy = -Math.abs(ey - y);
    const sx = x < ex ? 1 : -1;
    const sy = y < ey ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.set(x, y, c);
      if (x === ex && y === ey) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y += sy;
      }
    }
    return this;
  }

  strut(x0: number, y0: number, x1: number, y1: number, hi: string, lo: string): this {
    this.line(x0 + 1, y0, x1 + 1, y1, lo);
    return this.line(x0, y0, x1, y1, hi);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        if (u * u + v * v <= 1) this.set(x, y, c);
      }
    }
    return this;
  }

  shadeEllipse(cx: number, cy: number, rx: number, ry: number, ramp: readonly string[], bias = 0): this {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const u = (x + 0.5 - cx) / rx;
        const v = (y + 0.5 - cy) / ry;
        const d = u * u + v * v;
        if (d > 1) continue;
        const val = 0.62 - (u + v) * 0.3 - d * 0.18 + bias;
        this.set(x, y, dq(ramp, val, x, y));
      }
    }
    return this;
  }

  outline(c: string = C.deepIndigo): this {
    const src = this.px.slice();
    const at = (x: number, y: number) =>
      x < 0 || y < 0 || x >= this.w || y >= this.h ? null : src[y * this.w + x];
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (at(x, y)) continue;
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) {
          this.px[y * this.w + x] = c;
        }
      }
    }
    return this;
  }

  toCanvas(target?: HTMLCanvasElement, ox = 0, oy = 0): HTMLCanvasElement {
    const canvas = target ?? document.createElement('canvas');
    if (!target) {
      canvas.width = this.w;
      canvas.height = this.h;
    }
    const ctx = canvas.getContext('2d')!;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const c = this.px[y * this.w + x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
    return canvas;
  }
}

// ---------------------------------------------------------------------------
// Title Sky, Ridges, and Rotating Earth (Jeiel-Pasco/still-out-there TitleArt.ts)
// ---------------------------------------------------------------------------

interface SkySpec {
  w: number;
  h: number;
  horizon: number;
  zenith: number;
  ramp: string[];
  bandStrength: number;
  bandOffset: number;
  stars: number;
}

const TITLE_SKY: SkySpec = {
  w: TITLE_W,
  h: TITLE_H,
  horizon: 260,
  zenith: 40,
  ramp: [C.spaceBlack, C.deepIndigo, C.shadowNavy],
  bandStrength: 0.55,
  bandOffset: 40,
  stars: 260,
};

function buildSky(spec: SkySpec = TITLE_SKY): HTMLCanvasElement {
  const W = spec.w;
  const H = spec.h;
  const [canvas, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const ramp = spec.ramp.map(hexToRgb);
  const dusk = hexToRgb(C.atmosphericDusk);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const t = Math.min(1, Math.max(0, (y - spec.zenith) / (spec.horizon - spec.zenith)));
      let v = Math.pow(t, 1.6) * 0.95;
      const bandDist = Math.abs(x * 0.42 - y - spec.bandOffset) / 70;
      const band = Math.max(0, 1 - bandDist) * noise2(x / 38, y / 38, 77);
      v += band * spec.bandStrength;
      const col = rampPick(ramp, Math.min(1, v), x, y, 0.7);
      const o = (y * W + x) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;

      if (band > 0.35 && artHash(x, y, 91) > 0.985) {
        img.data[o] = dusk[0];
        img.data[o + 1] = dusk[1];
        img.data[o + 2] = dusk[2];
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  for (let i = 0; i < spec.stars; i++) {
    const x = Math.floor(artHash(i, 3, 5) * W);
    const y = Math.floor(artHash(i, 4, 5) * Math.max(10, spec.horizon - 10));
    const b = artHash(i, 6, 5);
    ctx.fillStyle = b > 0.85 ? C.lunarCrustCream : b > 0.5 ? C.lunarDustLight : C.lunarRegolithMid;
    ctx.globalAlpha = 0.35 + b * 0.5;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;
  return canvas;
}

interface RidgeSpec {
  w?: number;
  h?: number;
  seed: number;
  baseY: number;
  amp: number;
  scale: number;
  ramp: string[];
  gradDepth: number;
  rim: string;
  rimAlpha: number;
  invert?: boolean;
  craters?: number;
  pebbles?: number;
}

export interface RidgeLayer {
  canvas: HTMLCanvasElement;
  heights: number[];
}

function buildRidge(spec: RidgeSpec): RidgeLayer {
  const W = spec.w ?? TITLE_W + TITLE_PAD * 2;
  const H = spec.h ?? TITLE_H;
  const [canvas, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);

  const heights: number[] = [];
  for (let x = 0; x < W; x++) {
    const n =
      noise1(x / spec.scale, spec.seed) * 0.62 +
      noise1(x / (spec.scale * 0.37), spec.seed + 1) * 0.28 +
      noise1(x / (spec.scale * 0.11), spec.seed + 2) * 0.1;
    heights.push(Math.round(spec.baseY - n * spec.amp));
  }

  const ramp = spec.ramp.map(hexToRgb);
  const rim = hexToRgb(spec.rim);

  for (let x = 0; x < W; x++) {
    const h = heights[x];
    const slope = (heights[Math.min(W - 1, x + 2)] - heights[Math.max(0, x - 2)]) / 4;
    const lit = Math.max(-1, Math.min(1, slope * 1.8));

    for (let y = Math.max(0, h); y < H; y++) {
      const d = y - h;
      let v = Math.min(1, d / spec.gradDepth);
      if (!spec.invert) v *= 0.85;
      const faceBoost = d < 10 ? lit * 0.18 * (1 - d / 10) : 0;
      const base = spec.invert ? v : 1 - v;
      const col = rampPick(ramp, Math.min(1, Math.max(0, base * 0.85 + 0.1 + faceBoost)), x, y, 0.55);
      const o = (y * W + x) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }

    if (h >= 0 && h < H) {
      const o = (h * W + x) * 4;
      const a = spec.rimAlpha * (0.55 + Math.max(0, lit) * 0.45);
      img.data[o] = Math.round(img.data[o] * (1 - a) + rim[0] * a);
      img.data[o + 1] = Math.round(img.data[o + 1] * (1 - a) + rim[1] * a);
      img.data[o + 2] = Math.round(img.data[o + 2] * (1 - a) + rim[2] * a);
    }
  }
  ctx.putImageData(img, 0, 0);

  const dark = spec.ramp[0];
  for (let i = 0; i < (spec.craters ?? 0); i++) {
    const cx = Math.floor(artHash(i, 21, spec.seed) * (W - 60)) + 30;
    const surface = heights[cx];
    const cy = surface + 10 + Math.floor(artHash(i, 22, spec.seed) * Math.max(4, H - surface - 22));
    const rx = 5 + Math.floor(artHash(i, 23, spec.seed) * 9);
    const ry = Math.max(2, Math.round(rx * 0.32));
    for (let yy = -ry; yy <= ry; yy++) {
      for (let xx = -rx; xx <= rx; xx++) {
        const e = (xx * xx) / (rx * rx) + (yy * yy) / (ry * ry);
        if (e > 1) continue;
        const px = cx + xx;
        const py = cy + yy;
        if (py <= heights[Math.max(0, Math.min(W - 1, px))]) continue;
        if (yy < 0 && e > 0.55) {
          ctx.fillStyle = dark;
          ctx.globalAlpha = 0.85;
        } else if (yy > 0 && e > 0.6) {
          ctx.fillStyle = spec.rim;
          ctx.globalAlpha = 0.35;
        } else {
          ctx.fillStyle = dark;
          ctx.globalAlpha = 0.35 + (bayerSigned(px, py) + 0.5) * 0.15;
        }
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < (spec.pebbles ?? 0); i++) {
    const px = Math.floor(artHash(i, 31, spec.seed) * (W - 4));
    const surface = heights[px];
    const py = surface + 3 + Math.floor(artHash(i, 32, spec.seed) * Math.max(2, H - surface - 6));
    const w = artHash(i, 33, spec.seed) > 0.7 ? 3 : 2;
    ctx.fillStyle = dark;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(px + 1, py + 1, w, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = spec.ramp[Math.min(spec.ramp.length - 1, 2)];
    ctx.fillRect(px, py, w, 1);
    ctx.fillStyle = spec.rim;
    ctx.fillRect(px, py, 1, 1);
  }

  return { canvas, heights };
}

export interface TitleLayers {
  sky: HTMLCanvasElement;
  far: RidgeLayer;
  mid: RidgeLayer;
  near: RidgeLayer;
}

let cachedTitleLayers: TitleLayers | null = null;

export function getTitleLayers(): TitleLayers {
  if (cachedTitleLayers) return cachedTitleLayers;
  cachedTitleLayers = {
    sky: buildSky(),
    far: buildRidge({
      seed: 11,
      baseY: 248,
      amp: 52,
      scale: 120,
      ramp: [C.spaceBlack, C.deepIndigo, C.shadowNavy],
      gradDepth: 90,
      rim: C.atmosphericDusk,
      rimAlpha: 0.9,
    }),
    mid: buildRidge({
      seed: 29,
      baseY: 282,
      amp: 40,
      scale: 150,
      ramp: [C.deepIndigo, C.shadowNavy, C.lunarBasaltDark, C.lunarRegolithDeep],
      gradDepth: 70,
      rim: C.lunarDustLight,
      rimAlpha: 0.55,
      craters: 4,
    }),
    near: buildRidge({
      seed: 47,
      baseY: 318,
      amp: 30,
      scale: 170,
      ramp: [C.lunarBasaltDark, C.lunarRegolithDeep, C.lunarRegolithMid, C.lunarDustLight],
      gradDepth: 70,
      rim: C.lunarCrustCream,
      rimAlpha: 0.95,
      invert: true,
      craters: 6,
      pebbles: 40,
    }),
  };
  return cachedTitleLayers;
}

let cachedEarthSheet: HTMLCanvasElement | null = null;

/**
 * 64-frame horizontal sprite sheet of a rotating pixel Earth (72x72 each),
 * strictly using the 24-color guide palette (Cyan oceans/clouds + Moon rims).
 */
export function buildEarthSheet(): HTMLCanvasElement {
  if (cachedEarthSheet) return cachedEarthSheet;
  const S = EARTH_SIZE;
  const N = EARTH_FRAMES;
  const [canvas, ctx] = makeCanvas(S * N, S);
  const img = ctx.createImageData(S * N, S);

  const R = S / 2 - 5;
  const c = S / 2;
  const L = (() => {
    const v = [0.62, -0.38, 0.68];
    const m = Math.hypot(v[0], v[1], v[2]);
    return v.map((k) => k / m);
  })();

  const ocean = [C.spaceBlack, C.cyanVoid, C.cyanShadow, C.cyanDeep].map(hexToRgb);
  const land = [C.spaceBlack, C.shadowNavy, C.cyanDeep, C.cyanGlow].map(hexToRgb);
  const ice = [C.deepIndigo, C.lunarRegolithMid, C.lunarCrustCream, C.lunarHighlight].map(hexToRgb);
  const cloud = [C.deepIndigo, C.lunarRegolithDeep, C.lunarCrustCream, C.lunarHighlight].map(hexToRgb);
  const rimGlow = hexToRgb(C.cyanGlow);
  const rimCore = hexToRgb(C.cyanLaser);
  const halo = hexToRgb(C.cyanShadow);

  const LON_CELLS = 9;
  const CLOUD_CELLS = 14;

  for (let f = 0; f < N; f++) {
    const rot = (f / N) * Math.PI * 2;
    const cloudRot = rot * 1.35;

    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        const dx = (px + 0.5 - c) / R;
        const dy = (py + 0.5 - c) / R;
        const r2 = dx * dx + dy * dy;
        const o = (py * S * N + f * S + px) * 4;

        if (r2 > 1) {
          const r = Math.sqrt(r2);
          const edge = (r - 1) * R;
          if (edge < 2) {
            const nx = dx / r;
            const ny = dy / r;
            const facing = nx * L[0] + ny * L[1];
            if (facing > 0.05) {
              const a = (edge < 1 ? 0.9 : 0.45) * Math.min(1, facing * 1.6);
              const col = edge < 1 ? rimGlow : halo;
              img.data[o] = col[0];
              img.data[o + 1] = col[1];
              img.data[o + 2] = col[2];
              img.data[o + 3] = Math.round(a * 255);
            }
          }
          continue;
        }

        const nz = Math.sqrt(1 - r2);
        const lambert = Math.max(0, dx * L[0] + dy * L[1] + nz * L[2]);
        const lat = Math.asin(-dy);
        const lon = Math.atan2(dx, nz);

        const u = ((lon + rot) / (Math.PI * 2)) * LON_CELLS;
        const v = (lat / Math.PI + 0.5) * 5;
        const landN =
          noise2(u, v, 3, LON_CELLS) * 0.6 +
          noise2(u * 2, v * 2, 4, LON_CELLS * 2) * 0.28 +
          noise2(u * 4, v * 4, 5, LON_CELLS * 4) * 0.12;

        const cu = ((lon + cloudRot) / (Math.PI * 2)) * CLOUD_CELLS;
        const cv = (lat / Math.PI + 0.5) * 16;
        const cloudN =
          noise2(cu, cv, 8, CLOUD_CELLS) * 0.65 +
          noise2(cu * 2, cv * 2, 9, CLOUD_CELLS * 2) * 0.35;

        let ramp = landN > 0.56 ? land : ocean;
        if (Math.abs(lat) > 1.28) ramp = ice;
        if (cloudN > 0.7) ramp = cloud;

        const q = lambert + bayerSigned(px, py) * 0.16;
        const band = q < 0.12 ? 0 : q < 0.38 ? 1 : q < 0.82 ? 2 : 3;
        let col = ramp[band];

        if (r2 > 0.86 && lambert > 0.12) {
          col = r2 > 0.93 && lambert > 0.45 ? rimCore : rimGlow;
        }

        img.data[o] = col[0];
        img.data[o + 1] = col[1];
        img.data[o + 2] = col[2];
        img.data[o + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  cachedEarthSheet = canvas;
  return canvas;
}

export interface WorldBackdrop {
  sky: HTMLCanvasElement;
  far?: RidgeLayer;
  mid?: RidgeLayer;
  near?: RidgeLayer;
}

const backdropCache = new Map<PixelWorld, WorldBackdrop>();

export function getWorldBackdrop(world: PixelWorld): WorldBackdrop {
  const hit = backdropCache.get(world);
  if (hit) return hit;

  let result: WorldBackdrop;
  if (world === 'elsewhere') {
    result = {
      sky: buildSky({
        w: TITLE_W,
        h: TITLE_H,
        horizon: TITLE_H * 3,
        zenith: 0,
        ramp: [C.spaceBlack, C.deepIndigo, C.shadowNavy],
        bandStrength: 0.9,
        bandOffset: 20,
        stars: 420,
      }),
    };
  } else if (world === 'mars') {
    result = {
      sky: buildSky({
        w: TITLE_W,
        h: TITLE_H,
        horizon: 245,
        zenith: 16,
        ramp: [C.spaceBlack, C.marsShadowUmber, C.marsDeepRust],
        bandStrength: 0.25,
        bandOffset: 60,
        stars: 140,
      }),
      far: buildRidge({
        w: TITLE_W,
        h: TITLE_H,
        seed: 101,
        baseY: 224,
        amp: 46,
        scale: 130,
        ramp: [C.marsShadowUmber, C.marsDeepRust, C.marsOchreCore],
        gradDepth: 95,
        rim: C.marsHazePeach,
        rimAlpha: 0.65,
      }),
      mid: buildRidge({
        w: TITLE_W,
        h: TITLE_H,
        seed: 113,
        baseY: 262,
        amp: 36,
        scale: 150,
        ramp: [C.marsDeepRust, C.marsOchreCore, C.marsTerracotta],
        gradDepth: 75,
        rim: C.marsDustTan,
        rimAlpha: 0.5,
        craters: 4,
      }),
      near: buildRidge({
        w: TITLE_W,
        h: TITLE_H,
        seed: 131,
        baseY: 298,
        amp: 26,
        scale: 170,
        ramp: [C.marsOchreCore, C.marsTerracotta, C.marsDustTan, C.marsHazePeach],
        gradDepth: 70,
        rim: C.marsHazePeach,
        rimAlpha: 0.9,
        invert: true,
        craters: 5,
        pebbles: 34,
      }),
    };
  } else {
    const title = getTitleLayers();
    result = {
      sky: title.sky,
      far: title.far,
      mid: title.mid,
      near: title.near,
    };
  }
  backdropCache.set(world, result);
  return result;
}

// ---------------------------------------------------------------------------
// Top-down exploration terrain tile & craters (SpriteArt.ts + PixelArtGenerator.ts)
// ---------------------------------------------------------------------------

const terrainTileCache = new Map<PixelWorld, HTMLCanvasElement>();

export function getSurfaceTerrainTile(world: PixelWorld): HTMLCanvasElement {
  const hit = terrainTileCache.get(world);
  if (hit) return hit;

  const SIZE = 256;
  const [canvas, ctx] = makeCanvas(SIZE, SIZE);
  const shades =
    world === 'mars'
      ? [C.marsDeepRust, C.marsOchreCore, C.marsTerracotta]
      : world === 'elsewhere'
        ? [C.spaceBlack, C.deepIndigo, C.shadowNavy]
        : [C.lunarBasaltDark, C.lunarRegolithDeep, C.lunarRegolithMid];
  const grainLight =
    world === 'mars' ? C.marsDustTan : world === 'elsewhere' ? C.cyanDeep : C.lunarDustLight;
  const grainDark =
    world === 'mars' ? C.marsShadowUmber : world === 'elsewhere' ? C.spaceBlack : C.deepIndigo;
  const pebbleBody =
    world === 'mars' ? C.marsTerracotta : world === 'elsewhere' ? C.lunarBasaltDark : C.lunarRegolithMid;
  const pebbleLit =
    world === 'mars' ? C.marsHazePeach : world === 'elsewhere' ? C.cyanGlow : C.lunarCrustCream;

  const seed = world === 'mars' ? 4242 : world === 'elsewhere' ? 7070 : 1337;
  const valueNoise = (px: number, py: number, cells: number, s: number): number => {
    const fx = (px / SIZE) * cells;
    const fy = (py / SIZE) * cells;
    const x0 = Math.floor(fx);
    const y0 = Math.floor(fy);
    const tx = fx - x0;
    const ty = fy - y0;
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const wrap = (v: number) => ((v % cells) + cells) % cells;
    const a = artHash(wrap(x0), wrap(y0), s);
    const b = artHash(wrap(x0 + 1), wrap(y0), s);
    const c = artHash(wrap(x0), wrap(y0 + 1), s);
    const d = artHash(wrap(x0 + 1), wrap(y0 + 1), s);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };

  const shadeRgb = shades.map(hexToRgb);
  const img = ctx.createImageData(SIZE, SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const n =
        valueNoise(x, y, 3, seed) * 0.55 +
        valueNoise(x, y, 8, seed + 1) * 0.3 +
        valueNoise(x, y, 24, seed + 2) * 0.15;
      const v = Math.max(0, Math.min(1, (n - 0.5) * 1.7 + 0.45));
      const f = v * (shadeRgb.length - 1);
      const i0 = Math.floor(f);
      const t = bayer01(x, y);
      const fr = f - i0;
      const mix = fr < 0.32 ? 0 : fr > 0.68 ? 1 : (fr - 0.32) / 0.36;
      const idx = Math.min(shadeRgb.length - 1, mix > t ? i0 + 1 : i0);
      const [r, g, b] = shadeRgb[idx];
      const o = (y * SIZE + x) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  for (let i = 0; i < 300; i++) {
    const gx = Math.floor(artHash(i, 1, seed) * SIZE);
    const gy = Math.floor(artHash(i, 2, seed) * SIZE);
    ctx.fillStyle = i % 3 === 0 ? grainLight : grainDark;
    ctx.globalAlpha = i % 3 === 0 ? 0.55 : 0.7;
    ctx.fillRect(gx, gy, 1, 1);
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < (world === 'elsewhere' ? 14 : 24); i++) {
    const px = 2 + Math.floor(artHash(i, 7, seed) * (SIZE - 6));
    const py = 2 + Math.floor(artHash(i, 9, seed) * (SIZE - 6));
    const w = artHash(i, 11, seed) > 0.6 ? 3 : 2;
    ctx.fillStyle = grainDark;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(px + 1, py + w - 1, w, 1);
    ctx.globalAlpha = 1;
    ctx.fillStyle = pebbleBody;
    ctx.fillRect(px, py, w, w - 1);
    ctx.fillStyle = pebbleLit;
    ctx.fillRect(px, py, 1, 1);
  }

  terrainTileCache.set(world, canvas);
  return canvas;
}

export function buildCraterCanvas(r: number, world: 'moon' | 'mars', seed: number): HTMLCanvasElement {
  const ramp = world === 'moon' ? RAMPS.moonRock : RAMPS.marsRock;
  const rx = r;
  const ry = Math.round(r * 0.72);
  const pad = Math.ceil(r * 0.7) + 2;
  const W = rx * 2 + pad * 2;
  const H = ry * 2 + pad * 2;
  const [canvas, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);
  const cx = W / 2;
  const cy = H / 2;
  const rgb = ramp.map(hexToRgb);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      const wob = 1 + (artHash(Math.floor(Math.atan2(v, u) * 6 + 20), 1, seed) - 0.5) * 0.08;
      const d = Math.sqrt(u * u + v * v) / wob;
      const diag = (u + v) / Math.SQRT2;
      let val = 0;
      let alpha = 1;
      if (d <= 1) {
        val = 0.34 + diag * 0.32 * Math.min(1, d * 1.4) - (1 - d) * 0.04;
      } else if (d <= 1.22) {
        const t = (d - 1) / 0.22;
        val = 0.56 - diag * 0.24 - t * 0.1;
        if (t > 0.55 && bayer01(x, y) < (t - 0.55) * 2.2) alpha = 0;
      } else if (d <= 1.9) {
        const t = (d - 1.22) / 0.68;
        if (artHash(x, y, seed) > 0.9 + t * 0.08) val = 0.6;
        else alpha = 0;
      } else {
        alpha = 0;
      }
      if (!alpha) continue;
      const f = Math.max(0, Math.min(1, val)) * (rgb.length - 1);
      const i = Math.floor(f);
      const col = rgb[Math.min(rgb.length - 1, f - i > bayer01(x, y) ? i + 1 : i)];
      const o = (y * W + x) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export function buildRockCanvas(size: number, world: 'moon' | 'mars', seed: number): HTMLCanvasElement {
  const ramp = world === 'moon' ? RAMPS.moonRock : RAMPS.marsRock;
  const W = size + 6;
  const H = Math.round(size * 0.85) + 5;
  const p = new Painter(W, H);
  const cx = W / 2 - 1;
  const r = size / 2;
  const groundY = H - 3;
  const shadow = world === 'moon' ? C.deepIndigo : C.marsShadowUmber;
  p.ellipse(cx + 2, groundY, r + 1, Math.max(1.2, r * 0.32), shadow);
  const shape = new Painter(W, H);
  const cyc = groundY - r * 0.7;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - cx) / r;
      const v = (y + 0.5 - cyc) / (r * 0.78);
      const ang = Math.atan2(v, u);
      const k = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 7);
      const rr = 0.78 + artHash(k, 3, seed) * 0.26;
      const d = Math.sqrt(u * u + v * v);
      if (d > rr || y > groundY) continue;
      const val = 0.72 - (u + v) * 0.32 - d * 0.12 + (artHash(x, y, seed) - 0.5) * 0.12;
      shape.set(x, y, dq(ramp, val, x, y));
    }
  }
  shape.outline(ramp[0]);
  const canvas = p.toCanvas();
  return shape.toCanvas(canvas);
}

// ---------------------------------------------------------------------------
// UNIT-7 Robot & 31 Hardware Sprites (24x24 / 32x32, ported from SpriteArt.ts)
// ---------------------------------------------------------------------------

function paintRobot(frame: number): Painter {
  const p = new Painter(24, 24);
  const S = RAMPS.silver;

  p.line(15, 2, 15, 4, C.lunarDustLight).set(16, 3, C.lunarRegolithMid);
  p.set(15, 1, C.beaconGold).set(16, 1, C.thrusterOrange);

  for (const cx of [3, 18]) {
    p.rect(cx, 7, 3, 1, C.lunarCrustCream);
    p.set(cx, 8, C.lunarCrustCream).set(cx + 1, 8, C.lunarDustLight).set(cx + 2, 8, C.lunarRegolithMid);
    for (let y = 9; y <= 14; y++) {
      p.set(cx, y, C.lunarDustLight)
        .set(cx + 1, y, dq(S, 0.45 - (y - 9) * 0.04, cx + 1, y))
        .set(cx + 2, y, C.lunarRegolithDeep);
    }
    p.set(cx + 1, 10, C.thrusterOrange).set(cx + 1, 11, C.emberShadow);
    p.rect(cx, 15, 3, 1, C.shadowNavy).set(cx + 1, 15, C.atmosphericDusk);
    p.rect(cx, 16, 3, 1, C.emberShadow).set(cx + 1, 16, C.thrusterOrange);
  }

  p.rect(7, 4, 10, 1, C.lunarCrustCream);
  p.rect(6, 5, 12, 12, C.lunarDustLight);
  p.shadeRect(6, 5, 12, 12, S, 0.12);
  p.rect(7, 4, 10, 1, C.lunarHighlight).rect(6, 5, 1, 9, C.lunarHighlight).set(7, 5, C.lunarHighlight);
  p.rect(17, 6, 1, 11, C.lunarRegolithDeep);
  p.rect(7, 7, 10, 5, C.shadowNavy);
  p.rect(8, 8, 8, 3, C.cyanDeep);
  p.rect(8, 8, 8, 1, C.cyanGlow);
  p.set(8, 8, C.cyanLaser).set(9, 8, C.cyanLaser).set(8, 9, C.cyanGlow);
  p.rect(9, 10, 6, 1, C.cyanShadow);
  p.set(10, 9, C.cyanLaser).set(13, 9, C.cyanLaser);
  p.set(8, 13, C.cyanGlow).set(9, 13, C.cyanDeep);
  p.rect(12, 13, 4, 1, C.lunarRegolithMid).rect(12, 14, 4, 1, C.lunarRegolithDeep);
  p.rect(6, 16, 12, 1, C.lunarRegolithDeep);
  p.rect(9, 17, 6, 1, C.shadowNavy);

  for (const tx of [4, 13]) {
    p.rect(tx + 1, 17, 5, 1, C.lunarRegolithMid);
    p.rect(tx, 18, 7, 2, C.lunarBasaltDark);
    p.rect(tx + 1, 20, 5, 1, C.shadowNavy);
    for (let i = 0; i < 7; i++) {
      const lit = (i + frame) % 2 === 0;
      p.set(tx + i, 18, lit ? C.lunarRegolithDeep : C.shadowNavy);
    }
    p.set(tx + 1, 19, C.lunarRegolithMid).set(tx + 5, 19, C.lunarRegolithMid);
    p.set(tx + 3, 19, frame % 2 ? C.lunarRegolithDeep : C.atmosphericDusk);
  }

  return p.outline();
}

let cachedRobotIdle: HTMLCanvasElement | null = null;
let cachedRobotDriveSheet: HTMLCanvasElement | null = null;

export function getRobotIdleCanvas(): HTMLCanvasElement {
  if (!cachedRobotIdle) cachedRobotIdle = paintRobot(0).toCanvas();
  return cachedRobotIdle;
}

export function getRobotDriveSheet(): HTMLCanvasElement {
  if (!cachedRobotDriveSheet) {
    const [canvas] = makeCanvas(48, 24);
    paintRobot(0).toCanvas(canvas, 0, 0);
    paintRobot(1).toCanvas(canvas, 24, 0);
    cachedRobotDriveSheet = canvas;
  }
  return cachedRobotDriveSheet;
}

export type MachineSpriteKind =
  | 'apollo-lm'
  | 'surveyor'
  | 'lrrr'
  | 'lrv'
  | 'viking'
  | 'pathfinder'
  | 'phoenix'
  | 'insight'
  | 'mer'
  | 'msl'
  | 'ingenuity'
  | 'voyager'
  | 'dish-probe'
  | 'cassini'
  | 'solar-probe'
  | 'new-horizons'
  | 'space-telescope';

const MISSION_TO_MACHINE: Record<string, MachineSpriteKind> = {
  'ranger-7-9': 'solar-probe',
  'lunar-orbiter-program': 'solar-probe',
  'surveyor-1': 'surveyor',
  'surveyor-3': 'surveyor',
  'apollo-11-surface': 'apollo-lm',
  'apollo-12-surface': 'apollo-lm',
  'apollo-14-surface': 'lrrr',
  'apollo-15-surface': 'lrv',
  'apollo-16-surface': 'lrrr',
  'apollo-17-surface': 'lrv',
  'viking-1': 'viking',
  'viking-2': 'viking',
  'mars-pathfinder': 'pathfinder',
  spirit: 'mer',
  opportunity: 'mer',
  phoenix: 'phoenix',
  curiosity: 'msl',
  insight: 'insight',
  perseverance: 'msl',
  ingenuity: 'ingenuity',
  'pioneer-10': 'dish-probe',
  'pioneer-11': 'dish-probe',
  'voyager-1': 'voyager',
  'voyager-2': 'voyager',
  galileo: 'dish-probe',
  'cassini-huygens': 'cassini',
  'near-shoemaker': 'solar-probe',
  'deep-impact-epoxi': 'solar-probe',
  dawn: 'solar-probe',
  'new-horizons': 'new-horizons',
  kepler: 'space-telescope',
};

const ENCOUNTER_TO_MISSION: Record<string, string> = {
  'gentle-touch': 'surveyor-1',
  'echo-never-sleeps': 'apollo-14-surface',
  'farther-than-footsteps': 'apollo-15-surface',
  'question-in-the-soil': 'viking-1',
  'clues-beneath-the-wheel': 'spirit',
  'air-thin-as-a-whisper': 'ingenuity',
  'landing-not-planned': 'near-shoemaker',
  'power-for-the-unknown': 'voyager-1',
  'one-chance-at-pluto': 'new-horizons',
};

const footpad = (p: Painter, cx: number, rx = 2.5) =>
  p.shadeEllipse(cx, 25.6, rx, 1.4, RAMPS.silver, 0.1);

function legs(p: Painter, pairs: [number, number, number, number][]): void {
  for (const [x0, y0, x1, y1] of pairs) {
    p.strut(x0, y0, x1, y1, C.lunarDustLight, C.lunarRegolithDeep);
  }
}

function paintMachineKind(m: MachineSpriteKind): Painter {
  const p = new Painter(32, 32);
  const S = RAMPS.silver;
  switch (m) {
    case 'apollo-lm': {
      legs(p, [
        [11, 18, 8, 24],
        [20, 18, 22, 24],
      ]);
      footpad(p, 8, 2).rect(6, 24, 4, 1, C.lunarRegolithMid);
      footpad(p, 23, 2);
      legs(p, [
        [8, 14, 3, 24],
        [23, 14, 27, 24],
      ]);
      p.strut(9, 19, 5, 23, C.lunarRegolithMid, C.lunarBasaltDark)
        .strut(22, 19, 26, 23, C.lunarRegolithMid, C.lunarBasaltDark);
      footpad(p, 4).set(3, 25, C.lunarHighlight);
      footpad(p, 28);
      p.foil(8, 11, 16, 9, 7);
      p.clear(8, 11).clear(23, 11).clear(8, 19).clear(23, 19);
      p.rect(12, 12, 1, 7, C.emberShadow).rect(19, 12, 1, 7, C.emberShadow);
      p.rect(13, 13, 2, 4, C.shadowNavy).rect(13, 13, 2, 1, C.atmosphericDusk);
      p.rect(9, 10, 14, 1, C.lunarCrustCream).rect(10, 9, 12, 1, C.lunarDustLight);
      p.set(10, 9, C.lunarHighlight);
      p.rect(14, 20, 4, 1, C.lunarBasaltDark)
        .rect(13, 21, 6, 1, C.shadowNavy)
        .set(14, 21, C.lunarRegolithDeep);
      p.rect(14, 19, 1, 6, C.lunarCrustCream).rect(17, 19, 1, 6, C.lunarRegolithMid);
      for (let y = 20; y <= 24; y += 2) p.rect(15, y, 2, 1, C.lunarDustLight);
      footpad(p, 15.5, 3);
      break;
    }
    case 'surveyor': {
      legs(p, [
        [13, 18, 4, 24],
        [19, 18, 27, 24],
        [15, 19, 15, 24],
      ]);
      footpad(p, 4, 2).set(3, 25, C.lunarHighlight);
      footpad(p, 28, 2);
      footpad(p, 15.5, 2);
      p.line(9, 21, 23, 21, C.lunarRegolithMid);
      p.line(9, 21, 15, 9, C.lunarDustLight).line(23, 21, 17, 9, C.lunarRegolithMid);
      p.box(8, 14, 6, 5, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid);
      p.box(19, 15, 5, 4, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid);
      p.rect(15, 3, 2, 18, C.lunarDustLight).rect(16, 3, 1, 18, C.lunarRegolithMid);
      p.panel(6, 3, 9, 4, 2);
      p.box(18, 4, 7, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarDustLight);
      p.rect(17, 9, 2, 4, C.lunarCrustCream).set(17, 9, C.cyanGlow);
      p.strut(22, 17, 27, 20, C.lunarCrustCream, C.lunarRegolithDeep);
      p.box(27, 20, 3, 2, C.lunarDustLight, C.lunarRegolithMid, C.lunarBasaltDark);
      break;
    }
    case 'lrrr': {
      legs(p, [
        [9, 20, 8, 25],
        [23, 20, 24, 25],
        [16, 21, 16, 25],
      ]);
      footpad(p, 8.5, 2);
      footpad(p, 24.5, 2);
      p.shadeRect(4, 19, 24, 2, S, -0.25);
      p.box(4, 9, 24, 10, C.lunarHighlight, C.lunarDustLight, C.lunarRegolithMid);
      for (let cy = 0; cy < 4; cy++) {
        for (let cx = 0; cx < 10; cx++) {
          const x = 6 + cx * 2;
          const y = 11 + cy * 2;
          p.set(x, y, C.shadowNavy);
          p.set(x + 1, y, (cx + cy) % 3 === 0 ? C.cyanLaser : C.cyanShadow);
        }
      }
      p.rect(5, 10, 22, 1, C.lunarCrustCream);
      break;
    }
    case 'lrv': {
      p.shadeEllipse(11, 21.5, 3.5, 3.5, RAMPS.dark, 0.1);
      p.shadeEllipse(27, 21.5, 3.5, 3.5, RAMPS.dark, 0.1);
      p.shadeRect(3, 17, 27, 3, S, 0.05);
      p.rect(3, 17, 27, 1, C.lunarCrustCream);
      p.foil(4, 15, 6, 2, 11);
      p.box(12, 12, 4, 5, C.atmosphericDusk, C.shadowNavy, C.deepIndigo);
      p.box(17, 12, 4, 5, C.atmosphericDusk, C.shadowNavy, C.deepIndigo);
      p.rect(22, 11, 3, 2, C.lunarDustLight).line(23, 13, 23, 16, C.lunarRegolithMid);
      p.line(7, 7, 7, 16, C.lunarDustLight);
      p.shadeEllipse(7, 5, 5, 2, S, 0.2);
      p.box(26, 12, 3, 3, C.lunarCrustCream, C.lunarDustLight, C.lunarRegolithDeep)
        .line(27, 15, 27, 16, C.lunarRegolithMid);
      for (const wx of [7, 24]) {
        p.shadeEllipse(wx, 23, 3.5, 3.5, [
          C.lunarBasaltDark,
          C.lunarRegolithDeep,
          C.lunarRegolithMid,
          C.lunarDustLight,
        ]);
        p.set(wx, 23, C.lunarCrustCream).set(wx - 1, 22, C.lunarDustLight);
        p.rect(wx - 4, 18, 9, 1, C.lunarHighlight);
      }
      break;
    }
    case 'viking': {
      legs(p, [
        [11, 18, 4, 24],
        [21, 18, 27, 24],
        [16, 19, 16, 24],
      ]);
      footpad(p, 4, 2.5);
      footpad(p, 28, 2.5);
      footpad(p, 16.5, 2.5);
      p.shadeRect(9, 13, 14, 6, S, 0.1);
      p.rect(10, 13, 12, 1, C.lunarHighlight);
      p.foil(10, 17, 12, 2, 19);
      for (const rx of [9, 20]) p.box(rx, 9, 3, 4, C.atmosphericDusk, C.shadowNavy, C.deepIndigo);
      p.box(13, 9, 2, 4, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid).set(13, 10, C.cyanGlow);
      p.box(17, 9, 2, 4, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid).set(17, 10, C.cyanGlow);
      p.line(16, 6, 16, 12, C.lunarDustLight);
      p.shadeEllipse(16, 4, 5, 2, S, 0.25);
      p.strut(23, 15, 29, 19, C.lunarCrustCream, C.lunarRegolithDeep);
      break;
    }
    case 'pathfinder': {
      p.panel(1, 22, 10, 4, 2);
      p.panel(9, 24, 10, 2, 2);
      p.foil(10, 19, 7, 5, 23);
      p.rect(13, 7, 1, 11, C.lunarDustLight).rect(14, 7, 1, 11, C.lunarRegolithMid);
      p.box(11, 4, 6, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid)
        .set(12, 5, C.cyanLaser)
        .set(15, 5, C.cyanGlow);
      p.panel(20, 19, 10, 2, 2);
      p.box(21, 21, 8, 2, C.lunarCrustCream, C.lunarDustLight, C.lunarRegolithMid);
      for (const wx of [21, 25, 29]) p.shadeEllipse(wx, 24.5, 1.6, 1.6, RAMPS.dark, 0.25);
      break;
    }
    case 'phoenix':
    case 'insight': {
      const big = m === 'insight';
      legs(p, [
        [12, 18, 6, 24],
        [20, 18, 26, 24],
        [16, 19, 16, 24],
      ]);
      footpad(p, 6, 2);
      footpad(p, 26, 2);
      footpad(p, 16.5, 2);
      for (const ax of big ? [6.5, 25.5] : [7, 25]) {
        p.shadeEllipse(ax, 13, big ? 6.5 : 5.5, big ? 3 : 2.6, RAMPS.panel, 0.15);
        p.set(ax, 13, C.lunarDustLight);
      }
      p.shadeRect(12, 11, 8, 6, S, 0.15);
      p.foil(12, 17, 8, 2, 31);
      if (big) {
        p.strut(19, 14, 23, 9, C.lunarCrustCream, C.lunarRegolithDeep);
        p.rect(20, 26, 11, 1, C.thrusterOrange).set(21, 26, C.beaconGold);
      } else {
        p.line(19, 3, 19, 10, C.lunarDustLight).rect(18, 2, 3, 1, C.lunarCrustCream);
        p.box(12, 4, 5, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid).set(13, 5, C.cyanGlow);
      }
      break;
    }
    case 'mer': {
      p.strut(7, 20, 15, 19, C.lunarDustLight, C.lunarRegolithDeep)
        .strut(15, 19, 24, 21, C.lunarDustLight, C.lunarRegolithDeep);
      for (const wx of [7, 15.5, 24.5]) p.shadeEllipse(wx, 23.5, 2.6, 2.6, RAMPS.dark, 0.2);
      p.foil(9, 16, 14, 4, 37);
      p.panel(3, 13, 26, 3, 2);
      p.rect(22, 5, 1, 7, C.lunarCrustCream).rect(23, 5, 1, 7, C.lunarRegolithMid);
      p.box(19, 2, 7, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid)
        .set(20, 3, C.cyanLaser)
        .set(24, 3, C.cyanGlow);
      break;
    }
    case 'msl': {
      p.strut(6, 20, 15, 18, C.lunarDustLight, C.lunarRegolithDeep)
        .strut(15, 18, 25, 20, C.lunarDustLight, C.lunarRegolithDeep);
      for (const wx of [6, 15.5, 25.5]) {
        p.shadeEllipse(wx, 23, 3.2, 3.2, RAMPS.dark, 0.2);
        p.set(Math.round(wx), 23, C.lunarDustLight);
      }
      p.box(2, 10, 5, 7, C.atmosphericDusk, C.shadowNavy, C.deepIndigo);
      p.shadeRect(7, 12, 17, 6, S, 0.15);
      p.rect(21, 3, 1, 9, C.lunarCrustCream).rect(22, 3, 1, 9, C.lunarRegolithMid);
      p.box(18, 0, 8, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid).set(19, 1, C.cyanLaser);
      p.strut(23, 15, 28, 18, C.lunarCrustCream, C.lunarRegolithDeep);
      p.box(27, 18, 3, 3, C.lunarDustLight, C.lunarRegolithMid, C.lunarBasaltDark);
      break;
    }
    case 'ingenuity': {
      legs(p, [
        [14, 18, 8, 25],
        [18, 18, 24, 25],
      ]);
      for (const fx of [8, 24]) p.rect(fx - 1, 26, 3, 1, C.lunarDustLight);
      p.foil(13, 13, 6, 5, 43);
      p.rect(16, 4, 1, 9, C.lunarDustLight);
      p.rect(3, 10, 26, 1, C.lunarCrustCream).rect(5, 11, 22, 1, C.lunarRegolithMid);
      p.rect(6, 7, 20, 1, C.lunarCrustCream).rect(8, 8, 16, 1, C.lunarRegolithMid);
      p.panel(12, 2, 9, 2, 2);
      break;
    }
    case 'voyager': {
      p.shadeEllipse(14, 10, 9, 4, S, 0.28);
      p.rect(5, 10, 18, 1, C.lunarCrustCream);
      p.line(14, 4, 14, 10, C.lunarDustLight).set(14, 4, C.cyanLaser);
      p.shadeRect(11, 14, 6, 6, RAMPS.dark, 0.1);
      p.foil(12, 16, 4, 3, 51);
      p.strut(17, 17, 29, 23, C.lunarDustLight, C.lunarBasaltDark);
      p.box(26, 22, 4, 2, C.atmosphericDusk, C.shadowNavy, C.deepIndigo);
      p.line(11, 16, 3, 8, C.lunarRegolithMid);
      p.line(12, 20, 9, 25, C.cyanDeep);
      break;
    }
    case 'dish-probe': {
      p.shadeEllipse(16, 12, 10, 3.5, S, 0.25);
      p.foil(13, 15, 6, 5, 61);
      p.line(16, 6, 16, 12, C.lunarDustLight).set(16, 6, C.cyanGlow);
      p.line(19, 17, 29, 22, C.lunarRegolithMid);
      p.line(13, 17, 3, 21, C.lunarRegolithMid);
      break;
    }
    case 'cassini': {
      p.shadeEllipse(16, 8, 8, 3, S, 0.25);
      p.box(13, 11, 6, 8, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid);
      p.foil(8, 13, 5, 5, 71);
      p.line(19, 15, 29, 21, C.lunarDustLight);
      p.set(29, 21, C.cyanLaser);
      break;
    }
    case 'solar-probe': {
      p.panel(2, 13, 9, 4, 2);
      p.panel(21, 13, 9, 4, 2);
      p.box(12, 11, 8, 8, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid);
      p.shadeEllipse(16, 8, 4.5, 2, S, 0.2);
      p.set(16, 6, C.cyanGlow);
      break;
    }
    case 'new-horizons': {
      p.shadeEllipse(16, 8, 8, 3, S, 0.3);
      p.foil(11, 11, 10, 7, 83);
      p.line(16, 3, 16, 8, C.lunarDustLight).set(16, 3, C.cyanLaser);
      p.box(21, 14, 7, 3, C.atmosphericDusk, C.shadowNavy, C.deepIndigo);
      p.box(7, 13, 4, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid);
      break;
    }
    case 'space-telescope': {
      p.panel(3, 12, 7, 4, 2);
      p.panel(22, 12, 7, 4, 2);
      p.shadeRect(11, 7, 10, 14, S, 0.12);
      p.rect(12, 6, 8, 2, C.cyanVoid);
      p.foil(12, 18, 8, 3, 89);
      break;
    }
  }
  for (let x = 0; x < 32; x++) {
    for (let y = 27; y < 32; y++) p.clear(x, y);
  }
  p.outline();
  for (let x = 0; x < 32; x++) {
    for (let y = 28; y < 32; y++) p.clear(x, y);
  }
  return p;
}

const machineSpriteCache = new Map<string, HTMLCanvasElement>();

export function getMissionSpriteCanvas(missionId: string): HTMLCanvasElement {
  const kind: MachineSpriteKind = MISSION_TO_MACHINE[missionId] ?? 'solar-probe';
  const hit = machineSpriteCache.get(kind);
  if (hit) return hit;
  const canvas = paintMachineKind(kind).toCanvas();
  machineSpriteCache.set(kind, canvas);
  return canvas;
}

export function getEncounterSpriteCanvas(encounterId: string): HTMLCanvasElement {
  const missionId = ENCOUNTER_TO_MISSION[encounterId] ?? 'surveyor-1';
  return getMissionSpriteCanvas(missionId);
}

/** Draw a crisp title-screen style NineSliceHUD panel frame inside canvas coordinates. */
export function drawNineSliceFrame(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  borderColor: string = C.cyanGlow,
  fillColor = 'rgba(11, 15, 29, 0.90)'
): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  const iw = Math.round(w);
  const ih = Math.round(h);

  ctx.fillStyle = 'rgba(5, 7, 15, 0.4)';
  ctx.fillRect(ix - 1, iy + 2, iw + 2, ih + 2);
  ctx.fillStyle = fillColor;
  ctx.fillRect(ix, iy, iw, ih);

  ctx.fillStyle = borderColor;
  ctx.fillRect(ix, iy, iw, 1);
  ctx.fillRect(ix, iy + ih - 1, iw, 1);
  ctx.fillRect(ix, iy + 1, 1, ih - 2);
  ctx.fillRect(ix + iw - 1, iy + 1, 1, ih - 2);
}
