import Phaser from 'phaser';
import { PALETTE } from './theme.ts';

export interface HUDGauges {
  container: Phaser.GameObjects.Container;
  updateFuel: (current: number, max: number) => void;
  updateVelocity: (vx: number, vy: number, safeVx: number, safeVy: number) => void;
  updateAltitude: (alt: number) => void;
  setStatus: (status: string) => void;
}

export type FrameVariant = 'panel' | 'primary' | 'secondary' | 'ghost' | 'amber' | 'muted';

/** Shared pixel font + spacing used by every in-canvas label (matches the title screen). */
export const HUD_FONT = 'StillOutTherePixel, monospace';

/** Touch screens (phones, tablets): the canvas is shown small, so HUD text is drawn larger. */
export const TOUCH_UI = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

/**
 * HUD font size: as designed on desktop, larger on touch screens. The pixel font
 * draws "C" like "O" at 10-11px, so touch sizes skip those (7 -> 9, 9 -> 12).
 */
export function hudPx(px: number): string {
  if (!TOUCH_UI) return `${px}px`;
  const up = px <= 8 ? 9 : Math.max(12, px + 3);
  return `${up}px`;
}

/** Steps a label's font size down (not below minPx) until it fits maxW, then truncates as a last resort. */
export function shrinkToFit(t: Phaser.GameObjects.Text, maxW: number, minPx = 7): Phaser.GameObjects.Text {
  let px = parseInt(String(t.style.fontSize), 10) || minPx;
  while (t.width > maxW && px > minPx) {
    px--;
    if (px === 11 || px === 10) px = Math.max(minPx, 9); // pixel font: C reads as O at 10-11px
    t.setFontSize(px);
  }
  return fitText(t, maxW);
}

/** Truncate a single-line HUD text with an ellipsis until it fits within maxW pixels. */
export function fitText(t: Phaser.GameObjects.Text, maxW: number): Phaser.GameObjects.Text {
  const full = t.text;
  let n = full.length;
  while (t.width > maxW && n > 4) {
    n--;
    t.setText(full.slice(0, n).trimEnd() + '…');
  }
  return t;
}

export class NineSliceHUD {
  /**
   * Draws a crisp title-screen style frame: dark translucent fill, 1px hairline
   * border built from filled rects (no anti-aliased strokes), square corners and
   * a soft drop shadow. Every in-canvas panel and button goes through here so the
   * whole game shares one look.
   */
  static drawFrame(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    variant: FrameVariant = 'panel'
  ): void {
    x = Math.round(x);
    y = Math.round(y);
    w = Math.round(w);
    h = Math.round(h);

    let fill: number = PALETTE.deepIndigoHex;
    let fillAlpha = 0.9;
    let border: number = PALETTE.cyanGlowHex;
    let borderAlpha = 0.9;
    let shadow = true;

    switch (variant) {
      case 'primary':
        fill = PALETTE.cyanGlowHex;
        fillAlpha = 1;
        border = PALETTE.cyanGlowHex;
        borderAlpha = 1;
        break;
      case 'secondary':
        fill = PALETTE.spaceBlackHex;
        fillAlpha = 0.75;
        border = PALETTE.atmosphericDuskHex;
        borderAlpha = 1;
        shadow = false;
        break;
      case 'ghost':
        fill = PALETTE.spaceBlackHex;
        fillAlpha = 0.45;
        border = PALETTE.shadowNavyHex;
        borderAlpha = 1;
        shadow = false;
        break;
      case 'amber':
        border = PALETTE.beaconGoldHex;
        borderAlpha = 0.85;
        break;
      case 'muted':
        border = PALETTE.atmosphericDuskHex;
        borderAlpha = 1;
        break;
      default:
        break;
    }

    if (shadow) {
      g.fillStyle(PALETTE.spaceBlackHex, 0.35);
      g.fillRect(x - 1, y + 2, w + 2, h + 2);
      g.fillStyle(PALETTE.spaceBlackHex, 0.25);
      g.fillRect(x - 2, y + 4, w + 4, h + 2);
    }

    g.fillStyle(fill, fillAlpha);
    g.fillRect(x, y, w, h);

    g.fillStyle(border, borderAlpha);
    g.fillRect(x, y, w, 1);
    g.fillRect(x, y + h - 1, w, 1);
    g.fillRect(x, y + 1, 1, h - 2);
    g.fillRect(x + w - 1, y + 1, 1, h - 2);
  }

