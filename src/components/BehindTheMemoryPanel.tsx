import type { NarrativeEncounter, SourceRecord } from '../data/types';

interface BehindTheMemoryPanelProps {
  encounter: NarrativeEncounter;
  sourcesMap: Map<string, SourceRecord>;
  sectionLabels: Record<string, string>;
}

export function BehindTheMemoryPanel({
  encounter,
  sourcesMap,
  sectionLabels,
}: BehindTheMemoryPanelProps) {
  const { behind_the_memory: btm } = encounter;

  const resolvedSources = btm.source_ids
    .map((id) => sourcesMap.get(id))
    .filter((s): s is SourceRecord => Boolean(s));

  return (
    <section
      className="voice-card voice-record"
      aria-label={`Behind the Memory: ${encounter.title}`}
    >
      <div className="c-head">
        <span className="tag-record">Verified record · Behind the Memory</span>
        <span className="mono muted" style={{ fontSize: '12px' }}>
          Encounter #{String(encounter.order).padStart(2, '0')} · {encounter.id}
        </span>
      </div>

      <div>
        <div className="eyebrow" style={{ marginBottom: '4px' }}>
          Factual Mission Record
        </div>
        <h3>{btm.headline}</h3>
      </div>

      <p style={{ color: 'var(--crust)', fontSize: '15px' }}>{btm.summary}</p>

      {/* Key numbers */}
      {btm.key_numbers.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: '8px', color: 'var(--amber)' }}>
            {sectionLabels.key_numbers || 'Key numbers'}
          </div>
          <div className="readout-grid">
            {btm.key_numbers.map((item) => (
              <div key={item.label} className="readout-cell">
                <span className="k">{item.label}</span>
                <span className="v">{item.value}</span>
                <span className="mono muted" style={{ fontSize: '10px' }}>
                  src: {item.source_id}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* What happened */}
      <div>
        <div className="label" style={{ marginBottom: '6px', color: 'var(--amber)' }}>
          {sectionLabels.what_happened || 'What happened'}
        </div>
        <ul style={{ paddingLeft: '18px', display: 'grid', gap: '6px', color: 'var(--ink)' }}>
          {btm.what_happened.map((line, idx) => (
            <li key={idx}>{line}</li>
          ))}
        </ul>
      </div>

      {/* Why it matters + Simplifies */}
      <div className="evidence-grid">
        <div className="evidence-card">
          <div className="label" style={{ color: 'var(--amber)' }}>
            {sectionLabels.why_it_matters || 'Why it matters'}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--crust)' }}>{btm.why_it_matters}</p>
        </div>
        <div className="evidence-card">
          <div className="label" style={{ color: 'var(--amber)' }}>
            {sectionLabels.simplifies || 'How the game simplifies this'}
          </div>
          <p style={{ fontSize: '14px', color: 'var(--crust)' }}>{btm.how_the_game_simplifies}</p>
        </div>
      </div>

      {/* Evidence Chain */}
      <div>
        <div className="label" style={{ marginBottom: '8px', color: 'var(--amber)' }}>
          {sectionLabels.evidence || 'The evidence chain'}
        </div>
        <div className="evidence-grid">
          {btm.evidence_chain.map((item, idx) => (
            <div key={item.step} className="evidence-card">
              <div className="mono" style={{ fontSize: '11px', color: 'var(--amber)' }}>
                0{idx + 1} · {item.step.toUpperCase()}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--crust)' }}>{item.caption}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Primary Sources */}
      {resolvedSources.length > 0 && (
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: '12px' }}>
          <div className="label" style={{ marginBottom: '8px', color: 'var(--amber)' }}>
            {sectionLabels.sources || 'Sources'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {resolvedSources.map((src) => (
              <a
                key={src.id}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary btn-sm"
              >
                {src.title} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
