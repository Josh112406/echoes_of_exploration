# ART_STYLE_GUIDE.md — Echoes of Exploration
**Project:** Echoes of Exploration: The NASA Signal Archive · NASA Space Apps Challenge 2026
**Owner:** Member 5 (UI/UX & Visual Designer) · **Version:** 2.0 · **Updated:** 2026-11-14
**Visual reference:** [`docs/art-reference/index.html`](art-reference/index.html)

> **Mandatory for every contributor and every AI agent.** Every screen, canvas, sprite, badge and panel follows this file. If something here conflicts with another doc, this file wins. Raise a change with Member 5 instead of working around it.

### What changed in v2
- **One palette.** The second palette in the practice repo's `DESIGN.md` (`#07090e`, `#06b6d4`, `#e05a36`…) is **retired**. Only the 24-colour palette plus the new **Elsewhere ramp** (§2) is allowed.
- **Pixel font for labels only.** Silkscreen is used for labels, buttons, badges and the title screen. Headings and reading text use IBM Plex Sans (§4). All-caps pixel headings everywhere were hard to read.
- **One scene template.** The four parallax layers use a swappable ground ramp for Moon, Mars and Elsewhere (§5). This covers the home hero, the chapter art, the archive thumbnails and gameplay.
- **Dropped from the practice build:** the robot hero, the twitch jetpack landing, Phaser, and the cyan "landing pad". The pad is now a cyan UI target bracket, because Surveyor 1 had no pad (§11).

---

## 1. Visual philosophy

- **Dark, moody, modern pixel art** on a **640×360** internal grid with integer scaling and `image-rendering: pixelated`. It should look like detailed indie pixel art, not 8-bit blocks.
- **Earth is the hero light.** On the Moon it is big and detailed, with continents, clouds, a cyan rim and a dithered terminator. From Mars and deep space it is a pale cyan dot.
- **One cool light** from Earth or the sky, at the upper right. Lit edges get a 1px rim. Shadows dither into Deep Indigo or Shadow Navy. **Never `#000000`.**
- **Calm surfaces.** Areas are flat shades, and dithering appears only in a narrow band where two shades meet. Salt-and-pepper noise across a whole surface is a bug.
- **Editorial discipline for the DOM.** Equal left and right gutters, one idea per section, readable type and real data, with no decorative filler.

---

## 2. Palette — 24 colours + Elsewhere ramp (30 total)

Do not introduce any other hex. The code source of truth is `src/art/palette.ts` plus the CSS tokens in `src/index.css`.

### Space & shadow — backgrounds and every shadow
| Token | Hex | Use |
|---|---|---|
| `--void` | `#05070f` | Deepest background, vignette |
| `--indigo` | `#0b0f1d` | Panels and cards, darkest shadow |
| `--navy` | `#131a2e` | Mid shadow, crater interiors, sky band |
| `--line` (Dusk) | `#1d263f` | Borders, dividers, far-ridge shadow |

### Moon regolith — cool grey-purple ground
| Token | Hex | Use |
|---|---|---|
| `--basalt` | `#27293d` | Far ridge, deep craters |
| `--regolith-deep` | `#3b3e59` | Mid ridge, shadowed rock |
| `--regolith-mid` | `#595e7d` | Ground body |
| `--muted` (Dust light) | `#8389a8` | Lit ground, secondary text |
| `--crust` | `#b2b8d4` | Lit boulders, hardware metal, body text on dark |
| `--ink` (Highlight rim) | `#e2e6fa` | 1px rims, primary text |

### Mars rust — warm strata and haze
| Token | Hex | Use |
|---|---|---|
| `--umber` | `#2b140e` | Canyon shadow, haze band start |
| `--deep-rust` | `#522116` | Far ridge |
| `--ochre` | `#7d331c` | Mid ridge |
| `--terracotta` | `#ab4f2c` | Ground body |
| `--rust` (Dust tan) | `#cf724a` | Lit soil, Mars chapter accent |
| `--haze-peach` | `#e89e7d` | Horizon rim, caution text in the UI |

