import Phaser from 'phaser';
import { CONSTANTS } from '../core/Constants.ts';
import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { PALETTE } from '../ui/theme.ts';
import { NineSliceHUD, HUD_FONT, FrameVariant, fitText, hudPx, shrinkToFit } from '../ui/NineSliceHUD.ts';
import { ALL_ENTRIES } from '../data/entries.ts';
import { Practice } from './Practice.ts';
import { fieldTaskForEntry } from '../data/fieldTasks.ts';

/** The name a minigame shows: the echo's name, or the catalog mission's during a practice run. */
export function missionName(siteId: string): string {
  return Practice.run?.name ?? ALL_ENTRIES[siteId]?.name ?? siteId;
}

/** Leave a minigame: a practice run goes back to the Mission Catalog, a real one to the site. */
export function leaveMinigame(scene: Phaser.Scene, practiceResult?: 'complete' | 'failed' | 'exited'): void {
  const run = Practice.run;
  Practice.end();
  scene.scene.start('SiteScene');
  if (run) EventBus.emit(EVENTS.OPEN_ARCHIVE, { tab: 'catalog', practice: { name: run.name, result: practiceResult ?? 'exited' } });
}

/**
 * Shared building blocks for the four skill minigames (Rover, Laser, Rotor,
 * Flyby): pooled pixel particles, segmented gauges, HUD labels and buttons, the
 * pre-mission briefing card and the win / fail hand-off back to the site.
 * Every scene still owns its own 60 Hz fixed-step physics.
 */

export const MG_W = CONSTANTS.CANVAS.WIDTH;
export const MG_H = CONSTANTS.CANVAS.HEIGHT;

/** Canvas units needed for a 44px touch target at the current display scale. */
export function minTouchTarget(scene: Phaser.Scene): number {
  return Math.ceil(44 * MG_W / scene.scale.displaySize.width);
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: number;
  size: number;
  drag: number;
  gravity: number;
  /** Additive glow particles are drawn with a soft 3×3 halo. */
  glow?: boolean;
}

/** Cheap pooled particle layer drawn into one Graphics object. */
export class Particles {
  readonly gfx: Phaser.GameObjects.Graphics;
  private list: Particle[] = [];
  private readonly cap: number;

  constructor(scene: Phaser.Scene, depth: number, cap = 420) {
    this.gfx = scene.add.graphics().setDepth(depth);
    this.cap = cap;
  }

  emit(p: Partial<Particle> & { x: number; y: number }): void {
    if (this.list.length >= this.cap) this.list.shift();
    const life = p.life ?? 0.6;
    this.list.push({
      vx: 0, vy: 0, color: PALETTE.lunarCrustCreamHex, size: 1, drag: 1.5, gravity: 0,
      ...p,
      life,
      maxLife: p.maxLife ?? life,
    });
  }

  burst(n: number, base: Partial<Particle> & { x: number; y: number }, speed: number, spread = Math.PI * 2, angle = 0): void {
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.emit({ ...base, vx: Math.cos(a) * s + (base.vx ?? 0), vy: Math.sin(a) * s + (base.vy ?? 0), life: (base.life ?? 0.6) * (0.6 + Math.random() * 0.6) });
    }
  }

  update(dt: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.list.splice(i, 1);
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k;
      p.vy = p.vy * k + p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  draw(): void {
    const g = this.gfx;
    g.clear();
    for (const p of this.list) {
      const t = p.life / p.maxLife;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (p.glow) {
        g.fillStyle(p.color, t * 0.25).fillRect(x - 1, y - 1, p.size + 2, p.size + 2);
      }
      g.fillStyle(p.color, Math.min(1, t * 1.3)).fillRect(x, y, p.size, p.size);
    }
  }

  clear(): void {
    this.list = [];
    this.gfx.clear();
  }
}

/** Segmented gauge (style guide: discrete cells, no smooth bars). */
export function drawSegBar(
  g: Phaser.GameObjects.Graphics,
  x: number, y: number, w: number, h: number,
  frac: number, color: number,
  opts: { segments?: number; warnBelow?: number; warnColor?: number; vertical?: boolean } = {},
): void {
  const segs = opts.segments ?? 10;
  const f = Phaser.Math.Clamp(frac, 0, 1);
  const col = opts.warnBelow !== undefined && f < opts.warnBelow ? (opts.warnColor ?? PALETTE.thrusterOrangeHex) : color;
  g.fillStyle(PALETTE.spaceBlackHex, 0.8).fillRect(x, y, w, h);
  g.fillStyle(PALETTE.atmosphericDuskHex, 1);
  g.fillRect(x, y, w, 1).fillRect(x, y + h - 1, w, 1).fillRect(x, y, 1, h).fillRect(x + w - 1, y, 1, h);
  const lit = Math.ceil(f * segs - 1e-6);
  for (let i = 0; i < segs; i++) {
    if (opts.vertical) {
      const sh = (h - 2 - (segs - 1)) / segs;
      const sy = y + h - 1 - (i + 1) * sh - i;
      g.fillStyle(i < lit ? col : PALETTE.shadowNavyHex, i < lit ? 1 : 0.9).fillRect(x + 2, Math.round(sy), w - 4, Math.max(1, Math.round(sh)));
    } else {
      const sw = (w - 2 - (segs - 1)) / segs;
      const sx = x + 1 + i * (sw + 1);
      g.fillStyle(i < lit ? col : PALETTE.shadowNavyHex, i < lit ? 1 : 0.9).fillRect(Math.round(sx), y + 2, Math.max(1, Math.round(sw)), h - 4);
    }
  }
}

