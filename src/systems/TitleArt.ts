/**
 * Title-screen pixel art (docs/ART.md): dithered sky with a faint galactic band,
 * three ridge layers shaded with ordered dithering (same technique as the
 * exploration regolith tile), and a rotating pixel Earth sprite sheet.
 *
 * Everything is generated once into canvases at boot; nothing is fetched.
 */
import { PALETTE } from '../ui/theme.ts';

export const TITLE_W = 640;
export const TITLE_H = 360;
/** Extra width on each ridge layer so the pointer parallax never reveals an edge. */
export const TITLE_PAD = 24;

export const EARTH_SIZE = 72;
export const EARTH_FRAMES = 64;

type RGB = [number, number, number];

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bayer = (x: number, y: number): number => BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.47;

function hexToRgb(hex: string): RGB {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 1D value noise. */
function noise1(x: number, s: number): number {
  const x0 = Math.floor(x);
  const t = x - x0;
  const k = t * t * (3 - 2 * t);
  const a = hash(x0, 0, s);
  const b = hash(x0 + 1, 0, s);
  return a + (b - a) * k;
}

/** Smooth 2D value noise, optionally periodic in x (for wrapping around the globe). */
function noise2(x: number, y: number, s: number, periodX = 0): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const sx = tx * tx * (3 - 2 * tx);
  const sy = ty * ty * (3 - 2 * ty);
  const wx = (v: number) => (periodX > 0 ? ((v % periodX) + periodX) % periodX : v);
  const a = hash(wx(x0), y0, s);
  const b = hash(wx(x0 + 1), y0, s);
  const c = hash(wx(x0), y0 + 1, s);
  const d = hash(wx(x0 + 1), y0 + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

/** Picks a palette ramp entry for value v in [0,1] with ordered dithering. */
function rampPick(ramp: RGB[], v: number, x: number, y: number, spread = 1): RGB {
  const scaled = v * (ramp.length - 1) + bayer(x, y) * spread;
  const idx = Math.max(0, Math.min(ramp.length - 1, Math.round(scaled)));
  return ramp[idx];
}

// ---------------------------------------------------------------------------
// Sky
// ---------------------------------------------------------------------------

interface SkySpec {
  w: number;
  h: number;
  /** y where the gradient reaches its lightest value */
  horizon: number;
  /** y where the gradient starts brightening */
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
  ramp: [PALETTE.spaceBlack, PALETTE.deepIndigo, PALETTE.shadowNavy],
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
  const horizon = spec.horizon;
  const dusk = hexToRgb(PALETTE.atmosphericDusk);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Base vertical gradient: black at the zenith, lighter toward the horizon
      const t = Math.min(1, Math.max(0, (y - spec.zenith) / (horizon - spec.zenith)));
      let v = Math.pow(t, 1.6) * 0.95;

      // Faint diagonal galactic band, broken up by noise
      const bandDist = Math.abs((x * 0.42 - y) - spec.bandOffset) / 70;
      const band = Math.max(0, 1 - bandDist) * noise2(x / 38, y / 38, 77);
      v += band * spec.bandStrength;

      const col = rampPick(ramp, Math.min(1, v), x, y, 0.7);
      const o = (y * W + x) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;

      // Dust grains inside the band
      if (band > 0.35 && hash(x, y, 91) > 0.985) {
        img.data[o] = dusk[0];
        img.data[o + 1] = dusk[1];
        img.data[o + 2] = dusk[2];
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  // Static dim star dust (animated bright stars are added by the scene)
  for (let i = 0; i < spec.stars; i++) {
    const x = Math.floor(hash(i, 3, 5) * W);
    const y = Math.floor(hash(i, 4, 5) * Math.max(10, horizon - 10));
    const b = hash(i, 6, 5);
    ctx.fillStyle = b > 0.85 ? PALETTE.lunarCrustCream : b > 0.5 ? PALETTE.lunarDustLight : PALETTE.lunarRegolithMid;
    ctx.globalAlpha = 0.35 + b * 0.5;
    ctx.fillRect(x, y, 1, 1);
  }
  ctx.globalAlpha = 1;

  return canvas;
}

// ---------------------------------------------------------------------------
// Ridges
// ---------------------------------------------------------------------------

interface RidgeSpec {
  /** Canvas size; defaults to the padded title layer size. */
  w?: number;
  h?: number;
  seed: number;
  baseY: number;
  amp: number;
  scale: number; // horizontal feature size in px
  ramp: string[]; // top → bottom
  gradDepth: number; // px over which the ramp is traversed
  rim: string;
  rimAlpha: number;
  invert?: boolean; // true: gets lighter going down (foreground lit by Earth)
  craters?: number;
  pebbles?: number;
  /** Use this surface profile (one y per column) instead of generated noise. */
  fixedHeights?: number[];
}

export interface RidgeLayer {
  canvas: HTMLCanvasElement;
  /** Surface y for every column of the padded canvas. */
  heights: number[];
}

function buildRidge(spec: RidgeSpec): RidgeLayer {
  const W = spec.w ?? TITLE_W + TITLE_PAD * 2;
  const H = spec.h ?? TITLE_H;
  const [canvas, ctx] = makeCanvas(W, H);
  const img = ctx.createImageData(W, H);

  const heights: number[] = [];
  for (let x = 0; x < W; x++) {
    if (spec.fixedHeights) {
      heights.push(Math.round(spec.fixedHeights[x]));
      continue;
    }
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
    // Earth sits upper-right: slopes descending to the right face the light
    const lit = Math.max(-1, Math.min(1, slope * 1.8));

    for (let y = Math.max(0, h); y < H; y++) {
      const d = y - h;
      let v = Math.min(1, d / spec.gradDepth);
      if (!spec.invert) v = v * 0.85;
      // Lit faces get a lighter band right under the crest
      const faceBoost = d < 10 ? lit * 0.18 * (1 - d / 10) : 0;
      const base = spec.invert ? v : 1 - v;
      const col = rampPick(ramp, Math.min(1, Math.max(0, base * 0.85 + 0.1 + faceBoost)), x, y, 0.55);
      const o = (y * W + x) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }

    // Crest rim light (strongest on lit faces)
    if (h >= 0 && h < H) {
      const o = (h * W + x) * 4;
      const a = spec.rimAlpha * (0.55 + Math.max(0, lit) * 0.45);
      img.data[o] = Math.round(img.data[o] * (1 - a) + rim[0] * a);
      img.data[o + 1] = Math.round(img.data[o + 1] * (1 - a) + rim[1] * a);
      img.data[o + 2] = Math.round(img.data[o + 2] * (1 - a) + rim[2] * a);
    }
  }
  ctx.putImageData(img, 0, 0);

  // Perspective craters (flattened ellipses): shadowed near wall, lit far rim
  const dark = spec.ramp[0];
  for (let i = 0; i < (spec.craters ?? 0); i++) {
    const cx = Math.floor(hash(i, 21, spec.seed) * (W - 60)) + 30;
    const surface = heights[cx];
    const cy = surface + 10 + Math.floor(hash(i, 22, spec.seed) * Math.max(4, H - surface - 22));
    const rx = 5 + Math.floor(hash(i, 23, spec.seed) * 9);
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
          ctx.globalAlpha = 0.35 + (bayer(px, py) + 0.5) * 0.15;
        }
        ctx.fillRect(px, py, 1, 1);
      }
    }
  }
  ctx.globalAlpha = 1;

  // Pebbles with a lit top pixel and a contact shadow
  for (let i = 0; i < (spec.pebbles ?? 0); i++) {
    const px = Math.floor(hash(i, 31, spec.seed) * (W - 4));
    const surface = heights[px];
    const py = surface + 3 + Math.floor(hash(i, 32, spec.seed) * Math.max(2, H - surface - 6));
    const w = hash(i, 33, spec.seed) > 0.7 ? 3 : 2;
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

let cachedLayers: TitleLayers | null = null;

/** Deterministic, memoised so the scene can query ridge heights for prop placement. */
export function getTitleLayers(): TitleLayers {
  if (cachedLayers) return cachedLayers;
  cachedLayers = {
    sky: buildSky(),
    far: buildRidge({
      seed: 11,
      baseY: 248,
      amp: 52,
      scale: 120,
      ramp: [PALETTE.spaceBlack, PALETTE.deepIndigo, PALETTE.shadowNavy],
      gradDepth: 90,
      rim: PALETTE.atmosphericDusk,
      rimAlpha: 0.9,
    }),
    mid: buildRidge({
      seed: 29,
      baseY: 282,
      amp: 40,
      scale: 150,
      ramp: [PALETTE.deepIndigo, PALETTE.shadowNavy, PALETTE.lunarBasaltDark, PALETTE.lunarRegolithDeep],
      gradDepth: 70,
      rim: PALETTE.lunarDustLight,
      rimAlpha: 0.55,
      craters: 4,
    }),
    near: buildRidge({
      seed: 47,
      baseY: 318,
      amp: 30,
      scale: 170,
      ramp: [PALETTE.lunarBasaltDark, PALETTE.lunarRegolithDeep, PALETTE.lunarRegolithMid, PALETTE.lunarDustLight],
      gradDepth: 70,
      rim: PALETTE.lunarCrustCream,
      rimAlpha: 0.95,
      invert: true,
      craters: 6,
      pebbles: 40,
    }),
  };
  return cachedLayers;
}

// ---------------------------------------------------------------------------
// Rotating Earth
// ---------------------------------------------------------------------------

/**
 * Horizontal sprite sheet of EARTH_FRAMES frames, EARTH_SIZE px square.
 * Lit from the upper right, dithered terminator, drifting cloud layer and a thin
 * cyan atmospheric rim on the day side.
 */
export function buildEarthSheet(): HTMLCanvasElement {
  const S = EARTH_SIZE;
  const N = EARTH_FRAMES;
  const [canvas, ctx] = makeCanvas(S * N, S);
  const img = ctx.createImageData(S * N, S);

  const R = S / 2 - 5;
  const c = S / 2;
  const L = (() => {
    const v = [0.62, -0.38, 0.68];
    const m = Math.hypot(v[0], v[1], v[2]);
    return v.map(k => k / m);
  })();

  // Night → day ramps per material (Earth is the one place blue/green appear)
  const ocean = ['#05070f', '#082040', '#084b8a', '#1767a6'].map(hexToRgb);
  const land = ['#05070f', '#123d2a', '#1e7b4e', '#3d9a5e'].map(hexToRgb);
  const ice = [PALETTE.deepIndigo, PALETTE.lunarRegolithMid, PALETTE.lunarCrustCream, PALETTE.lunarHighlight].map(hexToRgb);
  const cloud = [PALETTE.deepIndigo, PALETTE.lunarRegolithDeep, PALETTE.lunarCrustCream, PALETTE.lunarHighlight].map(hexToRgb);
  const rimGlow = hexToRgb(PALETTE.cyanGlow);
  const rimCore = hexToRgb(PALETTE.cyanLaser);
  const halo = hexToRgb(PALETTE.cyanShadow);

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
          // 1–2 px halo on the lit limb
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
          noise2(cu, cv, 8, CLOUD_CELLS) * 0.65 + noise2(cu * 2, cv * 2, 9, CLOUD_CELLS * 2) * 0.35;

        let ramp = landN > 0.56 ? land : ocean;
        if (Math.abs(lat) > 1.28) ramp = ice;
        if (cloudN > 0.7) ramp = cloud;

        // Quantised, dithered lighting (4 bands)
        const q = lambert + bayer(px, py) * 0.16;
        const band = q < 0.12 ? 0 : q < 0.38 ? 1 : q < 0.82 ? 2 : 3;
        let col = ramp[band];

        // Thin atmospheric rim on the day side
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
  return canvas;
}

// ---------------------------------------------------------------------------
// Cinematic backdrops (padded so camera pans / zooms never reveal an edge)
// ---------------------------------------------------------------------------

/** Every cinematic layer is drawn this far beyond the 640×360 stage on all sides. */
export const CIN_MARGIN = 80;
export const CIN_W = TITLE_W + CIN_MARGIN * 2;
export const CIN_H = TITLE_H + CIN_MARGIN * 2;

export type BackdropKind = 'moon' | 'mars' | 'space';

export interface CinematicBackdrop {
  sky: HTMLCanvasElement;
  far?: RidgeLayer;
  mid?: RidgeLayer;
  near?: RidgeLayer;
}

const cachedBackdrops = new Map<BackdropKind, CinematicBackdrop>();

export function getCinematicBackdrop(kind: BackdropKind): CinematicBackdrop {
  const hit = cachedBackdrops.get(kind);
  if (hit) return hit;

  const M = CIN_MARGIN;
  const base = { w: CIN_W, h: CIN_H };
  let result: CinematicBackdrop;

  if (kind === 'space') {
    result = {
      sky: buildSky({
        ...base,
        horizon: CIN_H * 4,
        zenith: 0,
        ramp: [PALETTE.spaceBlack, PALETTE.deepIndigo, PALETTE.shadowNavy],
        bandStrength: 0.9,
        bandOffset: 20,
        stars: 900,
      }),
    };
  } else if (kind === 'moon') {
    result = {
      sky: buildSky({
        ...base,
        horizon: 275 + M,
        zenith: M - 20,
        ramp: [PALETTE.spaceBlack, PALETTE.deepIndigo, PALETTE.shadowNavy],
        bandStrength: 0.55,
        bandOffset: 70,
        stars: 520,
      }),
      far: buildRidge({
        ...base,
        seed: 11,
        baseY: 252 + M,
        amp: 52,
        scale: 130,
        ramp: [PALETTE.spaceBlack, PALETTE.deepIndigo, PALETTE.shadowNavy],
        gradDepth: 120,
        rim: PALETTE.atmosphericDusk,
        rimAlpha: 0.9,
      }),
      mid: buildRidge({
        ...base,
        seed: 29,
        baseY: 284 + M,
        amp: 40,
        scale: 160,
        ramp: [PALETTE.deepIndigo, PALETTE.shadowNavy, PALETTE.lunarBasaltDark, PALETTE.lunarRegolithDeep],
        gradDepth: 100,
        rim: PALETTE.lunarDustLight,
        rimAlpha: 0.55,
        craters: 6,
      }),
      near: buildRidge({
        ...base,
        seed: 53,
        baseY: 300 + M,
        amp: 26,
        scale: 190,
        ramp: [PALETTE.lunarBasaltDark, PALETTE.lunarRegolithDeep, PALETTE.lunarRegolithMid, PALETTE.lunarDustLight],
        gradDepth: 110,
        rim: PALETTE.lunarCrustCream,
        rimAlpha: 0.95,
        invert: true,
        craters: 9,
        pebbles: 70,
      }),
    };
  } else {
    result = {
      sky: buildSky({
        ...base,
        horizon: 285 + M,
        zenith: M - 10,
        ramp: [PALETTE.spaceBlack, PALETTE.deepIndigo, PALETTE.marsShadowUmber, PALETTE.marsDeepRust],
        bandStrength: 0.3,
        bandOffset: 70,
        stars: 380,
      }),
      far: buildRidge({
        ...base,
        seed: 17,
        baseY: 254 + M,
        amp: 56,
        scale: 120,
        ramp: [PALETTE.spaceBlack, PALETTE.marsShadowUmber, PALETTE.marsDeepRust],
        gradDepth: 120,
        rim: PALETTE.marsOchreCore,
        rimAlpha: 0.8,
      }),
      mid: buildRidge({
        ...base,
        seed: 37,
        baseY: 286 + M,
        amp: 38,
        scale: 150,
        ramp: [PALETTE.marsShadowUmber, PALETTE.marsDeepRust, PALETTE.marsOchreCore],
        gradDepth: 100,
        rim: PALETTE.marsTerracotta,
        rimAlpha: 0.6,
        craters: 5,
      }),
      near: buildRidge({
        ...base,
        seed: 61,
        baseY: 300 + M,
        amp: 24,
        scale: 180,
        ramp: [PALETTE.marsDeepRust, PALETTE.marsOchreCore, PALETTE.marsTerracotta, PALETTE.marsDustTan],
        gradDepth: 110,
        rim: PALETTE.marsHazePeach,
        rimAlpha: 0.9,
        invert: true,
        craters: 8,
        pebbles: 70,
      }),
    };
  }

  cachedBackdrops.set(kind, result);
  return result;
}

/**
 * Single-frame dithered planet (Moon or Mars as seen from space), lit from the
 * upper right with a darker mottled surface and optional polar cap.
 */
export function buildPlanet(size: number, ramp: string[], seed: number, polarCap: boolean): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(size, size);
  const img = ctx.createImageData(size, size);
  const R = size / 2 - 1;
  const c = size / 2;
  const L = [0.62, -0.38, 0.68];
  const lm = Math.hypot(L[0], L[1], L[2]);
  const rgb = ramp.map(hexToRgb);
  const capRgb = hexToRgb(PALETTE.lunarHighlight);

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = (px + 0.5 - c) / R;
      const dy = (py + 0.5 - c) / R;
      const r2 = dx * dx + dy * dy;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      const lambert = Math.max(0, (dx * L[0] + dy * L[1] + nz * L[2]) / lm);
      const mottle = noise2(px / (size / 5), py / (size / 5), seed) * 0.5 + noise2(px / (size / 11), py / (size / 11), seed + 1) * 0.5;
      const v = lambert * (0.75 + mottle * 0.4) + bayer(px, py) * 0.14;
      const idx = Math.max(0, Math.min(rgb.length - 1, Math.floor(v * rgb.length)));
      let col = rgb[idx];
      if (polarCap && dy < -0.82 && lambert > 0.15) col = capRgb;
      const o = (py * size + px) * 4;
      img.data[o] = col[0];
      img.data[o + 1] = col[1];
      img.data[o + 2] = col[2];
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** 12×30 pixel upper-stage booster, nose up (rotate to fly sideways). */
export function buildBoosterSprite(): HTMLCanvasElement {
  const [canvas, ctx] = makeCanvas(12, 30);
  const px = (color: string, x: number, y: number, w: number, h: number) => {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  };
  // Nose cone
  px(PALETTE.lunarHighlight, 5, 0, 2, 2);
  px(PALETTE.lunarHighlight, 4, 2, 4, 2);
  px(PALETTE.lunarCrustCream, 3, 4, 6, 2);
  // Body with shaded right side (light comes from the upper right on screen)
  px(PALETTE.lunarCrustCream, 3, 6, 6, 16);
  px(PALETTE.lunarHighlight, 6, 6, 2, 16);
  px(PALETTE.lunarDustLight, 3, 6, 1, 16);
  // Porthole + interstage band
  px(PALETTE.cyanShadow, 5, 8, 2, 2);
  px(PALETTE.cyanLaser, 6, 8, 1, 1);
  px(PALETTE.shadowNavy, 3, 13, 6, 1);
  px(PALETTE.beaconGold, 3, 17, 6, 1);
  // Fins
  px(PALETTE.lunarRegolithDeep, 1, 19, 2, 6);
  px(PALETTE.lunarRegolithDeep, 9, 19, 2, 6);
  px(PALETTE.lunarRegolithDeep, 0, 23, 1, 3);
  px(PALETTE.lunarRegolithDeep, 11, 23, 1, 3);
  // Engine skirt + nozzle
  px(PALETTE.lunarRegolithMid, 3, 22, 6, 3);
  px(PALETTE.shadowNavy, 4, 25, 4, 3);
  px(PALETTE.emberShadow, 4, 28, 4, 2);
  return canvas;
}

/**
 * Paints a landing level's real terrain profile (one surface y per column, in
 * canvas pixels) with the same dithered foreground style as the title ridges.
 */
export function buildLandingTerrain(heights: number[], h: number, world: 'moon' | 'mars' | 'elsewhere'): RidgeLayer {
  const isMoon = world !== 'mars';
  return buildRidge({
    w: heights.length,
    h,
    seed: isMoon ? 71 : 83,
    baseY: 0,
    amp: 0,
    scale: 1,
    fixedHeights: heights,
    ramp: isMoon
      ? [PALETTE.lunarBasaltDark, PALETTE.lunarRegolithDeep, PALETTE.lunarRegolithMid, PALETTE.lunarDustLight]
      : [PALETTE.marsDeepRust, PALETTE.marsOchreCore, PALETTE.marsTerracotta, PALETTE.marsDustTan],
    gradDepth: 90,
    rim: isMoon ? PALETTE.lunarCrustCream : PALETTE.marsHazePeach,
    rimAlpha: 1,
    craters: 9,
    pebbles: 90,
  });
}
