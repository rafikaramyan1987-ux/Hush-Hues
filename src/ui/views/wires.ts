import type { Rng } from '../../core/rng';
import { adjacent, generateWires, isPathComplete, isWiresSolved, terminalColor, type WirePaths } from '../../puzzles/wires';
import { cellFromPoint, h, s } from '../dom';
import { COLORS, type PuzzleView, type ViewCtx } from './types';

const T = 100;

export function createWiresView(rng: Rng, d: number, ctx: ViewCtx): PuzzleView {
  const p = generateWires(rng, d);
  const { size } = p;
  const paths: WirePaths = p.terminals.map(() => []);
  let active = -1;
  let done = false;
  let cursor = p.terminals[0]![0];
  let kbDrawing = false;

  const svg = s('svg', { viewBox: `-8 -8 ${size * T + 16} ${size * T + 16}`, class: 'board wires', 'aria-label': 'wires' });
  svg.append(s('rect', { x: -6, y: -6, width: size * T + 12, height: size * T + 12, rx: 14, class: 'board-bg' }));
  for (let i = 0; i < size * size; i++) {
    const r = Math.floor(i / size), c = i % size;
    svg.append(s('rect', { x: c * T + 4, y: r * T + 4, width: T - 8, height: T - 8, rx: 10, class: 'cell-bg' }));
  }
  const lines = s('g', { class: 'wire-lines' });
  const terms = s('g', {});
  const cur = s('rect', { width: T - 4, height: T - 4, rx: 12, class: 'kb-cursor' });
  svg.append(lines, terms, cur);
  p.terminals.forEach(([a, b], color) => {
    for (const cell of [a, b]) {
      const r = Math.floor(cell / size), c = cell % size;
      terms.append(
        s('circle', { cx: c * T + 50, cy: r * T + 50, r: 30, fill: COLORS[color]!, class: 'terminal' }),
        s('circle', { cx: c * T + 50, cy: r * T + 50, r: 12, class: 'terminal-core' }),
      );
    }
  });

  const pt = (cell: number) => `${(cell % size) * T + 50},${Math.floor(cell / size) * T + 50}`;

  const render = () => {
    lines.replaceChildren();
    paths.forEach((path, color) => {
      if (path.length < 1) return;
      const complete = isPathComplete(p, color, path);
      const points = path.map(pt).join(' ');
      lines.append(
        s('polyline', { points, class: `wire${complete ? ' complete' : ''}`, stroke: COLORS[color]! }),
      );
    });
    cur.setAttribute('x', String((cursor % size) * T + 2));
    cur.setAttribute('y', String(Math.floor(cursor / size) * T + 2));
  };

  const owner = (cell: number): number => paths.findIndex((pa) => pa.includes(cell));

  const extend = (color: number, n: number): boolean => {
    const path = paths[color]!;
    const last = path[path.length - 1];
    if (last === undefined || !adjacent(size, last, n)) return false;
    const idx = path.indexOf(n);
    if (idx >= 0) {
      path.length = idx + 1; // backtrack
      return true;
    }
    if (isPathComplete(p, color, path)) return false;
    const tc = terminalColor(p, n);
    if (tc !== -1 && tc !== color) return false;
    if (tc === color && n === path[0]) return false;
    const o = owner(n);
    if (o !== -1 && o !== color) {
      const op = paths[o]!;
      op.length = op.indexOf(n); // cut the other wire
    }
    path.push(n);
    ctx.sfx.click();
    return true;
  };

  const begin = (cell: number): boolean => {
    const tc = terminalColor(p, cell);
    if (tc !== -1) {
      paths[tc] = [cell];
      active = tc;
      return true;
    }
    const o = owner(cell);
    if (o !== -1) {
      const path = paths[o]!;
      path.length = path.indexOf(cell) + 1;
      active = o;
      return true;
    }
    return false;
  };

  const moveTo = (cell: number) => {
    if (active < 0 || cell < 0) return;
    const path = paths[active]!;
    let guard = 0;
    while (path[path.length - 1] !== cell && guard++ < 2 * size) {
      const last = path[path.length - 1]!;
      const lr = Math.floor(last / size), lc = last % size;
      const tr = Math.floor(cell / size), tc = cell % size;
      const dr = Math.sign(tr - lr), dc = Math.sign(tc - lc);
      const step = Math.abs(tr - lr) >= Math.abs(tc - lc) ? last + dr * size : last + dc;
      if (!extend(active, step)) break;
    }
    render();
  };

  const finish = () => {
    if (active >= 0 && isPathComplete(p, active, paths[active])) ctx.sfx.snap();
    active = -1;
    render();
    if (!done && isWiresSolved(p, paths)) {
      done = true;
      svg.classList.add('flowing');
      setTimeout(() => ctx.onSolved(), 350);
    }
  };

  svg.addEventListener('pointerdown', (e) => {
    if (done) return;
    const cell = cellFromPoint(svg, e.clientX, e.clientY, size, (8 / (size * T + 16)) * svg.getBoundingClientRect().width);
    if (cell >= 0 && begin(cell)) {
      svg.setPointerCapture(e.pointerId);
      render();
    }
    e.preventDefault();
  });
  svg.addEventListener('pointermove', (e) => {
    if (active < 0) return;
    const pad = (8 / (size * T + 16)) * svg.getBoundingClientRect().width;
    moveTo(cellFromPoint(svg, e.clientX, e.clientY, size, pad));
  });
  const up = () => {
    if (active >= 0) finish();
  };
  svg.addEventListener('pointerup', up);
  svg.addEventListener('pointercancel', up);

  render();
  return {
    el: h('div', { class: 'puzzle-wrap' }, svg),
    hint: () => {
      const color = p.terminals.findIndex((_, c) => !isPathComplete(p, c, paths[c]));
      if (color < 0) return false;
      const sol = p.solution[color]!;
      // clear anything in the way, then lay the known wire
      paths.forEach((path, o) => {
        if (o === color) return;
        const hit = path.findIndex((c) => sol.includes(c));
        if (hit >= 0) path.length = hit;
      });
      paths[color] = sol.slice();
      active = color;
      finish();
      return true;
    },
    solveNow: () => {
      p.solution.forEach((sol, c) => (paths[c] = sol.slice()));
      active = -1;
      finish();
    },
    onKey: (e) => {
      svg.classList.add('kb');
      const r = Math.floor(cursor / size), c = cursor % size;
      let next = cursor;
      if (e.key === 'ArrowUp' && r > 0) next -= size;
      else if (e.key === 'ArrowDown' && r < size - 1) next += size;
      else if (e.key === 'ArrowLeft' && c > 0) next -= 1;
      else if (e.key === 'ArrowRight' && c < size - 1) next += 1;
      else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (kbDrawing) {
          kbDrawing = false;
          finish();
        } else if (begin(cursor)) kbDrawing = true;
        render();
        return;
      } else return;
      e.preventDefault();
      cursor = next;
      if (kbDrawing) {
        moveTo(next);
        const path = paths[active] ?? [];
        cursor = path[path.length - 1] ?? next;
        if (active >= 0 && isPathComplete(p, active, path)) {
          kbDrawing = false;
          finish();
        }
      }
      render();
    },
  };
}
