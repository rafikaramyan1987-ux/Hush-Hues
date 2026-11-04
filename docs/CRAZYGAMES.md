# CrazyGames integration

## What the game does

| Requirement | Implementation |
|---|---|
| SDK v3 loaded from CrazyGames' URL | Only in the `crazygames` build (`npm run build:crazygames`): Vite injects `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js">` in `<head>`. The GitHub Pages build has no external script. |
| `await SDK.init()` before using the SDK | `src/platform/ads.ts` → `ads.init()` (with an 8 s timeout so a blocked SDK never blocks the game). |
| Loading events | `game.loadingStart()` / `game.loadingStop()` around boot (`src/main.ts`). |
| Gameplay events | `gameplayStart()` only while a puzzle (or the leak mini-game) is actively running; `gameplayStop()` on menus, room summaries, event choices, pause, ads, hidden tab and end of run. Calls are de-duplicated. |
| Rewarded ads, opt-in only | "+20 s O₂" button, appears once per run when oxygen < 15 %; "double parts" button on the end screen. |
| Midgame ads at natural breaks | Before a new run (never before the first one), max one every 3 minutes. |
| Pause + mute during ads | `adStarted` → oxygen timer paused, AudioContext suspended; resumed on `adFinished` / `adError`. |
| Works with ad blockers / no SDK | Every SDK call is wrapped; without SDK, rewarded ads resolve as "no SDK" and the reward is granted (testing). |
| happytime | Called when the player escapes. |
| No external links, no own ads, no tracking | None in the code (ESLint forbids `window.open`). |
| New players straight into gameplay | In the CrazyGames build, a first-time player starts a run immediately. |
| Portrait game | Centered column with a starfield on the sides; scales from 360 px to desktop. |
| Size | ~80 kB of JS+CSS, a handful of files (limits: initial download ≤ 50 MB, ≤ 20 MB for the mobile homepage, ≤ 1500 files). |
| Relative paths | Vite `base: './'` so the zip works from any folder. |
| Saves | localStorage wrapped in try/catch (game still works if storage is blocked). |

## Docs to re-check before submitting

- SDK v3 intro: https://docs.crazygames.com/sdk/html5-v3/intro
- Technical requirements: https://docs.crazygames.com/requirements/technical
- Gameplay requirements: https://docs.crazygames.com/requirements/gameplay/
- Requirements overview: https://docs.crazygames.com/requirements/intro/
- SDK requirements: https://docs.crazygames.com/partials/sdk-requirements/
- FAQ: https://docs.crazygames.com/faq/

## Submission steps

1. Run the GitHub Action (or `npm run zip:crazygames` locally) and download the `last-breath-crazygames` artifact.
   Its content (`index.html` at the root + `assets/`) is the zip to upload.
2. In the CrazyGames Developer Portal, create the game, choose **HTML5**, upload the zip.
3. Test it in the portal's **preview / QA tool** (it runs the SDK in "local" mode with demo ads): check that a
   rewarded ad pauses the oxygen and gives +20 s, that the midgame ad appears between runs, and that sound stops during ads.
4. Fill the metadata: title, description, controls (tap/drag, mouse, keyboard), orientation **portrait** on mobile,
   category (Puzzle), tags, and upload covers (`node scripts/covers.mjs` creates placeholder covers from the title
   screen; better hand-made covers are recommended).
5. Submit for the Basic launch; after approval, CrazyGames reviews the SDK integration for the Full launch.
