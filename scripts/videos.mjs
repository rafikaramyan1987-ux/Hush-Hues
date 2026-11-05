// Records the CrazyGames preview videos by playing the real game in real time (no speed-up), then encodes H.264 mp4.
// Needs the web build served: npm run build && npm run preview   (http://localhost:4173) and ffmpeg on PATH.
// Usage: node scripts/videos.mjs  -> submission/videos/*.mp4
//
// - first frame = the static cover scene (same art as the covers), held ~1.5 s
// - then a real level is played tap by tap: sorting, a ball revealing its colour, a locked tube opening
// - frames come from Chrome's screencast (no mouse cursor is ever drawn), so there are no black frames
// - no audio track, no text added on top of the game
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const LEVEL = Number(process.env.LEVEL ?? 51); // lock intro level: short, colourful, a tube unlocks
const TARGET_S = 18;
const formats = [
  // CSS viewport × 2 device pixels = output size (crisp)
  { name: 'landscape-1920x1080', w: 960, h: 540, outW: 1920, outH: 1080 },
  { name: 'portrait-1080x1620', w: 540, h: 810, outW: 1080, outH: 1620 },
];

mkdirSync('submission/videos', { recursive: true });
const browser = await chromium.launch();
for (const f of formats) {
  const ctx = await browser.newContext({ viewport: { width: f.w, height: f.h }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  // a returning player: all levels open, intros already seen (no text panels in the video), sound off
  await page.addInitScript(() => {
    localStorage.setItem(
      'hush-hues.save.v1',
      JSON.stringify({
        version: 1,
        unlocked: 300,
        stars: [],
        settings: { muted: true, vibration: false, symbols: false },
        seenIntros: ['oneEmpty', 'hidden', 'tall', 'lock', 'helper', 'frozen'],
      }),
    );
  });
  await page.goto(`${BASE}?cover`);
  await page.getByTestId('cover').waitFor();
  await page.waitForTimeout(800);

  const dir = mkdtempSync(join(tmpdir(), 'hh-frames-'));
  const frames = [];
  const cdp = await ctx.newCDPSession(page);
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const file = join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`);
    frames.push({ file, t: metadata.timestamp });
    writeFileSync(file, Buffer.from(data, 'base64'));
    await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: f.outW, maxHeight: f.outH, everyNthFrame: 1 });
  const t0 = Date.now();
  await page.waitForTimeout(1600); // static cover

  await page.evaluate((n) => window.__cover.play(n), LEVEL);
  await page.waitForTimeout(900);
  const moves = await page.evaluate(() => window.__hh.solution());
  const box = async (i) => page.getByTestId(`tube-${i}`).boundingBox();
  for (const m of moves) {
    if ((Date.now() - t0) / 1000 > TARGET_S - 2.5) break;
    for (const i of [m.from, m.to]) {
      const b = await box(i);
      await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height * 0.6);
      await page.waitForTimeout(i === m.from ? 260 : 420); // calm, human pace
    }
  }
  while ((Date.now() - t0) / 1000 < TARGET_S) await page.waitForTimeout(100);
  await cdp.send('Page.stopScreencast');
  await ctx.close();

  // concat list with each frame's real duration → constant 30 fps H.264, no audio
  const list = frames
    .map((fr, i) => {
      const next = frames[i + 1]?.t ?? fr.t + 1 / 30;
      return `file '${fr.file}'\nduration ${Math.max(0.001, next - fr.t).toFixed(4)}`;
    })
    .join('\n');
  writeFileSync(join(dir, 'list.txt'), `${list}\nfile '${frames[frames.length - 1].file}'\n`);
  const out = `submission/videos/${f.name}.mp4`;
  execFileSync('ffmpeg', [
    '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
    '-vf', `scale=${f.outW}:${f.outH}:flags=lanczos,fps=30,format=yuv420p`,
    '-t', String(TARGET_S), '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-movflags', '+faststart', out,
  ]);
  rmSync(dir, { recursive: true, force: true });
  console.log(`${out}: ${frames.length} frames, ${(statSync(out).size / 1e6).toFixed(1)} MB`);
}
await browser.close();
