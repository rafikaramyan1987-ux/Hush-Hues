import './style.css';
import { Game } from './game';
import { detectLang, setLang } from './i18n';
import { load, getBrowserStorage } from './core/save';
import { ads } from './platform/ads';
import { drawStars } from './ui/stars';

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  setLang(detectLang(load(getBrowserStorage()).settings.lang));
  drawStars(document.getElementById('stars') as HTMLCanvasElement);
  await ads.init();
  ads.loadingStart();
  const game = new Game(root);
  if (__TARGET__ !== 'crazygames') {
    (window as unknown as { __lb: unknown }).__lb = game.debug();
  }
  document.getElementById('boot')?.remove();
  ads.loadingStop();
  // CrazyGames asks that new players land in gameplay quickly: first-time players skip the title screen there.
  if (__TARGET__ === 'crazygames' && game.data.stats.runs === 0) void game.startRun(false);
  else game.menu();
}

void boot();
