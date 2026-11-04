import type { Rng } from '../core/rng';

export interface WiresPuzzle {
  size: number;
  /** terminals[color] = [cellA, cellB] */
  terminals: [number, number][];
  /** one known non-crossing solution, solution[color] = cells from A to B */
  solution: number[][];
}

export type WirePaths = number[][];

export function wiresParams(d: number): { size: number; pairs: number } {
  return { size: 5 + Math.round(2 * d), pairs: 3 + Math.round(3 * d) };
}

const neighbors = (size: number, cell: number): number[] => {
  const r = Math.floor(cell / size), c = cell % size;
  const out: number[] = [];
  if (r > 0) out.push(cell - size);
  if (c < size - 1) out.push(cell + 1);
  if (r < size - 1) out.push(cell + size);
  if (c > 0) out.push(cell - 1);
  return out;
};

export const adjacent = (size: number, a: number, b: number): boolean => neighbors(size, a).includes(b);

const manhattan = (size: number, a: number, b: number): number =>
  Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs((a % size) - (b % size));

function tryGenerate(rng: Rng, size: number, pairs: number): WiresPuzzle | null {
  const used = new Uint8Array(size * size);
  const solution: number[][] = [];
  const minLen = 3;
  const maxLen = Math.max(4, Math.floor((size * size * 0.8) / pairs));
  for (let color = 0; color < pairs; color++) {
    let placed: number[] | null = null;
    for (let attempt = 0; attempt < 40 && !placed; attempt++) {
      const free: number[] = [];
      for (let i = 0; i < used.length; i++) if (!used[i]) free.push(i);
      if (free.length < minLen) return null;
      const start = rng.pick(free);
      const target = rng.int(minLen, maxLen);
      const path = [start];
      const local = new Set<number>([start]);
      while (path.length < target) {
        const cur = path[path.length - 1]!;
        // Prefer cells that keep going straight half the time: makes paths that bend less trivially.
        const opts = neighbors(size, cur).filter((n) => !used[n] && !local.has(n));
        if (!opts.length) break;
        const next = rng.pick(opts);
        path.push(next);
        local.add(next);
      }
      if (path.length >= minLen && manhattan(size, path[0]!, path[path.length - 1]!) >= 2) placed = path;
    }
    if (!placed) return null;
    for (const c of placed) used[c] = 1;
    solution.push(placed);
  }
  return {
    size,
    terminals: solution.map((p) => [p[0]!, p[p.length - 1]!] as [number, number]),
    solution,
  };
}

export function generateWires(rng: Rng, d: number): WiresPuzzle {
  const { size, pairs } = wiresParams(d);
  for (let i = 0; i < 300; i++) {
    const p = tryGenerate(rng, size, pairs);
    if (p) return p;
  }
  // Fallback: fewer pairs always fit.
  for (let k = pairs - 1; k >= 1; k--) {
    for (let i = 0; i < 300; i++) {
      const p = tryGenerate(rng, size, k);
      if (p) return p;
    }
  }
  throw new Error('wires generation failed');
}

export function terminalColor(p: WiresPuzzle, cell: number): number {
  return p.terminals.findIndex(([a, b]) => a === cell || b === cell);
}

/** Validates a path for one color: connects both terminals, adjacent steps, no foreign terminals. */
export function isPathComplete(p: WiresPuzzle, color: number, path: number[] | undefined): boolean {
  if (!path || path.length < 2) return false;
  const [a, b] = p.terminals[color]!;
  const s = path[0], e = path[path.length - 1];
  if (!((s === a && e === b) || (s === b && e === a))) return false;
  const seen = new Set<number>();
  for (let i = 0; i < path.length; i++) {
    const c = path[i]!;
    if (seen.has(c)) return false;
    seen.add(c);
    if (i > 0 && !adjacent(p.size, path[i - 1]!, c)) return false;
    const tc = terminalColor(p, c);
    if (tc !== -1 && tc !== color) return false;
  }
  return true;
}

export function isWiresSolved(p: WiresPuzzle, paths: WirePaths): boolean {
  const used = new Set<number>();
  for (let color = 0; color < p.terminals.length; color++) {
    const path = paths[color];
    if (!isPathComplete(p, color, path)) return false;
    for (const c of path!) {
      if (used.has(c)) return false; // crossing
      used.add(c);
    }
  }
  return true;
}
