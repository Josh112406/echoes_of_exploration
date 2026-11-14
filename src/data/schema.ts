import { z } from 'zod';

export const WorldIdSchema = z.enum(['moon', 'mars', 'elsewhere']);
export type WorldId = z.infer<typeof WorldIdSchema>;

export const EntryTierSchema = z.enum(['flagship', 'standard']);
export type EntryTier = z.infer<typeof EntryTierSchema>;

export const MachineStatusSchema = z.enum(['active', 'dormant', 'ended', 'lost', 'drifting']);
export type MachineStatus = z.infer<typeof MachineStatusSchema>;

export const RecoveryModeSchema = z.enum(['jetpack', 'visit']);
export type RecoveryMode = z.infer<typeof RecoveryModeSchema>;

export const DifficultyIdSchema = z.enum(['easy', 'normal', 'hard']);
export type DifficultyId = z.infer<typeof DifficultyIdSchema>;

export const ArtifactLocationSchema = z.object({
  id: z.string(),
  label: z.string(),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  source_url: z.string().url(),
  approximate: z.boolean(),
  launch_date: z.string().optional(),
  end_date: z.string().nullable().optional(),
});
export type ArtifactLocation = z.infer<typeof ArtifactLocationSchema>;

export const SourcedFactSchema = z.object({
  text: z.string().min(1),
  source_url: z.string().url(),
});
export type SourcedFact = z.infer<typeof SourcedFactSchema>;

export const ArtifactImageSchema = z.object({
  nasa_id: z.string().min(1),
  file: z.string().min(1),
  credit: z.string().min(1),
  source_url: z.string().url(),
  alt: z.string().min(1),
});
export type ArtifactImage = z.infer<typeof ArtifactImageSchema>;

export const ArtifactEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  world: WorldIdSchema,
  tier: EntryTierSchema,
  status: MachineStatusSchema,
  launch_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  locations: z.array(ArtifactLocationSchema).min(1),
  summary: z.string().min(10),
  hook: z.string().min(10),
  how_it_worked: z.string().min(10),
  science: z.string().min(10),
  facts: z.array(SourcedFactSchema).min(2),
  image: ArtifactImageSchema,
  sources: z.array(z.string().url()).min(1),
  written_by: z.string().min(1),
  verified_by: z.string().min(1),
  last_verified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  recovery: RecoveryModeSchema,
}).refine(data => data.written_by !== data.verified_by, {
  message: 'written_by and verified_by must be different entities',
  path: ['verified_by'],
});
export type ArtifactEntry = z.infer<typeof ArtifactEntrySchema>;

export const TerrainSegmentSchema = z.object({
  x1: z.number(),
  y1: z.number(),
  x2: z.number(),
  y2: z.number(),
});
export type TerrainSegment = z.infer<typeof TerrainSegmentSchema>;

export const LevelConfigSchema = z.object({
  id: z.string(),
  world: WorldIdSchema,
  difficulty: DifficultyIdSchema,
  start: z.object({
    x: z.number(),
    y: z.number(),
    vx: z.number(),
    vy: z.number(),
  }),
  platform: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
  }),
  fuel: z.number().positive(),
  reference_fuel: z.number().positive(),
  terrain: z.array(TerrainSegmentSchema).min(1),
});
export type LevelConfig = z.infer<typeof LevelConfigSchema>;

export const CinematicSpriteCueSchema = z.object({
  id: z.string(),
  texture: z.string(),
  x: z.number(),
  y: z.number(),
  scale: z.number().positive().optional(),
  alpha: z.number().min(0).max(1).optional(),
  depth: z.number().optional(),
  targetX: z.number().optional(),
  targetY: z.number().optional(),
  targetAlpha: z.number().min(0).max(1).optional(),
  targetScale: z.number().positive().optional(),
  duration: z.number().nonnegative().optional(),
  thruster: z.boolean().optional(),
  visible: z.boolean().optional(),
  /** Degrees, clockwise. Thruster flames always point out of the sprite's base. */
  rotation: z.number().optional(),
  targetRotation: z.number().optional(),
  /** Place the sprite's base on the active backdrop's ground at x. */
  ground: z.boolean().optional(),
  /** Tween to the ground at targetX (or x). */
  targetGround: z.boolean().optional(),
});
export type CinematicSpriteCue = z.infer<typeof CinematicSpriteCueSchema>;

export const CinematicEventSchema = z.object({
  time: z.number().nonnegative(),
  camera: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
    zoom: z.number().positive().optional(),
    duration: z.number().nonnegative().optional(),
    shake: z.object({
      duration: z.number().nonnegative(),
      intensity: z.number().positive(),
    }).optional(),
  }).optional(),
  sprites: z.array(CinematicSpriteCueSchema).optional(),
  caption: z.object({
    tag: z.string(),
    text: z.string(),
  }).optional(),
  sound: z.object({
    cue: z.string(),
    state: z.boolean().optional(),
  }).optional(),
  /** Cross-fade to another backdrop (e.g. Moon → deep space → Mars). */
  backdrop: z.object({
    kind: z.enum(['moon', 'mars', 'space']),
    fade: z.number().nonnegative().optional(),
  }).optional(),
});
export type CinematicEvent = z.infer<typeof CinematicEventSchema>;

