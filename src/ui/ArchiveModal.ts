import { ALL_ENTRIES } from '../data/entries.ts';
import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { PALETTE } from './theme.ts';
import { typeInto } from './Talk.ts';
import { MOON_CHRONOLOGY, MARS_CHRONOLOGY, ELSEWHERE_CHRONOLOGY } from '../data/entries.ts';
import { STORY, MOTIVE_IDS, getSiteStory, getAnswer, getTheory, getMotiveTally } from '../data/story.ts';
import { MISSIONS, MISSION_CATALOG, MISSION_STATUS_LABEL, entryForMission, sourcesForMission, encounterForMission, Mission } from '../data/catalog.ts';
import { CATALOG_PRACTICE } from '../data/minigames.ts';
import { fieldTaskForEncounter } from '../data/fieldTasks.ts';

interface OpenArchiveOptions {
  tab?: 'archive' | 'catalog' | 'journal';
  practice?: { name: string; result: 'complete' | 'failed' | 'exited' };
}

type ArchiveTab = 'archive' | 'catalog' | 'journal';

export class ArchiveModal {
  private container: HTMLElement;
  private filterWorld: string = 'all';
  private tab: ArchiveTab = 'archive';
  private featuredOnly = false;
  /** One-shot note after returning from a practice run. */
  private practiceNote: string | null = null;
  /** Chapter whose reply UNIT-7 should speak (type out) on the next journal render. */
  private speakReplyFor: string | null = null;
  private cancelTalk: () => void = () => {};

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();

