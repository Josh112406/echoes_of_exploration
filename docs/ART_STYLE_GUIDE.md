# ART_STYLE_GUIDE.md — Echoes of Exploration Visual & Design Standard
**Project:** Echoes of Exploration: The NASA Signal Archive  
**Target:** NASA SpaceApps Challenge 2026  
**Owner:** Member 5 (UI/UX & Visual Designer)  
**Reference Origin:** `docs/art-reference/index.html` (Practice Build)

> **MANDATORY FOR ALL CONTRIBUTORS (Coder 1, Coder 2, Member 3, Member 4, Member 6):**  
> Every component, game canvas, UI dialog, badge, and graphic created for this project MUST adhere strictly to the rules, palettes, and typography specified in this document.

---

## 1. Core Visual Philosophy

* **Atmosphere:** Dark, moody 16-bit modern pixel art at a crisp **640×360 internal coordinate grid** with integer scaling and `image-rendering: pixelated`.
* **Subtle Realism over Retro Parody:** This is modern, high-detail pixel art, not blocky 8-bit parody. Avoid jagged primitive blocks.
* **Earth as the Hero Light:** In all lunar scenes, Earth is the dominant, beautiful light source with a luminous cyan atmosphere rim, continent outlines, and terminator shadow.
* **No Pure Black:** Shadows dither and fade into **Deep Indigo (`#0b0f1d`)** or **Shadow Navy (`#131a2e`)**, never raw `#000000`.

---

## 2. The Master 24-Color Palette

The project uses a disciplined 24-color system. Do not introduce arbitrary hex codes.

### Ramp 1: Space & Shadow (Backgrounds & Ambient Depth)
| Name | Hex | Usage |
|:---|:---|:---|
| **Void** | `#05070f` | Deepest background canvas |
| **Deep Indigo** | `#0b0f1d` | Card/panel backgrounds, darkest shadow base |
| **Shadow Navy** | `#131a2e` | Intermediate shadow, crater interior |
| **Dusk** | `#1d263f` | Borders, subtle grid dividers, muted lines |

### Ramp 2: Moon Regolith (Cool Grey-Purple Surface)
| Name | Hex | Usage |
|:---|:---|:---|
| **Basalt Dark** | `#27293d` | Far background ridges, deep craters |
| **Regolith Deep** | `#3b3e59` | Mid ground ridges, shadowed rocks |
| **Regolith Mid** | `#595e7d` | Primary surface terrain value |
| **Dust Light** | `#8389a8` | Highlight terrain, secondary text, muted labels |
| **Crust Cream** | `#b2b8d4` | Lit boulders, equipment metal body |
| **Highlight Rim** | `#e2e6fa` | Primary body text, 1px lit rims |

### Ramp 3: Mars Rust (Warm Layered Terrain & Atmospheric Haze)
| Name | Hex | Usage |
|:---|:---|:---|
| **Shadow Umber** | `#2b140e` | Deep canyon shadow, Martian night |
| **Deep Rust** | `#522116` | Far Martian ridges |
| **Ochre Core** | `#7d331c` | Mid-ground rock strata |
| **Terracotta** | `#ab4f2c` | Primary Martian regolith |
| **Dust Tan** | `#cf724a` | Dunes, lit soil, rover dust tracks |
| **Haze Peach** | `#e89e7d` | Horizon haze band, atmospheric twilight |

### Ramp 4: Cyan (Story Voice, Active UI, Focus)
| Name | Hex | Usage |
|:---|:---|:---|
| **Cyan Void** | `#032630` | Translucent hover background |
| **Cyan Shadow** | `#064b5c` | Inactive interactive elements |
| **Cyan Deep** | `#087d99` | 1px borders, subtle telemetry accents |
| **Cyan Glow** | `#0ec3dc` | Primary brand accent, story text, active badges |
| **Laser Core** | `#7ef1ff` | Intense light center, active pulse |

### Ramp 5: Warm Accents (Lamps, Thrust, Verified Records)
| Name | Hex | Usage |
|:---|:---|:---|
| **Ember Shadow** | `#4a1805` | Amber card shadow fill |
| **Thruster Orange**| `#e65100` | Rocket flames, caution lamps (Energy only) |
| **Beacon Gold** | `#f59e0b` | Verified scientific records, mission award badges |

---

## 3. The "Two Voices, Two Colors" Design Standard

To maintain scientific integrity (per NASA SpaceApps rules), fiction and fact are **strictly separated by color, tag, and container border**:

