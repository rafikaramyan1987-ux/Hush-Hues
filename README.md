# Last Breath

A mobile-first survival + puzzle web game. Station **Aster-7** is failing and your **oxygen drains in real time**.
Cross 10 rooms — each one a short procedurally generated puzzle — and reach the escape pod before you run out of air.

- **5 puzzle types**, procedurally generated, always solvable, harder room after room:
  oxygen pipes (rotate tiles), power wires (connect colours without crossing), door code (deduce from clues),
  cargo bay (slide crates to free the hatch), pressure valves (match gauge targets).
- **Hint** (limited per run) and **Skip** (costs a lot of oxygen) in every room.
- **Corridor events** with risky choices: hull leak (pay parts or tap-fast mini-game), meteor shower, power cut
  (play the next room by flashlight), lucky find.
- **Workshop**: spare parts are kept between runs (localStorage) and buy upgrades: bigger tank, slower drain,
  faster tools, more hints, scanner (reveals the next event).
- **Records**: runs, escapes, best run, fastest escape. **Daily station**: same seed for everyone (UTC date).
- **EN / FR**, browser language by default, language picker on the title screen.
- Generated sounds only (WebAudio, started after the first tap), mute button, `prefers-reduced-motion` respected.
- No backend, no cookies, no analytics, no external fonts/CDN at runtime. All art is drawn in code (SVG/CSS/canvas).

## Development

```bash
npm ci
npm run dev          # local dev server
npm run check        # lint + typecheck + unit tests
npm run e2e          # Playwright smoke test at 390px (builds + previews automatically)
npm run build        # web build -> dist/ (GitHub Pages)
npm run zip:crazygames  # CrazyGames build -> dist-crazygames/ and last-breath-crazygames.zip
```

Controls: tap / drag / swipe on touch; mouse; keyboard (arrows + Space/Enter in grid puzzles, digits for the code
lock, Tab + arrows for crates and valves, Esc = pause).

## Project layout

```
src/core/       rng + daily seed, balance (oxygen/difficulty math), upgrades, save/load, run plan & events
src/puzzles/    pure puzzle generators + validators (no DOM) — unit-tested on many seeds
src/ui/views/   one DOM/SVG view per puzzle type
src/ui/         DOM helpers, icons/logo, scene art, starfield
src/platform/   CrazyGames SDK adapter (no-op elsewhere), synthesized audio
src/i18n/       en.ts, fr.ts (add de.ts + one line in index.ts for German)
src/game.ts     screens, game loop, oxygen timer, pause logic
tests/          Vitest unit tests      e2e/  Playwright smoke test
```

## Hosting

`.github/workflows/ci.yml` runs lint, typecheck, unit tests, the bundle-size check (< 5 MB), the Playwright smoke test,
builds the CrazyGames package (uploaded as the `last-breath-crazygames` artifact) and deploys `dist/` to GitHub Pages
on every push.

See [docs/CRAZYGAMES.md](docs/CRAZYGAMES.md) for the CrazyGames integration and submission checklist.

## Debug hook

Builds other than the CrazyGames one expose `window.__lb` (`phase()`, `solve()`, `oxygen()`…) for the automated tests.
