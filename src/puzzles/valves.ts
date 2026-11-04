import type { Rng } from '../core/rng';

export interface ValvesPuzzle {
  valves: number;
  maxSetting: number;
  /** weights[g][v] = how much valve v adds to gauge g per notch (0 = not connected) */
  weights: number[][];
  targets: number[];
  solution: number[];
}

export function valvesParams(d: number): { valves: number; gauges: number; maxSetting: number; maxWeight: number } {
  return {
    valves: 3 + Math.round(2 * d),
    gauges: d < 0.5 ? 2 : 3,
    maxSetting: d < 0.5 ? 3 : 4,
    maxWeight: d < 0.3 ? 1 : 2,
  };
}

export function gaugeTotals(p: ValvesPuzzle, settings: readonly number[]): number[] {
  return p.weights.map((row) => row.reduce((sum, w, v) => sum + w * (settings[v] ?? 0), 0));
}

export function isValvesSolved(p: ValvesPuzzle, settings: readonly number[]): boolean {
  const t = gaugeTotals(p, settings);
  return t.every((v, i) => v === p.targets[i]);
}

export function generateValves(rng: Rng, d: number): ValvesPuzzle {
  const { valves, gauges, maxSetting, maxWeight } = valvesParams(d);
  for (let attempt = 0; attempt < 200; attempt++) {
    const weights: number[][] = [];
    for (let g = 0; g < gauges; g++) {
      const row = new Array<number>(valves).fill(0);
      const count = rng.int(2, Math.min(valves, 3 + Math.round(d)));
      for (const v of rng.shuffle([...Array(valves).keys()]).slice(0, count)) row[v] = rng.int(1, maxWeight);
      weights.push(row);
    }
    // every valve must matter, and no two gauges identical
    const everyUsed = [...Array(valves).keys()].every((v) => weights.some((r) => r[v]! > 0));
    const distinct = new Set(weights.map((r) => r.join())).size === gauges;
    if (!everyUsed || !distinct) continue;
    const solution = [...Array(valves)].map(() => rng.int(0, maxSetting));
    const p: ValvesPuzzle = { valves, maxSetting, weights, targets: [], solution };
    p.targets = gaugeTotals(p, solution);
    if (p.targets.some((t) => t === 0)) continue; // all-zero start must not already solve a gauge
    return p;
  }
  // Fallback: simple diagonal-ish system
  const weights = [
    [1, 1, 0],
    [0, 1, 1],
  ];
  const solution = [1, 2, 1];
  const p: ValvesPuzzle = { valves: 3, maxSetting: 3, weights, targets: [], solution };
  p.targets = gaugeTotals(p, solution);
  return p;
}

/** Hint: set one wrong valve to its solution value. Returns the valve index or -1. */
export function valvesHint(p: ValvesPuzzle, settings: number[]): number {
  if (isValvesSolved(p, settings)) return -1;
  for (let v = 0; v < p.valves; v++) {
    if (settings[v] !== p.solution[v]) {
      settings[v] = p.solution[v]!;
      return v;
    }
  }
  return -1;
}
