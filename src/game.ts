import { FREE_UNDOS, UNDOS_PER_AD } from './core/adPolicy';
import { applyMove, canMove, cloneState, colorOf, hasAnyMove, isFrozen, isSolved, isTubeComplete, starsFor, type Move, type Puzzle, type State } from './core/board';
import { getLevel } from './core/levelStore';
import type { Level } from './core/levels';
import { getBrowserStorage, load, recordWin, save, totalStars, type SaveData } from './core/save';
import { kindOf, LEVEL_COUNT, type Mechanic } from './core/schedule';
import { solve } from './core/solver';
import { getLang, LANGS, setLang, t, type Key } from './i18n';
import { ads } from './platform/ads';
import { audio, vibrate } from './platform/audio';
import { BoardView } from './ui/boardView';
import { h, svg } from './ui/dom';
import { ICONS, LOGO } from './ui/icons';
import { introArt } from './ui/intro';

export type Screen = 'home' | 'levels' | 'play' | 'won';

interface PlayState {
  level: Level;
  /** the level's puzzle, plus the extra tube once earned */
  puzzle: Puzzle;
  state: State;
  /** states before each move (undo restores them exactly: ice, locks…) */
  history: State[];
  moves: Move[];
  selected: number | null;
  undosLeft: number;
  extraUsed: boolean;
  /** true while the level-1 tutorial is still followed move by move */
  tutorial: boolean;
  won: boolean;
}

const icon = (name: keyof typeof ICONS) => svg(ICONS[name]);

const INTRO_TEXT: Record<Mechanic, [Key, Key]> = {
  oneEmpty: ['introOneEmpty', 'introOneEmptyText'],
  hidden: ['introHidden', 'introHiddenText'],
  tall: ['introTall', 'introTallText'],
  lock: ['introLock', 'introLockText'],
  helper: ['introHelper', 'introHelperText'],
  frozen: ['introFrozen', 'introFrozenText'],
};

export class Game {
  private kv = getBrowserStorage();
  data: SaveData = load(this.kv);
  screen: Screen = 'home';
  private play: PlayState | null = null;
  private view: BoardView | null = null;
  private screenEl: HTMLElement;
  private toastEl: HTMLElement;
  private toastTimer = 0;
  private overlay: HTMLElement | null = null;
  private busy = false;
  private hud: { moves: HTMLElement; undo: HTMLButtonElement; undoBadge: HTMLElement; extra: HTMLButtonElement } | null = null;
  private hidden = false;
  private adPlaying = false;

  constructor(private root: HTMLElement) {
    this.screenEl = root.querySelector('#screen')!;
    this.toastEl = root.querySelector('#toast')!;
    audio.setMuted(this.data.settings.muted);
    this.applySymbols();
    ads.setHooks({
      onAdStart: () => {
        this.adPlaying = true;
        audio.setAdMuted(true);
        this.root.classList.add('ad-playing');
        this.syncGameplay();
      },
      onAdEnd: () => {
        this.adPlaying = false;
        audio.setAdMuted(false);
        this.root.classList.remove('ad-playing');
        this.syncGameplay();
      },
    });
    document.addEventListener('visibilitychange', () => {
      this.hidden = document.hidden;
      this.syncGameplay();
    });
    // AudioContext can only start after a user gesture
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('keydown', (e) => this.onKey(e));
  }

  /** gameplayStart only while a level is really being played. */
  private syncGameplay(): void {
    ads.setGameplay(this.screen === 'play' && !this.overlay && !this.hidden && !this.adPlaying && !!this.play && !this.play.won);
  }

  private persist(): void {
    save(this.kv, this.data);
  }

  private applySymbols(): void {
    this.root.classList.toggle('symbols', this.data.settings.symbols);
  }

