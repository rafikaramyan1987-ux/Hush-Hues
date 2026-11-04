// Renders placeholder cover images for CrazyGames (needs `npm run build && npm run preview` running).
// Usage: node scripts/covers.mjs  -> writes covers/*.png (git-ignored)
// Sizes requested by CrazyGames: landscape 1920x1080, portrait 800x1200, square 800x800.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const sizes = [
  ['landscape-1920x1080', 1920, 1080],
  ['portrait-800x1200', 800, 1200],
  ['square-800x800', 800, 800],
];
mkdirSync('covers', { recursive: true });
const browser = await chromium.launch();
for (const [name, width, height] of sizes) {
  const page = await browser.newPage({ viewport: { width, height } });
  await page.goto('http://localhost:4173/');
  await page.addStyleTag({
    content:
      '#app{max-width:none!important}.topbar,.menu{display:none!important}.home{justify-content:center}' +
      '.logo{width:min(34vh,340px)!important;margin:0!important;animation:none!important}.title{font-size:min(14vh,9rem)!important}.tagline{font-size:min(4vh,2.2rem)}',
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: `covers/${name}.png` });
  await page.close();
}
await browser.close();
console.log('covers written to ./covers');
