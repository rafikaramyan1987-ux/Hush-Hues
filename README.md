# Hush Hues

A calm, mobile-first **colour ball-sort puzzle** for the web. Tap a tube to lift its top ball, tap another tube to drop it.
A ball may only land in an empty tube or on a ball of the same colour (4 balls per tube). A level is done when every
tube holds one colour.

- **Relaxing by design**: no timer, no way to lose, restart any time.
- **300 levels**, generated deterministically from a seed. Every level is built by playing **reverse moves** from a
  sorted board, so it is always solvable (a solver checks the first 300 in the unit tests).
- **Gentle curve**: levels 1–5 are a 3-colour tutorial, then one more colour every few levels up to 12, with the
  scramble growing slowly inside each step: no difficulty spikes.
- **Undo**: 3 free per level, more with an optional rewarded ad. **Extra empty tube**: once per level with an optional
  rewarded ad.
- **Stars** by number of moves (finishing always gives at least one), **level select**, progress saved in
  `localStorage` (the game still works if storage is blocked).
- **Colour-blind option**: a small symbol on every ball. **EN / FR**, browser language by default.
- Soft generated sounds (WebAudio, each colour has its own pentatonic note), mute button, optional vibration,
  `prefers-reduced-motion` respected, keyboard playable (Tab/Enter or 1–9 for tubes, U / Ctrl+Z to undo, R to restart).
- No backend, no cookies, no analytics, no external fonts/CDN at runtime. All art is drawn in code (CSS/SVG).

## Development

```bash
npm ci
npm run dev          # local dev server
npm run check        # lint + typecheck + unit tests
npm run e2e          # Playwright smoke test at 390px (builds + previews automatically)
npm run build        # web build -> dist/ (GitHub Pages)
npm run zip:crazygames  # CrazyGames build -> dist-crazygames/ and hush-hues-crazygames.zip
npm run icons        # re-render the PNG icons from public/favicon.svg
```

## Project layout

```
src/core/board.ts    rules: legal move, apply/undo, win, stars
src/core/levels.ts   difficulty curve + deterministic level generator (reverse moves from a solved board)
src/core/solver.ts   A* solver (tests, par for stars, debug hook)
src/core/save.ts     progress + settings (localStorage, try/catch everywhere)
src/core/adPolicy.ts midgame-ad rules (not before level 3, 3-minute cooldown), undo/ad amounts
src/ui/              board view (DOM + Web Animations), palette & symbols, icons, DOM helpers
src/platform/        CrazyGames SDK adapter (no-op elsewhere), synthesized audio + vibration
src/i18n/            en.ts, fr.ts (add a language = one file + one line in index.ts)
src/game.ts          screens (home, levels, play, win), input, ads, save
tests/               Vitest unit tests      e2e/  Playwright smoke test (390px: solve level 1, reach level 2)
```

## Hosting

`.github/workflows/ci.yml` runs lint, typecheck, unit tests, the bundle-size check (< 5 MB), the Playwright smoke test,
builds the CrazyGames package (uploaded as the `hush-hues-crazygames` artifact) and deploys `dist/` to GitHub Pages on
every push.

See [docs/CRAZYGAMES.md](docs/CRAZYGAMES.md) for the CrazyGames integration and submission checklist.

## Debug hook

Builds other than the CrazyGames one expose `window.__hh` (`screen()`, `level()`, `moves()`, `board()`, `solution()`)
for the automated tests.
