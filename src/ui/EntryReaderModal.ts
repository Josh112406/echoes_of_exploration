import { ALL_ENTRIES } from '../data/entries.ts';
import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { STORY, getSiteStory, sourceHost } from '../data/story.ts';
import type { ArtifactEntry } from '../data/schema.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { TalkClock } from './Talk.ts';
import { buildRobotCanvas } from '../systems/SpriteArt.ts';
import { missionsForEntry, sourcesForMission, encountersForEntry, MISSION_STATUS_LABEL } from '../data/catalog.ts';

/** How the reader was opened: the post-landing briefing, or browsing from the Archive. */
export type EntryOpenMode = 'briefing' | 'browse';

/** One line of UNIT-7's dialogue under the card. */
interface BriefLine {
  text: string;
  kind: 'thought' | 'record' | 'question';
  sourceUrl?: string;
}

type QuizState = 'ask' | 'wrong' | 'right';

const INFO_PAGES = 6; // pages 0..5 are the verified record
const QUIZ_PAGE = INFO_PAGES; // page 6 is the question card
const SLIDE_MS = 200;
const WRONG_RESET_MS = 1400;

const PAGE_TITLES = [
  'ARCHIVAL PHOTOGRAPH',
  'WHAT IT WAS',
  'HOW IT WORKED',
  'WHAT IT FOUND',
  'SOURCED CLAIMS',
  'LANDING COORDINATES',
  'UNIT-7 ASKS YOU',
];

/** Generated stand-in art (no public-domain photo in the repo yet): never credited to NASA. */
function isIllustration(nasaId: string): boolean {
  return nasaId === 'SI-ILLUSTRATION';
}

/** Card 6 reads as deep-space telemetry for the Elsewhere sector. */
function pageTitle(page: number, world: string | undefined): string {
  if (page === 5 && world === 'elsewhere') return 'DEEP SPACE TELEMETRY COORDINATES';
  return PAGE_TITLES[page];
}

let portraitUrl: string | null = null;
function robotPortrait(): string {
  if (!portraitUrl) portraitUrl = buildRobotCanvas().toDataURL();
  return portraitUrl;
}

function pick(pool: string[], seed: number): string {
  return pool[Math.abs(seed) % pool.length];
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h;
}

/**
 * Entry briefing: the verified record slides through as a card over the
 * exploration view while UNIT-7 talks about each page in a dialogue box at the
 * bottom. NEXT only appears once UNIT-7 has finished talking. The last card is a
 * question: a wrong answer rewinds the reel to page one, the right one closes it.
 */
export class EntryReaderModal {
  private container: HTMLElement;
  private live: HTMLElement;
  private entry: ArtifactEntry | null = null;
  private mode: EntryOpenMode = 'briefing';
  private page = 0;
  private maxSeen = 0;
  private isSinglePageView = false;

  // Dialogue state
  private lines: BriefLine[] = [];
  private lineIdx = 0;
  private shown = 0;
  private typing = false;
  private talk = new TalkClock();
  private lastFrame = 0;
  private rafId = 0;

  // Question state
  private quizState: QuizState = 'ask';
  private quizOrder: number[] = [];
  private picked = -1;
  private attempt = 0;
  private resetTimer = 0;
  private slideTimer = 0;
  private cardClosed = false;
  private sliding = false;
  private wasAlreadyReadOnOpen = false;

  constructor(container: HTMLElement) {
    this.container = container;

    this.live = document.createElement('div');
    this.live.id = 'briefing-live';
    this.live.setAttribute('aria-live', 'polite');
    this.live.setAttribute('role', 'status');
    this.live.className = 'sr-only';
    this.live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;';
    document.body.appendChild(this.live);

    EventBus.on(EVENTS.OPEN_ENTRY, (entryId: string, mode?: EntryOpenMode) => {
      this.open(entryId, mode ?? 'briefing');
    });

    window.addEventListener('keydown', (e: KeyboardEvent) => {
      if (this.container.classList.contains('hidden') || this.isSinglePageView) return;
      if (document.querySelector('#settings-overlay:not(.hidden), #about-overlay:not(.hidden), #fieldtask-overlay:not(.hidden), #failure-overlay:not(.hidden)')) return;
      const target = e.target as HTMLElement | null;
      if (target && target.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return; // let buttons click
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault();
        this.advance();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.prevPage();
      }
    });
  }

