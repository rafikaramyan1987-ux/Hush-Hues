import type { Rng } from '../../core/rng';
import { E, N, S, W, connectedCells, generatePipes, isPipesSolved, pipesHint, rotateTile, solvePipes } from '../../puzzles/pipes';
import { h, s } from '../dom';
import type { PuzzleView, ViewCtx } from './types';

const T = 100;

function armPaths(mask: number): SVGElement[] {
  const out: SVGElement[] = [s('rect', { x: 0, y: 0, width: 100, height: 100, class: 'rot-box' })];
  const arms: [number, string][] = [
    [N, 'M50 50 L50 0'],
    [E, 'M50 50 L100 50'],
    [S, 'M50 50 L50 100'],
    [W, 'M50 50 L0 50'],
  ];
  const d = arms.filter(([b]) => mask & b).map(([, p]) => p).join(' ');
  out.push(s('path', { d, class: 'pipe-case' }));
  out.push(s('path', { d, class: 'pipe-core' }));
  out.push(s('circle', { cx: 50, cy: 50, r: 13, class: 'pipe-joint' }));
  return out;
}

export function createPipesView(rng: Rng, d: number, ctx: ViewCtx): PuzzleView {
  const p = generatePipes(rng, d);
  const { size } = p;
  const visualTurns = p.rot.slice();
  let cursor = p.sourceRow * size;
  let done = false;
  const svg = s('svg', {
    viewBox: `-60 -10 ${size * T + 120} ${size * T + 20}`,
    class: 'board pipes',
    role: 'grid',
    'aria-label': 'pipes',
  });
  svg.append(
    s('rect', { x: -6, y: -6, width: size * T + 12, height: size * T + 12, rx: 14, class: 'board-bg' }),
  );
  // Source tank and valve
  svg.append(
    s('g', { class: 'tank', transform: `translate(-55 ${p.sourceRow * T + 15})` },
      s('rect', { width: 48, height: 70, rx: 12 }),
      s('text', { x: 24, y: 42, 'text-anchor': 'middle' }, 'O₂')),
    s('g', { class: 'valve-out', transform: `translate(${size * T + 8} ${p.valveRow * T + 20})` },
      s('rect', { width: 46, height: 60, rx: 10 }),
      s('circle', { cx: 23, cy: 30, r: 13 })),
  );
  const tiles: SVGGElement[] = [];
  for (let i = 0; i < size * size; i++) {
    const r = Math.floor(i / size), c = i % size;
    const inner = s('g', { class: 'rot' }, ...armPaths(p.tiles[i]!));
    const g = s('g', { class: 'tile', transform: `translate(${c * T} ${r * T})`, 'data-cell': i },
      s('rect', { x: 3, y: 3, width: T - 6, height: T - 6, rx: 10, class: 'tile-bg' }),
      inner);
    g.addEventListener('pointerup', (e) => {
      e.preventDefault();
      turn(i);
    });
    tiles.push(g);
    svg.append(g);
  }

  const render = () => {
    const on = connectedCells(p);
    tiles.forEach((g, i) => {
      const inner = g.lastChild as SVGGElement;
      inner.style.transform = `rotate(${visualTurns[i]! * 90}deg)`;
      g.classList.toggle('on', on.has(i));
      g.classList.toggle('cursor', i === cursor);
    });
    svg.classList.toggle('flowing', isPipesSolved(p));
  };

  const check = () => {
    render();
    if (!done && isPipesSolved(p)) {
      done = true;
      setTimeout(() => ctx.onSolved(), 350);
    }
  };

  const turn = (i: number) => {
    if (done) return;
    rotateTile(p, i);
    visualTurns[i]!++;
    ctx.sfx.click();
    check();
  };

  render();
  const el = h('div', { class: 'puzzle-wrap' }, svg);
  return {
    el,
    hint: () => {
      const before = p.rot.slice();
      const cell = pipesHint(p);
      if (cell < 0) return false;
      // keep visual rotation increasing (smooth forward animation)
      const delta = (((p.rot[cell]! - before[cell]!) % 4) + 4) % 4;
      visualTurns[cell]! += delta;
      tiles[cell]!.classList.add('hinted');
      check();
      return true;
    },
    solveNow: () => {
      solvePipes(p);
      p.rot.forEach((r, i) => (visualTurns[i] = r));
      check();
    },
    onKey: (e) => {
      svg.classList.add('kb');
      const r = Math.floor(cursor / size), c = cursor % size;
      if (e.key === 'ArrowUp' && r > 0) cursor -= size;
      else if (e.key === 'ArrowDown' && r < size - 1) cursor += size;
      else if (e.key === 'ArrowLeft' && c > 0) cursor -= 1;
      else if (e.key === 'ArrowRight' && c < size - 1) cursor += 1;
      else if (e.key === ' ' || e.key === 'Enter') turn(cursor);
      else return;
      e.preventDefault();
      render();
    },
  };
}
