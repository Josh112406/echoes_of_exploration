# Echoes of Exploration: The NASA Signal Archive

Build-ready planning package for a six-person, 12-hour NASA Space Apps educational game project. This package specifies the product; it does not contain application code or a demo.

## Product in one sentence

Players become Signal Archivists who recover nine dramatized—but source-grounded—memories from NASA hardware on the Moon, Mars, an asteroid, and deep space, then preserve those discoveries in an explorable museum.

## Frozen decisions

- Browser game for mobile and desktop, deployed as a static site to Vercel or Netlify.
- Core audience ages 10–13; readable story summaries and optional Deep Dives broaden the range.
- Complete campaign: nine adjustable encounters, grouped 3 × 3 across Moon, Mars, and Elsewhere.
- Broader catalog: coverage-driven selection of approximately 25–40 major NASA mission groups.
- Technology: TypeScript, Vite, Phaser, semantic HTML overlays, bundled static content, local browser saves.
- No backend, accounts, telemetry, advertising, third-party runtime APIs, or offline requirement.
- Authentic artifact imagery in archive/evidence views; gameplay may use clearly labeled illustrations.
- WCAG 2.2 AA target for the surrounding interface, with equivalent non-canvas routes.
- Apache-2.0 original code; CC0 team-created prose/data/art; external assets retain their own terms.
- No claim that learning effectiveness has been measured.

## Document map

| File | Purpose | Primary owner |
|---|---|---|
| [product-brief.md](product-brief.md) | Product definition, audience, scope, goals | Member 1 |
| [game-design.md](game-design.md) | Core loop, nine encounters, progression | Members 1 and 3 |
| [narrative-and-learning.md](narrative-and-learning.md) | Story, voices, learning approach | Members 1 and 4 |
| [mission-catalog.md](mission-catalog.md) | Featured roster and broader catalog | Member 4 |
| [sources-and-content-methodology.md](sources-and-content-methodology.md) | Research, citations, provenance | Member 4 |
| [technical-architecture.md](technical-architecture.md) | Client architecture and nonfunctional design | Member 2 |
| [data-model.md](data-model.md) | Content, campaign, saves, localization | Members 2 and 4 |
| [accessibility-privacy-legal.md](accessibility-privacy-legal.md) | WCAG, privacy, licensing, attribution | Member 6 |
| [team-workflow.md](team-workflow.md) | Conflict-free collaboration and delegation | Members 1 and 2 |
| [twelve-hour-execution-plan.md](twelve-hour-execution-plan.md) | Hour-by-hour work plan | Member 1 |
| [testing-and-acceptance.md](testing-and-acceptance.md) | Test matrix and definition of done | Member 6 |
| [risks-and-mitigations.md](risks-and-mitigations.md) | Prioritized risks and fallback order | Member 1 |
| [pitch-and-submission.md](pitch-and-submission.md) | Judging narrative and submission checklist | Member 1 |
| [folder-structure.md](folder-structure.md) | Proposed repository structure and ownership | Member 2 |

## Traceability snapshot

| Requirement | Design location | Acceptance evidence |
|---|---|---|
| Nine complete encounters | `game-design.md` | All nine start, resolve, reward, and cite a source |
| Adjustable roster | `data-model.md` | Reorder/disable an encounter using only the campaign manifest |
| Mobile and desktop | `technical-architecture.md` | Test matrix at 360 × 640 through desktop |
| Authentic hardware media | `sources-and-content-methodology.md` | Asset ledger has origin, credit, and usage status |
| Local retention | `data-model.md` | Refresh persists progress; reset and export/import work |
| No data collection | `accessibility-privacy-legal.md` | Network inspection shows no analytics or user-data request |
| Source-linked science | `mission-catalog.md` | Every published mission record has at least one primary source |
| Conflict-free teamwork | `team-workflow.md` | File ownership and merge gates followed |

## Definition of success

The released URL loads without an account; a player can finish the nine-encounter campaign, revisit unlocked records, inspect sources, use keyboard or touch, change accessibility settings, export or erase local progress, and reach the credits and policy pages. No placeholder, broken destination, unsourced fact, or unlicensed asset remains.

