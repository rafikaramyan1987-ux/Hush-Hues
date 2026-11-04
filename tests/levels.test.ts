import { describe, expect, it } from 'vitest';
import { applyMove, CAPACITY, cloneBoard, isSolved, isTubeComplete } from '../src/core/board';
import { colorsFor, generateLevel, LEVEL_COUNT, MAX_COLORS } from '../src/core/levels';
import { solve } from '../src/core/solver';

const levels = Array.from({ length: 300 }, (_, i) => generateLevel(i + 1));

describe('levels', () => {
  it('has 250+ levels', () => {
    expect(LEVEL_COUNT).toBeGreaterThanOrEqual(250);
  });

  it('is deterministic', () => {
    for (const n of [1, 7, 42, 199, 300]) expect(generateLevel(n)).toEqual(levels[n - 1]);
  });

  it('gentle curve: 3-colour tutorial, +1 colour max per level, up to 12, never decreasing', () => {
    for (let n = 1; n <= 5; n++) expect(colorsFor(n)).toBe(3);
    for (let n = 2; n <= LEVEL_COUNT; n++) {
      const d = colorsFor(n) - colorsFor(n - 1);
      expect(d === 0 || d === 1).toBe(true);
    }
    expect(colorsFor(LEVEL_COUNT)).toBe(MAX_COLORS);
  });

  it('every level has 4 balls of each colour, 2 empty tubes and is not already sorted', () => {
    for (const l of levels) {
      expect(l.board.length).toBe(l.colors + 2);
      const counts = new Array(l.colors).fill(0);
      for (const t of l.board) {
        expect(t.length).toBeLessThanOrEqual(CAPACITY);
        for (const c of t) counts[c]++;
      }
      expect(counts.every((c) => c === CAPACITY)).toBe(true);
      expect(isSolved(l.board)).toBe(false);
      if (l.n > 2) expect(l.board.some((t) => isTubeComplete(t))).toBe(false);
    }
  });

  it('the reference solution solves each level with legal moves', () => {
    for (const l of levels) {
      const b = cloneBoard(l.board);
      for (const m of l.solution) expect(applyMove(b, m)).toBe(true);
      expect(isSolved(b)).toBe(true);
      expect(l.par).toBe(l.solution.length);
    }
  });

  it('the solver verifies the first 300 levels are solvable', () => {
    for (const l of levels) expect(solve(l.board), `level ${l.n}`).not.toBeNull();
  });

  it('tutorial levels are very short', () => {
    expect(levels[0]!.par).toBeLessThanOrEqual(5);
    for (let i = 0; i < 5; i++) expect(levels[i]!.par).toBeLessThanOrEqual(10);
  });

  it('never has a difficulty spike', () => {
    for (let i = 1; i < levels.length; i++) {
      const recent = Math.max(...levels.slice(Math.max(0, i - 10), i).map((l) => l.par));
      expect(levels[i]!.par, `level ${i + 1}`).toBeLessThanOrEqual(Math.ceil(recent * 1.3) + 2);
    }
  });
});
