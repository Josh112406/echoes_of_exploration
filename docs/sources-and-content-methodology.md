# Sources and Content Methodology

## Evidence hierarchy

Use the highest available tier for every factual claim:

1. **Primary mission authority:** NASA Science, NASA/JPL, mission center, official project pages.
2. **Archived data:** NASA Planetary Data System (PDS), NSSDC, NTRS, mission documentation.
3. **Authoritative measurement service:** such as the International Laser Ranging Service for lunar reflectors.
4. **Partner agency source:** ESA or another mission partner for partner-owned hardware or media.
5. **Secondary explanation:** only for context, never as the sole support for a mission-defining claim.

Wikipedia, unsourced videos, social posts, and generated summaries can help discover terms but cannot support published claims.

## Required source set

- [NASA Planetary Data System](https://pds.nasa.gov/) — peer-reviewed planetary mission data archive.
- [NASA planetary data repositories](https://planetary.data.nasa.gov/find-data) — directory of mission and discipline resources.
- [NASA Moon missions](https://science.nasa.gov/moon/missions/) — broad mission chronology.
- [NASA Mars Exploration Program](https://science.nasa.gov/planetary-science/programs/mars-exploration/) — mission context.
- [NASA Open APIs](https://api.nasa.gov/) — discovery and media access only; no runtime dependency.
- [NASA Image and Video Library](https://images.nasa.gov/) — media discovery, with item-level credits checked.
- [NASA media usage guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) — rights and attribution.
- [2026 Space Apps participant terms](https://www.spaceappschallenge.org/legal/) — submission and licensing constraints.
- Challenge Resources-tab links must be added at kickoff and marked as challenge-provided.

## Research workflow per mission

1. **Frame the question:** hardware, purpose, operation, evidence, conclusion, status, location.
2. **Open the mission authority page:** record canonical URL, page title, and access date.
3. **Trace the scientific claim:** find the relevant instrument or archived-data description.
4. **Separate layers:** confirmed observation, scientific interpretation, current status, and dramatization.
5. **Write age-appropriate text:** preserve uncertainty; define jargon.
6. **Record media provenance:** source URL, creator/credit line, item identifier, rights note, transformations.
7. **Independent human review:** reviewer follows sources and signs the record.
8. **Validate content:** required fields, links, status vocabulary, missing credits.
9. **Freeze:** after Hour 4, only corrections, accessibility repairs, and critical defects bypass change control.

## Claim ledger

Every content record should be traceable to a ledger row:

| Field | Meaning |
|---|---|
| Claim ID | Stable identifier, e.g. `spirit-water-01` |
| Published wording | Exact game statement |
| Claim type | Fact / interpretation / status / dramatization |
| Primary source | Canonical URL or archive identifier |
| Supporting source | Optional second authority |
| Reviewed on | Internal date |
| Reviewer | Named team member |
| Confidence note | Ambiguity, qualification, or scope |

## Source-specific guardrails

- **Viking life experiments:** present the combined evidence and uncertainty; do not state a simplistic final proof.
- **Spirit water evidence:** identify the specific material/instrument evidence used by the encounter.
- **Voyager/New Horizons status:** recheck immediately before deployment because active-mission details change.
- **Apollo reflectors:** describe them as passive arrays; distinguish them from powered ALSEP experiments.
- **Cassini–Huygens:** credit ESA for Huygens and follow partner-media rights.
- **Commercial Lunar Payload Services:** distinguish NASA-funded payloads from commercially owned landers.

## Authentic media rule

Archive/evidence representations of hardware must use authentic mission photography, raw imagery, or an official illustration clearly identified as such. Gameplay may use team-created or AI-assisted art only when it is labeled “illustration” and cannot be mistaken for documentary evidence.

NASA content is generally available for educational/informational use, but item-level third-party credits, identifiable people, logos, and endorsement restrictions still apply. NASA must be acknowledged. Do not assume every file hosted on a NASA page is NASA-owned.

## AI-assistance ledger

For each assistant contribution record:

- Tool/provider and exact model identifier.
- Live-availability check result.
- Prompt objective and bounded scope.
- Files or claims affected.
- Output type: research lead, draft, code, review, image, or audio.
- Human verification owner and result.
- Asset provenance, disclosure, and rights status.
- Unresolved assumptions.

Assistants may not approve their own facts or legal conclusions. Generated artifact images cannot replace authentic evidence media. Never pass credentials, personal information, or unnecessary private data.

## No runtime data dependency

Research may use NASA APIs and archives during production. Published mission content is normalized into version-controlled static files. The live game does not depend on an API, preventing availability, rate-limit, CORS, schema-change, and privacy failures.

## Citation display

Each mission detail page includes a readable Sources section. The Behind the Memory panel shows the source used for the encounter, what the real instrument did, how gameplay simplified it, and the limits of the conclusion. Avoid academic citation clutter inside story dialogue.

