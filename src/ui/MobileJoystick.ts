/** AI-assisted touch control for directional input; gameplay stays in the scenes. */
export class MobileJoystick {
  x = 0;
  y = 0;
  private pointerId: number | null = null;

  constructor(private readonly pad: HTMLElement, private readonly thumb: HTMLElement) {
    pad.addEventListener('pointerdown', this.onDown);
    pad.addEventListener('pointermove', this.onMove);
    pad.addEventListener('pointerup', this.onEnd);
    pad.addEventListener('pointercancel', this.onEnd);
    pad.addEventListener('lostpointercapture', this.onEnd);
  }

  static fromPage(): MobileJoystick | null {
    const pad = document.getElementById('mobile-joystick');
    const thumb = pad?.querySelector<HTMLElement>('.mobile-joystick__thumb');
    return pad && thumb ? new MobileJoystick(pad, thumb) : null;
  }

  get active(): boolean {
    return this.pointerId !== null;
  }

  destroy(): void {
    if (this.pointerId !== null && this.pad.hasPointerCapture(this.pointerId)) {
      this.pad.releasePointerCapture(this.pointerId);
    }
    this.pad.removeEventListener('pointerdown', this.onDown);
    this.pad.removeEventListener('pointermove', this.onMove);
    this.pad.removeEventListener('pointerup', this.onEnd);
    this.pad.removeEventListener('pointercancel', this.onEnd);
    this.pad.removeEventListener('lostpointercapture', this.onEnd);
    this.reset();
  }

  private onDown = (event: PointerEvent): void => {
    event.stopPropagation();
    if (this.pointerId !== null) return;
    event.preventDefault();
    this.pointerId = event.pointerId;
    this.pad.setPointerCapture(event.pointerId);
    this.onMove(event);
  };

  private onMove = (event: PointerEvent): void => {
    event.stopPropagation();
    if (event.pointerId !== this.pointerId) return;
    const bounds = this.pad.getBoundingClientRect();
    const radius = Math.min(bounds.width, bounds.height) / 2;
    const dx = (event.clientX - bounds.left - bounds.width / 2) / radius;
    const dy = (event.clientY - bounds.top - bounds.height / 2) / radius;
    const length = Math.max(1, Math.hypot(dx, dy));
    this.x = Math.abs(dx / length) < 0.12 ? 0 : dx / length;
    this.y = Math.abs(dy / length) < 0.12 ? 0 : dy / length;
    this.thumb.style.left = `${50 + this.x * 25}%`;
    this.thumb.style.top = `${50 + this.y * 25}%`;
  };

  private onEnd = (event: PointerEvent): void => {
    event.stopPropagation();
    if (event.pointerId === this.pointerId) this.reset();
  };

  private reset(): void {
    this.pointerId = null;
    this.x = 0;
    this.y = 0;
    this.thumb.style.left = '50%';
    this.thumb.style.top = '50%';
  }
}

/** Keep an action pressed until its own pointer ends, even when another finger steers. */
export function bindHeldAction(button: HTMLElement, onDown: () => void, onUp: () => void): () => void {
  let pointerId: number | null = null;
  const down = (event: PointerEvent) => {
    if (pointerId !== null) return;
    event.preventDefault();
    pointerId = event.pointerId;
    button.setPointerCapture(event.pointerId);
    onDown();
  };
  const up = (event: PointerEvent) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    onUp();
  };
  button.addEventListener('pointerdown', down);
  button.addEventListener('pointerup', up);
  button.addEventListener('pointercancel', up);
  button.addEventListener('lostpointercapture', up);
  return () => {
    if (pointerId !== null) {
      const heldPointer = pointerId;
      pointerId = null;
      if (button.hasPointerCapture(heldPointer)) button.releasePointerCapture(heldPointer);
      onUp();
    }
    button.removeEventListener('pointerdown', down);
    button.removeEventListener('pointerup', up);
    button.removeEventListener('pointercancel', up);
    button.removeEventListener('lostpointercapture', up);
  };
}

/** Fire once on touch down; retain keyboard and screen-reader button activation. */
export function bindPressAction(button: HTMLElement, action: () => void): () => void {
  const down = (event: PointerEvent) => {
    event.preventDefault();
    action();
  };
  const click = (event: MouseEvent) => {
    if (event.detail === 0) action();
  };
  button.addEventListener('pointerdown', down);
  button.addEventListener('click', click);
  return () => {
    button.removeEventListener('pointerdown', down);
    button.removeEventListener('click', click);
  };
}
