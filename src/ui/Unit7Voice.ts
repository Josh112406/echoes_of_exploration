import Phaser from 'phaser';
import { PALETTE } from './theme.ts';
import { NineSliceHUD, HUD_FONT } from './NineSliceHUD.ts';
import { TalkClock } from './Talk.ts';
import { GameState } from '../core/GameState.ts';
import { VoiceLine, sourceHost } from '../data/story.ts';

const PANEL_W = 300;
const TEXT_W = 244;

/**
 * UNIT-7's voice: a HUD panel (bottom-left) that types out the robot's thoughts
 * (cyan "GAME STORY") or sourced facts (amber "VERIFIED RECORD"), mirrored to an
 * aria-live region for screen readers.
 */
export class Unit7Voice {
  private scene: Phaser.Scene;
  readonly container: Phaser.GameObjects.Container;
  private frame: Phaser.GameObjects.Graphics;
  private portrait: Phaser.GameObjects.Image;
  private nameText: Phaser.GameObjects.Text;
  private tagText: Phaser.GameObjects.Text;
  private body: Phaser.GameObjects.Text;
  private hint: Phaser.GameObjects.Text;
  private zone: Phaser.GameObjects.Zone;
  private live: HTMLElement | null = null;

  private queue: VoiceLine[] = [];
  private current: VoiceLine | null = null;
  private talk = new TalkClock();
  private hold = 0;
  private hiding = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const H = scene.scale.gameSize.height;
    this.container = scene.add.container(12, H - 12).setScrollFactor(0).setDepth(120).setVisible(false);

