// Generates src/data/levels.json from the seeded generator (src/core/levels.ts).
// Usage: npm run levels   (~20 minutes; the result is committed so the game loads instantly)
// POOL_CACHE=path keeps the candidate boards in a file, so changing only the selection reruns in seconds.
import { createServer } from 'vite';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { generatePools, selectLevels } = await server.ssrLoadModule('/src/core/levels.ts');
  const { encodeLevel } = await server.ssrLoadModule('/src/core/levelCodec.ts');
  const { LEVEL_COUNT } = await server.ssrLoadModule('/src/core/schedule.ts');
  const cache = process.env.POOL_CACHE;
  const t0 = Date.now();
  let pools;
  if (cache && existsSync(cache)) pools = JSON.parse(readFileSync(cache, 'utf8'));
  else {
    pools = generatePools(LEVEL_COUNT, (n) => {
      if (n % 25 === 0) console.log(`level ${n}  (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    });
    if (cache) writeFileSync(cache, JSON.stringify(pools));
  }
  const levels = selectLevels(pools);
  const json = '[\n' + levels.map((l) => JSON.stringify(encodeLevel(l))).join(',\n') + '\n]\n';
  writeFileSync('src/data/levels.json', json);
  console.log(`wrote ${levels.length} levels, ${(json.length / 1024).toFixed(0)} kB`);
} finally {
  await server.close();
}
