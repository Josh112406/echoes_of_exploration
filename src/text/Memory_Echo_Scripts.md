# Memory Echo Scripts and Behind the Memory Cards

**Project:** Echoes of Exploration: The NASA Signal Archive  
**Author:** Member 4 (Science Writer & Narrative Designer)  
**Machine-readable source:** `narrative.json` (this file is generated from it)

> Memory Echo is an imagined voice. Behind the Memory is the verified record.

## Voice rules

- **Memory Echo**: imagined first-person voice of the hardware. Short, present tense, never a fact that is not also in Behind the Memory.
- **Behind the Memory**: factual and sourced; debated results stay qualified.
- Lines marked **[priority]** are the first handoff to Member 2.

---

## 1. A Gentle Touch

*Chapter: moon | Mission: `surveyor-1` | Voice: Surveyor 1 lander | Mechanic: navigate-manage*  
**Player task:** Interpret simplified altitude and descent-rate cues to select safe automated descent corrections.

**Status badge:** Silent today. Mission ended January 7, 1967.  
*Archive replay: a dramatized voice built from mission records.*

### Memory Echo

> I am a lander with no pilot. Everything I know comes from my sensors.

> The Moon is rising to meet me. Read my numbers, then choose my next move.

| Trigger | Line |
|---|---|
| `on_hint` | Look at both gauges. How high am I, and how fast am I falling? |
| `on_correct` (stage: 1) | Braking burn started early. I am still falling, but much more slowly. |
| `on_incorrect` (stage: 1) | Too fast, too high. Waiting now means less room to slow down later. |
| `on_correct` (stage: 2) | Small thruster corrections. Steady and slow. That is the whole trick. |
| `on_incorrect` (stage: 2) | A big burn this close can overshoot. Gentle, repeated corrections are safer. |
| `on_correct` (stage: 3) | Engines off. My landing legs will take the last bit of motion. |
| `on_incorrect` (stage: 3) | Firing right at the surface could kick up trouble. Let the legs do their job. |

**Outcomes**

- **success:** Touchdown. My legs flex and settle. Soon my camera starts sending pictures home.
- **partial:** Contact, but rougher than planned. I am down, though with less margin than Earth hoped.
- **fail:** Too fast at the end. Rewind: braking has to start early, and the last meters need patience.

**Cue table**

| Stage | Cue | Best action | Why |
|---|---|---|---|
| 1 | High altitude, fast descent | Main braking burn | Remove most of the speed while there is still room. |
| 2 | Lower altitude, speed dropping | Fine thruster corrections | Hold a controlled, slow descent rate. |
| 3 | Very close to the surface, rate near target | Engines off, let legs absorb | Shock-absorbing legs handle the final contact. |

### Behind the Memory

**The first U.S. soft landing on the Moon**

Surveyor 1 showed that a robotic spacecraft could slow itself and touch down gently on the Moon. It then returned thousands of surface images and engineering data that helped prepare for later landings.

**What happened**

- Surveyor 1 launched on May 30, 1966, and landed on June 2, 1966, in Oceanus Procellarum.
- Its descent was automatic: onboard sensing and engines worked together to reduce speed before contact.
- After landing, its television camera and instruments sent back thousands of images and engineering measurements.

**Why it matters:** Before astronauts could land, engineers needed proof that a spacecraft could land softly and operate on the surface. Surveyor 1 provided early evidence of both.

**Key numbers**

| Item | Value | Source |
|---|---|---|
| Launch | May 30, 1966 | `nasa-surveyor1` |
| Landing | June 2, 1966 | `nasa-surveyor1` |
| Landing site | Oceanus Procellarum, Moon near side | `nasa-surveyor1` |

**How the game simplifies this:** Surveyor 1 flew itself. In the game, you interpret simplified altitude and speed cues and choose correction steps, instead of flying it by hand. The game also turns this into a quick tap-and-drag task.

**Evidence chain:** descent telemetry -> successful touchdown -> surface images and engineering data

**Sources:** `nasa-surveyor1`, `nasa-ranger-surveyor`

**Verify before release (Member 6):**

- [ ] Exact stage order (main braking burn, then thruster control, then engine cutoff) is a simplification of the real sequence; confirm wording against the Surveyor 1 NASA page.
- [ ] Confirm 'thousands of images' phrasing; do not state an exact count unless taken from nasa-surveyor1.

