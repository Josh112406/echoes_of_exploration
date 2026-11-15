/**
 * Field tasks: the evidence step of two designed encounters (src/data/encounters.json)
 * that a reflex minigame cannot teach on its own.
 *
 *  - "A Question in the Soil" (Viking): compare three soil-experiment results and pick
 *    only the conclusion the combined evidence supports.
 *  - "Power for the Unknown" (Voyager 1): share a shrinking power supply between
 *    instruments and keep a small interstellar data stream alive.
 *
 * Every factual line names its source (ids from src/data/sources.json). Wording follows
 * each encounter's simplification_note: Viking neither proved nor disproved life, and
 * Voyager's power numbers here are simplified units, not current spacecraft status.
 */

export interface EvidenceCard {
  name: string;
  test: string;
  result: string;
}

export interface Conclusion {
  text: string;
  correct: boolean;
  feedback: string;
}

export interface EvidenceTask {
  kind: 'evidence';
  id: string;
  encounterId: string;
  entryId: string;
  title: string;
  intro: string;
  cards: EvidenceCard[];
  prompt: string;
  conclusions: Conclusion[];
  /** Shown once the supported conclusion is chosen. */
  epilogue: string;
  sourceIds: string[];
}

export interface PowerItem {
  id: string;
  name: string;
  cost: number;
  /** Always on: without the radio nothing reaches Earth. */
  locked?: boolean;
  /** Measures the space around the spacecraft (fields and particles). */
  fields?: boolean;
  /** Only useful while there are planets to look at. */
  planetsOnly?: boolean;
  what: string;
}

export interface PowerRound {
  label: string;
  budget: number;
  situation: string;
  /** Feedback when the plan fits; `hint` explains the better choice if one was missed. */
  good: string;
  hint?: { ifOn: string; text: string };
}

export interface PowerTask {
  kind: 'power';
  id: string;
  encounterId: string;
  entryId: string;
  title: string;
  intro: string;
  items: PowerItem[];
  rounds: PowerRound[];
  epilogue: string;
  /** Live status page: instrument status changes over time. */
  statusUrl: string;
  sourceIds: string[];
}

export type FieldTask = EvidenceTask | PowerTask;

