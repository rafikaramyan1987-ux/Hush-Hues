import { FROZEN, type Puzzle, type State } from '../core/board';
import { BoardView } from './boardView';
import { h } from './dom';

/**
 * Marketing cover scene: the real game background, tubes and balls, and the title as the only text.
 * Used for the CrazyGames covers and as the first frame of the preview videos (`?cover`).
 */
export function renderCover(root: HTMLElement): BoardView {
  root.classList.add('cover-mode');
  const balls = [
    [0, 0, 0, 0],
    [2, 1, 4, 1],
    [1, 2, 2, 2],
    [3, 3, 3, 3],
    [4, 4, 1],
    [],
  ];
  const tubes = balls.map(() => ({ cap: 4, lock: null as number | null }));
  // tall formats: two rows of three; wide and square formats: one row
  const perRow = window.innerHeight > window.innerWidth * 1.2 ? 3 : balls.length;
  const puzzle: Puzzle = { tubes, perColor: 4, perRow };
  const state: State = { balls: balls.map((t) => t.map((b) => b & ~FROZEN)), locked: balls.map(() => false) };
  const view = new BoardView(() => {});
  view.maxBall = 200;
  const scene = h('section', { class: 'cover', 'data-testid': 'cover' }, h('h1', { class: 'cover-title', text: 'Hush Hues' }), view.el);
  root.querySelector('#screen')!.replaceChildren(scene);
  view.setBoard(puzzle, state, []);
  view.setComplete(0, 0);
  view.setComplete(3, 3);
  requestAnimationFrame(() => {
    view.layout(false);
    view.lift(1);
  });
  return view;
}
