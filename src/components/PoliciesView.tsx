import { useState } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';
import {
  AI_ASSISTANCE_LEDGER,
  ASSET_LEDGER,
  CLAIM_LEDGER,
} from '../data/ledgers';
import sourcesData from '../data/sources.json';

type PolicyTab = 'sources' | 'privacy' | 'copyright' | 'accessibility' | 'credits';

export function PoliciesView() {
  const [tab, setTab] = useState<PolicyTab>('sources');

  return (
    <section className="section-stack" aria-label="Policies, Sources and Provenance">
      <div className="panel notch-corner section-header-panel">
        <div>
          <span className="pill-tag pill-amber">PROVENANCE, SOURCES & POLICIES</span>
          <h2>Observatory Documentation & Compliance</h2>
          <p className="muted-caption">
            Every mission record traces to official NASA/ILRS sources, every dramatized voice is
            labeled as a Memory Echo, and all code/assets carry explicit open licenses.
          </p>
        </div>
      </div>

      <div className="layer-tabs" role="tablist" aria-label="Policy sections">
        {(
          [
            { id: 'sources', label: 'Sources & Claim Ledger' },
            { id: 'privacy', label: 'Privacy Policy' },
            { id: 'copyright', label: 'Copyright & Asset Ledger' },
            { id: 'accessibility', label: 'Accessibility Statement' },
            { id: 'credits', label: 'Credits & AI Ledger' },
          ] as Array<{ id: PolicyTab; label: string }>
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`stage-chip ${tab === t.id ? 'active' : ''}`}
            onClick={() => {
              telemetryAudio.playChirp(580, 0.04);
              setTab(t.id);
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sources' && (
        <div className="panel notch-corner policy-card">
          <h3>Claim Verification Ledger (9 Launch Encounters)</h3>
          <p className="record-paragraph">
            Verified scientific statements vs. deliberate simplifications are audited directly below:
          </p>
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Mission</th>
                  <th>Verified Claim</th>
                  <th>Qualification / Review Note</th>
                  <th>Primary Source</th>
                </tr>
              </thead>
              <tbody>
                {CLAIM_LEDGER.map((row) => {
                  const src = sourcesData.sources.find(
                    (s) => s.id === row.primarySourceId
                  );
                  return (
                    <tr key={row.claimId}>
                      <td>
                        <code>{row.missionId}</code>
                      </td>
                      <td>{row.publishedWording}</td>
                      <td>
                        {row.confidenceNote} ({row.reviewer} · {row.reviewedOn})
                      </td>
                      <td>
                        {src ? (
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noreferrer"
                            className="citation-link"
                          >
                            {src.title} ↗
                          </a>
                        ) : (
                          row.primarySourceId
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3 className="mt-section">All Official Archive Sources ({sourcesData.sources.length})</h3>
          <div className="sources-grid">
            {sourcesData.sources.map((src) => (
              <div key={src.id} className="source-row">
                <span className="pill-tag">{src.tier}</span>
                <a href={src.url} target="_blank" rel="noreferrer" className="citation-link">
                  [{src.organization}] {src.title} ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'privacy' && (
        <div className="panel notch-corner policy-card">
          <h3>Privacy Policy — Zero Tracking, Local-Only Storage</h3>
          <ul className="policy-list">
            <li>
              <strong>Zero Backend / Zero Runtime Network Calls:</strong> This application runs
              100% inside your browser using static bundled JSON and assets. It never calls{' '}
              <code>api.nasa.gov</code> or external telemetry servers at runtime.
            </li>
            <li>
              <strong>Local Storage Only:</strong> Call sign, completed echoes, unlocked patches,
              bookmarks, and accessibility preferences are stored strictly inside your browser under{' '}
              <code>localStorage</code> keys <code>echoes_save_v1</code> and{' '}
              <code>echoes_corrupt_backup</code>.
            </li>
            <li>
              <strong>Zero Cookies & Zero Analytics:</strong> No tracking cookies, session beacons,
              or third-party scripts are loaded. Exporting/deleting your save data takes one click
              in Settings.
            </li>
          </ul>
        </div>
      )}

      {tab === 'copyright' && (
        <div className="panel notch-corner policy-card">
          <h3>Copyright, NASA Trademark Compliance & Asset Ledger</h3>
          <ul className="policy-list">
            <li>
              <strong>Open Licensing:</strong> Source code is licensed under{' '}
              <code>Apache-2.0</code> (<code>LICENSE</code>). Original narrative writing, schemas,
              and procedural 16-bit illustrations are released under <code>CC0-1.0</code> (
              <code>LICENSE-CONTENT</code>).
            </li>
            <li>
              <strong>No NASA Insignia / Endorsement:</strong> Per NASA Media Usage Guidelines,
              this fan-created educational archive contains zero NASA “meatball”, “worm”, or
              program logos, and does not claim NASA endorsement.
            </li>
            <li>
              <strong>Visual Attribution:</strong> In-game sprites, globes, patches, and scenes are
              clearly badged <code>SI-GENERATED ILLUSTRATION · CC0</code>. Official NASA photographs
              are referenced by hyperlink to authentic NASA mission media galleries.
            </li>
          </ul>

          <h3 className="mt-section">Asset Provenance Ledger</h3>
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Asset Path / Group</th>
                  <th>Origin & Creator</th>
                  <th>License</th>
                  <th>Disclosure Label</th>
                </tr>
              </thead>
              <tbody>
                {ASSET_LEDGER.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <code>{a.path}</code>
                    </td>
                    <td>
                      {a.origin} — {a.creator}
                    </td>
                    <td>
                      <code>{a.license}</code>
                    </td>
                    <td>{a.disclosureLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'accessibility' && (
        <div className="panel notch-corner policy-card">
          <h3>Accessibility Statement (WCAG 2.2 AA Target)</h3>
          <ul className="policy-list">
            <li>
              <strong>Keyboard Navigation:</strong> All observatory tabs, modal dossiers, catalog
              filters, and mission encounters are operable via keyboard (<code>Tab</code>,{' '}
              <code>Enter</code>, <code>Escape</code> to close/pause, <code>P</code> to pause active
              telemetry, and Skip-to-Content link).
            </li>
            <li>
              <strong>Non-Canvas Discrete Alternative:</strong> Every canvas simulation provides an
              instant <code>Accessible Choice Mode</code> presenting the identical scientific tradeoff
              without timing or pointer dexterity pressure.
            </li>
            <li>
              <strong>Visual & Audio Accommodation:</strong> Independent Master Mute, SFX/Synth
              sliders, Live Visual Audio Transcripts (<code>[AUDIO: ...]</code>), 115%/130% text
              scaling, High Contrast palette mode, and Reduced Motion mode.
            </li>
          </ul>
        </div>
      )}

      {tab === 'credits' && (
        <div className="panel notch-corner policy-card">
          <h3>Credits & AI Assistance Ledger</h3>
          <p className="record-paragraph">
            Built for NASA Space Apps Challenge — Echoes of Exploration: The NASA Signal Archive by
            a cross-functional team spanning Architecture, Gameplay, Art Direction, Science
            Writing, Audio/QA, and Data Curation.
          </p>

          <h3 className="mt-section">AI Assistance Disclosure Ledger</h3>
          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>System / Model</th>
                  <th>Objective</th>
                  <th>Human Verification Status</th>
                </tr>
              </thead>
              <tbody>
                {AI_ASSISTANCE_LEDGER.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.toolAndModel}</td>
                    <td>{entry.promptObjective}</td>
                    <td>
                      {entry.verificationStatus} ({entry.humanReviewer}) — {entry.notes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
