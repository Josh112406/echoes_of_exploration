/**
 * Writes docs/submission-references.md: a paste-ready References and AI-disclosure
 * list for the Space Apps project submission, separated into NASA Data and Space
 * Agency Partner & Other Data with `Link Text: Link URL` formatting.
 * Run with `npm run references` after any data change.
 */
import fs from 'node:fs';
import path from 'node:path';
import { ALL_ENTRIES } from '../src/data/entries.ts';
import { MISSIONS, SOURCES, ENCOUNTERS } from '../src/data/catalog.ts';
import { FIELD_TASKS } from '../src/data/fieldTasks.ts';
import {
  SOFTWARE, MAPS, FONT_CREDIT, ART_CREDIT, AUDIO_CREDIT, AI_DISCLOSURE, MEDIA_GUIDELINES_URL, NON_ENDORSEMENT, HUMAN_REVIEW_STATEMENT,
} from '../src/data/credits.ts';

const CITATION_LABELS: Record<string, string> = {
  'https://an.rsl.wustl.edu/help/Content/About%20the%20mission/MER/MER%20mission.htm': 'Washington University in St. Louis (NASA PDS Geosciences Node) - MER Analyst Notebook',
  'https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/Landing_Sites.htm': 'Washington University in St. Louis (NASA PDS Geosciences Node) - Mars Orbital Data Explorer Landing Sites',
  'https://history.nasa.gov/alsj/a12/a12.html': 'NASA History - Apollo 12 Lunar Surface Journal',
  'https://history.nasa.gov/alsj/a15/a15.html': 'NASA History - Apollo 15 Lunar Surface Journal',
  'https://history.nasa.gov/alsj/a17/a17.html': 'NASA History - Apollo 17 Lunar Surface Journal',
  'https://mars.nasa.gov/mars2020/': 'NASA Mars Exploration - Mars 2020 Perseverance Rover',
  'https://mars.nasa.gov/msl/': 'NASA Mars Exploration - Mars Science Laboratory Curiosity',
  'https://mars.nasa.gov/technology/helicopter/': 'NASA Mars Exploration - Ingenuity Mars Helicopter',
  'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1967-035A': 'NASA NSSDCA - Surveyor 3 (1967-035A)',
  'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1996-008A': 'NASA NSSDCA - NEAR Shoemaker (1996-008A)',
  'https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1999-001A': 'NASA NSSDCA - Mars Polar Lander (1999-001A)',
  'https://science.nasa.gov/category/missions/ranger/': 'NASA Science - Ranger Missions Archive',
  'https://science.nasa.gov/mission/cassini/grand-finale/': 'NASA Science - Cassini Grand Finale',
  'https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/': 'NASA Science - Mars Exploration Rovers (Spirit and Opportunity)',
  'https://science.nasa.gov/mission/mars-polar-lander-deep-space-2/': 'NASA Science - Mars Polar Lander / Deep Space 2',
  'https://science.nasa.gov/mission/viking-1/': 'NASA Science - Viking 1',
  'https://science.nasa.gov/mission/viking-2/': 'NASA Science - Viking 2',
  'https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/': 'NASA Science - Voyager 1 and Voyager 2 Mission Status',
  'https://science.nasa.gov/moon/': "NASA Science - Earth's Moon",
  'https://solarsystem.nasa.gov/missions/deep-impact/in-depth/': 'NASA Solar System Exploration - Deep Impact In Depth',
  'https://www.giss.nasa.gov/tools/mars24/help/landers.html': 'NASA GISS - Mars24 Mars Lander Coordinates',
  'https://www.jpl.nasa.gov/images/pia25218-debris-field-for-perseverance-landing-gear-seen-from-mars-helicopter': 'NASA/JPL - PIA25218 Perseverance Landing Gear Debris Field',
  'https://www.jpl.nasa.gov/missions/insight': 'NASA/JPL - InSight Mars Lander',
  'https://www.jpl.nasa.gov/missions/phoenix': 'NASA/JPL - Phoenix Mars Lander',
  'https://www.jpl.nasa.gov/news/nasas-ingenuity-mars-helicopter-succeeds-in-historic-first-flight': 'NASA/JPL - Ingenuity Mars Helicopter First Flight News',
  'https://www.nasa.gov/clps': 'NASA - Commercial Lunar Payload Services (CLPS)',
  'https://www.nasa.gov/history/alsj/a15/a15.lrvface.html': 'NASA History - Apollo 15 Lunar Roving Vehicle Surface Operations',
  'https://www.nasa.gov/mission/apollo-11/': 'NASA - Apollo 11',
  'https://www.nasa.gov/mission/apollo-12/': 'NASA - Apollo 12',
  'https://www.nasa.gov/mission/apollo-14/': 'NASA - Apollo 14',
  'https://www.nasa.gov/mission/apollo-15/': 'NASA - Apollo 15',
  'https://www.nasa.gov/mission/apollo-17/': 'NASA - Apollo 17',
  'https://www.nasa.gov/mission_pages/apollo/apollo-11.html': 'NASA - Apollo 11 Mission Overview Archive',
  'https://www.nasa.gov/missions/artemis/clps/nasa-anticipates-lunar-findings-from-next-generation-retroreflector': 'NASA - Next-Generation Lunar Retroreflector (CLPS/Artemis)',
  'https://www.nasa.gov/specials/apollo50th/missions.html': 'NASA - Apollo 50th Anniversary Missions and Landing Sites',
};

