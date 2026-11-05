import './style.css';
import { Game } from './game';
import { detectLang, setLang } from './i18n';
import { getBrowserStorage, load } from './core/save';
import { ads } from './platform/ads';
import { renderCover } from './ui/cover';

async function boot(): Promise<void> {
  const root = document.getElementById('app')!;
  setLang(detectLang(load(getBrowserStorage()).settings.lang));
  // store art / video tooling only (never in the CrazyGames build)
  if (__TARGET__ !== 'crazygames' && new URLSearchParams(location.search).has('cover')) {
    document.getElementById('boot')?.remove();
    renderCover(root);
    (window as unknown as { __cover: unknown }).__cover = {
      play: (n: number) => {
        root.classList.remove('cover-mode');
        const game = new Game(root);
        (window as unknown as { __hh: unknown }).__hh = game.debug();
        game.startLevel(n);
      },
    };
    return;
  }
  await ads.init();
  ads.loadingStart();
  const game = new Game(root);
  if (__TARGET__ !== 'crazygames') {
    (window as unknown as { __hh: unknown }).__hh = game.debug();
  }
  document.getElementById('boot')?.remove();
  ads.loadingStop();
  // CrazyGames: players land directly in gameplay, on their current level (the menu stays one tap away)
  if (__TARGET__ === 'crazygames') game.startLevel(game.data.unlocked);
  else game.home();
}

void boot();
