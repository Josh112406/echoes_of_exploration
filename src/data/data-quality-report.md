# Data Quality Report

## Release

- Dataset version: 1.0.0
- Review date: 2026-11-09
- Scope: 30 mission groups; nine featured encounters
- Geographic chapters: 10 Moon, 10 Mars, 10 Elsewhere
- Runtime API dependency: none

## Validation performed

- All JSON files parse successfully.
- Mission IDs and encounter IDs are unique.
- Every mission has at least one registered source ID.
- Every source ID used by a mission resolves in `sources.json`.
- Every featured mission resolves to one encounter.
- Every encounter resolves to one featured mission and one source.
- Status values conform to the controlled vocabulary.
- Dates use ISO `YYYY-MM-DD` or `null`.
- All mission records include official media-page URLs.
- CSV views are mechanically generated from the canonical JSON.

## Records requiring release-day status review

The following are intentionally marked because their current activity or passive-science status can change:

- Apollo 11 surface hardware
- Apollo 14 surface hardware
- Apollo 15 surface hardware
- Curiosity
- Perseverance
- Voyager 1
- Voyager 2
- New Horizons

Check the linked authority before publishing player-facing status or operating-instrument details.

## Known limitations

1. The catalog groups related mission hardware and is not a component inventory.
2. Dates describe the representative mission group or a key event; multi-spacecraft groups can contain additional dates.
3. Surface/orbit coordinates are not yet included. Add them only from authoritative geospatial or mission sources.
4. Instrument inventories are summarized as hardware types; Deep Dive content should consult mission/PDS documentation.
5. `media-candidates.json` identifies official pages, not final image files. This avoids silently importing third-party or insufficiently credited media.
6. Some present locations are necessarily approximate for silent probes on escape trajectories.
7. Cassini–Huygens includes international partner hardware and therefore requires partner-specific credit and rights checks.
8. Scientific summaries are concise educational descriptions, not complete mission science reviews.

## Scientific caution flags

- Viking biology results must remain qualified and multi-test.
- Spirit’s water story should identify the exact silica/mineral evidence used by the final encounter.
- Voyager instrument availability and communications status must be rechecked immediately before release.
- Lunar retroreflectors are passive; do not describe them as powered transmitters.
- Deep Impact’s impactor and flyby spacecraft have different final states.

## Media gate

No image should enter the game until its asset-ledger row contains:

- Direct item URL
- Producing organization/mission
- Full supplied credit line
- Authentic photograph/raw image/official illustration/team illustration classification
- Third-party copyright check
- Allowed-use basis
- Transformations made
- Alt text and player-facing caption
- Human reviewer

## Next enrichment pass

For production-quality Deep Dives, add:

1. Instrument-level records and PDS archive links.
2. Coordinates and geospatial confidence.
3. One item-level authentic-media record per featured encounter.
4. Age-layered Story, Mission Console, and Deep Dive strings.
5. Claim-level ledger entries mapping each sentence to a source section.