### Elsewhere — asteroid rubble to Pluto tan *(new in v2)*
| Token | Hex | Use |
|---|---|---|
| `--rubble-dark` | `#221d1f` | Deepest rubble shadow |
| `--rubble-deep` | `#3d3532` | Far ridge |
| `--eros` | `#5e534c` | Mid ridge (Eros grey-brown) |
| `--taupe` | `#857669` | Ground body |
| `--regolith-tan` | `#b09d88` | Lit ground |
| `--pluto-tan` | `#ddc8a8` | Rims, Elsewhere chapter accent |

### Cyan — story voice, UI edges, focus
| Token | Hex | Use |
|---|---|---|
| `--cyan-void` | `#032630` | Hover and selected fills |
| `--cyan-shadow` | `#064b5c` | Inactive edges, bloom outer ring |
| `--cyan-deep` | `#087d99` | 1px panel edges, HUD border |
| `--cyan` (Glow) | `#0ec3dc` | Primary accent, story text, focus brackets |
| `--cyan-glow` (Laser core) | `#7ef1ff` | Brightest point, active pulse, Earth's lit rim |

### Warm accents — energy and verification
| Token | Hex | Use |
|---|---|---|
| `--ember` | `#4a1805` | Badge inner fill, plume edges |
| `--thruster` | `#e65100` | **Thrust and lamps only** |
| `--amber` (Beacon gold) | `#f59e0b` | Verified records, badges, eyebrow labels, status lamps |

**Earth surface exception:** inside the Earth sprite only, the ocean and land colours in `src/art/palette.ts` (`EARTH`) are allowed.

### Colour roles (non-negotiable)
| Colour | Means | Never use for |
|---|---|---|
| Cyan | Story voice ("Memory Echo"), interactive UI, focus, HUD | Verified facts |
| Amber | Verified record, sources, earned badges | Fiction or decoration |
| Orange (`--thruster`) | Thrust, lamps: energy | Text, borders, warnings |
| Haze peach | Caution in the UI (rising descent rate, wrong choice) | Large fills |
| Chapter accents | Moon `--crust`, Mars `--rust`, Elsewhere `--pluto-tan` | Mixing chapters |

---

## 3. Two voices, two colours

Fiction and fact are separated by **colour, label and frame**. Colour is never the only cue.

| Voice | Frame | Tag | Content |
|---|---|---|---|
| **Memory Echo** (game story) | 1px `--cyan` border, or a caption console | `Memory echo · Game story` | Dramatized, first-person line. Machines are never conscious, and never shown as transmitting when they are silent. Always followed by a "dramatized" note. |
| **Verified Record** (Archivist note / Deep dive) | 1px `--amber` border | `Verified record` | Facts from `src/data/*.json` only, with the date reviewed and a link to the primary NASA source. |

In the **record reader** the amber record comes first, with the image, credit strip, readouts and sources. The cyan story console sits below it. Never put both voices in one frame.

---

## 4. Typography

Three OFL fonts, loaded from Google Fonts in `index.html`.

| Role | Font | Token | Where |
|---|---|---|---|
| **Labels** (the one pixel font) | Silkscreen 400 | `--f-pixel` | Eyebrows, nav, buttons, tags, status badges, HUD keys, step counters, and the title-screen wordmark |
| **Headings & reading** | IBM Plex Sans 400/600 | `--f-body` | h1–h3, body copy, story lines, card titles |
| **Telemetry & data** | IBM Plex Mono 400–600 | `--f-mono` | Dates, coordinates, IDs, HUD values (tabular figures) |

**Scale** (desktop / ≤640px):

| Token | Desktop | Mobile | Style |
|---|---|---|---|
| `--t-h1` | 32px | 24px | Plex Sans 600, tracking −0.02em, lh 1.2 |
| `--t-h2` | 22px | 18px | Plex Sans 600, −0.015em |
| `--t-h3` | 17px | 16px | Plex Sans 600 |
| `--t-body` | 16px | 15px | Plex Sans 400, lh 1.6, max 62ch |
| `--t-small` | 14px | 13px | Plex Sans 400 |
| `--t-label` | 11px | 11px | Silkscreen, uppercase, tracking 0.14em |
| `--t-mono` | 13px | 12px | Plex Mono 500, tabular figures |

**Rules**
- Silkscreen is **never** used for sentences or for text over 2 lines. It is always uppercase with wide tracking (0.12–0.22em).
- The **title screen** is the only place Silkscreen is large: wordmark `clamp(24px, 4.3vw, 54px)`, tracking 0.14em, with an amber tagline above it.
- Amber eyebrow labels sit above headings, and headings stay in Plex Sans.

