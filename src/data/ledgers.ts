export interface ClaimLedgerRow {
  claimId: string;
  missionId: string;
  publishedWording: string;
  claimType: 'fact' | 'interpretation' | 'status' | 'dramatization';
  primarySourceId: string;
  supportingSourceId?: string;
  reviewedOn: string;
  reviewer: string;
  confidenceNote: string;
}

export interface AssetLedgerRow {
  id: string;
  path: string;
  role: 'team-illustration' | 'authentic-reference' | 'audio-synth';
  origin: string;
  creator: string;
  creditLine: string;
  license: string;
  disclosureLabel: string;
  reviewer: string;
  altText: string;
}

export interface AssistantLedgerRow {
  id: string;
  toolAndModel: string;
  promptObjective: string;
  filesAffected: string;
  outputType: 'code' | 'image' | 'draft' | 'review';
  humanReviewer: string;
  verificationStatus: string;
  notes: string;
}

export const CLAIM_LEDGER: ClaimLedgerRow[] = [
  {
    claimId: 'surveyor1-landing-01',
    missionId: 'surveyor-1',
    publishedWording: 'Surveyor 1 achieved the first U.S. soft lunar landing on June 2, 1966 using autonomous RADVS radar.',
    claimType: 'fact',
    primarySourceId: 'nasa-surveyor1',
    supportingSourceId: 'nasa-ranger-surveyor',
    reviewedOn: '2026-11-09',
    reviewer: 'Member 4 (Science Review)',
    confidenceNote: 'Autonomous descent verified; manual joystick control explicitly excluded.',
  },
  {
    claimId: 'apollo11-lrrr-01',
    missionId: 'apollo-11-surface',
    publishedWording: 'The Apollo 11 laser-ranging retroreflector uses zero onboard power and still returns Earth laser pulses.',
    claimType: 'fact',
    primarySourceId: 'ilrs-apollo11',
    supportingSourceId: 'nssdca-apollo11-lm',
    reviewedOn: '2026-11-09',
    reviewer: 'Member 4 (Science Review)',
    confidenceNote: 'Passive optical corner-cube array distinguished from powered EASEP instruments.',
  },
  {
    claimId: 'apollo17-lrv-01',
    missionId: 'apollo-17-surface',
    publishedWording: 'LRV-3 enabled >35 km of geological traverses across Taurus–Littrow while constrained by safe walk-back limits.',
    claimType: 'fact',
    primarySourceId: 'nasa-apollo17',
    supportingSourceId: 'nssdca-lrv',
    reviewedOn: '2026-11-09',
    reviewer: 'Member 4 (Science Review)',
    confidenceNote: 'Traverses condensed in encounter while retaining walk-back constraint.',
  },
  {
    claimId: 'viking1-bio-01',
    missionId: 'viking-1',
    publishedWording: 'Viking 1 biology tests gave reactive gas signals while GCMS detected no organics; results remain scientifically qualified.',
    claimType: 'interpretation',
    primarySourceId: 'nasa-viking',
    reviewedOn: '2026-11-09',
    reviewer: 'Member 4 (Science Review)',
    confidenceNote: 'Explicitly neither claims confirmed Martian life nor disproves all Martian life.',
  },
  {
    claimId: 'spirit-water-01',
    missionId: 'spirit',
    publishedWording: 'Spirit’s dragged front wheel uncovered ~90% amorphous silica near Home Plate, indicating localized past hydrothermal water.',
    claimType: 'interpretation',
    primarySourceId: 'nasa-spirit',
    reviewedOn: '2026-11-09',
    reviewer: 'Member 4 (Science Review)',
    confidenceNote: 'Scoped to Home Plate hydrothermal deposits, not generalized to all of Mars.',
  },
  {
    claimId: 'ingenuity-flight-01',
    missionId: 'ingenuity',
    publishedWording: 'Ingenuity completed 72 autonomous flights in ~1% Earth-density air using high-RPM lightweight carbon rotors.',
    claimType: 'fact',
    primarySourceId: 'nasa-ingenuity',
    reviewedOn: '2026-11-09',
    reviewer: 'Member 4 (Science Review)',
    confidenceNote: 'Autonomous onboard flight control; retired stationary in Jezero Crater.',
  },
  {
    claimId: 'near-eros-01',
    missionId: 'near-shoemaker',
    publishedWording: 'NEAR Shoemaker was built strictly as an orbiter and performed an unplanned soft touchdown on asteroid 433 Eros.',
    claimType: 'fact',
    primarySourceId: 'nasa-near',
    reviewedOn: '2026-11-09',
    reviewer: 'Member 4 (Science Review)',
    confidenceNote: 'Survived landing at <1.8 m/s and collected surface gamma-ray spectra.',
  },
  {
    claimId: 'voyager1-power-01',
    missionId: 'voyager-1',
    publishedWording: 'Voyager 1 operates in interstellar space beyond the heliopause under declining RTG electrical power (~4 W/yr loss).',
    claimType: 'status',
    primarySourceId: 'nasa-voyager1',
    reviewedOn: '2026-11-09',
    reviewer: 'Member 4 (Science Review)',
    confidenceNote: 'Recheck current operating instruments immediately prior to release.',
  },
  {
    claimId: 'newhorizons-pluto-01',
    missionId: 'new-horizons',
    publishedWording: 'New Horizons recorded flyby observations into solid-state storage during its rapid 2015 Pluto pass and downlinked over 15 months.',
    claimType: 'fact',
    primarySourceId: 'nasa-new-horizons',
    reviewedOn: '2026-11-09',
    reviewer: 'Member 4 (Science Review)',
    confidenceNote: 'Pluto findings (2015) distinguished from Arrokoth (2019) and heliosphere work.',
  },
];

