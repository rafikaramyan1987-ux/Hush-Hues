import './style.css';
import { Game } from './game';
import { detectLang, setLang } from './i18n';
import { getBrowserStorage, load } from './core/save';
import { ads } from './platform/ads';

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  setLang(detectLang(load(getBrowserStorage()).settings.lang));
  await ads.init();
  ads.loadingStart();
  const game = new Game(root);
  if (__TARGET__ !== 'crazygames') {
    (window as unknown as { __hh: unknown }).__hh = game.debug();
  }
  document.getElementById('boot')?.remove();
  ads.loadingStop();
  // CrazyGames asks that new players land in gameplay quickly: a first-time player starts level 1 directly there.
  if (__TARGET__ === 'crazygames' && game.data.unlocked === 1 && game.data.stars.length === 0) game.startLevel(1);
  else game.home();
}

void boot();