---

## 5. Scenes

### 5.1 Grid and scaling
- Internal height is always **360 scene px**. Gameplay is exactly **640×360**.
- **Integer scaling only.** Full-bleed scenes (the hero) pick `s = ceil(height / 360)` and widen the scene to fill the width instead of stretching it. The layers tile every 640px, so any width works.
- Static art such as thumbnails and chapter cards is rendered once and cached as PNG data URLs, then scaled with `image-rendering: pixelated`.

### 5.2 Side-view template: four parallax layers
Each layer is darker and cooler with distance. Swapping the ramp re-skins the whole scene.

| Layer | Content | Moon | Mars | Elsewhere | Parallax |
|---|---|---|---|---|---|
| 1 · Sky | Dithered bands Void→Indigo→Navy, dense small stars, ~12 soft twinkles, Earth | Dusk at the horizon | Brown **haze band** (Umber→Deep rust) in the last third above the ridges | Darker, no haze | 0.03 |
| 2 · Far ridge | Low silhouette, 3 shades, rim pixel on lit slopes | Dusk / Basalt / Regolith deep | Umber / Deep rust / Ochre | Rubble ramp | 0.15 |
| 3 · Mid ridge | Higher-frequency ridge, 3 shades | Basalt / Regolith deep / Regolith mid | Umber / Deep rust / Ochre | Rubble ramp | 0.35 |
| 4 · Near ground | Value noise quantized to 4 shades, dithered only at shade edges; craters; stones | Regolith deep → Crust | Deep rust → Dust tan | Rubble deep → Regolith tan | 0.7 |

- **Horizon:** the ground starts at about y = 298 of 360, so the sky gets roughly two-thirds of the frame.
- **Craters (side view):** flattened ellipses with a lit rim at top-left and a deep bowl at bottom-right.
- **Stones:** 2–3px, highlight pixel on top, darkest ramp shade beneath.
- **Vignette:** dithered Void pixels in the corners only, light.

### 5.3 Earth
- **From the Moon:** radius 34px (68px across), lit from the upper right, continents and clouds from value noise, dithered terminator into Indigo, a 1–2px cyan rim on the lit limb, and a sparse dithered cyan bloom. Never a hard ring.
- **From Mars or Elsewhere:** a pale cyan dot, 3×3 Cyan deep with a Laser core centre and a faint cross glow.
- **Placement:** upper right. On the title screen it is pinned to the top-right corner so the centred wordmark never overlaps it. On narrow screens it is partly cropped.

### 5.4 Top-down map (3/4 view) — for future chapter maps
- Regolith is value noise quantized to 4–5 shades with ordered dithering. Craters are lit at the top-left with a deep Indigo bowl at the bottom-right.
- Points of interest get a soft **cyan dashed ring** and a notched label. Locked ones go grey.
- Rover tracks are dotted lines in the ground's darkest shade.

### 5.5 Cutscene and chapter card
- Same layers as gameplay, with a slow camera (drift only, and none under reduced motion).
- Text appears **only in the caption console** at the bottom (§7.2), never over busy art.
- A chapter transition shows **one clear silhouette** in the middle of a quiet frame, with a low horizon.

### 5.6 FX
- Soft bloom on glows, using dithered halos instead of blur. Ground-hugging dust (no atmosphere on the Moon, so the plume spreads sideways and thins out). No flashing, no screen shake, no strobing.
- Twinkles change opacity slowly (≥0.6s period) and never fully on and off.

---

## 6. Sprites

- **Scale:** characters about 24px and hardware **24–40px** on the 640×360 grid, upscaled by integer factors with nearest-neighbour.
- **Every sprite has:** a 1px lit edge on the side facing the light, an indigo contact shadow, and orange **only** on lamps and thrust. Status lamps may be amber.
- **Accuracy:** a sprite is shown only for hardware it actually depicts. If none fits, show the chapter scene with a cyan signal ring instead of a wrong sprite.
- **Labelling:** every illustration is captioned "Team illustration, not a mission photograph".