export const ASSET_LEDGER: AssetLedgerRow[] = [
  {
    id: 'sprites-moon-mars-elsewhere',
    path: '/assets/generated/sprites/*.png',
    role: 'team-illustration',
    origin: 'Procedural pixel-art toolkit (tools/art/)',
    creator: 'Echoes of Exploration Team (Member 5)',
    creditLine: 'Team-created 16-bit illustration (CC0-1.0)',
    license: 'CC0-1.0',
    disclosureLabel: 'Illustration · Not a mission photograph',
    reviewer: 'Member 5 & Member 6',
    altText: '16-bit pixel art hardware illustrations for lunar, Martian, and deep-space NASA probes.',
  },
  {
    id: 'scenes-pixel-backdrops',
    path: '/assets/generated/scenes/*.png',
    role: 'team-illustration',
    origin: 'Procedural scene engine (tools/art/scenes.py)',
    creator: 'Echoes of Exploration Team (Member 5)',
    creditLine: 'Team-created 640x360 pixel landscape (CC0-1.0)',
    license: 'CC0-1.0',
    disclosureLabel: 'SI-GENERATED ILLUSTRATION',
    reviewer: 'Member 5 & Member 6',
    altText: 'Layered 16-bit parallax landscapes of the Moon, Mars, 433 Eros, deep space, and Pluto.',
  },
  {
    id: 'patches-mission-badges',
    path: '/assets/generated/patches/*.png',
    role: 'team-illustration',
    origin: 'Procedural pixel-art patch generator (tools/art/build.py)',
    creator: 'Echoes of Exploration Team (Member 5)',
    creditLine: 'Team-created mission patch icons (CC0-1.0)',
    license: 'CC0-1.0',
    disclosureLabel: 'Team-created emblem · Zero NASA insignia',
    reviewer: 'Member 5 & Member 6',
    altText: 'Ten hexagonal 16-bit achievement patches representing nine encounters and the master Signal Archivist emblem.',
  },
  {
    id: 'audio-webaudio-synth',
    path: 'src/audio/telemetryAudio.ts',
    role: 'audio-synth',
    origin: 'Web Audio API Oscillator Synthesis',
    creator: 'Echoes of Exploration Team',
    creditLine: 'Team-synthesized telemetry audio (Apache-2.0)',
    license: 'Apache-2.0',
    disclosureLabel: 'Synthesized audio with live text transcripts',
    reviewer: 'Member 6 (Accessibility & Audio)',
    altText: 'Browser-synthesized telemetry beeps, radar pings, and thruster tones accompanied by on-screen visual captions.',
  },
  {
    id: 'fonts-ofl-google',
    path: 'index.html (Silkscreen, IBM Plex Sans, IBM Plex Mono)',
    role: 'authentic-reference',
    origin: 'Google Fonts (SIL Open Font License 1.1)',
    creator: 'Jason Kottke (Silkscreen), Mike Abbink / IBM (IBM Plex)',
    creditLine: 'SIL Open Font License 1.1',
    license: 'OFL-1.1',
    disclosureLabel: 'Open-source display, body, and monospace web fonts',
    reviewer: 'Member 6',
    altText: 'Readable pixel display, sans-serif, and tabular monospace typography.',
  },
];

export const AI_ASSISTANCE_LEDGER: AssistantLedgerRow[] = [
  {
    id: 'ai-art-toolkit',
    toolAndModel: 'Anthropic Claude / Orchestrator',
    promptObjective: 'Generate procedural indexed-color pixel art toolkit adhering to the 24-color palette and NASA insignia prohibition.',
    filesAffected: 'tools/art/core.py, scenes.py, sprites.py, sprites_mars.py, sprites_elsewhere.py, build.py',
    outputType: 'image',
    humanReviewer: 'Member 5 (Visual Design) & Member 6',
    verificationStatus: 'Verified clean; PNG provenance chunks and SI-GENERATED ILLUSTRATION watermarks embedded.',
    notes: 'All generated art explicitly labeled as illustration, never documentary NASA photography.',
  },
  {
    id: 'ai-frontend-shell',
    toolAndModel: 'Orchestrator (Argon) / Gemini',
    promptObjective: 'Build static client-side React/TypeScript observatory shell, 9 encounters, local save system, and policy pages per docs/.',
    filesAffected: 'src/App.tsx, src/game/EncounterView.tsx, src/persistence/saveManager.ts, src/data/*',
    outputType: 'code',
    humanReviewer: 'Member 1, Member 2, Member 5',
    verificationStatus: 'Verified via tsc -b, vite build, and oxlint with 0 errors.',
    notes: 'All factual claims trace to src/data/missions.json, sources.json, and encounters.json.',
  },
];
