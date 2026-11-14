# Team Workflow and Conflict Prevention

## Roles and ownership

| Member | Primary role | Owns | Must review |
|---|---|---|---|
| 1 | Product owner / narrative / submission | Scope, copy integration, decisions, pitch | Final content and release |
| 2 | Technical lead / integrator | Shell, build, schemas, deployment, merges | All structural changes |
| 3 | Game systems | Mechanic families, encounter configuration | Encounter behavior |
| 4 | NASA research / catalog | Mission records, claims, sources, provenance | All factual content |
| 5 | Visual design | Art direction, sprites, maps, motion, asset optimization | Visual assets and labels |
| 6 | Accessibility / QA / audio / policy | Test matrix, accessible alternatives, audio, policies | Release acceptance |

Skills are unknown at planning time. At kickoff, swap assignments only through Member 1; preserve numbered ownership and document the change.

## Repository rules

- One shared repository; `main` is protected and deployable.
- No direct push or force-push to `main`.
- Short-lived branches: `m<member>/<area>-<task>`, e.g. `m4/content-viking`.
- One task and coherent file set per pull request.
- PR requires one reviewer other than the author.
- Member 2 merges and resolves structural overlaps.
- Author rebases/updates before review; integrator does not silently rewrite content.
- Never overwrite another member’s unmerged work.
- Lockfile, schemas, shared styles, campaign manifest, and routing require Member 2 review.
- Facts, sources, and authentic-media claims require Member 4 review.
- Accessibility-affecting UI requires Member 6 review.

## File ownership rule

Ownership means final review responsibility, not exclusive editing. Before touching another owner’s files, post the intended paths and reason on the status board. If two tasks need the same file, sequence them or split the file before work begins.

## Status board

Each row records:

| Task | Owner | Files | Depends on | State | Reviewer | Due |
|---|---|---|---|---|---|---|

States: `ready`, `active`, `review`, `blocked`, `merged`, `cut`. Update at least hourly and before handoff.

## Pull-request template

- Objective and acceptance criterion.
- Files changed and owner notified.
- Screens/encounters affected.
- Verification performed.
- Sources/assets added with ledger links.
- Accessibility and performance effects.
- Assistant contribution and human validation.
- Remaining issues or explicit none.

## Handoff template

1. What is complete.
2. Exact files and stable IDs.
3. Verification result.
4. Source/provenance status.
5. Known limitations.
6. Next owner and required action.

## Integration gates

- **Hour 1:** shell, schemas, theme, repository rules frozen.
- **Hour 2:** one vertical encounter end-to-end; mechanic APIs frozen.
- **Hour 4:** all nine content skeletons valid; feature/content freeze begins.
- **Hour 7:** all encounters merged and reachable; no new assets without replacement.
- **Hour 9:** release candidate; only defects, citations, accessibility, performance, submission.
- **Hour 11:** final deployed URL and submission material frozen.

## Assistant delegation rule

Delegate a concrete bounded task whenever it can run independently and a suitable assistant is truly available. Research, drafting, review, and isolated implementation are good candidates. Coordination, final judgment, secrets, and ambiguous cross-cutting work remain human-owned.

Before assigning:

1. Check installed tool and exact available model identifiers.
2. Run a live zero-tool availability prompt for the current task environment.
3. Explicitly select the non-GPT model; never rely on an unknown default.
4. If Qwen is considered, require a configured funded provider and successful live prompt.
5. Give role (`explorer`, `worker`, or `default`), objective, constraints, owned files, evidence requirement, and completion criterion.
6. Do not provide credentials, private data, or unrelated project material.

After return:

1. Require a concise report: findings/changes, file or source references, verification, unresolved issues.
2. Human owner reviews facts, rights, security, and integration.
3. Record provider/model and validation in the assistant ledger.
4. If no suitable non-GPT assistant is available or it fails, report the limitation and continue directly; do not silently substitute another provider.

## Conflict protocol

1. Stop edits to the overlapping file.
2. Preserve both branches.
3. Owners summarize intended behavior, not just line changes.
4. Member 2 proposes integration; Member 1 decides product conflicts.
5. Relevant reviewer confirms facts/accessibility.
6. Merge smallest verified resolution and record the decision.

## Change control after Hour 4

No new mission, mechanic, screen, or user-facing feature unless Member 1 removes comparable effort. Exemptions: factual correction, broken source, critical bug, accessibility failure, privacy/security issue, or rights problem.

## Communication cadence

- Five-minute kickoff.
- Hourly five-minute checkpoint.
- Immediate escalation for blocked shared contracts, missing rights, or unsourced facts.
- No long status meeting during integration; use the board and PR evidence.

