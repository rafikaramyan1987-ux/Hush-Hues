import type { Mechanic } from '../core/schedule';
import { h } from './dom';
import { LOCK_SVG } from './icons';
import { COLORS, SYMBOLS } from './palette';

/** Small static pictures for the mechanic intro screens, drawn with the same balls and tubes as the game. */
const ball = (c: number, cls = '') => {
  const b = h('span', { class: `mini-ball ${cls}` });
  b.style.setProperty('--c', COLORS[c]!);
  b.innerHTML = `<svg class="sym" viewBox="0 0 24 24" aria-hidden="true">${SYMBOLS[c]}</svg><span class="q">?</span>`;
  return b;
};
const tube = (balls: HTMLElement[], cap = 4, cls = '') => {
  const t = h('span', { class: `mini-tube ${cls}`, style: `--cap:${cap}` });
  t.append(...balls);
  return t;
};

export function introArt(m: Mechanic): HTMLElement {
  const art = h('div', { class: `intro-art art-${m}`, 'aria-hidden': 'true' });
  switch (m) {
    case 'oneEmpty':
      art.append(tube([ball(0), ball(1), ball(0), ball(1)]), tube([ball(1), ball(0), ball(1), ball(0)]), tube([], 4, 'glow'));
      break;
    case 'hidden':
      art.append(tube([ball(2, 'hidden'), ball(0, 'hidden'), ball(1, 'hidden'), ball(2)]), tube([ball(1, 'hidden'), ball(2)]), tube([]));
      break;
    case 'tall':
      art.append(tube([ball(3), ball(3), ball(3), ball(3), ball(3)], 5, 'glow'), tube([ball(1), ball(4), ball(1)], 5));
      break;
    case 'lock': {
      const locked = tube([ball(2), ball(1), ball(4), ball(1)], 4, 'locked');
      const badge = h('span', { class: 'mini-lock' });
      badge.style.setProperty('--c', COLORS[0]!);
      badge.innerHTML = `${LOCK_SVG}<span class="key"></span>`;
      locked.append(badge);
      art.append(tube([ball(0), ball(0), ball(0), ball(0)], 4, 'glow'), locked);
      break;
    }
    case 'helper':
      art.append(tube([ball(5), ball(6), ball(5), ball(6)]), tube([ball(6), ball(5)], 2, 'glow'), tube([]));
      break;
    case 'frozen':
      art.append(tube([ball(7), ball(8), ball(7, 'frozen')]), tube([ball(8), ball(7)], 4, 'glow'));
      break;
  }
  return art;
}
