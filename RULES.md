# RULES.md — NASA SpaceApps Team & Competition Rules
**Project:** Echoes of Exploration: The NASA Signal Archive  
**Challenge:** Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars  

Every team member and AI coding assistant must follow these competition, scientific, and engineering rules.

---

## 1. Official NASA Space Apps Eligibility & Submission Rules (PDF Compliance)

1. **Team Registration & Event Alignment (Disqualification Risk):**
   * Maximum of **6 members**.
   * All team members (including the Team Owner) **must be registered for the exact same Local Event** (or Universal Event) and appear on the **Members tab** of the team page **before project submission closes**. New members cannot be added after submission closes.
2. **Project Demo Format Limits:**
   * **Option A (Slides):** Strict maximum of **7 slides** (including title and intro slides).
   * **Option B (Video):** Strict maximum of **30 seconds**. If spoken in another language, **English subtitles are mandatory**.
3. **English Language Requirement:**
   * All text on the Project Submission page, presentation deck, and web application must be in **English**.
4. **References & Attribution Checkboxes:**
   * Every external resource—including NASA datasets, NSSDCA records, images, fonts, and open-source code libraries—must be listed in the **References field** on the project submission form.
5. **NASA Official Super Intelligence (SI) & AI Policy (Mandatory):**
   * **Permitted Tools:** Chatbots, LLMs, foundation models, and image generation are permitted to accelerate innovation.
   * **Strict NASA Branding Prohibition:** Generated content **MAY NOT** use, contain, or modify any NASA branding or design elements (such as NASA logos, the meatball, worm, flags, or official mission identifiers/patches).
   * **Mandatory Visible Watermarking on Images & Videos:** Any SI-generated images and videos **must include a visible watermark** indicating they are SI-generated.
   * **Mandatory Audio Disclosure:** Audio generated or synthesized via SI must be acknowledged in descriptive text and metadata.
   * **Mandatory Code & Data Disclosure:** Code and dataset normalization generated with SI must be acknowledged in descriptive text, metadata, and repository documentation.
   * **Judges' Evaluation:** While the SI data collection field is administrative, judges **will evaluate originality, intent, and execution based on visible SI watermarks, metadata, and disclosures** in the project.
6. **NASA Branding & Non-Endorsement:**
   * Follow the [NASA Media Usage Guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/). Do not use the NASA insignia/logo in a way that implies NASA sponsorship or endorsement.
   * NASA does not endorse any non-U.S. Government entity and is not responsible for information contained on non-U.S. Government websites.
7. **China Funding Restriction Policy:**
   * Per NASA Space Apps Terms & Conditions (PDF Page 4), no prohibited bilateral activity or affiliation with China or a Chinese-owned entity.
8. **Submission Deadline:**
   * Official deadline: **Sunday, November 15 at 11:59 p.m. local time** (Local Event time).
   * **Internal Team Deadline:** Submit at least **2 hours early (by 10:00 p.m.)** to avoid server congestion.

---

## 2. Judging Criteria Alignment (Scale 1–5)

Every feature and design choice must support the five official NASA judging criteria:
* **Impact:** Connects forgotten lunar, Martian, and deep-space hardware to human curiosity and accessible education.
* **Creativity:** Frames silent spacecraft through interactive "memory echoes" and a restorable Signal Observatory.
* **Validity:** Grounded in real scientific instruments, real mission constraints, and usability/user-friendliness.
* **Relevance:** Uses NASA open data (NSSDCA, PDS, JPL records) as a **core component**, not a superficial addition.
* **Presentation:** Clear, engaging storytelling across the live demo and submission materials.

---

## 3. Asset & Media Licensing (Zero Copyright Risk)

1. **Visual Assets:** Use **strictly official NASA public domain imagery** (from NASA Science, JPL, or NSSDCA) or original team-created graphics/illustrations. Clearly label illustrations vs. authentic mission photography.
2. **Audio Assets:** Use **team-synthesized SFX** (e.g., Web Audio API / synthesizer telemetry tones and beeps) or public domain NASA audio transmissions.
3. **Zero Unlicensed Material:** Never use copyrighted music, uncredited stock assets, or proprietary third-party media.

---

## 4. Scientific & Narrative Integrity

* **No Fake Science:** Inanimate hardware must **never** be depicted as conscious, magical, or currently transmitting live signals if dormant. Keep dramatized story hooks visibly distinct from scientific facts.
* **Acknowledge Scientific Uncertainty:** Where historical measurements were ambiguous (e.g., Viking's biological soil experiments), state the scientific ambiguity accurately.
* **Primary Source Linking:** Every mission in `src/data/missions.json` must link to an official primary source (`src/data/sources.json`, NSSDCA, or PDS).

---

## 5. Team Roles & Directory Ownership (6-Member Structure)

| Member | Role | Owned Directories / Deliverables |
|---|---|---|
| **Member 1 (Coder 1)** | Web Platform & UI Lead | `src/ui/`, `src/core/`, `index.html`, accessible overlays (`TitleScreen`, `HubMap`, `ArchiveModal`, `EntryReaderModal`, `FieldTaskModal`, `SettingsModal`, `AboutModal`) & deployment |
| **Member 2 (Coder 2)** | Engine & Integration Lead | `src/scenes/`, `src/systems/`, `src/main.ts`, Phaser 3 campaign & 60 Hz minigame integration |
| **Member 3** | Asset & Audio Maker | `src/audio/`, `public/assets/`, `src/systems/SpriteArt.ts` — procedural pixel art, maps, and Web Audio API SFX/music |
| **Member 4** | Game & Story Creator | `src/data/story.ts`, `src/data/fieldTasks.ts`, `src/data/finale.ts`, `data/cinematics/` — UNIT-7 narrative scripts, quizzes, and science field tasks |
| **Member 5** | Pitch & Submission Lead | Builds the 7-slide presentation deck / 30s demo video and manages the Space Apps submission portal |
| **Member 6** | Dataset Manager | `src/data/` (`artifacts.json`, `missions.json`, `sources.json`, `encounters.json`), coordinates, and `docs/submission-references.md` ledger |

---

## 6. Git & Engineering Workflow (Feature Branches & Peer Review)

1. **Branching & Peer Review:**
   * Work on isolated feature branches (e.g., `feature/platform-shell`, `feature/game-integration`, `feature/data-updates`).
   * Merging into `main` requires review/approval from the other coder to prevent merge conflicts and broken deployments.
2. **Pre-Merge Build Check:**
   * Always run `npm run build` locally and confirm zero TypeScript or build errors before merging to `main`.
3. **No Runtime External API Calls:**
   * All mission data must be loaded from the static JSON files in `src/data/` to guarantee 100% uptime and zero API rate-limit failures during judging.
4. **Commit Messages:**
   * Keep commit messages short, lowercase, and clear (e.g., `initial commit`, `add datasets`, `update rules.md`).
