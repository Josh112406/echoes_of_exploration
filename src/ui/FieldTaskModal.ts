import { EventBus, EVENTS } from '../core/EventBus.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { getFieldTask, EvidenceTask, PowerTask, FieldTask } from '../data/fieldTasks.ts';
import { getSource } from '../data/catalog.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * Field tasks (src/data/fieldTasks.ts): the evidence step of the Viking and Voyager
 * encounters. Plain DOM, so it is keyboard and screen-reader friendly. Opened after
 * the echo's minigame (then its record opens) or from the Mission Catalog.
 */
export class FieldTaskModal {
  private container: HTMLElement;
  private task: FieldTask | null = null;
  private onDone: (() => void) | null = null;

  // Evidence state
  private picked: number | null = null;
  // Power state
  private round = 0;
  private on = new Set<string>();
  private roundChecked = false;

  constructor(container: HTMLElement) {
    this.container = container;
    EventBus.on(EVENTS.OPEN_FIELD_TASK, (id: string, onDone?: () => void) => this.open(id, onDone));
  }

  private open(id: string, onDone?: () => void): void {
    const task = getFieldTask(id);
    if (!task) {
      onDone?.();
      return;
    }
    this.task = task;
    this.onDone = onDone ?? null;
    this.picked = null;
    this.round = 0;
    this.roundChecked = false;
    if (task.kind === 'power') this.on = new Set(task.items.map((i) => i.id));
    this.container.classList.remove('hidden');
    this.render();
    this.container.querySelector<HTMLElement>('.ft-panel')?.focus();
  }

  private close(): void {
    this.container.classList.add('hidden');
    this.container.innerHTML = '';
    const done = this.onDone;
    this.onDone = null;
    this.task = null;
    done?.();
  }

  private render(): void {
    const t = this.task;
    if (!t) return;
    const body = t.kind === 'evidence' ? this.evidenceHtml(t) : this.powerHtml(t);
    const sources = t.sourceIds
      .map(getSource)
      .filter((s) => !!s)
      .map((s) => `<a href="${esc(s!.url)}" target="_blank" rel="noreferrer">${esc(s!.organization)} · ${esc(s!.title)} ↗</a>`)
      .join(' ');
    this.container.innerHTML = `
      <section class="ft-panel" role="dialog" aria-modal="true" aria-labelledby="ft-title" tabindex="-1">
        <header class="ft-head">
          <div>
            <p class="ft-kicker">FIELD TASK · SIMPLIFIED FROM THE REAL MISSION</p>
            <h2 id="ft-title">${esc(t.title)}</h2>
          </div>
          <button class="btn" id="btn-close-fieldtask">${this.onDone ? 'SKIP TO RECORD ➔' : 'CLOSE [X]'}</button>
        </header>
        <p class="ft-intro">${esc(t.intro)}</p>
        ${body}
        <p class="ft-sources">SOURCES: ${sources}</p>
      </section>`;
    this.bind();
  }

  // ---------------------------------------------------------------------------
  // Viking: evidence → conclusion
  // ---------------------------------------------------------------------------

  private evidenceHtml(t: EvidenceTask): string {
    const cards = t.cards.map((c) => `
      <article class="ft-card">
        <h3>${esc(c.name)}</h3>
        <p><span class="ft-label">TEST</span> ${esc(c.test)}</p>
        <p><span class="ft-label">RESULT</span> ${esc(c.result)}</p>
      </article>`).join('');
    const solved = this.picked !== null && t.conclusions[this.picked].correct;
    const choices = t.conclusions.map((c, i) => {
      const state = this.picked === i ? (c.correct ? 'is-right' : 'is-wrong') : '';
      return `<button class="btn ft-choice ${state}" data-choice="${i}" ${solved ? 'disabled' : ''} aria-pressed="${this.picked === i}">${esc(c.text)}</button>`;
    }).join('');
    const feedback = this.picked !== null
      ? `<p class="ft-feedback ${t.conclusions[this.picked].correct ? 'is-right' : 'is-wrong'}" role="status">${esc(t.conclusions[this.picked].feedback)}</p>`
      : '<p class="ft-feedback" role="status"></p>';
    return `
      <div class="ft-cards">${cards}</div>
      <h3 class="ft-prompt">${esc(t.prompt)}</h3>
      <div class="ft-choices" role="group" aria-label="Conclusions">${choices}</div>
      ${feedback}
      ${solved ? `<p class="ft-epilogue">${esc(t.epilogue)}</p>${this.doneButton()}` : ''}`;
  }

  // ---------------------------------------------------------------------------
  // Voyager: share a shrinking power supply
  // ---------------------------------------------------------------------------

