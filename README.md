# Echoes of Exploration: The NASA Signal Archive

**NASA International Space Apps Challenge 2026**  
*Challenge: Abandoned but not Forgotten — Storytelling about NASA's Discarded Equipment on the Moon, Mars, and Elsewhere*

*Echoes of Exploration* is an interactive, story-driven educational browser game (Phaser 3 + TypeScript) designed for ages 10–13 and casual space enthusiasts. Players guide **UNIT-7**, a fictional archival maintenance robot, across the **Moon**, **Mars**, and **Deep Space ("Elsewhere")** to locate and recover the historical and scientific records of **23 real NASA hardware sites** and a **31-mission Museum Catalog**.

## Key Features

- **3 Sequential Sectors (23 Playable Echoes + 31 Catalog Missions):**
  - **The Moon (8 Echoes):** Surveyor 3, Apollo 11, Apollo 12, Apollo Laser Retroreflectors, Apollo 15 LRV, Apollo 17, IM-1 Odysseus, Blue Ghost 1.
  - **Mars (9 Echoes):** Viking 1 & 2, Sojourner & Mars Pathfinder, Mars Polar Lander, Spirit & Opportunity, Phoenix, Curiosity, InSight, Perseverance Landing Hardware, Ingenuity.
  - **Elsewhere / Deep Space (6 Echoes):** NEAR Shoemaker (Eros), Galileo (Jupiter/Europa), Cassini-Huygens (Saturn/Titan), Deep Impact (Comet Tempel 1), Voyager 1 (Interstellar Space), New Horizons (Pluto).
- **5 Authentic 60 Hz Physics Minigames:**
  - **Precision Powered Descent (`LandingScene`)** — Thruster/fuel management and soft touchdown.
  - **Surface Rover Traverse (`RoverScene`)** — Sprung-wheel buggy physics, slope traction, and core sample recovery.
  - **Laser & Deep Space Network Lock (`LaserScene`)** — Optical retroreflector photon ranging and DSN carrier lock.
  - **Thin-Atmosphere & Titan Rotorcraft (`RotorScene`)** — Helicopter collective/cyclic lift across Martian dust devils and Titan haze.
  - **High-Velocity Flyby Imaging (`FlybyScene`)** — Attitude stabilization and narrow-angle camera target capture during closest approach.
- **Interactive Science Field Tasks:**
  - **Viking Soil Ambiguity ("A Question in the Soil"):** Compare Labeled Release and GCMS results to practice scientific caution.
  - **Voyager 1 RTG Power Budgeting ("Power for the Unknown"):** Balance shrinking radioisotope power across deep-space instruments.
- **100% Sourced & Offline-Ready:**
  - Every date, coordinate, photograph, and scientific claim links directly to official NASA, JPL, NSSDCA, ILRS, or PDS primary sources (see [docs/submission-references.md](docs/submission-references.md)).
  - Zero runtime external API calls and zero third-party cookies; all progress is saved locally in `localStorage`.

## Development & Verification Commands

```bash
npm install
npm run dev               # Start local Vite dev server
npm run typecheck         # Run TypeScript strict check (tsc --noEmit)
npm run validate:entries  # Verify all 23 echoes, coordinates, sources, and story scripts
npm run references        # Regenerate docs/submission-references.md from src/data/
npm run build             # Production build to dist/
```
