import { describe, expect, it } from 'vitest';
import { midgameAllowed, MIDGAME_COOLDOWN_MS } from '../src/core/adPolicy';
import { applyMove, canMove, isSolved, starsFor, undoMove, type Board } from '../src/core/board';
import { createRng, hashString } from '../src/core/rng';
import { defaultSave, load, recordWin, sanitize, save, SAVE_KEY, type KV } from '../src/core/save';

describe('board rules', () => {
  const b = (): Board => [[0, 1], [1], [], [0, 0, 0, 1]];

  it('allows a drop on an empty tube or on the same colour with space', () => {
    expect(canMove(b(), 0, 1)).toBe(true); // 1 on 1
    expect(canMove(b(), 0, 2)).toBe(true); // empty
    expect(canMove(b(), 1, 0)).toBe(true); // 1 on 1
    expect(canMove(b(), 0, 3)).toBe(false); // full
    expect(canMove(b(), 2, 0)).toBe(false); // empty source
    expect(canMove(b(), 0, 0)).toBe(false);
    expect(canMove([[0], [1]], 0, 1)).toBe(false); // other colour
  });

  it('applies and undoes moves', () => {
    const x = b();
    expect(applyMove(x, { from: 0, to: 1 })).toBe(true);
    expect(x).toEqual([[0], [1, 1], [], [0, 0, 0, 1]]);
    undoMove(x, { from: 0, to: 1 });
    expect(x).toEqual(b());
    expect(applyMove(x, { from: 0, to: 3 })).toBe(false);
    expect(x).toEqual(b());
  });

  it('detects the win', () => {
    expect(isSolved([[0, 0, 0, 0], [], [1, 1, 1, 1]])).toBe(true);
    expect(isSolved([[0, 0, 0], [0], [1, 1, 1, 1]])).toBe(false);
    expect(isSolved([[0, 0, 0, 1], [1, 1, 1, 0]])).toBe(false);
  });

  it('gives 1-3 stars by moves', () => {
    expect(starsFor(10, 10)).toBe(3);
    expect(starsFor(9, 10)).toBe(3);
    expect(starsFor(14, 10)).toBe(2);
    expect(starsFor(40, 10)).toBe(1);
  });
});

describe('rng', () => {
  it('is deterministic', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 10; i++) expect(a.next()).toBe(b.next());
    expect(hashString('a')).not.toBe(hashString('b'));
  });
});

describe('save', () => {
  const mem = (): KV & { m: Map<string, string> } => {
    const m = new Map<string, string>();
    return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
  };

  it('round-trips and repairs garbage', () => {
    const kv = mem();
    const d = recordWin(defaultSave(), 1, 3);
    expect(save(kv, d)).toBe(true);
    expect(load(kv)).toEqual(d);
    kv.m.set(SAVE_KEY, '{not json');
    expect(load(kv)).toEqual(defaultSave());
    expect(sanitize({ unlocked: -5, stars: [9, 'x', 2], settings: { muted: 'yes' } })).toMatchObject({
      unlocked: 1,
      stars: [3, 0, 2],
      settings: { muted: false, vibration: true, symbols: false },
    });
  });

  it('never throws when storage is broken or missing', () => {
    const broken: KV = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(load(broken)).toEqual(defaultSave());
    expect(save(broken, defaultSave())).toBe(false);
    expect(load(null)).toEqual(defaultSave());
    expect(save(null, defaultSave())).toBe(false);
  });

  it('keeps best stars and unlocks the next level', () => {
    let d = recordWin(defaultSave(), 1, 2);
    expect(d.unlocked).toBe(2);
    d = recordWin(d, 1, 1);
    expect(d.stars[0]).toBe(2);
    d = recordWin(d, 2, 3);
    expect(d.stars).toEqual([2, 3]);
    expect(d.unlocked).toBe(3);
  });
});

describe('ad policy', () => {
  const t0 = 1_000_000;
  it('never shows a midgame ad before level 3 is done', () => {
    expect(midgameAllowed(1, t0 + MIDGAME_COOLDOWN_MS * 10, 0, t0)).toBe(false);
    expect(midgameAllowed(2, t0 + MIDGAME_COOLDOWN_MS * 10, 0, t0)).toBe(false);
    expect(midgameAllowed(3, t0 + MIDGAME_COOLDOWN_MS, 0, t0)).toBe(true);
  });
  it('waits 3 minutes between midgame ads', () => {
    expect(midgameAllowed(5, t0 + 60_000, 0, t0)).toBe(false);
    expect(midgameAllowed(5, t0 + MIDGAME_COOLDOWN_MS - 1, t0, t0)).toBe(false);
    expect(midgameAllowed(5, t0 + MIDGAME_COOLDOWN_MS, t0, t0)).toBe(true);
  });
});
