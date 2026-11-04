import { CAPACITY, type Board } from '../core/board';
import { h, reducedMotion } from './dom';
import { COLORS, SYMBOLS } from './palette';

interface Geo {
  d: number;
  tubeW: number;
  tubeH: number;
  x: number[];
  y: number[];
}

interface BallEl extends HTMLDivElement {
  _anim?: Animation;
  _x?: number;
  _y?: number;
}

/**
 * DOM board: tubes are buttons, balls are absolutely positioned divs living in board coordinates,
 * so they can glide from one tube to another (Web Animations API). All rules live in core/board.ts;
 * this class only draws what the game tells it.
 */
export class BoardView {
  readonly el: HTMLDivElement;
  private tubes: HTMLButtonElement[] = [];
  private balls: BallEl[][] = [];
  private geo: Geo | null = null;
  private lifted: number | null = null;
  private ro: ResizeObserver | null = null;

  constructor(private onTap: (tube: number) => void) {
    this.el = h('div', { class: 'board', 'data-testid': 'board' });
    // the whole board is the touch surface: a tap goes to the nearest tube, so even narrow tubes are easy to hit
    this.el.addEventListener('pointerdown', (e) => {
      const i = this.tubeAt(e.clientX, e.clientY);
      if (i < 0) return;
      e.preventDefault();
      this.onTap(i);
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.layout(false));
      this.ro.observe(this.el);
    }
  }

  destroy(): void {
    this.ro?.disconnect();
  }

  setBoard(board: Board): void {
    this.el.textContent = '';
    this.tubes = [];
    this.balls = [];
    this.lifted = null;
    board.forEach((t) => {
      this.addTubeEl();
      for (const c of t) this.balls[this.balls.length - 1]!.push(this.makeBall(c));
    });
    this.layout(false);
  }

  private addTubeEl(): void {
    const i = this.tubes.length;
    const btn = h('button', {
      class: 'tube',
      type: 'button',
      'data-testid': `tube-${i}`,
      'aria-label': `${i + 1}`,
      onkeydown: (e: Event) => {
        const k = (e as KeyboardEvent).key;
        if (k === 'Enter' || k === ' ') {
          e.preventDefault();
          this.onTap(i);
        }
      },
    });
    this.tubes.push(btn);
    this.balls.push([]);
    this.el.append(btn);
  }

  private makeBall(color: number): BallEl {
    const b = h('div', { class: 'ball', 'data-color': color }) as BallEl;
    b.style.setProperty('--c', COLORS[color % COLORS.length]!);
    b.innerHTML = `<svg class="sym" viewBox="0 0 24 24" aria-hidden="true">${SYMBOLS[color % SYMBOLS.length]}</svg>`;
    this.el.append(b);
    return b;
  }

  addTube(): void {
    this.addTubeEl();
    const t = this.tubes[this.tubes.length - 1]!;
    t.classList.add('appear');
    this.layout(true);
  }

