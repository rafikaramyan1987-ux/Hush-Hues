import { test, expect, type Page } from '@playwright/test';

declare global {
  interface Window {
    __lb: { phase(): string; solve(): void; oxygen(): number };
  }
}

const phase = (page: Page) => page.evaluate(() => window.__lb.phase());

/** Drive one step of the run. `mode` decides what to do in puzzle rooms. */
async function step(page: Page, mode: 'solve' | 'skip'): Promise<string> {
  const ph = await phase(page);
  if (ph === 'puzzle') {
    if (mode === 'solve') await page.evaluate(() => window.__lb.solve());
    else await page.getByTestId('skip').click();
  } else if (ph === 'cleared') {
    await page.getByTestId('next').click();
  } else if (ph === 'event') {
    if (await page.getByTestId('continue').count()) await page.getByTestId('continue').click();
    else {
      const ev = await page.getByTestId('event').getAttribute('data-event');
      // leak -> try the mini-game, power -> go dark, others -> first choice
      await page.getByTestId(ev === 'leak' || ev === 'power' ? 'choice-1' : 'choice-0').click();
    }
  } else if (ph === 'leak') {
    for (const spot of await page.locator('.leak-spot').all()) await spot.dispatchEvent('pointerdown');
  }
  await page.waitForTimeout(120);
  return phase(page);
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/');
  await expect(page.getByTestId('play')).toBeVisible();
});

test('title screen fits 390px and switches language', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await page.getByTestId('lang').selectOption('fr');
  await expect(page.getByTestId('play')).toHaveText('Lancer une partie');
  await page.getByTestId('lang').selectOption('en');
  await expect(page.getByTestId('play')).toHaveText('Start run');
});

test('a pipe tile rotates on tap', async ({ page }) => {
  await page.getByTestId('play').click();
  // find a pipes room by solving forward if needed
  for (let i = 0; i < 40; i++) {
    if ((await phase(page)) === 'puzzle' && (await page.getByTestId('room').getAttribute('data-type')) === 'pipes') break;
    await step(page, 'solve');
  }
  test.skip((await phase(page)) !== 'puzzle', 'no pipes room reached');
  const tile = page.locator('.tile').first();
  const rot = tile.locator('.rot');
  const before = await rot.evaluate((el) => (el as HTMLElement).style.transform);
  await tile.tap();
  await expect.poll(() => rot.evaluate((el) => (el as HTMLElement).style.transform)).not.toBe(before);
});

test('skipping every room ends in game over', async ({ page }) => {
  await page.getByTestId('play').click();
  await expect(page.getByTestId('room')).toBeVisible();
  let ph = 'puzzle';
  for (let i = 0; i < 80 && ph !== 'end'; i++) ph = await step(page, 'skip');
  expect(ph).toBe('end');
  await expect(page.getByTestId('end')).toHaveAttribute('data-result', 'lose');
  await page.getByTestId('menu').click();
  await expect(page.getByTestId('play')).toBeVisible();
});

test('solving every room reaches the escape pod and banks parts', async ({ page }) => {
  await page.getByTestId('play').click();
  let ph = 'puzzle';
  for (let i = 0; i < 120 && ph !== 'end'; i++) ph = await step(page, 'solve');
  await expect(page.getByTestId('end')).toHaveAttribute('data-result', 'win');
  await page.getByTestId('menu').click();
  await page.getByTestId('workshop').click();
  await expect(page.locator('.parts-bank')).not.toHaveText(/⚙ 0 /);
});
