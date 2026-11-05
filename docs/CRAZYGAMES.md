# CrazyGames integration

## What the game does

| Requirement | Implementation |
|---|---|
| SDK v3 loaded from CrazyGames' URL | Only in the `crazygames` build (`npm run build:crazygames`): Vite injects `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js">` in `<head>`. The GitHub Pages build has no external script. |
| `await SDK.init()` before using the SDK | `src/platform/ads.ts` → `ads.init()` (with an 8 s timeout so a blocked SDK never blocks the game). |
| Loading events | `game.loadingStart()` / `game.loadingStop()` around boot (`src/main.ts`). |
| Gameplay events | `gameplayStart()` only while a level is being played; `gameplayStop()` on home, level select, settings, the "Sorted!" panel, during ads and when the tab is hidden. Calls are de-duplicated. |
| Rewarded ads, opt-in only | "Extra tube" (once per level, also offered on the "No moves left" panel) and "Undo" after the 3 free undos (+3 undos). Both show an ad badge. |
| Midgame ads at natural breaks | Only when pressing "Next" between levels, never before level 3 is completed, at most one every 3 minutes (`src/core/adPolicy.ts`, unit-tested). |
| Mute during ads | `adStarted` → AudioContext suspended and input blocked; resumed on `adFinished` / `adError`. |
| happytime | Called when a level is sorted (if the SDK exposes it). |
| Works with ad blockers / no SDK | Every SDK call is wrapped; without SDK, rewarded ads resolve as "no SDK" and the reward is granted (GitHub Pages / testing). |
| No external links, no own ads, no tracking, no other portal branding | None in the code (ESLint forbids `window.open`); no logos or links of other sites. |
| Content rating | Abstract colour puzzle: no violence, chat, user content or purchases (well within PEGI 12). |
| No console errors | Checked with Playwright (web build e2e and CrazyGames build). With an ad blocker the only console line is the browser's own "failed to load" for the blocked SDK script. |
| Players land directly in gameplay | In the CrazyGames build every player starts straight on their current level (level 1 the first time); the menu is one tap away. |
| Portrait game | Centered column; scales from 360 px to desktop. |
| Size | ~280 kB in 8 files (limits: initial download ≤ 50 MB, ≤ 1500 files) — checked in CI. |
| Relative paths | Vite `base: './'` so the zip works from any folder. |
| Saves | localStorage wrapped in try/catch (game still works if storage is blocked). |

## Docs to re-check before submitting

- SDK v3 intro: https://docs.crazygames.com/sdk/html5-v3/intro
- Technical requirements: https://docs.crazygames.com/requirements/technical
- Gameplay requirements: https://docs.crazygames.com/requirements/gameplay/
- Requirements overview: https://docs.crazygames.com/requirements/intro/
- Ads requirements: https://docs.crazygames.com/requirements/ads/
- FAQ: https://docs.crazygames.com/faq/

## Submission steps

1. Run the GitHub Action (or `npm run zip:crazygames` locally) and download the `hush-hues-crazygames` artifact.
   Its content (`index.html` at the root + `assets/`) is the zip to upload.
2. In the CrazyGames Developer Portal, create the game, choose **HTML5**, upload the zip.
3. Test it in the portal's **preview / QA tool** (it runs the SDK in "local" mode with demo ads): check that "Extra tube"
   and the 4th undo show a rewarded ad and grant the reward, that a midgame ad can appear between levels (from level 4 on,
   3 minutes apart), and that sound stops during ads.
4. Fill the metadata from [`submission/README.md`](../submission/README.md) (title, EN/FR descriptions, controls, tags);
   covers are in `submission/covers/`, preview videos in `submission/videos/`. Fill the metadata: title, description, controls (tap / mouse; keyboard 1–9, U, R), orientation **portrait** on mobile,
   category (Puzzle), tags, and upload covers: **1920×1080** (landscape), **800×1200** (portrait), **800×800** (square).
   `node scripts/covers.mjs` creates placeholder covers from the title screen; hand-made covers are recommended.
5. Submit for the Basic launch; after approval, CrazyGames reviews the SDK integration for the Full launch.
