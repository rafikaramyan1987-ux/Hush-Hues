import { applyMove, canMove, cloneState, FROZEN, HELPER_CAP, isSolved, perRowFor, type Move, type Puzzle, type State, type TubeDef } from './board';
import { createRng, type Rng } from './rng';
import { bandOf, configFor, INTRO_LEVEL, LEVEL_COUNT, type Kind, type LevelConfig, type Mechanic } from './schedule';
import { solveFull } from './solver';

export { LEVEL_COUNT };

export interface Level {
  n: number;
  kind: Kind;
  colors: number;
  mechanics: Mechanic[];
  intro: Mechanic | null;
  puzzle: Puzzle;
  /** starting state (ball values may carry the FROZEN bit) */
  start: State;
  /** hidden[t][k]: ball k of tube t starts as "?" (revealed once it is on top) */
  hidden: boolean[][];
  /** moves of the reference solution (par = its length) */
  solution: Move[];
  par: number;
  /** solver measures used for the difficulty score */
  nodes: number;
  deadEndRatio: number;
  difficulty: number;
}

/** Intended solution length of the five tutorial levels. */
const TUTORIAL_PAR = [3, 5, 6, 7, 9];

/**
 * Difficulty score from the solver's search on the level:
 * log2 of the states it had to explore, plus the share of dead ends (states where every move only
 * leads back), plus a little for information the player can't see yet (hidden balls).
 */
export function difficultyScore(nodes: number, deadEndRatio: number, hiddenCount: number): number {
  return Math.round((Math.log2(Math.max(1, nodes)) + 8 * deadEndRatio + 0.15 * hiddenCount) * 10) / 10;
}

/** Normal levels may rise at most this much above the previous normal level of their band (no spikes). */
export const MAX_STEP = 2.5;
/** Hard levels stay within this much of the target curve. */
export const HARD_BONUS = 3.5;

/** Target difficulty of a normal level: rises steadily through each colour band and from band to band. */
export function targetDifficulty(cfg: LevelConfig): number {
  const lo = 3.5 + 0.55 * cfg.band;
  const hi = lo + 2 + 0.3 * cfg.band;
  return lo + (hi - lo) * cfg.progress;
}

/** Fraction of balls scrambled in the candidate draws, rising with the level. */
function scrambleRange(cfg: LevelConfig): [number, number] {
  if (cfg.n <= 5) return [0.15, 0.6];
  const base = 0.45 + 0.35 * cfg.progress;
  return [Math.max(0.3, base - 0.2), Math.min(1, base + 0.35)];
}

export interface Candidate {
  /** mechanics of the config the board was drawn for */
  mechanics: Mechanic[];
  puzzle: Puzzle;
  start: State;
  hidden: boolean[][];
  solution: Move[];
  nodes: number;
  deadEndRatio: number;
  difficulty: number;
}

