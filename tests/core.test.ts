import { describe, it, expect } from 'vitest';
import { createRng, dailyKey, dailySeed, hashString } from '../src/core/rng';
import * as B from '../src/core/balance';
import { buyUpgrade, emptyUpgrades, upgradeCost, UPGRADES } from '../src/core/upgrades';
import { defaultSave, load, recordRun, sanitize, save, SAVE_KEY, type KV } from '../src/core/save';
import { createRunPlan, meteorDash, roomOrder } from '../src/core/run';
import { PUZZLE_TYPES } from '../src/puzzles/types';

describe('difficulty curve', () => {
  it('starts at 0, ends at 1, never decreases', () => {
    expect(B.difficulty(0)).toBe(0);
    expect(B.difficulty(B.ROOM_COUNT - 1)).toBe(1);
    for (let r = 1; r < B.ROOM_COUNT; r++) expect(B.difficulty(r)).toBeGreaterThanOrEqual(B.difficulty(r - 1));
  });
  it('par time is 15–40 s without upgrades', () => {
    const up = emptyUpgrades();
    expect(B.parTime(0, up)).toBe(15);
    expect(B.parTime(9, up)).toBe(40);
  });
});

describe('oxygen & upgrades math', () => {
  const up = emptyUpgrades();
  it('tank and drain upgrades', () => {
    expect(B.maxOxygen(up)).toBe(100);
    expect(B.maxOxygen({ ...up, tank: 5 })).toBe(175);
    expect(B.drainPerSecond(0, up)).toBeCloseTo(1);
    expect(B.drainPerSecond(0, { ...up, drain: 5 })).toBeCloseTo(0.65);
    expect(B.drainPerSecond(9, up)).toBeGreaterThan(B.drainPerSecond(0, up));
  });
  it('tools add par time, hints add hints', () => {
    expect(B.parTime(0, { ...up, tools: 2 })).toBe(21);
    expect(B.hintsPerRun({ ...up, hints: 3 })).toBe(4);
  });
  it('fast solves give more', () => {
    const fast = B.solveReward(4, up, 5);
    const slow = B.solveReward(4, up, 999);
    expect(fast.fast).toBe(true);
    expect(fast.oxygen).toBeGreaterThan(slow.oxygen);
    expect(fast.parts).toBeGreaterThan(slow.parts);
  });
  it('skip is expensive, addOxygen clamps', () => {
    expect(B.skipCost(0)).toBeGreaterThanOrEqual(30);
    expect(B.addOxygen(90, 50, 100)).toBe(100);
    expect(B.addOxygen(5, -50, 100)).toBe(0);
  });
  it('rewarded ad grants 20 real seconds', () => {
    expect(B.secondsToOxygen(20, 0, up)).toBeCloseTo(20);
  });
  it('upgrade costs rise and cap', () => {
    for (const def of UPGRADES) {
      let prev = 0;
      for (let l = 0; l < def.maxLevel; l++) {
        const c = upgradeCost(def.id, l)!;
        expect(c).toBeGreaterThan(prev);
        prev = c;
      }
      expect(upgradeCost(def.id, def.maxLevel)).toBeNull();
    }
  });
  it('buying spends parts only when affordable', () => {
    const ok = buyUpgrade('tank', emptyUpgrades(), 10);
    expect(ok).toMatchObject({ ok: true, parts: 0 });
    expect(ok.levels.tank).toBe(1);
    expect(buyUpgrade('tank', emptyUpgrades(), 9).ok).toBe(false);
    expect(buyUpgrade('scanner', { ...emptyUpgrades(), scanner: 1 }, 999).ok).toBe(false);
  });
});

