/**
 * Device fit (AI-assisted, human-reviewed): fullscreen and the "turn your phone
 * sideways" screen.
 *
 * The game is a 16:9 picture. On a phone held upright it would be a thin strip
 * with tiny text, so phones in portrait get a short prompt to rotate (the game
 * pauses meanwhile). Players who cannot rotate (rotation lock, accessibility)
 * can carry on upright; that choice is remembered for the visit.
 *
 * Fullscreen is only offered where the browser really supports it (Android,
 * iPad, desktop). iPhone Safari has no fullscreen for web pages, so the button
 * never appears there and nothing can break.
 */
import Phaser from 'phaser';
import { PixelArtGenerator } from '../systems/PixelArtGenerator.ts';
import { AudioCore } from '../audio/AudioCore.ts';

type FsDocument = Document & {
  webkitFullscreenEnabled?: boolean;
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type LockableOrientation = ScreenOrientation & { lock?: (o: string) => Promise<void> };

const doc = document as FsDocument;

export const Fullscreen = {
  supported(): boolean {
    return !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
  },

  active(): boolean {
    return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  },

  /** Must be called from a click or tap. Also turns phones to landscape where allowed (Android). */
  async enter(): Promise<void> {
    const el = document.documentElement as FsElement;
    try {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
      else await el.webkitRequestFullscreen?.();
    } catch {
      return;
    }
    try {
      await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape');
    } catch {
      /* not allowed on this device: the rotate prompt still explains it */
    }
  },

  async exit(): Promise<void> {
    try {
      if (document.exitFullscreen) await document.exitFullscreen();
      else await doc.webkitExitFullscreen?.();
    } catch {
      /* already left */
    }
  },

  toggle(): Promise<void> {
    return this.active() ? this.exit() : this.enter();
  },

  onChange(fn: () => void): void {
    document.addEventListener('fullscreenchange', fn);
    document.addEventListener('webkitfullscreenchange', fn);
  },
};

const DISMISS_KEY = 'eoe-portrait-ok';
/** Phones held upright. Tablets upright still get a wide enough picture. */
const PORTRAIT_PHONE = '(pointer: coarse) and (orientation: portrait) and (max-width: 599px)';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function saveDismissed(): void {
  try {
    sessionStorage.setItem(DISMISS_KEY, '1');
  } catch {
    /* private mode: the choice lasts until reload */
  }
}

/** Shows the rotate prompt on phones held upright and pauses the game behind it. */
export function installRotatePrompt(game: Phaser.Game): void {
  const mq = window.matchMedia(PORTRAIT_PHONE);
  let dismissed = readDismissed();
  let paused = false;

  let robot = '';
  try {
    robot = PixelArtGenerator.createRobotCanvas().toDataURL();
  } catch {
    /* text-only prompt */
  }

  const prompt = document.createElement('div');
  prompt.id = 'rotate-prompt';
  prompt.className = 'rotate-prompt';
  prompt.hidden = true;
  prompt.setAttribute('role', 'dialog');
  prompt.setAttribute('aria-modal', 'true');
  prompt.setAttribute('aria-labelledby', 'rotate-prompt-title');
  prompt.innerHTML = `
    <div class="rotate-prompt__card">
      <div class="rotate-prompt__art" aria-hidden="true">
        <span class="rotate-prompt__phone">${robot ? `<img src="${robot}" alt="" />` : ''}</span>
      </div>
      <h2 id="rotate-prompt-title">TURN YOUR PHONE SIDEWAYS</h2>
      <p>UNIT-7's view is wide. Hold your phone sideways for a bigger picture, larger text and room for the controls.</p>
      <div class="rotate-prompt__actions">
        ${Fullscreen.supported() ? '<button type="button" class="btn btn--primary" id="rotate-fullscreen">FULLSCREEN + ROTATE</button>' : ''}
        <button type="button" class="btn btn--ghost" id="rotate-dismiss">KEEP PLAYING UPRIGHT</button>
      </div>
      <p class="rotate-prompt__tip">Tip: if the screen will not turn, check that rotation lock is off.</p>
    </div>`;
  document.getElementById('app')?.appendChild(prompt);

  const setPaused = (on: boolean) => {
    // Phaser starts its loop after booting; pausing before that would be undone
    if (on === paused || !game.isRunning) return;
    paused = on;
    if (on) game.loop.sleep();
    else game.loop.wake();
  };

  const update = () => {
    const show = mq.matches && !dismissed;
    prompt.hidden = !show;
    document.body.classList.toggle('rotate-prompt-open', show);
    setPaused(show);
  };

  prompt.querySelector('#rotate-dismiss')?.addEventListener('click', () => {
    dismissed = true;
    saveDismissed();
    update();
  });
  prompt.querySelector('#rotate-fullscreen')?.addEventListener('click', () => {
    void Fullscreen.enter();
  });

  mq.addEventListener('change', update);
  update();
  // First rendered frame: the loop is now running and can be paused
  if (!game.isRunning) game.events.once(Phaser.Core.Events.POST_RENDER, update);
}

/**
 * "Tap for sound": if the browser has stopped the audio and will not let it
 * restart on its own (some phones after fullscreen, a call or switching apps,
 * or when the only touches were joystick drags), a small button appears. A tap
 * on a real button always counts, so sound can always be brought back.
 * It never shows before the player's first tap, or when sound is switched off.
 */
export function installSoundPrompt(): void {
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'sound-prompt';
  button.className = 'sound-prompt';
  button.hidden = true;
  button.innerHTML = '<span aria-hidden="true">🔇</span> TAP FOR SOUND';
  button.addEventListener('click', () => {
    AudioCore.kick();
    window.setTimeout(check, 300);
  });
  document.getElementById('app')?.appendChild(button);

  let strikes = 0;
  const check = () => {
    // Two checks in a row, so a normal resume in progress never flashes the button
    strikes = AudioCore.blocked ? strikes + 1 : 0;
    button.hidden = strikes < 2;
  };
  window.setInterval(check, 1000);
}