| Sprite | Source | Notes |
|---|---|---|
| Surveyor-style lander (side) | `drawSurveyor` in `src/art/sprites.ts` | ~37px wide, 3 legs, cyan solar panel, amber status lamp |
| Six-wheeled rover (side) | `drawRover` | ~30px wide, mast camera with cyan lens |
| Deep-space probe | `drawProbe` | Dish, bus, booms; Elsewhere chapter |
| Retro-rocket casing, vernier plumes | `drawCasing`, `drawFlames` | Plumes go Laser core → Beacon gold → Thruster |
| Earth (hero / dot) | `drawEarth`, `drawEarthDot` | See §5.3 |
| Reference PNGs | `public/assets/sprites/*.png` | Practice-build crops with **baked RGB backdrops**. In the DOM use them only inside a dark frame with `mix-blend-mode: screen` and a radial mask. Rebuild them as transparent sprites before using them in any scene. |

---

## 7. UI components

### 7.1 Panels
- Fill `rgba(11,15,29,0.86)` with optional `backdrop-filter: blur(8px)`, a 1px border in `--line`, or in `--cyan-deep` / `--cyan-shadow` when interactive.
- **Square corners.** Small 8px corner notches are allowed (`.notched`). **Never pill-shaped or rounded.**

### 7.2 Caption console (`.console`)
- Translucent Indigo fill, 1px `--cyan-shadow` edge and **cyan corner brackets** (10×2px L-shapes, 3px outside the box).
- Head row: a cyan pixel tag with a square dot on the left, and the **step counter** (`03 / 06`) on the right in Silkscreen and `--muted`.
- Body: one story line in Plex Sans, plus an optional note in `--muted`. Actions go at the bottom (Next or Skip at top-right for cutscenes).
- Used for the Memory Echo on the title screen, encounter briefings and decisions, and the story half of the record reader.

### 7.3 Telemetry HUD (`.hud`)
- Dark translucent fill (`rgba(5,7,15,0.78)`), 1px `--cyan-deep` edge, sitting top-centre over the scene.
- Row 1: site name (cyan pixel label), a `Simulated` tag whenever the values are not real telemetry, and the key value on the right.
- Row 2: **gauges, not tables.** Segmented bars of 8×8 cells with 2px gaps. Lit cells are cyan, and haze peach when the value is trending unsafe.
- Mono digits with tabular figures. Keys in Silkscreen at 10px, `--muted`.
- On screens ≤600px the HUD drops below the scene so it never covers the art.

### 7.4 Buttons
| Variant | Look |
|---|---|
| Primary | Solid `--cyan`, `--void` text, 4px `--cyan-shadow` under-step. On hover it turns Laser core with a soft glow, and on press it moves down 1px. |
| Ghost | Indigo fill, `--cyan-shadow` border. On hover the border turns cyan. |
| Title-screen menu | Text-only Silkscreen links. The active item gets a cyan glow band and ▸ ◂ arrow markers. |

All buttons use Silkscreen labels, are at least 44px tall (34px for the small size), and have a visible focus ring (2px Laser core).

### 7.5 Status badges
Outlined, with **their own word and colour**, so colour is never the only cue.

| Data status | Label | Colour |
|---|---|---|
| `active-primary`, `active-extended` | Active / Active · Extended | `--cyan` |
| `passive-science` | Passive · In use | `--cyan-glow` |
| `silent-location-known` / `-approximate` | Silent · Located / Silent · Drifting | `--amber` |
| `completed-surface`, `completed-orbit` | Mission complete | `--crust` |
| `intentionally-impacted` | Impacted | `--muted` |
| `status_review_required_before_release` | Status under review (dashed) | `--haze-peach` on `--terracotta` |

### 7.6 Catalog card
Thumbnail (2:1) showing the chapter scene, framed at a different stretch of horizon per record, with a cyan **dashed signal ring** marking the site. The status badge sits bottom-left of the thumbnail. Below it come a pixel label (`#03 · Moon`), the title in Plex Sans 600, the cyan story hook, the objective in muted text, and a mono meta line. Locked or in-development items keep the layout and dim the content to 50%.

