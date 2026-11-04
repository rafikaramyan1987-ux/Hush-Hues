import { describe, expect, it } from 'vitest';
import en from '../src/i18n/en';
import fr from '../src/i18n/fr';
import { detectLang, setLang, t } from '../src/i18n';

describe('i18n', () => {
  it('fr has every key and keeps placeholders', () => {
    for (const k of Object.keys(en) as (keyof typeof en)[]) {
      expect(fr[k], k).toBeTruthy();
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
      expect(ph(fr[k]), k).toBe(ph(en[k]));
    }
  });
  it('detects the browser language and formats params', () => {
    expect(detectLang(null, ['fr-CA'])).toBe('fr');
    expect(detectLang(null, ['de-DE'])).toBe('en');
    expect(detectLang('en', ['fr'])).toBe('en');
    setLang('fr');
    expect(t('level', { n: 7 })).toBe('Niveau 7');
    setLang('en');
  });
});
