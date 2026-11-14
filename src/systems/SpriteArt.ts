import { PALETTE as C } from '../ui/theme.ts';

/**
 * Original 16-bit style sprites, painted procedurally on a pixel grid with the
 * game's 24-colour palette: shaded volumes (light from the upper left), ordered
 * dithering for gradients and an automatic dark silhouette outline.
 */

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number): number => (BAYER4[(y & 3) * 4 + (x & 3)] + 0.5) / 16;

export const hash = (x: number, y: number, s: number): number => {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
};

/** Pick a colour from a dark→light ramp for a 0..1 value with ordered dithering. */
export function dq(ramp: readonly string[], v: number, x: number, y: number): string {
  const f = Math.max(0, Math.min(1, v)) * (ramp.length - 1);
  const i = Math.floor(f);
  return ramp[Math.min(ramp.length - 1, f - i > bayer(x, y) ? i + 1 : i)];
}

export const RAMPS = {
  silver: [C.lunarBasaltDark, C.lunarRegolithMid, C.lunarDustLight, C.lunarCrustCream, C.lunarHighlight],
  gold: [C.emberShadow, C.thrusterOrange, C.beaconGold],
  panel: [C.cyanVoid, C.cyanShadow, C.cyanDeep],
  dark: [C.deepIndigo, C.shadowNavy, C.atmosphericDusk, C.lunarBasaltDark],
  moonRock: [C.deepIndigo, C.lunarBasaltDark, C.lunarRegolithDeep, C.lunarRegolithMid, C.lunarDustLight, C.lunarCrustCream],
  marsRock: [C.marsShadowUmber, C.marsDeepRust, C.marsOchreCore, C.marsTerracotta, C.marsDustTan, C.marsHazePeach],
} as const;

const OUTLINE = C.deepIndigo;

export class Painter {
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
    if (ix >= 0 && iy >= 0 && ix < this.w && iy < this.h) this.px[iy * this.w + ix] = c;
    return this;
  }

  get(x: number, y: number): string | null {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    return this.px[y * this.w + x];
  }

  clear(x: number, y: number): this {
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = null;
    return this;
  }

  rect(x: number, y: number, w: number, h: number, c: string): this {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
    return this;
  }

  /** Box with lit top/left edge and shaded bottom/right edge. */
  box(x: number, y: number, w: number, h: number, hi: string, mid: string, lo: string): this {
    this.rect(x, y, w, h, mid);
    this.rect(x, y, w, 1, hi).rect(x, y, 1, h, hi);
    this.rect(x, y + h - 1, w, 1, lo).rect(x + w - 1, y + 1, 1, h - 1, lo);
    return this;
  }

  /** Volume shaded across a ramp: brightest upper-left, darkest lower-right. */
  shadeRect(x: number, y: number, w: number, h: number, ramp: readonly string[], bias = 0, grain = 0, seed = 1): this {
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        const u = w > 1 ? xx / (w - 1) : 0.5;
        const v = h > 1 ? yy / (h - 1) : 0.5;
        let val = 0.8 - u * 0.35 - v * 0.4 + bias;
        if (grain) val += (hash(x + xx, y + yy, seed) - 0.5) * grain;
        this.set(x + xx, y + yy, dq(ramp, val, x + xx, y + yy));
      }
    }
    return this;
  }

  /** Crinkled gold thermal foil. */
  foil(x: number, y: number, w: number, h: number, seed = 3): this {
    this.shadeRect(x, y, w, h, RAMPS.gold, 0.05, 0.55, seed);
    for (let i = 0; i < Math.max(1, Math.floor((w * h) / 18)); i++) {
      const sx = x + Math.floor(hash(i, 5, seed) * w);
      const sy = y + Math.floor(hash(i, 6, seed) * h);
      this.set(sx, sy, hash(i, 7, seed) > 0.5 ? C.lunarHighlight : C.emberShadow);
    }
    return this;
  }

  /** Solar array: deep blue cells, cell grid, glint along the upper edge. */
  panel(x: number, y: number, w: number, h: number, cell = 2): this {
    this.shadeRect(x, y, w, h, RAMPS.panel, 0.05);
    for (let yy = y; yy < y + h; yy++) {
      for (let xx = x; xx < x + w; xx++) {
        if ((xx - x) % (cell + 1) === cell || (h > 2 && (yy - y) % (cell + 1) === cell)) this.set(xx, yy, C.cyanVoid);
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
      if (e2 >= dy) { err += dy; x += sx; }
      if (e2 <= dx) { err += dx; y += sy; }
    }
    return this;
  }

  /** Two-pixel strut: lit pixel on the left, shade on the right. */
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

  /** Dithered sphere/disc shading lit from the upper-left. */
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

  /** Dark silhouette outline (4-neighbour) around everything painted so far. */
  outline(c: string = OUTLINE): this {
    const src = this.px.slice();
    const at = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? null : src[y * this.w + x]);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        if (at(x, y)) continue;
        if (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1)) this.px[y * this.w + x] = c;
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
// Robot explorer (24×24). Geometry contract used by other scenes:
// wheels end on row 20 (ground line y = 21), visor rows 8–10,
// jet canisters x 3–5 / 18–20 with nozzles on rows 15–16.
// ---------------------------------------------------------------------------

