/**
 * Ambient backdrop (AI-assisted, human-reviewed).
 *
 * The game canvas is a fixed 16:9 picture, so every screen that is not 16:9 has
 * empty bars around it. Instead of flat black, those bars glow with a heavily
 * blurred, dimmed copy of whatever the game is showing (like a TV's ambient
 * light), so the frame always matches the scene: grey on the Moon, ochre on
 * Mars, deep blue in space.
 *
 * Cost: a few times a second the canvas is shrunk to 32x18 pixels; the browser's
 * GPU does the blur. Nothing is drawn while the tab is hidden.
 */
import Phaser from 'phaser';

const W = 32;
const H = 18;
/** Copy every Nth rendered frame (about 6 times a second at 60 fps). */
const EVERY = 10;

export function mountAmbientBackdrop(game: Phaser.Game, stage: HTMLElement): void {
  const glow = document.createElement('canvas');
  glow.width = W;
  glow.height = H;
  glow.className = 'ambient-backdrop';
  glow.setAttribute('aria-hidden', 'true');
  const ctx = glow.getContext('2d', { alpha: false });
  if (!ctx) return;
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, W, H);

  const shade = document.createElement('div');
  shade.className = 'ambient-shade';
  shade.setAttribute('aria-hidden', 'true');
  stage.prepend(glow, shade);

  let frame = 0;
  let failed = false;
  game.events.on(Phaser.Core.Events.POST_RENDER, () => {
    if (failed || document.hidden || ++frame % EVERY !== 0) return;
    try {
      // Read right after Phaser draws, while the WebGL back buffer is still valid
      ctx.drawImage(game.canvas, 0, 0, W, H);
    } catch {
      failed = true; // tainted or lost context: keep the last colour
    }
  });
}