  private toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2200);
  }

  private setScreen(name: Screen, content: HTMLElement): void {
    this.closeOverlay();
    this.view?.destroy();
    this.view = null;
    this.hud = null;
    this.screen = name;
    this.screenEl.textContent = '';
    this.screenEl.append(content);
    this.root.scrollTop = 0;
    this.syncGameplay();
  }

  private soundButton(): HTMLButtonElement {
    const btn = h('button', { class: 'icon-btn', type: 'button', 'data-testid': 'mute', 'aria-label': t('sound') });
    const paint = () => {
      btn.replaceChildren(icon(this.data.settings.muted ? 'soundOff' : 'soundOn'));
      btn.setAttribute('aria-pressed', String(!this.data.settings.muted));
    };
    paint();
    btn.addEventListener('click', () => {
      this.data.settings.muted = !this.data.settings.muted;
      audio.setMuted(this.data.settings.muted);
      this.persist();
      paint();
      audio.tap();
    });
    return btn;
  }

  private starCount(): HTMLElement {
    return h('span', { class: 'star-count', 'data-testid': 'star-total', 'aria-label': t('stars', { n: totalStars(this.data, kindOf) }) }, svg(ICONS.star), String(totalStars(this.data, kindOf)));
  }

  /* ------------------------------------------------------------------ home */

  home(): void {
    const next = Math.min(this.data.unlocked, LEVEL_COUNT);
    const content = h(
      'section',
      { class: 'home', 'data-testid': 'home' },
      h('div', { class: 'topbar' }, this.settingsButton(), h('span', { class: 'spacer' }), this.starCount(), h('span', { class: 'spacer' }), this.soundButton()),
      h('div', { class: 'logo' }, svg(LOGO)),
      h('h1', { class: 'title', text: t('title') }),
      h('p', { class: 'tagline', text: t('tagline') }),
      h(
        'div',
        { class: 'menu' },
        h(
          'button',
          { class: 'btn primary big', type: 'button', 'data-testid': 'play', onclick: () => this.startLevel(next) },
          icon('play'),
          h('span', {}, h('b', { text: t('play') }), h('small', { text: t('continueLevel', { n: next }) })),
        ),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'levels', onclick: () => this.levelSelect() }, icon('levels'), t('levels')),
      ),
    );
    this.play = null;
    this.setScreen('home', content);
  }

  private settingsButton(): HTMLButtonElement {
    return h('button', { class: 'icon-btn', type: 'button', 'data-testid': 'settings', 'aria-label': t('settings'), onclick: () => this.openSettings() }, icon('gear'));
  }

  private openSettings(): void {
    const s = this.data.settings;
    const toggle = (label: string, id: string, get: () => boolean, set: (v: boolean) => void) => {
      const btn = h('button', { class: 'toggle', type: 'button', role: 'switch', 'data-testid': id });
      const paint = () => {
        btn.setAttribute('aria-checked', String(get()));
        btn.textContent = get() ? t('on') : t('off');
      };
      paint();
      btn.addEventListener('click', () => {
        set(!get());
        this.persist();
        paint();
        audio.tap();
      });
      return h('label', { class: 'row' }, h('span', { text: label }), btn);
    };
    const lang = h('select', { 'data-testid': 'lang', 'aria-label': t('language') });
    for (const [code, dict] of Object.entries(LANGS)) {
      const o = h('option', { value: code, text: dict.langName });
      if (code === getLang()) o.selected = true;
      lang.append(o);
    }
    lang.addEventListener('change', () => {
      setLang(lang.value);
      s.lang = lang.value;
      this.persist();
      this.closeOverlay();
      this.refresh();
    });
    const panel = h(
      'div',
      { class: 'panel', 'data-testid': 'settings-panel' },
      h('h2', { text: t('settings') }),
      h('label', { class: 'row' }, h('span', { text: t('language') }), lang),
      toggle(t('sound'), 'opt-sound', () => !s.muted, (v) => {
        s.muted = !v;
        audio.setMuted(s.muted);
      }),
      toggle(t('vibration'), 'opt-vibration', () => s.vibration, (v) => {
        s.vibration = v;
        vibrate(v, 15);
      }),
      toggle(t('symbols'), 'opt-symbols', () => s.symbols, (v) => {
        s.symbols = v;
        this.applySymbols();
      }),
      h('button', { class: 'btn primary', type: 'button', 'data-testid': 'close', onclick: () => this.closeOverlay() }, t('close')),
    );
    this.showOverlay(panel);
  }

  /** Re-render the current screen (after a language change). */
  private refresh(): void {
    if (this.screen === 'home') this.home();
    else if (this.screen === 'levels') this.levelSelect();
    else if (this.play) {
      const p = this.play;
      this.renderPlay();
      if (p.won) this.showWin(false);
    }
  }

  private showOverlay(panel: HTMLElement, dismissable = true): void {
    this.closeOverlay();
    const ov = h('div', {
      class: 'overlay',
      onpointerdown: (e: Event) => {
        if (e.target === ov && dismissable && this.screen !== 'won') this.closeOverlay();
      },
    });
    ov.append(panel);
    this.root.append(ov);
    this.overlay = ov;
    this.syncGameplay();
    panel.querySelector<HTMLElement>('button, select')?.focus({ preventScroll: true });
  }

  private closeOverlay(): void {
    if (!this.overlay) return;
    this.overlay.remove();
    this.overlay = null;
    if (this.screen === 'won') this.screen = 'play';
    this.syncGameplay();
  }

  /* ---------------------------------------------------------------- levels */

  levelSelect(): void {
    const grid = h('div', { class: 'grid', 'data-testid': 'level-grid' });
    let current: HTMLElement | null = null;
    for (let n = 1; n <= LEVEL_COUNT; n++) {
      const locked = n > this.data.unlocked;
      const stars = this.data.stars[n - 1] ?? 0;
      const hard = kindOf(n) === 'hard';
      const btn = h(
        'button',
        {
          class: `cell${locked ? ' locked' : ''}${stars ? ' done' : ''}${hard ? ' hard' : ''}`,
          type: 'button',
          'data-testid': `level-${n}`,
          'aria-label': `${t('level', { n })}${hard ? ` — ${t('hardLevel')}` : ''}${locked ? ` — ${t('locked')}` : stars ? ` — ${t('stars', { n: stars })}` : ''}`,
          disabled: locked,
          onclick: () => this.startLevel(n),
        },
        locked ? icon('lock') : h('span', { class: 'num', text: n }),
        !locked && h('span', { class: 'mini-stars' }, ...[1, 2, 3].map((i) => h('i', { class: i <= stars ? 'on' : '' }))),
        hard && h('span', { class: 'hard-dot', 'aria-hidden': 'true' }, svg(ICONS.flame)),
      );
      if (n === this.data.unlocked) current = btn;
      grid.append(btn);
    }
    const content = h(
      'section',
      { class: 'levels', 'data-testid': 'levels-screen' },
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'icon-btn', type: 'button', 'data-testid': 'back', 'aria-label': t('back'), onclick: () => this.home() }, icon('back')),
        h('h2', { text: t('levels') }),
        this.starCount(),
        this.soundButton(),
      ),
      h('div', { class: 'grid-wrap' }, grid),
    );
    this.setScreen('levels', content);
    // scroll only the grid (scrollIntoView would also scroll the page container)
    const wrap = content.querySelector<HTMLElement>('.grid-wrap')!;
    requestAnimationFrame(() => {
      if (current) wrap.scrollTop = current.offsetTop - wrap.clientHeight / 2 + current.clientHeight / 2;
    });
  }

  /* ------------------------------------------------------------------ play */

  startLevel(n: number): void {
    const level = getLevel(n);
    this.play = {
      level,
      puzzle: { ...level.puzzle, tubes: level.puzzle.tubes.slice() },
      state: cloneState(level.start),
      history: [],
      moves: [],
      selected: null,
      undosLeft: FREE_UNDOS,
      extraUsed: false,
      tutorial: level.n === 1,
      won: false,
    };
    this.renderPlay();
    if (level.intro && !this.data.seenIntros.includes(level.intro)) this.showIntro(level.intro);
  }

  /** One screen that shows the new mechanic with a little picture before the level starts. */
  private showIntro(m: Mechanic): void {
    const [title, text] = INTRO_TEXT[m];
    const panel = h(
      'div',
      { class: 'panel intro', 'data-testid': 'intro', 'data-mechanic': m },
      h('span', { class: 'chip new', text: t('newIdea') }),
      introArt(m),
      h('h2', { text: t(title) }),
      h('p', { class: 'muted', text: t(text) }),
      h(
        'button',
        {
          class: 'btn primary',
          type: 'button',
          'data-testid': 'intro-ok',
          onclick: () => {
            if (!this.data.seenIntros.includes(m)) this.data.seenIntros.push(m);
            this.persist();
            this.closeOverlay();
          },
        },
        t('gotIt'),
      ),
    );
    this.showOverlay(panel, false);
  }

  private renderPlay(): void {
    const p = this.play!;
    const view = new BoardView((i) => this.tap(i));
    const movesEl = h('div', { class: 'moves', 'data-testid': 'moves' });
    const undoBadge = h('span', { class: 'badge' });
    const undo = h(
      'button',
      { class: 'tool', type: 'button', 'data-testid': 'undo', onclick: () => void this.undo() },
      icon('undo'),
      h('span', { class: 'lbl', text: t('undo') }),
      undoBadge,
    );
    const extra = h(
      'button',
      { class: 'tool', type: 'button', 'data-testid': 'extra', onclick: () => void this.extraTube() },
      icon('tube'),
      h('span', { class: 'lbl', text: t('extraTube') }),
      h('span', { class: 'badge ad' }, svg(ICONS.ad)),
    );
    const restart = h(
      'button',
      { class: 'tool', type: 'button', 'data-testid': 'restart', onclick: () => this.restart() },
      icon('restart'),
      h('span', { class: 'lbl', text: t('restart') }),
    );
    const kind = p.level.kind;
    const chip =
      kind === 'hard'
        ? h('span', { class: 'chip hard', 'data-testid': 'hard-badge' }, svg(ICONS.flame), t('hardLevel'), h('b', { text: '×2' }))
        : kind === 'relax'
          ? h('span', { class: 'chip relax', 'data-testid': 'relax-badge' }, svg(ICONS.leaf), t('relaxLevel'))
          : null;
    const content = h(
      'section',
      { class: `play kind-${kind}`, 'data-testid': 'play-screen', 'data-level': p.level.n },
      h(
        'div',
        { class: 'topbar' },
        h('button', { class: 'icon-btn', type: 'button', 'data-testid': 'home', 'aria-label': t('home'), onclick: () => this.home() }, icon('home')),
        h('div', { class: 'title-block' }, h('div', { class: 'lvl', 'data-testid': 'level-label', text: t('level', { n: p.level.n }) }), movesEl),
        this.soundButton(),
      ),
      h('div', { class: 'hint-text', 'data-testid': 'hint' }, chip ?? (p.tutorial ? t('hint') : '')),
      view.el,
      h('div', { class: 'toolbar' }, undo, extra, restart),
    );
    this.setScreen('play', content);
    this.view = view;
    this.hud = { moves: movesEl, undo, undoBadge, extra };
    view.setBoard(p.puzzle, p.state, p.level.hidden);
    // a restart or a language change re-renders: balls already revealed stay revealed
    if (p.moves.length) view.revealTops();
    p.state.balls.forEach((tube, i) => view.setComplete(i, isTubeComplete(p.puzzle, tube) ? colorOf(tube[0]!) : null));
    if (p.selected !== null) view.lift(p.selected);
    view.setSelected(p.selected);
    this.updateHud();
    this.updateHint();
  }

  private updateHud(): void {
    const p = this.play;
    if (!p || !this.hud) return;
    this.hud.moves.textContent = t('moves', { n: p.moves.length });
    const needAd = p.undosLeft <= 0;
    this.hud.undoBadge.replaceChildren(needAd ? svg(ICONS.ad) : String(p.undosLeft));
    this.hud.undoBadge.classList.toggle('ad', needAd);
    this.hud.undo.disabled = p.moves.length === 0 || p.won;
    this.hud.extra.disabled = p.extraUsed || p.won;
    this.hud.extra.classList.toggle('used', p.extraUsed);
  }

  private updateHint(): void {
    const p = this.play;
    if (!p || !this.view) return;
    if (!p.tutorial) {
      this.view.setHint(null);
      return;
    }
    const m = p.level.solution[p.moves.length];
    if (!m) return this.view.setHint(null);
    this.view.setHint(p.selected === null ? m.from : p.selected === m.from ? m.to : null);
  }

  private haptic(pattern: number | number[]): void {
    vibrate(this.data.settings.vibration, pattern);
  }

  /** Can the player pick up the top ball of this tube? */
  private liftable(i: number): boolean {
    const p = this.play!;
    const tube = p.state.balls[i]!;
    return tube.length > 0 && !p.state.locked[i] && !isFrozen(tube[tube.length - 1]!) && !isTubeComplete(p.puzzle, tube);
  }

  tap(i: number): void {
    const p = this.play;
    const view = this.view;
    if (!p || !view || p.won || this.busy || this.overlay) return;
    if (!p.state.balls[i]) return;
    if (p.selected === null) {
      if (!this.liftable(i)) {
        view.shake(i);
        if (p.state.locked[i] || p.state.balls[i]!.length) audio.nope();
        return;
      }
      p.selected = i;
      view.lift(i);
      const tube = p.state.balls[i]!;
      audio.lift(colorOf(tube[tube.length - 1]!));
    } else if (p.selected === i) {
      view.lower(i);
      p.selected = null;
    } else if (canMove(p.puzzle, p.state, p.selected, i)) {
      this.doMove(p.selected, i);
    } else {
      // not allowed: put the ball back and pick up the tapped tube instead (if it can be picked)
      audio.nope();
      view.shake(i);
      view.lower(p.selected);
      p.selected = null;
      if (this.liftable(i)) {
        p.selected = i;
        view.lift(i);
      }
    }
    view.setSelected(p.selected);
    this.updateHud();
    this.updateHint();
  }

  private doMove(from: number, to: number): void {
    const p = this.play!;
    const view = this.view!;
    const src = p.state.balls[from]!;
    const color = colorOf(src[src.length - 1]!);
    const before = cloneState(p.state);
    const fx = applyMove(p.puzzle, p.state, { from, to });
    if (!fx) return;
    if (p.tutorial && !sameMove(p.level.solution[p.moves.length], { from, to })) p.tutorial = false;
    p.history.push(before);
    p.moves.push({ from, to });
    p.selected = null;
    const ms = view.move(from, to);
    window.setTimeout(() => {
      audio.drop(color);
      this.haptic(fx.completed ? [12, 40, 18] : 8);
      if (fx.completed) {
        audio.tubeDone(color);
        view.setComplete(to, color);
      }
      if (view.revealTops()) audio.reveal();
      if (fx.thawed.length) audio.thaw();
      if (fx.unlocked.length) audio.opened();
      view.applyStatus(p.state);
    }, ms * 0.85);
    if (isSolved(p.puzzle, p.state)) this.win(ms);
    else if (!hasAnyMove(p.puzzle, p.state)) window.setTimeout(() => this.play === p && this.showStuck(), ms + 300);
  }

  /** No losing: when no move is possible, offer a way out. */
  private showStuck(): void {
    const p = this.play;
    if (!p || p.won || this.overlay) return;
    const panel = h(
      'div',
      { class: 'panel', 'data-testid': 'stuck' },
      h('h2', { text: t('stuckTitle') }),
      h('p', { class: 'muted', text: t('stuckText') }),
      h('button', { class: 'btn primary', type: 'button', 'data-testid': 'stuck-undo', onclick: () => (this.closeOverlay(), void this.undo()) }, icon('undo'), t('undo')),
      !p.extraUsed &&
        h(
          'button',
          { class: 'btn', type: 'button', 'data-testid': 'stuck-extra', onclick: () => (this.closeOverlay(), void this.extraTube()) },
          icon('tube'),
          t('extraTube'),
          h('span', { class: 'badge-inline' }, svg(ICONS.ad)),
        ),
      h('button', { class: 'btn', type: 'button', 'data-testid': 'stuck-restart', onclick: () => this.restart() }, icon('restart'), t('restart')),
    );
    this.showOverlay(panel);
  }

  private async rewarded(): Promise<boolean> {
    if (this.busy) return false;
    this.busy = true;
    try {
      const res = await ads.rewarded();
      if (res === 'failed') {
        this.toast(t('noAd'));
        return false;
      }
      return true;
    } finally {
      this.busy = false;
    }
  }

  async undo(): Promise<void> {
    const p = this.play;
    if (!p || !this.view || p.won || p.moves.length === 0 || this.busy) return;
    if (p.undosLeft <= 0) {
      if (!(await this.rewarded())) return;
      if (this.play !== p) return;
      p.undosLeft += UNDOS_PER_AD;
    }
    if (p.selected !== null) {
      this.view.lower(p.selected);
      p.selected = null;
    }
    const m = p.moves.pop()!;
    p.state = p.history.pop()!;
    p.undosLeft--;
    p.tutorial = false;
    this.view.move(m.to, m.from);
    this.view.applyStatus(p.state, false);
    p.state.balls.forEach((tube, i) => this.view!.setComplete(i, isTubeComplete(p.puzzle, tube) ? colorOf(tube[0]!) : null));
    const tube = p.state.balls[m.from]!;
    audio.lift(colorOf(tube[tube.length - 1]!));
    this.view.setSelected(null);
    this.updateHud();
    this.updateHint();
  }

  async extraTube(): Promise<void> {
    const p = this.play;
    if (!p || !this.view || p.won || p.extraUsed || this.busy) return;
    if (!(await this.rewarded())) return;
    if (this.play !== p || p.extraUsed) return;
    p.extraUsed = true;
    p.tutorial = false;
    p.puzzle.tubes.push({ cap: p.puzzle.perColor, lock: null });
    // the extra tube exists in every saved state too, so undo keeps it
    for (const s of [p.state, ...p.history]) {
      s.balls.push([]);
      s.locked.push(false);
    }
    this.view.addTube(p.puzzle.perColor);
    audio.tubeDone(1);
    this.updateHud();
    this.updateHint();
  }

  restart(): void {
    const p = this.play;
    if (!p || this.busy) return;
    audio.tap();
    // the extra tube stays if it was earned; undos reset to the free amount
    const state = cloneState(p.level.start);
    if (p.extraUsed) {
      state.balls.push([]);
      state.locked.push(false);
    }
    Object.assign(p, { state, history: [], moves: [], selected: null, undosLeft: FREE_UNDOS, tutorial: p.level.n === 1, won: false });
    this.renderPlay();
  }

  private win(delayMs: number): void {
    const p = this.play!;
    p.won = true;
    const stars = starsFor(p.moves.length, p.level.par);
    this.data = recordWin(this.data, p.level.n, stars);
    this.persist();
    this.syncGameplay();
    ads.happytime();
    this.updateHud();
    this.view?.setHint(null);
    window.setTimeout(() => {
      if (this.play !== p) return;
      audio.win();
      this.haptic([20, 60, 20, 60, 30]);
      this.root.classList.add('celebrate');
      window.setTimeout(() => this.root.classList.remove('celebrate'), 1200);
      this.showWin(true);
    }, delayMs + 350);
  }

  private showWin(animate: boolean): void {
    const p = this.play!;
    const stars = starsFor(p.moves.length, p.level.par);
    const isLast = p.level.n >= LEVEL_COUNT;
    const hard = p.level.kind === 'hard';
    const panel = h(
      'div',
      { class: `panel win${animate ? ' animate' : ''}`, 'data-testid': 'win', 'data-stars': stars },
      h('h2', { text: t('sorted') }),
      h('div', { class: 'stars' }, ...[1, 2, 3].map((i) => h('span', { class: `star${i <= stars ? ' on' : ''}`, style: `--i:${i}` }, svg(ICONS.star)))),
      hard && h('p', { class: 'chip hard', 'data-testid': 'x2' }, svg(ICONS.flame), t('doubleStars')),
      h('p', { class: 'muted', text: `${t('level', { n: p.level.n })} · ${t('moves', { n: p.moves.length })}` }),
      !isLast && h('button', { class: 'btn primary big', type: 'button', 'data-testid': 'next', onclick: () => void this.next() }, t('next')),
      h(
        'div',
        { class: 'row-btns' },
        h('button', { class: 'btn', type: 'button', 'data-testid': 'replay', onclick: () => this.startLevel(p.level.n) }, icon('restart'), t('replay')),
        h('button', { class: 'btn', type: 'button', 'data-testid': 'to-levels', onclick: () => this.levelSelect() }, icon('levels'), t('levels')),
      ),
    );
    this.showOverlay(panel);
    this.screen = 'won';
  }

  async next(): Promise<void> {
    const p = this.play;
    if (!p || this.busy) return;
    this.busy = true;
    try {
      this.closeOverlay();
      // natural break between levels: the only place a midgame ad may appear
      await ads.midgame(p.level.n);
    } finally {
      this.busy = false;
    }
    this.startLevel(p.level.n + 1);
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.overlay && this.screen !== 'won' && !this.overlay.querySelector('[data-testid=intro]')) {
      this.closeOverlay();
      return;
    }
    if (this.screen !== 'play' || this.overlay) return;
    if ((e.key === 'z' && (e.ctrlKey || e.metaKey)) || e.key === 'u' || e.key === 'Backspace') {
      e.preventDefault();
      void this.undo();
    } else if (e.key === 'r') this.restart();
    else if (/^[1-9]$/.test(e.key)) this.tap(Number(e.key) - 1);
    else if (e.key === '0') this.tap(9);
  }

  /** Test/debug hook (not exposed in the CrazyGames build). */
  debug() {
    return {
      screen: () => this.screen,
      level: () => this.play?.level.n ?? 0,
      moves: () => this.play?.moves.length ?? 0,
      /** moves that solve the current board from here (null if none found) */
      solution: (): Move[] | null => {
        const p = this.play;
        if (!p) return null;
        if (p.moves.length === 0 && !p.extraUsed) return p.level.solution;
        return solve(p.puzzle, p.state);
      },
    };
  }
}

const sameMove = (a: Move | undefined, b: Move): boolean => !!a && a.from === b.from && a.to === b.to;
