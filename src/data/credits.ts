/**
 * Non-NASA-source credits and the project's disclosures, shared by the About page
 * (src/ui/AboutModal.ts) and the submission references file (tools/build-references.ts),
 * so the two never disagree.
 */

/** Third-party software shipped in the build (versions pinned in package.json). */
export const SOFTWARE: [name: string, licence: string, url: string][] = [
  ['Phaser 3.90', 'MIT', 'https://github.com/phaserjs/phaser'],
  ['Zod 3.24', 'MIT', 'https://github.com/colinhacks/zod'],
  ['Vite 6.1 (build tool)', 'MIT', 'https://github.com/vitejs/vite'],
  ['TypeScript 5.7 (build tool)', 'Apache-2.0', 'https://github.com/microsoft/TypeScript'],
];

export const MAPS: [name: string, credit: string, url: string][] = [
  ['Moon map: LRO WAC global mosaic', 'NASA/GSFC/Arizona State University, via NASA Moon Trek', 'https://trek.nasa.gov/moon/'],
  ['Mars map: MGS MOLA color shaded relief', 'NASA/JPL/GSFC, via NASA Mars Trek', 'https://trek.nasa.gov/mars/'],
];

export const FONT_CREDIT = {
  text: 'Font: Silkscreen, © 2001 The Silkscreen Project Authors, SIL Open Font License 1.1',
  licencePath: 'public/assets/fonts/OFL.txt',
  sourceUrl: 'https://github.com/googlefonts/silkscreen',
};

export const ART_CREDIT = 'Elsewhere map, planets, sprites and backgrounds: original team pixel art, made procedurally in code (CC0).';

export const AUDIO_CREDIT = 'Music and sound effects: original, synthesized live in the browser with the Web Audio API. No recorded or licensed audio.';

export const HUMAN_REVIEW_STATEMENT = 'The team confirms that all facts and code were human-verified against the cited sources on 2026-11-14. This is team verification, not NASA certification.';

export const REVIEW_STATUS_LABEL = 'HUMAN VERIFIED';

export const AI_DISCLOSURE = 'Parts of the code, the procedural pixel art and early drafts of some text were produced with AI coding assistants (including Claude by Anthropic and Gemini / Antigravity by Google DeepMind). The team confirms that the facts and code are human-verified. Illustrations made this way are labelled as illustrations, never presented as NASA photographs.';

export const MEDIA_GUIDELINES_URL = 'https://www.nasa.gov/nasa-brand-center/images-and-media/';

export const NON_ENDORSEMENT = 'This is a student team project for the NASA International Space Apps Challenge 2026. It is not made, sponsored or endorsed by NASA. NASA imagery is used following the NASA Images and Media Usage Guidelines; the NASA insignia is not used. NASA does not endorse any non-U.S. Government entity and is not responsible for information on non-U.S. Government websites linked here.';
