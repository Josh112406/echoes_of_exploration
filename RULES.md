# RULES.md — NASA SpaceApps Team & Competition Rules
**Project:** Echoes of Exploration: The NASA Signal Archive  
**Challenge:** Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars  

Every team member and AI assistant must adhere to these non-negotiable competition rules.

---

## 1. Official NASA Space Apps Submission Rules (Strict Compliance)

* **Demo Limits (Disqualification Trap):**
  * **Option A:** Slide Presentation — **Strict maximum of 7 slides** (including title and intro slides). Exceeding 7 slides is grounds for immediate penalty.
  * **Option B:** Video Demo — **Strict maximum of 30 seconds**. If spoken in any language other than English, **English subtitles are mandatory**.
* **References & Attribution:**
  * Every code library, image, font, and NASA dataset used must be listed in the **References field** on the project submission form.
  * Only use public domain NASA imagery or CC0/open-source assets. Zero copyrighted music or third-party artwork.
* **Team Eligibility:**
  * Maximum 6 members, all registered for the same Local or Universal event.
* **Deadline:**
  * Must be submitted on `spaceappschallenge.org` before Sunday at 11:59 p.m. local time.
  * **Team Internal Deadline:** Submit 2 hours early (by 10:00 p.m.) to avoid portal downtime.

---

## 2. Scientific & Narrative Integrity (To Score 5/5)

* **No Fake Science:**
  * Inanimate hardware must **never** be depicted as truly conscious, magical, or actively transmitting alien signals.
  * Factual science, scientific interpretation, and dramatized memory hooks must remain visibly distinct.
* **Acknowledge Uncertainty:**
  * Where results were ambiguous (e.g., Viking's biological experiments), state the ambiguity honestly rather than claiming confirmed alien life.
* **Primary Source Linking:**
  * Every published mission record in the catalog must link to its official **NASA Space Science Data Coordinated Archive (NSSDCA)** or **Planetary Data System (PDS)** catalog page.

---

## 3. Git & Engineering Rules

1. **Never Break `main`:**
   * Always verify `npm run build` locally before pushing to `main`.
   * Vercel deploys `main` automatically; broken commits break the live demo for judges!
2. **Directory Isolation:**
   * Coder 1 builds the shell (`src/pages`, `src/components`, `src/context`).
   * Coder 2 builds the game (`src/game`).
   * Member 6 owns `src/data` (JSON datasets).
   * Member 4 owns `src/text` (dialogues & scripts).
   * Member 3 owns `public/assets` (audio, icons, badges).
3. **Commit Messages:**
   * Keep commit messages short, descriptive, and clean (e.g. `add apollo encounter`, `fix mobile nav`, `update mission coordinates`).