  open(entryId: string, mode: EntryOpenMode = 'briefing'): void {
    const entry = ALL_ENTRIES[entryId] as ArtifactEntry | undefined;
    if (!entry) return;
    this.entry = entry;
    this.mode = mode;
    this.wasAlreadyReadOnOpen = GameState.isEntryRead(entry.id);
    this.isSinglePageView = false;
    this.attempt = 0;
    this.resetRun();
    this.container.classList.add('briefing-mode');
    this.container.classList.remove('hidden');
    this.renderShell();
    this.showPage(0, false);
  }

  /** Close is offered when browsing, or once this briefing has been completed before. */
  private get canClose(): boolean {
    return this.mode === 'browse' || (!!this.entry && GameState.isEntryRead(this.entry.id));
  }

  private get hasQuiz(): boolean {
    return !!this.entry && !!getSiteStory(this.entry.id)?.quiz;
  }

  private get lastPage(): number {
    return this.hasQuiz ? QUIZ_PAGE : INFO_PAGES - 1;
  }

  private resetRun(): void {
    this.page = 0;
    this.maxSeen = 0;
    this.quizState = 'ask';
    this.picked = -1;
    this.cardClosed = false;
    window.clearTimeout(this.resetTimer);
    window.clearTimeout(this.slideTimer);
    this.sliding = false;
    this.stopTyping();
  }

  private hideNext(): void {
    const next = this.container.querySelector<HTMLButtonElement>('#btn-reel-next');
    if (next) {
      next.disabled = true;
      next.classList.add('is-waiting');
    }
  }

  /** Same rule as the scenes: only the in-game Reduced Motion setting turns the typewriter and slides off. */
  private get reducedMotion(): boolean {
    return GameState.getState().settings.reducedMotion;
  }

  // ---------------------------------------------------------------------------
  // Flow
  // ---------------------------------------------------------------------------

  private completeCurrentLine(): void {
    const line = this.lines[this.lineIdx];
    if (!line) return;
    this.talk.finish();
    this.shown = line.text.length;
    this.stopTyping();
    this.onLineDone();
  }

  /**
   * Click / Space: if UNIT-7 is still typing, reveal the line immediately;
   * otherwise move to the next line or the next page.
   */
  private advance(): void {
    if (!this.entry || this.sliding) return;
    if (this.typing) {
      this.completeCurrentLine();
      return;
    }
    if (this.lineIdx < this.lines.length - 1) {
      this.startLine(this.lineIdx + 1);
      return;
    }
    // All lines spoken
    if (this.page < QUIZ_PAGE && this.page < this.lastPage) {
      this.nextPage();
    } else if (this.page === this.lastPage && !this.hasQuiz) {
      this.finish();
    } else if (this.page === QUIZ_PAGE) {
      if (this.quizState === 'wrong') this.rewind();
      else if (this.quizState === 'right') this.finish();
    }
  }

  private skipPageOrAdvance(): void {
    if (!this.entry || this.sliding) return;
    if (this.typing) {
      this.completeCurrentLine();
      return;
    }
    this.advance();
  }

  private nextPage(): void {
    if (this.page < this.lastPage) this.showPage(this.page + 1, true, 1);
  }

  private prevPage(): void {
    if (this.sliding) return;
    if (this.page === QUIZ_PAGE && this.quizState !== 'ask') return;
    if (this.page > 0) this.showPage(this.page - 1, true, -1);
  }

  /** Wrong answer: the record rewinds to page one so it can be read again. */
  private rewind(): void {
    window.clearTimeout(this.resetTimer);
    if (this.page !== QUIZ_PAGE || this.quizState !== 'wrong') return;
    this.resetRun();
    this.showPage(0, true, -1);
  }

