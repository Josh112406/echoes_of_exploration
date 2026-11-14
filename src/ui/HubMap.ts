import { GameState } from '../core/GameState.ts';
import { EventBus, EVENTS } from '../core/EventBus.ts';
import { SoundFX } from '../audio/SoundEffects.ts';
import { ArtifactEntry } from '../data/schema.ts';
import { ALL_ENTRIES } from '../data/entries.ts';
import { getMinigameMetaForSite } from '../data/minigames.ts';

export { ALL_ENTRIES };

export class HubMap {
  private container: HTMLElement;
  private isListView: boolean = false;
  private activeEntryId: string = 'apollo-11-site';

  constructor(container: HTMLElement) {
    this.container = container;
    this.render();

    EventBus.on(EVENTS.NAVIGATE_TO_HUB, () => {
      this.container.classList.remove('hidden');
      this.render();
    });

    EventBus.on(EVENTS.ENTRY_UNLOCKED, () => {
      this.render();
    });
  }

  render(): void {
    const currentWorld = GameState.getWorld();
    const marsUnlocked = GameState.isWorldUnlocked('mars');
    const elsewhereUnlocked = GameState.isWorldUnlocked('elsewhere');
    const entries = Object.values(ALL_ENTRIES).filter(e => e.world === currentWorld);

    if (!entries.find(e => e.id === this.activeEntryId)) {
      this.activeEntryId = entries[0]?.id || 'apollo-11-site';
    }

    this.container.innerHTML = `
      <!-- Editorial Hero Header Entrance -->
      <div class="hero-intro">
        <div style="display:flex; align-items:baseline; gap:12px; margin-bottom:4px; flex-wrap:wrap;">
          <h1 class="hero-title">ECHOES OF EXPLORATION</h1>
          <span class="badge badge--active" style="font-size:10px; font-family:var(--font-mono);">CATALOGUE // 23 NASA SITES · 3 SECTORS · 5 MINIGAMES</span>
        </div>
        <p class="hero-sub">
          The NASA Signal Archive. Authentic archival survey and mathematical simulation of real NASA hardware across the Moon, Mars, and deep space.
        </p>
      </div>

      <!-- Controls & World Toggles -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button id="btn-world-moon" class="btn ${currentWorld === 'moon' ? 'btn--primary' : ''}">
            [LUNA // ${Object.values(ALL_ENTRIES).filter(e => e.world === 'moon').length} SITES]
          </button>
          <button id="btn-world-mars" class="btn ${currentWorld === 'mars' ? 'btn--primary' : ''}">
            ${marsUnlocked ? '[MARS // ' : '[LOCKED // MARS // '}${Object.values(ALL_ENTRIES).filter(e => e.world === 'mars').length} SITES]
          </button>
          <button id="btn-world-elsewhere" class="btn ${currentWorld === 'elsewhere' ? 'btn--primary' : ''}">
            ${elsewhereUnlocked ? '[ELSEWHERE // ' : '[LOCKED // ELSEWHERE // '}${Object.values(ALL_ENTRIES).filter(e => e.world === 'elsewhere').length} SITES]
          </button>
        </div>
        <div style="display:flex; gap:8px;">
          <button id="btn-quick-land" class="btn" style="background:#0e2a38; border-color:#06b6d4; color:#38bdf8;">
            [SIMULATION: DIRECT MINIGAME]
          </button>
          <button id="btn-toggle-view" class="btn">
            ${this.isListView ? '[VIEW: PROJECTION MAP]' : '[VIEW: ROSTER TABLE]'}
          </button>
        </div>
      </div>

      <!-- Quick Landing Menu Dropdown (Initially Hidden) -->
      <div id="quick-land-menu" style="display:none; margin-bottom:16px; background:#131822; border:1px solid #06b6d4; border-radius:4px; padding:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
          <span style="font-size:11px; font-family:var(--font-mono); font-weight:700; color:#38bdf8; letter-spacing:0.06em;">DIRECT SIMULATION LAUNCH // SELECT HARDWARE SITE:</span>
          <button id="btn-close-quick-land" class="btn" style="padding:2px 8px; font-size:10px; font-family:var(--font-mono);">CLOSE [X]</button>
        </div>
        <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:6px;">
          ${Object.values(ALL_ENTRIES).map(e => {
            const mg = getMinigameMetaForSite(e.id);
            const sectorColor = e.world === 'moon' ? '#cbd5e1' : e.world === 'mars' ? '#f97316' : '#38bdf8';
            return `
              <button class="btn btn-direct-pick" data-entry-id="${e.id}" style="font-size:11px; padding:6px 10px; justify-content:space-between; text-align:left;">
                <span style="font-family:var(--font-mono); color:${sectorColor};">[${e.world.toUpperCase()}]</span>
                <span style="flex:1; margin-left:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.name}</span>
                <span style="font-family:var(--font-mono); color:#06b6d4; font-size:10px;">PLAY ${mg.code} &rarr;</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Main Surface Display -->
      ${this.isListView ? this.renderListView(entries) : this.renderMapView(entries, currentWorld)}
    `;

    this.bindEvents();

    if (!this.isListView) {
      this.showMarkerCard(this.activeEntryId);
    }
  }

  private renderMapView(entries: ArtifactEntry[], currentWorld: string): string {
    const mapSrc =
      currentWorld === 'moon'
        ? 'assets/maps/moon-map.jpg'
        : currentWorld === 'mars'
          ? 'assets/maps/mars-map.jpg'
          : 'assets/generated/scenes/scene-elsewhere-deep.png';

    // Collect all markers across entries
    const markersHtml = entries.flatMap(entry => {
      const isRecovered = GameState.isEntryRecovered(entry.id);
      return entry.locations.map(loc => {
        // Equirectangular projection percentage
        const leftPercent = ((loc.lon + 180) / 360) * 100;
        const topPercent = ((90 - loc.lat) / 180) * 100;
        const beaconColor = isRecovered ? '#f59e0b' : '#06b6d4';
        const isSelected = entry.id === this.activeEntryId;

        return `
          <div class="map-marker ${isSelected ? 'selected' : ''}"
               data-entry-id="${entry.id}"
               title="${loc.label} (${entry.name})"
               style="position:absolute; left:${leftPercent}%; top:${topPercent}%; transform:translate(-50%, -50%); cursor:pointer; z-index:10; padding:6px;">
            <div style="width:${isSelected ? '16px' : '12px'}; height:${isSelected ? '16px' : '12px'}; border-radius:50%; background:${beaconColor}; border:2px solid #ffffff; box-shadow:0 0 ${isSelected ? '14px' : '8px'} ${beaconColor}; transition:all 0.15s ease;"></div>
          </div>
        `;
      });
    }).join('');

    return `
      <div style="position:relative; width:100%; aspect-ratio:2/1; max-height:calc(100vh - 210px); background:#0e121a; border:1px solid rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">
        <img src="${mapSrc}" alt="${currentWorld} Surface Map" style="width:100%; height:100%; object-fit:cover; opacity:0.85;" />
        
        <!-- Celestial Graticule Coordinate Grid -->
        <svg class="map-graticule" viewBox="0 0 360 180" preserveAspectRatio="none" style="position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:4;">
          <!-- Parallels -->
          <line x1="0" y1="30" x2="360" y2="30" stroke="rgba(255,255,255,0.06)" stroke-width="0.5" stroke-dasharray="2 2" />
          <line x1="0" y1="60" x2="360" y2="60" stroke="rgba(255,255,255,0.06)" stroke-width="0.5" stroke-dasharray="2 2" />
          <line x1="0" y1="90" x2="360" y2="90" stroke="rgba(6,182,212,0.25)" stroke-width="0.75" />
          <line x1="0" y1="120" x2="360" y2="120" stroke="rgba(255,255,255,0.06)" stroke-width="0.5" stroke-dasharray="2 2" />
          <line x1="150" y1="150" x2="360" y2="150" stroke="rgba(255,255,255,0.06)" stroke-width="0.5" stroke-dasharray="2 2" />

          <!-- Meridians -->
          <line x1="60" y1="0" x2="60" y2="180" stroke="rgba(255,255,255,0.06)" stroke-width="0.5" stroke-dasharray="2 2" />
          <line x1="120" y1="0" x2="120" y2="180" stroke="rgba(255,255,255,0.06)" stroke-width="0.5" stroke-dasharray="2 2" />
          <line x1="180" y1="0" x2="180" y2="180" stroke="rgba(6,182,212,0.25)" stroke-width="0.75" />
          <line x1="240" y1="0" x2="240" y2="180" stroke="rgba(255,255,255,0.06)" stroke-width="0.5" stroke-dasharray="2 2" />
          <line x1="300" y1="0" x2="300" y2="180" stroke="rgba(255,255,255,0.06)" stroke-width="0.5" stroke-dasharray="2 2" />

          <!-- Telemetry Degree Badges -->
          <text x="3" y="32" fill="#94a3b8" font-size="3.5" font-family="monospace">+60°</text>
          <text x="3" y="62" fill="#94a3b8" font-size="3.5" font-family="monospace">+30°</text>
          <text x="3" y="92" fill="#06b6d4" font-size="3.5" font-family="monospace">0° EQ</text>
          <text x="3" y="122" fill="#94a3b8" font-size="3.5" font-family="monospace">-30°</text>
          <text x="3" y="152" fill="#94a3b8" font-size="3.5" font-family="monospace">-60°</text>
          <text x="182" y="7" fill="#06b6d4" font-size="3.5" font-family="monospace">0° MERIDIAN</text>
          <text x="62" y="7" fill="#94a3b8" font-size="3.5" font-family="monospace">-120°</text>
          <text x="302" y="7" fill="#94a3b8" font-size="3.5" font-family="monospace">+120°</text>
        </svg>

        ${markersHtml}

        <!-- Docked Telemetry Deck -->
        <div id="marker-card-popover"></div>
      </div>
    `;
  }

  private renderListView(entries: ArtifactEntry[]): string {
    const rows = entries.map(entry => {
      const isRecovered = GameState.isEntryRecovered(entry.id);
      const badgeClass = `badge--${entry.status}`;
      const mg = getMinigameMetaForSite(entry.id);

      return `
        <tr style="border-bottom:1px solid rgba(255,255,255,0.06); padding:8px;">
          <td style="padding:10px 8px;"><strong>${entry.name}</strong></td>
          <td style="padding:10px 8px;"><span class="badge ${badgeClass}">${entry.status}</span></td>
          <td style="padding:10px 8px; font-family:monospace; font-size:12px;">${entry.locations[0].lat.toFixed(4)}°, ${entry.locations[0].lon.toFixed(4)}°</td>
          <td style="padding:10px 8px; font-family:monospace; font-size:11px;">${isRecovered ? '<span style="color:#f59e0b;">ARCHIVED</span>' : '<span style="color:#06b6d4;">ACTIVE</span>'}</td>
          <td style="padding:10px 8px;">
            <div style="display:flex; gap:6px;">
              <button class="btn btn-fly-here" data-entry-id="${entry.id}">VISIT</button>
              ${GameState.isSiteActive(entry.id)
            ? `<button class="btn btn--primary btn-direct-land" data-entry-id="${entry.id}">PLAY ${mg.code} (60Hz)</button>`
            : `<button class="btn" disabled title="Echoes are recovered in launch order">LOCKED · RECOVER ${(ALL_ENTRIES[GameState.getNextTarget(entry.world) ?? '']?.name ?? 'THE PREVIOUS SECTOR').toUpperCase()} FIRST</button>`}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; text-align:left; font-size:13px;">
          <thead>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.15); color:#94a3b8; font-family:var(--font-mono); font-size:11px;">
              <th style="padding:8px;">MISSION HARDWARE</th>
              <th style="padding:8px;">STATUS</th>
              <th style="padding:8px;">COORDINATES</th>
              <th style="padding:8px;">RECORD</th>
              <th style="padding:8px;">DEPLOYMENT</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>
    `;
  }

  private bindEvents(): void {
    const btnMoon = this.container.querySelector('#btn-world-moon');
    const btnMars = this.container.querySelector('#btn-world-mars');
    const btnElsewhere = this.container.querySelector('#btn-world-elsewhere');
    const btnToggle = this.container.querySelector('#btn-toggle-view');
    const btnQuickLand = this.container.querySelector('#btn-quick-land');
    const quickMenu = this.container.querySelector('#quick-land-menu') as HTMLElement;
    const btnCloseQuick = this.container.querySelector('#btn-close-quick-land');

    btnMoon?.addEventListener('click', () => {
      SoundFX.playWhoosh();
      GameState.setWorld('moon');
      this.render();
    });

    btnMars?.addEventListener('click', () => {
      if (!GameState.isWorldUnlocked('mars')) {
        SoundFX.playCrash();
        alert('Out of range. Recover all 8 Moon echoes to ignite the Mars transfer stage.');
        return;
      }
      SoundFX.playWhoosh();
      GameState.setWorld('mars');
      this.render();
    });

    btnElsewhere?.addEventListener('click', () => {
      if (!GameState.isWorldUnlocked('elsewhere')) {
        SoundFX.playCrash();
        alert('Deep space telemetry offline. Recover all 9 Mars echoes to ignite the outer-system ion drive.');
        return;
      }
      SoundFX.playWhoosh();
      GameState.setWorld('elsewhere');
      this.render();
    });

    btnToggle?.addEventListener('click', () => {
      SoundFX.playClick();
      this.isListView = !this.isListView;
      this.render();
    });

    btnQuickLand?.addEventListener('click', () => {
      SoundFX.playClick();
      if (quickMenu) {
        quickMenu.style.display = quickMenu.style.display === 'none' ? 'block' : 'none';
      }
    });

    btnCloseQuick?.addEventListener('click', () => {
      if (quickMenu) quickMenu.style.display = 'none';
    });

    this.container.querySelectorAll('.btn-direct-pick').forEach(btn => {
      btn.addEventListener('click', (e) => {
        SoundFX.playWhoosh();
        const entryId = (e.currentTarget as HTMLElement).dataset.entryId!;
        this.directLand(entryId);
      });
    });

    // Marker clicks
    this.container.querySelectorAll('.map-marker').forEach(marker => {
      marker.addEventListener('mouseenter', () => {
        SoundFX.playClick();
      });
      marker.addEventListener('click', (e) => {
        SoundFX.playClick();
        const entryId = (e.currentTarget as HTMLElement).dataset.entryId!;
        this.activeEntryId = entryId;
        this.showMarkerCard(entryId);
      });
      marker.addEventListener('dblclick', (e) => {
        const entryId = (e.currentTarget as HTMLElement).dataset.entryId!;
        this.flyToSite(entryId);
      });
    });

    // Fly here buttons
    this.container.querySelectorAll('.btn-fly-here').forEach(btn => {
      btn.addEventListener('click', (e) => {
        SoundFX.playWhoosh();
        const entryId = (e.currentTarget as HTMLElement).dataset.entryId!;
        this.flyToSite(entryId);
      });
    });

    // Direct Land buttons
    this.container.querySelectorAll('.btn-direct-land').forEach(btn => {
      btn.addEventListener('click', (e) => {
        SoundFX.playWhoosh();
        const entryId = (e.currentTarget as HTMLElement).dataset.entryId!;
        this.directLand(entryId);
      });
    });
  }

  private showMarkerCard(entryId: string): void {
    const entry = ALL_ENTRIES[entryId];
    const cardContainer = this.container.querySelector('#marker-card-popover');
    if (!cardContainer || !entry) return;

    const isRecovered = GameState.isEntryRecovered(entryId);
    const badgeClass = `badge--${entry.status}`;
    const mg = getMinigameMetaForSite(entry.id);

    cardContainer.innerHTML = `
      <div class="telemetry-deck">
        <div>
          <div class="telemetry-tag">TELEMETRY LOCK // SECTOR ${entry.world.toUpperCase()} // ${mg.title.toUpperCase()}</div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="telemetry-name">${entry.name}</span>
            <span class="badge ${badgeClass}">${entry.status}</span>
            ${isRecovered ? '<span style="color:#f59e0b; font-size:10px; font-family:var(--font-mono);">[ARCHIVED]</span>' : '<span style="color:#06b6d4; font-size:10px; font-family:var(--font-mono);">[SIGNAL ACTIVE]</span>'}
          </div>
          <div class="telemetry-coords">${entry.locations[0].label} &bull; ${entry.locations[0].lat.toFixed(4)}° LAT, ${entry.locations[0].lon.toFixed(4)}° LON</div>
          <div class="telemetry-summary">${entry.summary}</div>
        </div>
        <div class="telemetry-actions">
          <button class="btn btn-fly-here" data-entry-id="${entry.id}">VISIT SECTOR</button>
          <button class="btn btn--primary btn-direct-land" data-entry-id="${entry.id}">PLAY ${mg.code} (60Hz)</button>
        </div>
      </div>
    `;

    cardContainer.querySelector('.btn-fly-here')?.addEventListener('click', () => {
      this.flyToSite(entry.id);
    });
    cardContainer.querySelector('.btn-direct-land')?.addEventListener('click', () => {
      this.directLand(entry.id);
    });
  }

  private flyToSite(siteId: string): void {
    GameState.setCurrentSiteId(siteId);
    this.container.classList.add('hidden');
    EventBus.emit(EVENTS.NAVIGATE_TO_SITE, siteId);
  }

  private directLand(siteId: string): void {
    GameState.setCurrentSiteId(siteId);
    this.container.classList.add('hidden');
    EventBus.emit(EVENTS.START_LANDING, siteId);
  }
}