/** Antenna, jet canisters, shell, visor and chest: shared by the rover and flight-pack robot. */
function paintRobotUpper(p: Painter, rcs: boolean): void {
  const S = RAMPS.silver;

  // Antenna with beacon
  p.line(15, 2, 15, 4, C.lunarDustLight).set(16, 3, C.lunarRegolithMid);
  p.set(15, 1, C.beaconGold).set(16, 1, C.thrusterOrange);

  // Jet canisters (cylinders) + nozzles; in flight they become cyan RCS pods
  for (const cx of [3, 18]) {
    p.rect(cx, 7, 3, 1, C.lunarCrustCream);
    p.set(cx, 8, C.lunarCrustCream).set(cx + 1, 8, C.lunarDustLight).set(cx + 2, 8, C.lunarRegolithMid);
    for (let y = 9; y <= 14; y++) {
      p.set(cx, y, C.lunarDustLight).set(cx + 1, y, dq(S, 0.45 - (y - 9) * 0.04, cx + 1, y)).set(cx + 2, y, C.lunarRegolithDeep);
    }
    p.set(cx + 1, 10, rcs ? C.cyanGlow : C.thrusterOrange).set(cx + 1, 11, rcs ? C.cyanDeep : C.emberShadow);
    p.rect(cx, 15, 3, 1, C.shadowNavy).set(cx + 1, 15, C.atmosphericDusk);
    p.rect(cx, 16, 3, 1, rcs ? C.cyanShadow : C.emberShadow).set(cx + 1, 16, rcs ? C.cyanLaser : C.thrusterOrange);
  }

  // Head/body shell
  p.rect(7, 4, 10, 1, C.lunarCrustCream);
  p.rect(6, 5, 12, 12, C.lunarDustLight);
  p.shadeRect(6, 5, 12, 12, S, 0.12);
  p.rect(7, 4, 10, 1, C.lunarHighlight).rect(6, 5, 1, 9, C.lunarHighlight).set(7, 5, C.lunarHighlight);
  p.rect(17, 6, 1, 11, C.lunarRegolithDeep);
  // Visor bezel + glass (rows 7–11)
  p.rect(7, 7, 10, 5, C.shadowNavy);
  p.rect(8, 8, 8, 3, C.cyanDeep);
  p.rect(8, 8, 8, 1, C.cyanGlow);
  p.set(8, 8, C.cyanLaser).set(9, 8, C.cyanLaser).set(8, 9, C.cyanGlow);
  p.rect(9, 10, 6, 1, C.cyanShadow);
  // Twin eye lights
  p.set(10, 9, C.cyanLaser).set(13, 9, C.cyanLaser);
  // Chest: status LED + vents
  p.set(8, 13, C.cyanGlow).set(9, 13, C.cyanDeep);
  p.rect(12, 13, 4, 1, C.lunarRegolithMid).rect(12, 14, 4, 1, C.lunarRegolithDeep);
  // Belly / chassis underside
  p.rect(6, 16, 12, 1, C.lunarRegolithDeep);
}

/**
 * Flight-pack UNIT-7 (24×24) for zero-g sectors: treads folded away, a twin-bell
 * cyan ion nozzle under the chassis, solar wings / RCS pods on both sides and a
 * pulsing ion plume (frames 0–2). Same head/visor rows as the rover robot.
 */
export function buildFlyingRobotCanvas(frame: 0 | 1 | 2): HTMLCanvasElement {
  const p = new Painter(24, 24);
  // Solar wings deployed beside the RCS pods (cells catch the light on top)
  for (const wx of [0, 21]) p.panel(wx, 8, 3, 6, 1);
  paintRobotUpper(p, true);
  // Folded tread housings tucked under the shell
  p.rect(7, 17, 3, 1, C.lunarBasaltDark).rect(14, 17, 3, 1, C.lunarBasaltDark);
  // Ion nozzle housing + twin bells
  p.rect(9, 17, 6, 1, C.lunarRegolithMid).set(9, 17, C.lunarDustLight);
  p.rect(9, 18, 6, 1, C.shadowNavy);
  p.rect(9, 19, 2, 1, C.lunarRegolithDeep).rect(13, 19, 2, 1, C.lunarRegolithDeep);
  p.set(10, 18, C.cyanGlow).set(13, 18, C.cyanGlow);
  p.outline();

  // Plumes are light, not hardware: drawn after the outline
  const len = [3, 4, 2][frame];
  for (const bx of [9, 13]) {
    for (let i = 0; i < len; i++) {
      const y = 20 + i;
      const tip = i === len - 1;
      p.set(bx, y, tip ? C.cyanDeep : i === 0 ? C.lunarHighlight : C.cyanLaser);
      p.set(bx + 1, y, tip ? C.cyanShadow : C.cyanGlow);
    }
  }
  // RCS pod sparks flicker on alternating frames
  if (frame === 1) p.set(4, 17, C.cyanLaser).set(19, 17, C.cyanLaser);
  if (frame === 2) p.set(4, 17, C.cyanDeep).set(19, 17, C.cyanDeep);
  return p.toCanvas();
}

/** Three-frame ion-plume cycle (72×24 sheet) for flying in deep space. */
export function buildFlyingRobotSheet(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 24;
  const ctx = canvas.getContext('2d')!;
  ([0, 1, 2] as const).forEach((f) => ctx.drawImage(buildFlyingRobotCanvas(f), f * 24, 0));
  return canvas;
}

function paintRobot(frame: number): Painter {
  const p = new Painter(24, 24);
  paintRobotUpper(p, false);
  p.rect(9, 17, 6, 1, C.shadowNavy);
  return paintRobotTreads(p, frame);
}

