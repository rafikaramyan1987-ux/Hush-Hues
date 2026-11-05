import data from '../data/levels.json';
import { decodeLevel, type LevelRecord } from './levelCodec';
import type { Level } from './levels';
import { LEVEL_COUNT } from './schedule';

const records = data as unknown as LevelRecord[];
const cache = new Map<number, Level>();

/** The pre-generated level n (1-based). */
export function getLevel(n: number): Level {
  const i = Math.max(1, Math.min(LEVEL_COUNT, n));
  let l = cache.get(i);
  if (!l) {
    l = decodeLevel(records[i - 1]!);
    cache.set(i, l);
  }
  return l;
}

export const levelKind = (n: number) => records[n - 1]?.k ?? 'normal';