  private powerHtml(t: PowerTask): string {
    if (this.round >= t.rounds.length) {
      return `<p class="ft-epilogue">${esc(t.epilogue)}</p>
        <p><a href="${esc(t.statusUrl)}" target="_blank" rel="noreferrer">NASA · Where are Voyager 1 and 2 now? ↗</a></p>
        ${this.doneButton()}`;
    }
    const r = t.rounds[this.round];
    const used = t.items.filter((i) => this.on.has(i.id)).reduce((s, i) => s + i.cost, 0);
    const over = used > r.budget;
    const meter = Array.from({ length: Math.max(r.budget, used) }, (_v, k) =>
      `<span class="ft-cell ${k < used ? (k < r.budget ? 'is-used' : 'is-over') : ''}"></span>`).join('');
    const items = t.items.map((i) => `
      <label class="ft-item ${i.locked ? 'is-locked' : ''}">
        <input type="checkbox" data-item="${i.id}" ${this.on.has(i.id) ? 'checked' : ''} ${i.locked || this.roundChecked ? 'disabled' : ''} />
        <span class="ft-item-name">${esc(i.name)} <em>${i.cost} UNIT${i.cost > 1 ? 'S' : ''}</em></span>
        <span class="ft-item-what">${esc(i.what)}${i.locked ? ' (always on)' : ''}</span>
      </label>`).join('');
    let feedback = '';
    if (this.roundChecked) {
      const hint = r.hint && this.on.has(r.hint.ifOn) ? r.hint.text : r.good;
      feedback = `<p class="ft-feedback is-right" role="status">${esc(hint)}</p>
        <button class="btn btn--primary" id="btn-ft-next">${this.round + 1 < t.rounds.length ? 'NEXT ERA ➔' : 'FINISH ➔'}</button>`;
    } else {
      const fields = t.items.some((i) => i.fields && this.on.has(i.id));
      const problem = over
        ? `Over budget by ${used - r.budget}. Switch something off.`
        : !fields ? 'Keep at least one instrument that measures fields or particles, or there is nothing to send home.' : '';
      feedback = `<p class="ft-feedback ${problem ? 'is-wrong' : ''}" role="status">${esc(problem)}</p>
        <button class="btn btn--primary" id="btn-ft-check" ${problem ? 'disabled' : ''}>LOCK IN THIS PLAN</button>`;
    }
    return `
      <div class="ft-era">
        <strong>${esc(r.label)}</strong> · ERA ${this.round + 1} OF ${t.rounds.length}
        <p>${esc(r.situation)}</p>
      </div>
      <div class="ft-meter" aria-label="Power used ${used} of ${r.budget} units">${meter}<span class="ft-meter-label">${used} / ${r.budget} UNITS</span></div>
      <div class="ft-items">${items}</div>
      ${feedback}`;
  }

  private doneButton(): string {
    return `<button class="btn btn--primary" id="btn-ft-done">${this.onDone ? 'OPEN THE RECORD ➔' : 'DONE'}</button>`;
  }

  private bind(): void {
    const q = <T extends HTMLElement>(sel: string) => this.container.querySelector<T>(sel);
    q('#btn-close-fieldtask')?.addEventListener('click', () => { SoundFX.playClick(); this.close(); });
    q('#btn-ft-done')?.addEventListener('click', () => { SoundFX.playClick(); this.close(); });
    this.container.querySelectorAll<HTMLButtonElement>('.ft-choice').forEach((b) => b.addEventListener('click', () => {
      const t = this.task as EvidenceTask;
      this.picked = Number(b.dataset.choice);
      if (t.conclusions[this.picked].correct) SoundFX.playChime(2);
      else SoundFX.playBuzz();
      this.render();
      this.container.querySelector<HTMLElement>('.ft-feedback')?.focus?.();
    }));
    this.container.querySelectorAll<HTMLInputElement>('input[data-item]').forEach((cb) => cb.addEventListener('change', () => {
      const id = cb.dataset.item!;
      if (cb.checked) this.on.add(id); else this.on.delete(id);
      SoundFX.playClick();
      this.render();
      this.container.querySelector<HTMLInputElement>(`input[data-item="${id}"]`)?.focus();
    }));
    q('#btn-ft-check')?.addEventListener('click', () => {
      this.roundChecked = true;
      SoundFX.playChime(this.round);
      this.render();
      q('#btn-ft-next')?.focus();
    });
    q('#btn-ft-next')?.addEventListener('click', () => {
      this.round++;
      this.roundChecked = false;
      SoundFX.playClick();
      this.render();
    });
  }
}
