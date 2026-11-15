/**
 * Sector map (AI-assisted, human-reviewed). One simple map in the game's own art:
 * the sector's real terrain tile, each machine drawn with its in-game sprite at its
 * in-game position, UNIT-7 where you left it, and a dashed route to the next echo.
 * The real-world landing site is still named on each machine's card.
 */
import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { WorldId } from '../data/schema.ts';
import { ALL_ENTRIES, MOON_WORLD_COORDS, MARS_WORLD_COORDS, ELSEWHERE_WORLD_COORDS, WorldArtifactCoord } from '../data/entries.ts';
import { CONSTANTS } from '../core/Constants.ts';
import { getMinigameMetaForSite } from '../data/minigames.ts';
import { PixelArtGenerator } from '../systems/PixelArtGenerator.ts';

export { ALL_ENTRIES };

const WORLDS: ReadonlyArray<{ id: WorldId; label: string; locked: string }> = [
  { id: 'moon', label: 'MOON', locked: '' },
  { id: 'mars', label: 'MARS', locked: 'Out of range. Recover all 8 Moon echoes to ignite the Mars transfer stage.' },
  { id: 'elsewhere', label: 'DEEP SPACE', locked: 'Deep space telemetry offline. Recover all 9 Mars echoes to ignite the outer-system ion drive.' },
];

const COORDS: Record<WorldId, WorldArtifactCoord[]> = {
  moon: MOON_WORLD_COORDS,
  mars: MARS_WORLD_COORDS,
  elsewhere: ELSEWHERE_WORLD_COORDS,
};

type SiteState = 'done' | 'next' | 'locked';

/** Game textures as data URLs, generated once (the same pixel art the scenes use). */
const artCache = new Map<string, string>();
function art(key: string, make: () => HTMLCanvasElement): string {
  let url = artCache.get(key);
  if (!url) {
    try {
      url = make().toDataURL();
    } catch {
      url = '';
    }
    artCache.set(key, url);
  }
  return url;
}

