import Phaser from 'phaser';
import { gameConfig } from './config.ts';
import { UIManager } from './ui/UIManager.ts';
import { EventBus, EVENTS } from './core/EventBus.ts';
import { GameState } from './core/GameState.ts';
import { SoundFX } from './audio/SoundEffects.ts';
import { Soundscape } from './audio/Soundscape.ts';
import { getMinigameKeyForSite } from './data/minigames.ts';
import { Practice } from './systems/Practice.ts';
import { installRotatePrompt, installSoundPrompt } from './ui/DeviceFit.ts';

// Prefer Canvas when an older driver cannot compile the fragment precision Phaser needs.
function supportsWebGLShaders(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl');
    if (!gl || !gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)?.precision) return false;
    const shader = gl.createShader(gl.FRAGMENT_SHADER);
    if (!shader) return false;
    gl.shaderSource(shader, 'precision highp float; void main() { gl_FragColor = vec4(1.0); }');
    gl.compileShader(shader);
    const compiled = Boolean(gl.getShaderParameter(shader, gl.COMPILE_STATUS));
    gl.deleteShader(shader);
    return compiled;
  } catch {
    return false;
  }
}

// Music, ambience and effects: unlocks on the first click or key press
Soundscape.install();

window.addEventListener('DOMContentLoaded', () => {
  // Mount Phaser Game
  const fallback = document.getElementById('graphics-fallback');
  const showFallback = () => { if (fallback) fallback.hidden = false; };
  const hideFallback = () => { if (fallback) fallback.hidden = true; };
  document.getElementById('retry-graphics')?.addEventListener('click', () => window.location.reload());

  let game: Phaser.Game;
  try {
    game = new Phaser.Game({ ...gameConfig, type: supportsWebGLShaders() ? Phaser.AUTO : Phaser.CANVAS });
  } catch {
    showFallback();
    return;
  }
  const watchRenderer = () => {
    if (game.renderer.type !== Phaser.WEBGL) return;
    const renderer = game.renderer as Phaser.Renderer.WebGL.WebGLRenderer;
    renderer.on(Phaser.Renderer.Events.LOSE_WEBGL, showFallback);
    renderer.on(Phaser.Renderer.Events.RESTORE_WEBGL, hideFallback);
  };
  if (game.isBooted) watchRenderer();
  else game.events.once(Phaser.Core.Events.BOOT, watchRenderer);
  (window as any).__PHASER_GAME__ = game;

  // Phones held upright: ask to rotate (the game pauses behind the prompt)
  installRotatePrompt(game);
  // If the browser ever holds the sound back, offer a one-tap way to bring it back
  installSoundPrompt();

  // Android browser bars can change the visible height without updating CSS viewport units.
  const fitVisibleViewport = () => {
    document.documentElement.style.setProperty(
      '--visible-viewport-height',
      `${window.visualViewport?.height ?? window.innerHeight}px`,
    );
    requestAnimationFrame(() => {
      game.scale.getParentBounds();
      game.scale.refresh();
    });
  };
  window.visualViewport?.addEventListener('resize', fitVisibleViewport);
  window.addEventListener('resize', fitVisibleViewport);
  fitVisibleViewport();

  // Mount UI Overlays
  new UIManager();

  const hideAllOverlays = () => {
    document.getElementById('title-overlay')?.classList.add('hidden');
    document.getElementById('hub-overlay')?.classList.add('hidden');
    document.getElementById('archive-overlay')?.classList.add('hidden');
    document.getElementById('entry-overlay')?.classList.add('hidden');
    document.getElementById('failure-overlay')?.classList.add('hidden');
    document.getElementById('settings-overlay')?.classList.add('hidden');
    document.getElementById('about-overlay')?.classList.add('hidden');
    document.getElementById('fieldtask-overlay')?.classList.add('hidden');
  };

  const applyDisplaySettings = () => {
    const { highContrast, textSize } = GameState.getState().settings;
    const root = document.documentElement.classList;
    root.toggle('high-contrast', highContrast);
    root.toggle('text-large', textSize === 'large');
    root.toggle('text-xlarge', textSize === 'xlarge');
  };
  applyDisplaySettings();
  EventBus.on(EVENTS.SETTINGS_CHANGED, applyDisplaySettings);
  EventBus.on(EVENTS.PROGRESS_RESET, applyDisplaySettings);

  const stopActivePlayScenes = () => {
    SoundFX.setThruster(false);
    SoundFX.setRover(0);
    Soundscape.resetDuck();
    const activeScenes = [
      'IntroScene',
      'TitleScene',
      'SiteScene',
      'LandingScene',
      'RoverScene',
      'LaserScene',
      'RotorScene',
      'FlybyScene',
      'TransitionScene',
      'EndingScene',
    ];
    for (const s of activeScenes) {
      if (game.scene.isActive(s)) {
        game.scene.stop(s);
      }
    }
  };

  // 1. Intro Scene Trigger
  EventBus.on(EVENTS.START_INTRO, () => {
    hideAllOverlays();
    stopActivePlayScenes();
    game.scene.start('IntroScene');
  });

  // 2. Title Screen Trigger
  EventBus.on(EVENTS.SHOW_TITLE, () => {
    hideAllOverlays();
    stopActivePlayScenes();
    game.scene.start('TitleScene');
    document.getElementById('title-overlay')?.classList.remove('hidden');
  });

  // 3. Start Open World Exploration
  EventBus.on(EVENTS.START_EXPLORATION, () => {
    hideAllOverlays();
    stopActivePlayScenes();
    game.scene.start('SiteScene');
  });

  // 4. Start Site Minigame (Landing / Rover / Laser / Rotor / Flyby)
  EventBus.on(EVENTS.START_LANDING, (siteId: string, assisted?: boolean) => {
    if (!GameState.isSiteActive(siteId)) return; // chronological order
    Practice.end(); // a real run is never a practice run
    hideAllOverlays();
    stopActivePlayScenes();
    const sceneKey = getMinigameKeyForSite(siteId);
    game.scene.start(sceneKey, { siteId, assisted });
  });

  // 4b. Practice run of a catalog-only mission (from the Mission Catalog; recovers nothing)
  EventBus.on(EVENTS.START_PRACTICE, (missionId: string) => {
    const run = Practice.prepare(missionId);
    if (!run) return;
    Practice.begin(run);
    hideAllOverlays();
    stopActivePlayScenes();
    game.scene.start(run.scene, { siteId: run.siteId, assisted: false });
  });

  // 5. Interplanetary Transition (Moon -> Mars / Elsewhere)
  EventBus.on(EVENTS.START_TRANSITION, (targetWorld?: 'mars' | 'elsewhere') => {
    if (!GameState.isWorldUnlocked(targetWorld ?? 'mars')) return;
    hideAllOverlays();
    stopActivePlayScenes();
    game.scene.start('TransitionScene', { targetWorld: targetWorld ?? 'mars' });
  });

  // 6. Grand Finale (All 23 recovered)
  EventBus.on(EVENTS.SHOW_FINALE, () => {
    if (!GameState.isCampaignComplete()) return;
    hideAllOverlays();
    stopActivePlayScenes();
    game.scene.start('EndingScene');
  });

  // 7. Hub Map View
  EventBus.on(EVENTS.NAVIGATE_TO_HUB, () => {
    document.getElementById('hub-overlay')?.classList.remove('hidden');
  });

  // 8. Direct Site Navigation from Hub
  EventBus.on(EVENTS.NAVIGATE_TO_SITE, (siteId: string) => {
    hideAllOverlays();
    stopActivePlayScenes();
    game.scene.start('SiteScene', { siteId });
  });

  // Global Escape key: close the topmost open dialog; otherwise return to the Title menu.
  // Dialogs are closed through their own buttons so their normal close logic runs.
  const ESCAPE_DIALOGS: ReadonlyArray<[overlayId: string, closeSelector: string]> = [
    ['about-overlay', '#btn-close-about'],
    ['fieldtask-overlay', '#btn-close-fieldtask'],
    ['settings-overlay', '#btn-close-settings'],
    ['failure-overlay', '#btn-back-to-site'],
    ['entry-overlay', '#btn-close-entry'],
    ['archive-overlay', '#btn-close-archive'],
    ['hub-overlay', '#btn-close-hub'],
  ];
  const CINEMATIC_SCENES = ['IntroScene', 'TransitionScene', 'EndingScene'];
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    for (const [overlayId, closeSelector] of ESCAPE_DIALOGS) {
      const overlay = document.getElementById(overlayId);
      if (!overlay || overlay.classList.contains('hidden')) continue;
      // A dialog without a close button (e.g. a required briefing) swallows Escape.
      overlay.querySelector<HTMLButtonElement>(closeSelector)?.click();
      return;
    }
    // Cutscenes set progress flags when they finish; don't let Escape skip past them.
    if (CINEMATIC_SCENES.some((s) => game.scene.isActive(s))) return;
    EventBus.emit(EVENTS.SHOW_TITLE);
  });

  // Initial State Dispatch
  const state = GameState.getState();
  if (state.prologueSeen) {
    EventBus.emit(EVENTS.SHOW_TITLE);
  } else {
    // Overlays hidden; BootScene starts IntroScene
    hideAllOverlays();
  }

  // Trigger Tasteskill Hero Entrance
  requestAnimationFrame(() => {
    document.body.setAttribute('data-enter', 'active');
  });
});
