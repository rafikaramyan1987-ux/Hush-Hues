import type { Rng } from '../core/rng';

export type CodeClue =
  | { kind: 'guess'; guess: number[]; exact: number; misplaced: number }
  | { kind: 'sum'; value: number };

export interface CodePuzzle {
  length: number;
  code: number[];
  clues: CodeClue[];
}

export function codeLength(d: number): number {
  return d < 0.45 ? 3 : 4;
}

export function feedback(code: readonly number[], guess: readonly number[]): { exact: number; misplaced: number } {
  let exact = 0, misplaced = 0;
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === code[i]) exact++;
    else if (code.includes(guess[i]!)) misplaced++;
  }
  return { exact, misplaced };
}

export function satisfies(candidate: readonly number[], clue: CodeClue): boolean {
  if (clue.kind === 'sum') return candidate.reduce((a, b) => a + b, 0) === clue.value;
  const f = feedback(candidate, clue.guess);
  return f.exact === clue.exact && f.misplaced === clue.misplaced;
}

/** All codes with distinct digits of the given length. */
export function allCodes(length: number): number[][] {
  const out: number[][] = [];
  const rec = (prefix: number[]) => {
    if (prefix.length === length) {
      out.push(prefix.slice());
      return;
    }
    for (let d = 0; d <= 9; d++) {
      if (prefix.includes(d)) continue;
      prefix.push(d);
      rec(prefix);
      prefix.pop();
    }
  };
  rec([]);
  return out;
}

const cache = new Map<number, number[][]>();
const codesOf = (len: number): number[][] => {
  let c = cache.get(len);
  if (!c) cache.set(len, (c = allCodes(len)));
  return c;
};

export function consistentCodes(length: number, clues: readonly CodeClue[]): number[][] {
  return codesOf(length).filter((c) => clues.every((cl) => satisfies(c, cl)));
}

const randomDistinct = (rng: Rng, len: number): number[] => rng.shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, len);

export function generateCode(rng: Rng, d: number): CodePuzzle {
  const length = codeLength(d);
  const code = randomDistinct(rng, length);
  const clues: CodeClue[] = [];
  if (d < 0.25) clues.push({ kind: 'sum', value: code.reduce((a, b) => a + b, 0) });
  let candidates = consistentCodes(length, clues);
  let guard = 0;
  while (candidates.length > 1 && guard++ < 40) {
    // Greedy: among a few random guesses pick the one that eliminates the most candidates.
    let best: CodeClue | null = null;
    let bestLeft = Infinity;
    for (let k = 0; k < 10; k++) {
      const guess = randomDistinct(rng, length);
      const f = feedback(code, guess);
      if (f.exact === length) continue;
      const clue: CodeClue = { kind: 'guess', guess, ...f };
      const left = candidates.filter((c) => satisfies(c, clue)).length;
      if (left < bestLeft) {
        bestLeft = left;
        best = clue;
      }
    }
    if (best && bestLeft < candidates.length) {
      clues.push(best);
      candidates = candidates.filter((c) => satisfies(c, best!));
    }
  }
  // Guaranteed termination: guessing a wrong candidate always eliminates at least that candidate.
  while (candidates.length > 1) {
    const other = candidates.find((c) => !c.every((v, i) => v === code[i]))!;
    const clue: CodeClue = { kind: 'guess', guess: other.slice(), ...feedback(code, other) };
    clues.push(clue);
    candidates = candidates.filter((c) => satisfies(c, clue));
  }
  // Minimize: drop clues that are not needed for uniqueness.
  const order = rng.shuffle(clues.map((_, i) => i));
  let kept = clues.slice();
  for (const idx of order) {
    const clue = clues[idx]!;
    const trial = kept.filter((c) => c !== clue);
    if (trial.length && consistentCodes(length, trial).length === 1) kept = trial;
  }
  return { length, code, clues: kept };
}

export function isCodeCorrect(p: CodePuzzle, entry: readonly number[]): boolean {
  return entry.length === p.length && entry.every((v, i) => v === p.code[i]);
}