function esc(text: string): string {
  return text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function formatCoord(lat: number, lon: number): string {
  const ns = `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'}`;
  const ew = `${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`;
  return `${ns} ${ew}`;
}

export class HubMap {
  private container: HTMLElement;
  private activeEntryId = '';

  constructor(container: HTMLElement) {
    this.container = container;
    this.container.setAttribute('role', 'dialog');
    this.container.setAttribute('aria-label', 'Sector map');
    this.render();

    EventBus.on(EVENTS.NAVIGATE_TO_HUB, () => {
      this.container.classList.remove('hidden');
      this.activeEntryId = '';
      this.render();
      // Keyboard players land on the close button; touch players do not get a focus ring
      if (!window.matchMedia('(pointer: coarse)').matches) {
        this.container.querySelector<HTMLElement>('#btn-close-hub')?.focus({ preventScroll: true });
      }
    });

    EventBus.on(EVENTS.ENTRY_UNLOCKED, () => {
      this.activeEntryId = '';
      this.render();
    });
  }

  private siteState(id: string): SiteState {
    if (GameState.isEntryRecovered(id)) return 'done';
    return GameState.isSiteActive(id) ? 'next' : 'locked';
  }

  render(): void {
    const world = GameState.getWorld();
    const coords = COORDS[world];
    if (!coords.some((c) => c.id === this.activeEntryId)) {
      this.activeEntryId = GameState.getNextTarget(world) ?? coords[0]?.id ?? '';
    }

    this.container.innerHTML = `
      <div class="hub">
        <header class="hub__bar">
          <h2 class="hub__title"><span class="hub__dot" aria-hidden="true"></span>SECTOR MAP</h2>
          <div class="hub__tabs" role="group" aria-label="Sector">${WORLDS.map((w) => this.tabHtml(w.id, w.label, world)).join('')}</div>
          <button type="button" id="btn-close-hub" class="btn hub__close">CLOSE <span aria-hidden="true">✕</span></button>
        </header>
        <p id="hub-notice" class="hub__notice" role="status" aria-live="polite" hidden></p>
        <div class="hub__body">
          ${this.mapHtml(world, coords)}
          <aside class="hub__side">
            <div id="marker-card-popover" class="hub__card-slot"></div>
            <ol class="hub__list" aria-label="Machines in this sector">${coords.map((c, i) => this.rowHtml(c, i)).join('')}</ol>
          </aside>
        </div>
      </div>
    `;

    this.bindEvents();
    this.select(this.activeEntryId, false);
  }

  private tabHtml(id: WorldId, label: string, current: WorldId): string {
    const unlocked = GameState.isWorldUnlocked(id);
    const found = GameState.getRecoveredCount(id);
    const total = COORDS[id].length;
    return `<button type="button" class="hub-tab hub-tab--${id} ${id === current ? 'is-current' : ''} ${unlocked ? '' : 'is-locked'}"
      data-world="${id}" aria-pressed="${id === current}" ${unlocked ? '' : 'aria-disabled="true"'}>
      <span>${label}</span><small>${unlocked ? `${found}/${total}` : 'LOCKED'}</small></button>`;
  }

  private mapHtml(world: WorldId, coords: WorldArtifactCoord[]): string {
    const { WORLD_WIDTH, WORLD_HEIGHT } = CONSTANTS.CANVAS;
    const pct = (v: number, max: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
    const tile = art(`tile_${world}`, () => PixelArtGenerator.createTerrainTile(world));
    const robot = art('robot', () => PixelArtGenerator.createRobotCanvas());
    const position = GameState.getRobotPosition(world);
    const nextId = GameState.getNextTarget(world);
    const spot = spreadPins(coords, WORLD_WIDTH, WORLD_HEIGHT);
    const nextC = coords.find((c) => c.id === nextId);
    const next = nextC ? spot.get(nextC.id) : undefined;

    const pins = coords.map((c, i) => {
      const state = this.siteState(c.id);
      const sprite = art(`hw_${c.id}`, () => PixelArtGenerator.createHardwareSprite(c.id, world));
      const at = spot.get(c.id) ?? c;
      return `<button type="button" class="hub-pin exploration-nav__site is-${state}" data-entry-id="${c.id}"
          style="left:${pct(at.x, WORLD_WIDTH)};top:${pct(at.y, WORLD_HEIGHT)}"
          aria-label="${i + 1}. ${esc(c.name)} (${state === 'done' ? 'recovered' : state === 'next' ? 'next echo' : 'locked'})">
          <img src="${sprite}" alt="" draggable="false" /><span class="hub-pin__num">${state === 'done' ? '✓' : i + 1}</span></button>`;
    }).join('');

    const route = position && next
      ? `<svg class="hub-map__route" viewBox="0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
          <line x1="${position.x}" y1="${position.y}" x2="${next.x}" y2="${next.y}" vector-effect="non-scaling-stroke" /></svg>`
      : '';

    const you = position
      ? `<span class="hub-you exploration-nav__you" style="left:${pct(position.x, WORLD_WIDTH)};top:${pct(position.y, WORLD_HEIGHT)}">
          <img src="${robot}" alt="" draggable="false" /><b>YOU</b></span>`
      : '';

    return `
      <div class="hub-map hub-map--${world}" style="--tile:url(${tile});--tile-w:${(256 / WORLD_WIDTH) * 100}%;--tile-h:${(256 / WORLD_HEIGHT) * 100}%"
           role="group" aria-label="${world === 'elsewhere' ? 'Deep space' : world} sector${position ? ', your position shown as YOU' : ''}">
        ${route}${pins}${you}
        <span class="hub-map__legend" aria-hidden="true"><i class="is-next"></i>NEXT <i class="is-done"></i>FOUND <i class="is-locked"></i>LATER</span>
      </div>`;
  }

  private rowHtml(c: WorldArtifactCoord, index: number): string {
    const state = this.siteState(c.id);
    const tag = state === 'done' ? 'FOUND' : state === 'next' ? 'NEXT' : c.year;
    return `<li><button type="button" class="hub-row is-${state}" data-entry-id="${c.id}">
      <span class="hub-row__num">${index + 1}</span><span class="hub-row__name">${esc(c.name)}</span><span class="hub-row__tag">${tag}</span></button></li>`;
  }

  private cardHtml(id: string): string {
    const entry = ALL_ENTRIES[id];
    if (!entry) return '';
    const state = this.siteState(id);
    const mg = getMinigameMetaForSite(id);
    const loc = entry.locations[0];
    const where = loc
      ? `${esc(loc.label)}${loc.approximate ? '' : ` · ${formatCoord(loc.lat, loc.lon)}`}`
      : '';
    const chip = state === 'done'
      ? '<span class="chip chip--record">RECOVERED</span>'
      : state === 'next' ? '<span class="chip chip--story">NEXT ECHO</span>' : '<span class="chip hub-chip--locked">LOCKED</span>';
    const nextName = ALL_ENTRIES[GameState.getNextTarget(entry.world) ?? '']?.name;
    const play = state === 'next'
      ? `<button type="button" class="btn btn--primary btn-direct-land" data-entry-id="${id}">PLAY ${mg.code}</button>`
      : '';
    const note = state === 'locked' && nextName
      ? `<p class="hub-card__note">Echoes are recovered in launch order. Next up: ${esc(nextName)}.</p>`
      : '';
    return `
      <article class="hub-card is-${state}">
        <div class="hub-card__head">${chip}<span class="hub-card__game">${esc(mg.title.toUpperCase())}</span></div>
        <h3 class="hub-card__name">${esc(entry.name)}</h3>
        <p class="hub-card__summary">${esc(entry.summary)}</p>
        ${where ? `<p class="hub-card__where"><span>REAL SITE</span>${where}</p>` : ''}
        ${note}
        <div class="hub-card__actions">
          <button type="button" class="btn btn-fly-here" data-entry-id="${id}">GO THERE</button>
          ${play}
        </div>
      </article>`;
  }

  /** Highlights a machine on the map and in the list, and shows its card. */
  private select(id: string, sound = true): void {
    if (!ALL_ENTRIES[id]) return;
    if (sound) SoundFX.playClick();
    this.activeEntryId = id;
    this.container.querySelectorAll<HTMLElement>('[data-entry-id]').forEach((el) => {
      if (el.closest('.hub-card')) return;
      el.classList.toggle('is-selected', el.dataset.entryId === id);
    });
    const slot = this.container.querySelector<HTMLElement>('#marker-card-popover');
    if (!slot) return;
    slot.innerHTML = this.cardHtml(id);
    slot.querySelector('.btn-fly-here')?.addEventListener('click', () => {
      SoundFX.playWhoosh();
      this.flyToSite(id);
    });
    slot.querySelector('.btn-direct-land')?.addEventListener('click', () => {
      SoundFX.playWhoosh();
      this.directLand(id);
    });
  }

  private bindEvents(): void {
    this.container.querySelector('#btn-close-hub')?.addEventListener('click', () => {
      SoundFX.playClick();
      this.container.classList.add('hidden');
    });

    this.container.querySelectorAll<HTMLButtonElement>('.hub-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        const world = tab.dataset.world as WorldId;
        if (world === GameState.getWorld()) return;
        if (!GameState.isWorldUnlocked(world)) {
          SoundFX.playCrash();
          this.showNotice(WORLDS.find((w) => w.id === world)?.locked ?? 'Locked.');
          return;
        }
        SoundFX.playWhoosh();
        GameState.setWorld(world);
        this.activeEntryId = '';
        this.render();
      });
    });

    this.container.querySelectorAll<HTMLElement>('.hub-pin, .hub-row').forEach((el) => {
      const id = el.dataset.entryId!;
      el.addEventListener('click', () => {
        if (el.classList.contains('hub-pin') && this.activeEntryId === id && el.classList.contains('is-selected')) {
          // Second tap on a selected machine: go there
          SoundFX.playWhoosh();
          this.flyToSite(id);
          return;
        }
        this.select(id);
        if (el.classList.contains('hub-row')) {
          this.container.querySelector('.hub__card-slot')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
      });
    });
  }

  private showNotice(message: string): void {
    const notice = this.container.querySelector<HTMLElement>('#hub-notice');
    if (!notice) return;
    notice.textContent = message;
    notice.hidden = false;
  }

  private flyToSite(siteId: string): void {
    const entry = ALL_ENTRIES[siteId];
    if (entry) {
      if (!GameState.isWorldUnlocked(entry.world)) return;
      GameState.setWorld(entry.world);
    }
    GameState.setCurrentSiteId(siteId);
    this.container.classList.add('hidden');
    EventBus.emit(EVENTS.NAVIGATE_TO_SITE, siteId);
  }

  private directLand(siteId: string): void {
    const entry = ALL_ENTRIES[siteId];
    if (!entry || !GameState.isSiteActive(siteId)) return;
    GameState.setWorld(entry.world);
    GameState.setCurrentSiteId(siteId);
    this.container.classList.add('hidden');
    EventBus.emit(EVENTS.START_LANDING, siteId);
  }
}

