import { useEffect, useRef, useState } from 'react';
import { telemetryAudio } from '../audio/telemetryAudio';
import type {
  CatalogEncounterRecord,
  NarrativeEncounter,
  QuickTaskOption,
  SourceRecord,
} from '../data/types';
import { BehindTheMemoryPanel } from './BehindTheMemoryPanel';

interface NarrativeEncounterConsoleProps {
  encounter: NarrativeEncounter;
  datasetEncounter?: CatalogEncounterRecord;
  sourcesMap: Map<string, SourceRecord>;
  echoFrameText: string;
  sectionLabels: Record<string, string>;
  unlockedBadges: string[];
  onComplete: (badgeId: string) => void;
  onExit: () => void;
}

interface SuggestedStop {
  label: string;
  science_tag: string;
}

interface EvidenceCard {
  id: string;
  label: string;
  what_it_did: string;
  what_it_showed: string;
  reading: string;
}

interface InstrumentReading {
  instrument: string;
  reading: string;
}

const VOYAGER_INSTRUMENTS = [
  { id: 'inst-a', name: 'Instrument A', tag: 'Measures space between stars', power: 4, highValue: true },
  { id: 'inst-b', name: 'Instrument B', tag: 'Measures space between stars', power: 4, highValue: true },
  { id: 'inst-c', name: 'Instrument C', tag: 'Legacy calibration sensor', power: 3, highValue: false },
  { id: 'inst-d', name: 'Instrument D', tag: 'Engineering monitor', power: 3, highValue: false },
];

