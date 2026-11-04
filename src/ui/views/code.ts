import type { Rng } from '../../core/rng';
import { WRONG_CODE_PENALTY_S } from '../../core/balance';
import { generateCode, isCodeCorrect, type CodeClue } from '../../puzzles/code';
import { t } from '../../i18n';
import { h } from '../dom';
import type { PuzzleView, ViewCtx } from './types';

function clueText(c: CodeClue): string {
  if (c.kind === 'sum') return t('clueSum', { n: c.value });
  if (c.exact === 0 && c.misplaced === 0) return t('clueNothing');
  const parts: string[] = [];
  if (c.exact) parts.push(c.exact === 1 ? t('clueExact1') : t('clueExactN', { n: c.exact }));
  if (c.misplaced) parts.push(c.misplaced === 1 ? t('clueMisplaced1') : t('clueMisplacedN', { n: c.misplaced }));
  return parts.join(' · ');
}

export function createCodeView(rng: Rng, d: number, ctx: ViewCtx): PuzzleView {
  const p = generateCode(rng, d);
  const entry: number[] = [];
  const revealed: (number | null)[] = p.code.map(() => null);
  let done = false;

  const slots = h('div', { class: 'code-slots', 'aria-live': 'polite' });
  const clueList = h('ul', { class: 'clues' });
  const renderClues = () => {
    clueList.replaceChildren(
      ...p.clues.map((c) =>
        h('li', { class: 'clue' },
          c.kind === 'guess' ? h('span', { class: 'clue-digits' }, ...c.guess.map((g) => h('b', {}, g))) : null,
          h('span', { class: 'clue-text' }, clueText(c))),
      ),
      h('li', { class: 'clue note' }, t('codeAllDifferent')),
    );
  };
  const renderSlots = () => {
    slots.replaceChildren(
      ...p.code.map((_, i) =>
        h('span', { class: `slot${revealed[i] !== null ? ' revealed' : ''}${i === entry.length ? ' next' : ''}` },
          entry[i] ?? (revealed[i] !== null ? String(revealed[i]) : '')),
      ),
    );
  };

  const submit = () => {
    if (isCodeCorrect(p, entry)) {
      done = true;
      slots.classList.add('ok');
      ctx.sfx.snap();
      setTimeout(() => ctx.onSolved(), 400);
    } else {
      ctx.sfx.fail();
      ctx.onPenalty(WRONG_CODE_PENALTY_S);
      slots.classList.remove('bad');
      void slots.offsetWidth;
      slots.classList.add('bad');
      setTimeout(() => {
        entry.length = 0;
        renderSlots();
      }, 350);
    }
  };

  const press = (dgt: number) => {
    if (done || entry.length >= p.length) return;
    entry.push(dgt);
    ctx.sfx.click();
    renderSlots();
    if (entry.length === p.length) setTimeout(submit, 120);
  };
  const back = () => {
    if (done) return;
    entry.pop();
    renderSlots();
  };

  const keys = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const pad = h('div', { class: 'keypad' },
    ...keys.map((k) => h('button', { class: 'key', type: 'button', 'data-digit': k, onclick: () => press(k) }, k)),
    h('button', { class: 'key alt', type: 'button', onclick: back, 'aria-label': t('codeClear') }, '⌫'),
    h('button', { class: 'key', type: 'button', 'data-digit': 0, onclick: () => press(0) }, 0),
    h('button', { class: 'key alt', type: 'button', onclick: () => { entry.length = 0; renderSlots(); }, 'aria-label': t('codeClear') }, 'C'),
  );

  renderClues();
  renderSlots();
  return {
    el: h('div', { class: 'puzzle-wrap code' }, h('div', { class: 'lock-panel' }, slots), clueList, pad),
    hint: () => {
      const i = revealed.findIndex((v) => v === null);
      if (i < 0 || i === p.length - 1) return false; // never give the whole code away
      revealed[i] = p.code[i]!;
      renderSlots();
      return true;
    },
    solveNow: () => {
      entry.length = 0;
      entry.push(...p.code);
      renderSlots();
      submit();
    },
    onKey: (e) => {
      if (/^[0-9]$/.test(e.key)) press(Number(e.key));
      else if (e.key === 'Backspace') back();
      else return;
      e.preventDefault();
    },
  };
}