/** Row of square pips (hull, cores, gates, frames). */
export function drawPips(g: Phaser.GameObjects.Graphics, x: number, y: number, n: number, filled: number, color: number, size = 6, gap = 3): void {
  for (let i = 0; i < n; i++) {
    const px = x + i * (size + gap);
    if (i < filled) {
      g.fillStyle(color, 0.25).fillRect(px - 1, y - 1, size + 2, size + 2);
      g.fillStyle(color, 1).fillRect(px, y, size, size);
    } else {
      g.fillStyle(PALETTE.shadowNavyHex, 1).fillRect(px, y, size, size);
      g.fillStyle(PALETTE.atmosphericDuskHex, 1).fillRect(px, y, size, 1).fillRect(px, y, 1, size);
    }
  }
}

export function hudText(scene: Phaser.Scene, x: number, y: number, text: string, color: string = PALETTE.lunarHighlight, size = 7): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text, { fontFamily: HUD_FONT, fontSize: `${size}px`, color, letterSpacing: 1 }).setDepth(101).setScrollFactor(0);
}

export { fitText };

/**
 * Fits a centered header or subtitle inside maxW: eases wide tracking first, then
 * wraps across lines so long mission names stay readable inside fixed panels.
 */
export function fitHeaderText(t: Phaser.GameObjects.Text, maxW: number): Phaser.GameObjects.Text {
  if (t.width > maxW) t.setLetterSpacing(1);
  if (t.width > maxW) {
    t.setLineSpacing(3);
    t.setWordWrapWidth(maxW, true);
  }
  return fitText(t, maxW);
}

export interface TouchButton {
  zone: Phaser.GameObjects.Zone;
  label: Phaser.GameObjects.Text;
}

/** Held touch button (48px-friendly hit area on phones once the canvas is scaled). */
export function touchButton(
  scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string,
  variant: FrameVariant, onDown: () => void, onUp: () => void = () => {},
): TouchButton {
  const bg = scene.add.graphics().setDepth(100).setScrollFactor(0);
  NineSliceHUD.drawFrame(bg, x, y, w, h, variant);
  const hit = minTouchTarget(scene);
  const hitH = Math.max(h, hit);
  const zone = scene.add.zone(x + w / 2, Phaser.Math.Clamp(y + h / 2, hitH / 2, MG_H - hitH / 2), Math.max(w, hit), hitH)
    .setDepth(101).setScrollFactor(0).setInteractive({ cursor: 'pointer' });
  zone.on('pointerdown', onDown);
  zone.on('pointerup', onUp);
  zone.on('pointerout', onUp);
  zone.on('pointercancel', onUp);
  const text = shrinkToFit(scene.add.text(x + w / 2, y + h / 2, label, {
    fontFamily: HUD_FONT, fontSize: hudPx(7), letterSpacing: 1,
    color: variant === 'primary' ? PALETTE.spaceBlack : PALETTE.lunarCrustCream,
  }).setOrigin(0.5).setDepth(102).setScrollFactor(0), w - 6);
  return { zone, label: text };
}

/** Top-right "SURFACE MAP" exit back to exploration. */
export function exitButton(scene: Phaser.Scene, label: string, onExit: () => void): void {
  const W = MG_W;
  const bg = scene.add.graphics().setDepth(100).setScrollFactor(0);
  NineSliceHUD.drawFrame(bg, W - 98, 8, 86, 22, 'secondary');
  const hit = minTouchTarget(scene);
  const zone = scene.add.zone(W - 55, Math.max(19, hit / 2), Math.max(86, hit), Math.max(22, hit))
    .setDepth(101).setScrollFactor(0).setInteractive({ cursor: 'pointer' });
  const txt = shrinkToFit(scene.add.text(W - 55, 19, label, { fontFamily: HUD_FONT, fontSize: hudPx(7), color: PALETTE.lunarHighlight, letterSpacing: 1 })
    .setOrigin(0.5).setDepth(102).setScrollFactor(0), 80);
  zone.on('pointerdown', () => {
    SoundFX.playClick();
    if (Practice.run) leaveMinigame(scene, 'exited');
    else onExit();
  });
  zone.on('pointerover', () => txt.setColor(PALETTE.cyanLaser));
  zone.on('pointerout', () => txt.setColor(PALETTE.lunarHighlight));
}

