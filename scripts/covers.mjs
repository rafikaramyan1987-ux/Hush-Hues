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
  // the platform's NEW/HOT label covers the top-left ~25% × 20%: the title must stay clear of it
  const t = await page.locator('.cover-title').evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const r = range.getBoundingClientRect(); // the glyphs, not the full-width block
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
  });
  const overlaps = t.left < width * 0.25 && t.top < height * 0.2;
  console.log(`${name}: title ${Math.round(t.left)},${Math.round(t.top)} → ${Math.round(t.right)},${Math.round(t.bottom)}${overlaps ? '  OVERLAPS LABEL ZONE' : ''}`);
  if (overlaps) process.exitCode = 1;
  await page.screenshot({ path: `submission/covers/${name}.png` });
  await page.close();
}
await browser.close();
console.log('covers written to submission/covers');
