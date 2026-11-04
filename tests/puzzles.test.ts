import { describe, it, expect } from 'vitest';
import { createRng } from '../src/core/rng';
import { difficulty } from '../src/core/balance';
import * as pipes from '../src/puzzles/pipes';
import * as wires from '../src/puzzles/wires';
import * as code from '../src/puzzles/code';
import * as cargo from '../src/puzzles/cargo';
import * as valves from '../src/puzzles/valves';

const SEEDS = 150;
const ROOMS = [0, 3, 6, 9];

describe('pipes generator', () => {
  it('is always solvable and never starts solved', () => {
    for (let s = 0; s < SEEDS; s++) {
      for (const room of ROOMS) {
        const p = pipes.generatePipes(createRng(s * 31 + room), difficulty(room));
        expect(pipes.isPipesSolved(p)).toBe(false);
        pipes.solvePipes(p);
        expect(pipes.isPipesSolved(p)).toBe(true);
      }
    }
  });
  it('hints converge to a solution', () => {
    for (let s = 0; s < 50; s++) {
      const p = pipes.generatePipes(createRng(s), 1);
      let guard = 0;
      while (!pipes.isPipesSolved(p) && guard++ < 100) expect(pipes.pipesHint(p)).toBeGreaterThanOrEqual(0);
      expect(pipes.isPipesSolved(p)).toBe(true);
    }
  });
  it('rotateMask cycles', () => {
    expect(pipes.rotateMask(pipes.N, 1)).toBe(pipes.E);
    expect(pipes.rotateMask(pipes.W, 1)).toBe(pipes.N);
    expect(pipes.rotateMask(pipes.N | pipes.E, 4)).toBe(pipes.N | pipes.E);
  });
  it('is deterministic per seed', () => {
    expect(pipes.generatePipes(createRng(42), 0.5)).toEqual(pipes.generatePipes(createRng(42), 0.5));
  });
});

describe('wires generator', () => {
  it('stored solution is valid and non-crossing', () => {
    for (let s = 0; s < SEEDS; s++) {
      for (const room of ROOMS) {
        const p = wires.generateWires(createRng(s * 17 + room), difficulty(room));
        expect(p.terminals.length).toBeGreaterThanOrEqual(1);
        expect(wires.isWiresSolved(p, p.solution)).toBe(true);
        expect(wires.isWiresSolved(p, [])).toBe(false);
      }
    }
  });
  it('rejects crossing paths', () => {
    const p = wires.generateWires(createRng(5), 0);
    const bad = p.solution.map((x) => x.slice());
    bad[1] = [...bad[0]!]; // reuse another color's cells
    expect(wires.isWiresSolved(p, bad)).toBe(false);
  });
});

describe('code lock generator', () => {
  it('clues always identify exactly one code: the answer', () => {
    for (let s = 0; s < SEEDS; s++) {
      for (const room of ROOMS) {
        const p = code.generateCode(createRng(s * 7 + room), difficulty(room));
        const c = code.consistentCodes(p.length, p.clues);
        expect(c).toHaveLength(1);
        expect(c[0]).toEqual(p.code);
        expect(code.isCodeCorrect(p, p.code)).toBe(true);
        expect(p.clues.length).toBeLessThanOrEqual(8);
      }
    }
  });
  it('feedback counts', () => {
    expect(code.feedback([1, 2, 3], [1, 3, 9])).toEqual({ exact: 1, misplaced: 1 });
    expect(code.feedback([1, 2, 3], [4, 5, 6])).toEqual({ exact: 0, misplaced: 0 });
  });
  it('3 digits early, 4 digits late', () => {
    expect(code.codeLength(difficulty(0))).toBe(3);
    expect(code.codeLength(difficulty(9))).toBe(4);
  });
});

describe('cargo generator', () => {
  it('is always solvable and not already solved', () => {
    for (let s = 0; s < 60; s++) {
      for (const room of ROOMS) {
        const p = cargo.generateCargo(createRng(s * 13 + room), difficulty(room));
        expect(cargo.isCargoSolved(p)).toBe(false);
        const sol = cargo.solveCargo(p.size, p.crates);
        expect(sol).not.toBeNull();
        let cs = p.crates;
        for (const m of sol!) {
          const [lo, hi] = cargo.slideRange(p.size, cs, m.crate);
          expect(m.to).toBeGreaterThanOrEqual(lo);
          expect(m.to).toBeLessThanOrEqual(hi);
          cs = cargo.applyMove(cs, m);
        }
        expect(cargo.isCargoSolved({ size: p.size, crates: cs })).toBe(true);
      }
    }
  });
  it('later rooms need at least as many moves on average', () => {
    const avg = (room: number) => {
      let t = 0;
      for (let s = 0; s < 30; s++) t += cargo.generateCargo(createRng(1000 + s), difficulty(room)).minMoves;
      return t / 30;
    };
    expect(avg(9)).toBeGreaterThanOrEqual(avg(0));
  });
});

describe('valves generator', () => {
  it('is always solvable and not solved at start', () => {
    for (let s = 0; s < SEEDS; s++) {
      for (const room of ROOMS) {
        const p = valves.generateValves(createRng(s * 3 + room), difficulty(room));
        const zero = new Array(p.valves).fill(0);
        expect(valves.isValvesSolved(p, zero)).toBe(false);
        expect(valves.isValvesSolved(p, p.solution)).toBe(true);
        expect(p.solution.every((v) => v >= 0 && v <= p.maxSetting)).toBe(true);
      }
    }
  });
  it('hints reach a solution', () => {
    const p = valves.generateValves(createRng(9), 1);
    const st = new Array(p.valves).fill(0);
    let guard = 0;
    while (!valves.isValvesSolved(p, st) && guard++ < 10) valves.valvesHint(p, st);
    expect(valves.isValvesSolved(p, st)).toBe(true);
  });
});
