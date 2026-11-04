import type { Rng } from '../../core/rng';
import { applyMove, cargoHint, generateCargo, isCargoSolved, slideRange, solveCargo, type Move } from '../../puzzles/cargo';
import { h } from '../dom';
import type { PuzzleView, ViewCtx } from './types';

export function createCargoView(rng: Rng, d: number, ctx: ViewCtx): PuzzleView {
  const p = generateCargo(rng, d);
  const { size } = p;
  let done = false;
  let moves = 0;
  let selected = 0;

  const board = h('div', { class: 'board cargo', style: `--n:${size}` });
  board.append(h('div', { class: 'hatch', style: `top:${(p.exitRow / size) * 100}%;height:${100 / size}%` }));
  const counter = h('div', { class: 'moves' }, '0');
  const els = p.crates.map((c, i) => {
    const b = h('button', {
      type: 'button',
      class: `crate ${c.dir}${i === 0 ? ' cart' : ''}`,
      'aria-label': i === 0 ? 'oxygen cart' : `crate ${i}`,
      'data-crate': i,
    });
    board.append(b);
    return b;
  });

  const place = () => {
    p.crates.forEach((c, i) => {
      const el = els[i]!;
      el.style.left = `${(c.x / size) * 100}%`;
      el.style.top = `${(c.y / size) * 100}%`;
      el.style.width = `${((c.dir === 'h' ? c.len : 1) / size) * 100}%`;
      el.style.height = `${((c.dir === 'v' ? c.len : 1) / size) * 100}%`;
      el.style.transform = '';
      el.classList.toggle('selected', i === selected);
    });
    counter.textContent = String(moves);
  };

  const commit = (m: Move) => {
    const c = p.crates[m.crate]!;
    if ((c.dir === 'h' ? c.x : c.y) === m.to) return;
    p.crates = applyMove(p.crates, m);
    moves++;
    ctx.sfx.snap();
    place();
    if (!done && isCargoSolved(p)) {
      done = true;
      els[0]!.classList.add('leaving');
      setTimeout(() => ctx.onSolved(), 450);
    }
  };

  els.forEach((el, i) => {
    let startX = 0, startY = 0, range: [number, number] = [0, 0], dragging = false;
    el.addEventListener('pointerdown', (e) => {
      if (done) return;
      selected = i;
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
      range = slideRange(size, p.crates, i);
      el.setPointerCapture(e.pointerId);
      el.classList.add('dragging');
      place();
      e.preventDefault();
    });
    el.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const c = p.crates[i]!;
      const cell = board.getBoundingClientRect().width / size;
      const cur = c.dir === 'h' ? c.x : c.y;
      const raw = (c.dir === 'h' ? e.clientX - startX : e.clientY - startY) / cell;
      const delta = Math.max(range[0] - cur, Math.min(range[1] - cur, raw));
      el.style.transform = c.dir === 'h' ? `translateX(${delta * cell}px)` : `translateY(${delta * cell}px)`;
    });
    const end = (e: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      el.classList.remove('dragging');
      const c = p.crates[i]!;
      const cell = board.getBoundingClientRect().width / size;
      const cur = c.dir === 'h' ? c.x : c.y;
      const raw = (c.dir === 'h' ? e.clientX - startX : e.clientY - startY) / cell;
      const to = Math.round(Math.max(range[0], Math.min(range[1], cur + raw)));
      if (to !== cur) commit({ crate: i, to });
      else place();
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('focus', () => {
      selected = i;
      place();
    });
  });

  place();
  return {
    el: h('div', { class: 'puzzle-wrap' }, board, counter),
    hint: () => {
      const m = cargoHint(p);
      if (!m) return false;
      selected = m.crate;
      els[m.crate]!.classList.add('hinted');
      commit(m);
      return true;
    },
    solveNow: () => {
      const sol = solveCargo(size, p.crates) ?? [];
      for (const m of sol) commit(m);
    },
    onKey: (e) => {
      const c = p.crates[selected]!;
      const cur = c.dir === 'h' ? c.x : c.y;
      const [lo, hi] = slideRange(size, p.crates, selected);
      const dec = c.dir === 'h' ? 'ArrowLeft' : 'ArrowUp';
      const inc = c.dir === 'h' ? 'ArrowRight' : 'ArrowDown';
      if (e.key === dec && cur > lo) commit({ crate: selected, to: cur - 1 });
      else if (e.key === inc && cur < hi) commit({ crate: selected, to: cur + 1 });
      else if (e.key === 'Tab') return;
      else if (e.key === ' ' || e.key === 'Enter') {
        selected = (selected + 1) % p.crates.length;
        els[selected]!.focus();
      } else return;
      e.preventDefault();
    },
  };
}
