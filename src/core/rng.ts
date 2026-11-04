/** Small, fast, deterministic PRNG (mulberry32). */
export interface Rng {
  /** float in [0, 1) */
  next(): number;
  /** integer in [min, max] (inclusive) */
  int(min: number, max: number): number;
  pick<T>(arr: readonly T[]): T;
  shuffle<T>(arr: T[]): T[];
  chance(p: number): boolean;
  /** derive an independent child generator */
  fork(label: string | number): Rng;
  readonly seed: number;
}

export function hashString(s: string): number {
  // FNV-1a 32 bit
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function createRng(seed: number | string): Rng {
  const s0 = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
  let a = s0 || 0x9e3779b9;
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    seed: s0,
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)]!,
    shuffle: (arr) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j]!, arr[i]!];
      }
      return arr;
    },
    chance: (p) => next() < p,
    fork: (label) => createRng(hashString(`${s0}:${label}`)),
  };
  return rng;
}

/** Date key in UTC, e.g. "2026-11-04" — identical for every player on a given day. */
export function dailyKey(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailySeed(date: Date = new Date()): number {
  return hashString(`last-breath-daily:${dailyKey(date)}`);
}

export function randomSeed(): number {
  return (Math.random() * 4294967296) >>> 0;
}
