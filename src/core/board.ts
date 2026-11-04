/**
 * Pure ball-sort rules (no DOM). A board is a list of tubes; each tube lists colour indices bottom → top.
 */
export const CAPACITY = 4;

export type Tube = number[];
export type Board = Tube[];
export interface Move {
  from: number;
  to: number;
}

export const cloneBoard = (b: Board): Board => b.map((t) => t.slice());
export const top = (t: Tube): number | undefined => t[t.length - 1];

export function canMove(b: Board, from: number, to: number, cap = CAPACITY): boolean {
  if (from === to) return false;
  const src = b[from];
  const dst = b[to];
  if (!src || !dst || src.length === 0 || dst.length >= cap) return false;
  return dst.length === 0 || top(dst) === top(src);
}

/** Applies a legal move in place. Returns false (and changes nothing) if the move is illegal. */
export function applyMove(b: Board, m: Move, cap = CAPACITY): boolean {
  if (!canMove(b, m.from, m.to, cap)) return false;
  b[m.to]!.push(b[m.from]!.pop()!);
  return true;
}

/** Reverts a move that was applied with applyMove (no rule check: the reverse of a legal move may be "illegal"). */
export function undoMove(b: Board, m: Move): void {
  const ball = b[m.to]!.pop();
  if (ball !== undefined) b[m.from]!.push(ball);
}

export const isTubeComplete = (t: Tube, cap = CAPACITY): boolean => t.length === cap && t.every((c) => c === t[0]);

/** Won when every non-empty tube is full of a single colour. */
export const isSolved = (b: Board, cap = CAPACITY): boolean => b.every((t) => t.length === 0 || isTubeComplete(t, cap));

/** Stars from moves vs. par: never 0 — finishing a level always earns at least one star. */
export function starsFor(moves: number, par: number): 1 | 2 | 3 {
  if (moves <= par) return 3;
  if (moves <= par + Math.max(4, Math.ceil(par * 0.35))) return 2;
  return 1;
}