---

## 2. The Echo That Never Sleeps **[priority handoff to Member 2]**

*Chapter: moon | Mission: `apollo-11-surface` | Voice: Apollo 11 laser retroreflector | Mechanic: observe-infer*  
**Player task:** Align laser pulses, separate return signal from noise, and infer distance from round-trip time.

**Status badge:** Passive reflector with no power. Observatories still use it.  
*Archive replay: a dramatized voice built from mission records.*

### Memory Echo

> I have no battery, no radio, no computer. I only know how to send light back where it came from.

> Earth will fire a pulse. Almost all of it will miss me. Help the few photons that don't.

| Trigger | Line |
|---|---|
| `on_start_aim` | Aim at my landing site, not at the middle of the Moon. |
| `on_miss` | That pulse lit up bare ground. Nothing sends it back. Adjust and fire again. |
| `on_hit` | A few photons found me. Now they are heading home. |
| `on_noise` | Not every flash is mine. Sunlight and detector noise arrive at random times. |
| `on_hint` | Fire again. A real return shows up at the same delay, pulse after pulse. |
| `on_timing` | Start the clock when the pulse leaves. Stop it when my photon arrives. That is the round trip. |
| `on_calc_hint` | The light went out to me and back. The distance to the Moon is only half of that trip. |
| `on_success` | Round trip: {round_trip_s} seconds. One way, the Moon is {distance_km} km from that observatory right now. |
| `on_success_followup` | Ask again tomorrow and the answer changes a little. The Moon's path is not a perfect circle. |

**Outcomes**

- **success:** Signal locked. A mirror with no power just answered Earth, and the delay gave the distance.
- **partial:** You found a return, but the noise made the distance uncertain. More pulses would tighten it.
- **fail:** No clear echo yet. Real observatories also need many tries. Realign and fire again.

**Game math:** `distance_km = speed_of_light_km_s * round_trip_s / 2`, c = 299792.458 km/s. Worked example: 2.56 s x 299,792 km/s / 2 is about 383,700 km, close to the commonly cited average Earth-Moon distance of 384,400 km. Accept round-trip values between 2.38 and 2.71 s.

### Behind the Memory

**A mirror with no power can still answer Earth**

Apollo 11 astronauts placed a panel of 100 corner-cube reflectors on the Moon in July 1969. Laser pulses from Earth bounce straight back, and the round-trip time reveals the Earth-Moon distance.

**What happened**

- After Apollo 11's landing in Mare Tranquillitatis, the crew set up the retroreflector panel on the surface.
- Within weeks, observatories at Lick and McDonald detected laser light reflected from it.
- Because the panel is passive, it needs no power. Observatories have ranged to it since 1969 and still do, though its returns are weaker than when it was new.

**Why it matters:** Precise timing of returning light measures the Earth-Moon distance very accurately and helps scientists study the Moon's orbit and test theories of gravity.

**Key numbers**

| Item | Value | Source |
|---|---|---|
| Corner-cube reflectors on the Apollo 11 panel | 100 | `ilrs-apollo11` |
| Typical round-trip light time | about 2.5 seconds | `ilrs-apollo11` |
| Commonly cited average Earth-Moon distance | about 384,400 km | `nasa-moon-missions` |
| Best-case ranging precision at modern stations | millimeter level | `ilrs-apollo11` |

**How the game simplifies this:** Real ranging involves aiming through the atmosphere, correcting for many effects, firing many pulses, and statistical analysis of very few returning photons. The game compresses this into alignment, noise filtering, and one calculation. The game also turns this into a quick tap-and-drag task.

**Evidence chain:** outgoing laser pulse -> returned photons -> light travel time -> Earth–Moon distance

**Sources:** `ilrs-apollo11`, `nssdca-apollo11-lm`, `nasa-moon-missions`

**Already verified:**

- 2026-11-14: NASA Goddard briefing (Merkowitz, AGU, Dec 2024) says stations have ranged to the Apollo 11, 14 and 15 reflectors since 1969.
- 2026-11-14: JILA article by the reflector's co-designer says the Apollo 11 reflector is still in use but works less well than when new.
- 2026-11-14: round trip of about 2.5 s, 100 corner cubes, and 1969 detections at Lick and McDonald confirmed in NASA/NIST and 1970 science papers.