function paintRobotTreads(p: Painter, frame: number): Painter {
  // Treads (rows 17–20)
  for (const tx of [4, 13]) {
    p.rect(tx + 1, 17, 5, 1, C.lunarRegolithMid);
    p.rect(tx, 18, 7, 2, C.lunarBasaltDark);
    p.rect(tx + 1, 20, 5, 1, C.shadowNavy);
    for (let i = 0; i < 7; i++) {
      const lit = (i + frame) % 2 === 0;
      p.set(tx + i, 18, lit ? C.lunarRegolithDeep : C.shadowNavy);
    }
    p.set(tx + 1, 19, C.lunarRegolithMid).set(tx + 5, 19, C.lunarRegolithMid); // wheel hubs
    p.set(tx + 3, 19, (frame % 2) ? C.lunarRegolithDeep : C.atmosphericDusk);
  }

  return p.outline();
}

export function buildRobotCanvas(): HTMLCanvasElement {
  return paintRobot(0).toCanvas();
}

/** Two-frame drive cycle (48×24 sheet) for the top-down exploration view. */
export function buildRobotDriveSheet(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 48;
  canvas.height = 24;
  paintRobot(0).toCanvas(canvas, 0, 0);
  paintRobot(1).toCanvas(canvas, 24, 0);
  return canvas;
}

// ---------------------------------------------------------------------------
// Machines (32×32). Ground line y = 27: lowest painted art row is 26.
// ---------------------------------------------------------------------------

type Machine =
  | 'apollo-lm' | 'surveyor' | 'lrrr' | 'lrv' | 'blue-ghost' | 'odysseus'
  | 'viking' | 'pathfinder' | 'polar-lander' | 'phoenix' | 'insight'
  | 'mer' | 'msl' | 'backshell' | 'ingenuity'
  | 'voyager' | 'galileo' | 'near' | 'cassini' | 'deep-impact' | 'new-horizons';

const MACHINE_BY_ID: Record<string, Machine> = {
  'apollo-11-site': 'apollo-lm',
  'apollo-12-site': 'apollo-lm',
  'apollo-17-site': 'apollo-lm',
  'surveyor-3': 'surveyor',
  'apollo-retroreflectors': 'lrrr',
  'apollo-15-lrv': 'lrv',
  'blue-ghost-1': 'blue-ghost',
  'im-1-odysseus': 'odysseus',
  'viking-1-2': 'viking',
  'sojourner-pathfinder': 'pathfinder',
  'mars-polar-lander': 'polar-lander',
  phoenix: 'phoenix',
  insight: 'insight',
  'spirit-opportunity': 'mer',
  curiosity: 'msl',
  'perseverance-landing-hardware': 'backshell',
  ingenuity: 'ingenuity',
  'voyager-1': 'voyager',
  galileo: 'galileo',
  'near-shoemaker': 'near',
  'cassini-huygens': 'cassini',
  'deep-impact': 'deep-impact',
  'new-horizons': 'new-horizons',
};

const footpad = (p: Painter, cx: number, rx = 2.5) => p.shadeEllipse(cx, 25.6, rx, 1.4, RAMPS.silver, 0.1);

function legs(p: Painter, pairs: [number, number, number, number][]): void {
  for (const [x0, y0, x1, y1] of pairs) p.strut(x0, y0, x1, y1, C.lunarDustLight, C.lunarRegolithDeep);
}