/** One random board for the config, verified solvable; null when the draw is rejected. */
export function drawCandidate(cfg: LevelConfig, rng: Rng, frac: number, depth = cfg.perColor): Candidate | null {
  const { colors, perColor } = cfg;
  const total = colors * perColor;

  // 1. scramble a sorted layout (more balls swapped = harder)
  const flat: number[] = [];
  for (const c of rng.shuffle(Array.from({ length: colors }, (_, i) => i))) for (let k = 0; k < perColor; k++) flat.push(c);
  // only the top `depth` balls of each tube take part (tight boards need their bottoms calm to be solvable)
  const pool = Array.from({ length: total }, (_, i) => i).filter((i) => i % perColor >= perColor - depth);
  const k = Math.max(2, Math.min(pool.length, Math.round(pool.length * frac)));
  // at least one slot in every tube (so no tube starts sorted), then random others
  const chosen = new Set<number>(cfg.n <= 2 ? [] : Array.from({ length: colors }, (_, t) => t * perColor + rng.int(perColor - depth, perColor - 1)));
  for (const i of rng.shuffle(pool)) {
    if (chosen.size >= Math.max(k, cfg.n <= 2 ? 2 : colors)) break;
    chosen.add(i);
  }
  const slots = [...chosen];
  const vals = rng.shuffle(slots.map((s) => flat[s]!));
  slots.forEach((s, i) => (flat[s] = vals[i]!));
  const main: number[][] = [];
  for (let t = 0; t < colors; t++) main.push(flat.slice(t * perColor, (t + 1) * perColor));
  if (main.some((t) => t.every((c) => c === t[0])) && cfg.n > 2) return null;

  // 2. tubes: the coloured ones, then empties and helper tubes
  const tubes: TubeDef[] = main.map(() => ({ cap: perColor, lock: null }));
  const balls = main.map((t) => t.slice());
  for (let e = 0; e < cfg.empties; e++) {
    tubes.push({ cap: perColor, lock: null });
    balls.push([]);
  }
  for (let e = 0; e < cfg.helpers; e++) {
    tubes.push({ cap: HELPER_CAP, lock: null });
    balls.push([]);
  }
  const locked = tubes.map(() => false);

  // 3. locked tube: a coloured tube that opens when a colour it does not contain is completed
  if (cfg.lock) {
    const t = rng.int(0, colors - 1);
    const absent = Array.from({ length: colors }, (_, c) => c).filter((c) => !balls[t]!.includes(c));
    if (!absent.length) return null;
    tubes[t] = { cap: perColor, lock: rng.pick(absent) };
    locked[t] = true;
  }

  // 4. frozen balls (never in the locked tube)
  const lockedIdx = locked.indexOf(true);
  for (let f = 0; f < cfg.frozen; f++) {
    const t = rng.int(0, colors - 1);
    if (t === lockedIdx) continue;
    const pos = rng.int(0, perColor - 1);
    balls[t]![pos]! |= FROZEN;
  }

  // 5. hidden balls: some of the non-top balls show "?" until they reach the top
  const hidden = balls.map((t) => t.map((_, i) => i < t.length - 1 && cfg.hiddenFrac > 0 && rng.next() < cfg.hiddenFrac));

  const puzzle: Puzzle = { tubes, perColor, perRow: perRowFor(tubes.length) };
  const start: State = { balls, locked };
  if (isSolved(puzzle, start)) return null;

  // 6. plan a path to a sorted board, then rebuild the layout from the sorted board with reverse moves
  const res = solveFull(puzzle, start, { weight: 1.5, maxNodes: 40_000 });
  if (!res.moves || res.moves.length === 0) return null;
  const end = cloneState(start);
  for (const m of res.moves) if (!applyMove(puzzle, end, m)) return null;
  if (!isSolved(puzzle, end)) return null;
  const rebuilt = reverseScramble(puzzle, end.balls, res.moves);
  if (!rebuilt || rebuilt.some((t, i) => t.join() !== start.balls[i]!.map((b) => b & (FROZEN - 1)).join())) return null;

  const hiddenCount = hidden.reduce((a, t) => a + t.filter(Boolean).length, 0);
  return {
    mechanics: cfg.mechanics,
    puzzle,
    start,
    hidden,
    solution: res.moves,
    nodes: res.nodes,
    deadEndRatio: Math.round(res.deadEndRatio * 1000) / 1000,
    difficulty: difficultyScore(res.nodes, res.deadEndRatio, hiddenCount),
  };
}

/**
 * Plays a forward path backwards from a sorted board. Each reverse step moves the top ball of `to`
 * back onto `from` and is only accepted if the matching forward move is legal (by colour and capacity).
 * Returns the ball layout (colours only) or null.
 */
export function reverseScramble(p: Puzzle, solved: number[][], path: readonly Move[]): number[][] | null {
  const plain: Puzzle = { ...p, tubes: p.tubes.map((t) => ({ cap: t.cap, lock: null })) };
  const s: State = { balls: solved.map((t) => t.map((b) => b & (FROZEN - 1))), locked: solved.map(() => false) };
  for (let i = path.length - 1; i >= 0; i--) {
    const { from, to } = path[i]!;
    const ball = s.balls[to]!.pop();
    if (ball === undefined || s.balls[from]!.length >= p.tubes[from]!.cap) return null;
    s.balls[from]!.push(ball);
    if (!canMove(plain, s, from, to)) return null;
  }
  return s.balls;
}

