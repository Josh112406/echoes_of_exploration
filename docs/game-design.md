# Game Design

## Core fantasy

The player is a trainee Signal Archivist inside a quiet observatory whose collection has not yet been reconstructed. Mission records become “memory echoes”: short first-person impressions accompanied by a factual Archivist layer. Recovering three echoes in each destination restores that wing of the museum; recovering all nine earns the Signal Archivist patch and reopens the observatory.

## Core loop

**Explore → contact an artifact → hear a memory → perform a mission task → inspect evidence → archive the discovery → restore a connection**

Each encounter lasts about 2–3 minutes:

1. **Hook (15–25 seconds):** one question or mystery.
2. **Context (20–30 seconds):** objective, hardware, constraint.
3. **Interaction (60–90 seconds):** simplified authentic cause-and-effect.
4. **Result (20–30 seconds):** evidence and scientific meaning.
5. **Archive (20–30 seconds):** source, simplification note, reward, connection.

Target balance: approximately 60% interaction and 40% story/explanation.

## Three mechanic families

### Navigate and manage

Route, power, heat, time, terrain, or range. The player chooses among understandable tradeoffs; no twitch piloting is required.

### Observe and infer

Aim an instrument, compare readings, identify a pattern, and choose the conclusion supported by evidence.

### Communicate and preserve

Prioritize observations or instruments under bandwidth, storage, signal, or power constraints.

## Nine adjustable encounters

The campaign manifest controls order and activation. Each encounter must also work as a standalone Free Explore entry.

### Chapter I — Moon: Learning to Reach

#### 1. Surveyor 1 — “A Gentle Touch”

- Mechanic: navigate/manage.
- Player task: interpret altitude and descent-rate cues to select safe automated descent corrections.
- Teaches: soft landing requires controlled velocity, sensing, and shock absorption.
- Evidence: returned images and landing-performance data helped demonstrate lunar surface operations.
- Accuracy guardrail: do not depict Surveyor as manually joystick-flown.

#### 2. Apollo 11 Lunar Laser Ranging Retroreflector — “The Echo That Never Sleeps”

- Mechanic: observe/infer.
- Player task: align a laser pulse, distinguish return signal from noise, and infer distance from round-trip time.
- Teaches: passive hardware can enable science for decades; measurement uncertainty matters.
- Accuracy guardrail: the array does not generate power or transmit a radio signal.

#### 3. Apollo 17 Lunar Roving Vehicle — “Farther Than Footsteps”

- Mechanic: navigate/manage.
- Player task: plan a geology traverse within time, range, safety, and sample-value constraints.
- Teaches: mobility expands the scientific area humans can examine.
- Accuracy guardrail: simplify, but retain the need to remain within safe return capability.

### Chapter II — Mars: Reading a Changing World

#### 4. Viking 1 Lander — “A Question in the Soil”

- Mechanic: observe/infer.
- Player task: select samples, compare experiment results, and choose the conclusion justified by the combined evidence.
- Teaches: ambiguous results require multiple tests; absence of confirmation is not proof of impossibility.
- Accuracy guardrail: never state that Viking proved or disproved all Martian life.

#### 5. Spirit — “Clues Beneath the Wheel”

- Mechanic: navigate plus observe.
- Player task: choose a route, inspect exposed material, and match instrument evidence to past-water interpretation.
- Teaches: unexpected engineering events can expose scientifically valuable material.
- Accuracy guardrail: source the specific evidence used; do not reduce all of Mars history to one sample.

#### 6. Ingenuity — “Air Thin as a Whisper”

- Mechanic: navigate/manage.
- Player task: choose rotor, energy, altitude, and terrain decisions for a short flight.
- Teaches: powered flight is possible in a very thin atmosphere through lightweight design and fast rotors.
- Accuracy guardrail: no combat, cargo, or human transport capability.

### Chapter III — Elsewhere: Beyond the Familiar

#### 7. NEAR Shoemaker — “Landing Where No Landing Was Planned”

- Mechanic: observe then navigate.
- Player task: map Eros, refine a safe descent, and preserve final observations.
- Teaches: orbital measurements reveal shape and composition; adaptive planning can extend a mission.
- Accuracy guardrail: explain that the spacecraft was not originally designed as a lander.

#### 8. Voyager 1 — “Power for the Unknown”

- Mechanic: communicate/preserve.
- Player task: allocate limited power among instruments and prioritize a small data stream.
- Teaches: long missions survive through power management and the Deep Space Network; interstellar science differs from planetary imaging.
- Accuracy guardrail: status and operating-instrument claims require a source check immediately before release.

#### 9. New Horizons — “One Chance at Pluto”

- Mechanic: communicate/preserve.
- Player task: schedule observations through a fast flyby under time, pointing, and storage constraints.
- Teaches: a flyby requires years of preparation for a brief encounter; data may take a long time to return.
- Accuracy guardrail: distinguish Pluto encounter results from later Arrokoth and heliophysics work.

## Progression and rewards

- Completing any encounter awards its mission patch and restores one display.
- Completing a chapter reveals a “Discovery Bridge” showing how earlier engineering enabled later work.
- Completing all nine awards the Signal Archivist patch and unlocks the full observatory view.
- No currency, loot boxes, streak pressure, leaderboards, or public score.

## Difficulty and failure

- Soft failure explains the physical or scientific consequence.
- Retry is immediate; attempts are not counted publicly.
- After repeated attempts, assisted completion highlights the relevant evidence and still awards progress.
- Free Explore is never gated by campaign success.
- Optional Junior Guidance enlarges cues; Deep Dive does not make interactions harder.

## Input design

- All actions work with pointer/touch and keyboard.
- Use discrete choices and forgiving target sizes; avoid required drag precision.
- Focus order mirrors visual order.
- Pause is always available.
- Timed sequences pause when focus is lost and offer a non-timed accessibility mode.

## Adjustable roster rule

The nine entries are the launch roster, not hard-coded identities. A maintainer can reorder, disable, or replace an encounter by changing validated content and campaign manifests. New entries must satisfy the same source, accessibility, asset, and acceptance requirements.