const isNasaHost = (u: string) => /(^|\.)nasa\.gov$/i.test(new URL(u).hostname);
const cleanText = (s: string) => s.replace(/:\s+/g, ' - ');

const entries = Object.values(ALL_ENTRIES);
const citations = [...new Set([
  ...entries.flatMap((e) => [...e.sources, ...e.facts.map((f) => f.source_url), ...e.locations.map((l) => l.source_url)]),
  ...MISSIONS.map((m) => m.media_page_url),
  ...FIELD_TASKS.flatMap((t) => (t.kind === 'power' ? [t.statusUrl] : [])),
])].sort();

const catalogUrls = new Set(SOURCES.map((s) => s.url));
const extraCitations = citations.filter((u) => !catalogUrls.has(u));
const labelFor = (u: string) => CITATION_LABELS[u] ?? `${new URL(u).hostname.replace(/^www\./, '')}`;

const nasaSources = SOURCES.filter((s) => isNasaHost(s.url)).map((s) => `- ${cleanText(`${s.organization} - ${s.title}`)}: ${s.url}`);
const nasaExtraCitations = extraCitations.filter(isNasaHost).map((u) => `- ${cleanText(labelFor(u))}: ${u}`);
const nasaMaps = MAPS.filter(([, , u]) => isNasaHost(u)).map(([n, c, u]) => `- ${cleanText(`${n} (${c})`)}: ${u}`);
const nasaPhotos = entries.map((e) => `- ${cleanText(`NASA Image Library - ${e.name} (${e.image.nasa_id}, ${e.image.credit})`)}: ${e.image.source_url}`);

const partnerSources = SOURCES.filter((s) => !isNasaHost(s.url)).map((s) => `- ${cleanText(`${s.organization} - ${s.title}`)}: ${s.url}`);
const partnerExtraCitations = extraCitations.filter((u) => !isNasaHost(u)).map((u) => `- ${cleanText(labelFor(u))}: ${u}`);
const partnerMaps = MAPS.filter(([, , u]) => !isNasaHost(u)).map(([n, c, u]) => `- ${cleanText(`${n} (${c})`)}: ${u}`);

const out: string[] = [
  '# Echoes of Exploration: submission references',
  '',
  `_Generated by \`npm run references\` from src/data on ${new Date().toISOString().slice(0, 10)}. Do not edit by hand; edit the data files and re-run._`,
  '',
  `Coverage: ${entries.length} playable echoes, a ${MISSIONS.length}-mission catalog, ${ENCOUNTERS.length} designed encounters (${FIELD_TASKS.length} with field tasks). No NASA API is called at runtime; all data ships with the game.`,
  '',
  '## NASA Data',
  '',
  '### Primary Mission & Archive Authorities',
  '',
  ...nasaSources,
  '',
  '### Additional NASA Echo & Mission Citations',
  '',
  ...nasaExtraCitations,
  '',
  '### NASA Maps',
  '',
  ...nasaMaps,
  '',
  '### NASA Photographs (NASA Image and Video Library)',
  '',
  ...nasaPhotos,
  '',
  '## Space Agency Partner & Other Data',
  '',
  '### Partner Data Archives',
  '',
  ...partnerSources,
  ...partnerExtraCitations,
  ...partnerMaps,
  '',
  '### Fonts, Open-Source Software & Hosting',
  '',
  `- ${cleanText(FONT_CREDIT.text)} (${FONT_CREDIT.licencePath}): ${FONT_CREDIT.sourceUrl}`,
  ...SOFTWARE.map(([n, l, u]) => `- ${n} (${l} licence): ${u}`),
  '- Vercel Privacy Policy (static host operational logs): https://vercel.com/legal/privacy-policy',
  '',
  '## Original Art, Audio, AI Disclosure & Compliance Notes',
  '',
  `- ${ART_CREDIT}`,
  `- ${AUDIO_CREDIT}`,
  `- Use of artificial intelligence: ${AI_DISCLOSURE}`,
  `- Human verification: ${HUMAN_REVIEW_STATEMENT}`,
  `- NASA non-endorsement: ${NON_ENDORSEMENT} Guidelines: ${MEDIA_GUIDELINES_URL}`,
  '',
];

const file = path.resolve('docs/submission-references.md');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, out.join('\n'));
console.log(`wrote ${path.relative(process.cwd(), file)} (${SOURCES.length} sources, ${citations.length} citations, ${entries.length} photos)`);
