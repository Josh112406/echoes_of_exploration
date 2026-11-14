import { PALETTE } from '../ui/theme.ts';
import { bayer, hash } from './SpriteArt.ts';

/**
 * Procedural deep-space art for the Elsewhere sector: seamless nebula and star
 * tiles for parallax layers, plus the outer-system bodies seen near each echo.
 * Every body is lit from the upper right, where the distant Sun sits.
 */

type RGB = [number, number, number];
const rgb = (c: number): RGB => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const LIGHT = (() => { const v = [0.62, -0.38, 0.68]; const l = Math.hypot(v[0], v[1], v[2]); return v.map((c) => c / l); })();

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D, ImageData] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  return [c, ctx, ctx.createImageData(w, h)];
}

function put(img: ImageData, x: number, y: number, c: RGB, a = 255): void {
  const o = (y * img.width + x) * 4;
  img.data[o] = c[0];
  img.data[o + 1] = c[1];
  img.data[o + 2] = c[2];
  img.data[o + 3] = a;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise on a lattice that wraps every `period` cells (seamless tiles). */
function pnoise(x: number, y: number, period: number, seed: number): number {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = smooth(x - x0), fy = smooth(y - y0);
  const w = (i: number) => ((i % period) + period) % period;
  const h = (i: number, j: number) => hash(w(i), w(j), seed);
  const a = h(x0, y0) + (h(x0 + 1, y0) - h(x0, y0)) * fx;
  const b = h(x0, y0 + 1) + (h(x0 + 1, y0 + 1) - h(x0, y0 + 1)) * fx;
  return a + (b - a) * fy;
}

/** Seamless fractal noise over a unit tile (u, v in [0, 1)). */
function fbm(u: number, v: number, seed: number, base = 3, octaves = 5): number {
  let sum = 0, amp = 0.5, norm = 0;
  for (let k = 0; k < octaves; k++) {
    const p = base << k;
    sum += pnoise(u * p, v * p, p, seed + k * 13) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

/** Plain (non-tiling) value noise for bodies. */
function noise(x: number, y: number, seed: number): number {
  return pnoise(x, y, 1 << 16, seed);
}

// -----------------------------------------------------------------------------
// Parallax layers
// -----------------------------------------------------------------------------

/**
 * Seamless nebula: near-black space with cool indigo/teal gas, warm rust
 * filaments in places, and a faint diagonal galactic band.
 */
export function buildNebulaTile(size: number, seed: number): HTMLCanvasElement {
  const [c, ctx, img] = canvas(size, size);
  const cool = [PALETTE.spaceBlackHex, PALETTE.deepIndigoHex, PALETTE.shadowNavyHex, PALETTE.atmosphericDuskHex, PALETTE.cyanShadowHex].map(rgb);
  const warm = [PALETTE.spaceBlackHex, PALETTE.deepIndigoHex, PALETTE.marsShadowUmberHex, PALETTE.marsDeepRustHex, PALETTE.marsOchreCoreHex].map(rgb);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const gas = fbm(u, v, seed);
      const wisps = fbm(u, v, seed + 101, 6, 4);
      const band = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * 2 * (u - v)), 5);
      let d = (gas - 0.42) * 1.9 + band * 0.55 * gas + (wisps - 0.5) * 0.35;
      d = Math.max(0, Math.min(0.999, d));
      const warmth = fbm(u, v, seed + 211, 2, 3);
      const ramp = warmth > 0.6 && d > 0.25 ? warm : cool;
      const idx = Math.max(0, Math.min(ramp.length - 1, Math.floor(d * ramp.length + (bayer(x, y) - 0.5) * 0.9)));
      put(img, x, y, ramp[idx]);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Transparent seamless star tile. `brightness` scales how many reach full
 * white; `glints` adds four-point diffraction crosses to the brightest stars.
 */
export function buildStarTile(size: number, count: number, seed: number, brightness: number, glints: boolean): HTMLCanvasElement {
  const [c, ctx, img] = canvas(size, size);
  const tints = [PALETTE.lunarHighlightHex, PALETTE.lunarHighlightHex, PALETTE.lunarCrustCreamHex, PALETTE.cyanLaserHex, PALETTE.marsHazePeachHex, PALETTE.beaconGoldHex].map(rgb);
  const wrap = (n: number) => ((n % size) + size) % size;
  for (let i = 0; i < count; i++) {
    const x = Math.floor(hash(i, 1, seed) * size);
    const y = Math.floor(hash(i, 2, seed) * size);
    // Denser along the galactic band
    const u = x / size, v = y / size;
    const band = Math.pow(0.5 + 0.5 * Math.cos(Math.PI * 2 * (u - v)), 4);
    if (hash(i, 6, seed) > 0.35 + band * 0.65) continue;
    const b = Math.pow(hash(i, 3, seed), 2.2) * brightness;
    const col = tints[Math.floor(hash(i, 4, seed) * tints.length)];
    const a = Math.round(70 + Math.min(1, b) * 185);
    put(img, x, y, col, a);
    if (glints && b > 0.82) {
      const arm = b > 0.95 ? 2 : 1;
      for (let k = 1; k <= arm; k++) {
        const fa = Math.round(a * (k === 1 ? 0.55 : 0.25));
        put(img, wrap(x + k), y, col, fa);
        put(img, wrap(x - k), y, col, fa);
        put(img, x, wrap(y + k), col, fa);
        put(img, x, wrap(y - k), col, fa);
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

// -----------------------------------------------------------------------------
// Bodies
// -----------------------------------------------------------------------------

/** Lit sphere painter shared by the bodies: `shade(dx, dy, lambert, x, y)` → colour or null. */
function sphere(size: number, shade: (dx: number, dy: number, lam: number, x: number, y: number) => RGB): HTMLCanvasElement {
  const [c, ctx, img] = canvas(size, size);
  const R = size / 2 - 0.5;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - size / 2) / R;
      const dy = (y + 0.5 - size / 2) / R;
      const r2 = dx * dx + dy * dy;
      if (r2 > 1) continue;
      const nz = Math.sqrt(1 - r2);
      const lam = Math.max(0, dx * LIGHT[0] + dy * LIGHT[1] + nz * LIGHT[2]);
      put(img, x, y, shade(dx, dy, lam, x, y));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function pick(ramp: RGB[], v: number, x: number, y: number): RGB {
  return ramp[Math.max(0, Math.min(ramp.length - 1, Math.floor(v * ramp.length + (bayer(x, y) - 0.5) * 0.7)))];
}

/** Banded gas giant with a great storm (Jupiter). */
export function buildBandedGiant(size: number, seed: number): HTMLCanvasElement {
  const ramp = [PALETTE.deepIndigoHex, PALETTE.marsShadowUmberHex, PALETTE.marsOchreCoreHex, PALETTE.marsDustTanHex, PALETTE.marsHazePeachHex, PALETTE.lunarCrustCreamHex].map(rgb);
  const storm = rgb(PALETTE.marsTerracottaHex);
  return sphere(size, (dx, dy, lam, x, y) => {
    if (lam < 0.04) return ramp[0];
    const turb = noise(x / (size / 14), y / (size / 40), seed) * 0.9;
    const band = 0.5 + 0.5 * Math.sin(dy * 16 + turb);
    const spot = Math.hypot((dx - 0.28) / 0.22, (dy - 0.32) / 0.11);
    if (spot < 1 && lam > 0.2) return spot < 0.55 ? storm : pick(ramp, lam * 0.75, x, y);
    return pick(ramp, lam * (0.55 + band * 0.5), x, y);
  });
}

/** Pluto: tan and rust world with its bright nitrogen-ice heart. */
export function buildPluto(size: number, seed: number): HTMLCanvasElement {
  const ramp = [PALETTE.deepIndigoHex, PALETTE.marsShadowUmberHex, PALETTE.marsOchreCoreHex, PALETTE.marsDustTanHex, PALETTE.marsHazePeachHex].map(rgb);
  const ice = [PALETTE.marsHazePeachHex, PALETTE.lunarCrustCreamHex, PALETTE.lunarHighlightHex].map(rgb);
  const dark = rgb(PALETTE.marsDeepRustHex);
  return sphere(size, (dx, dy, lam, x, y) => {
    if (lam < 0.05) return ramp[0];
    const n = noise(x / (size / 8), y / (size / 8), seed);
    // Heart: two lobes and a point, right of centre
    const hx = (dx - 0.22) / 0.4, hy = (dy - 0.05) / 0.4;
    const heart = (hx * hx + hy * hy - 0.5) ** 3 - 1.2 * hx * hx * (-hy) ** 3 < (n - 0.5) * 0.06;
    if (heart) return pick(ice, lam * 0.95 + n * 0.25, x, y);
    const belt = ((dx + 0.42) / 0.38) ** 2 + ((dy - 0.2) / 0.16) ** 2;
    if (belt < 1 + (n - 0.5) * 0.9) return lam > 0.25 ? dark : ramp[1];
    return pick(ramp, lam * (0.8 + n * 0.3), x, y);
  });
}

/** Grey, cratered small moon or Galilean-style icy moon. */
export function buildSmallMoon(size: number, seed: number, icy: boolean): HTMLCanvasElement {
  const ramp = (icy
    ? [PALETTE.deepIndigoHex, PALETTE.lunarRegolithMidHex, PALETTE.lunarDustLightHex, PALETTE.lunarCrustCreamHex, PALETTE.lunarHighlightHex]
    : [PALETTE.deepIndigoHex, PALETTE.lunarBasaltDarkHex, PALETTE.lunarRegolithDeepHex, PALETTE.lunarRegolithMidHex, PALETTE.lunarDustLightHex]).map(rgb);
  const linea = rgb(PALETTE.marsOchreCoreHex);
  return sphere(size, (dx, dy, lam, x, y) => {
    if (lam < 0.05) return ramp[0];
    if (icy && lam > 0.3 && Math.abs(Math.sin(dx * 7 + dy * 3 + seed) * 0.6 - dy) < 0.05) return linea;
    return pick(ramp, lam * (0.85 + noise(x / 3, y / 3, seed) * 0.3), x, y);
  });
}

/** Hazy orange moon (Titan): almost featureless, with a soft blue upper haze rim. */
export function buildHazeMoon(size: number, seed: number): HTMLCanvasElement {
  const ramp = [PALETTE.marsShadowUmberHex, PALETTE.marsOchreCoreHex, PALETTE.marsTerracottaHex, PALETTE.marsDustTanHex, PALETTE.marsHazePeachHex].map(rgb);
  const rim = rgb(PALETTE.cyanShadowHex);
  return sphere(size, (dx, dy, lam, x, y) => {
    if (dx * dx + dy * dy > 0.86 && lam < 0.3) return rim;
    return pick(ramp, 0.25 + lam * 0.7 + noise(x / 4, y / 4, seed) * 0.08, x, y);
  });
}

/** Elongated, saddle-shaped asteroid (Eros), lit as an ellipsoid. */
export function buildPeanutAsteroid(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx, img] = canvas(w, h);
  const ramp = [PALETTE.deepIndigoHex, PALETTE.lunarBasaltDarkHex, PALETTE.lunarRegolithDeepHex, PALETTE.lunarRegolithMidHex, PALETTE.lunarDustLightHex, PALETTE.marsHazePeachHex].map(rgb);
  const craters = Array.from({ length: 9 }, (_v, i) => ({ x: hash(i, 1, seed) * 2 - 1, y: hash(i, 2, seed) * 1.2 - 0.6, r: 0.08 + hash(i, 3, seed) * 0.14 }));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5 - w / 2) / (w / 2);
      const v = (y + 0.5 - h / 2) / (h / 2);
      // Saddle: pinch the middle top edge
      const pinch = 1 - 0.32 * Math.exp(-((u - 0.05) ** 2) / 0.06) * (v < 0 ? 1 : 0.25);
      const lump = 1 + (noise(u * 3 + 5, v * 3 + 5, seed) - 0.5) * 0.18;
      const r2 = u * u + (v / pinch) ** 2;
      if (r2 > lump * lump) continue;
      const nz = Math.sqrt(Math.max(0, 1 - r2 / (lump * lump)));
      const nl = Math.hypot(u * 0.6, v * 1.6, nz);
      let lam = Math.max(0, (u * 0.6 * LIGHT[0] + v * 1.6 * LIGHT[1] + nz * LIGHT[2]) / nl);
      for (const cr of craters) {
        const d = Math.hypot(u - cr.x, (v - cr.y) * 2);
        if (d < cr.r) lam *= d < cr.r * 0.7 ? 0.55 : 1.15;
      }
      put(img, x, y, lam < 0.05 ? ramp[0] : pick(ramp, lam * 0.95 + noise(x / 2, y / 2, seed) * 0.12, x, y));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Comet with coma and two tails pointing away from the Sun (to the lower left):
 * a curved warm dust tail and a straight cyan ion tail. Drawn for additive blending.
 */
export function buildComet(w: number, h: number, seed: number): HTMLCanvasElement {
  const [c, ctx, img] = canvas(w, h);
  const nx = w - 14, ny = 12;
  const white = rgb(PALETTE.lunarHighlightHex), cream = rgb(PALETTE.lunarCrustCreamHex);
  const dust = [PALETTE.marsDeepRustHex, PALETTE.marsOchreCoreHex, PALETTE.marsDustTanHex, PALETTE.marsHazePeachHex].map(rgb);
  const ion = [PALETTE.cyanShadowHex, PALETTE.cyanDeepHex, PALETTE.cyanGlowHex, PALETTE.cyanLaserHex].map(rgb);
  const dirX = -0.86, dirY = 0.51; // away from the Sun
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rx = x - nx, ry = y - ny;
      const along = rx * dirX + ry * dirY; // distance down the tail
      const across = rx * -dirY + ry * dirX;
      const coma = Math.exp(-(rx * rx + ry * ry) / 30);
      let best: RGB | null = null, bi = 0;
      if (coma > 0.12) {
        bi = coma;
        best = coma > 0.75 ? white : cream;
      }
      if (along > 0) {
        const L = along / (w * 0.95);
        // Ion tail: narrow, straight
        const it = Math.exp(-(across * across) / (4 + along * 0.12)) * (1 - L) * (0.35 + noise(along / 6, 0, seed) * 0.45);
        // Dust tail: broad, curving
        const bend = across - (along * along) / (w * 1.4);
        const dt = Math.exp(-(bend * bend) / (6 + along * 0.6)) * (1 - L) * 0.9;
        if (it > bi && it > 0.12) { bi = it; best = ion[Math.min(3, Math.floor(it * 4.5))]; }
        if (dt > bi && dt > 0.12) { bi = dt; best = dust[Math.min(3, Math.floor(dt * 4.2))]; }
      }
      if (best && bi > bayer(x, y) * 0.5) put(img, x, y, best);
    }
  }
  put(img, nx, ny, white);
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Four-spike lens flare for the distant Sun (additive). */
export function buildSunFlare(size: number): HTMLCanvasElement {
  const [c, ctx, img] = canvas(size, size);
  const m = size / 2;
  const white = rgb(PALETTE.lunarHighlightHex), gold = rgb(PALETTE.beaconGoldHex), peach = rgb(PALETTE.marsHazePeachHex);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = Math.abs(x + 0.5 - m), dy = Math.abs(y + 0.5 - m);
      const r = Math.hypot(dx, dy);
      const spike = Math.max(Math.exp(-dy * 1.6) * (1 - dx / m), Math.exp(-dx * 1.6) * (1 - dy / m));
      const diag = Math.exp(-Math.abs(dx - dy) * 1.2) * Math.max(0, 1 - r / (m * 0.55)) * 0.55;
      const core = Math.max(0, 1 - r / 5);
      const v = Math.max(spike, diag, core);
      if (v < 0.08 || v < bayer(x, y) * 0.35) continue;
      put(img, x, y, v > 0.7 ? white : v > 0.3 ? gold : peach, Math.round(Math.min(1, v * 1.3) * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}
