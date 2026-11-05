# Hush Hues

A calm, mobile-first **colour ball-sort puzzle** for the web. Tap a tube to lift its top ball, tap another tube to drop it.
A ball may only land in an empty tube or on a ball of the same colour (4 balls per tube). A level is done when every
tube holds one colour.

- **Relaxing by design**: no timer, no way to lose, restart any time.
- **300 levels**, generated deterministically from seeds (`npm run levels` → `src/data/levels.json`). Each board's
  layout is rebuilt by playing **reverse moves** from a sorted board, then the whole level (with its mechanics) is
  verified by replaying the solution; the unit tests replay every solution and run the solver on all 300 levels.
- **New ideas, one at a time**, each with a one-screen visual intro, then mixed into later levels:
  L11 one empty tube · L21 hidden "?" balls · L35 taller tubes (5) · L51 locked tube (opens when its colour is done) ·
  L71 helper tubes (hold 2) · L91 frozen balls (thaw after a move next to them).
  (Every 10th level is a hard one, so intros that would land on L20/L50/L70/L90 come one level later.)
- **Rhythm**: every 5th level is a breather (easier than the one before), every 10th a "Hard level" (harder than the
  one before, stars count ×2); never two hard levels in a row.
- **Difficulty is measured** with the solver (log₂ of states explored + dead-end share + hidden balls) and rises
  smoothly inside each colour band: never easier than the previous normal level, never a jump > 2.5.
  `npm test` prints the table for levels 1–150.
- **No losing**: when no move is left, a calm panel offers Undo, Restart or "+1 tube".
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
npm run levels       # regenerate src/data/levels.json from the seeds (~15 min)
```

## Project layout

```
src/core/board.ts    rules: legal move, capacities, locks, ice, win, stars
src/core/schedule.ts colours per band, rhythm (relax/hard), which mechanics each level uses
src/core/levels.ts   generator: seeded candidate boards, reverse-move rebuild, difficulty score, band selection
src/core/solver.ts   A* solver (nodes explored + dead-end ratio, par for stars, tests, debug hook)
src/data/levels.json the 300 pre-generated levels (compact, see levelCodec.ts)
src/core/save.ts     progress + settings (localStorage, try/catch everywhere)
src/core/adPolicy.ts midgame-ad rules (not before level 3, 3-minute cooldown), undo/ad amounts
src/ui/              board view (DOM + Web Animations), palette & symbols, icons, DOM helpers
src/platform/        CrazyGames SDK adapter (no-op elsewhere), synthesized audio + vibration
src/i18n/            en.ts, fr.ts (add a language = one file + one line in index.ts)
src/game.ts          screens (home, levels, play, win), input, ads, save
tests/               Vitest unit tests      e2e/  Playwright smoke test (390px: solve level 1, reach level 2)
```

## Hosting

The build uses relative paths only (`base: './'`), so it works under any GitHub Pages path (`/Last-Breath/`,
`/Hush-Hues/`, …). CI checks it, and an e2e test loads the game from an arbitrary sub-folder.


`.github/workflows/ci.yml` runs lint, typecheck, unit tests, the bundle-size check (< 5 MB), the Playwright smoke test,
builds the CrazyGames package (uploaded as the `hush-hues-crazygames` artifact) and deploys `dist/` to GitHub Pages on
every push.

Submission material (covers, preview videos, descriptions): [`submission/`](submission/README.md).
See [docs/CRAZYGAMES.md](docs/CRAZYGAMES.md) for the CrazyGames integration and submission checklist.

## Debug hook

Builds other than the CrazyGames one expose `window.__hh` (`screen()`, `level()`, `moves()`, `solution()`), and `?cover` renders the store-art scene
for the automated tests.
