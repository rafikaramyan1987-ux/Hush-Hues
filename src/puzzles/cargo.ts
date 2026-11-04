import type { Rng } from '../core/rng';

export interface Crate {
  x: number;
  y: number;
  len: number;
  dir: 'h' | 'v';
}

export interface CargoPuzzle {
  size: number;
  exitRow: number;
  /** crates[0] is the oxygen cart that must reach the hatch on the right edge */
  crates: Crate[];
  minMoves: number;
}

export interface Move {
  crate: number;
  /** new position along the crate's axis */
  to: number;
}

export function cargoParams(d: number): { size: number; blockers: number; minMoves: number } {
  const size = d < 0.35 ? 5 : 6;
  return {
    size,
    blockers: size === 5 ? 3 + Math.round(3 * d) : 4 + Math.round(5 * d),
    minMoves: 2 + Math.round(5 * d),
  };
}

const axisPos = (c: Crate): number => (c.dir === 'h' ? c.x : c.y);

function occupancy(size: number, crates: readonly Crate[], skip = -1): Int8Array {
  const g = new Int8Array(size * size).fill(-1);
  crates.forEach((c, i) => {
    if (i === skip) return;
    for (let k = 0; k < c.len; k++) {
      const x = c.dir === 'h' ? c.x + k : c.x;
      const y = c.dir === 'v' ? c.y + k : c.y;
      g[y * size + x] = i;
    }
  });
  return g;
}

/** Range [min, max] of positions crate i can slide to given the others. */
export function slideRange(size: number, crates: readonly Crate[], i: number): [number, number] {
  const g = occupancy(size, crates, i);
  const c = crates[i]!;
  const free = (p: number): boolean => {
    if (p < 0 || p + c.len > size) return false;
    for (let k = 0; k < c.len; k++) {
      const x = c.dir === 'h' ? p + k : c.x;
      const y = c.dir === 'v' ? p + k : c.y;
      if (g[y * size + x] !== -1) return false;
    }
    return true;
  };
  const cur = axisPos(c);
  let lo = cur, hi = cur;
  while (free(lo - 1)) lo--;
  while (free(hi + 1)) hi++;
  return [lo, hi];
}

export function applyMove(crates: readonly Crate[], m: Move): Crate[] {
  return crates.map((c, i) => (i !== m.crate ? c : c.dir === 'h' ? { ...c, x: m.to } : { ...c, y: m.to }));
}

export const isCargoSolved = (p: { size: number; crates: readonly Crate[] }): boolean => {
  const k = p.crates[0]!;
  return k.x + k.len === p.size;
};

/**
 * BFS shortest solution (each slide of any distance = 1 move).
 * Returns null if unsolvable (or not solved within the state cap).
 * Optimised: states are small position arrays keyed as short strings, occupancy built once per state.
 */
export function solveCargo(size: number, start: readonly Crate[], cap = 40000): Move[] | null {
  const n = start.length;
  const dirH = start.map((c) => c.dir === 'h');
  const lens = start.map((c) => c.len);
  const fixed = start.map((c) => (c.dir === 'h' ? c.y : c.x));
  const pos0 = start.map(axisPos);
  const goal = size - lens[0]!;
  if (pos0[0] === goal) return [];
  const key = (p: number[]): string => String.fromCharCode(...p);
  const parent = new Map<string, { from: string; crate: number; to: number } | null>();
  const k0 = key(pos0);
  parent.set(k0, null);
  let frontier: number[][] = [pos0];
  const grid = new Uint8Array(size * size);
  const cell = (i: number, along: number): number => (dirH[i] ? fixed[i]! * size + along : along * size + fixed[i]!);
  while (frontier.length && parent.size < cap) {
    const next: number[][] = [];
    for (const pos of frontier) {
      grid.fill(0);
      for (let i = 0; i < n; i++) for (let k = 0; k < lens[i]!; k++) grid[cell(i, pos[i]! + k)] = 1;
      const pk = key(pos);
      for (let i = 0; i < n; i++) {
        const cur = pos[i]!, len = lens[i]!;
        // slide toward lower positions
        for (let p = cur - 1; p >= 0 && !grid[cell(i, p)]; p--) {
          const np = pos.slice();
          np[i] = p;
          const nk = key(np);
          if (parent.has(nk)) continue;
          parent.set(nk, { from: pk, crate: i, to: p });
          next.push(np);
        }
        // slide toward higher positions
        for (let p = cur + 1; p + len - 1 < size && !grid[cell(i, p + len - 1)]; p++) {
          const np = pos.slice();
          np[i] = p;
          const nk = key(np);
          if (parent.has(nk)) continue;
          parent.set(nk, { from: pk, crate: i, to: p });
          if (i === 0 && p === goal) {
            const moves: Move[] = [];
            let k: string | undefined = nk;
            while (k !== undefined) {
              const e = parent.get(k);
              if (!e) break;
              moves.unshift({ crate: e.crate, to: e.to });
              k = e.from;
            }
            return moves;
          }
          next.push(np);
        }
      }
    }
    frontier = next;
  }
  return null;
}

function tryLayout(rng: Rng, size: number, exitRow: number, blockers: number): Crate[] {
  const crates: Crate[] = [{ x: rng.int(0, 1), y: exitRow, len: 2, dir: 'h' }];
  let attempts = 0;
  while (crates.length < blockers + 1 && attempts++ < 200) {
    const dir: 'h' | 'v' = rng.chance(0.55) ? 'v' : 'h';
    const len = rng.chance(0.3) ? 3 : 2;
    const c: Crate =
      dir === 'h'
        ? { x: rng.int(0, size - len), y: rng.int(0, size - 1), len, dir }
        : { x: rng.int(0, size - 1), y: rng.int(0, size - len), len, dir };
    if (dir === 'h' && c.y === exitRow) continue; // would block the hatch forever
    const g = occupancy(size, crates);
    let ok = true;
    for (let k = 0; k < len && ok; k++) {
      const x = dir === 'h' ? c.x + k : c.x;
      const y = dir === 'v' ? c.y + k : c.y;
      if (g[y * size + x] !== -1) ok = false;
    }
    if (ok) crates.push(c);
  }
  return crates;
}

export function generateCargo(rng: Rng, d: number): CargoPuzzle {
  const { size, blockers, minMoves } = cargoParams(d);
  const exitRow = size === 5 ? 2 : 2;
  let bestFallback: CargoPuzzle | null = null;
  for (let attempt = 0; attempt < 250; attempt++) {
    // Relax the requirement as attempts go by so generation always ends fast.
    const want = Math.max(2, minMoves - Math.floor(attempt / 60));
    const crates = tryLayout(rng, size, exitRow, blockers);
    const sol = solveCargo(size, crates, 6000);
    if (!sol || sol.length < 2) continue;
    const p = { size, exitRow, crates, minMoves: sol.length };
    if (sol.length >= want) return p;
    if (!bestFallback || sol.length > bestFallback.minMoves) bestFallback = p;
  }
  if (bestFallback) return bestFallback;
  // Deterministic, always-solvable fallback: one blocker above the hatch row must move down first.
  const crates: Crate[] = [
    { x: 0, y: exitRow, len: 2, dir: 'h' },
    { x: size - 1, y: exitRow - 1, len: 2, dir: 'v' },
    { x: size - 1, y: 0, len: 1, dir: 'v' },
  ];
  return { size, exitRow, crates, minMoves: solveCargo(size, crates)!.length };
}

export function cargoHint(p: CargoPuzzle): Move | null {
  const sol = solveCargo(p.size, p.crates);
  return sol && sol.length ? sol[0]! : null;
}