/**
 * Map positions for the pins. Sites that really are neighbours (Apollo 12 landed
 * beside Surveyor 3) are pushed apart a little so each one can be tapped.
 */
function spreadPins(coords: WorldArtifactCoord[], worldW: number, worldH: number): Map<string, { x: number; y: number }> {
  // Work in "% of map width" on both axes (the map is 3:2)
  const toW = (y: number) => (y / worldH) * (100 / 1.5);
  const pts = coords.map((c) => ({ id: c.id, x: (c.x / worldW) * 100, y: toW(c.y) }));
  const minD = 11; // about one pin wide on the narrowest (phone upright) map
  for (let pass = 0; pass < 6; pass++) {
    for (let i = 0; i < pts.length; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy);
        if (d >= minD) continue;
        if (d < 0.01) { dx = 1; dy = 0; d = 1; }
        const push = (minD - d) / 2;
        a.x -= (dx / d) * push; a.y -= (dy / d) * push;
        b.x += (dx / d) * push; b.y += (dy / d) * push;
      }
    }
  }
  const clamp = (v: number, max: number) => Math.max(4, Math.min(max - 4, v));
  return new Map(pts.map((p) => [p.id, {
    x: (clamp(p.x, 100) / 100) * worldW,
    y: (clamp(p.y, 100 / 1.5) / (100 / 1.5)) * worldH,
  }]));
}
