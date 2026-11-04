import type { Rng } from '../core/rng';

// Connection bits
export const N = 1, E = 2, S = 4, W = 8;
const DIRS = [
  { bit: N, dr: -1, dc: 0, opp: S },
  { bit: E, dr: 0, dc: 1, opp: W },
  { bit: S, dr: 1, dc: 0, opp: N },
  { bit: W, dr: 0, dc: -1, opp: E },
] as const;

export interface PipesPuzzle {
  size: number;
  /** tile shape in its solved orientation (bit mask) */
  tiles: number[];
  /** current clockwise quarter-turns applied to each tile */
  rot: number[];
  /** cells on the intended solution path */
  path: number[];
  /** row of the oxygen source (left edge) */
  sourceRow: number;
  /** row of the valve (right edge) */
  valveRow: number;
}

export function rotateMask(m: number, times: number): number {
  let r = m & 15;
  for (let i = 0; i < ((times % 4) + 4) % 4; i++) r = ((r << 1) | (r >> 3)) & 15;
  return r;
}

export const maskAt = (p: PipesPuzzle, i: number): number => rotateMask(p.tiles[i]!, p.rot[i]!);

export function pipesSize(d: number): number {
  return 4 + Math.round(2 * d);
}

function findPath(size: number, sr: number, vr: number, rng: Rng): number[] {
  const target = vr * size + size - 1;
  const seen = new Uint8Array(size * size);
  const path: number[] = [];
  const dfs = (cell: number): boolean => {
    seen[cell] = 1;
    path.push(cell);
    if (cell === target) return true;
    const r = Math.floor(cell / size), c = cell % size;
    const order = rng.shuffle([0, 1, 2, 3]);
    for (const k of order) {
      const d = DIRS[k]!;
      const nr = r + d.dr, nc = c + d.dc;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      const n = nr * size + nc;
      if (seen[n]) continue;
      if (dfs(n)) return true;
    }
    path.pop();
    return false;
  };
  dfs(sr * size);
  return path;
}

function dirBetween(size: number, a: number, b: number): number {
  const ar = Math.floor(a / size), ac = a % size, br = Math.floor(b / size), bc = b % size;
  if (br === ar - 1) return N;
  if (bc === ac + 1) return E;
  if (br === ar + 1) return S;
  if (bc === ac - 1) return W;
  throw new Error('cells not adjacent');
}

const DECOYS = [N | S, N | E, N | E | S, N | E, N | S];

export function generatePipes(rng: Rng, d: number): PipesPuzzle {
  const size = pipesSize(d);
  const sourceRow = rng.int(0, size - 1);
  const valveRow = rng.int(0, size - 1);
  const path = findPath(size, sourceRow, valveRow, rng);
  const tiles = new Array<number>(size * size).fill(0);
  for (let i = 0; i < path.length; i++) {
    const cell = path[i]!;
    let m = 0;
    m |= i === 0 ? W : dirBetween(size, cell, path[i - 1]!);
    m |= i === path.length - 1 ? E : dirBetween(size, cell, path[i + 1]!);
    tiles[cell] = m;
  }
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i] === 0) tiles[i] = rotateMask(rng.pick(DECOYS), rng.int(0, 3));
  }
  const p: PipesPuzzle = { size, tiles, rot: tiles.map(() => 0), path, sourceRow, valveRow };
  // Scramble until not already solved.
  for (let tries = 0; tries < 50; tries++) {
    p.rot = tiles.map(() => rng.int(0, 3));
    if (!isPipesSolved(p)) break;
  }
  if (isPipesSolved(p)) {
    // Force the first path tile to point away from the source.
    const c = path[0]!;
    for (let t = 1; t < 4; t++) {
      p.rot[c] = t;
      if (!(maskAt(p, c) & W)) break;
    }
  }
  return p;
}

/** Cells currently connected to the oxygen source. */
export function connectedCells(p: PipesPuzzle): Set<number> {
  const { size } = p;
  const start = p.sourceRow * size;
  const out = new Set<number>();
  if (!(maskAt(p, start) & W)) return out;
  const queue = [start];
  out.add(start);
  while (queue.length) {
    const cell = queue.shift()!;
    const r = Math.floor(cell / size), c = cell % size;
    const m = maskAt(p, cell);
    for (const d of DIRS) {
      if (!(m & d.bit)) continue;
      const nr = r + d.dr, nc = c + d.dc;
      if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
      const n = nr * size + nc;
      if (out.has(n)) continue;
      if (maskAt(p, n) & d.opp) {
        out.add(n);
        queue.push(n);
      }
    }
  }
  return out;
}

export function isPipesSolved(p: PipesPuzzle): boolean {
  const valve = p.valveRow * p.size + p.size - 1;
  return connectedCells(p).has(valve) && (maskAt(p, valve) & E) !== 0;
}

/** Rotate a tile by one clockwise quarter turn (mutates). */
export function rotateTile(p: PipesPuzzle, i: number): void {
  p.rot[i] = (p.rot[i]! + 1) % 4;
}

/** Hint: fix one wrongly oriented path tile. Returns its index, or -1. */
export function pipesHint(p: PipesPuzzle): number {
  for (const cell of p.path) {
    if (maskAt(p, cell) !== p.tiles[cell]) {
      p.rot[cell] = 0;
      return cell;
    }
  }
  return -1;
}

/** Apply the full known solution (used by tests / e2e). */
export function solvePipes(p: PipesPuzzle): void {
  for (const cell of p.path) p.rot[cell] = 0;
}