export const FIELD_TASKS: FieldTask[] = [
  {
    kind: 'evidence',
    id: 'viking-soil',
    encounterId: 'question-in-the-soil',
    entryId: 'viking-1-2',
    title: 'A QUESTION IN THE SOIL',
    intro: "In 1976 each Viking lander scooped Martian soil into its onboard instruments. It ran three biology experiments (Pyrolytic Release, Labeled Release and Gas Exchange) and, separately, searched the soil for organic molecules. Three of those results are below, simplified. Read them all before you decide.",
    cards: [
      {
        name: 'LABELED RELEASE',
        test: 'Added a nutrient broth marked with radioactive carbon to the soil.',
        result: 'Radioactive gas came off, a result that at first looked like microbes eating. Soil that was heated first to sterilize it gave almost none.',
      },
      {
        name: 'ORGANIC MOLECULE SEARCH (GCMS)',
        test: 'Heated soil and searched the vapour for organic (carbon-based) molecules, the building blocks of living things.',
        result: 'It did not identify any Martian organic molecules.',
      },
      {
        name: 'GAS EXCHANGE',
        test: 'Moistened the soil and measured the gases it gave off or took in.',
        result: 'Oxygen came off quickly once the soil was moistened, and the carbon dioxide changed later. Reactive chemicals in the soil could explain this without life.',
      },
    ],
    prompt: 'Which conclusion does ALL of the evidence support?',
    conclusions: [
      {
        text: 'Viking found life on Mars.',
        correct: false,
        feedback: 'One test looked like life, but the organic-molecule search found nothing to back it up. One result is not enough.',
      },
      {
        text: 'Viking proved there is no life anywhere on Mars.',
        correct: false,
        feedback: 'A few scoops of soil at two landing sites cannot rule out life everywhere, and scientists still discuss these results.',
      },
      {
        text: 'The results do not establish life. Chemistry in the soil could explain them, but other explanations, including biology, could not be fully ruled out.',
        correct: true,
        feedback: 'That is the careful reading the Viking scientists reported: no clear sign of life, chemistry as a likely explanation, and the question left open.',
      },
      {
        text: 'The experiments must have been broken.',
        correct: false,
        feedback: 'The instruments worked. The puzzle is what their results mean, which is why careful interpretation matters.',
      },
    ],
    epilogue: 'In 2008 the Phoenix lander found perchlorate, a reactive salt, in Martian soil. Chemistry like that may help explain what Viking saw, and the search for life on Mars continues with today\'s rovers.',
    sourceIds: ['nasa-viking', 'nasa-phoenix'],
  },
  {
    kind: 'power',
    id: 'voyager-power',
    encounterId: 'power-for-the-unknown',
    entryId: 'voyager-1',
    title: 'POWER FOR THE UNKNOWN',
    intro: "Voyager 1 runs on a nuclear power source that gives a little less power every year. Engineers stretch it by switching things off. Choose what stays on in each era. (Power units here are simplified.)",
    items: [
      { id: 'radio', name: 'RADIO TRANSMITTER', cost: 3, locked: true, what: 'Sends the data home to the Deep Space Network. Without it, nothing reaches Earth.' },
      { id: 'camera', name: 'CAMERAS', cost: 2, planetsOnly: true, what: 'Photographed Jupiter and Saturn.' },
      { id: 'uv', name: 'ULTRAVIOLET SPECTROMETER', cost: 1, planetsOnly: true, what: 'Studied planet atmospheres and the glow of the Sun\'s neighbourhood.' },
      { id: 'mag', name: 'MAGNETOMETER', cost: 1, fields: true, what: 'Measures magnetic fields around the spacecraft.' },
      { id: 'pws', name: 'PLASMA WAVE INSTRUMENT', cost: 1, fields: true, what: 'Listens to vibrations in the thin gas of space.' },
      { id: 'crs', name: 'COSMIC RAY INSTRUMENT', cost: 1, fields: true, what: 'Counts fast particles arriving from the galaxy.' },
      { id: 'heat', name: 'SOME HEATERS', cost: 1, what: 'Keep parts warm. Engineers have turned some heaters off to save power.' },
    ],
    rounds: [
      {
        label: '1990 · PAST THE PLANETS',
        budget: 8,
        situation: 'The planet flybys are over and the power has dropped. Cut 2 units.',
        good: 'Plan fits. Voyager 1 took its last pictures in February 1990, then its cameras were turned off.',
        hint: { ifOn: 'camera', text: 'This fits, but the cameras have no more planets to photograph. NASA switched them off in 1990.' },
      },
      {
        label: '2012 · LEAVING THE BUBBLE',
        budget: 7,
        situation: "Voyager 1 is about to cross into interstellar space. Keep what can measure the space it's flying through.",
        good: 'Plan fits. In August 2012 its fields-and-particles instruments showed it had crossed the heliopause, the edge of the Sun\'s bubble of solar wind, into interstellar space.',
        hint: { ifOn: 'uv', text: 'This fits, but out here the instruments that measure fields and particles matter most.' },
      },
      {
        label: 'TODAY · RUNNING ON VERY LITTLE',
        budget: 5,
        situation: 'Only a little power is left. Keep the radio and the instruments you think matter most.',
        good: 'Plan fits. Every watt now goes to a thin stream of data from interstellar space.',
      },
    ],
    epilogue: "Its power drops by about 4 watts a year. The real list of instruments still running changes as engineers switch more off, so check NASA's Voyager status page for today's status.",
    statusUrl: 'https://science.nasa.gov/mission/voyager/where-are-voyager-1-and-voyager-2-now/',
    sourceIds: ['nasa-voyager1'],
  },
];

export function getFieldTask(id: string): FieldTask | undefined {
  return FIELD_TASKS.find((t) => t.id === id);
}

export function fieldTaskForEntry(entryId: string): FieldTask | undefined {
  return FIELD_TASKS.find((t) => t.entryId === entryId);
}

/** The field task (if any) for a catalog mission's encounter. */
export function fieldTaskForEncounter(encounterId: string): FieldTask | undefined {
  return FIELD_TASKS.find((t) => t.encounterId === encounterId);
}
