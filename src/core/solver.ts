import { applyMove, canMove, cloneState, colorOf, isFrozen, isSolved, isTubeComplete, type Move, type Puzzle, type State } from './board';

export interface SolveResult {
  /** forward moves to a solved board, or null if none was found within the node budget */
  moves: Move[] | null;
  /** states expanded by the search: how much exploring the board needs */
  nodes: number;
  /** share of expanded states that led nowhere new (every move goes back to a known state): how "tight" the board is */
  deadEndRatio: number;
}

export interface SolveOptions {
  maxNodes?: number;
  /** 1 = plain A* (shortest solutions); >1 = faster, slightly longer solutions */
  weight?: number;
}

/**
 * Weighted A* over single-ball moves with every mechanic (capacities, locks, frozen balls).
 * The heuristic counts balls that must still move at least once, so weight 1 gives optimal paths.
 * Used to plan and measure levels when generating them, by the unit tests and by the debug hook.
 */
export function solveFull(p: Puzzle, start: State, opts: SolveOptions = {}): SolveResult {
  const maxNodes = opts.maxNodes ?? 200_000;
  const W = opts.weight ?? 1.5;

  const key = (s: State): string => {
    const free = !s.locked.some(Boolean) && !s.balls.some((t) => t.some(isFrozen));
    const parts = s.balls.map((t, i) => `${p.tubes[i]!.cap}${s.locked[i] ? 'L' : ''}:${t.join(',')}`);
    // without locks or ice, tubes of the same size are interchangeable: sort them to merge symmetric states
    return free ? parts.sort().join('|') : parts.join('|');
  };

  const heuristic = (s: State): number => {
    let h = 0;
    const bestRun = new Map<number, number>();
    const sumRun = new Map<number, number>();
    s.balls.forEach((t, i) => {
      if (t.length === 0) return;
      const c = colorOf(t[0]!);
      // balls in a helper tube (or a tube too short for a full colour) always have to move
      if (p.tubes[i]!.cap < p.perColor) {
        h += t.length;
        return;
      }
      let run = 1;
      while (run < t.length && colorOf(t[run]!) === c) run++;
      h += t.length - run;
      bestRun.set(c, Math.max(bestRun.get(c) ?? 0, run));
      sumRun.set(c, (sumRun.get(c) ?? 0) + run);
    });
    for (const [c, sum] of sumRun) h += sum - bestRun.get(c)!;
    return h;
  };

  interface Node {
    s: State;
    g: number;
    f: number;
    parent: Node | null;
    move: Move | null;
  }

  // binary min-heap on f (ties: insertion order is irrelevant for correctness, deterministic anyway)
  const heap: Node[] = [];
  const push = (n: Node) => {
    heap.push(n);
    let i = heap.length - 1;
    while (i > 0) {
      const par = (i - 1) >> 1;
      if (heap[par]!.f <= n.f) break;
      heap[i] = heap[par]!;
      i = par;
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
  push({ s: cloneState(start), g: 0, f: W * heuristic(start), parent: null, move: null });
  seen.set(key(start), 0);
  let expanded = 0;
  let deadEnds = 0;
  const n = start.balls.length;

  while (heap.length && expanded < maxNodes) {
    const node = pop();
    if ((seen.get(key(node.s)) ?? Infinity) < node.g) continue; // stale entry
    expanded++;
    const s = node.s;
    if (isSolved(p, s)) {
      const moves: Move[] = [];
      for (let x: Node | null = node; x && x.move; x = x.parent) moves.push(x.move);
      return { moves: moves.reverse(), nodes: expanded, deadEndRatio: deadEnds / expanded };
    }
    const anyFrozen = s.balls.some((t) => t.some(isFrozen));
    let children = 0;
    for (let from = 0; from < n; from++) {
      const src = s.balls[from]!;
      if (src.length === 0) continue;
      if (isTubeComplete(p, src)) continue;
      const c = colorOf(src[src.length - 1]!);
      const homogeneous = src.every((b) => colorOf(b) === c) && p.tubes[from]!.cap >= p.perColor;
      const emptyCapsTried = new Set<number>();
      for (let to = 0; to < n; to++) {
        if (!canMove(p, s, from, to)) continue;
        const dst = s.balls[to]!;
        if (dst.length === 0) {
          // moving a clean stack into an empty tube of the same size never helps
          if (homogeneous && p.tubes[to]!.cap >= p.perColor) continue;
          // equivalent empty tubes: try one of each size (unless ice makes positions matter)
          const capKey = p.tubes[to]!.cap;
          if (!anyFrozen) {
            if (emptyCapsTried.has(capKey)) continue;
            emptyCapsTried.add(capKey);
          }
        }
        const ns = cloneState(s);
        applyMove(p, ns, { from, to });
        const k = key(ns);
        const g = node.g + 1;
        const prev = seen.get(k);
        if (prev !== undefined && prev <= g) continue;
        seen.set(k, g);
        children++;
        push({ s: ns, g, f: g + W * heuristic(ns), parent: node, move: { from, to } });
      }
    }
    if (children === 0) deadEnds++;
  }
  return { moves: null, nodes: expanded, deadEndRatio: expanded ? deadEnds / expanded : 0 };
}

/** Convenience: just the moves. */
export function solve(p: Puzzle, s: State, opts?: SolveOptions): Move[] | null {
  return solveFull(p, s, opts).moves;
}