function drawCandidates(cfg: LevelConfig, rng: Rng, wanted: number, boost = 0): Candidate[] {
  const [lo, hi] = scrambleRange(cfg);
  const cands: Candidate[] = [];
  // one empty tube and nothing else to park balls in: only boards with calm bottoms are solvable
  const tight = cfg.empties + cfg.helpers <= 1;
  for (let attempt = 0; attempt < 40 * wanted && cands.length < wanted; attempt++) {
    // tight configs reject many full scrambles: ease off as attempts fail
    const ease = Math.max(0.5, 1 - (attempt - cands.length * 6) / 120);
    const frac = (lo + (hi - lo) * (cands.length / Math.max(1, wanted - 1)) + boost) * Math.min(1, ease);
    const depth = cfg.n <= 5 ? cfg.perColor : tight ? rng.int(2, 3) : rng.int(cfg.perColor - 1, cfg.perColor);
    const c = drawCandidate(cfg, rng, Math.min(1, frac), depth);
    if (c) cands.push(c);
  }
  return cands;
}

const toLevel = (cfg: LevelConfig, c: Candidate): Level => ({
  n: cfg.n,
  kind: cfg.kind,
  colors: cfg.colors,
  mechanics: c.mechanics,
  intro: cfg.intro,
  puzzle: c.puzzle,
  start: c.start,
  hidden: c.hidden,
  solution: c.solution,
  par: c.solution.length,
  nodes: c.nodes,
  deadEndRatio: c.deadEndRatio,
  difficulty: c.difficulty,
});

/** Normal levels that follow the steady curve (tutorial and intro levels are deliberately gentle). */
export const isCurveLevel = (l: { n: number; kind: Kind; intro: Mechanic | null }): boolean =>
  l.kind === 'normal' && !l.intro && l.n > TUTORIAL_PAR.length;

/** Candidate boards drawn for one level. Depends only on the level's seed and config, never on other levels. */
function poolFor(cfg: LevelConfig): Candidate[] {
  const rng = createRng(`hush-hues:level:${cfg.n}`);
  if (cfg.n <= TUTORIAL_PAR.length) return drawCandidates(cfg, rng, 16);
  if (cfg.kind === 'relax' || cfg.intro) return drawCandidates(cfg, rng, 8);
  // wide pools (normal scramble, more scrambled, calmer) so the selection can always follow the curve
  return [...drawCandidates(cfg, rng, cfg.kind === 'hard' ? 10 : 8), ...drawCandidates(cfg, rng, 5, 0.25), ...drawCandidates(cfg, rng, 5, -0.2)];
}

const easiest = (c: Candidate[]) => c.reduce((a, b) => (b.difficulty < a.difficulty ? b : a));
const hardest = (c: Candidate[]) => c.reduce((a, b) => (b.difficulty > a.difficulty ? b : a));

/** A board may be used for level n only if all its mechanics were introduced before n. */
const allowedAt = (c: Candidate, n: number): boolean => c.mechanics.every((m) => INTRO_LEVEL[m] < n);

/**
 * Picks one board per level of a colour band.
 * - Hard levels take the hardest board of their own pool within HARD_BONUS of the curve; relax and intro levels the easiest of theirs.
 * - Normal levels share the boards drawn for all normal levels of the band (same colours), so the curve
 *   is not at the mercy of one level's mix of mechanics. Dynamic programming over those boards sorted by
 *   difficulty picks a strictly increasing subsequence (no board used twice, never easier than the previous
 *   normal level, never more than MAX_STEP harder), closest to the target curve, using only boards whose
 *   mechanics are already introduced, and keeping each level just before a hard one below it (and just
 *   before a relax one above it).
 */
