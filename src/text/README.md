# Narrative & Game Text Assets (`src/text/`)

**Project:** Echoes of Exploration: The NASA Signal Archive  
**Author:** Member 4 (Science Writer & Narrative Designer)  
**Directory:** `src/text/`

This directory contains the complete narrative copy, verified historical records, and tactile micro-task specifications for all nine spacecraft encounters in *Echoes of Exploration*.

---

## Directory Contents

| File | Format | Purpose & Audience |
|---|---|---|
| **`narrative.json`** | JSON (v1.0.0) | **Master machine-readable data.** Consumed directly by the React/TypeScript application (`Member 2`) for encounter dialogue, status badges, math formulas, quick-task steps, and verified science cards. |
| **`Memory_Echo_Scripts.md`** | Markdown | **Human-readable narrative reference.** Contains the full dramatized "Memory Echo" scripts, trigger tables, and factual "Behind the Memory" cards for team review (`Member 5` & `Member 6`). |
| **`Quick_Task_Design.md`** | Markdown | **Interaction & UI/UX build guide.** Breaks down the 1-to-3 step tactile micro-tasks, controls, win conditions, difficulty scaling, and visual/audio feedback cues (`Member 2` & `Member 3`). |
| **`HANDOFF_Member2_and_Member6.md`** | Markdown | **Actionable team handoff checklist.** Highlights priority encounters (`echo-never-sleeps`, `question-in-the-soil`), dataset/NSSDCA ID fixes for `Member 6`, and AI disclosure text for `Member 5`. |

---

## Core Design & Scientific Standards (`RULES.md` Compliance)

All content in `src/text/` adheres strictly to the project's scientific and competition guidelines:

1. **Archive Replay Framing (No Fake Science):**
   * Dramatized hardware narration (**Memory Echo**) is always visually paired with `ui_copy.echo_frame` (*"Archive replay: a dramatized voice built from mission records."*) and the mission's `status_badge.label` to keep story hooks distinct from verified facts.
   * Dormant or completed spacecraft are explicitly labeled as silent/completed and never depicted as conscious or currently transmitting.
2. **Qualified Scientific Uncertainty:**
   * Ambiguous historical findings (such as Viking 1's 1976 Martian soil experiments) present all evidence cards objectively and enforce `copy_guardrails.never_say` rules to prevent overstating conclusions.
3. **Original Micro-Task Mechanics:**
   * Every encounter features a 15–35 second, single-gesture micro-task (`tap`, `drag`, `hold`, `swipe`, `slide`, or `toggle`) with a 48px minimum touch target, non-color-dependent feedback, and no hard fail states.

---

## Quick Integration Guide (`Member 2`)

1. **Priority Handoff:** Start by wiring the two encounters flagged with `"handoff_priority": true`:
   * `echo-never-sleeps` (Apollo 11 Laser Retroreflector)
   * `question-in-the-soil` (Viking 1 Lander)
2. **Encounter Mapping:** Match `encounters[].id` in `narrative.json` with `encounters.json` (`src/data/`).
3. **Required UI Framing:** Render `ui_copy.echo_frame` alongside `encounter.status_badge.label` at the launch of every encounter.
4. **Dynamic Math (Apollo 11):** Use `game_support.formula` (`distance_km = speed_of_light_km_s * round_trip_s / 2`) with a `round_trip_s` value inside `plausible_round_trip_range_s` (`[2.38, 2.71]`) to populate `{round_trip_s}` and `{distance_km}` at runtime.
5. **Scoring Logic:**
   * `success`: Completed with **0 hints** and **< 3 retries**.
   * `partial`: Completed using a hint or **3+ retries**.
   * `fail`: Used strictly as a retry prompt (`outcomes.fail`), never a dead-end screen.

---

## Featured Encounters (9 Missions)

### Chapter 1: The Moon
1. **A Gentle Touch** (`surveyor-1`) — *Soft Landing* (Hold & Release)
2. **The Echo That Never Sleeps** (`apollo-11-surface`) **[Priority]** — *Ping the Moon* (Drag & Tap)
3. **Farther Than Footsteps** (`apollo-17-surface`) — *Plan the Drive* (Tap Route)

### Chapter 2: Mars
4. **A Question in the Soil** (`viking-1`) **[Priority]** — *Read the Results* (Flip Cards & Infer)
5. **Clues Beneath the Wheel** (`spirit`) — *Dig and Match* (Swipe, Tap & Connect)
6. **Air Thin as a Whisper** (`ingenuity`) — *Pre-flight Check* (Slide & Tap)

### Chapter 3: Deep Space & Asteroids
7. **Landing Where No Landing Was Planned** (`near-shoemaker`) — *Slow Descent* (Tap & Prioritize)
8. **Power for the Unknown** (`voyager-1`) — *Divert Power* (Toggle Switches & Drag)
9. **One Chance at Pluto** (`new-horizons`) — *Plan the Flyby* (Drag Schedule)

---

## Verification & References (`Member 5` & `Member 6`)

* **Fact-Checking:** Each encounter in `narrative.json` includes a `verify` array flagging items requiring final cross-checks against `src/data/sources.json` and NASA mission pages before release.
* **References & AI Disclosure:** All primary NASA/JPL/NSSDCA/NIST sources consulted during drafting are logged under `references_consulted` in `narrative.json` for inclusion in the final Space Apps submission ledger.