**Verify before release (Member 6):**

- [ ] Optional: also confirm 'still used' on the ILRS Apollo 11 page (ilrs-apollo11) so the primary source in sources.json states it directly.
- [ ] Confirm 'millimeter level' precision wording against ILRS or a NASA page before showing it in the UI.
- [ ] Range 356,400-406,700 km (perigee to apogee) is standard; cite a NASA page if shown in the UI.
- [ ] Do not use NSSDCA id 1969-099C for Apollo 11 (see handoff note: it is the Apollo 12 record).

---

## 3. Farther Than Footsteps

*Chapter: moon | Mission: `apollo-17-surface` | Voice: Apollo 17 Lunar Roving Vehicle | Mechanic: navigate-manage*  
**Player task:** Plan a geology traverse within time, range, sample value, and safe-return constraints.

**Status badge:** Mission complete. Ended September 30, 1977.  
*Archive replay: a dramatized voice built from mission records.*

### Memory Echo

> I am a rover left in a valley. I carried two people farther than any boots could reach.

> Plan a route. Every stop costs time, and every kilometer must leave a way home.

| Trigger | Line |
|---|---|
| `on_start` | The crew has a fixed number of hours outside. Time is the first limit. |
| `on_hint` | Stay within a distance the crew could walk back from if I stopped working. |
| `on_hint` | Rocks that tell a different story from the last stop are worth more. |
| `on_incorrect` | That loop goes beyond safe walking distance. Shorten it or change direction. |
| `on_incorrect` | Out of time before the last stop. Drop a stop, or pick closer ones. |
| `on_incorrect` | Two similar stops teach less than two different ones. |
| `on_correct` | Good stop. Different rock, new clue, still within the safe limit. |

**Outcomes**

- **success:** Route complete. Varied samples, safe margin, back at the lander. A landing site became a field laboratory.
- **partial:** You got home safely, but the samples were too similar to answer the big questions.
- **fail:** The plan broke a safety limit. Real planners rejected routes like this. Try a shorter, smarter loop.

### Behind the Memory

**A rover that turned a landing site into a field laboratory**

On Apollo 17, the Lunar Roving Vehicle let the crew explore the Taurus-Littrow valley far beyond walking range, cover more than 30 kilometers, and collect a large, varied set of samples.

**What happened**

- Apollo 17 landed in the Taurus-Littrow valley in December 1972.
- The crew drove the rover on several long traverses, stopping to observe and sample varied terrain.
- The samples went to laboratories on Earth, where analysis turned field observations into evidence.

**Why it matters:** Mobility changed lunar science: instead of sampling around the lander, the crew could compare different landforms and rock types in one mission.

**Key numbers**

| Item | Value | Source |
|---|---|---|
| Total traverse distance | more than 30 km | `nasa-apollo17` |
| Landing area | Taurus-Littrow valley | `nasa-apollo17` |

**How the game simplifies this:** The game condenses three real traverses and many operational limits into one short route-planning activity. The game also turns this into a quick tap-and-drag task.

**Evidence chain:** traverse plan -> field observations -> sample collection -> laboratory analysis

**Sources:** `nasa-apollo17`, `nasa-moon-missions`, `nssdca-lrv`

**Verify before release (Member 6):**

- [ ] Station names and their science tags are from memory of the Apollo 17 traverses: confirm each against nasa-apollo17 before displaying names in the UI, or switch to generic labels.
- [ ] Apollo 17's rover was LRV-3, not LRV-1. The sources.json entry 'nssdca-lrv' is titled LRV-1 (id 1971-063C), which belongs to the Apollo 15 timeframe. Do not caption it as Apollo 17's rover.
- [ ] 'Safe walking distance' rule: confirm wording against the Apollo 17 mission details page.

---

## 4. A Question in the Soil **[priority handoff to Member 2]**

*Chapter: mars | Mission: `viking-1` | Voice: Viking 1 lander | Mechanic: observe-infer*  
**Player task:** Compare soil-experiment results and choose only the conclusion supported by the combined evidence.

**Status badge:** Mission complete. Ended November 11, 1982.  
*Archive replay: a dramatized voice built from mission records.*

### Memory Echo

