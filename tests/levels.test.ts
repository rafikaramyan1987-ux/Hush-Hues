import { describe, expect, it } from 'vitest';
import data from '../src/data/levels.json';
import { applyMove, cloneState, colorOf, isSolved, isTubeComplete } from '../src/core/board';
import { decodeLevel, encodeLevel, type LevelRecord } from '../src/core/levelCodec';
import { generateLevels, isCurveLevel, MAX_STEP, type Level } from '../src/core/levels';
import { bandOf, colorsFor, INTRO_LEVEL, kindOf, LEVEL_COUNT, MAX_COLORS, MECHANICS } from '../src/core/schedule';
import { solveFull } from '../src/core/solver';

const records = data as unknown as LevelRecord[];
const levels: Level[] = records.map(decodeLevel);

describe('level data', () => {
  it('has all 300 levels (250+)', () => {
    expect(levels.length).toBe(LEVEL_COUNT);
    expect(LEVEL_COUNT).toBeGreaterThanOrEqual(250);
    levels.forEach((l, i) => expect(l.n).toBe(i + 1));
  });

  it('is exactly what the seeded generator produces (checked on the first 40 levels)', () => {
    const fresh = generateLevels(40);
    fresh.forEach((l, i) => expect(encodeLevel(l), `level ${l.n}`).toEqual(records[i]));
  }, 120_000);

  it('every level has all the balls of each colour and is not already sorted', () => {
    for (const l of levels) {
      const counts = new Array(l.colors).fill(0);
      l.start.balls.forEach((t, i) => {
        expect(t.length).toBeLessThanOrEqual(l.puzzle.tubes[i]!.cap);
        for (const b of t) counts[colorOf(b)]++;
      });
      expect(counts.every((c) => c === l.puzzle.perColor), `level ${l.n}`).toBe(true);
      expect(isSolved(l.puzzle, l.start)).toBe(false);
      if (l.n > 2) expect(l.start.balls.some((t) => isTubeComplete(l.puzzle, t)), `level ${l.n}`).toBe(false);
    }
  });

  it('the reference solution solves every level with legal moves (all mechanics)', () => {
    for (const l of levels) {
      const s = cloneState(l.start);
      for (const m of l.solution) expect(applyMove(l.puzzle, s, m), `level ${l.n}`).not.toBeNull();
      expect(isSolved(l.puzzle, s), `level ${l.n}`).toBe(true);
    }
  });

  it('the solver independently finds a solution for each of the first 300 levels', () => {
    for (const l of levels.slice(0, 300)) {
      expect(solveFull(l.puzzle, l.start, { weight: 2, maxNodes: 300_000 }).moves, `level ${l.n}`).not.toBeNull();
    }
  }, 300_000);
});

describe('difficulty curve and rhythm', () => {
  it('prints the difficulty table for levels 1-150', () => {
    const rows = levels.slice(0, 150).map((l) =>
      [
        String(l.n).padStart(3),
        l.kind.padEnd(6),
        String(l.colors).padStart(2),
        String(l.puzzle.tubes.filter((t, i) => t.cap === l.puzzle.perColor && l.start.balls[i]!.length === 0).length).padStart(5),
        String(l.puzzle.perColor).padStart(3),
        String(l.par).padStart(3),
        String(l.nodes).padStart(6),
        l.deadEndRatio.toFixed(2).padStart(5),
        l.difficulty.toFixed(1).padStart(5),
        (l.intro ? `NEW ${l.intro} ` : '') + l.mechanics.filter((m) => m !== l.intro).join(','),
      ].join(' | '),
    );
    console.log(['  n | kind   | col | empty | cap | par |  nodes | dead |  diff | mechanics', ...rows].join('\n'));
  });

  it('colours: 3-colour tutorial, at most +1 per band, up to 12, never decreasing between bands', () => {
    for (let n = 1; n <= 5; n++) expect(colorsFor(n)).toBe(3);
    for (let n = 2; n <= LEVEL_COUNT; n++) expect([0, 1]).toContain(colorsFor(n) - colorsFor(n - 1));
    expect(colorsFor(LEVEL_COUNT)).toBe(MAX_COLORS);
  });

  it('levels 1-10 are basics; each mechanic starts at its intro level, never on a hard level', () => {
    for (const l of levels.slice(0, 10)) expect(l.mechanics).toEqual([]);
    for (const m of MECHANICS) {
      const first = levels.find((l) => l.mechanics.includes(m))!;
      expect(first.n, m).toBe(INTRO_LEVEL[m]);
      expect(first.intro).toBe(m);
      expect(first.kind).not.toBe('hard');
    }
    expect(INTRO_LEVEL.oneEmpty).toBeGreaterThanOrEqual(11);
    expect(INTRO_LEVEL.hidden).toBeGreaterThanOrEqual(20);
    expect(INTRO_LEVEL.tall).toBeGreaterThanOrEqual(35);
    expect(INTRO_LEVEL.lock).toBeGreaterThanOrEqual(50);
    expect(INTRO_LEVEL.helper).toBeGreaterThanOrEqual(70);
    expect(INTRO_LEVEL.frozen).toBeGreaterThanOrEqual(90);
    // after their intro, mechanics are mixed into later levels
    for (const m of MECHANICS) expect(levels.filter((l) => l.mechanics.includes(m)).length, m).toBeGreaterThan(15);
  });

  it('rhythm: every 5th level is a breather, every 10th is hard, never two hard levels in a row', () => {
    for (const l of levels) {
      expect(l.kind).toBe(kindOf(l.n));
      if (l.n % 10 === 5) expect(l.kind).toBe('relax');
      if (l.n >= 10 && l.n % 10 === 0) expect(l.kind).toBe('hard');
    }
    for (let i = 1; i < levels.length; i++) expect(levels[i]!.kind === 'hard' && levels[i - 1]!.kind === 'hard').toBe(false);
    for (let i = 5; i < levels.length; i++) {
      const l = levels[i]!;
      const prev = levels[i - 1]!;
      if (l.kind === 'relax') expect(l.difficulty, `relax level ${l.n}`).toBeLessThan(prev.difficulty);
      if (l.kind === 'hard') expect(l.difficulty, `hard level ${l.n}`).toBeGreaterThan(prev.difficulty);
    }
  });

  it('normal levels get harder smoothly inside each band (never easier, no spike)', () => {
    let prev: Level | null = null;
    let violations = 0;
    for (const l of levels) {
      if (!isCurveLevel(l)) continue;
      if (prev && bandOf(prev.n).band === bandOf(l.n).band) {
        if (l.difficulty < prev.difficulty) violations++;
        expect(l.difficulty - prev.difficulty, `level ${l.n}`).toBeLessThanOrEqual(MAX_STEP + 1e-9);
      }
      prev = l;
    }
    expect(violations).toBe(0);
  });

  it('tutorial levels are very short', () => {
    expect(levels[0]!.par).toBeLessThanOrEqual(5);
    for (let i = 0; i < 5; i++) expect(levels[i]!.par).toBeLessThanOrEqual(10);
  });
});
