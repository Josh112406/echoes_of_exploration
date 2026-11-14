import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { typeInto } from './Talk.ts';

const MOON_TOTAL = 8;
const MARS_TOTAL = 9;
const ELSEWHERE_TOTAL = 6;
const TOTAL = MOON_TOTAL + MARS_TOTAL + ELSEWHERE_TOTAL;

/** One option in the title menu, plus what UNIT-7 says while it is highlighted. */
interface Item {
  id: string;
  label: string;
  hint: string;
  size?: 'main' | 'small';
  disabled?: boolean;
  /** Extra markup under the label (e.g. a world's echo gauge). */
  extra?: string;
}

/**
 * The title menu, drawn straight onto the scene like a game's start screen:
 * big pixel options with a ▶ ◀ cursor, an echo gauge as the HUD, and UNIT-7
 * (the robot on the ridge) commenting on whichever option is highlighted.
 * The options are real buttons, so mouse, touch, keyboard and screen readers
 * all work.
 */
export class TitleScreen {
  private container: HTMLElement;
  private isWorldSelectOpen: boolean = false;
  private selectedIndex: number = 0;
  private items: Item[] = [];
  private hintTimer = 0;
  /** The comment UNIT-7 should be making right now (read by TitleScene when it starts). */
  static currentHint = '';
  private compact = false;
  private cancelTyping: () => void = () => {};

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();

    EventBus.on(EVENTS.SHOW_TITLE, () => {
      this.isWorldSelectOpen = false;
      this.container.classList.remove('hidden');
      this.render();
    });

    EventBus.on(EVENTS.ENTRY_UNLOCKED, () => {
      if (!this.container.classList.contains('hidden')) this.render();
    });

    EventBus.on(EVENTS.PROGRESS_RESET, () => {
      if (!this.container.classList.contains('hidden')) this.render();
    });

