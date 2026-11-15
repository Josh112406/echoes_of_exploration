# Proposed Folder Structure and Ownership

This is the intended implementation repository. It is a design artifact, not a request to create code during planning.

```text
echoes-of-exploration/
├─ README.md                              # M1: public overview and setup
├─ LICENSE                                # M6: Apache-2.0 code notice
├─ LICENSE-CONTENT                        # M6: CC0 original content/assets
├─ package.json                           # M2
├─ lockfile                               # M2; exact filename follows package manager
├─ vite.config                            # M2
├─ tsconfig                               # M2
├─ public/
│  ├─ icons/                              # M5
│  ├─ fallback/                           # M6: readable no-canvas entry
│  └─ policy-assets/                      # M6
├─ src/
│  ├─ main/                               # M2: bootstrap and routing
│  ├─ app-shell/                          # M2/M6: semantic navigation, dialogs, errors
│  ├─ game/
│  │  ├─ scenes/                          # M3: boot/title/observatory/maps/encounter/result
│  │  ├─ mechanics/
│  │  │  ├─ navigate-manage/              # M3
│  │  │  ├─ observe-infer/                # M3
│  │  │  └─ communicate-preserve/         # M3
│  │  ├─ input/                           # M3/M6: keyboard, touch, pause
│  │  ├─ rendering/                       # M3/M5: quality and reduced effects
│  │  └─ accessibility-bridge/            # M6: DOM state and alternatives
│  ├─ catalog/                            # M2/M4: search, filter, detail, connections
│  ├─ content/
│  │  ├─ campaigns/                       # M1/M4: adjustable campaign manifests
│  │  ├─ encounters/                      # M1/M3/M4: nine encounter records
│  │  ├─ missions/                        # M4: 25–40 mission-group records
│  │  ├─ sources/                         # M4: source and claim ledgers
│  │  ├─ provenance/                      # M4/M5/M6: asset and AI ledgers
│  │  └─ schemas/                         # M2: validation contracts
│  ├─ i18n/
│  │  ├─ en/                              # M1/M4: English UI and content strings
│  │  └─ config/                          # M2: localization setup
│  ├─ assets/
│  │  ├─ authentic/                       # M5: cleared mission media, never generated
│  │  ├─ illustrations/                   # M5: labeled team/AI-assisted art
│  │  ├─ backgrounds/                     # M5: reusable destination systems
│  │  ├─ sprites/                         # M5: optimized atlases
│  │  ├─ audio/                           # M6/M5: music, effects, transcripts
│  │  └─ fonts-icons/                     # M5/M6: redistribution-cleared
│  ├─ persistence/                        # M2: save, migration, import/export/reset
│  ├─ settings/                           # M2/M6: audio, text, contrast, motion, quality
│  ├─ policies/                           # M6: privacy, rights, accessibility, methodology
│  ├─ styles/                             # M5/M6: tokens, responsive and accessible UI
│  └─ shared/                             # M2: stable utilities/types; no mission content
├─ tests/
│  ├─ unit/                               # M2/M3
│  ├─ content-validation/                 # M2/M4
│  ├─ integration/                        # M2/M6
│  ├─ accessibility/                      # M6
│  ├─ browser/                            # M6
│  └─ fixtures/                           # M2/M6: valid/corrupt saves and content
├─ docs/
│  ├─ architecture/                       # M2
│  ├─ science-review/                     # M4
│  ├─ rights-and-attribution/             # M5/M6
│  ├─ assistant-ledger/                   # Task owner + M6
│  ├─ accessibility/                      # M6
│  └─ submission/                         # M1
├─ deployment/
│  ├─ vercel/                             # M2
│  └─ netlify/                            # M2
└─ planning/                              # M1: this package or a linked copy
```

## Boundary rules

- Mission facts live in `content/`, never duplicated inside mechanic code.
- Authentic and illustrated assets remain in separate directories.
- Each external asset has a matching provenance record before merge.
- Shared schemas and styles require Member 2 review; facts require Member 4; accessibility/policies require Member 6.
- `shared/` is not a dumping ground: new modules need an identified second consumer.
- Encounter-specific visual configuration belongs with encounter content, not a forked mechanic.
- Generated files and build output are not hand-edited or committed unless the toolchain explicitly requires them.

## Low-conflict work partition

| Member | Default writable areas |
|---|---|
| M1 | campaign narrative, English story strings, submission docs |
| M2 | shell, schemas, persistence, deployment, shared contracts |
| M3 | game scenes, mechanics, input |
| M4 | missions, encounters’ factual fields, sources/claims |
| M5 | assets, styles, visual configuration, asset provenance |
| M6 | accessibility bridge/tests, audio, policies, QA fixtures |

Cross-boundary changes require the owner notification and review process in `team-workflow.md`.