> I landed in Chryse Planitia on July 20, 1976. My arm scooped up Martian soil and fed it to my laboratory.

> I asked one question four different ways. The answers did not agree. Look at all of them.

| Trigger | Line |
|---|---|
| `on_start` | Four tests, one soil sample. Open each card, then decide what the evidence supports. |
| `on_card_open` (card: gas-exchange) | When my soil got moisture and nutrients, it released oxygen fast. Surprising, and hard to explain as biology. |
| `on_card_open` (card: labeled-release) | I added labeled nutrients. A gas came off that looked like something living might release. |
| `on_card_open` (card: pyrolytic-release) | This test gave a weak signal. Hard to read, easy to over-read. |
| `on_card_open` (card: organic-test) | I heated the soil and looked for carbon-based molecules. I found none at the levels my instrument could detect. |
| `on_incorrect` (option: life-confirmed) | Some tests looked promising. But what did my organic test find? One result is not a conclusion. |
| `on_incorrect` (option: no-life-ever) | That says too much. I tested only two small patches of one planet, with tools built in the 1970s. |
| `on_incorrect` (option: cherry-pick) | Choosing only the exciting result ignores the rest. A conclusion has to fit every test. |
| `on_correct` (option: qualified) | Yes. The results were puzzling, no organics showed up, and chemistry can explain a lot. The question stayed open. |

**Outcomes**

- **success:** Careful and honest. Good scientists say what the evidence supports, and no more.
- **partial:** Close. Check that your conclusion fits all four results, not just the most exciting ones.
- **fail:** Try again: read every card, then choose the statement that all four results can support.

**Evidence cards**

| Test | What it did | What it showed | How to read it |
|---|---|---|---|
| Gas Exchange | Soil was humidified and fed nutrients while gases were monitored. | Oxygen was released quickly after moisture was added. | Surprising and fast, which is more typical of chemistry than slow biology. |
| Labeled Release | Soil received labeled nutrients while a detector watched for released gas. | A gas signal appeared that resembled a metabolic response. | Intriguing, but chemistry can mimic it, so on its own it is not proof. |
| Pyrolytic Release | Soil was exposed to labeled gases and then heated to look for incorporated carbon. | A weak, hard-to-interpret signal. | Too ambiguous to carry a conclusion. |
| Organic-compound test | Soil was heated and the released gases were analyzed for carbon-based molecules. | No organic molecules were detected at the instrument's sensitivity. | Argues against a biological explanation, with limits on what it could detect. |

**Conclusion choices**

- Viking found life on Mars.
- Viking proved there has never been life on Mars.
- (correct) The biology-style results were puzzling, but with no organics detected the combined evidence does not show life. Chemistry could explain them, and the question stayed open.
- Only the positive Labeled Release result matters.

**Never say:** Viking found life; Viking proved Mars is dead; Viking proved there is no life on Mars; aliens

### Behind the Memory

**The first life-detection experiments on Mars gave answers that did not line up**

Viking 1 carried a laboratory that tested Martian soil in several ways. Some results looked biology-like, but the organic test found no organic molecules and the findings needed careful, qualified interpretation.

**What happened**

- Viking 1 landed in Chryse Planitia on July 20, 1976, and operated on the surface until November 1982.
- Its sampler arm delivered soil to experiments that looked for signs of metabolism and for organic molecules.
- The experiments did not produce one simple answer, and scientists have debated the interpretation ever since.

**Why it matters:** Viking showed how to weigh conflicting evidence. Later missions added context: Phoenix detected perchlorate salts in Martian soil, and Curiosity has detected organic molecules in Martian rocks, so researchers have revisited how the Viking instruments may have behaved.

**Key numbers**

| Item | Value | Source |
|---|---|---|
| Viking 1 landing | July 20, 1976 | `nasa-viking` |
| Last contact / mission end | November 11, 1982 | `nasa-viking` |
| Landing region | Chryse Planitia | `nasa-viking` |

**How the game simplifies this:** The game does not reproduce laboratory protocols. It summarizes four experiments and asks which conclusion the combined evidence supports. It does not claim Viking proved or disproved all Martian life. The game also turns this into a quick tap-and-drag task.

**Evidence chain:** collected soil -> biology-experiment responses -> organic-compound test -> qualified interpretation

