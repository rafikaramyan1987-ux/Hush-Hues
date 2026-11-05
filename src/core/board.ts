/**
 * Pure ball-sort rules (no DOM).
 *
 * A puzzle has static tube definitions (capacity, optional lock colour) and a mutable state:
 * balls per tube (bottom → top), and which tubes are still locked.
 * A ball is a colour index; the FROZEN bit marks a frozen ball.
 *
 * Mechanics:
 * - capacity: regular tubes hold `perColor` balls (4, or 5 for "tall" levels); helper tubes hold 2.
 * - locked tube: can't give or take balls until a tube is completed with its lock colour.
 * - frozen ball: can't be lifted; it thaws as soon as a move is made in a tube next to it (same row).
 * - hidden balls are only a display matter (revealed once on top): they never change the rules.
 */
export const FROZEN = 64;
export const HELPER_CAP = 2;

export interface TubeDef {
  cap: number;
  /** colour that unlocks this tube, or null */
  lock: number | null;
}

export interface Puzzle {
  tubes: TubeDef[];
  /** balls of each colour = height of a regular tube */
  perColor: number;
  /** tubes per row on screen; also defines which tubes are neighbours (frozen balls) */
  perRow: number;
}

export interface State {
  balls: number[][];
  locked: boolean[];
}

export interface Move {
  from: number;
  to: number;
}

export const colorOf = (b: number): number => b & (FROZEN - 1);
export const isFrozen = (b: number): boolean => (b & FROZEN) !== 0;
const top = (t: number[]): number | undefined => t[t.length - 1];

/** Tubes per row: fixed per level (not per screen), so "next to" means the same thing everywhere. */
export function perRowFor(tubeCount: number): number {
  if (tubeCount <= 5) return tubeCount;
  if (tubeCount <= 12) return Math.ceil(tubeCount / 2);
  return Math.ceil(tubeCount / 3);
}

/** Left / right neighbours of a tube in the same row. */
export function neighbours(perRow: number, count: number, i: number): number[] {
  const out: number[] = [];
  const row = Math.floor(i / perRow);
  for (const j of [i - 1, i + 1]) if (j >= 0 && j < count && Math.floor(j / perRow) === row) out.push(j);
  return out;
}

export const cloneState = (s: State): State => ({ balls: s.balls.map((t) => t.slice()), locked: s.locked.slice() });

export function isTubeComplete(p: Puzzle, t: readonly number[]): boolean {
  if (t.length !== p.perColor) return false;
  const c = colorOf(t[0]!);
  return t.every((b) => colorOf(b) === c);
}

export function canMove(p: Puzzle, s: State, from: number, to: number): boolean {
  if (from === to) return false;
  const src = s.balls[from];
  const dst = s.balls[to];
  const def = p.tubes[to];
  if (!src || !dst || !def || src.length === 0 || dst.length >= def.cap) return false;
  if (s.locked[from] || s.locked[to]) return false;
  const b = top(src)!;
  if (isFrozen(b)) return false;
  return dst.length === 0 || colorOf(top(dst)!) === colorOf(b);
}

export interface MoveEffects {
  /** tubes whose frozen balls thawed */
  thawed: number[];
  /** tubes that got unlocked */
  unlocked: number[];
  /** the destination tube became complete */
  completed: boolean;
}

/** Applies a legal move in place (and its side effects). Returns null (and changes nothing) if illegal. */
export function applyMove(p: Puzzle, s: State, m: Move): MoveEffects | null {
  if (!canMove(p, s, m.from, m.to)) return null;
  s.balls[m.to]!.push(s.balls[m.from]!.pop()!);
  const count = s.balls.length;
  const thawed: number[] = [];
  const near = new Set([...neighbours(p.perRow, count, m.from), ...neighbours(p.perRow, count, m.to)]);
  for (const t of near) {
    const tube = s.balls[t]!;
    if (tube.some(isFrozen)) {
      for (let k = 0; k < tube.length; k++) tube[k] = colorOf(tube[k]!);
      thawed.push(t);
    }
  }
  const completed = isTubeComplete(p, s.balls[m.to]!);
  const unlocked: number[] = [];
  if (completed) {
    const c = colorOf(s.balls[m.to]![0]!);
    p.tubes.forEach((def, i) => {
      if (s.locked[i] && def.lock === c) {
        s.locked[i] = false;
        unlocked.push(i);
      }
    });
  }
  return { thawed, unlocked, completed };
}

/** Won when every tube is empty or holds all the balls of one colour. */
export const isSolved = (p: Puzzle, s: State): boolean => s.balls.every((t) => t.length === 0 || isTubeComplete(p, t));

export function hasAnyMove(p: Puzzle, s: State): boolean {
  for (let a = 0; a < s.balls.length; a++) for (let b = 0; b < s.balls.length; b++) if (canMove(p, s, a, b)) return true;
  return false;
}

/** Stars from moves vs. par: never 0 — finishing a level always earns at least one star. */
export function starsFor(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= par) return 3;
  if (moves <= par + Math.max(4, Math.ceil(par * 0.35))) return 2;
  return 1;
}