    EventBus.on(EVENTS.OPEN_ARCHIVE, (opts?: OpenArchiveOptions) => {
      if (opts?.tab) this.tab = opts.tab;
      if (opts?.practice) {
        const { name, result } = opts.practice;
        this.practiceNote = result === 'complete'
          ? `PRACTICE RUN COMPLETE · ${name.toUpperCase()}. Practice runs do not recover echoes.`
          : `PRACTICE RUN ENDED · ${name.toUpperCase()}. Try it again any time.`;
      }
      this.container.classList.remove('hidden');
      this.render();
    });
  }

  render(): void {
    this.cancelTalk();
    this.cancelTalk = () => {};
    if (this.tab === 'journal') {
      this.renderJournal();
      return;
    }
    if (this.tab === 'catalog') {
      this.renderCatalog();
      return;
    }
    const entries = Object.values(ALL_ENTRIES).filter(e => {
      if (this.filterWorld !== 'all' && e.world !== this.filterWorld) return false;
      return true;
    });

    const cardsHtml = entries.map(entry => {
      const isRecovered = GameState.isEntryRecovered(entry.id);
      const badgeClass = `badge--${entry.status}`;

      if (!isRecovered) {
        return `
          <div class="artifact-card locked" data-entry-id="${entry.id}">
            <div style="height:120px; background:${PALETTE.deepIndigo}; border:1px solid ${PALETTE.shadowNavy}; display:flex; align-items:center; justify-content:center; color:${PALETTE.slateMuted}; font-size:11px; font-family:var(--font-mono); letter-spacing:0.04em;">
              [ECHO NOT YET RECOVERED]
            </div>
            <div style="margin-top:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <h4 style="font-size:14px; color:${PALETTE.slateMuted}; font-family:var(--font-mono);">${entry.name}</h4>
                <span class="badge ${badgeClass}">${entry.status}</span>
              </div>
              <p style="font-size:10px; font-family:var(--font-mono); color:var(--muted); margin-top:6px;">SECTOR // ${entry.world.toUpperCase()}</p>
            </div>
          </div>
        `;
      }

      const verifiedStatus = entry.last_verified ? `[VERIFIED ARCHIVAL RECORD // ${entry.last_verified}]` : '[DRAFT, NOT YET VERIFIED]';
      const statusColor = entry.last_verified ? PALETTE.beaconGold : PALETTE.slateMuted;

      return `
        <div class="artifact-card" data-entry-id="${entry.id}">
          <div style="height:120px; background:${PALETTE.deepIndigo}; border:1px solid ${PALETTE.shadowNavy}; overflow:hidden;">
            <img src="${entry.image.file}" alt="${entry.image.alt}" style="width:100%; height:100%; object-fit:cover;" />
          </div>
          <div style="margin-top:12px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
              <h4 style="font-size:14px; font-weight:700; color:${PALETTE.lunarHighlight}; font-family:var(--font-mono);">${entry.name}</h4>
              <span class="badge ${badgeClass}">${entry.status}</span>
            </div>
            <p style="font-size:11px; color:${PALETTE.lunarCrustCream}; margin-top:6px; line-height:1.4;">${entry.summary}</p>
            <div style="margin-top:8px; font-size:10px; font-family:var(--font-mono); color:${statusColor}; letter-spacing:0.04em;">${verifiedStatus}</div>
          </div>
        </div>
      `;
    }).join('');

    this.container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:16px; border-bottom:1px solid ${PALETTE.shadowNavy}; padding-bottom:14px;">
        <div>
          <h2 style="font-size:18px; font-weight:700; letter-spacing:0.02em; color:${PALETTE.lunarHighlight}; font-family:var(--font-mono);">ECHOES OF EXPLORATION // MISSION ARCHIVE</h2>
          <p style="font-size:11px; font-family:var(--font-mono); color:${PALETTE.cyanGlow}; margin-top:2px;">${Object.keys(ALL_ENTRIES).length} PLAYABLE ECHOES // MOON, MARS &amp; DEEP SPACE</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${this.tabsHtml()}
          ${this.worldSelectHtml()}
          <button id="btn-close-archive" class="btn">CLOSE [X]</button>
        </div>
      </div>
      <div class="card-grid">
        ${cardsHtml}
      </div>
    `;

    this.bindEvents();
  }

  private tabsHtml(): string {
    const tab = (id: ArchiveTab, label: string) =>
      `<button class="btn archive-tab ${this.tab === id ? 'btn--primary' : ''}" data-tab="${id}" aria-pressed="${this.tab === id}">${label}</button>`;
    return tab('archive', 'RECORDS') + tab('catalog', `MISSION CATALOG · ${MISSIONS.length}`) + tab('journal', 'UNIT-7 JOURNAL');
  }

  private worldSelectHtml(): string {
    const opt = (v: string, label: string) => `<option value="${v}" ${this.filterWorld === v ? 'selected' : ''}>${label}</option>`;
    return `<select id="select-filter-world" aria-label="Filter by sector" class="archive-select">
      ${opt('all', 'ALL SECTORS')}${opt('moon', 'LUNA ONLY')}${opt('mars', 'MARS ONLY')}${opt('elsewhere', 'ELSEWHERE ONLY')}
    </select>`;
  }

  /**
   * The full NASA mission catalog (src/data/missions.json): every mission group whose
   * hardware is still out there, with its official sources, the designed encounter
   * (what the player learns and how a game simplifies it), and a link to the
   * playable echo when the game covers it.
   */
  private renderCatalog(): void {
    const missions = MISSIONS
      .filter((m) => this.filterWorld === 'all' || m.chapter === this.filterWorld)
      .filter((m) => !this.featuredOnly || m.featured)
      .slice()
      .sort((a, b) => a.launch_date.localeCompare(b.launch_date));
    const cards = missions.map((m) => this.missionCardHtml(m)).join('');
    const note = this.practiceNote;
    this.practiceNote = null;

    this.container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid ${PALETTE.shadowNavy}; padding-bottom:14px; gap:8px; flex-wrap:wrap;">
        <div>
          <h2 style="font-size:18px; font-weight:700; letter-spacing:0.02em; color:${PALETTE.lunarHighlight}; font-family:var(--font-mono);">NASA MISSION CATALOG</h2>
          <p style="font-size:11px; font-family:var(--font-mono); color:${PALETTE.cyanGlow}; margin-top:2px;">${MISSIONS.length} MISSIONS WHOSE HARDWARE IS STILL OUT THERE · REVIEWED ${MISSION_CATALOG.reviewed_on}</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          ${this.tabsHtml()}
          ${this.worldSelectHtml()}
          <label class="catalog-toggle"><input type="checkbox" id="chk-featured" ${this.featuredOnly ? 'checked' : ''} /> FEATURED ONLY</label>
          <button id="btn-close-archive" class="btn">CLOSE [X]</button>
        </div>
      </div>
      ${note ? `<p class="catalog-practice-note" role="status">${note}</p>` : ''}
      <p class="catalog-note">${MISSION_CATALOG.scope} Story hooks are dramatized and marked as such; every other line comes from the linked NASA sources. Missions that are not playable echoes have a practice run.</p>
      <div class="card-grid">
        ${cards || `<p class="catalog-note">No missions match these filters.</p>`}
      </div>
    `;
    this.bindEvents();
  }

  private missionCardHtml(m: Mission): string {
    const year = m.launch_date.slice(0, 4);
    const entryId = entryForMission(m.id);
    const entry = entryId ? ALL_ENTRIES[entryId] : undefined;
    const recovered = !!entryId && GameState.isEntryRecovered(entryId);
    const encounter = encounterForMission(m.id);
    const active = m.status.startsWith('active');
    const badge = active ? 'badge--active' : m.status === 'passive-science' ? 'badge--dormant' : 'badge--ended';
    const sources = sourcesForMission(m)
      .map((s) => `<li><a href="${s.url}" target="_blank" rel="noreferrer">${s.organization} · ${s.title} ↗</a></li>`)
      .join('');
    const playable = entry
      ? `<div class="catalog-play">
          <span>PLAYABLE ECHO: ${entry.name}</span>
          ${recovered
            ? `<button class="btn catalog-open" data-entry-id="${entryId}">OPEN RECORD</button>`
            : `<span class="catalog-muted">NOT YET RECOVERED</span>`}
        </div>`
      : CATALOG_PRACTICE[m.id]
        ? `<div class="catalog-play">
            <span class="catalog-muted">NOT A PLAYABLE ECHO</span>
            <button class="btn btn--primary catalog-practice" data-mission-id="${m.id}">▶ PRACTICE RUN</button>
          </div>`
        : `<div class="catalog-play catalog-muted">CATALOG ONLY · NOT A PLAYABLE ECHO</div>`;
    const task = encounter ? fieldTaskForEncounter(encounter.id) : undefined;
    const lesson = encounter
      ? `<div class="catalog-lesson">
          <div class="catalog-label">FIELD LESSON · ${encounter.title}</div>
          <p>${encounter.learning_intent}</p>
          <div class="catalog-label">HOW A GAME SIMPLIFIES IT</div>
          <p>${encounter.simplification_note}</p>
          ${task ? `<button class="btn catalog-task" data-task-id="${task.id}">▶ TRY THE FIELD TASK</button>` : ''}
        </div>`
      : '';
    return `
      <article class="catalog-card" aria-label="${m.name}">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px;">
          <h4 class="catalog-name">${m.name}</h4>
          <span class="badge ${badge}">${MISSION_STATUS_LABEL[m.status]}</span>
        </div>
        <p class="catalog-meta">${m.destination.toUpperCase()} · LAUNCHED ${year} · ${m.agencies.join(', ')}</p>
        <p class="catalog-meta">HARDWARE: ${m.hardware_types.join(', ')}</p>
        <div class="catalog-label">WHY IT WENT</div>
        <p>${m.objective}</p>
        <div class="catalog-label">WHAT IT FOUND</div>
        <p>${m.science_summary}</p>
        <div class="catalog-label">WHERE IT IS NOW</div>
        <p>${m.location_summary}</p>
        <p class="catalog-hook"><span class="catalog-label">STORY HOOK (DRAMATIZED)</span> "${m.story_hook}"</p>
        ${m.status_review_required_before_release ? `<p class="catalog-muted">Status can change: check the NASA page for the latest.</p>` : ''}
        ${lesson}
        ${playable}
        <div class="catalog-label">OFFICIAL SOURCES</div>
        <ul class="catalog-sources">
          ${sources}
          <li><a href="${m.media_page_url}" target="_blank" rel="noreferrer">NASA mission page ↗</a></li>
        </ul>
      </article>`;
  }

  /** UNIT-7's journal: one chapter per recovered echo, with the player's answers. */
  private renderJournal(): void {
    const ids = [...MOON_CHRONOLOGY, ...MARS_CHRONOLOGY, ...ELSEWHERE_CHRONOLOGY].filter((id) => GameState.isEntryRecovered(id));
    const theory = getTheory();
    const { counts, answered } = getMotiveTally();
    const total = MOON_CHRONOLOGY.length + MARS_CHRONOLOGY.length + ELSEWHERE_CHRONOLOGY.length;

    const bars = MOTIVE_IDS.map((m) => {
      const pct = answered ? Math.round((counts[m] / answered) * 100) : 0;
      return `
        <div style="display:flex; align-items:center; gap:8px; margin-top:6px; font-family:var(--font-mono); font-size:10px; color:${PALETTE.lunarCrustCream};">
          <span style="width:130px;">${STORY.motives[m].label.toUpperCase()}</span>
          <span style="flex:1; height:6px; background:${PALETTE.deepIndigo}; border:1px solid ${PALETTE.shadowNavy};"><span style="display:block; height:100%; width:${pct}%; background:${PALETTE.cyanGlow};"></span></span>
          <span style="width:20px; text-align:right;">${counts[m]}</span>
        </div>`;
    }).join('');

    const theoryHtml = `
      <div style="border:1px solid rgba(6,182,212,0.4); background:rgba(6,182,212,0.07); padding:16px 18px; margin-bottom:20px;">
        <div style="display:flex; justify-content:space-between; gap:8px; font-family:var(--font-mono); font-size:10px; color:${PALETTE.cyanGlow}; letter-spacing:0.06em;">
          <span>UNIT-7'S THEORY: WHY HUMANS GO</span>
          <span>${answered} / ${total} ANSWERS · GAME STORY</span>
        </div>
        <p style="font-size:15px; line-height:1.6; color:${PALETTE.lunarHighlight}; margin:10px 0 6px;">
          ${theory ? theory.text : 'Not enough data yet. Recover echoes and answer UNIT-7\'s questions. Its theory will grow from your answers.'}
        </p>
        ${answered ? bars : ''}
      </div>`;

    const chapters = ids.map((id, n) => {
      const site = getSiteStory(id);
      const entry = ALL_ENTRIES[id];
      if (!site || !entry) return '';
      const a = getAnswer(id);
      const answerHtml = a
        ? `<div style="margin-top:10px; font-size:12px; color:${PALETTE.lunarCrustCream};"><span style="font-family:var(--font-mono); font-size:10px; color:${PALETTE.slateMuted};">YOU ANSWERED ›</span> “${a.text}”
            <p style="margin:6px 0 0; font-size:12px; line-height:1.5; color:${PALETTE.cyanLaser};">UNIT-7: <span class="journal-reply" data-reply-for="${id}">${STORY.motives[a.motive].reply}</span></p></div>`
        : `<div role="group" aria-label="Answer UNIT-7" style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
            ${site.question.choices.map((c, i) => `<button class="btn journal-choice" data-entry-id="${id}" data-choice="${i}" style="justify-content:flex-start; text-align:left; white-space:normal; font-size:11px; padding:8px 10px;">${c.text}</button>`).join('')}
          </div>`;
      return `
        <article style="border-left:2px solid ${PALETTE.cyanDeep}; padding:4px 0 4px 16px; margin-bottom:22px;">
          <div style="font-family:var(--font-mono); font-size:10px; color:${PALETTE.slateMuted}; letter-spacing:0.06em;">CHAPTER ${n + 1} · ${entry.world.toUpperCase()} · ${entry.name.toUpperCase()}</div>
          <h3 style="font-family:var(--font-mono); font-size:14px; color:${PALETTE.cyanLaser}; margin:4px 0 8px;">${site.title}</h3>
          <p style="font-size:14px; line-height:1.6; color:${PALETTE.lunarHighlight}; margin:0;">${site.afterthought}</p>
          <p style="font-size:12px; line-height:1.5; color:${PALETTE.slateMuted}; margin:8px 0 0; font-style:italic;">${site.question.prompt}</p>
          ${answerHtml}
        </article>`;
    }).join('');

    this.container.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid ${PALETTE.shadowNavy}; padding-bottom:14px; gap:8px; flex-wrap:wrap;">
        <div>
          <h2 style="font-size:18px; font-weight:700; letter-spacing:0.02em; color:${PALETTE.lunarHighlight}; font-family:var(--font-mono);">UNIT-7 JOURNAL</h2>
          <p style="font-size:11px; font-family:var(--font-mono); color:${PALETTE.cyanGlow}; margin-top:2px;">WHAT THE ROBOT THINKS · SHAPED BY YOUR ANSWERS</p>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${this.tabsHtml()}
          <button id="btn-close-archive" class="btn">CLOSE [X]</button>
        </div>
      </div>
      <div style="max-width:720px; margin:0 auto;">
        ${theoryHtml}
        ${chapters || `<p style="font-family:var(--font-mono); font-size:12px; color:${PALETTE.slateMuted};">No chapters yet. The first echo is waiting on the surface.</p>`}
      </div>
    `;
    this.bindEvents();
    this.speakReply();
  }

  /** The reply to a just-answered chapter is spoken: typed out at UNIT-7's talking pace (clickable to skip). */
  private speakReply(): void {
    this.cancelTalk();
    this.cancelTalk = () => {};
    const id = this.speakReplyFor;
    this.speakReplyFor = null;
    if (!id) return;
    const el = this.container.querySelector<HTMLElement>(`.journal-reply[data-reply-for="${id}"]`);
    if (!el) return;
    const text = el.textContent ?? '';
    el.setAttribute('aria-label', text);
    this.cancelTalk = typeInto(el, text, {
      instant: GameState.getState().settings.reducedMotion,
    });
  }

  private bindEvents(): void {
    this.container.querySelectorAll('.archive-tab').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        this.tab = ((e.currentTarget as HTMLElement).dataset.tab as ArchiveTab) ?? 'archive';
        this.render();
      });
    });
    this.container.querySelectorAll('.journal-choice').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        GameState.setJournalAnswer(el.dataset.entryId!, parseInt(el.dataset.choice ?? '0', 10));
        this.speakReplyFor = el.dataset.entryId!;
        this.render();
      });
    });

    this.container.querySelector('#btn-close-archive')?.addEventListener('click', () => {
      this.container.classList.add('hidden');
    });

    this.container.querySelector<HTMLInputElement>('#chk-featured')?.addEventListener('change', (e) => {
      this.featuredOnly = (e.target as HTMLInputElement).checked;
      this.render();
    });
    this.container.querySelectorAll<HTMLElement>('.catalog-practice').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.classList.add('hidden');
        EventBus.emit(EVENTS.START_PRACTICE, btn.dataset.missionId!);
      });
    });
    this.container.querySelectorAll<HTMLElement>('.catalog-task').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.classList.add('hidden');
        EventBus.emit(EVENTS.OPEN_FIELD_TASK, btn.dataset.taskId!, () => {
          this.container.classList.remove('hidden');
          this.render();
        });
      });
    });
    this.container.querySelectorAll<HTMLElement>('.catalog-open').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.container.classList.add('hidden');
        EventBus.emit(EVENTS.OPEN_ENTRY, btn.dataset.entryId!, 'browse');
      });
    });

    const selectWorld = this.container.querySelector('#select-filter-world') as HTMLSelectElement;
    selectWorld?.addEventListener('change', (e) => {
      this.filterWorld = (e.target as HTMLSelectElement).value;
      this.render();
    });

    this.container.querySelectorAll('.artifact-card:not(.locked)').forEach(card => {
      card.addEventListener('click', (e) => {
        const id = (e.currentTarget as HTMLElement).dataset.entryId!;
        this.container.classList.add('hidden');
        EventBus.emit(EVENTS.OPEN_ENTRY, id, 'browse');
      });
    });
  }
}