  private finish(): void {
    const entry = this.entry;
    if (entry) GameState.markEntryRead(entry.id);
    this.stopTyping();
    window.clearTimeout(this.resetTimer);
    window.clearTimeout(this.slideTimer);
    this.sliding = false;
    this.container.classList.add('hidden');
    this.container.classList.remove('briefing-mode');
    this.container.innerHTML = '';
    EventBus.emit(EVENTS.ENTRY_CLOSED, entry?.id ?? null);
    if (this.mode !== 'briefing' || this.wasAlreadyReadOnOpen) return;
    const world = entry?.world ?? GameState.getWorld();
    if (GameState.isWorldComplete('moon') && world === 'moon') EventBus.emit(EVENTS.START_TRANSITION, 'mars');
    else if (GameState.isWorldComplete('mars') && world === 'mars') EventBus.emit(EVENTS.START_TRANSITION, 'elsewhere');
    else if (GameState.isWorldComplete('elsewhere') && world === 'elsewhere') EventBus.emit(EVENTS.SHOW_FINALE);
  }

  private showPage(page: number, animate: boolean, dir: 1 | -1 = 1): void {
    if (!this.entry) return;
    this.page = page;
    this.maxSeen = Math.max(this.maxSeen, page);
    if (page === QUIZ_PAGE && this.quizState === 'ask') this.prepareQuiz();

    const card = this.container.querySelector<HTMLElement>('.briefing__card');
    const swap = () => {
      this.renderCard(dir);
      this.renderTop();
      this.container.scrollTop = 0;
      this.lines = this.linesFor(page);
      // Every visit, UNIT-7 talks the page through again (as in the finale).
      this.startLine(0);
    };

    if (animate && card && !this.reducedMotion) {
      card.classList.add(dir > 0 ? 'is-leaving' : 'is-leaving-back');
      this.stopTyping();
      this.sliding = true;
      this.hideNext();
      window.clearTimeout(this.slideTimer);
      this.slideTimer = window.setTimeout(() => {
        this.sliding = false;
        swap();
      }, SLIDE_MS);
    } else {
      swap();
    }
    SoundFX.playWhoosh();
  }

