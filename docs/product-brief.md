# Product Brief

## Problem

NASA mission histories are rich but scattered across technical pages, archives, and long timelines. Younger and casual learners often encounter famous active missions while missing the hardware that enabled earlier discoveries. A list of artifacts is not enough: the product must connect engineering action to scientific evidence and human curiosity.

## Product vision

**Echoes of Exploration: The NASA Signal Archive** is a story-driven web game in which a new Signal Archivist reconstructs “memory echoes” from mission records. Completing short, scientifically faithful interactions restores an observatory museum and reveals how each machine changed what humanity knows.

The fiction is a framing device. Dormant hardware is never presented as truly conscious or currently transmitting. Factual explanation, scientific interpretation, and dramatization are visibly distinct.

## Audience

### Primary

- Ages 10–13.
- Comfortable with basic reading and simple touch, pointer, or keyboard input.
- May know famous mission names without understanding instruments or evidence.

### Extended

- Younger players can follow the story layer with hints and assisted completion.
- Older learners and adults can open Mission Console and Deep Dive layers.
- Teachers and families can use source panels, but a teacher dashboard is not in scope.

## Learning intent

The product is educational but makes no measured-effectiveness claim. It is designed to help players:

1. Explain how hardware and instruments made particular discoveries possible.
2. Recognize that engineering constraints shape scientific choices.
3. Distinguish evidence from interpretation and dramatization.
4. Compare active, passive, dormant, completed, lost, and impacted hardware.
5. Follow mission-to-mission connections across six decades.

Priority: **science enabled by hardware**, then **engineering decisions**, then **artifact identification**.

## Product principles

1. **Do, then understand.** Explanations prepare a choice or interpret its result.
2. **Wonder without deception.** Emotional storytelling never invents a discovery.
3. **Sources are part of the experience.** They are visible, readable, and mission-specific.
4. **Failure teaches.** Soft failure provides feedback and immediate retry or assistance.
5. **No learner is locked out.** Free exploration remains available.
6. **Broad catalog, focused play.** Nine encounters receive full treatment; other missions remain meaningful records.
7. **Local and private.** No account, telemetry, advertising, or server-side profile.

## Scope

### Included

- Opening, three chapters, nine encounters, ending.
- Observatory home, stylized solar-system map, Moon/Mars/Elsewhere views.
- Searchable/filterable museum catalog with approximately 25–40 mission groups.
- Story, Mission Console, Deep Dive, and Behind the Memory layers.
- Mission patches, restored displays, and discovery connections.
- Optional local call sign; progress, settings, and achievements in browser storage.
- Export/import and complete reset.
- Credits, sources, methodology, privacy, copyright/attribution, and accessibility pages.
- English release with localization-ready strings.

### Excluded

- Backend, login, cloud sync, leaderboards, chat, ads, telemetry, remote content, runtime NASA API calls.
- Offline guarantee or installable PWA requirement.
- Full narration, voice cloning, multiplayer, 3D simulation, teacher dashboard, localization at launch.
- Claims of educational impact or comprehensive inventory of every physical component.

## Essential screens

1. Title: New / Continue / Free Explore / Settings / About.
2. Optional call-sign prompt.
3. Observatory hub with campaign progress.
4. Solar-system map and destination chapters.
5. Encounter shell: story, interaction, result, Behind the Memory.
6. Museum catalog: search, filters, mission detail, bookmarks.
7. Achievements and restored connections.
8. Settings and accessibility.
9. Sources/methodology, privacy, attribution, license, credits.
10. Unsupported-graphics and save-recovery states.

## Nonfunctional targets

- 360 × 640 phones through desktop displays.
- Target 60 FPS; required interaction remains usable at 30 FPS.
- Playable baseline for a 4 GB RAM school laptop.
- Initial transfer target below 8 MB; lazy-load later chapter media.
- Recent Chrome, Edge, Firefox, and Safari, including mobile variants.
- No essential hover, precision dragging, high-speed reaction, or audio-only information.

## Product success criteria

Success is release completeness, not telemetry:

- All nine encounters are playable from start to resolution.
- Every claim and asset has recorded provenance.
- Campaign, free exploration, search/filter, saves, reset, and policies function.
- Keyboard, touch, reduced motion, contrast, text scaling, and canvas alternatives pass acceptance checks.
- Static build deploys to both Vercel- and Netlify-compatible hosting.

