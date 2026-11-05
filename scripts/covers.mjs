// Renders the CrazyGames covers from the real game art (the "?cover" scene: game background, tubes, balls, title).
// Needs the web build served: npm run build && npm run preview   (http://localhost:4173)
// Usage: node scripts/covers.mjs  -> submission/covers/*.png
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const sizes = [
  ['landscape-1920x1080', 1920, 1080],
  ['portrait-800x1200', 800, 1200],
  ['square-800x800', 800, 800],
];
mkdirSync('submission/covers', { recursive: true });
const browser = await chromium.launch();
for (const [name, width, height] of sizes) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`${BASE}?cover`);
  await page.getByTestId('cover').waitFor();
  await page.waitForTimeout(600); // let the lifted ball settle
  await page.screenshot({ path: `submission/covers/${name}.png` });
  await page.close();
}
await browser.close();
console.log('covers written to submission/covers');
