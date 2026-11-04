/**
 * Tiny adapter around the CrazyGames HTML5 SDK v3.
 * Outside CrazyGames (GitHub Pages, local dev) every call is a safe no-op;
 * rewarded ads resolve as "nosdk" so the game can grant the reward for testing.
 */
import { midgameAllowed } from '../core/adPolicy';

interface CGAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

interface CGSDK {
  init(): Promise<void>;
  environment: 'local' | 'crazygames' | 'disabled';
  ad: { requestAd(type: 'midgame' | 'rewarded', callbacks: CGAdCallbacks): void };
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    happytime?(): void;
  };
}

declare global {
  interface Window {
    CrazyGames?: { SDK: CGSDK };
  }
}

export type RewardResult = 'rewarded' | 'failed' | 'nosdk';

export interface AdHooks {
  /** called when an ad actually starts: pause the game + mute audio */
  onAdStart(): void;
  /** called when the ad finished or failed: resume */
  onAdEnd(): void;
}

class Ads {
  private sdk: CGSDK | null = null;
  private playing = false;
  private loading = false;
  private lastMidgame = 0;
  private readonly sessionStart = Date.now();
  private hooks: AdHooks = { onAdStart: () => {}, onAdEnd: () => {} };

  get available(): boolean {
    return this.sdk !== null;
  }

  setHooks(h: AdHooks): void {
    this.hooks = h;
  }

  async init(): Promise<void> {
    if (__TARGET__ !== 'crazygames') return;
    const sdk = window.CrazyGames?.SDK;
    if (!sdk) return;
    try {
      await Promise.race([sdk.init(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000))]);
      if (sdk.environment !== 'disabled') this.sdk = sdk;
    } catch {
      this.sdk = null;
    }
  }

  private safe(fn: (s: CGSDK) => void): void {
    if (!this.sdk) return;
    try {
      fn(this.sdk);
    } catch {
      /* never let the SDK break the game */
    }
  }

  loadingStart(): void {
    if (this.loading) return;
    this.loading = true;
    this.safe((s) => s.game.loadingStart());
  }

  loadingStop(): void {
    if (!this.loading) return;
    this.loading = false;
    this.safe((s) => s.game.loadingStop());
  }

  /** Idempotent: only forwards real state changes. */
  setGameplay(active: boolean): void {
    if (active === this.playing) return;
    this.playing = active;
    this.safe((s) => (active ? s.game.gameplayStart() : s.game.gameplayStop()));
  }

  happytime(): void {
    this.safe((s) => s.game.happytime?.());
  }

  private request(type: 'midgame' | 'rewarded'): Promise<boolean> {
    return new Promise((resolve) => {
      const sdk = this.sdk;
      if (!sdk) return resolve(false);
      let started = false;
      let done = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        if (started) this.hooks.onAdEnd();
        resolve(ok);
      };
      try {
        sdk.ad.requestAd(type, {
          adStarted: () => {
            started = true;
            this.hooks.onAdStart();
          },
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch {
        finish(false);
      }
    });
  }

  async rewarded(): Promise<RewardResult> {
    if (!this.sdk) return 'nosdk';
    return (await this.request('rewarded')) ? 'rewarded' : 'failed';
  }

  /** Midgame ad between levels only: never before level 3 is done, at most one every 3 minutes. */
  async midgame(completedLevel: number, now = Date.now()): Promise<void> {
    if (!this.sdk) return;
    if (!midgameAllowed(completedLevel, now, this.lastMidgame, this.sessionStart)) return;
    this.lastMidgame = now;
    await this.request('midgame');
  }
}

export const ads = new Ads();