    // Game-style menu navigation: arrows / WASD move the cursor, Enter / Space confirm
    window.addEventListener('keydown', (e: KeyboardEvent) => this.onKeyDown(e));
    // Phaser resizes the canvas on its own resize handler; measure after it
    window.addEventListener('resize', () => window.setTimeout(() => this.layout(), 80));
  }

  render(): void {
    const moon = GameState.getRecoveredCount('moon');
    const mars = GameState.getRecoveredCount('mars');
    const elsewhere = GameState.getRecoveredCount('elsewhere');
    const total = moon + mars + elsewhere;
    const marsUnlocked = GameState.isWorldUnlocked('mars');
    const elsewhereUnlocked = GameState.isWorldUnlocked('elsewhere');

    this.items = this.isWorldSelectOpen
      ? this.worldItems(moon, mars, elsewhere, marsUnlocked, elsewhereUnlocked)
      : this.mainItems(total);
    const main = this.items.filter((i) => i.size !== 'small');
    const small = this.items.filter((i) => i.size === 'small');

    this.container.innerHTML = `
      <h1 class="sr-only">ECHOES OF EXPLORATION — THE NASA SIGNAL ARCHIVE</h1>
      <nav class="tmenu ${this.isWorldSelectOpen ? 'tmenu--worlds' : ''}" aria-label="${this.isWorldSelectOpen ? 'Select destination' : 'Main menu'}">
        ${this.isWorldSelectOpen ? '<p class="tmenu__heading">SELECT DESTINATION</p>' : ''}
        <ul class="tmenu__list">
          ${main.map((it, k) => this.itemHtml(it, k)).join('')}
        </ul>
        ${small.length ? `<ul class="tmenu__row">${small.map((it, k) => this.itemHtml(it, main.length + k)).join('')}</ul>` : ''}
      </nav>

      <div class="tmenu-hud" role="status" aria-label="${total} of ${TOTAL} echoes recovered">
        <span class="tmenu-hud__label">ECHOES</span>
        ${this.pips(moon, MOON_TOTAL, 'moon')}
        ${this.pips(mars, MARS_TOTAL, 'mars')}
        ${this.pips(elsewhere, ELSEWHERE_TOTAL, 'elsewhere')}
        <span class="tmenu-hud__count">${String(total).padStart(2, '0')}<small>/${TOTAL}</small></span>
      </div>

      <p class="tmenu-say" aria-hidden="true"><span class="tmenu-say__who">UNIT-7</span><span class="tmenu-say__text"></span></p>

      <div class="tmenu-keys" aria-hidden="true"><kbd>↑</kbd><kbd>↓</kbd> SELECT <kbd>ENTER</kbd> CONFIRM${this.isWorldSelectOpen ? ' <kbd>ESC</kbd> BACK' : ''}</div>
      <div class="tmenu-credit">DATA: NASA NSSDC / PDS · EST. 1967 – 2026</div>
    `;

    this.container.classList.toggle('is-still', GameState.getState().settings.reducedMotion);
    this.layout();
    this.selectedIndex = 0;
    this.bindEvents();
    this.applySelection(false);
  }

  // ---------------------------------------------------------------------------
  // Menus
  // ---------------------------------------------------------------------------

  private mainItems(total: number): Item[] {
    const started = total > 0;
    const world = GameState.getWorld();
    const endingUnlocked = GameState.getState().epilogueSeen || total >= TOTAL;
    const next = world === 'moon' ? 'the Moon' : world === 'mars' ? 'Mars' : 'Deep Space';
    return [
      {
        id: 'btn-play-expedition',
        label: started ? 'CONTINUE' : 'START EXPEDITION',
        hint: started
          ? `${total} of ${TOTAL} echoes recovered. The next signal is on ${next}. Ready when you are.`
          : `Optics online. ${TOTAL} echoes are out there — on the Moon, on Mars, and in deep space. Shall we go?`,
      },
      {
        id: 'btn-world-select',
        label: 'DESTINATIONS',
        hint: 'The Moon, Mars, or Deep Space. Pick where we set down.',
      },
      { id: 'btn-open-archive', label: 'ARCHIVE', hint: 'Every record I have recovered, each with its NASA source.' },
      { id: 'btn-open-settings', label: 'SETTINGS', size: 'small', hint: 'Sound, text size, contrast and motion.' },
      { id: 'btn-open-about', label: 'ABOUT', size: 'small', hint: 'Who made this, and where the facts come from.' },
      { id: 'btn-replay-intro', label: 'INTRO', size: 'small', hint: 'Watch the prologue again.' },
      endingUnlocked
        ? { id: 'btn-replay-ending', label: 'ENDING', size: 'small', hint: 'Play the final transmission again.' }
        : { id: 'btn-ending-locked', label: 'ENDING', size: 'small', disabled: true, hint: `The final transmission opens after all ${TOTAL} echoes.` },
    ];
  }

  private worldItems(
    moon: number,
    mars: number,
    elsewhere: number,
    marsUnlocked: boolean,
    elsewhereUnlocked: boolean,
  ): Item[] {
    return [
      {
        id: 'btn-select-moon',
        label: 'THE MOON',
        hint: `${moon} of ${MOON_TOTAL} echoes found. Grey dust, no air, and it is very quiet.`,
        extra: `<span class="tmenu__meta">${this.pips(moon, MOON_TOTAL, 'moon')}<span>${moon}/${MOON_TOTAL}</span></span>`,
      },
      {
        id: 'btn-select-mars',
        label: 'MARS',
        disabled: !marsUnlocked,
        hint: marsUnlocked ? `${mars} of ${MARS_TOTAL} echoes found. Ochre dust and a thin, restless wind.` : 'Out of range. Recover all 8 Moon echoes to ignite the Mars transfer stage.',
        extra: `<span class="tmenu__meta">${this.pips(mars, MARS_TOTAL, 'mars')}<span>${mars}/${MARS_TOTAL}</span>${marsUnlocked ? '' : '<span class="lock-tag">LOCKED</span>'}</span>`,
      },
      {
        id: 'btn-select-elsewhere',
        label: 'ELSEWHERE',
        disabled: !elsewhereUnlocked,
        hint: elsewhereUnlocked ? `${elsewhere} of ${ELSEWHERE_TOTAL} echoes found. Saturn, Jupiter, Eros, Pluto, and the interstellar dark.` : 'Deep space telemetry offline. Recover all 9 Mars echoes to ignite the outer-system ion drive.',
        extra: `<span class="tmenu__meta">${this.pips(elsewhere, ELSEWHERE_TOTAL, 'elsewhere')}<span>${elsewhere}/${ELSEWHERE_TOTAL}</span>${elsewhereUnlocked ? '' : '<span class="lock-tag">LOCKED</span>'}</span>`,
      },
      { id: 'btn-back-main', label: 'BACK', size: 'small', hint: 'Back to the main menu.' },
    ];
  }

  private itemHtml(it: Item, index: number): string {
    const cls = ['tmenu__item', it.size === 'small' ? 'tmenu__item--small' : '', index === 0 && it.size !== 'small' ? 'tmenu__item--first' : ''].join(' ');
    return `
      <li style="--i:${index}">
        <button id="${it.id}" class="${cls}" ${it.disabled ? 'aria-disabled="true"' : ''} aria-describedby="${it.id}-hint">
          <span class="tmenu__label">${it.label}</span>${it.extra ?? ''}
        </button>
        <span id="${it.id}-hint" class="sr-only">${it.hint}</span>
      </li>`;
  }

  /** Pixel pips, one per echo (the same language as the landing fuel gauge). */
  private pips(count: number, total: number, world: 'moon' | 'mars' | 'elsewhere'): string {
    const segs = Array.from({ length: total }, (_, i) => `<i class="${i < count ? 'on' : ''}"></i>`).join('');
    return `<span class="pips pips--${world}" aria-hidden="true">${segs}</span>`;
  }

  // ---------------------------------------------------------------------------
  // Selection cursor
  // ---------------------------------------------------------------------------

  /** Every option, in order. Locked ones can be highlighted (UNIT-7 explains why) but not chosen. */
  private getButtons(): HTMLButtonElement[] {
    return Array.from(this.container.querySelectorAll<HTMLButtonElement>('.tmenu__item'));
  }

  private applySelection(focus: boolean): void {
    const buttons = this.getButtons();
    if (buttons.length === 0) return;
    this.selectedIndex = ((this.selectedIndex % buttons.length) + buttons.length) % buttons.length;
    buttons.forEach((b, i) => b.classList.toggle('is-selected', i === this.selectedIndex));
    if (focus) buttons[this.selectedIndex].focus({ preventScroll: true });
    this.sayHint();
  }

  /** UNIT-7 comments on the highlighted option (debounced so fast scrolling does not chatter). */
  private sayHint(): void {
    const item = this.items[this.selectedIndex];
    window.clearTimeout(this.hintTimer);
    this.hintTimer = window.setTimeout(() => {
      if (this.container.classList.contains('hidden')) return;
      const hint = item?.hint ?? '';
      // Small screens: the scene (and UNIT-7's bubble) is too small to read, so the line
      // is typed under the menu instead, at the same talking pace.
      TitleScreen.currentHint = this.compact ? '' : hint;
      EventBus.emit(EVENTS.TITLE_HINT, TitleScreen.currentHint);
      const say = this.container.querySelector<HTMLElement>('.tmenu-say__text');
      this.cancelTyping();
      if (say) this.cancelTyping = this.compact ? typeInto(say, hint, { instant: GameState.getState().settings.reducedMotion }) : () => {};
    }, 140);
  }

  /**
   * Pins the menu to the game canvas (which is letterboxed to 16:9). When the
   * canvas is a short strip (a phone held upright), it lays out like a handheld:
   * menu above the scene, UNIT-7's dialogue box below it.
   */
  private layout(): void {
    const canvas = document.querySelector<HTMLCanvasElement>('#game-stage canvas');
    const box = this.container.getBoundingClientRect();
    if (!canvas || box.height === 0) return;
    const r = canvas.getBoundingClientRect();
    const st = this.container.style;
    st.setProperty('--cv-x', `${r.left - box.left}px`);
    st.setProperty('--cv-y', `${r.top - box.top}px`);
    st.setProperty('--cv-w', `${r.width}px`);
    st.setProperty('--cv-h', `${r.height}px`);
    const wasCompact = this.compact;
    this.compact = r.height < 330 && r.top - box.top > 200;
    this.container.classList.toggle('is-compact', this.compact);
    if (wasCompact !== this.compact) this.sayHint();
  }

  private isActive(): boolean {
    if (this.container.classList.contains('hidden')) return false;
    // Another overlay (archive, settings, about...) sits on top of the title
    return !document.querySelector('.overlay-pane:not(.hidden):not(#title-overlay)');
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.isActive()) return;
    const key = e.key.toLowerCase();
    const prev = ['arrowup', 'arrowleft', 'w', 'a'];
    const next = ['arrowdown', 'arrowright', 's', 'd'];

    if (prev.includes(key) || next.includes(key)) {
      e.preventDefault();
      this.selectedIndex += prev.includes(key) ? -1 : 1;
      this.applySelection(true);
      SoundFX.playHover();
    } else if (key === 'escape' && this.isWorldSelectOpen) {
      e.preventDefault();
      this.back();
    } else if (key === 'enter' || key === ' ') {
      const target = this.getButtons()[this.selectedIndex];
      // Let the browser handle Enter/Space on an already-focused button
      if (target && document.activeElement !== target) {
        e.preventDefault();
        target.click();
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  private leave(): void {
    window.clearTimeout(this.hintTimer);
    this.cancelTyping();
    TitleScreen.currentHint = '';
    EventBus.emit(EVENTS.TITLE_HINT, '');
    this.container.classList.add('hidden');
  }

  private back(): void {
    SoundFX.playClick();
    this.isWorldSelectOpen = false;
    this.render();
  }

  private bindEvents(): void {
    this.getButtons().forEach((btn, i) => {
      btn.addEventListener('mouseenter', () => {
        if (this.selectedIndex !== i) {
          this.selectedIndex = i;
          this.applySelection(false);
          SoundFX.playHover();
        }
      });
      btn.addEventListener('focus', () => {
        if (this.selectedIndex !== i) {
          this.selectedIndex = i;
          this.applySelection(false);
        }
      });
      // Locked options stay focusable; choosing one just gets a soft "no"
      if (btn.getAttribute('aria-disabled') === 'true') {
        btn.addEventListener('click', () => {
          SoundFX.playHover();
          btn.classList.remove('is-denied');
          void btn.offsetWidth;
          btn.classList.add('is-denied');
          this.sayHint();
        });
      }
    });

    const on = (id: string, fn: () => void) => {
      const b = this.container.querySelector<HTMLButtonElement>(`#${id}`);
      if (b && b.getAttribute('aria-disabled') !== 'true') b.addEventListener('click', fn);
    };

    on('btn-play-expedition', () => {
      SoundFX.playClick();
      this.leave();
      const world = GameState.getWorld();
      // The player left before a sector launch played: pick the campaign up where it stopped.
      if (world === 'moon' && GameState.isWorldComplete('moon') && GameState.getRecoveredCount('mars') === 0) {
        EventBus.emit(EVENTS.START_TRANSITION, 'mars');
      } else if (world === 'mars' && GameState.isWorldComplete('mars') && GameState.getRecoveredCount('elsewhere') === 0) {
        EventBus.emit(EVENTS.START_TRANSITION, 'elsewhere');
      } else if (GameState.isCampaignComplete() && !GameState.getState().epilogueSeen) {
        EventBus.emit(EVENTS.SHOW_FINALE);
      } else {
        EventBus.emit(EVENTS.START_EXPLORATION);
      }
    });

    on('btn-world-select', () => {
      SoundFX.playClick();
      this.isWorldSelectOpen = true;
      this.render();
    });

    on('btn-back-main', () => this.back());

    on('btn-select-moon', () => {
      SoundFX.playClick();
      GameState.setWorld('moon');
      this.leave();
      EventBus.emit(EVENTS.START_EXPLORATION);
    });

    on('btn-select-mars', () => {
      if (!GameState.isWorldUnlocked('mars')) return;
      SoundFX.playClick();
      GameState.setWorld('mars');
      this.leave();
      EventBus.emit(EVENTS.START_EXPLORATION);
    });

    on('btn-select-elsewhere', () => {
      if (!GameState.isWorldUnlocked('elsewhere')) return;
      SoundFX.playClick();
      GameState.setWorld('elsewhere');
      this.leave();
      EventBus.emit(EVENTS.START_EXPLORATION);
    });

    on('btn-open-archive', () => {
      SoundFX.playClick();
      EventBus.emit(EVENTS.OPEN_ARCHIVE);
    });

    on('btn-open-settings', () => {
      SoundFX.playClick();
      EventBus.emit(EVENTS.OPEN_SETTINGS);
    });

    on('btn-open-about', () => {
      SoundFX.playClick();
      EventBus.emit(EVENTS.OPEN_ABOUT);
    });

    on('btn-replay-ending', () => {
      SoundFX.playClick();
      this.leave();
      EventBus.emit(EVENTS.SHOW_FINALE);
    });

    on('btn-replay-intro', () => {
      SoundFX.playClick();
      this.leave();
      EventBus.emit(EVENTS.START_INTRO);
    });
  }
}
