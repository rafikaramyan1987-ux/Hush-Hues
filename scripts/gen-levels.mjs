// Generates src/data/levels.json from the seeded generator (src/core/levels.ts).
// Usage: npm run levels   (takes a few minutes; the result is committed so the game loads instantly)
import { createServer } from 'vite';
import { writeFileSync } from 'node:fs';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { generateLevels } = await server.ssrLoadModule('/src/core/levels.ts');
  const { encodeLevel } = await server.ssrLoadModule('/src/core/levelCodec.ts');
  const { LEVEL_COUNT } = await server.ssrLoadModule('/src/core/schedule.ts');
  const t0 = Date.now();
  const levels = generateLevels(LEVEL_COUNT, (l) => {
    if (l.n % 25 === 0) console.log(`level ${l.n}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  });
  const json = '[\n' + levels.map((l) => JSON.stringify(encodeLevel(l))).join(',\n') + '\n]\n';
  writeFileSync('src/data/levels.json', json);
  console.log(`wrote ${levels.length} levels, ${(json.length / 1024).toFixed(0)} kB`);
} finally {
  await server.close();
}