/** Centred toast that pops in, holds and fades (combo calls, warnings, rewards). */
export class Banner {
  private text: Phaser.GameObjects.Text;
  private scene: Phaser.Scene;
  private reduced: boolean;

  constructor(scene: Phaser.Scene, y: number, reduced: boolean) {
    this.scene = scene;
    this.reduced = reduced;
    this.text = scene.add.text(MG_W / 2, y, '', { fontFamily: HUD_FONT, fontSize: hudPx(9), color: PALETTE.cyanLaser, letterSpacing: 2 })
      .setOrigin(0.5).setDepth(140).setScrollFactor(0).setAlpha(0)
      .setShadow(0, 1, PALETTE.spaceBlack, 0, false, true);
  }

  show(msg: string, color: string = PALETTE.cyanLaser, hold = 900): void {
    const t = this.text;
    this.scene.tweens.killTweensOf(t);
    t.setText(msg).setColor(color).setAlpha(1).setScale(this.reduced ? 1 : 1.25);
    if (!this.reduced) this.scene.tweens.add({ targets: t, scale: 1, duration: 160, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: t, alpha: 0, delay: hold, duration: 380 });
  }
}

export interface BriefingSpec {
  title: string;
  subtitle: string;
  lines: string[];
  cta: string;
}

/**
 * Pre-mission briefing card. The sim waits (paused) until the player engages
 * with SPACE / ENTER / click, so nobody starts mid-hazard.
 */
export function showBriefing(scene: Phaser.Scene, spec: BriefingSpec, onStart: () => void): void {
  const W = MG_W;
  const H = MG_H;
  const run = Practice.run;
  const lines = run
    ? [...spec.lines, '• PRACTICE RUN: NO ECHO IS RECOVERED.', `• TRUE STORY: ${run.note.toUpperCase()}`]
    : spec.lines;
  if (window.matchMedia('(pointer: coarse)').matches) {
    const overlay = document.createElement('div');
    overlay.className = 'mobile-briefing';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', spec.title);
    const card = document.createElement('div');
    card.className = 'mobile-briefing__card';
    const heading = document.createElement('h2');
    heading.textContent = run ? `PRACTICE RUN // ${run.name.toUpperCase()}` : spec.title;
    const subtitle = document.createElement('p');
    subtitle.className = 'mobile-briefing__subtitle';
    subtitle.textContent = spec.subtitle;
    const body = document.createElement('div');
    body.className = 'mobile-briefing__body';
    for (const line of lines) {
      const p = document.createElement('p');
      p.textContent = line;
      body.appendChild(p);
    }
    const button = document.createElement('button');
    button.className = 'btn btn--primary';
    button.textContent = spec.cta;
    let done = false;
    const start = () => {
      if (done) return;
      done = true;
      overlay.remove();
      scene.input.keyboard?.off('keydown-SPACE', start);
      scene.input.keyboard?.off('keydown-ENTER', start);
      SoundFX.playClick();
      onStart();
    };
    button.addEventListener('click', start);
    card.append(heading, subtitle, body, button);
    overlay.appendChild(card);
    document.getElementById('game-stage')?.appendChild(overlay);
    scene.time.delayedCall(150, () => {
      if (done) return;
      scene.input.keyboard?.on('keydown-SPACE', start);
      scene.input.keyboard?.on('keydown-ENTER', start);
    });
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      done = true;
      overlay.remove();
      scene.input.keyboard?.off('keydown-SPACE', start);
      scene.input.keyboard?.off('keydown-ENTER', start);
    });
    return;
  }
  const c = scene.add.container(W / 2, H / 2).setDepth(150).setScrollFactor(0);
  const title = run ? `PRACTICE RUN // ${run.name.toUpperCase()}` : spec.title;
  const titleText = fitHeaderText(scene.add.text(0, 0, title, {
    fontFamily: HUD_FONT, fontSize: '9px', color: PALETTE.lunarHighlight, letterSpacing: 3, align: 'center',
  }).setOrigin(0.5, 0), 328);
  const subText = fitHeaderText(scene.add.text(0, 0, spec.subtitle, {
    fontFamily: HUD_FONT, fontSize: '7px', color: PALETTE.beaconGold, letterSpacing: 2, align: 'center',
  }).setOrigin(0.5, 0), 328);
  // Lines are laid out by their wrapped height, so long notes never overlap
  const texts = lines.map((line) => scene.add.text(-164, 0, line, {
    fontFamily: HUD_FONT, fontSize: '7px', color: line.startsWith('• TRUE STORY') ? PALETTE.cyanLaser : PALETTE.lunarCrustCream,
    wordWrap: { width: 328, useAdvancedWrap: true },
  }));
  const yTitle = 10;
  const ySub = yTitle + titleText.height + 5;
  const yDiv = ySub + subText.height + 7;
  const yBody = yDiv + 10;
  const body = texts.reduce((sum, t) => sum + Math.max(15, t.height + 5), 0);
  const hgt = Math.min(H - 16, yBody + body + 51);
  const top = Math.round(-hgt / 2);
  const bg = scene.add.graphics();
  NineSliceHUD.drawFrame(bg, -180, top, 360, hgt, 'panel');
  bg.fillStyle(PALETTE.atmosphericDuskHex, 1).fillRect(-168, top + yDiv, 336, 1);
  c.add(bg);
  titleText.setY(top + yTitle);
  subText.setY(top + ySub);
  c.add([titleText, subText]);
  let ly = top + yBody;
  for (const t of texts) {
    t.setY(ly);
    c.add(t);
    ly += Math.max(15, t.height + 5);
  }
  const by = top + hgt - 36;
  const btn = scene.add.graphics();
  NineSliceHUD.drawFrame(btn, -110, by, 220, 22, 'primary');
  c.add(btn);
  c.add(fitText(scene.add.text(0, by + 11, spec.cta, { fontFamily: HUD_FONT, fontSize: '8px', color: PALETTE.spaceBlack, letterSpacing: 3 }).setOrigin(0.5), 204));
  const zone = scene.add.zone(0, by + 11, 220, Math.max(22, minTouchTarget(scene))).setInteractive({ cursor: 'pointer' });
  c.add(zone);

  let done = false;
  const kb = scene.input.keyboard;
  const start = () => {
    if (done) return;
    done = true;
    kb?.off('keydown-SPACE', start);
    kb?.off('keydown-ENTER', start);
    SoundFX.playClick();
    c.destroy();
    onStart();
  };
  zone.on('pointerdown', start);
  // Defer so the key press that opened the scene does not also start it
  scene.time.delayedCall(150, () => {
    if (done) return;
    kb?.on('keydown-SPACE', start);
    kb?.on('keydown-ENTER', start);
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    kb?.off('keydown-SPACE', start);
    kb?.off('keydown-ENTER', start);
  });
}

