import { emptyUpgrades, type UpgradeLevels, UPGRADES } from './upgrades';

export const SAVE_KEY = 'last-breath.save.v1';

export interface SaveData {
  version: 1;
  parts: number;
  upgrades: UpgradeLevels;
  stats: {
    runs: number;
    escapes: number;
    /** total rooms cleared across all runs */
    roomsCleared: number;
    /** most rooms cleared in one run */
    bestRooms: number;
    /** fastest escape in seconds (0 = none yet) */
    bestEscapeTime: number;
  };
  daily: { key: string; bestRooms: number; escaped: boolean } | null;
  settings: { lang: string | null; muted: boolean };
}

export const defaultSave = (): SaveData => ({
  version: 1,
  parts: 0,
  upgrades: emptyUpgrades(),
  stats: { runs: 0, escapes: 0, roomsCleared: 0, bestRooms: 0, bestEscapeTime: 0 },
  daily: null,
  settings: { lang: null, muted: false },
});

/** Minimal storage interface so tests can inject a fake and so a broken localStorage never crashes the game. */
export interface KV {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export function getBrowserStorage(): KV | null {
  try {
    const ls = globalThis.localStorage;
    if (!ls) return null;
    const probe = '__lb_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return null;
  }
}

const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);

/** Validate and repair any parsed value into a well-formed SaveData. */
export function sanitize(raw: unknown): SaveData {
  const base = defaultSave();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  const up = (r.upgrades ?? {}) as Record<string, unknown>;
  const st = (r.stats ?? {}) as Record<string, unknown>;
  const se = (r.settings ?? {}) as Record<string, unknown>;
  const dl = r.daily as Record<string, unknown> | null | undefined;
  const upgrades = emptyUpgrades();
  for (const def of UPGRADES) upgrades[def.id] = Math.min(def.maxLevel, Math.floor(num(up[def.id], 0)));
  return {
    version: 1,
    parts: Math.floor(num(r.parts, 0)),
    upgrades,
    stats: {
      runs: num(st.runs, 0),
      escapes: num(st.escapes, 0),
      roomsCleared: num(st.roomsCleared, 0),
      bestRooms: num(st.bestRooms, 0),
      bestEscapeTime: num(st.bestEscapeTime, 0),
    },
    daily:
      dl && typeof dl === 'object' && typeof dl.key === 'string'
        ? { key: dl.key, bestRooms: num(dl.bestRooms, 0), escaped: dl.escaped === true }
        : null,
    settings: {
      lang: typeof se.lang === 'string' ? se.lang : null,
      muted: se.muted === true,
    },
  };
}

export function load(kv: KV | null): SaveData {
  if (!kv) return defaultSave();
  try {
    const s = kv.getItem(SAVE_KEY);
    if (!s) return defaultSave();
    return sanitize(JSON.parse(s));
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

export interface RunOutcome {
  roomsCleared: number;
  escaped: boolean;
  seconds: number;
  parts: number;
  dailyKey: string | null;
}

/** Pure: apply the result of a run to the save. */
export function recordRun(data: SaveData, o: RunOutcome): SaveData {
  const stats = { ...data.stats };
  stats.runs += 1;
  stats.roomsCleared += o.roomsCleared;
  stats.bestRooms = Math.max(stats.bestRooms, o.roomsCleared);
  if (o.escaped) {
    stats.escapes += 1;
    stats.bestEscapeTime = stats.bestEscapeTime === 0 ? o.seconds : Math.min(stats.bestEscapeTime, o.seconds);
  }
  let daily = data.daily;
  if (o.dailyKey) {
    const prev = daily && daily.key === o.dailyKey ? daily : { key: o.dailyKey, bestRooms: 0, escaped: false };
    daily = { key: o.dailyKey, bestRooms: Math.max(prev.bestRooms, o.roomsCleared), escaped: prev.escaped || o.escaped };
  }
  return { ...data, parts: data.parts + o.parts, stats, daily };
}