  /** Small glowing status dot used before labels (title screen "EXPEDITION ACTIVE" dot). */
  static drawStatusDot(g: Phaser.GameObjects.Graphics, x: number, y: number, color: number = PALETTE.cyanGlowHex): void {
    g.fillStyle(color, 0.25);
    g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 4, 4);
    g.fillStyle(color, 1);
    g.fillRect(Math.round(x), Math.round(y), 2, 2);
  }

  /**
   * Creates a title-screen styled panel container with an optional header row
   */
  static createPanel(
    scene: Phaser.Scene,
    x: number,
    y: number,
    width: number,
    height: number,
    title?: string
  ): Phaser.GameObjects.Container {
    const container = scene.add.container(x, y).setScrollFactor(0).setDepth(100);

    const bg = scene.add.graphics();
    this.drawFrame(bg, 0, 0, width, height, 'panel');

    if (title) {
      this.drawStatusDot(bg, 7, 7);
      // Hairline divider under the header (title screen footer rule)
      bg.fillStyle(PALETTE.atmosphericDuskHex, 1);
      bg.fillRect(6, 16, width - 12, 1);
    }
    container.add(bg);

    if (title) {
      const titleText = scene.add.text(13, 4, title, {
        fontSize: '7px',
        fontFamily: HUD_FONT,
        color: PALETTE.cyanLaser,
        letterSpacing: 2,
      });
      container.add(titleText);
    }

    return container;
  }

  /**
   * Jetpack landing telemetry: a slim top-centre strip (keeps the spawn area,
   * the pad and the flight path clear).
   */
  static createLandingHUD(
    scene: Phaser.Scene,
    siteId: string,
    _world: 'moon' | 'mars' | 'elsewhere',
    maxFuel: number
  ): HUDGauges {
    // Phones get a wider, taller strip so the readouts can use a bigger font
    const big = TOUCH_UI;
    const panelW = big ? 388 : 300;
    const panelH = big ? 41 : 31;
    const fs = big ? 9 : 7;
    const row2 = big ? 25 : 19;
    const container = scene.add.container(Math.round((640 - panelW) / 2), 6).setScrollFactor(0).setDepth(100);

    const bg = scene.add.graphics();
    this.drawFrame(bg, 0, 0, panelW, panelH, 'panel');
    this.drawStatusDot(bg, 7, big ? 8 : 6);
    bg.fillStyle(PALETTE.atmosphericDuskHex, 1);
    bg.fillRect(6, big ? 20 : 15, panelW - 12, 1);
    container.add(bg);

    const txt = (x: number, y: number, t: string, color: string) =>
      scene.add.text(x, y, t, { fontSize: `${fs}px`, fontFamily: HUD_FONT, color, letterSpacing: 1 });

    const X = big
      ? { site: 252, alt: 274, vy: 8, vyV: 30, vx: 108, vxV: 130, fuel: 208, bar: 246 }
      : { site: 194, alt: 214, vy: 8, vyV: 24, vx: 84, vxV: 100, fuel: 164, bar: 192 };
    const site = txt(13, big ? 5 : 3, siteId.toUpperCase(), PALETTE.cyanLaser);
    site.setLetterSpacing(2);
    fitText(site, X.site);
    const altLabel = txt(X.alt, big ? 5 : 3, 'ALT', PALETTE.slateMuted);
    const altValue = txt(panelW - 8, big ? 5 : 3, '0.0M', PALETTE.lunarHighlight).setOrigin(1, 0);
    const vyLabel = txt(X.vy, row2, 'VY', PALETTE.slateMuted);
    const vyValue = txt(X.vyV, row2, '0.00', PALETTE.cyanGlow);
    const vxLabel = txt(X.vx, row2, 'VX', PALETTE.slateMuted);
    const vxValue = txt(X.vxV, row2, '0.00', PALETTE.cyanGlow);
    const fuelLabel = txt(X.fuel, row2, 'FUEL', PALETTE.slateMuted);
    const fuelGfx = scene.add.graphics();
    container.add([site, altLabel, altValue, vyLabel, vyValue, vxLabel, vxValue, fuelLabel, fuelGfx]);

    const barX = X.bar;
    const barY = row2 + (big ? 1 : 0);
    const barW = panelW - barX - 8;
    const barH = 8;
    const drawFuelBar = (current: number, max: number) => {
      fuelGfx.clear();
      const ratio = Phaser.Math.Clamp(current / max, 0, 1);
      this.drawFrame(fuelGfx, barX, barY, barW, barH, 'secondary');
      const numSegments = 12;
      const filled = Math.ceil(ratio * numSegments - 0.001);
      const segW = (barW - 2) / numSegments;
      for (let i = 0; i < filled; i++) {
        let c: number = PALETTE.cyanGlowHex;
        if (ratio < 0.25) c = PALETTE.thrusterOrangeHex;
        else if (ratio < 0.5) c = PALETTE.beaconGoldHex;
        fuelGfx.fillStyle(c, 1);
        fuelGfx.fillRect(Math.round(barX + 1 + i * segW), barY + 2, Math.max(1, Math.round(segW) - 1), barH - 4);
      }
    };

    const drawVelocity = (vx: number, vy: number, safeVx: number, safeVy: number) => {
      vyValue.setText(`${vy.toFixed(2)}/${safeVy.toFixed(1)}`);
      vyValue.setColor(Math.abs(vy) <= safeVy ? PALETTE.cyanGlow : PALETTE.thrusterOrange);
      vxValue.setText(`${vx.toFixed(2)}/${safeVx.toFixed(1)}`);
      vxValue.setColor(Math.abs(vx) <= safeVx ? PALETTE.cyanGlow : PALETTE.thrusterOrange);
    };

    drawFuelBar(maxFuel, maxFuel);

    return {
      container,
      updateFuel: (current: number, max: number) => drawFuelBar(current, max),
      updateVelocity: (vx: number, vy: number, safeVx: number, safeVy: number) => drawVelocity(vx, vy, safeVx, safeVy),
      updateAltitude: (alt: number) => {
        altValue.setText(`${Math.max(0, alt).toFixed(1)}M`);
      },
      setStatus: (_status: string) => {},
    };
  }
}
