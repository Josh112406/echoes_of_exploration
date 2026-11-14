# Quick Task Design: Among Us-style mini-tasks

**For:** Member 2 (build) and Member 3 (art/audio). **Author:** Member 4.  
Source of truth: `quick_task` in `narrative.json`.

> Style reference only: copy the *feel* (short, tactile, one gesture), never another game's art, names, or sounds.

## Rules every task follows

- One verb per step: tap, drag, hold, swipe, slide, or toggle.
- 1 to 3 steps, 15-35 seconds total, no reading beyond one short prompt.
- Instant feedback in color AND icon/sound, never color alone.
- No fail state: wrong moves show retry_text and the player can try again immediately.
- Large touch targets (at least 48 px) so it works on phones.
- Hint button always visible. Using a hint, or 3+ retries, ends in 'partial' instead of 'success'.
- After success, show a short Echo line, then the Behind the Memory button.

## Results

- **success:** no hint, fewer than 3 retries
- **partial:** used a hint or 3+ retries
- No hard fail: wrong moves just show the retry line.

## At a glance

| # | Encounter | Task | Control | Time | What it teaches |
|---|---|---|---|---|---|
| 1 | A Gentle Touch | **Soft Landing** | One big HOLD button | 15-20 s | Slow down early, control gently near the ground, then let the shock-absorbing legs finish the job. |
| 2 | The Echo That Never Sleeps | **Ping the Moon** | Drag, then tap | 20-25 s | A weak return shows up at the same delay every time, and the Moon's distance is half of the round-trip light time. |
| 3 | Farther Than Footsteps | **Plan the Drive** | Tap stops, then DRIVE | 20-30 s | Real field geology balances time, a safe walking distance back, and variety of samples. |
| 4 | A Question in the Soil | **Read the Results** | Tap cards, then tap an answer | 25-35 s | Scientific caution: weigh every result, not just the exciting one. |
| 5 | Clues Beneath the Wheel | **Dig and Match** | Swipe, tap, drag a line | 25-30 s | Rover movement exposes material, instruments measure it, and the evidence supports a past-water interpretation. |
| 6 | Air Thin as a Whisper | **Pre-flight Check** | Two sliders and a tap | 15-25 s | Thin air needs fast rotors, a small battery limits height and length, and autonomous navigation needs good terrain. |
| 7 | Landing Where No Landing Was Planned | **Slow Descent** | Tap three times, then drag | 20-30 s | Maps and gravity models guide a gentle landing, and priorities decide what data survives. |
| 8 | Power for the Unknown | **Divert Power** | Switches, then one drag | 20-30 s | Power declines, bandwidth is tiny, and priorities decide what a distant probe keeps doing. |
| 9 | One Chance at Pluto | **Plan the Flyby** | Drag cards into 3 slots, then RUN | 20-30 s | A flyby is one chance, so observations are limited by pointing time, storage, and a slow downlink. |

## 1. Soft Landing (A Gentle Touch)

*Like a steering task: hold, keep the needle steady, let go.*

| Step | Do | Prompt shown | Wins when | Success line | Retry line |
|---|---|---|---|---|---|
| brake | hold | Hold BRAKE to slow down | Descent needle reaches the green zone | Slowing down. | Too fast. Keep holding. |
| steady | hold | Keep the needle in the green | Needle stays in green while the zone narrows | Nice and steady. | Ease off a little, then hold again. |
| cut | release | Let go at the CUT line | Button released inside the glowing window | Engines off. Legs take the landing. | Too early or late. The line glows when it is time. |

**Difficulty:** easy: Wide green zone, long CUT window; normal: Narrower zone

## 2. Ping the Moon (The Echo That Never Sleeps)

*Like an aiming task, then a tap-the-right-signal task.*

| Step | Do | Prompt shown | Wins when | Success line | Retry line |
|---|---|---|---|---|---|
| aim | drag | Drag the crosshair onto the reflector | Crosshair released within the target ring | Pulse fired. | Missed. Line up with the glowing marker. |
| find-echo | tap | Tap the flash that repeats at the same time | At least 2 of 3 pulses tapped at the true delay tick | That one keeps coming back. It is real. | Noise moves around. Look for the one that stays put. |
| halve | drag | Drag the marker to the halfway point | Marker released within the halfway zone | Half the trip is the one-way distance: {distance_km} km. | The pulse went out and back. Find the middle. |

**Difficulty:** easy: 2 noise flashes, large target; normal: 4 noise flashes

**Build note:** Use game_support.formula for the reveal; round_trip_s should land inside plausible_round_trip_range_s.

## 3. Plan the Drive (Farther Than Footsteps)

*Like a chart-the-course task: tap stops, see the route.*

| Step | Do | Prompt shown | Wins when | Success line | Retry line |
|---|---|---|---|---|---|
| pick | tap | Tap 3 different stops inside the green ring | 3 stops with 3 different science tags, all inside the safe-return ring | Good mix. Safe and varied. | Two stops teach the same thing, or one is outside the ring. |
| drive | tap | Press DRIVE | Time bar finishes inside the limit | Route complete. Back at the lander. | Out of time. Swap one stop for a closer one. |

**Difficulty:** easy: Ring shows green/red automatically; normal: Ring only, no color hint

