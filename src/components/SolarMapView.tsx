import { useState } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';
import campaignData from '../data/campaign.json';
import encountersData from '../data/encounters.json';
import missionsData from '../data/missions.json';

interface SolarMapViewProps {
  completedEncounters: string[];
  onLaunchEncounter: (missionId: string, encounterId: string) => void;
  onInspectMission: (missionId: string) => void;
}

export function SolarMapView({
  completedEncounters,
  onLaunchEncounter,
  onInspectMission,
}: SolarMapViewProps) {
  const [listView, setListView] = useState(false);

  return (
    <section className="section-stack" aria-label="Solar System and Chapter Map">
      <div className="panel notch-corner section-header-panel">
        <div>
          <span className="pill-tag pill-cyan">SOLAR SYSTEM & OBSERVATORY WINGS</span>
          <h2>Expedition Flight Map</h2>
          <p className="muted-caption">
            Trace signal echoes outward from Earth across the Moon, Mars, 433 Eros, Jupiter,
            Saturn, Pluto, and interstellar space. All 9 launch encounters are open—explore in
            sequence or jump freely.
          </p>
        </div>
        <button
          type="button"
          className="btn"
          aria-pressed={listView}
          onClick={() => {
            telemetryAudio.playChirp(620, 0.04, 'Toggled map view mode');
            setListView((v) => !v);
          }}
        >
          {listView ? 'SWITCH TO VISUAL MAP' : 'ACCESSIBLE LIST VIEW'}
        </button>
      </div>

      {!listView ? (
        <div className="solar-orbit-strip panel notch-corner">
          <div className="orbit-node orbit-earth">
            <img
              src="/assets/generated/bodies/earth.png"
              alt="Earth Observatory illustration"
              className="planet-thumb pixel-art"
            />
            <span className="kv-label">ORIGIN</span>
            <strong>Earth Observatory</strong>
            <span className="muted-caption">Deep Space Network</span>
          </div>

          <span className="orbit-connector" aria-hidden="true">
            ····→
          </span>

          <div className="orbit-node">
            <img
              src="/assets/generated/bodies/moon.png"
              alt="Moon celestial globe illustration"
              className="planet-thumb pixel-art"
            />
            <span className="kv-label">CHAPTER I</span>
            <strong>The Moon</strong>
            <span className="muted-caption">
              {
                campaignData.chapters[0].encounter_ids.filter((id) =>
                  completedEncounters.includes(id)
                ).length
              }{' '}
              / 3 Signals
            </span>
          </div>

          <span className="orbit-connector" aria-hidden="true">
            ····→
          </span>

          <div className="orbit-node">
            <img
              src="/assets/generated/bodies/mars.png"
              alt="Mars celestial globe illustration"
              className="planet-thumb pixel-art"
            />
            <span className="kv-label">CHAPTER II</span>
            <strong>Mars</strong>
            <span className="muted-caption">
              {
                campaignData.chapters[1].encounter_ids.filter((id) =>
                  completedEncounters.includes(id)
                ).length
              }{' '}
              / 3 Signals
            </span>
          </div>

          <span className="orbit-connector" aria-hidden="true">
            ····→
          </span>

          <div className="orbit-node">
            <div className="multi-body-cluster">
              <img
                src="/assets/generated/bodies/eros.png"
                alt="433 Eros asteroid illustration"
                className="planet-mini pixel-art"
              />
              <img
                src="/assets/generated/bodies/saturn.png"
                alt="Saturn planet illustration"
                className="planet-mini pixel-art"
              />
              <img
                src="/assets/generated/bodies/pluto.png"
                alt="Pluto dwarf planet illustration"
                className="planet-mini pixel-art"
              />
            </div>
            <span className="kv-label">CHAPTER III</span>
            <strong>Elsewhere</strong>
            <span className="muted-caption">
              {
                campaignData.chapters[2].encounter_ids.filter((id) =>
                  completedEncounters.includes(id)
                ).length
              }{' '}
              / 3 Signals
            </span>
          </div>
        </div>
      ) : null}

      <div className="chapters-stack">
        {campaignData.chapters.map((chapter) => {
          const doneCount = chapter.encounter_ids.filter((id) =>
            completedEncounters.includes(id)
          ).length;

          return (
            <article key={chapter.id} className="panel notch-corner chapter-card">
              <div className="chapter-banner">
                <img
                  src={chapter.body_image}
                  alt={`${chapter.title} celestial illustration`}
                  className="chapter-globe pixel-art"
                />
                <div className="chapter-info">
                  <div className="modal-badges">
                    <span className="pill-tag pill-amber">CHAPTER {chapter.order}</span>
                    <span className="pill-tag pill-cyan">
                      {doneCount} / {chapter.encounter_ids.length} RECONSTRUCTED
                    </span>
                  </div>
                  <h3>{chapter.title}</h3>
                  <p className="record-paragraph">{chapter.theme}</p>
                </div>
              </div>

              <div className={listView ? 'encounter-list-rows' : 'encounter-pedestal-grid'}>
                {chapter.encounter_ids.map((encId) => {
                  const enc = encountersData.encounters.find((e) => e.id === encId);
                  const camp = campaignData.encounters.find((e) => e.id === encId);
                  const mission = missionsData.records.find(
                    (m) => m.id === enc?.mission_id
                  );
                  if (!enc || !camp || !mission) return null;
                  const done = completedEncounters.includes(enc.id);

                  return (
                    <div
                      key={enc.id}
                      className={`pedestal-card ${done ? 'pedestal-complete' : ''}`}
                    >
                      <div className="pedestal-head">
                        <img
                          src={camp.sprite}
                          alt={`${mission.name} spacecraft illustration`}
                          className="pedestal-sprite pixel-art"
                        />
                        <div>
                          <span className="kv-label">SIGNAL #{enc.order}</span>
                          <h4>{enc.title}</h4>
                          <p className="muted-caption">{mission.name}</p>
                        </div>
                        {done && (
                          <img
                            src={camp.patch_image}
                            alt={`${camp.patch_name} unlocked badge`}
                            className="patch-mini pixel-art"
                          />
                        )}
                      </div>
                      <p className="pedestal-task">{enc.player_task}</p>
                      <div className="pedestal-actions">
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => onLaunchEncounter(mission.id, enc.id)}
                        >
                          {done ? 'REPLAY ECHO' : 'RECONSTRUCT SIGNAL'}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => onInspectMission(mission.id)}
                        >
                          DOSSIER
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="discovery-bridge-box voice-record">
                <span className="pill-tag pill-amber">
                  {chapter.discovery_bridge.title.toUpperCase()}
                </span>
                <p>{chapter.discovery_bridge.summary}</p>
                <div className="bridge-chain">
                  {chapter.discovery_bridge.chain.map((link, idx) => (
                    <span key={link} className="bridge-pill">
                      {idx > 0 ? '→ ' : ''}
                      {link}
                    </span>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