**Sources:** `nasa-viking`, `nasa-phoenix`, `nasa-curiosity`

**Verify before release (Member 6):**

- [ ] Check each experiment description (Gas Exchange, Labeled Release, Pyrolytic Release, organic test) against the nasa-viking page; local snapshot science.nasa.gov-mission-viking.md exists and should be the reference.
- [ ] Confirm the Phoenix perchlorate and Curiosity organics sentences against the nasa-phoenix and nasa-curiosity snapshots; soften if the snapshots do not support them.
- [ ] Keep 'no organic molecules detected at the instrument's sensitivity' exactly qualified; never shorten to 'no organics'.

---

## 5. Clues Beneath the Wheel

*Chapter: mars | Mission: `spirit` | Voice: Spirit rover | Mechanic: navigate-manage-observe*  
**Player task:** Choose a route, inspect exposed material, and match instrument evidence to a past-water interpretation.

**Status badge:** Silent today. Mission ended May 25, 2011.  
*Archive replay: a dramatized voice built from mission records.*

### Memory Echo

> I am a rover in Gusev Crater. One wheel stopped working, so I drag it. The dragging digs things up.

> Choose where I go. Check what the ground is made of. Then decide what it says about water.

| Trigger | Line |
|---|---|
| `on_start` | Pick a path. Bright, disturbed soil stands out from the dusty plain. |
| `on_inspect_camera` | My cameras see pale, light-toned soil where my wheel churned the surface. |
| `on_inspect_chemistry` | My chemistry instruments read very high silica. That is unusual for ordinary Martian dust. |
| `on_incorrect` (option: dry-dust) | Ordinary dust does not read this way. Compare the chemistry again. |
| `on_incorrect` (option: life-proof) | Too big a leap. Silica tells me about water and heat, not about living things. |
| `on_correct` (option: past-water) | Yes. This kind of silica forms where water, possibly hot, once interacted with rock. |

**Outcomes**

- **success:** Evidence matched to a sound conclusion. A stuck wheel became a clue to wetter times on Mars.
- **partial:** Right instruments, but the conclusion went a step too far or too little.
- **fail:** Try again: look at the color, then the chemistry, then pick the conclusion both support.

**Conclusion choices**

- Ordinary wind-blown dust.
- (correct) Evidence that water, possibly hot, once interacted with this ground.
- Proof that ancient life existed here.

### Behind the Memory

**A stuck wheel opened a new scientific clue**

Spirit's disabled wheel churned up bright, silica-rich soil. Instrument readings supported an interpretation that parts of ancient Mars were wetter, and in some places possibly hot and wet.

**What happened**

- Spirit landed in Gusev Crater on January 4, 2004, and worked far beyond its planned lifetime.
- After one wheel stopped working, the rover dragged it, exposing material beneath the surface.
- Cameras and chemistry instruments showed silica-rich material, a strong clue to past water.

**Why it matters:** Mars is cold and dry today. Finding materials shaped by water helps scientists reconstruct where the planet was once more habitable, without claiming anything about life.

**Key numbers**

| Item | Value | Source |
|---|---|---|
| Landing | January 4, 2004 | `nasa-spirit` |
| Mission end declared | May 25, 2011 | `nasa-spirit` |
| Final location | near 'Troy', Gusev Crater | `nasa-spirit` |

**How the game simplifies this:** Spirit made many different discoveries. The game focuses on one evidence story: disturbed soil, silica, and a past-water interpretation. The game also turns this into a quick tap-and-drag task.

**Evidence chain:** disturbed soil -> silica-rich material -> instrument readings -> past-water interpretation

**Sources:** `nasa-spirit`

**Verify before release (Member 6):**

- [ ] nasa-spirit has no local snapshot. Confirm the 'dragged wheel exposed silica-rich soil' story and its year on the NASA page before release.
- [ ] Keep 'possibly hot' qualified; confirm the hydrothermal wording on the NASA page.
- [ ] Do not add a planned-lifetime number (about 90 Martian days) unless confirmed against NASA.

---

## 6. Air Thin as a Whisper

*Chapter: mars | Mission: `ingenuity` | Voice: Ingenuity helicopter | Mechanic: navigate-manage*  
**Player task:** Choose rotor, energy, altitude, and terrain parameters for a short autonomous flight.