  private linesFor(page: number): BriefLine[] {
    const e = this.entry!;
    const story = getSiteStory(e.id);
    const thought = (i: number): BriefLine[] => (story ? [{ text: story.reel[i], kind: 'thought' }] : []);
    const record = (text: string, sourceUrl: string): BriefLine => ({ text, kind: 'record', sourceUrl });
    const loc = e.locations[0];
    switch (page) {
      case 0: return [...thought(0), record(`Archival photograph: ${e.image.alt}`, e.image.source_url)];
      case 1: return [record(e.summary, e.facts[0].source_url), ...thought(1)];
      case 2: return [record(e.how_it_worked, e.facts[0].source_url), ...thought(2)];
      case 3: return [record(e.science, e.facts[0].source_url), ...thought(3)];
      case 4: return [...e.facts.map((f) => record(f.text, f.source_url)), ...thought(4)];
      case 5: return [record(`${loc.label}. Latitude ${loc.lat.toFixed(4)}, longitude ${loc.lon.toFixed(4)}${loc.approximate ? ', approximate' : ''}.`, loc.source_url), ...thought(5)];
      default: {
        const seed = hashId(e.id) + this.attempt;
        return [
          { text: pick(STORY.ambient.quiz_ask, seed), kind: 'thought' },
          { text: story!.quiz.prompt, kind: 'question' },
        ];
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Question card
  // ---------------------------------------------------------------------------

  private prepareQuiz(): void {
    const n = getSiteStory(this.entry!.id)!.quiz.choices.length;
    const order = Array.from({ length: n }, (_v, i) => i);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    this.quizOrder = order;
    this.picked = -1;
  }

  private answer(choice: number): void {
    if (this.page !== QUIZ_PAGE || this.quizState !== 'ask') return;
    this.stopTyping();
    const e = this.entry!;
    const quiz = getSiteStory(e.id)!.quiz;
    this.picked = choice;
    const seed = hashId(e.id) + this.attempt;
    this.attempt++;

    if (choice === quiz.answer) {
      this.quizState = 'right';
      SoundFX.playTouchdown();
      GameState.markEntryRead(e.id);
      this.renderCard(0);
      this.lines = [{ text: pick(STORY.ambient.quiz_right, seed), kind: 'thought' }];
      this.startLine(0);
      // The card closes; only UNIT-7's last line remains.
      const card = this.container.querySelector<HTMLElement>('.briefing__card');
      window.setTimeout(() => {
        card?.classList.add('is-closing');
        this.cardClosed = true;
        window.setTimeout(() => { if (this.cardClosed) card?.remove(); }, this.reducedMotion ? 0 : 320);
      }, this.reducedMotion ? 0 : 650);
    } else {
      this.quizState = 'wrong';
      SoundFX.playCrash();
      this.renderCard(0);
      this.lines = [{ text: pick(STORY.ambient.quiz_wrong, seed), kind: 'thought' }];
      this.startLine(0);
    }
    this.renderTop();
  }

  // ---------------------------------------------------------------------------
  // Typewriter
  // ---------------------------------------------------------------------------

  private startLine(idx: number): void {
    this.stopTyping();
    this.lineIdx = idx;
    this.shown = 0;
    const line = this.lines[idx];
    if (!line) return;
    this.live.textContent = `UNIT-7: ${line.text}`;
    if (this.reducedMotion) {
      this.shown = line.text.length;
      this.typing = false;
      this.onLineDone();
      return;
    }
    this.typing = true;
    this.talk.start(line.text, { record: line.kind === 'record' });
    this.lastFrame = performance.now();
    const tick = (now: number) => {
      const dt = (now - this.lastFrame) / 1000;
      this.lastFrame = now;
      if (this.talk.tick(dt)) {
        this.shown = this.talk.shown;
        this.renderDialogueText();
      }
      if (this.talk.done) {
        this.typing = false;
        this.onLineDone();
        return;
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.renderDialogue();
    this.rafId = requestAnimationFrame(tick);
  }

  private stopTyping(): void {
    cancelAnimationFrame(this.rafId);
    this.typing = false;
  }

  private onLineDone(): void {
    this.renderDialogue();
    const last = this.lineIdx >= this.lines.length - 1;
    if (last && this.page === QUIZ_PAGE && this.quizState === 'wrong') {
      window.clearTimeout(this.resetTimer);
      this.resetTimer = window.setTimeout(() => this.rewind(), WRONG_RESET_MS);
    }
    if (last && this.page === QUIZ_PAGE && this.quizState === 'ask') {
      this.container.querySelectorAll<HTMLButtonElement>('.quiz-choice').forEach((b) => (b.disabled = false));
      this.container.querySelector<HTMLButtonElement>('.quiz-choice')?.focus();
    } else if (last) {
      this.container.querySelector<HTMLButtonElement>('#btn-reel-next')?.focus();
    }
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private renderShell(): void {
    this.container.innerHTML = `
      <div class="briefing${this.reducedMotion ? ' briefing--still' : ''}">
        <div class="briefing__top"></div>
        <div class="briefing__stage"></div>
        <div class="briefing__dialogue" id="briefing-dialogue">
          <img class="briefing__portrait" src="${robotPortrait()}" alt="" aria-hidden="true" />
          <div class="briefing__speech">
            <div class="briefing__name">
              <span class="briefing__dot"></span>
              <span class="briefing__who"></span>
              <span class="briefing__tag"></span>
            </div>
            <p class="briefing__text" aria-hidden="true"></p>
          </div>
          <div class="briefing__controls">
            <button id="btn-reel-back" class="btn">◀ BACK</button>
            <span class="briefing__hint"></span>
            <button id="btn-reel-next" class="btn btn--primary"></button>
          </div>
        </div>
      </div>`;

    const dialogue = this.container.querySelector<HTMLElement>('#briefing-dialogue')!;
    dialogue.addEventListener('click', (ev) => {
      if ((ev.target as HTMLElement).closest('button')) return;
      this.advance();
    });
    this.container.querySelector('#btn-reel-back')!.addEventListener('click', () => this.prevPage());
    this.container.querySelector('#btn-reel-next')!.addEventListener('click', () => this.skipPageOrAdvance());
  }

  private renderTop(): void {
    const top = this.container.querySelector<HTMLElement>('.briefing__top');
    const e = this.entry;
    if (!top || !e) return;
    const verifiedLabel = e.last_verified ? `VERIFIED ARCHIVE RECORD // ${e.last_verified}` : 'DRAFT, NOT YET VERIFIED';
    const total = this.lastPage + 1;
    const dots = Array.from({ length: total }, (_v, i) => {
      const reachable = i <= this.maxSeen && i !== this.page && !(this.page === QUIZ_PAGE && this.quizState !== 'ask');
      const cls = i === this.page ? 'active' : i <= this.maxSeen ? 'seen' : '';
      return `<button class="reel-dot ${cls}" data-page="${i}" aria-label="Page ${i + 1}: ${pageTitle(i, this.entry?.world)}" ${reachable ? '' : 'disabled'}></button>`;
    }).join('');
    const showSkipToQuiz = this.page < QUIZ_PAGE && this.hasQuiz && !this.canClose;
    top.innerHTML = `
      <span class="briefing__verified" style="color:${e.last_verified ? 'var(--verified)' : 'var(--muted)'};">${verifiedLabel}</span>
      <div class="briefing__dots" role="group" aria-label="Reel progress">${dots}</div>
      <div class="briefing__actions">
        ${showSkipToQuiz ? '<button id="btn-skip-to-quiz" class="btn">SKIP TO QUIZ ➔</button>' : ''}
        <button id="btn-toggle-single-page" class="btn">READ AS ONE PAGE</button>
        ${this.canClose ? '<button id="btn-close-entry" class="btn">CLOSE [X]</button>' : ''}
      </div>`;
    top.querySelectorAll<HTMLButtonElement>('.reel-dot').forEach((b) => {
      b.addEventListener('click', () => {
        if (this.sliding) return;
        const p = parseInt(b.dataset.page ?? '0', 10);
        if (p <= this.maxSeen && p !== this.page) this.showPage(p, true, p > this.page ? 1 : -1);
      });
    });
    top.querySelector('#btn-skip-to-quiz')?.addEventListener('click', () => {
      if (this.sliding) return;
      this.stopTyping();
      this.maxSeen = Math.max(this.maxSeen, QUIZ_PAGE);
      this.showPage(QUIZ_PAGE, true, 1);
    });
    top.querySelector('#btn-close-entry')?.addEventListener('click', () => this.finish());
    top.querySelector('#btn-toggle-single-page')?.addEventListener('click', () => {
      this.stopTyping();
      this.isSinglePageView = true;
      this.renderSinglePage();
    });
  }

  private renderCard(dir: number): void {
    const stage = this.container.querySelector<HTMLElement>('.briefing__stage');
    const e = this.entry;
    if (!stage || !e) return;
    const isQuiz = this.page === QUIZ_PAGE;
    const enterCls = dir > 0 ? 'is-entering' : dir < 0 ? 'is-entering-back' : '';
    stage.innerHTML = `
      <section class="briefing__card ${isQuiz ? 'briefing__card--quiz' : ''} ${this.reducedMotion ? '' : enterCls}" aria-labelledby="briefing-card-title">
        <header class="briefing__card-head">
          <span id="briefing-card-title">${this.page + 1}. ${pageTitle(this.page, this.entry?.world)}</span>
          <span class="chip ${isQuiz ? 'chip--story' : 'chip--record'}">${isQuiz ? 'GAME STORY · CHECK THE RECORD' : 'VERIFIED RECORD'}</span>
        </header>
        <div class="briefing__card-body">${isQuiz ? this.quizHtml() : this.pageHtml(this.page)}</div>
      </section>`;
    const card = stage.querySelector<HTMLElement>('.briefing__card')!;
    card.querySelectorAll<HTMLButtonElement>('.quiz-choice').forEach((b) => {
      b.addEventListener('click', () => this.answer(parseInt(b.dataset.choice ?? '-1', 10)));
    });
  }

  private quizHtml(): string {
    const quiz = getSiteStory(this.entry!.id)!.quiz;
    const lockChoices = this.quizState !== 'ask';
    const buttons = this.quizOrder.map((ci, n) => {
      const state = this.picked === ci ? (this.quizState === 'right' ? 'is-right' : 'is-wrong') : '';
      return `<button class="quiz-choice ${state}" data-choice="${ci}" ${lockChoices ? 'disabled' : ''}>
          <span class="quiz-choice__key">${String.fromCharCode(65 + n)}</span><span>${quiz.choices[ci]}</span>
        </button>`;
    }).join('');
    const status = this.quizState === 'wrong'
      ? '<p class="quiz-status quiz-status--wrong">NOT IN THE RECORD · REWINDING TO PAGE ONE</p>'
      : this.quizState === 'right'
        ? '<p class="quiz-status quiz-status--right">MATCHES THE RECORD · ECHO FILED</p>'
        : '<p class="quiz-status">The answer is somewhere in the pages you just read.</p>';
    return `
      <h3 class="quiz-prompt">${quiz.prompt}</h3>
      <div class="quiz-choices" role="group" aria-label="Answers">${buttons}</div>
      ${status}`;
  }

  private pageHtml(page: number): string {
    const e = this.entry!;
    switch (page) {
      case 0:
        return `
          <div class="briefing__photo"><img src="${e.image.file}" alt="${e.image.alt}" /></div>
          <div class="briefing__meta">
            ${isIllustration(e.image.nasa_id)
              ? `<span>SI-GENERATED ILLUSTRATION · NOT A NASA PHOTOGRAPH</span>
            <a href="${e.image.source_url}" target="_blank" rel="noreferrer">[REAL NASA IMAGERY ↗]</a>`
              : `<span>NASA ID: ${e.image.nasa_id} · CREDIT: ${e.image.credit}</span>
            <a href="${e.image.source_url}" target="_blank" rel="noreferrer">[ORIGINAL IMAGE ↗]</a>`}
          </div>`;
      case 1:
        return `
          <div class="briefing__row">
            <span class="badge badge--${e.status}">${e.status.toUpperCase()}</span>
            <span class="briefing__muted">LAUNCH: ${e.launch_date} // END: ${e.end_date || 'ACTIVE'}</span>
          </div>
          <h3 class="briefing__h">${e.name}</h3>
          <p class="briefing__p">${e.summary}</p>
          <div class="briefing__hook">
            <div class="briefing__hook-label">STORY HOOK · DRAMATIZED IN THE MACHINE'S VOICE (FACTS ARE SOURCED ON THE NEXT PAGES):</div>
            <p>"${e.hook}"</p>
          </div>`;
      case 2:
        return `<h3 class="briefing__h briefing__h--small">Engineering &amp; Technical Operations</h3><p class="briefing__p">${e.how_it_worked}</p>`;
      case 3:
        return `<h3 class="briefing__h briefing__h--small">Scientific Discoveries &amp; Results</h3><p class="briefing__p">${e.science}</p>`;
      case 4:
        return `<h3 class="briefing__h briefing__h--small">Primary Sourced Claims</h3>
          <ul class="briefing__facts">${e.facts.map((f, i) => `
            <li><div>${f.text}</div><a href="${f.source_url}" target="_blank" rel="noreferrer">[NASA CITATION ${i + 1} · ${sourceHost(f.source_url).toUpperCase()} ↗]</a></li>`).join('')}
          </ul>`;
      default:
        return `<h3 class="briefing__h briefing__h--small">${e.world === 'elsewhere' ? 'Heliocentric / Target Coordinates' : 'Surface Landing Coordinates'}</h3>
          ${e.locations.map((l) => `
            <div class="briefing__loc">
              <strong>${l.label}</strong>
              <div class="briefing__muted">LAT: ${l.lat.toFixed(4)}° · LON: ${l.lon.toFixed(4)}° ${l.approximate ? '[APPROXIMATE]' : '[VERIFIED]'}</div>
              <a href="${l.source_url}" target="_blank" rel="noreferrer">[NASA LOCATION SOURCE ↗]</a>
            </div>`).join('')}
          ${this.catalogHtml(e)}
          <div class="briefing__muted briefing__byline">CATALOGUED BY: ${e.written_by} // VERIFIED BY: ${e.verified_by}</div>`;
    }
  }

  /** The matching record(s) from the team's NASA mission catalog (src/data/missions.json). */
  private catalogHtml(e: ArtifactEntry): string {
    const missions = missionsForEntry(e.id);
    if (!missions.length) {
      return `<div class="briefing__loc briefing__catalog"><strong>NASA MISSION CATALOG</strong>
        <div class="briefing__muted">Not in the 31-mission catalog: this echo is sourced from the citations above.</div></div>`;
    }
    const lessons = encountersForEntry(e.id).map((enc) => `
      <div class="briefing__muted">FIELD LESSON · ${enc.title.toUpperCase()}: ${enc.learning_intent}</div>
      <div class="briefing__muted">HOW A GAME SIMPLIFIES IT: ${enc.simplification_note}</div>`).join('');
    const rows = missions.map((m) => `
      <div class="briefing__loc briefing__catalog">
        <strong>CATALOG RECORD · ${m.name.toUpperCase()}</strong>
        <div class="briefing__muted">${MISSION_STATUS_LABEL[m.status].toUpperCase()} · ${m.location_summary}</div>
        ${sourcesForMission(m).map((s) => `<a href="${s.url}" target="_blank" rel="noreferrer">[${s.organization.toUpperCase()} · ${s.title.toUpperCase()} ↗]</a>`).join(' ')}
      </div>`).join('');
    return `<h3 class="briefing__h briefing__h--small">NASA Mission Catalog</h3>${rows}${lessons}`;
  }

  private renderDialogue(): void {
    const line = this.lines[this.lineIdx];
    const e = this.entry;
    if (!line || !e) return;
    const story = getSiteStory(e.id);
    const who = this.container.querySelector<HTMLElement>('.briefing__who');
    const tag = this.container.querySelector<HTMLElement>('.briefing__tag');
    const dialogue = this.container.querySelector<HTMLElement>('#briefing-dialogue');
    if (who) who.textContent = `UNIT-7 LOG // ${(story?.title ?? e.name).toUpperCase()}`;
    if (tag) {
      tag.textContent = line.kind === 'record' ? `VERIFIED RECORD · ${sourceHost(line.sourceUrl ?? '').toUpperCase()}` : line.kind === 'question' ? 'QUESTION' : 'GAME STORY';
      tag.className = `briefing__tag chip ${line.kind === 'record' ? 'chip--record' : 'chip--story'}`;
    }
    dialogue?.classList.toggle('is-record', line.kind === 'record');
    this.renderDialogueText();
    this.renderControls();
  }

  private renderDialogueText(): void {
    const el = this.container.querySelector<HTMLElement>('.briefing__text');
    const line = this.lines[this.lineIdx];
    if (!el || !line) return;
    const done = this.shown >= line.text.length;
    el.innerHTML = `${line.text.slice(0, this.shown)}${done ? '' : '<span class="briefing__caret">▌</span>'}`;
  }

  private renderControls(): void {
    const next = this.container.querySelector<HTMLButtonElement>('#btn-reel-next');
    const back = this.container.querySelector<HTMLButtonElement>('#btn-reel-back');
    const hint = this.container.querySelector<HTMLElement>('.briefing__hint');
    if (!next || !back || !hint) return;
    const talking = this.typing || this.lineIdx < this.lines.length - 1;
    const onQuiz = this.page === QUIZ_PAGE;

    back.disabled = this.page === 0 || (onQuiz && this.quizState !== 'ask');
    back.style.visibility = back.disabled ? 'hidden' : 'visible';

    let label = '';
    if (this.typing) {
      label = 'SKIP ➔';
    } else if (this.lineIdx < this.lines.length - 1) {
      label = 'NEXT ➔';
    } else if (!onQuiz) {
      if (this.page < this.lastPage) label = this.page === QUIZ_PAGE - 1 ? 'TO THE QUESTION ➔' : 'NEXT ➔';
      else label = this.finishLabel();
    } else if (this.quizState === 'wrong') {
      label = 'READ AGAIN ↺';
    } else if (this.quizState === 'right') {
      label = this.finishLabel();
    }

    const waitingForAnswer = !this.typing && this.lineIdx >= this.lines.length - 1 && onQuiz && this.quizState === 'ask';
    next.style.visibility = waitingForAnswer ? 'hidden' : 'visible';
    next.disabled = !label;
    next.classList.toggle('is-waiting', false);
    next.textContent = label || 'NEXT ➔';

    hint.textContent = this.typing
      ? 'CLICK / SPACE TO SKIP ▼'
      : talking
      ? 'CLICK / SPACE TO CONTINUE ▼'
      : onQuiz && this.quizState === 'ask'
        ? 'CHOOSE AN ANSWER ON THE CARD'
        : `PAGE ${Math.min(this.page, this.lastPage) + 1} OF ${this.lastPage + 1}`;
  }

  private finishLabel(): string {
    if (this.mode === 'briefing') {
      const world = GameState.getWorld();
      if (GameState.isWorldComplete('moon') && world === 'moon') return 'LAUNCH TO MARS ➔';
      if (GameState.isWorldComplete('mars') && world === 'mars') return 'LAUNCH TO DEEP SPACE ➔';
      if (GameState.isWorldComplete('elsewhere') && world === 'elsewhere') return 'VIEW GRAND FINALE ➔';
      return 'RESUME EXPLORATION ➔';
    }
    return 'DONE ➔';
  }

  // ---------------------------------------------------------------------------
  // Single-page view (accessibility / re-reading)
  // ---------------------------------------------------------------------------

  private renderSinglePage(): void {
    const e = this.entry;
    if (!e) return;
    const story = getSiteStory(e.id);
    const verifiedLabel = e.last_verified ? `VERIFIED ARCHIVE RECORD // ${e.last_verified}` : 'DRAFT, NOT YET VERIFIED';
    this.container.innerHTML = `
      <div class="briefing-single">
        <div class="briefing__top">
          <span class="briefing__verified" style="color:${e.last_verified ? 'var(--verified)' : 'var(--muted)'};">${verifiedLabel}</span>
          <div class="briefing__actions">
            <button id="btn-toggle-reel" class="btn">BACK TO BRIEFING</button>
            <button id="btn-close-entry" class="btn">CLOSE [X]</button>
          </div>
        </div>
        <div class="briefing__card briefing-single__card">
          <h1 class="briefing__h" style="font-size:22px;">${e.name}</h1>
          ${this.pageHtml(0)}
          <div class="briefing-single__note">
            <div class="briefing__name"><span class="briefing__dot"></span><span>UNIT-7 LOG // ${(story?.title ?? e.name).toUpperCase()}</span><span class="chip chip--story">GAME STORY</span></div>
            <p>${story?.afterthought ?? e.summary}</p>
          </div>
          ${[1, 2, 3, 4, 5].map((p) => `<section class="briefing-single__section">${this.pageHtml(p)}</section>`).join('')}
        </div>
      </div>`;
    this.container.querySelector('#btn-close-entry')?.addEventListener('click', () => this.finish());
    this.container.querySelector('#btn-toggle-reel')?.addEventListener('click', () => {
      this.isSinglePageView = false;
      this.resetRun();
      this.renderShell();
      this.showPage(0, false);
    });
  }
}
