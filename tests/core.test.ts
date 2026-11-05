import { describe, expect, it } from 'vitest';
import { midgameAllowed, MIDGAME_COOLDOWN_MS } from '../src/core/adPolicy';
import { applyMove, canMove, FROZEN, hasAnyMove, HELPER_CAP, isFrozen, isSolved, neighbours, perRowFor, starsFor, type Puzzle, type State } from '../src/core/board';
import { createRng, hashString } from '../src/core/rng';
import { defaultSave, load, pickStorage, recordWin, sanitize, save, SAVE_KEY, totalStars, type KV } from '../src/core/save';
import { kindOf } from '../src/core/schedule';

const plain = (balls: number[][], cap = 4): { p: Puzzle; s: State } => ({
  p: { tubes: balls.map(() => ({ cap, lock: null })), perColor: cap, perRow: perRowFor(balls.length) },
  s: { balls: balls.map((t) => t.slice()), locked: balls.map(() => false) },
});

describe('board rules', () => {
  it('allows a drop on an empty tube or on the same colour with space', () => {
    const { p, s } = plain([[0, 1], [1], [], [0, 0, 0, 1]]);
    expect(canMove(p, s, 0, 1)).toBe(true); // 1 on 1
    expect(canMove(p, s, 0, 2)).toBe(true); // empty
    expect(canMove(p, s, 1, 0)).toBe(true); // 1 on 1
    expect(canMove(p, s, 0, 3)).toBe(false); // full
    expect(canMove(p, s, 2, 0)).toBe(false); // empty source
    expect(canMove(p, s, 0, 0)).toBe(false);
    const o = plain([[0], [1]]);
    expect(canMove(o.p, o.s, 0, 1)).toBe(false); // other colour
  });

  it('applies moves and detects the win', () => {
    const { p, s } = plain([[0, 1], [1], []]);
    expect(applyMove(p, s, { from: 0, to: 1 })).not.toBeNull();
    expect(s.balls).toEqual([[0], [1, 1], []]);
    expect(applyMove(p, s, { from: 2, to: 0 })).toBeNull();
    const w = plain([[0, 0, 0, 0], [], [1, 1, 1, 1]]);
    expect(isSolved(w.p, w.s)).toBe(true);
    const nw = plain([[0, 0, 0], [0], [1, 1, 1, 1]]);
    expect(isSolved(nw.p, nw.s)).toBe(false);
  });

  it('helper tubes hold 2 balls and must end empty', () => {
    const { p, s } = plain([[0, 0, 0, 1], [1, 1, 1], []]);
    p.tubes[2] = { cap: HELPER_CAP, lock: null };
    expect(applyMove(p, s, { from: 0, to: 2 })).not.toBeNull();
    s.balls[2]!.push(1);
    expect(canMove(p, s, 1, 2)).toBe(false); // full at 2
    const done = plain([[0, 0, 0, 0], [1, 1]]);
    done.p.tubes[1] = { cap: HELPER_CAP, lock: null };
    expect(isSolved(done.p, done.s)).toBe(false);
  });

  it('a locked tube opens when its colour is completed', () => {
    const { p, s } = plain([[0, 0, 0], [0, 1], [1, 1, 1], []]);
    p.tubes[2] = { cap: 4, lock: 0 };
    s.locked[2] = true;
    expect(canMove(p, s, 1, 2)).toBe(false); // can't drop into a locked tube
    expect(canMove(p, s, 2, 3)).toBe(false); // nor take from it
    const fx = applyMove(p, s, { from: 1, to: 3 })!; // 1 aside
    expect(fx.unlocked).toEqual([]);
    expect(applyMove(p, s, { from: 1, to: 0 })!.unlocked).toEqual([2]);
    expect(s.locked[2]).toBe(false);
  });

  it('a frozen ball thaws after a move in a neighbouring tube of the same row', () => {
    // 6 tubes → 3 per row: tubes 0,1,2 / 3,4,5
    const { p, s } = plain([[1, 0 | FROZEN], [0], [], [1, 1, 1], [], []]);
    expect(p.perRow).toBe(3);
    expect(neighbours(3, 6, 2)).toEqual([1]);
    expect(canMove(p, s, 0, 2)).toBe(false); // frozen on top
    applyMove(p, s, { from: 3, to: 4 }); // other row: no effect
    expect(isFrozen(s.balls[0]![1]!)).toBe(true);
    const fx = applyMove(p, s, { from: 1, to: 2 })!; // tube 1 is next to tube 0
    expect(fx.thawed).toContain(0);
    expect(canMove(p, s, 0, 2)).toBe(true);
  });

  it('knows when no move is left', () => {
    const { p, s } = plain([[0, 1, 0, 1], [1, 0, 1, 0]]);
    expect(hasAnyMove(p, s)).toBe(false);
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
      seenIntros: [],
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

  it('uses the CrazyGames data module when present, copying an older local save once', () => {
    const platform = mem();
    const browser = mem();
    expect(pickStorage(null, browser)).toBe(browser);
    browser.m.set(SAVE_KEY, '{"unlocked":7}');
    expect(pickStorage(platform, browser)).toBe(platform);
    expect(platform.m.get(SAVE_KEY)).toBe('{"unlocked":7}');
    browser.m.set(SAVE_KEY, '{"unlocked":2}');
    pickStorage(platform, browser); // the platform save wins once it exists
    expect(platform.m.get(SAVE_KEY)).toBe('{"unlocked":7}');
  });

  it('hard levels count their stars twice', () => {
    let d = recordWin(defaultSave(), 9, 3);
    d = recordWin(d, 10, 3);
    expect(totalStars(d, kindOf)).toBe(9);
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