function drawMachine(m: Machine, p: Painter): void {
  const S = RAMPS.silver;
  switch (m) {
    case 'apollo-lm': {
      // Descent stage left on the surface: gold-foil octagon, four legs, ladder
      legs(p, [[11, 18, 8, 24], [20, 18, 22, 24]]);
      footpad(p, 8, 2).rect(6, 24, 4, 1, C.lunarRegolithMid);
      footpad(p, 23, 2);
      legs(p, [[8, 14, 3, 24], [23, 14, 27, 24]]);
      p.strut(9, 19, 5, 23, C.lunarRegolithMid, C.lunarBasaltDark).strut(22, 19, 26, 23, C.lunarRegolithMid, C.lunarBasaltDark);
      footpad(p, 4).set(3, 25, C.lunarHighlight);
      footpad(p, 28);
      p.foil(8, 11, 16, 9, 7);
      p.clear(8, 11).clear(23, 11).clear(8, 19).clear(23, 19);
      p.rect(12, 12, 1, 7, C.emberShadow).rect(19, 12, 1, 7, C.emberShadow);
      p.rect(13, 13, 2, 4, C.shadowNavy).rect(13, 13, 2, 1, C.atmosphericDusk);
      p.rect(9, 10, 14, 1, C.lunarCrustCream).rect(10, 9, 12, 1, C.lunarDustLight);
      p.set(10, 9, C.lunarHighlight);
      // Descent engine bell
      p.rect(14, 20, 4, 1, C.lunarBasaltDark).rect(13, 21, 6, 1, C.shadowNavy).set(14, 21, C.lunarRegolithDeep);
      // Front leg + ladder
      p.rect(14, 19, 1, 6, C.lunarCrustCream).rect(17, 19, 1, 6, C.lunarRegolithMid);
      for (let y = 20; y <= 24; y += 2) p.rect(15, y, 2, 1, C.lunarDustLight);
      footpad(p, 15.5, 3);
      break;
    }
    case 'surveyor': {
      legs(p, [[13, 18, 4, 24], [19, 18, 27, 24], [15, 19, 15, 24]]);
      footpad(p, 4, 2).set(3, 25, C.lunarHighlight);
      footpad(p, 28, 2);
      footpad(p, 15.5, 2);
      // Tubular spaceframe
      p.line(9, 21, 23, 21, C.lunarRegolithMid);
      p.line(9, 21, 15, 9, C.lunarDustLight).line(23, 21, 17, 9, C.lunarRegolithMid);
      // Thermal compartments (white boxes)
      p.box(8, 14, 6, 5, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid);
      p.box(19, 15, 5, 4, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid);
      p.rect(9, 16, 4, 1, C.lunarDustLight);
      // Central mast
      p.rect(15, 3, 2, 18, C.lunarDustLight).rect(16, 3, 1, 18, C.lunarRegolithMid);
      // Solar panel (left) + planar antenna (right)
      p.panel(6, 3, 9, 4, 2);
      p.box(18, 4, 7, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarDustLight);
      // TV camera + mirror
      p.rect(17, 9, 2, 4, C.lunarCrustCream).set(18, 12, C.lunarRegolithMid).set(17, 9, C.cyanGlow);
      // Surface sampler arm + scoop
      p.strut(22, 17, 27, 20, C.lunarCrustCream, C.lunarRegolithDeep);
      p.box(27, 20, 3, 2, C.lunarDustLight, C.lunarRegolithMid, C.lunarBasaltDark);
      break;
    }
    case 'lrrr': {
      legs(p, [[9, 20, 8, 25], [23, 20, 24, 25], [16, 21, 16, 25]]);
      footpad(p, 8.5, 2);
      footpad(p, 24.5, 2);
      // Tilted array of corner-cube prisms
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
      // Far-side wheels (darker)
      p.shadeEllipse(11, 21.5, 3.5, 3.5, RAMPS.dark, 0.1);
      p.shadeEllipse(27, 21.5, 3.5, 3.5, RAMPS.dark, 0.1);
      // Chassis
      p.shadeRect(3, 17, 27, 3, S, 0.05);
      p.rect(3, 17, 27, 1, C.lunarCrustCream);
      p.foil(4, 15, 6, 2, 11);
      // Seats + console
      p.box(12, 12, 4, 5, C.atmosphericDusk, C.shadowNavy, C.deepIndigo);
      p.box(17, 12, 4, 5, C.atmosphericDusk, C.shadowNavy, C.deepIndigo);
      p.rect(22, 11, 3, 2, C.lunarDustLight).line(23, 13, 23, 16, C.lunarRegolithMid);
      // High-gain umbrella antenna
      p.line(7, 7, 7, 16, C.lunarDustLight);
      p.shadeEllipse(7, 5, 5, 2, S, 0.2);
      p.rect(3, 6, 9, 1, C.lunarRegolithMid);
      // TV camera
      p.box(26, 12, 3, 3, C.lunarCrustCream, C.lunarDustLight, C.lunarRegolithDeep).line(27, 15, 27, 16, C.lunarRegolithMid);
      // Near wheels: wire mesh with chevrons + fenders
      for (const wx of [7, 24]) {
        p.shadeEllipse(wx, 23, 3.5, 3.5, [C.lunarBasaltDark, C.lunarRegolithDeep, C.lunarRegolithMid, C.lunarDustLight]);
        for (let a = 0; a < 8; a++) {
          const ang = (a / 8) * Math.PI * 2;
          p.set(wx + Math.round(Math.cos(ang) * 3), 23 + Math.round(Math.sin(ang) * 3), C.lunarBasaltDark);
        }
        p.set(wx, 23, C.lunarCrustCream).set(wx - 1, 22, C.lunarDustLight);
        p.rect(wx - 4, 18, 9, 1, C.lunarHighlight).set(wx + 4, 18, C.lunarDustLight);
      }
      break;
    }
    case 'blue-ghost': {
      legs(p, [[12, 19, 10, 24], [20, 19, 22, 24]]);
      footpad(p, 10, 2);
      footpad(p, 22, 2);
      legs(p, [[9, 16, 3, 24], [23, 16, 28, 24]]);
      footpad(p, 4);
      footpad(p, 28);
      // Squat white body with side solar panels
      p.shadeRect(8, 9, 16, 11, S, 0.15);
      p.rect(8, 9, 16, 1, C.lunarHighlight);
      p.panel(10, 11, 12, 4, 2);
      p.foil(9, 16, 14, 3, 13);
      // Deck payloads + antenna
      p.box(10, 6, 4, 3, C.beaconGold, C.thrusterOrange, C.emberShadow);
      p.box(18, 7, 3, 2, C.lunarCrustCream, C.lunarDustLight, C.lunarRegolithMid);
      p.line(16, 2, 16, 8, C.lunarDustLight).set(16, 2, C.cyanLaser);
      p.rect(14, 20, 4, 1, C.shadowNavy);
      break;
    }
    case 'odysseus': {
      legs(p, [[13, 18, 11, 24], [19, 18, 21, 24]]);
      footpad(p, 11, 2);
      footpad(p, 21, 2);
      legs(p, [[11, 16, 5, 24], [21, 16, 27, 24]]);
      footpad(p, 5);
      footpad(p, 27);
      // Tall hexagonal prism: lit left face, shaded right face
      p.shadeRect(11, 5, 5, 15, S, 0.2);
      p.shadeRect(16, 5, 5, 15, S, -0.15);
      p.rect(12, 4, 8, 1, C.lunarHighlight);
      p.panel(12, 8, 3, 8, 2);
      p.panel(17, 8, 3, 8, 2);
      p.foil(11, 17, 10, 3, 17);
      p.shadeEllipse(16, 2.5, 3, 1.2, S, 0.2);
      p.line(16, 3, 16, 4, C.lunarDustLight);
      p.rect(15, 20, 2, 1, C.shadowNavy);
      break;
    }
    case 'viking': {
      legs(p, [[11, 18, 4, 24], [21, 18, 27, 24], [16, 19, 16, 24]]);
      footpad(p, 4, 2.5);
      footpad(p, 28, 2.5);
      footpad(p, 16.5, 2.5);
      // Hexagonal equipment body
      p.shadeRect(9, 13, 14, 6, S, 0.1);
      p.clear(9, 13).clear(22, 13).clear(9, 18).clear(22, 18);
      p.rect(10, 13, 12, 1, C.lunarHighlight);
      p.foil(10, 17, 12, 2, 19);
      // Finned RTG power units
      for (const rx of [9, 20]) {
        p.box(rx, 9, 3, 4, C.atmosphericDusk, C.shadowNavy, C.deepIndigo);
        p.set(rx + 1, 10, C.lunarBasaltDark).set(rx + 1, 12, C.lunarBasaltDark);
      }
      // Camera turrets
      p.box(13, 9, 2, 4, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid).set(13, 10, C.cyanGlow);
      p.box(17, 9, 2, 4, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid).set(17, 10, C.cyanGlow);
      // High-gain dish on a mast
      p.line(16, 6, 16, 12, C.lunarDustLight);
      p.shadeEllipse(16, 4, 5, 2, S, 0.25);
      p.rect(12, 5, 9, 1, C.lunarRegolithMid);
      p.set(16, 4, C.lunarRegolithDeep);
      // Sampler boom + meteorology boom
      p.strut(23, 15, 29, 19, C.lunarCrustCream, C.lunarRegolithDeep);
      p.rect(28, 19, 2, 2, C.lunarRegolithMid);
      p.line(9, 14, 4, 10, C.lunarDustLight).rect(3, 9, 2, 2, C.lunarCrustCream);
      break;
    }
    case 'pathfinder': {
      // Opened petals with solar cells resting on the ground
      p.panel(1, 22, 10, 4, 2);
      p.panel(9, 24, 10, 2, 2);
      // Deflated airbag fabric
      p.shadeEllipse(4, 21.5, 3, 1.5, [C.marsTerracotta, C.marsDustTan, C.marsHazePeach], 0.1);
      // Base + camera mast
      p.foil(10, 19, 7, 5, 23);
      p.box(10, 18, 7, 1, C.lunarHighlight, C.lunarCrustCream, C.lunarDustLight);
      p.rect(13, 7, 1, 11, C.lunarDustLight).rect(14, 7, 1, 11, C.lunarRegolithMid);
      p.box(11, 4, 6, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid);
      p.set(12, 5, C.cyanLaser).set(15, 5, C.cyanGlow);
      // Sojourner, the small rover beside it
      p.panel(20, 19, 10, 2, 2);
      p.box(21, 21, 8, 2, C.lunarCrustCream, C.lunarDustLight, C.lunarRegolithMid);
      for (const wx of [21, 25, 29]) p.shadeEllipse(wx, 24.5, 1.6, 1.6, RAMPS.dark, 0.25);
      p.line(21, 23, 29, 23, C.lunarRegolithMid);
      p.set(28, 20, C.cyanLaser);
      break;
    }
    case 'polar-lander': {
      legs(p, [[12, 18, 5, 24], [20, 18, 27, 24], [16, 19, 16, 24]]);
      footpad(p, 5, 2);
      footpad(p, 27, 2);
      footpad(p, 16.5, 2);
      p.panel(1, 13, 10, 4, 2);
      p.panel(21, 13, 10, 4, 2);
      p.foil(11, 15, 10, 5, 29);
      p.shadeRect(11, 11, 10, 4, S, 0.15);
      p.rect(11, 11, 10, 1, C.lunarHighlight);
      p.line(14, 5, 14, 10, C.lunarDustLight);
      p.box(12, 2, 6, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid).set(13, 3, C.cyanGlow);
      p.strut(20, 16, 25, 21, C.lunarCrustCream, C.lunarRegolithDeep);
      break;
    }
    case 'phoenix':
    case 'insight': {
      const big = m === 'insight';
      legs(p, [[12, 18, 6, 24], [20, 18, 26, 24], [16, 19, 16, 24]]);
      footpad(p, 6, 2);
      footpad(p, 26, 2);
      footpad(p, 16.5, 2);
      // Round (decagonal) solar arrays seen in perspective
      for (const ax of big ? [6.5, 25.5] : [7, 25]) {
        const rx = big ? 6.5 : 5.5;
        const ry = big ? 3 : 2.6;
        p.shadeEllipse(ax, 13, rx, ry, RAMPS.panel, 0.15);
        for (let k = 0; k < 5; k++) {
          const ang = (k / 5) * Math.PI;
          p.line(ax, 13, ax + Math.cos(ang) * rx, 13 - Math.sin(ang) * ry, C.cyanVoid);
        }
        p.line(ax - rx + 1, 13 - ry + 1, ax, 13 - ry, C.cyanGlow);
        p.set(ax, 13, C.lunarDustLight);
      }
      p.shadeRect(12, 11, 8, 6, S, 0.15);
      p.rect(12, 11, 8, 1, C.lunarHighlight);
      p.foil(12, 17, 8, 2, 31);
      if (big) {
        // Robotic arm + seismometer shield dome placed on the ground
        p.strut(19, 14, 23, 9, C.lunarCrustCream, C.lunarRegolithDeep);
        p.rect(22, 8, 3, 2, C.lunarDustLight);
        for (let y = 20; y <= 25; y++) {
          const hw = Math.round(Math.sqrt(Math.max(0, 1 - ((y - 25.5) / 5.5) ** 2)) * 5);
          for (let x = 26 - hw; x <= 26 + hw; x++) p.set(x, y, dq(S, 0.85 - (x - 21) * 0.06 - (y - 20) * 0.05, x, y));
        }
        p.rect(20, 26, 13, 1, C.thrusterOrange).set(21, 26, C.beaconGold);
      } else {
        // Meteorological mast + camera mast + digging arm
        p.line(19, 3, 19, 10, C.lunarDustLight).rect(18, 2, 3, 1, C.lunarCrustCream);
        p.line(14, 6, 14, 10, C.lunarDustLight);
        p.box(12, 4, 5, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid).set(13, 5, C.cyanGlow);
        p.strut(13, 16, 9, 22, C.lunarCrustCream, C.lunarRegolithDeep);
        p.rect(8, 22, 2, 2, C.lunarRegolithMid);
      }
      break;
    }
    case 'mer': {
      // Rocker-bogie + six wheels (three visible)
      p.strut(7, 20, 15, 19, C.lunarDustLight, C.lunarRegolithDeep).strut(15, 19, 24, 21, C.lunarDustLight, C.lunarRegolithDeep);
      for (const wx of [7, 15.5, 24.5]) {
        p.shadeEllipse(wx, 23.5, 2.6, 2.6, RAMPS.dark, 0.2);
        p.set(Math.round(wx), 23, C.lunarDustLight);
      }
      // Body (warm electronics box)
      p.foil(9, 16, 14, 4, 37);
      p.rect(9, 16, 14, 1, C.lunarCrustCream);
      // Wing-shaped solar deck
      p.panel(3, 13, 26, 3, 2);
      p.rect(3, 12, 26, 1, C.lunarDustLight).set(3, 12, C.lunarHighlight);
      // Pancam mast + head, antennas
      p.rect(22, 5, 1, 7, C.lunarCrustCream).rect(23, 5, 1, 7, C.lunarRegolithMid);
      p.box(19, 2, 7, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid);
      p.set(20, 3, C.cyanLaser).set(24, 3, C.cyanGlow);
      p.shadeEllipse(12, 10.5, 2.6, 1.2, S, 0.2);
      p.line(7, 7, 7, 11, C.lunarDustLight);
      break;
    }
    case 'msl': {
      // Rocker-bogie + three visible wheels
      p.strut(6, 20, 15, 18, C.lunarDustLight, C.lunarRegolithDeep).strut(15, 18, 25, 20, C.lunarDustLight, C.lunarRegolithDeep);
      for (const wx of [6, 15.5, 25.5]) {
        p.shadeEllipse(wx, 23, 3.2, 3.2, RAMPS.dark, 0.2);
        p.set(Math.round(wx) - 1, 22, C.lunarRegolithMid).set(Math.round(wx), 23, C.lunarDustLight);
      }
      // Finned RTG on the back
      p.box(2, 10, 5, 7, C.atmosphericDusk, C.shadowNavy, C.deepIndigo);
      for (let y = 11; y < 16; y += 2) p.rect(1, y, 7, 1, C.lunarBasaltDark);
      // Body
      p.shadeRect(7, 12, 17, 6, S, 0.15);
      p.rect(7, 12, 17, 1, C.lunarHighlight);
      p.rect(8, 16, 15, 1, C.lunarDustLight);
      p.shadeEllipse(11, 10.5, 3, 1.2, S, 0.2);
      // Remote sensing mast + head with laser lens
      p.rect(21, 3, 1, 9, C.lunarCrustCream).rect(22, 3, 1, 9, C.lunarRegolithMid);
      p.box(18, 0, 8, 3, C.lunarHighlight, C.lunarCrustCream, C.lunarRegolithMid);
      p.set(19, 1, C.cyanLaser).set(20, 1, C.cyanGlow);
      // Robotic arm + turret
      p.strut(23, 15, 28, 18, C.lunarCrustCream, C.lunarRegolithDeep);
      p.box(27, 18, 3, 3, C.lunarDustLight, C.lunarRegolithMid, C.lunarBasaltDark);
      break;
    }
    case 'backshell': {
      // Parachute canopy draped across the ground: orange/white gores
      for (let y = 19; y <= 26; y++) {
        for (let x = 13; x <= 31; x++) {
          const u = (x + 0.5 - 23) / 8.5;
          const v = (y + 0.5 - 22.8) / 3.8;
          if (u * u + v * v > 1) continue;
          const gore = Math.floor((Math.atan2(v, u) + Math.PI) / (Math.PI / 5)) % 2 === 0;
          const shade = 0.75 - v * 0.35 + (hash(x, y, 41) - 0.5) * 0.25;
          p.set(x, y, gore ? dq([C.emberShadow, C.thrusterOrange, C.beaconGold], shade, x, y) : dq([C.lunarDustLight, C.lunarCrustCream, C.lunarHighlight], shade, x, y));
        }
      }
      p.line(16, 21, 28, 24, C.emberShadow);
      // Suspension lines
      p.line(11, 17, 15, 21, C.lunarDustLight).line(12, 19, 15, 23, C.lunarDustLight);
      // Backshell cone resting on the ground
      for (let y = 9; y <= 25; y++) {
        const hw = 2 + (y - 9) * 0.45;
        const cx = 9 + (y - 9) * 0.12;
        for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
          const u = (x - (cx - hw)) / (2 * hw);
          p.set(x, y, dq(S, 0.95 - u * 0.75 - (y - 9) * 0.01, x, y));
        }
      }
      p.rect(7, 9, 5, 1, C.lunarRegolithMid);
      for (const by of [14, 20]) {
        const hw = 2 + (by - 9) * 0.45;
        const cx = 9 + (by - 9) * 0.12;
        p.line(Math.round(cx - hw), by, Math.round(cx + hw), by, C.lunarRegolithDeep);
      }
      p.rect(2, 26, 15, 1, C.lunarBasaltDark);
      break;
    }
    case 'ingenuity': {
      legs(p, [[14, 18, 8, 25], [18, 18, 24, 25]]);
      p.line(15, 18, 12, 25, C.lunarRegolithMid).line(17, 18, 20, 25, C.lunarRegolithMid);
      for (const fx of [8, 24, 12, 20]) p.rect(fx - 1, 26, 3, 1, C.lunarDustLight);
      // Fuselage
      p.foil(13, 13, 6, 5, 43);
      p.rect(13, 12, 6, 1, C.lunarCrustCream);
      // Mast + counter-rotating rotors
      p.rect(16, 4, 1, 9, C.lunarDustLight);
      p.rect(3, 10, 26, 1, C.lunarCrustCream).rect(5, 11, 22, 1, C.lunarRegolithMid);
      p.rect(6, 7, 20, 1, C.lunarCrustCream).rect(8, 8, 16, 1, C.lunarRegolithMid);
      p.set(3, 10, C.lunarDustLight).set(28, 10, C.lunarRegolithDeep).set(6, 7, C.lunarDustLight).set(25, 7, C.lunarRegolithDeep);
      p.rect(15, 7, 3, 5, C.lunarRegolithDeep).set(15, 7, C.lunarDustLight);
      // Solar panel on top
      p.panel(12, 2, 9, 2, 2);
      break;
    }
    case 'voyager': {
      // High-gain parabolic white/cream dish + Golden Record + magnetometer & RTG booms
      p.shadeEllipse(16, 11, 7, 3.8, S, 0.25);
      p.ellipse(16, 10, 6.2, 2.2, C.lunarHighlight);
      p.line(16, 10, 16, 5, C.lunarDustLight).line(13, 10, 16, 5, C.lunarRegolithMid).line(19, 10, 16, 5, C.lunarRegolithMid);
      p.set(16, 4, C.cyanLaser);
      // 10-sided bus below dish + Golden Record emblem
      p.box(12, 15, 8, 5, C.shadowNavy, C.lunarRegolithDeep, C.deepIndigo);
      p.rect(14, 16, 3, 3, C.beaconGold).set(15, 17, C.thrusterOrange);
      // Long magnetometer lattice boom (left) + RTG boom (right)
      p.line(1, 14, 12, 17, C.lunarDustLight).set(1, 14, C.cyanGlow);
      p.line(20, 18, 29, 22, C.lunarRegolithMid);
      p.rect(25, 20, 5, 3, C.shadowNavy).rect(26, 21, 3, 1, C.lunarBasaltDark);
      // Scan platform arm down-left
      p.strut(13, 20, 9, 24, C.lunarCrustCream, C.lunarRegolithDeep);
      p.rect(7, 23, 3, 2, C.cyanGlow);
      break;
    }
    case 'galileo': {
      // Unfurled conical HGA rib umbrella + spinning gold-foil bus + jovian science platform
      p.shadeEllipse(16, 8, 8, 3, S, 0.15);
      for (const rx of [9, 12, 16, 20, 23]) p.line(rx, 8, 16, 4, C.lunarCrustCream);
      p.foil(12, 12, 8, 7, 61);
      // Magnetometer boom right
      p.line(20, 15, 30, 13, C.lunarDustLight).set(30, 13, C.cyanLaser);
      // Despun scan platform bottom
      p.strut(16, 19, 16, 25, C.lunarRegolithMid, C.shadowNavy);
      p.rect(12, 22, 8, 3, C.lunarBasaltDark);
      p.set(13, 23, C.cyanLaser).set(18, 23, C.beaconGold);
      break;
    }
    case 'near': {
      // 4-petal cross solar arrays around octagon foil body touching Eros regolith
      p.panel(3, 10, 7, 4, 2).panel(22, 10, 7, 4, 2);
      p.panel(13, 2, 6, 6, 2);
      // Central spacecraft octagon in kapton gold
      p.foil(11, 10, 10, 9, 77);
      p.shadeEllipse(16, 9, 4, 1.5, S, 0.25);
      // Side lander contact struts on asteroid boulder
      legs(p, [[12, 19, 9, 25], [20, 19, 23, 25]]);
      footpad(p, 9, 2);
      footpad(p, 23, 2);
      p.set(15, 16, C.cyanLaser).set(16, 16, C.cyanGlow);
      break;
    }
    case 'cassini': {
      // Tall white parabolic high-gain antenna top + foil stack + gold-cone Huygens probe on left side
      p.shadeEllipse(17, 6, 6.5, 2.8, S, 0.28);
      p.rect(17, 2, 1, 4, C.lunarCrustCream).set(17, 2, C.cyanGlow);
      // Spacecraft bus + fuel cylinder
      p.foil(14, 9, 6, 11, 83);
      p.rect(13, 13, 8, 2, C.lunarCrustCream);
      // Attached Huygens Titan conical aeroshell on left
      for (let r = 0; r < 6; r++) {
        p.line(13 - r, 11 + r, 13 - r, 19 - r, r % 2 ? C.beaconGold : C.thrusterOrange);
      }
      // Magnetometer boom extending upward-right
      p.line(20, 11, 29, 4, C.lunarDustLight).set(29, 4, C.cyanLaser);
      p.rect(18, 20, 4, 4, C.shadowNavy);
      p.set(19, 22, C.beaconGold);
      break;
    }
    case 'deep-impact': {
      // Flyby craft + copper impactor stage
      p.panel(4, 11, 7, 10, 2);
      p.box(12, 10, 9, 10, C.lunarCrustCream, C.lunarRegolithMid, C.lunarBasaltDark);
      // Telemetry dish on top
      p.shadeEllipse(16, 7, 4, 2, S, 0.2);
      // Copper impactor attached right side (amber/ember metallic cylinder)
      p.box(22, 12, 6, 7, C.beaconGold, C.thrusterOrange, C.emberShadow);
      p.rect(28, 14, 2, 3, C.cyanLaser);
      break;
    }
    case 'new-horizons': {
      // Triangular golden foil body + big top white dish + black RTG cylinder extending left
      p.shadeEllipse(17, 8, 7, 3, S, 0.28);
      p.line(17, 8, 17, 4, C.lunarCrustCream).set(17, 4, C.cyanLaser);
      for (let y = 11; y <= 20; y++) {
        const halfW = Math.round(2 + (y - 11) * 0.55);
        for (let x = 17 - halfW; x <= 17 + halfW; x++) {
          p.set(x, y, hash(x, y, 95) > 0.45 ? C.beaconGold : C.thrusterOrange);
        }
      }
      // Black RTG protruding left
      p.rect(5, 16, 7, 3, C.shadowNavy).rect(6, 16, 5, 1, C.lunarBasaltDark);
      p.set(22, 17, C.cyanLaser);
      break;
    }
  }
}

