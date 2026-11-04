import { CAPACITY, canMove, isSolved, isTubeComplete, type Board, type Move } from './board';
import { createRng } from './rng';
import { solve } from './solver';

export const LEVEL_COUNT = 300;
export const MAX_COLORS = 12;
export const EMPTY_TUBES = 2;

export interface Level {
  /** 1-based level number */
  n: number;
  colors: number;
  board: Board;
  /** move count of the reference solution — used for stars */
  par: number;
  /** reference solution (forward moves); used by the level-1 tutorial and the debug hook */
  solution: Move[];
}

/**
 * Difficulty curve: first level of each colour count. Bands get longer as the board grows,
 * and inside a band the scramble deepens slowly, so the step to one more colour is never a spike.
 */
const BANDS: readonly [firstLevel: number, colors: number][] = [
  [1, 3],
  [6, 4],
  [13, 5],
  [23, 6],
  [36, 7],
  [52, 8],
  [72, 9],
  [98, 10],
  [130, 11],
  [170, 12],
];

export function colorsFor(n: number): number {
  let c = BANDS[0]![1];
  for (const [first, colors] of BANDS) if (n >= first) c = colors;
  return c;
}

/** Intended solution length of the five tutorial levels. */
const TUTORIAL_PAR = [3, 5, 6, 7, 9];

/** Fraction of the balls that get scrambled (0..1) — rises inside each band. */
export function scrambleFor(n: number): number {
  if (n <= 5) return [0.2, 0.3, 0.4, 0.5, 0.6][n - 1]!;
  let idx = 0;
  for (let i = 0; i < BANDS.length; i++) if (n >= BANDS[i]![0]) idx = i;
  const start = BANDS[idx]![0];
  const end = idx + 1 < BANDS.length ? BANDS[idx + 1]![0] : start + 60;
  const p = Math.min(1, (n - start) / Math.max(1, end - start - 1));
  // early bands top out a little lower; from 10 colours on, boards are fully mixed at the end of a band
  return 0.5 + p * 0.5;
}

/**
 * Builds a level deterministically from its number.
 *
 * 1. Draw a scrambled target layout from the level seed (more balls scrambled as levels go up).
 * 2. Plan a path from it to a sorted board with the solver.
 * 3. Construct the level by playing that path *backwards* from the solved board: every step is a
 *    reverse move (the inverse of a legal forward move), checked one by one. So every level is
 *    solvable by construction, and the path length is the level's par.
 * Rejected draws (unsolved by the planner, already-complete tubes) simply try the next draw.
 */
export function generateLevel(n: number): Level {
  const colors = colorsFor(n);
  const rng = createRng(`hush-hues:level:${n}`);
  const frac = scrambleFor(n);
  const total = colors * CAPACITY;

  let best: Level | null = null;
  let found = 0;
  for (let attempt = 0; attempt < 80; attempt++) {
    // solved layout, tubes shuffled so the sorted colours sit in random tubes
    const flat: number[] = [];
    const order = rng.shuffle(Array.from({ length: colors }, (_, i) => i));
    for (const c of order) for (let k = 0; k < CAPACITY; k++) flat.push(c);
    const k = Math.max(2, Math.min(total, Math.round(total * frac) + (attempt >> 3)));
    const slots = rng.shuffle(Array.from({ length: total }, (_, i) => i)).slice(0, k);
    const vals = rng.shuffle(slots.map((s) => flat[s]!));
    slots.forEach((s, i) => (flat[s] = vals[i]!));
    const target: Board = [];
    for (let t = 0; t < colors; t++) target.push(flat.slice(t * CAPACITY, (t + 1) * CAPACITY));
    for (let e = 0; e < EMPTY_TUBES; e++) target.push([]);
    // the first two (tutorial) levels may keep one tube already sorted; later boards never do
    if (isSolved(target) || (n > 2 && target.some((t) => isTubeComplete(t)))) continue;

    const plan = solve(target, { weight: colors <= 6 ? 1 : 1.6, maxNodes: 60_000 });
    if (!plan || plan.length === 0) continue;

    // replay the plan to get the solved end state, then build the level with reverse moves
    const work = target.map((t) => t.slice());
    for (const m of plan) work[m.to]!.push(work[m.from]!.pop()!);
    if (!isSolved(work)) continue;
    const built = reverseScramble(work, plan);
    if (!built) continue;
    const level = { n, colors, board: built, par: plan.length, solution: plan };
    if (n > TUTORIAL_PAR.length) return level;
    // tutorial: keep the draw whose solution length is closest to the intended (tiny) length
    const want = TUTORIAL_PAR[n - 1]!;
    if (!best || Math.abs(level.par - want) < Math.abs(best.par - want)) best = level;
    if (++found >= 16 || best.par === want) return best;
  }
  if (best) return best;
  throw new Error(`could not generate level ${n}`);
}

/**
 * Applies the given forward path in reverse to a solved board. Each reverse step moves the top ball of
 * `to` back onto `from`, and is only accepted if the matching forward move (from → to) is legal afterwards.
 */
export function reverseScramble(solved: Board, path: readonly Move[]): Board | null {
  const b = solved.map((t) => t.slice());
  for (let i = path.length - 1; i >= 0; i--) {
    const { from, to } = path[i]!;
    const ball = b[to]!.pop();
    if (ball === undefined || b[from]!.length >= CAPACITY) return null;
    b[from]!.push(ball);
    if (!canMove(b, from, to)) return null;
  }
  return b;
}

const cache = new Map<number, Level>();
export function getLevel(n: number): Level {
  let l = cache.get(n);
  if (!l) {
    l = generateLevel(n);
    if (cache.size > 20) cache.clear();
    cache.set(n, l);
  }
  return l;
}
