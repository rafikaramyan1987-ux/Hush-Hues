import { LEVEL_COUNT, MECHANICS, type Kind, type Mechanic } from './schedule';

export const SAVE_KEY = 'hush-hues.save.v1';

export interface Settings {
  lang: string | null;
  muted: boolean;
  vibration: boolean;
  /** colour-blind helper: small symbols on balls */
  symbols: boolean;
}

export interface SaveData {
  version: 1;
  /** highest level the player may open (1-based) */
  unlocked: number;
  /** best stars per level, index = level - 1 (0 = not completed) */
  stars: number[];
  settings: Settings;
  /** mechanics whose intro screen was already shown */
  seenIntros: Mechanic[];
}

export const defaultSave = (): SaveData => ({
  version: 1,
  unlocked: 1,
  stars: [],
  settings: { lang: null, muted: false, vibration: true, symbols: false },
  seenIntros: [],
});

/** Minimal storage interface so tests can inject a fake and a broken localStorage never crashes the game. */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function getBrowserStorage(): KV | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__hh_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

/**
 * Where progress lives: the CrazyGames data module when available (it follows the player across devices),
 * otherwise localStorage. A save that exists only in localStorage is copied over once.
 */
export function pickStorage(platform: KV | null, browser: KV | null): KV | null {
  if (!platform) return browser;
  try {
    if (!platform.getItem(SAVE_KEY)) {
      const local = browser?.getItem(SAVE_KEY);
      if (local) platform.setItem(SAVE_KEY, local);
    }
  } catch {
    /* keep going with the platform store */
  }
  return platform;
}

const int = (v: unknown, d: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : d;

/** Validate and repair any parsed value into a well-formed SaveData. */
export function sanitize(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const se = (r.settings ?? {}) as Record<string, unknown>;
  const stars = Array.isArray(r.stars) ? r.stars.slice(0, LEVEL_COUNT).map((v) => int(v, 0, 0, 3)) : [];
  return {
    version: 1,
    unlocked: int(r.unlocked, 1, 1, LEVEL_COUNT),
    stars,
    settings: {
      lang: typeof se.lang === 'string' ? se.lang : null,
      muted: se.muted === true,
      vibration: se.vibration !== false,
      symbols: se.symbols === true,
    },
    seenIntros: Array.isArray(r.seenIntros) ? MECHANICS.filter((m) => (r.seenIntros as unknown[]).includes(m)) : [],
  };
}

export function load(kv: KV | null): SaveData {
  if (!kv) return defaultSave();
  try {
    const s = kv.getItem(SAVE_KEY);
    return s ? sanitize(JSON.parse(s)) : defaultSave();
  } catch {
    return defaultSave();
  }
}

export function save(kv: KV | null, data: SaveData): boolean {
  if (!kv) return false;
  try {
    kv.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Pure: record a completed level (keeps the best stars, unlocks the next one). */
export function recordWin(data: SaveData, level: number, stars: number): SaveData {
  const s = data.stars.slice();
  while (s.length < level) s.push(0);
  s[level - 1] = Math.max(s[level - 1] ?? 0, stars);
  return { ...data, stars: s, unlocked: Math.min(LEVEL_COUNT, Math.max(data.unlocked, level + 1)) };
}

/** Total stars; stars of "hard" levels count double (their reward). */
export const totalStars = (d: SaveData, kindOf: (n: number) => Kind): number =>
  d.stars.reduce((a, s, i) => a + s * (kindOf(i + 1) === 'hard' ? 2 : 1), 0);
