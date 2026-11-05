import { test, expect, type Page } from '@playwright/test';
import data from '../src/data/levels.json' with { type: 'json' };
import { decodeLevel, type LevelRecord } from '../src/core/levelCodec';

const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const SAVE_KEY = 'hush-hues.save.v1';

/** Minimal stand-in for the CrazyGames SDK v3 (the real one only works on CrazyGames). */
const STUB_SDK = `
(() => {
  const cg = (window.__cg = { calls: [], listeners: [] });
  const load = () => JSON.parse(sessionStorage.getItem('cg-data') || '{}');
  window.CrazyGames = { SDK: {
    environment: 'crazygames',
    init: async () => {},
    ad: { requestAd: (type, cb) => { cg.calls.push('ad:' + type); cb.adStarted && cb.adStarted(); setTimeout(() => cb.adFinished && cb.adFinished(), 30); } },
    game: {
      gameplayStart: () => cg.calls.push('gameplayStart'),
      gameplayStop: () => cg.calls.push('gameplayStop'),
      loadingStart: () => cg.calls.push('loadingStart'),
      loadingStop: () => cg.calls.push('loadingStop'),
      happytime: () => cg.calls.push('happytime'),
      settings: { muteAudio: false },
      addSettingsChangeListener: (l) => cg.listeners.push(l),
    },
    data: {
      getItem: (k) => { const d = load(); return k in d ? d[k] : null; },
      setItem: (k, v) => { const d = load(); d[k] = String(v); sessionStorage.setItem('cg-data', JSON.stringify(d)); },
      removeItem: (k) => { const d = load(); delete d[k]; sessionStorage.setItem('cg-data', JSON.stringify(d)); },
    },
  } };
})();`;

/** Records every request the page makes and every one that fails. */
function watch(page: Page) {
  const requests: string[] = [];
  const failed: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('response', (r) => r.status() >= 400 && failed.push(`${r.status()} ${r.url()}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(e.message));
  return { requests, failed, errors };
}

test('CrazyGames build: one file, no failing request, saves through the SDK data module', async ({ page }) => {
  await page.route(SDK_URL, (r) => r.fulfill({ contentType: 'text/javascript', body: STUB_SDK }));
  const w = watch(page);
  await page.goto('/');
  // lands directly in gameplay
  await expect(page.getByTestId('level-label')).toHaveText('Level 1');
  await expect.poll(() => page.evaluate(() => (window as unknown as { __cg: { calls: string[] } }).__cg.calls)).toContain('gameplayStart');

  // the only requests: the page itself and the SDK (nothing that can go missing)
  expect(new Set(w.requests.map((u) => new URL(u).pathname.replace(/^\/$/, '/index.html')))).toEqual(
    new Set(['/index.html', '/crazygames-sdk-v3.js']),
  );

  // solve level 1 with real taps
  const level1 = decodeLevel((data as unknown as LevelRecord[])[0]!);
  for (const m of level1.solution) {
    await page.getByTestId(`tube-${m.from}`).tap();
    await page.getByTestId(`tube-${m.to}`).tap();
  }
  await expect(page.getByTestId('win')).toBeVisible();
  const calls = await page.evaluate(() => (window as unknown as { __cg: { calls: string[] } }).__cg.calls);
  expect(calls).toContain('happytime');
  expect(calls[calls.length - 1]).toBe('gameplayStop');

  // progress went to the SDK data module, not to localStorage
  const saved = await page.evaluate((k) => JSON.parse(JSON.parse(sessionStorage.getItem('cg-data') || '{}')[k] || 'null'), SAVE_KEY);
  expect(saved.unlocked).toBe(2);
  expect(await page.evaluate((k) => localStorage.getItem(k), SAVE_KEY)).toBeNull();

  // and it is read back from there: after a reload the player lands on level 2
  await page.reload();
  await expect(page.getByTestId('level-label')).toHaveText('Level 2');

  expect(w.failed).toEqual([]);
  expect(w.errors).toEqual([]);
});

test('CrazyGames build follows the platform mute setting', async ({ page }) => {
  await page.route(SDK_URL, (r) => r.fulfill({ contentType: 'text/javascript', body: STUB_SDK }));
  await page.goto('/');
  await expect(page.getByTestId('level-label')).toBeVisible();
  const app = page.locator('#app');
  await expect(app).not.toHaveClass(/platform-muted/);
  await page.evaluate(() => (window as unknown as { __cg: { listeners: ((s: object) => void)[] } }).__cg.listeners.forEach((l) => l({ muteAudio: true })));
  await expect(app).toHaveClass(/platform-muted/);
  await page.evaluate(() => (window as unknown as { __cg: { listeners: ((s: object) => void)[] } }).__cg.listeners.forEach((l) => l({ muteAudio: false })));
  await expect(app).not.toHaveClass(/platform-muted/);
});

test('CrazyGames build still works with an ad blocker (SDK blocked)', async ({ page }) => {
  await page.route(SDK_URL, (r) => r.abort());
  const w = watch(page);
  await page.goto('/');
  await expect(page.getByTestId('level-label')).toHaveText('Level 1');
  await page.getByTestId('tube-0').tap();
  // only the blocked SDK itself failed; the game made no other request
  expect(w.failed).toEqual([SDK_URL]);
  expect(w.errors.filter((e) => !e.includes('ERR_FAILED'))).toEqual([]);
});