**Build note:** Use game_support.suggested_stops plus one decoy stop that repeats a science_tag (e.g. a second boulder field). Use generic labels if station names are not verified.

## 4. Read the Results (A Question in the Soil)

*Like an inspect-the-samples task: flip each one, then confirm.*

| Step | Do | Prompt shown | Wins when | Success line | Retry line |
|---|---|---|---|---|---|
| flip | tap | Tap each of the 4 test cards | All four evidence cards flipped | All four results read. | Flip every card before you decide. |
| conclude | tap | Tap the statement all 4 results support | Qualified statement selected | Honest answer. The question stayed open. | One result is not the whole story. Reread the cards. |

**Answer choices:** Viking found life on Mars. / Viking proved Mars never had life. / **The results were puzzling and no organics were detected, so life is not shown. The question stayed open.** (correct)

**Difficulty:** easy: Cards color-coded by reading; normal: No color

**Build note:** Cherry-pick option from game_support is dropped here to keep three choices; its feedback line may be reused if the player taps a card summary instead.

## 5. Dig and Match (Clues Beneath the Wheel)

*Like a clean-up task (swipe), then a match-the-wires task.*

| Step | Do | Prompt shown | Wins when | Success line | Retry line |
|---|---|---|---|---|---|
| scrape | swipe | Swipe to scrape the dusty patch | Most of the patch revealed | Bright soil exposed. | Keep swiping across the patch. |
| scan | tap | Tap the camera, then the chemistry scanner | Both scanners used on the bright patch | Bright color, very high silica. | Use both scanners to see the full picture. |
| match | drag | Drag the clue to its meaning | Line connected to the past-water option | Silica points to water interacting with rock. | Check what silica forms from. It says nothing about life. |

**Answer choices:** Ordinary wind-blown dust / **Water, possibly hot, once touched this ground** (correct) / Proof of ancient life

**Difficulty:** easy: Correct option glows after 2 misses; normal: No glow

## 6. Pre-flight Check (Air Thin as a Whisper)

*Like an align-the-output task: slide each setting into the green zone.*

| Step | Do | Prompt shown | Wins when | Success line | Retry line |
|---|---|---|---|---|---|
| rotor | slide | Slide ROTOR SPEED into the green | Slider released inside the green zone | Blades fast enough for thin air. | Too slow gives no lift. Too fast wastes energy. |
| altitude | slide | Slide ALTITUDE into the green | Slider released inside the green zone; battery bar stays safe | Low enough to save energy. | Higher costs more of a small battery. |
| land | tap | Tap the safest landing patch | Flat patch with visible features chosen | Flat, with features to navigate by. | The camera needs features to track. Pick a flat, visible patch. |

**Difficulty:** easy: Wide green zones; normal: Narrow zones

**Build note:** Press LAUNCH only after all three steps pass; the flight itself is a short animation with the on_launch beat.

## 7. Slow Descent (Landing Where No Landing Was Planned)

*Like a tap-on-the-beat task with a pick-a-spot first.*

| Step | Do | Prompt shown | Wins when | Success line | Retry line |
|---|---|---|---|---|---|
| zone | tap | Tap the smooth landing zone on the map | Smooth zone chosen (2 of 3 zones are rough) | Smooth ground. Good choice. | That area is rough. Check the shape map. |
| correct | tap | Tap when the marker hits each glowing tick | 3 taps inside their windows (slow, generous timing) | Small steady corrections. | Weak gravity means slow motion. Wait for the tick. |
| save | drag | Drag SURFACE DATA to the first send slot | Icon dropped in slot 1 of 3 | Final measurements saved first. | Put the most valuable data first in the queue. |

**Difficulty:** easy: Large tick windows; normal: Smaller windows

## 8. Divert Power (Power for the Unknown)

*Like a power-switch task: flip switches to match the meter.*

| Step | Do | Prompt shown | Wins when | Success line | Retry line |
|---|---|---|---|---|---|
| switches | toggle | Flip switches to stay under the power line | Total power under the line with both high-value instruments ON, in 2 rounds as the line drops | Power balanced. | Over the line. Turn off the low-value one first. |
| send | drag | Drag the best data into the signal window | Highest-value packet placed in the small window | Faint but valuable. | The signal is tiny. Send what matters most. |

**Difficulty:** easy: High-value switches marked with a star; normal: No star

**Build note:** Use generic names (Instrument A-D) with a 'measures space between stars' tag. Do not show real on/off status (see no_live_status_rule).

## 9. Plan the Flyby (One Chance at Pluto)

*Like a slot-the-items task: drag cards into a schedule.*

| Step | Do | Prompt shown | Wins when | Success line | Retry line |
|---|---|---|---|---|---|
| schedule | drag | Drag 3 observations into the timeline | 3 high-value cards placed; storage bar under the line | Schedule set. | Storage is full. Swap one for a smaller observation. |
| run | tap | Press RUN | Sequence plays; data trickles home | Flyby complete. The data will take a long time to arrive. | Not ready: fill all three slots. |

**Difficulty:** easy: Low-value card is greyed after one swap; normal: No grey

**Build note:** Show an 'antenna not pointed at Earth' icon on filled slots. Card names are generic: verify against nasa-new-horizons before naming specific instruments.