/** Unlock the echo, return to the site and open its briefing. */
export function completeMinigame(scene: Phaser.Scene, siteId: string, assisted: boolean, scoreA: number | null, scoreB: number | null, delay = 1400): void {
  if (Practice.run) {
    scene.time.delayedCall(delay, () => leaveMinigame(scene, 'complete'));
    return;
  }
  GameState.unlockEntry(siteId, assisted, scoreA, scoreB);
  EventBus.emit(EVENTS.LANDING_COMPLETE, siteId);
  scene.time.delayedCall(delay, () => {
    scene.scene.start('SiteScene', { siteId });
    // Some echoes have a field task (the encounter's evidence step) before their record opens
    const task = fieldTaskForEntry(siteId);
    if (task) EventBus.emit(EVENTS.OPEN_FIELD_TASK, task.id, () => EventBus.emit(EVENTS.OPEN_ENTRY, siteId));
    else EventBus.emit(EVENTS.OPEN_ENTRY, siteId);
  });
}

/** Count the failure and open the retry / assist dialog. */
export function failMinigame(scene: Phaser.Scene, siteId: string, delay = 1100): void {
  if (Practice.run) {
    // Practice: no failure count or assist offer; just run it again
    const key = scene.scene.key;
    scene.time.delayedCall(delay, () => scene.scene.start(key, { siteId, assisted: false }));
    return;
  }
  const fails = GameState.recordFailure(siteId);
  scene.time.delayedCall(delay, () => {
    EventBus.emit(EVENTS.LANDING_FAILED, { siteId, attempts: fails });
  });
}

/** Smooth 1-D value noise in [-1, 1] (turbulence, gusts). */
export function smoothNoise(t: number, seed: number): number {
  const i = Math.floor(t);
  const f = t - i;
  const r = (n: number) => {
    const s = Math.sin((n + seed * 101.3) * 127.1) * 43758.5453;
    return (s - Math.floor(s)) * 2 - 1;
  };
  const u = f * f * (3 - 2 * f);
  return r(i) * (1 - u) + r(i + 1) * u;
}