function chooseBand(cfgs: LevelConfig[], pools: Candidate[][]): Candidate[] {
  const picks: Candidate[] = new Array(cfgs.length);
  const curve: number[] = [];
  cfgs.forEach((cfg, i) => {
    if (cfg.n <= TUTORIAL_PAR.length) {
      const want = TUTORIAL_PAR[cfg.n - 1]!;
      picks[i] = pools[i]!.reduce((a, b) => (Math.abs(b.solution.length - want) < Math.abs(a.solution.length - want) ? b : a));
    } else if (cfg.kind === 'hard') {
      // clearly harder than the curve, but capped: a challenge, not a wall
      const capped = pools[i]!.filter((c) => c.difficulty <= targetDifficulty(cfg) + HARD_BONUS);
      picks[i] = capped.length ? hardest(capped) : easiest(pools[i]!);
    } else if (cfg.kind === 'relax' || cfg.intro) picks[i] = easiest(pools[i]!);
    else curve.push(i);
  });
  if (!curve.length) return picks;

  // all boards drawn for the band's normal levels, easiest first (ties: shorter solution first)
  const shared = curve.flatMap((i) => pools[i]!).sort((a, b) => a.difficulty - b.difficulty || a.solution.length - b.solution.length);
  const BAD = 1000; // a broken rule costs far more than any distance to the target
  const local = (i: number, c: Candidate): number => {
    const cfg = cfgs[i]!;
    if (!allowedAt(c, cfg.n)) return Infinity;
    let cost = Math.abs(c.difficulty - targetDifficulty(cfg));
    const next = cfgs[i + 1];
    if (next && next.kind === 'hard' && c.difficulty >= picks[i + 1]!.difficulty) cost += BAD;
    if (next && next.kind === 'relax' && next.n > TUTORIAL_PAR.length && c.difficulty <= picks[i + 1]!.difficulty) cost += BAD;
    return cost;
  };

  // best[k][j]: lowest cost for curve levels 0..k with shared[j] used for level curve[k]
  const N = shared.length;
  const best: Float64Array[] = [];
  const from: Int32Array[] = [];
  curve.forEach((i, k) => {
    const b = new Float64Array(N).fill(Infinity);
    const f = new Int32Array(N).fill(-1);
    for (let j = 0; j < N; j++) {
      const c = shared[j]!;
      const lc = local(i, c);
      if (lc === Infinity) continue;
      if (k === 0) {
        b[j] = lc;
        continue;
      }
      const prev = best[k - 1]!;
      for (let pj = 0; pj < j; pj++) {
        if (prev[pj] === Infinity) continue;
        const d = c.difficulty - shared[pj]!.difficulty;
        const v = prev[pj]! + (d > MAX_STEP ? BAD : 0) + lc;
        if (v < b[j]!) {
          b[j] = v;
          f[j] = pj;
        }
      }
    }
    best.push(b);
    from.push(f);
  });
  const last = best[curve.length - 1]!;
  let j = 0;
  for (let x = 1; x < N; x++) if (last[x]! < last[j]!) j = x;
  if (last[j] === Infinity) throw new Error(`no board sequence for band starting at level ${cfgs[0]!.n}`);
  for (let k = curve.length - 1; k >= 0; k--) {
    picks[curve[k]!] = shared[j]!;
    j = from[k]![j]!;
  }
  return picks;
}

/** Candidate pools for levels 1..count (the slow part: every board is solved and measured). */
export function generatePools(count: number, onLevel?: (n: number) => void): Candidate[][] {
  const pools: Candidate[][] = [];
  for (let n = 1; n <= count; n++) {
    const pool = poolFor(configFor(n));
    if (!pool.length) throw new Error(`could not generate level ${n}`);
    pools.push(pool);
    onLevel?.(n);
  }
  return pools;
}

/** Chooses the boards of levels 1..pools.length, band by band (see chooseBand). */
export function selectLevels(pools: Candidate[][]): Level[] {
  const out: Level[] = [];
  let n = 1;
  while (n <= pools.length) {
    const last = Math.min(bandOf(n).last, pools.length);
    const cfgs: LevelConfig[] = [];
    for (let m = n; m <= last; m++) cfgs.push(configFor(m));
    chooseBand(cfgs, pools.slice(n - 1, last)).forEach((c, i) => out.push(toLevel(cfgs[i]!, c)));
    n = last + 1;
  }
  return out;
}

/**
 * Builds levels 1..count deterministically: every board comes from a level's own seed, and the choice
 * among boards only looks at their colour band.
 */
export function generateLevels(count: number): Level[] {
  return selectLevels(generatePools(count));
}
