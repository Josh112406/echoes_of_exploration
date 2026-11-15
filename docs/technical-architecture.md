# Technical Architecture

## Architecture decision

Build a fully client-side static web game using TypeScript, Vite, and Phaser. Phaser handles scenes, sprites, animation, and game input. Semantic HTML handles navigation, long text, forms, settings, source panels, policies, and accessible alternatives.

Do not put essential educational content only inside the canvas.

## Logical components

```text
Static host (Vercel or Netlify)
  └─ Application shell
      ├─ Semantic HTML UI
      │   ├─ Navigation and dialogs
      │   ├─ Catalog and source panels
      │   ├─ Settings and policies
      │   └─ Non-canvas encounter alternatives
      ├─ Phaser runtime
      │   ├─ Observatory and maps
      │   ├─ Three mechanic families
      │   └─ Nine data-driven encounters
      ├─ Content layer
      │   ├─ Campaign manifest
      │   ├─ Mission records and localization
      │   └─ Asset/provenance manifests
      └─ Local persistence
          ├─ Versioned save
          ├─ Settings and achievements
          └─ Export/import/reset
```

## Scene model

- `Boot`: validate environment and load minimum shell.
- `Title`: new, continue, free explore, settings, about.
- `Observatory`: campaign hub and restored displays.
- `SolarMap`: Moon, Mars, Elsewhere navigation.
- `ChapterMap`: mission nodes and progress.
- `Encounter`: reusable shell that loads a mechanic adapter and content record.
- `Result`: evidence, simplification, sources, reward.

Catalog, policies, and Deep Dives should remain DOM routes or overlays rather than game scenes.

## Data-driven encounters

The code implements three stable mechanic families. A campaign manifest selects nine mission records and connects each to a mechanic configuration. Mission content does not fork the application shell.

The build must fail on:

- Missing required content, localization, source, or asset fields.
- Duplicate identifiers.
- Invalid status or mechanic identifiers.
- Missing keyboard/canvas-alternative descriptions.
- External asset without provenance and usage status.

## Rendering and performance

- Prefer WebGL with Phaser-supported Canvas fallback where feasible.
- Use sprite atlases, compressed textures, vector UI icons, and limited particle counts.
- Do not use full 3D, large video backgrounds, or per-frame DOM layout changes.
- Lazy-load Moon first; load Mars and Elsewhere chapter bundles on demand.
- Initial transfer target: under 8 MB compressed.
- Target 60 FPS; required interactions remain usable at 30 FPS.
- Reduced-effects mode disables parallax, particles, camera shake, flashes, and nonessential motion.
- Manual quality choice overrides capability detection. Do not use User-Agent sniffing to infer performance.

## Browser support

- Recent stable Chrome, Edge, Firefox, and Safari.
- Mobile Safari and mobile Chrome.
- Responsive from 360 × 640 to desktop.
- Friendly unsupported-browser page if required JavaScript or graphics initialization fails.
- Catalog fallback remains readable if Phaser cannot start.

## Persistence

Use a small versioned local save. Local storage is sufficient for structured progress/settings; downloadable JSON provides backup and transfer. Validate imports against a strict schema, reject unknown executable content, cap file size, and show a preview before replacement.

No cookies are required. No save data is transmitted.

## Security and privacy boundary

- No backend, authentication, telemetry, ads, remote user-generated content, or runtime third-party API.
- No `eval`, dynamic remote scripts, or HTML injected from content files.
- Pin dependencies and commit the lockfile.
- Review dependency licenses and known vulnerabilities before freeze.
- Restrictive Content Security Policy where host configuration permits.
- Escape rendered content and allowlist safe URL protocols.
- External source links use safe new-tab behavior.

## Deployment

Produce a host-neutral static output. Include configuration examples for:

- Vercel: static build command/output, rewrites for client routes, security headers.
- Netlify: static publish directory, redirects, security headers.

Deployment must not introduce host analytics. Use a relative base path unless the chosen host requires otherwise.

## Technical decision record

| Decision | Chosen | Rejected/why |
|---|---|---|
| Game layer | Phaser | Custom canvas engine adds one-day risk |
| Build | Vite + TypeScript | Untyped scripts weaken shared contracts |
| Long-form UI | Semantic HTML | Canvas-only UI harms accessibility/searchability |
| Content | Static validated manifests | Runtime APIs add availability and privacy risk |
| Save | Versioned browser storage + JSON export | Accounts/cloud sync are out of scope |
| Rendering | 2D sprites/parallax | Photorealistic 3D exceeds time and device budget |
| Adaptation | Responsive/capability-based | User-Agent detection is unreliable |

## Version policy

At Hour 0, Member 2 selects current stable compatible releases from official package sources, records exact versions, commits the lockfile, and freezes upgrades. Do not specify floating “latest” ranges in the implementation branch.

