# Data Model

This document specifies contracts, not implementation code.

## Mission record

Required fields:

- Stable `id` and localized display name.
- Agency/partner ownership and mission grouping.
- Destination, hardware type, launch/arrival/end milestones.
- Controlled current-status value and internal review date.
- Purpose, operation, instrument(s), evidence, discovery, uncertainty.
- Location description; coordinates only when a primary source supports them.
- Story summary, Mission Console, Deep Dive.
- Source references and claim-ledger identifiers.
- Authentic media references and provenance.
- Related missions and discovery connections.
- Accessibility text and pronunciation notes where useful.

## Campaign manifest

Required fields:

- Campaign ID, title, version.
- Chapter definitions and order.
- Active encounter IDs and order.
- Mission record ID for each encounter.
- Mechanic family and configuration reference.
- Prerequisites and unlock rewards.
- Asset bundle ID.
- Localization namespace.
- Opening/closing narrative references.

The manifest must allow maintainers to activate, deactivate, reorder, or replace encounters without editing application code.

## Encounter record

- Encounter ID and mission ID.
- Hook and learning intent.
- Mechanic family.
- Setup, choices/parameters, result rules, feedback.
- Assisted-completion rules.
- Evidence/result explanation.
- “How the game simplified this” statement.
- Reward and connection.
- Source and claim IDs.
- Keyboard instructions and non-canvas alternative.

## Source record

- Stable source ID.
- Title, publishing organization, canonical URL.
- Mission/archive identifiers when available.
- Access/review date.
- Source tier.
- Claims supported.
- Rights/credit notes for media.

## Asset record

- Stable asset ID and local path.
- Asset role: authentic evidence / official illustration / team art / generated support / audio.
- Origin URL, creator, credit line, item identifier.
- License or usage-guideline basis.
- Modifications and disclosure label.
- Human reviewer.
- Alt text, caption, dimensions, and performance variant.

## Save record

- Save-schema version.
- Optional call sign.
- Completed encounters and chapters.
- Unlocked mission records and patches.
- Bookmarked predefined observations.
- Settings: audio, text size, contrast, reduced motion, quality, assistance.
- Last selected route and safe recovery checkpoint.
- Content/campaign version used.

Do not store age, email, school, location, analytics identifier, or free-form notes.

## Save lifecycle

1. Read and validate.
2. Migrate known older schema versions.
3. If invalid, preserve the original and offer recovery/reset.
4. Write atomically where practical.
5. Export as human-readable JSON with schema and game versions.
6. Import only after file-size, shape, value, and version validation plus user confirmation.
7. Reset removes all game-owned keys.

## Localization model

- English ships first.
- All player-facing text uses stable string keys.
- Content and UI namespaces remain separate.
- Do not concatenate sentence fragments that translators cannot reorder.
- Support pluralization and variable interpolation safely.
- Layout tolerates text expansion.
- Sources, proper nouns, units, and pronunciation metadata remain attached to records.

## Validation gates

| Gate | Failure condition |
|---|---|
| Identity | Duplicate or missing ID |
| Completeness | Required text/source/accessibility field absent |
| References | Unknown mission, source, asset, mechanic, or string key |
| Science | Claim lacks ledger/source mapping |
| Rights | Asset lacks provenance or usage status |
| Accessibility | Missing alt text, keyboard instructions, or alternative |
| Campaign | Broken prerequisite, unreachable node, or invalid order |
| Save | Unsupported version or unsafe value |

## Change control

After Hour 4, campaign shape and schemas are frozen. New content must fit existing contracts. Factual corrections, accessibility fixes, and critical defects remain allowed with reviewer approval.

