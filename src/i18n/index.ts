import en, { type Dict, type Key } from './en';
import fr from './fr';

/** Register languages here. Adding German = create de.ts (typed as Dict) and add it below. */
export const LANGS: Record<string, Dict> = { en, fr };
export type { Key };

let current: Dict = en;
let currentCode = 'en';

export function detectLang(saved: string | null, nav: readonly string[] = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []): string {
  if (saved && LANGS[saved]) return saved;
  for (const l of nav) {
    const code = (l || '').toLowerCase().split('-')[0]!;
    if (LANGS[code]) return code;
  }
  return 'en';
}

export function setLang(code: string): void {
  current = LANGS[code] ?? en;
  currentCode = LANGS[code] ? code : 'en';
  if (typeof document !== 'undefined') document.documentElement.lang = currentCode;
}

export const getLang = (): string => currentCode;

export function t(key: Key, params?: Record<string, string | number>): string {
  let s = current[key] ?? en[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