export const CinematicTimelineSchema = z.object({
  id: z.string(),
  world: WorldIdSchema,
  totalDuration: z.number().positive(),
  events: z.array(CinematicEventSchema),
});
export type CinematicTimeline = z.infer<typeof CinematicTimelineSchema>;

// UNIT-7 story script (game story: cyan framing, never states unsourced facts)
export const MotiveIdSchema = z.enum(['curiosity', 'legacy', 'challenge', 'together']);
export type MotiveId = z.infer<typeof MotiveIdSchema>;

const MotiveSchema = z.object({
  label: z.string().min(1),
  reply: z.string().min(1),
  theory: z.string().min(1),
  callback: z.string().min(1),
});

export const StorySiteSchema = z.object({
  title: z.string().min(1),
  /** Spoken as the radar closes in: one line, or a short sequence. */
  approach: z.union([z.string().min(1), z.array(z.string().min(1)).min(1).max(3)]),
  /** Spoken once when the machine itself comes into view (close range). */
  first_seen: z.string().min(1).optional(),
  reel: z.array(z.string().min(1)).length(6),
  afterthought: z.string().min(1),
  question: z.object({
    prompt: z.string().min(1),
    choices: z.array(z.object({ text: z.string().min(1), motive: MotiveIdSchema })).min(2).max(4),
  }),
  /** Comprehension check at the end of the briefing. `evidence` must appear verbatim in the entry's `field`. */
  quiz: z.object({
    prompt: z.string().min(1),
    choices: z.array(z.string().min(1)).min(2).max(4),
    answer: z.number().int().nonnegative(),
    field: z.enum(['summary', 'how_it_worked', 'science', 'facts']),
    evidence: z.string().min(1),
  }),
});
export type StorySite = z.infer<typeof StorySiteSchema>;

const LinePool = z.array(z.string().min(1)).min(1);

/** The ending: UNIT-7's lines (game story) and NASA's next steps (verified, with sources). */
export const FinaleSchema = z.object({
  opening: LinePool,
  reflection: LinePool,
  theory_intro: z.string().min(1),
  theory_fallback: z.string().min(1),
  horizon_intro: z.string().min(1),
  horizon: z.array(z.object({
    destination: z.string().min(1),
    text: z.string().min(1),
    source_url: z.string().url(),
    thought: z.string().min(1).optional(),
  })).min(1),
  resolution: LinePool,
  card_line: z.string().min(1),
});
export type Finale = z.infer<typeof FinaleSchema>;

export const StorySchema = z.object({
  motives: z.object({
    curiosity: MotiveSchema,
    legacy: MotiveSchema,
    challenge: MotiveSchema,
    together: MotiveSchema,
  }),
  ambient: z.object({
    first_moon: LinePool,
    first_mars: LinePool,
    first_elsewhere: LinePool,
    why: LinePool,
    moon_drive: LinePool,
    moon_idle: LinePool,
    mars_drive: LinePool,
    mars_idle: LinePool,
    elsewhere_drive: LinePool,
    elsewhere_idle: LinePool,
    passing: LinePool,
    passing_active: LinePool,
    echo_far: LinePool,
    quiz_ask: LinePool,
    quiz_right: LinePool,
    quiz_wrong: LinePool,
  }),
  sites: z.record(z.string(), StorySiteSchema),
  finale: FinaleSchema,
});
export type Story = z.infer<typeof StorySchema>;

export const SaveStateV1Schema = z.object({
  version: z.literal(1),
  currentWorld: WorldIdSchema,
  currentSiteId: z.string().nullable(),
  marsUnlocked: z.boolean(),
  elsewhereUnlocked: z.boolean().default(false),
  prologueSeen: z.boolean(),
  epilogueSeen: z.boolean(),
  entries: z.record(
    z.string(),
    z.object({
      recovered: z.boolean(),
      read: z.boolean(),
      assisted: z.boolean(),
      attempts: z.number().int().nonnegative(),
      bestFuelRemaining: z.number().nullable(),
      bestLandingSpeed: z.number().nullable(),
    })
  ),
  achievements: z.array(z.string()),
  /** UNIT-7 journal: site id → index of the answer the player chose. */
  journal: z.record(z.string(), z.number().int().nonnegative()).optional(),
  robotPositions: z.record(
    WorldIdSchema,
    z.object({
      x: z.number(),
      y: z.number(),
    })
  ).optional(),
  settings: z.object({
    textSize: z.enum(['normal', 'large', 'xlarge']),
    highContrast: z.boolean(),
    reducedMotion: z.boolean(),
    reducedEffects: z.boolean(),
    audioEnabled: z.boolean(),
    /** Mixer levels, 0..1. Saves from before the soundtrack get these defaults. */
    musicVolume: z.number().min(0).max(1).default(0.9),
    ambienceVolume: z.number().min(0).max(1).default(0.4),
    sfxVolume: z.number().min(0).max(1).default(1),
    captionsEnabled: z.boolean(),
    alwaysSkipChallenge: z.boolean(),
  }),
});
export type SaveStateV1 = z.infer<typeof SaveStateV1Schema>;