**Status badge:** Mission complete. Ended January 25, 2024.  
*Archive replay: a dramatized voice built from mission records.*

### Memory Echo

> I am a helicopter on a planet with almost no air. Lift is hard to find here.

> Set my rotors, my energy, my height, and my landing ground. Then I fly myself.

| Trigger | Line |
|---|---|
| `on_start` | Mars air is far thinner than Earth's. My blades must spin much faster to push on it. |
| `on_incorrect` (parameter: rotor) | Rotors too slow. The thin air gives me no lift. |
| `on_incorrect` (parameter: rotor_high) | Faster than needed wastes energy I cannot spare. |
| `on_incorrect` (parameter: energy) | My battery is small. A longer or higher flight needs more energy than I have. |
| `on_incorrect` (parameter: terrain) | I steer by looking at the ground. Flat terrain with visible features is safest. |
| `on_launch` | Earth cannot steer me live. Signals take minutes. Once I lift off, my onboard software flies the plan. |
| `on_success` | Flight complete. Another plan survived the thin air. |

**Outcomes**

- **success:** Lift, energy, and terrain all balanced. Mars air carried a helicopter again.
- **partial:** Airborne, but with little margin. One setting was pushing the limits.
- **fail:** Grounded. Check lift first, then energy, then the landing area.

### Behind the Memory

**Five planned flights became seventy-two**

Ingenuity was designed as a technology demonstration and proved powered, controlled flight is possible on Mars. It flew 72 times after being designed for five.

**What happened**

- Ingenuity arrived at Jezero Crater with the Perseverance rover in February 2021.
- It flew autonomously, using onboard navigation to follow the plan sent from Earth.
- It completed 72 flights before its mission ended in January 2024.

**Why it matters:** Flying on Mars proved aerial scouting is possible and influenced thinking about future missions.

**Key numbers**

| Item | Value | Source |
|---|---|---|
| Flights planned | 5 | `nasa-ingenuity` |
| Flights completed | 72 | `nasa-ingenuity` |
| Mission end | January 25, 2024 | `nasa-ingenuity` |

**How the game simplifies this:** You plan high-level constraints only. Ingenuity controlled its own flight, not through real-time piloting from Earth. The game also turns this into a quick tap-and-drag task.

**Evidence chain:** flight plan -> rotor lift -> navigation images -> completed flight data

**Sources:** `nasa-ingenuity`, `nasa-perseverance`

**Verify before release (Member 6):**

- [ ] nasa-ingenuity has no local snapshot. Verify 72 flights, 5 planned, and the end-of-mission date directly on the NASA page.
- [ ] Any air-pressure comparison, rotor rpm, or mass figure must be sourced before it is added to the UI; the copy above intentionally avoids exact values.
- [ ] Mars-Earth signal delay is described as 'minutes'; confirm if a specific range is displayed.

---

## 7. Landing Where No Landing Was Planned

*Chapter: elsewhere | Mission: `near-shoemaker` | Voice: NEAR Shoemaker spacecraft | Mechanic: observe-infer-navigate*  
**Player task:** Use mapping observations to refine a controlled descent and preserve final measurements.

**Status badge:** Silent today. Mission ended February 28, 2001.  
*Archive replay: a dramatized voice built from mission records.*

### Memory Echo

> I was built to orbit. Nobody built me to land.

> Use my maps of Eros to plan a slow descent, and save my last measurements for the surface.

| Trigger | Line |
|---|---|
| `on_start` | Eros is not round. Its shape and weak gravity decide how I fall. |
| `on_hint` | Gravity here is very weak. I drift down slowly, so small corrections matter a lot. |
| `on_incorrect` | That target sits near rough ground. Check the shape map for a safer approach. |
| `on_incorrect` | Mind the final minutes. If measurements are not prioritized, they may never be sent. |
| `on_launch` | Beginning descent. Pictures and ranging are guiding every step. |
| `on_success` | Touchdown. The records show I kept sending measurements from the surface. |

**Outcomes**

- **success:** A spacecraft that was never designed to land touched down gently and kept sending data.
- **partial:** You landed, but some final measurements were lost. Priorities matter when time runs short.
- **fail:** The approach was off. Study the shape and gravity maps and try again.

### Behind the Memory

**An orbiter survived a landing it was never built to make**

