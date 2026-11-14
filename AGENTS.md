# AGENTS.md — AI Coding Agent Guardrails & Guidelines
**Project:** Echoes of Exploration: The NASA Signal Archive  
**Target:** NASA SpaceApps Challenge 2026  

This file provides non-negotiable instructions for all AI coding assistants (Claude Code, Cursor, Copilot, Antigravity, Codex) working on this codebase.

---

## 1. Strict Directory Ownership & Boundaries

To prevent merge conflicts between teammates and agents, respect these hard directory boundaries:

| Directory | Owner | Rules for Agents |
|---|---|---|
| `src/game/` | **Coder 2 (Game Lead)** | Only Coder 2's agent may edit this. Never touch `App.tsx` or `src/pages/`. Export a clean `<EncounterView onComplete={...} onExit={...} />`. |
| `src/pages/`<br>`src/components/`<br>`src/context/` | **Coder 1 (Web Platform Lead)** | Only Coder 1's agent may edit this. Mounts Coder 2's game at route `/game`. |
| `src/data/` | **Member 6 (Data Lead)** | Contains `missions.json`, `sources.json`, `encounters.json`. Do not hardcode mission facts inside React components; always read from here. |
| `src/text/` | **Member 4 (Science Writer)** | Contains in-game dialogue scripts and evidence explanations. |
| `public/assets/`<br>`public/images/` | **Member 3 & Member 6** | Audio files, badge graphics, and public domain NASA imagery. |

---

## 2. Hard Technical Constraints

1. **Zero Runtime APIs / Zero Backend:**
   * Do NOT make `fetch()` calls to external APIs (including `api.nasa.gov`) during runtime.
   * All data must be imported directly from `@/data/missions.json`, `@/data/sources.json`, or `@/data/encounters.json`.
   * State persistence must use browser `localStorage` only (no cookies, no backend databases, no auth).

2. **Clean Game-Platform Contract:**
   * The game on `/game` must communicate with the platform solely via props:
   ```typescript
   export interface EncounterProps {
     missionId: string;
     onComplete: (badgeId: string) => void;
     onExit: () => void;
   }
   ```
   * The game must be completely self-contained within `src/game/`.

3. **Routing & Deployment Safety:**
   * Single Page Application routes:
     * `/` $\rightarrow$ Observatory Home Page (with "Start Game" and "Mission Archive" buttons).
     * `/game` $\rightarrow$ Playable Minigame screen (with "Exit to Observatory" button).
     * `/archive` $\rightarrow$ 31-Mission Museum Catalog with filters.
     * `/about` $\rightarrow$ Citations, methodology, and legal compliance.
   * Static host 404 safety: `vercel.json` rewrites and `public/.htaccess` are required.

4. **Code Quality:**
   * TypeScript strict mode. No `any` types unless strictly necessary.
   * Responsive from mobile viewports (360px) up to 4K desktop displays.
   * `npm run build` must pass with zero TypeScript or build errors.