    this.frame = scene.add.graphics();
    this.portrait = scene.add.image(0, 0, 'robot_idle').setOrigin(0.5, 0.5);
    this.nameText = scene.add.text(42, 0, 'UNIT-7', { fontSize: '7px', fontFamily: HUD_FONT, color: PALETTE.cyanLaser, letterSpacing: 2 });
    this.tagText = scene.add.text(PANEL_W - 8, 0, '', { fontSize: '7px', fontFamily: HUD_FONT, color: PALETTE.cyanGlow, letterSpacing: 1 }).setOrigin(1, 0);
    this.body = scene.add.text(42, 0, '', {
      fontSize: '7px',
      fontFamily: HUD_FONT,
      color: PALETTE.lunarHighlight,
      lineSpacing: 3,
      wordWrap: { width: TEXT_W, useAdvancedWrap: true },
    });
    this.hint = scene.add.text(PANEL_W - 8, 0, '[SPACE]', { fontSize: '7px', fontFamily: HUD_FONT, color: PALETTE.slateMuted, letterSpacing: 1 }).setOrigin(1, 1);
    this.zone = scene.add.zone(0, 0, PANEL_W, 40).setOrigin(0, 0).setInteractive({ cursor: 'pointer' });
    this.zone.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.advance();
    });
    this.container.add([this.frame, this.portrait, this.nameText, this.tagText, this.body, this.hint, this.zone]);

    // Screen-reader mirror
    this.live = document.getElementById('unit7-live');
    if (!this.live) {
      this.live = document.createElement('div');
      this.live.id = 'unit7-live';
      this.live.setAttribute('aria-live', 'polite');
      this.live.setAttribute('role', 'status');
      this.live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
      document.body.appendChild(this.live);
    }
  }

  /** Queue a line (at most two waiting, so the robot never rambles). */
  say(line: VoiceLine): void {
    if (this.current?.key === line.key || this.queue.some((q) => q.key === line.key)) return;
    if (this.queue.length >= 2) this.queue.shift();
    this.queue.push(line);
    if (!this.current) this.next();
  }

  /** Queue a short sequence in order (bypasses the two-line backlog cap). */
  sayAll(lines: VoiceLine[]): void {
    for (const line of lines) {
      if (this.current?.key === line.key || this.queue.some((q) => q.key === line.key)) continue;
      this.queue.push(line);
    }
    if (!this.current) this.next();
  }

  /** True while a line is showing or queued. */
  get busy(): boolean {
    return !!this.current || this.queue.length > 0;
  }

  /** True while UNIT-7 is still typing out the current line. */
  get talking(): boolean {
    return !!this.current && !this.talk.done;
  }

  /**
   * SPACE / Q / click. While UNIT-7 is typing, the first press completes the
   * current line immediately; pressing again dismisses it.
   * Returns true when a line is on screen, so callers do not start another.
   */
  advance(): boolean {
    if (!this.current) return false;
    if (this.hiding) return true;
    if (this.talking) {
      this.talk.finish();
      this.body.setText(this.talk.visible);
      this.hold = this.holdTime(this.current.text);
      this.hint.setText('[SPACE]').setAlpha(1);
      return true;
    }
    this.hide();
    return true;
  }

  update(dt: number): void {
    if (!this.current || this.hiding) return;
    if (!this.talk.done) {
      if (this.talk.tick(dt)) this.body.setText(this.talk.visible);
      if (this.talk.done) this.hold = this.holdTime(this.current.text);
      this.hint.setText('[SPACE] SKIP').setAlpha(Math.floor(this.scene.time.now / 300) % 2 ? 0.7 : 0.3);
    } else {
      this.hold -= dt;
      this.hint.setText('[SPACE]').setAlpha(Math.floor(this.scene.time.now / 450) % 2 ? 1 : 0.35);
      if (this.hold <= 0) this.hide();
    }
  }

  private holdTime(text: string): number {
    return Math.max(4.5, text.split(/\s+/).length * 0.34);
  }

  private next(): void {
    const line = this.queue.shift();
    if (!line) {
      this.current = null;
      this.container.setVisible(false);
      return;
    }
    this.current = line;
    this.hiding = false;
    const reduced = GameState.getState().settings.reducedMotion;
    this.talk.start(line.text, { instant: reduced, record: line.kind === 'record' });
    this.layout(line);
    this.body.setText(reduced ? line.text : '');
    if (reduced) this.hold = this.holdTime(line.text);
    if (this.live) {
      const prefix = line.kind === 'record' ? `Verified record, ${line.title ?? 'NASA'}: ` : 'UNIT-7: ';
      this.live.textContent = prefix + line.text;
    }
    this.scene.tweens.killTweensOf(this.container);
    this.container.setVisible(true).setAlpha(reduced ? 1 : 0);
    if (!reduced) this.scene.tweens.add({ targets: this.container, alpha: 1, duration: 180 });
  }

  private hide(): void {
    if (this.hiding) return;
    this.hiding = true;
    const done = () => {
      this.hiding = false;
      this.current = null;
      this.next();
    };
    if (GameState.getState().settings.reducedMotion) {
      done();
      return;
    }
    this.scene.tweens.add({ targets: this.container, alpha: 0, duration: 200, onComplete: done });
  }

  private layout(line: VoiceLine): void {
    const record = line.kind === 'record';
    // Measure the wrapped body to size the panel
    this.body.setText(line.text);
    const textH = Math.ceil(this.body.height);
    const h = Math.max(40, 24 + textH + 10);
    const top = -h;

    this.frame.clear();
    NineSliceHUD.drawFrame(this.frame, 0, top, PANEL_W, h, record ? 'amber' : 'panel');
    // Portrait well
    NineSliceHUD.drawFrame(this.frame, 6, top + 6, 30, 30, 'secondary');
    this.frame.fillStyle(PALETTE.atmosphericDuskHex, 1).fillRect(42, top + 16, PANEL_W - 50, 1);

    this.portrait.setPosition(21, top + 21);
    this.nameText.setY(top + 6);
    const tag = record ? `VERIFIED RECORD${sourceHost(line.sourceUrl) ? ' · ' + sourceHost(line.sourceUrl).toUpperCase() : ''}` : `GAME STORY${line.title ? ' · ' + line.title.toUpperCase() : ''}`;
    this.tagText.setText(tag).setY(top + 6).setColor(record ? PALETTE.beaconGold : PALETTE.cyanGlow);
    this.nameText.setColor(record ? PALETTE.beaconGold : PALETTE.cyanLaser);
    this.body.setY(top + 21).setColor(record ? PALETTE.lunarCrustCream : PALETTE.lunarHighlight);
    this.hint.setY(-3);
    this.zone.setPosition(0, top).setSize(PANEL_W, h);
  }
}
