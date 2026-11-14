import { EventBus, EVENTS } from '../core/EventBus.ts';
import { PALETTE } from './theme.ts';
import { ALL_ENTRIES } from '../data/entries.ts';
import { MISSIONS, SOURCES } from '../data/catalog.ts';
import { sourceHost } from '../data/story.ts';
import { SOFTWARE, MAPS, FONT_CREDIT, ART_CREDIT, AUDIO_CREDIT, AI_DISCLOSURE, MEDIA_GUIDELINES_URL } from '../data/credits.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const link = (url: string, label: string) => `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)} ↗</a>`;

/**
 * About, methodology and the full References list (RULES.md §1.4): NASA sources,
 * image credits, maps, fonts, software, audio, AI-assistance disclosure and the
 * NASA non-endorsement statement (§1.5). Everything is generated from the data
 * files, so a new source or image shows up here automatically.
 */
export class AboutModal {
  private container: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;

    EventBus.on(EVENTS.OPEN_ABOUT, () => {
      this.container.classList.remove('hidden');
      this.render();
    });
  }

  render(): void {
    const entries = Object.values(ALL_ENTRIES);
    const citations = [...new Set(entries.flatMap((e) => [
      ...e.sources,
      ...e.facts.map((f) => f.source_url),
      ...e.locations.map((l) => l.source_url),
    ]))].sort();
    const h = (t: string, color: string = PALETTE.cyanLaser) => `<h3 style="font-size:12px; letter-spacing:0.06em; color:${color}; margin:0 0 4px;">${t}</h3>`;
    const list = (items: string[]) => `<ul class="about-list">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;

    this.container.innerHTML = `
      <div class="about-panel" role="dialog" aria-labelledby="about-title" style="background:${PALETTE.deepIndigo}; border:1px solid ${PALETTE.cyanGlow};">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:16px; border-bottom:1px solid ${PALETTE.shadowNavy}; padding-bottom:12px;">
          <h2 id="about-title" style="font-size:15px; font-weight:700; letter-spacing:0.04em; color:${PALETTE.lunarHighlight}; font-family:var(--font-mono); margin:0;">ABOUT ECHOES OF EXPLORATION</h2>
          <button id="btn-close-about" class="btn">CLOSE [X]</button>
        </div>

        <div class="about-body" style="color:${PALETTE.lunarCrustCream};">
          <section>
            <p><em>Echoes of Exploration</em> is an educational exploration game for ages 10–13 (and anyone curious) about the hardware humanity left on the Moon, on Mars and out in deep space. You play ${entries.length} of these machines as "echoes", and the archive's mission catalog covers ${MISSIONS.length} NASA missions in all.</p>
          </section>

          <section>
            ${h('HOW WE KEEP IT ACCURATE', PALETTE.beaconGold)}
            <p>Every date, location, status and factual claim links to an official source: NASA, JPL, NSSDCA or the Planetary Data System. Each echo lists who wrote it and a different team member who verified it.</p>
            <p>The robot UNIT-7, its "echoes", and the story hooks written in a machine's voice are <strong>fiction</strong>. They are always marked as story or dramatized. Real spacecraft are not conscious, and dormant hardware does not transmit. The minigames simplify how the missions worked; the archive says how.</p>
          </section>

          <section>
            ${h('NOT A NASA PRODUCT', PALETTE.beaconGold)}
            <p>This is a student team project for the NASA International Space Apps Challenge 2026. It is not made, sponsored or endorsed by NASA. NASA imagery is used following the ${link(MEDIA_GUIDELINES_URL, 'NASA Images and Media Usage Guidelines')}; the NASA insignia is not used. NASA does not endorse any non-U.S. Government entity and is not responsible for information on non-U.S. Government websites linked here.</p>
          </section>

          <section>
            ${h('AI ASSISTANCE DISCLOSURE', PALETTE.beaconGold)}
            <p>${esc(AI_DISCLOSURE)}</p>
          </section>

          <section>
            ${h('PRIVACY')}
            <p>No accounts, no cookies, no tracking. Progress is saved only in this browser (localStorage). The game makes no network calls to outside services while you play; links open official pages in a new tab.</p>
          </section>

          <section>
            ${h('REFERENCES')}
            <details open>
              <summary>NASA mission catalog sources (${SOURCES.length})</summary>
              ${list(SOURCES.map((s) => `${esc(s.organization)}: ${link(s.url, s.title)}`))}
            </details>
            <details>
              <summary>Echo citations (${citations.length})</summary>
              ${list(citations.map((u) => link(u, `${sourceHost(u)}${new URL(u).pathname}`)))}
            </details>
            <details>
              <summary>Photographs (${entries.length}), all NASA public-domain imagery</summary>
              ${list(entries.map((e) => `${esc(e.name)}: ${esc(e.image.nasa_id)} · ${esc(e.image.credit)} · ${link(e.image.source_url, 'NASA Image Library')}`))}
            </details>
            <details>
              <summary>Maps, fonts, audio and software</summary>
              ${list([
                ...MAPS.map(([n, c, u]) => `${esc(n)} · ${esc(c)} · ${link(u, 'source')}`),
                esc(ART_CREDIT),
                `${esc(FONT_CREDIT.text)} · ${link(FONT_CREDIT.licencePath.replace(/^public\//, ''), 'licence')} · ${link(FONT_CREDIT.sourceUrl, 'source')}`,
                esc(AUDIO_CREDIT),
                ...SOFTWARE.map(([n, l, u]) => `${esc(n)} · ${l} licence · ${link(u, 'source')}`),
              ])}
            </details>
          </section>
        </div>
      </div>
    `;

    this.container.querySelector('#btn-close-about')?.addEventListener('click', () => {
      this.container.classList.add('hidden');
    });
  }
}
