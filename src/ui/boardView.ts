import { colorOf, isFrozen, type Puzzle, type State } from '../core/board';
import { h, reducedMotion } from './dom';
import { LOCK_SVG } from './icons';
import { COLORS, SYMBOLS } from './palette';

interface Geo {
  d: number;
  tubeW: number;
  x: number[];
  y: number[];
  hgt: number[];
  liftY: number[];
}

interface BallEl extends HTMLDivElement {
  _anim?: Animation;
  _x?: number;
  _y?: number;
  _hidden?: boolean;
}

const tubeHeight = (d: number, cap: number) => Math.round(d * (cap * 1.06 + 0.45));

/**
 * DOM board: tubes are buttons, balls are absolutely positioned divs living in board coordinates,
 * so they can glide from one tube to another (Web Animations API). All rules live in core/board.ts;
 * this class only draws what the game tells it.
 */
export class BoardView {
  readonly el: HTMLDivElement;
  private tubes: HTMLButtonElement[] = [];
  private balls: BallEl[][] = [];
  private caps: number[] = [];
  private perColor = 4;
  private perRow = 5;
  private geo: Geo | null = null;
  private lifted: number | null = null;
  private ro: ResizeObserver | null = null;

  /** largest ball size in px (the cover scene draws bigger balls than the game) */
  maxBall = 62;

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

  /** Full render. `hidden[t][k]` marks balls that still show "?". */
  setBoard(p: Puzzle, s: State, hidden: boolean[][]): void {
    this.el.textContent = '';
    this.tubes = [];
    this.balls = [];
    this.caps = [];
    this.lifted = null;
    this.perColor = p.perColor;
    this.perRow = p.perRow;
    p.tubes.forEach((def, i) => {
      this.addTubeEl(def.cap, def.lock);
      s.balls[i]!.forEach((b, k) => this.balls[i]!.push(this.makeBall(b, !!hidden[i]?.[k])));
    });
    this.applyStatus(s, false);
    this.layout(false);
  }

  private addTubeEl(cap: number, lock: number | null): void {
    const i = this.tubes.length;
    const btn = h('button', {
      class: `tube${cap < this.perColor ? ' helper' : ''}`,
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
    if (lock !== null) {
      const badge = h('span', { class: 'lock', 'aria-hidden': 'true' });
      badge.style.setProperty('--c', COLORS[lock % COLORS.length]!);
      badge.innerHTML =
        LOCK_SVG +
        `<span class="key"><svg class="sym" viewBox="0 0 24 24">${SYMBOLS[lock % SYMBOLS.length]}</svg></span>`;
      btn.append(badge);
    }
    this.tubes.push(btn);
    this.balls.push([]);
    this.caps.push(cap);
    this.el.append(btn);
  }

  private makeBall(value: number, hidden: boolean): BallEl {
    const color = colorOf(value);
    const b = h('div', { class: 'ball', 'data-color': color }) as BallEl;
    b.style.setProperty('--c', COLORS[color % COLORS.length]!);
    b.innerHTML = `<svg class="sym" viewBox="0 0 24 24" aria-hidden="true">${SYMBOLS[color % SYMBOLS.length]}</svg><span class="q" aria-hidden="true">?</span>`;
    b._hidden = hidden;
    b.classList.toggle('hidden', hidden);
    this.el.append(b);
    return b;
  }

  addTube(cap: number): void {
    this.addTubeEl(cap, null);
    this.tubes[this.tubes.length - 1]!.classList.add('appear');
    this.layout(true);
  }

  /** Frozen balls and locks, read from the state (after a move, an undo, a restart). */
  applyStatus(s: State, animate = true): void {
    this.balls.forEach((stack, t) =>
      stack.forEach((b, k) => {
        const frozen = isFrozen(s.balls[t]?.[k] ?? 0);
        if (b.classList.contains('frozen') && !frozen && animate) this.pulse(b, 'thaw');
        b.classList.toggle('frozen', frozen);
      }),
    );
    this.tubes.forEach((t, i) => {
      const locked = !!s.locked[i];
      if (t.classList.contains('locked') && !locked && animate) this.pulse(t, 'unlock');
      t.classList.toggle('locked', locked);
    });
  }

  /** Every ball that is on top shows its colour from now on. Returns true if one was revealed. */
  revealTops(): boolean {
    let any = false;
    for (const stack of this.balls) {
      const b = stack[stack.length - 1];
      if (b && b._hidden) {
        b._hidden = false;
        b.classList.remove('hidden');
        this.pulse(b, 'reveal');
        any = true;
      }
    }
    return any;
  }

  private pulse(el: HTMLElement, cls: string): void {
    if (reducedMotion()) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    window.setTimeout(() => el.classList.remove(cls), 700);
  }

  /** Place tubes in fixed rows (perRow comes from the level) and size everything to the space available. */
  layout(animate: boolean): void {
    const W = this.el.clientWidth;
    const H = this.el.clientHeight;
    const n = this.tubes.length;
    if (!W || !H || !n) return;
    const perRow = Math.max(1, Math.min(this.perRow, n));
    const rows = Math.ceil(n / perRow);
    const cap = this.perColor;
    const byW = W / perRow / 1.42;
    const byH = H / rows / (cap * 1.06 + 0.45 + 1.3);
    const d = Math.floor(Math.min(byW, byH, this.maxBall));
    const tubeW = Math.round(d * 1.24);
    const fullH = tubeHeight(d, cap);
    const rowH = H / rows;
    const x: number[] = [];
    const y: number[] = [];
    const hgt: number[] = [];
    const liftY: number[] = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / perRow);
      const inRow = Math.min(perRow, n - r * perRow);
      const col = i - r * perRow;
      const colW = W / perRow;
      const offset = (W - inRow * colW) / 2;
      const top = Math.round(rowH * r + (rowH - fullH) / 2 + d * 0.6);
      const th = tubeHeight(d, this.caps[i]!);
      x.push(Math.round(offset + colW * col + (colW - tubeW) / 2));
      // shorter (helper) tubes stand on the same floor as the others
      y.push(top + fullH - th);
      hgt.push(th);
      liftY.push(top - d * 1.08);
    }
    this.geo = { d, tubeW, x, y, hgt, liftY };
    this.el.style.setProperty('--d', `${d}px`);
    this.tubes.forEach((t, i) => {
      t.style.width = `${tubeW}px`;
      t.style.height = `${hgt[i]}px`;
      t.style.transform = `translate(${x[i]}px, ${y[i]}px)`;
    });
    this.balls.forEach((stack, i) =>
      stack.forEach((b, k) => {
        const lifted = this.lifted === i && k === stack.length - 1;
        this.glide(b, [lifted ? this.liftPos(i) : this.slotPos(i, k)], animate ? 260 : 0);
      }),
    );
  }

  /** Index of the tube closest to a screen point, or -1. */
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
      if (py < g.liftY[i]! - g.d * 0.2 || py > g.y[i]! + g.hgt[i]! + g.d * 0.4) continue;
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
    return [g.x[tube]! + (g.tubeW - g.d) / 2, g.y[tube]! + g.hgt[tube]! - g.d * 0.13 - (k + 1) * g.d * 1.04];
  }

  private liftPos(tube: number): [number, number] {
    const g = this.geo!;
    return [g.x[tube]! + (g.tubeW - g.d) / 2, g.liftY[tube]!];
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
