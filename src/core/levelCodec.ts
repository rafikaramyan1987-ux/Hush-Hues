import { FROZEN, perRowFor, type Move, type TubeDef } from './board';
import type { Level } from './levels';
import type { Kind, Mechanic } from './schedule';

/**
 * Compact JSON form of a level (levels are generated ahead of time by `npm run levels`).
 * Ball: a letter per colour (a = colour 0), uppercase = frozen, "?" before it = starts hidden.
 * Tube: capacity, then "L<colour>" if locked. Moves: two base-36 digits (from, to).
 */
export interface LevelRecord {
  n: number;
  k: Kind;
  c: number;
  m: Mechanic[];
  i: Mechanic | null;
  p: number;
  t: string[];
  b: string[];
  s: string;
  nodes: number;
  de: number;
  d: number;
}

export function encodeLevel(l: Level): LevelRecord {
  return {
    n: l.n,
    k: l.kind,
    c: l.colors,
    m: l.mechanics,
    i: l.intro,
    p: l.puzzle.perColor,
    t: l.puzzle.tubes.map((t) => `${t.cap}${t.lock === null ? '' : `L${t.lock}`}`),
    b: l.start.balls.map((tube, ti) =>
      tube
        .map((ball, k) => {
          const ch = String.fromCharCode(97 + (ball & (FROZEN - 1)));
          return `${l.hidden[ti]?.[k] ? '?' : ''}${ball & FROZEN ? ch.toUpperCase() : ch}`;
        })
        .join(''),
    ),
    s: l.solution.map((m) => m.from.toString(36) + m.to.toString(36)).join(''),
    nodes: l.nodes,
    de: l.deadEndRatio,
    d: l.difficulty,
  };
}

export function decodeLevel(r: LevelRecord): Level {
  const tubes: TubeDef[] = r.t.map((s) => {
    const [cap, lock] = s.split('L');
    return { cap: Number(cap), lock: lock === undefined ? null : Number(lock) };
  });
  const balls: number[][] = [];
  const hidden: boolean[][] = [];
  for (const s of r.b) {
    const tube: number[] = [];
    const hid: boolean[] = [];
    let h = false;
    for (const ch of s) {
      if (ch === '?') {
        h = true;
        continue;
      }
      const lower = ch.toLowerCase();
      tube.push((lower.charCodeAt(0) - 97) | (ch !== lower ? FROZEN : 0));
      hid.push(h);
      h = false;
    }
    balls.push(tube);
    hidden.push(hid);
  }
  const solution: Move[] = [];
  for (let i = 0; i + 1 < r.s.length; i += 2) solution.push({ from: parseInt(r.s[i]!, 36), to: parseInt(r.s[i + 1]!, 36) });
  return {
    n: r.n,
    kind: r.k,
    colors: r.c,
    mechanics: r.m,
    intro: r.i,
    puzzle: { tubes, perColor: r.p, perRow: perRowFor(tubes.length) },
    start: { balls, locked: tubes.map((t) => t.lock !== null) },
    hidden,
    solution,
    par: solution.length,
    nodes: r.nodes,
    deadEndRatio: r.de,
    difficulty: r.d,
  };
}