describe('seeds', () => {
  it('daily seed is the same all day (UTC) and changes the next day', () => {
    const a = new Date(Date.UTC(2026, 10, 4, 0, 1));
    const b = new Date(Date.UTC(2026, 10, 4, 23, 59));
    const c = new Date(Date.UTC(2026, 10, 5, 0, 0));
    expect(dailyKey(a)).toBe('2026-11-04');
    expect(dailySeed(a)).toBe(dailySeed(b));
    expect(dailySeed(a)).not.toBe(dailySeed(c));
  });
  it('rng is deterministic', () => {
    const x = createRng(123), y = createRng(123);
    for (let i = 0; i < 10; i++) expect(x.next()).toBe(y.next());
    expect(hashString('abc')).toBe(hashString('abc'));
  });
  it('run plan is deterministic and well formed', () => {
    const p = createRunPlan(dailySeed(new Date(Date.UTC(2026, 0, 1))));
    expect(p).toEqual(createRunPlan(p.seed));
    expect(p.rooms).toHaveLength(B.ROOM_COUNT);
    expect(p.events[B.ROOM_COUNT - 1]).toBeNull();
  });
  it('room order uses every type twice without repeats', () => {
    for (let s = 0; s < 100; s++) {
      const o = roomOrder(createRng(s));
      for (const t of PUZZLE_TYPES) expect(o.filter((x) => x === t)).toHaveLength(2);
      for (let i = 1; i < o.length; i++) expect(o[i]).not.toBe(o[i - 1]);
    }
  });
  it('meteor dash is risky', () => {
    expect(meteorDash(0.1).oxygen).toBeLessThan(0);
    expect(meteorDash(0.9).oxygen).toBe(0);
  });
});

class MemKV implements KV {
  m = new Map<string, string>();
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, v);
  }
}

describe('save / load', () => {
  it('round-trips', () => {
    const kv = new MemKV();
    const d = defaultSave();
    d.parts = 42;
    d.upgrades.tank = 3;
    d.settings.lang = 'fr';
    expect(save(kv, d)).toBe(true);
    expect(load(kv)).toEqual(d);
  });
  it('survives corrupt data, missing storage and throwing storage', () => {
    const kv = new MemKV();
    kv.setItem(SAVE_KEY, '{not json');
    expect(load(kv)).toEqual(defaultSave());
    expect(load(null)).toEqual(defaultSave());
    const throwing: KV = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(load(throwing)).toEqual(defaultSave());
    expect(save(throwing, defaultSave())).toBe(false);
  });
  it('sanitizes bad values', () => {
    const s = sanitize({ parts: -5, upgrades: { tank: 99, drain: 'x' }, stats: { runs: NaN } });
    expect(s.parts).toBe(0);
    expect(s.upgrades.tank).toBe(5);
    expect(s.upgrades.drain).toBe(0);
    expect(s.stats.runs).toBe(0);
  });
  it('records runs, escapes and daily bests', () => {
    let d = defaultSave();
    d = recordRun(d, { roomsCleared: 4, escaped: false, seconds: 200, parts: 10, dailyKey: '2026-11-04' });
    d = recordRun(d, { roomsCleared: 10, escaped: true, seconds: 400, parts: 30, dailyKey: null });
    d = recordRun(d, { roomsCleared: 10, escaped: true, seconds: 350, parts: 5, dailyKey: '2026-11-04' });
    expect(d.parts).toBe(45);
    expect(d.stats).toEqual({ runs: 3, escapes: 2, roomsCleared: 24, bestRooms: 10, bestEscapeTime: 350 });
    expect(d.daily).toEqual({ key: '2026-11-04', bestRooms: 10, escaped: true });
  });
});

import { LANGS, detectLang, setLang, t } from '../src/i18n';
describe('i18n', () => {
  it('all languages have every key, non-empty', () => {
    const keys = Object.keys(LANGS.en!);
    for (const [code, dict] of Object.entries(LANGS)) {
      for (const k of keys) expect((dict as Record<string, string>)[k], `${code}.${k}`).toBeTruthy();
    }
  });
  it('detects browser language and interpolates', () => {
    expect(detectLang(null, ['fr-CA', 'en'])).toBe('fr');
    expect(detectLang(null, ['de-DE'])).toBe('en');
    expect(detectLang('en', ['fr'])).toBe('en');
    setLang('en');
    expect(t('room', { n: 3, total: 10 })).toBe('Room 3/10');
  });
});
