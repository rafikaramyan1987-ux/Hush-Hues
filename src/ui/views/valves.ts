import type { Rng } from '../../core/rng';
import { gaugeTotals, generateValves, isValvesSolved, valvesHint } from '../../puzzles/valves';
import { t } from '../../i18n';
import { h, s } from '../dom';
import type { PuzzleView, ViewCtx } from './types';

const VW = 400;

export function createValvesView(rng: Rng, d: number, ctx: ViewCtx): PuzzleView {
  const p = generateValves(rng, d);
  const settings = new Array<number>(p.valves).fill(0);
  let done = false;
  const gx = (g: number) => ((g + 0.5) * VW) / p.weights.length;
  const vx = (v: number) => ((v + 0.5) * VW) / p.valves;
  const GY = 62, VY = 262;

  const svg = s('svg', { viewBox: `0 0 ${VW} 340`, class: 'board valves', 'aria-label': 'valves' });
  svg.append(s('rect', { x: 2, y: 2, width: VW - 4, height: 336, rx: 14, class: 'board-bg' }));
  const linesG = s('g', {});
  svg.append(linesG);
  p.weights.forEach((row, g) =>
    row.forEach((w, v) => {
      if (!w) return;
      linesG.append(s('line', { x1: gx(g), y1: GY + 40, x2: vx(v), y2: VY - 34, class: `feed w${w}`, 'data-g': g }));
      if (w > 1) {
        const mx = (gx(g) * 0.35 + vx(v) * 0.65), my = (GY + 40) * 0.35 + (VY - 34) * 0.65;
        linesG.append(s('g', { class: 'weight' }, s('circle', { cx: mx, cy: my, r: 15 }), s('text', { x: mx, y: my + 5, 'text-anchor': 'middle' }, `×${w}`)));
      }
    }),
  );

  const gaugeEls = p.weights.map((_, g) => {
    const cur = s('text', { x: gx(g), y: GY + 2, 'text-anchor': 'middle', class: 'g-cur' }, '0');
    const tgt = s('text', { x: gx(g), y: GY + 24, 'text-anchor': 'middle', class: 'g-tgt' }, `/ ${p.targets[g]}`);
    const ring = s('circle', { cx: gx(g), cy: GY, r: 40, class: 'g-ring' });
    const grp = s('g', { class: 'gauge', 'aria-label': t('gauge', { n: g + 1 }) }, ring, cur, tgt);
    svg.append(grp);
    return { grp, cur };
  });

  const valveEls = settings.map((_, v) => {
    const spokes = s('g', { class: 'spokes' },
      s('line', { x1: vx(v) - 22, y1: VY, x2: vx(v) + 22, y2: VY }),
      s('line', { x1: vx(v), y1: VY - 22, x2: vx(v), y2: VY + 22 }));
    const val = s('text', { x: vx(v), y: VY + 7, 'text-anchor': 'middle', class: 'v-val' }, '0');
    const wheel = s('g', { class: 'wheel', tabindex: 0, role: 'button', 'aria-label': t('valve', { n: v + 1 }), 'data-valve': v },
      s('circle', { cx: vx(v), cy: VY, r: 30, class: 'v-ring' }), spokes, s('circle', { cx: vx(v), cy: VY, r: 14, class: 'v-hub' }), val);
    const minus = s('g', { class: 'v-btn', role: 'button', tabindex: 0, 'data-minus': v }, s('circle', { cx: vx(v) - 20, cy: VY + 52, r: 16 }), s('text', { x: vx(v) - 20, y: VY + 58, 'text-anchor': 'middle' }, '−'));
    const plus = s('g', { class: 'v-btn', role: 'button', tabindex: 0, 'data-plus': v }, s('circle', { cx: vx(v) + 20, cy: VY + 52, r: 16 }), s('text', { x: vx(v) + 20, y: VY + 58, 'text-anchor': 'middle' }, '+'));
    wheel.addEventListener('pointerup', (e) => { e.preventDefault(); change(v, settings[v]! >= p.maxSetting ? -p.maxSetting : 1); });
    minus.addEventListener('pointerup', (e) => { e.preventDefault(); change(v, -1); });
    plus.addEventListener('pointerup', (e) => { e.preventDefault(); change(v, 1); });
    wheel.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp' || e.key === 'ArrowRight' || e.key === '+') change(v, 1);
      else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === '-') change(v, -1);
      else if (e.key === 'Enter' || e.key === ' ') change(v, settings[v]! >= p.maxSetting ? -p.maxSetting : 1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    });
    svg.append(wheel, minus, plus);
    return { spokes, val };
  });

  const render = () => {
    const totals = gaugeTotals(p, settings);
    gaugeEls.forEach(({ grp, cur }, g) => {
      cur.textContent = String(totals[g]);
      grp.classList.toggle('ok', totals[g] === p.targets[g]);
      grp.classList.toggle('over', totals[g]! > p.targets[g]!);
    });
    valveEls.forEach(({ spokes, val }, v) => {
      val.textContent = String(settings[v]);
      spokes.style.transform = `rotate(${settings[v]! * 45}deg)`;
    });
  };

  const check = () => {
    render();
    if (!done && isValvesSolved(p, settings)) {
      done = true;
      svg.classList.add('flowing');
      setTimeout(() => ctx.onSolved(), 400);
    }
  };

  const change = (v: number, delta: number) => {
    if (done) return;
    const nv = Math.max(0, Math.min(p.maxSetting, settings[v]! + delta));
    if (nv === settings[v]) return;
    settings[v] = nv;
    ctx.sfx.click();
    check();
  };

  render();
  return {
    el: h('div', { class: 'puzzle-wrap' }, svg),
    hint: () => {
      const v = valvesHint(p, settings);
      if (v < 0) return false;
      check();
      return true;
    },
    solveNow: () => {
      p.solution.forEach((x, i) => (settings[i] = x));
      check();
    },
  };
}
