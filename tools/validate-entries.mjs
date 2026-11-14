#!/usr/bin/env node
// Validates the 23-entry archive and UNIT-7 story script.
// Usage: node tools/validate-entries.mjs   (exit 1 on any failure)
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const json = (p) => JSON.parse(readFileSync(resolve(root, p), 'utf8'));

const entries = json('src/data/artifacts.json');
const story = json('data/story/unit7.json');
const errors = [];
const fail = (id, msg) => errors.push(`${id}: ${msg}`);

const ids = Object.keys(entries);
if (ids.length !== 23) fail('archive', `expected 23 entries, found ${ids.length}`);
const perWorld = { moon: 0, mars: 0, elsewhere: 0 };
for (const id of ids) perWorld[entries[id].world] = (perWorld[entries[id].world] ?? 0) + 1;
for (const [w, n] of Object.entries({ moon: 8, mars: 9, elsewhere: 6 })) {
  if (perWorld[w] !== n) fail('archive', `expected ${n} ${w} entries, found ${perWorld[w] ?? 0}`);
}

for (const id of ids) {
  const e = entries[id];
  if (e.id !== id) fail(id, `id field "${e.id}" does not match key`);

  // Image: must be a local file under public/
  const file = e.image?.file;
  if (!file) fail(id, 'missing image.file');
  else if (/^https?:/i.test(file)) fail(id, `image.file is remote (${file})`);
  else if (!existsSync(resolve(root, 'public', file))) fail(id, `image not found: public/${file}`);
  if (!e.image?.alt) fail(id, 'missing image.alt');
  if (e.image?.nasa_id === 'SI-ILLUSTRATION' && /^NASA\b/.test(e.image.credit ?? '')) {
    fail(id, 'SI illustration credited as NASA');
  }

  // Two-person rule
  if (!e.written_by || !e.verified_by) fail(id, 'missing written_by / verified_by');
  else if (e.written_by === e.verified_by) fail(id, `written_by === verified_by (${e.written_by})`);

  // Citations
  const urls = [...(e.sources ?? []).map((s) => s.url ?? s.source_url ?? s), ...(e.facts ?? []).map((f) => f.source_url)];
  if (!urls.length) fail(id, 'no sources');
  if (!urls.some((u) => typeof u === 'string' && /(^|\.)nasa\.gov\//.test(u.replace(/^https?:\/\//, '')))) {
    fail(id, 'no nasa.gov citation');
  }

  // Story site
  const s = story.sites?.[id];
  if (!s) {
    fail(id, 'no story site in unit7.json');
    continue;
  }
  const approach = Array.isArray(s.approach) ? s.approach : [s.approach];
  if (!approach.length || approach.some((l) => !l)) fail(id, 'empty approach');
  if (e.world === 'elsewhere') {
    if (approach.length < 2) fail(id, 'elsewhere site needs 2 approach lines');
    if (!s.first_seen) fail(id, 'elsewhere site needs first_seen');
  }
  if (!Array.isArray(s.reel) || s.reel.length !== 6) fail(id, `reel must have 6 lines (has ${s.reel?.length ?? 0})`);
  if (!s.afterthought) fail(id, 'missing afterthought');
  if (!s.question) fail(id, 'missing question');

  const q = s.quiz;
  if (!q) {
    fail(id, 'missing quiz');
    continue;
  }
  if (!Array.isArray(q.choices) || q.answer < 0 || q.answer >= q.choices.length) fail(id, 'quiz.answer out of range');
  const src = q.field === 'facts' ? (e.facts ?? []).map((f) => f.text).join(' ') : e[q.field];
  if (typeof src !== 'string') fail(id, `quiz.field "${q.field}" is not a text field`);
  else if (!q.evidence || !src.includes(q.evidence)) fail(id, `quiz.evidence not found verbatim in ${q.field}: "${q.evidence}"`);
}

for (const sid of Object.keys(story.sites ?? {})) {
  if (!entries[sid]) fail(sid, 'story site has no archive entry');
}

// Chronology: each sector's play order follows launch dates and covers every entry
const entriesTs = readFileSync(resolve(root, 'src/data/entries.ts'), 'utf8');
for (const [name, world] of [['MOON', 'moon'], ['MARS', 'mars'], ['ELSEWHERE', 'elsewhere']]) {
  const m = entriesTs.match(new RegExp(`${name}_CHRONOLOGY: string\\[\\] = \\[([^\\]]*)\\]`));
  const order = m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : [];
  const expected = ids.filter((id) => entries[id].world === world);
  if (order.length !== expected.length || !expected.every((id) => order.includes(id))) {
    fail(`${name}_CHRONOLOGY`, 'does not list exactly the sector entries');
  }
  for (let i = 1; i < order.length; i++) {
    const a = entries[order[i - 1]]?.launch_date ?? '', b = entries[order[i]]?.launch_date ?? '';
    if (a > b) fail(`${name}_CHRONOLOGY`, `${order[i - 1]} (${a}) is before ${order[i]} (${b})`);
  }
}

// Nothing lands in deep space: Elsewhere echoes use flyby/link minigames only
const minigamesTs = readFileSync(resolve(root, 'src/data/minigames.ts'), 'utf8');
for (const [, id, scene] of minigamesTs.matchAll(/^\s*'?([a-z0-9-]+)'?: '(\w+Scene)',$/gm)) {
  if (entries[id]?.world === 'elsewhere' && ['LandingScene', 'RoverScene', 'RotorScene'].includes(scene)) {
    fail(id, `Elsewhere echo uses surface minigame ${scene}`);
  }
}
for (const id of ids) {
  if (entries[id].image?.nasa_id === 'SI-ILLUSTRATION') fail(id, 'image is an SI illustration, not NASA imagery');
}

// Ambient pools
const minPool = { first_elsewhere: 3, elsewhere_drive: 8, elsewhere_idle: 5 };
for (const [k, n] of Object.entries(minPool)) {
  const len = story.ambient?.[k]?.length ?? 0;
  if (len < n) fail('ambient', `${k} needs ${n}+ lines (has ${len})`);
}

// Finale script
for (const k of ['opening', 'reflection', 'resolution']) {
  if (!story.finale?.[k]) fail('finale', `missing ${k}`);
}

// Transition cinematic
const cin = json('data/cinematics/transition-elsewhere.json');
if (!Array.isArray(cin.events) || !cin.events.length) fail('transition-elsewhere', 'no events');
else if (cin.events.some((ev) => ev.time > cin.totalDuration)) fail('transition-elsewhere', 'event after totalDuration');

if (errors.length) {
  console.error(`✗ ${errors.length} problem(s):\n  ` + errors.join('\n  '));
  process.exit(1);
}
console.log(`✓ ${ids.length} entries (moon ${perWorld.moon} · mars ${perWorld.mars} · elsewhere ${perWorld.elsewhere}) and story script valid`);