```
┌─────────────────────────────────────────────────────────────┐
│ [TAG: GAME STORY]                           (Cyan Frame)    │
│ "Built as twins and sent to opposite sides of the planet."   │
│ ➔ Memory Echo: First-person, dramatized emotional hook.     │
└─────────────────────────────────────────────────────────────┘
                               ▲
                               │ Distinct Visual Separation
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ [TAG: VERIFIED RECORD]                     (Amber Frame)    │
│ Opportunity drove more than 45.16 km across Meridiani Planum│
│ ➔ Archivist Note: Factual, sourced, links to NSSDCA / PDS.   │
└─────────────────────────────────────────────────────────────┘
```

1. **Cyan (`#0ec3dc`) — The Story Voice ("Memory Echo"):**
   - 1px border `#0ec3dc`
   - Tag: `[ GAME STORY ]` or `[ MEMORY ECHO ]`
   - Content: Narrative perspective of the abandoned equipment.
2. **Amber (`#f59e0b`) — The Verified Record ("Archivist Note"):**
   - 1px border `#f59e0b`
   - Tag: `[ VERIFIED RECORD ]` or `[ NASA PDS RECORD ]`
   - Content: Peer-reviewed telemetry, real mission dates, scientific payloads, primary source links.

---

## 4. Typography System

The application loads three Google Fonts (free OFL open-source licenses):

| Purpose | Font Family | Fallback | CSS Variable |
|:---|:---|:---|:---|
| **Display / Headers** | `'Silkscreen'` | `'Courier New', monospace` | `var(--f-display)` |
| **Body / Narrative** | `'IBM Plex Sans'` | `system-ui, sans-serif` | `var(--f-body)` |
| **Telemetry / Data** | `'IBM Plex Mono'` | `ui-monospace, monospace` | `var(--f-mono)` |

### Typography Rules:
- Headings (`h1`, `h2`, `h3`) use `Silkscreen` with `letter-spacing: 0.06em;`.
- Telemetry values, coordinates, timestamps, and data tables use `IBM Plex Mono`.
- Dialogue, body copy, and narrative text use `IBM Plex Sans` for effortless readability.

---

## 5. UI Components & Layout Rules

1. **Notched Panels (`.hud-panel`):**
   - Background: `rgba(11, 15, 29, 0.85)` (`var(--panel)`) with `backdrop-filter: blur(8px)`.
   - Borders: 1px solid `var(--line)` (`#1d263f`) or `var(--cyan)` (`#0ec3dc`).
   - Corners: Small angular notches or square corners. Never pill-shaped or bubbly rounded buttons.
2. **Status Badges:**
   - Outlined badge with distinct text and color (e.g. `[ DORMANT ]` in amber `#f59e0b`, `[ IMPACTED ]` in muted `#8389a8`, `[ ACTIVE ]` in cyan `#0ec3dc`).
   - Color is never the only cue; always include the readable text label.
3. **Telemetry Gauges over Plain Text:**
   - Prefer segmented bars and numeric telemetry indicators over generic tables.
4. **Sprite Scale:**
   - Sprites scale at **3× nearest-neighbor** (`image-rendering: pixelated`).
   - Standard scale: Characters ~24 px, landers/hardware ~24–40 px on the 640×360 grid.
   - Sprites feature a 1px lit edge on the top-left, an indigo contact shadow, and orange used strictly for lamps or thrust.

---

## 6. Prohibited Elements (Zero-Tolerance Rules)

To comply with NASA SpaceApps competition rules and our narrative integrity:
* ❌ **NO NASA Insignia:** Never display the official NASA "meatball" or "worm" logos (NASA Media Guidelines prohibition on software branding).
* ❌ **NO Aliens or Monsters:** No fictional extraterrestrial creatures, fantasy crystals, or magical ruins.
* ❌ **NO Arcady Game Clutter:** No floating coins, heart containers, HP bars, floating numbers, or RPG inventories.
* ❌ **NO Pure Black (#000000):** All shadow fills must use the indigo/space palette.
* ❌ **NO Harsh Flashing:** Accessibility rule: all glows must be soft blooms. Respect `prefers-reduced-motion`.

---

## 7. Interactive Reference Gallery
The original visual reference build, images, and interactive palette swatches are preserved in the repository at:
- **`docs/art-reference/index.html`** (Live interactive reference page)
- **`public/assets/sprites/`** (Extracted 16-bit sprites: `robot.png`, `surveyor.png`, `lm.png`, `curiosity.png`, `rocket.png`, `earth.png`, `panel.png`)
