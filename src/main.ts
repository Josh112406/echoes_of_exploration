import Phaser from 'phaser';
import { gameConfig } from './config.ts';
import { UIManager } from './ui/UIManager.ts';
import { EventBus, EVENTS } from './core/EventBus.ts';
import { GameState } from './core/GameState.ts';
import { SoundFX } from './audio/SoundEffects.ts';
import { Soundscape } from './audio/Soundscape.ts';
import { getMinigameKeyForSite } from './data/minigames.ts';
import { Practice } from './systems/Practice.ts';

// Music, ambience and effects: unlocks on the first click or key press
Soundscape.install();

window.addEventListener('DOMContentLoaded', () => {
  // Mount Phaser Game
  const game = new Phaser.Game(gameConfig);
  (window as any).__PHASER_GAME__ = game;

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

  const setTopBarVisible = (visible: boolean) => {
    const nav = document.querySelector('header.nav');
    if (nav) {
      if (visible) {
        nav.classList.remove('hidden');
      } else {
        nav.classList.add('hidden');
      }
    }
  };

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
    setTopBarVisible(false);
    stopActivePlayScenes();
    game.scene.start('IntroScene');
  });

  // 2. Title Screen Trigger
  EventBus.on(EVENTS.SHOW_TITLE, () => {
    hideAllOverlays();
    setTopBarVisible(false);
    stopActivePlayScenes();
    game.scene.start('TitleScene');
    document.getElementById('title-overlay')?.classList.remove('hidden');
  });

  // 3. Start Open World Exploration
  EventBus.on(EVENTS.START_EXPLORATION, () => {
    hideAllOverlays();
    setTopBarVisible(false);
    stopActivePlayScenes();
    game.scene.start('SiteScene');
  });

  // 4. Start Site Minigame (Landing / Rover / Laser / Rotor / Flyby)
  EventBus.on(EVENTS.START_LANDING, (siteId: string, assisted?: boolean) => {
    if (!GameState.isSiteActive(siteId)) return; // chronological order
    Practice.end(); // a real run is never a practice run
    hideAllOverlays();
    setTopBarVisible(false);
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
    setTopBarVisible(false);
    stopActivePlayScenes();
    game.scene.start(run.scene, { siteId: run.siteId, assisted: false });
  });

  // 5. Interplanetary Transition (Moon -> Mars / Elsewhere)
  EventBus.on(EVENTS.START_TRANSITION, (targetWorld?: 'mars' | 'elsewhere') => {
    if (!GameState.isWorldUnlocked(targetWorld ?? 'mars')) return;
    hideAllOverlays();
    setTopBarVisible(false);
    stopActivePlayScenes();
    game.scene.start('TransitionScene', { targetWorld: targetWorld ?? 'mars' });
  });

  // 6. Grand Finale (All 23 recovered)
  EventBus.on(EVENTS.SHOW_FINALE, () => {
    if (!GameState.isCampaignComplete()) return;
    hideAllOverlays();
    setTopBarVisible(false);
    stopActivePlayScenes();
    game.scene.start('EndingScene');
  });

  // 7. Hub Map View
  EventBus.on(EVENTS.NAVIGATE_TO_HUB, () => {
    setTopBarVisible(true);
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
