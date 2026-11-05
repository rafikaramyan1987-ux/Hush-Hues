import { test, expect, type Page } from '@playwright/test';

interface Move {
  from: number;
  to: number;
}
declare global {
  interface Window {
    __hh: { screen(): string; level(): number; moves(): number; solution(): Move[] | null };
  }
}

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e;
  });
  await page.goto('/');
  await expect(page.getByTestId('play')).toBeVisible();
});

/** Solve the current level by real taps on the tubes; the solver only chooses which tubes to tap. */
async function solveByTapping(page: Page): Promise<void> {
  const moves = await page.evaluate(() => window.__hh.solution());
  expect(moves).not.toBeNull();
  for (const m of moves!) {
    await page.getByTestId(`tube-${m.from}`).tap();
    await page.getByTestId(`tube-${m.to}`).tap();
  }
}

test('home fits 390px and switches language', async ({ page }) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
  await expect(page).toHaveTitle('Hush Hues');
  await page.getByTestId('settings').click();
  await page.getByTestId('lang').selectOption('fr');
  await expect(page.getByTestId('play')).toContainText('Jouer');
  await page.getByTestId('settings').click();
  await page.getByTestId('lang').selectOption('en');
  await expect(page.getByTestId('play')).toContainText('Play');
});

test('solve level 1 and reach level 2', async ({ page }) => {
  await page.getByTestId('play').click();
  await expect(page.getByTestId('level-label')).toHaveText('Level 1');
  await expect(page.getByTestId('hint')).not.toBeEmpty();
  // tubes are big touch targets
  const box = await page.getByTestId('tube-0').boundingBox();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(150);

  await solveByTapping(page);
  await expect(page.getByTestId('win')).toBeVisible();
  await expect(page.getByTestId('win')).toHaveAttribute('data-stars', '3');
  await page.getByTestId('next').click();
  await expect(page.getByTestId('level-label')).toHaveText('Level 2');
  await expect(page.getByTestId('moves')).toHaveText('Moves 0');

  // progress is saved: after a reload level 2 is open, level 3 still locked
  await page.reload();
  await page.getByTestId('levels').click();
  await expect(page.getByTestId('level-2')).toBeEnabled();
  await expect(page.getByTestId('level-3')).toBeDisabled();
});

test('undo, extra tube and restart work without the SDK', async ({ page }) => {
  await page.getByTestId('play').click();
  const moves = await page.evaluate(() => window.__hh.solution());
  const m = moves![0]!;
  await page.getByTestId(`tube-${m.from}`).tap();
  await page.getByTestId(`tube-${m.to}`).tap();
  await expect(page.getByTestId('moves')).toHaveText('Moves 1');
  await page.getByTestId('undo').tap();
  await expect(page.getByTestId('moves')).toHaveText('Moves 0');
  await expect(page.getByTestId('undo')).toBeDisabled();

  const before = await page.locator('.tube').count();
  await page.getByTestId('extra').tap();
  await expect(page.locator('.tube')).toHaveCount(before + 1);
  await expect(page.getByTestId('extra')).toBeDisabled();

  await page.getByTestId('restart').tap();
  await expect(page.getByTestId('moves')).toHaveText('Moves 0');
});

test('works from any sub-path (repo name independent)', async ({ page }) => {
  // serve the same build under an arbitrary folder, like GitHub Pages does for /<repo-name>/
  // anything requested outside the sub-folder (an absolute "/assets/..." path) fails
  await page.route(/^http:\/\/localhost:4173\/(?!Any-Repo-Name\/)/, (route) => route.abort());
  await page.route('**/Any-Repo-Name/**', (route) => {
    const url = route.request().url().replace('/Any-Repo-Name/', '/');
    return route.continue({ url });
  });
  const errors: string[] = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('/Any-Repo-Name/');
  await expect(page.getByTestId('play')).toBeVisible();
  await page.getByTestId('play').click();
  await expect(page.getByTestId('level-label')).toHaveText('Level 1');
  expect(errors).toEqual([]);
});

test('a new mechanic shows its intro once, and hard levels carry a badge', async ({ page }) => {
  await page.evaluate(() =>
    localStorage.setItem('hush-hues.save.v1', JSON.stringify({ version: 1, unlocked: 30, stars: [], settings: {}, seenIntros: [] })),
  );
  await page.reload();
  await page.getByTestId('levels').click();
  await page.getByTestId('level-21').click();
  await expect(page.getByTestId('intro')).toHaveAttribute('data-mechanic', 'hidden');
  await page.getByTestId('intro-ok').click();
  await expect(page.getByTestId('intro')).toHaveCount(0);
  expect(await page.locator('.ball.hidden').count()).toBeGreaterThan(0);
  // seen once: not shown again
  await page.getByTestId('restart').click();
  await expect(page.getByTestId('intro')).toHaveCount(0);

  await page.getByTestId('home').click();
  await page.getByTestId('levels').click();
  await expect(page.getByTestId('level-20')).toHaveClass(/hard/);
  await page.getByTestId('level-20').click();
  await expect(page.getByTestId('hard-badge')).toBeVisible();
});