NEAR Shoemaker was the first spacecraft to orbit and land on an asteroid. After its main mission mapping Eros, engineers guided it to a controlled descent, and it returned data from the surface.

**What happened**

- NEAR launched in 1996 and entered orbit around asteroid 433 Eros on February 14, 2000.
- Orbital mapping produced composition, shape, density, and surface data.
- In February 2001, the team guided the spacecraft to a controlled landing on Eros.

**Why it matters:** NEAR showed how mission teams adapt. Detailed maps and gravity models turned a finished orbital mission into a landing, and the spacecraft gave an up-close look at an asteroid's surface.

**Key numbers**

| Item | Value | Source |
|---|---|---|
| Launch | February 17, 1996 | `nasa-near` |
| Entered orbit at Eros | February 14, 2000 | `nasa-near` |
| Mission end | February 28, 2001 | `nasa-near` |

**How the game simplifies this:** The real descent involved detailed navigation and engineering operations. The spacecraft was not designed as a lander, and the game omits most of those operations. The game also turns this into a quick tap-and-drag task.

**Evidence chain:** orbital images and ranging -> shape and gravity model -> descent -> surface measurements

**Sources:** `nasa-near`

**Verify before release (Member 6):**

- [ ] Local snapshot science.nasa.gov-mission-near-shoemaker.md exists: confirm the landing date (February 2001) and 'continued to send data from the surface' wording against it.
- [ ] No landing speed or Eros size is stated in this copy on purpose; add only if sourced.

---

## 8. Power for the Unknown

*Chapter: elsewhere | Mission: `voyager-1` | Voice: Voyager 1 spacecraft | Mechanic: communicate-preserve*  
**Player task:** Allocate declining power among instruments and prioritize a small interstellar data stream.

**Status badge:** Mission continues. Status can change.  
*Archive replay: a dramatized voice built from mission records.*

### Memory Echo

> I left Earth in 1977. My power source fades a little every year.

> Choose which instruments stay on. Every watt you save buys more time.

| Trigger | Line |
|---|---|
| `on_start` | My power budget shrinks over time. I cannot run everything at once. |
| `on_hint` | Keep the instruments that measure the space around me. That is what only I can do now. |
| `on_incorrect` | Too much power requested. I would have to shut something off on my own. |
| `on_incorrect` | My signal is very faint and slow. Send only your highest-value measurements. |
| `on_hint` | A message to me and my reply both take a very long time. Plan ahead. |
| `on_success` | Signal sent. Huge antennas on Earth listen for my faint signal. |

**Outcomes**

- **success:** Power balanced, best data sent. That is how a 1970s probe keeps exploring.
- **partial:** You kept it running, but a valuable measurement was dropped. Priorities decide what Earth learns.
- **fail:** Out of power budget. Switch off lower-priority instruments first, then try again.

### Behind the Memory

**A planetary explorer became an interstellar weather station**

Voyager 1 revolutionized knowledge of Jupiter and Saturn and was the first spacecraft to enter interstellar space. Its remaining science instruments still study interstellar space, while declining power forces engineers to make hard choices.

**What happened**

- Voyager 1 launched on September 5, 1977, and flew past Jupiter in March 1979.
- It later crossed the heliopause, the edge of the Sun's influence, into interstellar space.
- Its power source weakens by about 4 watts a year, so engineers have turned off some instruments and devices. In September 2026, a power-saving swap of three devices extended the life of its remaining instruments.
- Contact briefly dropped on October 18 and 19, 2026, and returned on October 20 before engineers sent commands. NASA's Deep Space Network, large antennas around the world, receives its faint signal.

**Why it matters:** Voyager 1 is a direct measurement of the space between stars. It also shows how distance, power, and bandwidth shape what a mission can do. On November 18, 2026 it reaches one light-day from Earth, so a radio message takes about 24 hours each way.

**Key numbers**

| Item | Value | Source |
|---|---|---|
| Launch | September 5, 1977 | `nasa-voyager1` |
| Jupiter encounter | March 1979 | `nasa-voyager1` |
| Power lost each year | about 4 watts | `nasa-voyager1` |
| One light-day from Earth | November 18, 2026 (about 25.89 billion km); radio takes 24 hours each way | `nasa-voyager1` |