### 7.7 Record reader
A modal over a darkened scrim. The top bar reads "Verified archive record · reviewed YYYY-MM-DD" with a Close [Esc] button. Then comes the amber card: a header with an amber `Verified record` tag, then a 16:9 image frame, then a credit strip in mono with the ID, credit and source link. Readouts follow as a 4-up grid, then the summary, facts and sources. The cyan story console sits below. Authentic NASA photos go in the frame, with NASA ID and credit, once the data team adds them to `public/images/`. Until then the frame shows the labelled team illustration.

---

## 8. Layout

- **Gutters:** `--gut = clamp(16px, 5.5vw, 80px)`, the same on the header, content and footer. Content max width is 1200px (1560px at 2200px viewports and wider).
- **One idea per section.** Section spacing is `clamp(48px, 7vw, 96px)`. The title screen fills the first viewport and never peeks into the next section on desktop.
- **Section head:** amber eyebrow, Plex heading, and an optional single action on the right.
- **Hover layer:** cards lift 2px with a cyan-deep border, and thumbnails zoom 1.02×. Buttons move down 1px on press.
- **Responsive range: 360px to 4K.** There is never horizontal scroll. Test at 360, 768, 1366 and 2560.

---

## 9. Motion and accessibility

- `prefers-reduced-motion`: no parallax drift, no twinkle, no tweened descent, and CSS transitions are off. **Gameplay state must still advance**: tweens complete instantly instead of stalling.
- Canvases pause when off-screen or when the tab is hidden.
- Every canvas gets `role="img"` and a plain-English `aria-label`, or `aria-hidden` if it is decorative. Live telemetry is announced with `aria-live="polite"`.
- Text contrast: body text in `--ink` or `--crust` on Indigo. `--muted` is for secondary text only, never for text that conveys meaning.
- Dialogs trap focus, close on Esc, and return focus to where it was.

---

## 10. Prohibited (zero tolerance)

- ❌ The NASA insignia ("meatball"), the logotype ("worm"), or anything implying endorsement.
- ❌ Aliens, monsters, plants, magic crystals, ruins.
- ❌ Coins, HP bars, floating damage numbers, inventories, enemies, quests.
- ❌ `#000000`, or any hex outside §2.
- ❌ Harsh flashing, strobing, screen shake.
- ❌ Rounded or pill buttons, purple gradient blobs, generic glassmorphism cards.
- ❌ Unlabelled illustrations presented as photographs.

---

## 11. Decisions log (v2)

| Source said | Decision | Why |
|---|---|---|
| Practice `DESIGN.md`: second palette (`#07090e`, `#06b6d4`, `#e05a36`) | **Dropped** | The art reference requires a single palette |
| `DESIGN.md`: Space Grotesk / Inter / JetBrains Mono | **Replaced** by IBM Plex Sans / Mono | Already loaded, OFL, and pairs with Silkscreen |
| `DESIGN.md`: pill buttons, rounded frames | **Dropped** | ART.md and the reference require square corners and notches |
| `DESIGN.md`: Phaser canvas, toroidal map, 60 Hz lander | **Not used** | No reaction-time play. The encounters are decision-based. Canvas plus React is enough |
| `DESIGN.md`: gutters, one section per screen, type scale, tactile hover | **Kept** | §4 and §8 |
| Practice build: robot hero (Unit-7) | **Dropped** | The new plan has a human Signal Archivist in an observatory. That interior needs its own look (open task for Member 3) |
| Practice build: glowing cyan landing pad | **Changed** to a cyan dashed target bracket (UI overlay) | Surveyor 1 had no pad. Cyan stays a UI colour |
| Practice build: unlicensed pixel title font | **Replaced** by Silkscreen (OFL) | Licence on record |
| Art reference: "Elsewhere has no ramp yet" | **Added** an asteroid → Pluto tan ramp | §2 |

---

## 12. Implementation map

| Concern | File |
|---|---|
| Palette constants | `src/art/palette.ts` |
| Noise, ordered dither | `src/art/noise.ts` |
| Scene template (four layers, ramps, Earth, vignette) | `src/art/scene.ts` |
| Sprites | `src/art/sprites.ts` |
| Chapter art snapshots | `src/art/chapterArt.ts` |
| React canvas wrapper (cover/fixed, integer scale, reduced motion) | `src/art/PixelScene.tsx` |
| CSS tokens and components | `src/index.css` |
| Encounter screen styles | `src/game/game.css` |
