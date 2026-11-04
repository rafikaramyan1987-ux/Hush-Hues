// Renders public/favicon.svg into the PNG icons (run after changing the SVG): node scripts/icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/favicon.svg', 'utf8');
const browser = await chromium.launch();
for (const [file, size, opaque] of [
  ['public/icon-192.png', 192, false],
  ['public/icon-512.png', 512, false],
  // iOS masks the corners itself and shows transparency as black: render it square on the theme colour
  ['public/apple-touch-icon.png', 180, true],
]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<style>html,body{margin:0;background:${opaque ? '#2a2d5c' : 'transparent'}}svg{width:${size}px;height:${size}px;display:block}</style>${svg}`);
  await page.screenshot({ path: file, omitBackground: !opaque });
  await page.close();
}
await browser.close();
console.log('icons written');