export function buildMachineCanvas(id: string, world: 'moon' | 'mars' | 'elsewhere'): HTMLCanvasElement {
  const p = new Painter(32, 32);
  const m = MACHINE_BY_ID[id] ?? (world === 'mars' ? 'msl' : world === 'elsewhere' ? 'voyager' : 'apollo-lm');
  drawMachine(m, p);
  // Keep the ground line exact: nothing below row 26 except the outline
  for (let x = 0; x < 32; x++) for (let y = 27; y < 32; y++) p.clear(x, y);
  p.outline();
  for (let x = 0; x < 32; x++) for (let y = 28; y < 32; y++) p.clear(x, y);
  return p.toCanvas();
}

// ---------------------------------------------------------------------------
// Top-down ground props
// ---------------------------------------------------------------------------

/**
 * Dithered impact crater seen from a 3/4 top-down angle (light from the upper
 * left): shadowed sunward inner wall, lit far wall, raised rim, ejecta specks.
 */
export function buildCraterCanvas(r: number, world: 'moon' | 'mars' | 'elsewhere', seed: number): HTMLCanvasElement {
  const ramp = world === 'mars' ? RAMPS.marsRock : RAMPS.moonRock;
  const rx = r;
  const ry = Math.round(r * 0.72);
  const pad = Math.ceil(r * 0.7) + 2;
  const W = rx * 2 + pad * 2;
  const H = ry * 2 + pad * 2;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);
  const cx = W / 2;
  const cy = H / 2;
  const rgb = ramp.map((h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - cx) / rx;
      const v = (y + 0.5 - cy) / ry;
      const wob = 1 + (hash(Math.floor(Math.atan2(v, u) * 6 + 20), 1, seed) - 0.5) * 0.08;
      const d = Math.sqrt(u * u + v * v) / wob;
      const diag = (u + v) / Math.SQRT2; // −1 upper-left … +1 lower-right
      let val: number;
      let alpha = 1;
      if (d <= 1) {
        // Bowl: sunward wall in shadow, far wall lit; flat-ish floor
        val = 0.34 + diag * 0.32 * Math.min(1, d * 1.4) - (1 - d) * 0.04;
      } else if (d <= 1.22) {
        // Raised rim: outer slope facing the light is bright
        const t = (d - 1) / 0.22;
        val = 0.56 - diag * 0.24 - t * 0.1;
        if (t > 0.55 && bayer(x, y) < (t - 0.55) * 2.2) alpha = 0;
      } else if (d <= 1.9) {
        // Sparse ejecta specks
        const t = (d - 1.22) / 0.68;
        if (hash(x, y, seed) > 0.9 + t * 0.08) {
          val = 0.6;
        } else {
          alpha = 0;
          val = 0;
        }
      } else {
        alpha = 0;
        val = 0;
      }
      if (!alpha) continue;
      const f = Math.max(0, Math.min(1, val)) * (rgb.length - 1);
      const i = Math.floor(f);
      const col = rgb[Math.min(rgb.length - 1, f - i > bayer(x, y) ? i + 1 : i)];
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

/** Small boulder with dithered shading, outline and a baked contact shadow. */
export function buildRockCanvas(size: number, world: 'moon' | 'mars' | 'elsewhere', seed: number): HTMLCanvasElement {
  const ramp = world === 'mars' ? RAMPS.marsRock : RAMPS.moonRock;
  const W = size + 6;
  const H = Math.round(size * 0.85) + 5;
  const p = new Painter(W, H);
  const cx = W / 2 - 1;
  const r = size / 2;
  const groundY = H - 3;
  // Contact shadow (lower-right)
  const shadow = world === 'mars' ? C.marsShadowUmber : C.deepIndigo;
  p.ellipse(cx + 2, groundY, r + 1, Math.max(1.2, r * 0.32), shadow);
  const shape = new Painter(W, H);
  const cyc = groundY - r * 0.7;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5 - cx) / r;
      const v = (y + 0.5 - cyc) / (r * 0.78);
      const ang = Math.atan2(v, u);
      const k = Math.floor(((ang + Math.PI) / (Math.PI * 2)) * 7);
      const rr = 0.78 + hash(k, 3, seed) * 0.26;
      const d = Math.sqrt(u * u + v * v);
      if (d > rr || y > groundY) continue;
      const val = 0.72 - (u + v) * 0.32 - d * 0.12 + (hash(x, y, seed) - 0.5) * 0.12;
      shape.set(x, y, dq(ramp, val, x, y));
    }
  }
  shape.outline(ramp[0]);
  const canvas = p.toCanvas();
  return shape.toCanvas(canvas);
}
