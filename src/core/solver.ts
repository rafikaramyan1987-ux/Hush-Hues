import { CAPACITY, type Board, type Move } from './board';

/**
 * Weighted A* solver for single-ball moves. Used by the unit tests (every level must be solvable),
 * to compute each level's "par" (star thresholds) and by the debug hook of the e2e test.
 * The heuristic (balls that must still move at least once) never overestimates, so weight 1 gives optimal paths.
 * Returns the list of moves, or null if no solution was found within `maxNodes` expanded states.
 */
export function solve(start: Board, opts: { cap?: number; maxNodes?: number; weight?: number } = {}): Move[] | null {
  const cap = opts.cap ?? CAPACITY;
  const maxNodes = opts.maxNodes ?? 200_000;
  // weight 1 = plain A* (shortest solutions, fine for small boards); >1 = faster, slightly longer solutions
  const W = opts.weight ?? 2;
  const key = (b: Board): string => b.map((t) => t.join(',')).sort().join('|');

  const heuristic = (b: Board): number => {
    let h = 0;
    const bestRun = new Map<number, number>();
    const sumRun = new Map<number, number>();
    for (const t of b) {
      if (t.length === 0) continue;
      let run = 1;
      while (run < t.length && t[run] === t[0]) run++;
      h += t.length - run;
      const c = t[0]!;
      bestRun.set(c, Math.max(bestRun.get(c) ?? 0, run));
      sumRun.set(c, (sumRun.get(c) ?? 0) + run);
    }
    for (const [c, s] of sumRun) h += s - bestRun.get(c)!;
    return h;
  };

  interface Node {
    board: Board;
    g: number;
    f: number;
    parent: Node | null;
    move: Move | null;
  }

  // binary min-heap on f
  const heap: Node[] = [];
  const push = (n: Node) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p]!.f <= n.f) break;
      heap[i] = heap[p]!;
      i = p;
    }
    heap[i] = n;
  };
  const pop = (): Node => {
    const first = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        let mf = last.f;
        if (l < heap.length && heap[l]!.f < mf) {
          m = l;
          mf = heap[l]!.f;
        }
        if (r < heap.length && heap[r]!.f < mf) m = r;
        if (m === i) break;
        heap[i] = heap[m]!;
        i = m;
      }
      heap[i] = last;
    }
    return first;
  };

  const seen = new Map<string, number>();
  const h0 = heuristic(start);
  push({ board: start.map((t) => t.slice()), g: 0, f: W * h0, parent: null, move: null });
  seen.set(key(start), 0);
  let expanded = 0;

  while (heap.length && expanded < maxNodes) {
    const node = pop();
    expanded++;
    const b = node.board;
    if (heuristic(b) === 0 && b.every((t) => t.length === 0 || t.length === cap)) {
      const moves: Move[] = [];
      for (let n: Node | null = node; n && n.move; n = n.parent) moves.push(n.move);
      return moves.reverse();
    }
    let emptyTried = false;
    for (let from = 0; from < b.length; from++) {
      const src = b[from]!;
      if (src.length === 0) continue;
      const c = src[src.length - 1]!;
      const homogeneous = src.every((x) => x === c);
      if (homogeneous && src.length === cap) continue;
      emptyTried = false;
      for (let to = 0; to < b.length; to++) {
        if (to === from) continue;
        const dst = b[to]!;
        if (dst.length >= cap) continue;
        if (dst.length === 0) {
          if (homogeneous || emptyTried) continue;
          emptyTried = true;
        } else if (dst[dst.length - 1] !== c) continue;
        const nb = b.map((t) => t.slice());
        nb[to]!.push(nb[from]!.pop()!);
        const k = key(nb);
        const g = node.g + 1;
        const prev = seen.get(k);
        if (prev !== undefined && prev <= g) continue;
        seen.set(k, g);
        push({ board: nb, g, f: g + W * heuristic(nb), parent: node, move: { from, to } });
      }
    }
  }
  return null;
}
