import { createRng } from './rng';

/**
 * What each level is made of: colours, tube sizes, mechanics, and its place in the rhythm.
 * Pure and deterministic; the generator turns a config into an actual board.
 */
export type Mechanic = 'oneEmpty' | 'hidden' | 'tall' | 'lock' | 'helper' | 'frozen';
export type Kind = 'normal' | 'relax' | 'hard';

export const LEVEL_COUNT = 300;
export const MAX_COLORS = 12;

/**
 * First level of each mechanic = its 1-screen intro. Every 10th level is a hard one, so the intros
 * that would fall on a round number are placed one level later: a new idea never comes with a hard board.
 */
export const INTRO_LEVEL: Record<Mechanic, number> = {
  oneEmpty: 11,
  hidden: 21,
  tall: 35,
  lock: 51,
  helper: 71,
  frozen: 91,
};
export const MECHANICS = Object.keys(INTRO_LEVEL) as Mechanic[];

/** First level of each colour count. Bands start away from the intro levels. */
export const COLOR_BANDS: readonly [firstLevel: number, colors: number][] = [
  [1, 3],
  [6, 4],
  [14, 5],
  [26, 6],
  [41, 7],
  [57, 8],
  [77, 9],
  [97, 10],
  [127, 11],
  [167, 12],
];

export interface LevelConfig {
  n: number;
  kind: Kind;
  colors: number;
  /** balls per colour = height of regular tubes */
  perColor: number;
  empties: number;
  helpers: number;
  lock: boolean;
  /** share of non-top balls that start hidden */
  hiddenFrac: number;
  frozen: number;
  mechanics: Mechanic[];
  /** the mechanic this level introduces (shows its intro screen) */
  intro: Mechanic | null;
  /** band index and 0..1 position inside the band (drives the difficulty target) */
  band: number;
  progress: number;
}

export function kindOf(n: number): Kind {
  if (n >= 10 && n % 10 === 0) return 'hard';
  if (n % 10 === 5) return 'relax';
  return 'normal';
}

export function bandOf(n: number): { band: number; colors: number; first: number; last: number } {
  let band = 0;
  for (let i = 0; i < COLOR_BANDS.length; i++) if (n >= COLOR_BANDS[i]![0]) band = i;
  const first = COLOR_BANDS[band]![0];
  const last = band + 1 < COLOR_BANDS.length ? COLOR_BANDS[band + 1]![0] - 1 : LEVEL_COUNT;
  return { band, colors: COLOR_BANDS[band]![1], first, last };
}

export const colorsFor = (n: number): number => bandOf(n).colors;

export function introAt(n: number): Mechanic | null {
  return MECHANICS.find((m) => INTRO_LEVEL[m] === n) ?? null;
}

export function configFor(n: number): LevelConfig {
  const { band, colors: bandColors, first, last } = bandOf(n);
  const kind = kindOf(n);
  const intro = introAt(n);
  const rng = createRng(`hush-hues:config:${n}`);
  const unlocked = MECHANICS.filter((m) => n > INTRO_LEVEL[m]);
  let mechanics: Mechanic[] = [];

  if (intro) {
    mechanics = [intro];
  } else if (kind === 'relax') {
    // breathers: at most one familiar, gentle mechanic
    if (unlocked.includes('hidden') && rng.next() < 0.3) mechanics = ['hidden'];
  } else if (unlocked.length) {
    const max = n < 40 ? 1 : n < 100 ? 2 : 3;
    const want = kind === 'hard' ? max : rng.int(n < 60 ? 0 : 1, max);
    // a just-introduced mechanic comes back in the next few levels so it sinks in
    const recent = unlocked.filter((m) => n - INTRO_LEVEL[m] <= 4);
    const pool = rng.shuffle(unlocked.filter((m) => !recent.includes(m)));
    mechanics = [...recent, ...pool].slice(0, Math.max(want, recent.length));
  }

  const has = (m: Mechanic) => mechanics.includes(m);
  // intro and relax levels use one colour less, so the new idea (or the breather) stays light
  const colors = Math.max(3, kind === 'relax' || intro ? bandColors - 1 : bandColors);
  const helpers = has('helper') ? (n < 120 ? 1 : rng.int(1, 2)) : 0;
  return {
    n,
    kind,
    colors,
    perColor: has('tall') ? 5 : 4,
    // one empty tube on "oneEmpty" levels; helper tubes replace one of the two empties
    empties: has('oneEmpty') || helpers ? 1 : 2,
    helpers,
    lock: has('lock'),
    hiddenFrac: has('hidden') ? Math.min(0.75, 0.3 + (n - INTRO_LEVEL.hidden) * 0.004) : 0,
    frozen: has('frozen') ? (intro ? 1 : Math.min(3, 1 + Math.floor((n - INTRO_LEVEL.frozen) / 60))) : 0,
    mechanics,
    intro,
    band,
    progress: last > first ? (n - first) / (last - first) : 0,
  };
}
