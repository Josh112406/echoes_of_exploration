# Echoes of Exploration Dataset

Static, source-linked content dataset for **Echoes of Exploration: The NASA Signal Archive**.

## Contents

| File | Purpose |
|---|---|
| `missions.json` | Canonical 30-record mission catalog |
| `missions.csv` | Flattened spreadsheet-friendly mission catalog |
| `encounters.json` | Nine featured game encounters and evidence chains |
| `featured-encounters.csv` | Flattened encounter reference |
| `sources.json` | Canonical primary-source registry |
| `sources.csv` | Spreadsheet-friendly source registry |
| `media-candidates.json` | Official media pages and item-selection requirements |
| `mission-schema.json` | JSON Schema for the mission catalog |
| `data-quality-report.md` | Validation results and release-day checks |
| `LICENSE-DATA.md` | CC0 dedication for original normalization and prose |

## What this dataset is

- A curated, coverage-driven catalog of major NASA mission groups across the Moon, Mars, and elsewhere.
- Static content intended to ship with the web game; it requires no runtime NASA API.
- A starting point for Story, Mission Console, Deep Dive, map, filtering, and encounter content.
- Source-linked and internally reviewed on 2026-11-09.

## What it is not

- A literal inventory of every bolt, stage, debris fragment, or experiment.
- A substitute for release-day verification of active missions.
- A bundle of downloadable images. `media-candidates.json` deliberately requires item-level rights and credit review before an image is copied into the project.
- Proof that educational outcomes have been measured.

## Recommended application workflow

1. Treat `missions.json` as the canonical mission source.
2. Validate it against `mission-schema.json` during the build.
3. Join `source_ids` to `sources.json`; fail the build if a reference is unknown.
4. Join featured missions to `encounters.json` using `featured_encounter_id`.
5. Store player-facing language in localization files rather than editing the identifiers.
6. Before release, recheck every record where `status_review_required_before_release` is `true`.
7. Select authentic media from `media-candidates.json`, then add item-level URL, credit, rights note, and alt text to the project asset ledger.

## Status values

- `active-primary`
- `active-extended`
- `passive-science`
- `completed-surface`
- `completed-orbit`
- `silent-location-known`
- `silent-location-approximate`
- `intentionally-impacted`
- `unintentionally-impacted`
- `lost-or-unknown`

These are controlled internal values. The interface may display friendlier language while preserving the original value.

## Source policy

Mission facts use NASA, NASA/JPL, NASA Goddard/ILRS, or another identified mission partner. The Planetary Data System is the preferred archive for deeper instrument and data-product work. Generated summaries are not acceptable as sources.

NASA media must be reviewed under the [NASA Images and Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). NASA-hosted third-party material does not automatically become reusable NASA content.

## Maintenance

- Update `reviewed_on` when a human rechecks a record against its sources.
- Preserve stable IDs even when display names change.
- Add missions through the schema and source registry; never hard-code a mission only in game logic.
- Record uncertainty rather than forcing false precision.
- Rebuild the CSV views after canonical JSON changes.

