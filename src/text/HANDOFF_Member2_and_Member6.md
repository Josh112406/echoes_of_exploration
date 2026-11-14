# Handoff from Member 4 (Science Writer)

Files live in `src/text/`: `narrative.json` (master data), `Memory_Echo_Scripts.md` (readable copy), `Quick_Task_Design.md` (task build guide), and this note.

## Member 2: start here
1. Priority: `echo-never-sleeps` (Apollo 11), then `question-in-the-soil` (Viking 1). Both have `handoff_priority: true`.
2. Load `narrative.json` -> `encounters[]`, keyed by the same `id` as `encounters.json`.
3. **Show at the start of every encounter:** `ui_copy.echo_frame` plus that encounter's `status_badge.label`. This keeps dramatized voices visibly separate from facts and shows dormant hardware as dormant (RULES.md section 4).
4. Dialogue: `memory_echo.beats[]`, fired by `trigger` (list in `voice_rules.trigger_vocabulary`). Outcomes: `success | partial | fail`.
5. Tasks: `quick_task` per encounter (steps, prompts, win conditions, retry lines). Results: success = no hint and under 3 retries; partial otherwise; no hard fail.
6. Apollo 11 math: `game_support.formula`, `constants`, `plausible_round_trip_range_s`. Replace the tokens `{round_trip_s}` and `{distance_km}` at runtime.
7. Viking: obey `copy_guardrails.never_say`; show Behind the Memory after any outcome.

## Member 6: please verify and fix
- **Wrong NSSDCA mapping.** `sources.json` `nssdca-alsep` is titled "Apollo 11 ALSEP Package" with id `1969-099C`. NASA records list `1969-099C` as the **Apollo 12** lunar module / ALSEP. Apollo 11's id `1969-059C` is correct.
- **LRV label.** `nssdca-lrv` is titled LRV-1 (`1971-063C`). Apollo 17's rover was LRV-3, and 1971-063 is the Apollo 15 timeframe. Check before captioning it as Apollo 17 hardware.
- **Add this source** (primary, NASA JPL) so the Voyager 1 key numbers can cite it directly:
  `{"id":"jpl-voyager1-2026-078","title":"NASA's Voyager 1 Conserves Power, Resolves Brief Communications Pause","organization":"NASA JPL","url":"https://www.jpl.nasa.gov/news/nasas-voyager-1-conserves-power-resolves-brief-communications-pause/","tier":"primary-mission-authority","local_snapshot":null}`
- **Voyager 1 dataset wording.** The dataset says "fields-and-particles", but secondary reports say only the magnetometer and plasma-wave instruments remain on (NASA's status page is the authority). Read it before naming instruments. Narrative copy names none.
- **Title note.** "The Echo That Never Sleeps" is figurative for a passive reflector. It is in `encounters.json`, so it is your call; the status badge already says the reflector has no power.
- **Still unchecked** (no local snapshots): Surveyor 1, Spirit, Ingenuity facts, and the Apollo 17 stop names (listed per encounter in `verify`).

## Member 5 / Member 6: References and AI disclosure (RULES.md 1.4)
Add the entries in `references_consulted` (in `narrative.json`) to the References field, plus the NASA sources in `sources.json`. Suggested disclosure text, to use only once a team member has actually reviewed the content:
> "The game's narrative text and science cards (src/text/) were drafted with an AI assistant (Claude, by Anthropic). A team member reviewed the text and checked its facts against the NASA sources listed in References."