  /** Compute the best grid (1–3 rows) for the available space and place everything. */
  layout(animate: boolean): void {
    const W = this.el.clientWidth;
    const H = this.el.clientHeight;
    const n = this.tubes.length;
    if (!W || !H || !n) return;
    let best: { rows: number; d: number } = { rows: 1, d: 0 };
    for (let rows = 1; rows <= 3; rows++) {
      const perRow = Math.ceil(n / rows);
      const byW = W / perRow / 1.42;
      const byH = H / rows / (CAPACITY * 1.06 + 0.45 + 1.25);
      const d = Math.min(byW, byH, 62);
      if (d > best.d + 0.5) best = { rows, d };
    }
    const { rows } = best;
    const d = Math.floor(best.d);
    const tubeW = Math.round(d * 1.24);
    const tubeH = Math.round(d * (CAPACITY * 1.06 + 0.45));
    const rowH = H / rows;
    const perRow = Math.ceil(n / rows);
    const x: number[] = [];
    const y: number[] = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / perRow);
      const inRow = r === rows - 1 ? n - perRow * (rows - 1) : perRow;
      const col = i - r * perRow;
      const colW = W / perRow;
      const offset = (W - inRow * colW) / 2;
      x.push(Math.round(offset + colW * col + (colW - tubeW) / 2));
      y.push(Math.round(rowH * r + (rowH - tubeH) / 2 + d * 0.55));
    }
    this.geo = { d, tubeW, tubeH, x, y };
    this.el.style.setProperty('--d', `${d}px`);
    this.tubes.forEach((t, i) => {
      t.style.width = `${tubeW}px`;
      t.style.height = `${tubeH}px`;
      t.style.transform = `translate(${x[i]}px, ${y[i]}px)`;
    });
    this.balls.forEach((stack, i) =>
      stack.forEach((b, k) => {
        const lifted = this.lifted === i && k === stack.length - 1;
        const p = lifted ? this.liftPos(i) : this.slotPos(i, k);
        this.glide(b, [p], animate ? 260 : 0);
      }),
    );
  }

  /** Index of the tube closest to a screen point (within half a column / row), or -1. */
  tubeAt(clientX: number, clientY: number): number {
    const g = this.geo;
    if (!g) return -1;
    const r = this.el.getBoundingClientRect();
    const px = clientX - r.left;
    const py = clientY - r.top;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.tubes.length; i++) {
      const cx = g.x[i]! + g.tubeW / 2;
      const top = g.y[i]! - g.d * 1.2;
      const bottom = g.y[i]! + g.tubeH + g.d * 0.4;
      if (py < top || py > bottom) continue;
      const dx = Math.abs(px - cx);
      if (dx < bestD) {
        bestD = dx;
        best = i;
      }
    }
    return bestD <= g.tubeW * 1.6 ? best : -1;
  }

  private slotPos(tube: number, k: number): [number, number] {
    const g = this.geo!;
    const bx = g.x[tube]! + (g.tubeW - g.d) / 2;
    const by = g.y[tube]! + g.tubeH - g.d * 0.13 - (k + 1) * g.d * 1.04;
    return [bx, by];
  }

  private liftPos(tube: number): [number, number] {
    const g = this.geo!;
    return [g.x[tube]! + (g.tubeW - g.d) / 2, g.y[tube]! - g.d * 1.05];
  }

  /** Animate a ball through waypoints. Starts from wherever it currently is, even mid-animation. */
  private glide(b: BallEl, pts: [number, number][], duration: number, easing = 'cubic-bezier(.33,.9,.36,1)'): void {
    const end = pts[pts.length - 1]!;
    let sx = b._x ?? end[0];
    let sy = b._y ?? end[1];
    if (b._anim && b._anim.playState === 'running') {
      try {
        const m = new DOMMatrixReadOnly(getComputedStyle(b).transform);
        sx = m.m41;
        sy = m.m42;
      } catch {
        /* keep logical position */
      }
      b._anim.cancel();
    }
    b._x = end[0];
    b._y = end[1];
    b.style.transform = `translate(${end[0]}px, ${end[1]}px)`;
    if (duration <= 0 || reducedMotion() || typeof b.animate !== 'function') return;
    const frames: Keyframe[] = [{ transform: `translate(${sx}px, ${sy}px)` }];
    // offsets proportional to the distance of each leg, so speed feels even
    const all: [number, number][] = [[sx, sy], ...pts];
    const legs = all.slice(1).map((p, i) => Math.hypot(p[0] - all[i]![0], p[1] - all[i]![1]));
    const total = legs.reduce((a, c) => a + c, 0) || 1;
    let acc = 0;
    pts.forEach((p, i) => {
      acc += legs[i]!;
      frames.push({ transform: `translate(${p[0]}px, ${p[1]}px)`, offset: i === pts.length - 1 ? 1 : acc / total });
    });
    b._anim = b.animate(frames, { duration, easing });
  }

  private top(tube: number): BallEl | undefined {
    const s = this.balls[tube]!;
    return s[s.length - 1];
  }

  lift(tube: number): void {
    const b = this.top(tube);
    if (!b || !this.geo) return;
    this.lifted = tube;
    b.classList.add('up');
    this.glide(b, [this.liftPos(tube)], 170);
  }

  lower(tube: number): void {
    const b = this.top(tube);
    this.lifted = null;
    if (!b || !this.geo) return;
    b.classList.remove('up');
    this.glide(b, [this.slotPos(tube, this.balls[tube]!.length - 1)], 200, 'cubic-bezier(.5,0,.4,1.35)');
  }

  /** Move the top ball of `from` to `to` (works whether it was lifted or not). Returns the animation time in ms. */
  move(from: number, to: number): number {
    const b = this.balls[from]!.pop();
    if (!b || !this.geo) return 0;
    this.lifted = null;
    b.classList.remove('up');
    this.balls[to]!.push(b);
    const k = this.balls[to]!.length - 1;
    const pts: [number, number][] = [];
    if ((b._y ?? 0) > this.liftPos(from)[1] + 1) pts.push(this.liftPos(from));
    pts.push(this.liftPos(to), this.slotPos(to, k));
    const g = this.geo;
    const dist = Math.hypot(g.x[to]! - g.x[from]!, g.y[to]! - g.y[from]!);
    const ms = Math.round(Math.min(520, 260 + dist * 0.5));
    this.glide(b, pts, ms, 'cubic-bezier(.45,.05,.3,1)');
    return reducedMotion() ? 0 : ms;
  }

  shake(tube: number): void {
    const t = this.tubes[tube];
    if (!t || reducedMotion() || typeof t.animate !== 'function') return;
    const base = t.style.transform;
    t.animate(
      [{ transform: base }, { transform: `${base} translateX(-4px)` }, { transform: `${base} translateX(4px)` }, { transform: base }],
      { duration: 240, easing: 'ease-in-out' },
    );
  }

  setComplete(tube: number, color: number | null): void {
    const t = this.tubes[tube];
    if (!t) return;
    t.classList.toggle('done', color !== null);
    if (color !== null) t.style.setProperty('--glow', COLORS[color % COLORS.length]!);
  }

  setHint(tube: number | null): void {
    this.tubes.forEach((t, i) => t.classList.toggle('hint', i === tube));
  }

  setSelected(tube: number | null): void {
    this.tubes.forEach((t, i) => t.classList.toggle('sel', i === tube));
  }
}