**How the game simplifies this:** Instrument availability and power decisions change over time, so the game uses a simplified, abstract budget. Real operations are decided by the mission team. The game also turns this into a quick tap-and-drag task.

**Evidence chain:** instrument power -> fields-and-particles measurement -> encoded signal -> Deep Space Network reception

**Sources:** `nasa-voyager1`, `nasa-nssdca`

**Already verified:**

- 2026-11-14: NASA JPL release 2026-078 (Oct 29, 2026) confirms: about 4 W/yr power loss, September 2026 three-device swap, contact loss Oct 18-19 resolved Oct 20, and one light-day (25.89 billion km) on Nov 18, 2026.
- The JPL release does not name which instruments remain on, so this copy names none.

**Verify before release (Member 6):**

- [ ] Release-day recheck: look for newer JPL news on Voyager 1 status before showing 'still study interstellar space'.
- [ ] Before naming any instrument, read NASA's 'Where Are Voyager 1 and 2 Now?' page. Secondary reports say only the magnetometer and plasma-wave subsystem remain on, so the dataset's 'fields-and-particles' phrase may be out of date.
- [ ] Ask Member 6 to add the JPL release (URL in citation_url) to sources.json, then switch the two citation_url key numbers to that source id.
- [ ] Keep the one-light-day line evergreen: it is dated November 18, 2026, which is after the November 15 submission deadline.

---

## 9. One Chance at Pluto

*Chapter: elsewhere | Mission: `new-horizons` | Voice: New Horizons spacecraft | Mechanic: communicate-preserve*  
**Player task:** Schedule observations during a fast flyby with limited pointing time, storage, and downlink.

**Status badge:** Mission continues. Status can change.  
*Archive replay: a dramatized voice built from mission records.*

### Memory Echo

> I will pass Pluto once. There is no second lap and no brake.

> Choose what I look at, in what order. I can't look and call home at the same time.

| Trigger | Line |
|---|---|
| `on_start` | The flyby is short. Years of preparation come down to a few busy hours. |
| `on_hint` | When I turn my instruments toward Pluto, my antenna is not aimed at Earth. |
| `on_incorrect` (parameter: storage) | My storage is filling up. Prioritize, or something will not be kept. |
| `on_hint` | Everything I record must be sent later, slowly. The data trickles home for months. |
| `on_launch` | Sequence loaded. I run it on my own. No one on Earth can steer me live. |
| `on_success` | Flyby complete. The measurements are safe. Now the long wait for the data to arrive. |

**Outcomes**

- **success:** A well-planned sequence captured the key observations and kept room to send them home.
- **partial:** Good observations, but some data would take too long to downlink. Balance looking with sending.
- **fail:** The plan ran out of pointing time or storage. Try fewer, higher-value observations.

### Behind the Memory

**Years of planning for a few fast hours beside Pluto**

New Horizons flew past Pluto on July 14, 2015. Because the encounter was brief and the spacecraft far away, it ran a preplanned observation sequence, then sent the data home slowly over a long period.

**What happened**

- New Horizons launched on January 19, 2006, and passed Pluto on July 14, 2015.
- It revealed unexpectedly complex geology across the Pluto system.
- After Pluto, it continued into the Kuiper Belt and returned the first close observations of Arrokoth.

**Why it matters:** A flyby is a one-time chance. The mission shows how preparation, limited downlink capacity, and patience let a small spacecraft explore a distant world.

**Key numbers**

| Item | Value | Source |
|---|---|---|
| Launch | January 19, 2006 | `nasa-new-horizons` |
| Pluto flyby | July 14, 2015 | `nasa-new-horizons` |

**How the game simplifies this:** The game compresses a complex preprogrammed observation campaign and a lengthy data return into a short sequence. The game also turns this into a quick tap-and-drag task.

**Evidence chain:** observation sequence -> stored measurements -> delayed downlink -> Pluto-system interpretation

**Sources:** `nasa-new-horizons`

**Verify before release (Member 6):**

- [ ] Dataset flags status_review_required_before_release=true: recheck the 'continues outward through the Kuiper Belt' status on the NASA page.
- [ ] Local snapshot exists (science.nasa.gov-mission-new-horizons.md): if the UI adds closest-approach distance, speed, or how long data return took, source those numbers from it first.

---
