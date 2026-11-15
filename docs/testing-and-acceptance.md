# Testing and Acceptance

## Testing scope

No learner-effectiveness evaluation or telemetry is planned. Testing covers functional correctness, scientific traceability, accessibility, responsive behavior, performance, privacy, security, rights, and release integrity.

## Severity

- **Critical:** data loss, privacy/security issue, unlicensed asset, unsourced central claim, app cannot load/finish, essential accessibility path absent.
- **Major:** an encounter, save, navigation, source, or supported input path fails; misleading factual presentation.
- **Moderate:** degraded layout, unclear feedback, nonessential browser issue.
- **Minor:** cosmetic polish with no comprehension or access effect.

Release requires zero open Critical or Major issues.

## Functional matrix

### Core flow

- New game with default and custom local call sign.
- Continue from every safe checkpoint.
- Complete all nine encounters in campaign order.
- Soft failure, retry, and assisted completion for each mechanic family.
- Finish chapter and final campaign rewards.
- Enter Free Explore without campaign completion.
- Revisit completed encounter and result.

### Catalog

- Search by mission/artifact name.
- Filter by destination, decade, hardware type, status, and featured flag.
- Open Story, Mission Console, Deep Dive, Behind the Memory, and Sources.
- Related-mission connections do not lead to missing records.
- Authentic imagery and illustrations are correctly labeled.

### Persistence

- Refresh preserves progress/settings.
- Export produces readable versioned data.
- Import valid data after preview/confirmation.
- Reject malformed, oversized, unsupported-version, and unexpected-field imports safely.
- Reset removes all game-owned data and returns to title.
- Corrupt storage produces recovery options rather than a crash.

### Settings

- Independent music/effects controls and mute.
- Text-size, contrast, reduced-motion, assistance, and quality settings.
- Settings persist locally.

## Accessibility acceptance

- Keyboard-only user can finish the campaign and reach all sources/settings.
- Touch user needs no hover or precision drag.
- Focus is visible, logical, and restored after dialogs.
- Screen reader can navigate title, observatory alternative, catalog, one complete alternative encounter per mechanic family, settings, policies.
- Canvas events announce meaningful state through DOM live regions without chatter.
- 200% zoom does not hide essential controls or require two-dimensional scrolling in text views.
- Contrast meets AA; state does not rely on color.
- Reduced motion removes nonessential movement and flashing.
- Audio-muted path loses no facts or instructions.

## Responsive and browser matrix

| Class | Minimum checks |
|---|---|
| Small phone | 360 × 640 portrait, touch |
| Large phone | portrait and landscape |
| Tablet | touch and keyboard where available |
| School laptop | 1366 × 768, 4 GB target profile |
| Desktop | wide layout and keyboard |
| Browsers | Recent Chrome, Edge, Firefox, Safari; mobile Safari/Chrome |

If a browser lacks required graphics, show the readable catalog fallback and recovery message.

## Performance acceptance

- Initial compressed transfer target below 8 MB.
- Later chapters load only when requested or intentionally prefetched after idle.
- Required interactions remain usable at 30 FPS; target 60 FPS.
- No runaway memory growth after three encounter transitions.
- No large layout shifts obscuring controls.
- Images have appropriate dimensions/variants and audio is compressed.

## Content and science audit

For every featured encounter:

- Purpose, hardware, instrument/action, evidence, conclusion, uncertainty, status, and source are present.
- Claim-ledger IDs resolve.
- “How the game simplified this” is accurate.
- Memory Echo does not masquerade as a quotation.
- Active-mission status is rechecked before release.

For every catalog entry:

- Required fields, source, status, media provenance, and reviewer are present.
- No claim of completeness beyond the documented rubric.

## Privacy and security checks

- Network inspection shows no analytics, tracking, runtime mission API, or user-data upload.
- No cookies are set by application code.
- Call sign and progress remain local.
- External links are safe and clearly external.
- Content cannot inject HTML/script.
- Dependency audit and license review completed.
- Security headers/CSP checked on deployed host where supported.

## Rights audit

- Every asset appears in the asset ledger.
- Credit lines match item/source requirements.
- Third-party and partner assets retain correct licenses.
- NASA logos/identifiers are not used as team branding without permission.
- Authentic versus official illustration versus team/generated illustration is visible.
- Apache-2.0 and CC0 notices are included.

## Definition of done

The production URL passes the complete core flow from a clean browser; all nine encounters resolve; catalog/search/filter, local save/export/import/reset, settings, source/policy pages, keyboard/touch paths, and non-canvas alternatives work; all critical facts and assets are traceable; and no Critical or Major defect remains.