function EncounterVisualStage({
  encounterId,
  chapter,
  stepIdx,
  stepsTotal,
  outcome,
}: {
  encounterId: string;
  chapter: string;
  stepIdx: number;
  stepsTotal: number;
  outcome: 'active' | 'success' | 'partial';
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const progress = outcome === 'active' ? (stepIdx + 0.5) / Math.max(1, stepsTotal) : 1;
    ctx.imageSmoothingEnabled = false;

    // Strict 24-color sky + horizon layers
    const isMars = chapter === 'mars';
    const isMoon = chapter === 'moon';
    const sky = ctx.createLinearGradient(0, 0, 0, 128);
    sky.addColorStop(0, '#05070f');
    sky.addColorStop(0.75, '#0b0f1d');
    sky.addColorStop(1, isMars ? '#522116' : '#131a2e');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 640, 128);

    // Stars
    for (let i = 0; i < 42; i += 1) {
      const sx = (i * 151 + 17) % 640;
      const sy = (i * 59 + 9) % 102;
      ctx.fillStyle = i % 7 === 0 ? '#7ef1ff' : i % 3 === 0 ? '#b2b8d4' : '#8389a8';
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Hero light
    if (isMoon) {
      ctx.fillStyle = '#087d99';
      ctx.beginPath();
      ctx.arc(560, 44, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7ef1ff';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#7ef1ff';
      ctx.fillRect(560, 34, 3, 3);
    }

    // Horizon terrain
    ctx.fillStyle = isMars ? '#7d331c' : isMoon ? '#3b3e59' : '#27293d';
    ctx.fillRect(0, 128, 640, 52);
    ctx.fillStyle = isMars ? '#cf724a' : isMoon ? '#b2b8d4' : '#8389a8';
    ctx.fillRect(0, 128, 640, 1);

    // Encounter-specific pixel visualization
    if (encounterId === 'echo-never-sleeps') {
      // Earth -> Moon retroreflector laser beam
      ctx.fillStyle = '#e2e6fa';
      ctx.fillRect(390, 118, 28, 10);
      ctx.strokeStyle = '#7ef1ff';
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(548, 56);
      ctx.lineTo(404, 118);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (encounterId === 'air-thin-as-a-whisper') {
      const hoverY = Math.round(112 - progress * 46);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(310, hoverY, 20, 8);
      ctx.fillStyle = '#7ef1ff';
      ctx.fillRect(298, hoverY - 4, 44, 2);
      ctx.fillStyle = 'rgba(11, 15, 29, 0.7)';
      ctx.fillRect(308, 134, 24, 5);
    } else if (encounterId === 'power-for-the-unknown') {
      // Voyager RTG power bars & DSN wave
      for (let b = 0; b < 5; b += 1) {
        ctx.fillStyle = b < 3 ? '#0ec3dc' : '#1d263f';
        ctx.fillRect(48 + b * 24, 64, 18, 10);
      }
      ctx.strokeStyle = '#0ec3dc';
      ctx.beginPath();
      ctx.arc(490, 74, 18, 0.7 * Math.PI, 1.3 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(490, 74, 32, 0.75 * Math.PI, 1.25 * Math.PI);
      ctx.stroke();
    } else if (encounterId === 'one-chance-at-pluto') {
      // Pluto + Charon flyby trajectory
      ctx.fillStyle = '#e89e7d';
      ctx.beginPath();
      ctx.arc(320, 72, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#8389a8';
      ctx.beginPath();
      ctx.arc(388, 56, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7ef1ff';
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(120, 108);
      ctx.lineTo(520, 32);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Traverse / Lander / Sample inspection line
      const px = Math.round(90 + progress * 430);
      ctx.strokeStyle = '#087d99';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(90, 146);
      ctx.lineTo(520, 146);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(px - 6, 120, 12, 10);
      ctx.fillStyle = '#7ef1ff';
      ctx.fillRect(px - 2, 122, 5, 3);
    }

    // Bottom status overlay bar inside canvas
    ctx.fillStyle = 'rgba(11, 15, 29, 0.88)';
    ctx.fillRect(10, 10, 290, 22);
    ctx.strokeStyle = '#087d99';
    ctx.strokeRect(10.5, 10.5, 289, 21);
    ctx.font = 'bold 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = outcome === 'active' ? '#0ec3dc' : '#f59e0b';
    ctx.fillText(
      outcome === 'active'
        ? `TELEMETRY STAGE ${Math.min(stepIdx + 1, stepsTotal)}/${stepsTotal}`
        : 'SIGNAL LOCK VERIFIED // COMPLETE',
      18,
      25
    );
  }, [encounterId, chapter, stepIdx, stepsTotal, outcome]);

  return (
    <canvas
      ref={canvasRef}
      width={640}
      height={180}
      className="encounter-visual-stage pixelated"
      aria-hidden="true"
    />
  );
}

export function NarrativeEncounterConsole({
  encounter,
  datasetEncounter,
  sourcesMap,
  echoFrameText,
  sectionLabels,
  unlockedBadges,
  onComplete,
  onExit,
}: NarrativeEncounterConsoleProps) {
  const steps = encounter.quick_task.steps;
  const [stepIdx, setStepIdx] = useState<number>(0);
  const [retries, setRetries] = useState<number>(0);
  const [hintUsed, setHintUsed] = useState<boolean>(false);
  const [hintIdx, setHintIdx] = useState<number>(0);
  const [feedback, setFeedback] = useState<string>('');
  const [outcome, setOutcome] = useState<'active' | 'success' | 'partial'>('active');

  const [aimTarget, setAimTarget] = useState<string | null>(null);
  const [echoHits, setEchoHits] = useState<number>(0);
  const [halveVal, setHalveVal] = useState<number>(20);

  const [selectedStops, setSelectedStops] = useState<string[]>([]);
  const [flippedCards, setFlippedCards] = useState<string[]>([]);
  const [scrapeCount, setScrapeCount] = useState<number>(0);
  const [usedScanners, setUsedScanners] = useState<string[]>([]);

  const [rotorSlider, setRotorSlider] = useState<number>(1800);
  const [altSlider, setAltSlider] = useState<number>(14);
  const [patchChoice, setPatchChoice] = useState<string | null>(null);

  const [nearZone, setNearZone] = useState<string | null>(null);
  const [nearTicks, setNearTicks] = useState<number>(0);
  const [tickCursor, setTickCursor] = useState<number>(10);

  const [voyagerRound, setVoyagerRound] = useState<number>(1);
  const [voyagerOn, setVoyagerOn] = useState<string[]>(['inst-a', 'inst-b', 'inst-c', 'inst-d']);
  const [selectedPacket, setSelectedPacket] = useState<string | null>(null);

  const [plutoSlots, setPlutoSlots] = useState<string[]>([]);

  useEffect(() => {
    setStepIdx(0);
    setRetries(0);
    setHintUsed(false);
    setHintIdx(0);
    setFeedback('');
    setOutcome('active');
    setAimTarget(null);
    setEchoHits(0);
    setHalveVal(20);
    setSelectedStops([]);
    setFlippedCards([]);
    setScrapeCount(0);
    setUsedScanners([]);
    setRotorSlider(1800);
    setAltSlider(14);
    setPatchChoice(null);
    setNearZone(null);
    setNearTicks(0);
    setTickCursor(10);
    setVoyagerRound(1);
    setVoyagerOn(['inst-a', 'inst-b', 'inst-c', 'inst-d']);
    setSelectedPacket(null);
    setPlutoSlots([]);
  }, [encounter.id]);

  // Slow predictable ping bar for NEAR Shoemaker step 2
  useEffect(() => {
    if (encounter.id !== 'landing-not-planned' || stepIdx !== 1 || outcome !== 'active') return;
    const id = setInterval(() => {
      setTickCursor((prev) => (prev + 6) % 100);
    }, 110);
    return () => clearInterval(id);
  }, [encounter.id, stepIdx, outcome]);

  const badgeId = encounter.id;
  const alreadyCompleted = unlockedBadges.includes(badgeId);
  const currentStep = steps[Math.min(stepIdx, Math.max(0, steps.length - 1))];

  const findBeatText = (trigger: string, stage?: number): string | null => {
    const match =
      encounter.memory_echo.beats.find(
        (b) => b.trigger === trigger && (stage === undefined || b.stage === stage)
      ) ?? encounter.memory_echo.beats.find((b) => b.trigger === trigger);
    return match ? match.text : null;
  };

  const replaceTokens = (text: string): string => {
    const roundTrip = 2.56;
    const distance = Math.round((299792.458 * roundTrip) / 2).toLocaleString('en-US');
    return text
      .replace(/\{round_trip_s\}/g, roundTrip.toFixed(2))
      .replace(/\{distance_km\}/g, distance);
  };

  const passStep = (customMsg?: string, beatTrigger = 'on_correct') => {
    telemetryAudio.playSignalLock();
    const beatLine = findBeatText(beatTrigger, stepIdx + 1);
    const stepText = replaceTokens(customMsg ?? currentStep.success_text);
    setFeedback(beatLine ? `${stepText} — "${beatLine}"` : stepText);

    if (stepIdx + 1 >= steps.length) {
      const nextOutcome = !hintUsed && retries < 3 ? 'success' : 'partial';
      setOutcome(nextOutcome);
      onComplete(badgeId);
    } else {
      setStepIdx((s) => s + 1);
    }
  };

  const failStep = (customMsg?: string, beatTrigger = 'on_incorrect') => {
    telemetryAudio.playChirp(320, 0.08);
    setRetries((r) => r + 1);
    const beatLine = findBeatText(beatTrigger, stepIdx + 1);
    const retryText = customMsg ?? currentStep.retry_text;
    setFeedback(beatLine ? `${retryText} — "${beatLine}"` : retryText);
  };

  const handleShowHint = () => {
    telemetryAudio.playChirp(680, 0.04);
    setHintUsed(true);
    const ladder = Array.isArray(encounter.game_support.hint_ladder)
      ? (encounter.game_support.hint_ladder as string[])
      : [];
    const fallbackHints = [
      ...ladder,
      typeof encounter.game_support.design_hint === 'string' ? encounter.game_support.design_hint : '',
      typeof encounter.game_support.scoring_hint === 'string' ? encounter.game_support.scoring_hint : '',
      currentStep?.win_condition ?? '',
      encounter.quick_task.teaches,
    ].filter(Boolean);

    const hint = fallbackHints[hintIdx % fallbackHints.length] || encounter.quick_task.teaches;
    const beatHint = findBeatText('on_hint');
    setHintIdx((i) => i + 1);
    setFeedback(`HINT: ${hint}${beatHint ? ` — "${beatHint}"` : ''}`);
  };

  const handleRestart = () => {
    telemetryAudio.playChirp(820, 0.04);
    setStepIdx(0);
    setRetries(0);
    setHintUsed(false);
    setHintIdx(0);
    setFeedback('');
    setOutcome('active');
    setAimTarget(null);
    setEchoHits(0);
    setHalveVal(20);
    setSelectedStops([]);
    setFlippedCards([]);
    setScrapeCount(0);
    setUsedScanners([]);
    setRotorSlider(1800);
    setAltSlider(14);
    setPatchChoice(null);
    setNearZone(null);
    setNearTicks(0);
    setVoyagerRound(1);
    setVoyagerOn(['inst-a', 'inst-b', 'inst-c', 'inst-d']);
    setSelectedPacket(null);
    setPlutoSlots([]);
  };

  const gs = encounter.game_support;

  const renderInteractiveTask = () => {
    if (outcome !== 'active') {
      const outcomeLine = replaceTokens(
        outcome === 'success'
          ? encounter.memory_echo.outcomes.success
          : encounter.memory_echo.outcomes.partial
      );
      return (
        <div
          style={{
            borderTop: '1px solid var(--line)',
            paddingTop: '14px',
            display: 'grid',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span className="status-badge active">
              {outcome === 'success' ? 'SIGNAL RECONSTRUCTED // CLEAN RUN' : 'SIGNAL RECONSTRUCTED // PARTIAL MARGIN'}
            </span>
            <span className="status-badge dormant">BADGE UNLOCKED: {encounter.quick_task.task_name}</span>
          </div>
          <p style={{ fontSize: '15px', color: 'var(--cyan-glow)' }}>{outcomeLine}</p>
          <p style={{ fontSize: '13px', color: 'var(--crust)' }}>
            <strong>Takeaway:</strong> {encounter.quick_task.teaches}
          </p>
          <div>
            <button className="btn-secondary btn-sm" onClick={handleRestart}>
              RE-RUN ENCOUNTER ↺
            </button>
          </div>
        </div>
      );
    }

    switch (encounter.id) {
      case 'echo-never-sleeps': {
        if (stepIdx === 0) {
          const sites = [
            { id: 'center', label: 'Mid-Moon Disk (Mare Imbrium)', hit: false },
            { id: 'tycho', label: 'Tycho Southern Highlands', hit: false },
            { id: 'tranquility', label: 'Mare Tranquillitatis Reflector Ring', hit: true },
          ];
          return (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {sites.map((s) => (
                <button
                  key={s.id}
                  className={aimTarget === s.id ? 'btn-observatory btn-sm' : 'btn-secondary btn-sm'}
                  onClick={() => {
                    setAimTarget(s.id);
                    if (s.hit) passStep(undefined, 'on_hit');
                    else failStep(undefined, 'on_miss');
                  }}
                >
                  {s.hit ? '◎ ' : '· '}
                  {s.label}
                </button>
              ))}
            </div>
          );
        }
        if (stepIdx === 1) {
          const ticks = [
            { id: 'n1', label: '1.14 s · Scattered flash (moves each pulse)', real: false },
            { id: 'real', label: `2.56 s · Repeating photon return (${echoHits}/2 locked)`, real: true },
            { id: 'n2', label: '3.92 s · Random sunlight spike', real: false },
          ];
          return (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {ticks.map((t) => (
                <button
                  key={t.id}
                  className={t.real ? 'btn-observatory btn-sm' : 'btn-secondary btn-sm'}
                  onClick={() => {
                    if (t.real) {
                      const next = echoHits + 1;
                      setEchoHits(next);
                      telemetryAudio.playChirp(1040, 0.05);
                      if (next >= 2) passStep(undefined, 'on_hit');
                      else setFeedback('Pulse 1/2 matched at 2.56 s. Tap the repeating delay once more.');
                    } else {
                      failStep(undefined, 'on_noise');
                    }
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          );
        }
        return (
          <div style={{ display: 'grid', gap: '10px' }}>
            <div className="mono" style={{ fontSize: '12px', color: 'var(--crust)' }}>
              Round-trip time: 2.56 s · Marker position: {halveVal}% of round trip ({((2.56 * halveVal) / 100).toFixed(2)} s)
            </div>
            <input
              type="range"
              min={10}
              max={90}
              step={5}
              value={halveVal}
              onChange={(e) => setHalveVal(Number(e.target.value))}
              aria-label="Halfway round-trip marker"
            />
            <div>
              <button
                className="btn-observatory btn-sm"
                onClick={() => {
                  if (halveVal >= 45 && halveVal <= 55) passStep();
                  else failStep();
                }}
              >
                LOCK ONE-WAY DISTANCE
              </button>
            </div>
          </div>
        );
      }

      case 'farther-than-footsteps': {
        const stops = (gs.suggested_stops as SuggestedStop[]) ?? [];
        const allStops = [
          ...stops.map((s, idx) => ({ ...s, inRing: idx < 4 })),
          { label: 'Deep Ridge Overflow (Same Ejecta)', science_tag: 'Fresh crater ejecta', inRing: false },
        ];
        if (stepIdx === 0) {
          return (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className="evidence-grid">
                {allStops.map((stop) => {
                  const picked = selectedStops.includes(stop.label);
                  return (
                    <button
                      key={stop.label}
                      className="encounter-tab"
                      style={{
                        borderColor: picked ? 'var(--cyan)' : stop.inRing ? 'var(--line)' : 'var(--terracotta)',
                        background: picked ? 'var(--cyan-void)' : 'var(--indigo)',
                      }}
                      onClick={() => {
                        telemetryAudio.playChirp(760, 0.03);
                        setSelectedStops((prev) =>
                          prev.includes(stop.label)
                            ? prev.filter((x) => x !== stop.label)
                            : prev.length < 3
                            ? [...prev, stop.label]
                            : prev
                        );
                      }}
                    >
                      <span className="mono" style={{ fontSize: '10px', color: stop.inRing ? 'var(--cyan)' : 'var(--haze-peach)' }}>
                        {stop.inRing ? 'INSIDE SAFE-RETURN RING' : 'OUTSIDE SAFE RING'} · {picked ? 'SELECTED' : 'TAP'}
                      </span>
                      <strong style={{ fontSize: '14px' }}>{stop.label}</strong>
                      <span style={{ fontSize: '12px', color: 'var(--crust)' }}>{stop.science_tag}</span>
                    </button>
                  );
                })}
              </div>
              <div>
                <button
                  className="btn-observatory btn-sm"
                  onClick={() => {
                    const chosen = allStops.filter((s) => selectedStops.includes(s.label));
                    const uniqueTags = new Set(chosen.map((s) => s.science_tag)).size;
                    if (chosen.length === 3 && chosen.every((s) => s.inRing) && uniqueTags === 3) {
                      passStep();
                    } else {
                      failStep();
                    }
                  }}
                >
                  CONFIRM 3 STOPS ({selectedStops.length}/3)
                </button>
              </div>
            </div>
          );
        }
        return (
          <div>
            <button className="btn-observatory btn-sm" onClick={() => passStep()}>
              ▶ DRIVE TRAVERSE & RETURN TO LM
            </button>
          </div>
        );
      }

      case 'question-in-the-soil': {
        const cards = (gs.evidence_cards as EvidenceCard[]) ?? [];
        const options: QuickTaskOption[] = encounter.quick_task.options ?? [];
        if (stepIdx === 0) {
          return (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className="evidence-grid">
                {cards.map((card) => {
                  const flipped = flippedCards.includes(card.id);
                  return (
                    <button
                      key={card.id}
                      className="encounter-tab"
                      style={{ borderColor: flipped ? 'var(--cyan)' : 'var(--line)' }}
                      onClick={() => {
                        telemetryAudio.playChirp(820, 0.03);
                        const next = flipped ? flippedCards : [...flippedCards, card.id];
                        setFlippedCards(next);
                        if (next.length === cards.length) {
                          passStep(undefined, 'on_card_open');
                        }
                      }}
                    >
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--cyan)' }}>
                        {flipped ? 'READ ✓' : 'TAP TO INSPECT'}
                      </span>
                      <strong>{card.label}</strong>
                      {flipped && (
                        <span style={{ fontSize: '12px', color: 'var(--crust)' }}>
                          {card.what_it_showed} ({card.reading})
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="mono muted" style={{ fontSize: '11px' }}>
                Evidence cards inspected: {flippedCards.length} / {cards.length}
              </div>
            </div>
          );
        }
        return (
          <div style={{ display: 'grid', gap: '8px' }}>
            {options.map((opt) => (
              <button
                key={opt.id}
                className="encounter-tab"
                onClick={() => {
                  if (opt.correct) passStep();
                  else failStep();
                }}
              >
                <span style={{ fontSize: '14px' }}>{opt.text}</span>
              </button>
            ))}
          </div>
        );
      }

      case 'clues-beneath-the-wheel': {
        const evidenceList = (gs.evidence as InstrumentReading[]) ?? [];
        const options: QuickTaskOption[] = encounter.quick_task.options ?? [];
        if (stepIdx === 0) {
          return (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className="hud" style={{ padding: '12px', border: '1px solid var(--cyan-deep)', background: 'var(--void)' }}>
                <div className="mono" style={{ fontSize: '12px', color: 'var(--crust)', marginBottom: '6px' }}>
                  SURFACE EXPOSURE: {Math.min(100, scrapeCount * 34)}%
                </div>
                <div className="gauge" aria-label="Dust cleared">
                  {Array.from({ length: 12 }).map((_, i) => (
                    <i key={i} className={i < scrapeCount * 4 ? 'on' : ''} />
                  ))}
                </div>
              </div>
              <div>
                <button
                  className="btn-observatory btn-sm"
                  onClick={() => {
                    const next = scrapeCount + 1;
                    setScrapeCount(next);
                    telemetryAudio.playThruster();
                    if (next >= 3) passStep();
                    else setFeedback('Scraping surface dust...');
                  }}
                >
                  SWIPE WHEEL ACROSS DUSTY PATCH ({scrapeCount}/3)
                </button>
              </div>
            </div>
          );
        }
        if (stepIdx === 1) {
          return (
            <div className="evidence-grid">
              {evidenceList.map((ev) => {
                const used = usedScanners.includes(ev.instrument);
                return (
                  <button
                    key={ev.instrument}
                    className="encounter-tab"
                    style={{ borderColor: used ? 'var(--cyan)' : 'var(--line)' }}
                    onClick={() => {
                      telemetryAudio.playChirp(900, 0.04);
                      const next = used ? usedScanners : [...usedScanners, ev.instrument];
                      setUsedScanners(next);
                      if (next.length === evidenceList.length) passStep();
                    }}
                  >
                    <span className="mono" style={{ fontSize: '10px', color: 'var(--cyan)' }}>
                      {used ? 'SCANNED ✓' : 'TAP TO SCAN'}
                    </span>
                    <strong>{ev.instrument}</strong>
                    {used && <span style={{ fontSize: '12px', color: 'var(--crust)' }}>{ev.reading}</span>}
                  </button>
                );
              })}
            </div>
          );
        }
        return (
          <div style={{ display: 'grid', gap: '8px' }}>
            {options.map((opt) => (
              <button
                key={opt.id}
                className="encounter-tab"
                onClick={() => {
                  if (opt.correct) passStep();
                  else failStep();
                }}
              >
                <span style={{ fontSize: '14px' }}>{opt.text}</span>
              </button>
            ))}
          </div>
        );
      }

      case 'air-thin-as-a-whisper': {
        if (stepIdx === 0) {
          return (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className="mono" style={{ fontSize: '12px', color: 'var(--crust)' }}>
                Rotor Speed: <b>{rotorSlider} RPM</b> (Target: 2,400–2,700 RPM for thin Martian air)
              </div>
              <input
                type="range"
                min={1400}
                max={3200}
                step={100}
                value={rotorSlider}
                onChange={(e) => setRotorSlider(Number(e.target.value))}
                aria-label="Rotor speed slider"
              />
              <div>
                <button
                  className="btn-observatory btn-sm"
                  onClick={() => {
                    if (rotorSlider >= 2400 && rotorSlider <= 2700) passStep();
                    else failStep();
                  }}
                >
                  LOCK ROTOR SPEED
                </button>
              </div>
            </div>
          );
        }
        if (stepIdx === 1) {
          return (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className="mono" style={{ fontSize: '12px', color: 'var(--crust)' }}>
                Target Altitude: <b>{altSlider} m</b> (Safe low hover zone: 3–8 m)
              </div>
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={altSlider}
                onChange={(e) => setAltSlider(Number(e.target.value))}
                aria-label="Flight altitude slider"
              />
              <div>
                <button
                  className="btn-observatory btn-sm"
                  onClick={() => {
                    if (altSlider >= 3 && altSlider <= 8) passStep();
                    else failStep();
                  }}
                >
                  SET FLIGHT ALTITUDE
                </button>
              </div>
            </div>
          );
        }
        const patches = [
          { id: 'boulders', label: 'Crater Wall (Steep Boulders)', ok: false },
          { id: 'flat', label: 'Flat Regolith Patch with Tracking Rocks', ok: true },
          { id: 'blank', label: 'Smooth Featureless Sand Ripple', ok: false },
        ];
        return (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {patches.map((p) => (
              <button
                key={p.id}
                className={patchChoice === p.id ? 'btn-observatory btn-sm' : 'btn-secondary btn-sm'}
                onClick={() => {
                  setPatchChoice(p.id);
                  if (p.ok) passStep(undefined, 'on_launch');
                  else failStep();
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        );
      }

      case 'landing-not-planned': {
        if (stepIdx === 0) {
          const zones = [
            { id: 'ridge', label: 'Northern Boulder Ridge (Rough)', ok: false },
            { id: 'saddle', label: 'Himeros Smooth Pond Deposit', ok: true },
            { id: 'crater', label: 'Steep Crater Rim (Rough)', ok: false },
          ];
          return (
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {zones.map((z) => (
                <button
                  key={z.id}
                  className={nearZone === z.id ? 'btn-observatory btn-sm' : 'btn-secondary btn-sm'}
                  onClick={() => {
                    setNearZone(z.id);
                    if (z.ok) passStep();
                    else failStep();
                  }}
                >
                  {z.label}
                </button>
              ))}
            </div>
          );
        }
        if (stepIdx === 1) {
          const inWindow = tickCursor >= 30 && tickCursor <= 72;
          return (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ border: '1px solid var(--line)', padding: '10px', background: 'var(--void)' }}>
                <div className="mono" style={{ fontSize: '11px', color: 'var(--crust)', marginBottom: '6px' }}>
                  MICROGRAVITY DESCENT TICK ({nearTicks}/3 LOCKED) — GLOW WINDOW: 30%–72% · NOW: {tickCursor}%
                </div>
                <div
                  style={{
                    position: 'relative',
                    height: '16px',
                    background: 'var(--navy)',
                    border: '1px solid var(--line)',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: '30%',
                      width: '42%',
                      top: 0,
                      bottom: 0,
                      background: 'rgba(14, 195, 220, 0.25)',
                      borderInline: '1px solid var(--cyan)',
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: `${tickCursor}%`,
                      width: '6px',
                      top: 0,
                      bottom: 0,
                      background: inWindow ? 'var(--cyan-glow)' : 'var(--amber)',
                    }}
                  />
                </div>
              </div>
              <div>
                <button
                  className="btn-observatory btn-sm"
                  onClick={() => {
                    if (inWindow) {
                      const next = nearTicks + 1;
                      setNearTicks(next);
                      telemetryAudio.playSignalLock();
                      if (next >= 3) passStep();
                      else setFeedback(`Steady correction ${next}/3 logged.`);
                    } else {
                      failStep();
                    }
                  }}
                >
                  PULSE DESCENT BURN ON TICK ({nearTicks}/3)
                </button>
              </div>
            </div>
          );
        }
        const queues = [
          { id: 'eng', label: 'Slot 1: Housekeeping Log · Slot 2: Surface Data', ok: false },
          { id: 'surf', label: 'Slot 1: SURFACE DATA · Slot 2: Engineering Margin', ok: true },
          { id: 'idle', label: 'Slot 1: Carrier Beacon Only · Slot 2: Blank', ok: false },
        ];
        return (
          <div style={{ display: 'grid', gap: '8px' }}>
            {queues.map((q) => (
              <button
                key={q.id}
                className="encounter-tab"
                onClick={() => {
                  if (q.ok) passStep();
                  else failStep();
                }}
              >
                <span style={{ fontSize: '13px' }}>{q.label}</span>
              </button>
            ))}
          </div>
        );
      }

      case 'power-for-the-unknown': {
        if (stepIdx === 0) {
          const budgetLimit = voyagerRound === 1 ? 10 : 8;
          const totalUsed = VOYAGER_INSTRUMENTS.filter((i) => voyagerOn.includes(i.id)).reduce(
            (sum, i) => sum + i.power,
            0
          );
          const underLine = totalUsed <= budgetLimit;
          return (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className="mono" style={{ fontSize: '12px', color: underLine ? 'var(--cyan)' : 'var(--haze-peach)' }}>
                Round {voyagerRound}/2 · Power Draw: {totalUsed} / {budgetLimit} units max
              </div>
              <div className="evidence-grid">
                {VOYAGER_INSTRUMENTS.map((inst) => {
                  const isOn = voyagerOn.includes(inst.id);
                  return (
                    <button
                      key={inst.id}
                      className="encounter-tab"
                      style={{ borderColor: isOn ? 'var(--cyan)' : 'var(--line)' }}
                      onClick={() => {
                        telemetryAudio.playChirp(isOn ? 520 : 880, 0.03);
                        setVoyagerOn((prev) =>
                          prev.includes(inst.id) ? prev.filter((x) => x !== inst.id) : [...prev, inst.id]
                        );
                      }}
                    >
                      <span className="mono" style={{ fontSize: '10px', color: isOn ? 'var(--cyan)' : 'var(--muted)' }}>
                        {isOn ? 'ON' : 'OFF'} · DRAW {inst.power}W EQ
                      </span>
                      <strong>
                        {inst.highValue ? '★ ' : ''}
                        {inst.name}
                      </strong>
                      <span style={{ fontSize: '12px', color: 'var(--crust)' }}>{inst.tag}</span>
                    </button>
                  );
                })}
              </div>
              <div>
                <button
                  className="btn-observatory btn-sm"
                  onClick={() => {
                    const bothHighOn = voyagerOn.includes('inst-a') && voyagerOn.includes('inst-b');
                    if (underLine && bothHighOn) {
                      if (voyagerRound === 1) {
                        telemetryAudio.playSignalLock();
                        setVoyagerRound(2);
                        setFeedback('Round 1 balanced. Available RTG output dropped further to 8 units.');
                      } else {
                        passStep();
                      }
                    } else {
                      failStep();
                    }
                  }}
                >
                  APPLY POWER BUS ({voyagerRound}/2)
                </button>
              </div>
            </div>
          );
        }
        const packets = [
          { id: 'diag', label: 'Routine Bus Voltage Repeat (Low Value)', ok: false },
          { id: 'interstellar', label: 'Interstellar Particles & Magnetic Packet (High Value)', ok: true },
        ];
        return (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {packets.map((p) => (
              <button
                key={p.id}
                className={selectedPacket === p.id ? 'btn-observatory btn-sm' : 'btn-secondary btn-sm'}
                onClick={() => {
                  setSelectedPacket(p.id);
                  if (p.ok) passStep();
                  else failStep();
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        );
      }

      case 'one-chance-at-pluto': {
        const cards = encounter.quick_task.cards ?? [];
        if (stepIdx === 0) {
          return (
            <div style={{ display: 'grid', gap: '10px' }}>
              <div className="mono" style={{ fontSize: '12px', color: 'var(--crust)' }}>
                Flyby Timeline Slots: {plutoSlots.length} / 3 · Antenna mode: Pointed at Pluto (not Earth)
              </div>
              <div className="evidence-grid">
                {cards.map((c) => {
                  const picked = plutoSlots.includes(c.label);
                  return (
                    <button
                      key={c.label}
                      className="encounter-tab"
                      style={{ borderColor: picked ? 'var(--cyan)' : 'var(--line)' }}
                      onClick={() => {
                        telemetryAudio.playChirp(820, 0.03);
                        setPlutoSlots((prev) =>
                          prev.includes(c.label)
                            ? prev.filter((x) => x !== c.label)
                            : prev.length < 3
                            ? [...prev, c.label]
                            : prev
                        );
                      }}
                    >
                      <span className="mono" style={{ fontSize: '10px', color: 'var(--cyan)' }}>
                        {picked ? 'IN TIMELINE ✓' : 'TAP TO SCHEDULE'} · SCIENCE VALUE: {c.value.toUpperCase()}
                      </span>
                      <strong>{c.label}</strong>
                    </button>
                  );
                })}
              </div>
              <div>
                <button
                  className="btn-observatory btn-sm"
                  onClick={() => {
                    const highCount = cards.filter((c) => plutoSlots.includes(c.label) && c.value === 'high').length;
                    if (plutoSlots.length === 3 && highCount === 3) passStep();
                    else failStep();
                  }}
                >
                  LOCK FLYBY TIMELINE ({plutoSlots.length}/3)
                </button>
              </div>
            </div>
          );
        }
        return (
          <div>
            <button className="btn-observatory btn-sm" onClick={() => passStep()}>
              ▶ RUN FLYBY SEQUENCE & BEGIN DOWNLINK
            </button>
          </div>
        );
      }

      default:
        return (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button className="btn-observatory btn-sm" onClick={() => passStep()}>
              EXECUTE STEP {stepIdx + 1} / {steps.length}
            </button>
          </div>
        );
    }
  };

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {/* Mandatory Framing Bar (§1, UI Copy Frame Rule) */}
      <div className="encounter-frame-bar">
        <span>
          <strong style={{ color: 'var(--cyan)' }}>ARCHIVE REPLAY:</strong> {echoFrameText}
        </span>
        <span className="status-badge dormant">{encounter.status_badge.label}</span>
      </div>

      {/* Cyan Story & Simulation Console */}
      <section className="console" style={{ padding: '22px', display: 'grid', gap: '16px' }}>
        <div className="c-head">
          <span className="tag-story">
            <span className="signal-dot" aria-hidden="true" />
            Memory echo · {encounter.echo_speaker}
          </span>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            {alreadyCompleted && <span className="status-badge active">COMPLETED ✓</span>}
            <span className="mono muted" style={{ fontSize: '12px' }}>
              STEP {Math.min(stepIdx + 1, steps.length)} / {steps.length}
            </span>
            <button className="btn-secondary btn-sm" onClick={onExit}>
              [ EXIT ]
            </button>
          </div>
        </div>

        <div>
          <div className="eyebrow" style={{ marginBottom: '4px' }}>
            Encounter #{String(encounter.order).padStart(2, '0')} · {encounter.quick_task.task_name}
            {datasetEncounter ? ` · ${datasetEncounter.mechanic_family.toUpperCase()}` : ''}
          </div>
          <h2>{encounter.title}</h2>
        </div>

        {/* Pixel Telemetry Visualizer Stage */}
        <EncounterVisualStage
          encounterId={encounter.id}
          chapter={encounter.chapter}
          stepIdx={stepIdx}
          stepsTotal={steps.length}
          outcome={outcome}
        />

        {/* Intro Story Monologue */}
        <div style={{ display: 'grid', gap: '6px', color: 'var(--cyan-glow)', fontSize: '15px' }}>
          {encounter.memory_echo.intro.map((line, i) => (
            <p key={i} style={{ fontStyle: 'italic' }}>
              "{line}"
            </p>
          ))}
        </div>

        {/* Verified Learning Intent & Evidence Chain Preview from encounters.json */}
        {datasetEncounter && (
          <div
            style={{
              background: 'var(--indigo)',
              border: '1px solid var(--line)',
              padding: '10px 12px',
              display: 'grid',
              gap: '4px',
              fontSize: '12px',
              color: 'var(--crust)',
            }}
          >
            <span>
              <strong style={{ color: 'var(--amber)' }}>LEARNING GOAL:</strong> {datasetEncounter.learning_intent}
            </span>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
              EVIDENCE CHAIN: {datasetEncounter.evidence_chain.join(' -> ')}
            </span>
          </div>
        )}

        {/* Active Step Instruction Box */}
        {outcome === 'active' && currentStep && (
          <div
            style={{
              background: 'var(--void)',
              border: '1px solid var(--line)',
              padding: '14px',
              display: 'grid',
              gap: '8px',
            }}
          >
            <div className="label" style={{ color: 'var(--cyan)' }}>
              Task Prompt ({currentStep.verb.toUpperCase()})
            </div>
            <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ink)' }}>
              {currentStep.prompt}
            </div>
            <div className="mono muted" style={{ fontSize: '12px' }}>
              Goal: {currentStep.win_condition}
            </div>
          </div>
        )}

        {/* Micro-task Controls */}
        {renderInteractiveTask()}

        {/* Live Feedback & Hint Bar */}
        {feedback && (
          <div
            aria-live="polite"
            style={{
              background: 'var(--navy)',
              borderLeft: '2px solid var(--cyan)',
              padding: '10px 12px',
              fontSize: '13px',
              color: 'var(--ink)',
            }}
          >
            {feedback}
          </div>
        )}

        {outcome === 'active' && retries >= 3 && currentStep && (
          <div className="assisted-box" role="region" aria-label="Assisted Guidance">
            <div className="label" style={{ color: 'var(--cyan-glow)' }}>
              Assisted Guidance Unlocked
            </div>
            <p style={{ fontSize: '13px', color: 'var(--ink)' }}>
              Evidence clue: {currentStep.win_condition}. {encounter.quick_task.teaches}
            </p>
            <div>
              <button
                type="button"
                className="btn-observatory btn-sm"
                onClick={() => {
                  telemetryAudio.playSignalLock();
                  setHintUsed(true);
                  setOutcome('partial');
                  setFeedback(
                    `Archivist assistance applied — "${replaceTokens(encounter.memory_echo.outcomes.partial)}"`
                  );
                  onComplete(badgeId);
                }}
              >
                COMPLETE WITH ARCHIVIST ASSISTANCE ✓
              </button>
            </div>
          </div>
        )}

        {outcome === 'active' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <button className="btn-secondary btn-sm" onClick={handleShowHint}>
              ? SHOW A HINT
            </button>
            <span className="mono muted" style={{ fontSize: '11px' }}>
              Retries: {retries} · Estimated: {encounter.quick_task.seconds}s
            </span>
          </div>
        )}
      </section>

      {/* Separated Amber Verified Record Section */}
      <BehindTheMemoryPanel
        encounter={encounter}
        sourcesMap={sourcesMap}
        sectionLabels={sectionLabels}
      />
    </div>
  );
}
